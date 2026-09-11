"use client";

import { useEffect, useState } from "react";
import { maxBracketSize } from "@sahne/engine";
import { BRACKET_SIZES, type Slide, type Tournament, type TournamentCard } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { errText, getTournament, listTournaments } from "@/lib/tournaments";
import { CardVisual } from "@/components/tournament/TournamentCard";

type BS = Extract<Slide, { type: "bracket" }>;

/** Canlı turnuva slaydı: galeriden ara ya da slug yapıştır → boyut seç. Seçilen turnuvanın başlığı slayt metni olur. */
export function BracketPicker({ slide, onChange }: { slide: BS; onChange: (patch: Partial<BS>) => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TournamentCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Tournament | null>(null);
  const [changing, setChanging] = useState(false);

  // Kayıtlı slayt: turnuva bilgisini id ile geri yükle (API slug ile de id ile de açar).
  useEffect(() => {
    if (!slide.tournamentId || picked?.id === slide.tournamentId) return;
    let alive = true;
    getTournament(slide.tournamentId).then((r) => { if (alive) setPicked(r.tournament); }).catch(() => { /* metin zaten var */ });
    return () => { alive = false; };
  }, [slide.tournamentId, picked?.id]);

  useEffect(() => {
    const id = setTimeout(async () => {
      setSearching(true); setError(null);
      try { setResults((await listTournaments({ q: q.trim(), sort: "popular", limit: 8 })).items); }
      catch (e) { setError(errText(e)); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  async function choose(slugOrId: string) {
    setError(null);
    try {
      const { tournament } = await getTournament(slugOrId);
      const max = maxBracketSize(tournament.items.length);
      setPicked(tournament); setChanging(false);
      onChange({ tournamentId: tournament.id, size: Math.min(max, slide.size >= 4 ? slide.size : 8, 32) as BS["size"], items: tournament.items, text: tournament.title });
    } catch (e) { setError(errText(e)); }
  }

  const itemCount = picked?.items.length ?? slide.items.length;
  const max = itemCount >= 4 ? maxBracketSize(itemCount) : 256;
  const sizes = BRACKET_SIZES.filter((s) => s <= max);

  if (slide.tournamentId && !changing) {
    const title = picked?.title ?? slide.text;
    const thumbs = (picked?.items ?? slide.items).map((i) => i.imageUrl).filter((u): u is string => !!u);
    return (
      <div className="h-field">
        <span>{t("tournament.selected")}</span>
        <div className="t-pick s-card">
          <CardVisual coverUrl={picked?.coverUrl ?? null} thumbUrls={thumbs} title={title} className="t-pick__visual" />
          <div className="t-pick__body">
            <strong>{title}</strong>
            {picked && <span className="s-muted">{t("tournament.items", { n: picked.items.length })} · {t("tournament.plays", { n: picked.plays })}</span>}
            {picked && <code className="s-muted t-pick__slug">{picked.slug}</code>}
          </div>
          <button type="button" className="s-btn" onClick={() => setChanging(true)}>{t("tournament.change")}</button>
        </div>
        <label className="h-field" style={{ marginTop: 8 }}>
          <span>{t("tournament.sizeSelect")}</span>
          <div className="t-sizes t-sizes--sm" role="group">
            {sizes.map((s) => (
              <button key={s} type="button" className={`t-size${slide.size === s ? " t-size--on" : ""}`} aria-pressed={slide.size === s} onClick={() => onChange({ size: s })}>
                <b>{s}</b>
              </button>
            ))}
          </div>
        </label>
      </div>
    );
  }

  return (
    <div className="h-field">
      <span>{t("tournament.pickTournament")}</span>
      {slide.tournamentId === "" && <small className="s-muted">{t("tournament.noTournament")}</small>}
      <input className="s-input" type="search" value={q} placeholder={t("tournament.searchTournaments")} onChange={(e) => setQ(e.target.value)} />
      <div className="t-pick-list">
        {searching && results.length === 0 && <span className="h-spinner" />}
        {!searching && results.length === 0 && <span className="s-muted">{t("tournament.noResults")}</span>}
        {results.map((c) => (
          <button key={c.id} type="button" className="t-pick-row" onClick={() => choose(c.slug)}>
            <CardVisual coverUrl={c.coverUrl} thumbUrls={c.thumbUrls} title={c.title} className="t-pick-row__visual" />
            <span className="t-pick-row__body">
              <strong>{c.title}</strong>
              <small className="s-muted">{t(`tournament.cat_${c.category}`)} · {t("tournament.items", { n: c.itemCount })} · {t("tournament.plays", { n: c.plays })}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="h-option">
        <input className="s-input" value={slug} placeholder={t("tournament.slugPlaceholder")} aria-label={t("tournament.pasteSlug")} onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (slug.trim()) void choose(slug.trim()); } }} />
        <button type="button" className="s-btn" disabled={!slug.trim()} onClick={() => choose(slug.trim())}>{t("tournament.load")}</button>
      </div>
      {slide.tournamentId && <button type="button" className="s-btn s-btn--ghost" style={{ justifySelf: "start" }} onClick={() => setChanging(false)}>{t("common.cancel")}</button>}
      {error && <p className="h-error" role="alert">{error}</p>}
    </div>
  );
}
