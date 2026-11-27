// ── BETA M237 s3: PATHS AND PADS FOLLOW THE OWNER'S SETTLEMENTS (Alex 11-27: "paths re-route to a moved settlement"). The season's
// paths and lot pads are BAKED (scripts/bake-wilds-network.mts routes, scripts/bake-path-profiles.mts heights + pads) on the raw
// tiles. A settlement the owner MOVED or ADDED (settlement-edits.ts) gets the same treatment at load, on the same raw ground:
//   - a SPUR: A* on the bake's own 20 m lattice (same costs: no open water, steep costs, woods/rock/shore dearer), from the
//     settlement to the nearest point of the network, smoothed like the bake, then given the bake's height profile (smoothed,
//     grade-capped, cut-limited), its far end pinned to the network's own height there, so the ribbon and the sculpt join seamlessly;
//   - LEVEL PADS for its five lot slots: the mean raw ground over each footprint, exactly as the bake levels them;
//   - a removed or moved settlement's DEAD-END spur goes (its only path, when it had just one: a path that carries on to another
//     place stays, the old centre is a crossroads now).
// The ground comes from the tiles round the edits only (network.ts loadNetwork fetches them; a test drives it from the files).
// ★ PURE: no fetch, no React. The bake scripts stay the source; settlement-routes.test holds this copy to their numbers.
import type { Network, Path, Settlement, Fair } from './network'
import { lotSlot, MAX_LOTS, LOT_W, LOT_D } from './settlement-lots'

/** one raw tile, as the files hold it: meta + decimetre heights + biome cells (tiles.json gives tx, ty) */
export interface TileData { tx: number; ty: number; meta: { nx: number; nz: number; cell: number; sizeX: number; sizeZ: number; waterY: number }; dm: Int16Array; bio: Uint8Array }
export interface Ground {
  /** the RAW ground at a world point (the mesh's two triangles per cell, no relief); NaN off the tiles */
  raw(x: number, z: number): number
  /** the bake's routing sample: the cell corner's height + the cell's biome; null off the tiles */
  cell(x: number, z: number): { h: number; b: number } | null
}
const TILE = 1000
export function groundOf(tiles: readonly TileData[]): Ground {
  const by = new Map(tiles.map(t => [`${t.tx},${t.ty}`, t]))
  const at = (x: number, z: number) => by.get(`${Math.floor((x + TILE / 2) / TILE)},${Math.floor((z + TILE / 2) / TILE)}`)
  return {
    raw(x, z) {
      const t = at(x, z); if (!t) return NaN
      const { nx, nz, cell, sizeX, sizeZ } = t.meta, lx = x - t.tx * TILE, lz = z - t.ty * TILE
      const fx = Math.min(nx - 1 - 1e-6, Math.max(0, (lx + sizeX / 2) / cell)), fz = Math.min(nz - 1 - 1e-6, Math.max(0, (lz + sizeZ / 2) / cell))
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, H = (a: number, b: number) => t.dm[b * nx + a] / 10
      const h00 = H(i, j), h10 = H(i + 1, j), h01 = H(i, j + 1), h11 = H(i + 1, j + 1)
      return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v
    },
    cell(x, z) {
      const t = at(x, z); if (!t) return null
      const { nx, nz, cell } = t.meta, lx = x - t.tx * TILE + TILE / 2, lz = z - t.ty * TILE + TILE / 2
      const i = Math.min(nx - 2, Math.max(0, Math.floor(lx / cell))), j = Math.min(nz - 2, Math.max(0, Math.floor(lz / cell)))
      return { h: t.dm[j * nx + i] / 10, b: t.bio[j * (nx - 1) + i] }
    },
  }
}

