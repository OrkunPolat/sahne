import type { Locale } from "@sahne/i18n";

export interface StoredPlayer {
  code: string;
  nickname: string;
  token: string | null;
  participantId: string | null;
  /** Takım modu: seçilen/atanan takım (yeniden katılımda tekrar gönderilir). */
  teamId?: string | null;
}

const PLAYER_KEY = "sahne.player";
const LOCALE_KEY = "sahne.locale";
const ANSWERED_KEY = "sahne.player.answered";

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string | null) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function readPlayer(): StoredPlayer | null {
  const raw = safeGet(PLAYER_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<StoredPlayer>;
    if (typeof p.code !== "string" || typeof p.nickname !== "string") return null;
    return { code: p.code, nickname: p.nickname, token: p.token ?? null, participantId: p.participantId ?? null, teamId: p.teamId ?? null };
  } catch { return null; }
}
export function writePlayer(p: StoredPlayer | null) { safeSet(PLAYER_KEY, p ? JSON.stringify(p) : null); }

export function readLocale(): Locale | null {
  const v = safeGet(LOCALE_KEY);
  return v === "tr" || v === "en" ? v : null;
}
export function writeLocale(l: Locale) { safeSet(LOCALE_KEY, l); }

export function readAnsweredSlide(): string | null { return safeGet(ANSWERED_KEY); }
export function writeAnsweredSlide(id: string | null) { safeSet(ANSWERED_KEY, id); }

export function hasStoredTheme(): boolean { return safeGet("sahne.theme") !== null; }
