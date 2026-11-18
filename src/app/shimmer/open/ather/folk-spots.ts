// WHERE A SETTLEMENT'S MOGLINS STAND (BETA M19, Alex 11-18). Pure. Each of a settlement's folk (settlement-folk.ts folkOf) gets a
// spot on the green before the burrows, around the well, hashed from the settlement + the Moglin's id, so every device puts the
// same Moglin in the same place. The layout follows network-scene.tsx's SettlementModel: the knoll and its doors behind (local
// -z), the well at local (0, 5), the whole group turned by `settlementTurn`. Spots are x/z only: the draw asks the ground's
// height there every time (M18 reshapes ground near paths), never a cached y. All inside the settlement's flat disc.
import type { Settlement } from './network'

/** the same hash network-scene.tsx uses for a settlement's doors and turn */
export const h01 = (s: string, k: number) => { let h = 2166136261 ^ k; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000 }
export const settlementTurn = (s: Settlement) => h01(s.id, 2) * Math.PI * 2
export const MIN_GAP = 1.6

export interface Spot { id: string; x: number; z: number; yaw: number }
/** one spot per Moglin, in the green: radius 3.5-8 m round a point just behind the well, spread across the half facing out */
export function folkSpots(s: Settlement, ids: readonly string[]): Spot[] {
  const turn = settlementTurn(s), c = Math.cos(turn), sn = Math.sin(turn)
  const out: Spot[] = []
  ids.forEach((id, k) => {
    let lx = 0, lz = 0
    for (let tryN = 0; tryN < 12; tryN++) {
      const a = -1.25 + ((k + 0.5) / Math.max(1, ids.length)) * 2.5 + (h01(id, 11 + tryN) - 0.5) * 0.5   // a fan across the green
      const r = 3.5 + h01(id, 31 + tryN) * 4.5
      lx = Math.sin(a) * r; lz = 3 + Math.cos(a) * r * 0.75
      if (Math.hypot(lx, lz - 5) < 2) continue   // not in the well
      if (out.every(o => Math.hypot(o.x - (s.x + lx * c + lz * sn), o.z - (s.z - lx * sn + lz * c)) >= MIN_GAP)) break
    }
    // local (lx, lz) -> world: the group's rotation-y = turn (x' = x cos + z sin, z' = -x sin + z cos)
    const x = s.x + lx * c + lz * sn, z = s.z - lx * sn + lz * c
    out.push({ id, x, z, yaw: turn + Math.atan2(lx, lz) + (h01(id, 51) - 0.5) * 0.8 })   // roughly facing out from the knoll
  })
  return out
}
/** the spot nearest a point (the keeper), among the given ids */
export const nearestSpot = (spots: readonly Spot[], x: number, z: number) =>
  spots.reduce<Spot | null>((b, s) => (!b || Math.hypot(s.x - x, s.z - z) < Math.hypot(b.x - x, b.z - z) ? s : b), null)
