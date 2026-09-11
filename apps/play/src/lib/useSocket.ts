import { useEffect, useRef, useState } from "react";
import { ClientMessage, ServerMessage } from "@sahne/protocol";

export type SocketStatus = "idle" | "connecting" | "open" | "reconnecting";

interface Options {
  url: string;
  /** false → bağlantı kapatılır ve yeniden bağlanma durur. */
  enabled: boolean;
  /** Bağlanır bağlanmaz gönderilecek ilk mesaj (join/resume). null → bağlanma. */
  hello: () => ClientMessage | null;
  onMessage: (m: ServerMessage) => void;
  onInvalid?: (raw: unknown) => void;
}

const BACKOFF_BASE_MS = 600;
const BACKOFF_MAX_MS = 10_000;

export function useSocket({ url, enabled, hello, onMessage, onInvalid }: Options) {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const helloRef = useRef(hello);
  const onMessageRef = useRef(onMessage);
  const onInvalidRef = useRef(onInvalid);
  helloRef.current = hello;
  onMessageRef.current = onMessage;
  onInvalidRef.current = onInvalid;

  useEffect(() => {
    if (!enabled) { setStatus("idle"); return; }
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (closed) return;
      const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt) * (0.8 + Math.random() * 0.4);
      attempt += 1;
      setStatus("reconnecting");
      timer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (closed) return;
      const first = helloRef.current();
      if (!first) { setStatus("idle"); return; }
      setStatus(attempt === 0 ? "connecting" : "reconnecting");
      let ws: WebSocket;
      try { ws = new WebSocket(url); } catch { schedule(); return; }
      wsRef.current = ws;

      ws.onopen = () => {
        if (closed) { ws.close(); return; }
        ws.send(JSON.stringify(first));
        attempt = 0;
        setStatus("open");
      };
      ws.onmessage = (ev) => {
        let raw: unknown;
        try { raw = JSON.parse(String(ev.data)); } catch { onInvalidRef.current?.(ev.data); return; }
        const parsed = ServerMessage.safeParse(raw);
        if (parsed.success) onMessageRef.current(parsed.data);
        else onInvalidRef.current?.(raw);
      };
      ws.onerror = () => { /* onclose takip eder */ };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (!closed) schedule();
      };
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && !closed && !wsRef.current && timer) {
        clearTimeout(timer); timer = null; connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    connect();

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) { ws.onclose = null; ws.onmessage = null; ws.close(); }
      setStatus("idle");
    };
  }, [url, enabled]);

  const send = (m: ClientMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(m));
    return true;
  };

  return { status, send };
}
