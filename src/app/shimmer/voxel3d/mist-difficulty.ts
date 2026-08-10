// How strong the thing standing in a mist patch is — the last piece of the 2026-08-09 ruling that
// was left to Jin, and the one that was still a placeholder.
//
// ★ THE BUG THIS FIXES IS A DOCTRINE VIOLATION, NOT A NUMBER. Slice 2 built the resident at
// `wild.level = party average`. That is EXACTLY the model `engine/encounters.ts` deleted on
// 2026-07-23 (Alex's ruling, and the comment block at the top of that file is the argument):
// levels used to be offsets from the player, so every area re-levelled itself to whoever walked in,
// out-levelling never paid, and the map had no shape. A mist patch that tracks your average is a
// patch you can never outgrow and never grow into — "go there when you're ready" cannot mean
// anything, and `arena.ts`'s levelEdge term goes back to being a treadmill. Same class of miss as
// slice 2's turn-based near-miss: reasoning from a nice-sounding principle instead of reading the
// system next door first.
//
// ★ SO A PATCH'S LEVEL IS A PROPERTY OF THE GROUND, like every other place in the garden. The
// difficulty curve a keeper feels is GEOGRAPHY: walk further out, meet stronger mist. That is the
// same sentence the roster ruling already made canon one layer up — a patch describes the ground,
// not the species — now spent on the numbers as well as the names.
//
// ★ THE BANDS ARE READ, NOT COPIED. `bandFor` looks the region up in `ENCOUNTER_TABLES` and uses
// the band the 2D ring already assigns it. A transcribed copy would drift until the Twilight
// Thicket meant Lv 9 through one surface and Lv 14 through another, and nobody would find out
// from a test. Only `the-outfields` needs an override, because the 2D ring has no such place.
//
// ★ FAIL CLOSED. No band ⇒ no resident, exactly as no roster ⇒ no resident. A zone that grows mist
// but has never been given a band must produce NOTHING rather than a level-1 default; the oracle
// asserts band-set == roster-set so a new region cannot half-arrive.

import { ENCOUNTER_TABLES } from '../engine/encounters'
import type { MistPatch } from '../voxel/mist'
import { hash2 } from '../voxel/noise'
import { rosterFor, type ZoneId } from './mist-roster'

export type Band = readonly [number, number]

/**
 * Regions the 2D ring never had, so there is no band to read. The Outfields are the garden's frayed
 * edge — the one zone that is not fully tended (`ZoneAnchor.tended` 0.45), where the greying feeds
 * out and the Hollows and ruins concentrate. Canon already says its guttering mist calls "only what
 * can hold a frequency where the ground is failing"; this is that sentence in levels. Placed in the
 * deep ring rather than at the very top: the Threshold (Lv 19-22) is still the far end of the line.
 */
const BAND_OVERRIDES: Partial<Record<ZoneId, Band>> = {
  'the-outfields': [15, 18],
}

/**
 * How far a worn-in patch can drift up its own band. Sparring the same ground repeatedly nudges
 * what answers toward the top of the band and NO FURTHER — the region's shape is absolute, so a
 * much-worked Meadows dell may become the stiffest meadow-mist there is and still never out-rank
 * the Thicket. Without the cap this is the treadmill sneaking back in through the ledger.
 */
export const WORN_CAP = 2

/** Chance a second spirit answers alongside the first, in a region whose roster can field two. */
export const PAIR_CHANCE = 0.3

/** The absolute level band this region's mist gathers at, or null — no band, no resident. */
export function bandFor(zone: ZoneId | null | undefined): Band | null {
  if (!zone) return null
  const over = BAND_OVERRIDES[zone]
  if (over) return over
  const table = ENCOUNTER_TABLES[zone]
  return table ? table.levels : null
}

/**
 * The level of the spirit standing in this patch, or null when the ground calls nothing.
 *
 * Deterministic in (patch, zone, nonce), like `residentFor` — walk away from a patch and back and
 * it is the same spirit at the same level. `nonce` is the withdrawal count, so a sparred patch
 * re-rolls its level with its species when the mist gathers again.
 */
export function residentLevel(patch: MistPatch, zone: ZoneId | null | undefined, nonce = 0): number | null {
  const band = bandFor(zone)
  if (!band) return null
  const [lo, hi] = band
  const span = Math.max(0, hi - lo)
  const draw = Math.floor(hash2(Math.round(patch.x) + nonce * 409, Math.round(patch.z) - nonce * 251, patch.seed ^ 0x1e7e1) * (span + 1))
  return Math.min(hi, lo + Math.min(span, draw) + Math.min(WORN_CAP, nonce))
}

/** Whether the ground calls a pair. False wherever the roster cannot field two distinct kinds. */
export function answersInPair(patch: MistPatch, zone: ZoneId | null | undefined, nonce = 0): boolean {
  if (rosterFor(zone).length < 2) return false
  if (!bandFor(zone)) return false
  return hash2(Math.round(patch.x) - nonce * 733, Math.round(patch.z) + nonce * 197, patch.seed ^ 0x7a12) < PAIR_CHANCE
}

/**
 * The second spirit's level. Shape borrowed from play3d's `buildWildParty` (a step below the lead,
 * jittered) rather than re-derived, for the same reason the XP curve was borrowed: two independent
 * derivations of the same idea drift. Floored at the band's own bottom — a pair is still this
 * ground, not a softer version of it.
 */
export function secondLevel(patch: MistPatch, zone: ZoneId | null | undefined, leadLevel: number, nonce = 0): number {
  const band = bandFor(zone)
  const lo = band ? band[0] : 1
  const d = hash2(Math.round(patch.z) + nonce * 89, Math.round(patch.x) - nonce * 631, patch.seed ^ 0x2ec0) < 0.5 ? 1 : 2
  return Math.max(lo, Math.max(1, leadLevel - d))
}

/**
 * ⚠ THERE IS DELIBERATELY NO PARTY-SIZE FLOOR HERE, and that is a departure from `buildWildParty`,
 * which only ever adds a second wild spirit when the player has more than one. That floor exists
 * because a 2D grass encounter is sprung on you — you are in the fight before you know its shape.
 * A mist patch is the opposite by construction: the presence is visible from outside the fog and
 * the prompt names it and its level before you press E. The consent gate already does the job the
 * fairness floor was doing, and doing it again here would put a player-relative term back into a
 * file whose entire point is that the ground does not care who walked up.
 *
 * ⚠ AND NO TIER LEVER. `ArenaAITier` moves decision quality, and 'trained' means a spirit worked by
 * a handler — the collar. A mist resident is a wild spirit answering its own ground, so it fights
 * on instinct at every band. Difficulty here is levels and numbers, never a better brain.
 */
export const RESIDENT_TIER = 'wild' as const
