import type { NextConfig } from "next";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "";
const dev = process.env.NODE_ENV === "development";

// Content-Security-Policy. Scripts may only come from this origin; inline
// scripts stay allowed because prerendered pages cannot carry per-request
// nonces. Data, images, uploads and videos may only go to or come from
// Supabase; embedded players are limited to YouTube (no-cookie) and Vimeo.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabase}`,
  `media-src 'self' blob: https://${supabase}`,
  `connect-src 'self' https://${supabase} wss://${supabase} https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // Icons and login photos change rarely and have stable names: cache for a week.
    const staticCache = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/icons/:path*", headers: staticCache },
      { source: "/auth/:file(.*\\.(?:jpg|png|webp))", headers: staticCache },
    ];
  },
  experimental: {
    // Photos are resized in the browser (≤ 3.5 MB); Vercel caps requests at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
