"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { THEME_IDS, type Locale, type ThemeId } from "@sahne/protocol";
import { LOCALES, LOCALE_LABELS } from "@sahne/i18n";
import { useT } from "@/lib/providers";
import { ApiError, createSession } from "@/lib/api";
import { readRegistry, removeFromRegistry, saveToRegistry, type HostSession } from "@/lib/registry";

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

  return (
    <main className="h-page">
      <header className="h-hero s-fade-in">
        <h1>{t("common.appName")}</h1>
        <p className="s-muted">{t("host.tagline")}</p>
      </header>

      <div className="h-grid">
        <form className="s-card s-card--glow h-form" onSubmit={onSubmit}>
          <h2>{t("host.newSession")}</h2>
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

        <section>
          <h2 style={{ marginBottom: 14 }}>{t("host.mySessions")}</h2>
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
    </main>
  );
}
