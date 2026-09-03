import type { NextConfig } from "next";

// Security headers applied to every route. Kept conservative so they don't
// break the PWA: clickjacking is blocked outright (the console/portal is never
// meant to be framed), transport is pinned to HTTPS, and referrers/permissions
// are tightened. No script-src CSP here to avoid breaking Next's inline runtime.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the app can be
  // shipped as a small Docker image / run on any Node host. See Dockerfile.
  output: "standalone",
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
