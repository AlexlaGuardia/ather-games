// bake-wilds-network.mts — THE WILDS' PATH NETWORK for a season (Alex 11-16: "some kind of path network for the player
// to have some kind of direction with settlements placed throughout the map and event locations").
//
//   npx tsx scripts/bake-wilds-network.mts [--season 1] [--dry]
//
// Reads every streamed Wilds tile (public/open/wilds/*.bin|.biome|.json), and writes public/open/wilds/network-s<N>.json:
//   settlements — generated free-Moglin settlements (canon: ather-rework §3, fresh each season), on dry, flat meadow,
//                 well apart, clear of infected nodes and of Greg's stone
//   paths       — routed on the real ground (A* on a 20 m grid: no open water, steep costs, woods cost more than
//                 meadow), joining Greg's stone and every settlement: a spanning tree plus a few loops
//   fair        — where THE THISTLEDOWN FAIR pitches its big top this season (RULED 11-17, athernyx 505c6d0: a new spot
//                 on the path network each season): a flat meadow beside a path, a walk from Greg's stone
//
// Baked, not run in the page: routing needs every tile, and the game streams only the four round the keeper. Same
// season, same files, same network byte for byte. Placement, spacing and names are BUILD (Jin's, per the ruling).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../public/open/wilds')
const argv = process.argv.slice(2)
const SEASON = Number(argv[argv.indexOf('--season') + 1]) || 1
const DRY = argv.includes('--dry')
const W = { water: 0, shore: 1, meadow: 2, woods: 3, rock: 4 }
const G = 20                     // routing grid, metres
const SPACING = 1400             // settlements at least this far apart
const GREG = { x: -300, z: 300 } // Greg's stone (waymarks.ts GREG_WAYMARK, first-wilds = world origin)

interface Tile { name: string; tx: number; ty: number; nx: number; nz: number; cell: number; waterY: number; h: Float32Array; b: Uint8Array; nodes: { x: number; z: number }[] }
const index = JSON.parse(readFileSync(join(DIR, 'tiles.json'), 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { x: number; z: number }[] }[] }
const tiles = new Map<string, Tile>()
for (const t of index.tiles) {
  const meta = JSON.parse(readFileSync(join(DIR, `${t.name}.json`), 'utf8'))
  const dm = new Int16Array(new Uint8Array(readFileSync(join(DIR, `${t.name}.bin`))).buffer)   // a copy: a Buffer's .buffer is a shared pool
  const h = new Float32Array(dm.length); for (let k = 0; k < dm.length; k++) h[k] = dm[k] / 10
  const b = new Uint8Array(readFileSync(join(DIR, `${t.name}.biome`)))
  tiles.set(`${t.tx},${t.ty}`, { name: t.name, tx: t.tx, ty: t.ty, nx: meta.nx, nz: meta.nz, cell: meta.cell, waterY: meta.waterY, h, b, nodes: t.nodes.map(n => ({ x: n.x + t.tx * 1000, z: n.z + t.ty * 1000 })) })
}
void readdirSync
const tileAt = (x: number, z: number) => tiles.get(`${Math.floor((x + 500) / 1000)},${Math.floor((z + 500) / 1000)}`)
function sample(x: number, z: number): { h: number; b: number } | null {
  const t = tileAt(x, z); if (!t) return null
  const lx = x - t.tx * 1000 + 500, lz = z - t.ty * 1000 + 500
  const i = Math.min(t.nx - 2, Math.max(0, Math.floor(lx / t.cell))), j = Math.min(t.nz - 2, Math.max(0, Math.floor(lz / t.cell)))
  return { h: t.h[j * t.nx + i], b: t.b[j * (t.nx - 1) + i] }
}

// ── the routing grid ──────────────────────────────────────────────────────────────────────────────────────────────
const txs = index.tiles.map(t => t.tx), tys = index.tiles.map(t => t.ty)
const X0 = Math.min(...txs) * 1000 - 500, Z0 = Math.min(...tys) * 1000 - 500
const GW = ((Math.max(...txs) - Math.min(...txs) + 1) * 1000) / G, GH = ((Math.max(...tys) - Math.min(...tys) + 1) * 1000) / G
const H = new Float32Array(GW * GH), B = new Uint8Array(GW * GH).fill(255)
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const s = sample(X0 + (i + 0.5) * G, Z0 + (j + 0.5) * G); if (!s) continue
  H[j * GW + i] = s.h; B[j * GW + i] = s.b
}
const gx = (x: number) => Math.floor((x - X0) / G), gz = (z: number) => Math.floor((z - Z0) / G)
const wx = (i: number) => X0 + (i + 0.5) * G, wz = (j: number) => Z0 + (j + 0.5) * G
const inG = (i: number, j: number) => i >= 0 && j >= 0 && i < GW && j < GH
const dry = (i: number, j: number) => inG(i, j) && B[j * GW + i] !== 255 && B[j * GW + i] !== W.water
function slopeAt(i: number, j: number): number {
  let m = 0; const h = H[j * GW + i]
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (dry(i + di, j + dj)) m = Math.max(m, Math.abs(H[(j + dj) * GW + i + di] - h) / G)
  return m
}

