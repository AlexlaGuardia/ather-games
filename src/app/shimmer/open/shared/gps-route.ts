// BETA M63 s2: THE GPS ROUTE (2026-11-21, Jin sprites ae450348). Alex 11-21: the quest trail "goes straight through
// mountains". This plans the walk instead: on the continent, along the roads where they lead toward the goal, then over the
// land; in the Wilds and Ather, a coarse path over the ground that goes AROUND slopes the walker cannot climb and around water.
//
// ★ PURE. No three, no react. The world is injected: `ground(x, z)` (the same probe QuestGuide already gets), an optional
//   `water(x, z)`, and on the continent a `RoadGraph` (build it once with `roadGraph(region.meta.network)`). So the whole
//   planner runs against a synthetic ridge in gps-route.test.ts.
//
// ★ WHAT "WALKABLE" MEANS HERE: the rise between two ground samples ONE METRE apart is at most `maxRise`
//   (default MAX_WALK_GRADIENT, ~46°, terrain-world.ts's rule for land you can walk up). On smooth land that is the
//   gradient; on voxel ground it lets a single block through (a vault, one press) and stops a 2-high face (climb country),
//   which matches locomotion.ts's own split. Both directions are held to it: a guide must not send you off a cliff either.
//   Every point-to-point leg the planner emits off-road was checked at that 1 m spacing (`clear()`), including the
//   shortcuts the smoother takes, so the "never exceeds walkable slope" promise is about the polyline, not the grid.
//
// ★ ROADS: trusted, not slope-checked (they are graded by the Atlas, and a tunnel's road runs under the hill the height
//   probe reports). A road route costs ROAD_COST per metre against 1 per metre off-road, and it is taken only when
//   (walk to the road + road + walk from the road) beats walking straight there. So a goal 30 m away ignores the road
//   that loops round, and a goal 2 km away takes it.
//
// ★ BUDGET: one `planRoute` spends at most `budget` grid expansions across all its legs (default 24k, measured ~10-40 ms
//   on the continent in the test). The grid's cell grows with the leg's length so a long leg stays inside it. Out of
//   budget or no way through = the best partial path (`reached: false`) toward the goal, never nothing; if even that
//   fails, a straight line (`mode: 'straight'`), so the guide always has something to draw.
//   ★ RESUMABLE (hub 11-21: 60-160 ms on the box is 300-600 ms on a mid phone, and an idle callback still blocks once it
//   runs): the planner is a generator (`planSteps`) that yields every YIELD_EVERY expansions. `GuideRoute` is what the
//   frame loop holds: it replans only on a new goal or a stray (never per frame, never on a timer), steps the plan for
//   at most SLICE_MS a frame, and keeps handing back the old route (or null = straight dots) until the new one lands.

import { MAX_WALK_GRADIENT } from '../terrain-world'

export type XZ = [number, number]
export interface RouteWorld {
  ground: (x: number, z: number) => number
  water?: (x: number, z: number) => boolean
  roads?: RoadGraph | null
  /** max rise per metre of ground (default MAX_WALK_GRADIENT) */
  maxRise?: number
}
export interface Route {
  pts: XZ[]
  /** metres along pts */
  length: number
  mode: 'terrain' | 'road' | 'straight'
  /** false = the route ends at the nearest point it could reach (budget, or the goal is somewhere you cannot walk) */
  reached: boolean
  /** grid expansions spent */
  spent: number
}

export const SAMPLE = 1
export const ROAD_COST = 0.6
export const DEFAULT_BUDGET = 24000
/** how many nearest roads to try joining (and leaving) by */
const ROAD_TRIES = 3
/** a goal within this of a road, or a start within it, joins without a terrain leg */
const ON_ROAD = 3

// ── the 1 m check ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Every 1 m step from a to b rises/falls at most maxRise and is dry. */
export function clear(w: RouteWorld, ax: number, az: number, bx: number, bz: number): boolean {
  const max = w.maxRise ?? MAX_WALK_GRADIENT
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / SAMPLE)), step = d / n
  let ph = w.ground(ax, az)
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, h = w.ground(x, z)
    if (step > 0 && Math.abs(h - ph) > max * Math.max(step, 1e-6) + 1e-9) return false
    if (w.water && w.water(x, z)) return false   // the start is not checked: you may walk out of water
    ph = h
  }
  return true
}

