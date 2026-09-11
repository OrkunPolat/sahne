// Supabase Storage (bucket `media`, public) — REST üzerinden; SDK yok. Anahtar asla loglanmaz.
import { env } from "../env";

export const MEDIA_BUCKET = "media";

export function storageEnabled(): boolean { return !!env.SUPABASE_URL && !!env.SUPABASE_SERVICE_KEY; }

function headers(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, ...extra };
}

let bucketReady: Promise<void> | null = null;

/** Bucket yoksa public olarak oluşturur; sonuç süreç ömrünce hatırlanır (hata olursa bir sonraki çağrı tekrar dener). */
export function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const get = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket/${MEDIA_BUCKET}`, { headers: headers() });
      if (get.ok) return;
      if (get.status !== 404 && get.status !== 400) throw new Error(`storage bucket lookup failed: ${get.status}`);
      const create = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: MEDIA_BUCKET, name: MEDIA_BUCKET, public: true }),
      });
      if (!create.ok && create.status !== 409) throw new Error(`storage bucket create failed: ${create.status} ${await create.text().catch(() => "")}`);
    })().catch((e) => { bucketReady = null; throw e; });
  }
  return bucketReady;
}

export function publicUrl(path: string): string {
  return `${env.SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** `path` bucket içi yol (ör. t/2026-09/abc.webp). Döner: herkese açık URL. */
export async function uploadObject(path: string, body: Buffer, contentType: string): Promise<string> {
  await ensureBucket();
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": "false", "cache-control": "public, max-age=31536000, immutable" }),
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status} ${await res.text().catch(() => "")}`);
  return publicUrl(path);
}
