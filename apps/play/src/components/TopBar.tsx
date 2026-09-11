import { useState } from "react";
import { LOCALES, type Locale } from "@sahne/i18n";
import { ThemeSwitcher, type ThemeId } from "@sahne/ui";
import { useI18n } from "../lib/i18n";
import { chooseTheme, currentTheme } from "../lib/theme";

export function TopBar({ theme, onTheme }: { theme: ThemeId; onTheme: (t: ThemeId) => void }) {
  const { t, locale, setLocale } = useI18n();
  const labels = {
    "midnight-gold": t("theme.midnight-gold"),
    "obsidian-neon": t("theme.obsidian-neon"),
    "cream-forest": t("theme.cream-forest"),
    "burgundy-champagne": t("theme.burgundy-champagne"),
  } as const;
  return (
    <header className="p-top">
      <span className="p-top__brand">{t("common.appName")}</span>
      <div className="p-top__right">
        <ThemeSwitcher value={theme} labels={labels} onChange={(th) => { chooseTheme(th); onTheme(th); }} />
        <div className="p-lang" role="group" aria-label={t("common.language")}>
          {LOCALES.map((l: Locale) => (
            <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>
    </header>
  );
}

export function useThemeState() {
  return useState<ThemeId>(() => currentTheme());
}