// ── a binary heap of (f, id) ────────────────────────────────────────────────────────────────────────────────────────
class Heap {
  f: number[] = []; id: number[] = []
  get size() { return this.f.length }
  push(f: number, id: number) {
    const F = this.f, I = this.id; let i = F.length; F.push(f); I.push(id)
    while (i > 0) { const p = (i - 1) >> 1; if (F[p] <= f) break; F[i] = F[p]; I[i] = I[p]; i = p }
    F[i] = f; I[i] = id
  }
  pop(): number {
    const F = this.f, I = this.id, top = I[0], lf = F.pop()!, li = I.pop()!
    if (F.length) {
      let i = 0; const n = F.length
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && F[c + 1] < F[c]) c++; if (F[c] >= lf) break; F[i] = F[c]; I[i] = I[c]; i = c }
      F[i] = lf; I[i] = li
    }
    return top
  }
}

const NB: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

/**
 * Over the land from a to b: A* on a coarse grid (8-way, an edge exists only if `clear`), then a smoother that takes the
 * longest clear shortcut. Returns the path and the expansions it spent.
 */
export type Leg = { pts: XZ[]; reached: boolean; spent: number; length: number }
export function terrainPath(w: RouteWorld, a: XZ, b: XZ, budget = DEFAULT_BUDGET): Leg { return drain(terrainSteps(w, a, b, budget)) }

/** Run a resumable plan to the end in one go (tests, and anything off the frame loop). */
export function drain<T>(g: Generator<void, T>): T { for (;;) { const r = g.next(); if (r.done) return r.value } }

/** terrainPath, resumable: yields every YIELD_EVERY grid expansions (and between smoothing chords). */
export function* terrainSteps(w: RouteWorld, a: XZ, b: XZ, budget = DEFAULT_BUDGET): Generator<void, Leg> {
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (dist < 1e-6) return { pts: [a, b], reached: true, spent: 0, length: 0 }
  if (clear(w, a[0], a[1], b[0], b[1])) return { pts: [a, b], reached: true, spent: 0, length: dist }
  // standing in water: wade to the nearest dry ground first (the grid never enters water)
  if (w.water?.(a[0], a[1])) {
    const dry = nearestDry(w, a)
    if (!dry) return { pts: [a], reached: false, spent: 0, length: 0 }
    const rest: Leg = yield* terrainSteps(w, dry, b, budget)
    const pts = [a, ...rest.pts]
    return { ...rest, pts, length: polyLength(pts) }
  }
  // the box round both ends grows when the way round lies outside it (a ridge longer than the trip)
  let spent = 0, last: GridLeg | null = null
  for (const f of [0.6, 1.6, 4]) {
    if (spent >= budget) break
    const r: GridLeg = yield* gridSteps(w, a, b, Math.max(40, dist * f), budget - spent)
    spent += r.spent
    if (r.reached) return { ...r, spent }
    if (!last || r.left < last.left) last = r
  }
  return { ...last!, spent }
}

/** The nearest dry point within 80 m (rings every 2 m, 16 bearings), or null. */
function nearestDry(w: RouteWorld, a: XZ): XZ | null {
  for (let r = 2; r <= 80; r += 2) for (let k = 0; k < 16; k++) {
    const t = (k / 16) * Math.PI * 2, x = a[0] + Math.cos(t) * r, z = a[1] + Math.sin(t) * r
    if (!w.water!(x, z)) return [x, z]
  }
  return null
}

/** Grid expansions between yields on a 2 m grid. A big leg's cells are bigger and every `clear` between them samples
 *  every metre, so the batch shrinks with the cell (64 / cell, at least 1): one batch stays ~0.1-0.3 ms on the box. */
