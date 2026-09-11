// Tek oturumun canlı durumu. Ağ ve DB bilmez: Client arayüzü + Persistence enjekte edilir.
import { nanoid } from "nanoid";
import {
  MAX_PARTICIPANTS,
  type AnswerValue, type LeaderboardEntry, type Participant, type Reaction, type ServerMessage, type SessionMeta,
  type SessionPhase, type SessionSnapshot, type Slide, type SlidePhase, type Tally, type Team, type TeamStanding,
} from "@sahne/protocol";
import {
  allowsMultipleAnswers, buildLeaderboard, buildTally, buildTeamStandings, fastestCorrect, isScored, missedAnswer, pickTeam,
  ranksOf, scoreAnswer, transition, validateAnswerForSlide,
  type AnswerRecord, type HostAction, type Upvotes,
} from "@sahne/engine";
import type { Persistence } from "./persistence";

export interface Client { send(m: ServerMessage): void; close(): void }
export type ErrorCode = Extract<ServerMessage, { t: "error" }>["code"];
export type JoinResult = { ok: true; participant: Participant; token: string } | { ok: false; code: ErrorCode };
export interface JoinOptions { deviceId?: string | null; teamId?: string | null }

interface Answer extends AnswerRecord { id: string; msTaken: number; correct: boolean | null; pointsAwarded: number }
interface Member { p: Participant; token: string; deviceId: string | null }
interface Bucket { tokens: number; last: number }

export interface LiveSessionOptions {
  now?: () => number;
  onEnded?: (s: LiveSession) => void;
  log?: (msg: string, err?: unknown) => void;
}

const AUTO_LOCK_GRACE_MS = 500;
/** qa slaydında kişi başı en fazla soru. */
export const MAX_QUESTIONS_PER_PARTICIPANT = 5;
/** Tepki sınırı: kişi başı saniyede 2 (token bucket, kapasite 2). */
const REACT_RATE_PER_S = 2;
const REACT_BURST = 2;

export class LiveSession {
  phase: SessionPhase = "lobby";
  idx = -1;
  slidePhase: SlidePhase | null = null;
  slideStartedAt: number | null = null;
  endedAt: number | null = null;

  private members = new Map<string, Member>();        // participantId → üye
  private byToken = new Map<string, string>();        // token → participantId
  private hosts = new Set<Client>();
  private players = new Map<string, Client>();        // participantId → bağlantı
  private clientPid = new Map<Client, string>();
  /** slideId → answerId → cevap. Tek cevaplı slaytlarda katılımcı başına bir kayıt; qa'da en fazla 5. */
  private answers = new Map<string, Map<string, Answer>>();
  /** qa: slideId → questionId → oy veren participantId'ler (bellekte, deneme kapsamı). */
  private upvotes = new Map<string, Upvotes>();
  private reactBuckets = new Map<string, Bucket>();
  private scoredSlides = new Set<string>();
  private prevRanks = new Map<string, Map<string, number>>();     // slideId → reveal öncesi sıralar
  private prevTeamRanks = new Map<string, Map<string, number>>(); // slideId → reveal öncesi takım sıraları
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly now: () => number;
  private readonly log: (msg: string, err?: unknown) => void;

  constructor(
    public meta: SessionMeta,
    public slides: Slide[],
    public readonly hostSecret: string,
    private readonly persist: Persistence,
    private readonly opts: LiveSessionOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? ((m, e) => console.error(`[live ${meta.code}] ${m}`, e ?? ""));
    this.slides = [...slides].sort((a, b) => a.idx - b.idx);
  }

  /* ---------- görünüm ---------- */

  get currentSlide(): Slide | undefined { return this.idx >= 0 ? this.slides[this.idx] : undefined; }
  get participants(): Participant[] { return [...this.members.values()].map((m) => m.p); }
  get teamMode(): boolean { return this.meta.teams.length > 0; }

