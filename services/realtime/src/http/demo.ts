// POST /api/demo için örnek slaytlar: MC (game), word_cloud, true_false. Locale'e göre TR/EN.
import { nanoid } from "nanoid";
import type { Locale, Slide } from "@sahne/protocol";

export const DEMO_TTL_MS = 2 * 60 * 60 * 1000;

export function demoTitle(locale: Locale): string { return locale === "tr" ? "Demo oturum" : "Demo session"; }

export function demoSlides(locale: Locale): Slide[] {
  const o = () => nanoid(6);
  const tr = locale === "tr";
  const a = o(), b = o(), c = o(), d = o();
  return [
    {
      id: nanoid(8), idx: 0, type: "multiple_choice", mode: "game", timeLimitS: 20, points: 1000,
      text: tr ? "Türkiye'nin başkenti neresidir?" : "What is the capital of Türkiye?",
      options: [
        { id: a, text: tr ? "İstanbul" : "Istanbul" },
        { id: b, text: "Ankara" },
        { id: c, text: tr ? "İzmir" : "Izmir" },
        { id: d, text: "Bursa" },
      ],
      correctOptionIds: [b],
    },
    {
      id: nanoid(8), idx: 1, type: "word_cloud", mode: "insight", timeLimitS: 45, points: 0, maxEntries: 3,
      text: tr ? "Bu toplantıdan tek kelimeyle beklentin ne?" : "In one word, what do you expect from this session?",
    },
    {
      id: nanoid(8), idx: 2, type: "true_false", mode: "game", timeLimitS: 15, points: 1000, correct: false,
      text: tr ? "Işık hızı saniyede yaklaşık 300 bin kilometredir; ses hızı bunun yarısıdır." : "Light travels about 300,000 km/s; sound travels at half that speed.",
    },
  ];
}
