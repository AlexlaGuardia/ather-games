// ── THE GLADE'S BUILDER LAYER, IN THE GAME (BETA M83 s2b) ──
// s2a made the closed Glade a World Builder map: one virtual 1 km tile over gladeZoneGround (world/glade-builder.ts), published to
// world/glade-edits.json and served at GET /shimmer/open/glade-edits. This file is what the GAME does with it:
//   · gladeLayerGround: the walker's ground = gladeZoneGround + the layer's delta (on the drawn triangles, 0 where nothing is edited). Off the land
//     it stays NaN: the layer sculpts the ground the Glade has, it never adds land (the builder's void rule).
//   · liftGeometry: the Glade's meshes are BAKED from the base ground (Greg's island, the mates' islands, the meadow), so each one is
//     displaced by the same delta at its vertices' WORLD xz (a mate's island is placed + turned, so its local xz is mapped first).
//     Greg's island and the meadow share the tile's 4 m grid (both origins are multiples of 4), so there the mesh is exact.
//   · gladePonds: the owner's painted water, the Wilds' ponds() over the tile's base + edits (sampled only when there is water).
// Pure apart from fetchGladeLayer; glade-layer.test.ts.
import * as THREE from 'three'
import { gladeZoneGround, bowlAtVertex, GLADE_FRAME } from './glade-cluster'
import { mateAt, type Frame } from './cluster'
import { MOONWELL } from './moonwell'
import { poolEdge, POOL_SEGS, POOL_Y } from './moonwell-water'
import { cleanEdits, cleanWaters, ponds, type PondCell, type TileEdits, type WaterMap } from './wilds-edits'
import { publishedZones } from './zone-parts'
import { cleanProps, type Prop } from '../../world/builder-props'
import type { Zone } from '../../world/builder-zones'
import { gladeDeltaAt, sampleGladeBase, GLADE_BRUSH_TILE, GLADE_LAYER_TILE, GLADE_N, GLADE_CELL, GLADE_SIZE, GLADE_TILE_CENTER } from '../../world/glade-builder'

/** M84 s3: `zones` = the published building zones that have a build (zone-parts.ts draws them, with collision); absent = none */
export interface GladeLayer { edits: TileEdits | null; water: WaterMap | null; zones?: Zone[]; /** M153 s1a: the published scenery (scenery.ts), absent = none */ props?: Prop[] }
export const NO_GLADE_LAYER: GladeLayer = { edits: null, water: null }
export const gladeLayerEmpty = (l: GladeLayer) => !l.edits && !l.water && !l.zones?.length && !l.props?.length

/** the layer out of the route's JSON (same shape as the Wilds layer, one tile named 'glade'); junk = no layer */
export function parseGladeLayer(j: unknown): GladeLayer {
  const e = cleanEdits(j)[GLADE_LAYER_TILE], w = cleanWaters(j)[GLADE_LAYER_TILE], z = publishedZones(j), p = cleanProps(j)
  return { edits: e && Object.keys(e).length ? e : null, water: w && Object.keys(w).length ? w : null, ...(z.length ? { zones: z } : {}), ...(p.length ? { props: p } : {}) }
}

export async function fetchGladeLayer(): Promise<GladeLayer> {
  try {
    const r = await fetch('/shimmer/open/glade-edits', { cache: 'no-store' })
    return r.ok ? parseGladeLayer(await r.json()) : NO_GLADE_LAYER
  } catch { return NO_GLADE_LAYER }   // no layer = the Glade as built, exactly
}

/** On a mate's island turned a quarter, whose mesh splits its cells the other way (so the walker reads the same triangles). */
const turned = (x: number, z: number): boolean => { const m = mateAt(GLADE_FRAME, x, z); return !!m && Math.abs(Math.sin(m.rot)) > 0.5 }
/** The walker's ground with the layer applied. No edits = gladeZoneGround itself (the same function, so nothing re-derives). */
export function gladeLayerGround(edits: TileEdits | null, base: (x: number, z: number) => number = gladeZoneGround): (x: number, z: number) => number {
  if (!edits) return base
  return (x, z) => { const g = base(x, z); return Number.isFinite(g) ? g + gladeDeltaAt(edits, x, z, turned(x, z)) : g }
}

/** What the baked meshes' VERTICES move by (metres at a world vertex): the Moonwell's bowl (M157: drawn, not only walked) + the edits.
 *  Never null: the bowl is there with no edits at all. */
export const gladeLift = (edits: TileEdits | null): ((x: number, z: number) => number) => (x, z) => bowlAtVertex(x, z) + gladeDeltaAt(edits, x, z)

/** Where a mesh's local frame sits in the world: three's rotation-y, then the offset (cluster-scene's mate islands). */
export interface Place { x: number; z: number; rot: number }

