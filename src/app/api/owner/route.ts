import { NextResponse, type NextRequest } from "next/server";

// Client-readable owner check. The owner unlock cookie (`ather_owner`, set by
// /owner?key=OWNER_KEY) is httpOnly, so client JS can't read it directly. This
// route reports owner status so owner-only in-game UI (e.g. the Shimmer "Edit
// Map" tool) can reveal itself. Path is NOT under /api/shimmer, so the proxy
// leaves it public — it simply returns { owner: false } for non-owners.
export function GET(req: NextRequest) {
  const cookie = req.cookies.get("ather_owner")?.value;
  const owner = !!cookie && !!process.env.OWNER_KEY && cookie === process.env.OWNER_KEY;
  return NextResponse.json({ owner });
}
