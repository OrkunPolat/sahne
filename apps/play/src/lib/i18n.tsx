import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectLocale, makeT, type Locale, type TKey } from "@sahne/i18n";
import { readLocale, writeLocale } from "./storage";

type T = (key: TKey, vars?: Record<string, string | number>) => string;
interface Ctx { locale: Locale; setLocale: (l: Locale) => void; t: T }

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readLocale() ?? detectLocale(typeof navigator !== "undefined" ? navigator.languages : undefined));
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo<Ctx>(() => ({
    locale,
    t: makeT(locale),
    setLocale: (l) => { writeLocale(l); setLocaleState(l); },
  }), [locale]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("I18nProvider missing");
  return c;
}
