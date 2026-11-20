// The Wilds' path network for the season: settlements, the paths between them and Greg's stone, and where the
// Thistledown Fair pitches (baked by scripts/bake-wilds-network.mts → public/open/wilds/network-s<N>.json).
//
// Canon: generated free-Moglin settlements, fresh each season (ather-rework §3) · THE THISTLEDOWN FAIR, a travelling
// fair of free Moglins that pitches its big top at a new spot on the path network each season (RULED 11-17, athernyx
// 505c6d0). Placement, spacing, names and the tent's look = build.
//
// ★ PURE apart from `loadNetwork` (fetch).

import { GLADE } from './moonwell-glade'
export const SEASON = 1   // until the season clock exists, the network is season 1's
export type SettlementBiome = 'shore' | 'meadow' | 'woods' | 'rock'
/** `biome` = what lies around it (the bake guarantees at least one of each, Alex 11-17); older bakes lack it */
/** `pads` (M39 s3, baked by scripts/bake-path-profiles.mts): each generated lot slot's level pad [x, z, yaw, y]: the footprint's
 *  ONE height, so every tile reads the same ground there (relief.ts levels it). Absent on the Glade and on older bakes. */
export interface Settlement { id: string; name: string; x: number; z: number; biome?: SettlementBiome; pads?: [number, number, number, number][] }
/** What a settlement's Moglins gather, by its biome: their PRODUCT (Magii 11-17, c52ba1c: idle gathering is a Moglin's
 *  product, never a keeper skill), moved by want-list trade. Existing items only; which goods are BUILD (Jin's).
 *  Woods gives goldwood logs as the stand-in for DEADFALL (fallen tier-1 goldwood, canon) until that item exists. */
export const SETTLEMENT_GATHERS: Readonly<Record<SettlementBiome, readonly string[]>> = {
  shore: ['shimmerscale', 'clickclaw', 'pearlshell', 'bait'],
  meadow: ['mast'],
  woods: ['goldwood_log'],
  rock: ['blankstone', 'raw_mana_shard'],
}
/** `pts[k][2]` = the PATH'S OWN HEIGHT there (BETA M18, scripts/bake-path-profiles.mts): the ground smoothed along the path and
 *  held to a trail grade. Older bakes lack it, and then the land is not sculpted (relief.ts falls back to the M16 mask). */
export interface Path { a: string; b: string; pts: [number, number, number?][] }
export interface Fair { x: number; z: number; yaw: number; path: string }
export interface Network { v: 1; season: number; settlements: Settlement[]; paths: Path[]; fair: Fair | null }

export const FAIR_NAME = 'The Thistledown Fair'
/** how near counts as "in" a settlement (the message line names it) and "at" the fair's door */
export const SETTLEMENT_R = 45, FAIR_R = 34, FAIR_DOOR_R = 9

export async function loadNetwork(season = SEASON, base = '/open/wilds'): Promise<Network | null> {
  try { const r = await fetch(`${base}/network-s${season}.json`); return r.ok ? withGlade((await r.json()) as Network) : null } catch { return null }
}

