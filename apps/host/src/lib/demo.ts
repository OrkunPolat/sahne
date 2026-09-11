"use client";
import type { Locale } from "@sahne/protocol";
import { createDemo } from "./api";
import { saveToRegistry } from "./registry";

/** POST /api/demo → kayıt defterine yaz → sunum yolu. Hem anasayfa butonu hem /demo rotası kullanır. */
export async function startDemo(locale: Locale): Promise<string> {
  const s = await createDemo(locale);
  saveToRegistry({ id: s.id, code: s.code, title: s.title, hostSecret: s.hostSecret, createdAt: Date.now(), isDemo: true });
  return `/s/${s.id}/present`;
}
