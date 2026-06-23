import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For APK/web deployment, use standalone output
  // For static export (Capacitor APK), uncomment the 'export' line below
  output: "standalone",
  // output: "export",
  // trailingSlash: true,
  // images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
