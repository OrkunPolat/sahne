"use client";

import Link from "next/link";
import { ThemeSwitcher, THEME_IDS, type ThemeId } from "@sahne/ui";
import { LOCALES } from "@sahne/i18n";
import { useLocale, useT, useTheme } from "@/lib/providers";
import { PLAY_URL } from "@/lib/api";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      <path d="M32 14l18 32H14z" fill="var(--accent-fg)" />
    </svg>
  );
}

export function SiteHeader() {
  const t = useT();
  const [theme, setTheme] = useTheme();
  const [locale, setLocale] = useLocale();
  const labels = Object.fromEntries(THEME_IDS.map((id) => [id, t(`theme.${id}`)])) as Record<ThemeId, string>;
  return (
    <header className="h-site-header">
      <div className="h-site-header__inner">
        <Link href="/" className="h-brand"><Logo /> <span>{t("common.appName")}</span></Link>
        <nav className="h-nav" aria-label="Site">
          <Link href="/t">{t("tournament.nav")}</Link>
          <a href="/#features">{t("host.nav_features")}</a>
          <a href="/#how">{t("host.nav_how")}</a>
          <a href={PLAY_URL}>{t("host.nav_join")}</a>
        </nav>
        <div className="h-site-header__ctl">
          <ThemeSwitcher value={theme} onChange={setTheme} labels={labels} />
          <div className="h-seg" role="group" aria-label={t("common.language")}>
            {LOCALES.map((l) => (
              <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <a href="/#create" className="s-btn s-btn--primary h-nav-cta">{t("host.ctaCreate")}</a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="h-site-footer">
      <div className="h-site-footer__inner">
        <div className="h-brand h-brand--muted"><Logo size={18} /> <span>{t("common.appName")}</span></div>
        <p className="s-muted">{t("host.footerNote")}</p>
        <nav className="h-footer-links" aria-label="Footer">
          <Link href="/t">{t("tournament.nav")}</Link>
          <a href={PLAY_URL}>{t("host.nav_join")}</a>
          <a href="https://github.com/OrkunPolat/sahne" target="_blank" rel="noreferrer">{t("host.footerSource")}</a>
        </nav>
        <span className="s-muted h-copy">© {new Date().getFullYear()} {t("common.appName")}</span>
      </div>
    </footer>
  );
}