// ── the route (scripts/bake-wilds-network.mts › route, on a window of the same lattice) ──
const W = { water: 0, shore: 1, meadow: 2, woods: 3, rock: 4 }
/** the bake's routing grid (G) and how far round the two ends the window reaches */
export const ROUTE_G = 20, ROUTE_PAD = 300
/** a spur the first window cannot route (a lake or a ridge in the way) tries this wider one (the ground fetched covers it) */
export const ROUTE_PAD_WIDE = 600
export function routeOn(g: Ground, a: { x: number; z: number }, b: { x: number; z: number }, pad = ROUTE_PAD): [number, number][] | null {
  const G = ROUTE_G
  const I0 = Math.floor((Math.min(a.x, b.x) - pad) / G), J0 = Math.floor((Math.min(a.z, b.z) - pad) / G)
  const GW = Math.floor((Math.max(a.x, b.x) + pad) / G) - I0 + 1, GH = Math.floor((Math.max(a.z, b.z) + pad) / G) - J0 + 1
  const H = new Float32Array(GW * GH), B = new Uint8Array(GW * GH).fill(255)
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const s = g.cell((I0 + i + 0.5) * G, (J0 + j + 0.5) * G); if (s) { H[j * GW + i] = s.h; B[j * GW + i] = s.b } }
  const inG = (i: number, j: number) => i >= 0 && j >= 0 && i < GW && j < GH
  const dry = (i: number, j: number) => inG(i, j) && B[j * GW + i] !== 255 && B[j * GW + i] !== W.water
  const slopeAt = (i: number, j: number) => {
    let m = 0; const h = H[j * GW + i]
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (dry(i + di, j + dj)) m = Math.max(m, Math.abs(H[(j + dj) * GW + i + di] - h) / G)
    return m
  }
  const cost = (i: number, j: number) => {
    const bb = B[j * GW + i], s = slopeAt(i, j)
    if (s > 0.45) return Infinity
    return (bb === W.woods ? 1.7 : bb === W.rock ? 3 : bb === W.shore ? 1.4 : 1) * (1 + 40 * s * s)
  }
  const si = Math.floor(a.x / G) - I0, sj = Math.floor(a.z / G) - J0, ti = Math.floor(b.x / G) - I0, tj = Math.floor(b.z / G) - J0
  const N = GW * GH, gg = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N)
  const heap: [number, number][] = []
  const push = (f: number, k: number) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p } }
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m } } return top }
  const hz = (i: number, j: number) => Math.hypot(i - ti, j - tj)
  if (!inG(si, sj) || !inG(ti, tj)) return null
  const s0 = sj * GW + si; gg[s0] = 0; push(hz(si, sj), s0)
  while (heap.length) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1
    const i = k % GW, j = (k / GW) | 0
    if (i === ti && j === tj) break
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue
      const a2 = i + di, c2 = j + dj; if (!dry(a2, c2)) continue
      const n = c2 * GW + a2; if (closed[n]) continue
      const w = cost(a2, c2); if (!Number.isFinite(w)) continue
      const ng = gg[k] + w * (di && dj ? Math.SQRT2 : 1)
      if (ng < gg[n]) { gg[n] = ng; from[n] = k; push(ng + hz(a2, c2), n) }
    }
  }
  const t0 = tj * GW + ti; if (t0 !== s0 && from[t0] < 0) return null
  const pts: [number, number][] = []
  for (let k = t0; k >= 0; k = from[k]) pts.push([(I0 + (k % GW) + 0.5) * G, (J0 + ((k / GW) | 0) + 0.5) * G])
  if (pts.length < 2) pts.push(pts[0])
  pts.reverse(); pts[0] = [a.x, a.z]; pts[pts.length - 1] = [b.x, b.z]
  for (let pass = 0; pass < 4; pass++) for (let k = 1; k < pts.length - 1; k++) pts[k] = [(pts[k - 1][0] + pts[k][0] * 2 + pts[k + 1][0]) / 4, (pts[k - 1][1] + pts[k][1] * 2 + pts[k + 1][1]) / 4]
  return pts.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10])
}

