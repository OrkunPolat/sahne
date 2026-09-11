"use client";

import type { BracketPlay, Locale, Tournament, TournamentCard, TournamentCategory, TournamentItem, TournamentItemStat } from "@sahne/protocol";
import { API_URL, ApiError } from "./api";

/* ---------- REST (docs/API.md "Dalga 3 — Turnuva") ---------- */

async function req<T>(path: string, init: RequestInit & { ownerSecret?: string; raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (!init.raw) headers["content-type"] = "application/json";
  if (init.ownerSecret) headers["x-owner-secret"] = init.ownerSecret;
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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type TournamentSort = "latest" | "popular";
export type ListQuery = { sort?: TournamentSort; category?: TournamentCategory | ""; locale?: Locale | ""; q?: string; limit?: number; cursor?: string | null };

export function listTournaments(qy: ListQuery = {}) {
  const p = new URLSearchParams();
  if (qy.sort) p.set("sort", qy.sort);
  if (qy.category) p.set("category", qy.category);
  if (qy.locale) p.set("locale", qy.locale);
  if (qy.q) p.set("q", qy.q);
  if (qy.limit) p.set("limit", String(qy.limit));
  if (qy.cursor) p.set("cursor", qy.cursor);
  const qs = p.toString();
  return req<{ items: TournamentCard[]; nextCursor: string | null }>(`/api/tournaments${qs ? `?${qs}` : ""}`);
}

export type TournamentInput = {
  title: string; description?: string; category?: TournamentCategory; locale?: Locale; coverUrl?: string | null;
  items: Array<Omit<TournamentItem, "id"> & { id?: string }>; visibility?: "public" | "unlisted";
};

export function createTournament(body: TournamentInput) {
  return req<{ tournament: Tournament; ownerSecret: string }>("/api/tournaments", { method: "POST", body: JSON.stringify(body) });
}

export function getTournament(slug: string) {
  return req<{ tournament: Tournament; stats: TournamentItemStat[] }>(`/api/tournaments/${encodeURIComponent(slug)}`);
}

export function updateTournament(id: string, ownerSecret: string, body: Partial<TournamentInput>) {
  return req<{ tournament: Tournament }>(`/api/tournaments/${encodeURIComponent(id)}`, { method: "PUT", ownerSecret, body: JSON.stringify(body) });
}

export function deleteTournament(id: string, ownerSecret: string) {
  return req<{ ok: boolean } | undefined>(`/api/tournaments/${encodeURIComponent(id)}`, { method: "DELETE", ownerSecret });
}

export function postPlay(id: string, play: BracketPlay, deviceId: string) {
  return req<{ ok: boolean; stats: TournamentItemStat[] }>(`/api/tournaments/${encodeURIComponent(id)}/plays`, { method: "POST", body: JSON.stringify({ ...play, deviceId }) });
}

export const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadImage(file: File): Promise<string> {
  if (!UPLOAD_TYPES.includes(file.type)) throw new ApiError(400, "bad_type", file.type || "unknown");
  if (file.size > UPLOAD_MAX_BYTES) throw new ApiError(413, "too_large", `${file.size}`);
  const fd = new FormData();
  fd.append("file", file);
  const r = await req<{ url: string }>("/api/uploads", { method: "POST", body: fd, raw: true });
  return r.url;
}

/* ---------- localStorage: sahiplik kaydı + cihaz kimliği ---------- */

export type OwnedTournament = { id: string; slug: string; ownerSecret: string; title: string; createdAt: number };
const REG_KEY = "sahne.tournaments";
const DEVICE_KEY = "sahne.device";

export function readOwned(): OwnedTournament[] {
  try {
    const raw = localStorage.getItem(REG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as OwnedTournament[]) : [];
  } catch { return []; }
}

export function saveOwned(t: OwnedTournament) {
  const list = readOwned().filter((x) => x.id !== t.id);
  list.unshift(t);
  try { localStorage.setItem(REG_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function removeOwned(id: string) {
  try { localStorage.setItem(REG_KEY, JSON.stringify(readOwned().filter((x) => x.id !== id))); } catch { /* ignore */ }
}

export function findOwnedBySlug(slug: string): OwnedTournament | undefined {
  return readOwned().find((x) => x.slug === slug);
}

export function getDeviceId(): string {
  try {
    const v = localStorage.getItem(DEVICE_KEY);
    if (v) return v;
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch { return "anon"; }
}

/* ---------- yardımcılar ---------- */

export function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.code}: ${e.message}` : String(e);
}

export const LOCALE_FLAG: Record<Locale, string> = { tr: "🇹🇷 TR", en: "🇬🇧 EN" };

/** Detay sayfası: şampiyonluk oranı → kazanma oranı sırası. */
export function rankStats(items: TournamentItem[], stats: TournamentItemStat[]) {
  const byId = new Map(stats.map((s) => [s.itemId, s]));
  const totalPlays = stats.reduce((n, s) => n + s.champions, 0);
  return items
    .map((it) => {
      const s = byId.get(it.id) ?? { itemId: it.id, wins: 0, losses: 0, finals: 0, champions: 0 };
      const games = s.wins + s.losses;
      return { item: it, stat: s, games, winRate: games ? s.wins / games : 0, champRate: totalPlays ? s.champions / totalPlays : 0 };
    })
    .sort((a, b) => b.champRate - a.champRate || b.winRate - a.winRate || b.games - a.games || a.item.name.localeCompare(b.item.name));
}
