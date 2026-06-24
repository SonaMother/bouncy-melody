import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: 'output: standalone' is a PRODUCTION-only setting. In dev mode it
  // forces Turbopack to track extra build-graph state for the standalone
  // bundle, which slows HMR and can cause compile-loop hangs. Removed.
  allowedDevOrigins: ['*.space-z.ai', '*.chatglm.cn'],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
