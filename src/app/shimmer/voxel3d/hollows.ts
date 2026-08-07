// The Hollows — unanswered drain-grey, bodied. The pure half: eligibility, drift, guttering.
//
// ★ CANON (ruled 2026-08-07, CANON/game/shimmer-geography.md › THE HOLLOWS — read it before
// touching what these ARE): a Hollow is the greying wearing a shape. Not a spirit, not a Mana'mal,
// not a collared anything — absence given just enough form to move. It has HP because there is
// NOTHING IN IT TO FREE: the verb is DISPERSE (gun or cast puts frequency back into a place that
// had none), never kill, never un-collar. It forms ONLY where the ground was already drained —
// darkness is the CONDITION, never the CAUSE. A Hollow appearing on healthy ground is the
// 2026-06-16 failure returning; the eligibility gate below is that sentence as code.
//
// ⚠ BLOCKOUT. The locked look is owed a design-briefs + /picaso pass; this fixes behaviour only.
// Everything else — counts, tiers, drops, difficulty, whether they linger in deep-greyed pockets
// by day — is build tuning and is Jin's (the ruling says so explicitly).
//
// ★ THE BODY IS A GLIDE, NOT A WALKER. A smear has no feet: it drifts toward the keeper at a
// fixed hover above the ground line, unbothered by single blocks. That is cheaper than pathing
// and reads MORE wrong-in-the-right-way — terrain does not slow it, which is quietly the scariest
// thing about it. Speed sits under run speed: a keeper who runs, escapes. Menace, not a wall.

import { greyness } from '../voxel/biome'
import { spawnDark } from '../voxel/light'

export interface HollowState {
  x: number; y: number; z: number
  hp: number
  /** 0 = fully formed .. 1 = guttered out (despawn). Driven up by dawn, never down. */
  gutter: number
  /** Per-hollow phase so a pack never pulses in sync. */
  phase: number
}

export const HOLLOW_HP = 30
export const HOLLOW_HOVER = 1.15     // metres above the ground line
export const HOLLOW_SPEED = 3.4      // < run speed: running away always works
export const HOLLOW_RADIUS = 0.85    // hit sphere for projectiles
/**
 * ★ THE SPAWN CYCLE, MINECRAFT'S SHAPE (researched + reworked 2026-08-07 eve).
 *
 * The first cut scanned ONE random column every 1.6s and Alex play-tested a night without meeting
 * a single Hollow. Minecraft's machine, verbatim from the wiki: EVERY eligible chunk gets a pack
 * attempt EVERY tick (20Hz) — coverage ~3,600× ours. The night fills in seconds and then the CAP
 * is the governor, not scan luck. Ported here with the numbers marked as kept or deliberately bent:
 *
 *   · sweep every loaded column per cycle (kept; our cycle is 0.4s, not 50ms — the cap fills
 *     within a tick or two anyway, and 20Hz would only burn frame budget re-proving it)
 *   · one anchor attempt per column per sweep, random x,z (kept — MC's exact structure)
 *   · pack of up to 4, per-mob ±5 TRIANGULAR random walk from the anchor (kept: ~85% land
 *     within 5 of the anchor, occasional stragglers — a smear, not a circle)
 *   · spawn window 24..(load edge); MC is 24..128 with instant despawn past 128 — our load
 *     radius is 96, so the despawn line sits there and the whole loaded night is spawn ground
 *   · cap = 0.1/column (MC: 70/289 ≈ 0.24/column — halved-and-some, because the ruling's read
 *     is a MENACE; MC density in open grey country read as a horde in the sim)
 *   · light: block light 0 absolute + internal sky ≤ 7 (MC 1.18+ verbatim — see NIGHT_SKY_MAX)
 */
export const SPAWN_CYCLE_S = 0.4     // full-coverage sweep cadence (MC: every tick; see above)
export const PACK_MAX = 4            // MC hostile pack max, kept — a pack is a mood, not an army
export const PACK_STEP = 5           // ±5 triangular per-mob walk step, MC verbatim
export const PLAYER_EXCLUSION = 24   // MC verbatim — it forms out of sight, never in your lap
export const DESPAWN_DIST = 96       // our load edge (MC uses 128 = its own spawn horizon)

/**
 * ★ MC 1.18+'s light rule, both halves (minecraft.wiki/w/Light, confirmed 2026-08-07):
 * block light MUST be 0, and INTERNAL sky light must be ≤ 7. Internal sky at MC midnight is 4,
 * not 0 — which means the tide comes in at DEEP DUSK, not only at pitch black. Our equivalent of
 * "internal sky" is skyOf(packed) · dayFactor; ≤ 7 opens the window at dayFactor ≤ 0.467 and the
 * first cut's `day === 0` gate was the strictest possible misreading of the same rule.
 */
