// ── GENERATED SETTLEMENTS, BUILT (BETA M39 slice 3; Alex 11-20, canon amended athernyx 25f5437: in the game's day free Moglins
// build ABOVE GROUND in the keepers' styles: plank walls, roofs, doors, windows, on level pads). One LOT per trade present
// among a generated settlement's season folk (max 5): a free-standing plank house on its own pad on a ring OUTSIDE the folk's
// green, turned to face the settlement's centre, all inside the settlement's flat disc (network.ts SETTLEMENT_CLEAR) so no
// relief changes. The trade's Moglin stands 1.2 m out from its building's front door (glade-lots.ts doorSpot, as the Glade's).
// Guards that hold: NO metal fittings on any settlement blueprint, warm wood never grey, never the hold silhouette (a house on
// its own pad, never folded/pinned/stacked into a mound). The Glade (its own lots) and authored dug places are not here.
// A lot stands blueprint `trade-<profession>` (world/house-blueprints, drawn on the worktable by Alex, read at runtime); with
// no file yet it stands BLOCKOUT, a plain plank house built from the same parts. PURE apart from the small registry below.
import type { Settlement } from './network'
import { SETTLEMENT_CLEAR } from './network'
import { GLADE_ID } from './moonwell-glade'
import { folkOf, type Folk } from './settlement-folk'
import { PROFESSIONS, type Profession } from './moglins'
import { h01, folkSpots, type Spot } from './folk-spots'
import { doorSpot } from './glade-lots'
import { placeBlueprint, type HouseBlueprint } from './plot-blueprint'
import { runKeys, type Walls } from './plot-walls'
import type { Box } from '../terrain-world'

export const MAX_LOTS = 5
/** the pad, as the Glade's lots (the worktable draws 13 x 8 inside it) */
export const LOT_W = 13.5, LOT_D = 8.5
/** pad centre's distance from the settlement centre: pads span 16.75..25.3 m out along the radius, 26.1 m at the far corners, all inside SETTLEMENT_CLEAR (32) */
export const LOT_RING = 21
/** the trades that have a blueprint slot (shopkeeper is Moonwell's Mallow only) */
export const TRADES: readonly Profession[] = PROFESSIONS
export const tradeBlueprintId = (p: Profession) => `trade-${p}`
export const isTradeBlueprintId = (id: string) => TRADES.some(p => tradeBlueprintId(p) === id)

export interface SettlementLot {
  id: string; settlement: string; profession: Profession
  /** the Moglin that stands at the door: the first of that trade in the season's folk */
  folkId: string
  x: number; z: number; yaw: number; w: number; d: number
}
const ORDER = TRADES as readonly string[]
/** The lots of a GENERATED settlement this season: one per trade present among its folk (max 5), five fixed slots round the
 *  ring (72 degrees apart, the first at a hashed angle), each turned to face the centre (the building's front = local z 0). */
export function settlementLots(s: Settlement, season: number, folk: Folk[] = folkOf(s, season)): SettlementLot[] {
  if (s.id === GLADE_ID) return []
  const firstOf = new Map<Profession, Folk>()
  for (const f of folk) if (ORDER.includes(f.profession) && !firstOf.has(f.profession)) firstOf.set(f.profession, f)
  const trades = [...firstOf.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).slice(0, MAX_LOTS)
  const base = h01(`${season}:${s.id}`, 77) * Math.PI * 2
  return trades.map((p, k) => {
    const a = base + (k * Math.PI * 2) / MAX_LOTS, x = s.x + Math.sin(a) * LOT_RING, z = s.z + Math.cos(a) * LOT_RING
    // forward = (-sin yaw, -cos yaw) points at the centre: (s - lot) / |.| = (-sin a, -cos a)  =>  yaw = a
    return { id: `${s.id}:${p}`, settlement: s.id, profession: p, folkId: firstOf.get(p)!.id, x, z, yaw: a, w: LOT_W, d: LOT_D }
  })
}

