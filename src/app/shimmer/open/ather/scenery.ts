// ── BETA M153 s1a: THE SCENERY PALETTE, AND WHERE A PLACED PIECE STANDS (pure: no three, no react; scenery.test.ts) ──
// The palette is built from the game's own lists, never a copy: the tree model's looks (world/flora-placements.ts FLORA_LOOKS), the
// three bush models, the crystal bodies (prospecting.ts CRYSTAL_KINDS), the prop models (world/prop-models.tsx PROP_MODELS) and
// every furniture piece (furniture.ts FURNITURE_ORDER). A new entry in one of those lists shows up here by itself.
// Scenery is only scenery: nothing here is a node, a station or a keeper's piece. No E, no drops, no pickup (nodes are s1b).
// A placed piece stands on the ground under it; off the land it is not drawn. Trunks and big props block, bushes do not, and the
// owner's per-piece toggle (prop.solid) wins over that.
import { FLORA_LOOKS } from '../../world/flora-placements'
import { PROP_MODELS } from '../../world/prop-models'
import { CRYSTAL_KINDS, CRYSTAL_NAME } from './prospecting'
import { FURNITURE, FURNITURE_ORDER } from './furniture'
import { panelChain } from './rooms'
import { isWholeQ, quadBounds } from './build-prefs'
import type { Prop } from '../../world/builder-props'
import type { Box } from '../terrain-world'

export type SceneryGroup = 'Trees' | 'Bushes' | 'Crystals' | 'Props' | 'Furniture'
export const SCENERY_GROUPS: readonly SceneryGroup[] = ['Trees', 'Bushes', 'Crystals', 'Props', 'Furniture']
/** w, d, h = its size at scale 1 (m); `box` = the part that blocks (a tree's trunk), absent = the whole size; `fit` = model height */
export interface SceneryKind {
  k: string; group: SceneryGroup; label: string
  w: number; d: number; h: number; solid: boolean
  box?: { w: number; d: number; h: number }; panel?: boolean
  model: { glb: string; fit: number; look?: string; yaw?: number; glow?: number } | { crystal: string } | { piece: string }
}
const words = (id: string) => { const s = id.replace(/[_-]+/g, ' '); return s[0].toUpperCase() + s.slice(1) }

/** the tree model (public/models/flora/tree.glb): this tall at look scale 1 (its trunk ~0.75 m thick, like the Wilds' big trees) */
export const TREE_H = 5.4
/** the three bush models (Alex 09-22: bushes are models), drawn at their own size: w, d, h in metres off the model (tested against the file) */
export const BUSHES: Readonly<Record<string, { w: number; d: number; h: number }>> = {
  'sunfruit-bush': { w: 1, d: 0.92, h: 0.95 }, 'moonberry-bush': { w: 1, d: 0.98, h: 0.62 }, 'bloom-bush': { w: 0.79, d: 0.85, h: 0.6 },
}
/** how tall each prop model stands here (m); its width and depth follow the model (w, d per metre of height, tested against the files) */
export const PROP_SIZE: Readonly<Record<string, { h: number; w: number; d: number }>> = {
  alchemy_station: { h: 1.5, w: 1.32, d: 0.43 }, crafting_table: { h: 1.2, w: 2.05, d: 1.23 }, chest: { h: 0.8, w: 1.42, d: 0.83 },
  exchange_booth: { h: 2.4, w: 0.99, d: 0.64 }, farm_planter: { h: 0.8, w: 1.76, d: 1.53 }, gun_bench: { h: 1.5, w: 0.83, d: 0.35 },
}
const PROP_DEFAULT = { h: 1.2, w: 1, d: 1 }
/** a prop at least this tall blocks unless its toggle says otherwise */
export const BIG_PROP_H = 0.6

export const SCENERY: readonly SceneryKind[] = [
  ...Object.entries(FLORA_LOOKS).map(([id, l]): SceneryKind => { const h = TREE_H * l.scale
    return { k: `tree:${id}`, group: 'Trees', label: `${words(id)} tree`, w: h * 0.5, d: h * 0.5, h, solid: true, box: { w: h * 0.12, d: h * 0.12, h: h * 0.45 }, model: { glb: '/models/flora/tree.glb', fit: h, look: id } } }),
  ...Object.entries(BUSHES).map(([id, b]): SceneryKind => ({ k: `bush:${id}`, group: 'Bushes', label: words(id), ...b, solid: false, model: { glb: `/models/flora/${id}.glb`, fit: b.h } })),
  // the egg hunt's hidden crystal is not a body of its own (it wears the others' light so it never gives itself away): not scenery
  ...CRYSTAL_KINDS.filter(c => c !== 'egg').map((c): SceneryKind => ({ k: `crystal:${c}`, group: 'Crystals', label: CRYSTAL_NAME[c], w: 1.2, d: 1.2, h: 1.35, solid: true, box: { w: 0.8, d: 0.8, h: 1.1 }, model: { crystal: c } })),
  ...Object.entries(PROP_MODELS).map(([id, m]): SceneryKind => { const z = PROP_SIZE[id] ?? PROP_DEFAULT
    return { k: `prop:${id}`, group: 'Props', label: words(id), w: z.h * z.w, d: z.h * z.d, h: z.h, solid: z.h >= BIG_PROP_H, model: { glb: m.url, fit: z.h, yaw: m.yaw, glow: m.glow } } }),
  ...FURNITURE_ORDER.map((id): SceneryKind => { const f = FURNITURE[id]
    return { k: `piece:${id}`, group: 'Furniture', label: f.name, w: f.w, d: f.d, h: f.h, solid: f.solid, panel: f.panel, model: { piece: id } } }),
]
export const SCENERY_BY: ReadonlyMap<string, SceneryKind> = new Map(SCENERY.map(s => [s.k, s]))
export const isSolid = (p: Pick<Prop, 'k' | 'solid'>) => p.solid ?? SCENERY_BY.get(p.k)?.solid ?? false

/** a piece standing on the ground */
export interface PlacedProp extends Prop { y: number }
export function sceneryPlaced(props: readonly Prop[], ground: (x: number, z: number) => number): PlacedProp[] {
  const out: PlacedProp[] = []
  for (const p of props) { if (!SCENERY_BY.has(p.k)) continue; const y = ground(p.x, p.z); if (Number.isFinite(y)) out.push({ ...p, y }) }
  return out
}
/** the walker's boxes. A wall panel off the axes is a chain of thin boxes (rooms.ts), the rest the turned footprint's bounds. */
export function sceneryBoxes(items: readonly PlacedProp[]): Box[] {
  return items.flatMap(p => {
    const K = SCENERY_BY.get(p.k)
    if (!K || !isSolid(p)) return []
    const b = K.box ?? K, w = b.w * p.s, d = b.d * p.s
    const ks = K.box ? [quadBounds(p.x, p.z, w, d, 0)] : K.panel && !isWholeQ(p.q) ? panelChain(p.x, p.z, w, d, p.q) : [quadBounds(p.x, p.z, w, d, p.q)]
    return ks.map(r => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y0: p.y - 0.5, y1: p.y + b.h * p.s }))
  })
}
