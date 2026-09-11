import type { FastestEntry, LeaderboardEntry, Participant, Team, TeamStanding } from "@sahne/protocol";

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

/** Reveal: doğru cevaplayanlar arasında en hızlı N. */
export function fastestCorrect(
  entries: { participantId: string; msTaken: number; correct: boolean | null }[],
  participants: Participant[],
  n = 3,
): FastestEntry[] {
  const byId = new Map(participants.map((p) => [p.id, p]));
  return entries
    .filter((e) => e.correct === true)
    .sort((a, b) => a.msTaken - b.msTaken)
    .slice(0, n)
    .flatMap((e) => { const p = byId.get(e.participantId); return p ? [{ participantId: p.id, nickname: p.nickname, avatarSeed: p.avatarSeed, ms: e.msTaken }] : []; });
}

/** Takım sıralaması: üye ortalaması (Kahoot takım modu gibi); eşitlikte toplam, sonra ad. */
export function buildTeamStandings(teams: Team[], participants: Participant[], prevRanks?: Map<string, number>): TeamStanding[] {
  const rows = teams.map((t) => {
    const members = participants.filter((p) => p.teamId === t.id);
    const total = members.reduce((s, p) => s + p.score, 0);
    return { teamId: t.id, name: t.name, members: members.length, totalScore: total, avgScore: members.length ? Math.round(total / members.length) : 0 };
  });
  rows.sort((a, b) => b.avgScore - a.avgScore || b.totalScore - a.totalScore || a.name.localeCompare(b.name));
  return rows.map((r, i) => { const rank = i + 1; const prev = prevRanks?.get(r.teamId); return { ...r, rank, rankDelta: prev === undefined ? 0 : prev - rank }; });
}

/** Round-robin takım atama: en az üyeli takım. */
export function pickTeam(teams: Team[], participants: Participant[]): string | null {
  if (teams.length === 0) return null;
  const counts = new Map(teams.map((t) => [t.id, 0]));
  for (const p of participants) if (p.teamId && counts.has(p.teamId)) counts.set(p.teamId, counts.get(p.teamId)! + 1);
  let best = teams[0]!.id, min = Infinity;
  for (const t of teams) { const c = counts.get(t.id)!; if (c < min) { min = c; best = t.id; } }
  return best;
}
