import type { BracketMatchResult, BracketPlay, BracketState, TournamentItem, TournamentItemStat } from "@sahne/protocol";

/** Deterministik karıştırma (seed verilirse tekrarlanabilir; solo'da Math.random). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

export function isPowerOfTwo(n: number) { return n >= 2 && (n & (n - 1)) === 0; }

/** Aday sayısına sığan en büyük geçerli turnuva boyutu. */
export function maxBracketSize(itemCount: number): number {
  let s = 4; while (s * 2 <= itemCount && s * 2 <= 256) s *= 2; return itemCount >= 4 ? s : 0;
}

/** Turnuva başlangıcı: `size` aday rastgele seçilir ve eşleştirilir. */
export function startBracket(slideId: string, items: TournamentItem[], size: number, rng?: () => number): { state: BracketState; queue: TournamentItem[] } {
  if (!isPowerOfTwo(size) || size < 4 || size > items.length) throw new Error("bad bracket size");
  const pool = shuffle(items, rng).slice(0, size);
  const state: BracketState = { slideId, size, round: size, matchIdx: 0, matchesInRound: size / 2, current: { a: pool[0]!, b: pool[1]! }, results: [], champion: null };
  return { state, queue: pool };
}

/**
 * Turnuva ilerleme motoru. `queue` bu turdaki sıradaki adaylar; kazananlar `winners`'a birikir,
 * tur bitince winners yeni queue olur.
 */
export interface BracketRun { state: BracketState; queue: TournamentItem[]; winners: TournamentItem[] }

export function beginRun(slideId: string, items: TournamentItem[], size: number, rng?: () => number): BracketRun {
  const { state, queue } = startBracket(slideId, items, size, rng);
  return { state, queue, winners: [] };
}

/** Mevcut eşleşmeyi sonuçlandırır ve bir sonrakine geçer (ya da şampiyonu belirler). Beraberlikte rng ile seçilir. */
export function resolveMatch(run: BracketRun, votesA: number, votesB: number, rng: () => number = Math.random): BracketRun {
  const { state } = run;
  if (!state.current || state.champion) return run;
  const { a, b } = state.current;
  const winner = votesA > votesB ? a : votesB > votesA ? b : (rng() < 0.5 ? a : b);
  const result: BracketMatchResult = { round: state.round, aId: a.id, bId: b.id, winnerId: winner.id, votesA, votesB };
  const results = [...state.results, result];
  const winners = [...run.winners, winner];
  let queue = run.queue.slice(2);
  let round = state.round, matchIdx = state.matchIdx + 1, matchesInRound = state.matchesInRound;
  let nextWinners = winners;
  if (queue.length < 2) {
    if (winners.length === 1) {
      return { state: { ...state, results, current: null, champion: winner, matchIdx, }, queue: [], winners: [] };
    }
    queue = winners; nextWinners = []; round = winners.length; matchIdx = 0; matchesInRound = winners.length / 2;
  }
  const current = { a: queue[0]!, b: queue[1]! };
  return { state: { ...state, results, current, round, matchIdx, matchesInRound, champion: null }, queue, winners: nextWinners };
}

/** Solo oyun sonucundan istatistik farkı (her aday için). */
export function playToStatDeltas(play: BracketPlay): Map<string, TournamentItemStat> {
  const m = new Map<string, TournamentItemStat>();
  const get = (id: string) => { let s = m.get(id); if (!s) { s = { itemId: id, wins: 0, losses: 0, finals: 0, champions: 0 }; m.set(id, s); } return s; };
  for (const r of play.results) {
    const loser = r.winnerId === r.aId ? r.bId : r.aId;
    get(r.winnerId).wins++; get(loser).losses++;
    if (r.round === 2) { get(r.aId).finals++; get(r.bId).finals++; }
  }
  get(play.championId).champions++;
  return m;
}

/** Solo oyunun tutarlılığı: sonuç sayısı size-1, her tur doğru, şampiyon son maçın kazananı. */
export function validatePlay(play: BracketPlay, itemIds: Set<string>): boolean {
  if (!isPowerOfTwo(play.size) || play.results.length !== play.size - 1) return false;
  let round = play.size, inRound = 0;
  for (const r of play.results) {
    if (!itemIds.has(r.aId) || !itemIds.has(r.bId) || (r.winnerId !== r.aId && r.winnerId !== r.bId) || r.aId === r.bId) return false;
    if (r.round !== round) return false;
    inRound++;
    if (inRound === round / 2) { round /= 2; inRound = 0; }
  }
  return play.results[play.results.length - 1]!.winnerId === play.championId;
}

export function winRate(s: TournamentItemStat): number { const n = s.wins + s.losses; return n ? s.wins / n : 0; }