export const NIGHT_SKY_MAX = 7
/** The window, from a day factor: could a fully open-sky spot spawn? (15 · day ≤ 7) */
export const hollowNight = (day: number): boolean => 15 * day <= NIGHT_SKY_MAX
/** Dawn wins: bodied Hollows gutter once effective sky climbs past this. Sits above
 *  NIGHT_SKY_MAX so the boundary has hysteresis — no spawn-and-gutter flap at the dusk line. */
export const GUTTER_SKY = 9

/**
 * At most this many bodied at once, scaled by how much world is loaded — a fixed cap on a
 * variable radius would make view distance change the danger. MC's constant is 70·chunks/289
 * ≈ 0.24/column; ours is 0.1 (full load ≈ 11) because the ruling reads menace, not horde.
 */
export const hollowCap = (loadedCols: number): number =>
  Math.min(12, Math.max(2, Math.round(loadedCols * 0.1)))

/** Pack size from one roll — flat 1..PACK_MAX. */
export const packSize = (roll: number): number =>
  1 + Math.min(PACK_MAX - 1, Math.floor(Math.max(0, Math.min(0.999, roll)) * PACK_MAX))

/**
 * The pack's ground: a RANDOM WALK from the anchor, one ±PACK_STEP triangular step per mate —
 * MC's exact scatter ("before each mob in the pack, the position is offset by ±5, triangular
 * distribution"). Triangular = sum of two uniforms, so most mates huddle near the anchor and the
 * odd one strays; offsets ACCUMULATE, so a pack can smear downhill like something pouring.
 * Positions only — the caller re-validates every one with `hollowEligible`, because a pack mate
 * is not exempt from the ruling (an anchor at a lit greyfield edge must not smear its pack onto
 * tended ground).
 */
export function packWalk(k: number, rand: () => number): { dx: number; dz: number }[] {
  const out: { dx: number; dz: number }[] = []
  let dx = 0, dz = 0
  for (let i = 1; i < k; i++) {
    dx += (rand() - rand()) * PACK_STEP
    dz += (rand() - rand()) * PACK_STEP
    out.push({ dx, dz })
  }
  return out
}

/**
 * May the grey body HERE, now? The whole ruling in one predicate:
 *   drained ground (the cause happened long ago) + dark (the condition) + dry land (a Hollow is
 *   a shape in the air over ground, not a thing in the water).
 *
 * ★ "Dark" is the LIGHT FIELD's word (2026-08-07). `packedLight` is light.ts's two-channel byte
 * at the spot the body would form; `day` is `dayFactor`'s 0..1. `spawnDark` keeps block light an
 * ABSOLUTE veto — the entire strategy layer: a keeper who lanterns their ground has bought it
 * back from the night, at any hour (*tended light holds grey off*). Sky passes at ≤ NIGHT_SKY_MAX
 * per MC 1.18+'s internal-light rule, so the tide starts at deep dusk, not pitch black.
 */
export function hollowEligible(
  x: number, z: number, seed: number,
  packedLight: number, day: number, surfaceH: number, seaLevel: number,
): boolean {
  if (!spawnDark(packedLight, day, NIGHT_SKY_MAX)) return false
  if (surfaceH <= seaLevel + 1) return false
  return greyness(x, z, seed) >= 0.5
}

/**
 * One drift step. Pure: returns nothing, mutates the state it is given (the caller owns the
 * matching mesh). `groundAt` is the carved surface line — the glide follows it at HOLLOW_HOVER,
 * eased so a bench edge reads as a swell in the drift, not a stair-step.
 */
export function hollowStep(
  h: HollowState, dt: number, px: number, pz: number,
  groundAt: (x: number, z: number) => number, time: number,
): void {
  const dx = px - h.x, dz = pz - h.z
  const d = Math.hypot(dx, dz)
  const speed = HOLLOW_SPEED * (1 - h.gutter)          // a guttering Hollow loses its will first
  if (d > 0.5) {
    h.x += (dx / d) * speed * dt
    h.z += (dz / d) * speed * dt
  }
  const want = groundAt(h.x, h.z) + 1 + HOLLOW_HOVER + Math.sin(time * 1.7 + h.phase) * 0.12
  h.y += (want - h.y) * Math.min(1, dt * 3)
}

/** Distance from point P to the segment A→A+D·len — the projectile hit test, shared with the
 *  oracle so "the gun can actually hit one" is an assertable claim, not a hope. */
export function segmentDist(
  ax: number, ay: number, az: number, dx: number, dy: number, dz: number, len: number,
  px: number, py: number, pz: number,
): number {
  const t = Math.max(0, Math.min(len, (px - ax) * dx + (py - ay) * dy + (pz - az) * dz))
  const qx = ax + dx * t, qy = ay + dy * t, qz = az + dz * t
  return Math.hypot(px - qx, py - qy, pz - qz)
}
