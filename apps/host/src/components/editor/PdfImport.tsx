"use client";
import { useRef, useState } from "react";
import type { Slide } from "@sahne/protocol";
import { ApiError, importPdf } from "@/lib/api";
import { useLocale, useT } from "@/lib/providers";

const MAX_BYTES = 8 * 1024 * 1024;

/** "PDF'ten üret": dosya → base64 → POST import-pdf → slaytlar sona eklenir. */
export function PdfImport({ sessionId, secret, disabled, onSlides }: { sessionId: string; secret: string; disabled?: boolean; onSlides: (s: Slide[]) => void }) {
  const t = useT();
  const [locale] = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) { setMsg({ kind: "err", text: t("host.pdfTooLarge") }); return; }
    setBusy(true); setMsg(null);
    try {
      const pdfBase64 = await toBase64(file);
      const r = await importPdf(sessionId, secret, { pdfBase64, locale, mode: "mixed" });
      onSlides(r.slides);
      setMsg({ kind: "ok", text: t("host.pdfImported", { n: r.slides.length }) });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiError ? `${e.code}: ${e.message}` : String(e) });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="h-pdf">
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" className="s-btn" disabled={busy || disabled} onClick={() => input.current?.click()} aria-busy={busy}>
        {busy ? <><span className="h-spinner" aria-hidden /> {t("host.pdfImporting")}</> : `⇪ ${t("host.pdfImport")}`}
      </button>
      <span className="s-muted h-pdf__hint">{msg ? <span className={msg.kind === "err" ? "h-error" : undefined} role={msg.kind === "err" ? "alert" : undefined}>{msg.text}</span> : t("host.pdfImportHint")}</span>
    </div>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("read"));
    r.onload = () => { const s = String(r.result); resolve(s.slice(s.indexOf(",") + 1)); };
    r.readAsDataURL(file);
  });
}
