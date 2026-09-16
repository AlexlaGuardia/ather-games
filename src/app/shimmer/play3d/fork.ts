// The fork on Rune Hold's square — pure. Where the guide trail points and what the chip says,
// from the mortal side's own save flags.
//
// ── ★ CANON (`world/rune-hold.md` › THE SQUARE IS THE FORK, ruled 2026-09-11) ─────────────────
// The player arrives in Rune Hold as a traveler and the crossroads square is the game's fork:
// follow Greg through the Spirit Corner into the Ather story, or follow the town into the
// Travelers Station and the galaxy. "The choice is made by walking, not by a menu." Nothing here
// is a lock: the trail is a suggestion the keeper can ignore, and the station is a door, not a
// branch they are barred from after meeting Greg.
//
// ── THE BUILD (Alex, 2026-09-16: "from here in the tutorial they should have the trail to greg
//    and he can lead them to the moonwell glade tutorial or if they go into the travelers station
//    the crucible and expeditions tutorial can kick off") ─────────────────────────────────────
// The trail is the voxel guide trail (`voxel3d/guide-trail.ts`, the same motes), aimed by this
// file instead of `guide-target.ts`: Greg's corner until he has spoken, then his door, then
// nothing — the crossing ends the mortal side's part. Stepping into the Travelers Station takes
// the trail off Greg: the keeper has chosen by walking, and a trail that kept pointing back at the
// corner would be the menu canon forbids. ⚠ The station's own tutorial (who greets, what is
// enrolled, what the first expedition teaches) is UNRULED and its lines are @lark's — see
// CANON_GAPS. Until then the station branch has a chip and no script.

import type { GuideTarget, Spot } from '../voxel3d/guide-target'

/** The two flags this reads; both persist in the play3d save's `flags`. */
export const MET_GREG_FLAG = 'metGregSquare'
export const STATION_FLAG = 'stationEntered'

export interface ForkFlags { metGreg: boolean; stationEntered: boolean }

export const forkFlags = (flags: Record<string, boolean>): ForkFlags =>
  ({ metGreg: !!flags[MET_GREG_FLAG], stationEntered: !!flags[STATION_FLAG] })

/** Greg's talk range, a shade over — the trail goes dark inside it; the door's is a step. */
const TALK = 3.5
const DOOR = 1.5

/**
 * Where the trail points, or null. Only on the square (`zone === 'rune-hold'`): inside the shop,
 * the station or the range there is nothing for it to say.
 */
export function forkTarget(zone: string, f: ForkFlags, greg: Spot, door: Spot): GuideTarget | null {
  if (zone !== 'rune-hold') return null
  if (f.stationEntered) return null
  if (!f.metGreg) return { ...greg, kind: 'greg', hideBelow: TALK }
  return { ...door, kind: 'door', hideBelow: DOOR }
}

/**
 * The objective chip's value (the label is always "objective"). Build copy, not dialogue: canon's
 * own nouns, no invented voice. Null = no chip.
 */
export function forkObjective(zone: string, f: ForkFlags): string | null {
  if (f.stationEntered) return zone === 'rune-hold' || zone === 'travelers-station' || zone === 'firing-range' ? 'the way out — the Travelers Station' : null
  if (zone !== 'rune-hold') return null
  return f.metGreg ? 'after Greg — through the corner door' : 'the old man at the corner door'
}
