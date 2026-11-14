// A REGION of the continent, as exported by tools/worldmap/export_region.py: a 5 m height grid (int16 decimetres)
// with the Atlas roads already cut in, plus the roads' centre lines and the places, in metres. x east, z south,
// origin at the region's centre.
//
// ★ As with land.ts: what you see is what you drive on. `heightAt` interpolates the SAME two triangles per cell the
// mesh draws, split on the (i,j)→(i+1,j+1) diagonal.

export type RoadKind = 'paved' | 'road' | 'trail' | 'pass'
/** Anything drivable with a centre line: an Atlas route or a network edge. */
export interface RoadLike { id: string; kind: RoadKind; width: number; pts: [number, number, number][] }
/** An Atlas ROUTE, place to place. Routes overlap on shared trunks; drive the network, not these. */
export interface RegionRoad extends RoadLike { from: string; to: string }
/** A NETWORK edge (tools/worldmap/road_network.py): junction to junction, no overlaps. */
export interface RegionEdge extends RoadLike { a: string; b: string }
export type JunctionKind = 'square' | 'roundabout' | 'cross' | 'stop4' | 'tee' | 'merge' | 'end' | 'bend' | 'in-square'
/** A deck carrying an edge over water: centre line with the DECK height (not the ground's). */
export interface RegionBridge { id: string; edge: string; kind: RoadKind; width: number; pts: [number, number, number][] }
export interface RegionJunction {
  id: string; kind: JunctionKind; x: number; z: number; y: number
  r: number                 // pad radius (0 = no pad of its own)
  island?: number           // roundabout: the planted centre's radius
  place?: string            // square: the town it belongs to
  override?: boolean        // kind pinned by hand (tools/worldmap/junctions.json)
  arms: { edge: string; kind: RoadKind; ang: number }[]
}
export interface RegionPlace { id: string; name: string | null; kind: string; x: number; z: number; y: number }
export interface RegionMeta {
  name: string; cell: number; nx: number; nz: number; sizeX: number; sizeZ: number; scale: number
  roads: RegionRoad[]; places: RegionPlace[]
  network?: { edges: RegionEdge[]; junctions: RegionJunction[]; bridges?: RegionBridge[] }
}
export interface Region {
  meta: RegionMeta
  h: Float32Array                     // metres, row-major (z rows of nx)
  heightAt: (x: number, z: number) => number          // the TERRAIN (what the mesh draws)
  /** What a car drives on: the terrain, or a bridge deck where one is at/below the hint `y` (+ a step). */
  groundAt: (x: number, z: number, y?: number) => number
  /** The deck under x, z (any height), for placement, labels and tests. */
  deckAt: (x: number, z: number) => { y: number; bridge: RegionBridge } | null
  vertex: (i: number, j: number) => number
}

