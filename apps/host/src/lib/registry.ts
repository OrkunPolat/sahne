"use client";

export type HostSession = { id: string; code: string; title: string; hostSecret: string; createdAt: number };

const KEY = "sahne.hostSessions";

export function readRegistry(): HostSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as HostSession[]) : [];
  } catch {
    return [];
  }
}

export function saveToRegistry(s: HostSession) {
  const list = readRegistry().filter((x) => x.id !== s.id);
  list.unshift(s);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function removeFromRegistry(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(readRegistry().filter((x) => x.id !== id))); } catch { /* ignore */ }
}

export function findInRegistry(id: string): HostSession | undefined {
  return readRegistry().find((x) => x.id === id);
}
