// Run: npx tsx src/app/shimmer/voxel/plot-snapshot.test.ts
// ★ The claims: a mate's plot edits land in THEIR quarter of my framed cluster, cell for cell; they
// never land outside that mate's own fold ground; and a snapshot is checked, not trusted, on read.
import { Column, DEFAULT_COLUMN, SECTION } from './column'
import { DEFAULT_CLUSTER, NO_SLOTS, clusterAt, type ClusterConfig } from './cluster'
import { generateFramedColumn, quarterShift, unframe } from './cluster-space'
import { GENERATOR_VERSION, packEdits, type ColumnEdits } from './edits'
import { MAT } from './depth'
import {
  buildSnapshot, readSnapshot, mateColumnOf, applyMateEdits, snapshotColumn, type PlotSnapshot,
} from './plot-snapshot'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const cfg: ClusterConfig = { ...DEFAULT_CLUSTER, slots: { ...NO_SLOTS, ne: { seed: 1337, tier: 1 }, sw: { seed: 42, tier: 1 } } }
const idx = (x: number, y: number, z: number) => x + z * SECTION + y * SECTION * SECTION
const BUILT = MAT.PLANKS_GOLDWOOD

// §1 build / read round-trip, and garbage is refused.
const e: ColumnEdits = new Map([[idx(3, 120, 5), BUILT], [idx(4, 121, 5), BUILT]])
const snap = buildSnapshot([{ px: 0, pz: 0, edits: packEdits(e) }, { px: 1, pz: 1, edits: packEdits(new Map()) }])
ok(snap.gen === GENERATOR_VERSION, '§1 stamped with the running generator')
ok(Object.keys(snap.cols).length === 1, '§1 an empty column costs nothing')
const back = readSnapshot(JSON.stringify(snap))
ok(!!back && snapshotColumn(back, 0, 0).get(idx(3, 120, 5)) === BUILT, '§1 round-trips through JSON')
for (const [label, bad] of [
  ['not JSON', '{nope'], ['wrong version', { v: 2, gen: 1, cols: {} }], ['cols an array', { v: 1, gen: 1, cols: [] }],
  ['bad key', { v: 1, gen: 1, cols: { 'x,1': { i: [1], m: [1] } } }],
  ['length mismatch', { v: 1, gen: 1, cols: { '0,0': { i: [1, 2], m: [1] } } }],
  ['negative material', { v: 1, gen: 1, cols: { '0,0': { i: [1], m: [-1] } } }],
  ['fractional index', { v: 1, gen: 1, cols: { '0,0': { i: [1.5], m: [1] } } }],
] as const) ok(readSnapshot(bad) === null, `§1 refuses ${label}`)

// §2 the column map: my framed column → the mate's plot column, and back to the same cluster cell.
{
  const p = mateColumnOf(0, 0, 'ne', 'sw', cfg)
  const a = quarterShift('ne', cfg), b = quarterShift('sw', cfg)
  ok(p.px === a.dcx - b.dcx && p.pz === a.dcz - b.dcz, '§2 two integer shifts')
  ok(mateColumnOf(5, -3, 'sw', 'sw', cfg).px === 5, '§2 my own quarter maps to itself')
}

// §3 ★★ A MATE'S EDIT LANDS IN THEIR QUARTER. Their plot column (0,0) is the middle of their fold.
{
  const fx = 0 - quarterShift('ne', cfg).dcx + quarterShift('sw', cfg).dcx
  const fz = 0 - quarterShift('ne', cfg).dcz + quarterShift('sw', cfg).dcz
  const col = generateFramedColumn(new Column(fx * SECTION, fz * SECTION, DEFAULT_COLUMN), 'ne', cfg)
  const u = unframe(col.wx + 3, col.wz + 5, 'ne', cfg)
  ok(clusterAt(u.x, u.z, cfg).quarter === 'sw', '§3 (the probe column really is the SW fold)')
  const n = applyMateEdits(col, 'ne', cfg, { sw: snap })
  ok(n === 2, `§3 both edits written (${n})`)
  ok(col.get(3, 120, 5) === BUILT && col.get(4, 121, 5) === BUILT, '§3 ★★ cell for cell, same local indices')
  // Applying the NE keeper's own snapshot as though it were a mate's does nothing.
  const col2 = generateFramedColumn(new Column(0, 0, DEFAULT_COLUMN), 'ne', cfg)
  const before = col2.get(3, 120, 5)
  ok(applyMateEdits(col2, 'ne', cfg, { ne: snap }) === 0 && col2.get(3, 120, 5) === before, '§3 my own quarter is never painted from a snapshot')
  // An empty slot is no ground and no garden, whatever snapshot is lying around for it.
  const col3 = generateFramedColumn(new Column(fx * SECTION, fz * SECTION, DEFAULT_COLUMN), 'ne', cfg)
  ok(applyMateEdits(col3, 'ne', cfg, { nw: snap, se: snap }) === 0, '§3 an unfilled slot paints nothing')
}

// §4 ★★ CLIPPED, NOT MOVED: an edit in a mate's plot column that the cluster gives to the Green.
{
  // SW centre is (-512,-512); plot column (20,20) → cluster (-192,-192), inside the Green square.
  const far: PlotSnapshot = buildSnapshot([{ px: 20, pz: 20, edits: packEdits(new Map([[idx(8, 120, 8), BUILT]])) }])
  const fx = 20 - quarterShift('ne', cfg).dcx + quarterShift('sw', cfg).dcx
  const fz = 20 - quarterShift('ne', cfg).dcz + quarterShift('sw', cfg).dcz
  const col = generateFramedColumn(new Column(fx * SECTION, fz * SECTION, DEFAULT_COLUMN), 'ne', cfg)
  const u = unframe(col.wx + 8, col.wz + 8, 'ne', cfg)
  ok(clusterAt(u.x, u.z, cfg).part === 'green', `§4 (the probe cell really is the Green: ${clusterAt(u.x, u.z, cfg).part})`)
  const before = col.get(8, 120, 8)
  ok(applyMateEdits(col, 'ne', cfg, { sw: far }) === 0 && col.get(8, 120, 8) === before,
     '§4 ★★ a mate\'s build never stands on the shared middle')
}

// §5 out-of-range y is skipped, not thrown.
{
  const high = buildSnapshot([{ px: 0, pz: 0, edits: packEdits(new Map([[idx(1, 99999, 1), BUILT]])) }])
  const fx = -quarterShift('ne', cfg).dcx + quarterShift('sw', cfg).dcx
  const fz = -quarterShift('ne', cfg).dcz + quarterShift('sw', cfg).dcz
  const col = generateFramedColumn(new Column(fx * SECTION, fz * SECTION, DEFAULT_COLUMN), 'ne', cfg)
  let threw = false
  try { ok(applyMateEdits(col, 'ne', cfg, { sw: high }) === 0, '§5 nothing written above the column') } catch { threw = true }
  ok(!threw, '§5 a hostile y does not throw')
}

if (fails.length) { for (const f of fails) console.log('  FAIL ', f); console.log(`plot-snapshot: ${pass} passed, ${fails.length} FAILED`); process.exit(1) }
console.log(`plot-snapshot: ${pass}/0`)
