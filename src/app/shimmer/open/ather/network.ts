// The Wilds' path network for the season: settlements, the paths between them and Greg's stone, and where the
// Thistledown Fair pitches (baked by scripts/bake-wilds-network.mts → public/open/wilds/network-s<N>.json).
//
// Canon: generated free-Moglin settlements, fresh each season (ather-rework §3) · THE THISTLEDOWN FAIR, a travelling
// fair of free Moglins that pitches its big top at a new spot on the path network each season (RULED 11-17, athernyx
// 505c6d0). Placement, spacing, names and the tent's look = build.
//
// ★ PURE apart from `loadNetwork` (fetch).

import { LINGSTON, LINGSTON_CLEAR } from './lingston'
import { GLADE } from './moonwell-glade'
import { applySettlementEdits, type SettlementEdits } from './settlement-edits'   // M237
import { ensureEdits, settlementEditsLive } from './wilds-edits'
export const SEASON = 1   // until the season clock exists, the network is season 1's
export type SettlementBiome = 'shore' | 'meadow' | 'woods' | 'rock'
/** `biome` = what lies around it (the bake guarantees at least one of each, Alex 11-17); older bakes lack it */
/** `pads` (M39 s3, baked by scripts/bake-path-profiles.mts): each generated lot slot's level pad [x, z, yaw, y]: the footprint's
 *  ONE height, so every tile reads the same ground there (relief.ts levels it). Absent on the Glade and on older bakes. */
/** `homes` (M237, the owner's settlement layer): how many lots stand (settlement-lots caps at it); absent = the trades' own count */
export interface Settlement { id: string; name: string; x: number; z: number; biome?: SettlementBiome; pads?: [number, number, number, number][]; homes?: number }
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
/** BETA M233 (Alex 11-27, RULED Magii b4f51aa): the one troupe pitches SEVERAL tents a season, ONE contest each. */
export const CONTESTS = ['clash', 'dash', 'smash'] as const
export type Contest = typeof CONTESTS[number]
/** the banner word on each tent (plain UI label; @lark may reword) */
export const CONTEST_LABEL: Readonly<Record<Contest, string>> = { clash: 'Clash', dash: 'Dash', smash: 'Smash' }
/** a Clash tent's difficulty (Alex 11-27: 2 easy, 2 average, 1 difficult a season) */
export type ClashLevel = 'easy' | 'average' | 'difficult'
export const CLASH_LEVEL_LABEL: Readonly<Record<ClashLevel, string>> = { easy: 'Easy', average: 'Average', difficult: 'Difficult' }
/** `settlement` (M237 s2): pitched beside this settlement by the owner's layer (World Builder > Settlements > Event tent) */
export interface Tent extends Fair { contest: Contest; level?: ClashLevel; settlement?: string }
/** a tent's banner/prompt words: 'Smash', 'Clash · Easy' (plain UI labels; @lark may reword) */
export const tentLabel = (t: Pick<Tent, 'contest' | 'level'>) => t.level ? `${CONTEST_LABEL[t.contest]} · ${CLASH_LEVEL_LABEL[t.level]}` : CONTEST_LABEL[t.contest]
/** THE SEASON'S TENT PLAN = DATA (Alex 11-27): how many tents of each contest, and each Clash tent's difficulty.
 *  At least five Clash (2 easy, 2 average, 1 difficult), one Dash, one Smash for now. */
export const TENT_PLAN: readonly Pick<Tent, 'contest' | 'level'>[] = [
  { contest: 'clash', level: 'easy' }, { contest: 'clash', level: 'easy' }, { contest: 'clash', level: 'average' },
  { contest: 'clash', level: 'average' }, { contest: 'clash', level: 'difficult' }, { contest: 'dash' }, { contest: 'smash' },
]
/** `fair` = the first big top (older bakes have only it); `tents` (scripts/bake-fair-tents.mts) = every tent this season */
export interface Network { v: 1; season: number; settlements: Settlement[]; paths: Path[]; fair: Fair | null; tents?: Tent[] }

export const FAIR_NAME = 'The Thistledown Fair'
/** how near counts as "in" a settlement (the message line names it) and "at" the fair's door */
export const SETTLEMENT_R = 45, FAIR_R = 34, FAIR_DOOR_R = 9

