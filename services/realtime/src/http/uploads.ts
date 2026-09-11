// POST /api/uploads: multipart `file` → sharp (≤1200px, webp q82) → Supabase Storage `media` → { url }.
import type { IncomingMessage } from "node:http";
import busboy from "busboy";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { HttpError } from "./util";
import { uploadObject } from "./storage";

export const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_DIM = 1200;
const WEBP_QUALITY = 82;

/** multipart gövdesinden `file` alanını okur (express yok; busboy). Boyut/mime sınırları burada. */
export function readUploadFile(req: IncomingMessage): Promise<{ buffer: Buffer; mime: string }> {
  return new Promise((resolve, reject) => {
    let bb: busboy.Busboy;
    try {
      bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: UPLOAD_MAX_BYTES, fields: 5, fieldSize: 1024 } });
    } catch {
      return reject(new HttpError(422, "validation", "Expected multipart/form-data"));
    }
    let found = false;
    let done = false;
    const finish = (err?: HttpError, val?: { buffer: Buffer; mime: string }) => {
      if (done) return; done = true;
      if (err) { req.unpipe(bb); req.resume(); reject(err); } else resolve(val!);
    };
    bb.on("file", (name, stream, info) => {
      if (name !== "file" || found) { stream.resume(); return; }
      found = true;
      if (!ALLOWED.has(info.mimeType)) { stream.resume(); return finish(new HttpError(422, "validation", "file must be image/jpeg|png|webp|gif")); }
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("limit", () => finish(new HttpError(413, "too_large", "file exceeds 3 MB")));
      stream.on("end", () => { if (!done && !(stream as unknown as { truncated?: boolean }).truncated) finish(undefined, { buffer: Buffer.concat(chunks), mime: info.mimeType }); });
    });
    bb.on("error", () => finish(new HttpError(422, "validation", "Malformed multipart body")));
    bb.on("finish", () => { if (!found) finish(new HttpError(422, "validation", "Missing `file` field")); });
    req.pipe(bb);
  });
}

/** Görseli 1200px'e sığdırır (büyütmez) ve webp'ye çevirir. Bozuk görsel → 422. */
export async function processImage(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { animated: false }).rotate().resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer();
  } catch {
    throw new HttpError(422, "validation", "file is not a decodable image");
  }
}

export function uploadPath(now = new Date()): string {
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `t/${ym}/${nanoid(12)}.webp`;
}

export async function handleUpload(req: IncomingMessage): Promise<{ url: string }> {
  const { buffer } = await readUploadFile(req);
  const webp = await processImage(buffer);
  const url = await uploadObject(uploadPath(), webp, "image/webp");
  return { url };
}