export function makeRegion(meta: RegionMeta, raw: Int16Array): Region {
  const { nx, nz, cell, sizeX, sizeZ, scale } = meta
  if (raw.length !== nx * nz) throw new Error(`region ${meta.name}: ${raw.length} samples, expected ${nx * nz}`)
  const h = new Float32Array(raw.length)
  for (let k = 0; k < raw.length; k++) h[k] = raw[k] * scale
  const hx = sizeX / 2, hz = sizeZ / 2
  const vertex = (i: number, j: number) => h[j * nx + i]
  const heightAt = (x: number, z: number) => {
    const gx = (x + hx) / cell, gz = (z + hz) / cell
    if (gx < 0 || gz < 0 || gx > nx - 1 || gz > nz - 1) return -Infinity
    const i = Math.min(nx - 2, Math.floor(gx)), j = Math.min(nz - 2, Math.floor(gz))
    const fx = gx - i, fz = gz - j
    const h00 = h[j * nx + i], h10 = h[j * nx + i + 1], h01 = h[(j + 1) * nx + i], h11 = h[(j + 1) * nx + i + 1]
    return fx >= fz
      ? h00 + (h10 - h00) * fx + (h11 - h10) * fz
      : h00 + (h11 - h01) * fx + (h01 - h00) * fz
  }
  // decks: for each bridge segment, a footprint test (within half the width of the centre line, inside the segment)
  const bridges = meta.network?.bridges ?? []
  const boxes = bridges.map(b => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const p of b.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]) }
    const m = b.width / 2 + 1
    return [x0 - m, x1 + m, z0 - m, z1 + m]
  })
  const deckAt = (x: number, z: number) => {
    let best: { y: number; bridge: RegionBridge } | null = null
    for (let bi = 0; bi < bridges.length; bi++) {
      const bx = boxes[bi]
      if (x < bx[0] || x > bx[1] || z < bx[2] || z > bx[3]) continue
      const b = bridges[bi], p = b.pts, hw = b.width / 2 + 0.45     // to the parapet's outer face: the ribbon's edge never misses
      for (let k = 0; k < p.length - 1; k++) {
        const ax = p[k][0], az = p[k][1], abx = p[k + 1][0] - ax, abz = p[k + 1][1] - az, L = abx * abx + abz * abz || 1
        const t = ((x - ax) * abx + (z - az) * abz) / L
        // inside the segment; the ends overlap their neighbours by a hair so a seam has no gap
        if (t < -0.02 || t > 1.02 || (k === 0 && t < 0) || (k === p.length - 2 && t > 1)) continue
        const tc = Math.max(0, Math.min(1, t))
        if (Math.hypot(ax + abx * tc - x, az + abz * tc - z) > hw) continue
        const y = p[k][2] + (p[k + 1][2] - p[k][2]) * tc
        if (!best || y > best.y) best = { y, bridge: b }
      }
    }
    return best
  }
  const STEP = 1.5
  const groundAt = (x: number, z: number, y?: number) => {
    const g = heightAt(x, z)
    if (!bridges.length) return g
    const d = deckAt(x, z)
    if (!d || d.y < g) return g
    return y === undefined || d.y <= y + STEP ? d.y : g
  }
  return { meta, h, heightAt, groundAt, deckAt, vertex }
}

/** Browser: fetch the pair from /open/<name>.{json,bin}. */
export async function loadRegion(name: string): Promise<Region> {
  const [meta, bin] = await Promise.all([
    fetch(`/open/${name}.json`).then(r => r.json() as Promise<RegionMeta>),
    fetch(`/open/${name}.bin`).then(r => r.arrayBuffer()),
  ])
  return makeRegion(meta, new Int16Array(bin))
}

/** What you drive on: the network's edges when the export has one, else the raw routes (older exports). */
export const drivable = (region: Region): RoadLike[] => region.meta.network?.edges ?? region.meta.roads

/** The junction pad (r > 0) under x, z, if any. A roundabout's island is NOT on its pad. */
export function junctionAt(region: Region, x: number, z: number): RegionJunction | null {
  for (const j of region.meta.network?.junctions ?? []) {
    if (j.r <= 0) continue
    const d = Math.hypot(x - j.x, z - j.z)
    if (d <= j.r && !(j.island && d < j.island)) return j
  }
  return null
}

/** True when x, z is within `margin` of a junction pad's rim (or on it): keep trees and houses off the paving. */
export const nearPad = (region: Region, x: number, z: number, margin: number) =>
  (region.meta.network?.junctions ?? []).some(j => j.r > 0 && Math.hypot(x - j.x, z - j.z) < j.r + margin)

/** The nearest point on any road's centre line: distance (m) and the road. For "on road?" and callouts.
 *  On a junction pad d = 0 (the pad is road); on a roundabout's island you are off it. */
export function nearestRoad(region: Region, x: number, z: number): { d: number; road: RoadLike | null; junction: RegionJunction | null } {
  const roads = drivable(region)
  for (const j of region.meta.network?.junctions ?? []) {
    if (!j.island) continue
    const d = Math.hypot(x - j.x, z - j.z)
    if (d < j.island) return { d: j.island - d + 7, road: null, junction: j }
  }
  let best = Infinity, road: RoadLike | null = null
  for (const r of roads) {
    const p = r.pts
    for (let k = 0; k < p.length - 1; k++) {
      const ax = p[k][0], az = p[k][1], bx = p[k + 1][0], bz = p[k + 1][1]
      const abx = bx - ax, abz = bz - az, L = abx * abx + abz * abz || 1
      const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / L))
      const d = Math.hypot(ax + abx * t - x, az + abz * t - z)
      if (d < best) { best = d; road = r }
    }
  }
  const j = junctionAt(region, x, z)
  if (j) {
    const top = j.arms.map(a => roads.find(r => r.id === a.edge)).filter((r): r is RoadLike => !!r).sort((a, b) => b.width - a.width)[0]
    return { d: 0, road: top ?? road, junction: j }
  }
  return { d: best, road, junction: null }
}

