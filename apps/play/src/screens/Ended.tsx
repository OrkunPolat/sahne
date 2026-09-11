import { Avatar } from "@sahne/ui";
import { useI18n } from "../lib/i18n";

export function Ended({ nickname, avatarSeed, rank, score, onLeave }: { nickname: string; avatarSeed: string; rank: number | null; score: number | null; onLeave: () => void }) {
  const { t } = useI18n();
  return (
    <div className="p-center s-fade-in">
      <div className="s-card s-card--glow p-result">
        <div className="p-label">{t("play.finalRank")}</div>
        {rank !== null ? <div className="p-rank-big s-pop">{rank}<sup>.</sup></div> : <div className="p-h2">{t("play.sessionOver")}</div>}
        {score !== null && <div className="p-result__points" style={{ fontSize: "1.6rem" }}>{score} {t("common.points")}</div>}
        <div className="p-avatar-wrap"><Avatar seed={avatarSeed} size={96} /></div>
        <div className="p-nick-big">{nickname}</div>
        <div className="p-sub">{t("play.thanks")}</div>
      </div>
      <button type="button" className="s-btn s-btn--ghost" onClick={onLeave}>{t("play.leave")}</button>
    </div>
  );
}
