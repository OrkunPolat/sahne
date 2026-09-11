"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, readStoredTheme, type ThemeId } from "@sahne/ui";
import { detectLocale, makeT, type Locale, type TKey } from "@sahne/i18n";

const LOCALE_KEY = "sahne.locale";

type Ctx = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
};

const AppContext = createContext<Ctx | null>(null);

function readStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    return v === "tr" || v === "en" ? v : null;
  } catch { return null; }
}

export function Providers({ children }: { children: ReactNode }) {
  // Sunucu ve ilk istemci render'ı aynı olsun diye varsayılanlarla başla; mount sonrası localStorage'dan oku.
  const [theme, setThemeState] = useState<ThemeId>("midnight-gold");
  const [locale, setLocaleState] = useState<Locale>("tr");

  useEffect(() => {
    const t = readStoredTheme() ?? "midnight-gold";
    setThemeState(t);
    applyTheme(t, false);
    setLocaleState(readStoredLocale() ?? detectLocale(navigator.languages));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setTheme = useCallback((t: ThemeId) => { applyTheme(t); setThemeState(t); }, []);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(LOCALE_KEY, l); } catch { /* ignore */ }
  }, []);

  const value = useMemo<Ctx>(() => ({ theme, setTheme, locale, setLocale, t: makeT(locale) }), [theme, setTheme, locale, setLocale]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useCtx() {
  const c = useContext(AppContext);
  if (!c) throw new Error("Providers missing");
  return c;
}

export function useT() { return useCtx().t; }
export function useTheme() { const c = useCtx(); return [c.theme, c.setTheme] as const; }
export function useLocale() { const c = useCtx(); return [c.locale, c.setLocale] as const; }
