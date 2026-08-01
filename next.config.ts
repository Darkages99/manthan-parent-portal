import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the app can be
  // shipped as a small Docker image / run on any Node host. See Dockerfile.
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
