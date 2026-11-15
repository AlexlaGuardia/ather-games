// GARDEN CLUSTERS, IN THE OPEN WORLD — the geometry (Alex 11-15: "it should work the same: if no friends have joined
// the clouds hide the expansion, but once a friend joins they are linked together and the communal space opens in the
// middle as a bridge between plots. Pretty much the same idea"). [OPEN] in CANON_GAPS (reverses ather-rework §3):
// built against Alex's word with NEUTRAL words ("the shared ground", "a road"); the retired names stay retired
// until Magii rules.
//
// ★ THE LAYOUT IS ALEX'S SKETCH (11-15, pen on paper): the shared ground is a SQUARE in the middle, streets run round
// it in a # (two each way), and the gardens sit on the four corner cells of the #. Every garden's start corner and
// its MAIN GATE face the shared square, so you step out of your gate straight onto a crossroads. The # cells on the
// square's four sides stay open sky.
//
// THE FRAME. Everyone sees THEMSELVES in the north-east, with the square to their south-west, the way the sketch is
// drawn: the cluster turns round you, your garden never moves or turns (everything position-keyed you own, squares,
// the gate, Greg, stays put). The server's quarters only say who stands where RELATIVE to whom: mine maps to ne and
// the rest turn with it. A mate's garden is the same island as everyone's, turned by a quarter-turn so its gate corner
// faces the square (three.js rotation.y: world = centre + (c·x + s·z, −s·x + c·z)).
// ALONE (or the only one in the frame): nothing but your island; the clouds hide the rest.
// LINKED (two or more): the square, the streets, and a short RAMP from each garden's gate corner to its crossroads.
// A mate's plot is read-only (Alex 09-23); this file only says where things are and what you can stand on.
//
// ★ PURE. The server record (src/lib/accounts/clusters.ts, consent-only joining, the four landlord guards) is reused
// as is; a member's quarter comes from there.

import type { Box } from '../terrain-world'
import { PLOT_R, plotHeightAt, mistWalls, GATE } from './plot'

export type Quarter = 'ne' | 'nw' | 'sw' | 'se'
export const QV: Record<Quarter, { x: number; z: number }> = { ne: { x: 1, z: -1 }, nw: { x: -1, z: -1 }, sw: { x: -1, z: 1 }, se: { x: 1, z: 1 } }
const ORDER: Quarter[] = ['ne', 'nw', 'sw', 'se']   // each a quarter-turn from the last

/** The island's shore reaches PLOT_R + ~4.1 m of wobble; streets keep a gap past that, so no shore runs under a road. */
export const SHORE_GAP = 4
export const ROAD_W = 6
/** Half the shared square's side (64 m across: the old r 40 disc's area). */
export const MIDDLE_HALF = 32
/** Garden centre to the square's centre, along each axis: shore + gap + a street + half the square (= 130). */
export const D = PLOT_R + 4 + SHORE_GAP + ROAD_W + MIDDLE_HALF
export const RAMP_W = 4
/** The square, the streets and the ramps' far ends stand at the gate pad's height. */
export const MIDDLE_Y = 2.0
export const ROAD_Y = MIDDLE_Y

export interface Mate { quarter: Quarter; name: string; owned: string[] }
export interface Seg { ax: number; az: number; ay: number; bx: number; bz: number; by: number; w: number }
export interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface Frame {
  mine: Quarter | null
  linked: boolean
  middle: { x: number; z: number; half: number } | null
  /** each mate at their place, turned by `rot` (radians, rotation.y) so their gate faces the square */
  mates: (Mate & { x: number; z: number; rot: number; where: Quarter })[]
  /** the four streets of the #, at ROAD_Y */
  streets: Rect[]
  /** gate corner → crossroads: mine first, then each mate's */
  ramps: Seg[]
}

const toWorld = (cx: number, cz: number, rot: number, lx: number, lz: number) => {
  const c = Math.cos(rot), s = Math.sin(rot)
  return { x: cx + c * lx + s * lz, z: cz - s * lx + c * lz }
}
const toLocal = (cx: number, cz: number, rot: number, x: number, z: number) => {
  const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dz = z - cz
  return { x: c * dx - s * dz, z: s * dx + c * dz }
}
/** The quarter-turn that points a garden's gate corner (native: south-west) at the square from quarter `where`. */
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

