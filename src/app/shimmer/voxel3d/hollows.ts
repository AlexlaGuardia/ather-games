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
  /** Which shape the greying took. Set at spawn, never changes — a Hollow does not become a
   *  different Hollow, it disperses and the ground congeals another. */
  form: HollowForm
  hp: number
  /** 0 = fully formed .. 1 = guttered out (despawn). Driven up by dawn, never down. */
  gutter: number
  /** Per-hollow phase so a pack never pulses in sync. */
  phase: number
}

/**
 * ── ★ THE THREE FORMS (2026-08-11, Alex: "a guard type and assassin and a mage type") ────────
 * Canon already handed this to the build: the 08-07 gun ruling closes with "Jin still owns (build):
 * FORMS, tiers, spawn-rules, difficulty". So the shapes the greying takes are a tuning table, not
 * a canon question — but WHAT they are is still bounded by the ruling, and the boundary changed
 * Alex's words on the way in.
 *
 * ★ THEY CANNOT BE PROFESSIONS. "Assassin" and "mage" are jobs, and a job implies someone who
 * chose it. A Hollow has nothing in it — that absence is the entire reason it is legal to shoot,
 * because the Ather's other enemy class is collared and its verb is FREE, not disperse. Name one
 * of these an assassin and you have quietly moved it into the class the guns are forbidden to
 * answer. Same triangle, drain-shaped names: a body that BLOCKS, a body that CHASES, a body that
 * REACHES.
 *
 * ★ AND THE TRIANGLE HAS TO BE A TRIANGLE. Three enemies that differ only in HP are one enemy
 * with three healthbars. Each form must break a different habit: the warden punishes walking
 * straight at things, the stalker punishes standing still, the caster punishes ignoring range.
 * The oracle asserts the three are actually distinct on their own axis, so a balance pass cannot
 * quietly converge them.
 */
export type HollowForm = 'warden' | 'stalker' | 'caster'

export interface HollowFormDef {
  /** Dispersal pool. */
  hp: number
  /** Glide speed. ⚠ See DRAINED_SPEED in locomotion.ts — no form may out-glide a drained keeper,
   *  or "a keeper who runs, escapes" stops being true and menace becomes a wall. */
  speed: number
  /** Projectile hit sphere. */
  radius: number
  /** How close it has to be to drain. The caster's is long — that IS its form. */
  reach: number
  /** ★ Solid half-width. A warden you can walk through is not a guard, it is scenery — this is
   *  what makes the form mean anything. 0 = incorporeal (the caster: reach is its body). */
  body: number
  /** Seconds of drain a touch lays on the keeper. */
  drain: number
  /** How far out it stops closing. The caster holds this line; the melee forms come all the way. */
  standoff: number
  /** Relative spawn frequency within a pack. */
  weight: number
}

/**
 * ⚠ SPEEDS ARE BOUNDED FROM BOTH SIDES, and the bound is a canon sentence, not taste. Every form
 * must glide SLOWER than a drained keeper (locomotion's DRAINED_SPEED, 4.2) so the escape the
 * ruling promises survives even at the keeper's worst. The stalker sits as close to that ceiling
 * as the triangle allows — it should feel like it is about to catch you and never quite does.
 */
export const HOLLOW_FORMS: Record<HollowForm, HollowFormDef> = {
  // The wall. Slow enough to walk around, solid enough that you must, and the heaviest drain —
  // so going THROUGH it is a real cost rather than a formality.
  warden:  { hp: 60, speed: 2.0, radius: 1.15, reach: 1.25, body: 0.85, drain: 3.4, standoff: 0,   weight: 3 },
  // The pressure. Frail, fast, small. It is the reason you cannot stand still and mine while a
  // pack is out, which is the habit the night is supposed to break.
  stalker: { hp: 18, speed: 3.9, radius: 0.62, reach: 0.80, body: 0.34, drain: 1.8, standoff: 0,   weight: 4 },
  // The reason to move. It never closes and it barely has a body — it drains from across the
  // clearing, so a keeper who solves the other two by backing away has solved nothing.
  caster:  { hp: 14, speed: 1.5, radius: 0.70, reach: 7.5,  body: 0,    drain: 2.2, standoff: 6.5, weight: 2 },
}

export const formOf = (h: HollowState): HollowFormDef => HOLLOW_FORMS[h.form]

/** Pick a form by weight. `roll` is 0..1 — injected so the oracle can pin the distribution
 *  instead of hoping. Ordered explicitly: a Record's key order is not a contract to lean on. */
export const FORM_ORDER: HollowForm[] = ['warden', 'stalker', 'caster']
export function pickForm(roll: number): HollowForm {
  const total = FORM_ORDER.reduce((a, f) => a + HOLLOW_FORMS[f].weight, 0)
  let acc = 0
  const target = Math.min(0.999999, Math.max(0, roll)) * total
  for (const f of FORM_ORDER) {
    acc += HOLLOW_FORMS[f].weight
    if (target < acc) return f
  }
  return FORM_ORDER[FORM_ORDER.length - 1]
}

