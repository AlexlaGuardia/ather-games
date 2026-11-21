// ── M49 slice 1: WHERE THE SHIPYARD'S YARD LIES (hub call 11-21: the deed grid = the shipyard's fenced YARD; a shipyard is a
// yard, Alex's 11-16 'no interiors for now' stands). The shipyard is a town-kit house (doors.ts › front:shipyard, Rune Hold's
// outskirts); its yard is a DEED_GRID rectangle beside it, on whichever side (back, left, right) is clear of the other houses
// and the lanes, and flattest. Nothing is levelled (no terrace, per the M49 row): placed things sit on the ground per cell.
// The yard comes BUILT (a fence, a gate gap, a look board); the keeper only places things in it. Jin's placement.
// PURE (no three): reads the region's heights and the town plan.
import type { Region } from '../region'
import { cachedPlan } from '../foot-solids'
import type { Building } from '../towns/plan'
import { DEED_GRID, type DeedKind } from './deed-grid'

export interface Yard {
  kind: DeedKind
  /** the grid's centre, world metres */ x: number; z: number
  /** unit vectors: grid +x (across, cx grows) and grid +z (deep, cz grows: away from the building) */
  ax: [number, number]; az: [number, number]
  /** which side of the building it took */ side: 'back' | 'left' | 'right'
  /** the fence edge left open as the gate: 1 = far, 2 = -x end, 3 = +x end (never 0, the near edge along the house wall) */
  gate: 1 | 2 | 3
  /** false = every side was blocked and this is the least-bad one (the check reports it) */
  clear: boolean
}

/** the middle of a fence edge, yard-local metres (0 = near, 1 = far, 2 = -x end, 3 = +x end) */
export const GATE_MID = (G: { w: number; d: number }, k: 0 | 1 | 2 | 3): [number, number] => (k === 0 ? [0, -G.d / 2] : k === 1 ? [0, G.d / 2] : k === 2 ? [-G.w / 2, 0] : [G.w / 2, 0])
export const YARD_GAP = 1.2      // metres between the building's wall and the yard's near fence
const MARGIN = 0.6               // a fence keeps this far off a neighbour's wall or a lane's edge

/** a building's frame: local +x and local +z (+z = toward its street, where the door is; towns/shop-door.tsx) */
export function buildingAxes(b: Pick<Building, 'yaw'>): { bx: [number, number]; bz: [number, number] } {
  const ry = Math.PI / 2 - b.yaw, c = Math.cos(ry), s = Math.sin(ry)
  return { bx: [c, -s], bz: [s, c] }
}

export const yardToWorld = (y: Yard, lx: number, lz: number) => ({ x: y.x + y.ax[0] * lx + y.az[0] * lz, z: y.z + y.ax[1] * lx + y.az[1] * lz })
export function yardToLocal(y: Yard, x: number, z: number) {
  const dx = x - y.x, dz = z - y.z
  return { lx: dx * y.ax[0] + dz * y.ax[1], lz: dx * y.az[0] + dz * y.az[1] }
}
/** the heading (rad, three's rotation.y) that turns a mesh's local +x onto the yard's +x */
export const yardRotY = (y: Yard) => Math.atan2(-y.ax[1], y.ax[0])

function insideBuilding(b: Building, x: number, z: number, m: number) {
  const { bx, bz } = buildingAxes(b), dx = x - b.x, dz = z - b.z
  return Math.abs(dx * bx[0] + dz * bx[1]) < b.w / 2 + m && Math.abs(dx * bz[0] + dz * bz[1]) < b.d / 2 + m
}
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz, t = L ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L)) : 0
  return Math.hypot(px - ax - vx * t, pz - az - vz * t)
}

/** the yard beside building `b` in town plan index `i` (pure in R + b) */
export function yardBeside(R: Region, i: number, b: Building, kind: DeedKind = 'shipyard', door?: { x: number; z: number }): Yard {
  const G = DEED_GRID[kind], plan = cachedPlan(R, i), { bx, bz } = buildingAxes(b)
  const neg = (v: [number, number]): [number, number] => [-v[0], -v[1]]
  const cands: { side: Yard['side']; off: number; ax: [number, number]; az: [number, number] }[] = [
    { side: 'back', off: b.d / 2, ax: bx, az: neg(bz) },
    { side: 'left', off: b.w / 2, ax: bz, az: neg(bx) },
    { side: 'right', off: b.w / 2, ax: neg(bz), az: bx },
  ]
  const lanes = [...plan.lanes, ...(plan.walks ?? [])]
  let best: (Yard & { score: number }) | null = null
  for (const c of cands) {
    const dist = c.off + YARD_GAP + G.d / 2
    const y: Yard = { kind, x: b.x + c.az[0] * dist, z: b.z + c.az[1] * dist, ax: c.ax, az: c.az, side: c.side, gate: 1, clear: true }
    let lo = Infinity, hi = -Infinity, blocked = 0
    for (let u = -G.w / 2; u <= G.w / 2 + 1e-6; u += 1) for (let v = -G.d / 2; v <= G.d / 2 + 1e-6; v += 1) {
      const p = yardToWorld(y, u, v), h = R.heightAt(p.x, p.z)
      lo = Math.min(lo, h); hi = Math.max(hi, h)
      if (plan.buildings.some(o => o !== b && insideBuilding(o, p.x, p.z, MARGIN))) blocked++
      else if (lanes.some(l => l.pts.some((q, k) => k > 0 && segDist(p.x, p.z, l.pts[k - 1][0], l.pts[k - 1][2], q[0], q[2]) < l.width / 2 + MARGIN))) blocked++
      else if (R.tunnelAt(p.x, p.z) || R.deckAt(p.x, p.z)) blocked++
    }
    y.clear = blocked === 0
    const score = (blocked ? 1000 + blocked : 0) + (hi - lo)
    if (!best || score < best.score) best = { ...y, score }
  }
  const { score: _s, ...yard } = best!   // eslint-disable-line @typescript-eslint/no-unused-vars
  // the gate: of the three edges off the house wall, the one whose middle is nearest the door (the way in from the street)
  if (door) {
    let dk = Infinity
    for (const k of [1, 2, 3] as const) { const [u, v] = GATE_MID(G, k), p = yardToWorld(yard, u, v), d = Math.hypot(p.x - door.x, p.z - door.z); if (d < dk) { dk = d; yard.gate = k } }
  }
  return yard
}

// THE keeper's yards (Kael's + the bought ones) are listed in business/shipyards.ts › shipyardSites / shipyardYard (moved there in
// M49 s3 so doors.ts can site a bought shipyard by its yard without an import cycle).
