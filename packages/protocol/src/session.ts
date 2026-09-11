import { z } from "zod";
import { Slide } from "./slides";

export const ThemeId = z.enum(["midnight-gold", "obsidian-neon", "cream-forest", "burgundy-champagne"]);
export type ThemeId = z.infer<typeof ThemeId>;
export const THEME_IDS: ThemeId[] = ["midnight-gold", "obsidian-neon", "cream-forest", "burgundy-champagne"];

export const Locale = z.enum(["tr", "en"]);
export type Locale = z.infer<typeof Locale>;

export const SessionPhase = z.enum(["lobby", "live", "ended"]);
export type SessionPhase = z.infer<typeof SessionPhase>;

/** Canlı slaydın alt durumu. */
export const SlidePhase = z.enum(["open", "locked", "revealed"]);
export type SlidePhase = z.infer<typeof SlidePhase>;

export const Team = z.object({ id: z.string(), name: z.string().min(1).max(24) });
export type Team = z.infer<typeof Team>;
export const MAX_TEAMS = 10;

export const Participant = z.object({
  id: z.string(),
  nickname: z.string().min(1).max(20),
  avatarSeed: z.string(),
  score: z.number().int().default(0),
  streak: z.number().int().default(0),
  connected: z.boolean().default(true),
  /** Takım modu açıksa atanmış takım. */
  teamId: z.string().nullable().default(null),
});

export const TeamStanding = z.object({
  teamId: z.string(),
  name: z.string(),
  members: z.number().int(),
  /** Üyelerin ortalama puanı (takım sıralaması buna göre). */
  avgScore: z.number(),
  totalScore: z.number().int(),
  rank: z.number().int(),
  rankDelta: z.number().int().default(0),
});
export type TeamStanding = z.infer<typeof TeamStanding>;

/** Reveal'de en hızlı doğru cevaplayanlar. */
export const FastestEntry = z.object({ participantId: z.string(), nickname: z.string(), avatarSeed: z.string(), ms: z.number().int() });
export type FastestEntry = z.infer<typeof FastestEntry>;
export type Participant = z.infer<typeof Participant>;

export const LeaderboardEntry = z.object({
  participantId: z.string(),
  nickname: z.string(),
  avatarSeed: z.string(),
  score: z.number().int(),
  rank: z.number().int(),
  /** Bu sorudan önceki sıraya göre değişim (+ yukarı). */
  rankDelta: z.number().int().default(0),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

export const SessionMeta = z.object({
  id: z.string(),
  code: z.string().regex(/^\d{6}$/),
  title: z.string().min(1).max(80),
  themeDefault: ThemeId.default("midnight-gold"),
  localeDefault: Locale.default("tr"),
  /** Boşsa takım modu kapalı. Katılımcı katılırken seçer; seçmezse round-robin atanır. */
  teams: z.array(Team).max(MAX_TEAMS).default([]),
  /** Aynı seriesKey'e sahip oturumlar cihaz bazında kümülatif tabloda birleşir (haftalık ekip oturumu). */
  seriesKey: z.string().max(40).nullable().default(null),
  /** Herkese açık sonuç sayfası jetonu (oturum bitince üretilir). */
  publicToken: z.string().nullable().default(null),
  /** Anasayfadan "Şimdi dene" ile açılan örnek oturum. */
  isDemo: z.boolean().default(false),
});
export type SessionMeta = z.infer<typeof SessionMeta>;

/** Sunucunun tek otorite olduğu tam canlı durum. Bağlanan/yeniden bağlanan herkese gönderilir. */
export const SessionSnapshot = z.object({
  meta: SessionMeta,
  phase: SessionPhase,
  slides: z.array(Slide),
  currentSlideIdx: z.number().int().default(-1),
  slidePhase: SlidePhase.nullable(),
  /** Sunucu saatine göre epoch ms. */
  slideStartedAt: z.number().nullable(),
  serverNow: z.number(),
  participants: z.array(Participant),
  answeredCount: z.number().int().default(0),
});
export type SessionSnapshot = z.infer<typeof SessionSnapshot>;
