// BETA M204 (play, 2026-11-26): THE ELEMENT COMES FROM COOKING. Alex 11-26 (BETA Inbox 14:0x, replaces the brewed-Infusion
// plan): the element herbs are GROUND AT THE CRUSHER TABLE into infused SPICES; a spice goes into a meal at the hearth; a meal
// FED to a spirit adds its element to her bar: 10 slots beside her name, filled meal by meal in the element's colour, that
// NEVER resets or changes. 3-4 meals of one element + M201's stat bar = she takes that element's second form. At 10 the
// bar is full and locked. ⚖ canon amend [OPEN] (athernyx CANON_GAPS, alchemy.md): every word here is a neutral UI label.
//
// ★ BETA M207 (world, Alex 11-26, reworks the spice step above): THE FOUR INFUSIONS ARE DISH INGREDIENTS made at the alchemy
// set's stations, each from its element's gem (prospecting.ts GEM, RULED c73ab4e: Aqual water, Dinloid earth, Fuli mana,
// Rhyloid storm; their bag ids are the old `<kind>_crystal` keys):
//   Water = Shimmerscale ground to powder at the CRUSHER + Aqual           -> Aqual Sauce
//   Earth = Goldleaf + Dinloid at the STILL                                -> Golden Glaze
//   Storm = Stormgrass + Rhyloid boiled at the CAULDRON (the Cauldron Nook) -> Storm Broth
//   Mana  = Fuli ground at the CRUSHER                                     -> Fuli Powder
// "these would all just be part of recipes to add the element to the dish": a dish cooked with one is that element's meal
// (the bar, MEALS_FOR_FORM and the form gate below are unchanged). Names = Alex's working words, canon [OPEN] (athernyx
// CANON_GAPS 'Cooking, part 2'), for @lark. THE OLD EARTH HERB IS RETIRED (Alex: "too close to rootbulb"): no tree turns it up any more.
// Old saves: a `<el>_spice` in a bag is RENAMED in place to its element's infusion when the bag loads (inventory.ts loadInv,
// LEGACY_SPICE), so a keeper loses nothing. M204 s3 (canon 35c83eb): the retired herb is gone from the crop roster; a held or
// growing one loads as Goldleaf, the earth herb, grade and count kept (farming.ts RETIRED_CROPS).
//
// Herb finds (M204, Jin's application of canon's herb grounds, alchemy.md 07-30): a herb is FOUND at a node the keeper
// already works. Stormgrass feeds the Storm Broth; Tidepetal + Violetbloom stay finds (canon herbs, growable crops).
//     Tidepetal  <- pruning a STARWILLOW (the willows line the water: the shore)
//     Stormgrass <- pruning a DAWNWOOD (the Spine's foothills: unbroken sky)
//     Violetbloom <- breaking a FULI (violet) crystal (where the mana pools deepest)
//   A find = the herb + its seed (so it can be grown in the Farm: harvests hand seeds back).
// ★ PURE: no React, no storage. Run: npx tsx src/app/shimmer/open/ather/infusions.test.ts
import { dominantInfusion, type Infusions, type Species } from '../../spirits/spirit'
import { pendingEvolution } from '../../spirits/evolution'
import type { FormElement, StatOf } from '../../spirits/second-form-gate'
import { cropId, seedId, GRADES, type CropId } from './farming'
import type { Pot } from './spirit-seeds'

export const ELEMENTS: readonly FormElement[] = ['mana', 'storm', 'earth', 'water']
export const isElement = (v: unknown): v is FormElement => typeof v === 'string' && (ELEMENTS as readonly string[]).includes(v)

/** the herbs a FIND turns up (alchemy.md); earth has none: Goldleaf (canon's earth herb since 35c83eb) is a tier-1 crop grown from seed. */
export const HERB_OF: Readonly<Partial<Record<FormElement, CropId>>> = { mana: 'violetbloom', storm: 'stormgrass', water: 'tidepetal' }
/** which tree's pruning turns up which herb (Jin's application, above); goldwood + shimmeroak none (M207: no earth find) */
export const TREE_HERB: Readonly<Record<string, FormElement>> = { starwillow: 'water', dawnwood: 'storm' }
/** which crystal's breaking turns up which herb */
export const CRYSTAL_HERB: Readonly<Record<string, FormElement>> = { violet: 'mana' }
/** odds per worked node (build dial): ~1 in 8 prunes of the right tree */
export const HERB_FIND_CHANCE = 0.12
/** what a find puts in the bag: one herb and its seed, grade D */
export const herbFind = (el: FormElement): { id: string; n: number }[] => { const h = HERB_OF[el]; return h ? [{ id: cropId(h), n: 1 }, { id: seedId(h), n: 1 }] : [] }
/** roll a find for a node of this kind (one rand() call, always made, so the roll count never depends on the kind) */
export function rollHerb(el: FormElement | undefined, rand: () => number): { id: string; n: number }[] {
  const r = rand()
  return el && r < HERB_FIND_CHANCE ? herbFind(el) : []
}

