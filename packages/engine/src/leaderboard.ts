import type { LeaderboardEntry, Participant } from "@sahne/protocol";

/** Skora göre sıralama; eşitlikte takma ada göre (deterministik). rankDelta önceki sıralamaya göre. */
export function buildLeaderboard(participants: Participant[], prevRanks?: Map<string, number>): LeaderboardEntry[] {
  const sorted = [...participants].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  return sorted.map((p, i) => {
    const rank = i + 1;
    const prev = prevRanks?.get(p.id);
    return { participantId: p.id, nickname: p.nickname, avatarSeed: p.avatarSeed, score: p.score, rank, rankDelta: prev === undefined ? 0 : prev - rank };
  });
}

export function ranksOf(lb: LeaderboardEntry[]): Map<string, number> {
  return new Map(lb.map((e) => [e.participantId, e.rank]));
}
