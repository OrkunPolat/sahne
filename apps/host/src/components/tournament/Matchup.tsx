"use client";

import { useMemo } from "react";
import type { TournamentItem } from "@sahne/protocol";
import { useT } from "@/lib/providers";

/** Tur etiketi: 2 → Final, 4 → Yarı final, aksi "{n}'lık tur". */
export function useRoundLabel() {
  const t = useT();
  return (round: number) => (round === 2 ? t("tournament.final") : round === 4 ? t("tournament.semiFinal") : t("tournament.roundOf", { n: round }));
}

export function ItemCard({
  item, side, onPick, state, votes, share, big, tabIndex,
}: {
  item: TournamentItem; side: "a" | "b"; onPick?: () => void;
  /** idle: seçilebilir · winner: kazanan · loser: kaybeden */
  state?: "idle" | "winner" | "loser"; votes?: number | null; share?: number | null; big?: boolean; tabIndex?: number;
}) {
  const cls = `t-mcard t-mcard--${side}${state && state !== "idle" ? ` t-mcard--${state}` : ""}${big ? " t-mcard--big" : ""}${onPick ? " t-mcard--pick" : ""}`;
  const inner = (
    <>
      <div className="t-mcard__img">
        {item.imageUrl ? <img src={item.imageUrl} alt="" draggable={false} /> : <span className="t-mcard__letter">{item.name.charAt(0).toUpperCase()}</span>}
      </div>
      <div className="t-mcard__name">{item.name}</div>
      {share !== null && share !== undefined && (
        <div className="t-mcard__votes">
          <div className="p-bar"><i style={{ width: `${Math.round(share * 100)}%` }} /></div>
          <span className="t-mcard__count">{votes ?? 0}</span>
        </div>
      )}
    </>
  );
  if (onPick) return <button type="button" className={cls} onClick={onPick} tabIndex={tabIndex}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

/** CSS partikül konfetisi (kütüphanesiz). */
export function Confetti({ count = 48 }: { count?: number }) {
  const parts = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 900, dur: 2400 + Math.random() * 1600, rot: Math.random() * 720 - 360, size: 6 + Math.random() * 8, hue: i % 4,
  })), [count]);
  return (
    <div className="t-confetti" aria-hidden>
      {parts.map((p) => (
        <i key={p.id} className={`t-confetti__p t-confetti__p--${p.hue}`} style={{ left: `${p.x}%`, width: p.size, height: p.size * 0.6, animationDelay: `${p.delay}ms`, animationDuration: `${p.dur}ms`, ["--rot" as string]: `${p.rot}deg` }} />
      ))}
    </div>
  );
}

export function ChampionCard({ item, label }: { item: TournamentItem; label: string }) {
  return (
    <div className="t-champ s-pop">
      <div className="t-champ__crown" aria-hidden>👑</div>
      <span className="t-champ__label">{label}</span>
      <div className="t-champ__img">
        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="t-mcard__letter">{item.name.charAt(0).toUpperCase()}</span>}
      </div>
      <h2 className="t-champ__name">{item.name}</h2>
    </div>
  );
}

/** Şu ana kadarki eşleşmeler: küçük çipler (kazanan adı). */
export function ProgressStrip({ results, items, size }: { results: Array<{ winnerId: string; round: number }>; items: TournamentItem[]; size: number }) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const total = size - 1;
  return (
    <div className="t-strip" aria-label="progress">
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const w = r ? byId.get(r.winnerId) : null;
        return (
          <span key={i} className={`t-strip__chip${r ? " t-strip__chip--done" : ""}${r?.round === 2 ? " t-strip__chip--final" : ""}`} title={w?.name}>
            {w?.imageUrl ? <img src={w.imageUrl} alt="" /> : w ? <b>{w.name.charAt(0)}</b> : null}
          </span>
        );
      })}
    </div>
  );
}
