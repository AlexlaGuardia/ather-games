// GARDEN CLUSTERS, IN THE OPEN WORLD — the geometry (Alex 11-15: "it should work the same: if no friends have joined
// the clouds hide the expansion, but once a friend joins they are linked together and the communal space opens in the
// middle as a bridge between plots. Pretty much the same idea"). [OPEN] in CANON_GAPS (reverses ather-rework §3):
// built against Alex's word with NEUTRAL words ("the shared ground", "a road"); the retired names stay retired
// until Magii rules.
//
// ★ THE LAYOUT IS ALEX'S SKETCH (11-15, pen on paper): the shared ground is a SQUARE in the middle and the gardens
// stand round it, each with its start corner facing it. Every garden's MAIN GATE stands beside that corner, off to the
// side, and a PATH leaves the corner past it and winds to the middle of the square, where all the paths meet.
// ★ AND THE GROUND BETWEEN IS A MEADOW (Alex, same evening: "filled in the space inbetween the gardens with diff
// terrain.. modeled after the meadows biome with hills.. dividing them.. the bridges could just be paths that all
// meet"): ather/meadow.ts. Linked, the cluster is one landmass (canon: one fold, not four folds with doors).
//
// THE FRAME. Everyone sees THEMSELVES in the north-east, with the square to their south-west, the way the sketch is
// drawn: the cluster turns round you, your garden never moves or turns (everything position-keyed you own, squares,
// the gate, Greg, stays put). The server's quarters only say who stands where RELATIVE to whom: mine maps to ne and
// the rest turn with it. A mate's garden is the same island as everyone's, turned by a quarter-turn so its gate corner
// faces the square (three.js rotation.y: world = centre + (c·x + s·z, −s·x + c·z)).
// ALONE (or the only one in the frame): nothing but your island; the clouds hide the rest.
// LINKED (two or more): the meadow round every present garden and the square, hills in the divides, the paths.
// A mate's plot is read-only (Alex 09-23); this file only says where things are and what you can stand on.
//
// ★ PURE. The server record (src/lib/accounts/clusters.ts, consent-only joining, the four landlord guards) is reused
// as is; a member's quarter comes from there.

import type { Box } from '../terrain-world'
import { plotHeightAt, mistWalls, GREEN_D } from './plot'
import { buildMeadow, gardenPath, meadowHeightAt, pathDist, toWorld, toLocal, type Meadow, type Path } from './meadow'

export type Quarter = 'ne' | 'nw' | 'sw' | 'se'
export const QV: Record<Quarter, { x: number; z: number }> = { ne: { x: 1, z: -1 }, nw: { x: -1, z: -1 }, sw: { x: -1, z: 1 }, se: { x: 1, z: 1 } }
const ORDER: Quarter[] = ['ne', 'nw', 'sw', 'se']   // each a quarter-turn from the last

/** Half the shared square's side (64 m across: the old r 40 disc's area). */
export const MIDDLE_HALF = 32
/** Garden centre to the Green's centre, along each axis (a multiple of 4 m, so every island grid lines up with the
 *  valley's). 212 for the 300 m plot: start corners still ~30 m off the Green's corner (friends start beside each
 *  other), neighbours' shores ~80 m apart across the hill between them, and everyone grows AWAY from the middle. */
export const D = GREEN_D   // plot.ts holds it (the gate stands on the Green's centre)
/** The square and the paths stand at the gate pad's height. */
export const MIDDLE_Y = 2.0

export interface Mate { quarter: Quarter; name: string; owned: string[] }
export interface Frame {
  mine: Quarter | null
  linked: boolean
  middle: { x: number; z: number; half: number } | null
  /** each mate at their place, turned by `rot` (radians, rotation.y) so their gate corner faces the square */
  mates: (Mate & { x: number; z: number; rot: number; where: Quarter })[]
  /** gate corner → the middle of the square: mine first, then each mate's, then each open spot's */
  paths: Path[]
  /** BETA M52: the quarters no mate holds yet, level mown ground where one will land (never a stand-in garden) */
  open: { x: number; z: number; rot: number; where: Quarter }[]
  meadow: Meadow | null
}

/** The quarter-turn that points a garden's start corner (native: south-west) at the square from quarter `where`. */
function rotFor(where: Quarter): number {
  const want = { x: -QV[where].x, z: -QV[where].z }
  for (let k = 0; k < 4; k++) {
    const r = (k * Math.PI) / 2, p = toWorld(0, 0, r, -1, 1)
    if (Math.abs(p.x - want.x) < 1e-6 && Math.abs(p.z - want.z) < 1e-6) return r
  }
  return 0
}
/** Where a server quarter stands in MY view (mine is always ne). */
const relQuarter = (mine: Quarter, q: Quarter) => ORDER[(ORDER.indexOf(q) - ORDER.indexOf(mine) + 4) % 4]

