// Plot SNAPSHOTS — a keeper's plot edits as one plain record a cluster-mate can read.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder. Where the snapshot comes
// from (IndexedDB) and where it goes (/api/cluster/plot) is the host's problem.
//
// ── ★ WHAT A SNAPSHOT IS (cluster phase 3, 2026-09-23) ──────────────────────────────────────────
// Ruled with Alex: offline first, a mate's quarter is READ-ONLY to you. So a snapshot is a one-way
// copy: the keeper's own browser stays the only place their garden is written, and the server holds
// the last picture of it for the other members to look at. Nothing ever writes a snapshot back into
// anybody's save, and nothing reads one outside a cluster.
//
// It carries BLOCK EDITS ONLY — the plot's columns keyed by PLOT column, exactly as the keeper's own
// save keys them. Edits are absolute ("this cell is now X"), never deltas, so applying a mate's
// edits over their generated quarter gives their built garden even where our generators disagree in
// detail (their litter tier, say). Pieces, chests and jobs are not in it: a chest's contents are the
// keeper's business, and the host has no read-only path for pieces yet.
//
// ── ★ WHY THE QUARTER SHIFT IS ALL THE MAPPING THERE IS ─────────────────────────────────────────
// `cluster-space.ts` proves a quarter is its keeper's plot moved by whole columns. So a column of
// MY framed plot space is a cluster column is a column of the MATE's plot space, with the same local
// indices all the way down: `mateColumnOf` is two integer shifts, and a packed edit applies as-is.
import type { Column } from './column'
import { SECTION, refreshUniform } from './column'
import { GENERATOR_VERSION, editIndex, unpackIndex, type ColumnEdits, type PackedEdits } from './edits'
import { clusterAt, QUARTERS, type ClusterConfig, type QuarterId } from './cluster'
import { quarterShift } from './cluster-space'

export interface PlotSnapshot {
  v: 1
  /** The generator the edits were diffed against (`isStale` in edits.ts is the same question). */
  gen: number
  /** Plot column `"px,pz"` → parallel arrays of packed cell index and material. */
  cols: Record<string, { i: number[]; m: number[] }>
  /**
   * The keeper's gate-station LAMPS, `[x, y, z, dark]` in plot cells (2026-09-24). The edits already
   * say what each lamp shows while its keeper is awake; this says which cells they are and what the
   * blueprint holds there, so a mate's client can show the station DORMANT while its keeper is away
   * (`applyMateLamps`). Optional: a snapshot from before it, or a plot whose station never stood, has none.
   */
  lamps?: [number, number, number, number][]
}

/** A station has four lamps; the bound only stops a hostile upload from making the loop long. */
export const MAX_LAMPS = 16
/** The lit lamp. Written out rather than imported: this file's core imports nothing outside the folder but its own. */
const LIT = 9   // MAT.MANA_LANTERN — `plot-snapshot.test.ts` asserts the two agree

/** A runaway guard, the same size as a cloud save's. A real plot is a few KB. */
export const SNAPSHOT_MAX_BYTES = 512 * 1024

/** Build a snapshot from the keeper's own plot columns. Empty columns cost nothing. */
export function buildSnapshot(cols: Iterable<{ px: number; pz: number; edits: PackedEdits }>,
                              lamps?: readonly { x: number; y: number; z: number; dark: number }[]): PlotSnapshot {
  const out: PlotSnapshot = { v: 1, gen: GENERATOR_VERSION, cols: {} }
  if (lamps?.length) out.lamps = lamps.slice(0, MAX_LAMPS).map(l => [l.x, l.y, l.z, l.dark])
  for (const c of cols) {
    const n = Math.min(c.edits.idx.length, c.edits.mat.length)
    if (!n) continue
    out.cols[`${c.px},${c.pz}`] = { i: Array.from(c.edits.idx.subarray(0, n)), m: Array.from(c.edits.mat.subarray(0, n)) }
  }
  return out
}

const COL_KEY = /^-?\d{1,4},-?\d{1,4}$/
const isIntArray = (a: unknown, max: number): a is number[] =>
  Array.isArray(a) && a.every(n => Number.isInteger(n) && n >= 0 && n <= max)