// ── the height profile (scripts/bake-path-profiles.mts, same numbers) ──
export const STEP = 2, HALF_WINDOW = 15, MAX_GRADE = 0.18, MAX_CUT = 6
/** a path's own height at each of its points. `endY` pins the LAST point to that height (a spur meets the network's path there). */
export function profilePath(P: readonly (readonly number[])[], rawAt: (x: number, z: number) => number, endY?: number): [number, number, number][] {
  const xs: number[] = [], zs: number[] = [], at: number[] = [0]
  for (let k = 0; k < P.length - 1; k++) {
    const [ax, az] = P[k], [bx, bz] = P[k + 1], L = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.round(L / STEP))
    for (let s = 0; s < m; s++) { xs.push(ax + ((bx - ax) * s) / m); zs.push(az + ((bz - az) * s) / m) }
    at.push(xs.length)
  }
  xs.push(P[P.length - 1][0]); zs.push(P[P.length - 1][1])
  const raw = xs.map((x, i) => rawAt(x, zs[i]))
  for (let i = 0; i < raw.length; i++) if (!Number.isFinite(raw[i])) raw[i] = raw[i - 1] ?? raw.find(Number.isFinite) ?? 0
  if (endY !== undefined) raw[raw.length - 1] = endY
  let y = raw.slice()
  const w = Math.round(HALF_WINDOW / STEP)
  for (let pass = 0; pass < 2; pass++) {
    const o = y.slice()
    for (let i = 1; i < y.length - 1; i++) { let s = 0, c = 0; for (let k = Math.max(0, i - w); k <= Math.min(y.length - 1, i + w); k++) { s += y[k]; c++ } o[i] = s / c }
    y = o
  }
  const g = MAX_GRADE * STEP, lo = y.slice(), hi = y.slice()
  for (let i = 1; i < y.length; i++) { lo[i] = Math.min(lo[i], lo[i - 1] + g); hi[i] = Math.max(hi[i], hi[i - 1] - g) }
  for (let i = y.length - 2; i >= 0; i--) { lo[i] = Math.min(lo[i], lo[i + 1] + g); hi[i] = Math.max(hi[i], hi[i + 1] - g) }
  const fin = y.map((_, i) => Math.max(raw[i] - MAX_CUT, Math.min(raw[i] + MAX_CUT, (lo[i] + hi[i]) / 2)))
  if (endY !== undefined) fin[fin.length - 1] = endY
  return P.map((q, k) => [q[0], q[1], Math.round(fin[at[k]] * 100) / 100])
}

/** the five lot pads of a settlement standing at (s.x, s.z): [x, z, yaw, y], y = the mean raw ground over the footprint (the bake's rule) */
export function levelPads(s: Settlement, season: number, rawAt: (x: number, z: number) => number): [number, number, number, number][] | null {
  const out: [number, number, number, number][] = []
  for (let k = 0; k < MAX_LOTS; k++) {
    const l = lotSlot(s, season, k), sn = Math.sin(l.yaw), cs = Math.cos(l.yaw)
    let sum = 0, c = 0
    for (let a = -LOT_W / 2; a <= LOT_W / 2 + 1e-6; a += 1.5) for (let b = -LOT_D / 2; b <= LOT_D / 2 + 1e-6; b += 1.5) {
      const y = rawAt(l.x + cs * a + sn * b, l.z - sn * a + cs * b)
      if (Number.isFinite(y)) { sum += y; c++ }
    }
    if (!c) return null
    out.push([Math.round(l.x * 100) / 100, Math.round(l.z * 100) / 100, l.yaw, Math.round((sum / c) * 100) / 100])
  }
  return out
}

// ── the merge ──
type Edited = Settlement & { moved?: boolean; added?: boolean }
/** a moved/added settlement this near a path point already stands on the network: no spur */
export const SPUR_MIN = 12
/** the spur paths' far-end label: `~` + the path it meets (never a settlement id, so nothing reads it as one) */
export const spurEnd = (p: Path) => `~${p.a}-${p.b}`
/** the settlements whose ground the merge needs: moved or added ones */
export const rerouted = (m: Network): Edited[] => (m.settlements as Edited[]).filter(s => s.moved || s.added)
/** baked paths that go: a removed or moved settlement's path when it was that settlement's ONLY one (a dead-end spur) */
export function keptPaths(base: Network, m: Network): Path[] {
  const here = new Map(m.settlements.map(s => [s.id, s as Edited]))
  const gone = new Set(base.settlements.filter(s => !here.has(s.id) || here.get(s.id)!.moved).map(s => s.id))
  const deg = new Map<string, number>()
  for (const p of base.paths) for (const e of [p.a, p.b]) deg.set(e, (deg.get(e) ?? 0) + 1)
  return base.paths.filter(p => !((gone.has(p.a) && deg.get(p.a) === 1) || (gone.has(p.b) && deg.get(p.b) === 1)))
}
/** the nearest path point to (x, z): which path, which point */
export function nearestPoint(paths: readonly Path[], x: number, z: number): { p: Path; k: number; d: number } | null {
  let best: { p: Path; k: number; d: number } | null = null
  for (const p of paths) p.pts.forEach((q, k) => { const d = Math.hypot(q[0] - x, q[1] - z); if (!best || d < best.d) best = { p, k, d } })
  return best
}
/** the world boxes [x0, z0, x1, z1] whose raw ground the merge needs (tiles to fetch): each spur's window, each pad ring */
export function groundBoxes(base: Network, m: Network, extra: readonly { x: number; z: number; r: number }[] = []): [number, number, number, number][] {
  const kept = keptPaths(base, m), out: [number, number, number, number][] = []
  for (const s of rerouted(m)) {
    const t = nearestPoint(kept, s.x, s.z), r = (t ? t.d : 0) + ROUTE_PAD_WIDE + ROUTE_G
    out.push([s.x - r, s.z - r, s.x + r, s.z + r])
  }
  for (const e of extra) out.push([e.x - e.r, e.z - e.r, e.x + e.r, e.z + e.r])
  return out
}
/** the tiles (tx, ty) those boxes touch */
export function tilesFor(boxes: readonly [number, number, number, number][]): { tx: number; ty: number }[] {
  const seen = new Map<string, { tx: number; ty: number }>()
  for (const [x0, z0, x1, z1] of boxes)
    for (let ty = Math.floor((z0 + TILE / 2) / TILE); ty <= Math.floor((z1 + TILE / 2) / TILE); ty++)
      for (let tx = Math.floor((x0 + TILE / 2) / TILE); tx <= Math.floor((x1 + TILE / 2) / TILE); tx++) seen.set(`${tx},${ty}`, { tx, ty })
  return [...seen.values()]
}
/** THE MERGE, step 2: `m` = the bake with the owner's edits (applySettlementEdits), `base` = the bake bare. Dead-end spurs of
 *  removed/moved settlements go; each moved/added settlement gets its pads and a spur to the nearest network point. No such
 *  settlement and nothing removed = the very same object. */
