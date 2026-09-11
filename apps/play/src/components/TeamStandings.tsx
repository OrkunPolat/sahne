import type { TeamStanding } from "@sahne/protocol";
import { useI18n } from "../lib/i18n";

export function TeamStandings({ teams, myTeamId }: { teams: TeamStanding[]; myTeamId: string | null }) {
  const { t } = useI18n();
  if (!teams.length) return null;
  const mine = myTeamId ? teams.find((x) => x.teamId === myTeamId) : undefined;
  const top = [...teams].sort((a, b) => a.rank - b.rank).slice(0, 3);
  return (
    <div className="s-card p-teams s-fade-in">
      <div className="p-label">{t("play.teamStandings")}</div>
      {mine && <div className="p-teams__mine">{t("play.teamRankLine", { rank: mine.rank, avg: Math.round(mine.avgScore) })}</div>}
      <ol className="p-teams__list">
        {top.map((x) => (
          <li key={x.teamId} className={x.teamId === myTeamId ? "p-teams__row p-teams__row--mine" : "p-teams__row"}>
            <span className="p-teams__rank">{x.rank}</span>
            <span className="p-teams__name">{x.name}</span>
            <span className="p-teams__meta">{t("play.teamMembers", { n: x.members })}</span>
            <span className="p-teams__avg">{Math.round(x.avgScore)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
