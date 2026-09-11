import type { Locale, SessionMeta, SessionPhase, Slide, ThemeId } from "@sahne/protocol";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4100";
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