export const YIELD_EVERY = 32
type GridLeg = Leg & { left: number }
function* gridSteps(w: RouteWorld, a: XZ, b: XZ, margin: number, budget: number): Generator<void, GridLeg> {
  // the grid: a box round both ends with room to go round, cells sized so it stays ~≤ 160 across
  const x0 = Math.min(a[0], b[0]) - margin, z0 = Math.min(a[1], b[1]) - margin
  const spanX = Math.abs(b[0] - a[0]) + 2 * margin, spanZ = Math.abs(b[1] - a[1]) + 2 * margin
  const cell = Math.max(2, Math.max(spanX, spanZ) / 160)
  const nx = Math.ceil(spanX / cell) + 1, nz = Math.ceil(spanZ / cell) + 1
  const cx = (i: number) => x0 + i * cell, cz = (j: number) => z0 + j * cell
  const g = new Float64Array(nx * nz).fill(Infinity), prev = new Int32Array(nx * nz).fill(-1), shut = new Uint8Array(nx * nz)
  const gi = Math.round((b[0] - x0) / cell), gj = Math.round((b[1] - z0) / cell)
  const h = (i: number, j: number) => { const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return cell * (Math.max(dx, dz) + 0.41421356 * Math.min(dx, dz)) }
  const heap = new Heap()
  // seed: every cell round the start you can walk to from where you stand
  const si = Math.round((a[0] - x0) / cell), sj = Math.round((a[1] - z0) / cell)
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const i = si + di, j = sj + dj
    if (i < 0 || j < 0 || i >= nx || j >= nz) continue
    const d = Math.hypot(cx(i) - a[0], cz(j) - a[1])
    if (!clear(w, a[0], a[1], cx(i), cz(j))) continue
    const k = j * nx + i; if (d < g[k]) { g[k] = d; heap.push(d + h(i, j), k) }
  }
  let spent = 0, end = -1, best = -1, bestH = Infinity
  const every = Math.max(1, Math.round((YIELD_EVERY * 2) / cell))
  while (heap.size && spent < budget) {
    const k = heap.pop()
    if (shut[k]) continue
    shut[k] = 1; spent++
    if (spent % every === 0) yield
    const i = k % nx, j = (k - i) / nx, hk = h(i, j)
    if (hk < bestH) { bestH = hk; best = k }
    if (Math.abs(i - gi) <= 1 && Math.abs(j - gj) <= 1 && clear(w, cx(i), cz(j), b[0], b[1])) { end = k; break }
    for (const [di, dj] of NB) {
      const ni = i + di, nj = j + dj
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue
      const nk = nj * nx + ni
      if (shut[nk]) continue
      const step = di && dj ? cell * Math.SQRT2 : cell, ng = g[k] + step
      if (ng >= g[nk]) continue
      if (!clear(w, cx(i), cz(j), cx(ni), cz(nj))) continue
      g[nk] = ng; prev[nk] = k; heap.push(ng + h(ni, nj), nk)
    }
  }
  const reached = end >= 0, last = reached ? end : best
  if (last < 0) return { pts: [a], reached: false, spent, length: 0, left: Infinity }
  const chain: XZ[] = []
  for (let k = last; k >= 0; k = prev[k]) { const i = k % nx; chain.unshift([cx(i), cz((k - i) / nx)]) }
  const raw: XZ[] = [a, ...chain]; if (reached) raw.push(b)
  const pts: XZ[] = yield* smoothSteps(w, raw), e = pts[pts.length - 1]
  return { pts, reached, spent, length: polyLength(pts), left: Math.hypot(e[0] - b[0], e[1] - b[1]) }
}

/** Take the farthest clear shortcut from each kept point (looks at most 24 ahead, so it stays bounded). */
function* smoothSteps(w: RouteWorld, p: XZ[]): Generator<void, XZ[]> {
  if (p.length <= 2) return p
  const out: XZ[] = [p[0]]
  let i = 0
  while (i < p.length - 1) {
    let j = Math.min(p.length - 1, i + 24)
    while (j > i + 1 && !clear(w, p[i][0], p[i][1], p[j][0], p[j][1])) { j--; yield }
    out.push(p[j]); i = j
  }
  return out
}

/** The steepest 1 m rise along a polyline (for probes/checks: what `clear` holds every off-road leg to). */
export function maxRiseAlong(ground: (x: number, z: number) => number, pts: readonly XZ[]): number {
  let worst = 0
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1], [bx, bz] = pts[k], d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / SAMPLE))
    let ph = ground(ax, az)
    for (let i = 1; i <= n; i++) { const h = ground(ax + (bx - ax) * i / n, az + (bz - az) * i / n); worst = Math.max(worst, Math.abs(h - ph) / Math.max(d / n, 1e-6)); ph = h }
  }
  return worst
}

export function polyLength(p: readonly XZ[]): number { let L = 0; for (let k = 1; k < p.length; k++) L += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); return L }

// ── roads ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface RoadGraph {
  nodes: { id: string; x: number; z: number }[]
  /** box = [x0, z0, x1, z1]: lets nearestOnRoads skip an edge without walking its points */
  edges: { a: number; b: number; pts: XZ[]; len: number; cum: number[]; box: [number, number, number, number] }[]
  /** node -> the edges that touch it (built once, not per search) */
  adj: number[][]
}
/** Build once from region.meta.network (or any {edges:{a,b,pts}, junctions:{id,x,z}}). Ferry edges are dropped: you
 *  cannot walk a ferry crossing. Edge pts are [x, z, y?] (the Atlas's order). */
