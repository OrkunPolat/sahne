// docs/API.md REST rotaları (Faz 1 + Dalga 2). Plain node:http, ufak bir eşleyici.
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Locale, MAX_TEAMS, Slide, Team, ThemeId } from "@sahne/protocol";
import {
  createSession, getSession, getSessionByCode, getSessionByPublicToken, getSlides, replaceSlides, resultsFromDb, rowToMeta,
  seriesLeaderboard, updateSettings,
} from "../db/repo";
import type { Registry } from "../live/registry";
import { CORS_HEADERS, HttpError, json, readBody, sendError } from "./util";
import { AiBody, aiEnabled, generateSlides, generateSlidesFromText } from "./ai";
import { demoSlides, demoTitle } from "./demo";
import { extractPdfText } from "./pdf";

const CreateBody = z.object({ title: z.string().min(1).max(80), themeDefault: ThemeId.default("midnight-gold"), localeDefault: Locale.default("tr") });
const SlidesBody = z.object({ slides: z.array(Slide) });
const DemoBody = z.object({ locale: Locale.default("tr") });
/** Takım id'si istemciden gelmeyebilir; sunucu nanoid(6) atar. */
const SettingsBody = z.object({
  teams: z.array(Team.extend({ id: z.string().min(1).max(16).optional() })).max(MAX_TEAMS).optional(),
  seriesKey: z.string().min(1).max(40).nullable().optional(),
});
const PDF_MAX_BYTES = 8 * 1024 * 1024;
const ImportPdfBody = z.object({
  pdfBase64: z.string().min(1),
  count: AiBody.shape.count,
  locale: AiBody.shape.locale,
  mode: AiBody.shape.mode,
});

type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => Promise<void>;
interface Route { method: string; pattern: RegExp; keys: string[]; handler: Handler }

function route(method: string, path: string, handler: Handler): Route {
  const keys: string[] = [];
  const pattern = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
  return { method, pattern, keys, handler };
}

async function authed(req: IncomingMessage, id: string) {
  const row = await getSession(id);
  if (!row) throw new HttpError(404, "not_found", "Session not found");
  const secret = req.headers["x-host-secret"];
  if (typeof secret !== "string" || secret !== row.hostSecret) throw new HttpError(401, "bad_secret", "Invalid host secret");
  return row;
}

const createResponse = (row: Awaited<ReturnType<typeof createSession>>) => ({
  id: row.id, code: row.code, hostSecret: row.hostSecret, title: row.title, themeDefault: row.themeDefault, localeDefault: row.localeDefault, isDemo: row.isDemo,
});