/** Which way the ring runs. ⚠ Which side of the road Athernyx drives on is CANON (asked of Magii 11-14); until it is
 *  ruled, the ring runs as right-hand traffic does: counter-clockwise seen from above. In x-east / z-south that is
 *  DEcreasing atan2(z, x). */
export const RING_DIR = -1

/** A drivable line from one place to another along the network (Dijkstra by length), going AROUND roundabouts.
 *  Starts and ends at the junction nearest each place (a town's square). null if not connected. */
export function routeBetween(region: Region, fromPlace: string, toPlace: string): { pts: [number, number][]; length: number } | null {
  const net = region.meta.network
  if (!net) return null
  const J = new Map(net.junctions.map(j => [j.id, j]))
  const nearJ = (id: string) => {
    const p = region.meta.places.find(q => q.id === id); if (!p) return null
    const sq = net.junctions.find(j => j.place === id)
    if (sq) return sq.id
    let best: string | null = null, bd = Infinity
    for (const j of net.junctions) { const d = Math.hypot(j.x - p.x, j.z - p.z); if (d < bd && net.edges.some(e => e.a === j.id || e.b === j.id)) { bd = d; best = j.id } }
    return best
  }
  const a = nearJ(fromPlace), b = nearJ(toPlace)
  if (!a || !b) return null
  const len = (e: RegionEdge) => { let L = 0; for (let k = 1; k < e.pts.length; k++) L += Math.hypot(e.pts[k][0] - e.pts[k - 1][0], e.pts[k][1] - e.pts[k - 1][1]); return L }
  const dist = new Map<string, number>([[a, 0]]), prev = new Map<string, { e: RegionEdge; from: string }>()
  const open = new Set([a])
  while (open.size) {
    let u = '', du = Infinity
    for (const q of open) { const d = dist.get(q)!; if (d < du) { du = d; u = q } }
    open.delete(u)
    if (u === b) break
    for (const e of net.edges) {
      if (e.a !== u && e.b !== u) continue
      const v = e.a === u ? e.b : e.a, nd = du + len(e)
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, { e, from: u }); open.add(v) }
    }
  }
  if (!dist.has(b)) return null
  const chain: { e: RegionEdge; fwd: boolean }[] = []
  for (let v = b; v !== a;) { const p = prev.get(v)!; chain.unshift({ e: p.e, fwd: p.e.a === p.from }); v = p.from }
  // stitch, then replace each pass THROUGH a roundabout with an arc around its ring
  let pts: [number, number][] = []
  for (const { e, fwd } of chain) {
    const q = (fwd ? e.pts : [...e.pts].reverse()).map(p => [p[0], p[1]] as [number, number])
    pts = pts.length ? pts.concat(q.slice(1)) : q
  }
  for (const j of net.junctions) {
    if (!j.island) continue
    const rr = (j.island + j.r) / 2
    const inside = pts.map(p => Math.hypot(p[0] - j.x, p[1] - j.z) < j.r)
    const i0 = inside.indexOf(true), i1 = inside.lastIndexOf(true)
    if (i0 <= 0 || i1 >= pts.length - 1) continue
    const ang = (p: [number, number]) => Math.atan2(p[1] - j.z, p[0] - j.x)
    const a0 = ang(pts[i0 - 1]), a1 = ang(pts[i1 + 1])
    let sweep = a1 - a0
    if (RING_DIR < 0) { while (sweep >= 0) sweep -= 2 * Math.PI } else { while (sweep <= 0) sweep += 2 * Math.PI }
    const n = Math.max(4, Math.ceil(Math.abs(sweep) * rr / 2.5))
    const arc: [number, number][] = []
    for (let k = 0; k <= n; k++) { const t = a0 + sweep * k / n; arc.push([j.x + Math.cos(t) * rr, j.z + Math.sin(t) * rr]) }
    pts = [...pts.slice(0, i0), ...arc, ...pts.slice(i1 + 1)]
  }
  let L = 0
  for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])
  return { pts, length: L }
}

