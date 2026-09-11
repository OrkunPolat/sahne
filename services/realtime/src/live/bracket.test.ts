import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BracketPlay, ServerMessage, Slide, SessionMeta, TournamentItem } from "@sahne/protocol";
import { LiveSession, type Client } from "./session";
import { noopPersistence, type Persistence } from "./persistence";

const meta: SessionMeta = { id: "sess1", code: "123456", title: "Test", themeDefault: "midnight-gold", localeDefault: "tr", teams: [], seriesKey: null, publicToken: null, isDemo: false };
const items: TournamentItem[] = ["i1", "i2", "i3", "i4", "i5"].map((id) => ({ id, name: id.toUpperCase(), imageUrl: null }));
const bracket: Slide = { id: "b1", idx: 0, type: "bracket", mode: "insight", text: "En iyi?", timeLimitS: 15, points: 0, tournamentId: "t1", size: 4, items };
const wc: Slide = { id: "s2", idx: 1, type: "word_cloud", mode: "insight", text: "W", timeLimitS: 20, points: 0, maxEntries: 3 };

function fakeClient() {
  const msgs: ServerMessage[] = [];
  const c: Client & { msgs: ServerMessage[]; closed: boolean } = { msgs, closed: false, send: (m) => { msgs.push(m); }, close: () => { c.closed = true; } };
  return c;
}
const last = (c: { msgs: ServerMessage[] }, t: ServerMessage["t"]) => [...c.msgs].reverse().find((m) => m.t === t) as any;
const count = (c: { msgs: ServerMessage[] }, t: ServerMessage["t"]) => c.msgs.filter((m) => m.t === t).length;

let now = 1_000_000;
const clock = () => now;

