// THE REEL, RE-RULED (2026-11-16, /magii + Alex; game/shimmer-skilling.md › Skill 4): THE RINN CAN GET AWAY.
// Alex: "each fish has a pattern and the player has to give a little when it fights and take when it gives in.. like
// controlling a bobber in a zone and you cant let it touch the edges of the zone as it moves in that fish pattern toward
// the player". The line never breaks; a rinn that gets away costs the bait and the chance, nothing else.
//
// One bar, far end (0) to the keeper (1):
//   · the ZONE is the rinn. It moves to its kind's PATTERN: when it FIGHTS it runs away (toward 0), when it GIVES IN it
//     comes toward you (toward 1). Over the whole pattern it comes in, so a keeper who stays with it lands it when the
//     zone reaches the keeper's end.
//   · the BOBBER is the keeper. HOLD = take (it climbs toward you), LET GO = give (it slides back). It has weight: it
//     drifts on after you change your mind, which is the skill.
//   · the bobber TOUCHING THE ZONE'S EDGE strains the line; strain held past a breath (STRAIN_S) and the rinn is gone.
//     That breath is the one forgiveness: a frame's graze is not a loss, staying out is. (Jin's: canon makes the edge
//     the rule; how long a touch is a touch is tuning.)
// Jin's (canon hands these to the build): the patterns per kind, zone size, difficulty by tier and level, what the
// rinstick tier eases (`ease` widens the zone).
//
// ★ PURE. Both worlds' rinning (ather/rinning.ts, continent/rinning-nyx.ts) run this.

/** one kind of rinn on either side's catch table (ather/rinning.ts › RINN, continent/rinning-nyx.ts › NYX_RINN) */
export interface Rinn { id: string; name: string; tier: 1 | 2 | 3 | 4; level: number; xp: number; blurb: string; pattern: Pattern }
/** how far out a cast reaches (m) */
export const CAST_RANGE = 14
/** XP a catch is worth by tier (canon's Ather numbers, game/shimmer-skilling.md › Rinning XP; the Nyx side uses the same) */
export const RINN_XP = [0, 15, 45, 120, 350] as const

export type Pattern = 'steady' | 'darter' | 'sulker' | 'zigzag' | 'roller' | 'sidler'
export const PATTERNS: Pattern[] = ['steady', 'darter', 'sulker', 'zigzag', 'roller', 'sidler']
/** what the keeper reads on the bar for each kind's habit (the reel bar's line) */
export const PATTERN_TELL: Record<Pattern, string> = {
  steady: 'pulls and gives, even as a tide',
  darter: 'darts without warning',
  sulker: 'sulks, then bolts',
  zigzag: 'twists back and forth',
  roller: 'rolls in long slow swings',
  sidler: 'shuffles in little steps',
}

/** one leg of a pattern: which way it goes (−1 fights, +1 gives in, 0 holds still), how fast (bar/s), how long (s),
 *  and how sharply it gets up to speed (1/s: high = a dart) */
interface Leg { dir: -1 | 0 | 1; speed: number; dur: number; snap: number }
/** each kind's habit, as a cycle of legs; jittered per leg by rng so no two runs are the same */
const LEGS: Record<Pattern, Leg[]> = {
  steady: [{ dir: 1, speed: 0.1, dur: 1.5, snap: 3 }, { dir: -1, speed: 0.12, dur: 1.2, snap: 3 }],
  darter: [{ dir: 0, speed: 0, dur: 1.3, snap: 4 }, { dir: -1, speed: 0.24, dur: 0.32, snap: 12 }, { dir: 0, speed: 0, dur: 1.0, snap: 4 }, { dir: 1, speed: 0.22, dur: 0.3, snap: 12 }],
  sulker: [{ dir: 0, speed: 0, dur: 1.8, snap: 5 }, { dir: 1, speed: 0.18, dur: 0.7, snap: 7 }, { dir: -1, speed: 0.2, dur: 0.7, snap: 7 }],
  zigzag: [{ dir: 1, speed: 0.15, dur: 0.55, snap: 7 }, { dir: -1, speed: 0.15, dur: 0.55, snap: 7 }],
  roller: [{ dir: 1, speed: 0.12, dur: 2.4, snap: 1.6 }, { dir: -1, speed: 0.13, dur: 2.2, snap: 1.6 }],
  sidler: [{ dir: 1, speed: 0.14, dur: 0.3, snap: 10 }, { dir: 0, speed: 0, dur: 0.35, snap: 10 }, { dir: -1, speed: 0.14, dur: 0.3, snap: 10 }, { dir: 0, speed: 0, dur: 0.3, snap: 10 }],
}
/** the come-in: under its habit every rinn drifts toward the keeper, a rarer one more slowly (sets how long a reel
 *  lasts: ~7 s for tier 1 … ~13 s for tier 4 for a keeper who stays with it) */
