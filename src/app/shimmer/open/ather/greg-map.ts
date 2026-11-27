// ── GREG'S WILDS MAP (BETA M236, Alex 11-27) ───────────────────────────────────────────────────────────────────────────────
// While Greg explains the Wilds (glade-greg-talk.ts, the four signed greg.b1.wilds lines) a map of the WHOLE Ather shows beside
// his talk and runs one stage per line: (0) every zone CLEAR, (1) the infection ripples zone by zone across it, (2) every zone
// HOLLOW GROUND, (3) it fades to black = the newborn's own map (all Unseen). Display only: it never reads or writes the keeper's
// spread map (spread-map.ts); it draws M235's zones (zones.ts) in M235's looks (STATE_LOOK) and names the state with the SIGNED
// legend words (STATE_WORD). Stage pacing + ripple speed are Jin's (look calls for Alex).
// ★ PURE. Build only: no canon place, no words of its own.
import { fuseZones, mergePolys } from './zones'
import { SUB, type Poly, type WildsNode } from './nodes'
import { sectionRoll, type LegendState } from './spread-map'
import { GREG_WAYMARK } from './waymarks'

export const GREG_MAP_STAGES = ['clear', 'ripple', 'hollow', 'dark'] as const
export type GregMapStage = (typeof GREG_MAP_STAGES)[number]
/** how long the ripple takes to cross the whole Ather (ms) */
export const RIPPLE_MS = 3200
/** how long the fade to black takes (ms) */
export const FADE_MS = 1600

/** The Wilds talk line `i` (0-based, greg.b1.wilds.<i+1>) -> its map stage. Any other branch shows no map (null). */
export function stageOfLine(branch: string, i: number): GregMapStage | null {
  if (branch !== 'wilds') return null
  return GREG_MAP_STAGES[Math.max(0, Math.min(i, GREG_MAP_STAGES.length - 1))]
}
/** the legend state the stage SHOWS (its signed word captions the map) */
export const stageState = (s: GregMapStage): LegendState => (s === 'clear' ? 'clear' : s === 'dark' ? 'unseen' : 'hollow')
/** zones turned Hollow ground `ms` into the ripple, of `n`: 0 at the start, all of them by RIPPLE_MS, never falling back */
export function rippleCount(n: number, ms: number): number {
  if (!(ms > 0) || n <= 0) return 0
  return Math.min(n, Math.ceil((n * ms) / RIPPLE_MS))
}

export interface IndexTile { name: string; tx: number; ty: number; nodes: { id: string; x: number; z: number; i: number; j: number; biome: WildsNode['biome'] }[] }
export interface MapZone { id: string; /** SVG points, world metres */ pts: string; /** 0 = the first to turn */ rank: number }
export interface GregMap { zones: MapZone[]; /** the zone count (a zone across a tile seam draws as several shapes) */ n: number; box: { x: number; z: number; w: number; h: number } }

/** Every zone of the Ather (the tile index, loaded or not) as outlines in world metres, each ranked by when the ripple reaches it:
 *  outward from the zone farthest from Greg's waymark (so it closes in on the Glade last), with a seeded wobble so the front is
 *  not a perfect circle. Same index -> same map. */
export function buildGregMap(tiles: readonly IndexTile[], tileM: number): GregMap {
  const raw: WildsNode[] = tiles.flatMap(t => t.nodes.map(n => ({ ...n, tile: t.name, x: n.x + t.tx * tileM, z: n.z + t.ty * tileM, gi: t.tx * SUB + n.i, gj: t.ty * SUB + n.j })))
  const fused = fuseZones(raw)
  const home = tiles.find(t => t.name === GREG_WAYMARK.tile), hx = GREG_WAYMARK.x + (home?.tx ?? 0) * tileM, hz = GREG_WAYMARK.z + (home?.ty ?? 0) * tileM
  const far = fused.zones.reduce<WildsNode | null>((b, z) => (!b || Math.hypot(z.x - hx, z.z - hz) > Math.hypot(b.x - hx, b.z - hz) ? z : b), null)
  const order = fused.zones.map(z => ({ id: z.id, d: far ? Math.hypot(z.x - far.x, z.z - far.z) + sectionRoll(236, 0, z.id) * tileM * 0.6 : 0 }))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
  const rank = new Map(order.map((o, k) => [o.id, k]))
  const zones: MapZone[] = []
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
  // each section as its own subsection square (nodes.ts: SUB x SUB per tile, one node per LAND subsection), fused per zone: the
  // land's own outline at 1/SUB of a tile, sea left out (a tile's Voronoi cells would paint its sea too)
  const cell = tileM / SUB, sq = new Map<string, Poly[]>()
  for (const t of tiles) {
    const ox = t.tx * tileM - tileM / 2, oz = t.ty * tileM - tileM / 2
    x0 = Math.min(x0, ox); x1 = Math.max(x1, ox + tileM); z0 = Math.min(z0, oz); z1 = Math.max(z1, oz + tileM)
    for (const n of t.nodes) {
      const a = ox + n.i * cell, b = oz + n.j * cell, z = fused.zoneOf.get(n.id) ?? n.id, l = sq.get(z) ?? []
      l.push([{ x: a, z: b }, { x: a + cell, z: b }, { x: a + cell, z: b + cell }, { x: a, z: b + cell }]); sq.set(z, l)
    }
  }
  for (const [id, polys] of [...sq].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    for (const poly of mergePolys(polys) ?? polys) zones.push({ id, rank: rank.get(id) ?? order.length, pts: poly.map(p => `${Math.round(p.x)},${Math.round(p.z)}`).join(' ') })
  }
  return { zones, n: order.length, box: tiles.length ? { x: x0, z: z0, w: x1 - x0, h: z1 - z0 } : { x: 0, z: 0, w: 1, h: 1 } }
}