/** A garden's ramp: from just outside its gate, along the diagonal, to the middle of its crossroads. */
function rampFor(cx: number, cz: number, rot: number, mx: number, mz: number): Seg {
  const out = { x: -Math.SQRT1_2, z: Math.SQRT1_2 }                       // the gate corner's outward diagonal, native
  const a = { x: GATE.x + out.x * 3, z: GATE.z + out.z * 3 }
  const A = toWorld(cx, cz, rot, a.x, a.z)
  const cross = MIDDLE_HALF + ROAD_W / 2                                   // the crossroads' centre, off the square's
  const dir = { x: Math.sign(cx - mx), z: Math.sign(cz - mz) }
  return { ax: A.x, az: A.z, ay: plotHeightAt(a.x, a.z), bx: mx + dir.x * cross, bz: mz + dir.z * cross, by: ROAD_Y, w: RAMP_W }
}

export function clusterFrame(mine: Quarter | null, mates: Mate[]): Frame {
  const others = mates.filter(m => m.quarter !== mine)
  if (!mine || others.length === 0) return { mine, linked: false, middle: null, mates: [], streets: [], ramps: [] }
  const mx = -D, mz = D                                                   // the square, south-west of me
  const placed = others.map(m => {
    const where = relQuarter(mine, m.quarter)
    return { ...m, where, x: mx + D * QV[where].x, z: mz + D * QV[where].z, rot: rotFor(where) }
  })
  // the # : two streets each way, hugging the square, running out to the far shores
  const a = MIDDLE_HALF, b = MIDDLE_HALF + ROAD_W, L = D + PLOT_R + 8
  const streets: Rect[] = [
    { x0: mx + a, x1: mx + b, z0: mz - L, z1: mz + L }, { x0: mx - b, x1: mx - a, z0: mz - L, z1: mz + L },
    { x0: mx - L, x1: mx + L, z0: mz + a, z1: mz + b }, { x0: mx - L, x1: mx + L, z0: mz - b, z1: mz - a },
  ]
  return {
    mine, linked: true,
    middle: { x: mx, z: mz, half: MIDDLE_HALF },
    mates: placed,
    streets,
    ramps: [rampFor(0, 0, 0, mx, mz), ...placed.map(m => rampFor(m.x, m.z, m.rot, mx, mz))],
  }
}

/** Distance from (x,z) to a segment, and how far along it (0..1). */
function along(s: Seg, x: number, z: number) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, L = dx * dx + dz * dz
  const t = L > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L)) : 0
  return { d: Math.hypot(s.ax + dx * t - x, s.az + dz * t - z), t }
}
export const onSeg = (s: Seg, x: number, z: number) => along(s, x, z).d <= s.w / 2
const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1
export const inMiddle = (f: Frame, x: number, z: number) => !!f.middle && Math.abs(x - f.middle.x) <= f.middle.half && Math.abs(z - f.middle.z) <= f.middle.half
export const onRoad = (f: Frame, x: number, z: number) => f.streets.some(r => inRect(r, x, z)) || f.ramps.some(s => onSeg(s, x, z))
/** The mate whose island (x,z) stands on, if any. */
export const mateAt = (f: Frame, x: number, z: number) =>
  f.mates.find(m => { const l = toLocal(m.x, m.z, m.rot, x, z); return Number.isFinite(plotHeightAt(l.x, l.z)) })

/** The ground of everything the cluster adds, or −Infinity: a mate's island, the square, a street, a ramp. (My own
 *  island is plot.ts's.) A mate's island is the same shape as everyone's, so plotHeightAt in their (turned) frame. */
export function clusterGround(f: Frame, x: number, z: number): number {
  if (!f.linked) return -Infinity
  let best = -Infinity
  for (const r of f.ramps) { const a = along(r, x, z); if (a.d <= r.w / 2) best = Math.max(best, r.ay + (r.by - r.ay) * a.t) }
  if (inMiddle(f, x, z) || f.streets.some(r => inRect(r, x, z))) best = Math.max(best, MIDDLE_Y)
  for (const m of f.mates) { const l = toLocal(m.x, m.z, m.rot, x, z), h = plotHeightAt(l.x, l.z); if (h > best) best = h }
  return best
}

/** Every wall the cluster adds beyond my own plot: each mate's mist (their unbought squares stay theirs to open),
 *  turned and placed with their island, so a visitor walks the ground they hold and nothing else. */
export function mateWalls(f: Frame): Box[] {
  return f.mates.flatMap(m => mistWalls(new Set(m.owned)).map(w => {
    const p = toWorld(m.x, m.z, m.rot, w.x0, w.z0), q = toWorld(m.x, m.z, m.rot, w.x1, w.z1)
    return { ...w, x0: Math.min(p.x, q.x), x1: Math.max(p.x, q.x), z0: Math.min(p.z, q.z), z1: Math.max(p.z, q.z) }
  }))
}