// ── the blockout: a plain goldwood house with a door on the front, a window each side, a gable roof ───────────────────
function blockout(p: Profession): HouseBlueprint {
  const w = 8, d = 6, walls: Record<string, Walls[string]> = {}
  const mat = 'goldwood' as const
  for (const k of [...runKeys({ i: 0, j: 0 }, { i: w, j: 0 }), ...runKeys({ i: 0, j: d }, { i: w, j: d }), ...runKeys({ i: 0, j: 0 }, { i: 0, j: d }), ...runKeys({ i: w, j: 0 }, { i: w, j: d })]) walls[k] = { mat }
  walls['h,3,0'] = { mat, kind: 'door' }; walls['h,4,0'] = { mat, kind: 'door' }
  walls['v,0,3'] = { mat, kind: 'window' }; walls[`v,${w},3`] = { mat, kind: 'window' }
  return { v: 1, id: tradeBlueprintId(p), name: `${p} blockout`, w, d, walls, floors: {}, roof: 'gable', saved: 0 }
}
const blockouts = new Map<Profession, HouseBlueprint>()
const blockoutOf = (p: Profession) => { let b = blockouts.get(p); if (!b) { b = blockout(p); blockouts.set(p, b) } return b }

// ── the registry: blueprints fetched at runtime (trade-<profession>); none = the blockout ─────────────────────────────
const blueprints = new Map<Profession, HouseBlueprint>()
let bpVersion = 0
export const settlementBlueprintVersion = () => bpVersion
export const hasTradeBlueprint = (p: Profession) => blueprints.has(p)
/** a trade's building: its drawn blueprint if one fit the pad, else the blockout */
export const tradeBuilding = (p: Profession): HouseBlueprint => blueprints.get(p) ?? blockoutOf(p)
export function setTradeBlueprint(p: Profession, bp: HouseBlueprint | null) {
  if (bp && (bp.w > LOT_W || bp.d > LOT_D)) bp = null   // oversize: refused, the blockout stays
  if (bp) blueprints.set(p, bp); else blueprints.delete(p)
  bpVersion++
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('settlement-blueprints'))   // the folk re-place
}
/** the lot's pad as placeBlueprint wants it */
export const lotPadOf = (l: SettlementLot, y: number) => ({ x: l.x, z: l.z, yaw: l.yaw, y })
/** where the lot's Moglin stands (x/z): 1.2 m out from the building's front door */
export const lotDoorSpot = (l: SettlementLot) => doorSpot(tradeBuilding(l.profession), lotPadOf(l, 0))
/** the folk that stand at a door instead of in the green: folk id -> spot (yaw: looking out toward the centre) */
export function lotFolkSpots(lots: readonly SettlementLot[], s: Settlement): Map<string, { x: number; z: number; yaw: number }> {
  const out = new Map<string, { x: number; z: number; yaw: number }>()
  for (const l of lots) { const p = lotDoorSpot(l); out.set(l.folkId, { ...p, yaw: Math.atan2(s.x - p.x, s.z - p.z) }) }
  return out
}

// ── the walker's boxes: the view registers each mounted settlement's lots (ground y known there) ────────────────────────
const standing = new Map<string, Box[]>()
export function setSettlementBoxes(id: string, boxes: Box[] | null) { if (boxes) standing.set(id, boxes); else standing.delete(id) }
export function settlementSolids(x0: number, z0: number, x1: number, z1: number): Box[] {
  const out: Box[] = []
  for (const list of standing.values()) for (const b of list) if (b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0) out.push(b)
  return out
}
export const lotBoxes = (l: SettlementLot, y: number): Box[] => placeBlueprint(tradeBuilding(l.profession), lotPadOf(l, y)).boxes
export { SETTLEMENT_CLEAR }
/** a generated settlement's folk spots: the green's fan, except each lot's Moglin, who stands at its building's door */
export function builtFolkSpots(s: Settlement, folk: readonly Folk[], season: number): Spot[] {
  const at = lotFolkSpots(settlementLots(s, season, folk as Folk[]), s)
  return folkSpots(s, folk.map(f => f.id)).map(p => { const o = at.get(p.id); return o ? { id: p.id, ...o } : p })
}