// ★ BETA M52 (Alex 11-20): the Green is ALWAYS drawn, alone too: `linked` now means "the Green is here" (always true), the
// quarters nobody holds are OPEN SPOTS, and the one main gate stands in the square's centre (plot.ts GATE). No record yet
// (signed out, never linked) = I am ne, as every view is.
export function clusterFrame(mineIn: Quarter | null, mates: Mate[]): Frame {
  const mine: Quarter = mineIn ?? 'ne'
  const others = mates.filter(m => m.quarter !== mine)
  const mx = -D, mz = D                                                   // the square, south-west of me
  const placed = others.map(m => {
    const where = relQuarter(mine, m.quarter)
    return { ...m, where, x: mx + D * QV[where].x, z: mz + D * QV[where].z, rot: Math.round(rotFor(where) * 1e9) / 1e9 }
  })
  const gardens = [{ x: 0, z: 0, rot: 0 }, ...placed]
  const held = new Set<Quarter>(['ne', ...placed.map(m => m.where)])
  const open = ORDER.filter(w => !held.has(w)).map(where => ({ where, x: mx + D * QV[where].x, z: mz + D * QV[where].z, rot: Math.round(rotFor(where) * 1e9) / 1e9 }))
  // each path bends its own way (by where it stands), so four of them read as paths and not as an X
  const bendOf = (x: number, z: number) => ((x > mx) === (z > mz) ? 1 : -1)
  const paths = [...gardens, ...open].map(g => gardenPath(g, mx, mz, bendOf(g.x, g.z)))
  return {
    mine, linked: true,
    middle: { x: mx, z: mz, half: MIDDLE_HALF },
    mates: placed,
    paths,
    open,
    meadow: buildMeadow(gardens, mx, mz, MIDDLE_HALF, paths, open),
  }
}

export const inMiddle = (f: Frame, x: number, z: number) => !!f.middle && Math.abs(x - f.middle.x) <= f.middle.half && Math.abs(z - f.middle.z) <= f.middle.half
export const onPath = (f: Frame, x: number, z: number) => f.paths.some(p => pathDist(p, x, z) <= p.w / 2)
export const onMeadow = (f: Frame, x: number, z: number) => !!f.meadow && Number.isFinite(meadowHeightAt(f.meadow, x, z))
/** The mate whose island (x,z) stands on, if any. */
export const mateAt = (f: Frame, x: number, z: number) =>
  f.mates.find(m => { const l = toLocal(m.x, m.z, m.rot, x, z); return Number.isFinite(plotHeightAt(l.x, l.z)) })

/** The ground of everything the cluster adds, or −Infinity: a mate's island, the meadow (with the square and the paths
 *  in it). My own island is plot.ts's. A mate's island is the same shape as everyone's, so plotHeightAt in their
 *  (turned) frame. */
export function clusterGround(f: Frame, x: number, z: number): number {
  if (!f.linked || !f.meadow) return -Infinity
  const at = (x: number, z: number) => {
    let best = meadowHeightAt(f.meadow!, x, z)
    for (const m of f.mates) { const l = toLocal(m.x, m.z, m.rot, x, z), h = plotHeightAt(l.x, l.z); if (h > best) best = h }
    return best
  }
  const h = at(x, z)
  if (h > -Infinity) return h
  // exactly on a cell edge of a TURNED island, its floor() and the meadow's can round to opposite neighbours and both
  // say "not mine": nudge off the edge (both sides meet at the same height there, so any nudge is right)
  for (const [dx, dz] of [[1e-4, 1e-4], [-1e-4, -1e-4], [1e-4, -1e-4], [-1e-4, 1e-4]]) { const g = at(x + dx, z + dz); if (g > -Infinity) return g }
  return -Infinity
}

/** Every wall the cluster adds beyond my own plot: each mate's mist (their unbought squares stay theirs to open),
 *  turned and placed with their island, so a visitor walks the ground they hold and nothing else. */
export function mateWalls(f: Frame): Box[] {
  return f.mates.flatMap(m => mistWalls(new Set(m.owned)).map(w => {
    const p = toWorld(m.x, m.z, m.rot, w.x0, w.z0), q = toWorld(m.x, m.z, m.rot, w.x1, w.z1)
    return { ...w, x0: Math.min(p.x, q.x), x1: Math.max(p.x, q.x), z0: Math.min(p.z, q.z), z1: Math.max(p.z, q.z) }
  }))
}
