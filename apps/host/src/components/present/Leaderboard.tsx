"use client";

import { useLayoutEffect, useRef } from "react";
import { Avatar } from "@sahne/ui";
import type { LeaderboardEntry } from "@sahne/protocol";
import { useT } from "@/lib/providers";

/** FLIP: satırlar sırası değişince eski konumdan yeni konuma kayar. */
export function Leaderboard({ entries, limit = 10, title }: { entries: LeaderboardEntry[]; limit?: number; title?: string }) {
  const t = useT();
  const rows = useRef(new Map<string, HTMLDivElement>());
  const prev = useRef(new Map<string, number>());
  const shown = entries.slice(0, limit);

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    rows.current.forEach((el, id) => {
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      const was = prev.current.get(id);
      if (was !== undefined && Math.abs(was - top) > 1) {
        el.style.transition = "none";
        el.style.transform = `translateY(${was - top}px)`;
        void el.offsetHeight;
        el.style.transition = "";
        el.style.transform = "";
      } else if (was === undefined && prev.current.size > 0) {
        el.classList.remove("s-pop"); void el.offsetWidth; el.classList.add("s-pop");
      }
    });
    prev.current = next;
  }, [shown]);

  return (
    <div className="s-card p-lb">
      <h3>{title ?? t("host.leaderboard")}</h3>
      {shown.map((e) => {
        const d = e.rankDelta;
        return (
          <div key={e.participantId} className={`p-lb-row${e.rank <= 3 ? " top" : ""} s-pop`}
            ref={(el) => { if (el) rows.current.set(e.participantId, el); else rows.current.delete(e.participantId); }}>
            <span className="rank">{e.rank}</span>
            <Avatar seed={e.avatarSeed} size={32} />
            <span className="name">{e.nickname}</span>
            <span className={`delta ${d > 0 ? "up" : d < 0 ? "down" : "same"}`}>{d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "–"}</span>
            <span className="score">{e.score}</span>
          </div>
        );
      })}
    </div>
  );
}
