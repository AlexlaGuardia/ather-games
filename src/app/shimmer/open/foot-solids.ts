// SOLID TOWNS ON FOOT (Alex's towns list, 11-15: "houses + station collide on foot"). The walker walked through every
// house and up through the Station's terrace; this file gives open/on-foot.ts what it needs to stop doing that.
//
// ★ PURE (no three, no react), so on-foot.test.ts drives the same functions the page does.
//
// The houses and the Station are ROTATED (a house faces its street; the field is turned to face its town), and
// terrain-world's Shape only takes axis-aligned boxes. So the solids here are oriented boxes, tested against the body
// as a separate gate on bodyFree (on-foot.ts › footWorld). A gate on bodyFree is enough for walls: locomotion moves x
// and z separately through bodyFree, so a body slides along a wall at any angle. Walls are not climbable; nothing here
// feeds tallFace.
//
// Read-only on the town planner (towns/plan.ts, the play lane's): planTown, FLOOR_H, townRadius. The Station's wall
// grid is play3d/station-field.ts, the same grid the scene draws from, so the collision cannot drift from the picture.

import type { Region } from './region'
import { planTown, townRadius, FLOOR_H, type TownPlan, type Building } from './towns/plan'
import { runeHoldStation, type StationSite } from './towns/rune-hold-core'
import { STATION, STATION_COLS, STATION_ROWS, T } from '../play3d/station-field'
import { BODY_H, BODY_R } from './shared/locomotion'

/** An oriented box: centre, two unit axes in the ground plane, half-extents along them, and a height range. */
export interface OBox { cx: number; cz: number; ux: number; uz: number; vx: number; vz: number; hu: number; hv: number; y0: number; y1: number }

const EPS = 0.01
/** Roofs sit above the walls; no walker clears one, so the box just runs well past the eaves. */
const ROOF_CLEAR = 4
/** play3d/StationScene: the terminal's walls stand WALL_H tall, the field's rim is a parapet. */
const STATION_WALL_H = 7, STATION_RIM_H = 1.4, HULL_H = 8

/** A body (its square footprint, its height) at these feet overlaps the box. */
export function bodyHits(b: OBox, x: number, z: number, feetY: number): boolean {
  if (feetY + EPS >= b.y1 || feetY + BODY_H - EPS <= b.y0) return false
  const dx = x - b.cx, dz = z - b.cz
  // the body's square footprint, turned into the box's frame, reaches at most R·(|cos|+|sin|) along each axis
  const ru = BODY_R * (Math.abs(b.ux) + Math.abs(b.uz)), rv = BODY_R * (Math.abs(b.vx) + Math.abs(b.vz))
  return Math.abs(dx * b.ux + dz * b.uz) < b.hu + ru && Math.abs(dx * b.vx + dz * b.vz) < b.hv + rv
}

/** A house as a box: its footprint (towns/plan.ts › footprint, same axes), from below its plinth to past its roof. */
export function buildingBox(b: Building): OBox {
  const fx = Math.cos(b.yaw), fz = Math.sin(b.yaw)
  return { cx: b.x, cz: b.z, ux: -fz, uz: fx, vx: fx, vz: fz, hu: b.w / 2, hv: b.d / 2, y0: b.y0 - 2, y1: b.y1 + 0.25 + b.floors * FLOOR_H + ROOF_CLEAR }
}

/** Station metres → continent metres (rune-hold-core › stationToWorld, kept as axes so a box can carry them). */
const stationAxes = (s: StationSite) => ({ ux: Math.cos(s.yaw), uz: Math.sin(s.yaw), vx: -Math.sin(s.yaw), vz: Math.cos(s.yaw) })

/** The rim cells the town's stair arrives through. The scene draws a parapet there today; a walker has to get in. */
export function stationGapCells(): Set<string> {
  const d = STATION.doors.town, out = new Set<string>()
  for (let dz = 0; dz < d.h; dz++) out.add(`0,${d.z + dz}`)
  return out
}

/** The Station's walls, hulls and rim as boxes: each grid row's run of WALL cells becomes one box. Cells are 1 m and
 *  centred on whole station metres (the scene and the terrace both put cell (x, z) at x, z). */