// ── the infusion (an alchemy station) and the meal (the hearth) ─────────────────────────────────────────────────────
/** the alchemy-set station that makes it (alchemy-set.ts AlcStation; 'nook' = the Cauldron Nook, the set's cauldron) */
export type InfusionStation = 'crusher' | 'still' | 'nook'
/** one infusion: its bag id, name, station and what it takes (`crop:<crop>` = that crop at any grade, worst first) */
export interface InfusionRecipe { id: string; name: string; at: InfusionStation; in: readonly { id: string; n: number }[] }
export const INFUSION: Readonly<Record<FormElement, InfusionRecipe>> = {
  water: { id: 'aqual_sauce', name: 'Aqual Sauce', at: 'crusher', in: [{ id: 'shimmerscale_scales', n: 1 }, { id: 'water_crystal', n: 1 }] },   // M206: the scales off the Filet tab (cooking.ts SCALES)
  earth: { id: 'golden_tonic', name: 'Golden Glaze', at: 'still', in: [{ id: 'crop:goldleaf', n: 1 }, { id: 'earth_crystal', n: 1 }] },
  storm: { id: 'storm_broth', name: 'Storm Broth', at: 'nook', in: [{ id: 'crop:stormgrass', n: 1 }, { id: 'storm_crystal', n: 1 }] },
  mana: { id: 'fuli_powder', name: 'Fuli Powder', at: 'crusher', in: [{ id: 'violet_crystal', n: 1 }] },
}
export const infusionId = (el: FormElement) => INFUSION[el].id
export const elementOfInfusion = (id: string): FormElement | null => ELEMENTS.find(el => INFUSION[el].id === id) ?? null
/** the infusions a station makes, in ELEMENTS order */
export const infusionsAt = (at: string): FormElement[] => ELEMENTS.filter(el => INFUSION[el].at === at)
/** The exact bag ids an infusion would spend from `have` (crops worst grade first), or null if something is short. */
export function infusionTake(el: FormElement, have: Readonly<Record<string, number>>): { id: string; n: number }[] | null {
  const out: { id: string; n: number }[] = []
  for (const slot of INFUSION[el].in) {
    let need = slot.n
    const ids = slot.id.startsWith('crop:') ? GRADES.map(g => `${slot.id}:${g}`) : [slot.id]
    for (const id of ids) {
      if (!need) break
      const n = Math.min(need, have[id] ?? 0)
      if (n > 0) { out.push({ id, n }); need -= n }
    }
    if (need) return null
  }
  return out
}
/** how many of a slot `have` holds (a crop slot counts every grade) */
export const slotHave = (slotId: string, have: Readonly<Record<string, number>>) =>
  slotId.startsWith('crop:') ? GRADES.reduce((a, g) => a + (have[`${slotId}:${g}`] ?? 0), 0) : (have[slotId] ?? 0)

/** bag ids: `<el>_meal` cooked from an infusion + a Shimmerscale (the hearth's tier-1 rinn) */
export const mealId = (el: FormElement) => `${el}_meal`
/** the meal's base: one Shimmerscale (cooking.ts: the hearth's first food) */
export const MEAL_BASE = 'shimmerscale'
export const elementOfMeal = (id: string): FormElement | null => { const m = /^(mana|storm|earth|water)_meal$/.exec(id); return m ? m[1] as FormElement : null }
/** M204's retired spices (`<el>_spice`): an old bag's spice becomes its element's infusion on load (inventory.ts loadInv) */
export const LEGACY_SPICE: Readonly<Record<string, string>> = Object.fromEntries(ELEMENTS.map(el => [`${el}_spice`, INFUSION[el].id]))

// ── her bar ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** the bar's length: full = locked (Alex: "feed the spirit 10 meals to lock in its element") */
export const BAR_SLOTS = 10
/** meals of ONE element her second form asks (Alex: "most 2nd evos need 3-4"). Build dial; per spirit later. */
export const MEALS_FOR_FORM = 3