  private answersFor(slideId: string): Map<string, Answer> {
    let m = this.answers.get(slideId);
    if (!m) { m = new Map(); this.answers.set(slideId, m); }
    return m;
  }
  private upvotesFor(slideId: string): Upvotes {
    let m = this.upvotes.get(slideId);
    if (!m) { m = new Map(); this.upvotes.set(slideId, m); }
    return m;
  }
  /** Katılımcının bu slayttaki cevapları (qa'da birden çok). */
  private answersOf(slideId: string, pid: string): Answer[] {
    return [...this.answersFor(slideId).values()].filter((a) => a.participantId === pid);
  }
  private answeredCount(slideId: string): number {
    return new Set([...this.answersFor(slideId).values()].map((a) => a.participantId)).size;
  }

  private tallyFor(slide: Slide): Tally { return buildTally(slide, [...this.answersFor(slide.id).values()], this.upvotes.get(slide.id)); }

  snapshot(): SessionSnapshot {
    const cur = this.currentSlide;
    return {
      meta: this.meta,
      phase: this.phase,
      slides: this.slides,
      currentSlideIdx: this.idx,
      slidePhase: this.slidePhase,
      slideStartedAt: this.slideStartedAt,
      serverNow: this.now(),
      participants: this.participants,
      answeredCount: cur ? this.answeredCount(cur.id) : 0,
    };
  }

  leaderboard(slideId?: string): LeaderboardEntry[] {
    return buildLeaderboard(this.participants, slideId ? this.prevRanks.get(slideId) : undefined);
  }

  teamStandings(slideId?: string): TeamStanding[] {
    if (!this.teamMode) return [];
    return buildTeamStandings(this.meta.teams, this.participants, slideId ? this.prevTeamRanks.get(slideId) : undefined);
  }

  results(): { slides: { slide: Slide; tally: Tally }[]; leaderboard: LeaderboardEntry[]; teams: TeamStanding[] } {
    return { slides: this.slides.map((slide) => ({ slide, tally: this.tallyFor(slide) })), leaderboard: this.leaderboard(), teams: this.teamStandings() };
  }

  /** Lobby'de slayt listesi değiştirilebilir (PUT /slides). */
  setSlides(slides: Slide[]): boolean {
    if (this.phase !== "lobby") return false;
    this.slides = [...slides].sort((a, b) => a.idx - b.idx);
    this.broadcast({ t: "state:snapshot", snapshot: this.snapshot() });
    return true;
  }

  /** Lobby'de ayarlar (PUT /settings). Takım listesi değişince mevcut katılımcılar yeniden atanır. */
  setSettings(patch: { teams?: Team[]; seriesKey?: string | null }): boolean {
    if (this.phase !== "lobby") return false;
    if (patch.teams !== undefined) {
      this.meta = { ...this.meta, teams: patch.teams };
      const valid = new Set(patch.teams.map((t) => t.id));
      for (const m of this.members.values()) if (!m.p.teamId || !valid.has(m.p.teamId)) m.p.teamId = null;
      for (const m of this.members.values()) if (!m.p.teamId) m.p.teamId = pickTeam(this.meta.teams, this.participants);
    }
    if (patch.seriesKey !== undefined) this.meta = { ...this.meta, seriesKey: patch.seriesKey };
    this.broadcast({ t: "state:snapshot", snapshot: this.snapshot() });
    return true;
  }

  /* ---------- bağlantılar ---------- */

  hostJoin(c: Client): void {
    this.hosts.add(c);
    c.send({ t: "state:snapshot", snapshot: this.snapshot() });
  }

