// BETA M38: the owner saves one Wilds tile's EDIT LAYER (open/ather/wilds-edits.ts). POST { tile, d: { <vertex k>: dm } } replaces
// that tile's map in world/wilds-edits.json (an empty map removes the tile). Owner-gated by the proxy (/shimmer/save-*). The file is
// read at RUNTIME by GET /shimmer/open/wilds-edits, so an edit is live on reload with no build. Backups via safeWriteFile.
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { cleanTile, TILE_NAME, type Edits } from '../open/ather/wilds-edits'

const EDITS_FILE = join(process.cwd(), 'src/app/shimmer/world/wilds-edits.json')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { tile?: unknown; d?: unknown }
    const tile = typeof body.tile === 'string' && TILE_NAME.test(body.tile) ? body.tile : null
    const d = cleanTile(body.d)
    if (!tile || !d) return NextResponse.json({ error: 'expected { tile, d: { <vertex>: dm } }' }, { status: 400 })
    let data: { v: 1; tiles: Edits } = { v: 1, tiles: {} }
    try { const j = JSON.parse(await readFile(EDITS_FILE, 'utf-8')); if (j && typeof j.tiles === 'object') data = { v: 1, tiles: j.tiles } } catch { /* fresh file */ }
    if (Object.keys(d).length) data.tiles[tile] = d; else delete data.tiles[tile]
    await writeFile(EDITS_FILE, JSON.stringify(data) + '\n')
    return NextResponse.json({ ok: true, tile, verts: Object.keys(d).length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