const DRIFT = [0, 0.085, 0.07, 0.058, 0.048]
/** tier makes a rinn's habit quicker and its zone narrower */
const SPEED_K = [0, 1, 1.15, 1.3, 1.45]
const HALF_W = [0, 0.17, 0.15, 0.13, 0.115]
/** the bobber: HOLD climbs, LET GO slides back, with weight */
export const BOB_ACCEL = 2.4, BOB_DRAG = 3.2
/** how long the bobber may sit at or past the zone's edge before the rinn is gone (s) */
export const STRAIN_S = 0.35
/** how close (fraction of the half-width) to the edge counts as touching it */
const EDGE = 0.97
/** M88: how far (bar) the zone's far edge may pull off the wall while a bobber rests on the wall without that counting as an edge */
const WALL_GRACE = 0.04

export interface Reel {
  pattern: Pattern
  tier: number
  /** zone centre and half-width on the bar (0 far … 1 the keeper) */
  zone: number
  half: number
  zoneV: number
  /** the keeper's bobber */
  bob: number
  bobV: number
  /** 0..1 of STRAIN_S: how long the line has been at the edge */
  strain: number
  leg: number
  legLeft: number
  legSpeed: number
  /** 0..1 how far in (for the bar's fill); landed at 1 */
  progress: number
  state: 'on' | 'landed' | 'gone'
  t: number
}

export function newReel(pattern: Pattern, tier: number, rng: () => number, ease = 1): Reel {
  const legs = LEGS[pattern], leg = Math.floor(rng() * legs.length)
  const half = HALF_W[tier] * ease
  return { pattern, tier, zone: 0.22, half, zoneV: 0, bob: 0.22, bobV: 0, strain: 0, leg, legLeft: legs[leg].dur * (0.7 + rng() * 0.6),
    legSpeed: legs[leg].speed * (0.85 + rng() * 0.3), progress: 0, state: 'on', t: 0 }
}

/** One step. `holding` = the keeper is taking line. Returns the next reel; `state` says landed / gone. */
export function stepReel(r: Reel, dt: number, holding: boolean, rng: () => number): Reel {
  if (r.state !== 'on') return r
  const n = { ...r }, legs = LEGS[n.pattern]
  n.t += dt
  n.legLeft -= dt
  if (n.legLeft <= 0) {
    n.leg = (n.leg + 1) % legs.length
    n.legLeft = legs[n.leg].dur * (0.7 + rng() * 0.6)
    n.legSpeed = legs[n.leg].speed * (0.85 + rng() * 0.3)
  }
  const L = legs[n.leg]
  // the rinn: its velocity eases toward its leg's (snap = how sharply), scaled by tier
  const want = DRIFT[n.tier] + L.dir * n.legSpeed * SPEED_K[n.tier]
  n.zoneV += (want - n.zoneV) * Math.min(1, L.snap * dt)
  n.zone += n.zoneV * dt
  // the far end is open water: a rinn run out to it turns and comes again; the keeper's end is where it lands
  if (n.zone - n.half < 0) { n.zone = n.half; n.zoneV = Math.max(0, n.zoneV) }
  // the keeper: hold climbs, let go slides back, with weight; the bar's ends stop it
  n.bobV += (holding ? BOB_ACCEL : -BOB_ACCEL) * dt
  n.bobV *= Math.exp(-BOB_DRAG * dt)
  n.bob += n.bobV * dt
  if (n.bob < 0) { n.bob = 0; n.bobV = Math.max(0, n.bobV) }
  if (n.bob > 1) { n.bob = 1; n.bobV = Math.min(0, n.bobV) }
  // the edge: at or past it strains the line; inside it eases back twice as fast
  // ★ M88 (Alex 11-22): the far wall is open water, not an edge. A zone pinned there with the bobber at or beyond its far
  // side (let go, resting at 0) is INSIDE: before this it read off = 1.0 and the rinn was gone with nothing to do.
  // A bobber resting ON the wall also gets a short grace while the zone pulls off it (WALL_GRACE of bar), so the turn from
  // fighting to coming in is a cue to take line, not an instant strain.
  const atWall = n.bob <= n.zone && (n.zone - n.half <= 1e-6 || (n.bob <= 1e-6 && n.zone - n.half <= WALL_GRACE))
  const off = atWall ? 0 : Math.abs(n.bob - n.zone) / n.half
  n.strain = off >= EDGE ? n.strain + dt / STRAIN_S : Math.max(0, n.strain - 2 * dt / STRAIN_S)
  if (n.strain >= 1) { n.state = 'gone'; return n }
  n.progress = Math.max(0, Math.min(1, (n.zone - 0.22) / (1 - n.half - 0.22)))
  if (n.zone + n.half >= 1) { n.zone = 1 - n.half; n.progress = 1; n.state = 'landed' }
  return n
}
export const landed = (r: Reel) => r.state === 'landed'
export const gone = (r: Reel) => r.state === 'gone'