/** `layer` (BETA M237): the owner's published settlement edits (World Builder > Settlements, settlement-edits.ts) applied on top of
 *  the baked file; the World Builder itself reads the bake bare (layer = false) and draws its draft's edits over it. */
export async function loadNetwork(season = SEASON, base = '/open/wilds', layer = true): Promise<Network | null> {
  try {
    const r = await fetch(`${base}/network-s${season}.json`); if (!r.ok) return null
    const n = withGlade((await r.json()) as Network); if (!layer) return n
    await ensureEdits()   // never throws: no layer = the bake as it is
    const rr = await withRoutes(n, applySettlementEdits(n, settlementEditsLive()), base)   // M237 s3: paths + pads follow moved/added ones
    const m = pitchOwnerTents(rr.m, rr.siteOk)   // M237 s2: the Fair pitches beside a settlement (s3: on dry land, off the Hollows' wells)
    if (typeof window !== 'undefined') (window as unknown as { __atherNet?: () => Network }).__atherNet = () => m   // checks: READ only
    return m
  } catch { return null }
}

/** M237 s4 (World Builder): the bake + a DRAFT's settlement edits routed the way the game routes the published layer (the same
 *  withRoutes: spurs to moved/added settlements, pads), so the builder draws the paths the game will. No edits = the bake. */
export async function routeSettlementEdits(baked: Network, edits: SettlementEdits | null | undefined, base = '/open/wilds'): Promise<Network> {
  return (await routeSettlementDraft(baked, edits, base)).net
}
/** M237 s5: the same routing + the moved/added settlements NO path reaches (settlement-routes islandIds: no way over the ground,
 *  an island). islands = null when the routing itself failed (tiles did not load): unknown, never a false warning. */
export async function routeSettlementDraft(baked: Network, edits: SettlementEdits | null | undefined, base = '/open/wilds'): Promise<{ net: Network; islands: string[] | null }> {
  const m = applySettlementEdits(baked, edits)
  if (m === baked) return { net: baked, islands: [] }
  const r = await withRoutes(baked, m, base)
  if (!r.routed) return { net: r.m, islands: null }
  return { net: r.m, islands: (await import('./settlement-routes')).islandIds(r.m) }
}

/** M237 s3: the raw tiles round the owner's moved/added settlements (and its tent asks) are fetched, and settlement-routes.ts
 *  routes their spurs, levels their pads and tests the tents' ground on them. Any failure = the merge as it was (s2). */
async function withRoutes(baked: Network, m: Network, root: string): Promise<{ m: Network; siteOk?: (x: number, z: number) => boolean; routed?: true }> {
  if (m === baked) return { m }
  try {
    const R = await import('./settlement-routes')
    const asks = m.settlements.filter(s => (s as { tent?: unknown }).tent).map(s => ({ x: s.x, z: s.z, r: OWNER_TENT_RINGS[OWNER_TENT_RINGS.length - 1] + 28 + R.TENT_NODE_CLEAR }))
    const want = R.tilesFor(R.groundBoxes(baked, m, asks))
    const idx = (await (await fetch(`${root}/tiles.json`)).json()) as { tiles: { name: string; tx: number; ty: number; nodes: { x: number; z: number }[] }[] }
    const have = idx.tiles.filter(t => want.some(w => w.tx === t.tx && w.ty === t.ty))
    const get = async (u: string) => { const res = await fetch(u); if (!res.ok) throw new Error(`${u} ${res.status}`); return res }
    const tiles = await Promise.all(have.map(async t => {
      const [meta, bin, bio] = await Promise.all([get(`${root}/${t.name}.json`).then(x => x.json()), get(`${root}/${t.name}.bin`).then(x => x.arrayBuffer()), get(`${root}/${t.name}.biome`).then(x => x.arrayBuffer())])
      return { tx: t.tx, ty: t.ty, meta, dm: new Int16Array(bin), bio: new Uint8Array(bio) }
    }))
    const g = R.groundOf(tiles)
    const nodes = have.flatMap(t => t.nodes.map(q => ({ x: q.x + t.tx * 1000, z: q.z + t.ty * 1000 })))
    return { m: R.rerouteNetwork(baked, m, g), siteOk: R.tentSiteOk(g, nodes), routed: true }
  } catch { return { m } }
}

