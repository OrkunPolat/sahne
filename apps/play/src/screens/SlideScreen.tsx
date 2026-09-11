import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AnswerValue, Slide } from "@sahne/protocol";
import { AnswerButton, TimerRing } from "@sahne/ui";
import { useI18n } from "../lib/i18n";
import { SentState } from "../components/SentState";

interface Props {
  slide: Slide;
  startedAt: number;
  clockOffset: number;
  locked: boolean;
  sent: boolean;
  /** Gönderilen cevabın yerel kopyası (seçili butonu göstermek için). */
  sentValue: AnswerValue | null;
  onAnswer: (value: AnswerValue) => void;
}

function useTimeUp(startedAt: number, limitS: number, clockOffset: number) {
  const deadline = startedAt + limitS * 1000;
  const [up, setUp] = useState(() => Date.now() + clockOffset >= deadline);
  useEffect(() => {
    setUp(Date.now() + clockOffset >= deadline);
    const id = setInterval(() => { if (Date.now() + clockOffset >= deadline) { setUp(true); clearInterval(id); } }, 200);
    return () => clearInterval(id);
  }, [deadline, clockOffset]);
  return up;
}

export function SlideScreen({ slide, startedAt, clockOffset, locked, sent, sentValue, onAnswer }: Props) {
  const { t } = useI18n();
  const timeUp = useTimeUp(startedAt, slide.timeLimitS, clockOffset);
  const disabled = locked || timeUp || sent;
  const isTitle = slide.type === "title";

  return (
    <div className="p-stack s-fade-in" style={{ flex: 1 }}>
      <div className="p-slide-head">
        <div className="p-stack" style={{ gap: 6 }}>
          <div className="p-question">{slide.text}</div>
          {isTitle && slide.subtitle && <div className="p-sub">{slide.subtitle}</div>}
        </div>
        {!isTitle && <TimerRing startedAt={startedAt} limitS={slide.timeLimitS} clockOffset={clockOffset} size={56} />}
      </div>

      {isTitle ? (
        <div className="p-state"><div className="p-sub">{t("play.waitingHost")}</div></div>
      ) : (
        <Body slide={slide} disabled={disabled} sent={sent} timeUp={timeUp || locked} sentValue={sentValue} onAnswer={onAnswer} />
      )}
    </div>
  );
}

function Body({ slide, disabled, sent, timeUp, sentValue, onAnswer }: { slide: Slide; disabled: boolean; sent: boolean; timeUp: boolean; sentValue: AnswerValue | null; onAnswer: (v: AnswerValue) => void }) {
  switch (slide.type) {
    case "multiple_choice": return <MultipleChoice slide={slide} disabled={disabled} sent={sent} timeUp={timeUp} sentValue={sentValue} onAnswer={onAnswer} />;
    case "true_false": return <TrueFalse disabled={disabled} sent={sent} timeUp={timeUp} sentValue={sentValue} onAnswer={onAnswer} />;
    case "word_cloud": return sent || timeUp ? <SentState timeUp={!sent && timeUp} /> : <WordCloud max={slide.maxEntries} disabled={disabled} onAnswer={onAnswer} />;
    case "open_ended": return sent || timeUp ? <SentState timeUp={!sent && timeUp} /> : <OpenEnded max={slide.maxLength} disabled={disabled} onAnswer={onAnswer} />;
    case "scale": return <Scale slide={slide} disabled={disabled} sent={sent} timeUp={timeUp} sentValue={sentValue} onAnswer={onAnswer} />;
    default: return null;
  }
}

/* ---------- multiple choice ---------- */
function MultipleChoice({ slide, disabled, sent, timeUp, sentValue, onAnswer }: {
  slide: Extract<Slide, { type: "multiple_choice" }>; disabled: boolean; sent: boolean; timeUp: boolean; sentValue: AnswerValue | null; onAnswer: (v: AnswerValue) => void;
}) {
  const { t } = useI18n();
  const multi = slide.mode === "insight" || slide.correctOptionIds.length > 1;
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => { setPicked([]); }, [slide.id]);
  const sentIds = useMemo(() => (sentValue?.kind === "choice" ? sentValue.optionIds : []), [sentValue]);
  const active = sent ? sentIds : picked;

  const tap = (id: string) => {
    if (disabled) return;
    if (!multi) { onAnswer({ kind: "choice", optionIds: [id] }); return; }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const submit = () => { if (picked.length && !disabled) onAnswer({ kind: "choice", optionIds: picked }); };

  return (
    <div className="p-stack" style={{ flex: 1 }}>
      <div className="p-grid" style={{ flex: 1 }}>
        {slide.options.map((o, i) => {
          const isOn = active.includes(o.id);
          const state = sent || (timeUp && !sent) ? (isOn ? "selected" : "dim") : isOn ? "selected" : "idle";
          return <AnswerButton key={o.id} index={i} label={o.text} state={state} disabled={disabled} onClick={() => tap(o.id)} />;
        })}
      </div>
      {sent ? <SentState /> : timeUp ? <SentState timeUp /> : multi ? (
        <button type="button" className="s-btn s-btn--primary s-btn--lg p-btn-block" disabled={!picked.length || disabled} onClick={submit}>{t("play.send")}</button>
      ) : (
        <div className="p-sub" style={{ textAlign: "center" }}>{t("play.tapToAnswer")}</div>
      )}
    </div>
  );
}

