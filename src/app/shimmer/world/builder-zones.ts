// ── BETA M84 s1 + M114: BUILDING ZONES in the World Builder draft (pure; TerrainEditor drives it, builder-zones.test.ts tests it) ──
// Alex 11-23: "remove and place building zones after preparing the landscape.. tags on building zones that I mark (first it's
// cropped and then a pop asks if it's a home and if so who's with a dropdown or a shop with a dropdown or a supplier with a dropdown
// or other for buildings that should be locked and empty inside".
//   · A zone is a rectangle on the draft. Marking it FLATTENS ('cropped') the ground inside to the height under the first click,
//     blending back to the land over ZONE_BLEND_M outside the rectangle (smoothstep, no cliff).
//   · The flatten is BAKED into the draft's height edits (the same per-vertex deltas the brushes write), so the tile view, the
//     overview, Fly and, after Publish, the game all show it with no new reader. The zone keeps `prev`: every vertex it changed
//     and the delta that vertex had before, so DELETE writes `prev` back and the ground is exactly what it was.
//   · Zones never overlap (blend margins included): deleting one can then never undo another's ground.
//   · The TAG (M114): home (who lives there) / shop (which) / supplier (which) / other (locked, empty inside). s1 stores and shows
//     it only; the game does not read it yet.
import type { BrushTile, Edits, TileEdits } from '../open/ather/wilds-edits'
import { EDIT_MAX_DM } from '../open/ather/wilds-edits'
import { FURNITURE } from '../open/ather/furniture'

export type ZoneKind = 'home' | 'shop' | 'supplier' | 'other'
export const ZONE_KINDS: readonly ZoneKind[] = ['home', 'shop', 'supplier', 'other']
/** `ref` = the chosen entry's id in its list (folk id, shop id, good id); `name` = what the list showed (kept for the overlay) */
/** M114 s3: which edge of the zone is its FRONT (the game's E point sits at its middle). N = -z, E = +x, S = +z, W = -x, as the
 *  top-down plan draws them (z grows down the page). Absent = 's' (+z), the s2 default, so an old zone keeps its E point. */
export type ZoneFront = 'n' | 'e' | 's' | 'w'
export const ZONE_FRONTS: readonly ZoneFront[] = ['n', 'e', 's', 'w']
export const FRONT_LABEL: Record<ZoneFront, string> = { n: 'N', e: 'E', s: 'S', w: 'W' }
export interface ZoneTag { kind: ZoneKind; ref?: string; name?: string; /** M114 s3: absent = 's' (+z) */ front?: ZoneFront }
/** M84 s2: one building part set in the zone (a furniture.ts item: wall panel, floor slab, furniture). x, z are ZONE-LOCAL metres
 *  from the zone's (x0, z0) corner, so the build travels with the zone; q = turns in quarters (0..4, sixths of a quarter = 15 deg). */
export interface ZonePiece { id: string; item: string; x: number; z: number; q: number }
export interface Zone { id: string; x0: number; z0: number; x1: number; z1: number; h: number; tag: ZoneTag | null; prev: Record<string, TileEdits>; /** M84 s2: what is built on it (absent = nothing) */ build?: ZonePiece[] }

export const ZONE_BLEND_M = 8       // the edge blends back to the land over this many metres
export const ZONE_MIN_M = 4         // a drag shorter than this on either side is a click (select), not a zone
export const ZONES_MAX = 300
const STR_MAX = 80

export interface Rect { x0: number; z0: number; x1: number; z1: number }
const r1 = (v: number) => Math.round(v * 10) / 10
export const normRect = (ax: number, az: number, bx: number, bz: number): Rect =>
  ({ x0: r1(Math.min(ax, bx)), z0: r1(Math.min(az, bz)), x1: r1(Math.max(ax, bx)), z1: r1(Math.max(az, bz)) })
export const bigEnough = (r: Rect) => r.x1 - r.x0 >= ZONE_MIN_M && r.z1 - r.z0 >= ZONE_MIN_M

