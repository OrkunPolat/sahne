"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { ServerMessage, type ClientMessage, type FastestEntry, type LeaderboardEntry, type Reaction, type SessionSnapshot, type Tally, type TeamStanding } from "@sahne/protocol";
import { WS_URL } from "./api";

export type SocketStatus = "connecting" | "open" | "reconnecting" | "closed";
export type ErrorCode = Extract<ServerMessage, { t: "error" }>["code"];

export type HostState = {
  status: SocketStatus;
  snapshot: SessionSnapshot | null;
  clockOffset: number;
  tally: Tally | null;
  answeredCount: number;
  reveal: { slideId: string; correct: string[] | boolean | null; leaderboard: LeaderboardEntry[]; tally: Tally; fastest: FastestEntry[]; teams: TeamStanding[] } | null;
  podium: LeaderboardEntry[] | null;
  leaderboard: LeaderboardEntry[];
  /** Son reveal'deki takım sıralaması (oturum sonunda session:ended ile güncellenir). */
  teams: TeamStanding[];
  publicToken: string | null;
  /** Büyük ekranda uçan tepkiler; en son 40 tanesi tutulur, bileşen süresi dolanları eler. */
  reactions: FloatingReaction[];
  error: ErrorCode | null;
};
export type FloatingReaction = { id: number; emoji: Reaction; at: number; x: number };
const MAX_REACTIONS = 40;
let reactionSeq = 0;

type Action = { kind: "status"; status: SocketStatus } | { kind: "msg"; msg: ServerMessage };

const initial: HostState = {
  status: "connecting", snapshot: null, clockOffset: 0, tally: null, answeredCount: 0,
  reveal: null, podium: null, leaderboard: [], teams: [], publicToken: null, reactions: [], error: null,
};

function reduce(s: HostState, a: Action): HostState {
  if (a.kind === "status") return { ...s, status: a.status };
  const m = a.msg;
  switch (m.t) {
    case "state:snapshot": {
      const snap = m.snapshot;
      return {
        ...s, snapshot: snap, clockOffset: snap.serverNow - Date.now(), answeredCount: snap.answeredCount, error: null,
        // Yeniden bağlanmada slayt değiştiyse eski tally/reveal geçersiz.
        tally: s.snapshot && s.snapshot.currentSlideIdx === snap.currentSlideIdx ? s.tally : null,
        reveal: s.reveal && snap.slidePhase === "revealed" && snap.slides[snap.currentSlideIdx]?.id === s.reveal.slideId ? s.reveal : null,
        podium: snap.phase === "ended" ? s.podium : null,
        publicToken: snap.meta.publicToken ?? s.publicToken,
      };
    }
    case "participants:update":
      return s.snapshot ? { ...s, snapshot: { ...s.snapshot, participants: m.participants } } : s;
    case "slide:open": {
      if (!s.snapshot) return s;
      const slides = [...s.snapshot.slides];
      slides[m.idx] = m.slide;
      return {
        ...s, tally: null, reveal: null, answeredCount: 0, clockOffset: m.serverNow - Date.now(),
        snapshot: { ...s.snapshot, slides, phase: "live", currentSlideIdx: m.idx, slidePhase: "open", slideStartedAt: m.startedAt, serverNow: m.serverNow, answeredCount: 0 },
      };
    }
    case "slide:phase":
      return s.snapshot ? { ...s, snapshot: { ...s.snapshot, slidePhase: m.phase } } : s;
    case "slide:tally":
      return { ...s, tally: m.tally, answeredCount: m.answeredCount };
    case "slide:reveal": {
      const scores = new Map(m.leaderboard.map((e) => [e.participantId, e.score]));
      const participants = s.snapshot?.participants.map((p) => ({ ...p, score: scores.get(p.id) ?? p.score })) ?? [];
      return {
        ...s, tally: m.tally, leaderboard: m.leaderboard,
        reveal: { slideId: m.slideId, correct: m.correct, leaderboard: m.leaderboard, tally: m.tally, fastest: m.fastest, teams: m.teams },
        teams: m.teams.length > 0 ? m.teams : s.teams,
        snapshot: s.snapshot ? { ...s.snapshot, slidePhase: "revealed", participants } : s.snapshot,
      };
    }
    case "session:ended":
      return {
        ...s, podium: m.podium, teams: m.teams.length > 0 ? m.teams : s.teams, publicToken: m.publicToken ?? s.publicToken,
        snapshot: s.snapshot ? { ...s.snapshot, phase: "ended", meta: { ...s.snapshot.meta, publicToken: m.publicToken ?? s.snapshot.meta.publicToken } } : s.snapshot,
      };
    case "reaction": {
      const now = Date.now();
      const fresh = s.reactions.filter((r) => now - r.at < 2600);
      const next = [...fresh, { id: ++reactionSeq, emoji: m.emoji, at: now, x: Math.random() }];
      return { ...s, reactions: next.length > MAX_REACTIONS ? next.slice(next.length - MAX_REACTIONS) : next };
    }
    case "error":
      return { ...s, error: m.code };
    default:
      return s;
  }
}

const FATAL: ErrorCode[] = ["bad_code", "bad_secret", "session_ended"];

export function useHostSocket(code: string | null, secret: string | null) {
  const [state, dispatch] = useReducer(reduce, initial);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const stopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!code || !secret) return;
    stopRef.current = false;
    attemptRef.current = 0;

    const connect = () => {
      if (stopRef.current) return;
      dispatch({ kind: "status", status: attemptRef.current === 0 ? "connecting" : "reconnecting" });
      const ws = new WebSocket(`${WS_URL}/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        attemptRef.current = 0;
        dispatch({ kind: "status", status: "open" });
        ws.send(JSON.stringify({ t: "host:join", code, hostSecret: secret } satisfies ClientMessage));
      };
      ws.onmessage = (ev) => {
        let raw: unknown;
        try { raw = JSON.parse(String(ev.data)); } catch { return; }
        const parsed = ServerMessage.safeParse(raw);
        if (!parsed.success) return;
        dispatch({ kind: "msg", msg: parsed.data });
        if (parsed.data.t === "error" && FATAL.includes(parsed.data.code)) { stopRef.current = true; ws.close(); }
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (stopRef.current) { dispatch({ kind: "status", status: "closed" }); return; }
        attemptRef.current += 1;
        const delay = Math.min(10_000, 1000 * 2 ** Math.min(attemptRef.current - 1, 4));
        dispatch({ kind: "status", status: "reconnecting" });
        timerRef.current = setTimeout(connect, delay);
      };
      ws.onerror = () => { /* onclose takes over */ };
    };
    connect();

    return () => {
      stopRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [code, secret]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  return { state, send };
}