/** Legacy single-body numbers, kept as the warden-neutral defaults the older call sites read. */
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
  const f = formOf(h)
  const dx = px - h.x, dz = pz - h.z
  const d = Math.hypot(dx, dz)
  const speed = f.speed * (1 - h.gutter)               // a guttering Hollow loses its will first
  // ★ THE CASTER HOLDS ITS LINE, AND HOLDS IT FROM BOTH SIDES. It closes to `standoff` and then
  // BACKS OFF if the keeper walks in — without the retreat it is just a slow stalker, because
  // every fight ends with the player standing on top of it, which is the one range its whole form
  // exists to deny. The melee forms have standoff 0, so this is a no-op for them and there is one
  // movement function rather than a melee one and a ranged one that drift apart.
  const stop = Math.max(0.5, f.standoff)
  if (d > stop) {
    h.x += (dx / d) * speed * dt
    h.z += (dz / d) * speed * dt
  } else if (f.standoff > 0 && d < f.standoff * 0.72 && d > 1e-4) {
    h.x -= (dx / d) * speed * dt
    h.z -= (dz / d) * speed * dt
  }
  const want = groundAt(h.x, h.z) + 1 + HOLLOW_HOVER + Math.sin(time * 1.7 + h.phase) * 0.12
  h.y += (want - h.y) * Math.min(1, dt * 3)
}

/**
 * ── ★ THE TOUCH (2026-08-11) — the night finally costs something ────────────────────────────
 * Everything upstream of this existed to make the dark dangerous — the two-channel light field,
 * the spawn cycle, the pack walk, the lantern that buys a safe room — and a Hollow that reached
 * the keeper GLIDED THROUGH HER and did nothing at all. The threat could not threaten.
 *
 * ★ IT DRAINS, IT DOES NOT DAMAGE, AND THAT IS THE CANON NOT A SOFTENING. A Hollow is
 * "unanswered drain-grey... absence given just enough form to move" — there is nothing in it to
 * free and nothing in it that strikes. What absence does on contact is TAKE FREQUENCY. So the
 * keeper leaves the touch slowed, not wounded. This also keeps me out of the one question that
 * is NOT mine: whether a keeper can die is the open cozy-vs-peril gap for /magii, and a drain
 * needs no answer to it. `shimmer-geography.md` hands Jin "counts, tiers, drops, difficulty"
 * explicitly; the drain is difficulty, and the lethality question stays where it belongs.
 */
export const HOLLOW_TOUCH = 0.95     // a shade past the hit sphere — the smear reaches before it overlaps
export const DRAIN_TIME = 2.6        // seconds of slowed keeper per touch, refreshed not stacked

/** The keeper's drained speed lives in `locomotion.ts` with her other speeds — the walker must
 *  not have to know what drained her. The invariant that ties them (drained > HOLLOW_SPEED, or
 *  "menace" becomes "wall") is asserted in the locomotion oracle, which is the one place that
 *  legitimately knows both. */

/** True when the smear is on the keeper. Pure and shared with the oracle for the same reason the
 *  projectile test is: "it can actually reach you" has to be assertable. */
export function hollowTouching(h: HollowState, px: number, pz: number): boolean {
  if (h.hp <= 0 || h.gutter >= 1) return false
  const r = formOf(h).reach
  const dx = px - h.x, dz = pz - h.z
  return dx * dx + dz * dz < r * r
}

/**
 * ── ★ BODIES (2026-08-11) — "id like them to be phisical enemies" ────────────────────────────
 * Push the keeper out of any solid form she has ended up inside. Resolved HERE, after locomotion
 * has run, rather than by teaching the walker about monsters: locomotion's whole contract is that
 * the world is one injected `solid(x,y,z)` probe, and a Hollow is not a voxel. Keeping it out
 * means the walker stays testable against a synthetic grid with no creatures in it.
 *
 * ★ IT REFUSES A PUSH IT CANNOT MAKE SAFELY. `fits` is the caller's body test; if shoving the
 * keeper clear would put her inside terrain, she stays overlapping instead. A monster that can
 * press you into rock is a monster that can kill you through the floor, and momentary overlap is
 * a far cheaper bug than being extruded into a hillside. Same instinct as the chest that spills
 * rather than refusing to break.
 *
 * Incorporeal forms (`body` 0 — the caster) are skipped: reach is its body, and a thing made of
 * absence at seven metres has no surface to bump into.
 */
export function pushOutOfBodies(
  px: number, pz: number, keeperR: number,
  bodies: HollowState[],
  fits: (x: number, z: number) => boolean,
): { x: number; z: number } {
  let x = px, z = pz
  for (const h of bodies) {
    if (h.hp <= 0 || h.gutter >= 1) continue
    const b = formOf(h).body
    if (b <= 0) continue
    const min = b + keeperR
    let dx = x - h.x, dz = z - h.z
    let d = Math.hypot(dx, dz)
    if (d >= min) continue
    // Dead centre has no direction to leave by; pick one rather than dividing by zero.
    if (d < 1e-4) { dx = 1; dz = 0; d = 1 }
    const nx = h.x + (dx / d) * min
    const nz = h.z + (dz / d) * min
    if (fits(nx, nz)) { x = nx; z = nz }
  }
  return { x, z }
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
