// BUYING AT THE GUN SHOP (RULED 11-15, world/rune-hold.md › The gun shop; play / Jin). Pure, like smokehouse.ts: the five
// base guns are sold at a counter for Marks. Kael's Charred Rifle is NOT sold (it comes only from Kael's chest). No name,
// no keeper: the UI says "The gun shop". Prices are build numbers (a keeper starts with 1500 Marks; the cheapest deed is 35000).
import { RANGE_GUNS, type RangeGun } from '../shared/gunplay'
import { give, type Inv } from '../shared/inventory'
import { equip, slotOfGun, type Loadout } from '../shared/loadout'
import type { Ledger } from '../trade'
import { addOwnedSight, ownedSights, isKitGun } from '../shared/gun-fit'
import type { KitGunId, KitSightId } from '../shared/gun-kit'

export const GUN_PRICES: Record<string, number> = { repeater: 400, spitter: 900, backbone: 1800, roar: 3200, lance: 4500 }
/** the guns on the racks, in price order */
export const SHOP_GUNS: RangeGun[] = RANGE_GUNS.filter(g => g.id in GUN_PRICES).sort((a, b) => GUN_PRICES[a.id] - GUN_PRICES[b.id])

export interface GunBuy { ok: boolean; why?: string; loadout: Loadout; ledger: Ledger }
export function buyGun(loadout: Loadout, ledger: Ledger, gunId: string): GunBuy {
  const g = SHOP_GUNS.find(x => x.id === gunId), price = GUN_PRICES[gunId]
  if (!g || price === undefined) return { ok: false, why: 'Not sold here.', loadout, ledger }
  if (loadout.guns.includes(gunId)) return { ok: false, why: 'Already yours.', loadout, ledger }
  if (ledger.marks < price) return { ok: false, why: `It costs ${price.toLocaleString()} Marks. You have ${ledger.marks.toLocaleString()}.`, loadout, ledger }
  let next: Loadout = { ...loadout, guns: [...loadout.guns, gunId] }
  const slot = slotOfGun(g)
  if (next[slot] === null) next = equip(next, slot, gunId)
  return { ok: true, loadout: next, ledger: { ...ledger, marks: ledger.marks - price } }
}

/** M93 s2: a blank sigil sold at the counter (canon: bought unattuned at a gun shop). Marks; Jin's dial. */
export const SIGIL_PRICE = 250
export const SIGIL_ITEM = 'sigil_blank'
export interface SigilBuy { ok: boolean; why?: string; ledger: Ledger; inv: Inv }
export function buySigil(ledger: Ledger, inv: Inv): SigilBuy {
  if (ledger.marks < SIGIL_PRICE) return { ok: false, why: `It costs ${SIGIL_PRICE.toLocaleString()} Marks. You have ${ledger.marks.toLocaleString()}.`, ledger, inv }
  const g = give(inv, SIGIL_ITEM, 1)
  if (g.left > 0) return { ok: false, why: 'No room in the bag.', ledger, inv }
  return { ok: true, ledger: { ...ledger, marks: ledger.marks - SIGIL_PRICE }, inv: g.inv }
}

// ── SIGHTS (BETA M81 s3a, Alex 11-22: "gunshops that sell different sights per weapon... the gunshops are where they upgrade them";
// "4-5 gun shops, each stocks a new sight for a gun or two + a slightly different gun list"). FIVE larger places are the sight
// dealers; every other gun shop sells the five guns and no sights. A sight is bought FOR a gun (it seats on that gun's rail) and
// joins that gun's owned set (shared/gun-fit.ts); the Character tab fits it. Only railed guns take sights (gun-kit: Backbone,
// Charred Rifle). Stock + prices are Jin's dials.

export const SIGHT_PRICES: Record<string, number> = { lens: 300, hood: 450, ring: 450 }
export interface SightStock { gun: KitGunId; sight: KitSightId }
export interface ShopStock { guns: string[]; sights: SightStock[] }
const ALL = Object.keys(GUN_PRICES)
export const GUNSHOP_STOCK: Record<string, ShopStock> = {
  'rune-hold':  { guns: ALL, sights: [{ gun: 'backbone', sight: 'lens' }] },
  ashfeld:      { guns: ['repeater', 'spitter', 'backbone', 'roar'], sights: [{ gun: 'charred-rifle', sight: 'lens' }] },
  citadel:      { guns: ALL, sights: [{ gun: 'backbone', sight: 'ring' }, { gun: 'charred-rifle', sight: 'hood' }] },
  veradyn:      { guns: ['repeater', 'spitter', 'backbone', 'lance'], sights: [{ gun: 'backbone', sight: 'lens' }, { gun: 'charred-rifle', sight: 'lens' }] },
  'gale-haven': { guns: ['repeater', 'backbone', 'roar', 'lance'], sights: [{ gun: 'backbone', sight: 'ring' }] },
}
export const DEFAULT_STOCK: ShopStock = { guns: ALL, sights: [] }
export const stockOf = (town: string): ShopStock => GUNSHOP_STOCK[town] ?? DEFAULT_STOCK
/** the racks of this town's gun shop, in price order */
export const shopGunsOf = (town: string): RangeGun[] => SHOP_GUNS.filter(g => stockOf(town).guns.includes(g.id))

export interface SightBuy { ok: boolean; why?: string; loadout: Loadout; ledger: Ledger }
export function buySight(loadout: Loadout, ledger: Ledger, town: string, gunId: string, sightId: string): SightBuy {
  const no = (why: string): SightBuy => ({ ok: false, why, loadout, ledger })
  const st = stockOf(town).sights.find(x => x.gun === gunId && x.sight === sightId), price = SIGHT_PRICES[sightId]
  if (!st || price === undefined || !isKitGun(gunId)) return no('Not sold here.')
  if (!loadout.guns.includes(gunId)) return no('It fits a gun you do not have.')
  if (ownedSights(loadout, gunId).includes(st.sight)) return no('Already yours.')
  if (ledger.marks < price) return no(`It costs ${price.toLocaleString()} Marks. You have ${ledger.marks.toLocaleString()}.`)
  return { ok: true, loadout: addOwnedSight(loadout, st.gun, st.sight), ledger: { ...ledger, marks: ledger.marks - price } }
}
