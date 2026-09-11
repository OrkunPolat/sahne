// SPEC.md §4 veri modeli + docs/API.md "Dalga 2" eklemeleri. Slayt içeriği tam Slide nesnesi olarak jsonb'de tutulur.
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import type { Slide, AnswerValue, Team, TournamentItem } from "@sahne/protocol";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 6 }).notNull(),
  hostSecret: text("host_secret").notNull(),
  title: text("title").notNull(),
  themeDefault: text("theme_default").notNull(),
  localeDefault: text("locale_default").notNull(),
  state: text("state").notNull().default("lobby"), // lobby | live | ended
  currentSlideIdx: integer("current_slide_idx").notNull().default(-1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Dalga 2
  teams: jsonb("teams").$type<Team[]>().notNull().default([]),
  seriesKey: text("series_key"),
  publicToken: text("public_token"),
  isDemo: boolean("is_demo").notNull().default(false),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (t) => ({
  codeIdx: index("sessions_code_idx").on(t.code),
  publicTokenUq: uniqueIndex("sessions_public_token_uq").on(t.publicToken),
  seriesIdx: index("sessions_series_key_idx").on(t.seriesKey),
}));

export const slides = pgTable("slides", {
  id: text("id").notNull(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  type: text("type").notNull(),
  mode: text("mode").notNull(),
  payload: jsonb("payload").$type<Slide>().notNull(),
  timeLimitS: integer("time_limit_s").notNull(),
  points: integer("points").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.sessionId, t.id] }) }));

export const participants = pgTable("participants", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  nickname: varchar("nickname", { length: 20 }).notNull(),
  avatarSeed: text("avatar_seed").notNull(),
  score: integer("score").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  // Dalga 2
  deviceId: text("device_id"),
  teamId: text("team_id"),
}, (t) => ({ sessionIdx: index("participants_session_idx").on(t.sessionId), deviceIdx: index("participants_device_idx").on(t.deviceId) }));

/**
 * answers.id: qa slaydında soru kimliği (LiveSession nanoid(10) üretir), diğer slaytlarda rastgele.
 * Dalga 1'deki (session_id, slide_id, participant_id) unique index kaldırıldı: qa slaydında aynı katılımcı
 * en fazla 5 soru gönderebilir. "Slayt başına tek cevap" kuralı artık yalnızca bellekte (LiveSession.playerAnswer)
 * uygulanır; DB'de tekillik `id` PK'si ile sağlanır. Sorgu için (session_id, slide_id) index'i eklendi.
 */
export const answers = pgTable("answers", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  slideId: text("slide_id").notNull(),
  participantId: text("participant_id").notNull().references(() => participants.id, { onDelete: "cascade" }),
  value: jsonb("value").$type<AnswerValue>().notNull(),
  answeredAt: timestamp("answered_at", { withTimezone: true }).notNull(),
  msTaken: integer("ms_taken").notNull(),
  isCorrect: boolean("is_correct"),
  pointsAwarded: integer("points_awarded").notNull().default(0),
}, (t) => ({ slideIdx: index("answers_session_slide_idx").on(t.sessionId, t.slideId) }));

/* ---------- Dalga 3: Turnuva (docs/API.md) ---------- */

export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("general"),
  locale: text("locale").notNull().default("tr"),
  coverUrl: text("cover_url"),
  items: jsonb("items").$type<TournamentItem[]>().notNull().default([]),
  visibility: text("visibility").notNull().default("public"), // public | unlisted
  ownerSecret: text("owner_secret").notNull(),
  plays: integer("plays").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugUq: uniqueIndex("tournaments_slug_uq").on(t.slug),
  latestIdx: index("tournaments_visibility_created_idx").on(t.visibility, t.createdAt, t.id),
  popularIdx: index("tournaments_visibility_plays_idx").on(t.visibility, t.plays, t.createdAt, t.id),
}));

export const tournamentItemStats = pgTable("tournament_item_stats", {
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  finals: integer("finals").notNull().default(0),
  champions: integer("champions").notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.tournamentId, t.itemId] }) }));

/** results saklanmaz; stats'a işlenir. */
export const tournamentPlays = pgTable("tournament_plays", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  size: integer("size").notNull(),
  championId: text("champion_id").notNull(),
  deviceId: text("device_id"),
  source: text("source").notNull(), // solo | live
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ tournamentIdx: index("tournament_plays_tournament_idx").on(t.tournamentId, t.createdAt) }));
