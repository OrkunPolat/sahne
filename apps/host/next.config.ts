import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sahne/ui", "@sahne/protocol", "@sahne/i18n", "@sahne/engine"],
};

export default nextConfig;
