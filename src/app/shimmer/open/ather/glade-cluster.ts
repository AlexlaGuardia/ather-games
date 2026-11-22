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
//   · s1b-2 (hub 11-22): Greg's garden carries the Glade backdrop: the Moonwell layout (pond, green, the five's lots, his home
//     + jetty; moonwell.ts GLADE_ANCHOR) stands in a 6 x 4 block of his ground, and the Glade is gone from the Wilds. Greg
//     is the real one on his bench (moonwell-glade gregSpot, glade-greg.tsx), Fennel stands at her lot (gladeSpots); the
//     other four Moglins keep their friends' gardens (hub 11-22 'A': their lots are Greg's backdrop, they live next door).
//   · talk: the five and Greg talk here exactly as they did in the Wilds (page.tsx picks them in the glade zone).
// Pure; glade-cluster.test.ts.
import { clusterFrame, clusterGround, mateAt, inMiddle, onPath, onMeadow, type Frame, type Quarter } from './cluster'
import { gladeGround, pondDepthIn } from './relief'
import { STARTING_SQUARES, GATE, plotHeightAt, sqId } from './plot'
import { toWorld } from './meadow'
import { GLADE_ID, gregSpot, newbornSpot } from './moonwell-glade'

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
/** Greg's ground in the Glade: the start corner plus the block the Moonwell layout stands on (squares i 0..5, j 11..14 =
 *  x -150..-30, z 70..150; the layout spans x -146..-47, z 80..140 with its fade). The friends' gardens hold the corner only. */
export const GLADE_GREG_BLOCK = { i0: 0, i1: 5, j0: 11, j1: 14 }
export const GLADE_OWNED: ReadonlySet<string> = new Set([...STARTING_SQUARES, ...(() => {
  const out: string[] = []; const b = GLADE_GREG_BLOCK
  for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) out.push(sqId(i, j))
  return out
})()])
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

/** The three friends (Otto, Tess, Bonn), each in their own start ground facing their corner. Greg is drawn by glade-greg.tsx
 *  on his bench (s1b-2), so he is not in this list. */
export function gladeKeepers(): Placed[] {
  return GLADE_GARDENS.filter(g => g.id !== 'greg').map(g => ({ id: g.id, name: g.keeper, ...place(g.id, KEEPER_LOCAL.x, KEEPER_LOCAL.z, KEEPER_YAW_LOCAL) }))
}
/** The Moglins who live in the FRIENDS' gardens, by their settlement ids (`moonwell:<name>`, so fur and names match the Glade's
 *  own folk). Fennel (Greg's) stands at her lot in his garden instead (folk-spots.ts asks gladeSpots for her). */
export function gladeClusterFolk(): Placed[] {
  return GLADE_GARDENS.filter(g => g.id !== 'greg').flatMap(g => g.folk.map((f, k) => {
    const side = g.folk.length === 1 ? FOLK_SIDE : (k === 0 ? FOLK_SIDE : -FOLK_SIDE)
    const p = keeperRel(-FOLK_BACK, side)
    return { id: `${GLADE_ID}:${f}`, name: f[0].toUpperCase() + f.slice(1), ...place(g.id, p.x, p.z, KEEPER_YAW_LOCAL) }
  }))
}
/** a Glade Moglin's spot when they live in a friend's garden, or null (Fennel: her lot, gladeSpots) */
export function gladeClusterSpot(id: string): Placed | null { return gladeClusterFolk().find(f => f.id === id) ?? null }
/** Greg, the real one on his bench in his garden (s1b-2; was the s1a stand-in in the start ground) */
export const gregInGlade = (): Placed => ({ id: 'greg', name: 'Gregory', ...gregSpot() })

/** How far in front of Greg a newborn opens their eyes (moonwell-glade NEWBORN_GAP's value). */
export const GLADE_NEWBORN_GAP = 5
/** Where a newborn opens their eyes: in Greg's garden, GLADE_NEWBORN_GAP m in front of his bench (green side), turned to FACE
 *  him (moonwell-glade newbornSpot, now in the Glade's coords). yaw is the WALKER's: forward = (-sin yaw, -cos yaw). */
export const gladeNewbornSpot = (): { x: number; z: number; yaw: number } => newbornSpot()

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

/** The Glade zone's ground: Greg's island + the cluster's (as s1a), with the Moonwell's bowl sunk under its water plane inside
 *  the pond (s1b-2: the island mesh is flat and baked, so the bowl is the walker's ground only; the water hides it). */
export function gladeZoneGround(x: number, z: number): number {
  const g = Math.max(plotHeightAt(x, z), clusterGround(GLADE_FRAME, x, z))
  return Number.isFinite(g) && pondDepthIn(x, z) > 0 ? gladeGround(x, z, g) : g
}