  playerJoin(c: Client, nickname: string, opts: JoinOptions = {}): JoinResult {
    if (this.phase === "ended") return { ok: false, code: "session_ended" };
    if (this.members.size >= MAX_PARTICIPANTS) return { ok: false, code: "session_full" };
    const nick = nickname.trim();
    const lower = nick.toLocaleLowerCase("tr");
    for (const m of this.members.values()) if (m.p.nickname.toLocaleLowerCase("tr") === lower) return { ok: false, code: "nickname_taken" };

    // Takım: mod açıkken verilen id geçerli olmalı; verilmediyse en az üyeli takım. Mod kapalıyken teamId yok sayılır.
    let teamId: string | null = null;
    if (this.teamMode) {
      if (opts.teamId) {
        if (!this.meta.teams.some((t) => t.id === opts.teamId)) return { ok: false, code: "bad_team" };
        teamId = opts.teamId;
      } else {
        teamId = pickTeam(this.meta.teams, this.participants);
      }
    }

    const p: Participant = { id: nanoid(12), nickname: nick, avatarSeed: nanoid(8), score: 0, streak: 0, connected: true, teamId };
    const token = nanoid(24);
    const deviceId = opts.deviceId ?? null;
    this.members.set(p.id, { p, token, deviceId });
    this.byToken.set(token, p.id);
    this.attachPlayer(c, p.id);
    this.persist.addParticipant(this.meta.id, p, deviceId).catch((e) => this.log("addParticipant", e));
    c.send({ t: "player:joined", participantId: p.id, token, nickname: p.nickname, avatarSeed: p.avatarSeed, teamId });
    c.send({ t: "state:snapshot", snapshot: this.snapshot() });
    this.participantsChanged();
    return { ok: true, participant: p, token };
  }

  playerResume(c: Client, token: string): Participant | null {
    const pid = this.byToken.get(token);
    const m = pid ? this.members.get(pid) : undefined;
    if (!m) return null;
    m.p.connected = true;
    this.attachPlayer(c, m.p.id);
    c.send({ t: "state:snapshot", snapshot: this.snapshot() });
    this.participantsChanged();
    return m.p;
  }

  private attachPlayer(c: Client, pid: string) {
    const old = this.players.get(pid);
    if (old && old !== c) { this.clientPid.delete(old); old.close(); }
    this.players.set(pid, c);
    this.clientPid.set(c, pid);
  }

  participantIdOf(c: Client): string | undefined { return this.clientPid.get(c); }

  /** Bağlantı koptu: host ise listeden çıkar, katılımcı ise connected=false. */
  detach(c: Client): void {
    if (this.hosts.delete(c)) return;
    const pid = this.clientPid.get(c);
    if (!pid) return;
    this.clientPid.delete(c);
    if (this.players.get(pid) === c) this.players.delete(pid);
    const m = this.members.get(pid);
    if (m) { m.p.connected = false; this.participantsChanged(); }
  }

  kick(pid: string): void {
    const m = this.members.get(pid);
    if (!m) return;
    const c = this.players.get(pid);
    if (c) { c.send({ t: "error", code: "kicked" }); this.clientPid.delete(c); this.players.delete(pid); c.close(); }
    this.members.delete(pid);
    this.byToken.delete(m.token);
    this.participantsChanged();
  }

  /* ---------- akış ---------- */

  hostAction(action: HostAction): boolean {
    const next = transition({ phase: this.phase, slidePhase: this.slidePhase, idx: this.idx, total: this.slides.length }, action);
    if (!next) return false;
    this.clearLockTimer();
    this.phase = next.phase; this.idx = next.idx; this.slidePhase = next.slidePhase;

    if (next.phase === "ended") { this.end(); return true; }
    this.persist.setState(this.meta.id, this.phase, this.idx).catch((e) => this.log("setState", e));

    switch (action) {
      case "start":
      case "next": this.openSlide(); break;
      case "lock": this.broadcast({ t: "slide:phase", phase: "locked" }); break;
      case "reveal": this.reveal(); break;
      case "prev": {
        // Geri dönülen slayt "revealed" gelir: tam snapshot + reveal verisi tekrar gönderilir.
        this.broadcast({ t: "state:snapshot", snapshot: this.snapshot() });
        this.reveal();
        break;
      }
    }
    return true;
  }

  private openSlide() {
    const slide = this.currentSlide;
    if (!slide) return;
    this.slideStartedAt = this.now();
    this.broadcast({ t: "slide:open", slide, idx: this.idx, startedAt: this.slideStartedAt, serverNow: this.slideStartedAt });
    this.lockTimer = setTimeout(() => {
      this.lockTimer = null;
      if (this.currentSlide?.id === slide.id && this.slidePhase === "open") this.hostAction("lock");
    }, slide.timeLimitS * 1000 + AUTO_LOCK_GRACE_MS);
  }

