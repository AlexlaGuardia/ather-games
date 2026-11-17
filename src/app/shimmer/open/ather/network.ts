// The Wilds' path network for the season: settlements, the paths between them and Greg's stone, and where the
// Thistledown Fair pitches (baked by scripts/bake-wilds-network.mts → public/open/wilds/network-s<N>.json).
//
// Canon: generated free-Moglin settlements, fresh each season (ather-rework §3) · THE THISTLEDOWN FAIR, a travelling
// fair of free Moglins that pitches its big top at a new spot on the path network each season (RULED 11-17, athernyx
// 505c6d0). Placement, spacing, names and the tent's look = build.
//
// ★ PURE apart from `loadNetwork` (fetch).

export const SEASON = 1   // until the season clock exists, the network is season 1's
export interface Settlement { id: string; name: string; x: number; z: number }
export interface Path { a: string; b: string; pts: [number, number][] }
export interface Fair { x: number; z: number; yaw: number; path: string }
export interface Network { v: 1; season: number; settlements: Settlement[]; paths: Path[]; fair: Fair | null }

export const FAIR_NAME = 'The Thistledown Fair'
/** how near counts as "in" a settlement (the message line names it) and "at" the fair's door */
export const SETTLEMENT_R = 45, FAIR_R = 34, FAIR_DOOR_R = 9

export async function loadNetwork(season = SEASON, base = '/open/wilds'): Promise<Network | null> {
  try { const r = await fetch(`${base}/network-s${season}.json`); return r.ok ? (await r.json()) as Network : null } catch { return null }
}

/** The settlement the keeper stands in, if any. */
export function settlementAt(n: Network, x: number, z: number): Settlement | null {
  for (const s of n.settlements) if (Math.hypot(s.x - x, s.z - z) < SETTLEMENT_R) return s
  return null
}
export const nearFair = (n: Network, x: number, z: number, r = FAIR_R) => !!n.fair && Math.hypot(n.fair.x - x, n.fair.z - z) < r
/** the fair's door: in front of the big top, toward its path */
export function fairDoor(f: Fair) { return { x: f.x + Math.sin(f.yaw) * 15, z: f.z + Math.cos(f.yaw) * 15 } }

/** The path pieces inside a square (a tile's), as polylines resampled every `step` metres, in WORLD coords. */
export function pathsIn(n: Network, x0: number, z0: number, x1: number, z1: number, step = 3): [number, number][][] {
  const inside = (x: number, z: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1
  const out: [number, number][][] = []
  for (const p of n.paths) {
    let cur: [number, number][] = []
    for (let k = 1; k < p.pts.length; k++) {
      const [ax, az] = p.pts[k - 1], [bx, bz] = p.pts[k], L = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.ceil(L / step))
      for (let s = k === 1 ? 0 : 1; s <= m; s++) {
        const x = ax + ((bx - ax) * s) / m, z = az + ((bz - az) * s) / m
        if (inside(x, z)) cur.push([x, z])
        else if (cur.length) { if (cur.length > 1) out.push(cur); cur = [] }
      }
    }
    if (cur.length > 1) out.push(cur)
  }
  return out
}

/** Distance from a point to the nearest path (for keeping trees and crowds off it, and for "you are on the road"). */
export function pathDistance(n: Network, x: number, z: number): number {
  let best = Infinity
  for (const p of n.paths) for (let k = 1; k < p.pts.length; k++) {
    const [ax, az] = p.pts[k - 1], [bx, bz] = p.pts[k]
    if (Math.min(ax, bx) - best > x || Math.max(ax, bx) + best < x || Math.min(az, bz) - best > z || Math.max(az, bz) + best < z) continue
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2))
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z))
  }
  return best
}

/** Where no tree stands: within PATH_CLEAR of a path, and the settlements' and the fair's ground. A 4 m cell mask,
 *  built once, so a tile's 60k tree cells ask a Set, not 2,700 path segments. */
export const PATH_W = 3.2, PATH_CLEAR = 4, SETTLEMENT_CLEAR = 32, FAIR_CLEAR = 36
export function clearing(n: Network): (x: number, z: number) => boolean {
  const C = 4, key = (i: number, j: number) => i * 200003 + j, mask = new Set<number>()
  const disc = (x: number, z: number, r: number) => {
    const k = Math.ceil(r / C), ci = Math.floor(x / C), cj = Math.floor(z / C)
    for (let dj = -k; dj <= k; dj++) for (let di = -k; di <= k; di++) {
      const cx = (ci + di + 0.5) * C, cz = (cj + dj + 0.5) * C
      if (Math.hypot(cx - x, cz - z) <= r + C * 0.71) mask.add(key(ci + di, cj + dj))
    }
  }
  for (const p of n.paths) for (let k = 1; k < p.pts.length; k++) {
    const [ax, az] = p.pts[k - 1], [bx, bz] = p.pts[k], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2))
    for (let s = 0; s <= m; s++) disc(ax + ((bx - ax) * s) / m, az + ((bz - az) * s) / m, PATH_CLEAR)
  }
  for (const s of n.settlements) disc(s.x, s.z, SETTLEMENT_CLEAR)
  if (n.fair) disc(n.fair.x, n.fair.z, FAIR_CLEAR)
  return (x, z) => mask.has(key(Math.floor(x / C), Math.floor(z / C)))
}
