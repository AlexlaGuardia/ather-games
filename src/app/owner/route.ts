import { NextResponse, type NextRequest } from "next/server";

// Owner unlock: visit /owner?key=OWNER_KEY once to set the httpOnly owner cookie,
// which unlocks tooling + non-live games for this browser. /owner?logout clears it.
export function GET(req: NextRequest) {
  const url = req.nextUrl;
  if (url.searchParams.has("logout")) {
    const res = NextResponse.redirect(new URL("/arcade", req.url));
    res.cookies.delete("ather_owner");
    return res;
  }

  const key = url.searchParams.get("key");
  if (!key || key !== process.env.OWNER_KEY) {
    return new NextResponse("Invalid or missing key.", { status: 401 });
  }

  const res = NextResponse.redirect(new URL("/arcade", req.url));
  res.cookies.set("ather_owner", key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