export function stationBoxes(s: StationSite): OBox[] {
  const { ux, uz, vx, vz } = stationAxes(s), g = STATION.grid, gap = stationGapCells(), out: OBox[] = []
  const hull = (x: number, z: number) => STATION.ships.some(h => x >= h.x0 && x <= h.x1 && z >= h.z0 && z <= h.z1)
  const height = (x: number, z: number) => hull(x, z) ? HULL_H : (x === 0 || z === 0 || x === STATION_COLS - 1 || z === STATION_ROWS - 1) ? STATION_RIM_H : STATION_WALL_H
  for (let z = 0; z < g.length; z++) {
    let x = 0
    while (x < g[z].length) {
      if (g[z][x] !== T.WALL || gap.has(`${x},${z}`)) { x++; continue }
      const h = height(x, z)
      let e = x
      while (e + 1 < g[z].length && g[z][e + 1] === T.WALL && !gap.has(`${e + 1},${z}`) && height(e + 1, z) === h) e++
      const gx = (x + e) / 2, gz = z
      out.push({ cx: s.x + gx * ux + gz * vx, cz: s.z + gx * uz + gz * vz, ux, uz, vx, vz, hu: (e - x + 1) / 2, hv: 0.5, y0: s.level - 0.5, y1: s.level + h })
      x = e + 1
    }
  }
  return out
}

/** The Station's raised ground: the terrace's top over the field, and the stair up its west face to the town door
 *  (Towns.tsx › StationField draws both: the terrace from base to level, the stair at 0.55 rise per metre).
 *  Returns -Infinity where the Station adds nothing. */
export function stationGround(s: StationSite, x: number, z: number): number {
  const dx = x - s.x, dz = z - s.z, c = Math.cos(s.yaw), sn = Math.sin(s.yaw)
  const gx = dx * c + dz * sn, gz = -dx * sn + dz * c
  if (gx >= -0.5 && gx < STATION_COLS - 0.5 && gz >= -0.5 && gz < STATION_ROWS - 0.5) return s.level
  const h = s.level - s.base
  if (h <= 0.6) return -Infinity
  const L = h / 0.55, zc = STATION.doors.town.z + STATION.doors.town.h / 2 - 0.5
  if (gx < -0.5 && gx >= -L - 0.5 && Math.abs(gz - zc) <= 2) return s.level - h * ((-0.5 - gx) / L)
  return -Infinity
}

// ── the town plans: one per town, made when a walker comes near, shared by everything that asks ──

interface Town { i: number; x: number; z: number; r: number; boxes: OBox[] | null; x0: number; z0: number; x1: number; z1: number }
export interface TownSolids { towns: Town[]; station: StationSite | null; stationBoxes: OBox[] }

/** Plans made here (or handed in by the page's renderer) — the planner is not cheap: Rune Hold is ~0.3 s. */
const planCache = new WeakMap<Region, Map<number, TownPlan>>()
export function cachedPlan(R: Region, i: number): TownPlan {
  let m = planCache.get(R)
  if (!m) planCache.set(R, m = new Map())
  let p = m.get(i)
  if (!p) m.set(i, p = planTown(R, R.meta.places[i], i))
  return p
}

/** How far past a town's reach a building may stand, before its plan says exactly (lanes run out past the disc). */
const PRE_PLAN_PAD = 40
/** Plan a town ahead of the walker once it is this close to the town's reach. */
export const PREFETCH = 140

export function townSolids(R: Region): TownSolids {
  const js = R.meta.network?.junctions ?? []
  const towns: Town[] = []
  R.meta.places.forEach((p, i) => {
    const r = townRadius(p)
    if (r <= 0) return
    const sq = p.kind === 'spot' ? undefined : js.find(j => j.kind === 'square' && j.place === p.id)
    const x = sq?.x ?? p.x, z = sq?.z ?? p.z, pad = r + PRE_PLAN_PAD
    towns.push({ i, x, z, r, boxes: null, x0: x - pad, z0: z - pad, x1: x + pad, z1: z + pad })
  })
  const station = runeHoldStation(R)
  return { towns, station, stationBoxes: station ? stationBoxes(station) : [] }
}

