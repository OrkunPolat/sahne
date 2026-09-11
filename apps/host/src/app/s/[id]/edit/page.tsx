"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { SessionMeta, SessionPhase, Slide, SlideType } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { ApiError, getSession, putSlides, PLAY_URL } from "@/lib/api";
import { findInRegistry, type HostSession } from "@/lib/registry";
import { JoinQr } from "@/components/JoinQr";
import { AiPanel } from "@/components/editor/AiPanel";
import { PdfImport } from "@/components/editor/PdfImport";
import { SettingsCard } from "@/components/editor/SettingsCard";
import { SlideList } from "@/components/editor/SlideList";
import { SlideForm } from "@/components/editor/SlideForm";
import { newSlide, reindex, validateSlides } from "@/components/editor/slides";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [reg, setReg] = useState<HostSession | null | undefined>(undefined);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [phase, setPhase] = useState<SessionPhase | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);

  useEffect(() => { setReg(findInRegistry(id) ?? null); }, [id]);

  useEffect(() => {
    if (!reg) return;
    let alive = true;
    getSession(reg.id, reg.hostSecret)
      .then((r) => { if (!alive) return; setMeta(r.meta); setPhase(r.phase); setSlides(r.slides); setSelected(r.slides[0]?.id ?? null); })
      .catch((e: unknown) => { if (alive) setLoadError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)); });
    return () => { alive = false; };
  }, [reg]);

  const mutate = useCallback((fn: (prev: Slide[]) => Slide[]) => { setSlides((p) => reindex(fn(p))); setDirty(true); setSaved(false); }, []);

  const onAdd = (type: SlideType) => {
    const s = newSlide(type, slides.length, (n) => t("host.option", { n }));
    mutate((p) => [...p, s]);
    setSelected(s.id);
  };
  const onMove = (sid: string, dir: -1 | 1) => mutate((p) => {
    const i = p.findIndex((s) => s.id === sid); const j = i + dir;
    if (i < 0 || j < 0 || j >= p.length) return p;
    const next = [...p]; [next[i], next[j]] = [next[j]!, next[i]!]; return next;
  });
  const onDelete = (sid: string) => {
    mutate((p) => p.filter((s) => s.id !== sid));
    if (selected === sid) setSelected(null);
  };
  const onChange = (next: Slide) => mutate((p) => p.map((s) => (s.id === next.id ? next : s)));

  async function onSave() {
    if (!reg) return;
    const v = validateSlides(slides);
    if (!v.ok) { setErrors(v.errors); return; }
    setErrors([]); setSaving(true);
    try {
      const r = await putSlides(reg.id, reg.hostSecret, v.slides);
      setSlides(r.slides); setDirty(false); setSaved(true);
    } catch (e) {
      setErrors([e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)]);
    } finally { setSaving(false); }
  }

  async function copy(kind: "link" | "embed") {
    const playUrl = `${PLAY_URL}?code=${reg?.code ?? ""}`;
    const text = kind === "link" ? playUrl : `<iframe src="${playUrl}" width="420" height="720" style="border:0;border-radius:16px"></iframe>`;
    try { await navigator.clipboard.writeText(text); setCopied(kind); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  }

  if (reg === undefined) return <main className="h-page"><p className="s-muted">{t("common.loading")}</p></main>;
  if (reg === null) {
    return (
      <main className="h-page">
        <div className="s-card h-notice"><p>{t("error.bad_secret")}</p><p className="s-muted">{t("host.secretHint")}</p>
          <Link className="s-btn" href="/">{t("host.mySessions")}</Link></div>
      </main>
    );
  }

  const current = slides.find((s) => s.id === selected) ?? null;
  const code = meta?.code ?? reg.code;
  const playHost = PLAY_URL.replace(/^https?:\/\//, "");

  return (
    <main className="h-page">
      <div className="h-editor-head s-fade-in">
        <div>
          <p className="s-muted" style={{ marginBottom: 6 }}>{t("host.editor")}{(meta?.isDemo || reg.isDemo) && <span className="h-demo-badge">{t("host.demoBadge")}</span>}</p>
          <h1>{meta?.title ?? reg.title}</h1>
        </div>
        <div className="s-card h-join">
          <div>
            <div className="url">{t("host.joinAt")} <b>{playHost}</b> · {t("host.enterCode")}</div>
            <div className="h-code code">{code}</div>
          </div>
          <JoinQr url={`${PLAY_URL}/?code=${meta?.code ?? reg.code}`} size={96} />
          <div className="h-actions" style={{ flexDirection: "column" }}>
            <button type="button" className="s-btn" onClick={() => copy("link")}>{copied === "link" ? `✓ ${t("host.copied")}` : `⧉ ${t("host.copyLink")}`}</button>
            <button type="button" className="s-btn" onClick={() => copy("embed")} title="<iframe>">{copied === "embed" ? `✓ ${t("host.embedCopied")}` : `‹› ${t("host.embed")}`}</button>
          </div>
          <Link className="s-btn s-btn--primary s-btn--lg" href={`/s/${reg.id}/present`}>{t("host.present")} →</Link>
        </div>
      </div>

      {loadError && <div className="s-card h-notice" style={{ marginBottom: 20 }}><p className="h-error">{loadError}</p><p className="s-muted">{t("common.disconnected")}</p></div>}
      {phase === "live" && <div className="s-card h-notice" style={{ marginBottom: 20 }}>{t("host.sessionLiveReadonly")}</div>}

      <div className="h-editor">
        <SlideList slides={slides} selectedId={selected} onSelect={setSelected} onMove={onMove} onDelete={onDelete} onAdd={onAdd} />
        <div style={{ display: "grid", gap: 16 }}>
          {current ? <SlideForm key={current.id} slide={current} onChange={onChange} /> : <div className="s-card h-empty">{t("host.addSlide")}</div>}
          {errors.length > 0 && <div className="h-errors" role="alert">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
          {phase !== "live" && !loadError && (
            <>
              <AiPanel sessionId={reg.id} secret={reg.hostSecret} onSlides={(gen) => { mutate((prev) => [...prev, ...gen]); setSelected(gen[0]?.id ?? null); }} />
              <PdfImport sessionId={reg.id} secret={reg.hostSecret} onSlides={(gen) => { mutate((prev) => [...prev, ...gen]); setSelected(gen[0]?.id ?? null); }} />
            </>
          )}
          {!loadError && <SettingsCard sessionId={reg.id} secret={reg.hostSecret} meta={meta} readOnly={phase === "live"} onSaved={setMeta} />}
          <div className="h-actions" style={{ justifyContent: "flex-end", alignItems: "center" }}>
            {saved && !dirty && <span className="s-chip">✓ {t("host.saved")}</span>}
            <button type="button" className="s-btn s-btn--primary s-btn--lg" onClick={onSave} disabled={saving || !!loadError}>
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
