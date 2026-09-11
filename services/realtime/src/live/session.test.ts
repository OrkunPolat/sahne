import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ServerMessage, Slide, SessionMeta } from "@sahne/protocol";
import { LiveSession, type Client } from "./session";
import { noopPersistence } from "./persistence";

const meta: SessionMeta = { id: "sess1", code: "123456", title: "Test", themeDefault: "midnight-gold", localeDefault: "tr" };
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

  function setup(slides = [mc, wc, tf]) {
    const s = new LiveSession(meta, slides, "secret", noopPersistence, { now: clock, log: () => {} });
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
});
