// ALCHEMY IS A FURNITURE SET, NOT A ROOM (Alex 11-20: "the alchemy room was a mistake.. this is actually going to have to be
// the only skill that is a furniture set ... this way the player could plan a potion party"; then "more advanced manatech
// introduced to alchemy .. the four i mentioned, the mixing table would have a cauldron attached"). Pure: the four stations,
// each potion's step chain, and POTENCY from the grades of what went in ("the higher the ingredients grade the higher the
// potency"). No React, no bag: the panel spends and pays, this file says what a step takes and what it makes.
//
// ★ STATIONS RULED 2026-11-21 (Q1, athernyx 2cbbaca, game/alchemy.md › THE ALCHEMY SET): Alchemy Desk (a recipe starts and
//   ends there) · Still (mixture -> extract) · Cauldron Nook (makes the mixture) · Crusher Table (WORKING name: items -> fine
//   powders or gels). The chain: crush -> mix -> distil -> combine, each potion its own step list.
// ★ NAMES RULED 2026-11-21 (Q2-Q3, athernyx 61911e7): the naming GRAMMAR (Crusher -> a Dust or a Gel, Nook -> a Steep, Still
//   -> an Extract, Desk -> the potion by its class word), the first recipe (Rinnscale Dust + Goldleaf Steep -> Golden Dew
//   Extract -> Health Draught) and the three starters (Health Draught, Mana Draught, Starlight Tincture). The other
//   intermediates are named BY that grammar (what went in + its word). The Rinnscale Dust is ground from the build's
//   Shimmerscale catch (the dust is canon's name, the input is Jin's). Every name lives in this file only.
// ⚖ Jin's (canon 09-16): every step list, every number, potency, the grade maths. Canon's: a brewing, every hand a bottle,
//   bottle-only, more-never-only (alchemy.md). Run: npx tsx src/app/shimmer/open/ather/alchemy-set.test.ts
import { GRADES, type Grade } from './farming'
import { draughtHeal } from '../shared/vitals-economy'

export type AlcStation = 'crusher' | 'still' | 'nook' | 'desk'
export const ALC_STATIONS: Readonly<Record<AlcStation, { name: string; verb: string; blurb: string }>> = {
  crusher: { name: 'Crusher Table', verb: 'Crush', blurb: 'Crushes what you feed it into a fine powder, or a gel.' },
  nook:    { name: 'Cauldron Nook', verb: 'Mix', blurb: 'Folds herbs and powders together over the heat into a mixture.' },
  still:   { name: 'Still', verb: 'Distil', blurb: 'Runs a mixture through glass coils into a clear extract.' },
  desk:    { name: 'Alchemy Desk', verb: 'Combine', blurb: 'Every recipe starts here, and ends here: the prepared parts become a potion.' },
}
/** The chain's order (crush -> mix -> distil -> combine), which is also the order the stations are listed in. */
export const ALC_ORDER: readonly AlcStation[] = ['crusher', 'nook', 'still', 'desk']

/** A slot a step takes: a plain bag id, a graded crop (`crop:<crop>`, any grade) or an earlier step's product (`alc:<id>`). */
export interface Slot { id: string; n: number }
export interface Step { at: AlcStation; in: readonly Slot[]; out: string; ms: number }
export interface Potion {
  name: string
  blurb: string
  steps: readonly Step[]
  /** how many bottles the last step pours */
  makes: number
  /** the effect at potency 1 (grade D); potency scales it */
  effect: { heal: number } | { mana: number } | { xp: number; ms: number }
}

/** The things a chain makes on the way (each is graded like a crop: `alc:<id>:<grade>`). */
export const INTERMEDIATES: Readonly<Record<string, string>> = {
  rinnscale_dust: 'Rinnscale Dust', goldleaf_steep: 'Goldleaf Steep', golden_dew_extract: 'Golden Dew Extract',
  shard_dust: 'Shard Dust', dewdrop_gel: 'Dewdrop Gel', shard_steep: 'Shard Steep', starwillow_extract: 'Starwillow Extract', core_dust: 'Core Dust',
}

