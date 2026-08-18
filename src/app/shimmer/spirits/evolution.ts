// Whether a spirit may take its second form, and taking it. #262 slice ④, 2026-08-18.
//
// ── ★★ THE RULE IS A STANDING CONDITION, NEVER AN EDGE, AND THAT IS THE WHOLE FILE ─────────────
// `addXP` detected evolution as a TRANSITION — `formStage(level)` changing from 'base' to 'second'
// on the call that crossed level 34. That works only if the answer is always available at the
// instant of crossing, which was true under the premise this slice deletes: the old overlay let the
// player PICK an element, so crossing 34 always resolved.
//
// Canon refuses the pick. `game/alchemy.md` rules the form is *"set at level 34 by dominant
// infusion"* and that the Infusions are the only road to an evolved form — so a spirit can cross 34
// with **no lean at all**, or with a **tie**, and simply have no form to take yet. Under an
// edge-triggered rule that spirit is base FOREVER: `prevStage === newStage` on every later level, so
// the flag never fires again no matter how many infusions are poured afterwards. The keeper does
// everything right and nothing ever happens.
//
// So the question is asked as "is this spirit owed a form RIGHT NOW", which is answerable at any
// moment — after a pour, on opening a panel, on load — and cannot be missed by being asked late.
//
// ⚠ AWAKENED (level 67) IS DELIBERATELY NOT HERE. It needs a `branch` on Spirit that does not
// exist — `grimoire-tab.tsx` says the same thing about the 160 awakened entries it cannot count.
// Guessing a branch would be accidental canon on 160 ruled forms. Second form only, and the type
// says so.
import type { Spirit, Element } from './spirit'
import { SECOND_FORM_NAMES, dominantInfusion, infusionTotal, speciesDisplayName } from './spirit'
import { EVOLUTION_THRESHOLDS } from './evolution-config'

export interface PendingEvolution {
  stage: 'second'
  element: Exclude<Element, 'base'>
  /** The ruled second-form name for this species+element — canon's grid, never composed here. */
  formName: string
}

/**
 * Why this spirit is not evolving, in the keeper's terms. `null` means it IS owed a form.
 *
 * ⚠ FOUR REASONS, NOT A BOOLEAN, for the same reason `applyInfusion`'s refusals are typed: "not
 * high enough yet", "you have never infused them", "they are pulled two ways" and "they already
 * have a form" are four different things to do next, and a panel that knows only "no" can only
 * shrug. `tied` in particular is the one a keeper would otherwise read as a bug — the bar is full,
 * the level is there, and nothing happens.
 */
export type EvolutionBlocker = 'settled' | 'too-young' | 'no-infusions' | 'tied'

export function evolutionBlocker(spirit: Spirit): EvolutionBlocker | null {
  if (spirit.element !== 'base') return 'settled'
  if (spirit.level < EVOLUTION_THRESHOLDS.secondFormLevel) return 'too-young'
  if (infusionTotal(spirit.infusions) === 0) return 'no-infusions'
  if (!dominantInfusion(spirit.infusions)) return 'tied'
  return null
}

/** The form this spirit is owed right now, or null. Pure — asks, never writes. */
export function pendingEvolution(spirit: Spirit): PendingEvolution | null {
  if (evolutionBlocker(spirit) !== null) return null
  const element = dominantInfusion(spirit.infusions)!
  return { stage: 'second', element, formName: secondFormName(spirit, element) }
}

/**
 * The ruled name for a species' second form in an element.
 *
 * ⚠ FALLS BACK TO THE SPECIES NAME, NEVER TO A COMPOSED STRING. `SECOND_FORM_NAMES` is canon's
 * 40-entry grid and the canon gate watches it; inventing "Storm Fox" for a missing cell would put a
 * name canon never ruled in front of a player at the single most memorable moment in the game.
 */
export function secondFormName(spirit: Spirit, element: Exclude<Element, 'base'>): string {
  return SECOND_FORM_NAMES[spirit.species]?.[element] ?? speciesDisplayName(spirit.species)
}

/**
 * Take the form. Returns what happened, or null if nothing was owed.
 *
 * ⚠ THE ONLY PERSISTENT WRITE IS `element`, and that is deliberate — `formStage` is derived from
 * level, stats are derived from stage, and moves are looked up per element. Writing anything else
 * here would create a second copy of a fact the rest of the game already computes.
 *
 * ⚠ ASKED THROUGH `pendingEvolution`, never re-deriving the condition. Two copies of "may this
 * spirit evolve" is exactly how a UI ends up offering something the engine then refuses.
 */
export function evolveSpirit(spirit: Spirit): PendingEvolution | null {
  const due = pendingEvolution(spirit)
  if (!due) return null
  spirit.element = due.element
  return due
}
