import type { NextConfig } from "next";

// ather.games — public games site. Cortex redirects dropped; security + asset-cache headers kept.
const nextConfig: NextConfig = {
  compress: true,
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
        // long-cache immutable game assets (magii/spirits/audio land here as games migrate)
        source: "/:dir(magii|spirits|characters|manamals)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
