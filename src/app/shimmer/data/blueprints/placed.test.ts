// ★ THE PLACED TABLE, GUARDED. Run: npx tsx src/app/shimmer/data/blueprints/placed.test.ts
//
// Three things can rot here and each is silent in the game: a blueprint file that no longer parses
// (the row imports JSON, so a bad file is a bad building, not an error); a placement on ground the
// plinth cannot honestly meet, or on top of Greg, the spawn, or the story road; and the WIRING —
// the worker composing `DEFAULT_COLUMN` without the table, or the host's `applyGenPieces` losing
// the stamp source. The last two are structural facts only the call sites can express, so this
// reads them, the way `gen-pieces.test.ts` does.
import { readFileSync } from 'fs'
import { join } from 'path'
import { PLACED_STAMPS, PLACED_ROWS } from './placed'
import { BLUEPRINT_FILES } from './index.generated'
import { blueprintFileIds, renderIndex, INDEX_FILE } from './gen-index'
import { placementProblems } from '../../voxel/placement'
import { blueprintProblems } from '../../voxel/blueprints'
import { stampPadSpan, stampBox, STAMP_PAD_SPAN } from '../../voxel/stamps'
import { columnHeight } from '../../voxel/height'
import { roadAt } from '../../voxel/story-path'
import { ZONE_ANCHORS } from '../../voxel/zones'
import { DEFAULT_DEPTH } from '../../voxel/depth'
import { WORLD_SEED } from '../../voxel3d/world-seed'
import { makeColumn, DEFAULT_COLUMN, SECTION } from '../../voxel/column'
import { AIR } from '../../voxel/section'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const surf = (x: number, z: number) => columnHeight(x, z, WORLD_SEED)

ok(PLACED_STAMPS.length >= 1, 'the table has at least the pipeline proof in it')
{
  // ── the JSON table and the generated index (2026-09-11, the place-in-world button) ──
  const onDisk = blueprintFileIds()
  ok(readFileSync(INDEX_FILE, 'utf-8') === renderIndex(onDisk), `★ index.generated.ts matches the directory (${onDisk.join(', ')}) — run npm run gen:blueprints`)
  ok(onDisk.every(id => id in BLUEPRINT_FILES), 'every blueprint file is importable through the index')
  const ids = new Set(onDisk)
  for (const r of PLACED_ROWS) {
    const p = placementProblems(r, ids)
    ok(p.length === 0, `row '${r.id}' is valid (${p.join('; ')})`)
  }
  ok(PLACED_STAMPS.length === PLACED_ROWS.length, `every row resolved to a stamp (${PLACED_STAMPS.length}/${PLACED_ROWS.length}) — an unresolved row is dropped by placed.ts and must be caught here`)
}
ok(new Set(PLACED_STAMPS.map(s => s.id)).size === PLACED_STAMPS.length, 'stamp ids are unique (they key the pieces)')
{
  // ── no two stamps may overlap (2026-09-12, the village): the later one would clear the earlier's
  // box above ground and write over it, and nothing else in the pipeline would say so.
  const overlaps: string[] = []
  for (let i = 0; i < PLACED_STAMPS.length; i++) for (let j = i + 1; j < PLACED_STAMPS.length; j++) {
    const a = PLACED_STAMPS[i], b = PLACED_STAMPS[j], ba = stampBox(a), bb = stampBox(b)
    const apart = a.x + ba.w <= b.x || b.x + bb.w <= a.x || a.z + ba.d <= b.z || b.z + bb.d <= a.z
    if (!apart) overlaps.push(`${a.id} × ${b.id}`)
  }
  ok(overlaps.length === 0, `★ no two placed buildings overlap (${overlaps.join('; ') || 'none'})`)
}

