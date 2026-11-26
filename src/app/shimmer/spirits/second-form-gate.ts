// BETA M201 (play, 2026-11-26): THE SECOND-FORM STAT GATE. Canon RULED athernyx b0f1d0d (world/spirits-species.md ›
// Second Form, amended 11-26, Alex): the dominant elemental infusion stays the ONLY road to a second form (game/alchemy.md);
// it is GATED BY A STAT REQUIREMENT tied to the element she leans to, not by level 34 (levels are retired; growth runs to
// 9999). "Which stat, and the thresholds = Jin's." This file is those numbers. Pure: no React, no storage.
//  - GATE_STAT: one TRAINABLE stat per element, so a keeper can reach the bar by growth (fighting) AND training (play).
//    Read off ELEMENT_STAT_MODS (evolution-config.ts), each element's own lead, made one-to-one over the four training
//    stats: mana -> VIG, storm -> PWR, earth -> GRD, water -> AGI.
//  - SECOND_FORM_BAR[species][element]: derived from the species' FIXED base (open/ather/spirit-growth.ts SPECIES_BASE) as
//    round(BAR.MULT x base + BAR.ADD). With BAR {2, 10}, a stat at base 20 needs 50: full training (TRAIN.cap = +20%
//    since M200, so 24) still asks real growth; no training asks ~26 growths. Every species needs real growth or training, never neither.
//  - BAR_TUNED: per-species x per-element overrides. Empty on purpose: each base spirit's numbers are tuned in its own M202
//    slice (one spirit at a time); an override beats the derived number and nothing else changes.
// ⚠ NOT in evolution-config.ts: the dev Evolution editor (save-map route) REGENERATES that file whole, and would drop this.
import type { Species, Element } from './spirit'
import { SPECIES_BASE } from '../open/ather/spirit-growth'

export type FormElement = Exclude<Element, 'base'>
export const FORM_ELEMENTS: readonly FormElement[] = ['mana', 'storm', 'earth', 'water']
export type GateStat = 'pwr' | 'grd' | 'agi' | 'vig'
/** reads one of her stats NOW (real; growth + training). The open world passes spirit-stats statValue. */
export type StatOf = (k: GateStat) => number

/** the stat each element's bar reads (Jin's, canon b0f1d0d leaves it to the game) */
export const GATE_STAT: Record<FormElement, GateStat> = { mana: 'vig', storm: 'pwr', earth: 'grd', water: 'agi' }
/** DIALS (Jin's): the bar = round(MULT x her species base in that stat + ADD) */
export const BAR = { MULT: 2, ADD: 10 }
/** per-species overrides (M202 tunes each base spirit here); a missing cell = the derived number */
export const BAR_TUNED: Partial<Record<Species, Partial<Record<FormElement, number>>>> = {}

export const derivedBar = (sp: Species, el: FormElement) => Math.round(BAR.MULT * SPECIES_BASE[sp][GATE_STAT[el]] + BAR.ADD)
/** the full table, species x element: what her leaning stat must reach for that second form */
export const SECOND_FORM_BAR: Record<Species, Record<FormElement, number>> = Object.fromEntries(
  (Object.keys(SPECIES_BASE) as Species[]).map(sp => [sp, Object.fromEntries(FORM_ELEMENTS.map(el => [el, BAR_TUNED[sp]?.[el] ?? derivedBar(sp, el)]))]),
) as Record<Species, Record<FormElement, number>>

export type FormBar = { element: FormElement; stat: GateStat; need: number; have: number; met: boolean; fill: number }
/** one element's bar for this spirit, now. `have` is real (the panel rounds); met = have >= need. */
export function formBar(sp: Species, el: FormElement, statOf: StatOf): FormBar {
  const stat = GATE_STAT[el], need = SECOND_FORM_BAR[sp][el], raw = statOf(stat), have = Number.isFinite(raw) ? raw : 0
  return { element: el, stat, need, have, met: have >= need, fill: Math.max(0, Math.min(1, have / need)) }
}
/** all four bars, in FORM_ELEMENTS order */
export const formBars = (sp: Species, statOf: StatOf): FormBar[] => FORM_ELEMENTS.map(el => formBar(sp, el, statOf))