function planInto(R: Region, t: Town) {
  const plan = cachedPlan(R, t.i)
  t.boxes = plan.buildings.map(buildingBox)
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
  for (const b of t.boxes) {
    const ex = Math.abs(b.ux) * b.hu + Math.abs(b.vx) * b.hv, ez = Math.abs(b.uz) * b.hu + Math.abs(b.vz) * b.hv
    x0 = Math.min(x0, b.cx - ex); x1 = Math.max(x1, b.cx + ex); z0 = Math.min(z0, b.cz - ez); z1 = Math.max(z1, b.cz + ez)
  }
  if (t.boxes.length) { t.x0 = x0 - 1; t.z0 = z0 - 1; t.x1 = x1 + 1; t.z1 = z1 + 1 } else { t.x0 = t.x1 = t.x; t.z0 = t.z1 = t.z }
}

/** Plan at most ONE nearby town ahead of the walker (nearest first), so a stall is one town's worth, never the map's. */
export function prefetchTowns(R: Region, ts: TownSolids, x: number, z: number) {
  let best: Town | null = null, bd = Infinity
  for (const t of ts.towns) {
    if (t.boxes) continue
    const d = Math.hypot(t.x - x, t.z - z) - t.r
    if (d < PREFETCH && d < bd) { best = t; bd = d }
  }
  if (best) planInto(R, best)
}

/** Does a body at these feet stand inside a house or a Station wall? Plans a town on the spot if the body is already
 *  inside its reach and the prefetch has not got there (a walker set down in a town: the step out of a car). */
export function solidHit(R: Region, ts: TownSolids, x: number, z: number, feetY: number): boolean {
  for (const t of ts.towns) {
    if (x < t.x0 || x > t.x1 || z < t.z0 || z > t.z1) continue
    if (!t.boxes) planInto(R, t)
    if (x < t.x0 || x > t.x1 || z < t.z0 || z > t.z1) continue
    for (const b of t.boxes!) if (bodyHits(b, x, z, feetY)) return true
  }
  for (const b of ts.stationBoxes) if (bodyHits(b, x, z, feetY)) return true
  return false
}

/** A body that ended a tick inside a box (a land mantle onto the hill a house is buried in, a spawn) is moved out
 *  through the box's nearest face, its speed into that face dropped. Every move is gated by bodyFree, so this is the
 *  backstop, not the wall: without it a body inside a box could never move again. Returns whether it moved. */
export function pushOut(R: Region, ts: TownSolids, s: { px: number; py: number; pz: number; hvx: number; hvz: number }): boolean {
  for (let k = 0; k < 4; k++) {
    const b = boxAt(ts, s.px, s.pz, s.py)
    if (!b) return k > 0
    const dx = s.px - b.cx, dz = s.pz - b.cz, u = dx * b.ux + dz * b.uz, v = dx * b.vx + dz * b.vz
    const ru = BODY_R * (Math.abs(b.ux) + Math.abs(b.uz)), rv = BODY_R * (Math.abs(b.vx) + Math.abs(b.vz))
    const pu = b.hu + ru - Math.abs(u), pv = b.hv + rv - Math.abs(v)
    const [ax, az, d] = pu < pv ? [b.ux, b.uz, (pu + 0.02) * Math.sign(u || 1)] : [b.vx, b.vz, (pv + 0.02) * Math.sign(v || 1)]
    s.px += ax * d; s.pz += az * d
    const into = s.hvx * ax + s.hvz * az
    if (into * d < 0) { s.hvx -= ax * into; s.hvz -= az * into }
  }
  return true
  function boxAt(t: TownSolids, x: number, z: number, y: number): OBox | null {
    for (const town of t.towns) {
      if (!town.boxes || x < town.x0 || x > town.x1 || z < town.z0 || z > town.z1) continue
      for (const b of town.boxes) if (bodyHits(b, x, z, y)) return b
    }
    for (const b of t.stationBoxes) if (bodyHits(b, x, z, y)) return b
    return null
  }
}
