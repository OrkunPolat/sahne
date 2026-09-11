// Ortam değişkenleri repo kökündeki .env'den yüklenir (services/realtime → ../../.env).
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(pkgDir, "../../.env") });

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://sahne:sahne@localhost:5433/sahne",
  PORT: Number(process.env.REALTIME_PORT ?? process.env.PORT ?? 4100),
};
