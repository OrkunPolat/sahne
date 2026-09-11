"use client";
import { useEffect, useState } from "react";
import { isSoundMuted, setSoundMuted } from "@/lib/sound";
import { useT } from "@/lib/providers";

export function SoundToggle() {
  const t = useT();
  const [muted, setMuted] = useState(false);
  useEffect(() => { setMuted(isSoundMuted()); }, []);
  const toggle = () => { const next = !muted; setSoundMuted(next); setMuted(next); };
  return (
    <button type="button" className="s-btn s-btn--ghost p-sound" onClick={toggle} aria-pressed={!muted} aria-label={muted ? t("host.soundOff") : t("host.soundOn")} title={muted ? t("host.soundOff") : t("host.soundOn")}>
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
