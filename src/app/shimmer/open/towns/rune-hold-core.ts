// RUNE HOLD'S CORE on the continent = the town Alex laid out in play3d, stamped at the continent square
// (Jin play lane, 2026-11-15).
//
// ★ PURE. Reads the grid Alex placed (`world/tilemap.ts` RUNE_HOLD, the same grid play3d walks and
// `play3d/rune-hold-look.ts` reads), never a second copy of the layout: every 4-connected run of building tiles is one
// block (`blocksOf`), path tiles are the paving, FRONTS name the storefronts (the Kindled Mug, the Forgelight Inn,
// Eyuun's Bookstore, the Smithy, the Spirit Corner, the Passage door in the hillside, the Travelers Station) and HOMES
// are the regulars' cottages up the north road (Alex placed those, 09-27).
//
// ONE CELL = ONE METRE (play3d's body is the voxel body, eye 1.62: metrics.ts). A grid block's wall height is in the
// same metres; it maps to whole floors of the continent kit (FLOOR_H).
//
// ── WHICH WAY IT FACES ─────────────────────────────────────────────────────────────────────────────────────────────
// play3d's Rune Hold stands on its own flat ground; the continent's stands on a real hillside with roads already
// running through it. ★ THE PASSAGE DECIDES IT: in the grid the Passage is a door in the hillside on the town's east
// edge (FRONTS: x 84.5, facing west into town), and on the continent the Passage BORE's portal is 21 m off the
// square at bearing 163° (the west arm IS the bore road, tools/worldmap/tunnels.json). So the grid turns until its
// east points at the portal: the town's Passage door is the real tunnel mouth, and the real spine above the bore
// stands where play3d drew its hillside, which is why the drawn hillside block is NOT stamped (a 60 m wall of
// fake rock in front of a real mountain). A block a road still runs through is NUDGED the least distance that
// clears it (`nudge`), so the layout keeps its shape and every front keeps its side of the square.
// `CORE_YAW` is one number: a map-placement call (Alex's) made from canon's own geometry. Turn it here.

import { RUNE_HOLD } from '../../world/tilemap'
import { blocksOf, FRONTS, HOMES } from '../../play3d/rune-hold-look'
import { nearestRoad, nearPad, type Region, type RegionJunction } from '../region'
import { type Building, streetAtDoor, DOOR_STEP } from './plan'

const GRID = RUNE_HOLD as number[][]
const PATH = 3
const id = (v: number | undefined) => (v === undefined || v < 0 ? -1 : v & 0xff)
/** the square's middle in grid cells (the open path field between the four corner blocks) */
export const GRID_SQUARE: [number, number] = [49.5, 47.5]
/** the stamp's bearing on the continent (rad). Chosen by `bestYaw` on the live map; pinned so it cannot drift when
 *  the generator around it is tuned. Turn it here and the whole core turns with it. TODO(rune-hold-placement): Alex. */
export const CORE_YAW = 163 * Math.PI / 180

export interface CoreTransform { cx: number; cz: number; yaw: number }
/** grid cell → continent metres */
export function toWorld(t: CoreTransform, gx: number, gz: number): [number, number] {
  const dx = gx - GRID_SQUARE[0], dz = gz - GRID_SQUARE[1], c = Math.cos(t.yaw), s = Math.sin(t.yaw)
  return [t.cx + dx * c - dz * s, t.cz + dx * s + dz * c]
}
/** continent metres → grid cell */
export function toGrid(t: CoreTransform, x: number, z: number): [number, number] {
  const dx = x - t.cx, dz = z - t.cz, c = Math.cos(t.yaw), s = Math.sin(t.yaw)
  return [dx * c + dz * s + GRID_SQUARE[0], -dx * s + dz * c + GRID_SQUARE[1]]
}
/** inside the authored grid (with a margin): the generator leaves this ground to the core */
export function inCore(t: CoreTransform, x: number, z: number, margin = 4): boolean {
  const [gx, gz] = toGrid(t, x, z), C = GRID[0].length, R = GRID.length
  return gx > 6 - margin && gx < C + margin && gz > 10 - margin && gz < R + margin
}

export interface CoreBuilding extends Building { /** placed by the ring fallback, off its grid side */ moved?: boolean }
export interface Core { t: CoreTransform; buildings: CoreBuilding[]; paving: [number, number][]; }

const STOREY = 2.1   // play3d's storey (rune-hold-look: "two storeys of stone" ≈ 4.2 m)

