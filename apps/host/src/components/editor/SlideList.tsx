"use client";

import { useState } from "react";
import type { Slide, SlideType } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { SLIDE_TYPES } from "./slides";

const GAME_CAPABLE: Record<SlideType, "insight" | "game" | "both"> = {
  title: "insight", multiple_choice: "both", true_false: "game", word_cloud: "insight", open_ended: "insight", scale: "insight",
};

export function ModeBadge({ mode }: { mode: Slide["mode"] }) {
  const t = useT();
  return <span className={`h-badge${mode === "game" ? " h-badge--game" : ""}`}>{t(`mode.${mode}`)}</span>;
}

export function SlideList({
  slides, selectedId, onSelect, onMove, onDelete, onAdd,
}: {
  slides: Slide[]; selectedId: string | null;
  onSelect: (id: string) => void; onMove: (id: string, dir: -1 | 1) => void; onDelete: (id: string) => void; onAdd: (type: SlideType) => void;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  return (
    <div className="s-card h-slides">
      {slides.length === 0 && <div className="h-empty">{t("host.addSlide")}</div>}
      {slides.map((s, i) => (
        <div key={s.id} className="h-slide-row" aria-current={s.id === selectedId} onClick={() => onSelect(s.id)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") onSelect(s.id); }}>
          <span className="n">{i + 1}</span>
          <span className="txt">{s.text || t(`slideType.${s.type}`)}</span>
          <ModeBadge mode={s.mode} />
          <span className="ops" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="h-icon" disabled={i === 0} onClick={() => onMove(s.id, -1)} aria-label="↑">↑</button>
            <button type="button" className="h-icon" disabled={i === slides.length - 1} onClick={() => onMove(s.id, 1)} aria-label="↓">↓</button>
            <button type="button" className="h-icon" onClick={() => onDelete(s.id)} aria-label={t("common.delete")}>✕</button>
          </span>
        </div>
      ))}
      {picking ? (
        <div className="h-type-picker">
          {SLIDE_TYPES.map((type) => {
            const cap = GAME_CAPABLE[type];
            return (
              <button key={type} type="button" onClick={() => { onAdd(type); setPicking(false); }}>
                <strong>{t(`slideType.${type}`)}</strong>
                <small>{cap === "both" ? `${t("mode.insight")} · ${t("mode.game")}` : t(`mode.${cap}`)}</small>
              </button>
            );
          })}
          <button type="button" onClick={() => setPicking(false)} style={{ gridColumn: "1 / -1", textAlign: "center" }}>{t("common.cancel")}</button>
        </div>
      ) : (
        <button type="button" className="s-btn" onClick={() => setPicking(true)}>+ {t("host.addSlide")}</button>
      )}
    </div>
  );
}
