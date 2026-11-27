// BETA M233 s3: CLASH's LINE-UPS and STAT EVENING (rules: fair-clash-rules.ts). Pure; no React.
//  - a tent's line-up is PREGENERATED from its tier's pool, seeded by (season, tent number): the same tent fields the same
//    spirits for every keeper all season. Easy = base forms, average = second forms (species x element), no species twice.
//  - evenSpirit() builds the battle Spirit at the tent's level with even seeds, neutral temperament, the same bond: species
//    + form are all that differ, hers included.
// Names are the canon form names (spirits/spirit.ts spiritFormName), nothing new.
import { createSpirit, spiritFormName, ELEMENTS, type Spirit, type Species, type Element } from '../../spirits/spirit'
import { LINEUP_SIZE, TENT_LEVEL, type ClashTier } from './fair-clash-rules'

export const CLASH_SPECIES: readonly Species[] = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
/** the seed every stat gets inside a tent (0..31: the middle) */
export const EVEN_SEED = 16
/** the bond every spirit gets inside a tent (50 = her species signature move, engine/moves.ts) */
export const EVEN_BOND = 50

export interface Foe { species: Species; element: Element }
/** a tier's pool: easy = every base form, average = every second form; difficult (awakened) has none yet (HELD) */
export function clashPool(tier: ClashTier): Foe[] {
  if (tier === 'easy') return CLASH_SPECIES.map(species => ({ species, element: 'base' as Element }))
  if (tier === 'average') return CLASH_SPECIES.flatMap(species => ELEMENTS.map(element => ({ species, element: element as Element })))
  return []
}

/** a small seeded generator (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** the tent's line-up: LINEUP_SIZE foes from the tier's pool, no species twice, fixed by (season, tent) */
export function clashLineup(season: number, tent: number, tier: ClashTier): Foe[] {
  const pool = clashPool(tier), r = rng(season * 7919 + tent * 104729 + 17), out: Foe[] = []
  const left = [...pool]
  while (out.length < LINEUP_SIZE && left.length) {
    const f = left.splice(Math.floor(r() * left.length), 1)[0]
    if (!out.some(o => o.species === f.species)) out.push(f)
  }
  return out
}

export const foeName = (f: Foe) => spiritFormName(f.species, f.element)

/** THE EVENING: a battle Spirit at the tent's level, even seeds, neutral temperament, even bond. Hers and the troupe's alike. */
export function evenSpirit(species: Species, element: Element, tier: ClashTier, name = spiritFormName(species, element)): Spirit {
  const s = createSpirit(species, name, 0, 0)
  s.level = TENT_LEVEL[tier]
  s.seeds = Array.from({ length: 6 }, () => EVEN_SEED)
  s.temperament = 'neutral'
  s.bond = EVEN_BOND
  s.element = element
  s.hpFrac = 1
  s.heldItem = undefined
  return s
}
