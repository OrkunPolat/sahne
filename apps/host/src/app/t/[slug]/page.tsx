"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { maxBracketSize } from "@sahne/engine";
import type { Tournament, TournamentItemStat } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { ApiError } from "@/lib/api";
import { errText, findOwnedBySlug, getTournament, LOCALE_FLAG, rankStats } from "@/lib/tournaments";
import { CardVisual } from "@/components/tournament/TournamentCard";

const PER_PAGE = 20;

export default function TournamentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useT();
  const [data, setData] = useState<{ tournament: Tournament; stats: TournamentItemStat[] } | null>(null);
  const [error, setError] = useState<{ notFound: boolean; text: string } | null>(null);
  const [owned, setOwned] = useState(false);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { setOwned(!!findOwnedBySlug(slug)); }, [slug]);
  useEffect(() => {
    let alive = true;
    getTournament(slug)
      .then((r) => { if (alive) setData(r); })
      .catch((e: unknown) => { if (alive) setError({ notFound: e instanceof ApiError && e.status === 404, text: errText(e) }); });
    return () => { alive = false; };
  }, [slug]);

  const ranked = useMemo(() => (data ? rankStats(data.tournament.items, data.stats) : []), [data]);
  const played = useMemo(() => ranked.some((r) => r.games > 0), [ranked]);

  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  if (error) {
    return (
      <main className="h-page t-page">
        <div className="s-card h-notice"><p>{error.notFound ? t("tournament.notFound") : error.text}</p><Link className="s-btn" href="/t">{t("tournament.backToGallery")}</Link></div>
      </main>
    );
  }
  if (!data) return <main className="h-page t-page"><div className="h-empty"><span className="h-spinner h-spinner--lg" /></div></main>;

  const tn = data.tournament;
  const pages = Math.max(1, Math.ceil(ranked.length / PER_PAGE));
  const rows = ranked.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const thumbs = tn.items.map((i) => i.imageUrl).filter((u): u is string => !!u);

  return (
    <main className="h-page t-page">
      <p className="s-muted" style={{ marginBottom: 12 }}><Link href="/t" className="t-back">← {t("tournament.backToGallery")}</Link></p>
      <section className="t-detail s-fade-in">
        <CardVisual coverUrl={tn.coverUrl} thumbUrls={thumbs} title={tn.title} className="t-detail__visual" />
        <div className="t-detail__body">
          <div className="t-card__top">
            <span className="s-chip t-cat">{t(`tournament.cat_${tn.category}`)}</span>
            <span className="t-flag">{LOCALE_FLAG[tn.locale]}</span>
          </div>
          <h1>{tn.title}</h1>
          {tn.description && <p className="s-muted t-detail__desc">{tn.description}</p>}
          <div className="t-card__meta s-muted">
            <span>{t("tournament.items", { n: tn.items.length })}</span><span>·</span>
            <span>{t("tournament.bracketOf", { size: maxBracketSize(tn.items.length) })}</span><span>·</span>
            <span>{t("tournament.plays", { n: tn.plays })}</span>
          </div>
          <div className="h-actions t-detail__actions">
            <Link href={`/t/${tn.slug}/play`} className="s-btn s-btn--primary s-btn--lg">▶ {t("tournament.play")}</Link>
            <button type="button" className="s-btn s-btn--lg" onClick={share}>{copied ? `✓ ${t("tournament.linkCopied")}` : `⧉ ${t("tournament.share")}`}</button>
            {owned && <Link href={`/t/${tn.slug}/edit`} className="s-btn s-btn--lg">✎ {t("tournament.edit")}</Link>}
          </div>
        </div>
      </section>

      <section className="t-stats s-card">
        <div className="t-items__head">
          <h2>{t("tournament.statsTitle")}</h2>
          {pages > 1 && (
            <div className="t-pager">
              <button type="button" className="h-icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t("common.prev")}>←</button>
              <span className="s-muted">{t("tournament.page", { page, pages })}</span>
              <button type="button" className="h-icon" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label={t("common.next")}>→</button>
            </div>
          )}
        </div>
        {!played && <p className="s-muted t-stats__empty">{t("tournament.noStats")}</p>}
        <div className="t-table" role="table">
          <div className="t-tr t-tr--head" role="row">
            <span role="columnheader">{t("tournament.statRank")}</span>
            <span role="columnheader" style={{ gridColumn: "2 / 4" }}>{t("tournament.statName")}</span>
            <span role="columnheader">{t("tournament.statWinRate")}</span>
            <span role="columnheader">{t("tournament.statChampRate")}</span>
          </div>
          {rows.map((r, i) => {
            const rank = (page - 1) * PER_PAGE + i + 1;
            return (
              <div key={r.item.id} className={`t-tr${rank === 1 && played ? " t-tr--top" : ""}`} role="row">
                <span className="t-rank" role="cell">{rank}</span>
                <span role="cell">{r.item.imageUrl ? <span className="t-thumb"><img src={r.item.imageUrl} alt="" loading="lazy" /></span> : <span className="t-thumb t-thumb--empty">{r.item.name.charAt(0).toUpperCase()}</span>}</span>
                <span className="t-name" role="cell">{r.item.name}<small className="s-muted">{t("tournament.statGames", { n: r.games })}</small></span>
                <span className="t-rate" role="cell"><b>{Math.round(r.winRate * 100)}%</b><span className="p-bar"><i style={{ width: `${r.winRate * 100}%` }} /></span></span>
                <span className="t-rate" role="cell"><b>{Math.round(r.champRate * 100)}%</b><span className="p-bar p-bar--gold"><i style={{ width: `${r.champRate * 100}%` }} /></span></span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
