// BETA M204 (play, 2026-11-26): THE ELEMENT COMES FROM COOKING. Alex 11-26 (BETA Inbox 14:0x, replaces the brewed-Infusion
// plan): the element herbs are GROUND AT THE CRUSHER TABLE into infused SPICES; a spice goes into a meal at the hearth; a meal
// FED to a spirit adds its element to her bar: 10 slots beside her name, filled meal by meal in the element's colour, that
// NEVER resets or changes. 3-4 meals of one element + M201's stat bar = she takes that element's second form. At 10 the
// bar is full and locked. ⚖ canon amend [OPEN] (athernyx CANON_GAPS, alchemy.md): every word here is a neutral UI label.
//
// Canon herbs (alchemy.md, RULED 07-30): Violetbloom (Mana), Stormgrass (Storm), Rootvine (Earth), Tidepetal (Water).
// ⚖ JIN'S APPLICATION (for Magii, CANON_GAPS 08-18 herb grounds): canon puts each herb on a GROUND (Violetbloom basin,
//   Stormgrass highland, Rootvine woodland, Tidepetal shore). The open world's Wilds have no such ground layer yet, so a herb
//   is FOUND where its ground's character already stands, at a node the keeper already works:
//     Rootvine   <- pruning a SHIMMEROAK (the thicket's closed canopy: old forest floor)
//     Tidepetal  <- pruning a STARWILLOW (the willows line the water: the shore)
//     Stormgrass <- pruning a DAWNWOOD (the Spine's foothills: unbroken sky)
//     Violetbloom <- breaking a FULI (violet) crystal (where the mana pools deepest)
//   A find = the herb + its seed (so it can be grown in the Farm: harvests hand seeds back).
// ★ PURE: no React, no storage. Run: npx tsx src/app/shimmer/open/ather/infusions.test.ts
import { dominantInfusion, type Infusions, type Species } from '../../spirits/spirit'
import { pendingEvolution } from '../../spirits/evolution'
import type { FormElement, StatOf } from '../../spirits/second-form-gate'
import { cropId, seedId, type CropId } from './farming'
import type { Pot } from './spirit-seeds'

export const ELEMENTS: readonly FormElement[] = ['mana', 'storm', 'earth', 'water']
export const isElement = (v: unknown): v is FormElement => typeof v === 'string' && (ELEMENTS as readonly string[]).includes(v)

/** canon: each element's herb */
export const HERB_OF: Readonly<Record<FormElement, CropId>> = { mana: 'violetbloom', storm: 'stormgrass', earth: 'rootvine', water: 'tidepetal' }
/** which tree's pruning turns up which herb (Jin's application, above); goldwood none */
export const TREE_HERB: Readonly<Record<string, FormElement>> = { shimmeroak: 'earth', starwillow: 'water', dawnwood: 'storm' }
/** which crystal's breaking turns up which herb */
export const CRYSTAL_HERB: Readonly<Record<string, FormElement>> = { violet: 'mana' }
/** odds per worked node (build dial): ~1 in 8 prunes of the right tree */
export const HERB_FIND_CHANCE = 0.12
/** what a find puts in the bag: one herb and its seed, grade D */
export const herbFind = (el: FormElement): { id: string; n: number }[] => [{ id: cropId(HERB_OF[el]), n: 1 }, { id: seedId(HERB_OF[el]), n: 1 }]
/** roll a find for a node of this kind (one rand() call, always made, so the roll count never depends on the kind) */
export function rollHerb(el: FormElement | undefined, rand: () => number): { id: string; n: number }[] {
  const r = rand()
  return el && r < HERB_FIND_CHANCE ? herbFind(el) : []
}

// ── the spice (Crusher Table) and the meal (the hearth) ─────────────────────────────────────────────────────────────
/** bag ids: `<el>_spice` ground from the herb, `<el>_meal` cooked from a spice + a Shimmerscale (the hearth's tier-1 rinn) */
export const spiceId = (el: FormElement) => `${el}_spice`
export const mealId = (el: FormElement) => `${el}_meal`
/** grinding: SPICE_HERBS herbs of ANY grade (`crop:<herb>:<g>`), worst grade first -> one spice, at once (build dial) */
export const SPICE_HERBS = 1
/** the meal's base: one Shimmerscale (cooking.ts: the hearth's first food) */
export const MEAL_BASE = 'shimmerscale'
export const elementOfMeal = (id: string): FormElement | null => { const m = /^(mana|storm|earth|water)_meal$/.exec(id); return m ? m[1] as FormElement : null }
export const elementOfSpice = (id: string): FormElement | null => { const m = /^(mana|storm|earth|water)_spice$/.exec(id); return m ? m[1] as FormElement : null }

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
  spiceName: (el: string) => `${el} Spice`,
  spiceBlurb: (el: string) => `Ground from its herb at the Crusher Table. Cook it into a ${el} Meal at the hearth.`,
  mealName: (el: string) => `${el} Meal`,
  mealBlurb: (el: string) => `A spiced meal. Open a garden spirit's panel and feed it to her: it adds ${el} to her bar, for good.`,
  grind: 'Grind',
  spices: 'Spices',
  bar: 'Element',
  feed: (meal: string) => `Feed ${meal}`,
  fed: (el: string, n: number) => `${el} · ${n} / ${BAR_SLOTS}`,
  evolved: (form: string) => `She takes her second form: ${form}`,
  locked: 'Her bar is full.',
  meals: (el: string, n: number) => `Leaning ${el}: ${n} / ${MEALS_FOR_FORM} meals`,
}
