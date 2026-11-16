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
//   · the reel is a tug you CANNOT LOSE: the rinn PULLS (give it line: let go) and RESTS (draw it in: hold). Pull
//     against a pull and the tension tops out, the rinn takes some line back, and that is ALL: the line never parts,
//     the rinn never slips away, a clumsy reel is only a slower one. It is a conversation, not a fight.
// ⚖ Bait and the reel are [OPEN] for Magii (canon names neither; Alex asked for both, 11-15).
//
// Catch table: canon's eight rinn, four tiers (Shimmerscale/Clickclaw · Glowfin/Ribboneel · Moonkoi/Pearlshell · Crystal
// Rinn), canon XP (15 / 45 / 120 / 350), the level gates of world/resources.ts' rinning nodes (1 / 4 / 7, Crystal Rinn
// 10, canon's Tier 4). The Mana Springs zone (forestry.ts, this season's) tips the table toward the rarer rinn.
//
// ★ PURE.

import type { Zone } from './forestry'

export const BAIT = 'bait'
export const CAST_RANGE = 14

export interface Rinn { id: string; name: string; tier: 1 | 2 | 3 | 4; level: number; xp: number; blurb: string }
export const RINN: Rinn[] = [
  { id: 'shimmerscale', name: 'Shimmerscale', tier: 1, level: 1, xp: 15, blurb: 'Tiny, warm-scaled. Schools of them catch the light.' },
  { id: 'clickclaw', name: 'Clickclaw', tier: 1, level: 1, xp: 15, blurb: 'Small crustacean. Clicks when annoyed. Surprisingly tasty.' },
  { id: 'glowfin', name: 'Glowfin', tier: 2, level: 4, xp: 45, blurb: 'Soft bioluminescent scales. Nutritious. Spirits love it raw.' },
  { id: 'ribboneel', name: 'Ribboneel', tier: 2, level: 4, xp: 45, blurb: 'Long, slippery, iridescent. Prized for potion-making.' },
  { id: 'moonkoi', name: 'Moonkoi', tier: 3, level: 7, xp: 120, blurb: 'Beautiful silver-gold. Slow, patient catch. Worth the wait.' },
  { id: 'pearlshell', name: 'Pearlshell', tier: 3, level: 7, xp: 120, blurb: 'Occasionally contains a small Ather pearl.' },
  { id: 'crystal_rinn', name: 'Crystal Rinn', tier: 4, level: 10, xp: 350, blurb: 'A Rinn made partly of crystallized mana. Catching one feels like holding a wish.' },
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

// ── the reel: give and take ─────────────────────────────────────────────────────────────────────────────
export interface Reel {
  tier: number
  /** 0..1, how far in the rinn is; 1 = landed */
  progress: number
  /** 0..1, how hard the line is pulling */
  tension: number
  /** what the rinn is doing, and for how much longer (s) */
  mood: 'pull' | 'rest'
  moodLeft: number
  /** times it took line back (a slower reel, never a loss) */
  slips: number
}
const PULL_S = [0, 0.9, 1.1, 1.3, 1.6], REST_S = [0, 1.4, 1.2, 1.0, 0.9]
const DRAW = [0, 0.32, 0.24, 0.18, 0.13]       // progress a second, reeling a resting rinn
const SLIP = 0.12                               // progress the rinn takes back when the tension tops out ...
const TIRE = 0.85                               // ... and each time it does, it takes less: the rinn TIRES, so even a reel
                                                // that fights every pull lands in the end (a clumsy reel is only slower;
                                                // the first cut never landed a tier 3 or 4 that way)

export function newReel(tier: number, rng: () => number): Reel {
  return { tier, progress: 0.08, tension: 0, mood: 'rest', moodLeft: REST_S[tier] * (0.6 + rng() * 0.6), slips: 0 }
}

/** One step. `holding` = the keeper is reeling. Returns the next reel; landed when progress reaches 1. */
export function stepReel(r: Reel, dt: number, holding: boolean, rng: () => number): Reel {
  const n = { ...r }
  n.moodLeft -= dt
  if (n.moodLeft <= 0) {
    n.mood = n.mood === 'pull' ? 'rest' : 'pull'
    n.moodLeft = (n.mood === 'pull' ? PULL_S[n.tier] : REST_S[n.tier]) * (0.6 + rng() * 0.8)
  }
  if (n.mood === 'rest') {
    if (holding) n.progress += DRAW[n.tier] * dt              // take: it comes in
    n.tension = Math.max(0, n.tension - 1.2 * dt)
  } else {
    if (holding) n.tension += (0.9 + 0.15 * n.tier) * dt     // reeling against a pull: the line tightens
    else { n.tension = Math.max(0, n.tension - 0.8 * dt); n.progress -= 0.02 * dt }   // give: a little line runs out
    if (n.tension >= 1) { n.tension = 0.35; n.progress -= SLIP * TIRE ** n.slips; n.slips++ }   // it takes line back (less each time); nothing breaks
  }
  n.progress = Math.max(0.02, Math.min(1, n.progress))
  return n
}
export const landed = (r: Reel) => r.progress >= 1
