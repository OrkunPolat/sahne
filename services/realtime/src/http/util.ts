import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZodTypeAny, z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-host-secret",
  "Access-Control-Max-Age": "86400",
};

export function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export function sendError(res: ServerResponse, e: unknown) {
  if (e instanceof HttpError) return json(res, e.status, { error: { code: e.code, message: e.message } });
  console.error("[http]", e);
  return json(res, 500, { error: { code: "internal", message: "Internal error" } });
}

export async function readBody<S extends ZodTypeAny>(req: IncomingMessage, schema: S, limit = 1_000_000): Promise<z.output<S>> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new HttpError(413, "too_large", "Body too large");
    chunks.push(c as Buffer);
  }
  let raw: unknown;
  try { raw = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }
  catch { throw new HttpError(422, "invalid_json", "Body is not valid JSON"); }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(422, "validation", r.error.issues.map((i) => `${i.path.join(".") || "$"}: ${i.message}`).join("; "));
  return r.data;
}
