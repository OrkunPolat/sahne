import { z } from "zod";
/** session.ts bu dosyayı import eder (BracketState); döngüsel import olmasın diye Locale burada tekrar tanımlı. */
const Locale = z.enum(["tr", "en"]);

/** Turnuva (ideal tip world cup): N aday, tek elemeli ikili seçim, şampiyon. */
export const TournamentCategory = z.enum(["general", "movies", "music", "games", "anime", "food", "sports", "people", "places", "brands", "other"]);
export type TournamentCategory = z.infer<typeof TournamentCategory>;
export const TOURNAMENT_CATEGORIES = TournamentCategory.options;

export const TournamentItem = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  imageUrl: z.string().url().max(500).nullable().default(null),
});
export type TournamentItem = z.infer<typeof TournamentItem>;

export const BRACKET_SIZES = [4, 8, 16, 32, 64, 128, 256] as const;
export const MIN_ITEMS = 4;
export const MAX_ITEMS = 256;

export const Tournament = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string().min(2).max(80),
  description: z.string().max(300).default(""),
  category: TournamentCategory.default("general"),
  locale: Locale.default("tr"),
  coverUrl: z.string().url().max(500).nullable().default(null),
  items: z.array(TournamentItem).min(MIN_ITEMS).max(MAX_ITEMS),
  visibility: z.enum(["public", "unlisted"]).default("public"),
  plays: z.number().int().default(0),
  createdAt: z.number(),
});
export type Tournament = z.infer<typeof Tournament>;

/** Galeri kartı: items yerine sayı ve kapak. */
export const TournamentCard = Tournament.omit({ items: true }).extend({ itemCount: z.number().int(), thumbUrls: z.array(z.string()).max(4) });
export type TournamentCard = z.infer<typeof TournamentCard>;

/** Aday istatistiği (tüm oyunlardan). */
export const TournamentItemStat = z.object({
  itemId: z.string(),
  wins: z.number().int(),
  losses: z.number().int(),
  /** Finale kaç kez çıktı */
  finals: z.number().int(),
  /** Kaç kez şampiyon oldu */
  champions: z.number().int(),
});
export type TournamentItemStat = z.infer<typeof TournamentItemStat>;

/** Bir oyunun sonucu (solo veya canlı). */
export const BracketMatchResult = z.object({
  round: z.number().int(),      // 16, 8, 4, 2 (final)
  aId: z.string(),
  bId: z.string(),
  winnerId: z.string(),
  /** canlı modda oy sayıları; solo'da 1/0 */
  votesA: z.number().int().default(0),
  votesB: z.number().int().default(0),
});
export type BracketMatchResult = z.infer<typeof BracketMatchResult>;

export const BracketPlay = z.object({
  size: z.number().int(),
  results: z.array(BracketMatchResult).min(1),
  championId: z.string(),
});
export type BracketPlay = z.infer<typeof BracketPlay>;

/** Canlı turnuva slaydının anlık durumu (snapshot + bracket:state ile yayınlanır). */
export const BracketState = z.object({
  slideId: z.string(),
  size: z.number().int(),
  /** Bu turun büyüklüğü (16 → 8 → 4 → 2) */
  round: z.number().int(),
  matchIdx: z.number().int(),
  matchesInRound: z.number().int(),
  current: z.object({ a: TournamentItem, b: TournamentItem }).nullable(),
  /** Şu ana kadar oynanan eşleşmeler */
  results: z.array(BracketMatchResult),
  champion: TournamentItem.nullable(),
});
export type BracketState = z.infer<typeof BracketState>;