/** 1 inside the rectangle, smoothstep down to 0 at ZONE_BLEND_M outside it */
export function zoneWeight(r: Rect, x: number, z: number, blend = ZONE_BLEND_M): number {
  const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1), d = Math.hypot(dx, dz)
  if (d <= 0) return 1
  if (d >= blend) return 0
  const t = 1 - d / blend
  return t * t * (3 - 2 * t)
}

/** The deltas that flatten `r` to height h (m), and `prev`: the delta each changed vertex had before (0 = none). `heightAt` is the
 *  edited ground in world coords (NaN off the land: skipped, like the brushes). */
export function flattenZone(tiles: BrushTile[], heightAt: (x: number, z: number) => number, cur: Edits, r: Rect, h: number): { d: Record<string, TileEdits>; prev: Record<string, TileEdits> } {
  const d: Record<string, TileEdits> = {}, prev: Record<string, TileEdits> = {}
  const B = ZONE_BLEND_M
  for (const t of tiles) {
    const hx = t.sizeX / 2, hz = t.sizeZ / 2
    const i0 = Math.max(0, Math.floor((r.x0 - B - t.ox + hx) / t.cell)), i1 = Math.min(t.nx - 1, Math.ceil((r.x1 + B - t.ox + hx) / t.cell))
    const j0 = Math.max(0, Math.floor((r.z0 - B - t.oz + hz) / t.cell)), j1 = Math.min(t.nz - 1, Math.ceil((r.z1 + B - t.oz + hz) / t.cell))
    if (i0 > i1 || j0 > j1) continue
    const mine = cur[t.name] ?? {}
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = t.ox - hx + i * t.cell, z = t.oz - hz + j * t.cell
      const w = zoneWeight(r, x, z); if (w <= 0) continue
      const hc = heightAt(x, z); if (!Number.isFinite(hc)) continue
      const k = String(j * t.nx + i), was = mine[k] ?? 0
      const dm = Math.max(-EDIT_MAX_DM, Math.min(EDIT_MAX_DM, Math.round(was + (h - hc) * w * 10)))
      if (dm === was) continue
      ;(d[t.name] ??= {})[k] = dm
      ;(prev[t.name] ??= {})[k] = was
    }
  }
  return { d, prev }
}

/** the rectangle grown by the blend margin */
const grown = (r: Rect): Rect => ({ x0: r.x0 - ZONE_BLEND_M, z0: r.z0 - ZONE_BLEND_M, x1: r.x1 + ZONE_BLEND_M, z1: r.z1 + ZONE_BLEND_M })
const meets = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1
/** the first zone whose blended ground would meet r's (null = free) */
export const overlapping = (zones: readonly Zone[], r: Rect): Zone | null => zones.find(z => meets(grown(z), grown(r))) ?? null
/** the zone under (x, z) (its rectangle, not the blend) */
export const zoneAt = (zones: readonly Zone[], x: number, z: number): Zone | null => zones.find(q => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) ?? null

export const newZoneId = (zones: readonly Zone[], now = Date.now()) => { let id = `z${now.toString(36)}`; for (let n = 1; zones.some(q => q.id === id); n++) id = `z${now.toString(36)}-${n}`; return id }

/** what the overlay and the panel call a tag */
export const KIND_LABEL: Record<ZoneKind, string> = { home: 'Home', shop: 'Shop', supplier: 'Supplier', other: 'Other' }
export function zoneLabel(z: Pick<Zone, 'tag'>): string {
  const t = z.tag; if (!t) return 'zone (untagged)'
  if (t.kind === 'other') return 'Other (locked)'
  return t.name ? `${KIND_LABEL[t.kind]}: ${t.name}` : KIND_LABEL[t.kind]
}

