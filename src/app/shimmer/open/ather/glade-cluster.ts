// ── THE CLOSED GLADE: the tutorial cluster (BETA M67 s1a; plan docs/tutorial-cluster.md; Magii 43fef80 #1/#4) ──────────────
// A NEWBORN keeper opens their eyes in a CLOSED cluster of four gardens, not in the open Wilds: Greg's (the spawn), Otto's,
// Tess's and Bonn's. It is the existing cluster shape (cluster.ts: four islands round the Green, paths meeting at its centre)
// with nobody's own plot in it: Greg's garden stands where "mine" stands in every frame (ne, at the origin) and the three
// friends' gardens are read-only islands turned to face the Green. The one way out is the main gate at the Green's centre
// (plot.ts GATE), open from the start (the skip path, M72), and it leads to the Wilds. Off the edge = the fall, which sets
// you back down at the spawn.
//   · the Moglins (canon moonwell-folk, placement ours): Fennel on Greg's plot, Sax at Otto's, Yarrow + Mallow at Tess's,
//     Hazel at Bonn's. NOT invitable (they belong to the Glade).
//   · Otto, Tess, Bonn have no locked look yet: placeholder figures (folkLook's id colours). Greg has his locked look.
//   · s1a draws every garden on the green; Greg's Glade backdrop (pond, home, jetty) + taking the Glade out of the Wilds = s1b.
//   · no talk here yet (M68).
// Pure; glade-cluster.test.ts.
import { clusterFrame, mateAt, inMiddle, onPath, onMeadow, type Frame, type Quarter } from './cluster'
import { STARTING_SQUARES, GATE, plotHeightAt } from './plot'
import { toWorld } from './meadow'
import { GLADE_ID } from './moonwell-glade'

/** The spot-save's tile name for "standing in the closed Glade" (location.ts spots carry a tile; this one is no Wilds tile). */
export const GLADE_TILE = 'glade'
export const GLADE_ZONE_NAME = 'Moonwell Glade'

export interface GladeGarden { id: 'greg' | 'otto' | 'tess' | 'bonn'; keeper: string; quarter: Quarter; folk: readonly string[] }
/** Greg's is the spawn and stands where "mine" stands (ne); the friends take the other three quarters. */
export const GLADE_GARDENS: readonly GladeGarden[] = [
  { id: 'greg', keeper: 'Gregory', quarter: 'ne', folk: ['fennel'] },
  { id: 'otto', keeper: 'Otto', quarter: 'nw', folk: ['sax'] },
  { id: 'tess', keeper: 'Tess', quarter: 'sw', folk: ['yarrow', 'mallow'] },
  { id: 'bonn', keeper: 'Bonn', quarter: 'se', folk: ['hazel'] },
]
/** What each Glade garden holds: the start ground only (the 3 × 3 corner), same as a fresh garden. */
export const GLADE_OWNED: ReadonlySet<string> = new Set(STARTING_SQUARES)
/** The Glade as a cluster frame: Greg's island at the origin, the three friends' islands round the Green. */
export const GLADE_FRAME: Frame = clusterFrame('ne', GLADE_GARDENS.filter(g => g.id !== 'greg').map(g => ({ quarter: g.quarter, name: g.keeper, owned: [...STARTING_SQUARES] })))

/** a garden's island in world coords (centre + rotation.y); Greg's is the origin, unturned */
export function gardenAt(id: GladeGarden['id']): { x: number; z: number; rot: number } {
  if (id === 'greg') return { x: 0, z: 0, rot: 0 }
  const g = GLADE_GARDENS.find(q => q.id === id)!, m = GLADE_FRAME.mates.find(q => q.quarter === g.quarter)!
  return { x: m.x, z: m.z, rot: m.rot }
}