/** Moonwell Glade joined every season's settlements (M30) until M67 s1b-2 (hub 11-22) took it OUT of the Wilds into the
 *  closed Glade (glade-cluster.ts): it is no longer a Wilds settlement (no node, no disc, no folk drawn there; the baked
 *  networks never routed a road to it). Kept as the identity so every loader/check keeps one call site; a stray Glade
 *  node in an old network file is dropped. */
export const withGlade = (n: Network): Network => (n.settlements.some(s => s.id === GLADE.id) ? { ...n, settlements: n.settlements.filter(s => s.id !== GLADE.id) } : n)

/** The settlement the keeper stands in, if any. */
export function settlementAt(n: Network, x: number, z: number): Settlement | null {
  for (const s of n.settlements) if (Math.hypot(s.x - x, s.z - z) < SETTLEMENT_R) return s
  return null
}
/** every tent this season: the baked `tents`, else the lone big top (an older bake) holding SMASH */
export const tentsOf = (n: Network): Tent[] => n.tents?.length ? n.tents : n.fair ? [{ ...n.fair, contest: 'smash' }] : []
export const nearFair = (n: Network, x: number, z: number, r = FAIR_R) => tentsOf(n).some(t => Math.hypot(t.x - x, t.z - z) < r)
/** the tent whose door the keeper stands at, if any */
export function tentAtDoor(n: Network, x: number, z: number): Tent | null {
  for (const t of tentsOf(n)) { const d = fairDoor(t); if (Math.hypot(d.x - x, d.z - z) < FAIR_DOOR_R) return t }
  return null
}
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
  for (const t of tentsOf(n)) disc(t.x, t.z, FAIR_CLEAR)
  disc(LINGSTON.x, LINGSTON.z, LINGSTON_CLEAR)   // M228: Lingston's square (stand-in spot, lingston.ts)
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
  for (const t of tentsOf(n)) discs.push({ x: t.x, z: t.z, r: FAIR_CLEAR })
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

// ── THE TENTS (BETA M233 s1): where the season's contest tents pitch. Pure; the bake (scripts/bake-fair-tents.mts) hands it
// the ground test. Same rule as the first big top (a flat meadow 38 m off a path, door facing it, 1.2 to 3 km from Greg's
// stone, widened to 0.9..3.6 km for room); the first big top stays where it stood, and each other tent is at least
// TENT_SPACING from every tent and clear of settlements, so the tents spread along the network. Season-seeded.
export const TENT_SPACING = 450, TENT_SETTLEMENT_GAP = 160
const GREG_STONE = { x: -300, z: 300 }
export function pickTents(n: Pick<Network, 'paths' | 'settlements' | 'fair' | 'season'>, siteOk: (x: number, z: number) => boolean, plan: readonly Pick<Tent, 'contest' | 'level'>[] = TENT_PLAN): Tent[] {
  let seed = ((n.season * 2246822519) ^ 0x9e3779b9) >>> 0
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const spots: Fair[] = []
  for (const p of n.paths) for (let k = 3; k < p.pts.length - 3; k += 4) {
    const [x, z] = p.pts[k], d = Math.hypot(x - GREG_STONE.x, z - GREG_STONE.z)
    if (d < 900 || d > 3600) continue
    const [x1, z1] = p.pts[k + 1], tx = x1 - x, tz = z1 - z, l = Math.hypot(tx, tz) || 1
    for (const side of [1, -1]) {
      const cx = Math.round(x + (-tz / l) * 38 * side), cz = Math.round(z + (tx / l) * 38 * side)
      if (n.settlements.some(s => Math.hypot(s.x - cx, s.z - cz) < TENT_SETTLEMENT_GAP)) continue
      if (siteOk(cx, cz)) spots.push({ x: cx, z: cz, yaw: Math.atan2(x - cx, z - cz), path: `${p.a}-${p.b}` })
    }
  }
  for (let k = spots.length - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); [spots[k], spots[r]] = [spots[r], spots[k]] }
  const chosen: Fair[] = n.fair ? [n.fair] : []
  for (const s of spots) {
    if (chosen.length >= plan.length) break
    if (chosen.every(c => Math.hypot(c.x - s.x, c.z - s.z) >= TENT_SPACING)) chosen.push(s)
  }
  // which slot of the plan each spot takes is a season-seeded shuffle (so the first big top holds a different contest by season)
  const slots = plan.map(x => ({ ...x }))
  for (let k = slots.length - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); [slots[k], slots[r]] = [slots[r], slots[k]] }
  return chosen.map((f, i) => ({ ...f, ...slots[i] }))
}

