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
import { GENERATOR_VERSION, unpackIndex, type ColumnEdits, type PackedEdits } from './edits'
import { clusterAt, QUARTERS, type ClusterConfig, type QuarterId } from './cluster'
import { quarterShift } from './cluster-space'

export interface PlotSnapshot {
  v: 1
  /** The generator the edits were diffed against (`isStale` in edits.ts is the same question). */
  gen: number
  /** Plot column `"px,pz"` → parallel arrays of packed cell index and material. */
  cols: Record<string, { i: number[]; m: number[] }>
}

/** A runaway guard, the same size as a cloud save's. A real plot is a few KB. */
export const SNAPSHOT_MAX_BYTES = 512 * 1024

/** Build a snapshot from the keeper's own plot columns. Empty columns cost nothing. */
export function buildSnapshot(cols: Iterable<{ px: number; pz: number; edits: PackedEdits }>): PlotSnapshot {
  const out: PlotSnapshot = { v: 1, gen: GENERATOR_VERSION, cols: {} }
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
  return { v: 1, gen: s.gen as number, cols }
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
                               snaps: Partial<Record<QuarterId, PlotSnapshot | null>>): number {
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
  if (n) refreshUniform(col)
  return n
}

/** A snapshot as the edits map one column of it describes — for tests and the doctor. */
export function snapshotColumn(snap: PlotSnapshot, px: number, pz: number): ColumnEdits {
  const out: ColumnEdits = new Map()
  const c = snap.cols[`${px},${pz}`]
  if (c) for (let k = 0; k < c.i.length; k++) out.set(c.i[k], c.m[k])
  return out
}