export function stampCore(R: Region, t: CoreTransform): Core {
  const out: CoreBuilding[] = []
  for (const b of blocksOf(GRID)) {
    if (b.kind === 'kiosk' || b.kind === 'hillside') continue
    const gx = (b.x0 + b.x1 + 1) / 2, gz = (b.z0 + b.z1 + 1) / 2
    const w = b.x1 - b.x0 + 1, d = b.z1 - b.z0 + 1
    const [x, z] = toWorld(t, gx, gz)
    // the facade faces the square: the grid side nearest the square's middle; plan.ts' yaw is the heading toward the
    // street and w runs along it
    const vx = GRID_SQUARE[0] - gx, vz = GRID_SQUARE[1] - gz
    const alongX = Math.abs(vz) >= Math.abs(vx)            // facing ±z: the long side runs along x
    const fgx = alongX ? 0 : Math.sign(vx), fgz = alongX ? Math.sign(vz) : 0
    const c = Math.cos(t.yaw), s = Math.sin(t.yaw)
    const yaw = Math.atan2(fgx * s + fgz * c, fgx * c - fgz * s)
    const front = FRONTS.find(f => f.x >= b.x0 - 1 && f.x <= b.x1 + 1 && f.z >= b.z0 - 1 && f.z <= b.z1 + 1)
    const home = HOMES.some(h => h.x >= b.x0 - 1 && h.x <= b.x1 + 1 && h.z >= b.z0 - 1 && h.z <= b.z1 + 1)
    let y0 = Infinity, y1 = -Infinity
    for (const [u, v] of [[b.x0, b.z0], [b.x1 + 1, b.z0], [b.x1 + 1, b.z1 + 1], [b.x0, b.z1 + 1], [gx, gz]]) {
      const [px, pz] = toWorld(t, u, v), y = R.heightAt(px, pz)
      y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    out.push({
      x, z, yaw, w: alongX ? w : d, d: alongX ? d : w,
      floors: Math.max(1, Math.round(b.h / STOREY)),
      y0, y1, kind: home ? 'cottage' : front?.kind === 'station' ? 'hall' : 'house', rim: 0, v: ((b.x0 * 7 + b.z0 * 13) % 17) / 17,
      front: front?.id, core: true,
    })
  }
  // ── nudge: a block a road or the water runs through slides the least distance (outward from the square first,
  // then along it) that clears every corner. It keeps its bearing, so the layout keeps its shape.
  const placed: CoreBuilding[] = []
  for (const b of out) {
    const dx = b.x - t.cx, dz = b.z - t.cz, L = Math.hypot(dx, dz) || 1, ox = dx / L, oz = dz / L
    let best: CoreBuilding | null = null
    search: for (const step of [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 26, 30, 35, 40, 46]) {
      for (const [a, c] of step === 0 ? [[0, 0]] : [[1, 0], [0, 1], [0, -1], [0.7, 0.7], [0.7, -0.7], [-1, 0]]) {
        const x = b.x + (ox * a - oz * c) * step, z = b.z + (oz * a + ox * c) * step
        const cand = { ...b, x, z }
        if (clear(R, cand) && (step === 0 || !onPaving(t, cand)) && !placed.some(o => overlaps(cand, o))) { best = cand; break search }
      }
    }
    // fallback: walk round the square at the block's own distance (then a little farther) and take the nearest
    // bearing that is clear, turned to face the square. The front keeps the square; it may lose its side of it.
    // (11-15: the Spirit Corner's side of the grid lands in the lake once the Passage faces the bore.)
    if (!best) {
      const a0 = Math.atan2(dz, dx)
      ring: for (let rr = L; rr < L + 34; rr += 4) for (let k = 1; k <= 12; k++) for (const sg of [1, -1]) {
        const a = a0 + sg * k * Math.PI / 12, x = t.cx + Math.cos(a) * rr, z = t.cz + Math.sin(a) * rr
        const cand = { ...b, x, z, yaw: a + Math.PI, moved: true }
        if (clear(R, cand) && !onPaving(t, cand) && !placed.some(o => overlaps(cand, o))) { best = cand; break ring }
      }
    }
    if (best) {
      // ★ CARVED INTO THE HILLSIDE (canon): the floor line is the ground at the FRONT, the side facing the square,
      // and a back that stands higher is simply buried in the hill. On the spine's foot a block can sit across a 25 m
      // rise; the old rule (floor at the highest corner) stood the Mug on a 25 m tower of plinth.
      // ★ 11-16 (Alex: "no way to reach the entrances"): the front's HIGHEST point still stood a door up the wall where
      // the square slopes along a frontage (the Bookstore's step was 3 m over the street). The floor is the street AT
      // THE DOOR now (plan.ts streetAtDoor + one step), the same rule as every generated house.
      const g = groundSpan(R, best)
      const floor = streetAtDoor(R, best) + DOOR_STEP
      placed.push({ ...best, y0: Math.min(g[0], floor - 0.25), y1: floor - 0.25 })
    }
  }
  out.length = 0; out.push(...placed)
  const paving: [number, number][] = []
  GRID.forEach((row, gz) => row.forEach((v, gx) => { if (id(v) === PATH) paving.push(toWorld(t, gx + 0.5, gz + 0.5)) }))
  return { t, buildings: out, paving }
}

function cornersOf(b: Pick<Building, 'x' | 'z' | 'yaw' | 'w' | 'd'>, m = 0): [number, number][] {
  const fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), ax = -fz, az = fx, W = b.w + 2 * m, D = b.d + 2 * m
  return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, 0], [0, 0.5], [0, -0.5], [0.5, 0], [-0.5, 0]].map(([u, v]) => [b.x + ax * u * W + fx * v * D, b.z + az * u * W + fz * v * D])
}
/** does a moved block stand on the grid's own streets */
function onPaving(t: CoreTransform, b: Building): boolean {
  return cornersOf(b, 0.5).some(([x, z]) => { const [gx, gz] = toGrid(t, x, z); return id(GRID[Math.floor(gz)]?.[Math.floor(gx)]) === PATH })
}
function clear(R: Region, b: Building): boolean {
  return cornersOf(b).every(([x, z]) => {
    const nr = nearestRoad(R, x, z)
    return !(nr.road && nr.d < nr.road.width / 2 + 1) && !nearPad(R, x, z, 0.5) && R.heightAt(x, z) >= 1.5 && !(R.tunnelAt(x, z) && R.tunnelAt(x, z)!.cover < 12)
  })
}
function groundSpan(R: Region, b: Building): [number, number] {
  let y0 = Infinity, y1 = -Infinity
  for (const [x, z] of cornersOf(b)) { const y = R.heightAt(x, z); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  return [y0, y1]
}
function overlaps(a: Building, b: Building): boolean {
  // separating axis on the two footprints, a metre apart
  const A = cornersOf(a, 0.5).slice(0, 4), B = cornersOf(b, 0.5).slice(0, 4)
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % 4], nx = z0 - z1, nz = x1 - x0
    const pa = A.map(([x, z]) => x * nx + z * nz), pb = B.map(([x, z]) => x * nx + z * nz)
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false
  }
  return true
}