/* ---------- true / false ---------- */
function TrueFalse({ disabled, sent, timeUp, sentValue, onAnswer }: { disabled: boolean; sent: boolean; timeUp: boolean; sentValue: AnswerValue | null; onAnswer: (v: AnswerValue) => void }) {
  const { t } = useI18n();
  const chosen = sentValue?.kind === "bool" ? sentValue.value : null;
  const state = (v: boolean) => (sent || timeUp ? (chosen === v ? "selected" : "dim") : "idle");
  return (
    <div className="p-stack" style={{ flex: 1 }}>
      <div className="p-grid p-grid--tall" style={{ flex: 1 }}>
        <AnswerButton index={2} label={t("play.true")} state={state(true)} disabled={disabled} onClick={() => onAnswer({ kind: "bool", value: true })} />
        <AnswerButton index={0} label={t("play.false")} state={state(false)} disabled={disabled} onClick={() => onAnswer({ kind: "bool", value: false })} />
      </div>
      {sent ? <SentState /> : timeUp ? <SentState timeUp /> : <div className="p-sub" style={{ textAlign: "center" }}>{t("play.tapToAnswer")}</div>}
    </div>
  );
}

/* ---------- word cloud ---------- */
function WordCloud({ max, disabled, onAnswer }: { max: number; disabled: boolean; onAnswer: (v: AnswerValue) => void }) {
  const { t } = useI18n();
  const [words, setWords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const full = words.length >= max;

  const add = (e?: FormEvent) => {
    e?.preventDefault();
    const w = draft.trim().slice(0, 30);
    if (!w || full || words.some((x) => x.toLowerCase() === w.toLowerCase())) return;
    setWords((ws) => [...ws, w]); setDraft("");
  };
  const submit = () => {
    const list = draft.trim() && !full ? [...words, draft.trim().slice(0, 30)] : words;
    if (list.length && !disabled) onAnswer({ kind: "words", words: list.slice(0, 5) });
  };

  return (
    <div className="p-stack">
      <div className="p-chips">
        {words.map((w) => (
          <span key={w} className="s-chip">{w}<button type="button" className="p-chip-x" aria-label={t("play.removeWord")} onClick={() => setWords((ws) => ws.filter((x) => x !== w))}>×</button></span>
        ))}
      </div>
      <form className="p-row" onSubmit={add}>
        <input className="s-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={30} placeholder={t("play.wordPlaceholder")} disabled={disabled || full} enterKeyHint="done" />
        <button type="submit" className="s-btn" disabled={!draft.trim() || full || disabled}>{t("play.addWord")}</button>
      </form>
      <div className="p-counter">{words.length} / {max}</div>
      <button type="button" className="s-btn s-btn--primary s-btn--lg p-btn-block" disabled={disabled || (!words.length && !draft.trim())} onClick={submit}>{t("play.send")}</button>
    </div>
  );
}

/* ---------- open ended ---------- */
function OpenEnded({ max, disabled, onAnswer }: { max: number; disabled: boolean; onAnswer: (v: AnswerValue) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); const v = text.trim(); if (v && !disabled) onAnswer({ kind: "text", text: v.slice(0, max) }); };
  return (
    <form className="p-stack" onSubmit={submit}>
      <textarea className="s-input p-textarea" value={text} onChange={(e) => setText(e.target.value.slice(0, max))} maxLength={max} placeholder={t("play.typeHere")} disabled={disabled} />
      <div className="p-counter">{text.length} / {max}</div>
      <button type="submit" className="s-btn s-btn--primary s-btn--lg p-btn-block" disabled={!text.trim() || disabled}>{t("play.send")}</button>
    </form>
  );
}

/* ---------- scale ---------- */
function Scale({ slide, disabled, sent, timeUp, sentValue, onAnswer }: {
  slide: Extract<Slide, { type: "scale" }>; disabled: boolean; sent: boolean; timeUp: boolean; sentValue: AnswerValue | null; onAnswer: (v: AnswerValue) => void;
}) {
  const { t } = useI18n();
  const chosen = sentValue?.kind === "scale" ? sentValue.value : null;
  const values: number[] = [];
  for (let v = slide.min; v <= slide.max; v++) values.push(v);
  return (
    <div className="p-stack">
      <div className="p-scale">
        {values.map((v) => (
          <button key={v} type="button" className={`p-scale__btn ${chosen === v ? "p-scale__btn--selected" : ""}`} disabled={disabled} onClick={() => onAnswer({ kind: "scale", value: v })}>{v}</button>
        ))}
      </div>
      {(slide.minLabel || slide.maxLabel) && (
        <div className="p-scale__labels"><span>{slide.minLabel ?? slide.min}</span><span>{slide.maxLabel ?? slide.max}</span></div>
      )}
      {sent ? <SentState /> : timeUp ? <SentState timeUp /> : <div className="p-sub" style={{ textAlign: "center" }}>{t("play.tapToAnswer")}</div>}
    </div>
  );
}
