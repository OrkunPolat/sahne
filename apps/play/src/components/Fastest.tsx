import type { FastestEntry } from "@sahne/protocol";
import { Avatar } from "@sahne/ui";
import { useI18n } from "../lib/i18n";

export function FastestBadge({ n }: { n: number }) {
  const { t } = useI18n();
  return <span className="s-chip p-fastest-badge s-pop">{t("play.fastestBadge", { n })}</span>;
}

export function FastestList({ fastest }: { fastest: FastestEntry[] }) {
  const { t } = useI18n();
  if (!fastest.length) return null;
  return (
    <div className="p-fastest">
      <span className="p-fastest__label">⚡ {t("play.fastestList")}</span>
      {fastest.map((f, i) => (
        <span key={f.participantId} className="p-fastest__item">
          <Avatar seed={f.avatarSeed} size={18} />
          <span>{i + 1}. {f.nickname}</span>
          <span className="p-fastest__ms">{(f.ms / 1000).toFixed(1)}s</span>
        </span>
      ))}
    </div>
  );
}
