// ★ PURE. Every door cell in Rune Hold that a building should be levelled to: the storefront faces and the
// town's painted gates. Split from `rune-hold-terraces.ts` so the terraces stay free of the zone table.
import { FRONTS, HOMES } from './rune-hold-look'
import { LANDING } from '../world/landing'

export function runeHoldDoors(): { x: number; z: number }[] {
  return [
    ...FRONTS.map(f => ({ x: Math.floor(f.x - f.face[0] * 0.5), z: Math.floor(f.z - f.face[1] * 0.5) })),
    ...HOMES.map(h => ({ x: Math.floor(h.x), z: Math.floor(h.z - h.face[1] * 0.5) })),
    { x: LANDING.x, z: LANDING.y },
  ]
}
