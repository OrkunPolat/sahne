"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { aiGenerate, ApiError, createSession, getHealth, putSlides, type AiBody } from "@/lib/api";
import { saveToRegistry } from "@/lib/registry";
import { useLocale, useT } from "@/lib/providers";

/** Anasayfa: konu → AI slaytları → yeni oturum → düzenleyici. AI kapalıysa kart kalır, sessiz bir not gösterir. */
export function AiCard() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<AiBody["mode"]>("mixed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getHealth().then((h) => setEnabled(h.ai === true)).catch(() => setEnabled(false)); }, []);

  async function run() {
    if (busy || prompt.trim().length < 3) return;
    setBusy(true); setError(null);
    try {
      const gen = await aiGenerate({ prompt: prompt.trim(), count, locale, mode });
      const s = await createSession({ title: prompt.trim().slice(0, 60), localeDefault: locale });
      saveToRegistry({ id: s.id, code: s.code, title: s.title, hostSecret: s.hostSecret, createdAt: Date.now() });
      await putSlides(s.id, s.hostSecret, gen.slides.map((sl, idx) => ({ ...sl, idx })));
      router.push(`/s/${s.id}/edit`);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
      setBusy(false);
    }
  }

  const off = enabled === false;
  return (
    <section className={`s-card s-card--glow h-ai${off ? " h-ai--off" : ""}`} aria-labelledby="ai-title">
      <div className="h-ai__head">
        <span className="h-ai__spark" aria-hidden>✦</span>
        <div>
          <h2 id="ai-title">{t("host.aiHomeTitle")}</h2>
          <p className="s-muted">{t("host.aiHomeLead")}</p>
        </div>
        {off && <span className="s-chip h-ai__off" title={t("host.aiOffHint")}>{t("host.aiOff")}</span>}
      </div>
      <textarea className="s-input h-ai__prompt" rows={2} value={prompt} maxLength={500} disabled={off || busy}
        placeholder={t("host.aiPromptPlaceholder")} onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }} />
      <div className="h-ai__row">
        <label>
          <span className="s-muted">{t("host.aiCount")}</span>
          <input className="s-input" type="number" min={1} max={10} value={count} disabled={off || busy} onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
        </label>
        <label>
          <span className="s-muted">{t("host.aiMode")}</span>
          <select className="s-input h-select" value={mode} disabled={off || busy} onChange={(e) => setMode(e.target.value as AiBody["mode"])}>
            <option value="mixed">{t("host.aiMixed")}</option>
            <option value="game">{t("mode.game")}</option>
            <option value="insight">{t("mode.insight")}</option>
          </select>
        </label>
        <span className="spacer" />
        <button type="button" className="s-btn s-btn--primary s-btn--lg" onClick={run} disabled={off || busy || prompt.trim().length < 3}>
          {busy ? t("host.generating") : `✦ ${t("host.aiCreate")}`}
        </button>
      </div>
      {off && <p className="s-muted h-ai__note">{t("host.aiOffHint")}</p>}
      {error && <p className="h-error" role="alert">{error}</p>}
    </section>
  );
}
