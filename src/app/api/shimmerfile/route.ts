import { NextResponse, type NextRequest } from "next/server";

// ather.games v1 stub. "Shimmerfile" is Shimmer's account/identity layer (username,
// online presence) — part of the deferred multiplayer/cloud feature set. Here it
// returns a benign anonymous profile so single-player Shimmer proceeds without the
// username picker. No auth, no db. Restore the real version with the MP/cloud wave.
export function GET() {
  return NextResponse.json({
    shimmerfile: { username: "player", character_id: null, user_id: "local" },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  return NextResponse.json({
    shimmerfile: {
      username: (body as { username?: string }).username ?? "player",
      character_id: (body as { characterId?: string }).characterId ?? null,
      user_id: "local",
    },
  });
}
