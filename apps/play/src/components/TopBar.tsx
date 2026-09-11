import { useEffect, useState } from "react";
import { LOCALES, type Locale } from "@sahne/i18n";
import { ThemeSwitcher, type ThemeId } from "@sahne/ui";
import { useI18n } from "../lib/i18n";
import { chooseTheme, currentTheme } from "../lib/theme";
import { isSoundEnabled, onSoundChange, setSoundEnabled } from "../lib/sound";

export function TopBar({ theme, onTheme }: { theme: ThemeId; onTheme: (t: ThemeId) => void }) {
  const { t, locale, setLocale } = useI18n();
  const labels = {
    "midnight-gold": t("theme.midnight-gold"),
    "obsidian-neon": t("theme.obsidian-neon"),
    "cream-forest": t("theme.cream-forest"),
    "burgundy-champagne": t("theme.burgundy-champagne"),
  } as const;
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  useEffect(() => onSoundChange(setSoundOn), []);
  return (
    <header className="p-top">
      <span className="p-top__brand">{t("common.appName")}</span>
      <div className="p-top__right">
        <button
          type="button" className="p-sound" aria-pressed={soundOn} aria-label={soundOn ? t("play.soundOn") : t("play.soundOff")} title={soundOn ? t("play.soundOn") : t("play.soundOff")}
          onClick={() => setSoundEnabled(!soundOn)}
        >
          {soundOn ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5L6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 010 7" /><path d="M18.5 5.5a9 9 0 010 13" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5L6 9H2v6h4l5 4z" /><path d="M22 9l-6 6" /><path d="M16 9l6 6" /></svg>
          )}
        </button>
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
