// ── M49 s4: THE SHIPYARD PLOT (docs/M49-shipyards.md; Alex 11-21: "a ship yard is basically ~100x100 plot with a landing zone,
// ..garages that can store 4-12 coursers, and a ship dock some need water others just need somewhere to tie em down ..and
// a home of some kind mixed into it all"). PURE (no three, no react, no storage).
// Every shipyard is its own fenced plot on its own ground by a road (Veradyn: an isle by the water, no road). It comes BUILT:
// one levelled floor (a terrace at the highest ground under it, retaining walls where the land falls away), a gate with a
// ramp down to the ground, a landing pad, a garage block, a dock (tie-down posts + a mast on dry ground, a berth + slipway
// where the plot meets water) and a home. Everything else on the plot is the keeper's DEED ground (deed-grid.ts, kind 'plot'):
// they place things on it, never build walls. All pieces are BLOCKOUT boxes (art later).
// ★ The two tables below are the knobs: SHIPYARD_PLOTS (where, which way) and SHIPYARD_TIERS (garage / dock / home / price).
// Sites came from a search of the real continent (100 x 100 clear of every town, road, bridge and bore; hub 11-21 #15797).
import { WATER_Y } from '../on-foot'
import type { OBox } from '../foot-solids'
import { pieceCentre, type DeedState } from './deed-grid'

export type DockKind = 'tie-down' | 'berth'
export type HomeKind = 'kael' | 'cabin' | 'house' | 'large'
export interface ShipyardTier { garage: 4 | 8 | 12; dock: DockKind; home: HomeKind; price: number }

/** DEFAULT tiers (docs/M49-shipyards.md › Tiers; Alex tunes). key = the shipyard key (shipyards.ts). */
export const SHIPYARD_TIERS: Record<string, ShipyardTier> = {
  'front:shipyard': { garage: 4, dock: 'tie-down', home: 'kael', price: 0 },
  'front:shipyard:gale-haven': { garage: 8, dock: 'tie-down', home: 'cabin', price: 250_000 },
  'front:shipyard:veradyn': { garage: 8, dock: 'berth', home: 'house', price: 300_000 },
  'front:shipyard:citadel': { garage: 12, dock: 'tie-down', home: 'large', price: 400_000 },
}

/** WHERE each plot stands: its centre and the bearing of its across-axis (deg, atan2(z, x)); `road` = the network edge it fronts
 *  (null = no road: the gate faces the driest side, the dock the wettest). */
export interface PlotSite { key: string; town: string; x: number; z: number; yawDeg: number; road: string | null }
export const SHIPYARD_PLOTS: readonly PlotSite[] = [
  { key: 'front:shipyard', town: 'rune-hold', x: -216, z: -1283, yawDeg: -132.6, road: 'e11' },          // above Rune Hold, by the road over the mountain (canon)
  { key: 'front:shipyard:gale-haven', town: 'gale-haven', x: -2660, z: -2453, yawDeg: -75.1, road: 'e40' },  // 390 m N of town
  { key: 'front:shipyard:veradyn', town: 'veradyn', x: 3577, z: -2101, yawDeg: 0, road: null },           // an isle 290 m from town: by water or by air
  { key: 'front:shipyard:citadel', town: 'citadel', x: 1661, z: 3091, yawDeg: -167.7, road: 'e30' },      // 560 m S of the capital
]

export const PLOT = 100            // metres, square
export const PLOT_GATE_W = 6       // the gate gap (a courser fits, s5)
export const FLOOR_LIFT = 0.15     // the floor over the highest ground under the plot
export const SLIP_W = 5            // the slipway's width (berth plots)
/** the ramps' rise per metre (the Station's stair is 0.55) */
export const RAMP_RISE = 0.45
/** the gate's LANDING: a strip this deep outside the front fence at floor height, the ramp running down it ALONG the fence
 *  (parallel to the road, inside the setback, so it never crosses the carriageway coursers drive) */
