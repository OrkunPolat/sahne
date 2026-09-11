import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ServerMessage, Slide, SessionMeta } from "@sahne/protocol";
import { LiveSession, type Client } from "./session";
import { noopPersistence } from "./persistence";

const meta: SessionMeta = { id: "sess1", code: "123456", title: "Test", themeDefault: "midnight-gold", localeDefault: "tr", teams: [], seriesKey: null, publicToken: null, isDemo: false };
const teamMeta: SessionMeta = { ...meta, teams: [{ id: "red", name: "Kırmızı" }, { id: "blue", name: "Mavi" }] };
const qa: Slide = { id: "s4", idx: 3, type: "qa", mode: "insight", text: "Sorular?", timeLimitS: 60, points: 0, maxLength: 200 };
const mc: Slide = { id: "s1", idx: 0, type: "multiple_choice", mode: "game", text: "Q1", timeLimitS: 10, points: 1000,
  options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionIds: ["a"] };
const wc: Slide = { id: "s2", idx: 1, type: "word_cloud", mode: "insight", text: "W", timeLimitS: 20, points: 0, maxEntries: 3 };
const tf: Slide = { id: "s3", idx: 2, type: "true_false", mode: "game", text: "TF", timeLimitS: 10, points: 1000, correct: true };

function fakeClient() {
  const msgs: ServerMessage[] = [];
  const c: Client & { msgs: ServerMessage[]; closed: boolean } = { msgs, closed: false, send: (m) => { msgs.push(m); }, close: () => { c.closed = true; } };
  return c;
}
const last = (c: { msgs: ServerMessage[] }, t: ServerMessage["t"]) => [...c.msgs].reverse().find((m) => m.t === t) as any;

let now = 1_000_000;
const clock = () => now;

