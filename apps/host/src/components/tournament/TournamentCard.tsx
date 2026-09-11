"use client";

import Link from "next/link";
import type { TournamentCard as Card } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { LOCALE_FLAG } from "@/lib/tournaments";

/** Kapak varsa kapak; yoksa ilk 4 adayın 2x2 kolajı; o da yoksa baş harf. */
export function CardVisual({ coverUrl, thumbUrls, title, className }: { coverUrl: string | null; thumbUrls: string[]; title: string; className?: string }) {
  const cls = `t-visual${className ? ` ${className}` : ""}`;
  if (coverUrl) return <div className={cls}><img src={coverUrl} alt="" loading="lazy" /></div>;
  const thumbs = thumbUrls.slice(0, 4);
  if (thumbs.length >= 2) {
    return (
      <div className={`${cls} t-visual--grid`} data-n={Math.min(4, thumbs.length)}>
        {thumbs.map((u, i) => <img key={i} src={u} alt="" loading="lazy" />)}
      </div>
    );
  }
  if (thumbs.length === 1) return <div className={cls}><img src={thumbs[0]} alt="" loading="lazy" /></div>;
  return <div className={`${cls} t-visual--empty`}><span>{title.trim().charAt(0).toUpperCase() || "?"}</span></div>;
}

export function TournamentCard({ card, compact }: { card: Card; compact?: boolean }) {
  const t = useT();
  return (
    <Link href={`/t/${card.slug}`} className={`s-card t-card${compact ? " t-card--compact" : ""}`}>
      <CardVisual coverUrl={card.coverUrl} thumbUrls={card.thumbUrls} title={card.title} />
      <div className="t-card__body">
        <div className="t-card__top">
          <span className="s-chip t-cat">{t(`tournament.cat_${card.category}`)}</span>
          <span className="t-flag">{LOCALE_FLAG[card.locale]}</span>
        </div>
        <h3>{card.title}</h3>
        {!compact && card.description && <p className="s-muted">{card.description}</p>}
        <div className="t-card__meta s-muted">
          <span>{t("tournament.items", { n: card.itemCount })}</span>
          <span>·</span>
          <span>{t("tournament.plays", { n: card.plays })}</span>
        </div>
      </div>
    </Link>
  );
}
