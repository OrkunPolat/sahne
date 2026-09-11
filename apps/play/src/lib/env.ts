/**
 * Realtime adresi öncelik sırası: ?api= sorgu parametresi (localStorage'a yazılır) → localStorage → build env → localhost.
 * Deploy edilmiş istemci, realtime nerede barındırılırsa ona bağlanabilsin diye.
 */
const KEY = "sahne.apiUrl";

function resolveApi(): string {
  try {
    const q = new URLSearchParams(location.search).get("api");
    if (q) { localStorage.setItem(KEY, q.replace(/\/+$/, "")); history.replaceState(null, "", location.pathname); }
    const stored = localStorage.getItem(KEY);
    if (stored) return stored;
  } catch { /* SSR / storage yok */ }
  return import.meta.env.VITE_API_URL || "http://localhost:4100";
}

export const API_URL: string = resolveApi();
export const WS_URL: string = API_URL.replace(/^http/, "ws");

/** ws://host:4100 → ws://host:4100/ws (docs/API.md). */
export function wsEndpoint(): string {
  const base = WS_URL.replace(/\/+$/, "");
  return base.endsWith("/ws") ? base : `${base}/ws`;
}
