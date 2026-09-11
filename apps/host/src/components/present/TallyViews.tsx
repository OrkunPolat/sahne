"use client";

import { AnswerButton } from "@sahne/ui";
import type { Slide, Tally } from "@sahne/protocol";
import { useT } from "@/lib/providers";

type MC = Extract<Slide, { type: "multiple_choice" }>;
type SC = Extract<Slide, { type: "scale" }>;

export function ChoiceTiles({ slide, tally, correct, showCounts }: { slide: MC; tally: Tally | null; correct: string[] | null; showCounts: boolean }) {
  const counts = tally?.kind === "choice" ? tally.counts : {};
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="p-answers">
      {slide.options.map((o, i) => {
        const n = counts[o.id] ?? 0;
        const state = correct ? (correct.includes(o.id) ? "correct" : "dim") : "idle";
        return (
          <div key={o.id} className="p-answer-wrap">
            <div style={{ position: "relative" }}>
              <AnswerButton index={i} label={o.text} big state={state} disabled />
              {showCounts && <span className="p-answer-count">{n}</span>}
            </div>
            {showCounts && <div className="p-bar"><i style={{ width: `${(n / max) * 100}%` }} /></div>}
          </div>
        );
      })}
    </div>
  );
}

export function TrueFalseTiles({ tally, correct, showCounts }: { tally: Tally | null; correct: boolean | null; showCounts: boolean }) {
  const t = useT();
  const counts = tally?.kind === "bool" ? tally.counts : { true: 0, false: 0 };
  const max = Math.max(1, counts.true, counts.false);
  return (
    <div className="p-tf">
      {([true, false] as const).map((v, i) => {
        const n = v ? counts.true : counts.false;
        const state = correct === null ? "idle" : correct === v ? "correct" : "dim";
        return (
          <div key={String(v)} className="p-answer-wrap">
            <div style={{ position: "relative" }}>
              <AnswerButton index={v ? 3 : 0} label={v ? t("play.true") : t("play.false")} big state={state} disabled />
              {showCounts && <span className="p-answer-count">{n}</span>}
            </div>
            {showCounts && <div className="p-bar"><i style={{ width: `${(n / max) * 100}%` }} /></div>}
          </div>
        );
      })}
    </div>
  );
}

export function WordCloud({ tally }: { tally: Tally | null }) {
  const t = useT();
  const words = tally?.kind === "words" ? tally.words : [];
  if (words.length === 0) return <p className="p-waiting">{t("play.waitingOthers")}</p>;
  const max = Math.max(1, ...words.map((w) => w.count));
  return (
    <div className="p-cloud">
      {words.map((w) => {
        const r = w.count / max;
        return (
          <span key={w.text} className="s-pop" style={{ fontSize: `${22 + 66 * r}px`, opacity: 0.55 + 0.45 * r, color: r > 0.66 ? "var(--accent)" : "var(--fg)" }}>
            {w.text}
          </span>
        );
      })}
    </div>
  );
}

export function OpenCards({ tally }: { tally: Tally | null }) {
  const t = useT();
  const entries = tally?.kind === "text" ? [...tally.entries].sort((a, b) => b.at - a.at) : [];
  if (entries.length === 0) return <p className="p-waiting">{t("play.waitingOthers")}</p>;
  return (
    <div className="p-cards">
      {entries.map((e) => <div key={`${e.at}-${e.text}`} className="s-card p-card s-pop">{e.text}</div>)}
    </div>
  );
}

export function ScaleBars({ slide, tally }: { slide: SC; tally: Tally | null }) {
  const counts = tally?.kind === "scale" ? tally.counts : {};
  const avg = tally?.kind === "scale" ? tally.avg : null;
  const values: number[] = [];
  for (let v = slide.min; v <= slide.max && values.length < 12; v++) values.push(v);
  const max = Math.max(1, ...values.map((v) => counts[String(v)] ?? 0));
  return (
    <div className="p-scale">
      {(slide.minLabel || slide.maxLabel) && <div className="p-scale-labels"><span>{slide.minLabel}</span><span>{slide.maxLabel}</span></div>}
      {values.map((v) => {
        const n = counts[String(v)] ?? 0;
        return (
          <div key={v} className="p-scale-row">
            <span>{v}</span>
            <div className="p-bar"><i style={{ width: `${(n / max) * 100}%` }} /></div>
            <span className="s-muted">{n}</span>
          </div>
        );
      })}
      {avg !== null && <div className="p-avg">Ø <b>{avg.toFixed(2)}</b></div>}
    </div>
  );
}