export function rerouteNetwork(base: Network, m: Network, g: Ground): Network {
  const moved = rerouted(m)
  const kept = keptPaths(base, m)
  if (!moved.length && kept.length === base.paths.length) return m
  const paths: Path[] = kept.slice()
  const settlements = m.settlements.map(s => {
    if (!(s as Edited).moved && !(s as Edited).added) return s
    const pads = levelPads(s, m.season, g.raw)
    return pads ? { ...s, pads } : s
  })
  for (const s of moved) {
    const t = nearestPoint(paths, s.x, s.z)
    if (!t || t.d < SPUR_MIN) continue
    const q = t.p.pts[t.k], to = { x: q[0], z: q[1] }, pts = routeOn(g, s, to) ?? routeOn(g, s, to, ROUTE_PAD_WIDE)
    if (!pts) continue   // no way over the ground (an island): it stands off the network, as a bake drops it
    paths.push({ a: s.id, b: spurEnd(t.p), pts: profilePath(pts, g.raw, typeof q[2] === 'number' ? q[2] : undefined) })
  }
  return { ...m, settlements, paths }
}

/** M237 s5: a moved/added settlement stands ON the network when a path point is this near it (a spur starts on the lattice
 *  point nearest it, under 15 m; one already beside a path is under SPUR_MIN) */
export const REACH_M = 30
/** M237 s5: the moved/added settlements NO path reaches after the merge (rerouteNetwork found no way over the ground: an island).
 *  The World Builder warns on its marker, list line and panel, and Publish asks first. */
export function islandIds(m: Network): string[] {
  return rerouted(m).filter(s => { const t = nearestPoint(m.paths, s.x, s.z); return !t || t.d >= REACH_M }).map(s => s.id)
}

// ── the Fair's pitch beside a settlement (M237 s2 ownerTentSpot's siteOk): dry land, off the Hollows' wells ──
/** a pitch keeps this far from an infected node (tiles.json nodes, where the Hollows well up) */
export const TENT_NODE_CLEAR = 60
/** the tent's ground: no open water (or off the map) within its own clear radius, sampled every 10 m */
export function tentSiteOk(g: Ground, nodes: readonly { x: number; z: number }[], r = 28): (x: number, z: number) => boolean {
  return (x, z) => {
    if (nodes.some(n => Math.hypot(n.x - x, n.z - z) < TENT_NODE_CLEAR)) return false
    for (let dz = -r; dz <= r; dz += 10) for (let dx = -r; dx <= r; dx += 10) {
      if (dx * dx + dz * dz > r * r) continue
      const c = g.cell(x + dx, z + dz)
      if (!c || c.b === W.water) return false
    }
    return true
  }
}
export type { Fair }
