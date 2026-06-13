import { NextResponse } from "next/server";

// v1 stub — usernames are always "available" (no account registry; MP/cloud deferred).
export function GET() {
  return NextResponse.json({ available: true });
}
