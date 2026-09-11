// AI ile slayt üretimi. ANTHROPIC_API_KEY yoksa 503; host UI butonu gizler.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Slide } from "@sahne/protocol";
import { nanoid } from "nanoid";
import { HttpError } from "./util";

export const AiBody = z.object({
  prompt: z.string().min(3).max(500),
  count: z.number().int().min(1).max(10).default(5),
  locale: z.enum(["tr", "en"]).default("tr"),
  /** Oyun/içgörü karışımı; "mixed" ise ~%70 game. */
  mode: z.enum(["game", "insight", "mixed"]).default("mixed"),
});

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const tool = {
  name: "emit_slides",
  description: "Return the generated slides.",
  input_schema: {
    type: "object" as const,
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["multiple_choice", "true_false", "word_cloud", "open_ended", "scale"] },
            mode: { type: "string", enum: ["game", "insight"] },
            text: { type: "string" },
            options: { type: "array", items: { type: "string" }, description: "multiple_choice: 2-4 options" },
            correctIndex: { type: "integer", description: "multiple_choice game: index of correct option" },
            correct: { type: "boolean", description: "true_false" },
          },
          required: ["type", "mode", "text"],
        },
      },
    },
    required: ["slides"],
  },
};

interface Raw { type: string; mode: string; text: string; options?: string[]; correctIndex?: number; correct?: boolean }

function toSlide(r: Raw, idx: number): Slide | null {
  const id = nanoid(8);
  const base = { id, idx, text: r.text.slice(0, 280), timeLimitS: 20, points: 1000 };
  switch (r.type) {
    case "multiple_choice": {
      const opts = (r.options ?? []).slice(0, 4).map((t) => ({ id: nanoid(6), text: t.slice(0, 120) }));
      if (opts.length < 2) return null;
      const mode = r.mode === "insight" ? "insight" : "game";
      const ci = r.correctIndex ?? 0;
      return Slide.parse({ ...base, type: "multiple_choice", mode, options: opts, correctOptionIds: mode === "game" ? [opts[Math.min(ci, opts.length - 1)]!.id] : [] });
    }
    case "true_false": return Slide.parse({ ...base, type: "true_false", mode: "game", correct: Boolean(r.correct) });
    case "word_cloud": return Slide.parse({ ...base, type: "word_cloud", mode: "insight", timeLimitS: 45, maxEntries: 3 });
    case "open_ended": return Slide.parse({ ...base, type: "open_ended", mode: "insight", timeLimitS: 60, maxLength: 200 });
    case "scale": return Slide.parse({ ...base, type: "scale", mode: "insight", min: 1, max: 5 });
    default: return null;
  }
}

export type AiOpts = Omit<z.infer<typeof AiBody>, "prompt">;

/** PDF'ten çıkarılan metin bu kadar karakterle kırpılır (prompt bütçesi). */
export const MAX_SOURCE_TEXT_CHARS = 12_000;

export async function generateSlides(body: z.infer<typeof AiBody>): Promise<Slide[]> {
  return generate(`Topic/brief: ${body.prompt}`, body);
}

/** PDF/metin kaynağından soru üretimi: metin brief olarak gider; model yalnızca metindeki bilgiye dayanır. */
export async function generateSlidesFromText(text: string, opts: AiOpts): Promise<Slide[]> {
  const src = text.replace(/\s+\n/g, "\n").trim().slice(0, MAX_SOURCE_TEXT_CHARS);
  if (src.length < 20) throw new HttpError(422, "empty_text", "No extractable text in document");
  return generate(`Generate questions strictly from the following source text. Do not use outside knowledge for mode=game answers.\n<source>\n${src}\n</source>`, opts);
}

async function generate(brief: string, body: AiOpts): Promise<Slide[]> {
  if (!aiEnabled()) throw new HttpError(503, "ai_disabled", "ANTHROPIC_API_KEY is not configured");
  const client = new Anthropic();
  const lang = body.locale === "tr" ? "Turkish" : "English";
  const mix = body.mode === "game" ? "All slides are mode=game (multiple_choice or true_false)."
    : body.mode === "insight" ? "All slides are mode=insight (word_cloud, open_ended, scale, or multiple_choice without a correct answer)."
    : "About 70% mode=game quiz questions (multiple_choice with a single correct option, some true_false) and 30% mode=insight (one word_cloud, one scale or open_ended).";
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: `You write live-audience session slides. Language: ${lang}. Questions must be short (≤120 chars), unambiguous, and factual when mode=game. Options ≤ 60 chars. Never include the answer in the question. Use the emit_slides tool exactly once.`,
    messages: [{ role: "user", content: `${brief}\nSlide count: ${body.count}\n${mix}` }],
    tools: [tool],
    tool_choice: { type: "tool", name: "emit_slides" },
  });
  const use = msg.content.find((c) => c.type === "tool_use");
  if (!use || use.type !== "tool_use") throw new HttpError(502, "ai_bad_output", "Model returned no slides");
  const raw = (use.input as { slides?: Raw[] }).slides ?? [];
  const slides = raw.map((r, i) => { try { return toSlide(r, i); } catch { return null; } }).filter((s): s is Slide => s !== null);
  if (slides.length === 0) throw new HttpError(502, "ai_bad_output", "Model returned no valid slides");
  return slides.map((s, i) => ({ ...s, idx: i }));
}
