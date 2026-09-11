import { THEME_IDS, type ThemeId } from "@sahne/protocol";
export { THEME_IDS, type ThemeId };

const KEY = "sahne.theme";

export function readStoredTheme(): ThemeId | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && (THEME_IDS as string[]).includes(v) ? (v as ThemeId) : null;
  } catch { return null; }
}
export function applyTheme(theme: ThemeId, persist = true) {
  document.documentElement.setAttribute("data-theme", theme);
  if (persist) { try { localStorage.setItem(KEY, theme); } catch { /* ignore */ } }
}
/** Tema önizleme noktası için (switcher'da renkli daire). */
export const THEME_SWATCH: Record<ThemeId, [string, string]> = {
  "midnight-gold": ["#0B1020", "#D4AF5A"],
  "obsidian-neon": ["#07080C", "#6C7BFF"],
  "cream-forest": ["#F4EFE6", "#1E5A3F"],
  "burgundy-champagne": ["#2A0F16", "#E8CFA3"],
};