describe("LiveSession", () => {
  beforeEach(() => { vi.useFakeTimers(); now = 1_000_000; });
  afterEach(() => { vi.useRealTimers(); });

  function setup(slides = [mc, wc, tf], m: SessionMeta = meta) {
    const s = new LiveSession(m, slides, "secret", noopPersistence, { now: clock, log: () => {} });
    const host = fakeClient(); s.hostJoin(host);
    return { s, host };
  }

  it("host join gets snapshot; player join/full/nickname taken", () => {
    const { s, host } = setup();
    expect(host.msgs[0]?.t).toBe("state:snapshot");

    const p1 = fakeClient();
    const r1 = s.playerJoin(p1, "Ali");
    expect(r1.ok).toBe(true);
    expect(p1.msgs.map((m) => m.t)).toEqual(["player:joined", "state:snapshot"]);
    expect(last(host, "participants:update").participants).toHaveLength(1);

    expect(s.playerJoin(fakeClient(), "ALİ").ok).toBe(false);
    const dup = s.playerJoin(fakeClient(), "ali");
    expect(dup).toEqual({ ok: false, code: "nickname_taken" });

    for (let i = 0; i < 49; i++) expect(s.playerJoin(fakeClient(), `p${i}`).ok).toBe(true);
    expect(s.playerJoin(fakeClient(), "overflow")).toEqual({ ok: false, code: "session_full" });
  });

  it("start → answer → tally to host, auto-lock after time limit", () => {
    const { s, host } = setup();
    const p1 = fakeClient(); const j1 = s.playerJoin(p1, "Ali"); if (!j1.ok) throw new Error();

    expect(s.playerAnswer(j1.participant.id, "s1", { kind: "choice", optionIds: ["a"] })).toBe("not_open");
    expect(s.hostAction("start")).toBe(true);
    expect(last(p1, "slide:open").slide.id).toBe("s1");
    expect(last(host, "slide:open").startedAt).toBe(now);

    now += 2000;
    expect(s.playerAnswer(j1.participant.id, "s1", { kind: "choice", optionIds: ["a"] })).toBeNull();
    expect(last(p1, "answer:ack").slideId).toBe("s1");
    const tally = last(host, "slide:tally");
    expect(tally.answeredCount).toBe(1);
    expect(tally.tally).toEqual({ kind: "choice", counts: { a: 1, b: 0 }, total: 1 });
    expect(s.playerAnswer(j1.participant.id, "s1", { kind: "choice", optionIds: ["b"] })).toBe("already_answered");
    expect(s.playerAnswer(j1.participant.id, "s1", { kind: "bool", value: true })).toBe("already_answered");

    vi.advanceTimersByTime(10_000 + 500);
    expect(s.slidePhase).toBe("locked");
    expect(last(p1, "slide:phase").phase).toBe("locked");
    expect(s.snapshot().answeredCount).toBe(1);
  });

  it("reveal scores, sends `you` to players only, resets streak of non-answerers", () => {
    const { s, host } = setup();
    const p1 = fakeClient(), p2 = fakeClient();
    const j1 = s.playerJoin(p1, "Fast"); const j2 = s.playerJoin(p2, "Slow");
    if (!j1.ok || !j2.ok) throw new Error();

    s.hostAction("start");
    now += 0; s.playerAnswer(j1.participant.id, "s1", { kind: "choice", optionIds: ["a"] });
    now += 5000; s.playerAnswer(j2.participant.id, "s1", { kind: "choice", optionIds: ["b"] });
    expect(s.hostAction("reveal")).toBe(true);

    const hr = last(host, "slide:reveal");
    expect(hr.you).toBeUndefined();
    expect(hr.correct).toEqual(["a"]);
    expect(hr.leaderboard[0]).toMatchObject({ nickname: "Fast", score: 1000, rank: 1 });

    const y1 = last(p1, "slide:reveal").you;
    expect(y1).toEqual({ correct: true, pointsAwarded: 1000, score: 1000, rank: 1, rankDelta: 0, streak: 1 });
    const y2 = last(p2, "slide:reveal").you;
    expect(y2).toMatchObject({ correct: false, pointsAwarded: 0, score: 0, rank: 2, streak: 0 });

    // sonraki puanlı slayt: sadece Slow cevaplar → Fast'in serisi sıfırlanır, Slow öne geçer (rankDelta +1)
    s.hostAction("next"); // s2 word cloud (insight)
    s.hostAction("next"); // s3 true/false
    now += 1000;
    s.playerAnswer(j2.participant.id, "s3", { kind: "bool", value: true });
    s.hostAction("reveal");
    const y2b = last(p2, "slide:reveal").you;
    expect(y2b.pointsAwarded).toBe(950);
    expect(y2b.rank).toBe(2); // 950 < 1000
    expect(y2b.rankDelta).toBe(0);
    const y1b = last(p1, "slide:reveal").you;
    expect(y1b).toMatchObject({ correct: null, pointsAwarded: 0, streak: 0, rank: 1 });

    // tekrar reveal geçersiz (revealed → reveal yok)
    expect(s.hostAction("reveal")).toBe(false);
  });

  it("prev/next flow re-broadcasts revealed slide without re-scoring", () => {
    const { s, host } = setup();
    const p1 = fakeClient(); const j1 = s.playerJoin(p1, "Ali"); if (!j1.ok) throw new Error();
    s.hostAction("start");
    s.playerAnswer(j1.participant.id, "s1", { kind: "choice", optionIds: ["a"] });
    s.hostAction("reveal");
    expect(s.hostAction("prev")).toBe(false); // idx 0
    s.hostAction("next");
    expect(s.idx).toBe(1); expect(s.slidePhase).toBe("open");
    expect(s.hostAction("prev")).toBe(true);
    expect(s.idx).toBe(0); expect(s.slidePhase).toBe("revealed");
    expect(last(host, "state:snapshot").snapshot.currentSlideIdx).toBe(0);
    const y = last(p1, "slide:reveal").you;
    expect(y.score).toBe(1000); // çift puanlama yok
    expect(s.playerAnswer(j1.participant.id, "s1", { kind: "choice", optionIds: ["a"] })).toBe("not_open");
    // sona kadar next → ended + podium
    s.hostAction("next"); s.hostAction("next"); s.hostAction("next");
    expect(s.phase).toBe("ended");
    expect(last(p1, "session:ended").podium[0].nickname).toBe("Ali");
    expect(s.playerJoin(fakeClient(), "Late")).toEqual({ ok: false, code: "session_ended" });
  });

  it("resume by token restores same participant and connected flag", () => {
    const { s, host } = setup();
    const p1 = fakeClient(); const j1 = s.playerJoin(p1, "Ali"); if (!j1.ok) throw new Error();
    s.detach(p1);
    expect(last(host, "participants:update").participants[0].connected).toBe(false);
    expect(s.playerResume(fakeClient(), "nope")).toBeNull();
    const p1b = fakeClient();
    const p = s.playerResume(p1b, j1.token);
    expect(p?.id).toBe(j1.participant.id);
    expect(p?.connected).toBe(true);
    expect(p1b.msgs[0]?.t).toBe("state:snapshot");
    expect(last(host, "participants:update").participants[0].connected).toBe(true);
    // yeni bağlantı cevap verebilir
    s.hostAction("start");
    expect(s.playerAnswer(j1.participant.id, "s1", { kind: "choice", optionIds: ["a"] })).toBeNull();
    expect(last(p1b, "answer:ack").slideId).toBe("s1");
    expect(p1.msgs.some((m) => m.t === "answer:ack")).toBe(false);
  });

  it("insight mode tally is live and reveal gives correct=null", () => {
    const { s, host } = setup([wc]);
    const p1 = fakeClient(); const j1 = s.playerJoin(p1, "Ali"); if (!j1.ok) throw new Error();
    s.hostAction("start");
    expect(s.playerAnswer(j1.participant.id, "s2", { kind: "words", words: ["a", "b", "c", "d"] })).toBe("invalid");
    expect(s.playerAnswer(j1.participant.id, "s2", { kind: "words", words: ["Kedi", "kedi"] })).toBeNull();
    expect(last(host, "slide:tally").tally).toEqual({ kind: "words", words: [{ text: "Kedi", count: 2 }], total: 1 });
    s.hostAction("reveal");
    expect(last(p1, "slide:reveal").correct).toBeNull();
    expect(last(p1, "slide:reveal").you.correct).toBeNull();
  });

  /* ---------- Dalga 2 ---------- */

  it("team mode: explicit teamId kept, missing → round-robin (least members), unknown → bad_team", () => {
    const { s, host } = setup([mc], teamMeta);
    const p1 = fakeClient();
    const j1 = s.playerJoin(p1, "A", { teamId: "blue" }); if (!j1.ok) throw new Error();
    expect(j1.participant.teamId).toBe("blue");
    expect(last(p1, "player:joined").teamId).toBe("blue");
    const j2 = s.playerJoin(fakeClient(), "B"); if (!j2.ok) throw new Error();
    expect(j2.participant.teamId).toBe("red"); // en az üyeli
    const j3 = s.playerJoin(fakeClient(), "C"); if (!j3.ok) throw new Error();
    expect(j3.participant.teamId).toBe("red"); // eşitlikte ilk takım
    const j4 = s.playerJoin(fakeClient(), "D"); if (!j4.ok) throw new Error();
    expect(j4.participant.teamId).toBe("blue");
    expect(s.playerJoin(fakeClient(), "E", { teamId: "green" })).toEqual({ ok: false, code: "bad_team" });
    expect(last(host, "participants:update").participants.map((p: any) => p.teamId)).toEqual(["blue", "red", "red", "blue"]);
    expect(s.snapshot().meta.teams).toHaveLength(2);
    // takım modu kapalıyken teamId yok sayılır
    const { s: s2 } = setup([mc]);
    const j = s2.playerJoin(fakeClient(), "X", { teamId: "whatever" }); if (!j.ok) throw new Error();
    expect(j.participant.teamId).toBeNull();
  });

  it("reactions: 2/sec per participant, burst of 3 → one rate_limited, broadcast to host and players", () => {
    const { s, host } = setup();
    const p1 = fakeClient(), p2 = fakeClient();
    const j1 = s.playerJoin(p1, "A"); const j2 = s.playerJoin(p2, "B"); if (!j1.ok || !j2.ok) throw new Error();
    expect(s.playerReact(j1.participant.id, "👏")).toBeNull();
    expect(s.playerReact(j1.participant.id, "🔥")).toBeNull();
    expect(s.playerReact(j1.participant.id, "😂")).toBe("rate_limited");
    expect(s.playerReact(j2.participant.id, "❤️")).toBeNull(); // başka katılımcı etkilenmez
    const hostReacts = host.msgs.filter((m) => m.t === "reaction");
    expect(hostReacts).toHaveLength(3);
    expect(hostReacts[0]).toEqual({ t: "reaction", emoji: "👏", participantId: j1.participant.id });
    expect(p2.msgs.filter((m) => m.t === "reaction")).toHaveLength(3);
    expect(p1.msgs.filter((m) => m.t === "reaction")).toHaveLength(3);
    now += 500; // 1 token yenilenir
    expect(s.playerReact(j1.participant.id, "🤔")).toBeNull();
    expect(s.playerReact(j1.participant.id, "❓")).toBe("rate_limited");
    expect(s.playerReact("nope", "❓")).toBe("invalid");
  });

  it("qa: multiple answers (max 5), upvote toggle, tally to everyone, answer ids are question ids", () => {
    const { s, host } = setup([qa]);
    const p1 = fakeClient(), p2 = fakeClient();
    const j1 = s.playerJoin(p1, "A"); const j2 = s.playerJoin(p2, "B"); if (!j1.ok || !j2.ok) throw new Error();
    s.hostAction("start");
    expect(s.playerAnswer(j1.participant.id, "s4", { kind: "question", text: "Soru 1" })).toBeNull();
    now += 10;
    expect(s.playerAnswer(j1.participant.id, "s4", { kind: "question", text: "Soru 2" })).toBeNull();
    for (let i = 3; i <= 5; i++) expect(s.playerAnswer(j1.participant.id, "s4", { kind: "question", text: `Soru ${i}` })).toBeNull();
    expect(s.playerAnswer(j1.participant.id, "s4", { kind: "question", text: "Soru 6" })).toBe("already_answered");
    expect(s.playerAnswer(j2.participant.id, "s4", { kind: "text", text: "yanlış tür" })).toBe("invalid");

    // herkes tally alır
    const t1 = last(p2, "slide:tally");
    expect(t1.tally.kind).toBe("questions");
    expect(t1.tally.questions).toHaveLength(5);
    expect(t1.answeredCount).toBe(1);
    expect(t1.tally.questions[0]).toMatchObject({ text: "Soru 1", nickname: "A", votes: 0 });
    expect(last(host, "slide:tally").tally.questions).toHaveLength(5);
    expect(s.snapshot().answeredCount).toBe(1);

    const q2 = t1.tally.questions.find((q: any) => q.text === "Soru 2").id;
    expect(typeof q2).toBe("string");
    expect(s.playerUpvote(j2.participant.id, "s4", "missing")).toBe("invalid");
    expect(s.playerUpvote(j2.participant.id, "s4", q2)).toBeNull();
    let t = last(p1, "slide:tally");
    expect(t.tally.questions[0]).toMatchObject({ id: q2, votes: 1 }); // oy alan öne geçer
    expect(s.playerUpvote(j1.participant.id, "s4", q2)).toBeNull();
    expect(last(host, "slide:tally").tally.questions[0].votes).toBe(2);
    expect(s.playerUpvote(j2.participant.id, "s4", q2)).toBeNull(); // toggle off
    t = last(p2, "slide:tally");
    expect(t.tally.questions[0]).toMatchObject({ id: q2, votes: 1 });
    // oylama kilitli slaytta da mümkün, reveal sonrası da
    s.hostAction("lock");
    expect(s.playerUpvote(j2.participant.id, "s4", q2)).toBeNull();
    s.hostAction("reveal");
    expect(last(p1, "slide:reveal").tally.questions[0].votes).toBe(2);
    expect(last(p1, "slide:reveal").fastest).toEqual([]);
  });

  it("qa tally is not sent to players for non-qa slides", () => {
    const { s } = setup([wc]);
    const p1 = fakeClient(); const j1 = s.playerJoin(p1, "A"); if (!j1.ok) throw new Error();
    s.hostAction("start");
    s.playerAnswer(j1.participant.id, "s2", { kind: "words", words: ["x"] });
    expect(p1.msgs.some((m) => m.t === "slide:tally")).toBe(false);
  });

  it("reveal: fastest = top 3 correct by ms; teams standings with rankDelta", () => {
    const { s, host } = setup([mc, tf], teamMeta);
    const clients = ["A", "B", "C", "D", "E"].map((n) => { const c = fakeClient(); const j = s.playerJoin(c, n); if (!j.ok) throw new Error(); return { c, id: j.participant.id, team: j.participant.teamId }; });
    // A red, B blue, C red, D blue, E red
    expect(clients.map((x) => x.team)).toEqual(["red", "blue", "red", "blue", "red"]);
    s.hostAction("start");
    now += 3000; s.playerAnswer(clients[0]!.id, "s1", { kind: "choice", optionIds: ["a"] }); // A 3000 doğru
    now += 1000; s.playerAnswer(clients[1]!.id, "s1", { kind: "choice", optionIds: ["b"] }); // B yanlış
    now -= 3500; s.playerAnswer(clients[2]!.id, "s1", { kind: "choice", optionIds: ["a"] }); // C 500 doğru
    now += 1500; s.playerAnswer(clients[3]!.id, "s1", { kind: "choice", optionIds: ["a"] }); // D 2000 doğru
    now += 3000; s.playerAnswer(clients[4]!.id, "s1", { kind: "choice", optionIds: ["a"] }); // E 5000 doğru
    s.hostAction("reveal");
    const r = last(host, "slide:reveal");
    expect(r.fastest.map((f: any) => [f.nickname, f.ms])).toEqual([["C", 500], ["D", 2000], ["A", 3000]]);
    expect(r.teams).toHaveLength(2);
    // red: A 850 + C 975 + E 750 = 2575 / 3 ≈ 858; blue: D 900 + B 0 = 900 / 2 = 450
    expect(r.teams[0]).toMatchObject({ teamId: "red", name: "Kırmızı", members: 3, rank: 1, totalScore: 2575, avgScore: 858, rankDelta: 0 });
    expect(r.teams[1]).toMatchObject({ teamId: "blue", members: 2, rank: 2, totalScore: 900, avgScore: 450 });
    expect(last(clients[0]!.c, "slide:reveal").teams).toHaveLength(2);

    // 2. slayt: sadece blue doğru cevaplar → blue öne geçer, rankDelta +1
    s.hostAction("next");
    now += 100;
    s.playerAnswer(clients[1]!.id, "s3", { kind: "bool", value: true });
    s.playerAnswer(clients[3]!.id, "s3", { kind: "bool", value: true });
    s.hostAction("reveal");
    const r2 = last(host, "slide:reveal");
    expect(r2.teams[0]).toMatchObject({ teamId: "blue", rank: 1, rankDelta: 1 });
    expect(r2.teams[1]).toMatchObject({ teamId: "red", rank: 2, rankDelta: -1 });
    expect(r2.fastest.map((f: any) => f.nickname)).toEqual(["B", "D"]);
    // takım modu kapalı oturumda teams boş
    const { s: s2, host: h2 } = setup([mc]);
    s2.hostAction("start"); s2.hostAction("reveal");
    expect(last(h2, "slide:reveal").teams).toEqual([]);
    expect(last(h2, "slide:reveal").fastest).toEqual([]);
  });

  it("ended: publicToken generated, persisted, in meta and session:ended with teams", async () => {
    const setEnded = vi.fn(async () => {});
    const s = new LiveSession(teamMeta, [mc], "secret", { ...noopPersistence, setEnded }, { now: clock, log: () => {} });
    const host = fakeClient(); s.hostJoin(host);
    const p1 = fakeClient(); const j1 = s.playerJoin(p1, "A"); if (!j1.ok) throw new Error();
    expect(s.snapshot().meta.publicToken).toBeNull();
    s.hostAction("start"); s.hostAction("end");
    const e = last(p1, "session:ended");
    expect(typeof e.publicToken).toBe("string");
    expect(e.publicToken).toHaveLength(16);
    expect(e.teams).toHaveLength(2);
    expect(e.podium[0].nickname).toBe("A");
    expect(s.meta.publicToken).toBe(e.publicToken);
    expect(setEnded).toHaveBeenCalledWith("sess1", e.publicToken, now);
    expect(s.results().teams).toHaveLength(2);
  });

  it("settings: teams change in lobby reassigns participants; refused when live", () => {
    const { s, host } = setup([mc]);
    const j1 = s.playerJoin(fakeClient(), "A"); if (!j1.ok) throw new Error();
    expect(j1.participant.teamId).toBeNull();
    expect(s.setSettings({ teams: teamMeta.teams, seriesKey: "weekly" })).toBe(true);
    expect(j1.participant.teamId).toBe("red");
    const snap = last(host, "state:snapshot").snapshot;
    expect(snap.meta.seriesKey).toBe("weekly");
    expect(snap.meta.teams).toHaveLength(2);
    expect(s.setSettings({ teams: [] })).toBe(true);
    expect(j1.participant.teamId).toBeNull();
    s.hostAction("start");
    expect(s.setSettings({ seriesKey: null })).toBe(false);
  });
});
