// Postgres erişimi: oturum CRUD + LiveSession için Persistence uygulaması.
import { and, desc, eq, ne, sql as dsql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Participant, SessionMeta, SessionPhase, Slide } from "@sahne/protocol";
import { buildLeaderboard, buildTally, type AnswerRecord } from "@sahne/engine";
import { db } from "./client";
import { answers, participants, sessions, slides } from "./schema";
import type { Persistence, RevealRow } from "../live/persistence";

export type SessionRow = typeof sessions.$inferSelect;

export function rowToMeta(r: SessionRow): SessionMeta {
  return { id: r.id, code: r.code, title: r.title, themeDefault: r.themeDefault as SessionMeta["themeDefault"], localeDefault: r.localeDefault as SessionMeta["localeDefault"] };
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

export async function createSession(input: { title: string; themeDefault: string; localeDefault: string }): Promise<SessionRow> {
  const row: typeof sessions.$inferInsert = { id: nanoid(16), code: await uniqueCode(), hostSecret: nanoid(24), ...input };
  const [created] = await db.insert(sessions).values(row).returning();
  return created!;
}

export async function getSession(id: string): Promise<SessionRow | undefined> {
  const [r] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
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

/** Bellekte olmayan (bitmiş/eski) oturum için sonuçlar DB'den derlenir. */
export async function resultsFromDb(sessionId: string) {
  const [slideList, ps, as] = await Promise.all([
    getSlides(sessionId),
    db.select().from(participants).where(eq(participants.sessionId, sessionId)),
    db.select().from(answers).where(eq(answers.sessionId, sessionId)),
  ]);
  const bySlide = new Map<string, AnswerRecord[]>();
  for (const a of as) {
    const list = bySlide.get(a.slideId) ?? [];
    list.push({ participantId: a.participantId, value: a.value, answeredAt: a.answeredAt.getTime() });
    bySlide.set(a.slideId, list);
  }
  const plist: Participant[] = ps.map((p) => ({ id: p.id, nickname: p.nickname, avatarSeed: p.avatarSeed, score: p.score, streak: p.streak, connected: false }));
  return {
    slides: slideList.map((slide) => ({ slide, tally: buildTally(slide, bySlide.get(slide.id) ?? []) })),
    leaderboard: buildLeaderboard(plist),
  };
}

export const pgPersistence: Persistence = {
  async addParticipant(sessionId, p) {
    await db.insert(participants).values({ id: p.id, sessionId, nickname: p.nickname, avatarSeed: p.avatarSeed }).onConflictDoNothing();
  },
  async saveAnswer(sessionId, slideId, participantId, value, answeredAt, msTaken) {
    await db.insert(answers).values({ id: nanoid(16), sessionId, slideId, participantId, value, answeredAt: new Date(answeredAt), msTaken }).onConflictDoNothing();
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
};
