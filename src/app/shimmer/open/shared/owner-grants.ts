// OWNER-ONLY test grants (Alex 11-22 via hub: "put one of each mana seed in my players pack so i can look at the icons").
// Reached only from the Options › Dev tab, which renders for the owner alone (/api/owner, ather_owner cookie). Mana Seeds stay
// an event for everyone else. ★ PURE: the caller reads and writes the bag.
import { give, countOf, type Inv } from './inventory'
import { SEED_IDS } from '../ather/seed-items'
import { RANGE_GUNS } from './gunplay'
import type { Loadout } from './loadout'

/** One of every Mana Seed the bag does not already hold (idempotent: a second press adds none). `missed` = no room. */
export function oneOfEachSeed(inv: Inv): { inv: Inv; added: number; missed: number } {
  let out = inv, added = 0, missed = 0
  for (const id of SEED_IDS) {
    if (countOf(out, id) > 0) continue
    const r = give(out, id, 1)
    if (r.left) { missed++; continue }
    out = r.inv; added++
  }
  return { inv: out, added, missed }
}

/** M140 (Alex 11-24): every range gun into the owned set; what was not there before is listed in `lent`. Equips nothing, touches
 *  no vessel, sight, sigil or Mark. Pressed again it adds only what is missing. */
export function lendAllGuns(l: Loadout): { loadout: Loadout; added: number } {
  const add = RANGE_GUNS.map(g => g.id).filter(id => !l.guns.includes(id))
  if (!add.length) return { loadout: l, added: 0 }
  return { loadout: { ...l, guns: [...l.guns, ...add], lent: [...new Set([...(l.lent ?? []), ...add])] }, added: add.length }
}
/** Takes back exactly the lent guns, out of the hand too; guns really owned stay, in their order. */
export function takeBackGuns(l: Loadout): { loadout: Loadout; taken: number } {
  const lent = new Set(l.lent ?? []); if (!lent.size) return { loadout: l, taken: 0 }
  const { lent: _drop, ...rest } = l, off = (id: string | null) => (id !== null && lent.has(id) ? null : id)
  const guns = l.guns.filter(g => !lent.has(g))
  return { loadout: { ...rest, guns, primary: off(l.primary), secondary: off(l.secondary) }, taken: l.guns.length - guns.length }
}
