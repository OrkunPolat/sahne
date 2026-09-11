import { describe, it, expect } from "vitest";
import type { TournamentItem } from "@sahne/protocol";
import { beginRun, resolveMatch, playToStatDeltas, validatePlay, maxBracketSize } from "./bracket";

const items: TournamentItem[] = Array.from({ length: 10 }, (_, i) => ({ id: `i${i}`, name: `Item ${i}`, imageUrl: null }));
const seq = () => { let x = 0.1; return () => { x = (x + 0.37) % 1; return x; }; };

describe("bracket", () => {
  it("maxBracketSize", () => { expect(maxBracketSize(10)).toBe(8); expect(maxBracketSize(3)).toBe(0); expect(maxBracketSize(300)).toBe(256); });
  it("runs an 8-bracket to a champion in 7 matches", () => {
    let run = beginRun("s", items, 8, seq());
    expect(run.state.round).toBe(8); expect(run.state.matchesInRound).toBe(4);
    let n = 0;
    while (!run.state.champion) { run = resolveMatch(run, 1, 0, seq()); n++; }
    expect(n).toBe(7);
    expect(run.state.results.map((r) => r.round)).toEqual([8, 8, 8, 8, 4, 4, 2]);
    expect(run.state.current).toBeNull();
  });
  it("tie resolved by rng", () => {
    const run = beginRun("s", items, 4, seq());
    const a = run.state.current!.a.id;
    const r = resolveMatch(run, 2, 2, () => 0.1);
    expect(r.state.results[0]!.winnerId).toBe(a);
  });
  it("stat deltas + validatePlay", () => {
    let run = beginRun("s", items, 4, seq());
    while (!run.state.champion) run = resolveMatch(run, 0, 1, seq());
    const play = { size: 4, results: run.state.results, championId: run.state.champion!.id };
    expect(validatePlay(play, new Set(items.map((i) => i.id)))).toBe(true);
    const d = playToStatDeltas(play);
    expect(d.get(play.championId)).toMatchObject({ wins: 2, losses: 0, finals: 1, champions: 1 });
    expect(validatePlay({ ...play, championId: "zzz" }, new Set(items.map((i) => i.id)))).toBe(false);
  });
});
