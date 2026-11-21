// ── THE LIFT (BETA M48 slice 1; Alex 11-20: "an elevator that can be built like stations ... the click of a button") ───────────
// Canon RULED-AFK (Magii, athernyx 29b26fa): a LIFT. Cord + counterweight, wood / stone / cord, pegged or lashed, stone
// weights, no metal, no runes; its panel is one peg or pull-cord per floor. Item name = "Lift".
// A lift is a furniture Piece (item 'lift', crafted at the Carpentry station, held on the hotbar, E-set on a plot cell).
// It claims its ONE cell on EVERY level (a shaft): the upper slabs leave a hole there (upperBoxes), and the CAR (a platform)
// stands at one level, `lv` on the Piece (saved; an old save has no lift at all). ride(target) sends the car (the keeper on
// it rides along), call(level) brings it to you. Where the car is NOT, the shaft is shut by a gate (nobody falls in).
// PURE state machine + the live runtime the walker reads (no three, no react).
import { floorAt } from './plot-found'
import type { Box, Shape } from '../terrain-world'
import type { Works, Piece } from './rooms'
import { levelCount, levelsOf, levelBase, slabCells, SLAB_T } from './plot-floors'
import { wallRects } from './plot-walls'

export const LIFT = 'lift', CAR_SPEED = 2.6, GATE_H = 2.0, CELL_INSET = 0.03
export const isLiftPiece = (p: { item: string }) => p.item === LIFT
export const liftsOf = (w: Works): Piece[] => w.pieces.filter(isLiftPiece)
export const cellMid = (v: number) => Math.floor(v) + 0.5
/** M48 (hub 11-20): the highest level the SHAFT reaches: the ground, then each level up while that level has a BUILT room over
 *  the cell (its slab). The frame stops there under a plank cap and the house's roof stays closed over it: no post or car pokes
 *  through a roof, and the car never rides above the top floor it serves. */
export function shaftTop(w: Works, p: { x: number; z: number }): number {
  const i = Math.floor(p.x), j = Math.floor(p.z), lv = levelsOf(w); let top = 0
  for (let k = 1; k < lv.length; k++) { if (slabCells(lv[k]).some(([a, b]) => a === i && b === j)) top = k; else break }
  return top
}
/** how many floors this lift serves (its cords, its gates) */
export const liftLevels = (w: Works, p: { x: number; z: number }) => shaftTop(w, p) + 1
/** which level the car stands at (saved; clamped to the levels its shaft reaches) */
export const carLevel = (w: Works, p: Piece) => Math.max(0, Math.min(shaftTop(w, p), Math.round(p.lv ?? 0)))
/** the plot cells (`i,j`) the shafts claim, on every level */
export const shaftKeys = (w: Works): Set<string> => new Set(liftsOf(w).map(p => `${Math.floor(p.x)},${Math.floor(p.z)}`))
/** the slab holes: `i,j,k` for every level k (1..top) the shaft passes up through; a slab above the top stays whole */
export const shaftHoles = (w: Works): Set<string> => {
  const out = new Set<string>()
  for (const p of liftsOf(w)) for (let k = 1; k <= shaftTop(w, p); k++) out.add(`${Math.floor(p.x)},${Math.floor(p.z)},${k}`)
  return out
}

/** the shaft cells as wall-tool blockers: a wall may not touch a shaft cell on ANY level (the ground already refuses it via the
 *  lift piece's rect; upper levels have no pieces, so they ask this). Same overlap rule as shaftBlocked. */
export const SHAFT_WHY = 'The lift shaft runs up through here.'
export const shaftBlockers = (w: Works): { r: { x0: number; x1: number; z0: number; z1: number }; why: string }[] =>
  [...shaftKeys(w)].map(k => { const [i, j] = k.split(',').map(Number); return { r: { x0: i, x1: i + 1, z0: j, z1: j + 1 }, why: SHAFT_WHY } })
