"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TOURNAMENT_CATEGORIES, type Locale, type TournamentCard as Card, type TournamentCategory } from "@sahne/protocol";
import { LOCALES, LOCALE_LABELS } from "@sahne/i18n";
import { useT } from "@/lib/providers";
import { errText, listTournaments, readOwned, removeOwned, type OwnedTournament, type TournamentSort } from "@/lib/tournaments";
import { TournamentCard } from "@/components/tournament/TournamentCard";

const PAGE = 24;

export default function GalleryPage() {
  const t = useT();
  const [sort, setSort] = useState<TournamentSort>("latest");
  const [category, setCategory] = useState<TournamentCategory | "">("");
  const [locale, setLocale] = useState<Locale | "">("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owned, setOwned] = useState<OwnedTournament[]>([]);
  const seq = useRef(0);

  useEffect(() => { setOwned(readOwned()); }, []);

  // Arama: 300ms debounce.
  useEffect(() => {
    const id = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(id);
  }, [qInput]);

  const load = useCallback(async (reset: boolean, cur: string | null) => {
    const my = ++seq.current;
    if (reset) setLoading(true); else setMore(true);
    setError(null);
    try {
      const r = await listTournaments({ sort, category, locale, q, limit: PAGE, cursor: reset ? null : cur });
      if (my !== seq.current) return;
      setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
      setCursor(r.nextCursor ?? null);
    } catch (e) {
      if (my === seq.current) setError(errText(e));
    } finally {
      if (my === seq.current) { setLoading(false); setMore(false); }
    }
  }, [sort, category, locale, q]);

  useEffect(() => { void load(true, null); }, [load]);

  return (
    <main className="h-page t-page">
      <section className="t-head s-fade-in">
        <div>
          <h1>{t("tournament.title")}</h1>
          <p className="s-muted">{t("tournament.lead")}</p>
        </div>
        <Link href="/t/new" className="s-btn s-btn--primary s-btn--lg">+ {t("tournament.create")}</Link>
      </section>

      {owned.length > 0 && (
        <section className="t-mine s-card">
          <h2>{t("tournament.mine")}</h2>
          <div className="t-mine__list">
            {owned.map((o) => (
              <div key={o.id} className="t-mine__row">
                <Link href={`/t/${o.slug}`} className="t-mine__title">{o.title}</Link>
                <div className="h-actions">
                  <Link className="s-btn" href={`/t/${o.slug}/edit`}>{t("tournament.edit")}</Link>
                  <Link className="s-btn s-btn--primary" href={`/t/${o.slug}/play`}>{t("tournament.play")}</Link>
                  <button type="button" className="s-btn s-btn--ghost" aria-label={t("common.delete")} title={t("common.delete")}
                    onClick={() => { removeOwned(o.id); setOwned(readOwned()); }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="t-filters s-card">
        <div className="h-seg" role="group" aria-label="sort">
          {(["latest", "popular"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>{t(s === "latest" ? "tournament.sortLatest" : "tournament.sortPopular")}</button>
          ))}
        </div>
        <select className="s-input h-select t-filters__sel" value={category} onChange={(e) => setCategory(e.target.value as TournamentCategory | "")} aria-label={t("tournament.formCategory")}>
          <option value="">{t("tournament.allCategories")}</option>
          {TOURNAMENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`tournament.cat_${c}`)}</option>)}
        </select>
        <select className="s-input h-select t-filters__sel" value={locale} onChange={(e) => setLocale(e.target.value as Locale | "")} aria-label={t("tournament.formLocale")}>
          <option value="">{t("tournament.allLocales")}</option>
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
        </select>
        <input className="s-input t-filters__search" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={t("tournament.searchPlaceholder")} aria-label={t("tournament.searchPlaceholder")} />
      </div>

      {error && <p className="h-error" role="alert">{error}</p>}

      {loading ? (
        <div className="h-empty"><span className="h-spinner h-spinner--lg" /></div>
      ) : items.length === 0 ? (
        <div className="s-card t-empty">
          <strong>{t("tournament.empty")}</strong>
          <p className="s-muted">{t("tournament.emptyHint")}</p>
          <Link href="/t/new" className="s-btn s-btn--primary">+ {t("tournament.create")}</Link>
        </div>
      ) : (
        <>
          <div className="t-grid">
            {items.map((c) => <TournamentCard key={c.id} card={c} />)}
          </div>
          {cursor && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
              <button type="button" className="s-btn s-btn--lg" disabled={more} onClick={() => load(false, cursor)}>
                {more ? t("common.loading") : `${t("tournament.loadMore")} ↓`}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