export function roadGraph(net: { edges: { id?: string; a: string; b: string; pts: readonly (readonly number[])[] }[]; junctions: { id: string; x: number; z: number }[]; ferries?: { edge: string }[] } | null | undefined): RoadGraph | null {
  if (!net || !net.edges.length) return null
  const ferry = new Set((net.ferries ?? []).map(f => f.edge))
  const idx = new Map<string, number>(), nodes: RoadGraph['nodes'] = []
  for (const j of net.junctions) { idx.set(j.id, nodes.length); nodes.push({ id: j.id, x: j.x, z: j.z }) }
  const edges: RoadGraph['edges'] = []
  for (const e of net.edges) {
    if (e.id && ferry.has(e.id)) continue
    const a = idx.get(e.a), b = idx.get(e.b)
    if (a === undefined || b === undefined || e.pts.length < 2) continue
    const pts = e.pts.map(p => [p[0], p[1]] as XZ), cum = [0]
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
    const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, z] of pts) { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], z); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], z) }
    edges.push({ a, b, pts, len: cum[cum.length - 1], cum, box })
  }
  const adj: number[][] = nodes.map(() => [])
  edges.forEach((e, i) => { adj[e.a].push(i); if (e.b !== e.a) adj[e.b].push(i) })
  return edges.length ? { nodes, edges, adj } : null
}

interface RoadHit { e: number; s: number; x: number; z: number; d: number }
/** The nearest point on each edge, the `n` closest edges first. */
export function nearestOnRoads(G: RoadGraph, x: number, z: number, n = ROAD_TRIES): RoadHit[] {
  const hits: RoadHit[] = []
  // nearest boxes first; once n hits are in, an edge whose box is farther than the n-th hit cannot place
  const boxD = (b: RoadGraph['edges'][number]['box']) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - z, 0, z - b[3]))
  const order = G.edges.map((e, ei) => ({ ei, bd: boxD(e.box) })).sort((p, q) => p.bd - q.bd)
  for (const { ei, bd } of order) {
    if (hits.length >= n && bd > hits[n - 1].d) break
    const e = G.edges[ei]
    let best: RoadHit | null = null
    for (let k = 1; k < e.pts.length; k++) {
      const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz
      const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0
      const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz)
      if (!best || d < best.d) best = { e: ei, s: e.cum[k - 1] + t * (e.cum[k] - e.cum[k - 1]), x: px, z: pz, d }
    }
    if (best) { hits.push(best); hits.sort((p, q) => p.d - q.d) }
  }
  return hits.slice(0, n)
}

/** Points of edge e between arc lengths s0 and s1 (either direction), ends included. */
function slice(e: RoadGraph['edges'][number], s0: number, s1: number): XZ[] {
  const at = (s: number): XZ => {
    let k = 1; while (k < e.cum.length - 1 && e.cum[k] < s) k++
    const t = (s - e.cum[k - 1]) / Math.max(1e-9, e.cum[k] - e.cum[k - 1])
    return [e.pts[k - 1][0] + (e.pts[k][0] - e.pts[k - 1][0]) * t, e.pts[k - 1][1] + (e.pts[k][1] - e.pts[k - 1][1]) * t]
  }
  const lo = Math.min(s0, s1), hi = Math.max(s0, s1), out: XZ[] = [at(lo)]
  for (let k = 0; k < e.pts.length; k++) if (e.cum[k] > lo && e.cum[k] < hi) out.push(e.pts[k])
  out.push(at(hi))
  return s0 <= s1 ? out : out.reverse()
}

