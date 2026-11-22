// BETA M83 s2a: the Glade's published edit layer for EVERY keeper (public read; only the World Builder's publish / roll back writes
// it: /shimmer/save-builder, owner only). Same shape as the Wilds layer, one tile named 'glade' (world/glade-builder.ts).
// Read from disk on each request (never imported, never cached), so a publish shows on the next Glade load with no build.
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'
const FILE = join(process.cwd(), 'src/app/shimmer/world/glade-edits.json')

export async function GET() {
  let body = '{"v":1,"tiles":{},"water":{},"falls":{}}'
  try { body = await readFile(FILE, 'utf-8') } catch { /* nothing published yet */ }
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' } })
}
