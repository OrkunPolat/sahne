import { tr } from "./tr";
import { en } from "./en";
import type { Dictionary, TKey } from "./types";

export type { Dictionary, TKey };
export type Locale = "tr" | "en";
export const LOCALES: Locale[] = ["tr", "en"];
export const LOCALE_LABELS: Record<Locale, string> = { tr: "Türkçe", en: "English" };

const dictionaries: Record<Locale, Dictionary> = { tr, en };

function lookup(dict: Dictionary, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(locale: Locale, key: TKey, vars?: Record<string, string | number>): string {
  const raw = lookup(dictionaries[locale], key) ?? lookup(dictionaries.tr, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function makeT(locale: Locale) {
  return (key: TKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}

/** Tarayıcı dilinden en yakın desteklenen dili seçer. */
export function detectLocale(navLangs: readonly string[] | undefined): Locale {
  for (const l of navLangs ?? []) {
    const short = l.toLowerCase().slice(0, 2);
    if (short === "tr" || short === "en") return short;
  }
  return "tr";
}
