import { useEffect } from "react";
import type { Slide } from "@sahne/protocol";
import { useI18n } from "../lib/i18n";
import { useCountUp } from "../lib/useCountUp";

export interface You { correct: boolean | null; pointsAwarded: number; score: number; rank: number; rankDelta: number; streak: number }

export function Reveal({ slide, you }: { slide: Slide; you: You | undefined }) {
  const { t } = useI18n();
  const isGame = slide.mode === "game" && you !== undefined;

  useEffect(() => {
    if (!isGame || you.correct === null) return;
    try { navigator.vibrate?.(you.correct ? [40] : [60, 40, 60]); } catch { /* ignore */ }
  }, [isGame, you]);

  const points = useCountUp(isGame ? you.pointsAwarded : 0);

  if (!isGame) {
    return (
      <div className="p-center s-fade-in">
        <div className="s-card s-card--glow p-result s-pop">
          <div className="p-result__title">{t("play.thanks")}</div>
          <div className="p-sub">{t("play.waitingHost")}</div>
        </div>
      </div>
    );
  }

  const title = you.correct === null ? t("play.noAnswer") : you.correct ? t("play.correct") : t("play.wrong");
  const cls = you.correct === null ? "" : you.correct ? "p-result__title--ok" : "p-result__title--bad";
  const delta = you.rankDelta > 0 ? t("play.rankUp", { n: you.rankDelta }) : you.rankDelta < 0 ? t("play.rankDown", { n: -you.rankDelta }) : t("play.rankSame");

  return (
    <div className="p-center s-fade-in">
      <div className="s-card s-card--glow p-result">
        <div className={`p-result__title s-pop ${cls}`}>{title}</div>
        <div className="p-result__points s-pop" style={{ animationDelay: "120ms" }}>{t("play.pointsEarned", { n: points })}</div>
        <div className="p-sub" style={{ marginTop: -8 }}>{you.score} {t("common.points")}</div>
        {you.streak >= 2 && <span className="s-chip s-pop" style={{ animationDelay: "220ms" }}>🔥 {t("play.streak", { n: you.streak })}</span>}
        <div className="p-result__rank s-pop" style={{ animationDelay: "300ms" }}>{t("play.yourRank", { rank: you.rank })}</div>
        <div className="p-result__delta">{delta}</div>
      </div>
      <div className="p-state"><div className="p-sub">{t("play.waitingHost")}</div></div>
    </div>
  );
}
