import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** `next build` ile `next dev` aynı klasörü paylaşmasın; build çalışan dev sunucusunu bozmasın. */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  /** Katılımcı uygulaması ayrı deploy; tek domain için /join → play. */
  async rewrites() {
    const play = process.env.PLAY_ORIGIN ?? "https://sahne-play.vercel.app";
    return [
      { source: "/join", destination: `${play}/` },
      { source: "/join/:path*", destination: `${play}/:path*` },
    ];
  },
  transpilePackages: ["@sahne/ui", "@sahne/protocol", "@sahne/i18n", "@sahne/engine"],
};

export default nextConfig;
