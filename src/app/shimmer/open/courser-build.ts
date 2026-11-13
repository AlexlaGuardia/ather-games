// A courser's BUILD: its stock spec sheet + the parts in its slots + the player's balance dial. Pure, so the garage,
// the game and the tests all compute the same car. (Alex 11-13: keep upgrades simple, a mix of buy / find / earn,
// and "let the player choose the balance of speed and handling… so they can tune it as well".)
//
// SLOTS follow canon's own anatomy of a manalic vehicle (world/transportation.md › Mana-Carriage): the MANA CORE
// (the power), the CHANNEL TRIM (the rune-frame that carries it to the wheels: top speed), the DRIVER'S RUNE (how
// the driver commands it: handling). Tier names + the dial's poles RULED by Magii + Alex 2026-11-13
// (world/transportation.md › Coursers › Parts, tiers & the balance dial): Core Cell→Lattice→Prism, Trim
// Etched→Inlaid→Gilded, Rune Cut→Bound→Living, dial Poise ↔ Surge. ⛔ never "Flow" (a rune-State) for the speed
// pole; the Driver's Rune is a RUNE, never a sigil. Buy at Rune Hold / town craft-shops, find as salvage of archaic
// Citadel / Mana-Carriage stock, earn by deeds (placement + costs are build).
//
// The rules, each pinned by courser-build.test.ts:
//   · every tier of every part IMPROVES its stat and touches nothing else
//   · the balance dial TRADES: toward speed = quicker and faster but less grip; toward handling = the reverse.
//     It never makes a car better at everything (so it is a choice, not a free upgrade)

import type { CourserSpec } from './courser'

export type Slot = 'core' | 'trim' | 'rune'
export type Tier = 0 | 1 | 2 | 3
export interface CourserBuild { core: Tier; trim: Tier; rune: Tier; balance: number }   // balance −1 (Poise) … +1 (Surge)
export const STOCK_BUILD: CourserBuild = { core: 0, trim: 0, rune: 0, balance: 0 }

export const PART_LABEL: Record<Slot, { name: string; does: string; tiers: [string, string, string] }> = {
  core: { name: 'Mana Core', does: 'acceleration', tiers: ['Cell', 'Lattice', 'Prism'] },
  trim: { name: 'Channel Trim', does: 'top speed', tiers: ['Etched', 'Inlaid', 'Gilded'] },
  rune: { name: "Driver's Rune", does: 'handling + grip', tiers: ['Cut', 'Bound', 'Living'] },
}
/** The canon tier name for a slot ("Lattice", "Gilded"…); Stock is the courser as it left the shop. */
export const tierLabel = (slot: Slot, t: Tier) => (t === 0 ? 'Stock' : PART_LABEL[slot].tiers[t - 1])
/** The balance dial's poles (canon): Poise = handling, Surge = speed. */
export const DIAL = { handling: 'Poise', speed: 'Surge' } as const

// per tier, what each part does to the sheet
const CORE_0TO60 = -0.38, CORE_TRACTION = 0.5        // s, m/s²
const TRIM_TOP = 8                                   // mph
const RUNE_GRIP = 0.07, RUNE_HANDLING = 0.08         // × base
// the dial at full speed-side (mirror for handling-side)
const BAL_TOP = 0.07, BAL_0TO60 = 0.05, BAL_GRIP = 0.09, BAL_HANDLING = 0.1

export function buildSpec(base: CourserSpec, b: CourserBuild): CourserSpec {
  const bal = Math.max(-1, Math.min(1, b.balance))
  const s: CourserSpec = {
    ...base,
    zeroTo60: base.zeroTo60 + CORE_0TO60 * b.core,
    traction: base.traction + CORE_TRACTION * b.core,
    topMph: base.topMph + TRIM_TOP * b.trim,
    grip: base.grip * (1 + RUNE_GRIP * b.rune),
    handling: base.handling * (1 + RUNE_HANDLING * b.rune),
  }
  return {
    ...s,
    topMph: s.topMph * (1 + BAL_TOP * bal),
    zeroTo60: s.zeroTo60 * (1 - BAL_0TO60 * bal),
    grip: s.grip * (1 - BAL_GRIP * bal),
    handling: s.handling * (1 - BAL_HANDLING * bal),
  }
}

/** 0–10 bars for the garage, against a fixed scale so upgrades visibly move them. */
export function statBars(s: CourserSpec): { speed: number; accel: number; handling: number; braking: number } {
  const bar = (v: number, lo: number, hi: number) => Math.max(0, Math.min(10, ((v - lo) / (hi - lo)) * 10))
  return {
    speed: bar(s.topMph, 80, 160),
    accel: bar(8 - s.zeroTo60, 0, 6),          // 8 s → 0 bars, 2 s → 10
    handling: bar(s.grip * s.handling, 0.6, 1.6),
    braking: bar(160 - s.brake60ft, 30, 110),
  }
}
