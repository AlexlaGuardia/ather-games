// ── BETA M153 s1a: THE SCENERY PALETTE, AND WHERE A PLACED PIECE STANDS (pure: no three, no react; scenery.test.ts) ──
// The palette is built from the game's own lists, never a copy: the tree model's looks (world/flora-placements.ts FLORA_LOOKS), the
// three bush models, the crystal bodies (prospecting.ts CRYSTAL_KINDS), the prop models (world/prop-models.tsx PROP_MODELS) and
// every furniture piece (furniture.ts FURNITURE_ORDER), plus the filler built in code (FILLER; shapes in scenery-filler.ts). A new entry in one of those lists shows up here by itself.
// Scenery is only scenery: nothing here is a node, a station or a keeper's piece. No E, no drops, no pickup (nodes are s1b).
// A placed piece stands on the ground under it; off the land it is not drawn. Trunks and big props block, bushes do not, and the
// owner's per-piece toggle (prop.solid) wins over that.
import { FLORA_LOOKS } from '../../world/flora-placements'
import { PROP_MODELS } from '../../world/prop-models'
import { CRYSTAL_KINDS, CRYSTAL_NAME } from './prospecting'
import { FURNITURE, FURNITURE_ORDER } from './furniture'
import { panelChain, ROOMS } from './rooms'
import { BENCH_IN, ROOM_SIZE, padLevel, plinthBoxes, roomPad } from './glade-pads'
import { isWholeQ, quadBounds } from './build-prefs'
import { GLADE_ROOMS, NODE_PREFIX, ROOM_PREFIX, isRoom, type GladeRoom, type Prop } from '../../world/builder-props'
import { NODE_CRYSTALS, NODE_CRYSTAL_S, NODE_TREES, nodeName, nodeTree, nodeTrunk } from './glade-nodes'
import { crownOf } from './forestry'
import type { Box } from '../terrain-world'

export type SceneryGroup = 'Nodes' | 'Rooms' | 'Trees' | 'Bushes' | 'Plants' | 'Rocks and logs' | 'Fences and signs' | 'Crystals' | 'Props' | 'Furniture'
export const SCENERY_GROUPS: readonly SceneryGroup[] = ['Nodes', 'Rooms', 'Trees', 'Bushes', 'Plants', 'Rocks and logs', 'Fences and signs', 'Crystals', 'Props', 'Furniture']
/** w, d, h = its size at scale 1 (m); `box` = the part that blocks (a tree's trunk), absent = the whole size; `fit` = model height.
 *  `panel` = long and thin: off the axes it blocks as a chain. `arms` = it blocks as these (local centres, each a panel) instead.
 *  `ends` = local points where a piece of the same family joins on (endSnap) */
