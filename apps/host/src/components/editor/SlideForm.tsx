"use client";

import type { Slide } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { ModeBadge } from "./SlideList";
import { slideTypeKey } from "./slides";
import { BracketPicker } from "./BracketPicker";

type Patch = Partial<Record<string, unknown>>;

export function SlideForm({ slide, onChange }: { slide: Slide; onChange: (next: Slide) => void }) {
  const t = useT();
  const patch = (p: Patch) => onChange({ ...slide, ...p } as Slide);
  const num = (v: string, fallback: number) => (v === "" ? fallback : Number(v));

  return (
    <div className="s-card h-slide-form">
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <h2>{t(slideTypeKey(slide.type))}</h2>
        {slide.type === "multiple_choice" ? (
          <div className="h-seg" role="group">
            {(["insight", "game"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={slide.mode === m} onClick={() => patch({ mode: m })}>{t(`mode.${m}`)}</button>
            ))}
          </div>
        ) : <ModeBadge mode={slide.mode} />}
      </div>

      <label className="h-field">
        <span>{t("host.slideText")}</span>
        <textarea className="s-input" rows={2} value={slide.text} maxLength={280} onChange={(e) => patch({ text: e.target.value })} />
      </label>

      {slide.type === "title" && (
        <label className="h-field">
          <span>{t("host.subtitle")}</span>
          <input className="s-input" value={slide.subtitle ?? ""} maxLength={280} onChange={(e) => patch({ subtitle: e.target.value })} />
        </label>
      )}

      {slide.type === "multiple_choice" && (
        <div className="h-field">
          <span>{t("host.option", { n: `1–${slide.options.length}` })}</span>
          {slide.options.map((o, i) => {
            const correct = slide.correctOptionIds.includes(o.id);
            return (
              <div key={o.id} className="h-option">
                <span className="s-muted" style={{ width: 18 }}>{i + 1}</span>
                <input className="s-input" value={o.text} maxLength={120} placeholder={t("host.option", { n: i + 1 })}
                  onChange={(e) => patch({ options: slide.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })} />
                {slide.mode === "game" && (
                  <button type="button" className="h-toggle" aria-pressed={correct}
                    onClick={() => patch({ correctOptionIds: correct ? slide.correctOptionIds.filter((id) => id !== o.id) : [...slide.correctOptionIds, o.id] })}>
                    ✓ {t("host.correct")}
                  </button>
                )}
                <button type="button" className="h-icon" disabled={slide.options.length <= 2} aria-label={t("common.delete")}
                  onClick={() => patch({ options: slide.options.filter((x) => x.id !== o.id), correctOptionIds: slide.correctOptionIds.filter((id) => id !== o.id) })}>✕</button>
              </div>
            );
          })}
          {slide.options.length < 4 && (
            <button type="button" className="s-btn" style={{ justifySelf: "start" }}
              onClick={() => patch({ options: [...slide.options, { id: Math.random().toString(36).slice(2, 8), text: "" }] })}>
              + {t("host.option", { n: slide.options.length + 1 })}
            </button>
          )}
        </div>
      )}

      {slide.type === "true_false" && (
        <div className="h-field">
          <span>{t("host.correct")}</span>
          <div className="h-seg" role="group">
            <button type="button" aria-pressed={slide.correct} onClick={() => patch({ correct: true })}>{t("play.true")}</button>
            <button type="button" aria-pressed={!slide.correct} onClick={() => patch({ correct: false })}>{t("play.false")}</button>
          </div>
        </div>
      )}

      {slide.type === "word_cloud" && (
        <label className="h-field">
          <span>{t("host.maxEntries")}</span>
          <input className="s-input" type="number" min={1} max={5} value={slide.maxEntries} onChange={(e) => patch({ maxEntries: num(e.target.value, 3) })} />
        </label>
      )}

      {slide.type === "qa" && (
        <label className="h-field">
          <span>{t("host.maxLength")}</span>
          <input className="s-input" type="number" min={20} max={300} value={slide.maxLength} onChange={(e) => patch({ maxLength: num(e.target.value, 200) })} />
        </label>
      )}

      {slide.type === "open_ended" && (
        <label className="h-field">
          <span>{t("host.maxLength")}</span>
          <input className="s-input" type="number" min={20} max={500} value={slide.maxLength} onChange={(e) => patch({ maxLength: num(e.target.value, 200) })} />
        </label>
      )}

      {slide.type === "bracket" && (
        <BracketPicker slide={slide} onChange={(p) => patch(p)} />
      )}

      {slide.type === "scale" && (
        <div className="h-row">
          <label className="h-field"><span>{t("host.scaleMin")}</span><input className="s-input" type="number" value={slide.min} onChange={(e) => patch({ min: num(e.target.value, 1) })} /></label>
          <label className="h-field"><span>{t("host.scaleMax")}</span><input className="s-input" type="number" value={slide.max} onChange={(e) => patch({ max: num(e.target.value, 5) })} /></label>
          <label className="h-field"><span>{t("host.minLabel")}</span><input className="s-input" value={slide.minLabel ?? ""} maxLength={40} onChange={(e) => patch({ minLabel: e.target.value })} /></label>
          <label className="h-field"><span>{t("host.maxLabel")}</span><input className="s-input" value={slide.maxLabel ?? ""} maxLength={40} onChange={(e) => patch({ maxLabel: e.target.value })} /></label>
        </div>
      )}

      {slide.type !== "title" && (
        <div className="h-row">
          <label className="h-field">
            <span>{t("host.timeLimit")} ({t("common.seconds")})</span>
            <input className="s-input" type="number" min={5} max={120} value={slide.timeLimitS} onChange={(e) => patch({ timeLimitS: num(e.target.value, 20) })} />
          </label>
          {slide.mode === "game" && (
            <label className="h-field">
              <span>{t("host.pointsLabel")}</span>
              <input className="s-input" type="number" min={0} max={5000} step={100} value={slide.points} onChange={(e) => patch({ points: num(e.target.value, 1000) })} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
