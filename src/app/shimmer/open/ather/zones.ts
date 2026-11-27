// ── THE WILDS' ZONES (BETA M235 s1, Alex 11-27: "fewer, bigger zones") ─────────────────────────────────────────────────────
// A ZONE is four old sections fused (2 x 2 on the continent's subsection grid, nodes.ts SUB, across tile seams too): it has ONE
// champion, ONE state on the spread map, and is uncovered whole the moment the keeper steps into any part of it. So the Wilds
// hold about a quarter of the champions they did (M121's sections overran the keeper).
// Ownership is the old fine rule (nodes.ts ownerOf, nearest SECTION node in its tile) mapped onto the section's zone, so a zone is
// exactly the union of its old sections and an old save converts section by section (spread-map.ts toZones).
// The zone's champion stands where its most central old section's champion stood (a spot placeNodes already found walkable).
// ★ PURE. Build only: no canon place, no words.
import type { Poly, WildsNode } from './nodes'

/** old sections per zone side (2 = 2 x 2) */
export const FUSE = 2
export const zoneKey = (n: WildsNode): string => {
  const gi = n.gi ?? n.i, gj = n.gj ?? n.j, pre = n.gi === undefined ? `${n.tile}:` : ''
  return `z${pre}${Math.floor(gi / FUSE)},${Math.floor(gj / FUSE)}`
}
export interface Fused { zones: WildsNode[]; zoneOf: Map<string, string>; members: Map<string, string[]> }
/** every section node -> its zone; one zone node per fused block, sorted by id */
export function fuseZones(nodes: readonly WildsNode[]): Fused {
  const groups = new Map<string, WildsNode[]>()
  for (const n of nodes) { const k = zoneKey(n), g = groups.get(k); if (g) g.push(n); else groups.set(k, [n]) }
  const zones: WildsNode[] = [], zoneOf = new Map<string, string>(), members = new Map<string, string[]>()
  for (const [id, g] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const mx = g.reduce((s, n) => s + n.x, 0) / g.length, mz = g.reduce((s, n) => s + n.z, 0) / g.length
    const rep = [...g].sort((a, b) => Math.hypot(a.x - mx, a.z - mz) - Math.hypot(b.x - mx, b.z - mz) || (a.id < b.id ? -1 : 1))[0]
    const [zi, zj] = id.slice(id.lastIndexOf(':') + 1).replace(/^z/, '').split(',').map(Number)
    zones.push({ ...rep, id, gi: zi, gj: zj })
    members.set(id, g.map(n => n.id).sort())
    for (const n of g) zoneOf.set(n.id, id)
  }
  return { zones, zoneOf, members }
}

/** Merge each zone's section polygons (exact Voronoi cells of one tile, nodes.ts nodeRegions) into its outline: the edges two cells
 *  of the SAME zone share cancel, the rest chain into loops. A zone the chain cannot close keeps its cells (never a lost region). */
export function mergeRegions(cells: readonly { id: string; poly: Poly }[], zoneOf: (id: string) => string): { id: string; poly: Poly }[] {
  const by = new Map<string, Poly[]>()
  for (const c of cells) { const z = zoneOf(c.id), a = by.get(z); if (a) a.push(c.poly); else by.set(z, [c.poly]) }
  const out: { id: string; poly: Poly }[] = []
  for (const [id, polys] of by) {
    if (polys.length === 1) { out.push({ id, poly: polys[0] }); continue }
    const merged = mergePolys(polys)
    for (const p of merged ?? polys) out.push({ id, poly: p })
  }
  return out
}
const Q = 0.05
const key = (p: { x: number; z: number }) => `${Math.round(p.x / Q)},${Math.round(p.z / Q)}`
/** null = the edges did not chain cleanly (the caller keeps the cells) */
export function mergePolys(polys: readonly Poly[]): Poly[] | null {
  const edges = new Map<string, { a: { x: number; z: number }; b: { x: number; z: number } }>()
  for (const poly of polys) for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length], ka = key(a), kb = key(b)
    if (ka === kb) continue
    const back = `${kb}>${ka}`
    if (edges.has(back)) edges.delete(back); else edges.set(`${ka}>${kb}`, { a, b })
  }
  const from = new Map<string, string[]>()
  for (const k of edges.keys()) { const s = k.split('>')[0], l = from.get(s); if (l) l.push(k); else from.set(s, [k]) }
  const used = new Set<string>(), loops: Poly[] = []
  for (const k0 of edges.keys()) {
    if (used.has(k0)) continue
    const loop: Poly = []; let k: string | undefined = k0
    while (k && !used.has(k)) {
      used.add(k); const e = edges.get(k)!; loop.push(e.a)
      k = (from.get(k.split('>')[1]) ?? []).find(n => !used.has(n))
    }
    if (key(edges.get(k0)!.a) !== key(edges.get([...used].pop()!)!.b)) return null
    loops.push(loop)
  }
  return loops.length ? loops : null
}
