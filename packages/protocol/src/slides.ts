import { z } from "zod";
import { TournamentItem } from "./tournament";

export const SlideMode = z.enum(["insight", "game"]);
export type SlideMode = z.infer<typeof SlideMode>;

/** Cevap butonu kimliği: renk + şekil, her temada palete uydurulur. */
export const AnswerShape = z.enum(["triangle", "diamond", "circle", "square"]);
export type AnswerShape = z.infer<typeof AnswerShape>;
export const ANSWER_SHAPES: AnswerShape[] = ["triangle", "diamond", "circle", "square"];

const base = {
  id: z.string(),
  idx: z.number().int().nonnegative(),
  /** Soru veya başlık metni. Host'un yazdığı gibi, çevrilmez. */
  text: z.string().min(1).max(280),
  timeLimitS: z.number().int().min(5).max(120).default(20),
  points: z.number().int().min(0).max(5000).default(1000),
};

export const TitleSlide = z.object({
  ...base,
  type: z.literal("title"),
  mode: z.literal("insight"),
  subtitle: z.string().max(280).optional(),
});

export const MultipleChoiceSlide = z.object({
  ...base,
  type: z.literal("multiple_choice"),
  mode: SlideMode,
  options: z.array(z.object({ id: z.string(), text: z.string().min(1).max(120) })).min(2).max(4),
  /** game modunda zorunlu; insight modunda yok sayılır. */
  correctOptionIds: z.array(z.string()).default([]),
});

export const TrueFalseSlide = z.object({
  ...base,
  type: z.literal("true_false"),
  mode: z.literal("game"),
  correct: z.boolean(),
});

export const WordCloudSlide = z.object({
  ...base,
  type: z.literal("word_cloud"),
  mode: z.literal("insight"),
  maxEntries: z.number().int().min(1).max(5).default(3),
});

export const OpenEndedSlide = z.object({
  ...base,
  type: z.literal("open_ended"),
  mode: z.literal("insight"),
  maxLength: z.number().int().min(20).max(500).default(200),
});

export const ScaleSlide = z.object({
  ...base,
  type: z.literal("scale"),
  mode: z.literal("insight"),
  min: z.number().int().default(1),
  max: z.number().int().default(5),
  minLabel: z.string().max(40).optional(),
  maxLabel: z.string().max(40).optional(),
});

/** Canlı Q&A: katılımcılar soru yazar ve birbirlerinin sorularını oylar; host en çok oylananı görür. */
export const QaSlide = z.object({
  ...base,
  type: z.literal("qa"),
  mode: z.literal("insight"),
  maxLength: z.number().int().min(20).max(300).default(200),
});

/** Canlı turnuva: salon her eşleşmeyi oylar. Puansız (insight). items sunucu tarafında turnuvadan doldurulur. */
export const BracketSlide = z.object({
  ...base,
  type: z.literal("bracket"),
  mode: z.literal("insight"),
  tournamentId: z.string(),
  /** 4..256, 2'nin kuvveti, aday sayısını aşamaz */
  size: z.number().int().min(4).max(256),
  /** Sunucu doldurur; host editörde önizleme için kullanılabilir */
  items: z.array(TournamentItem).default([]),
});

export const Slide = z.discriminatedUnion("type", [
  TitleSlide,
  MultipleChoiceSlide,
  TrueFalseSlide,
  WordCloudSlide,
  OpenEndedSlide,
  ScaleSlide,
  QaSlide,
  BracketSlide,
]);
export type Slide = z.infer<typeof Slide>;
export type SlideType = Slide["type"];

/** Katılımcının gönderdiği cevap değeri; slayt tipine göre. */
export const AnswerValue = z.union([
  z.object({ kind: z.literal("choice"), optionIds: z.array(z.string()).min(1).max(4) }),
  z.object({ kind: z.literal("bool"), value: z.boolean() }),
  z.object({ kind: z.literal("words"), words: z.array(z.string().min(1).max(30)).min(1).max(5) }),
  z.object({ kind: z.literal("text"), text: z.string().min(1).max(500) }),
  z.object({ kind: z.literal("scale"), value: z.number().int() }),
  /** qa slaydı: bir katılımcı birden çok soru gönderebilir (her biri ayrı answer). */
  z.object({ kind: z.literal("question"), text: z.string().min(1).max(300) }),
]);
export type AnswerValue = z.infer<typeof AnswerValue>;

/** Host ekranında gösterilen toplu sonuç. */
export const Tally = z.union([
  z.object({ kind: z.literal("choice"), counts: z.record(z.string(), z.number()), total: z.number() }),
  z.object({ kind: z.literal("bool"), counts: z.object({ true: z.number(), false: z.number() }), total: z.number() }),
  z.object({ kind: z.literal("words"), words: z.array(z.object({ text: z.string(), count: z.number() })), total: z.number() }),
  z.object({ kind: z.literal("text"), entries: z.array(z.object({ text: z.string(), at: z.number() })), total: z.number() }),
  z.object({ kind: z.literal("scale"), counts: z.record(z.string(), z.number()), avg: z.number(), total: z.number() }),
  z.object({
    kind: z.literal("questions"),
    questions: z.array(z.object({ id: z.string(), text: z.string(), votes: z.number(), nickname: z.string(), at: z.number() })),
    total: z.number(),
  }),
]);
export type Tally = z.infer<typeof Tally>;
