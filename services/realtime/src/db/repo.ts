// Postgres erişimi: oturum CRUD + LiveSession için Persistence uygulaması.
import { and, desc, eq, inArray, isNotNull, lt, ne, sql as dsql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Participant, SessionMeta, SessionPhase, Slide, Team } from "@sahne/protocol";
import { buildLeaderboard, buildTally, buildTeamStandings, type AnswerRecord } from "@sahne/engine";
import { db } from "./client";
import { answers, participants, sessions, slides } from "./schema";
import type { Persistence, RevealRow } from "../live/persistence";

export type SessionRow = typeof sessions.$inferSelect;

export function rowToMeta(r: SessionRow): SessionMeta {
  return {
    id: r.id, code: r.code, title: r.title,
    themeDefault: r.themeDefault as SessionMeta["themeDefault"], localeDefault: r.localeDefault as SessionMeta["localeDefault"],
    teams: r.teams ?? [], seriesKey: r.seriesKey ?? null, publicToken: r.publicToken ?? null, isDemo: r.isDemo,
  };
}

/** 6 haneli, bitmemiş oturumlar arasında benzersiz kod. */
async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const hit = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.code, code), ne(sessions.state, "ended"))).limit(1);
    if (hit.length === 0) return code;
  }
  throw new Error("could not allocate session code");
}

export async function createSession(input: { title: string; themeDefault: string; localeDefault: string; isDemo?: boolean }): Promise<SessionRow> {
  const row: typeof sessions.$inferInsert = { id: nanoid(16), code: await uniqueCode(), hostSecret: nanoid(24), ...input };
  const [created] = await db.insert(sessions).values(row).returning();
  return created!;
}

export async function getSession(id: string): Promise<SessionRow | undefined> {
  const [r] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return r;
}

export async function getSessionByPublicToken(token: string): Promise<SessionRow | undefined> {
  const [r] = await db.select().from(sessions).where(eq(sessions.publicToken, token)).limit(1);
  return r;
}

/** Koda göre en güncel bitmemiş oturum; yoksa en güncel olan (phase=ended döner). */
export async function getSessionByCode(code: string): Promise<SessionRow | undefined> {
  const [live] = await db.select().from(sessions).where(and(eq(sessions.code, code), ne(sessions.state, "ended"))).orderBy(desc(sessions.createdAt)).limit(1);
  if (live) return live;
  const [any] = await db.select().from(sessions).where(eq(sessions.code, code)).orderBy(desc(sessions.createdAt)).limit(1);
  return any;
}

export async function getSlides(sessionId: string): Promise<Slide[]> {
  const rows = await db.select({ payload: slides.payload }).from(slides).where(eq(slides.sessionId, sessionId)).orderBy(slides.idx);
  return rows.map((r) => r.payload);
}

export async function replaceSlides(sessionId: string, list: Slide[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(slides).where(eq(slides.sessionId, sessionId));
    if (list.length === 0) return;
    await tx.insert(slides).values(list.map((s) => ({ id: s.id, sessionId, idx: s.idx, type: s.type, mode: s.mode, payload: s, timeLimitS: s.timeLimitS, points: s.points })));
  });
}

export async function updateSettings(sessionId: string, patch: { teams?: Team[]; seriesKey?: string | null }): Promise<SessionRow> {
  const set: Partial<typeof sessions.$inferInsert> = {};
  if (patch.teams !== undefined) set.teams = patch.teams;
  if (patch.seriesKey !== undefined) set.seriesKey = patch.seriesKey;
  if (Object.keys(set).length === 0) return (await getSession(sessionId))!;
  const [row] = await db.update(sessions).set(set).where(eq(sessions.id, sessionId)).returning();
  return row!;
}

/** Bellekte olmayan (bitmiş/eski) oturum için sonuçlar DB'den derlenir. Upvote'lar bellekte olduğundan burada 0 görünür. */
export async function resultsFromDb(sessionId: string, teams: Team[] = []) {
  const [slideList, ps, as] = await Promise.all([
    getSlides(sessionId),
    db.select().from(participants).where(eq(participants.sessionId, sessionId)),
    db.select().from(answers).where(eq(answers.sessionId, sessionId)),
  ]);
  const nick = new Map(ps.map((p) => [p.id, p.nickname]));
  const bySlide = new Map<string, AnswerRecord[]>();
  for (const a of as) {
    const list = bySlide.get(a.slideId) ?? [];
    list.push({ id: a.id, participantId: a.participantId, nickname: nick.get(a.participantId) ?? "", value: a.value, answeredAt: a.answeredAt.getTime() });
    bySlide.set(a.slideId, list);
  }
  const plist: Participant[] = ps.map((p) => ({ id: p.id, nickname: p.nickname, avatarSeed: p.avatarSeed, score: p.score, streak: p.streak, connected: false, teamId: p.teamId ?? null }));
  return {
    slides: slideList.map((slide) => ({ slide, tally: buildTally(slide, bySlide.get(slide.id) ?? []) })),
    leaderboard: buildLeaderboard(plist),
    teams: teams.length ? buildTeamStandings(teams, plist) : [],
  };
}