/** THE PARAPETS: a car on a deck that drifts past the rail line is put back on it and loses its outward speed
 *  (a glancing scrape, not a wall that stops you dead). Returns true if it touched. Mutates x/z/vx/vz. */
export function bridgeRail(region: Region, c: { x: number; y: number; z: number; vx: number; vz: number }): boolean {
  for (const b of region.meta.network?.bridges ?? []) {
    const p = b.pts, rail = b.width / 2 - 0.9
    let best = Infinity, bx = 0, bz = 0, by = 0, nx = 0, nz = 0, k0 = -1
    for (let k = 0; k < p.length - 1; k++) {
      const ax = p[k][0], az = p[k][1], abx = p[k + 1][0] - ax, abz = p[k + 1][1] - az, L = abx * abx + abz * abz || 1
      const t = Math.max(0, Math.min(1, ((c.x - ax) * abx + (c.z - az) * abz) / L))
      const qx = ax + abx * t, qz = az + abz * t, d = Math.hypot(c.x - qx, c.z - qz)
      if (d < best) { best = d; bx = qx; bz = qz; by = p[k][2] + (p[k + 1][2] - p[k][2]) * t; k0 = k }
    }
    // only mid-span, only when the car is up on the deck (not under it, not on the approach where the land is level)
    if (k0 < 2 || k0 > p.length - 4 || best > rail + 3 || best <= rail || Math.abs(c.y - by) > 1.2) continue
    if (region.heightAt(c.x, c.z) > by - 0.8) continue
    nx = (c.x - bx) / best; nz = (c.z - bz) / best
    c.x = bx + nx * rail; c.z = bz + nz * rail
    const out = c.vx * nx + c.vz * nz
    if (out > 0) { c.vx -= nx * out * 1.2; c.vz -= nz * out * 1.2; c.vx *= 0.97; c.vz *= 0.97 }
    return true
  }
  return false
}

// ── ROADSIDE: waystones and fingerposts (canon 11-14, world/transportation.md › The roads in Year 1672) ──
// A rune-cut WAYSTONE stands every kilometre (canon measures in km), carved with the distance to the next town each
// way. A carved FINGERPOST stands at every junction, one arm per road, naming the nearest town down it; its runes
// glow faintly after dark. Distances are ROAD distances through the network, not straight lines.

export interface Signpost { town: string; name: string; km: number; ang: number }
export interface Waystone { x: number; z: number; y: number; yaw: number; faces: Signpost[] }
export interface Fingerpost { x: number; z: number; y: number; junction: string; arms: Signpost[] }

const edgeLen = (e: RegionEdge) => { let L = 0; for (let k = 1; k < e.pts.length; k++) L += Math.hypot(e.pts[k][0] - e.pts[k - 1][0], e.pts[k][1] - e.pts[k - 1][1]); return L }

/** From junction `start`, leaving by edge `first`, the nearest town square by road. */
function nearestTownVia(region: Region, start: string, first: RegionEdge, offset: number): { town: string; m: number } | null {
  const net = region.meta.network!
  const J = new Map(net.junctions.map(j => [j.id, j]))
  const firstEnd = first.a === start ? first.b : first.a
  const dist = new Map<string, number>([[firstEnd, edgeLen(first) - offset]])
  const open = new Set([firstEnd]), done = new Set([start])
  while (open.size) {
    let u = '', du = Infinity
    for (const q of open) { const d = dist.get(q)!; if (d < du) { du = d; u = q } }
    open.delete(u); done.add(u)
    const ju = J.get(u)
    if (ju?.kind === 'square' && ju.place) return { town: ju.place, m: du }
    for (const e of net.edges) {
      if (e.a !== u && e.b !== u) continue
      const v = e.a === u ? e.b : e.a
      if (done.has(v)) continue
      const nd = du + edgeLen(e)
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); open.add(v) }
    }
  }
  return null
}
// an unnamed Atlas place reads as its kind ("a village"), never its id: names are Magii's to give, not ours to leak
const placeName = (region: Region, id: string) => {
  const p = region.meta.places.find(q => q.id === id)
  return p?.name ?? (p ? `the ${p.kind}` : id)
}
const km = (m: number) => Math.round(m / 100) / 10

