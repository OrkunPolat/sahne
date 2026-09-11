import { THEME_SWATCH, applyTheme, readStoredTheme, type ThemeId } from "@sahne/ui";

export function setThemeColorMeta(theme: ThemeId) {
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", THEME_SWATCH[theme][0]);
}

export function currentTheme(): ThemeId {
  const attr = document.documentElement.getAttribute("data-theme") as ThemeId | null;
  return readStoredTheme() ?? attr ?? "midnight-gold";
}

/** Kullanıcı seçimi: kalıcı. */
export function chooseTheme(theme: ThemeId) {
  applyTheme(theme, true);
  setThemeColorMeta(theme);
}

/** Oturum varsayılanı: kullanıcı hiç seçmediyse uygula, kalıcı yapma. */
export function adoptSessionTheme(theme: ThemeId): boolean {
  if (readStoredTheme()) return false;
  applyTheme(theme, false);
  setThemeColorMeta(theme);
  return true;
}
