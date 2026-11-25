// Live terrain pieces (terrain casts) as solids for the keeper's walker. PURE: no three, no react.
// The CombatLayer points `live.combat` at its Combat; `withPieces(shape)` wraps the world's Shape so its
// `solids()` query also returns one box per raised cell. terrainWorld then blocks (bodyFree), stands on
// (floorAt) and vaults/climbs them like any rock. Nothing is rebuilt per cast: the query reads c.pieces live.
import type { Combat } from './combat'
import type { Shape, Box } from '../terrain-world'
import { gladeHomeBoxes } from './glade-home'
import { crateBoxes, gladeLotBoxes, standOn, jettyBoxes, gladeBlueprintVersion } from './glade-lots'
import { GLADE, WATER_DROP } from './relief'
import { gladePeopleVersion } from './glade-people'
import { settlementSolids } from './settlement-lots'
// M40: the Glade's station blockouts + Greg's jetty, built once (the Glade's floor is one level, GLADE.y)
// M153 s1c-2: a house moved in Place mode stands on the land under it, anywhere in the Glade: rebuilt when one moves or the land changes
let gladeParts: Box[] | null = null, gladeVer = '', gladeOn: Shape['ground'] | null = null, around = { x0: 0, x1: 0, z0: 0, z1: 0 }
const gladeSolids = (ground: Shape['ground'], x0: number, z0: number, x1: number, z1: number) => {
  const v = `${gladeBlueprintVersion()}.${gladePeopleVersion()}`
  if (!gladeParts || gladeVer !== v || gladeOn !== ground) {   // a blueprint landing rebuilds them
    const lots = gladeLotBoxes(GLADE.y, ground)
    gladeParts = [...lots, ...crateBoxes(standOn(ground), GLADE.y), ...jettyBoxes(GLADE.y - WATER_DROP)]; gladeVer = v; gladeOn = ground
    around = gladeParts.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) }), { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity })
  }
  if (x1 < around.x0 || x0 > around.x1 || z1 < around.z0 || z0 > around.z1) return []
  return gladeParts.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0)
}

export const live: { combat: Combat | null } = { combat: null }

/** A piece cell is the engine's rounded 1 m grid cell: [cx-.5, cx+.5) in x and z, base..base+rise in y. */
export function pieceBoxes(c: Combat | null, x0: number, z0: number, x1: number, z1: number): Box[] {
  const out: Box[] = []
  if (!c?.pieces?.length) return out
  for (const p of c.pieces) for (const q of p.cells) {
    if (q.x + 0.5 < x0 || q.x - 0.5 > x1 || q.z + 0.5 < z0 || q.z - 0.5 > z1) continue
    out.push({ x0: q.x - 0.5, y0: q.base, z0: q.z - 0.5, x1: q.x + 0.5, y1: q.base + q.rise, z1: q.z + 0.5 })
  }
  return out
}

/** `glade`: the closed Glade's solids (Greg's home, the lots' stations, the jetty) instead of the Wilds' settlements. M67 s1b-2:
 *  the Glade's coords are the Glade ZONE's, so they must never be asked in the Wilds (they would stand in a field there). */
export function withPieces(shape: Shape, get: () => Combat | null = () => live.combat, glade = false): Shape {
  return {
    ground: shape.ground, water: shape.water,
    solids(x0, y0, z0, x1, y1, z1) {
      const base = shape.solids(x0, y0, z0, x1, y1, z1), extra = [...pieceBoxes(get(), x0, z0, x1, z1), ...(glade ? [...gladeHomeBoxes(shape.ground, x0, z0, x1, z1), ...gladeSolids(shape.ground, x0, z0, x1, z1)] : settlementSolids(x0, z0, x1, z1))]
      return extra.length ? [...base, ...extra] : base
    },
  }
}