// Where things stand in a garden's OWN frame (the unturned island: start corner south-west, the path leaving that corner).
// The keeper stands in the start ground, turned to face the corner (where the path to the Green leaves); the garden's
// Moglins stand either side of them, a step back.
const KEEPER_LOCAL = { x: -112, z: 108 }
const CORNER = { x: -150, z: 150 }
const KEEPER_YAW_LOCAL = Math.atan2(CORNER.x - KEEPER_LOCAL.x, CORNER.z - KEEPER_LOCAL.z)   // figure yaw (model faces +z)
const FOLK_SIDE = 2.6, FOLK_BACK = 1.2

export interface Placed { id: string; name: string; x: number; z: number; yaw: number }
const place = (garden: GladeGarden['id'], lx: number, lz: number, yawLocal: number) => {
  const g = gardenAt(garden), p = toWorld(g.x, g.z, g.rot, lx, lz)
  return { x: p.x, z: p.z, yaw: yawLocal + g.rot }
}
/** a point `ahead` m in front of a garden's keeper (toward the corner) and `side` m to their right, in that garden's frame */
function keeperRel(ahead: number, side: number) {
  const fx = Math.sin(KEEPER_YAW_LOCAL), fz = Math.cos(KEEPER_YAW_LOCAL)   // forward (figure convention)
  return { x: KEEPER_LOCAL.x + fx * ahead - fz * side, z: KEEPER_LOCAL.z + fz * ahead + fx * side }
}

/** The four garden-keepers (Greg + the three friends), each in their own start ground facing their corner. */
export function gladeKeepers(): Placed[] {
  return GLADE_GARDENS.map(g => ({ id: g.id, name: g.keeper, ...place(g.id, KEEPER_LOCAL.x, KEEPER_LOCAL.z, KEEPER_YAW_LOCAL) }))
}
/** The Glade's Moglins, by their settlement ids (`moonwell:<name>`, so fur and names match the Glade's own folk). */
export function gladeClusterFolk(): Placed[] {
  return GLADE_GARDENS.flatMap(g => g.folk.map((f, k) => {
    const side = g.folk.length === 1 ? FOLK_SIDE : (k === 0 ? FOLK_SIDE : -FOLK_SIDE)
    const p = keeperRel(-FOLK_BACK, side)
    return { id: `${GLADE_ID}:${f}`, name: f[0].toUpperCase() + f.slice(1), ...place(g.id, p.x, p.z, KEEPER_YAW_LOCAL) }
  }))
}
export const gregInGlade = (): Placed => gladeKeepers().find(k => k.id === 'greg')!

/** How far in front of Greg a newborn opens their eyes (moonwell-glade NEWBORN_GAP's value). */
export const GLADE_NEWBORN_GAP = 5
/** Where a newborn opens their eyes: in Greg's garden, GLADE_NEWBORN_GAP m in front of him, turned to FACE him.
 *  yaw is the WALKER's: forward = (-sin yaw, -cos yaw). */
export function gladeNewbornSpot(): { x: number; z: number; yaw: number } {
  const p = keeperRel(GLADE_NEWBORN_GAP, 0), g = gregInGlade()
  return { x: p.x, z: p.z, yaw: Math.atan2(-(g.x - p.x), -(g.z - p.z)) }
}

/** The Glade's ground: Greg's island (plot.ts) or what the cluster adds (the friends' islands, the meadow, the Green). */
export const gladeGarden = (x: number, z: number): GladeGarden | null => {
  if (Number.isFinite(plotHeightAt(x, z))) return GLADE_GARDENS[0]
  const m = mateAt(GLADE_FRAME, x, z)
  return m ? GLADE_GARDENS.find(g => g.quarter === m.quarter) ?? null : null
}
/** The message line's "where" in the Glade. */
export function gladeWhere(x: number, z: number): string {
  const g = gladeGarden(x, z)
  if (g) return g.id === 'greg' ? "Greg's garden" : `${g.keeper}'s garden`
  return inMiddle(GLADE_FRAME, x, z) ? 'the Green' : onPath(GLADE_FRAME, x, z) ? 'the path' : onMeadow(GLADE_FRAME, x, z) ? 'the valley' : 'the edge'
}
/** The gate out (the Green's centre, the same spot every cluster's gate stands). */
export const GLADE_GATE = GATE
