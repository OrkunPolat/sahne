// Dalga 3: turnuva CRUD + oyun kaydı (docs/API.md "Dalga 3 — Turnuva").
import { and, desc, eq, ilike, lt, or, sql as dsql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { BracketPlay, Tournament, TournamentCard, TournamentItem, TournamentItemStat } from "@sahne/protocol";
import { playToStatDeltas } from "@sahne/engine";
import { db } from "./client";
import { tournamentItemStats, tournamentPlays, tournaments } from "./schema";

export type TournamentRow = typeof tournaments.$inferSelect;
export type PlaySource = "solo" | "live";

export function rowToTournament(r: TournamentRow): Tournament {
  return {
    id: r.id, slug: r.slug, title: r.title, description: r.description,
    category: r.category as Tournament["category"], locale: r.locale as Tournament["locale"],
    coverUrl: r.coverUrl ?? null, items: r.items, visibility: r.visibility as Tournament["visibility"],
    plays: r.plays, createdAt: r.createdAt.getTime(),
  };
}

export function rowToCard(r: TournamentRow): TournamentCard {
  const { items, ...rest } = rowToTournament(r);
  return { ...rest, itemCount: items.length, thumbUrls: items.map((i) => i.imageUrl).filter((u): u is string => !!u).slice(0, 4) };
}

export interface ListQuery { sort: "latest" | "popular"; category?: string; locale?: string; q?: string; limit: number; cursor?: string }

/**
 * Cursor (opak): latest → `createdAtMs|id`; popular → `plays|createdAtMs|id`.
 * Keyset sayfalama; her iki sıralama da (…, createdAt desc, id desc) ile deterministik.
 */
type Cursor = { plays?: number; createdAt: Date; id: string };
function parseCursor(sort: ListQuery["sort"], cursor: string | undefined): Cursor | null {
  if (!cursor) return null;
  const parts = cursor.split("|");
  if (sort === "popular") {
    if (parts.length !== 3) return null;
    const p = Number(parts[0]), t = Number(parts[1]), id = parts[2];
    return Number.isFinite(p) && Number.isFinite(t) && id ? { plays: p, createdAt: new Date(t), id } : null;
  }
  if (parts.length !== 2) return null;
  const t = Number(parts[0]), id = parts[1];
  return Number.isFinite(t) && id ? { createdAt: new Date(t), id } : null;
}

export async function listTournaments(q: ListQuery): Promise<{ items: TournamentCard[]; nextCursor: string | null }> {
  const conds = [eq(tournaments.visibility, "public")];
  if (q.category) conds.push(eq(tournaments.category, q.category));
  if (q.locale) conds.push(eq(tournaments.locale, q.locale));
  if (q.q) {
    const pat = `%${q.q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    conds.push(or(ilike(tournaments.title, pat), ilike(tournaments.description, pat))!);
  }
  const c = parseCursor(q.sort, q.cursor);
  if (c) {
    if (c.plays !== undefined) {
      const p = c.plays;
      conds.push(or(
        lt(tournaments.plays, p),
        and(eq(tournaments.plays, p), lt(tournaments.createdAt, c.createdAt)),
        and(eq(tournaments.plays, p), eq(tournaments.createdAt, c.createdAt), lt(tournaments.id, c.id)),
      )!);
    } else {
      conds.push(or(lt(tournaments.createdAt, c.createdAt), and(eq(tournaments.createdAt, c.createdAt), lt(tournaments.id, c.id)))!);
    }
  }
  const order = q.sort === "popular"
    ? [desc(tournaments.plays), desc(tournaments.createdAt), desc(tournaments.id)]
    : [desc(tournaments.createdAt), desc(tournaments.id)];
  const rows = await db.select().from(tournaments).where(and(...conds)).orderBy(...order).limit(q.limit + 1);
  const page = rows.slice(0, q.limit);
  const last = rows.length > q.limit ? page[page.length - 1] : undefined;
  const nextCursor = last
    ? (q.sort === "popular" ? `${last.plays}|${last.createdAt.getTime()}|${last.id}` : `${last.createdAt.getTime()}|${last.id}`)
    : null;
  return { items: page.map(rowToCard), nextCursor };
}

export interface CreateTournamentInput {
  slug: string; title: string; description: string; category: string; locale: string; coverUrl: string | null;
  items: TournamentItem[]; visibility: string;
}

export async function createTournament(input: CreateTournamentInput): Promise<TournamentRow> {
  const [row] = await db.insert(tournaments).values({ id: nanoid(16), ownerSecret: nanoid(24), ...input }).returning();
  return row!;
}

export async function getTournamentBySlug(slug: string): Promise<TournamentRow | undefined> {
  const [r] = await db.select().from(tournaments).where(eq(tournaments.slug, slug)).limit(1);
  return r;
}

export async function getTournamentById(id: string): Promise<TournamentRow | undefined> {
  const [r] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  return r;
}

export async function updateTournament(id: string, patch: Partial<Omit<CreateTournamentInput, "slug">>): Promise<TournamentRow> {
  const [row] = await db.update(tournaments).set({ ...patch, updatedAt: dsql`now()` }).where(eq(tournaments.id, id)).returning();
  return row!;
}

export async function deleteTournament(id: string): Promise<void> {
  await db.delete(tournaments).where(eq(tournaments.id, id));
}

/** Silinen item'ların stats satırları kalır; yalnızca mevcut item'lar döner. */
export async function getStats(tournamentId: string, itemIds?: Set<string>): Promise<TournamentItemStat[]> {
  const rows = await db.select().from(tournamentItemStats).where(eq(tournamentItemStats.tournamentId, tournamentId));
  return rows
    .filter((r) => !itemIds || itemIds.has(r.itemId))
    .map((r) => ({ itemId: r.itemId, wins: r.wins, losses: r.losses, finals: r.finals, champions: r.champions }));
}

/** Tek transaction: tournament_plays insert + stats upsert (delta) + plays++. Doğrulama (validatePlay) çağıranda. */
export async function recordPlay(tournamentId: string, play: BracketPlay, deviceId: string | null, source: PlaySource): Promise<void> {
  const deltas = playToStatDeltas(play);
  await db.transaction(async (tx) => {
    await tx.insert(tournamentPlays).values({ id: nanoid(16), tournamentId, size: play.size, championId: play.championId, deviceId, source });
    for (const d of deltas.values()) {
      await tx.insert(tournamentItemStats)
        .values({ tournamentId, itemId: d.itemId, wins: d.wins, losses: d.losses, finals: d.finals, champions: d.champions })
        .onConflictDoUpdate({
          target: [tournamentItemStats.tournamentId, tournamentItemStats.itemId],
          set: {
            wins: dsql`${tournamentItemStats.wins} + ${d.wins}`,
            losses: dsql`${tournamentItemStats.losses} + ${d.losses}`,
            finals: dsql`${tournamentItemStats.finals} + ${d.finals}`,
            champions: dsql`${tournamentItemStats.champions} + ${d.champions}`,
          },
        });
    }
    await tx.update(tournaments).set({ plays: dsql`${tournaments.plays} + 1` }).where(eq(tournaments.id, tournamentId));
  });
}
