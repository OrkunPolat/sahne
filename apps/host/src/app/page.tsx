"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { THEME_IDS, type Locale, type ThemeId } from "@sahne/protocol";
import { LOCALES, LOCALE_LABELS } from "@sahne/i18n";
import { useT } from "@/lib/providers";
import { ApiError, createSession } from "@/lib/api";
import { readRegistry, removeFromRegistry, saveToRegistry, type HostSession } from "@/lib/registry";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { PLAY_URL } from "@/lib/api";
import { DemoButton } from "@/components/home/DemoButton";
import { AiCard } from "@/components/home/AiCard";
import { TemplateGallery } from "@/components/home/TemplateGallery";
import { PopularTournaments } from "@/components/home/PopularTournaments";

export default function HomePage() {
  const t = useT();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [themeDefault, setThemeDefault] = useState<ThemeId>("midnight-gold");
  const [localeDefault, setLocaleDefault] = useState<Locale>("tr");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<HostSession[]>([]);

  useEffect(() => { setSessions(readRegistry()); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const s = await createSession({ title: title.trim(), themeDefault, localeDefault });
      saveToRegistry({ id: s.id, code: s.code, title: s.title, hostSecret: s.hostSecret, createdAt: Date.now() });
      router.push(`/s/${s.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? `${err.code}: ${err.message}` : String(err));
      setBusy(false);
    }
  }

  function onDelete(id: string) {
    removeFromRegistry(id);
    setSessions(readRegistry());
  }

  const features = [1, 2, 3, 4] as const;
  const steps = [1, 2, 3] as const;

  return (
    <>
      <SiteHeader />
      <main className="h-page h-landing">
        <section className="h-hero s-fade-in">
          <h1>{t("host.heroTitle")} <span className="h-accent">{t("host.heroTitleAccent")}</span></h1>
          <p className="s-muted">{t("host.heroLead")}</p>
          <div className="h-actions">
            <DemoButton className="s-btn s-btn--primary s-btn--lg" />
            <a href="#create" className="s-btn s-btn--lg">{t("host.ctaCreate")} →</a>
            <a href={PLAY_URL} className="s-btn s-btn--lg">{t("host.ctaJoin")}</a>
            <Link href="/t" className="s-btn s-btn--lg">🏆 {t("tournament.nav")}</Link>
          </div>
          <p className="s-muted h-hero__hint">{t("host.tryNowHint")}</p>
        </section>

        <AiCard />

        <div className="h-grid" id="create">
        <section>
        <h2 className="h-col-title">{t("host.newSession")}</h2>
        <form className="s-card s-card--glow h-form" onSubmit={onSubmit}>
          <label>
            {t("host.sessionTitle")}
            <input className="s-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("host.sessionTitlePlaceholder")} maxLength={80} required />
          </label>
          <div className="h-row">
            <label>
              {t("common.theme")}
              <select className="s-input h-select" value={themeDefault} onChange={(e) => setThemeDefault(e.target.value as ThemeId)}>
                {THEME_IDS.map((id) => <option key={id} value={id}>{t(`theme.${id}`)}</option>)}
              </select>
            </label>
            <label>
              {t("common.language")}
              <select className="s-input h-select" value={localeDefault} onChange={(e) => setLocaleDefault(e.target.value as Locale)}>
                {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="h-error" role="alert">{error}</p>}
          <button type="submit" className="s-btn s-btn--primary s-btn--lg" disabled={busy || !title.trim()}>
            {busy ? t("common.loading") : t("host.create")}
          </button>
        </form>
        </section>

        <section>
          <h2 className="h-col-title">{t("host.mySessions")}</h2>
          {sessions.length === 0 ? (
            <div className="s-card h-empty">{t("host.noSessions")}</div>
          ) : (
            <div className="h-list">
              {sessions.map((s) => (
                <div key={s.id} className="s-card h-list-item s-fade-in">
                  <span className="h-code">{s.code}</span>
                  <div className="grow">
                    <div className="title">{s.title}</div>
                    <div className="s-muted" style={{ fontSize: "0.8rem" }}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(s.createdAt)}</div>
                  </div>
                  <div className="h-actions">
                    <Link className="s-btn" href={`/s/${s.id}/edit`}>{t("host.editor")}</Link>
                    <Link className="s-btn s-btn--primary" href={`/s/${s.id}/present`}>{t("host.present")}</Link>
                    <button type="button" className="s-btn s-btn--ghost" onClick={() => onDelete(s.id)} aria-label={t("common.delete")}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

        <TemplateGallery />
        <PopularTournaments />

        <section className="h-section" id="features">
          <h2>{t("host.featuresTitle")}</h2>
          <p className="s-muted h-section__lead">{t("host.featuresLead")}</p>
          <div className="h-features">
            {features.map((n) => (
              <div key={n} className="s-card h-feature">
                <span className="h-feature__n">0{n}</span>
                <h3>{t(`host.f${n}Title`)}</h3>
                <p className="s-muted">{t(`host.f${n}Text`)}</p>
              </div>
            ))}
            <Link href="/t" className="s-card h-feature h-feature--link">
              <span className="h-feature__n">🏆</span>
              <h3>{t("tournament.homeCardTitle")}</h3>
              <p className="s-muted">{t("tournament.homeCardText")}</p>
              <span className="h-template__cta">{t("tournament.seeAll")} →</span>
            </Link>
          </div>
        </section>

        <section className="h-section" id="how">
          <h2>{t("host.howTitle")}</h2>
          <ol className="h-steps">
            {steps.map((n) => (
              <li key={n} className="h-step">
                <span className="h-step__n">{n}</span>
                <div>
                  <h3>{t(`host.h${n}Title`)}</h3>
                  <p className="s-muted">{t(`host.h${n}Text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