/** a wall on ANY level inside this cell? (the shaft goes up through the whole house) */
export function shaftBlocked(w: Works, x: number, z: number): boolean {
  const i = Math.floor(x), j = Math.floor(z)
  return levelsOf(w).some(lv => wallRects(lv.walls ?? {}).some(b => b.x0 < i + 1 && b.x1 > i && b.z0 < j + 1 && b.z1 > j))
}
/** The state machine's two moves. Both save the car's new level; null = nothing to do (no such lift/level, or already there). */
export function ride(w: Works, id: string, target: number): Works | null {
  const p = w.pieces.find(x => x.id === id && isLiftPiece(x))
  if (!p || !Number.isInteger(target) || target < 0 || target > shaftTop(w, p) || carLevel(w, p) === target) return null
  return { ...w, pieces: w.pieces.map(x => (x.id === id ? { ...x, lv: target } : x)) }
}
/** call(level): the car comes to `level` (the same move as a ride, made from outside the car) */
export const call = (w: Works, id: string, level: number): Works | null => ride(w, id, level)
/** which level a keeper's feet are on (the nearest floor at or below, with a little give) */
export const levelAt = (w: Works, groundY: number, feetY: number) => { let k = 0; for (let i = 1; i < levelCount(w); i++) if (feetY >= groundY + levelBase(i) - 0.6) k = i; return k }

/** the car's floor height at a level */
export const carBase = (groundY: number, k: number) => groundY + levelBase(k)
/** one step of a car toward its level */
export const stepCar = (y: number, to: number, dt: number) => Math.abs(to - y) <= CAR_SPEED * dt ? to : y + Math.sign(to - y) * CAR_SPEED * dt

/** local (across, depth) → plot metres round the piece, as rooms.toWorld turns it (front is local -z) */
export function turnLocal(q: number, lx: number, lz: number): [number, number] {
  const k = ((q % 4) + 4) % 4
  return k === 0 ? [lx, lz] : k === 1 ? [-lz, lx] : k === 2 ? [-lx, -lz] : [lz, -lx]
}
/** the pull-cords of one lift, one per level (left to right, floor 1 first): where each hangs in the world */
export const CORD_LOW = 0.9, CORD_HIGH = 1.55, CORD_STEP = 0.26, PANEL_Z = -0.46
export function cordsOf(p: Piece, carY: number, levels: number): { level: number; x: number; z: number; y0: number; y1: number }[] {
  return Array.from({ length: levels }, (_, k) => {
    const [dx, dz] = turnLocal(p.q, (k - (levels - 1) / 2) * CORD_STEP, PANEL_Z)
    return { level: k, x: p.x + dx, z: p.z + dz, y0: carY + CORD_LOW, y1: carY + CORD_HIGH }
  })
}
/** the cord a view ray (origin o, unit direction d) points at: within `reach` metres and 0.14 m of the cord, nearest first */
export function cordAimed(p: Piece, carY: number, levels: number, o: [number, number, number], d: [number, number, number], reach = 3.4): number | null {
  let best: number | null = null, bestT = Infinity
  for (const c of cordsOf(p, carY, levels)) for (let y = c.y0; y <= c.y1 + 1e-6; y += 0.1) {
    const vx = c.x - o[0], vy = y - o[1], vz = c.z - o[2], t = vx * d[0] + vy * d[1] + vz * d[2]
    if (t < 0 || t > reach) continue
    const px = vx - d[0] * t, py = vy - d[1] * t, pz = vz - d[2] * t
    if (Math.hypot(px, py, pz) < 0.14 && t < bestT) { best = c.level; bestT = t }
  }
  return best
}

/** The walker's solids for the lifts: the car (a platform) at its height, and a gate at every level it is NOT at (only while it stands still). */
export function liftSolids(w: Works, groundY: number, ys: ReadonlyMap<string, number>): Box[] {
  const out: Box[] = []
  for (const p of liftsOf(w)) {
    const g = floorAt(w, groundY, p.x, p.z)   // M55 slice 2: each lift on its own house's foundation
    const lv = carLevel(w, p), rest = carBase(g, lv), y = ys.get(p.id) ?? rest
    const cell = { x0: Math.floor(p.x) + CELL_INSET, x1: Math.floor(p.x) + 1 - CELL_INSET, z0: Math.floor(p.z) + CELL_INSET, z1: Math.floor(p.z) + 1 - CELL_INSET }
    out.push({ ...cell, y0: y - SLAB_T, y1: y })
    if (Math.abs(y - rest) < 0.02) for (let k = 0; k < liftLevels(w, p); k++) if (k !== lv) out.push({ ...cell, y0: k === 0 ? g - 0.5 : carBase(g, k) - SLAB_T, y1: carBase(g, k) + GATE_H })
  }
  return out
}

