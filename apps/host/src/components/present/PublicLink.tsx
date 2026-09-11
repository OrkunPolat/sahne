"use client";
import { useState } from "react";
import { hostOrigin } from "@/lib/api";
import { useT } from "@/lib/providers";

/** Oturum bitince gelen publicToken → HOST_ORIGIN/r/<token>; kopyala butonu. */
export function PublicLink({ token }: { token: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const url = `${hostOrigin()}/r/${token}`;
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }
  return (
    <div className="s-card p-public s-fade-in">
      <span className="s-muted">🔗 {t("host.publicLink")}</span>
      <a href={url} target="_blank" rel="noreferrer" className="p-public__url">{url.replace(/^https?:\/\//, "")}</a>
      <button type="button" className="s-btn" onClick={copy}>{copied ? `✓ ${t("host.copied")}` : `⧉ ${t("host.copyLink")}`}</button>
    </div>
  );
}
