"use client";
import { Avatar } from "@sahne/ui";
import type { FastestEntry } from "@sahne/protocol";
import { useT } from "@/lib/providers";

/** Reveal'de en hızlı 3 doğru: avatar + ad + saniye. */
export function Fastest({ entries }: { entries: FastestEntry[] }) {
  const t = useT();
  if (entries.length === 0) return null;
  return (
    <div className="p-fastest s-fade-in">
      <span className="p-fastest__label">⚡ {t("host.fastest")}</span>
      {entries.slice(0, 3).map((e, i) => (
        <span key={e.participantId} className="p-fastest__row s-pop" style={{ animationDelay: `${i * 90}ms` }}>
          <Avatar seed={e.avatarSeed} size={26} />
          <b>{e.nickname}</b>
          <span className="s-muted">{t("host.fastestSeconds", { s: (e.ms / 1000).toFixed(1) })}</span>
        </span>
      ))}
    </div>
  );
}