export const LANDING_D = 4
/** M49 s5: the COURSER ramp, the other way along the landing (toward -lx from the gate), gentle enough to drive: rise per
 *  metre (the courser climbs to 0.6 before a face scrubs its speed; the road a gate faces is ~6 m off, so it cannot run out) */
export const CAR_RISE = 0.2
/** the garage: one BAY per courser, open at the front (-x face) so a courser drives in */
export const BAY = 4, GARAGE_D = 8, GARAGE_H = 4.2, GWALL_T = 0.3
const RIM_H = 1.4, RIM_T = 0.2

interface Terrain { heightAt: (x: number, z: number) => number }
interface Roads { meta: { network?: { edges: { id: string; width: number; pts: number[][] }[] } } }

/** a plot's frame, oriented so the GATE edge is local lz = -PLOT/2 (the front) and lz grows deeper into the plot */
export interface PlotFrame { key: string; x: number; z: number; ax: [number, number]; az: [number, number] }
export const plotToWorld = (f: PlotFrame, lx: number, lz: number) => ({ x: f.x + f.ax[0] * lx + f.az[0] * lz, z: f.z + f.ax[1] * lx + f.az[1] * lz })
export function plotToLocal(f: PlotFrame, x: number, z: number) { const dx = x - f.x, dz = z - f.z; return { lx: dx * f.ax[0] + dz * f.ax[1], lz: dx * f.az[0] + dz * f.az[1] } }
/** three's rotation.y that turns a mesh's local +x onto the plot's +x */
export const plotRotY = (f: PlotFrame) => Math.atan2(-f.ax[1], f.ax[0])

/** a built piece, plot-local (centre, size along lx/lz, height over the floor) */
export interface PlotPiece { kind: 'home' | 'garage' | 'gwall' | 'bay' | 'pad' | 'mast' | 'post' | 'bollard' | 'board'; lx: number; lz: number; w: number; d: number; h: number; solid: boolean }

export interface PlotLayout {
  frame: PlotFrame
  tier: ShipyardTier
  floor: number
  /** the lowest ground under the plot: the retaining wall runs down to it */ base: number
  /** the gate ramp: out of the gate onto the landing strip (lz -50..-54), then down along it toward +lx from lx = +gate/2,
   *  `L` metres long (0 = the floor meets the ground there) */ ramp: { L: number }
  /** s5: the courser ramp, down the landing toward -lx from lx = -gate/2, `L` metres long at CAR_RISE */ carRamp: { L: number }
  /** berth plots: the slipway at the back edge, from the floor down into the water; centre lx and length */ slip: { lx: number; L: number } | null
  pieces: PlotPiece[]
  /** how much of the plot stands over water (0..1) */ wet: number
}

const H_HOME: Record<HomeKind, { w: number; d: number; h: number }> = { kael: { w: 10, d: 8, h: 6 }, cabin: { w: 7, d: 6, h: 3.5 }, house: { w: 11, d: 8, h: 6 }, large: { w: 15, d: 11, h: 7 } }

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz, t = L ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L)) : 0
  return Math.hypot(px - ax - vx * t, pz - az - vz * t)
}

