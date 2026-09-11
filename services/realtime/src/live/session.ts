// Tek oturumun canlı durumu. Ağ ve DB bilmez: Client arayüzü + Persistence enjekte edilir.
import { nanoid } from "nanoid";
import {
  MAX_PARTICIPANTS,
  type AnswerValue, type LeaderboardEntry, type Participant, type ServerMessage, type SessionMeta,
  type SessionPhase, type SessionSnapshot, type Slide, type SlidePhase, type Tally,
} from "@sahne/protocol";
import {
  buildLeaderboard, buildTally, isScored, missedAnswer, ranksOf, scoreAnswer, transition, validateAnswerForSlide,
  type AnswerRecord, type HostAction,
} from "@sahne/engine";
import type { Persistence } from "./persistence";

export interface Client { send(m: ServerMessage): void; close(): void }
export type ErrorCode = Extract<ServerMessage, { t: "error" }>["code"];
export type JoinResult = { ok: true; participant: Participant; token: string } | { ok: false; code: ErrorCode };

interface Answer extends AnswerRecord { msTaken: number; correct: boolean | null; pointsAwarded: number }
interface Member { p: Participant; token: string }

export interface LiveSessionOptions {
  now?: () => number;
  onEnded?: (s: LiveSession) => void;
  log?: (msg: string, err?: unknown) => void;
}

const AUTO_LOCK_GRACE_MS = 500;

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
  private answers = new Map<string, Map<string, Answer>>(); // slideId → pid → cevap
  private scoredSlides = new Set<string>();
  private prevRanks = new Map<string, Map<string, number>>(); // slideId → reveal öncesi sıralar
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

  private answersFor(slideId: string): Map<string, Answer> {
    let m = this.answers.get(slideId);
    if (!m) { m = new Map(); this.answers.set(slideId, m); }
    return m;
  }

  private tallyFor(slide: Slide): Tally { return buildTally(slide, [...this.answersFor(slide.id).values()]); }

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
      answeredCount: cur ? this.answersFor(cur.id).size : 0,
    };
  }

  leaderboard(slideId?: string): LeaderboardEntry[] {
    return buildLeaderboard(this.participants, slideId ? this.prevRanks.get(slideId) : undefined);
  }

  results(): { slides: { slide: Slide; tally: Tally }[]; leaderboard: LeaderboardEntry[] } {
    return { slides: this.slides.map((slide) => ({ slide, tally: this.tallyFor(slide) })), leaderboard: this.leaderboard() };
  }

  /** Lobby'de slayt listesi değiştirilebilir (PUT /slides). */
  setSlides(slides: Slide[]): boolean {
    if (this.phase !== "lobby") return false;
    this.slides = [...slides].sort((a, b) => a.idx - b.idx);
    this.broadcast({ t: "state:snapshot", snapshot: this.snapshot() });
    return true;
  }

  /* ---------- bağlantılar ---------- */

  hostJoin(c: Client): void {
    this.hosts.add(c);
    c.send({ t: "state:snapshot", snapshot: this.snapshot() });
  }

  playerJoin(c: Client, nickname: string): JoinResult {
    if (this.phase === "ended") return { ok: false, code: "session_ended" };
    if (this.members.size >= MAX_PARTICIPANTS) return { ok: false, code: "session_full" };
    const nick = nickname.trim();
    const lower = nick.toLocaleLowerCase("tr");
    for (const m of this.members.values()) if (m.p.nickname.toLocaleLowerCase("tr") === lower) return { ok: false, code: "nickname_taken" };
    const p: Participant = { id: nanoid(12), nickname: nick, avatarSeed: nanoid(8), score: 0, streak: 0, connected: true };
    const token = nanoid(24);
    this.members.set(p.id, { p, token });
    this.byToken.set(token, p.id);
    this.attachPlayer(c, p.id);
    this.persist.addParticipant(this.meta.id, p).catch((e) => this.log("addParticipant", e));
    c.send({ t: "player:joined", participantId: p.id, token, nickname: p.nickname, avatarSeed: p.avatarSeed });
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

    if (!this.scoredSlides.has(slide.id)) {
      this.scoredSlides.add(slide.id);
      this.prevRanks.set(slide.id, ranksOf(this.leaderboard()));
      const rows = [];
      for (const m of this.members.values()) {
        const a = answers.get(m.p.id);
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
    const base = { t: "slide:reveal" as const, slideId: slide.id, tally, correct, leaderboard };

    for (const h of this.hosts) h.send(base);
    const byPid = new Map(leaderboard.map((e) => [e.participantId, e]));
    for (const [pid, c] of this.players) {
      const m = this.members.get(pid); const e = byPid.get(pid);
      if (!m || !e) continue;
      const a = answers.get(pid);
      c.send({ ...base, you: { correct: a?.correct ?? null, pointsAwarded: a?.pointsAwarded ?? 0, score: m.p.score, rank: e.rank, rankDelta: e.rankDelta, streak: m.p.streak } });
    }
  }

  private end() {
    this.endedAt = this.now();
    this.slideStartedAt = null;
    this.persist.setState(this.meta.id, "ended", this.idx).catch((e) => this.log("setState", e));
    this.broadcast({ t: "session:ended", podium: this.leaderboard().slice(0, 3) });
    this.opts.onEnded?.(this);
  }

  /* ---------- cevap ---------- */

  playerAnswer(pid: string, slideId: string, value: AnswerValue): ErrorCode | null {
    const slide = this.currentSlide;
    if (this.phase !== "live" || this.slidePhase !== "open" || !slide || slide.id !== slideId) return "not_open";
    const m = this.members.get(pid);
    if (!m) return "invalid";
    const bucket = this.answersFor(slide.id);
    if (bucket.has(pid)) return "already_answered";
    if (!validateAnswerForSlide(slide, value)) return "invalid";
    const answeredAt = this.now();
    const msTaken = Math.max(0, answeredAt - (this.slideStartedAt ?? answeredAt));
    bucket.set(pid, { participantId: pid, value, answeredAt, msTaken, correct: null, pointsAwarded: 0 });
    this.persist.saveAnswer(this.meta.id, slide.id, pid, value, answeredAt, msTaken).catch((e) => this.log("saveAnswer", e));
    this.players.get(pid)?.send({ t: "answer:ack", slideId: slide.id });
    // Host'a canlı tally (insight) / sayaç (game — UI reveal öncesi yalnızca answeredCount gösterir).
    const msg: ServerMessage = { t: "slide:tally", slideId: slide.id, tally: this.tallyFor(slide), answeredCount: bucket.size };
    for (const h of this.hosts) h.send(msg);
    return null;
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
