import { describe, it, expect } from "vitest";
import type { BracketPlay, TournamentItem } from "@sahne/protocol";
import { RateLimiter, checkPlay, makeSlug, slugBase } from "./tournamentLogic";

const items: TournamentItem[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id, imageUrl: null }));

describe("slug generation", () => {
  it("transliterates Turkish characters, lowercases, replaces non-alnum with '-', trims", () => {
    expect(slugBase("En İyi Türk Filmleri: Şöyle Çığır Açan Öğeler!")).toBe("en-iyi-turk-filmleri-soyle-cigir-acan-ogeler");
    expect(slugBase("  --Hello   World--  ")).toBe("hello-world");
    expect(slugBase("IŞIK ığdır")).toBe("isik-igdir");
    expect(slugBase("!!!")).toBe("turnuva");
  });
  it("appends '-' + 5-char nanoid", () => {
    const slug = makeSlug("Kediler mi Köpekler mi?", () => "abc12");
    expect(slug).toBe("kediler-mi-kopekler-mi-abc12");
    expect(makeSlug("Deneme")).toMatch(/^deneme-[A-Za-z0-9_-]{5}$/);
  });
});

describe("checkPlay (validatePlay + playToStatDeltas)", () => {
  const good: BracketPlay = {
    size: 4,
    championId: "c",
    results: [
      { round: 4, aId: "a", bId: "b", winnerId: "a", votesA: 1, votesB: 0 },
      { round: 4, aId: "c", bId: "d", winnerId: "c", votesA: 1, votesB: 0 },
      { round: 2, aId: "a", bId: "c", winnerId: "c", votesA: 0, votesB: 1 },
    ],
  };

  it("accepts a consistent play and yields stat deltas", () => {
    const r = checkPlay(good, items);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.deltas.get("c")).toEqual({ itemId: "c", wins: 2, losses: 0, finals: 1, champions: 1 });
    expect(r.deltas.get("a")).toEqual({ itemId: "a", wins: 1, losses: 1, finals: 1, champions: 0 });
    expect(r.deltas.get("b")).toEqual({ itemId: "b", wins: 0, losses: 1, finals: 0, champions: 0 });
    expect(r.deltas.has("e")).toBe(false);
  });

  it("rejects unknown item ids, wrong champion, bad round structure, oversize", () => {
    expect(checkPlay({ ...good, results: [{ ...good.results[0]!, aId: "zz" }, good.results[1]!, good.results[2]!] }, items)).toMatchObject({ ok: false, code: "invalid_play" });
    expect(checkPlay({ ...good, championId: "a" }, items)).toMatchObject({ ok: false });
    expect(checkPlay({ ...good, championId: "zz" }, items)).toMatchObject({ ok: false });
    expect(checkPlay({ ...good, results: good.results.slice(0, 2) }, items)).toMatchObject({ ok: false });
    expect(checkPlay({ ...good, results: [good.results[0]!, { ...good.results[1]!, round: 2 }, good.results[2]!] }, items)).toMatchObject({ ok: false });
    expect(checkPlay({ ...good, size: 8 }, items)).toMatchObject({ ok: false });
    expect(checkPlay({ ...good, size: 6 }, items)).toMatchObject({ ok: false });
  });
});

describe("RateLimiter", () => {
  it("fixed window per key", () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    expect(rl.allow("k")).toBe(true);
    expect(rl.allow("k")).toBe(true);
    expect(rl.allow("k")).toBe(false);
    expect(rl.allow("other")).toBe(true);
    t = 1000;
    expect(rl.allow("k")).toBe(true);
  });
});
