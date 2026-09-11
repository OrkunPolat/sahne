import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** `next build` ile `next dev` aynı klasörü paylaşmasın; build çalışan dev sunucusunu bozmasın. */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@sahne/ui", "@sahne/protocol", "@sahne/i18n", "@sahne/engine"],
};

export default nextConfig;