/** how badly the core sits at a bearing (lower is better): roads and water under buildings, ground step, and the
 *  hillside facing downhill */
export function fitScore(R: Region, sq: RegionJunction, yaw: number): number {
  const t = { cx: sq.x, cz: sq.z, yaw }
  const core = stampCore(R, t)
  let bad = 0
  for (const b of core.buildings) {
    const fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), ax = -fz, az = fx
    for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, 0], [0, 0.5], [0, -0.5], [0.5, 0], [-0.5, 0]]) {
      const x = b.x + ax * u * b.w + fx * v * b.d, z = b.z + az * u * b.w + fz * v * b.d
      const nr = nearestRoad(R, x, z)
      if ((nr.road && nr.d < nr.road.width / 2 + 1) || nearPad(R, x, z, 0)) bad += 10
      if (R.heightAt(x, z) < 1.5) bad += 10
    }
    bad += Math.max(0, b.y1 - b.y0 - 3)
  }
  // canon: carved INTO a hillside. The grid's hillside is its east edge (x 83-97); it should stand uphill of the square
  const [ex, ez] = toWorld(t, 90, 50), [wx, wz] = toWorld(t, 20, 50)
  bad -= Math.max(-10, Math.min(10, (R.heightAt(ex, ez) - R.heightAt(wx, wz)) / 3))
  return bad
}
export function bestYaw(R: Region, sq: RegionJunction): { yaw: number; score: number }[] {
  const out: { yaw: number; score: number }[] = []
  for (let k = 0; k < 72; k++) { const yaw = k / 72 * Math.PI * 2; out.push({ yaw, score: fitScore(R, sq, yaw) }) }
  return out.sort((a, b) => a.score - b.score)
}

