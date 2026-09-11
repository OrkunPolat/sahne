import type { SocketStatus } from "../lib/useSocket";
import { useI18n } from "../lib/i18n";

export function ConnChip({ status }: { status: SocketStatus }) {
  const { t } = useI18n();
  if (status === "open" || status === "idle") return null;
  return (
    <div className="s-chip p-conn s-fade-in" role="status">
      <span className="p-conn__dot" aria-hidden />
      {t("common.reconnecting")}
    </div>
  );
}
