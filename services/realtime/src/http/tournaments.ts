// docs/API.md "Dalga 3 — Turnuva" REST rotaları.
import type { IncomingMessage } from "node:http";
import { z } from "zod";
import { nanoid } from "nanoid";
import { BracketPlay, Locale, MAX_ITEMS, MIN_ITEMS, TournamentCategory, TournamentItem } from "@sahne/protocol";
import {
  createTournament, deleteTournament, getStats, getTournamentById, getTournamentBySlug, listTournaments, recordPlay, rowToTournament, updateTournament,
} from "../db/tournaments";
import { HttpError, json, readBody } from "./util";
import { route, type Route } from "./router";
import { RateLimiter, checkPlay, makeSlug } from "./tournamentLogic";
import { handleUpload } from "./uploads";
import { storageEnabled } from "./storage";

const ItemIn = TournamentItem.extend({ id: z.string().min(1).max(16).optional() });
const CreateBody = z.object({
  title: z.string().min(2).max(80),
  description: z.string().max(300).default(""),
  category: TournamentCategory.default("general"),
  locale: Locale.default("tr"),
  coverUrl: z.string().url().max(500).nullable().default(null),
  items: z.array(ItemIn).min(MIN_ITEMS).max(MAX_ITEMS),
  visibility: z.enum(["public", "unlisted"]).default("public"),
});
const UpdateBody = CreateBody.partial();
const PlayBody = BracketPlay.extend({ deviceId: z.string().max(40).optional() });
const ListQuery = z.object({
  sort: z.enum(["latest", "popular"]).default("latest"),
  category: TournamentCategory.optional(),
  locale: Locale.optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  cursor: z.string().max(120).optional(),
});

const HOUR = 60 * 60 * 1000;
const createLimiter = new RateLimiter(10, HOUR);   // IP başına 10/saat
const uploadLimiter = new RateLimiter(60, HOUR);   // IP başına 60/saat
const playLimiter = new RateLimiter(1, 60 * 1000); // device+tournament 1/dk

export function clientIp(req: IncomingMessage): string {
  const xf = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xf) ? xf[0] : xf)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

/** Item id'siz gelebilir; sunucu nanoid(8) atar. Aynı listede id çakışması 422. */
function assignItemIds(items: z.infer<typeof ItemIn>[]): TournamentItem[] {
  const used = new Set<string>();
  return items.map((it) => {
    let id = it.id ?? nanoid(8);
    if (used.has(id)) { if (it.id) throw new HttpError(422, "validation", `items: duplicate id ${id}`); while (used.has(id)) id = nanoid(8); }
    used.add(id);
    return { id, name: it.name, imageUrl: it.imageUrl ?? null };
  });
}

async function owned(req: IncomingMessage, id: string) {
  const row = await getTournamentById(id);
  if (!row) throw new HttpError(404, "not_found", "Tournament not found");
  const secret = req.headers["x-owner-secret"];
  if (typeof secret !== "string" || secret !== row.ownerSecret) throw new HttpError(401, "bad_secret", "Invalid owner secret");
  return row;
}

export function tournamentRoutes(): Route[] {
  return [
    route("GET", "/api/tournaments", async (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const parsed = ListQuery.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) throw new HttpError(422, "validation", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      const q = parsed.data;
      json(res, 200, await listTournaments({ sort: q.sort, category: q.category, locale: q.locale, q: q.q || undefined, limit: q.limit, cursor: q.cursor }));
    }),

    route("POST", "/api/tournaments", async (req, res) => {
      if (!createLimiter.allow(clientIp(req))) throw new HttpError(429, "rate_limited", "Too many tournaments created; try later");
      const body = await readBody(req, CreateBody);
      const items = assignItemIds(body.items);
      let row;
      for (let attempt = 0; ; attempt++) {
        try {
          row = await createTournament({ ...body, items, slug: makeSlug(body.title) });
          break;
        } catch (e) {
          // slug unique çakışması (çok düşük olasılık): yeni ek ile tekrar dene
          if (attempt < 3 && String((e as { code?: string }).code) === "23505") continue;
          throw e;
        }
      }
      json(res, 201, { tournament: rowToTournament(row), ownerSecret: row.ownerSecret });
    }),

    route("GET", "/api/tournaments/:slug", async (_req, res, { slug }) => {
      const row = await getTournamentBySlug(slug!);
      if (!row) throw new HttpError(404, "not_found", "Tournament not found");
      const stats = await getStats(row.id, new Set(row.items.map((i) => i.id)));
      json(res, 200, { tournament: rowToTournament(row), stats });
    }),

    route("PUT", "/api/tournaments/:id", async (req, res, { id }) => {
      const row = await owned(req, id!);
      const body = await readBody(req, UpdateBody);
      const patch: Parameters<typeof updateTournament>[1] = {};
      if (body.title !== undefined) patch.title = body.title;
      if (body.description !== undefined) patch.description = body.description;
      if (body.category !== undefined) patch.category = body.category;
      if (body.locale !== undefined) patch.locale = body.locale;
      if (body.coverUrl !== undefined) patch.coverUrl = body.coverUrl;
      if (body.visibility !== undefined) patch.visibility = body.visibility;
      if (body.items !== undefined) patch.items = assignItemIds(body.items);
      const updated = Object.keys(patch).length ? await updateTournament(row.id, patch) : row;
      json(res, 200, { tournament: rowToTournament(updated) });
    }),

    route("DELETE", "/api/tournaments/:id", async (req, res, { id }) => {
      const row = await owned(req, id!);
      await deleteTournament(row.id);
      json(res, 200, { ok: true });
    }),

    route("POST", "/api/tournaments/:id/plays", async (req, res, { id }) => {
      const row = await getTournamentById(id!);
      if (!row) throw new HttpError(404, "not_found", "Tournament not found");
      const { deviceId, ...play } = await readBody(req, PlayBody);
      const check = checkPlay(play, row.items);
      if (!check.ok) throw new HttpError(422, check.code, check.message);
      const key = `${deviceId ?? "ip:" + clientIp(req)}#${row.id}`;
      if (!playLimiter.allow(key)) throw new HttpError(429, "rate_limited", "One play per minute per tournament");
      await recordPlay(row.id, play, deviceId ?? null, "solo");
      const stats = await getStats(row.id, new Set(row.items.map((i) => i.id)));
      json(res, 200, { ok: true, stats });
    }),

    route("POST", "/api/uploads", async (req, res) => {
      if (!storageEnabled()) throw new HttpError(503, "storage_disabled", "SUPABASE_URL / SUPABASE_SERVICE_KEY not configured");
      if (!uploadLimiter.allow(clientIp(req))) throw new HttpError(429, "rate_limited", "Too many uploads; try later");
      json(res, 200, await handleUpload(req));
    }),
  ];
}
