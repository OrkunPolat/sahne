import { Avatar } from "@sahne/ui";
import { useI18n } from "../lib/i18n";

export function Lobby({ nickname, avatarSeed, title }: { nickname: string; avatarSeed: string; title?: string }) {
  const { t } = useI18n();
  return (
    <div className="p-center s-fade-in">
      <div className="s-card s-card--glow p-card p-stack" style={{ alignItems: "center", textAlign: "center", gap: 16 }}>
        <h1 className="p-h1 s-pop">{t("play.youreIn")}</h1>
        <div className="p-avatar-wrap s-pop"><Avatar seed={avatarSeed} size={128} /></div>
        <div className="p-nick-big">{nickname}</div>
        <div className="p-sub">{t("play.seeYourName")}</div>
      </div>
      <div className="p-state">
        {title && <div className="p-h2" style={{ marginBottom: 8 }}>{title}</div>}
        <div className="p-sub">{t("play.waitingHost")}</div>
      </div>
    </div>
  );
}