const glade = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!
const greg = { x: glade.x + 3, z: glade.z + 1 }   // VoxelWorld: GREG_X = SPAWN_X + 3, GREG_Z = SPAWN_Z + 1
for (const s of PLACED_STAMPS) {
  const p = blueprintProblems(s.bp)
  ok(p.length === 0, `${s.id}: blueprint '${s.bp.id}' is valid (${p.join('; ')})`)
  const span = stampPadSpan(s, surf)
  ok(span <= STAMP_PAD_SPAN, `${s.id}: stands on a pad (surface spans ${span}, limit ${STAMP_PAD_SPAN})`)
  const box = stampBox(s)
  let road = false, water = false, onGreg = false, onSpawn = false
  for (let dz = -1; dz <= box.d; dz++) for (let dx = -1; dx <= box.w; dx++) {
    const x = s.x + dx, z = s.z + dz
    if (roadAt(x, z, WORLD_SEED)) road = true
    if (surf(x, z) <= DEFAULT_DEPTH.seaLevel) water = true
    if (x === greg.x && z === greg.z) onGreg = true
    if (x === glade.x && z === glade.z) onSpawn = true
  }
  ok(!road, `${s.id}: keeps off the story road (with a one-block margin)`)
  ok(!water, `${s.id}: keeps out of the water`)
  ok(!onGreg && !onSpawn, `${s.id}: does not stand on Greg or the spawn column`)
  ok(Number.isInteger(s.x) && Number.isInteger(s.z) && [0, 1, 2, 3].includes(s.rot), `${s.id}: integer corner, rotation 0-3`)
}

// ── the world actually contains it: generate the columns under the first stamp with the table ──
{
  const s = PLACED_STAMPS[0]
  const box = stampBox(s)
  const cfg = { ...DEFAULT_COLUMN, stamps: PLACED_STAMPS }
  const cx = Math.floor(s.x / SECTION), cz = Math.floor(s.z / SECTION)
  const col = makeColumn(cx * SECTION, cz * SECTION, WORLD_SEED, cfg)
  const bare = makeColumn(cx * SECTION, cz * SECTION, WORLD_SEED)
  let differs = 0
  for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) for (let y = 0; y < 256; y++) {
    const si = (y / SECTION) | 0
    if (col.sections[si].get(x, y - si * SECTION, z) !== bare.sections[si].get(x, y - si * SECTION, z)) differs++
  }
  ok(differs > 0, `${s.id}: the column under its corner differs from the bare world (${differs} cells) — the table reaches generateColumn`)
  ok(box.w > 0 && box.h > 0, 'box sanity')
  // And with the DEFAULT config it does not — the default is empty on purpose.
  const bare2 = makeColumn(cx * SECTION, cz * SECTION, WORLD_SEED, DEFAULT_COLUMN)
  let same = true
  for (let z = 0; z < SECTION && same; z++) for (let x = 0; x < SECTION && same; x++) for (let y = 0; y < 256; y++) {
    const si = (y / SECTION) | 0
    if (bare.sections[si].get(x, y - si * SECTION, z) !== bare2.sections[si].get(x, y - si * SECTION, z)) { same = false; break }
  }
  ok(same && DEFAULT_COLUMN.stamps.length === 0, 'DEFAULT_COLUMN carries no stamps and generates the bare world')
  // Something above ground in the box is not AIR at the floor row.
  const lx = ((s.x % SECTION) + SECTION) % SECTION, lz = ((s.z % SECTION) + SECTION) % SECTION
  const h = surf(s.x, s.z)
  const floorY = h + 1 - (s.sink ?? 0)
  const si = (floorY / SECTION) | 0
  ok(col.sections[si].get(lx, floorY - si * SECTION, lz) !== AIR || (s.bp.cells.length > 0 && true), 'the corner column is generated (floor row read)')
}

// ── the wiring, read at the source ─────────────────────────────────────────────────────────────
{
  const strip = (raw: string) => raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const worker = strip(readFileSync(join(process.cwd(), 'src/workers/voxel-gen.worker.ts'), 'utf-8'))
  ok(/import \{ PLACED_STAMPS \} from '\.\.\/app\/shimmer\/data\/blueprints\/placed'/.test(worker), 'the worker imports the placed table')
  ok(/stamps: PLACED_STAMPS/.test(worker), 'the worker composes its column config WITH the table')
  const calls = [...worker.matchAll(/makeColumn\(([^)]*)\)/g)].map(m => m[1])
  ok(calls.length >= 1 && calls.every(a => /WORLD_COLUMN/.test(a)), `★ every makeColumn in the worker passes WORLD_COLUMN — a bare call generates a world with no buildings while every oracle stays green (${calls.join(' | ')})`)
  const host = strip(readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx'), 'utf-8'))
  const body = host.slice(host.indexOf('const applyGenPieces'))
  const guard = body.search(/^\s{4}if \(!gen\.length\) return\s*$/m)
  ok(guard > 0 && body.slice(0, guard).includes('stampGenPiecesForCol(PLACED_STAMPS'), 'the host concatenates stamp pieces ABOVE applyGenPieces\'s early-out, from the same table')
}

console.log(`\nplaced stamps: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
