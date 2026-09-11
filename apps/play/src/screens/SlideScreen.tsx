import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AnswerValue, Slide, Tally } from "@sahne/protocol";
import { AnswerButton, TimerRing } from "@sahne/ui";
import { useI18n } from "../lib/i18n";
import { sound } from "../lib/sound";
import { SentState } from "../components/SentState";

export type QuestionsTally = Extract<Tally, { kind: "questions" }>;
export const MAX_QUESTIONS_PER_PERSON = 5;

interface Props {
  slide: Slide;
  startedAt: number;
  clockOffset: number;
  locked: boolean;
  sent: boolean;
  /** Gönderilen cevabın yerel kopyası (seçili butonu göstermek için). */
  sentValue: AnswerValue | null;
  onAnswer: (value: AnswerValue) => void;
  /** qa slaydı: canlı soru listesi, kendi takma adın (kendi sorunu oylayamazsın) ve oy toggle'ı. */
  questions?: QuestionsTally | null;
  nickname?: string;
  onAsk?: (text: string) => void;
  onUpvote?: (questionId: string) => void;
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

/** Son 3 saniyede saniyede bir çok hafif tik (kilitli/bitmişse yok). */
function useTick(startedAt: number, limitS: number, clockOffset: number, active: boolean) {
  const last = useRef<number>(-1);
  useEffect(() => {
    if (!active) return;
    const deadline = startedAt + limitS * 1000;
    const id = setInterval(() => {
      const remain = Math.ceil((deadline - (Date.now() + clockOffset)) / 1000);
      if (remain >= 1 && remain <= 3 && remain !== last.current) { last.current = remain; sound.tick(); }
    }, 100);
    return () => clearInterval(id);
  }, [startedAt, limitS, clockOffset, active]);
}

export function SlideScreen({ slide, startedAt, clockOffset, locked, sent, sentValue, onAnswer, questions, nickname, onAsk, onUpvote }: Props) {
  const { t } = useI18n();
  const timeUp = useTimeUp(startedAt, slide.timeLimitS, clockOffset);
  const isTitle = slide.type === "title";
  const isQa = slide.type === "qa";
  const disabled = locked || timeUp || (sent && !isQa);
  useTick(startedAt, slide.timeLimitS, clockOffset, !isTitle && !isQa && !locked && !timeUp);

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
      ) : isQa ? (
        <Qa slide={slide} disabled={disabled} questions={questions ?? null} nickname={nickname ?? ""} onAsk={onAsk} onUpvote={onUpvote} />
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

/* ---------- live Q&A ---------- */
function Qa({ slide, disabled, questions, nickname, onAsk, onUpvote }: {
  slide: Extract<Slide, { type: "qa" }>; disabled: boolean; questions: QuestionsTally | null; nickname: string;
  onAsk?: (text: string) => void; onUpvote?: (id: string) => void;
}) {
  const { t } = useI18n();
  const max = slide.maxLength;
  const [text, setText] = useState("");
  const [asked, setAsked] = useState(0);
  const [voted, setVoted] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<Record<string, number>>({});
  const [justSent, setJustSent] = useState(false);

  // Yeni tally geldiğinde iyimser farklar sunucu değeriyle değiştirilir.
  useEffect(() => { setPending({}); }, [questions]);

  const left = MAX_QUESTIONS_PER_PERSON - asked;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim().slice(0, max);
    if (!v || disabled || left <= 0 || !onAsk) return;
    onAsk(v); setAsked((n) => n + 1); setText("");
    setJustSent(true); setTimeout(() => setJustSent(false), 1200);
  };
  const toggle = (id: string) => {
    if (disabled || !onUpvote) return;
    const on = voted.has(id);
    setVoted((s) => { const n = new Set(s); on ? n.delete(id) : n.add(id); return n; });
    setPending((p) => ({ ...p, [id]: (p[id] ?? 0) + (on ? -1 : 1) }));
    try { navigator.vibrate?.(8); } catch { /* ignore */ }
    onUpvote(id);
  };

  const list = useMemo(() => {
    const qs = (questions?.questions ?? []).map((q) => ({ ...q, votes: q.votes + (pending[q.id] ?? 0) }));
    return qs.sort((a, b) => b.votes - a.votes || a.at - b.at);
  }, [questions, pending]);

  return (
    <div className="p-stack" style={{ flex: 1 }}>
      <form className="p-stack" onSubmit={submit}>
        <textarea
          className="s-input p-textarea p-textarea--qa" value={text} onChange={(e) => setText(e.target.value.slice(0, max))} maxLength={max}
          placeholder={left > 0 ? t("play.askPlaceholder") : t("play.questionLimit")} disabled={disabled || left <= 0}
        />
        <div className="p-row" style={{ alignItems: "center" }}>
          <span className="p-counter" style={{ flex: 1, textAlign: "left" }}>{left > 0 ? t("play.questionsLeft", { n: left }) : t("play.questionLimit")} · {text.length}/{max}</span>
          <button type="submit" className={`s-btn s-btn--primary ${justSent ? "s-pop" : ""}`} disabled={!text.trim() || disabled || left <= 0}>
            {justSent ? "✓" : t("play.send")}
          </button>
        </div>
      </form>

      <div className="p-label" style={{ marginTop: 4 }}>{t("play.liveQuestions")} {list.length ? `· ${list.length}` : ""}</div>
      {list.length === 0 ? (
        <div className="p-sub" style={{ textAlign: "center", padding: 12 }}>{t("play.noQuestions")}</div>
      ) : (
        <ul className="p-qa">
          {list.map((q) => {
            const mine = q.nickname === nickname;
            const on = voted.has(q.id);
            return (
              <li key={q.id} className={`p-qa__item ${mine ? "p-qa__item--mine" : ""}`}>
                <div className="p-qa__body">
                  <div className="p-qa__text">{q.text}</div>
                  <div className="p-qa__meta">{q.nickname}{mine && <span className="p-qa__you">{t("play.youChip")}</span>}</div>
                </div>
                <button
                  type="button" className={`p-qa__vote ${on ? "p-qa__vote--on" : ""}`} aria-pressed={on} aria-label={t("play.upvote")}
                  disabled={mine || disabled} onClick={() => toggle(q.id)}
                >
                  <svg viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>
                  <span>{q.votes}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