const S = 1000
export const ALC_POTIONS: Readonly<Record<string, Potion>> = {
  // THE FIRST RECIPE, as ruled (Alex's chain): Rinnscale Dust + Goldleaf Steep (Goldleaf + Dewdrop Vine) -> Still -> Golden
  // Dew Extract -> Desk -> Health Draught.
  health: {
    name: 'Health Draught', blurb: 'Golden dew and rinnscale dust. Drink it to heal.', makes: 2, effect: { heal: 40 },
    steps: [
      { at: 'crusher', in: [{ id: 'shimmerscale', n: 2 }], out: 'rinnscale_dust', ms: 6 * S },
      { at: 'nook', in: [{ id: 'crop:goldleaf', n: 2 }, { id: 'crop:dewdrop_vine', n: 2 }], out: 'goldleaf_steep', ms: 10 * S },
      { at: 'still', in: [{ id: 'alc:goldleaf_steep', n: 1 }], out: 'golden_dew_extract', ms: 12 * S },
      { at: 'desk', in: [{ id: 'alc:rinnscale_dust', n: 1 }, { id: 'alc:golden_dew_extract', n: 1 }], out: 'health', ms: 8 * S },
    ],
  },
  mana: {
    // a starter (the canon first recipe; its page comes with the Desk). The vine is crushed to a GEL first (the Crusher's
    // other product, ruled with the Dust).
    name: 'Mana Draught', blurb: 'Shard dust steeped with dewdrop gel. Drink it for mana.', makes: 2, effect: { mana: 65 },
    steps: [
      { at: 'crusher', in: [{ id: 'raw_mana_shard', n: 3 }], out: 'shard_dust', ms: 6 * S },
      { at: 'crusher', in: [{ id: 'crop:dewdrop_vine', n: 2 }], out: 'dewdrop_gel', ms: 6 * S },
      { at: 'nook', in: [{ id: 'alc:shard_dust', n: 1 }, { id: 'alc:dewdrop_gel', n: 1 }], out: 'shard_steep', ms: 10 * S },
      { at: 'desk', in: [{ id: 'alc:shard_steep', n: 1 }], out: 'mana', ms: 8 * S },
    ],
  },
  wisdom: {
    name: 'Starlight Tincture', blurb: 'Starwillow extract on core dust. Gathering teaches you more for a while.', makes: 2, effect: { xp: 0.25, ms: 8 * 60 * S },
    steps: [
      { at: 'crusher', in: [{ id: 'pure_mana_core', n: 2 }], out: 'core_dust', ms: 6 * S },
      { at: 'still', in: [{ id: 'starwillow_sap', n: 3 }], out: 'starwillow_extract', ms: 12 * S },
      { at: 'desk', in: [{ id: 'alc:core_dust', n: 1 }, { id: 'alc:starwillow_extract', n: 1 }, { id: 'crop:goldleaf', n: 1 }], out: 'wisdom', ms: 8 * S },
    ],
  },
}
export const ALC_POTION_ORDER = Object.keys(ALC_POTIONS)

// ── grades and potency ──────────────────────────────────────────────────────────────────────────────────────────────
/** D = 1 ... S = 5 */
export const gradeScore = (g: Grade) => GRADES.indexOf(g) + 1
/** What potency a grade gives: D ×1, C ×1.15, B ×1.3, A ×1.5, S ×1.75 (felt at every rung, S not doubling the bottle). */
export const POTENCY: Readonly<Record<Grade, number>> = { D: 1, C: 1.15, B: 1.3, A: 1.5, S: 1.75 }

/** The grade an id carries (`crop:goldleaf:B`, `alc:x:A`, `potion:x:S`), or null for a plain bag id. */
export function gradeOf(id: string): Grade | null {
  const p = id.split(':')
  return p.length === 3 && (GRADES as readonly string[]).includes(p[2]) ? p[2] as Grade : null
}
/** Does a bag id fill a slot? A graded slot (`crop:x`, `alc:x`) takes any grade of it; a plain slot takes only itself. An
 *  intermediate made from nothing graded is plain (`alc:x`, see stepMakes) and fills its own slot too. */
export const fills = (slot: string, id: string) =>
  id === slot ? !slot.startsWith('crop:') : slot.includes(':') && id.startsWith(slot + ':') && gradeOf(id) !== null

/** The grade a step's product takes: the mean score of its GRADED inputs (weighted by count), rounded down; a step fed
 *  nothing graded makes a D. Rounding down means one S cannot carry a pile of D's up. */
export function gradeFrom(spent: readonly { id: string; n: number }[]): Grade {
  return gradeOrNull(spent) ?? 'D'
}
/** The same, but null when nothing graded went in (an intermediate made only of plain things carries no grade, so ground
 *  scales never drag a grade-A extract down at the desk). */