// ── settlements: dry, flat meadow, spaced, clear of infected nodes and Greg ───────────────────────────────────────
let seed = (SEASON * 2654435761) >>> 0
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const nodes = [...tiles.values()].flatMap(t => t.nodes)
function goodSite(i: number, j: number, r: number, biomeOk: (b: number) => boolean): boolean {
  const k = Math.ceil(r / G)
  for (let dj = -k; dj <= k; dj++) for (let di = -k; di <= k; di++) {
    if (di * di + dj * dj > k * k) continue
    const a = i + di, c = j + dj
    if (!dry(a, c) || !biomeOk(B[c * GW + a]) || slopeAt(a, c) > 0.12) return false
  }
  return true
}
const cands: { i: number; j: number }[] = []
for (let j = 2; j < GH - 2; j += 2) for (let i = 2; i < GW - 2; i += 2) if (dry(i, j) && B[j * GW + i] === W.meadow) cands.push({ i, j })
for (let k = cands.length - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); [cands[k], cands[r]] = [cands[r], cands[k]] }
const sites: { x: number; z: number }[] = []
{
  const sl = cands.map(c => slopeAt(c.i, c.j)).sort((a, b) => a - b)
  const q = (f: number) => sl[Math.floor(f * (sl.length - 1))].toFixed(3)
  console.log(`grid ${GW}x${GH}, meadow candidates ${cands.length}, slope p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)}, sites passing r40 ${cands.filter(c => goodSite(c.i, c.j, 40, b => b === W.meadow || b === W.woods)).length}`)
}
for (const c of cands) {
  const x = wx(c.i), z = wz(c.j)
  if (Math.hypot(x - GREG.x, z - GREG.z) < 900) continue
  if (sites.some(s => Math.hypot(s.x - x, s.z - z) < SPACING)) continue
  if (nodes.some(n => Math.hypot(n.x - x, n.z - z) < 120)) continue
  if (!goodSite(c.i, c.j, 40, b => b === W.meadow || b === W.woods)) continue
  sites.push({ x, z })
}

// names: generated (two hedgerow words), never a canon name (the Moonwell folk, the holds, the kept places)
const CANON = new Set(['hazel', 'saxifrage', 'yarrow', 'fennel', 'mallow', 'burdock', 'vetch', 'sorrel', 'hemlock', 'nettle', 'marl', 'teasel', 'sedge', 'tuckbank', 'thistledown', 'downbarrow', 'snagbarrows', 'moonwell', 'gloview', 'warren'])
const HEADS = ['Bramble', 'Furze', 'Cress', 'Clover', 'Burnet', 'Sloe', 'Woad', 'Madder', 'Tansy', 'Rush', 'Fern', 'Moss', 'Bryony', 'Campion', 'Plantain', 'Dock', 'Sweetbriar', 'Hawthorn', 'Elder', 'Betony', 'Comfrey', 'Lovage', 'Rue', 'Agrimony']
const TAILS = ['dell', 'holt', 'bank', 'hollow', 'burrow', 'mead', 'combe', 'knoll', 'delve', 'brake', 'hythe', 'warth']
const used = new Set<string>()
const nameFor = () => {
  for (;;) {
    const n = HEADS[Math.floor(rnd() * HEADS.length)] + TAILS[Math.floor(rnd() * TAILS.length)]
    if (!used.has(n) && ![...CANON].some(c => n.toLowerCase().includes(c))) { used.add(n); return n }
  }
}
const settlements = sites.map((s, k) => ({ id: `s${SEASON}-${k}`, name: nameFor(), x: Math.round(s.x), z: Math.round(s.z) }))

// ── the graph: Greg's stone + every settlement; a spanning tree on distance, then each node's next-nearest for loops ─
const P = [{ id: 'greg', x: GREG.x, z: GREG.z }, ...settlements]
const edges: [number, number][] = []
{
  const inT = new Set([0])
  while (inT.size < P.length) {
    let best: [number, number, number] | null = null
    for (const a of inT) for (let b = 0; b < P.length; b++) if (!inT.has(b)) {
      const d = Math.hypot(P[a].x - P[b].x, P[a].z - P[b].z); if (!best || d < best[2]) best = [a, b, d]
    }
    edges.push([best![0], best![1]]); inT.add(best![1])
  }
  const has = (a: number, b: number) => edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))
  for (let a = 0; a < P.length; a++) {
    const near = P.map((p, b) => ({ b, d: Math.hypot(p.x - P[a].x, p.z - P[a].z) })).filter(o => o.b !== a).sort((u, v) => u.d - v.d)
    const o = near.find(o => !has(a, o.b))
    if (o && o.d < 2600 && rnd() < 0.5) edges.push([a, o.b])
  }
}

