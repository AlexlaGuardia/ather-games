// OWNER-ONLY test grants (Alex 11-22 via hub: "put one of each mana seed in my players pack so i can look at the icons").
// Reached only from the Options › Dev tab, which renders for the owner alone (/api/owner, ather_owner cookie). Mana Seeds stay
// an event for everyone else. ★ PURE: the caller reads and writes the bag.
import { give, countOf, type Inv } from './inventory'
import { SEED_IDS } from '../ather/seed-items'

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
