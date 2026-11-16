// RINNING IN THE WILDS (Alex 11-15: "selecting bait on the hotbar and interacting pulls out the players rinstick, from
// there the player can cast, do a little give and take game to reel in a rinn and then recast as long as they have the
// bait in their inventory").
//
// ★ THE CANON LINE, AND HOW THIS KEEPS IT. game/shimmer-skilling.md › Skill 4: *"Rinn are caught by simply waiting —
// there's no minigame"*, and › Rinsticks: *"you are asking a rinn, not tricking one"* (a rinstick is built from rinn;
// kin calls to kin). The voxel world already read that as refusing a SKILL TEST, not an interaction (engine/rin-cast.ts:
// "take the shape, drop the punishment"). The give-and-take keeps it the same way:
//   · the wait is engine/rin-cast.ts as is: a watched wait, a luminous RISE toward the float, a generous TAKE; a
//     missed take costs nothing, the rinn circles and comes again;
//   · ★ RE-RULED 11-16 (Alex): THE RINN CAN GET AWAY. The reel is shared/reel.ts: each kind's PATTERN moves a zone, the
//     keeper holds a bobber inside it (hold = take, let go = give); stay at the edge and it is gone. The line never
//     breaks; a lost rinn costs the bait and the chance. "Asking, not tricking" holds: the pattern is the rinn's own.
// Bait is canon now (an offering, one a cast, RULED 11-16).
//
// Catch table: canon's eight rinn, four tiers (Shimmerscale/Clickclaw · Glowfin/Ribboneel · Moonkoi/Pearlshell · Crystal
// Rinn), canon XP (15 / 45 / 120 / 350), the level gates of world/resources.ts' rinning nodes (1 / 4 / 7, Crystal Rinn
// 10, canon's Tier 4). The Mana Springs zone (forestry.ts, this season's) tips the table toward the rarer rinn.
//
// ★ PURE.

import type { Zone } from './forestry'
import type { Rinn } from '../shared/reel'
export type { Rinn } from '../shared/reel'

export const BAIT = 'bait'
export { CAST_RANGE } from '../shared/reel'

export const RINN: Rinn[] = [
  { id: 'shimmerscale', name: 'Shimmerscale', tier: 1, level: 1, xp: 15, blurb: 'Tiny, warm-scaled. Schools of them catch the light.', pattern: 'darter' },
  { id: 'clickclaw', name: 'Clickclaw', tier: 1, level: 1, xp: 15, blurb: 'Small crustacean. Clicks when annoyed. Surprisingly tasty.', pattern: 'sidler' },
  { id: 'glowfin', name: 'Glowfin', tier: 2, level: 4, xp: 45, blurb: 'Soft bioluminescent scales. Nutritious. Spirits love it raw.', pattern: 'steady' },
  { id: 'ribboneel', name: 'Ribboneel', tier: 2, level: 4, xp: 45, blurb: 'Long, slippery, iridescent. Prized for potion-making.', pattern: 'zigzag' },
  { id: 'moonkoi', name: 'Moonkoi', tier: 3, level: 7, xp: 120, blurb: 'Beautiful silver-gold. Slow, patient catch. Worth the wait.', pattern: 'roller' },
  { id: 'pearlshell', name: 'Pearlshell', tier: 3, level: 7, xp: 120, blurb: 'Occasionally contains a small Ather pearl.', pattern: 'sulker' },
  { id: 'crystal_rinn', name: 'Crystal Rinn', tier: 4, level: 10, xp: 350, blurb: 'A Rinn made partly of crystallized mana. Catching one feels like holding a wish.', pattern: 'darter' },
]
const TIER_WEIGHT = [0, 10, 4, 1.6, 0.35]   // the table leans common; rarer tiers are a treat
const SPRINGS_RARE = 1.8                      // the Mana Springs' rarer tiers are this much likelier

/** What bites: weighted by tier among the rinn the keeper's Rinning level can hook; the zone tips the odds. */
export function rollRinn(level: number, zone: Zone, rng: () => number): Rinn {
  const open = RINN.filter(r => r.level <= level)
  const w = open.map(r => TIER_WEIGHT[r.tier] * (zone === 'springs' && r.tier > 1 ? SPRINGS_RARE : 1))
  let x = rng() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < open.length; i++) { x -= w[i]; if (x <= 0) return open[i] }
  return open[open.length - 1]
}
