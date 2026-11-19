// M39 slice 1: READ a house blueprint (public, read-only; saves are owner-gated at /shimmer/save-house-blueprint).
// GET ?id=<id> -> the blueprint, or 404. no-store: a fresh save shows on the next Glade visit with no deploy.
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { parseHouse, SAFE_HOUSE_ID } from '../ather/plot-blueprint'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!SAFE_HOUSE_ID.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  const raw = await readFile(join(process.cwd(), 'world/house-blueprints', `${id}.json`), 'utf-8').catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'none' }, { status: 404, headers: { 'cache-control': 'no-store' } })
  let bp = null; try { bp = parseHouse(JSON.parse(raw)) } catch { /* refused below */ }
  if (!bp) return NextResponse.json({ error: 'malformed' }, { status: 422, headers: { 'cache-control': 'no-store' } })
  return NextResponse.json(bp, { headers: { 'cache-control': 'no-store' } })
}
