// ── M49 slice 3: THE SHIPYARDS A KEEPER CAN HOLD (2026-11-21, world; hub #15751). PURE (no three, no react, no storage). ────
// Canon (game/ather-rework-2026-11.md §2, AMENDED 11-20): Kael's shipyard above Rune Hold is the inherited base; beyond it a
// keeper BUYS shipyards "in different places, each its own place at its own price" (shipyards, not homes). Lots and prices
// are Jin's: one buyable shipyard in each of the three cities, on the town's outskirts (doors.ts › BOUGHT_SHIPYARD_TOWNS),
// priced off the ladder (economy/prices.ts › LADDER.shipyard, "250k and up"), the Citadel dearest. Every shipyard comes with
// its own yard deed (deed-yard-site.ts), saved per shipyard. Door names stay a placeholder ("The shipyard") until lark/Magii.
// Ownership lives on the keeper's ledger (trade.ts › Ledger.shipyards: the keys bought); Kael's is always the keeper's.
import type { Region } from '../region'
import type { Building } from '../towns/plan'
import { LADDER } from '../economy/prices'
import type { Ledger } from '../trade'
import { doorByKey, BOUGHT_SHIPYARD_TOWNS, type BoughtShipyardTown } from './doors'
import { yardBeside, type Yard } from './deed-yard-site'

export const KAEL_SHIPYARD = 'front:shipyard'
export const shipyardKey = (town: BoughtShipyardTown) => `front:shipyard:${town}`
/** what each bought shipyard costs (Marks): the ladder's floor, then dearer toward the capital */
export const SHIPYARD_PRICE: Record<BoughtShipyardTown, number> = {
  'gale-haven': LADDER.shipyard.from,
  veradyn: LADDER.shipyard.from + 50_000,
  citadel: LADDER.shipyard.from + 150_000,
}

export interface ShipyardSite {
  /** the door key (doors.ts): front:shipyard (Kael's) or front:shipyard:<town> */ key: string
  town: string
  b: Building
  door: { x: number; y: number; z: number }
  yard: Yard
  /** Kael's: never bought, never sold */ inherited: boolean
  /** 0 for Kael's */ price: number
}

const siteCache = new WeakMap<Region, ShipyardSite[]>()
/** every shipyard on this map that has a door, Kael's first */
export function shipyardSites(R: Region): ShipyardSite[] {
  const hit = siteCache.get(R); if (hit) return hit
  const out: ShipyardSite[] = []
  const add = (key: string, town: string, price: number) => {
    const d = doorByKey(R, key), i = R.meta.places.findIndex(p => p.id === town)
    if (d && i >= 0) out.push({ key, town, b: d.b, door: d.at, yard: yardBeside(R, i, d.b, 'shipyard', d.at), inherited: key === KAEL_SHIPYARD, price })
  }
  add(KAEL_SHIPYARD, 'rune-hold', 0)
  for (const t of BOUGHT_SHIPYARD_TOWNS) add(shipyardKey(t), t, SHIPYARD_PRICE[t])
  siteCache.set(R, out)
  return out
}

/** THE keeper's inherited yard: Kael's, at Rune Hold. Null when this region has no shipyard. */
export function shipyardYard(R: Region): Yard | null {
  return shipyardSites(R).find(s => s.inherited)?.yard ?? null
}

/** does the keeper hold shipyard `key`? Kael's always; a bought one when the ledger lists it; `all` = the owner's dev flag */
export function ownsShipyard(owned: readonly string[] | undefined, key: string, all = false): boolean {
  return key === KAEL_SHIPYARD || all || !!owned?.includes(key)
}

/** where a shipyard's yard deed is saved (a garden key base). Kael's keeps its slice-1 key so nobody's yard moves. */
export const yardStoreBase = (key: string) => (key === KAEL_SHIPYARD ? 'open.deed.shipyard.v1' : `open.deed.shipyard:${key.slice(KAEL_SHIPYARD.length + 1)}`)

export type BuyRefusal = 'owned' | 'marks' | 'unknown'
/** buying shipyard `key` (s3b): the new ledger, or why not. Kael's is inherited and cannot be bought. */
export function buyShipyard(l: Ledger, key: string): { ok: true; ledger: Ledger } | { ok: false; why: BuyRefusal } {
  const town = BOUGHT_SHIPYARD_TOWNS.find(t => shipyardKey(t) === key)
  if (!town) return { ok: false, why: 'unknown' }
  if (ownsShipyard(l.shipyards, key)) return { ok: false, why: 'owned' }
  const price = SHIPYARD_PRICE[town]
  if (l.marks < price) return { ok: false, why: 'marks' }
  return { ok: true, ledger: { ...l, marks: l.marks - price, shipyards: [...(l.shipyards ?? []), key] } }
}
