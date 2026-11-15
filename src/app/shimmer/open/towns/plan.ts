// TOWN PLANS for the continent: streets first, buildings on the streets (Jin play lane, 2026-11-15).
//
// ★ PURE. No three, no react. `planTown(R, place)` says where a town's lanes run and where every building stands,
// how big it is and which way it faces; `Towns.tsx` draws it and `plan.test.ts` sweeps it.
//
// WHY: the first towns were N boxes at random angles within 90 m of a point (26 for a city, 9 for a village). No
// streets, nothing faced anything, the centre was as sparse as the edge, so a city read as a scatter. Alex 11-15:
// *"expand the map on the nyx side so they look and feel more like real cities and towns."* A town is a STREET
// PLAN first; the houses follow the streets.
//
// THE RULES (all build calls, Jin's; the look per town is canon's and comes from STYLE):
//   · The roads that run through a town are its main streets. LANES branch off them, and on a hillside a lane
//     follows the CONTOUR (it tries a few headings each step and takes the flattest under LANE_GRADE), which is
//     what makes hillside streets wind (canon, Rune Hold: "streets wind upward").
//   · Buildings take LOTS along both sides of every street and lane, facing it, ridge parallel to the street.
//   · Density falls from the core to the edge: a lot near the square is almost always built, the edge has gaps.
//     Core buildings are taller and stand closer to the street.
//   · On a slope a building stands on a stone PLINTH that reaches down to the lowest corner: that is the "stone
//     stacked up a hillside" look, and it means no building ever floats or sinks.
//   · Nothing on a road, a junction pad, water, another building, or a slope too steep to build on.
//
// Canon fixes: Roman bones (world/athernyx.md: columns, arches, pale stone, terracotta roofs, carved trim).
// Concept shots Alex judged 11-15 (tools/art/gen_towns.py): Rune Hold 2, Citadel 3, Ashfeld 3, village 1.

import { nearestRoad, nearPad, drivable, type Region, type RegionPlace } from '../region'
import { stampCore, inCore, CORE_YAW, type CoreTransform } from './rune-hold-core'

export interface Lane { pts: [number, number, number][]; width: number }
export type BuildingKind = 'house' | 'cottage' | 'hall'
export interface Building {
  x: number; z: number
  /** the facade faces the street along this heading (rad, atan2 in x/z) */
  yaw: number
  /** along the street */ w: number
  /** away from the street */ d: number
  floors: number
  /** lowest and highest ground under the footprint: the plinth fills the gap */
  y0: number; y1: number
  kind: BuildingKind
  /** 0 at the core, 1 at the town's edge */
  rim: number
  /** stable per-building variation 0..1 (colour picks) */
  v: number
  /** an AUTHORED building (Rune Hold's grid): its floor is the ground at its front, a higher back is buried in the hill */
  core?: true
  /** the storefront it is, when it is one (play3d FRONTS ids) */
  front?: string
}
export interface TownPlan { place: string; r: number; lanes: Lane[]; buildings: Building[]; /** authored paving cells (1 m), with the bearing they are laid at */ paving?: { pts: [number, number][]; yaw: number } }

/** how far a town reaches, by its kind on the Atlas */
export function townRadius(p: RegionPlace): number {
  switch (p.kind) {
    case 'city': return 260
    case 'settlement': return 150
    case 'village': return p.name ? 95 : 70
    case 'school': return 55
    case 'spot': return 14
    default: return 0              // 'site' (the Passage) is underground: no town on top
  }
}

export const FLOOR_H = 3.1
export const LANE_W = 5
export const LANE_STEP = 6
/** lanes keep this far apart: a lot (setback + depth) on each side of each, back to back */
export const LANE_GAP = 24
/** a lane is a steep cart's grade at most (town lanes climb harder than roads): steeper and it turns along the hill */
export const LANE_GRADE = 0.25
/** steeper than this not even a stair alley climbs it (the lane ends) */
export const STAIR_GRADE = 0.6
/** building ground may step this much across a footprint (the plinth shows it); steeper is not buildable */
export const MAX_STEP = 9

