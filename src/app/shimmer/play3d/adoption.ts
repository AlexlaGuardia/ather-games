// ★ PURE. Lowen's caravan: who rides it this month, which animal chooses you, and how a bond arrives.
//
// Canon (`world/manamals.md` › ★ Adoption — Lowen's caravan, RULED 2026-09-27):
//   · ADOPTION GIVES YOU THE ANIMAL. THE BOND IS STILL ITS CHOICE — *"watched, then followed, then chosen."* The gifts
//     and perks come with the bond, never with the adoption.
//   · the caravan carries animals that need a home: STRAYS, retired work animals, and THE QUIET ONES (whose Alkin died).
//   · Marks pay the keeper's trouble and the animal's care, NEVER a price for the animal.
//   · Domesticated and Companions ride. ⛔ Glowmites never (they dim in captivity) · ⛔ Rare · ⛔ Legendary.
//   · LOWEN sits on the step while the animals look at the keeper, and speaks only once one has stayed.
// Jin's (the same ruling): cadence, roster size and rotation, adoptions per visit, care costs, how the bond shows.
//
// ⚠ What the code can carry today: the game's Mana'mals are the five skill-gated beasts (`beasts/beast.ts`), and of
// those only DUSTWHISKER and SPORELING are canon Companions (`manamals.md` › Companions). Drifthorn is a wild food
// animal, Embermole uncommon, Glowmite barred. The Domesticated work animals (Strider, Craghopper...) are not built;
// they join the roster when they exist (and a job for them does). So the caravan carries strays and quiet ones today.

import type { BeastSpecies } from '../beasts/beast'
import { monthIndex, lowenIn, dayOfMonth, LOWEN_DAYS } from './caravans'

/** The species that may ride, by canon tier. Never add a Glowmite, a Rare or a Legendary here. */
export const ADOPTABLE: readonly BeastSpecies[] = ['dustwhisker', 'sporeling']
/** canon's barred list, named so a test can hold the line */
export const NEVER_ON_THE_CARAVAN: readonly string[] = ['glowmite']

export type Origin = 'stray' | 'quiet'

/** Lowen parks the first week of each month (`caravans.ts` › LOWEN_DAYS). */
export { lowenIn, dayOfMonth, LOWEN_DAYS }
/** One home per keeper per visit. */
export const ADOPTIONS_PER_MONTH = 1
/** How many wait on the step. */
export const ROSTER_SIZE = 3
/** The care the keeper pays: bedding, feed for the road, Lowen's trouble. Never the animal's price. */
export const CARE_MARKS = 25

const mix = (a: number, b: number) => {
  let s = (a * 73856093) ^ (b * 19349663)
  s = (s ^ (s >>> 13)) * 1274126177
  return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff
}

export interface Stray { species: BeastSpecies; origin: Origin; seat: number }

/** The month's animals on the step. At least one quiet one most months; never the same pair two months running. */
export function rosterFor(month: number): Stray[] {
  return Array.from({ length: ROSTER_SIZE }, (_, seat) => ({
    species: ADOPTABLE[Math.floor(mix(month, 11 + seat) * ADOPTABLE.length) % ADOPTABLE.length],
    origin: (mix(month, 23 + seat) < (seat === 0 ? 0.6 : 0.3) ? 'quiet' : 'stray') as Origin,
    seat,
  }))
}

/** Which one comes to you. The animal chooses: fixed for a keeper and a month, so waiting again does not reroll it. */
export function whoStays(month: number, keeperId: string): number {
  let h = 0
  for (let i = 0; i < keeperId.length; i++) h = (h * 31 + keeperId.charCodeAt(i)) | 0
  return Math.floor(mix(month, h) * ROSTER_SIZE) % ROSTER_SIZE
}

export const canAdopt = (lastAdoptedMonth: number | undefined, nowMs: number) =>
  lowenIn(nowMs) && lastAdoptedMonth !== monthIndex(nowMs)

// ── THE BOND ARRIVING: watched → followed → chosen — the thresholds live with the beast (`beasts/beast.ts`) ──────
export { bondStage, FOLLOWED_AT, CHOSEN_AT, QUIET_BOND_RATE, type BondStage } from '../beasts/beast'
