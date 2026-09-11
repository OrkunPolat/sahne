// Bellekteki canlı oturumlar: Map<code, LiveSession>. DB'de olup bellekte olmayan oturum lobby olarak yüklenir.
import { LiveSession } from "./session";
import type { Persistence } from "./persistence";
import { getSessionByCode, getSlides, rowToMeta } from "../db/repo";

const EVICT_AFTER_MS = 10 * 60 * 1000;

export class Registry {
  private byCode = new Map<string, LiveSession>();
  private byId = new Map<string, LiveSession>();
  private loading = new Map<string, Promise<LiveSession | undefined>>();

  constructor(private readonly persist: Persistence) {}

  peek(code: string): LiveSession | undefined { return this.byCode.get(code); }
  peekById(id: string): LiveSession | undefined { return this.byId.get(id); }

  /** Bellekte yoksa DB'den yükler; ended ise yüklemez (undefined). Eşzamanlı yüklemeler tekilleştirilir. */
  async getOrLoad(code: string): Promise<LiveSession | undefined> {
    const hit = this.byCode.get(code);
    if (hit) return hit;
    let p = this.loading.get(code);
    if (!p) {
      p = this.load(code).finally(() => this.loading.delete(code));
      this.loading.set(code, p);
    }
    return p;
  }

  private async load(code: string): Promise<LiveSession | undefined> {
    const row = await getSessionByCode(code);
    if (!row || row.state === "ended") return undefined;
    const slides = await getSlides(row.id);
    const s = new LiveSession(rowToMeta(row), slides, row.hostSecret, this.persist, { onEnded: (x) => this.scheduleEvict(x) });
    if (row.state === "live") {
      // Sunucu yeniden başlamış: canlı durum kayboldu, lobby'den devam (deneme kapsamı).
      this.persist.setState(row.id, "lobby", -1).catch(() => {});
    }
    this.byCode.set(code, s); this.byId.set(row.id, s);
    return s;
  }

  private scheduleEvict(s: LiveSession) {
    const t = setTimeout(() => {
      if (this.byCode.get(s.meta.code) === s) this.byCode.delete(s.meta.code);
      if (this.byId.get(s.meta.id) === s) this.byId.delete(s.meta.id);
      s.dispose();
    }, EVICT_AFTER_MS);
    t.unref?.();
  }

  disposeAll() { for (const s of this.byCode.values()) s.dispose(); this.byCode.clear(); this.byId.clear(); }
}
