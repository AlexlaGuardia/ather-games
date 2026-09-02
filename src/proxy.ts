import { NextResponse, type NextRequest } from "next/server";
import { GAMES } from "./lib/games";

// ather.games owner-token gate (v1; NextAuth-Google planned later).
//   - Source-mutating tooling (editors, save-*, doctor, deploy, game APIs) → hard 403 for the public.
//   - Non-`live` games (coming-soon + back-room) → redirected to /arcade for the public (they see the
//     teaser card there); the owner plays the real thing.
//   - `live` games + the arcade landing are fully public.
// The owner unlocks everything by visiting /owner?key=OWNER_KEY once (sets an httpOnly cookie).

const COOKIE = "ather_owner";

// href prefixes of games the public may NOT play directly (coming-soon + back-room).
const GATED_GAME_PREFIXES = GAMES.filter((g) => g.tier !== "live").map((g) => g.href);

function classify(path: string): "tool" | "gated-game" | null {
  // Source-mutating / dev tooling — never reachable without the owner cookie.
  if (
    path.startsWith("/shimmer/dev") ||
    path.startsWith("/shimmer/save-") ||
    path.startsWith("/shimmer/doctor") ||
    path.startsWith("/shimmer/deploy") ||
    path.startsWith("/nolmir/dev") ||
    path.startsWith("/nolmir/sfx-lab") ||
    // ★★ ADDED 2026-09-02 — IT WAS MISSING, AND A COMMENT ASSERTED OTHERWISE. `/vault` is tier
    // `live`, so it never entered GATED_GAME_PREFIXES and `classify` returned null for everything
    // beneath it: `/vault/dev` answered **200 to anybody**, and `/vault/dev/save` has no owner
    // check of its own — an unauthenticated POST with a valid slot key overwrites or DELETES an
    // authored Vault level in `public/vault/authored-levels.json` on prod.
    // ⚠ THE TELL WAS PROSE THAT WAS NEVER TRUE. `vault/dev/layout.tsx` says "Owner tool — keep it
    // out of the index (mirrors /shimmer/dev)". It did not mirror /shimmer/dev; it was simply
    // omitted from this list while its two siblings above were not. PATTERNS 09-01: a note does
    // not rot into nonsense, it rots into something plausible — and this one was plausible enough
    // that a reader checking "is the vault editor gated?" would have stopped at the comment.
    path.startsWith("/vault/dev") ||
    // NOTE the trailing slash: `/api/shimmer/*` is the source-mutating tooling (save-sprite).
    // A bare `/api/shimmer` prefix ALSO swallows `/api/shimmerfile`, which is the public
    // account/profile endpoint the username picker calls — that 403'd every non-owner player.
    path === "/api/shimmer" ||
    path.startsWith("/api/shimmer/")
    // `/api/saves` used to sit here from the deferred owner-cloud-save plan. It is a PUBLIC
    // player endpoint now (per-account garden sync, session-authed in the route itself) —
    // gating it owner-only 403'd every player's cloud copy. Same lesson as /api/shimmerfile.
  ) {
    return "tool";
  }
  // The 3D walker is PUBLIC — anyone can play it. Its in-page terrain editor + the save-* endpoints
  // (tool-gated above) stay owner-only; the edit UI hides itself for non-owners.
  //
  // Shimmer went `live` 2026-08-06, so `/shimmer` is no longer a gated prefix and these carve-outs
  // are belt-and-braces rather than load-bearing. They stay deliberately: if Shimmer is ever put
  // back to `coming-soon` for a rework, the thing testers actually play should not silently go dark
  // with it. Everything that MUTATES SOURCE is caught by the tool check above, which runs first —
  // that is the gate that matters, and it is independent of any game's tier.
  //
  // ── ★ FLIPPED 2026-08-07 (Alex): play3d is the LEGACY route, voxel3d is Shimmer ──────────────
  // `/shimmer` and the room's Shimmer wall both land on `/shimmer/voxel3d` now. play3d keeps the
  // systems being ported across (PLAY3D-MIGRATION.md: 16 of 23 port untouched), so it stays
  // REACHABLE — but owner-only, so nothing wanders back onto the world model we are leaving.
  // Gated here and not merely unlinked: the voxel HUD hides its play3d link for non-owners, and a
  // hidden link is not a permission.
  if (path === "/shimmer/play3d" || path.startsWith("/shimmer/play3d/")) {
    return "gated-game";
  }
  // The voxel world is PUBLIC — it is the game now. Its in-page editors and the save-* endpoints
  // stay owner-only via the tool check above, which runs first.
  if (path === "/shimmer/voxel3d" || path.startsWith("/shimmer/voxel3d/")) {
    return null;
  }
  // Live world data — read-only map payload (tile/height/node numbers) the public 3D walker
  // boots from; saves stay owner-gated above, this is just the reading side.
  if (path === "/shimmer/world-data" || path === "/shimmer/region-data" || path === "/shimmer/client-log") {
    return null;
  }
  // Keeper's Arena test harness — public so Alex can cold-play the new combat on his device.
  if (path === "/shimmer/arena" || path.startsWith("/shimmer/arena/")) {
    return null;
  }
  // Non-live game pages — hidden from the public, owner-only.
  if (GATED_GAME_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    return "gated-game";
  }
  return null;
}

export function proxy(req: NextRequest) {
  const kind = classify(req.nextUrl.pathname);
  if (!kind) return NextResponse.next();

  const owner = req.cookies.get(COOKIE)?.value;
  const isOwner = !!owner && !!process.env.OWNER_KEY && owner === process.env.OWNER_KEY;
  if (isOwner) return NextResponse.next();

  if (kind === "gated-game") {
    return NextResponse.redirect(new URL("/room", req.url));
  }
  return new NextResponse("Forbidden — owner only.", { status: 403 });
}

export const config = {
  // Run on every page request EXCEPT Next internals + static assets (anything with a dot, e.g.
  // .webp/.js/.ico). classify() then decides what's actually gated — so the gate auto-covers
  // EVERY game route from the GAMES registry (no more stale per-path matcher missing new games).
  matcher: ["/((?!_next/|favicon.ico|.*\\.).*)"],
};