/** Along the roads from hit A to hit B: Dijkstra over junctions with A and B as virtual nodes. Metres + points. */
export function roadPath(G: RoadGraph, A: RoadHit, B: RoadHit): { pts: XZ[]; len: number } | null {
  if (A.e === B.e) return { pts: slice(G.edges[A.e], A.s, B.s), len: Math.abs(A.s - B.s) }
  const N = G.nodes.length, dist = new Float64Array(N).fill(Infinity), via = new Int32Array(N).fill(-1), done = new Uint8Array(N)
  const eA = G.edges[A.e], eB = G.edges[B.e]
  const heap = new Heap()
  dist[eA.a] = A.s; heap.push(A.s, eA.a)
  if (eA.len - A.s < dist[eA.b]) { dist[eA.b] = eA.len - A.s; heap.push(dist[eA.b], eA.b) }
  const adj = G.adj
  while (heap.size) {
    const u = heap.pop(); if (done[u]) continue; done[u] = 1
    for (const ei of adj[u]) {
      const e = G.edges[ei], v = e.a === u ? e.b : e.a, nd = dist[u] + e.len
      if (nd < dist[v]) { dist[v] = nd; via[v] = ei; heap.push(nd, v) }
    }
  }
  const viaA = dist[eB.a] + B.s, viaB = dist[eB.b] + (eB.len - B.s)
  if (!Number.isFinite(Math.min(viaA, viaB))) return null
  const endNode = viaA <= viaB ? eB.a : eB.b
  // walk back from endNode to whichever end of eA seeded it
  const chain: number[] = []
  let v = endNode
  while (via[v] >= 0) { const e = G.edges[via[v]]; chain.unshift(via[v]); v = e.a === v ? e.b : e.a }
  const pts: XZ[] = []
  const push = (q: XZ[]) => { for (const p of q) if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 1e-6) pts.push(p) }
  push(slice(eA, A.s, v === eA.a ? 0 : eA.len))
  let at = v
  for (const ei of chain) { const e = G.edges[ei]; const fwd = e.a === at; push(fwd ? e.pts : [...e.pts].reverse()); at = fwd ? e.b : e.a }
  push(slice(eB, endNode === eB.a ? 0 : eB.len, B.s))
  return { pts, len: Math.min(viaA, viaB) }
}

// ── the planner ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function planRoute(w: RouteWorld, start: XZ, goal: XZ, budget = DEFAULT_BUDGET): Route { return drain(planSteps(w, start, goal, budget)) }

/** planRoute, resumable: step it with `.next()` under a deadline (GuideRoute does) and the frame never waits on it. */
export function* planSteps(w: RouteWorld, start: XZ, goal: XZ, budget = DEFAULT_BUDGET): Generator<void, Route> {
  let spent = 0
  const direct: Leg = yield* terrainSteps(w, start, goal, Math.max(1, Math.floor(budget / 2)))
  spent += direct.spent
  let best: Route | null = direct.reached ? { pts: direct.pts, length: direct.length, mode: 'terrain', reached: true, spent } : null
  let bestCost = best ? best.length : Infinity
  const G = w.roads
  if (G) {
    const from = nearestOnRoads(G, start[0], start[1]); yield
    const to = nearestOnRoads(G, goal[0], goal[1]); yield
    const legs = new Map<string, Leg>()
    const leg = function* (p: XZ, q: XZ): Generator<void, Leg> {
      const key = `${p[0]},${p[1]}>${q[0]},${q[1]}`
      let r = legs.get(key)
      if (!r) { r = Math.hypot(p[0] - q[0], p[1] - q[1]) <= ON_ROAD ? { pts: [p, q], reached: true, spent: 0, length: Math.hypot(p[0] - q[0], p[1] - q[1]) } : yield* terrainSteps(w, p, q, Math.max(1, Math.floor((budget - spent) / 4))); spent += r.spent; legs.set(key, r) }
      return r
    }
    // cheapest first by a lower bound, so the budget goes to the likely winners
    const pairs: { A: RoadHit; B: RoadHit; rp: { pts: XZ[]; len: number } | null; lb: number }[] = []
    for (const A of from) for (const B of to) { const rp = roadPath(G, A, B); if (rp) pairs.push({ A, B, rp, lb: A.d + B.d + rp.len * ROAD_COST }); yield }
    pairs.sort((p, q) => p.lb - q.lb)
    for (const { A, B, rp, lb } of pairs) {
      if (lb >= bestCost || spent >= budget) break
      const inLeg: Leg = yield* leg(start, [A.x, A.z]); if (!inLeg.reached) continue
      const outLeg: Leg = yield* leg([B.x, B.z], goal); if (!outLeg.reached) continue
      const cost = inLeg.length + rp!.len * ROAD_COST + outLeg.length
      if (cost < bestCost) {
        const pts = joinPts(inLeg.pts, rp!.pts, outLeg.pts)
        bestCost = cost; best = { pts, length: polyLength(pts), mode: 'road', reached: true, spent }
      }
    }
  }
  if (best) return { ...best, spent }
  if (direct.pts.length > 1) return { pts: direct.pts, length: direct.length, mode: 'terrain', reached: false, spent }
  return { pts: [start, goal], length: Math.hypot(goal[0] - start[0], goal[1] - start[1]), mode: 'straight', reached: false, spent }
}

