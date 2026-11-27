// ── GREG'S WILDS MAP (BETA M236, Alex 11-27) ───────────────────────────────────────────────────────────────────────────────
// While Greg explains the Wilds (glade-greg-talk.ts, the four signed greg.b1.wilds lines) a map of the WHOLE Ather shows beside
// his talk and runs one stage per line: (0) every zone CLEAR, (1) the infection ripples zone by zone across it, (2) every zone
// HOLLOW GROUND, (3) it fades to the newborn's own map (all Unseen under the fold-mist). Display only: it never reads or writes the
// keeper's spread map (spread-map.ts) or fog. M236 s2 (Alex 11-27: "why didnt we just use the same map"): the picture IS the real
// Ather Wilds map, panels.tsx AreaView (the fold map's Ather side), round Greg's waymark tile, fed THIS file's display-only regions
// in place of the keeper's; the signed legend under it (SpreadLegend). Stage pacing + ripple speed are Jin's (look calls for Alex).
// ★ PURE. Build only: no canon place, no words of its own.
import { fuseZones, mergeRegions } from './zones'
import { SUB, nodeRegions, type Poly, type WildsNode } from './nodes'
import { sectionRoll, type LegendState } from './spread-map'
import type { Region } from './tile-picture'
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

/** the ripple's next count from `prev`: on time (rippleCount), but never more than RIPPLE_MAX_STEP of the zones in one tick, so a
 *  slow frame (a busy phone) slows the ripple down instead of jumping it to the end (M236 s2: seen 0,2,3,64 under swiftshader) */
export const RIPPLE_MIN_STEPS = 8
export function rippleNext(n: number, ms: number, prev: number): number {
  const due = rippleCount(n, ms), cap = Math.max(1, Math.ceil(n / RIPPLE_MIN_STEPS))
  return Math.max(prev, Math.min(due, prev + cap))
}

export interface IndexTile { name: string; tx: number; ty: number; nodes: { id: string; x: number; z: number; i: number; j: number; biome: WildsNode['biome'] }[] }
export interface GregRegion { id: string; /** tile-local metres, as the fold map's regions */ poly: Poly; /** 0 = the first to turn */ rank: number }
export interface GregArea {
  /** the tile the map is centred on (Greg's waymark tile) and its centre in world metres: AreaView's cx / cz */
  tile: string; cx: number; cz: number
  /** each tile of the 3 x 3 round it: its zone outlines (the fold map's own rule: nodeRegions + mergeRegions per tile) */
  byTile: Map<string, GregRegion[]>
  /** the zones drawn (a zone across a tile seam draws on each tile, one rank) */
  n: number
}

/** The Ather Wilds map's ground round Greg's waymark (the 3 x 3 tiles the fold map shows from there), each zone ranked by when the
 *  ripple reaches it: outward from the zone farthest from Greg's waymark (so it closes in on the Glade last), with a seeded wobble
 *  so the front is not a perfect circle. Regions are built exactly as page.tsx builds the keeper's (regionsByTile). Same index ->
 *  same area. */
export function buildGregArea(tiles: readonly IndexTile[], tileM: number): GregArea {
  const raw: WildsNode[] = tiles.flatMap(t => t.nodes.map(n => ({ ...n, tile: t.name, x: n.x + t.tx * tileM, z: n.z + t.ty * tileM, gi: t.tx * SUB + n.i, gj: t.ty * SUB + n.j })))
  const fused = fuseZones(raw), home = tiles.find(t => t.name === GREG_WAYMARK.tile)
  const htx = home?.tx ?? 0, hty = home?.ty ?? 0, hx = GREG_WAYMARK.x + htx * tileM, hz = GREG_WAYMARK.z + hty * tileM
  const near = tiles.filter(t => Math.abs(t.tx - htx) <= 1 && Math.abs(t.ty - hty) <= 1)
  const byTile = new Map<string, GregRegion[]>(), ids = new Set<string>()
  const cells = new Map<string, { id: string; poly: Poly }[]>()
  for (const t of near) {
    const local = raw.filter(n => n.tile === t.name).map(n => ({ ...n, x: n.x - t.tx * tileM, z: n.z - t.ty * tileM }))
    const rs = mergeRegions(nodeRegions(local, tileM, tileM), id => fused.zoneOf.get(id) ?? id)
    cells.set(t.name, rs); for (const r of rs) ids.add(r.id)
  }
  const at = new Map(fused.zones.map(z => [z.id, z]))
  const far = [...ids].map(id => at.get(id)).reduce<WildsNode | null>((b, z) => (!z ? b : !b || Math.hypot(z.x - hx, z.z - hz) > Math.hypot(b.x - hx, b.z - hz) ? z : b), null)
  const order = [...ids].map(id => { const z = at.get(id); return { id, d: z && far ? Math.hypot(z.x - far.x, z.z - far.z) + sectionRoll(236, 0, id) * tileM * 0.3 : 0 } })
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
  const rank = new Map(order.map((o, k) => [o.id, k]))
  for (const [name, rs] of cells) byTile.set(name, rs.map(r => ({ ...r, rank: rank.get(r.id) ?? order.length })))
  return { tile: home?.name ?? GREG_WAYMARK.tile, cx: htx * tileM, cz: hty * tileM, byTile, n: order.length }
}

/** The display-only regions a stage shows, in the shape the Ather Wilds map takes (Map<tile, Region[]>): `turned` zones Hollow
 *  ground (by rank), the rest Clear; the dark stage = every zone Unseen (the plain map under the fold-mist). Never the keeper's. */
export function stageRegions(area: GregArea, stage: GregMapStage, turned: number): Map<string, Region[]> {
  // a tile whose zones read the same keeps the SAME array, so the map recomposes only the tiles the ripple just reached (AreaView)
  let memo = memos.get(area); if (!memo) memos.set(area, memo = new Map())
  const out = new Map<string, Region[]>()
  for (const [name, rs] of area.byTile) {
    const dark = stage === 'dark', k = `${name}|${dark ? 'd' : rs.filter(r => r.rank < turned).length}`
    let v = memo.get(k)
    if (!v) memo.set(k, v = rs.map(r => ({ id: r.id, poly: r.poly, state: dark ? 'unseen' : r.rank < turned ? 'hollow' : 'clear' })))
    out.set(name, v)
  }
  return out
}
const memos = new WeakMap<GregArea, Map<string, Region[]>>()
/** how many zones a stage shows turned when it is not rippling (clear: none, hollow + dark: all) */
export const turnedAt = (stage: GregMapStage, n: number) => (stage === 'clear' ? 0 : stage === 'ripple' ? 0 : n)
