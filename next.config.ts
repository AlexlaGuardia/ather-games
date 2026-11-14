import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ★★ TWO PRODUCTION SLOTS, NEVER RENAMED (2026-11-14, hub). `coord build` used to rebuild the `.next` the live
// server was reading from, so the whole site answered 500 for the length of every deploy (and a FAILED build left
// prod on a half-written artifact). Now the server reads one slot while the build writes the other, and
// `.next-active` (one line: `.next` or `.next_b`) names the live one. Read here at startup, so ANY restart — a
// window, the mem-watcher, a reboot — comes up on the live slot, not on whatever a build last touched.
// ⚠ Why not build to a staging dir and rename it into place: every route module bakes its build dir's name in
// (`distDir:".next-stage"`) and resolves its manifests from it at runtime, so a renamed build cannot find its own
// files. That is the "client reference manifest does not exist" crash. The slots keep their names for life.
const SLOTS = [".next", ".next_b"];
function liveSlot(): string {
  try {
    const s = readFileSync(join(process.cwd(), ".next-active"), "utf8").trim();
    return SLOTS.includes(s) ? s : ".next";
  } catch { return ".next"; }
}

// ather.games — public games site. Cortex redirects dropped; security + asset-cache headers kept.
const nextConfig: NextConfig = {
  compress: true,
  // NEXT_DIST_DIR wins when set: satellite dev servers (`.next-<lane>`, devwin.sh) and `coord build` (which sets it
  // to the slot it is building). Unset = the production server, which serves the live slot.
  distDir: process.env.NEXT_DIST_DIR || liveSlot(),
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
