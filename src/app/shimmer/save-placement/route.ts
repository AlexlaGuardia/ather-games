// Read, write and remove PLACEMENT rows — the worktable's "place in world" button.
//
// ★ NAMED `save-placement` TO INHERIT THE OWNER GATE, like `save-blueprint` beside it: `proxy.ts`
// hard-403s `/shimmer/save-*` for anyone without the owner cookie, and a route that writes a file the
// build reads must sit behind that rule. Do not "tidy" it onto another prefix without moving the gate.
//
// ★ IT VALIDATES THROUGH `placementProblems` (shape) AND `placementSiteProblems` (ground) — the same
// two functions `placed.test.ts` runs over the file on disk. The ground half reads the real world:
// `columnHeight` and `roadAt` at `WORLD_SEED`, Greg's column and the spawn column, so a row that
// would stand in the river or on the road is refused with the sentence saying so, not written and
// found by the sweep.
//
// ⚠ A ROW IS LIVE AT THE NEXT DEPLOY, NOT ON SAVE. Both the worker bundle and the host import
// `placed.ts` at build time. The response says so, and the worktable prints it.
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { placementProblems, placementSiteProblems, SAFE_PLACEMENT_ID, type PlacementRow } from '../voxel/placement'
import type { Stamp } from '../voxel/stamps'
import { columnHeight } from '../voxel/height'
import { roadAt } from '../voxel/story-path'
import { DEFAULT_DEPTH } from '../voxel/depth'
import { ZONE_ANCHORS } from '../voxel/zones'
import { parseBlueprint } from '../voxel/blueprints'
import { WORLD_SEED } from '../voxel3d/world-seed'
import { blueprintFileIds, writeIndex, BLUEPRINT_DIR } from '../data/blueprints/gen-index'

const FILE = join(BLUEPRINT_DIR, 'placed.table.json')   // a name no blueprint id can take — see placed.ts

async function readRows(): Promise<PlacementRow[]> {
  const raw = await readFile(FILE, 'utf-8').catch(() => '[]')
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v as PlacementRow[] : [] } catch { return [] }
}
const serialize = (rows: PlacementRow[]) => `[\n${rows.map(r => `  ${JSON.stringify(r)}`).join(',\n')}\n]\n`

function siteContext() {
  const glade = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!
  return {
    surfaceAt: (x: number, z: number) => columnHeight(x, z, WORLD_SEED),
    roadAt: (x: number, z: number) => roadAt(x, z, WORLD_SEED),
    seaLevel: DEFAULT_DEPTH.seaLevel,
    reserved: [{ x: glade.x + 3, z: glade.z + 1, name: 'Greg' }, { x: glade.x, z: glade.z, name: 'the spawn column' }],
  }
}

/** GET — every row, plus the ids a row may name. */
export async function GET() {
  try {
    return NextResponse.json({ placements: await readRows(), blueprints: blueprintFileIds() })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

/** PUT — upsert one row by id. Refuses bad shape and bad ground, each with its reasons. */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const ids = new Set(blueprintFileIds())
    const problems = placementProblems(body, ids)
    if (problems.length) return NextResponse.json({ error: 'invalid placement', problems }, { status: 400 })
    const row = body as PlacementRow
    const raw = await readFile(join(BLUEPRINT_DIR, `${row.blueprint}.json`), 'utf-8')
    const bp = parseBlueprint(raw)
    const stamp: Stamp = { id: row.id, bp, x: row.x, z: row.z, rot: row.rot }
    if (row.sink) stamp.sink = row.sink
    const ground = placementSiteProblems(stamp, siteContext())
    if (ground.length) return NextResponse.json({ error: 'refused by the ground', problems: ground }, { status: 400 })
    const rows = await readRows()
    const clean: PlacementRow = { id: row.id, blueprint: row.blueprint, x: row.x, z: row.z, rot: row.rot }
    if (row.sink) clean.sink = row.sink
    const i = rows.findIndex(r => r.id === row.id)
    if (i >= 0) rows[i] = clean; else rows.push(clean)
    await writeFile(FILE, serialize(rows))
    writeIndex()
    return NextResponse.json({ ok: true, id: row.id, replaced: i >= 0, live: 'at the next deploy (coord build)' })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

/** DELETE — remove one row by id. */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id || !SAFE_PLACEMENT_ID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const rows = await readRows()
    const next = rows.filter(r => r.id !== id)
    await writeFile(FILE, serialize(next))
    return NextResponse.json({ ok: true, removed: rows.length - next.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
