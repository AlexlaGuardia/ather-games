// BUYING AT THE GUN SHOP (RULED 11-15, world/rune-hold.md › The gun shop; play / Jin). Pure, like smokehouse.ts: the five
// base guns are sold at a counter for Marks. Kael's Charred Rifle is NOT sold (it comes only from Kael's chest). No name,
// no keeper: the UI says "The gun shop". Prices are build numbers (a keeper starts with 1500 Marks; the cheapest deed is 35000).
import { RANGE_GUNS, type RangeGun } from '../shared/gunplay'
import { equip, slotOfGun, type Loadout } from '../shared/loadout'
import type { Ledger } from '../trade'

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