/** the plot's frame: the gate edge faces its road (road pts are [x, z, y]); with no road, the dock (wettest) edge is the back */
export function plotFrame(R: Terrain & Roads, s: PlotSite): PlotFrame {
  const a = s.yawDeg * Math.PI / 180, tx: [number, number] = [Math.cos(a), Math.sin(a)], tz: [number, number] = [-Math.sin(a), Math.cos(a)]
  // the four candidate fronts: -tz, +tz, -tx, +tx (as the direction from the centre to that edge)
  const outs: [number, number][] = [[-tz[0], -tz[1]], [tz[0], tz[1]], [-tx[0], -tx[1]], [tx[0], tx[1]]]
  const edgeAt = (o: [number, number], k: number) => ({ x: s.x + o[0] * PLOT / 2 + -o[1] * k, z: s.z + o[1] * PLOT / 2 + o[0] * k })
  let best = 0
  if (s.road) {
    const e = R.meta.network?.edges.find(q => q.id === s.road)
    let bd = Infinity
    outs.forEach((o, i) => {
      const m = edgeAt(o, 0); let d = Infinity
      if (e) for (let k = 1; k < e.pts.length; k++) d = Math.min(d, segDist(m.x, m.z, e.pts[k - 1][0], e.pts[k - 1][1], e.pts[k][0], e.pts[k][1]))
      if (d < bd) { bd = d; best = i }
    })
  } else {
    // the wettest edge is the dock: the gate is the edge opposite it
    let bw = -1, dock = 0
    outs.forEach((o, i) => { let w = 0; for (let k = -PLOT / 2; k <= PLOT / 2; k += 5) { const p = edgeAt(o, k); if (R.heightAt(p.x + o[0] * 3, p.z + o[1] * 3) < WATER_Y) w++ } if (w > bw) { bw = w; dock = i } })
    best = dock ^ 1   // 0<->1, 2<->3: the opposite edge
  }
  const front = outs[best], az: [number, number] = [-front[0], -front[1]], ax: [number, number] = [az[1], -az[0]]
  return { key: s.key, x: s.x, z: s.z, ax, az }
}

