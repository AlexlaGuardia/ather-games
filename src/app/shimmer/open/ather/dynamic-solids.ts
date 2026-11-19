// Live terrain pieces (terrain casts) as solids for the keeper's walker. PURE: no three, no react.
// The CombatLayer points `live.combat` at its Combat; `withPieces(shape)` wraps the world's Shape so its
// `solids()` query also returns one box per raised cell. terrainWorld then blocks (bodyFree), stands on
// (floorAt) and vaults/climbs them like any rock. Nothing is rebuilt per cast: the query reads c.pieces live.
import type { Combat } from './combat'
import type { Shape, Box } from '../terrain-world'
import { gladeHomeBoxes } from './glade-home'
import { stationBoxes, jettyBoxes } from './glade-lots'
import { GLADE, WATER_DROP } from './relief'
// M40: the Glade's station blockouts + Greg's jetty, built once (the Glade's floor is one level, GLADE.y)
let gladeParts: Box[] | null = null
const gladeSolids = (x0: number, z0: number, x1: number, z1: number) => {
  gladeParts ??= [...stationBoxes(GLADE.y), ...jettyBoxes(GLADE.y - WATER_DROP)]
  if (x1 < GLADE.pondX - 40 || x0 > GLADE.gx + 45 || z1 < GLADE.gz - 45 || z0 > GLADE.gz + 45) return []
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

export function withPieces(shape: Shape, get: () => Combat | null = () => live.combat): Shape {
  return {
    ground: shape.ground, water: shape.water,
    solids(x0, y0, z0, x1, y1, z1) {
      const base = shape.solids(x0, y0, z0, x1, y1, z1), extra = [...pieceBoxes(get(), x0, z0, x1, z1), ...gladeHomeBoxes(shape.ground, x0, z0, x1, z1), ...gladeSolids(x0, z0, x1, z1)]
      return extra.length ? [...base, ...extra] : base
    },
  }
}
