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
    path.startsWith("/api/shimmer") ||
    path.startsWith("/api/saves")
  ) {
    return "tool";
  }
  // The 3D walker is PUBLIC — anyone can play it. Its in-page terrain editor + the save-* endpoints
  // (tool-gated above) stay owner-only; the edit UI hides itself for non-owners. This wins over the
  // gated-game check below (Shimmer's `/shimmer` href would otherwise sweep the whole prefix in).
  if (path === "/shimmer/play3d" || path.startsWith("/shimmer/play3d/")) {
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
