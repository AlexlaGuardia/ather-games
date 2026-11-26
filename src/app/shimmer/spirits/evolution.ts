// Whether a spirit may take its second form, and taking it. #262 slice ④, 2026-08-18.
// ★ M201 (2026-11-26, canon b0f1d0d): the LEVEL-34 GATE IS GONE. The form is still set by the dominant infusion; it is now
// gated by a STAT BAR on the element she leans to (second-form-gate.ts). Below, "34" is the history of the old rule.
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
import { formBar, type FormBar, type StatOf } from './second-form-gate'
import { grownStat } from '../open/ather/spirit-growth'

export interface PendingEvolution {
  stage: 'second'
  element: Exclude<Element, 'base'>
  /** The ruled second-form name for this species+element — canon's grid, never composed here. */
  formName: string
}

/**
 * Why this spirit is not evolving, in the keeper's terms. `null` means it IS owed a form.
 *
 * ⚠ FOUR REASONS, NOT A BOOLEAN, for the same reason `applyInfusion`'s refusals are typed: "she has not reached the bar
 * yet", "you have never infused them", "they are pulled two ways" and "they already have a form" are four different things
 * to do next, and a panel that knows only "no" can only shrug. `tied` in particular is the one a keeper would otherwise
 * read as a bug.
 *
 * M201 (canon b0f1d0d): `too-young` (level 34) is GONE. `below-bar` = she leans to an element but her stat for that
 * element (second-form-gate.ts GATE_STAT) is under its bar. The lean is read FIRST: the bar belongs to the element she
 * leans to, so there is no bar to be below until there is a lean.
 */
export type EvolutionBlocker = 'settled' | 'no-infusions' | 'tied' | 'below-bar'

/** what the gate reads of a spirit: the legacy Spirit has all three; the open world builds one from a planter */
export type GateSubject = Pick<Spirit, 'species' | 'element' | 'infusions'> & { level?: number }

/**
 * ⚠ LEGACY READING ONLY. The old engines (voxel3d / play3d) keep a `level` and no stat record; their spirits read the
 * bar off the same growth curve the open world uses, with growths = level - 1 (spirit-growth.ts: the hidden level runs
 * 1..MAX_LEVEL). The open world NEVER uses this: it passes spirit-stats statValue (growth + training).
 */
export const legacyStatOf = (s: GateSubject): StatOf => k => grownStat(s.species, k, Math.max(0, (s.level ?? 1) - 1))

/** the bar of the element she leans to, or null (no lean / tied / settled) */
export function leaningBar(spirit: GateSubject, statOf: StatOf = legacyStatOf(spirit)): FormBar | null {
  if (spirit.element !== 'base') return null
  const el = dominantInfusion(spirit.infusions)
  return el ? formBar(spirit.species, el, statOf) : null
}

export function evolutionBlocker(spirit: GateSubject, statOf: StatOf = legacyStatOf(spirit)): EvolutionBlocker | null {
  if (spirit.element !== 'base') return 'settled'
  if (infusionTotal(spirit.infusions) === 0) return 'no-infusions'
  const el = dominantInfusion(spirit.infusions)
  if (!el) return 'tied'
  if (!formBar(spirit.species, el, statOf).met) return 'below-bar'
  return null
}

/** The form this spirit is owed right now, or null. Pure — asks, never writes. */
export function pendingEvolution(spirit: GateSubject, statOf: StatOf = legacyStatOf(spirit)): PendingEvolution | null {
  if (evolutionBlocker(spirit, statOf) !== null) return null
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
export function secondFormName(spirit: Pick<Spirit, 'species'>, element: Exclude<Element, 'base'>): string {
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
export function evolveSpirit(spirit: GateSubject, statOf: StatOf = legacyStatOf(spirit)): PendingEvolution | null {
  const due = pendingEvolution(spirit, statOf)
  if (!due) return null
  spirit.element = due.element
  return due
}
