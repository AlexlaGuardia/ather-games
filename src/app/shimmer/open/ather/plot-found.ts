// ── PLOT FOUNDATION (BETA M55 slice 1; Alex 11-20: "a foundation to lift the build off the ground") ─────────────────────
// One setting for the keeper's house (slice 1): none, LOW 0.6 m or HIGH 1.2 m. The ground floor's BUILT rooms stand on a stone
// plinth that tall: every level, wall, column, stair and every piece of furniture / Keepstone / lift INSIDE a built room rides
// up by it (floorAt), and every ground-floor door gets steps down to the ground outside, each under the walker's 0.5 m step.
// Cost: Stone Brick per m² of plinth per 0.6 m (a built house pays the difference when the setting changes; a room built on a
// raised house pays its plinth on the list). PURE: no three, no react.
import type { Box } from '../terrain-world'
import { findRooms, parseKey, WALL_T, type Walls, type Paid } from './plot-walls'

export const FOUND_OPTS = [0, 0.6, 1.2] as const
export type FoundH = (typeof FOUND_OPTS)[number]
export const FOUND_NAME: Record<FoundH, string> = { 0: 'None', 0.6: 'Low', 1.2: 'High' }
export const adoptFound = (v: unknown): FoundH => (FOUND_OPTS as readonly number[]).includes(v as number) ? (v as FoundH) : 0
/** bricks per m² of plinth: one per 0.6 m of height */
export const plinthPerM2 = (h: number) => Math.round(h / 0.6)

export interface Founded { walls?: Walls; paid?: Paid; found?: number }
const cache = new WeakMap<object, Set<string>>()
/** the cells of the ground floor's BUILT rooms: the plinth's top (cached per works object) */
export function plinthCells(w: Founded): Set<string> {
  const hit = cache.get(w); if (hit) return hit
  const paid = w.paid ?? {}, built: Walls = Object.fromEntries(Object.entries(w.walls ?? {}).filter(([, x]) => !x.draft))
  const s = new Set(findRooms(built).filter(r => paid[r.key]).flatMap(r => r.cells.map(([i, j]) => `${i},${j}`)))
  cache.set(w, s); return s
}
export const foundH = (w: Founded) => adoptFound(w.found)
/** the floor under (x, z): the ground, or the ground + the foundation inside a built ground-floor room */
export function floorAt(w: Founded, groundY: number, x: number, z: number): number {
  const h = foundH(w); if (!h) return groundY
  return plinthCells(w).has(`${Math.floor(x)},${Math.floor(z)}`) ? groundY + h : groundY
}

/** the plinth's solids: a block under every built room cell, and under every built ground-floor wall (walls stand on its rim) */
export function plinthBoxes(w: Founded, groundY: number): Box[] {
  const h = foundH(w); if (!h) return []
  const out: Box[] = [], t = WALL_T / 2
  for (const c of plinthCells(w)) { const [i, j] = c.split(',').map(Number); out.push({ x0: i, x1: i + 1, z0: j, z1: j + 1, y0: groundY - 0.5, y1: groundY + h }) }
  for (const [k, x] of Object.entries(w.walls ?? {})) {
    if (x.draft) continue
    const e = parseKey(k)!; const r = e.o === 'h' ? { x0: e.i - t, x1: e.i + 1 + t, z0: e.j - t, z1: e.j + t } : { x0: e.i - t, x1: e.i + t, z0: e.j - t, z1: e.j + 1 + t }
    out.push({ ...r, y0: groundY - 0.5, y1: groundY + h })
  }
  return out
}
export const STEP_DEPTH = 0.45
/** the door steps: outside every built ground-floor DOOR piece, n steps each under 0.5 m, from the ground up to the plinth */
export function doorSteps(w: Founded, groundY: number): Box[] {
  const h = foundH(w); if (!h) return []
  const cells = plinthCells(w), n = Math.ceil(h / 0.45) - 1, out: Box[] = []
  for (const [k, x] of Object.entries(w.walls ?? {})) {
    if (x.draft || x.kind !== 'door') continue
    const e = parseKey(k)!
    // the two cells the edge borders; the step goes on the side that is NOT a room
    const [a, b] = e.o === 'h' ? [[e.i, e.j - 1], [e.i, e.j]] : [[e.i - 1, e.j], [e.i, e.j]]
    const inA = cells.has(`${a[0]},${a[1]}`), inB = cells.has(`${b[0]},${b[1]}`)
    if (inA === inB) continue   // a door between two rooms (or two outsides) has no step
    const sgn = inA ? 1 : -1    // outward along +j (h) / +i (v) when the room is on the A (lower) side
    for (let s = 0; s < n; s++) {
      const top = groundY + h * (n - s) / (n + 1), d0 = WALL_T / 2 + s * STEP_DEPTH, d1 = d0 + STEP_DEPTH
      if (e.o === 'h') { const z0 = e.j + sgn * d0, z1 = e.j + sgn * d1; out.push({ x0: e.i, x1: e.i + 1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: groundY - 0.5, y1: top }) }
      else { const x0 = e.i + sgn * d0, x1 = e.i + sgn * d1; out.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: e.j, z1: e.j + 1, y0: groundY - 0.5, y1: top }) }
    }
  }
  return out
}
/** what setting the foundation from `from` to `to` costs (+) or gives back (−) in Stone Brick, over the built footprint */
export const foundDelta = (w: Founded, from: number, to: number) => plinthCells(w).size * (plinthPerM2(to) - plinthPerM2(from))
