// Turnuva rotalarının saf parçaları (test edilebilir): slug üretimi, oyun doğrulama, bellek içi hız sınırı.
import { nanoid } from "nanoid";
import type { BracketPlay, TournamentItem, TournamentItemStat } from "@sahne/protocol";
import { playToStatDeltas, validatePlay } from "@sahne/engine";

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u" };

/** Başlık → slug gövdesi: Türkçe harfler çevrilir, küçük harf, alfanümerik dışı '-' , kırpılır. Ek yok. */
export function slugBase(title: string): string {
  const translit = title.replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => TR_MAP[c] ?? c);
  return translit.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "") || "turnuva";
}

/** `slugBase(title)-xxxxx` (nanoid(5)). */
export function makeSlug(title: string, id: () => string = () => nanoid(5)): string {
  return `${slugBase(title)}-${id()}`;
}

export type PlayCheck = { ok: true; deltas: Map<string, TournamentItemStat> } | { ok: false; code: "invalid_play"; message: string };

/** POST /plays'in saf çekirdeği: item id'ler turnuvada olmalı, sonuç ağacı tutarlı olmalı; delta'lar hesaplanır. */
export function checkPlay(play: BracketPlay, items: TournamentItem[]): PlayCheck {
  const ids = new Set(items.map((i) => i.id));
  if (play.size > items.length) return { ok: false, code: "invalid_play", message: "size exceeds item count" };
  if (!ids.has(play.championId)) return { ok: false, code: "invalid_play", message: "championId is not a tournament item" };
  if (!validatePlay(play, ids)) return { ok: false, code: "invalid_play", message: "results are not a consistent bracket" };
  return { ok: true, deltas: playToStatDeltas(play) };
}

/** Basit bellek içi sabit pencere sınırlayıcı (deneme kapsamı; tek süreç). */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly max: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {}

  /** true → izin verildi (sayaç arttı). */
  allow(key: string): boolean {
    const t = this.now();
    let h = this.hits.get(key);
    if (!h || h.resetAt <= t) { h = { count: 0, resetAt: t + this.windowMs }; this.hits.set(key, h); }
    if (h.count >= this.max) return false;
    h.count++;
    if (this.hits.size > 10_000) this.sweep(t);
    return true;
  }

  private sweep(t: number) { for (const [k, h] of this.hits) if (h.resetAt <= t) this.hits.delete(k); }
}
