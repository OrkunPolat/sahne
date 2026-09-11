import { useI18n } from "../lib/i18n";

export function SentState({ timeUp }: { timeUp?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="p-state s-pop">
      {timeUp ? (
        <div className="p-state__title">{t("play.timeUp")}</div>
      ) : (
        <div className="p-sent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 13l4 4L19 7" /></svg>
          <span>{t("play.answerSent")}</span>
        </div>
      )}
      <div className="p-sub" style={{ marginTop: 6 }}>{t("play.waitingOthers")}</div>
    </div>
  );
}