/** the whole built plot (pure in R + the site) */
export function plotLayout(R: Terrain & Roads, s: PlotSite): PlotLayout {
  const f = plotFrame(R, s), tier = SHIPYARD_TIERS[s.key]
  let hi = -Infinity, lo = Infinity, wetN = 0, n = 0
  for (let u = -PLOT / 2; u <= PLOT / 2 + 1e-6; u += 2.5) for (let v = -PLOT / 2; v <= PLOT / 2 + 1e-6; v += 2.5) {
    const p = plotToWorld(f, u, v), h = R.heightAt(p.x, p.z); n++
    lo = Math.min(lo, h); if (h < WATER_Y) wetN++; else hi = Math.max(hi, h)
  }
  const floor = hi + FLOOR_LIFT
  // the gate ramp falls along the landing strip until it meets the ground under it (flush), capped at the fence's length
  let rL = 0
  for (let d = 0.5; d <= PLOT / 2; d += 0.5) { const p = plotToWorld(f, PLOT_GATE_W / 2 + d, -PLOT / 2 - LANDING_D / 2); rL = d; if (floor - d * RAMP_RISE <= R.heightAt(p.x, p.z)) break }
  const ramp = { L: rL }
  let cL = 0
  for (let d = 0.5; d <= PLOT / 2 - PLOT_GATE_W / 2; d += 0.5) { const p = plotToWorld(f, -PLOT_GATE_W / 2 - d, -PLOT / 2 - LANDING_D / 2); cL = d; if (floor - d * CAR_RISE <= R.heightAt(p.x, p.z)) break }
  const carRamp = { L: cL }
  const pieces: PlotPiece[] = []
  // the home: front-left, set back from the fence
  const hm = H_HOME[tier.home]
  pieces.push({ kind: 'home', lx: -PLOT / 2 + 8 + hm.w / 2, lz: -PLOT / 2 + 8 + hm.d / 2, w: hm.w, d: hm.d, h: hm.h, solid: true })
  // the garage block: along the right fence from the front, one 4 m bay per courser, OPEN at the front (-x) so a courser
  // drives in (s5): a back wall, a wall between bays and at each end, a roof. 'garage' = its footprint (the roof, the deed
  // margin), 'gwall' = the walls (solid), 'bay' = the lintel over each opening (its lz = the bay's centre)
  const GD = GARAGE_D, gLen = tier.garage * BAY, gx = PLOT / 2 - 3 - GD / 2, gz0 = -PLOT / 2 + 8
  pieces.push({ kind: 'garage', lx: gx, lz: gz0 + gLen / 2, w: GD, d: gLen, h: GARAGE_H, solid: false })
  pieces.push({ kind: 'gwall', lx: gx + GD / 2 - GWALL_T / 2, lz: gz0 + gLen / 2, w: GWALL_T, d: gLen, h: GARAGE_H, solid: true })
  for (let b = 0; b <= tier.garage; b++) pieces.push({ kind: 'gwall', lx: gx, lz: gz0 + BAY * b, w: GD, d: GWALL_T, h: GARAGE_H, solid: true })
  for (let b = 0; b < tier.garage; b++) pieces.push({ kind: 'bay', lx: gx - GD / 2 - 0.05, lz: gz0 + BAY * (b + 0.5), w: 0.1, d: BAY - GWALL_T, h: 0.6, solid: false })
  // the landing pad: the deep middle
  pieces.push({ kind: 'pad', lx: -6, lz: 16, w: 28, d: 28, h: 0.06, solid: false })
  // the dock: dry ground ties the ship down (a mast + four posts, back-left); a berth has bollards along the back fence
  let slip: PlotLayout['slip'] = null
  if (tier.dock === 'tie-down') {
    const cx = -PLOT / 2 + 18, cz = PLOT / 2 - 18
    pieces.push({ kind: 'mast', lx: cx, lz: cz, w: 0.8, d: 0.8, h: 14, solid: true })
    for (const [a, b] of [[-8, -8], [8, -8], [8, 8], [-8, 8]]) pieces.push({ kind: 'post', lx: cx + a, lz: cz + b, w: 0.5, d: 0.5, h: 1.2, solid: true })
  } else {
    // the slipway runs out from the back edge until it meets the bed (flush, so a swimmer walks straight onto it), at least
    // to below the water line; capped at 40 m
    const sx = -PLOT / 2 + 20
    let sL = 0
    for (let d = 0.5; d <= 40; d += 0.5) { const p = plotToWorld(f, sx, PLOT / 2 + d), y = floor - d * RAMP_RISE; sL = d; if (y <= R.heightAt(p.x, p.z) && y < WATER_Y - 0.5) break }
    slip = { lx: sx, L: sL }
    for (let k = -40; k <= 40; k += 10) if (Math.abs(k - sx) > SLIP_W) pieces.push({ kind: 'bollard', lx: k, lz: PLOT / 2 - 1.2, w: 0.5, d: 0.5, h: 0.8, solid: true })
  }
  // the look board, just inside the gate on its left
  pieces.push({ kind: 'board', lx: -PLOT_GATE_W / 2 - 2, lz: -PLOT / 2 + 1.5, w: 0.9, d: 0.12, h: 1.6, solid: true })
  return { frame: f, tier, floor, base: lo, ramp, carRamp, slip, pieces, wet: wetN / n }
}

// ── the deed ground: 1 m cells over the whole plot, minus what is built (a 1 m margin round each solid piece and the pad), the
// way in from the gate and the slipway's landing ──
export function blockedCells(L: PlotLayout): (cx: number, cz: number) => boolean {
  const rects: [number, number, number, number][] = []   // lx0, lz0, lx1, lz1
  for (const p of L.pieces) { if (p.kind === 'bay') continue; const m = p.kind === 'pad' ? 0 : 1; rects.push([p.lx - p.w / 2 - m, p.lz - p.d / 2 - m, p.lx + p.w / 2 + m, p.lz + p.d / 2 + m]) }
  rects.push([-PLOT_GATE_W / 2 - 1, -PLOT / 2, PLOT_GATE_W / 2 + 1, -PLOT / 2 + 6])                 // the gate way
  if (L.slip) rects.push([L.slip.lx - SLIP_W / 2 - 1, PLOT / 2 - 6, L.slip.lx + SLIP_W / 2 + 1, PLOT / 2])  // the slip landing
  return (cx, cz) => {
    const x0 = cx - PLOT / 2, z0 = cz - PLOT / 2
    return rects.some(([a, b, c, d]) => x0 + 1 > a && x0 < c && z0 + 1 > b && z0 < d)
  }
}

