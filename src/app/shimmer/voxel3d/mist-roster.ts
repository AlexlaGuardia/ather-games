// Which spirits answer a mist patch — the 2026-08-09 canon ruling, as code.
//
// ★ THIS FILE IS A TRANSCRIPTION, NOT A DESIGN. Every entry below is ruled in
// `CANON/game/shimmer-geography.md` › *The mist patches*, and `scripts/canon-drift.mjs` diffs this
// table against that file on every `npm run canon`. If you want to change a roster, the change
// happens in CANON first (Magii's seat) and lands here second. Editing this table alone is exactly
// the accidental-canon failure the drift gate exists to catch.
//
// ★ THE RULING'S LOAD-BEARING SENTENCE, because it is easy to lose in a lookup table:
// **a roster describes the GROUND, not the species.** Spirits have NO home-regions — that was ruled
// as a positive fact, not left as a gap, so a book may put any spirit anywhere in the garden
// forever. Mist is luminous mana and atmosphere is mana-resonance made visible, so a patch rings
// with the character of the ground it pools on and the spirits whose frequency answers it manifest
// there. A Manalotl crossing the Spirit Meadows is neither rare nor trespassing; it simply does not
// answer meadow-mist. **Never rename this to a habitat, a spawn table, or a biome roster** — those
// words all assert the thing canon explicitly refused.
//
// ★ FAIL CLOSED ON A ZONE CANON HAS NOT RULED. An unruled zone gets an EMPTY roster and therefore
// no resident — never a default, never a nearest-neighbour guess. Home and Moonwell generate no
// patches today (measured, not assumed — see zones.ts), so canon was never asked about them; if a
// terrain retune ever produces a patch there, `mist-roster.test.ts` fails loudly and the answer is
// a CANON_GAPS entry, not a line added here.

import type { Species, Element } from '../spirits/spirit'
import { SPECIES_NAMES } from '../spirits/spirit'
import type { ZoneAnchor } from '../voxel/zones'
import type { MistPatch } from '../voxel/mist'
import { hash2 } from '../voxel/noise'

export type ZoneId = ZoneAnchor['id']

/**
 * The ruled rosters. Species codes are canon's own shorthand (`world/spirits-species.md` › Quick
 * Reference); the canon NAME is what a player is ever shown — `SPECIES_NAMES` does that mapping,
 * and the Native-World Law means the code must never reach a screen ("fox" is designer shorthand;
 * the world has no fox).
 */
export const MIST_ROSTERS: Partial<Record<ZoneId, readonly Species[]>> = {
  // Open rolling ground under open sky; sunlit, grazed, running country.
  // Lepara is canon-anchored twice over: it is the line Thistle collars at this very region.
  'spirit-meadow': ['rabbit', 'water-bear', 'fox', 'hummingbird'],
  // Closed canopy, dim floor, a permanent twilight. Athowl + Noctyx are canon's own named
  // nocturnal pair; Luminara is living light, and light belongs where there is dark to answer.
  'twilight-thicket': ['owl', 'bat', 'firefly'],
  // Hot water over mineral terraces. Croakling is canon-anchored (Vetch's line, the east arm).
  // Shellmere sits here though its affinity is Earth: the roster keys to the ground's WHOLE
  // character, never a one-to-one element table, and a spring terrace IS mineral laid down over
  // ages. Read the ground, not a lookup.
  'mana-springs': ['frog', 'axolotl', 'turtle'],
  // The garden's frayed edge — thin, guttering mist calls only what can hold a frequency where the
  // ground is failing. A guttering patch offering a full roster would read as a healthy one.
  'the-outfields': ['water-bear', 'turtle'],
  // A village is lived-in ground, not left ground. Explicit rather than absent: the empty array is
  // the ruling, and the drift gate checks that it stays empty.
  'gloview-village': [],
}

/**
 * A corridor offers what it connects. The Mycelial Path forks to the Meadows and the Thicket, so
 * its mist calls from both and it has no roster of its own — ruled that way rather than given a
 * third list, because a road with its own exclusive spirits would be a place, and it is a passage.
 */
export const MIST_CORRIDORS: Partial<Record<ZoneId, readonly ZoneId[]>> = {
  'mycelial-path': ['spirit-meadow', 'twilight-thicket'],
}

/** Every species this zone's mist can call, corridors resolved. Empty = no resident forms here. */
export function rosterFor(zone: ZoneId | null | undefined): readonly Species[] {
  if (!zone) return []
  const direct = MIST_ROSTERS[zone]
  if (direct) return direct
  const from = MIST_CORRIDORS[zone]
  if (!from) return []                       // fail closed — an unruled zone calls nothing
  const out: Species[] = []
  for (const z of from) for (const s of MIST_ROSTERS[z] ?? []) if (!out.includes(s)) out.push(s)
  return out
}

/**
 * Which spirit stands in THIS patch — deterministic, so a patch's resident is the same one every
 * time you walk back to it until it is sparred. Keyed off the patch's own seed (already mixed from
 * the world seed and its cell) so two patches in one zone rarely show the same kind.
 *
 * `nonce` re-rolls it: after a spar the resident withdraws into the mist, and what answers that
 * ground NEXT is a different draw. Passing the withdrawal count keeps that deterministic too.
 */
export function residentFor(patch: MistPatch, zone: ZoneId | null | undefined, nonce = 0): Species | null {
  const roster = rosterFor(zone)
  if (!roster.length) return null
  const r = hash2(Math.round(patch.x) + nonce * 977, Math.round(patch.z) - nonce * 613, patch.seed ^ 0x5b17)
  return roster[Math.min(roster.length - 1, Math.floor(r * roster.length))]
}

/**
 * The canon display name — what a player sees. Goes through `SPECIES_NAMES` rather than any local
 * table so the Native-World Law is enforced by construction: there is no path from this file to a
 * screen that could print "frog".
 */
export const residentName = (s: Species): string => SPECIES_NAMES[s]

/**
 * The element a resident reads as, for the presence's tint. Deliberately the species' NATURAL
 * affinity and nothing more — a wild spirit answering its own ground has lived no bonded life that
 * could have earned it another path ("affinity is a lean, not a leash" is about a RAISED spirit).
 * Kept as canon's own affinity column rather than derived from the roster's zone, so the tint can
 * never imply that the ground assigned the element.
 */
export const SPECIES_AFFINITY: Record<Species, Exclude<Element, 'base'>> = {
  fox: 'mana',
  axolotl: 'water',
  'water-bear': 'earth',
  turtle: 'earth',
  owl: 'mana',
  frog: 'water',
  firefly: 'mana',
  rabbit: 'earth',
  hummingbird: 'storm',
  bat: 'storm',
}
