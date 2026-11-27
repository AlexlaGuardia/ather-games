// ★ BETA M234 s2 (play, 2026-11-27): FOOD FEEDS SPIRITS, POTIONS HEAL KEEPERS. Canon: athernyx game/alchemy.md › THE RECIPES
// SIT-DOWN (Alex + Magii 043e3a6) + Magii 30d19fd (Moonberry) + § COOKING FOR SPIRITS (bond, "capped per spirit per day").
// Every hearth dish is fed to a garden spirit in her panel (spirit-talk.tsx). What a dish gives her:
//   · STEEP: the element slots it fills on her 10-slot bar (infusions.ts BAR_SLOTS). A plain roast has none (no infusion);
//     an element meal one; Grilled Rinn with Aqual Sauce three Water, her whole Water need (MEALS_FOR_FORM) in one meal.
//   · BOND: the hidden stat (spirits/spirit.ts bond 0-255), raised by care over time, CAPPED PER SPIRIT PER GAME DAY: "bond is
//     earned by care over time, never bought in bulk". A Moonberry dish gives a little more (cooking.ts MOONBERRY_BOND), still
//     under the cap.
// A dish is refused only when it would give her nothing (her bar is full or it has no element, AND today's bond is spent).
// Bond lives on her pot (spirit-seeds.ts Pot.bond / bondDay / bondToday), so no new storage key. Numbers = Jin's (feel: Alex).
// ★ BETA M240 (play, Alex 11-27): FEED BY HAND. Her talk has no Feed any more: a dish IN HAND, the crosshair on her, E (Square
// on a pad: the pad's west button already sends E, shared/pad.ts) feeds it, the same feedDish rules. A full Steep (10/10) makes
// the meal a SNACK: bond only (under the day cap), her Steep unchanged.
// ★ PURE: no React, no storage. Run: npx tsx src/app/shimmer/open/ather/spirit-dishes.test.ts
import type { Species } from '../../spirits/spirit'
import type { FormElement, StatOf } from '../../spirits/second-form-gate'
import { DISHES, GRILLED } from './cooking'
import { elementOfMeal, feedMeals, mealsOf, BAR_SLOTS } from './infusions'
import type { Pot } from './spirit-seeds'

/** the hidden stat's ceiling (spirits/spirit.ts: bond 0-255) */
export const BOND_MAX = 255
/** bond one spirit can gain from food in one game day (~3 dishes). Build dial. */
export const BOND_DAY_CAP = 12
/** an element meal's bond (a Shimmerscale + an infusion) */
export const MEAL_BOND = 2

export interface SpiritDish { steep: readonly FormElement[]; bond: number }
/** what a bag item gives a spirit when fed, or null = not a spirit dish */
export function dishOf(id: string | null | undefined): SpiritDish | null {
  if (!id) return null
  if (Object.prototype.hasOwnProperty.call(DISHES, id)) return { steep: [], bond: DISHES[id].bond }
  if (Object.prototype.hasOwnProperty.call(GRILLED, id)) return { steep: GRILLED[id].steep, bond: GRILLED[id].bond }
  const el = elementOfMeal(id)
  return el ? { steep: [el], bond: MEAL_BOND } : null
}
export const isSpiritDish = (id: string | null | undefined): id is string => !!dishOf(id)
/** every spirit dish id, in the order her panel lists them: the grill, the meals, then the roasts */
export const SPIRIT_DISH_IDS: readonly string[] = [...Object.keys(GRILLED), ...['mana', 'storm', 'earth', 'water'].map(el => `${el}_meal`), ...Object.keys(DISHES)]

export const bondOf = (p: Pot | undefined) => Math.max(0, Math.min(BOND_MAX, Math.floor(Number(p?.bond) || 0)))
/** bond already gained today (a pot last fed on another day = 0) */
export const bondToday = (p: Pot | undefined, day: number) => (p && p.bondDay === day ? Math.max(0, Math.floor(Number(p.bondToday) || 0)) : 0)
/** bond she can still gain today */
export const bondRoom = (p: Pot | undefined, day: number) => Math.max(0, Math.min(BOND_DAY_CAP - bondToday(p, day), BOND_MAX - bondOf(p)))

export type FedDish =
  | { ok: true; pot: Pot; steep: FormElement[]; bond: number; evolved: FormElement | null; formName: string | null; locked: boolean; /** M240: her Steep was full (10/10): bond only */ snack: boolean }
  | { ok: false; why: 'unbloomed' | 'not-a-dish' | 'full' }
/** Feed her one dish `id` on game day `day`. Steep first (infusions.ts feedMeals: the slots past a full bar are dropped, and
 *  the form gate runs), then bond up to today's room. `full` = it would give her nothing (the dish stays in the bag). */
export function feedDish(pot: Pot, sp: Species, id: string, statOf: StatOf, day: number): FedDish {
  const d = dishOf(id)
  if (!d) return { ok: false, why: 'not-a-dish' }
  if (!pot.bloomed) return { ok: false, why: 'unbloomed' }
  const room = BAR_SLOTS - mealsOf(pot).length, steep = d.steep.slice(0, Math.max(0, room)) as FormElement[]
  const bond = Math.min(d.bond, bondRoom(pot, day))
  if (!steep.length && bond <= 0) return { ok: false, why: 'full' }
  let next: Pot = pot, evolved: FormElement | null = null, formName: string | null = null
  if (steep.length) {
    const r = feedMeals(pot, sp, steep, statOf)
    if (!r.ok) return { ok: false, why: 'full' }
    next = r.pot; evolved = r.evolved; formName = r.formName
  }
  if (bond > 0) next = { ...next, bond: bondOf(pot) + bond, bondDay: day, bondToday: bondToday(pot, day) + bond }
  return { ok: true, pot: next, steep, bond, evolved, formName, locked: mealsOf(next).length >= BAR_SLOTS, snack: room <= 0 }
}

/** M240: the dish E feeds her from the hand, or null (nothing in hand that she eats, or the crosshair is not on a spirit) */
export function handFeedOf(held: string | null | undefined, aimed: { kind: string } | null | undefined): string | null {
  return aimed?.kind === 'spirit' && isSpiritDish(held) ? held : null
}

/** player-facing words: plain functional UI labels, UNSIGNED (for @lark) */
export const DISH_UI = {
  bond: 'Bond',
  bondLine: (n: number, today: number) => `Bond ${n} · today ${today}/${BOND_DAY_CAP}`,
  fed: (dish: string, bond: number, steep: string) => `${dish}${steep ? ` · ${steep}` : ''}${bond > 0 ? ` · bond +${bond}` : ''}`,
  full: 'She has had her fill today.',
  /** M240: the E prompt with a dish in hand, aimed at her */
  handFeed: (dish: string) => `E · feed ${dish}`,
  /** M240: her Steep is full, the dish is a snack (bond only) */
  snack: 'A snack: her Steep is full, so bond only.',
  dishes: 'Dishes',
  notForKeeper: 'Food is for spirits. Feed it to a garden spirit, in her panel. Potions heal you.',
}
