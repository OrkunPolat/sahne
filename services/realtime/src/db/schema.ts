// SPEC.md §4 veri modeli. Slayt içeriği tam Slide nesnesi olarak jsonb'de tutulur.
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import type { Slide, AnswerValue } from "@sahne/protocol";

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
}, (t) => ({ codeIdx: index("sessions_code_idx").on(t.code) }));

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
}, (t) => ({ sessionIdx: index("participants_session_idx").on(t.sessionId) }));

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
}, (t) => ({ uniq: uniqueIndex("answers_slide_participant_uq").on(t.sessionId, t.slideId, t.participantId) }));
