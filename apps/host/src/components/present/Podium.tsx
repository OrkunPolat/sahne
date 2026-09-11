"use client";

import { Avatar } from "@sahne/ui";
import type { LeaderboardEntry } from "@sahne/protocol";
import { useT } from "@/lib/providers";

export function Podium({ podium }: { podium: LeaderboardEntry[] }) {
  const t = useT();
  const byRank = (r: number) => podium.find((e) => e.rank === r) ?? podium[r - 1];
  // Görsel sıra: 2 · 1 · 3; yükselme gecikmeleri 3 → 2 → 1.
  const slots: { e: LeaderboardEntry | undefined; delay: number }[] = [
    { e: byRank(2), delay: 500 }, { e: byRank(1), delay: 1000 }, { e: byRank(3), delay: 0 },
  ];
  return (
    <div className="p-podium">
      {slots.map(({ e, delay }, i) => (
        <div key={i} className="p-podium-slot s-pop" style={{ animationDelay: `${delay}ms`, animationDuration: "700ms" }}>
          {e ? (
            <>
              <Avatar seed={e.avatarSeed} size={72} />
              <div className="name">{e.nickname}</div>
              <div className="score">{e.score} {t("common.points")}</div>
              <div className="block">{e.rank}</div>
            </>
          ) : <div className="block" style={{ opacity: 0.3 }} />}
        </div>
      ))}
    </div>
  );
}
