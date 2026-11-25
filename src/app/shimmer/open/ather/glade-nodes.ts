// ── BETA M153 s1b: TUTORIAL NODES IN THE GLADE (docs/m153-place-mode.md; placed in the World Builder, world/builder-props.ts) ──
// A placed `node:` piece becomes the same Tree / Crystal the Wilds are made of, so everything past this file is the Wilds' own code
// (aim, channel, mana, drops, XP, loot, look). Two things differ: `waitMs` (the piece's own cooldown instead of the dial's) and the id.
// ★ THE ID is `glade:<piece id>:<kind>`: the piece keeps its id through a move and a republish, so a keeper's timer holds; a piece that
//   becomes another kind is another node. A NODE PIECE'S ID IS NEVER USED AGAIN (newNodeId is the time it was placed).
// ★ THE WAIT RUNS FROM THE FIRST TOUCH, as in the Wilds (channel.ts): one cycle, one roll, one yield, so at most one yield per wait
//   however it is let go of. What is done is kept, and saved, until that cycle ends, so a newcomer out of mana halfway has the whole
//   wait (a day) to finish it; past that the node is whole again and can be worked afresh at once.
// Only the Glade's scene reads these: they are never in WildsWorld, so the fold map, spirits, infection and spread cannot see them.
import { TRUNK, type TreeKind, TREE_KINDS } from './forestry'
import { CRYSTAL_KINDS, CRYSTAL_NAME, type CrystalKind } from './prospecting'
import { TREE_NAME } from './forestry'
import { KEEPER_NODE } from './keeper-nodes'
import { NODE_PREFIX, nodeWaitH, type Prop } from '../../world/builder-props'
import type { Crystal, Tree } from './wilds'

export const NODE_TREES = TREE_KINDS
/** the hidden crystal is the Trails' egg hunt, not a body of its own: not placeable */
export const NODE_CRYSTALS = CRYSTAL_KINDS.filter((k): k is Exclude<CrystalKind, 'egg'> => k !== 'egg')
export const nodeName = (kind: string) => TREE_NAME[kind as TreeKind] ?? CRYSTAL_NAME[kind as CrystalKind] ?? kind
export const nodeKindOf = (k: string): TreeKind | Exclude<CrystalKind, 'egg'> | null => {
  if (!k.startsWith(NODE_PREFIX)) return null
  const n = k.slice(NODE_PREFIX.length)
  return (NODE_TREES as string[]).includes(n) ? n as TreeKind : (NODE_CRYSTALS as string[]).includes(n) ? n as Exclude<CrystalKind, 'egg'> : null
}
export const isTreeKind = (k: string): k is TreeKind => (NODE_TREES as string[]).includes(k)
/** true size: the middle of what the Wilds grow (wilds.ts: tall 5..10, r 1.6..2.8, x the kind's own; crystals 0.8..1.3) */
const BIG: Record<TreeKind, number> = { goldwood: 1, shimmeroak: 1.2, starwillow: 0.95, dawnwood: 1.55 }
export const nodeTree = (kind: TreeKind) => ({ tall: 7.5 * BIG[kind], r: 2.2 * BIG[kind] })
export const NODE_CRYSTAL_S = 1.05

export interface GladeNodes { trees: Tree[]; crystals: Crystal[]; treesNear(x: number, z: number, r: number): Tree[]; crystalsNear(x: number, z: number, r: number): Crystal[] }
export function gladeNodes(props: readonly Prop[], ground: (x: number, z: number) => number): GladeNodes {
  const trees: Tree[] = [], crystals: Crystal[] = []
  for (const p of props) {
    const kind = nodeKindOf(p.k), y = kind ? ground(p.x, p.z) : NaN
    if (!kind || !Number.isFinite(y)) continue
    const at = { id: `${KEEPER_NODE}${p.id}:${kind}`, x: p.x, y, z: p.z, waitMs: nodeWaitH(p) * 3_600_000 }
    if (isTreeKind(kind)) trees.push({ ...at, kind, ...nodeTree(kind) })
    else crystals.push({ ...at, kind, s: NODE_CRYSTAL_S, rot: -p.q * Math.PI / 2 })
  }
  const near = <T extends { x: number; z: number }>(a: T[]) => (x: number, z: number, r: number) => a.filter(t => Math.abs(t.x - x) < r && Math.abs(t.z - z) < r)
  return { trees, crystals, treesNear: near(trees), crystalsNear: near(crystals) }
}
/** the walker's box of a tree node (a crystal does not block, as in the Wilds) */
export const nodeTrunk = (kind: TreeKind) => ({ w: TRUNK[kind] * 2, d: TRUNK[kind] * 2, h: 3.2 })
