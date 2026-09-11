"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { startDemo } from "@/lib/demo";
import { useLocale, useT } from "@/lib/providers";

export function DemoButton({ className = "s-btn s-btn--lg" }: { className?: string }) {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    if (busy) return;
    setBusy(true); setError(null);
    try { router.push(await startDemo(locale)); }
    catch (e) { setError(e instanceof ApiError ? `${t("host.demoFailed")} (${e.code})` : t("host.demoFailed")); setBusy(false); }
  }
  return (
    <span className="h-demo">
      <button type="button" className={className} onClick={go} disabled={busy} aria-busy={busy}>
        {busy ? t("host.demoStarting") : `▶ ${t("host.tryNow")}`}
      </button>
      {error && <span className="h-error" role="alert">{error}</span>}
    </span>
  );
}
