import type { Results } from "./api";

/** Sonuçları CSV'ye çevirir: bir bölüm liderlik, sonra slayt başına tally. Excel için UTF-8 BOM. */
export function resultsToCsv(r: Results): string {
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows: string[][] = [["section", "key", "label", "value"]];
  for (const e of r.leaderboard) rows.push(["leaderboard", String(e.rank), e.nickname, String(e.score)]);
  for (const { slide, tally } of r.slides) {
    const key = `${slide.idx + 1}`;
    switch (tally.kind) {
      case "choice":
        if (slide.type === "multiple_choice") for (const o of slide.options) rows.push([`slide ${key}`, slide.text, o.text, String(tally.counts[o.id] ?? 0)]);
        break;
      case "bool": rows.push([`slide ${key}`, slide.text, "true", String(tally.counts.true)], [`slide ${key}`, slide.text, "false", String(tally.counts.false)]); break;
      case "words": for (const w of tally.words) rows.push([`slide ${key}`, slide.text, w.text, String(w.count)]); break;
      case "text": for (const e of tally.entries) rows.push([`slide ${key}`, slide.text, e.text, new Date(e.at).toISOString()]); break;
      case "scale": for (const [k, v] of Object.entries(tally.counts)) rows.push([`slide ${key}`, slide.text, k, String(v)]); rows.push([`slide ${key}`, slide.text, "avg", String(tally.avg)]); break;
    }
  }
  return "﻿" + rows.map((row) => row.map(esc).join(",")).join("\n");
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