export interface SceneryKind {
  k: string; group: SceneryGroup; label: string
  w: number; d: number; h: number; solid: boolean
  box?: { w: number; d: number; h: number }; panel?: boolean
  arms?: readonly { x: number; z: number; w: number; d: number; h: number }[]; ends?: readonly (readonly [number, number])[]
  model: { glb: string; fit: number; look?: string; yaw?: number; glow?: number } | { crystal: string } | { piece: string } | { filler: string } | { node: string } | { room: GladeRoom }
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

/** M153 s1a+: the filler (sizes tested against the built shapes). Big rocks, logs, fences and the sign block; plants never do. */
export const FILLER: Readonly<Record<string, Omit<SceneryKind, 'k' | 'model'>>> = {
  'grass-tall': { group: 'Plants', label: 'Tall grass', w: 1.05, d: 1.05, h: 0.67, solid: false },
  'flowers-white': { group: 'Plants', label: 'White flowers', w: 0.75, d: 0.75, h: 0.46, solid: false },
  'flowers-yellow': { group: 'Plants', label: 'Yellow flowers', w: 0.75, d: 0.75, h: 0.46, solid: false },
  'flowers-violet': { group: 'Plants', label: 'Violet flowers', w: 0.75, d: 0.75, h: 0.46, solid: false },
  reeds: { group: 'Plants', label: 'Reeds', w: 1.3, d: 1.35, h: 1.72, solid: false },
  'rock-small': { group: 'Rocks and logs', label: 'Small rock', w: 0.5, d: 0.42, h: 0.3, solid: false },
  'rock-medium': { group: 'Rocks and logs', label: 'Rock', w: 1.4, d: 1.1, h: 0.8, solid: true, box: { w: 1, d: 0.85, h: 0.75 } },
  'rock-large': { group: 'Rocks and logs', label: 'Large rock', w: 2.75, d: 2.15, h: 1.75, solid: true, box: { w: 1.75, d: 1.55, h: 1.65 } },
  'log-fallen': { group: 'Rocks and logs', label: 'Fallen log', w: 2.4, d: 0.65, h: 0.65, solid: true, arms: [{ x: 0, z: 0, w: 2.4, d: 0.46, h: 0.5 }] },
  stump: { group: 'Rocks and logs', label: 'Tree stump', w: 1.1, d: 1.1, h: 0.46, solid: true, box: { w: 0.6, d: 0.6, h: 0.46 } },
  fence: { group: 'Fences and signs', label: 'Fence', w: 2.15, d: 0.15, h: 1.13, solid: true, arms: [{ x: 0, z: 0, w: 2, d: 0.15, h: 1.1 }], ends: [[-1, 0], [1, 0]] },
  // its turn point is the corner post, so the whole thing sits on the grid like a straight piece
  'fence-corner': { group: 'Fences and signs', label: 'Fence corner', w: 2.15, d: 2.15, h: 1.13, solid: true, arms: [{ x: 0.5, z: 0, w: 1, d: 0.15, h: 1.1 }, { x: 0, z: 0.5, w: 0.15, d: 1, h: 1.1 }], ends: [[1, 0], [0, 1]] },
  sign: { group: 'Fences and signs', label: 'Blank sign', w: 1.13, d: 0.23, h: 1.55, solid: true, box: { w: 0.3, d: 0.3, h: 1.5 } },
}

/** s1c-3: what blocks in a room (the plot's floor and furniture, workshop.tsx RoomMesh): its bench, or Cooking's hearth under its spit */
const ROOM_BENCH = { w: 2.4, d: 0.8, h: 1 }, ROOM_HEARTH = { w: 2, d: 1.1, h: 1.3 }
export const ROOM_H = 1.5

export const SCENERY: readonly SceneryKind[] = [
  // s1b: gatherable nodes (glade-nodes.ts). Fly draws the body off these rows; the game draws and works them as the Wilds' own.
  ...NODE_TREES.map((kind): SceneryKind => { const t = { ...nodeTree(kind), y: 0, kind }, c = crownOf(t), h = c.cy + c.hh
    return { k: `${NODE_PREFIX}${kind}`, group: 'Nodes', label: `${nodeName(kind)} node`, w: c.r * 2, d: c.r * 2, h, solid: true, box: nodeTrunk(kind), model: { node: kind } } }),
  ...NODE_CRYSTALS.map((kind): SceneryKind => ({ k: `${NODE_PREFIX}${kind}`, group: 'Nodes', label: `${nodeName(kind)} node`, w: 1.2 * NODE_CRYSTAL_S, d: 1.2 * NODE_CRYSTAL_S, h: 1.35 * NODE_CRYSTAL_S, solid: false, model: { node: kind } })),
  ...GLADE_ROOMS.map((r): SceneryKind => ({ k: `${ROOM_PREFIX}${r}`, group: 'Rooms', label: ROOMS[r].name, ...ROOM_SIZE[r], h: ROOM_H, solid: true, arms: [{ x: 0, z: ROOM_SIZE[r].d / 2 - BENCH_IN, ...(r === 'cooking' ? ROOM_HEARTH : ROOM_BENCH) }], model: { room: r } })),
  ...Object.entries(FLORA_LOOKS).map(([id, l]): SceneryKind => { const h = TREE_H * l.scale
    return { k: `tree:${id}`, group: 'Trees', label: `${words(id)} tree`, w: h * 0.5, d: h * 0.5, h, solid: true, box: { w: h * 0.12, d: h * 0.12, h: h * 0.45 }, model: { glb: '/models/flora/tree.glb', fit: h, look: id } } }),
  ...Object.entries(BUSHES).map(([id, b]): SceneryKind => ({ k: `bush:${id}`, group: 'Bushes', label: words(id), ...b, solid: false, model: { glb: `/models/flora/${id}.glb`, fit: b.h } })),
  ...Object.entries(FILLER).map(([id, f]): SceneryKind => ({ k: `filler:${id}`, ...f, model: { filler: id } })),
  // the egg hunt's hidden crystal is not a body of its own (it wears the others' light so it never gives itself away): not scenery
  ...CRYSTAL_KINDS.filter(c => c !== 'egg').map((c): SceneryKind => ({ k: `crystal:${c}`, group: 'Crystals', label: CRYSTAL_NAME[c], w: 1.2, d: 1.2, h: 1.35, solid: true, box: { w: 0.8, d: 0.8, h: 1.1 }, model: { crystal: c } })),
  ...Object.entries(PROP_MODELS).map(([id, m]): SceneryKind => { const z = PROP_SIZE[id] ?? PROP_DEFAULT
    return { k: `prop:${id}`, group: 'Props', label: words(id), w: z.h * z.w, d: z.h * z.d, h: z.h, solid: z.h >= BIG_PROP_H, model: { glb: m.url, fit: z.h, yaw: m.yaw, glow: m.glow } } }),
  ...FURNITURE_ORDER.map((id): SceneryKind => { const f = FURNITURE[id]
    return { k: `piece:${id}`, group: 'Furniture', label: f.name, w: f.w, d: f.d, h: f.h, solid: f.solid, panel: f.panel, model: { piece: id } } }),
]
export const SCENERY_BY: ReadonlyMap<string, SceneryKind> = new Map(SCENERY.map(s => [s.k, s]))
export const isSolid = (p: Pick<Prop, 'k' | 'solid'>) => p.solid ?? SCENERY_BY.get(p.k)?.solid ?? false

/** a local offset turned by q quarter turns (the drawn piece's own turn: rotation-y = -q * 90 degrees) */
export function turned(x: number, z: number, q: number): [number, number] { const a = q * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); return [x * c - z * s, x * s + z * c] }
/** how near (m) the hand must be for a piece with ends to jump onto its neighbour's */
export const END_REACH = 0.8
/** fences run on end to end: where a piece in hand, aimed at (x, z), would sit with one of its ends on an end of a placed one. Nearest
 *  wins; never on top of a piece already there. null = nothing near, the grid decides. */
