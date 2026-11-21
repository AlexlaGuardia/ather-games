// ── M49 slice 2: THE YARD COMES BUILT WITH A LEVEL FLOOR (hub 11-21 #15579). PURE (no three, no react). ───────────────────
// The shipyard's yard stands on Rune Hold's hillside (3.8 m of fall across it). The yard is part of the BUILT structure, so it
// comes with its own floor: a timber deck at ONE height (just over the highest ground under it), carried on posts where the
// hill falls away. This is the shipyard's build, not the keeper terracing (the M49 row's ban stays on the keeper). Every cell
// sits at the floor; pieces stand flush on it. The walker gets in through the GATE (a ramp down to the ground where the deck
// stands above it); the fence on the rim is solid everywhere else; placed pieces are solid (the plot's footprints, h).
import { DEED_GRID, pieceCentre, type DeedState, type Footprint } from './deed-grid'
import { yardToWorld, yardToLocal, GATE_MID, type Yard } from './deed-yard-site'
import type { OBox } from '../foot-solids'

/** gate gap width (m) */
export const GATE_W = 2
/** the deck's top stands this far over the highest ground under it */
export const DECK_LIFT = 0.15
/** the ramp's rise per metre at the gate (the Station's stair is 0.55) */
export const RAMP_RISE = 0.45
/** the fence rim's height over the floor (a body cannot step over it) */
export const RIM_H = 1.2
const RIM_T = 0.16

interface Heights { heightAt: (x: number, z: number) => number }

/** the deck's top: one height for the whole yard, a lift over the highest ground under it (sampled every 0.5 m, edges in) */
export function yardFloorY(R: Heights, y: Yard): number {
  const G = DEED_GRID[y.kind]
  let hi = -Infinity
  for (let u = -G.w / 2; u <= G.w / 2 + 1e-6; u += 0.5) for (let v = -G.d / 2; v <= G.d / 2 + 1e-6; v += 0.5) {
    const p = yardToWorld(y, u, v); hi = Math.max(hi, R.heightAt(p.x, p.z))
  }
  return hi + DECK_LIFT
}

/** the gate's outward unit vector (yard-local) and the ramp's length from the gate edge out to where it meets the ground */
export function rampOf(R: Heights, y: Yard, floor: number) {
  const G = DEED_GRID[y.kind], [mu, mv] = GATE_MID(G, y.gate)
  const out: [number, number] = y.gate === 1 ? [0, 1] : y.gate === 2 ? [-1, 0] : [1, 0]
  // walk out until the ramp's surface is at or below the ground
  let L = 0
  for (let s = 0; s <= 20; s += 0.1) {
    const p = yardToWorld(y, mu + out[0] * s, mv + out[1] * s)
    if (floor - s * RAMP_RISE <= R.heightAt(p.x, p.z)) { L = s; break }
    L = s
  }
  return { mu, mv, out, L }
}

/** the yard's raised ground at (x, z): the deck inside the rim, the ramp outside the gate; -Infinity elsewhere */
export function yardGround(R: Heights, y: Yard, floor: number, ramp = rampOf(R, y, floor)) {
  const G = DEED_GRID[y.kind]
  return (x: number, z: number): number => {
    const { lx, lz } = yardToLocal(y, x, z)
    if (Math.abs(lx) <= G.w / 2 + 1e-6 && Math.abs(lz) <= G.d / 2 + 1e-6) return floor
    // the ramp: along the gate's edge within the gap, outward 0..L
    const du = lx - ramp.mu, dv = lz - ramp.mv
    const s = du * ramp.out[0] + dv * ramp.out[1], t = Math.abs(du * ramp.out[1] - dv * ramp.out[0])
    if (s > 0 && s <= ramp.L && t <= GATE_W / 2) return floor - s * RAMP_RISE
    return -Infinity
  }
}

/** an oriented box along yard-local segment (u0,v0)-(u1,v1), RIM_T thick, from far below to RIM_H over the floor */
function edgeBox(y: Yard, u0: number, v0: number, u1: number, v1: number, floor: number): OBox {
  const a = yardToWorld(y, u0, v0), b = yardToWorld(y, u1, v1), L = Math.hypot(b.x - a.x, b.z - a.z)
  const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L
  return { cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, ux, uz, vx: -uz, vz: ux, hu: L / 2 + RIM_T / 2, hv: RIM_T / 2, y0: floor - 40, y1: floor + RIM_H }
}

/** the fence on the rim as solid boxes: all four edges, the gate edge split around its gap */
export function rimBoxes(y: Yard, floor: number): OBox[] {
  const G = DEED_GRID[y.kind], W = G.w / 2, D = G.d / 2, g = GATE_W / 2
  const edges: { k: 0 | 1 | 2 | 3; a: [number, number]; b: [number, number] }[] = [
    { k: 0, a: [-W, -D], b: [W, -D] }, { k: 1, a: [-W, D], b: [W, D] }, { k: 2, a: [-W, -D], b: [-W, D] }, { k: 3, a: [W, -D], b: [W, D] },
  ]
  const out: OBox[] = []
  for (const e of edges) {
    if (e.k !== y.gate) { out.push(edgeBox(y, e.a[0], e.a[1], e.b[0], e.b[1], floor)); continue }
    const [mu, mv] = GATE_MID(G, e.k), du = e.b[0] - e.a[0], dv = e.b[1] - e.a[1], L = Math.hypot(du, dv), tu = du / L, tv = dv / L
    out.push(edgeBox(y, e.a[0], e.a[1], mu - tu * g, mv - tv * g, floor))
    out.push(edgeBox(y, mu + tu * g, mv + tv * g, e.b[0], e.b[1], floor))
  }
  return out
}

export interface PieceSolid { w: number; d: number; h: number; solid: boolean }
/** the placed pieces as solid boxes on the floor (non-solid ones, a stool or an arch, are left out) */
export function pieceBoxes(y: Yard, floor: number, s: DeedState, defOf: (id: string) => PieceSolid | null): OBox[] {
  const out: OBox[] = []
  for (const p of s.items) {
    const f = defOf(p.id); if (!f || !f.solid) continue
    const fp: Footprint = { w: f.w, d: f.d }, c = pieceCentre(y.kind, fp, p.cx, p.cz, p.rot), w = yardToWorld(y, c.lx, c.lz), odd = p.rot % 2 === 1
    out.push({ cx: w.x, cz: w.z, ux: y.ax[0], uz: y.ax[1], vx: y.az[0], vz: y.az[1], hu: (odd ? f.d : f.w) / 2, hv: (odd ? f.w : f.d) / 2, y0: floor, y1: floor + f.h })
  }
  return out
}
