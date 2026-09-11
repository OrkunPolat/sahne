// docs/API.md WS sözleşmesi. İlk mesaj join olmalı; sonrası role göre yönlendirilir.
import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { ClientMessage, type ServerMessage } from "@sahne/protocol";
import type { Registry } from "../live/registry";
import type { Client, LiveSession } from "../live/session";

const HEARTBEAT_MS = 25_000;

interface Conn { ws: WebSocket; client: Client; alive: boolean; role: "none" | "host" | "player"; session?: LiveSession }

function makeClient(ws: WebSocket): Client {
  return {
    send(m: ServerMessage) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); },
    close() { try { ws.close(); } catch { /* ignore */ } },
  };
}

export function attachWs(server: Server, registry: Registry) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const conns = new Set<Conn>();

  wss.on("connection", (ws) => {
    const conn: Conn = { ws, client: makeClient(ws), alive: true, role: "none" };
    conns.add(conn);
    ws.on("pong", () => { conn.alive = true; });
    ws.on("message", (raw) => { void handle(conn, raw.toString()); });
    ws.on("close", () => { conns.delete(conn); conn.session?.detach(conn.client); });
    ws.on("error", () => { /* close takes care */ });
  });

  const hb = setInterval(() => {
    for (const c of conns) {
      if (!c.alive) { c.ws.terminate(); continue; }
      c.alive = false;
      c.ws.ping();
    }
  }, HEARTBEAT_MS);
  wss.on("close", () => clearInterval(hb));

  async function handle(conn: Conn, raw: string) {
    const fail = (code: Parameters<typeof err>[1], message?: string, close = false) => { err(conn.client, code, message); if (close) conn.client.close(); };

    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return fail("invalid", "Not JSON", conn.role === "none"); }
    const r = ClientMessage.safeParse(parsed);
    if (!r.success) return fail("invalid", "Bad message", conn.role === "none");
    const msg = r.data;

    // İlk mesaj: join/resume zorunlu.
    if (conn.role === "none") {
      if (msg.t === "host:join") {
        const s = await registry.getOrLoad(msg.code);
        if (!s) return fail("bad_code", undefined, true);
        if (s.hostSecret !== msg.hostSecret) return fail("bad_secret", undefined, true);
        conn.role = "host"; conn.session = s; s.hostJoin(conn.client);
        return;
      }
      if (msg.t === "player:join") {
        const s = await registry.getOrLoad(msg.code);
        if (!s) return fail("bad_code", undefined, true);
        const res = s.playerJoin(conn.client, msg.nickname);
        if (!res.ok) return fail(res.code, undefined, true);
        conn.role = "player"; conn.session = s;
        return;
      }
      if (msg.t === "player:resume") {
        const s = registry.peek(msg.code) ?? (await registry.getOrLoad(msg.code));
        if (!s) return fail("bad_code", undefined, true);
        if (!s.playerResume(conn.client, msg.token)) return fail("invalid", "Unknown token", true);
        conn.role = "player"; conn.session = s;
        return;
      }
      return fail("invalid", "First message must be a join", true);
    }

    const s = conn.session!;
    if (conn.role === "host") {
      switch (msg.t) {
        case "host:start": case "host:next": case "host:prev": case "host:lock": case "host:reveal": case "host:end": {
          const action = msg.t.slice("host:".length) as "start" | "next" | "prev" | "lock" | "reveal" | "end";
          if (!s.hostAction(action)) fail("invalid", `Cannot ${action} now`);
          return;
        }
        case "host:kick": s.kick(msg.participantId); return;
        default: return fail("invalid", "Already joined");
      }
    }

    // player
    if (msg.t === "player:answer") {
      const pid = s.participantIdOf(conn.client);
      if (!pid) return fail("invalid");
      const code = s.playerAnswer(pid, msg.slideId, msg.value);
      if (code) fail(code);
      return;
    }
    return fail("invalid", "Not allowed for player");
  }

  return wss;
}

function err(c: Client, code: Extract<ServerMessage, { t: "error" }>["code"], message?: string) {
  c.send(message ? { t: "error", code, message } : { t: "error", code });
}
