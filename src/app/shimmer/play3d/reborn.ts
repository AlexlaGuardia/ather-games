/**
 * reborn.ts — a keeper born again of a different rune. THE DEV DOOR, OWNER-ONLY.
 *
 * ── WHY IT EXISTS (Alex, pinned 2026-09-02 at wrap) ─────────────────────────────────────────────
 * There is NO in-game way to change or add runes: birth is the only built acquisition (lane
 * training is ruled, unbuilt), and a doubled-focus tactical like Threshold is granted at BIRTH only.
 * Measured headless: a tempest-born keeper given `/rune barrier` still seats only Squall. So Alex
 * could not test Threshold on his tempest keeper at all. `/reborn barrier` is the one door.
 *
 * ── WHAT A REBIRTH IS ───────────────────────────────────────────────────────────────────────────
 * Three saves, in one call, so no host has to remember the set:
 *   1. the inventory becomes `[rune]` — birth set, developed runes gone (`rebornInventory`)
 *   2. the saved LOADOUT is removed, so `resolveLoadout` takes the starting-kit path
 *   3. the saved BOOK is removed, so `keeperBook` re-seeds from that kit + Gregory's gift
 *   4. the GEMS and VESSELS are removed (2026-09-03), so `keeperLetters` re-seeds for the new birth
 * Vitals and mana are the HOST's (`VoxelWorld.tsx`): they are refs derived from the birth affinity
 * at mount, so the host re-derives them on the same tick it bumps `runeTick`.
 *
 * ⚠ NOT CLEARED, DELIBERATELY: the tutorial, the seen-map, pots, saplings, mist. Those are the
 * WORLD's memory of this browser, and a dev rebirth to test a cast should not put the Glade gate
 * back in front of the tester. The epoch sweep (`ather-epoch.ts`) is the thing that resets those.
 *
 * ⚠ THIS IS A TEST HARNESS, NOT THE ACQUISITION SYSTEM — the same standing warning `/rune` carries.
 * Canon is silent on whether a DEVELOPED rune grants its doubled focus; the build says no. If that
 * ever matters it is a `CANON_GAPS` entry, not a change here.
 */
import { clearLoadout } from './loadout'
import { clearBook } from './book'
import { clearLetters } from './gems'
import { clearStowed } from './vessels'
import { clearTrials } from './vessel-drops'
import { rebornInventory, saveRuneInventory, type RuneInventory } from './rune-inventory'

/** Be born again of `runeId`. Writes all three saves; returns the new hand. */
export function rebirth(runeId: string): RuneInventory {
  clearLoadout()
  clearBook()
  clearLetters()   // the gems and both vessels: a different keeper writes with different letters
  clearStowed()    // and every other vessel they owned — the letters ride the paper
  clearTrials()    // and the trials they cleared — a different keeper has won nothing yet
  const inv = rebornInventory(runeId)
  saveRuneInventory(inv)
  return inv
}