  private clearLockTimer() {
    if (this.lockTimer) { clearTimeout(this.lockTimer); this.lockTimer = null; }
  }

  /** Puanlama bir slayt için yalnızca bir kez uygulanır; tekrar reveal (prev) aynı sonucu yeniden yayınlar. */
  private reveal() {
    const slide = this.currentSlide;
    if (!slide) return;
    const answers = this.answersFor(slide.id);
    // Tek cevaplı slaytlarda pid → cevap; qa'da ilk cevap (puansız, sadece "cevapladı mı" için).
    const byPid = new Map<string, Answer>();
    for (const a of answers.values()) if (!byPid.has(a.participantId)) byPid.set(a.participantId, a);

    if (!this.scoredSlides.has(slide.id)) {
      this.scoredSlides.add(slide.id);
      this.prevRanks.set(slide.id, ranksOf(this.leaderboard()));
      if (this.teamMode) this.prevTeamRanks.set(slide.id, new Map(this.teamStandings().map((t) => [t.teamId, t.rank])));
      const rows = [];
      for (const m of this.members.values()) {
        const a = byPid.get(m.p.id);
        if (a) {
          const r = scoreAnswer({ slide, value: a.value, msTaken: a.msTaken, prevStreak: m.p.streak });
          a.correct = r.correct; a.pointsAwarded = r.points;
          m.p.score += r.points; m.p.streak = r.streak;
        } else {
          m.p.streak = missedAnswer(slide, m.p.streak);
        }
        rows.push({ participantId: m.p.id, answered: !!a, correct: a?.correct ?? null, pointsAwarded: a?.pointsAwarded ?? 0, score: m.p.score, streak: m.p.streak });
      }
      if (isScored(slide) || answers.size > 0) this.persist.saveReveal(this.meta.id, slide.id, rows).catch((e) => this.log("saveReveal", e));
    }

    const tally = this.tallyFor(slide);
    const correct = slide.type === "multiple_choice" && slide.mode === "game" ? slide.correctOptionIds : slide.type === "true_false" ? slide.correct : null;
    const leaderboard = this.leaderboard(slide.id);
    const fastest = isScored(slide)
      ? fastestCorrect([...byPid.values()].map((a) => ({ participantId: a.participantId, msTaken: a.msTaken, correct: a.correct })), this.participants)
      : [];
    const teams = this.teamStandings(slide.id);
    const base = { t: "slide:reveal" as const, slideId: slide.id, tally, correct, leaderboard, fastest, teams };

    for (const h of this.hosts) h.send(base);
    const byLb = new Map(leaderboard.map((e) => [e.participantId, e]));
    for (const [pid, c] of this.players) {
      const m = this.members.get(pid); const e = byLb.get(pid);
      if (!m || !e) continue;
      const a = byPid.get(pid);
      c.send({ ...base, you: { correct: a?.correct ?? null, pointsAwarded: a?.pointsAwarded ?? 0, score: m.p.score, rank: e.rank, rankDelta: e.rankDelta, streak: m.p.streak } });
    }
  }

  private end() {
    this.endedAt = this.now();
    this.slideStartedAt = null;
    const publicToken = nanoid(16);
    this.meta = { ...this.meta, publicToken };
    this.persist.setState(this.meta.id, "ended", this.idx).catch((e) => this.log("setState", e));
    this.persist.setEnded(this.meta.id, publicToken, this.endedAt).catch((e) => this.log("setEnded", e));
    this.broadcast({ t: "session:ended", podium: this.leaderboard().slice(0, 3), teams: this.teamStandings(), publicToken });
    this.opts.onEnded?.(this);
  }

  /* ---------- cevap ---------- */