describe("LiveSession bracket flow", () => {
  beforeEach(() => { vi.useFakeTimers(); now = 1_000_000; });
  afterEach(() => { vi.useRealTimers(); });

  function setup(persist: Persistence = noopPersistence) {
    const s = new LiveSession(meta, [bracket, wc], "secret", persist, { now: clock, log: () => {} });
    const host = fakeClient(); s.hostJoin(host);
    const p1 = fakeClient(), p2 = fakeClient();
    const j1 = s.playerJoin(p1, "Ali"); const j2 = s.playerJoin(p2, "Veli");
    if (!j1.ok || !j2.ok) throw new Error("join failed");
    return { s, host, p1, p2, pid1: j1.participant.id, pid2: j2.participant.id };
  }

  it("open → 2 votes → reveal → next … → champion after 3 matches; then host:next advances slide", () => {
    const recorded: { tournamentId: string; play: BracketPlay }[] = [];
    const persist: Persistence = { ...noopPersistence, recordTournamentPlay: async (tournamentId, play) => { recorded.push({ tournamentId, play }); } };
    const { s, host, p1, p2, pid1, pid2 } = setup(persist);

    expect(s.hostAction("start")).toBe(true);
    expect(last(p1, "slide:open").slide.id).toBe("b1");
    const st0 = last(p1, "bracket:state").state;
    expect(st0).toMatchObject({ slideId: "b1", size: 4, round: 4, matchIdx: 0, matchesInRound: 2, champion: null });
    expect(st0.current).not.toBeNull();
    expect(s.snapshot().bracket?.slideId).toBe("b1");

    const openMatches = [];
    for (let match = 0; match < 3; match++) {
      const st = s.snapshot().bracket!;
      expect(st.current).not.toBeNull();
      openMatches.push(st.current);
      // Oylar: p1 → a, p2 → b (beraberlik değil: p1 tek başına a'ya 2. tur için de yeter; burada ikisi de a'ya)
      expect(s.playerAnswer(pid1, "b1", { kind: "choice", optionIds: [st.current!.a.id] })).toBeNull();
      expect(s.playerAnswer(pid2, "b1", { kind: "choice", optionIds: [st.current!.a.id] })).toBeNull();
      expect(last(host, "slide:tally").tally).toEqual({ kind: "choice", counts: { [st.current!.a.id]: 2 }, total: 2 });
      expect(last(host, "slide:tally").answeredCount).toBe(2);

      expect(s.hostAction("reveal")).toBe(true);
      expect(s.slidePhase).toBe("revealed");
      const after = last(p2, "bracket:state").state;
      expect(after.results).toHaveLength(match + 1);
      expect(after.results[match]).toMatchObject({ aId: st.current!.a.id, bId: st.current!.b.id, winnerId: st.current!.a.id, votesA: 2, votesB: 0 });
      const rev = last(p2, "slide:reveal");
      expect(rev.slideId).toBe("b1");
      expect(rev.correct).toBeNull();
      expect(rev.tally.total).toBe(2);
      expect(rev.you.correct).toBeNull();

      if (match < 2) {
        expect(after.champion).toBeNull();
        expect(after.current).not.toBeNull();
        // Reveal sonrası oy kapalı
        expect(s.playerAnswer(pid1, "b1", { kind: "choice", optionIds: [after.current.a.id] })).toBe("not_open");
        const slideOpens = count(p1, "slide:open");
        expect(s.hostAction("next")).toBe(true);
        expect(s.idx).toBe(0);
        expect(s.slidePhase).toBe("open");
        expect(count(p1, "slide:open")).toBe(slideOpens); // slide:open YERİNE bracket:state + slide:phase
        expect(last(p1, "slide:phase").phase).toBe("open");
        expect(last(p1, "bracket:state").state.matchIdx).toBe(match === 0 ? 1 : 0);
        expect(s.snapshot().answeredCount).toBe(0);
      } else {
        expect(after.current).toBeNull();
        expect(after.champion?.id).toBe(st.current!.a.id);
        expect(after.round).toBe(2);
      }
    }
    // İkinci turda final: ilk iki maçın kazananları
    expect(openMatches[2]!.a.id).toBe(openMatches[0]!.a.id);
    expect(openMatches[2]!.b.id).toBe(openMatches[1]!.a.id);

    // Şampiyon → tournament_plays (live) kaydı
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.tournamentId).toBe("t1");
    expect(recorded[0]!.play.size).toBe(4);
    expect(recorded[0]!.play.results).toHaveLength(3);
    expect(recorded[0]!.play.championId).toBe(openMatches[0]!.a.id);

    // Şampiyondan sonra host:next normal slayt geçişi
    expect(s.hostAction("next")).toBe(true);
    expect(s.idx).toBe(1);
    expect(last(p1, "slide:open").slide.id).toBe("s2");
    expect(s.snapshot().bracket).toBeNull();
  });

  it("vote for a non-current item → invalid; second vote in same match → already_answered; new match resets", () => {
    const { s, pid1 } = setup();
    s.hostAction("start");
    const cur = s.snapshot().bracket!.current!;
    const other = items.find((i) => i.id !== cur.a.id && i.id !== cur.b.id)!;
    expect(s.playerAnswer(pid1, "b1", { kind: "choice", optionIds: [other.id] })).toBe("invalid");
    expect(s.playerAnswer(pid1, "b1", { kind: "choice", optionIds: [cur.a.id, cur.b.id] })).toBe("invalid");
    expect(s.playerAnswer(pid1, "b1", { kind: "bool", value: true })).toBe("invalid");
    expect(s.playerAnswer(pid1, "b1", { kind: "choice", optionIds: [cur.b.id] })).toBeNull();
    expect(s.playerAnswer(pid1, "b1", { kind: "choice", optionIds: [cur.a.id] })).toBe("already_answered");

    s.hostAction("reveal");
    s.hostAction("next");
    const cur2 = s.snapshot().bracket!.current!;
    expect(cur2.a.id).not.toBe(cur.a.id);
    expect(s.playerAnswer(pid1, "b1", { kind: "choice", optionIds: [cur2.a.id] })).toBeNull();
  });

  it("auto-locks each match after timeLimitS; next match re-arms the timer", () => {
    const { s, p1 } = setup();
    s.hostAction("start");
    vi.advanceTimersByTime(15_000 + 500);
    expect(s.slidePhase).toBe("locked");
    expect(last(p1, "slide:phase").phase).toBe("locked");
    s.hostAction("reveal");
    s.hostAction("next");
    expect(s.slidePhase).toBe("open");
    vi.advanceTimersByTime(15_000 + 500);
    expect(s.slidePhase).toBe("locked");
  });

  it("tie resolves to one of the pair; host:next without reveal resolves silently", () => {
    const { s, pid1, pid2 } = setup();
    s.hostAction("start");
    const cur = s.snapshot().bracket!.current!;
    s.playerAnswer(pid1, "b1", { kind: "choice", optionIds: [cur.a.id] });
    s.playerAnswer(pid2, "b1", { kind: "choice", optionIds: [cur.b.id] });
    expect(s.hostAction("next")).toBe(true);
    const st = s.snapshot().bracket!;
    expect(st.results).toHaveLength(1);
    expect([cur.a.id, cur.b.id]).toContain(st.results[0]!.winnerId);
    expect(st.matchIdx).toBe(1);
    expect(s.slidePhase).toBe("open");
  });
});
