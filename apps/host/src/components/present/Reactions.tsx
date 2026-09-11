"use client";
import { useEffect, useState } from "react";
import type { FloatingReaction } from "@/lib/useHostSocket";

const LIFE_MS = 2200;

/** Sağ alttan yükselip solan emojiler. Konum rastgele x; hareket CSS keyframes; reduced-motion'da sadece solar. */
export function Reactions({ items }: { items: FloatingReaction[] }) {
  const [, tick] = useState(0);
  // Süresi dolanları düşürmek için kısa periyotla yeniden çiz (yalnızca ekranda tepki varken).
  useEffect(() => {
    if (items.length === 0) return;
    const id = setInterval(() => tick((n) => n + 1), 400);
    return () => clearInterval(id);
  }, [items.length]);
  const now = Date.now();
  const live = items.filter((r) => now - r.at < LIFE_MS + 200);
  if (live.length === 0) return null;
  return (
    <div className="p-reactions" aria-hidden>
      {live.map((r) => (
        <span key={r.id} className="p-reaction" style={{ right: `${8 + r.x * 22}%`, animationDuration: `${LIFE_MS}ms`, ["--drift" as string]: `${(r.x - 0.5) * 80}px` }}>
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