/** her bar as the pot keeps it (an old pot has none). Append-only: never reordered, never cleared. */
export const mealsOf = (p: Pot | undefined): FormElement[] => (p?.meals ?? []).filter(isElement).slice(0, BAR_SLOTS)
export const barLocked = (p: Pot | undefined) => mealsOf(p).length >= BAR_SLOTS
/** the bar counted per element, in the shape the evolution gate reads (spirit.ts Infusions) */
export function mealCounts(meals: readonly FormElement[]): Infusions {
  const c: Infusions = { mana: 0, storm: 0, earth: 0, water: 0 }
  for (const m of meals) c[m]++
  return c
}
/** her lean and how many meals of it she has (null = no meals yet, or tied) */
export function mealLean(meals: readonly FormElement[]): { el: FormElement; n: number } | null {
  const c = mealCounts(meals), el = dominantInfusion(c)
  return el ? { el, n: c[el] } : null
}

/** The gate: her dominant meal element has MEALS_FOR_FORM meals AND M201's stat bar is met = her form. Null = not yet. */
function formDue(meals: readonly FormElement[], sp: Species, statOf: StatOf): { element: FormElement; formName: string } | null {
  const lean = mealLean(meals)
  if (!lean || lean.n < MEALS_FOR_FORM) return null
  const due = pendingEvolution({ species: sp, element: 'base', infusions: mealCounts(meals) }, statOf)
  return due ? { element: due.element, formName: due.formName } : null
}

export type Fed =
  | { ok: true; pot: Pot; slot: number; evolved: FormElement | null; formName: string | null; locked: boolean }
  | { ok: false; why: 'unbloomed' | 'locked' }
/** Feed her one `el` meal: it takes the next slot of her bar (the slots before it never change). A full bar refuses (the
 *  meal stays in the bag). Then the gate: an evolved spirit keeps her element for good; a base one may take her form now. */
export function feedMeal(pot: Pot, sp: Species, el: FormElement, statOf: StatOf): Fed {
  if (!pot.bloomed) return { ok: false, why: 'unbloomed' }
  const meals = mealsOf(pot)
  if (meals.length >= BAR_SLOTS) return { ok: false, why: 'locked' }
  const next = [...meals, el], fed: Pot = { ...pot, meals: next }, locked = next.length >= BAR_SLOTS
  if (pot.element) return { ok: true, pot: fed, slot: meals.length, evolved: null, formName: null, locked }
  const due = formDue(next, sp, statOf)
  return due ? { ok: true, pot: { ...fed, element: due.element }, slot: meals.length, evolved: due.element, formName: due.formName, locked }
    : { ok: true, pot: fed, slot: meals.length, evolved: null, formName: null, locked }
}
/** Her meals were already in when her stat reached the bar (training, growth): she takes her form now. Null = no change. */
export function settleForm(pot: Pot, sp: Species, statOf: StatOf): { pot: Pot; evolved: FormElement; formName: string } | null {
  if (!pot.bloomed || pot.element) return null
  const due = formDue(mealsOf(pot), sp, statOf)
  return due ? { pot: { ...pot, element: due.element }, evolved: due.element, formName: due.formName } : null
}

/** player-facing words: plain functional UI labels, UNSIGNED (for @lark; canon amend [OPEN]) */
export const MEAL_UI = {
  infusionBlurb: (el: string, station: string) => `Made at the ${station}. Cook it into a ${el} Meal at the hearth.`,
  mealName: (el: string) => `${el} Meal`,
  mealBlurb: (el: string) => `A ${el} meal. Open a garden spirit's panel and feed it to her: it adds ${el} to her Steep, for good.`,
  make: 'Make',
  infusions: 'Meal ingredients',
  /** M204 s3: canon's word for the bar (alchemy.md › THE COOKING ROAD: UI word *Steep*, e.g. *Steep 6/10*) */
  bar: 'Steep',
  steep: (n: number) => `Steep ${n}/${BAR_SLOTS}`,
  feed: (meal: string) => `Feed ${meal}`,
  fed: (el: string, n: number) => `${el} · Steep ${n}/${BAR_SLOTS}`,
  evolved: (form: string) => `She takes her second form: ${form}`,
  locked: 'Her Steep is full.',
  meals: (el: string, n: number) => `Leaning ${el}: ${n} / ${MEALS_FOR_FORM} meals`,
}