export function roadside(region: Region): { waystones: Waystone[]; fingerposts: Fingerpost[] } {
  const net = region.meta.network
  const waystones: Waystone[] = [], fingerposts: Fingerpost[] = []
  if (!net) return { waystones, fingerposts }
  // a stone wherever the road distance to the NEAREST town crosses a whole kilometre: d(s) = min(da + s, db + L − s)
  const townDist = (start: string) => {
    const dist = new Map<string, number>([[start, 0]]), open = new Set([start]), done = new Set<string>()
    const J = new Map(net.junctions.map(j => [j.id, j]))
    while (open.size) {
      let u = '', du = Infinity
      for (const q of open) { const d = dist.get(q)!; if (d < du) { du = d; u = q } }
      open.delete(u); done.add(u)
      if (J.get(u)?.kind === 'square') return du
      for (const e of net.edges) {
        if (e.a !== u && e.b !== u) continue
        const v = e.a === u ? e.b : e.a
        if (done.has(v)) continue
        const nd = du + edgeLen(e)
        if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); open.add(v) }
      }
    }
    return Infinity
  }
  for (const e of net.edges) {
    const L = edgeLen(e), da = townDist(e.a), db = townDist(e.b)
    if (!Number.isFinite(da) && !Number.isFinite(db)) continue
    const d = (s: number) => Math.min(da + s, db + L - s)
    let acc = 0
    for (let k = 1; k < e.pts.length; k++) {
      const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k], seg = Math.hypot(bx - ax, bz - az)
      if (seg < 1e-3) continue
      const d0 = d(acc), d1 = d(acc + seg)
      const km0 = Math.floor(d0 / 1000), km1 = Math.floor(d1 / 1000)
      if (km0 !== km1 && Math.max(km0, km1) >= 1) {
        const mark = Math.max(km0, km1) * 1000, t = (mark - d0) / (d1 - d0)
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t, sAt = acc + seg * t
        const ux = (bx - ax) / seg, uz = (bz - az) / seg
        const sx = x - uz * (e.width / 2 + 2.2), sz = z + ux * (e.width / 2 + 2.2)
        const y = region.groundAt(sx, sz)
        const crowded = waystones.some(w => Math.hypot(w.x - sx, w.z - sz) < 80) ||
          net.junctions.some(j => j.kind !== 'bend' && Math.hypot(j.x - sx, j.z - sz) < j.r + 18)
        if (Number.isFinite(y) && y > 0.6 && !region.deckAt(x, z) && !crowded) {
          const fwd = nearestTownVia(region, e.a, e, sAt), back = nearestTownVia(region, e.b, e, L - sAt)
          const faces: Signpost[] = []
          if (fwd) faces.push({ town: fwd.town, name: placeName(region, fwd.town), km: km(fwd.m), ang: Math.atan2(uz, ux) })
          if (back) faces.push({ town: back.town, name: placeName(region, back.town), km: km(back.m), ang: Math.atan2(-uz, -ux) })
          if (faces.length) waystones.push({ x: sx, z: sz, y, yaw: Math.atan2(ux, uz), faces })
        }
      }
      acc += seg
    }
  }
  for (const j of net.junctions) {
    if (!['tee', 'merge', 'cross', 'stop4', 'roundabout'].includes(j.kind)) continue
    const arms: Signpost[] = []
    for (const a of j.arms) {
      const e = net.edges.find(q => q.id === a.edge); if (!e) continue
      const t = nearestTownVia(region, j.id, e, 0)
      if (t) arms.push({ town: t.town, name: placeName(region, t.town), km: km(t.m), ang: a.ang })
    }
    if (!arms.length) continue
    // the post stands on the corner between the two widest-apart arms, just off the pad
    const angs = j.arms.map(a => a.ang).sort((p, q) => p - q)
    let gap = -1, mid = 0
    for (let k = 0; k < angs.length; k++) {
      const a0 = angs[k], a1 = k + 1 < angs.length ? angs[k + 1] : angs[0] + 2 * Math.PI
      if (a1 - a0 > gap) { gap = a1 - a0; mid = (a0 + a1) / 2 }
    }
    const r = (j.r || 8) + 2.5
    const x = j.x + Math.cos(mid) * r, z = j.z + Math.sin(mid) * r, y = region.groundAt(x, z)
    if (Number.isFinite(y)) fingerposts.push({ x, z, y, junction: j.id, arms })
  }
  return { waystones, fingerposts }
}

