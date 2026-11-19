// BETA M38: the Wilds edit layer for EVERY keeper (public read; saving is /shimmer/save-wilds-edit, owner only).
// Read from disk on each request (never imported, never cached), so the owner's last save shows on the next load.
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'
const FILE = join(process.cwd(), 'src/app/shimmer/world/wilds-edits.json')

export async function GET() {
  let body = '{"v":1,"tiles":{}}'
  try { body = await readFile(FILE, 'utf-8') } catch { /* no edits yet */ }
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' } })
}