export const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 1440662683) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}


/** the four corners of a footprint, grown by `m` on every side */
export function footprint(b: Pick<Building, 'x' | 'z' | 'yaw' | 'w' | 'd'>, m = 0): [number, number][] {
  const fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), ax = -fz, az = fx   // f: toward the street, a: along it
  const W = b.w + 2 * m, D = b.d + 2 * m
  return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => [b.x + ax * u * W + fx * v * D, b.z + az * u * W + fz * v * D])
}
/** do two convex quads overlap (separating axis) */
export function quadsOverlap(A: [number, number][], B: [number, number][]): boolean {
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % 4], nx = z0 - z1, nz = x1 - x0
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
    for (const [x, z] of A) { const t = x * nx + z * nz; a0 = Math.min(a0, t); a1 = Math.max(a1, t) }
    for (const [x, z] of B) { const t = x * nx + z * nz; b0 = Math.min(b0, t); b1 = Math.max(b1, t) }
    if (a1 <= b0 + 1e-6 || b1 <= a0 + 1e-6) return false
  }
  return true
}

/** distance from (x, z) to a polyline */
function distToLine(pts: [number, number, number][], x: number, z: number): number {
  let best = Infinity
  for (let k = 0; k < pts.length - 1; k++) {
    const ax = pts[k][0], az = pts[k][1], bx = pts[k + 1][0], bz = pts[k + 1][1]
    const abx = bx - ax, abz = bz - az, L = abx * abx + abz * abz || 1
    const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / L))
    best = Math.min(best, Math.hypot(ax + abx * t - x, az + abz * t - z))
  }
  return best
}

/** The roads that run through the town, clipped to its circle, as street polylines (bridges and bores left out). */
function mainStreets(R: Region, p: RegionPlace, r: number): Lane[] {
  const out: Lane[] = []
  for (const e of drivable(R)) {
    let run: [number, number, number][] = []
    const flush = () => { if (run.length >= 2) out.push({ pts: run, width: e.width }); run = [] }
    for (const q of e.pts) {
      const inside = Math.hypot(q[0] - p.x, q[1] - p.z) < r && !R.tunnelAt(q[0], q[1]) && !R.deckAt(q[0], q[1])
      if (inside) run.push([q[0], q[1], R.heightAt(q[0], q[1])]); else flush()
    }
    flush()
  }
  return out
}

