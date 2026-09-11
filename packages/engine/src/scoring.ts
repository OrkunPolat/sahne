import type { AnswerValue, Slide } from "@sahne/protocol";

export const STREAK_BONUS_PER = 100;
export const STREAK_CAP = 5;

/** Slayt puanlı mı? Sadece game modundaki multiple_choice ve true_false. */
export function isScored(slide: Slide): boolean {
  return slide.mode === "game" && (slide.type === "multiple_choice" || slide.type === "true_false");
}

/** Doğruluk; puansız slaytlarda null. */
export function isCorrect(slide: Slide, value: AnswerValue): boolean | null {
  if (!isScored(slide)) return null;
  if (slide.type === "multiple_choice" && value.kind === "choice") {
    const want = new Set(slide.correctOptionIds);
    const got = new Set(value.optionIds);
    if (want.size !== got.size) return false;
    for (const id of want) if (!got.has(id)) return false;
    return true;
  }
  if (slide.type === "true_false" && value.kind === "bool") return value.value === slide.correct;
  return false;
}

/**
 * Hız çarpanı: anında cevap 1.0, sürenin sonunda 0.5. Aralık [0.5, 1].
 */
export function speedFactor(msTaken: number, timeLimitMs: number): number {
  if (timeLimitMs <= 0) return 1;
  const ratio = Math.min(1, Math.max(0, msTaken / timeLimitMs));
  return 1 - ratio / 2;
}

export function streakBonus(streak: number): number {
  return streak >= 2 ? Math.min(streak, STREAK_CAP) * STREAK_BONUS_PER : 0;
}

export interface ScoreInput { slide: Slide; value: AnswerValue; msTaken: number; prevStreak: number }
export interface ScoreResult { correct: boolean | null; points: number; streak: number }

/** Tek cevabın puanı ve yeni seri. Puansız slaytta 0 puan, seri değişmez. */
export function scoreAnswer({ slide, value, msTaken, prevStreak }: ScoreInput): ScoreResult {
  const correct = isCorrect(slide, value);
  if (correct === null) return { correct: null, points: 0, streak: prevStreak };
  if (!correct) return { correct: false, points: 0, streak: 0 };
  const streak = prevStreak + 1;
  const base = Math.round(slide.points * speedFactor(msTaken, slide.timeLimitS * 1000));
  return { correct: true, points: base + streakBonus(streak), streak };
}

/** Cevap vermeyenler için: seri sıfırlanır (sadece puanlı slaytlarda). */
export function missedAnswer(slide: Slide, prevStreak: number): number {
  return isScored(slide) ? 0 : prevStreak;
}

/** Cevap değeri slayt tipiyle uyumlu mu? */
export function validateAnswerForSlide(slide: Slide, value: AnswerValue): boolean {
  switch (slide.type) {
    case "multiple_choice": {
      if (value.kind !== "choice") return false;
      const ids = new Set(slide.options.map((o) => o.id));
      if (!value.optionIds.every((id) => ids.has(id))) return false;
      // game modunda çoklu doğru yoksa tek seçim
      return slide.mode === "game" && slide.correctOptionIds.length <= 1 ? value.optionIds.length === 1 : true;
    }
    case "true_false": return value.kind === "bool";
    case "word_cloud": return value.kind === "words" && value.words.length <= slide.maxEntries;
    case "open_ended": return value.kind === "text" && value.text.length <= slide.maxLength;
    case "scale": return value.kind === "scale" && value.value >= slide.min && value.value <= slide.max;
    case "title": return false;
  }
}
