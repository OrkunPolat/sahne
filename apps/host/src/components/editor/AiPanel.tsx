"use client";
import { useEffect, useState } from "react";
import type { Slide } from "@sahne/protocol";
import { ApiError, generateSlides, getHealth } from "@/lib/api";
import { useLocale, useT } from "@/lib/providers";

export function AiPanel({ sessionId, secret, onSlides }: { sessionId: string; secret: string; onSlides: (s: Slide[]) => void }) {
  const t = useT();
  const [locale] = useLocale();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<"game" | "insight" | "mixed">("mixed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getHealth().then((h) => setEnabled(h.ai)).catch(() => setEnabled(false)); }, []);

  async function run() {
    setBusy(true); setError(null);
    try {
      const r = await generateSlides(sessionId, secret, { prompt, count, locale, mode });
      onSlides(r.slides);
      setPrompt("");
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally { setBusy(false); }
  }

  if (enabled === null) return null;
  return (
    <div className="s-card" style={{ padding: 18, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <strong>✦ {t("host.aiGenerate")}</strong>
        <span className="s-muted" style={{ fontSize: ".85rem" }}>{enabled ? t("host.aiAppend") : t("host.aiDisabled")}</span>
      </div>
      {enabled && (
        <>
          <label className="s-muted" style={{ fontSize: ".85rem" }}>{t("host.aiPrompt")}</label>
          <input className="s-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("host.aiPromptPlaceholder")} maxLength={500} disabled={busy} />
          <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="s-muted" style={{ fontSize: ".85rem" }}>{t("host.aiCount")}</span>
              <input className="s-input" type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} style={{ width: 90 }} disabled={busy} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="s-muted" style={{ fontSize: ".85rem" }}>{t("host.aiMode")}</span>
              <select className="s-input" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} disabled={busy}>
                <option value="mixed">{t("host.aiMixed")}</option>
                <option value="game">{t("mode.game")}</option>
                <option value="insight">{t("mode.insight")}</option>
              </select>
            </label>
            <span style={{ flex: 1 }} />
            <button type="button" className="s-btn s-btn--primary" onClick={run} disabled={busy || prompt.trim().length < 3}>
              {busy ? t("host.generating") : `✦ ${t("host.aiGenerate")}`}
            </button>
          </div>
          {error && <div className="h-errors" role="alert">{error}</div>}
        </>
      )}
    </div>
  );
}