export const WHY: Record<string, number> = {}
let TAG = ''
const no = (k: string) => { WHY[TAG + k] = (WHY[TAG + k] ?? 0) + 1 }
export function planTown(R: Region, p: RegionPlace, pi: number): TownPlan {
  const r = townRadius(p)
  // the town's heart is its square when the network gave it one (Ashfeld's Atlas dot sits 88 m off its square)
  const sq = (R.meta.network?.junctions ?? []).find(j => j.kind === 'square' && j.place === p.id)
  if (sq && p.kind !== 'spot') p = { ...p, x: sq.x, z: sq.z }
  const plan: TownPlan = { place: p.id, r, lanes: [], buildings: [] }
  if (r <= 0) return plan
  const big = p.kind === 'city', mid = p.kind === 'settlement'

  // every footprint passes the same test: on land, off roads/pads/shallow bores, not too steep, clear of the others.
  // Answers the ground span under it (the plinth) or null.
  const placed = new Map<string, Building[]>()
  const bucket = (x: number, z: number) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`
  const fits = (b: Pick<Building, 'x' | 'z' | 'yaw' | 'w' | 'd'>, gap: number, skipLane?: Lane): { y0: number; y1: number } | null => {
    const pts = footprint(b)
    let y0 = Infinity, y1 = -Infinity
    for (const [x, z] of [...pts, [b.x, b.z] as [number, number]]) {
      const y = R.heightAt(x, z)
      if (!Number.isFinite(y) || y < 1.5) return no('water'), null
      y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    if (y1 - y0 > MAX_STEP) return no('steep'), null
    if (pts.some(([x, z]) => coreAt(x, z))) return no('core'), null
    if (pts.some(([x, z]) => onRoad(x, z, 0.6) || (R.tunnelAt(x, z) && R.tunnelAt(x, z)!.cover < 12))) return no('road'), null
    if (pts.some(([x, z]) => nearLane(x, z, LANE_W / 2 + 1, skipLane))) return no('lane'), null
    const grown = footprint(b, gap)
    const bx = Math.floor(b.x / 16), bz = Math.floor(b.z / 16)
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const o of placed.get(`${bx + i},${bz + j}`) ?? []) if (quadsOverlap(grown, footprint(o))) return no('occ'), null
    return { y0, y1 }
  }
  let nearLane = (_x: number, _z: number, _m: number, _skip?: Lane): boolean => false
  const keep = (b: Building) => { plan.buildings.push(b); const k = bucket(b.x, b.z); const l = placed.get(k); if (l) l.push(b); else placed.set(k, [b]) }
  const onRoad = (x: number, z: number, m: number) => {
    const nr = nearestRoad(R, x, z)
    return (nr.road && nr.d < nr.road.width / 2 + m) || nearPad(R, x, z, m)
  }

  // ── RUNE HOLD's core is AUTHORED (play3d's grid, Alex's layout: rune-hold-core.ts); the generator builds round it
  let core: CoreTransform | null = null
  if (p.id === 'rune-hold' && sq) {
    core = { cx: sq.x, cz: sq.z, yaw: CORE_YAW }
    const c = stampCore(R, core)
    for (const b of c.buildings) keep(b)
    plan.paving = { pts: c.paving, yaw: CORE_YAW }
  }
  const coreAt = (x: number, z: number) => !!core && inCore(core, x, z)

  // ── a spot (a hut, a shack) is one building on its own ground: try a few spots round the dot until one fits
  if (p.kind === 'spot') {
    for (let k = 0; k < 24; k++) {
      const a = hash(pi, k, 1) * Math.PI * 2, d = k === 0 ? 0 : 4 + k * 1.5
      const c = { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, yaw: hash(pi, 1) * Math.PI * 2, w: 7, d: 6 }
      const g = fits(c, 1)
      if (g) { keep({ ...c, floors: 1, y0: g.y0, y1: g.y1, kind: 'cottage', rim: 0, v: hash(pi, 2) }); break }
    }
    return plan
  }

  // ── STREETS, the way a town grows (rework 11-15 after Alex: "the buildings and roads dont make any sense yet"):
  //   1. the roads through town are the HIGH STREET, and the square is the heart;
  //   2. BACK STREETS run parallel to the high street (and in rings round the square), a block's depth behind it;
  //   3. CROSS LANES leave the high street (and the square) at right angles and run out through the back streets;
  //   4. anything not joined to the high street through those is dropped. A lane that goes nowhere is not a lane.
  // (v2 laid a lattice along the hill's contour: it covered the ground but ignored the road, so streets met it at
  // random angles, stopped 3 m short of it, and left stubs everywhere.)
  const streets = mainStreets(R, p, r)
  const ph0 = hash(pi, 21) * 6.28, ph1 = hash(pi, 22) * 6.28
  /** the town's edge is ragged, not a circle: how far it reaches varies with the bearing */
  const reach = (x: number, z: number) => { const a = Math.atan2(z - p.z, x - p.x); return r * (0.74 + 0.16 * Math.sin(a * 2 + ph0) + 0.1 * Math.sin(a * 5 + ph1)) }
  const rowGap = big ? 30 : mid ? 32 : 34          // street to street: a lot back to back on each side
  const sqR = sq ? sq.r : 0
  // how far (x, z) is from the high street or the square's rim
  const toHeart = (x: number, z: number) => {
    let d = sq ? Math.hypot(x - sq.x, z - sq.z) - sq.r : Infinity
    for (const st of streets) d = Math.min(d, distToLine(st.pts, x, z) - st.width / 2)
    return d
  }
  const land = (x: number, z: number) => {
    if (Math.hypot(x - p.x, z - p.z) > reach(x, z) || coreAt(x, z)) return null
    const y = R.heightAt(x, z)
    if (!Number.isFinite(y) || y < 1.5) return null
    const t = R.tunnelAt(x, z); if (t && t.cover < 12) return null
    return y
  }
  // a run of points becomes lanes, broken where the ground fails, climbs too steeply, or meets another road
  const runs = (pts: [number, number][], keepOffRoad: boolean): Lane[] => {
    const out: Lane[] = []
    let run: [number, number, number][] = []
    const flush = () => { if (run.length >= 3) out.push({ pts: run, width: LANE_W }); run = [] }
    for (const [x, z] of pts) {
      const y = land(x, z)
      const bad = y === null || (keepOffRoad && onRoad(x, z, 2.5)) || (run.length > 0 && Math.abs(y - run[run.length - 1][2]) / LANE_STEP > STAIR_GRADE)
      if (bad) { flush(); if (y === null || keepOffRoad && onRoad(x, z, 2.5)) continue }
      run.push([x, z, y!])
    }
    flush()
    return out
  }
  /** a polyline resampled every LANE_STEP */
  const resample = (pts: [number, number][]): [number, number][] => {
    const out: [number, number][] = []
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / LANE_STEP))
      for (let i = 0; i < n; i++) out.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n])
    }
    if (pts.length) out.push(pts[pts.length - 1])
    return out
  }

  // 2. back streets: offset copies of each high street, and rings round the square. A point is kept only where the
  // high street it copies is really the nearest (so two offsets do not stack where streets meet)
  const backs: Lane[] = []
  for (let k = 1; k * rowGap < r; k++) {
    for (const st of streets) for (const sd of [1, -1]) {
      const D = st.width / 2 + k * rowGap
      const pts: [number, number][] = []
      for (let i = 0; i < st.pts.length; i++) {
        const a = st.pts[Math.max(0, i - 1)], b = st.pts[Math.min(st.pts.length - 1, i + 1)]
        let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L
        const x = st.pts[i][0] - tz * sd * D, z = st.pts[i][1] + tx * sd * D
        if (toHeart(x, z) > D - st.width / 2 - 4) pts.push([x, z])
        else if (pts.length) { backs.push(...runs(resample(pts), true)); pts.length = 0 }
      }
      backs.push(...runs(resample(pts), true))
    }
    if (sq) {
      const R0 = sqR + k * rowGap, n = Math.max(12, Math.round(2 * Math.PI * R0 / LANE_STEP))
      const ring: [number, number][] = []
      for (let i = 0; i <= n; i++) {
        const a = i / n * Math.PI * 2, x = sq.x + Math.cos(a) * R0, z = sq.z + Math.sin(a) * R0
        if (toHeart(x, z) > k * rowGap - 4) ring.push([x, z])
        else if (ring.length) { backs.push(...runs(ring, true)); ring.length = 0 }
      }
      backs.push(...runs(ring, true))
    }
  }

  // 3. cross lanes: straight out from the high street's kerb (and the square's rim) through every back street.
  // They START on the kerb, so they join it: no gap, no stub.
  const cross: Lane[] = []
  const crossGap = big ? 64 : mid ? 70 : 80
  const reachOut = r
  for (const st of streets) {
    let acc = crossGap * (0.3 + hash(pi, cross.length, 31) * 0.4)
    for (let k = 0; k < st.pts.length - 1; k++) {
      const [ax, az] = st.pts[k], [bx, bz] = st.pts[k + 1], seg = Math.hypot(bx - ax, bz - az); if (seg < 0.01) continue
      const ux = (bx - ax) / seg, uz = (bz - az) / seg
      for (; acc < seg; acc += crossGap) {
        const x0 = ax + ux * acc, z0 = az + uz * acc
        if (sq && Math.hypot(x0 - sq.x, z0 - sq.z) < sqR + 10) continue      // the square has its own lanes
        for (const sd of [1, -1]) {
          const nx = -uz * sd, nz = ux * sd, pts: [number, number][] = []
          for (let d = st.width / 2; d < reachOut; d += LANE_STEP) {
            const x = x0 + nx * d, z = z0 + nz * d
            if (d > st.width / 2 + 8 && onRoad(x, z, 2.5)) break           // ran into another road: that is its far end
            pts.push([x, z])
          }
          cross.push(...runs(pts, false).slice(0, 1).filter(l => Math.hypot(l.pts[0][0] - x0, l.pts[0][1] - z0) < st.width / 2 + 1))
        }
      }
      acc -= seg
    }
  }
  if (sq && !core) {
    // few spokes: each one costs the square a frontage's width of buildings, and the road arms already serve it
    const spokes = big ? 6 : mid ? 4 : 3, a0 = hash(pi, 33) * Math.PI
    for (let i = 0; i < spokes; i++) {
      const a = a0 + i / spokes * Math.PI * 2, pts: [number, number][] = []
      if (sq.arms.some(arm => Math.abs(Math.atan2(Math.sin(arm.ang - a), Math.cos(arm.ang - a))) < 0.5)) continue   // beside a road arm
      for (let d = sqR; d < reachOut; d += LANE_STEP) {
        const x = sq.x + Math.cos(a) * d, z = sq.z + Math.sin(a) * d
        if (d > sqR + 6 && onRoad(x, z, 2.5)) break
        pts.push([x, z])
      }
      // a spoke that would run down the high street itself is not a lane
      if (pts.length > 3 && onRoad(pts[3][0], pts[3][1], 1)) continue
      // only a spoke that really leaves the rim (water by the square can eat its first steps, and then it starts nowhere)
      cross.push(...runs(pts, false).slice(0, 1).filter(l => Math.hypot(l.pts[0][0] - sq.x, l.pts[0][1] - sq.z) < sqR + 1.5))
    }
  }

  // 4. keep only what joins the high street: cross lanes start on it; a back street is joined when a joined lane
  // crosses it; repeat until nothing new joins
  const joined = new Set<Lane>(cross)
  const touches = (a: Lane, b: Lane) => a.pts.some(([x, z]) => distToLine(b.pts, x, z) < LANE_W)
  for (let grew = true; grew;) {
    grew = false
    for (const b of backs) if (!joined.has(b) && [...joined].some(j => touches(b, j))) { joined.add(b); grew = true }
  }
  // a cross lane runs on only as far as the last back street it serves (no tail into the fields)
  const lanes: Lane[] = []
  for (const c of cross) {
    let last = Math.min(c.pts.length - 1, 4)
    c.pts.forEach(([x, z], i) => { if (backs.some(b => joined.has(b) && distToLine(b.pts, x, z) < LANE_W)) last = Math.max(last, i) })
    lanes.push({ pts: c.pts.slice(0, last + 1), width: LANE_W })
  }
  for (const b of backs) if (joined.has(b)) lanes.push(b)
  // the square's rim is a frontage too: buildings stand round it, facing in
  const squareFront: Lane[] = []
  if (sq && !core) {
    const n = Math.max(12, Math.round(2 * Math.PI * sqR / 4)), ring: [number, number, number][] = []
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, x = sq.x + Math.cos(a) * (sqR - 1), z = sq.z + Math.sin(a) * (sqR - 1); ring.push([x, z, R.heightAt(x, z)]) }
    squareFront.push({ pts: ring, width: 2 })
  }
  plan.lanes = lanes
  // lane segments bucketed (16 m), so a footprint asks only the lanes beside it, not every lane in a city
  const laneGrid = new Map<string, [Lane, number][]>()
  for (const l of lanes) for (let k = 0; k < l.pts.length - 1; k++) {
    const key = `${Math.floor((l.pts[k][0] + l.pts[k + 1][0]) / 32)},${Math.floor((l.pts[k][1] + l.pts[k + 1][1]) / 32)}`
    const e = laneGrid.get(key); if (e) e.push([l, k]); else laneGrid.set(key, [[l, k]])
  }
  nearLane = (x, z, m, skip) => {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16)
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [l, k] of laneGrid.get(`${cx + i},${cz + j}`) ?? []) {
      if (l === skip) continue
      if (distToLine([l.pts[k], l.pts[k + 1]], x, z) < m) return true
    }
    return false
  }

  // ── lots: walk every street and lane, both sides, a lot per step, facing the street
  // the square and the high street choose first, so the best lots are theirs
  const frontages: Lane[] = [...squareFront, ...streets, ...lanes]
  let bi = 0
  for (const f of frontages) {
    TAG = streets.includes(f) || squareFront.includes(f) ? 'street.' : 'lane.'
    const high = streets.includes(f) || squareFront.includes(f)
    for (const sd of [1, -1]) {
      let carry = 0
      for (let k = 0; k < f.pts.length - 1; k++) {
        const [ax, az] = f.pts[k], [bx, bz] = f.pts[k + 1]
        const seg = Math.hypot(bx - ax, bz - az); if (seg < 0.01) continue
        const ux = (bx - ax) / seg, uz = (bz - az) / seg, nx = -uz * sd, nz = ux * sd
        let t = carry
        while (t < seg) {
          const h0 = hash(pi, bi++, 7)
          const mx = ax + ux * t, mz = az + uz * t
          const rim = Math.min(1, Math.hypot(mx - p.x, mz - p.z) / reach(mx, mz))
          const core = 1 - rim
          const w = core > 0.45 ? 9 + h0 * 6 : 7 + h0 * 4
          // in the core the lots run back to back and fill the block (row houses); out at the edge they shrink
          const d = core > 0.45 ? 7.5 + hash(pi, bi, 8) * 2.5 : 6 + hash(pi, bi, 8) * 4
          const gap = core > 0.45 ? 0.15 : 1
          t += w / 2
          const fill = high ? 0.98 : core > 0.45 ? 0.95 : (big ? 0.45 : 0.3) + core
          const setback = core > 0.45 ? 0.8 + hash(pi, bi, 9) * 0.6 : 1.2 + rim * 3 + hash(pi, bi, 9) * 1.2
          const cx = mx + ux * 0 + nx * (f.width / 2 + setback + d / 2), cz = mz + nz * (f.width / 2 + setback + d / 2)
          const place = () => {
            if (hash(pi, bi, 10) > fill) return no('fill')
            if (Math.hypot(cx - p.x, cz - p.z) > reach(cx, cz) + 4) return no('radius')
            const yaw = Math.atan2(-nz, -nx)
            const g = fits({ x: cx, z: cz, yaw, w, d }, gap, f)
            if (!g) return
            const { y0, y1 } = g
            const tall0 = big ? 1 + Math.round(core * 2.4 + hash(pi, bi, 11) * 1.2) : mid ? 1 + Math.round(core * 1.6 + hash(pi, bi, 11) * 0.8) : 1 + (hash(pi, bi, 11) > 0.7 ? 1 : 0)
            const tall = tall0 + (high && core > 0.3 ? 1 : 0)   // the high street and the square stand a storey taller
            const kind: BuildingKind = core > 0.75 && w > 12 && hash(pi, bi, 12) > 0.6 ? 'hall' : tall === 1 && w * d < 70 ? 'cottage' : 'house'
            keep({ x: cx, z: cz, yaw, w, d, floors: kind === 'hall' ? Math.max(2, tall) : tall, y0, y1, kind, rim, v: hash(pi, bi, 13) })
          }
          place()
          t += w / 2 + gap + (core > 0.45 ? 0 : hash(pi, bi, 14) * 2.5)
        }
        carry = t - seg
      }
    }
  }
  return plan
}

export function planTowns(R: Region): TownPlan[] {
  return R.meta.places.map((p, pi) => planTown(R, p, pi))
}

/** where each town stands (its square when it has one) and how far it reaches: the tree scatter keeps out of it */
export function townDiscs(R: Region): { id: string; x: number; z: number; r: number }[] {
  const js = R.meta.network?.junctions ?? []
  return R.meta.places.map(p => {
    const sq = p.kind === 'spot' ? undefined : js.find(j => j.kind === 'square' && j.place === p.id)
    return { id: p.id, x: sq?.x ?? p.x, z: sq?.z ?? p.z, r: Math.max(20, townRadius(p) * 0.9) }
  })
}
