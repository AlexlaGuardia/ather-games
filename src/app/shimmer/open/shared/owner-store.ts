// ── A MODULE-LEVEL STORE THAT KNOWS WHOSE SAVE IT HOLDS (11-22 playtest: Forestry L6 -> L1 on his live save) ─────────────
// forestry.ts, prospecting.ts and companion.ts read their keeper/garden key ONCE, at MODULE EVALUATION. The 11-18 gate
// (owner-ready.tsx) only holds MOUNTING: the page chunk evaluates first, before SaveOwnerBoot knows the account, so
// keeperKey()/gardenKey() answered the ANONYMOUS slot (empty = level 1). The first XP grant then wrote that level 1 over
// the account's real level 6, and the cloud save carried it to every device.
// ★ The rule this file enforces, in two halves:
//   READ only once the owner is resolved, and again whenever the key it read from may now hold someone else's bytes
//     (the owner changed: SAVE_OWNER_EVENT; the active keeper changed: KEEPER_SWAP_EVENT).
//   WRITE only to the key the value was READ from, and only while that is still the current key. A value that was never
//     read from this owner's slot has no business in it.
import { saveOwnerResolved, SAVE_OWNER_EVENT } from '@/lib/save-slot'
import { KEEPER_SWAP_EVENT } from '@/lib/keeper-roster'

// The slot only GATES: the store still spells its own localStorage call with keeperKey()/gardenKey() inline, so the
// keeper-local test's static scan can see every key is scoped (a key handed back from here would read as unclassified).
export interface OwnerSlot {
  /** Call before every read of the store. True = (re)load now from keyOf(): the owner is known and the store has not
   *  read this slot yet (first use, or the owner / active keeper changed since). */
  due(): boolean
  /** True = a write to keyOf() may go: the owner is known and the value in memory was read from that very slot. */
  writable(): boolean
}

/** `keyOf` names the slot (keeperKey(BASE) / gardenKey(BASE)); `onReset` drops the in-memory value back to fresh and
 *  tells the store's subscribers, so the next read reloads from the right slot. */
export function ownerSlot(keyOf: () => string, onReset: () => void): OwnerSlot {
  let from: string | null = null
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const reset = () => { from = null; onReset() }
    window.addEventListener(SAVE_OWNER_EVENT, reset)
    window.addEventListener(KEEPER_SWAP_EVENT, reset)
  }
  const live = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined' && saveOwnerResolved()
  return {
    due() { if (!live()) return false; const k = keyOf(); if (k === from) return false; from = k; return true },
    writable() { return live() && keyOf() === from },
  }
}
