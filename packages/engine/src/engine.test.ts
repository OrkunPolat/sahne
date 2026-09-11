import { describe, it, expect } from "vitest";
import type { Slide, Participant } from "@sahne/protocol";
import { scoreAnswer, speedFactor, streakBonus, buildTally, buildLeaderboard, ranksOf, transition, validateAnswerForSlide, fastestCorrect, buildTeamStandings, pickTeam } from "./index";

const mc: Slide = { id: "s1", idx: 0, type: "multiple_choice", mode: "game", text: "Q", timeLimitS: 20, points: 1000,
  options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionIds: ["a"] };
const wc: Slide = { id: "s2", idx: 1, type: "word_cloud", mode: "insight", text: "W", timeLimitS: 30, points: 0, maxEntries: 3 };

describe("scoring", () => {
  it("speed factor bounds", () => {
    expect(speedFactor(0, 20000)).toBe(1);
    expect(speedFactor(20000, 20000)).toBe(0.5);
    expect(speedFactor(10000, 20000)).toBe(0.75);
    expect(speedFactor(50000, 20000)).toBe(0.5);
  });
  it("streak bonus", () => {
    expect(streakBonus(1)).toBe(0); expect(streakBonus(2)).toBe(200); expect(streakBonus(9)).toBe(500);
  });
  it("correct fast answer with streak", () => {
    const r = scoreAnswer({ slide: mc, value: { kind: "choice", optionIds: ["a"] }, msTaken: 0, prevStreak: 1 });
    expect(r).toEqual({ correct: true, points: 1200, streak: 2 });
  });
  it("wrong resets streak", () => {
    const r = scoreAnswer({ slide: mc, value: { kind: "choice", optionIds: ["b"] }, msTaken: 0, prevStreak: 4 });
    expect(r).toEqual({ correct: false, points: 0, streak: 0 });
  });
  it("insight slide gives no points and keeps streak", () => {
    const r = scoreAnswer({ slide: wc, value: { kind: "words", words: ["x"] }, msTaken: 0, prevStreak: 3 });
    expect(r).toEqual({ correct: null, points: 0, streak: 3 });
  });
  it("validates answer shape", () => {
    expect(validateAnswerForSlide(mc, { kind: "choice", optionIds: ["a"] })).toBe(true);
    expect(validateAnswerForSlide(mc, { kind: "choice", optionIds: ["a", "b"] })).toBe(false);
    expect(validateAnswerForSlide(mc, { kind: "choice", optionIds: ["zzz"] })).toBe(false);
    expect(validateAnswerForSlide(wc, { kind: "words", words: ["a", "b", "c", "d"] })).toBe(false);
  });
});

describe("tally", () => {
  it("choice counts", () => {
    const t = buildTally(mc, [
      { participantId: "p1", value: { kind: "choice", optionIds: ["a"] }, answeredAt: 1 },
      { participantId: "p2", value: { kind: "choice", optionIds: ["a"] }, answeredAt: 2 },
      { participantId: "p3", value: { kind: "choice", optionIds: ["b"] }, answeredAt: 3 },
    ]);
    expect(t).toEqual({ kind: "choice", counts: { a: 2, b: 1 }, total: 3 });
  });
  it("word cloud normalizes case/whitespace", () => {
    const t = buildTally(wc, [
      { participantId: "p1", value: { kind: "words", words: ["Kahve", " kahve "] }, answeredAt: 1 },
      { participantId: "p2", value: { kind: "words", words: ["çay"] }, answeredAt: 2 },
    ]);
    expect(t.kind === "words" && t.words[0]).toEqual({ text: "Kahve", count: 2 });
  });
});

describe("leaderboard", () => {
  const ps: Participant[] = [
    { id: "1", nickname: "b", avatarSeed: "1", score: 10, streak: 0, connected: true, teamId: null },
    { id: "2", nickname: "a", avatarSeed: "2", score: 10, streak: 0, connected: true, teamId: null },
    { id: "3", nickname: "c", avatarSeed: "3", score: 50, streak: 0, connected: true, teamId: null },
  ];
  it("sorts and computes delta", () => {
    const prev = ranksOf(buildLeaderboard(ps.map((p) => ({ ...p, score: 0 }))));
    const lb = buildLeaderboard(ps, prev);
    expect(lb.map((e) => e.participantId)).toEqual(["3", "2", "1"]);
    expect(lb[0]!.rankDelta).toBe(2);
  });
});

describe("state machine", () => {
  it("full flow", () => {
    let s = { phase: "lobby" as const, slidePhase: null, idx: -1, total: 2 };
    let n = transition(s, "start")!; expect(n).toMatchObject({ phase: "live", idx: 0, slidePhase: "open" });
    n = transition(n, "lock")!; expect(n.slidePhase).toBe("locked");
    n = transition(n, "reveal")!; expect(n.slidePhase).toBe("revealed");
    n = transition(n, "next")!; expect(n).toMatchObject({ idx: 1, slidePhase: "open" });
    n = transition(n, "next")!; expect(n.phase).toBe("ended");
    expect(transition(n, "next")).toBeNull();
  });
  it("rejects start with no slides", () => {
    expect(transition({ phase: "lobby", slidePhase: null, idx: -1, total: 0 }, "start")).toBeNull();
  });
});

describe("qa tally", () => {
  const qa: Slide = { id: "q", idx: 0, type: "qa", mode: "insight", text: "Sorular?", timeLimitS: 60, points: 0, maxLength: 200 };
  it("sorts by votes then time", () => {
    const up = new Map([["b", new Set(["p1", "p2"])], ["a", new Set(["p3"])]]);
    const t = buildTally(qa, [
      { id: "a", participantId: "p1", nickname: "A", value: { kind: "question", text: "ilk" }, answeredAt: 1 },
      { id: "b", participantId: "p2", nickname: "B", value: { kind: "question", text: "ikinci" }, answeredAt: 2 },
    ], up);
    expect(t.kind === "questions" && t.questions.map((q) => [q.id, q.votes])).toEqual([["b", 2], ["a", 1]]);
  });
});

describe("fastest + teams", () => {
  const ps: Participant[] = [
    { id: "1", nickname: "a", avatarSeed: "1", score: 100, streak: 0, connected: true, teamId: "t1" },
    { id: "2", nickname: "b", avatarSeed: "2", score: 300, streak: 0, connected: true, teamId: "t1" },
    { id: "3", nickname: "c", avatarSeed: "3", score: 250, streak: 0, connected: true, teamId: "t2" },
  ];
  it("fastest correct top n", () => {
    const f = fastestCorrect([{ participantId: "1", msTaken: 900, correct: true }, { participantId: "2", msTaken: 400, correct: true }, { participantId: "3", msTaken: 100, correct: false }], ps, 3);
    expect(f.map((e) => e.participantId)).toEqual(["2", "1"]);
  });
  it("team standings by average", () => {
    const st = buildTeamStandings([{ id: "t1", name: "Kırmızı" }, { id: "t2", name: "Mavi" }], ps);
    expect(st.map((t) => [t.teamId, t.avgScore, t.rank])).toEqual([["t2", 250, 1], ["t1", 200, 2]]);
  });
  it("pickTeam picks least populated", () => {
    expect(pickTeam([{ id: "t1", name: "x" }, { id: "t2", name: "y" }], ps)).toBe("t2");
    expect(pickTeam([], ps)).toBeNull();
  });
});
