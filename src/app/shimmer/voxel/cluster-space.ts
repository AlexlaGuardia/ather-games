// Cluster SPACE — how a keeper's own plot lives inside a cluster, column for column.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ── ★★ THE ONE IDEA: A QUARTER IS YOUR PLOT, MOVED BY WHOLE COLUMNS ──────────────────────────────
// A keeper's plot is saved as edits keyed by COLUMN (16×16) in plot space, centred on the origin.
// In a cluster the same fold sits at `quarterCentre(q)` — `(±offset, ±offset)`. Because `offset`
// is 512 = 32 columns exactly, the move is a pure column shift: plot column (px, pz) IS cluster
// column (px + dcx, pz + dcz), cell for cell, with the SAME local indices. So:
//   · a keeper's saved plot edits load into their quarter UNCHANGED, read under the plot's own keys;
//   · an edit made in their quarter is written back under the plot's keys — building in your
//     quarter IS building in your plot, and walking home solo finds it there.
// There is no second copy of anybody's garden anywhere, which is the whole point.
//
// ── ★ WHOSE CELL IS IT ──────────────────────────────────────────────────────────────────────────
// Ruled with Alex 2026-09-23: offline first; your quarter is yours, a mate's quarter is read-only to
// you. So a cell is editable only where it is YOUR fold's ground. The Green and the lanes are made
// ground that is nobody's plot (canon: folk walk and work it, none live there); phase 1 leaves them
// read-only too, and says so, rather than inventing whose edit that would be.
//
// ── ⚠ STAND-INS ARE A DEV TOOL, NEVER A CLUSTER ─────────────────────────────────────────────────
// Canon: an unfilled slot is NO GROUND AT ALL. `standInCluster` fills the other three slots with
// generated folds only so the owner can walk the geometry in the real engine before any other
// keeper's ground can be loaded. Its keepers carry `STAND_IN_SEED_BASE` seeds so nothing can mistake
// one for a person, and nothing but the owner's console reaches it.
import { SECTION } from './column'
import {
  DEFAULT_CLUSTER, NO_SLOTS, QUARTERS, QUARTER_SIGN, clusterAt,
  type ClusterConfig, type QuarterId,
} from './cluster'

/** Columns a quarter is shifted by. Derived; throws if the offset stops being column-aligned. */
export function quarterShift(q: QuarterId, cfg: ClusterConfig = DEFAULT_CLUSTER): { dcx: number; dcz: number } {
  if (cfg.offset % SECTION !== 0) throw new Error(`cluster offset ${cfg.offset} is not column-aligned (${SECTION})`)
  const n = cfg.offset / SECTION
  return { dcx: QUARTER_SIGN[q].sx * n, dcz: QUARTER_SIGN[q].sz * n }
}

/** Cluster column → the plot column whose saved edits it wears (for quarter `q`). */
export function plotColumnOf(gx: number, gz: number, q: QuarterId, cfg: ClusterConfig = DEFAULT_CLUSTER): { px: number; pz: number } {
  const s = quarterShift(q, cfg)
  return { px: gx - s.dcx, pz: gz - s.dcz }
}

/** Plot column → where it stands in the cluster. */
export function clusterColumnOf(px: number, pz: number, q: QuarterId, cfg: ClusterConfig = DEFAULT_CLUSTER): { gx: number; gz: number } {
  const s = quarterShift(q, cfg)
  return { gx: px + s.dcx, gz: pz + s.dcz }
}

/**
 * Is this world cell the keeper's own fold ground (quarter `mine`)? The edit gate.
 * ⚠ ASKS `clusterAt`'s PART, NOT `foldAt`. At max tier a fold's coast reaches into the Green's
 * reserved square, and `foldAt` still names the fold there. The first cut of this gate used it and
 * called ~4,000 cells of the Green "mine" (caught by cluster-space.test § 2's block-for-block walk).
 * The door mound counts: `clusterAt` hands doorway columns back to the fold, so they ARE the plot.
 */
export function cellIsMine(x: number, z: number, mine: QuarterId, cfg: ClusterConfig): boolean {
  const c = clusterAt(x, z, cfg)
  return (c.part === 'quarter' || c.part === 'door') && c.quarter === mine
}

/** A stand-in keeper's seed lives far from any real seed, so a stand-in can never pass for a person. */
export const STAND_IN_SEED_BASE = 900_000

/**
 * The owner's walk-through cluster: the keeper in quarter `mine` at their real seed and tier, the
 * other three as generated stand-ins at `standTier`. DEV ONLY — see the header.
 */
export function standInCluster(mine: QuarterId, seed: number, tier: number, standTier = 1,
                               cfg: ClusterConfig = DEFAULT_CLUSTER): ClusterConfig {
  const slots = { ...NO_SLOTS }
  QUARTERS.forEach((q, i) => {
    slots[q] = q === mine ? { seed, tier } : { seed: STAND_IN_SEED_BASE + i, tier: standTier }
  })
  return { ...cfg, slots }
}
