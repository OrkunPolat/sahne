import { env } from "./env";
import { createServer } from "node:http";
import { pgPersistence } from "./db/repo";
import { sql } from "./db/client";
import { Registry } from "./live/registry";
import { buildRouter } from "./http/routes";
import { attachWs } from "./ws/server";

const registry = new Registry(pgPersistence);
const server = createServer(buildRouter(registry));
const wss = attachWs(server, registry);

server.listen(env.PORT, () => console.log(`[realtime] http+ws on :${env.PORT} (ws path /ws)`));

async function shutdown() {
  console.log("[realtime] shutting down");
  registry.disposeAll();
  wss.close();
  server.close();
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