/** zones as overlay data (builder-pois' shapes): a marker at the centre named by its tag, and the rectangle as a closed line */
export function zoneOverlay(zones: readonly Zone[]): { pois: { kind: 'zone'; name: string; x: number; z: number }[]; roads: { kind: 'zone'; pts: [number, number][] }[] } {
  return {
    pois: zones.map(z => ({ kind: 'zone' as const, name: zoneLabel(z), x: r1((z.x0 + z.x1) / 2), z: r1((z.z0 + z.z1) / 2) })),
    roads: zones.map(z => ({ kind: 'zone' as const, pts: [[z.x0, z.z0], [z.x1, z.z0], [z.x1, z.z1], [z.x0, z.z1], [z.x0, z.z0]] as [number, number][] })),
  }
}

// ── junk-proof reader (the route stores whatever cleanLayer keeps) ──
const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim().slice(0, STR_MAX) : undefined
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6
function cleanPrev(p: unknown): Record<string, TileEdits> | null {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const out: Record<string, TileEdits> = {}
  for (const [t, m] of Object.entries(p as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(t) || !m || typeof m !== 'object' || Array.isArray(m)) return null
    const o: TileEdits = {}
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      const n = Number(k)
      if (!Number.isInteger(n) || n < 0 || n > 4_000_000 || typeof v !== 'number' || !Number.isInteger(v) || Math.abs(v) > EDIT_MAX_DM) return null
      o[String(n)] = v
    }
    out[t] = o
  }
  return out
}
export function cleanTag(t: unknown): ZoneTag | null {
  const o = t as Partial<ZoneTag> | null
  if (!o || typeof o !== 'object' || !ZONE_KINDS.includes(o.kind as ZoneKind)) return null
  const tag: ZoneTag = { kind: o.kind as ZoneKind }
  if (tag.kind !== 'other') { const ref = str(o.ref), name = str(o.name); if (ref) tag.ref = ref; if (name) tag.name = name }
  if (ZONE_FRONTS.includes(o.front as ZoneFront) && o.front !== 's') tag.front = o.front   // M114 s3: the default is never stored
  return tag
}
export const ZONE_PIECES_MAX = 400   // = plot-blueprint MAX_BP_PIECES
const qNorm = (q: number) => { const k = Math.round(q * 6); return (((k % 24) + 24) % 24) / 6 }   // = build-prefs normQ
/** M84 s2: the zone's build, junk-proof: known items, finite coords inside the zone (+1 m slack), unique ids; [] = nothing */
export function cleanBuild(v: unknown, w: number, d: number): ZonePiece[] {
  if (!Array.isArray(v)) return []
  const out: ZonePiece[] = []
  for (const p of v.slice(0, ZONE_PIECES_MAX)) {
    const o = p as Partial<ZonePiece> | null
    if (!o || typeof o !== 'object') continue
    const id = str(o.id), item = str(o.item)
    if (!id || !item || !Object.prototype.hasOwnProperty.call(FURNITURE, item) || out.some(q => q.id === id) || ![o.x, o.z, o.q].every(num)) continue
    if (o.x! < -1 || o.x! > w + 1 || o.z! < -1 || o.z! > d + 1) continue
    out.push({ id, item, x: Math.round(o.x! * 1000) / 1000, z: Math.round(o.z! * 1000) / 1000, q: qNorm(o.q!) })
  }
  return out
}
export function cleanZones(j: unknown): Zone[] {
  const a = (j as { zones?: unknown } | null)?.zones
  if (!Array.isArray(a)) return []
  const out: Zone[] = []
  for (const z of a.slice(0, ZONES_MAX)) {
    const o = z as Partial<Zone> | null
    if (!o || typeof o !== 'object') continue
    const id = str(o.id), prev = cleanPrev(o.prev)
    if (!id || !prev || out.some(q => q.id === id) || ![o.x0, o.z0, o.x1, o.z1, o.h].every(num)) continue
    const r = normRect(o.x0!, o.z0!, o.x1!, o.z1!)
    const build = cleanBuild(o.build, r.x1 - r.x0, r.z1 - r.z0)
    out.push({ id, ...r, h: r1(o.h!), tag: cleanTag(o.tag), prev, ...(build.length ? { build } : {}) })
  }
  return out
}
