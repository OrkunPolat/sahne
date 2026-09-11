/**
 * Paylaşılabilir sonuç kartı: 1080×1920 offscreen canvas → PNG.
 * Avatar, @sahne/ui Avatar ile aynı hash/şekil kuralıyla çizilir; renkler CSS değişkenlerinden okunur.
 */
export interface CardData {
  appName: string;
  title: string;
  nickname: string;
  avatarSeed: string;
  rank: number | null;
  score: number | null;
  rankLabel: string;
  pointsLabel: string;
  teamName?: string | null;
  teamLabel?: string;
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Avatar.tsx ile birebir aynı geometri (viewBox 40 → scale). */
function drawAvatar(ctx: CanvasRenderingContext2D, seed: string, cx: number, cy: number, size: number) {
  const h = hash(seed);
  const hue = h % 360, hue2 = (hue + 60 + (h >> 8) % 120) % 360;
  const shape = (h >> 16) % 3;
  const s = size / 40;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.fillStyle = `hsl(${hue} 45% 35%)`;
  ctx.beginPath(); ctx.arc(20, 20, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `hsl(${hue2} 70% 60%)`;
  if (shape === 0) {
    ctx.beginPath(); ctx.arc(20, 20, 9, 0, Math.PI * 2); ctx.fill();
  } else if (shape === 1) {
    ctx.translate(20, 20); ctx.rotate(((h >> 20) % 45) * Math.PI / 180); ctx.translate(-20, -20);
    roundRect(ctx, 11, 11, 18, 18, 4); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(20, 9); ctx.lineTo(31, 29); ctx.lineTo(9, 29); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

export function renderResultCard(d: CardData): HTMLCanvasElement {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const bg = cssVar("--bg", "#0B1020");
  const elevated = cssVar("--bg-elevated", "#131A30");
  const fg = cssVar("--fg", "#F4EFE4");
  const muted = cssVar("--fg-muted", "#A6A9B8");
  const accent = cssVar("--accent", "#D4AF5A");
  const accentFg = cssVar("--accent-fg", "#14110A");
  const display = `"Bricolage Grotesque", "Instrument Sans", ui-sans-serif, system-ui, sans-serif`;
  const body = `Inter, ui-sans-serif, system-ui, sans-serif`;

  // zemin + ışık
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const g1 = ctx.createRadialGradient(160, -100, 0, 160, -100, 1100);
  g1.addColorStop(0, accent + "33"); g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W + 100, H + 100, 0, W + 100, H + 100, 1000);
  g2.addColorStop(0, accent + "22"); g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  // wordmark
  ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `800 64px ${display}`;
  ctx.fillText(d.appName, W / 2, 190);
  ctx.fillStyle = accent;
  roundRect(ctx, W / 2 - 40, 236, 80, 6, 3); ctx.fill();

  // kart
  ctx.fillStyle = elevated;
  ctx.shadowColor = accent + "55"; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
  roundRect(ctx, 90, 380, W - 180, 1180, 56); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = accent + "55"; ctx.lineWidth = 2;
  roundRect(ctx, 90, 380, W - 180, 1180, 56); ctx.stroke();

  // başlık (Türkçe İ/ı için yerel büyük harf)
  const lang = document.documentElement.lang || "tr";
  ctx.fillStyle = muted; ctx.font = `600 34px ${body}`;
  ctx.fillText(fitText(ctx, d.title.toLocaleUpperCase(lang), W - 300), W / 2, 470);

  // sıra
  if (d.rank !== null) {
    ctx.fillStyle = muted; ctx.font = `600 32px ${body}`;
    ctx.fillText(d.rankLabel.toLocaleUpperCase(lang), W / 2, 560);
    ctx.fillStyle = fg; ctx.font = `800 300px ${display}`;
    ctx.fillText(`${d.rank}.`, W / 2, 740);
  }
  if (d.score !== null) {
    ctx.fillStyle = accent; ctx.font = `800 84px ${display}`;
    ctx.fillText(`${d.score} ${d.pointsLabel}`, W / 2, 940);
  }

  // avatar + ad
  drawAvatar(ctx, d.avatarSeed, W / 2, 1150, 200);
  ctx.fillStyle = fg; ctx.font = `800 72px ${display}`;
  ctx.fillText(fitText(ctx, d.nickname, W - 300), W / 2, 1320);

  if (d.teamName) {
    ctx.font = `600 36px ${body}`;
    const label = `${d.teamLabel ? d.teamLabel + " · " : ""}${d.teamName}`;
    const tw = ctx.measureText(label).width + 80;
    ctx.fillStyle = accent; roundRect(ctx, W / 2 - tw / 2, 1400, tw, 76, 38); ctx.fill();
    ctx.fillStyle = accentFg; ctx.fillText(label, W / 2, 1439);
  }

  ctx.fillStyle = muted; ctx.font = `400 34px ${body}`;
  ctx.fillText("sahne", W / 2, 1720);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
}

/** Web Share Level 2 (dosya) varsa paylaş; yoksa false döner (indirme yoluna düş). */
export async function shareCard(blob: Blob, text: string): Promise<boolean> {
  const file = new File([blob], "sahne-sonuc.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], text }); return true; } catch { return true; /* kullanıcı iptal etti */ }
  }
  return false;
}