function joinPts(...parts: XZ[][]): XZ[] {
  const out: XZ[] = []
  for (const q of parts) for (const p of q) if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 1e-6) out.push(p)
  return out
}

// ── reading a route from where you stand ─────────────────────────────────────────────────────────────────────────────
/** Distance from (x, z) to the route, and the arc length of the nearest point on it. */
export function project(pts: readonly XZ[], x: number, z: number): { d: number; s: number } {
  let bd = Infinity, bs = 0, acc = 0
  if (pts.length === 1) return { d: Math.hypot(x - pts[0][0], z - pts[0][1]), s: 0 }
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1], [bx, bz] = pts[k], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz)
    const t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (L * L))) : 0
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t))
    if (d < bd) { bd = d; bs = acc + t * L }
    acc += L
  }
  return { d: bd, s: bs }
}

/** Points every `step` metres along the route, from your nearest point on it, for `reach` metres: what the trail draws.
 *  `offset` = where the first point sits past your point (default one step; the trail's flow phase slides it). */
export function trailAhead(pts: readonly XZ[], x: number, z: number, reach: number, step: number, offset = step): XZ[] {
  if (pts.length < 2) return []
  const { s } = project(pts, x, z), out: XZ[] = []
  let acc = 0, k = 1, want = s + offset
  const stop = s + reach
  while (k < pts.length && want <= stop) {
    const L = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])
    if (acc + L >= want) { const t = (want - acc) / Math.max(L, 1e-9); out.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t]); want += step }
    else { acc += L; k++ }
  }
  return out
}

// ── the cache the frame loop holds ───────────────────────────────────────────────────────────────────────────────────
/** Off the line by more than this = replan. */
export const STRAY_M = 10
/** The frame loop's budget: a replan (a stray, a new goal) is one ~30-150 ms hitch at most, never a repeating one. */
export const LIVE_BUDGET = 12000
/** Never replan more often than this (s), however you move. */
export const MIN_GAP_S = 0.5

/** Per-frame slice (ms): the planner works at most this long in one `get`, then hands back the route it already had. */
export const SLICE_MS = 2.5   // + at most one batch of overshoot: ≤ ~3-4 ms a frame (hub 11-21)

export class GuideRoute {
  /** The route to draw: the last one that LANDED. Null until the first plan lands (draw the straight dots meanwhile). */
  route: Route | null = null
  /** A plan in flight, resumed a slice per frame. */
  private job: { gen: Generator<void, Route>; goal: XZ } | null = null
  private goal: XZ | null = null
  private at = -Infinity
  plans = 0
  /** slices spent on the plan in flight / the last landed one (for probes and tests) */
  slices = 0
  constructor(private world: () => RouteWorld, private budget = LIVE_BUDGET, private sliceMs = SLICE_MS, private clock: () => number = () => performance.now()) {}
  /** Call once a frame. Starts a plan on a new goal or a stray (never on a timer: an unreachable goal spent its whole
   *  budget failing, and walking STRAY_M off is what changes the question), works on it for at most `sliceMs`, and
   *  returns what to draw: the route that last landed, or null before the first one (straight dots). A NEW GOAL drops
   *  the old route at once (it leads somewhere else); a stray keeps showing it until the replan lands. */
  get(x: number, z: number, goal: XZ, now: number): Route | null {
    const moved = !this.goal || Math.hypot(goal[0] - this.goal[0], goal[1] - this.goal[1]) > 0.5
    if (moved) { this.goal = [goal[0], goal[1]]; this.route = null; this.start(x, z, now) }
    else if (!this.job && this.route && now - this.at >= MIN_GAP_S && project(this.route.pts, x, z).d > STRAY_M) this.start(x, z, now)
    if (this.job) {
      const t0 = this.clock()
      this.slices++
      for (;;) {
        const r = this.job.gen.next()
        if (r.done) { this.route = r.value; this.job = null; this.plans++; break }
        if (this.clock() - t0 >= this.sliceMs) break
      }
    }
    return this.route
  }
  /** True while a plan is in flight. */
  get busy() { return !!this.job }
  private start(x: number, z: number, now: number) {
    this.job = { gen: planSteps(this.world(), [x, z], this.goal!, this.budget), goal: this.goal! }
    this.at = now; this.slices = 0
  }
  reset() { this.route = null; this.goal = null; this.job = null }
}
