// docs/API.md REST rotaları. Plain node:http, ufak bir eşleyici.
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { Locale, Slide, ThemeId } from "@sahne/protocol";
import { createSession, getSession, getSessionByCode, getSlides, replaceSlides, resultsFromDb, rowToMeta } from "../db/repo";
import type { Registry } from "../live/registry";
import { CORS_HEADERS, HttpError, json, readBody, sendError } from "./util";

const CreateBody = z.object({ title: z.string().min(1).max(80), themeDefault: ThemeId.default("midnight-gold"), localeDefault: Locale.default("tr") });
const SlidesBody = z.object({ slides: z.array(Slide) });

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

export function buildRouter(registry: Registry) {
  const routes: Route[] = [
    route("GET", "/health", async (_req, res) => json(res, 200, { ok: true })),

    route("POST", "/api/sessions", async (req, res) => {
      const body = await readBody(req, CreateBody);
      const row = await createSession(body);
      json(res, 201, { id: row.id, code: row.code, hostSecret: row.hostSecret, title: row.title, themeDefault: row.themeDefault, localeDefault: row.localeDefault });
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

    route("GET", "/api/sessions/:id/results", async (req, res, { id }) => {
      const row = await authed(req, id!);
      const live = registry.peekById(row.id);
      json(res, 200, live ? live.results() : await resultsFromDb(row.id));
    }),

    route("GET", "/api/join/:code", async (_req, res, { code }) => {
      const live = registry.peek(code!);
      if (live) return json(res, 200, { title: live.meta.title, themeDefault: live.meta.themeDefault, localeDefault: live.meta.localeDefault, phase: live.phase });
      const row = await getSessionByCode(code!);
      if (!row) throw new HttpError(404, "not_found", "Session not found");
      json(res, 200, { title: row.title, themeDefault: row.themeDefault, localeDefault: row.localeDefault, phase: row.state });
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