/** Moonwell Glade (M30, moonwell-glade.ts) joins every season's settlements: fixed, at the Wilds' front door. */
export const withGlade = (n: Network): Network => (n.settlements.some(s => s.id === GLADE.id) ? n : { ...n, settlements: [GLADE, ...n.settlements] })

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
/** `cap`: the caller only cares below this many metres; past it any answer >= cap may come back (the void carve passes its ramp's end) */
export function pathDistance(n: Network, x: number, z: number, cap = Infinity): number {
  if (cap === Infinity) return pathDistanceScan(n, x, z)   // the index pays off only with a cap (rings stop early); far points would walk many rings
  const ix = segIndex(n), C = PD_CELL, ci = Math.floor(x / C), cj = Math.floor(z / C), s = ix.segs
  let best = Infinity
  // M44 part 3: rings of grid cells outward from the point; a cell r rings out is at least (r - 1) * C away, so once the best
  // found is that close, nothing further can beat it. Exact, same answer as the full scan (pathDistanceScan, the test's oracle).
  for (let r = 0; r <= PD_RINGS; r++) {
    if (best <= (r - 1) * C) return best
    if ((r - 1) * C >= cap) return Math.max(best === Infinity ? cap : best, cap)   // nothing nearer than cap is left
    const ring = r === 0 ? 1 : 8 * r   // the perimeter cells only
    for (let e = 0; e < ring; e++) {
      let di = 0, dj = 0
      if (r > 0) { const side = Math.floor(e / (2 * r)), o = e % (2 * r) - r; [di, dj] = side === 0 ? [o, -r] : side === 1 ? [r, o] : side === 2 ? [-o, r] : [-r, -o] }
      const cell = ix.grid.get((ci + di) * 100003 + (cj + dj)); if (!cell) continue
      for (const q of cell) {
        const ax = s[q], az = s[q + 1], dx = s[q + 2] - ax, dz = s[q + 3] - az, l2 = dx * dx + dz * dz || 1
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2))
        const d = Math.hypot(ax + dx * t - x, az + dz * t - z); if (d < best) best = d
      }
    }
  }
  return best <= PD_RINGS * C ? best : pathDistanceScan(n, x, z)   // far from every path: the plain scan (rare: open sea)
}
/** M44 part 3: path segments bucketed into PD_CELL squares (every square a segment's box touches), once per network */
const PD_CELL = 64, PD_RINGS = 24
const segIndexes = new WeakMap<Network, { grid: Map<number, number[]>; segs: Float64Array }>()
function segIndex(n: Network) {
  const hit = segIndexes.get(n); if (hit) return hit
  let m = 0; for (const p of n.paths) m += Math.max(0, p.pts.length - 1)
  const segs = new Float64Array(m * 4), grid = new Map<number, number[]>(); let q = 0
  for (const p of n.paths) for (let k = 1; k < p.pts.length; k++) {
    const [ax, az] = p.pts[k - 1], [bx, bz] = p.pts[k]
    segs[q] = ax; segs[q + 1] = az; segs[q + 2] = bx; segs[q + 3] = bz
    for (let j = Math.floor(Math.min(az, bz) / PD_CELL); j <= Math.floor(Math.max(az, bz) / PD_CELL); j++)
      for (let i = Math.floor(Math.min(ax, bx) / PD_CELL); i <= Math.floor(Math.max(ax, bx) / PD_CELL); i++) {
        const key = i * 100003 + j, l = grid.get(key); if (l) l.push(q); else grid.set(key, [q])
      }
    q += 4
  }
  const out = { grid, segs }; segIndexes.set(n, out); return out
}
/** the plain full scan: the oracle the indexed pathDistance is tested against */
export function pathDistanceScan(n: Network, x: number, z: number): number {
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

// ── THE ROAD FIELD (BETA M18): what the land needs to meet the paths. Pure. ────────────────────────────────────────────
/** A path's half width, for the sculpt (the drawn ribbon is PATH_W). */
export const PATH_HALF = PATH_W / 2
/** Settlement and fair ground stays flat: full inside the disc, fading out over DISC_FADE metres. */
export const DISC_FADE = 16
export interface RoadField {
  /** the nearest path point within `r` metres: its distance, the path's own height there, its half width */
  near(x: number, z: number, r: number): { d: number; y: number; hw: number } | null
  /** 0..1: how much a settlement's or the fair's flat ground holds this point (1 = fully flat, no relief) */
  flat(x: number, z: number): number
  /** the level pads (settlement lots) whose blend can reach (x, z): signed distance outside the pad + apron (<= 0 = on it) and its height */
  pads(x: number, z: number): { d: number; y: number }[]
}
/** a lot pad's size (settlement-lots LOT_W x LOT_D; a test asserts they agree) and the apron levelled round it */
export const PAD_W = 13.5, PAD_D = 8.5, PAD_APRON = 4.5, PAD_REACH = 20
/** Null when the bake carries no path heights (an older network): the caller keeps the M16 mask. */
/** `reach` = the farthest `near` is ever asked (relief.ts ROAD_REACH): each 32 m cell lists every segment within it, so a
 *  query reads ONE cell (a tile parse asks 63k times; a 7x7 cell scan cost ~0.7 s a tile). */
export function roadField(n: Network, reach = 70): RoadField | null {
  if (!n.paths.length || n.paths.some(p => p.pts.some(q => typeof q[2] !== 'number'))) return null
  const C = 32, key = (i: number, j: number) => i * 100003 + j
  type Seg = { ax: number; az: number; ay: number; bx: number; bz: number; by: number }
  const segs: Seg[] = [], cells = new Map<number, number[]>()
  for (const p of n.paths) for (let k = 1; k < p.pts.length; k++) {
    const [ax, az, ay] = p.pts[k - 1], [bx, bz, by] = p.pts[k]
    const id = segs.push({ ax, az, ay: ay!, bx, bz, by: by! }) - 1
    for (let j = Math.floor((Math.min(az, bz) - reach) / C); j <= Math.floor((Math.max(az, bz) + reach) / C); j++)
      for (let i = Math.floor((Math.min(ax, bx) - reach) / C); i <= Math.floor((Math.max(ax, bx) + reach) / C); i++) { const kk = key(i, j); const l = cells.get(kk); if (l) l.push(id); else cells.set(kk, [id]) }
  }
  const discs: { x: number; z: number; r: number }[] = n.settlements.map(s => ({ x: s.x, z: s.z, r: SETTLEMENT_CLEAR }))
  if (n.fair) discs.push({ x: n.fair.x, z: n.fair.z, r: FAIR_CLEAR })
  const pads: { x: number; z: number; s: number; c: number; y: number }[] = []
  for (const st of n.settlements) for (const p of st.pads ?? []) pads.push({ x: p[0], z: p[1], s: Math.sin(p[2]), c: Math.cos(p[2]), y: p[3] })
  const padR = Math.hypot(PAD_W, PAD_D) / 2 + PAD_APRON + PAD_REACH
  return {
    pads(x, z) {
      const out: { d: number; y: number }[] = []
      for (const p of pads) {
        const dx = x - p.x, dz = z - p.z
        if (dx * dx + dz * dz > padR * padR) continue
        // outside distance to the rotated rect (right = (c, -s), front = (-s, -c)), apron included
        const u = Math.abs(dx * p.c - dz * p.s) - (PAD_W / 2 + PAD_APRON), v = Math.abs(-dx * p.s - dz * p.c) - (PAD_D / 2 + PAD_APRON)
        out.push({ d: Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0), y: p.y })
      }
      return out
    },
    near(x, z, r) {
      const list = cells.get(key(Math.floor(x / C), Math.floor(z / C)))
      if (!list) return null
      let best: { d: number; y: number; hw: number } | null = null
      for (const id of list) {
        const g = segs[id], dx = g.bx - g.ax, dz = g.bz - g.az, L = dx * dx + dz * dz || 1
        const t = Math.max(0, Math.min(1, ((x - g.ax) * dx + (z - g.az) * dz) / L))
        const d = Math.hypot(g.ax + dx * t - x, g.az + dz * t - z)
        if (d <= r && (!best || d < best.d)) best = { d, y: g.ay + (g.by - g.ay) * t, hw: PATH_HALF }
      }
      return best
    },
    flat(x, z) {
      let f = 0
      for (const c of discs) { const d = Math.hypot(c.x - x, c.z - z) - c.r; if (d < DISC_FADE) f = Math.max(f, d <= 0 ? 1 : 1 - d / DISC_FADE) }
      return f * f * (3 - 2 * f)
    },
  }
}
