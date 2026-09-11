import type { Locale, SessionMeta, SessionPhase, Slide, ThemeId } from "@sahne/protocol";

const KEY = "sahne.apiUrl";
/** ?api=https://realtime.example → localStorage → env → localhost. Deploy edilmiş host, realtime nerede olursa olsun bağlanabilsin. */
function resolveApi(): string {
  if (typeof window !== "undefined") {
    try {
      const q = new URLSearchParams(window.location.search).get("api");
      if (q) { localStorage.setItem(KEY, q.replace(/\/+$/, "")); window.history.replaceState(null, "", window.location.pathname); }
      const stored = localStorage.getItem(KEY);
      if (stored) return stored;
    } catch { /* ignore */ }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";
}
export const API_URL = resolveApi();
export const WS_URL = typeof window !== "undefined" && localStorage.getItem(KEY)
  ? API_URL.replace(/^http/, "ws")
  : (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4100");
export const PLAY_URL = process.env.NEXT_PUBLIC_PLAY_URL ?? "http://localhost:5173";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { secret?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.secret) headers["x-host-secret"] = init.secret;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (e) {
    throw new ApiError(0, "network", e instanceof Error ? e.message : "network");
  }
  if (!res.ok) {
    let code = String(res.status);
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body?.error) { code = body.error.code ?? code; message = body.error.message ?? message; }
    } catch { /* ignore */ }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export type CreatedSession = { id: string; code: string; hostSecret: string; title: string; themeDefault: ThemeId; localeDefault: Locale };

export function createSession(body: { title: string; themeDefault?: ThemeId; localeDefault?: Locale }) {
  return request<CreatedSession>("/api/sessions", { method: "POST", body: JSON.stringify(body) });
}

export function getSession(id: string, secret: string) {
  return request<{ meta: SessionMeta; slides: Slide[]; phase: SessionPhase }>(`/api/sessions/${id}`, { secret });
}

export function putSlides(id: string, secret: string, slides: Slide[]) {
  return request<{ slides: Slide[] }>(`/api/sessions/${id}/slides`, { method: "PUT", secret, body: JSON.stringify({ slides }) });
}

export type Results = { slides: { slide: Slide; tally: import("@sahne/protocol").Tally }[]; leaderboard: import("@sahne/protocol").LeaderboardEntry[] };
export function getResults(id: string, secret: string) {
  return request<Results>(`/api/sessions/${id}/results`, { secret });
}

export function getHealth() {
  return request<{ ok: boolean; ai: boolean }>("/health");
}

export function generateSlides(id: string, secret: string, body: { prompt: string; count: number; locale: Locale; mode: "game" | "insight" | "mixed" }) {
  return request<{ slides: Slide[] }>(`/api/sessions/${id}/ai`, { method: "POST", secret, body: JSON.stringify(body) });
}

/* ---------- Dalga 2 ---------- */

export type AiBody = { prompt: string; count: number; locale: Locale; mode: "game" | "insight" | "mixed" };

/** Anasayfa "Şimdi dene": sunucu 3 örnek slaytla demo oturum açar. */
export function createDemo(locale?: Locale) {
  return request<CreatedSession & { isDemo: true }>("/api/demo", { method: "POST", body: JSON.stringify({ locale }) });
}

/** Oturumsuz AI üretimi (anasayfa kartı). */
export function aiGenerate(body: AiBody) {
  return request<{ slides: Slide[] }>("/api/ai/generate", { method: "POST", body: JSON.stringify(body) });
}

export function importPdf(id: string, secret: string, body: { pdfBase64: string; count?: number; locale?: Locale; mode?: AiBody["mode"] }) {
  return request<{ slides: Slide[] }>(`/api/sessions/${id}/import-pdf`, { method: "POST", secret, body: JSON.stringify(body) });
}

export function putSettings(id: string, secret: string, body: { teams?: import("@sahne/protocol").Team[]; seriesKey?: string | null }) {
  return request<{ meta: SessionMeta }>(`/api/sessions/${id}/settings`, { method: "PUT", secret, body: JSON.stringify(body) });
}

export type SeriesEntry = { deviceId: string; nickname: string; totalScore: number; sessionsPlayed: number; wins: number };
export function getSeries(id: string, secret: string) {
  return request<{ seriesKey: string; sessions: number; leaderboard: SeriesEntry[] }>(`/api/sessions/${id}/series`, { secret });
}

export type PublicResults = Results & { title: string; endedAt: string | number | null; teams: import("@sahne/protocol").TeamStanding[] };
export function getPublicResults(token: string) {
  return request<PublicResults>(`/api/public/${encodeURIComponent(token)}/results`);
}

/** Host uygulamasının kendi origin'i (public sonuç bağlantısı için). */
export function hostOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_HOST_URL ?? "";
}
