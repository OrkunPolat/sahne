import { env } from "./env";
import { createServer } from "node:http";
import { deleteOldDemoSessions, pgPersistence } from "./db/repo";
import { DEMO_TTL_MS } from "./http/demo";
import { sql } from "./db/client";
import { Registry } from "./live/registry";
import { buildRouter } from "./http/routes";
import { attachWs } from "./ws/server";

const registry = new Registry(pgPersistence);
const server = createServer(buildRouter(registry));
const wss = attachWs(server, registry);

server.listen(env.PORT, () => console.log(`[realtime] http+ws on :${env.PORT} (ws path /ws)`));

// Demo oturumlar 2 saat sonra DB'den ve bellekten silinir.
const demoSweep = setInterval(async () => {
  try {
    const ids = await deleteOldDemoSessions(DEMO_TTL_MS);
    for (const id of ids) registry.evictById(id);
    if (ids.length) console.log(`[realtime] evicted ${ids.length} demo session(s)`);
  } catch (e) { console.error("[realtime] demo sweep", e); }
}, 5 * 60 * 1000);
demoSweep.unref();

async function shutdown() {
  console.log("[realtime] shutting down");
  clearInterval(demoSweep);
  registry.disposeAll();
  wss.close();
  server.close();
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