// ── the walker: the floor + ramp + slip as ground; the rim (gaps at the gate and the slip) and the solid pieces as boxes ──
export function plotGround(L: PlotLayout): (x: number, z: number) => number {
  const f = L.frame
  return (x, z) => {
    const { lx, lz } = plotToLocal(f, x, z)
    if (Math.abs(lx) <= PLOT / 2 + 0.1 && Math.abs(lz) <= PLOT / 2 + 0.1) return L.floor
    if (lz < -PLOT / 2 && lz >= -PLOT / 2 - LANDING_D && lx >= -PLOT_GATE_W / 2 - L.carRamp.L && lx <= PLOT_GATE_W / 2 + L.ramp.L)
      return L.floor - (lx > PLOT_GATE_W / 2 ? (lx - PLOT_GATE_W / 2) * RAMP_RISE : lx < -PLOT_GATE_W / 2 ? (-PLOT_GATE_W / 2 - lx) * CAR_RISE : 0)
    if (L.slip && Math.abs(lx - L.slip.lx) <= SLIP_W / 2 && lz > PLOT / 2 && lz < PLOT / 2 + L.slip.L) return L.floor - (lz - PLOT / 2) * RAMP_RISE
    return -Infinity
  }
}
const box = (f: PlotFrame, lx: number, lz: number, hw: number, hd: number, y0: number, y1: number): OBox => {
  const c = plotToWorld(f, lx, lz)
  return { cx: c.x, cz: c.z, ux: f.ax[0], uz: f.ax[1], vx: f.az[0], vz: f.az[1], hu: hw, hv: hd, y0, y1 }
}
/** the rim, the landing's rails and the solid pieces as walker boxes. `shut` (a shipyard the keeper does not hold): the gate
 *  and the slipway are closed too, so nobody walks or swims in */
export function plotBoxes(L: PlotLayout, shut = false): OBox[] {
  const f = L.frame, H = PLOT / 2, y0 = L.floor - 0.2, y1 = L.floor + RIM_H, g = PLOT_GATE_W / 2
  const out: OBox[] = shut ? [box(f, 0, -H, H, RIM_T / 2, y0, y1)] : [
    // front, split round the gate
    box(f, (-H - g) / 2, -H, (H - g) / 2, RIM_T / 2, y0, y1), box(f, (H + g) / 2, -H, (H - g) / 2, RIM_T / 2, y0, y1),
  ]
  out.push(box(f, -H, 0, RIM_T / 2, H, y0, y1), box(f, H, 0, RIM_T / 2, H, y0, y1))
  // the landing's rail: its outer edge (the drop), the whole strip; both ramps' feet are open (the walker's +lx, the
  // courser's -lx: s5, the courser ramp replaced the closed -x end)
  out.push(landingRail(L))
  if (L.slip && !shut) {
    const a = L.slip.lx - SLIP_W / 2, b = L.slip.lx + SLIP_W / 2
    out.push(box(f, (-H + a) / 2, H, (a + H) / 2, RIM_T / 2, y0, y1), box(f, (b + H) / 2, H, (H - b) / 2, RIM_T / 2, y0, y1))
  } else out.push(box(f, 0, H, H, RIM_T / 2, y0, y1))
  if (shut && L.slip) out.push(box(f, L.slip.lx, H + 0.4, SLIP_W / 2 + 0.3, RIM_T / 2, L.floor - 40, L.floor + RIM_H))
  for (const p of L.pieces) if (p.solid) out.push(box(f, p.lx, p.lz, p.w / 2, p.d / 2, L.floor - 0.1, L.floor + p.h))
  return out
}

function landingRail(L: PlotLayout): OBox {
  const g = PLOT_GATE_W / 2, rx0 = -g - L.carRamp.L, rx1 = g + L.ramp.L
  return box(L.frame, (rx0 + rx1) / 2, -PLOT / 2 - LANDING_D, (rx1 - rx0) / 2, RIM_T / 2, L.floor - 40, L.floor + RIM_H)
}