export function endSnap(props: readonly Prop[], hand: Pick<Prop, 'k' | 'q' | 's'>, x: number, z: number): { x: number; z: number } | null {
  const mine = SCENERY_BY.get(hand.k)?.ends; if (!mine) return null
  let best: { x: number; z: number } | null = null, bd = END_REACH
  const near = props.filter(p => SCENERY_BY.get(p.k)?.ends && Math.hypot(p.x - x, p.z - z) < 6)
  for (const p of near) for (const e of SCENERY_BY.get(p.k)!.ends!) for (const m of mine) {
    const [ex, ez] = turned(e[0] * p.s, e[1] * p.s, p.q), [mx, mz] = turned(m[0] * hand.s, m[1] * hand.s, hand.q)
    const cx = p.x + ex - mx, cz = p.z + ez - mz, d = Math.hypot(cx - x, cz - z)
    if (d >= bd || near.some(o => Math.hypot(o.x - cx, o.z - cz) < 0.05)) continue
    bd = d; best = { x: cx, z: cz }
  }
  return best
}

/** a piece standing on the ground; `low` = a room's: how deep its plinth goes */
export interface PlacedProp extends Prop { y: number; low?: number }
/** `ground` = what pieces stand on (glade-pads padGround), `land` = the bare land: a room stands level on the highest of it */
export function sceneryPlaced(props: readonly Prop[], ground: (x: number, z: number) => number, land = ground): PlacedProp[] {
  const out: PlacedProp[] = []
  for (const p of props) { if (!SCENERY_BY.has(p.k)) continue
    const r = isRoom(p) ? roomPad(p) : null; if (r) { const v = padLevel(r, land); if (Number.isFinite(v.top)) out.push({ ...p, y: v.top, low: v.low }); continue }
    const y = ground(p.x, p.z); if (Number.isFinite(y)) out.push({ ...p, y }) }
  return out
}
/** the walker's boxes. A wall panel off the axes is a chain of thin boxes (rooms.ts), the rest the turned footprint's bounds. */
export function sceneryBoxes(items: readonly PlacedProp[]): Box[] {
  return items.flatMap(p => {
    const K = SCENERY_BY.get(p.k)
    if (!K || !isSolid(p)) return []
    const pad = isRoom(p) && p.low !== undefined ? roomPad(p) : null, plinth = pad ? plinthBoxes(pad, p.y, p.low!) : []
    if (K.arms) return plinth.concat(K.arms.flatMap(a => {
      const [ox, oz] = turned(a.x * p.s, a.z * p.s, p.q), x = p.x + ox, z = p.z + oz, w = a.w * p.s, d = a.d * p.s
      const rs = isWholeQ(p.q) ? [quadBounds(x, z, w, d, p.q)] : w >= d ? panelChain(x, z, w, d, p.q) : panelChain(x, z, d, w, p.q + 1)
      return rs.map(r => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y0: p.y - 0.5, y1: p.y + a.h * p.s }))
    }))
    const b = K.box ?? K, w = b.w * p.s, d = b.d * p.s
    const ks = K.box ? [quadBounds(p.x, p.z, w, d, 0)] : K.panel && !isWholeQ(p.q) ? panelChain(p.x, p.z, w, d, p.q) : [quadBounds(p.x, p.z, w, d, p.q)]
    return ks.map(r => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y0: p.y - 0.5, y1: p.y + b.h * p.s }))
  })
}
