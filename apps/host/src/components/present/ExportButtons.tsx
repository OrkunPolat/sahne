"use client";
import { useState } from "react";
import { getResults } from "@/lib/api";
import { downloadText, resultsToCsv } from "@/lib/export";
import { useT } from "@/lib/providers";

export function ExportButtons({ sessionId, secret, title }: { sessionId: string; secret: string; title: string }) {
  const t = useT();
  const [busy, setBusy] = useState<"csv" | "json" | null>(null);
  const safe = title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "sahne";
  async function exp(kind: "csv" | "json") {
    setBusy(kind);
    try {
      const r = await getResults(sessionId, secret);
      if (kind === "csv") downloadText(`${safe}.csv`, resultsToCsv(r), "text/csv;charset=utf-8");
      else downloadText(`${safe}.json`, JSON.stringify(r, null, 2), "application/json");
    } finally { setBusy(null); }
  }
  return (
    <>
      <button type="button" className="s-btn" onClick={() => exp("csv")} disabled={busy !== null}>↓ {t("host.exportCsv")}</button>
      <button type="button" className="s-btn" onClick={() => exp("json")} disabled={busy !== null}>↓ {t("host.exportJson")}</button>
    </>
  );
}
