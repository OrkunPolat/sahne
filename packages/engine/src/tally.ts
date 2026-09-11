import type { AnswerValue, Slide, Tally } from "@sahne/protocol";

export interface AnswerRecord { participantId: string; value: AnswerValue; answeredAt: number; /** qa: soru kimliği (answer id) */ id?: string; nickname?: string }
/** qa slaydı için oylar: questionId → oy veren participantId'ler. */
export type Upvotes = Map<string, Set<string>>;

const norm = (w: string) => w.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");

/** Slayt tipine göre toplu sonuç. Saf, sıralı, deterministik. */
export function buildTally(slide: Slide, answers: AnswerRecord[], upvotes?: Upvotes): Tally {
  switch (slide.type) {
    case "multiple_choice": {
      const counts: Record<string, number> = Object.fromEntries(slide.options.map((o) => [o.id, 0]));
      for (const a of answers) if (a.value.kind === "choice") for (const id of a.value.optionIds) counts[id] = (counts[id] ?? 0) + 1;
      return { kind: "choice", counts, total: answers.length };
    }
    case "true_false": {
      const counts = { true: 0, false: 0 };
      for (const a of answers) if (a.value.kind === "bool") counts[a.value.value ? "true" : "false"]++;
      return { kind: "bool", counts, total: answers.length };
    }
    case "word_cloud": {
      const map = new Map<string, { text: string; count: number }>();
      for (const a of answers) if (a.value.kind === "words") for (const w of a.value.words) {
        const k = norm(w); if (!k) continue;
        const e = map.get(k); if (e) e.count++; else map.set(k, { text: w.trim(), count: 1 });
      }
      const words = [...map.values()].sort((x, y) => y.count - x.count || x.text.localeCompare(y.text));
      return { kind: "words", words, total: answers.length };
    }
    case "open_ended": {
      const entries = answers.filter((a) => a.value.kind === "text").map((a) => ({ text: (a.value as { text: string }).text, at: a.answeredAt }))
        .sort((x, y) => x.at - y.at);
      return { kind: "text", entries, total: answers.length };
    }
    case "scale": {
      const counts: Record<string, number> = {};
      for (let v = slide.min; v <= slide.max; v++) counts[String(v)] = 0;
      let sum = 0, n = 0;
      for (const a of answers) if (a.value.kind === "scale") { counts[String(a.value.value)] = (counts[String(a.value.value)] ?? 0) + 1; sum += a.value.value; n++; }
      return { kind: "scale", counts, avg: n ? Math.round((sum / n) * 100) / 100 : 0, total: answers.length };
    }
    case "qa": {
      const questions = answers
        .filter((a) => a.value.kind === "question" && a.id)
        .map((a) => ({ id: a.id!, text: (a.value as { text: string }).text, votes: upvotes?.get(a.id!)?.size ?? 0, nickname: a.nickname ?? "", at: a.answeredAt }))
        .sort((x, y) => y.votes - x.votes || x.at - y.at);
      return { kind: "questions", questions, total: answers.length };
    }
    case "title":
      return { kind: "text", entries: [], total: 0 };
  }
}