export function buildRouter(registry: Registry) {
  const routes: Route[] = [
    route("GET", "/health", async (_req, res) => json(res, 200, { ok: true, ai: aiEnabled() })),

    route("POST", "/api/sessions/:id/ai", async (req, res, { id }) => {
      await authed(req, id!);
      const body = await readBody(req, AiBody);
      json(res, 200, { slides: await generateSlides(body) });
    }),

    /** Oturum gerektirmez: anasayfa "konudan oturum". */
    route("POST", "/api/ai/generate", async (req, res) => {
      const body = await readBody(req, AiBody);
      json(res, 200, { slides: await generateSlides(body) });
    }),

    route("POST", "/api/sessions/:id/import-pdf", async (req, res, { id }) => {
      await authed(req, id!);
      if (!aiEnabled()) throw new HttpError(503, "ai_disabled", "ANTHROPIC_API_KEY is not configured");
      // base64 ≈ 4/3 × ham boyut + JSON zarfı; ham 8 MB sınırı aşağıda ayrıca kontrol edilir.
      const body = await readBody(req, ImportPdfBody, Math.ceil(PDF_MAX_BYTES * 4 / 3) + 64 * 1024);
      const buf = Buffer.from(body.pdfBase64, "base64");
      if (buf.length > PDF_MAX_BYTES) throw new HttpError(413, "too_large", "PDF exceeds 8 MB");
      if (buf.length === 0) throw new HttpError(422, "validation", "pdfBase64 is not valid base64");
      const text = await extractPdfText(buf);
      json(res, 200, { slides: await generateSlidesFromText(text, { count: body.count, locale: body.locale, mode: body.mode }) });
    }),

    route("POST", "/api/demo", async (req, res) => {
      const { locale } = await readBody(req, DemoBody);
      const row = await createSession({ title: demoTitle(locale), themeDefault: "midnight-gold", localeDefault: locale, isDemo: true });
      await replaceSlides(row.id, demoSlides(locale));
      json(res, 201, createResponse(row));
    }),

    route("POST", "/api/sessions", async (req, res) => {
      const body = await readBody(req, CreateBody);
      const row = await createSession(body);
      json(res, 201, createResponse(row));
    }),

    route("GET", "/api/sessions/:id", async (req, res, { id }) => {
      const row = await authed(req, id!);
      const live = registry.peekById(row.id);
      if (live) return json(res, 200, { meta: live.meta, slides: live.slides, phase: live.phase });
      json(res, 200, { meta: rowToMeta(row), slides: await getSlides(row.id), phase: row.state });
    }),

    route("PUT", "/api/sessions/:id/slides", async (req, res, { id }) => {
      const row = await authed(req, id!);
      const live = registry.peekById(row.id);
      if ((live?.phase ?? row.state) === "live") throw new HttpError(409, "session_live", "Slides cannot change while session is live");
      const { slides } = await readBody(req, SlidesBody);
      const sorted = [...slides].sort((a, b) => a.idx - b.idx);
      await replaceSlides(row.id, sorted);
      live?.setSlides(sorted);
      json(res, 200, { slides: sorted });
    }),

    route("PUT", "/api/sessions/:id/settings", async (req, res, { id }) => {
      const row = await authed(req, id!);
      const live = registry.peekById(row.id);
      if ((live?.phase ?? row.state) === "live") throw new HttpError(409, "session_live", "Settings cannot change while session is live");
      const body = await readBody(req, SettingsBody);
      const patch: { teams?: Team[]; seriesKey?: string | null } = {};
      if (body.teams !== undefined) {
        const used = new Set<string>();
        patch.teams = body.teams.map((t) => {
          let tid = t.id ?? nanoid(6);
          while (used.has(tid)) tid = nanoid(6);
          used.add(tid);
          return { id: tid, name: t.name };
        });
      }
      if (body.seriesKey !== undefined) patch.seriesKey = body.seriesKey;
      const updated = await updateSettings(row.id, patch);
      live?.setSettings(patch);
      json(res, 200, { meta: live?.meta ?? rowToMeta(updated) });
    }),

    route("GET", "/api/sessions/:id/results", async (req, res, { id }) => {
      const row = await authed(req, id!);
      const live = registry.peekById(row.id);
      json(res, 200, live ? live.results() : await resultsFromDb(row.id, row.teams ?? []));
    }),

    route("GET", "/api/sessions/:id/series", async (req, res, { id }) => {
      const row = await authed(req, id!);
      const key = registry.peekById(row.id)?.meta.seriesKey ?? row.seriesKey;
      if (!key) return json(res, 200, { seriesKey: null, sessions: 0, leaderboard: [] });
      json(res, 200, await seriesLeaderboard(key));
    }),

    /** Herkese açık sonuç sayfası; host secret gerekmez. */
    route("GET", "/api/public/:token/results", async (_req, res, { token }) => {
      const row = await getSessionByPublicToken(token!);
      if (!row || row.state !== "ended") throw new HttpError(404, "not_found", "Results not found");
      const live = registry.peekById(row.id);
      const r = live ? live.results() : await resultsFromDb(row.id, row.teams ?? []);
      json(res, 200, { title: row.title, endedAt: (live?.endedAt ?? row.endedAt?.getTime()) ?? null, ...r });
    }),

    route("GET", "/api/join/:code", async (_req, res, { code }) => {
      const live = registry.peek(code!);
      if (live) return json(res, 200, { title: live.meta.title, themeDefault: live.meta.themeDefault, localeDefault: live.meta.localeDefault, phase: live.phase, teams: live.meta.teams });
      const row = await getSessionByCode(code!);
      if (!row) throw new HttpError(404, "not_found", "Session not found");
      json(res, 200, { title: row.title, themeDefault: row.themeDefault, localeDefault: row.localeDefault, phase: row.state, teams: row.teams ?? [] });
    }),
  ];

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "OPTIONS") { res.writeHead(204, CORS_HEADERS); return res.end(); }
    try {
      for (const r of routes) {
        const m = url.pathname.match(r.pattern);
        if (!m) continue;
        if (r.method !== req.method) continue;
        const params: Record<string, string> = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]!); });
        return await r.handler(req, res, params);
      }
      throw new HttpError(404, "not_found", `No route for ${req.method} ${url.pathname}`);
    } catch (e) { sendError(res, e); }
  };
}