export function gradeOrNull(spent: readonly { id: string; n: number }[]): Grade | null {
  let sum = 0, n = 0
  for (const s of spent) { const g = gradeOf(s.id); if (g) { sum += gradeScore(g) * s.n; n += s.n } }
  return n ? GRADES[Math.max(0, Math.floor(sum / n) - 1)] : null
}

export const alcId = (inter: string, g: Grade) => `alc:${inter}:${g}`
export const potionId = (p: string, g: Grade) => `potion:${p}:${g}`
export const isAlcPotion = (id: string) => id.startsWith('potion:') && id.split(':')[1] in ALC_POTIONS && gradeOf(id) !== null
export function alcName(id: string): string | null {
  const [k, x, g] = id.split(':')
  if (k === 'alc' && !g && INTERMEDIATES[x]) return INTERMEDIATES[x]
  if (!g || !gradeOf(id)) return null
  if (k === 'alc' && INTERMEDIATES[x]) return `${INTERMEDIATES[x]} · ${g}`
  if (k === 'potion' && ALC_POTIONS[x]) return `${ALC_POTIONS[x].name} · ${g}`
  return null
}

/** What a bottle does at its grade. */
export function effectOf(id: string): { heal: number } | { mana: number } | { xp: number; ms: number } | null {
  if (!isAlcPotion(id)) return null
  const p = ALC_POTIONS[id.split(':')[1]], m = POTENCY[gradeOf(id)!]
  const e = p.effect
  if ('heal' in e) return { heal: draughtHeal(gradeOf(id)!, 100) }   // M78: a chunk of max HP by grade (D 25% .. S 75%), shown at the base 100 HP; drink() scales by the keeper's real max
  if ('mana' in e) return { mana: Math.round(e.mana * m) }
  // the XP boost's strength is fixed (one Wisdom buff, alchemy.ts) and potency makes it LAST longer: a D runs 8 min, an S 14
  return { xp: e.xp, ms: Math.round(e.ms * m) }
}

// ── a step ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Have = Readonly<Record<string, number>>

/** Which bag ids a step would spend, best grade first by default (a keeper brewing for potency wants their best). Null when
 *  the bag cannot fill every slot. Plain slots spend themselves. */
export function pickFor(step: Step, have: Have, prefer: 'best' | 'worst' = 'best'): { id: string; n: number }[] | null {
  const out: { id: string; n: number }[] = []
  for (const slot of step.in) {
    const ids = Object.keys(have).filter(id => (have[id] ?? 0) > 0 && fills(slot.id, id))
    ids.sort((a, b) => (gradeScore(gradeOf(b) ?? 'D') - gradeScore(gradeOf(a) ?? 'D')) * (prefer === 'best' ? 1 : -1))
    let need = slot.n
    for (const id of ids) {
      if (!need) break
      const take = Math.min(need, have[id])
      out.push({ id, n: take }); need -= take
    }
    if (need) return null
  }
  return out
}

/** What a step makes from what it spent: the next intermediate, or (the last step) the bottles. */
export function stepMakes(potion: string, k: number, spent: readonly { id: string; n: number }[]): { id: string; n: number } {
  const p = ALC_POTIONS[potion], st = p.steps[k], g = gradeOrNull(spent)
  if (k === p.steps.length - 1) return { id: potionId(potion, g ?? 'D'), n: p.makes }
  return { id: g ? alcId(st.out, g) : `alc:${st.out}`, n: 1 }
}

/** The step a keeper is on: the first whose product they do not hold yet (counting back from the bottle). A keeper holding
 *  the extract skips straight to the desk. Returns the step index, or -1 when the bag cannot start anywhere. */
export function nextStep(potion: string, have: Have): number {
  const p = ALC_POTIONS[potion]
  for (let k = p.steps.length - 1; k >= 0; k--) if (pickFor(p.steps[k], have)) return k
  return -1
}

/** Every step done at a station, across every potion (what the station's panel lists). */
export const stepsAt = (at: AlcStation) => ALC_POTION_ORDER.flatMap(p => ALC_POTIONS[p].steps.map((s, k) => ({ potion: p, k, step: s })).filter(x => x.step.at === at))
/** A recipe as the Desk shows it when it opens one: each step's station in order, ending back at the Desk. */
export const chainOf = (potion: string): AlcStation[] => ALC_POTIONS[potion].steps.map(s => s.at)
