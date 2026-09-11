"use client";

import { ThemeSwitcher, THEME_IDS, type ThemeId } from "@sahne/ui";
import { LOCALES } from "@sahne/i18n";
import { usePathname } from "next/navigation";
import { useLocale, useT, useTheme } from "@/lib/providers";

export function ControlBar() {
  const pathname = usePathname();
  const t = useT();
  const [theme, setTheme] = useTheme();
  const [locale, setLocale] = useLocale();
  if (pathname === "/" || pathname === "/t" || pathname.startsWith("/t/")) return null;
  const labels = Object.fromEntries(THEME_IDS.map((id) => [id, t(`theme.${id}`)])) as Record<ThemeId, string>;
  return (
    <div className="h-topbar s-card" aria-label={t("common.theme")}>
      <ThemeSwitcher value={theme} onChange={setTheme} labels={labels} />
      <div className="h-seg" role="group" aria-label={t("common.language")}>
        {LOCALES.map((l) => (
          <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
    </div>
  );
}
