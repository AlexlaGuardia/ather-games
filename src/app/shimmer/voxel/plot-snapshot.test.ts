// Run: npx tsx src/app/shimmer/voxel/plot-snapshot.test.ts
// ★ The claims: a mate's plot edits land in THEIR quarter of my framed cluster, cell for cell; they
// never land outside that mate's own fold ground; and a snapshot is checked, not trusted, on read.
import { Column, DEFAULT_COLUMN, SECTION } from './column'
import { DEFAULT_CLUSTER, NO_SLOTS, clusterAt, type ClusterConfig } from './cluster'
import { generateFramedColumn, quarterShift, unframe } from './cluster-space'
import { GENERATOR_VERSION, packEdits, type ColumnEdits } from './edits'
import { MAT } from './depth'
import {
  buildSnapshot, readSnapshot, mateColumnOf, applyMateEdits, applyMateLamps, snapshotColumn, MAX_LAMPS, MAX_PIECES, matePieces, type PlotSnapshot,
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

// §6 ★★ A MATE'S STATION GOES DORMANT WHILE THEY ARE AWAY (2026-09-24) — its lamps, and nothing else.
{
  const LIT = MAT.MANA_LANTERN, DARK = MAT.CUT_STONE
  const lampE: ColumnEdits = new Map([[idx(3, 122, 5), LIT], [idx(4, 122, 5), DARK], [idx(5, 122, 5), BUILT], [idx(3, 120, 5), BUILT]])
  const lamps = [{ x: 3, y: 122, z: 5, dark: DARK }, { x: 4, y: 122, z: 5, dark: DARK }, { x: 5, y: 122, z: 5, dark: DARK }]
  const st = readSnapshot(JSON.stringify(buildSnapshot([{ px: 0, pz: 0, edits: packEdits(lampE) }], lamps)))!
  ok(st?.lamps?.length === 3 && st.lamps[0].join() === '3,122,5,' + DARK, '§6 lamps round-trip through JSON')
  const fx = 0 - quarterShift('ne', cfg).dcx + quarterShift('sw', cfg).dcx
  const fz = 0 - quarterShift('ne', cfg).dcz + quarterShift('sw', cfg).dcz
  const fresh = () => generateFramedColumn(new Column(fx * SECTION, fz * SECTION, DEFAULT_COLUMN), 'ne', cfg)

  const awake = fresh(); applyMateEdits(awake, 'ne', cfg, { sw: st }, new Set())
  ok(awake.get(3, 122, 5) === LIT, '§6 awake: the lamp shows what their picture says (lit)')
  const away = fresh(); applyMateEdits(away, 'ne', cfg, { sw: st }, new Set(['sw']))
  ok(away.get(3, 122, 5) === DARK, '§6 ★ away: a lit lamp shows the blueprint\'s dark block')
  ok(away.get(4, 122, 5) === DARK, '§6 an unearned lamp stays dark either way')
  ok(away.get(5, 122, 5) === BUILT, '§6 ★ a lamp cell they built over is THEIRS — dormancy never writes over a build')
  ok(away.get(3, 120, 5) === BUILT, '§6 ★★ their garden stands exactly as it was (canon: nothing greys, nothing vanishes)')
  ok(applyMateEdits(fresh(), 'ne', cfg, { sw: st }, new Set(['nw'])) >= 0 && (() => { const c = fresh(); applyMateEdits(c, 'ne', cfg, { sw: st }, new Set(['nw'])); return c.get(3, 122, 5) === LIT })(),
     '§6 another quarter being away does not dim this one')
  // Waking and sleeping in place — the relight a presence change runs on loaded columns.
  ok(applyMateLamps(away, 'ne', cfg, { sw: st }, new Set()) === 1 && away.get(3, 122, 5) === LIT, '§6 ★ wakes in place: exactly the one lit lamp comes back')
  ok(applyMateLamps(away, 'ne', cfg, { sw: st }, new Set(['sw'])) === 1 && away.get(3, 122, 5) === DARK, '§6 and sleeps in place again')
  ok(applyMateLamps(away, 'ne', cfg, { sw: st }, new Set(['sw'])) === 0, '§6 a second pass with no change writes nothing (no remesh churn)')
  // A lamp outside the mate's own ground is clipped, like every other cell of theirs.
  // ⚠ Aimed INSIDE the column on purpose: a lamp that misses the column is refused by the bounds
  // check first, and a test built that way passes with the ownership clip deleted (measured).
  const p0 = mateColumnOf(0, 0, 'ne', 'sw', cfg)
  const mineCol = generateFramedColumn(new Column(0, 0, DEFAULT_COLUMN), 'ne', cfg)
  mineCol.sections[(122 / SECTION) | 0].set(3, 122 % SECTION, 5, LIT)
  const onMine = readSnapshot(JSON.stringify({ v: 1, gen: 1, cols: {}, lamps: [[p0.px * SECTION + 3, 122, p0.pz * SECTION + 5, DARK]] }))!
  ok(clusterAt(unframe(3, 5, 'ne', cfg).x, unframe(3, 5, 'ne', cfg).z, cfg).quarter === 'ne', '§6 (the probe cell really is MY fold)')
  ok(applyMateLamps(mineCol, 'ne', cfg, { sw: onMine }, new Set(['sw'])) === 0 && mineCol.get(3, 122, 5) === LIT,
     '§6 ★ a mate\'s lamp that maps onto MY ground never dims my lantern')
  for (const [label, bad] of [
    ['too many lamps', Array.from({ length: MAX_LAMPS + 1 }, () => [0, 0, 0, 1])],
    ['a short tuple', [[1, 2, 3]]], ['a fractional cell', [[1.5, 2, 3, 4]]], ['a negative material', [[1, 2, 3, -4]]],
    ['not an array', { x: 1 }],
  ] as const) ok(readSnapshot({ v: 1, gen: 1, cols: {}, lamps: bad }) === null, `§6 refuses ${label}`)
  ok(!('lamps' in buildSnapshot([])), '§6 no station, no lamps field (an old reader sees the old shape)')
}

// §7 ★★ A MATE'S PIECES (2026-09-24): carried, shifted into their quarter, clipped to their ground.
{
  const shed = [{ pieceId: 'door_wood', x: 3, y: 121, z: 5, rot: 1, open: true }, { pieceId: 'roof_thatch', x: 4, y: 124, z: 6, rot: 0 }]
  const sp = readSnapshot(JSON.stringify(buildSnapshot([{ px: 0, pz: 0, edits: packEdits(e), pieces: shed }])))!
  ok(sp?.pieces?.length === 2 && sp.pieces[0].join() === 'door_wood,3,121,5,1,1' && sp.pieces[1][5] === 0, '§7 pieces round-trip, open as 0/1')
  ok(!!readSnapshot(JSON.stringify(buildSnapshot([{ px: 5, pz: 5, edits: packEdits(new Map()), pieces: shed }])))?.pieces,
     '§7 ★ a column with pieces and no block edits still carries its pieces')
  const fx = 0 - quarterShift('ne', cfg).dcx + quarterShift('sw', cfg).dcx
  const fz = 0 - quarterShift('ne', cfg).dcz + quarterShift('sw', cfg).dcz
  const got = matePieces({ wx: fx * SECTION, wz: fz * SECTION }, 'ne', cfg, { sw: sp })
  ok(got.length === 2 && got.every(p => p.mate === 'sw'), `§7 both pieces land in their column, tagged sw (${got.length})`)
  ok(got[0].x === fx * SECTION + 3 && got[0].z === fz * SECTION + 5 && got[0].y === 121 && got[0].rot === 1 && got[0].open === true,
     '§7 ★ same local cell, same y, rotation and state')
  ok(matePieces({ wx: (fx + 1) * SECTION, wz: fz * SECTION }, 'ne', cfg, { sw: sp }).length === 0, '§7 a neighbour column draws none of them (keyed by origin)')
  ok(matePieces({ wx: 0, wz: 0 }, 'ne', cfg, { ne: sp }).length === 0, '§7 my own quarter never takes pieces from a snapshot')
  // Aimed inside my own column, like §6's clip: an origin that maps onto MY ground is never drawn.
  const p0 = mateColumnOf(0, 0, 'ne', 'sw', cfg)
  const onMine = readSnapshot({ v: 1, gen: 1, cols: {}, pieces: [['door_wood', p0.px * SECTION + 3, 121, p0.pz * SECTION + 5, 0, 0]] })!
  ok(matePieces({ wx: 0, wz: 0 }, 'ne', cfg, { sw: onMine }).length === 0, '§7 ★ a mate\'s piece that maps onto MY ground is clipped')
  for (const [label, bad] of [
    ['too many pieces', Array.from({ length: MAX_PIECES + 1 }, () => ['door_wood', 0, 0, 0, 0, 0])],
    ['a bad id', [['<script>', 0, 0, 0, 0, 0]]], ['a rotation of 4', [['door_wood', 0, 0, 0, 4, 0]]],
    ['open as true', [['door_wood', 0, 0, 0, 0, true]]], ['a short tuple', [['door_wood', 0, 0, 0]]],
  ] as const) ok(readSnapshot({ v: 1, gen: 1, cols: {}, pieces: bad }) === null, `§7 refuses ${label}`)
}

if (fails.length) { for (const f of fails) console.log('  FAIL ', f); console.log(`plot-snapshot: ${pass} passed, ${fails.length} FAILED`); process.exit(1) }
console.log(`plot-snapshot: ${pass}/0`)
