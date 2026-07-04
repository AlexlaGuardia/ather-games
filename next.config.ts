import type { NextConfig } from "next";

// ather.games — public games site. Cortex redirects dropped; security + asset-cache headers kept.
const nextConfig: NextConfig = {
  compress: true,
  // Eyuun's Bookstore streams the ~500MB of narration that lives in akatskii-web's
  // /public/listen. Loading it cross-origin from akatskii.com stalls in the browser
  // (Cloudflare treats a cross-site <audio> fetch as a hotlink and hangs it — curl,
  // which sends no Origin/Referer, sails through). Proxying it SAME-ORIGIN through
  // ather.games → the local akatskii-web process (:3100, same box) sidesteps that
  // entirely and keeps range/streaming (206) intact. No 500MB copy, always in sync.
  async rewrites() {
    return [
      { source: "/listen/:path*", destination: "http://localhost:3100/listen/:path*" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // long-cache immutable game MEDIA (images/audio/fonts) under these public/ folders.
        // MUST require a file extension: the bare ":path*" also matched the /magii PAGE route,
        // pinning its HTML with a 1-year immutable cache → phones kept stale HTML referencing
        // dead chunk hashes after every rebuild (the recurring "stale build" breakage). Anchor
        // to real asset extensions so page routes (no extension) never match.
        source: "/:dir(magii|spirits|characters|manamals)/:path*.:ext(png|jpe?g|webp|gif|svg|avif|ico|mp3|ogg|wav|m4a|woff|woff2|ttf)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
