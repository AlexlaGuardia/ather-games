// BETA M62 (engine from M38): the owner saves Wilds EDIT LAYER maps (open/ather/wilds-edits.ts) into world/wilds-edits.json.
// POST { tiles: { <tile>: { <vertex k>: dm } }, water: { <tile>: { <cell k>: level dm } } } (the terrain editor: every changed
// tile in ONE request; either part may be absent) or the single form
// { tile, d }. Each named tile's map is REPLACED (an empty map removes the tile); tiles not named are kept. Owner-gated by the proxy
// (/shimmer/save-*). The file is read at RUNTIME by GET /shimmer/open/wilds-edits, so an edit is live on reload with no build.
// ★ Writes are SERIALISED in this process (one read-modify-write at a time): the M62 check's first run saved 9 tiles as 9 parallel
//   POSTs, each read the same old file, and safeWriteFile's tmp names (pid + ms) collided: lost tiles and 500s.
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { cleanTile, cleanWater, TILE_NAME, type Edits, type TileEdits, type WaterMap } from '../open/ather/wilds-edits'

const EDITS_FILE = join(process.cwd(), 'src/app/shimmer/world/wilds-edits.json')
let chain: Promise<unknown> = Promise.resolve()
const serial = <T,>(f: () => Promise<T>): Promise<T> => { const r = chain.then(f, f); chain = r.catch(() => {}); return r }

/** one kind of map off the request (heights or water), validated; null = malformed */
function maps(raw: unknown, clean: (d: unknown) => Record<string, number> | null): Record<string, Record<string, number>> | null {
  if (raw === undefined) return {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Record<string, Record<string, number>> = {}
  for (const [t, d] of Object.entries(raw as Record<string, unknown>)) { const c = TILE_NAME.test(t) ? clean(d) : null; if (!c) return null; out[t] = c }
  return out
}
function parse(body: { tile?: unknown; d?: unknown; tiles?: unknown; water?: unknown }): { tiles: Record<string, TileEdits>; water: Record<string, WaterMap> } | null {
  const tiles = maps(body.tiles !== undefined ? body.tiles : typeof body.tile === 'string' ? { [body.tile]: body.d } : undefined, cleanTile)
  const water = maps(body.water, cleanWater)
  if (!tiles || !water) return null
  const n = Object.keys(tiles).length + Object.keys(water).length
  return n && n <= 128 ? { tiles, water } : null
}

export async function POST(req: NextRequest) {
  try {
    const req0 = parse(await req.json())
    if (!req0) return NextResponse.json({ error: 'expected { tiles?: { <tile>: { <vertex>: dm } }, water?: { <tile>: { <cell>: level dm } } } or { tile, d }' }, { status: 400 })
    const res = await serial(async () => {
      let data: { v: 1; tiles: Edits; water: Record<string, WaterMap> } = { v: 1, tiles: {}, water: {} }
      try { const j = JSON.parse(await readFile(EDITS_FILE, 'utf-8')); if (j && typeof j.tiles === 'object') data = { v: 1, tiles: j.tiles, water: j.water && typeof j.water === 'object' ? j.water : {} } } catch { /* fresh file */ }
      const put = (into: Record<string, Record<string, number>>, from: Record<string, Record<string, number>>) => { for (const [t, d] of Object.entries(from)) { if (Object.keys(d).length) into[t] = d; else delete into[t] } }
      put(data.tiles, req0.tiles); put(data.water, req0.water)
      await writeFile(EDITS_FILE, JSON.stringify(data) + '\n')
      const count = (m: Record<string, Record<string, number>>) => Object.fromEntries(Object.entries(m).map(([t, d]) => [t, Object.keys(d).length]))
      return { tiles: count(req0.tiles), water: count(req0.water) }
    })
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