/**
 * Parse anything into a snapshot, or null. The SERVER calls this on upload and the CLIENT on
 * download — a mate's snapshot is somebody else's data arriving in my world, so it is checked
 * the same way at both ends rather than trusted at either.
 */
export function readSnapshot(raw: unknown): PlotSnapshot | null {
  const o = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as unknown } catch { return null } })() : raw
  if (!o || typeof o !== 'object') return null
  const s = o as Partial<PlotSnapshot>
  if (s.v !== 1 || !Number.isInteger(s.gen) || !s.cols || typeof s.cols !== 'object' || Array.isArray(s.cols)) return null
  const cols: PlotSnapshot['cols'] = {}
  for (const [k, c] of Object.entries(s.cols)) {
    if (!COL_KEY.test(k) || !c || typeof c !== 'object') return null
    const { i, m } = c as { i: unknown; m: unknown }
    if (!isIntArray(i, 0xffffffff) || !isIntArray(m, 0xffff) || i.length !== m.length) return null
    cols[k] = { i, m }
  }
  const out: PlotSnapshot = { v: 1, gen: s.gen as number, cols }
  if (s.lamps !== undefined) {
    const L = s.lamps as unknown
    const cell = (n: unknown) => Number.isInteger(n) && Math.abs(n as number) <= 100_000
    if (!Array.isArray(L) || L.length > MAX_LAMPS) return null
    for (const l of L)
      if (!Array.isArray(l) || l.length !== 4 || !cell(l[0]) || !cell(l[1]) || !cell(l[2]) || !isIntArray([l[3]], 0xffff)) return null
    if (L.length) out.lamps = L.map(l => [l[0], l[1], l[2], l[3]] as [number, number, number, number])
  }
  return out
}

/** My framed column (host coordinates) → the plot column of the mate standing in quarter `q`. */
export function mateColumnOf(fx: number, fz: number, mine: QuarterId, q: QuarterId, cfg: ClusterConfig): { px: number; pz: number } {
  const a = quarterShift(mine, cfg), b = quarterShift(q, cfg)
  return { px: fx + a.dcx - b.dcx, pz: fz + a.dcz - b.dcz }
}

/**
 * Lay every mate's snapshot over one freshly generated framed column. Returns cells written.
 *
 * ⚠ ONLY WHERE THE CELL IS THAT MATE'S OWN FOLD GROUND (`clusterAt` part quarter/door, the same
 * question as the edit gate in `cluster-space.ts`). A keeper who built at the far edge of their solo
 * plot may have edits in columns the cluster clips to Green, lane or another cell; those are ground
 * the cluster says is not theirs, and painting them there would let one keeper's build stand on the
 * shared middle, or in a neighbour's corner. Clipped, not moved.
 *
 * ⚠ NEVER A PLAYER EDIT. This writes the column directly, not through the host's edit funnel, so a
 * mate's garden cannot enter my save; the host's write gate already refuses every cell outside my
 * fold, which is exactly the set this touches.
 */
export function applyMateEdits(col: Column, mine: QuarterId, cfg: ClusterConfig,
                               snaps: Partial<Record<QuarterId, PlotSnapshot | null>>,
                               away?: ReadonlySet<QuarterId>): number {
  const fx = Math.floor(col.wx / SECTION), fz = Math.floor(col.wz / SECTION)
  const ms = quarterShift(mine, cfg)
  const H = col.sections.length * SECTION
  let n = 0
  for (const q of QUARTERS) {
    if (q === mine || !cfg.slots[q]) continue
    const snap = snaps[q]
    if (!snap) continue
    const p = mateColumnOf(fx, fz, mine, q, cfg)
    const c = snap.cols[`${p.px},${p.pz}`]
    if (!c) continue
    for (let k = 0; k < c.i.length; k++) {
      const { x, y, z } = unpackIndex(c.i[k])
      if (y < 0 || y >= H) continue
      // cluster coordinates of this cell: the framed cell plus my quarter's shift
      const at = clusterAt(col.wx + x + ms.dcx * SECTION, col.wz + z + ms.dcz * SECTION, cfg)
      if ((at.part !== 'quarter' && at.part !== 'door') || at.quarter !== q) continue
      const s = (y / SECTION) | 0
      col.sections[s].set(x, y - s * SECTION, z, c.m[k])
      n++
    }
  }
  if (away?.size) n += applyMateLamps(col, mine, cfg, snaps, away, false)
  if (n) refreshUniform(col)
  return n
}