// ── s5: THE COURSER on the plot. Its ground is plotGround (the floor + both ramps); its walls are these boxes: the rim run
// down to below the lowest ground (a courser below the terrace meets the retaining wall, not a 4 m step it creeps up), split
// at the gate unless `shut`, the landing's rail and the solid pieces (the garage walls, the home, the mast...). ──
export function plotCarBoxes(L: PlotLayout, shut = false): OBox[] {
  const f = L.frame, H = PLOT / 2, y0 = L.base - 2, y1 = L.floor + RIM_H, g = PLOT_GATE_W / 2
  const out: OBox[] = shut ? [box(f, 0, -H, H, RIM_T / 2, y0, y1)] : [box(f, (-H - g) / 2, -H, (H - g) / 2, RIM_T / 2, y0, y1), box(f, (H + g) / 2, -H, (H - g) / 2, RIM_T / 2, y0, y1)]
  out.push(box(f, -H, 0, RIM_T / 2, H, y0, y1), box(f, H, 0, RIM_T / 2, H, y0, y1), box(f, 0, H, H, RIM_T / 2, y0, y1), landingRail(L))
  for (const p of L.pieces) if (p.solid) out.push(box(f, p.lx, p.lz, p.w / 2, p.d / 2, L.floor - 0.1, L.floor + p.h))
  return out
}

/** the garage's bays, plot-local: the inside of each (front opening to the back wall), centre + half sizes */
export interface BayRect { k: number; lx: number; lz: number; hw: number; hd: number }
export function bayRects(L: PlotLayout): BayRect[] {
  const g = L.pieces.find(p => p.kind === 'garage')!, x0 = g.lx - g.w / 2, x1 = g.lx + g.w / 2 - GWALL_T
  return L.pieces.filter(p => p.kind === 'bay').map((p, k) => ({ k, lx: (x0 + x1) / 2, lz: p.lz, hw: (x1 - x0) / 2, hd: (BAY - GWALL_T) / 2 }))
}
/** which bay a courser at (x, z) stands in (its centre at least `inset` m inside the opening), -1 = none */
export function bayAt(L: PlotLayout, x: number, z: number, y = L.floor, inset = 1.2): number {
  if (Math.abs(y - L.floor) > 1.5) return -1
  const { lx, lz } = plotToLocal(L.frame, x, z)
  for (const b of bayRects(L)) if (lx > b.lx - b.hw + inset && lx < b.lx + b.hw && Math.abs(lz - b.lz) < b.hd) return b.k
  return -1
}
/** where a courser stands parked in bay k (nose in, toward +lx), world */
export function bayPose(L: PlotLayout, k: number): { x: number; z: number; yaw: number } {
  const b = bayRects(L)[k], c = plotToWorld(L.frame, b.lx + 0.4, b.lz)
  return { x: c.x, z: c.z, yaw: Math.atan2(-L.frame.ax[0], -L.frame.ax[1]) }
}

/** the keeper's PLACED things (deed-grid.ts, kind 'plot') as walker boxes on the floor; non-solid ones (a stool) are left out */
export interface PieceSolid { w: number; d: number; h: number; solid: boolean }
export function placedBoxes(L: PlotLayout, s: DeedState, defOf: (id: string) => PieceSolid | null): OBox[] {
  const out: OBox[] = []
  for (const p of s.items) {
    const d = defOf(p.id); if (!d || !d.solid) continue
    const c = pieceCentre('plot', { w: d.w, d: d.d }, p.cx, p.cz, p.rot), odd = p.rot % 2 === 1
    out.push(box(L.frame, c.lx, c.lz, (odd ? d.d : d.w) / 2, (odd ? d.w : d.d) / 2, L.floor, L.floor + d.h))
  }
  return out
}
