// BETA M62 (engine from M38): the owner saves Wilds EDIT LAYER maps (open/ather/wilds-edits.ts) into world/wilds-edits.json.
// POST { tiles: { <tile>: { <vertex k>: dm } } } (the terrain editor: every changed tile in ONE request) or the single form
// { tile, d }. Each named tile's map is REPLACED (an empty map removes the tile); tiles not named are kept. Owner-gated by the proxy
// (/shimmer/save-*). The file is read at RUNTIME by GET /shimmer/open/wilds-edits, so an edit is live on reload with no build.
// ★ Writes are SERIALISED in this process (one read-modify-write at a time): the M62 check's first run saved 9 tiles as 9 parallel
//   POSTs, each read the same old file, and safeWriteFile's tmp names (pid + ms) collided: lost tiles and 500s.
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { cleanTile, TILE_NAME, type Edits, type TileEdits } from '../open/ather/wilds-edits'

const EDITS_FILE = join(process.cwd(), 'src/app/shimmer/world/wilds-edits.json')
let chain: Promise<unknown> = Promise.resolve()
const serial = <T,>(f: () => Promise<T>): Promise<T> => { const r = chain.then(f, f); chain = r.catch(() => {}); return r }

/** the request's tile maps, validated; null = malformed */
function parse(body: { tile?: unknown; d?: unknown; tiles?: unknown }): Record<string, TileEdits> | null {
  const raw: Record<string, unknown> = body.tiles && typeof body.tiles === 'object' && !Array.isArray(body.tiles)
    ? body.tiles as Record<string, unknown>
    : typeof body.tile === 'string' ? { [body.tile]: body.d } : {}
  const out: Record<string, TileEdits> = {}
  for (const [t, d] of Object.entries(raw)) { const c = TILE_NAME.test(t) ? cleanTile(d) : null; if (!c) return null; out[t] = c }
  return Object.keys(out).length && Object.keys(out).length <= 64 ? out : null
}

export async function POST(req: NextRequest) {
  try {
    const maps = parse(await req.json())
    if (!maps) return NextResponse.json({ error: 'expected { tiles: { <tile>: { <vertex>: dm } } } or { tile, d }' }, { status: 400 })
    const res = await serial(async () => {
      let data: { v: 1; tiles: Edits } = { v: 1, tiles: {} }
      try { const j = JSON.parse(await readFile(EDITS_FILE, 'utf-8')); if (j && typeof j.tiles === 'object') data = { v: 1, tiles: j.tiles } } catch { /* fresh file */ }
      for (const [t, d] of Object.entries(maps)) { if (Object.keys(d).length) data.tiles[t] = d; else delete data.tiles[t] }
      await writeFile(EDITS_FILE, JSON.stringify(data) + '\n')
      return Object.fromEntries(Object.entries(maps).map(([t, d]) => [t, Object.keys(d).length]))
    })
    return NextResponse.json({ ok: true, tiles: res })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