/**
 * ★ A MATE'S GATE STATION, AWAKE OR DORMANT (Alex, 2026-09-24: *"it should go dormant if the player is
 * offline"*). For every mate in `away`, each of their station's lit lamps shows the blueprint's dark
 * block instead; for every other mate, each lamp shows what their snapshot says it shows. Returns
 * cells written. Run at column adoption (inside `applyMateEdits`) and again, on the loaded columns
 * only, when somebody wakes or goes away — so a presence change is a few cells and a remesh, not a
 * rebuild.
 *
 * ⛔ A LAMP AND NOTHING ELSE. Canon: a quiet keeper's quarter *"sits exactly as it was; nothing greys,
 * nothing vanishes"* (`game/shimmer-geography.md` › GARDEN CLUSTERS §4). Dormant is the station's
 * lights going out; its stone, their garden and the ground never change with it.
 *
 * ⚠ ONLY A CELL THAT IS LIT GOES DARK. A lamp the keeper has not earned is already dark, and a cell
 * their snapshot changed to something else (they built over it) is theirs: dimming writes the dark
 * block only where a lantern stands.
 */
export function applyMateLamps(col: Column, mine: QuarterId, cfg: ClusterConfig,
                               snaps: Partial<Record<QuarterId, PlotSnapshot | null>>,
                               away: ReadonlySet<QuarterId>, refresh = true): number {
  const ms = quarterShift(mine, cfg)
  const H = col.sections.length * SECTION
  let n = 0
  for (const q of QUARTERS) {
    if (q === mine || !cfg.slots[q]) continue
    const snap = snaps[q]
    if (!snap?.lamps) continue
    const qs = quarterShift(q, cfg)
    const dx = (qs.dcx - ms.dcx) * SECTION, dz = (qs.dcz - ms.dcz) * SECTION
    for (const [lx0, y, lz0, dark] of snap.lamps) {
      // plot cell → my framed cell (the inverse of `mateColumnOf`, one cell at a time)
      const x = lx0 + dx - col.wx, z = lz0 + dz - col.wz
      if (x < 0 || x >= SECTION || z < 0 || z >= SECTION || y < 0 || y >= H) continue
      const at = clusterAt(col.wx + x + ms.dcx * SECTION, col.wz + z + ms.dcz * SECTION, cfg)
      if ((at.part !== 'quarter' && at.part !== 'door') || at.quarter !== q) continue
      const s = (y / SECTION) | 0, sy = y - s * SECTION
      const now = col.sections[s].get(x, sy, z)
      let want = now
      if (away.has(q)) { if (now === LIT) want = dark }
      else if (now === dark) {
        // Awake: whatever their picture holds at this cell (a lamp they have lit, or still dark).
        const pc = snap.cols[`${Math.floor(lx0 / SECTION)},${Math.floor(lz0 / SECTION)}`]
        const idx = pc ? pc.i.indexOf(editIndex(lx0 - Math.floor(lx0 / SECTION) * SECTION, y, lz0 - Math.floor(lz0 / SECTION) * SECTION)) : -1
        if (idx >= 0) want = pc!.m[idx]
      }
      if (want !== now) { col.sections[s].set(x, sy, z, want); n++ }
    }
  }
  if (n && refresh) refreshUniform(col)
  return n
}

/** A snapshot as the edits map one column of it describes — for tests and the doctor. */
export function snapshotColumn(snap: PlotSnapshot, px: number, pz: number): ColumnEdits {
  const out: ColumnEdits = new Map()
  const c = snap.cols[`${px},${pz}`]
  if (c) for (let k = 0; k < c.i.length; k++) out.set(c.i[k], c.m[k])
  return out
}