/** Adds lift(world x, world z) to every vertex's y, in place, and refreshes the normals. Returns the same geometry. */
export function liftGeometry(g: THREE.BufferGeometry, lift: (x: number, z: number) => number, place?: Place): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute, c = place ? Math.cos(place.rot) : 1, s = place ? Math.sin(place.rot) : 0
  for (let k = 0; k < p.count; k++) {
    const lx = p.getX(k), lz = p.getZ(k)
    const wx = place ? place.x + lx * c + lz * s : lx, wz = place ? place.z - lx * s + lz * c : lz
    const d = lift(wx, wz)
    if (d) p.setY(k, p.getY(k) + d)
  }
  p.needsUpdate = true
  if (g.getAttribute('normal')) g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

const PONDS = new WeakMap<GladeLayer, PondCell[]>()
let baseSample: ReturnType<typeof sampleGladeBase> | null = null   // the Glade as built, sampled once (Fly asks every brush tick)
/** The painted water's wet cells (tile-local i, j and the level), over the base + edits. Empty when nothing is painted. */
export function gladePonds(layer: GladeLayer, base: (x: number, z: number) => number = gladeZoneGround): PondCell[] {
  if (!layer.water) return []
  const own = base === gladeZoneGround, hit = own && PONDS.get(layer); if (hit) return hit
  const s = own ? (baseSample ??= sampleGladeBase(base)) : sampleGladeBase(base), { voidV, voided } = s, h = Float32Array.from(s.h)
  if (layer.edits) for (const k in layer.edits) { const n = +k; if (n >= 0 && n < GLADE_N * GLADE_N && !voidV[n]) h[n] += layer.edits[k] / 10 }
  // a cell with a void corner is not the Glade's land: no water hangs over the cloud
  const cells = ponds(GLADE_BRUSH_TILE, h, layer.water).cells.filter(c => !voided[c.j * (GLADE_N - 1) + c.i])
  if (own) PONDS.set(layer, cells)   // the water and the trees read one answer
  return cells
}

/** GladeWater draws a painted cell this far under its level */
export const GLADE_WATER_DROP = 0.05
const TRUNK = 0.32
/** Is this spot's ground under the layer's water, as drawn: a painted cell's sheet, or the Moonwell's (moonwell-water.ts). */
export function gladeWet(layer: GladeLayer): (x: number, z: number) => boolean {
  const ground = gladeLayerGround(layer.edits), cx = GLADE_N - 1, h = GLADE_SIZE / 2
  const top = new Map(gladePonds(layer).map(c => [c.j * cx + c.i, c.y - GLADE_WATER_DROP]))
  let edge: ReturnType<typeof poolEdge> | null = null
  const inPool = (x: number, z: number) => {
    const dx = x - MOONWELL.x, dz = z - MOONWELL.z, d = Math.hypot(dx, dz); if (d > 60) return false
    edge ??= poolEdge(ground)
    const a = ((Math.atan2(dz, dx) / (Math.PI * 2)) * POOL_SEGS + POOL_SEGS) % POOL_SEGS, k = Math.floor(a), f = a - k
    return d <= edge[k % POOL_SEGS].r * (1 - f) + edge[(k + 1) % POOL_SEGS].r * f
  }
  return (x, z) => {
    const t = top.get(Math.floor((z - GLADE_TILE_CENTER.z + h) / GLADE_CELL) * cx + Math.floor((x - GLADE_TILE_CENTER.x + h) / GLADE_CELL))
    const pool = inPool(x, z); if (t === undefined && !pool) return false
    const g = ground(x, z)
    return (t !== undefined && g < t) || (pool && g < POOL_Y)
  }
}
const FRAMES = new WeakMap<GladeLayer, Frame>()
/** BETA M160: the Glade as a cluster frame under this layer: a generated tree whose foot is in the water is not in its list, so nothing
 *  that reads the frame's trees has it. Nothing wet = GLADE_FRAME itself. Per layer, so water lowered or dried brings the tree back. */
export function gladeFrame(layer: GladeLayer): Frame {
  const hit = FRAMES.get(layer); if (hit) return hit
  const m = GLADE_FRAME.meadow, wet = gladeWet(layer), treeNo: number[] = []
  m?.trees.forEach((t, k) => { if (![[0, 0], [TRUNK, 0], [-TRUNK, 0], [0, TRUNK], [0, -TRUNK]].some(([dx, dz]) => wet(t.x + dx, t.z + dz))) treeNo.push(k) })
  const f = !m || treeNo.length === m.trees.length ? GLADE_FRAME : { ...GLADE_FRAME, meadow: { ...m, trees: treeNo.map(k => m.trees[k]), treeNo } }
  FRAMES.set(layer, f); return f
}
