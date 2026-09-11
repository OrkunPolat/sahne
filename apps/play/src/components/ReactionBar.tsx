import { useEffect, useRef, useState } from "react";
import { REACTION_EMOJIS, type Reaction } from "@sahne/protocol";
import { useI18n } from "../lib/i18n";

export interface FloatingReaction { id: number; emoji: Reaction; mine?: boolean }

interface Props {
  onReact: (emoji: Reaction) => void;
  /** Gelen `reaction` yayınları (App'ten). Her yeni kayıt bardan yukarı süzülür. */
  incoming: FloatingReaction[];
}

const MIN_GAP_MS = 500; // istemci tarafı 2/sn

export function ReactionBar({ onReact, incoming }: Props) {
  const { t } = useI18n();
  const lastRef = useRef(0);
  const [popped, setPopped] = useState<Reaction | null>(null);
  const [floats, setFloats] = useState<(FloatingReaction & { x: number; rot: number; at: number })[]>([]);
  const seen = useRef(0);

  useEffect(() => {
    const fresh = incoming.filter((r) => r.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1]!.id;
    const at = Date.now();
    setFloats((f) => [...f, ...fresh.map((r) => ({ ...r, at, x: 8 + Math.random() * 84, rot: -20 + Math.random() * 40 }))].slice(-24));
  }, [incoming]);

  // Animasyon süresi dolanları temizle (her batch için ayrı timer yerine tek süpürücü).
  useEffect(() => {
    if (!floats.length) return;
    const id = setInterval(() => setFloats((f) => f.filter((x) => Date.now() - x.at < 1800)), 300);
    return () => clearInterval(id);
  }, [floats.length]);

  const tap = (emoji: Reaction) => {
    const now = Date.now();
    if (now - lastRef.current < MIN_GAP_MS) return;
    lastRef.current = now;
    setPopped(emoji);
    setTimeout(() => setPopped((p) => (p === emoji ? null : p)), 260);
    try { navigator.vibrate?.(8); } catch { /* ignore */ }
    onReact(emoji);
  };

  return (
    <div className="p-react" role="group" aria-label={t("play.reactAria")}>
      <div className="p-react__floats" aria-hidden>
        {floats.map((f) => (
          <span key={f.id} className={`p-react__float ${f.mine ? "p-react__float--mine" : ""}`} style={{ left: `${f.x}%`, ["--rot" as string]: `${f.rot}deg` }}>{f.emoji}</span>
        ))}
      </div>
      <div className="p-react__bar">
        {REACTION_EMOJIS.map((e) => (
          <button key={e} type="button" className={`p-react__btn ${popped === e ? "p-react__btn--pop" : ""}`} onClick={() => tap(e)} aria-label={`${t("play.reactAria")} ${e}`}>{e}</button>
        ))}
      </div>
    </div>
  );
}