// ── M237 s2: THE FAIR PITCHES BESIDE IT (Magii d2e2dca: the tents are the Thistledown troupe's; the owner's Event tent on a
// settlement = "the Fair pitches beside it this season"). RULE: an owner tent TAKES OVER the baked plan's tent of the same contest
// + level (the nearest such one not already taken), so the season keeps the plan's counts (5 Clash 2/2/1, 1 Dash, 1 Smash) and a
// Clash tent keeps its number (its pregenerated line-up, its once-per-season prize). Only when every baked tent of that kind is
// already taken does it ADD one. Pure.
/** how far out from the settlement's centre the tent stands: past the lots' ring (pads reach ~30 m) by the big top's own ground */
export const OWNER_TENT_RINGS = [60, 75, 90] as const
/** a pitch keeps this far off every path, other settlements' ground and other tents' ground */
export const OWNER_TENT_PATH_GAP = 24
const OWNER_TENT_ANGLES = 24
/** where the Fair pitches beside settlement `s`: the nearest ring with room, and on it the angle farthest from any path (ties: the
 *  first). Door faces the settlement. `others` = every other tent standing. Null = no room (the editor says so). */
export function ownerTentSpot(n: Network, s: Settlement, others: readonly Fair[], siteOk: (x: number, z: number) => boolean = () => true): Fair | null {
  for (const r of OWNER_TENT_RINGS) {
    let best: Fair | null = null, bestD = -1
    for (let k = 0; k < OWNER_TENT_ANGLES; k++) {
      const a = (k / OWNER_TENT_ANGLES) * Math.PI * 2, x = Math.round(s.x + Math.sin(a) * r), z = Math.round(s.z + Math.cos(a) * r)
      const pd = n.paths.length ? pathDistanceScan(n, x, z) : Infinity
      if (pd < OWNER_TENT_PATH_GAP) continue
      if (n.settlements.some(o => o.id !== s.id && Math.hypot(o.x - x, o.z - z) < SETTLEMENT_CLEAR + FAIR_CLEAR)) continue
      if (others.some(t => Math.hypot(t.x - x, t.z - z) < FAIR_CLEAR * 2)) continue
      if (Math.hypot(LINGSTON.x - x, LINGSTON.z - z) < LINGSTON_CLEAR + FAIR_CLEAR) continue
      if (!siteOk(x, z)) continue
      const score = Math.min(pd, 60)
      if (score > bestD) { bestD = score; best = { x, z, yaw: Math.atan2(s.x - x, s.z - z), path: `owner:${s.id}` } }
    }
    if (best) return best
  }
  return null
}
/** the merged network's tents with every settlement's owner tent pitched (see the rule above). No owner tent = the same object. */
export function pitchOwnerTents(n: Network, siteOk?: (x: number, z: number) => boolean): Network {
  const asks = n.settlements.filter(s => (s as { tent?: Pick<Tent, 'contest' | 'level'> }).tent) as (Settlement & { tent: Pick<Tent, 'contest' | 'level'> })[]
  if (!asks.length) return n
  const tents: Tent[] = tentsOf(n).map(t => ({ ...t })), taken = new Set<number>()
  for (const s of asks) {
    const want = s.tent, kind = (t: Tent) => t.contest === want.contest && (t.level ?? null) === (want.contest === 'clash' ? want.level ?? 'easy' : null)
    let slot = -1, sd = Infinity
    tents.forEach((t, i) => { if (!taken.has(i) && !t.settlement && kind(t)) { const d = Math.hypot(t.x - s.x, t.z - s.z); if (d < sd) { sd = d; slot = i } } })
    const spot = ownerTentSpot(n, s, tents.filter((_, i) => i !== slot), siteOk)
    if (!spot) continue   // no room beside it: the baked tent stays where it was
    const t: Tent = { ...spot, contest: want.contest, settlement: s.id, ...(want.contest === 'clash' ? { level: want.level ?? 'easy' } : {}) }
    if (slot >= 0) { tents[slot] = t; taken.add(slot) } else { taken.add(tents.push(t) - 1) }
  }
  return { ...n, tents }
}
/** M237 s2 counter: the owner's tent for this settlement as pitched (null = none asked, or no room) */
export const ownerTentOf = (n: Network, sid: string): Tent | null => tentsOf(n).find(t => t.settlement === sid) ?? null
