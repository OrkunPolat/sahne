import { nanoid } from "nanoid";
import { Slide, type SlideType } from "@sahne/protocol";
import { z } from "zod";

export const SLIDE_TYPES: SlideType[] = ["title", "multiple_choice", "true_false", "word_cloud", "open_ended", "scale"];

export function newSlide(type: SlideType, idx: number, optionLabel: (n: number) => string): Slide {
  const base = { id: nanoid(10), idx, text: "", timeLimitS: 20, points: 1000 };
  switch (type) {
    case "title": return { ...base, type, mode: "insight", points: 0, subtitle: "" };
    case "multiple_choice": {
      const options = [1, 2, 3, 4].map((n) => ({ id: nanoid(6), text: optionLabel(n) }));
      return { ...base, type, mode: "game", options, correctOptionIds: [options[0]!.id] };
    }
    case "true_false": return { ...base, type, mode: "game", correct: true };
    case "word_cloud": return { ...base, type, mode: "insight", points: 0, timeLimitS: 60, maxEntries: 3 };
    case "open_ended": return { ...base, type, mode: "insight", points: 0, timeLimitS: 90, maxLength: 200 };
    case "scale": return { ...base, type, mode: "insight", points: 0, min: 1, max: 5, minLabel: "", maxLabel: "" };
  }
}

export function reindex(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({ ...s, idx: i }));
}

/** Boş opsiyonel string alanlarını kaldırır; zod .max() boş string'i kabul eder ama temiz kalsın. */
function clean(s: Slide): Slide {
  const c: Record<string, unknown> = { ...s };
  for (const k of ["subtitle", "minLabel", "maxLabel"]) if (c[k] === "") delete c[k];
  return c as Slide;
}

export function validateSlides(slides: Slide[]): { ok: true; slides: Slide[] } | { ok: false; errors: string[] } {
  const r = z.array(Slide).safeParse(reindex(slides).map(clean));
  if (r.success) return { ok: true, slides: r.data };
  const errors = r.error.issues.map((i) => {
    const [n, ...rest] = i.path;
    const where = typeof n === "number" ? `#${n + 1} ${rest.join(".")}` : i.path.join(".");
    return `${where}: ${i.message}`.trim();
  });
  return { ok: false, errors };
}