// ── the live runtime: where each car is NOW, and who rides ──────────────────────────────────────────────────────────────
import type { LocoState } from '../shared/locomotion'
export const liveLift: { get: (() => Works) | null; set: ((w: Works) => void) | null; ys: Map<string, number>; rider: string | null; loco: LocoState | null; groundY: number } =
  { get: null, set: null, ys: new Map(), rider: null, loco: null, groundY: 0 }
if (typeof window !== 'undefined') (window as unknown as { __lift?: unknown }).__lift = liveLift   // read-only probe for lift-check
export const liveLiftBoxes = (x0: number, z0: number, x1: number, z1: number): Box[] => {
  const w = liveLift.get?.(); if (!w || !w.pieces.some(isLiftPiece)) return []
  return liftSolids(w, liveLift.groundY, liveLift.ys).filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0)
}
/** the plot's shape with the lifts' cars and gates added (they move, so they are read live, never memoised) */
export const withLifts = (shape: Shape): Shape => ({ ...shape, solids: (x0, y0, z0, x1, y1, z1) => { const base = shape.solids(x0, y0, z0, x1, y1, z1), lift = liveLiftBoxes(x0, z0, x1, z1); return lift.length ? [...base, ...lift] : base } })
/** every frame (the walker): advance the cars, and carry the keeper who stands on one */
export function liftCarry(lc: LocoState, dt: number, ground: number) {
  const w = liveLift.get?.(), groundY = ground   // the plot's ground; each lift adds its house's foundation (floorAt, M55 slice 2)
  liveLift.loco = lc; liveLift.groundY = groundY
  if (!w) return
  const lifts = liftsOf(w), ids = new Set(lifts.map(p => p.id))
  for (const id of [...liveLift.ys.keys()]) if (!ids.has(id)) liveLift.ys.delete(id)
  for (const p of lifts) { const to = carBase(floorAt(w, groundY, p.x, p.z), carLevel(w, p)); liveLift.ys.set(p.id, stepCar(liveLift.ys.get(p.id) ?? to, to, dt)) }
  const r = liveLift.rider; if (!r) return
  const p = lifts.find(x => x.id === r), y = liveLift.ys.get(r)
  if (!p || y == null || Math.abs(lc.px - p.x) > 0.75 || Math.abs(lc.pz - p.z) > 0.75) { liveLift.rider = null; return }
  lc.py = y; lc.vy = 0; lc.airborne = false
  if (Math.abs(y - carBase(floorAt(w, groundY, p.x, p.z), carLevel(w, p))) < 0.001) liveLift.rider = null
}
/** the keeper stands on this car (cell and height) */
export function onCar(p: Piece, lc: LocoState, y: number) { return Math.abs(lc.px - p.x) < 0.5 && Math.abs(lc.pz - p.z) < 0.5 && Math.abs(lc.py - y) < 0.45 }
/** send a car to a level now: save it, and take the keeper along when they stand on it */
export function rideNow(id: string): (level: number) => boolean {
  return level => {
    const w = liveLift.get?.(), set = liveLift.set; if (!w || !set) return false
    const p = w.pieces.find(x => x.id === id), next = ride(w, id, level); if (!p || !next) return false
    const y = liveLift.ys.get(id) ?? carBase(floorAt(w, liveLift.groundY, p.x, p.z), carLevel(w, p))
    liveLift.rider = liveLift.loco && onCar(p, liveLift.loco, y) ? id : null
    set(next); return true
  }
}
/** E by a lift: bring the car to the keeper's level if it is elsewhere. Returns true when it answered (false = let E open the panel). */
export function callNearest(): boolean {
  const w = liveLift.get?.(), lc = liveLift.loco, set = liveLift.set; if (!w || !lc || !set) return false
  let best: Piece | null = null, bd = 2.2
  for (const p of liftsOf(w)) { const d = Math.hypot(p.x - lc.px, p.z - lc.pz); if (d < bd) { best = p; bd = d } }
  if (!best) return false
  const k = levelAt(w, floorAt(w, liveLift.groundY, best.x, best.z), lc.py), next = call(w, best.id, k)
  if (!next) return false
  liveLift.rider = null; set(next); return true
}
