// ── M49: THE SHIPYARDS A KEEPER CAN HOLD (s3 2026-11-21 world, hub #15751; s4 the plots, hub #15797). PURE (no three/react/storage).
// Canon (game/ather-rework-2026-11.md §2, AMENDED 11-20): Kael's shipyard above Rune Hold is the inherited base; beyond it a
// keeper BUYS shipyards "in different places, each its own place at its own price" (shipyards, not homes). Lots and prices
// are Jin's. s4 (docs/M49-shipyards.md): a shipyard is its own ~100 x 100 m PLOT on its own ground by a road (Veradyn: an isle
// by the water), built per its tier: business/shipyard-plots.ts holds WHERE (SHIPYARD_PLOTS) and WHAT (SHIPYARD_TIERS).
// Every plot is a deed (deed-grid.ts kind 'plot'), saved per shipyard. Ownership lives on the keeper's ledger
// (trade.ts › Ledger.shipyards: the keys bought); Kael's is always the keeper's. Names stay placeholders until lark/Magii.
import type { Region } from '../region'
import type { Ledger } from '../trade'
import { SHIPYARD_PLOTS, SHIPYARD_TIERS, plotLayout, plotToLocal, PLOT, type PlotLayout } from './shipyard-plots'

export const KAEL_SHIPYARD = 'front:shipyard'
/** the towns where a keeper can BUY a shipyard (s3; their plots: shipyard-plots.ts) */
export const BOUGHT_SHIPYARD_TOWNS = ['gale-haven', 'veradyn', 'citadel'] as const
export type BoughtShipyardTown = typeof BOUGHT_SHIPYARD_TOWNS[number]
export const shipyardKey = (town: BoughtShipyardTown) => `front:shipyard:${town}`
/** what each bought shipyard costs (Marks): its tier's price (the ladder's 250k floor, dearer toward the capital) */
export const SHIPYARD_PRICE = Object.fromEntries(BOUGHT_SHIPYARD_TOWNS.map(t => [t, SHIPYARD_TIERS[shipyardKey(t)].price])) as Record<BoughtShipyardTown, number>

export interface ShipyardSite {
  /** front:shipyard (Kael's) or front:shipyard:<town> */ key: string
  town: string
  /** the built plot: frame, floor, ramp, pieces (shipyard-plots.ts) */ plot: PlotLayout
  /** Kael's: never bought, never sold */ inherited: boolean
  /** 0 for Kael's */ price: number
}

const siteCache = new WeakMap<Region, ShipyardSite[]>()
/** every shipyard plot, Kael's first */
export function shipyardSites(R: Region): ShipyardSite[] {
  const hit = siteCache.get(R); if (hit) return hit
  const out = SHIPYARD_PLOTS.map(s => ({ key: s.key, town: s.town, plot: plotLayout(R, s), inherited: s.key === KAEL_SHIPYARD, price: SHIPYARD_TIERS[s.key].price }))
  siteCache.set(R, out)
  return out
}

/** does the keeper hold shipyard `key`? Kael's always; a bought one when the ledger lists it; `all` = the owner's dev flag */
export function ownsShipyard(owned: readonly string[] | undefined, key: string, all = false): boolean {
  return key === KAEL_SHIPYARD || all || !!owned?.includes(key)
}

const idOf = (key: string) => (key === KAEL_SHIPYARD ? 'kael' : key.slice(KAEL_SHIPYARD.length + 1))
/** where a shipyard plot's deed is saved (a garden key base, family 'open.deed.plot:') */
export const plotStoreBase = (key: string) => `open.deed.plot:${idOf(key)}`
/** where the s1-s3 small yard (12 x 8 beside a town building, retired in s4) was saved: its pieces go back to the bag */
export const oldYardStoreBase = (key: string) => (key === KAEL_SHIPYARD ? 'open.deed.shipyard.v1' : `open.deed.shipyard:${idOf(key)}`)

export type BuyRefusal = 'owned' | 'marks' | 'unknown'
/** buying shipyard `key` (s7): the new ledger, or why not. Kael's is inherited and cannot be bought. */
export function buyShipyard(l: Ledger, key: string): { ok: true; ledger: Ledger } | { ok: false; why: BuyRefusal } {
  const town = BOUGHT_SHIPYARD_TOWNS.find(t => shipyardKey(t) === key)
  if (!town) return { ok: false, why: 'unknown' }
  if (ownsShipyard(l.shipyards, key)) return { ok: false, why: 'owned' }
  const price = SHIPYARD_PRICE[town]
  if (l.marks < price) return { ok: false, why: 'marks' }
  return { ok: true, ledger: { ...l, marks: l.marks - price, shipyards: [...(l.shipyards ?? []), key] } }
}

/** is (x, z) on a shipyard plot (or within `margin` metres of its fence)? For scatter that must keep off them (trees) */
export function inShipyardPlot(R: Region, x: number, z: number, margin = 0): boolean {
  return shipyardSites(R).some(s => { if (Math.abs(x - s.plot.frame.x) > 80 || Math.abs(z - s.plot.frame.z) > 80) return false; const l = plotToLocal(s.plot.frame, x, z); return Math.abs(l.lx) < PLOT / 2 + margin && Math.abs(l.lz) < PLOT / 2 + margin })
}