// ── route each edge on the ground ─────────────────────────────────────────────────────────────────────────────────
function cost(i: number, j: number): number {
  const b = B[j * GW + i], s = slopeAt(i, j)
  if (s > 0.45) return Infinity
  return (b === W.woods ? 1.7 : b === W.rock ? 3 : b === W.shore ? 1.4 : 1) * (1 + 40 * s * s)
}
function route(a: { x: number; z: number }, b: { x: number; z: number }): [number, number][] | null {
  const si = gx(a.x), sj = gz(a.z), ti = gx(b.x), tj = gz(b.z)
  const N = GW * GH, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N)
  const heap: [number, number][] = []   // [f, idx]
  const push = (f: number, k: number) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p } }
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m } } return top }
  const hz = (i: number, j: number) => Math.hypot(i - ti, j - tj)
  const s0 = sj * GW + si; g[s0] = 0; push(hz(si, sj), s0)
  while (heap.length) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1
    const i = k % GW, j = (k / GW) | 0
    if (i === ti && j === tj) break
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue
      const a2 = i + di, c2 = j + dj; if (!dry(a2, c2)) continue
      const n = c2 * GW + a2; if (closed[n]) continue
      const w = cost(a2, c2); if (!Number.isFinite(w)) continue
      const ng = g[k] + w * (di && dj ? Math.SQRT2 : 1)
      if (ng < g[n]) { g[n] = ng; from[n] = k; push(ng + hz(a2, c2), n) }
    }
  }
  const t0 = tj * GW + ti; if (from[t0] < 0) return null
  const pts: [number, number][] = []
  for (let k = t0; k >= 0; k = from[k]) pts.push([wx(k % GW), wz((k / GW) | 0)])
  pts.reverse(); pts[0] = [a.x, a.z]; pts[pts.length - 1] = [b.x, b.z]
  // smooth: a few passes of neighbour averaging, ends pinned; then thin to every ~20 m
  for (let pass = 0; pass < 4; pass++) for (let k = 1; k < pts.length - 1; k++) pts[k] = [(pts[k - 1][0] + pts[k][0] * 2 + pts[k + 1][0]) / 4, (pts[k - 1][1] + pts[k][1] * 2 + pts[k + 1][1]) / 4]
  return pts.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10])
}
const paths: { a: string; b: string; pts: [number, number][] }[] = []
let unrouted = 0
for (const [a, b] of edges) { const pts = route(P[a], P[b]); if (pts) paths.push({ a: P[a].id, b: P[b].id, pts }); else unrouted++ }
// a settlement no path reaches is dropped: the network is what gives it direction
const reached = new Set(paths.flatMap(p => [p.a, p.b]))
const kept = settlements.filter(s => reached.has(s.id))

// ── the fair: a flat meadow beside a path, 1.2 to 3 km from Greg's stone ──────────────────────────────────────────
let fair: { x: number; z: number; yaw: number; path: string } | null = null
{
  const spots: { x: number; z: number; yaw: number; path: string }[] = []
  for (const p of paths) for (let k = 3; k < p.pts.length - 3; k += 4) {
    const [x, z] = p.pts[k], d = Math.hypot(x - GREG.x, z - GREG.z)
    if (d < 1200 || d > 3000) continue
    const [x1, z1] = p.pts[k + 1], tx = x1 - x, tz = z1 - z, l = Math.hypot(tx, tz) || 1
    for (const side of [1, -1]) {   // set back off the path, door facing it
      const cx = x + (-tz / l) * 38 * side, cz = z + (tx / l) * 38 * side
      if (goodSite(gx(cx), gz(cz), 28, b => b === W.meadow)) spots.push({ x: Math.round(cx), z: Math.round(cz), yaw: Math.atan2(x - cx, z - cz), path: `${p.a}-${p.b}` })
    }
  }
  if (spots.length) fair = spots[Math.floor(rnd() * spots.length)]
}

const out = { v: 1, season: SEASON, baked: 'scripts/bake-wilds-network.mts', settlements: kept, paths, fair }
const km = paths.reduce((s, p) => s + p.pts.slice(1).reduce((a, q, k) => a + Math.hypot(q[0] - p.pts[k][0], q[1] - p.pts[k][1]), 0), 0) / 1000
console.log(`season ${SEASON}: ${kept.length} settlements (${settlements.length - kept.length} unreachable dropped), ${paths.length} paths (${unrouted} unroutable), ${km.toFixed(1)} km of path, fair ${fair ? `at (${fair.x}, ${fair.z})` : 'NOT PLACED'}`)
for (const s of kept) console.log(`  ${s.name.padEnd(16)} (${s.x}, ${s.z})  ${Math.round(Math.hypot(s.x - GREG.x, s.z - GREG.z))} m from Greg`)
if (!DRY) { writeFileSync(join(DIR, `network-s${SEASON}.json`), JSON.stringify(out)); console.log(`wrote public/open/wilds/network-s${SEASON}.json`) }