  playerAnswer(pid: string, slideId: string, value: AnswerValue): ErrorCode | null {
    const slide = this.currentSlide;
    if (this.phase !== "live" || this.slidePhase !== "open" || !slide || slide.id !== slideId) return "not_open";
    const m = this.members.get(pid);
    if (!m) return "invalid";
    const bucket = this.answersFor(slide.id);
    const mine = this.answersOf(slide.id, pid).length;
    const multi = allowsMultipleAnswers(slide);
    if (mine >= (multi ? MAX_QUESTIONS_PER_PARTICIPANT : 1)) return "already_answered";
    if (!validateAnswerForSlide(slide, value)) return "invalid";
    const answeredAt = this.now();
    const msTaken = Math.max(0, answeredAt - (this.slideStartedAt ?? answeredAt));
    const id = nanoid(10);
    bucket.set(id, { id, participantId: pid, nickname: m.p.nickname, value, answeredAt, msTaken, correct: null, pointsAwarded: 0 });
    this.persist.saveAnswer(this.meta.id, slide.id, pid, id, value, answeredAt, msTaken).catch((e) => this.log("saveAnswer", e));
    this.players.get(pid)?.send({ t: "answer:ack", slideId: slide.id });
    this.sendTally(slide);
    return null;
  }

  /** qa: bir soruyu oyla / oyu geri al. Slayt güncel olmalı (open/locked/revealed fark etmez). */
  playerUpvote(pid: string, slideId: string, questionId: string): ErrorCode | null {
    const slide = this.currentSlide;
    if (this.phase !== "live" || !slide || slide.id !== slideId || slide.type !== "qa") return "not_open";
    if (!this.members.has(pid)) return "invalid";
    if (!this.answersFor(slide.id).has(questionId)) return "invalid";
    const votes = this.upvotesFor(slide.id);
    let set = votes.get(questionId);
    if (!set) { set = new Set(); votes.set(questionId, set); }
    if (set.has(pid)) set.delete(pid); else set.add(pid);
    this.sendTally(slide);
    return null;
  }

  /** Tepki: kişi başı 2/sn token bucket; aşınca rate_limited (bağlantı kapanmaz). Herkese yayınlanır. */
  playerReact(pid: string, emoji: Reaction): ErrorCode | null {
    if (!this.members.has(pid)) return "invalid";
    if (this.phase === "ended") return "session_ended";
    const t = this.now();
    let b = this.reactBuckets.get(pid);
    if (!b) { b = { tokens: REACT_BURST, last: t }; this.reactBuckets.set(pid, b); }
    b.tokens = Math.min(REACT_BURST, b.tokens + ((t - b.last) / 1000) * REACT_RATE_PER_S);
    b.last = t;
    if (b.tokens < 1) return "rate_limited";
    b.tokens -= 1;
    this.broadcast({ t: "reaction", emoji, participantId: pid });
    return null;
  }

  /**
   * qa slaydında tally herkese gider (katılımcılar oy verebilsin diye); diğer tiplerde yalnızca host'a
   * (insight: canlı tally; game: UI reveal öncesi sadece answeredCount gösterir).
   */
  private sendTally(slide: Slide) {
    const msg: ServerMessage = { t: "slide:tally", slideId: slide.id, tally: this.tallyFor(slide), answeredCount: this.answeredCount(slide.id) };
    if (slide.type === "qa") this.broadcast(msg);
    else for (const h of this.hosts) h.send(msg);
  }

  /* ---------- yardımcılar ---------- */

  private participantsChanged() {
    const msg: ServerMessage = { t: "participants:update", participants: this.participants };
    for (const h of this.hosts) h.send(msg);
  }

  private broadcast(msg: ServerMessage) {
    for (const h of this.hosts) h.send(msg);
    for (const c of this.players.values()) c.send(msg);
  }

  /** Bellekten atılırken: zamanlayıcı temizle, bağlantıları kapat. */
  dispose(): void {
    this.clearLockTimer();
    for (const h of this.hosts) h.close();
    for (const c of this.players.values()) c.close();
    this.hosts.clear(); this.players.clear(); this.clientPid.clear();
  }
}