export interface SeriesEntry { deviceId: string; nickname: string; totalScore: number; sessionsPlayed: number; wins: number }

/** Aynı seriesKey'li bitmiş oturumlarda device_id bazında toplam. deviceId'siz katılımcılar dışarıda. */
export async function seriesLeaderboard(seriesKey: string): Promise<{ seriesKey: string; sessions: number; leaderboard: SeriesEntry[] }> {
  const ended = await db.select({ id: sessions.id, endedAt: sessions.endedAt }).from(sessions)
    .where(and(eq(sessions.seriesKey, seriesKey), eq(sessions.state, "ended")));
  if (ended.length === 0) return { seriesKey, sessions: 0, leaderboard: [] };
  const ids = ended.map((s) => s.id);
  const ps = await db.select().from(participants).where(and(inArray(participants.sessionId, ids), isNotNull(participants.deviceId)));
  // Oturum başına kazanan cihaz (en yüksek skor; eşitlikte tümü kazanır).
  const topBySession = new Map<string, number>();
  for (const p of ps) topBySession.set(p.sessionId, Math.max(topBySession.get(p.sessionId) ?? -Infinity, p.score));
  const acc = new Map<string, SeriesEntry & { lastJoined: number; played: Set<string> }>();
  for (const p of ps) {
    const key = p.deviceId!;
    let e = acc.get(key);
    if (!e) { e = { deviceId: key, nickname: p.nickname, totalScore: 0, sessionsPlayed: 0, wins: 0, lastJoined: 0, played: new Set() }; acc.set(key, e); }
    e.totalScore += p.score;
    if (!e.played.has(p.sessionId)) { e.played.add(p.sessionId); e.sessionsPlayed++; if (p.score === topBySession.get(p.sessionId) && p.score > 0) e.wins++; }
    const j = p.joinedAt.getTime();
    if (j >= e.lastJoined) { e.lastJoined = j; e.nickname = p.nickname; }
  }
  const leaderboard = [...acc.values()]
    .map(({ lastJoined: _l, played: _p, ...rest }) => rest)
    .sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins || a.nickname.localeCompare(b.nickname));
  return { seriesKey, sessions: ended.length, leaderboard };
}

/** Demo oturumlar: 2 saatten eski olanları siler, silinen id'leri döner (registry'den atmak için). */
export async function deleteOldDemoSessions(olderThanMs: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const rows = await db.delete(sessions).where(and(eq(sessions.isDemo, true), lt(sessions.createdAt, cutoff))).returning({ id: sessions.id });
  return rows.map((r) => r.id);
}

export const pgPersistence: Persistence = {
  async addParticipant(sessionId, p, deviceId) {
    await db.insert(participants).values({ id: p.id, sessionId, nickname: p.nickname, avatarSeed: p.avatarSeed, deviceId, teamId: p.teamId ?? null }).onConflictDoNothing();
  },
  async saveAnswer(sessionId, slideId, participantId, answerId, value, answeredAt, msTaken) {
    await db.insert(answers).values({ id: answerId, sessionId, slideId, participantId, value, answeredAt: new Date(answeredAt), msTaken }).onConflictDoNothing();
  },
  async saveReveal(sessionId, slideId, rows: RevealRow[]) {
    await db.transaction(async (tx) => {
      for (const r of rows) {
        await tx.update(participants).set({ score: r.score, streak: r.streak, lastSeen: dsql`now()` }).where(eq(participants.id, r.participantId));
        if (r.answered) {
          await tx.update(answers).set({ isCorrect: r.correct, pointsAwarded: r.pointsAwarded })
            .where(and(eq(answers.sessionId, sessionId), eq(answers.slideId, slideId), eq(answers.participantId, r.participantId)));
        }
      }
    });
  },
  async setState(sessionId, state: SessionPhase, currentSlideIdx) {
    await db.update(sessions).set({ state, currentSlideIdx }).where(eq(sessions.id, sessionId));
  },
  async setEnded(sessionId, publicToken, endedAt) {
    await db.update(sessions).set({ publicToken, endedAt: new Date(endedAt) }).where(eq(sessions.id, sessionId));
  },
};