// ── THE TRAVELERS STATION'S FIELD (canon 09-26: "a spaceport, and it is big: several berths, a field, a terminal") ──
// play3d already built it: `play3d/station-field.ts` (80 x 50 m: the stone terminal west with the town door in its west
// wall, the range door north, the Crucible's south; a paved field east with six berths in two rows; a ship at every
// seated berth) and `StationScene.tsx` draws it. The continent draws the SAME scene, placed beyond Rune Hold's
// Station building: on the flattest clear ground near it, turned so the terminal's town door faces the town, on a
// stone terrace built up to one level (a field has to be flat; a hillside is not).
import { STATION_COLS, STATION_ROWS, STATION } from '../../play3d/station-field'

export interface StationSite { x: number; z: number; yaw: number; level: number; base: number; score?: number; dist?: number; bad?: number }
/** station-field metres → continent metres, (0,0) = the field's north-west corner */
export function stationToWorld(s: StationSite, gx: number, gz: number): [number, number] {
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw)
  return [s.x + gx * c - gz * sn, s.z + gx * sn + gz * c]
}
export function inStation(s: StationSite, x: number, z: number, margin = 3): boolean {
  const dx = x - s.x, dz = z - s.z, c = Math.cos(s.yaw), sn = Math.sin(s.yaw)
  const gx = dx * c + dz * sn, gz = -dx * sn + dz * c
  return gx > -margin && gx < STATION_COLS + margin && gz > -margin && gz < STATION_ROWS + margin
}
/** where the terminal's town door is, in station metres (the road from the town comes in here) */
export const STATION_TOWN_DOOR: [number, number] = [STATION.doors.town.x, STATION.doors.town.z + STATION.doors.town.h / 2]

export function placeStation(R: Region, core: Core): StationSite | null {
  const st = core.buildings.find(b => b.front === 'station')
  if (!st) return null
  // the Station building's front door, in the world: the field's town door should be near it and face it
  const fx = Math.cos(st.yaw), fz = Math.sin(st.yaw)
  const door: [number, number] = [st.x + fx * (st.d / 2 + 4), st.z + fz * (st.d / 2 + 4)]
  // the field lies BEYOND the building, away from the square
  const away = Math.atan2(st.z - core.t.cz, st.x - core.t.cx)
  let best: { s: StationSite; score: number } | null = null
  for (let da = -1.4; da <= 1.4001; da += 0.175) for (let dist = 40; dist <= 200; dist += 20) {
    // the town door's world position for this candidate, and the field turned so the door faces back to the town
    const a = away + da, tx = st.x + Math.cos(a) * dist, tz = st.z + Math.sin(a) * dist
    const yaw = a           // field +x points away from the town, so the terminal (west) stands toward it
    const c = Math.cos(yaw), sn = Math.sin(yaw)
    const ox = tx - (STATION_TOWN_DOOR[0] * c - STATION_TOWN_DOOR[1] * sn), oz = tz - (STATION_TOWN_DOOR[0] * sn + STATION_TOWN_DOOR[1] * c)
    const s: StationSite = { x: ox, z: oz, yaw, level: 0, base: 0 }
    let bad = 0, lo = Infinity, hi = -Infinity
    for (let gz = 0; gz <= STATION_ROWS; gz += 10) for (let gx = 0; gx <= STATION_COLS; gx += 10) {
      const [x, z] = stationToWorld(s, gx, gz), y = R.heightAt(x, z)
      if (!Number.isFinite(y) || y < 1.5) { bad += 10; continue }
      const nr = nearestRoad(R, x, z)
      if ((nr.road && nr.d < nr.road.width / 2 + 2) || nearPad(R, x, z, 2)) bad += 10
      if (inCore(core.t, x, z, 2)) bad += 10
      if (R.tunnelAt(x, z) && R.tunnelAt(x, z)!.cover < 12) bad += 10
      lo = Math.min(lo, y); hi = Math.max(hi, y)
    }
    const score = bad + (hi - lo) * 1.5 + dist * 0.05
    if (!best || score < best.score) best = { s: { ...s, level: hi + 0.3, base: lo - 1, score, dist, bad } as StationSite, score }
  }
  return best && best.score < 400 ? best.s : null
}

/** Rune Hold's Station site, once per map (the planner and the tree scatter both ask; the search is not free) */
const siteCache = new WeakMap<Region, StationSite | null>()
export function runeHoldStation(R: Region): StationSite | null {
  if (siteCache.has(R)) return siteCache.get(R)!
  const sq = (R.meta.network?.junctions ?? []).find(j => j.kind === 'square' && j.place === 'rune-hold')
  const s = sq ? placeStation(R, stampCore(R, { cx: sq.x, cz: sq.z, yaw: CORE_YAW })) : null
  siteCache.set(R, s)
  return s
}
