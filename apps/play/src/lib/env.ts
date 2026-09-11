export const WS_URL: string = import.meta.env.VITE_WS_URL || "ws://localhost:4100";
export const API_URL: string = import.meta.env.VITE_API_URL || "http://localhost:4100";

/** ws://host:4100 → ws://host:4100/ws (docs/API.md). */
export function wsEndpoint(): string {
  const base = WS_URL.replace(/\/+$/, "");
  return base.endsWith("/ws") ? base : `${base}/ws`;
}
