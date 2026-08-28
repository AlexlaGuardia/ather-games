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
// ⚠ BLOCKOUT BODIES. The LOOK is ruled — `CANON/design-briefs/hollows.md` (2026-08-15): one
// material at three densities, dead-flat unlit diffuse with a high specular BORROWED from the
// scene (so a Hollow goes glossy beside a tended plot and near-matte in a greyfield — a danger read
// the player learns by looking), no face, always visibly losing itself. The MODELS have not caught
// up to it yet; that is a /picaso pass, not a canon gap.
// ⚠ THIS LINE READ "the locked look is owed a design-briefs pass" FOR ELEVEN DAYS AFTER THAT BRIEF
// LANDED. It was accurate when written and it went on telling every reader the art direction did
// not exist — which is the kind of stale claim that stops work rather than misinforming it. If you
// are about to act on a comment here that says something is missing, check whether it still is.
// This file fixes BEHAVIOUR only, as it always has.
// Everything else — counts, tiers, drops, difficulty, whether they linger in deep-greyed pockets
// by day — is build tuning and is Jin's (the ruling says so explicitly).
//
// ★ MOST OF THEM WALK. ONLY THE CASTER HOVERS. (Alex, 2026-08-14 — his concept call, and it
// overturns what this header said for a week.)
//
// This block used to argue "THE BODY IS A GLIDE, NOT A WALKER — a smear has no feet… terrain does
// not slow it, which is quietly the scariest thing about it." That was a real design argument and
// Alex has overruled it: **the Hollows are goopy BIPEDAL creatures. They have feet. Only the ranged
// form floats.** The current models are placeholders, which is why the correction arrives now.
//
// ★ AND THE FORM TABLE BELOW ALREADY SAID SO — THE LOCOMOTION JUST WASN'T READING IT. `caster` is
// the only form with `body: 0` (incorporeal, `standoff: 6.5`, `reach: 7.5` — it never closes), while
// warden and stalker both carry solid bodies and come all the way in. The data had the melee/ranged
// split from the day it was written; `hollowStep` applied one universal hover over the top of it.
// Same shape as everything else this week: the description was right and the mechanism ignored it.
//
// **What we lose, stated plainly, because it was deliberate:** terrain-does-not-slow-it was the
// scariest property the melee forms had. **What we keep:** the caster still floats and still
// outranges any wall, so the menace survives on the form whose whole job is denying the answer —
// and the two walkers gain legible counterplay, which is the better trade. A wall now means
// something to 7 of every 9 Hollows (the warden+stalker spawn weight) and nothing to the caster.
//
// Speed still sits under run speed: a keeper who runs, escapes. Menace, not a wall.
//
// ⚠ THE LOCKED LOOK IS STILL OWED A CANON DESIGN-BRIEF. "Goopy bipedal" is Alex's concept and is
// recorded here as direction, but `/picaso` builds against `CANON/design-briefs/`, so the brief has
// to land there before anyone models one. This file fixes BEHAVIOUR only, as it always has.

import { greyness } from '../voxel/biome'
import { spawnDark } from '../voxel/light'

/**
 * ── ★ WHAT A CAST HAS DONE TO THIS BODY (2026-08-15, the status port) ───────────────────────────
 * Two booleans, and deliberately NOT a `StatusBag` or a `StatusKind[]`.
 *
 * `engine/statuses.ts` keeps targets as opaque string ids so it never learns what an enemy is; this
 * is that same wall from the other side, so a Hollow never learns what a status system is. The host
 * is the only thing that knows both, which is what let the status module move worlds without a line
 * changing. Import the module here and the two would be welded together for one import's convenience.
 *
 * ⚠ ONE STRUCT FOR BOTH FUNCTIONS, NOT ONE PER FUNCTION. `rooted` only reaches `hollowStep` and
 * `disarmed` only reaches `hollowTouching`, so a tighter pair of types is arguable — but the host
 * builds this ONCE per body per frame and hands the same value to both, and two types would mean
 * two builds that can disagree about the same Hollow in the same tick. `blinded` needs both halves
 * anyway (it moves you wrong AND shortens your reach), so the split would not even be clean.
 */
export interface Impair {
  /** Clamped in place — cannot move at all. Read by `hollowStep`. */
  rooted: boolean
  /** Cannot find the keeper: drifts on a wrong heading, and cannot reach past contact. Read by both. */
  blinded: boolean
  /** Its weapon is jammed — the touch lays no drain. Read by `hollowTouching`. */
  disarmed: boolean
}

/**
 * No cast has touched this body.
 *
 * ⚠ EXPORTED AS A CONSTANT SO A CALL SITE READS AS A CLAIM, and NOT as a default parameter. An
 * `imp: Impair = UNIMPAIRED` would hand "nothing is affecting this Hollow" to every call site that
 * had not been updated — so statuses would land in the bag, tick down, expire, and never once
 * change a body's behaviour, with nothing to see. That is the `runMs` lesson and the `milledYield`
 * lesson for the third time in two days; the parameter is required.
 */
export const UNIMPAIRED: Impair = { rooted: false, blinded: false, disarmed: false }

export interface HollowState {
  /**
   * ★ STABLE, UNIQUE, AND NEVER REUSED — the status bag keys on it (2026-08-15).
   *
   * ⚠ NEVER REUSING AN ID IS A CORRECTNESS PROPERTY, NOT TIDINESS. `statuses.ts` warns that "an
   * enemy that dies must not carry a root into its respawn". The host clears a despawning Hollow's
   * entry, but a *missed* clear plus a recycled id would silently hand a brand-new body somebody
   * else's three-second root — a bug that appears only under spawn churn and looks like a physics
   * glitch. A monotonic counter makes that unrepresentable, which is cheaper than remembering.
   */
  id: string
  x: number; y: number; z: number
  /** Which shape the greying took. Set at spawn, never changes — a Hollow does not become a
   *  different Hollow, it disperses and the ground congeals another. */
  form: HollowForm
  hp: number
  /** 0 = fully formed .. 1 = guttered out (despawn). Driven up by dawn, never down. */
  gutter: number
  /** Per-hollow phase so a pack never pulses in sync. */
  phase: number
  /**
   * Seconds until this body may strike again. Per-BODY, not per-form: four stalkers must each be
   * on their own clock or a pack lands one synchronised hit and then nothing, which reads as a
   * single big enemy rather than as four.
   */
  strikeCd?: number
  /**
   * ★ THE STALKER'S MEMORY OF BEING SEEN (2026-08-26, Alex). Latched rather than recomputed raw
   * every frame so the flee has HYSTERESIS: a pure "is it in the view cone" test flickers on and
   * off at the boundary, and a body that stutters between advancing and fleeing on alternate
   * frames reads as a physics bug, not as a thing that fears being watched.
   */
  seen?: boolean
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

/**
 * ── ★★★ WHAT EACH FORM DOES TO YOU (2026-08-26, Alex's call) ──────────────────────────────────
 * The three forms were a triangle of MOVEMENT with one shared verb: every one of them drained, and
 * they differed only in reach and duration. Three well-drawn identities, one attack. Alex split
 * them, and each split follows the form's own description rather than adding a new idea:
 *
 *   · `press`  — the WARDEN walks in and hits you. It is the wall; the cost of being in its way.
 *   · `ambush` — the STALKER strikes only from your BLIND SPOT, and flees while you look at it.
 *                ★ This is not a new instinct: canon already spawns Hollows out of your sight
 *                (`PLAYER_EXCLUSION` — "it forms out of sight, never in your lap"). The stalker
 *                carries that same nature into the fight. It punishes standing still by making
 *                *where you are not looking* the dangerous place.
 *   · `sap`    — the CASTER reaches from across the clearing and takes MANA, never health.
 *                ★ Canon-exact, and the reason this one needed no ruling: `shimmer-geography.md`
 *                says what absence does on contact is TAKE FREQUENCY, and mana IS frequency. The
 *                caster is the only form whose attack is literally the thing a Hollow is.
 *
 * ⚠ ONLY THE CASTER IS RANGED. The other two must arrive, which is what keeps a wall meaningful to
 * seven of every nine Hollows and keeps the caster the one that punishes walling up.
 */
export type HollowAttack = 'press' | 'ambush' | 'sap'

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
  /**
   * ★ How far above the ground line this form FLOATS. 0 = it walks, feet on the ground, and is
   * step-height limited like anything with legs (Alex 2026-08-14: goopy bipedal creatures).
   * Non-zero = it hovers, ignores terrain, and a wall means nothing to it.
   *
   * Deliberately its own axis rather than inferred from `body === 0`. Incorporeal and airborne
   * happen to coincide on today's three forms, but they are two different claims — a corporeal
   * floater or a walking smear are both coherent, and inferring would silently weld them together.
   */
  hover: number
  /**
   * Seconds of drain a touch lays on the keeper — the slow.
   *
   * ⚠ NOW THE WARDEN'S ALONE, and that is a narrowing, not a deletion. It used to be every form's
   * only attack. The stalker and the caster were given their own (health from the blind spot; mana
   * from range), so leaving them a slow as well would hand the two forms that got something new an
   * extra effect nobody asked for. The warden keeps it because "you must go around me" IS its
   * identity, and slowing the keeper who does not is that sentence as a number.
   */
  drain: number
  /** What this form does when it reaches you. */
  attack: HollowAttack
  /** HP a strike takes. `sap` forms leave this 0 — a caster never wounds. */
  damage: number
  /** Mana a strike takes. Only `sap` uses it; absence taking frequency. */
  sap: number
  /** Seconds between strikes from this form. */
  strikeCd: number
  /** How far out it stops closing. The caster holds this line; the melee forms come all the way. */
  standoff: number
  /** Relative spawn frequency within a pack. */
  weight: number
}

// ⚠ DECLARED ABOVE `HOLLOW_FORMS` ON PURPOSE — the caster's `hover` reads it. A `const` below its
// consumer is a temporal-dead-zone ReferenceError at module load, not a lint nit: it took the whole
// module down on the first run of this change.
/** The CASTER's float height, in metres above the ground line. The walkers use 0 — see `hover`. */
export const HOLLOW_HOVER = 1.15
/**
 * ★ How high a walking Hollow can haul itself in one step. One block: it steps a kerb, a tilled row
 * or a single stair, and a two-high face stops it dead. This is the number that makes TERRAIN mean
 * something to the melee forms — and once conjured terrain writes real voxels (step 3 of the cast
 * port), a Stonewall becomes a wall to a warden for free, with no monster code involved.
 *
 * ⚠ It bounds the CLIMB only. A goop walking off a ledge oozes down, which is why descent is left
 * to the same lerp it always used.
 */
export const HOLLOW_STEP_UP = 1

/**
 * ── ★★★ HOW FAR A HOLLOW'S GROUND PROBE MAY LOOK, AND WHY UP AND DOWN DIFFER (2026-08-28) ─────
 * Alex, playing: *"they are 20 blocks above just hovering mid air.. but that doesnt stop them from
 * damaging me."*
 *
 * `hollowStep` asks its host `groundAt(x, z)` and then sets its own height to that answer plus a
 * hover. The host answered with a window CENTRED ON THE BODY'S OWN Y — so the body's height was
 * derived from a reply its own height had chosen. In open country that is invisible, because there
 * is nothing overhead to find. Under a canopy it is a ratchet: leaves are not AIR, the window rises
 * with each answer, and the body walks up its own reply to the top of the tree in about two frames.
 *
 * ⚠ THE DOWN HALF MUST STAY GENEROUS — a body legitimately sits above its ground (the caster hovers,
 * a walker steps off a ledge), and a short down-window drops it onto the generator's fallback line,
 * which is the "no wall ever stopped a Hollow" bug this probe was written to fix.
 *
 * ★ THE UP HALF IS DERIVED, NOT PICKED: a walker cannot get onto anything higher than
 * `HOLLOW_STEP_UP`, so a surface further up than that is not ground it could ever be standing on.
 * The day the step-up changes, this follows it. That is the difference between an exemption that
 * expires and a number someone has to remember.
 */
export const HOLLOW_GROUND_UP = HOLLOW_STEP_UP
/** The down half of the same window — unchanged from the host's old symmetric default. */
export const HOLLOW_GROUND_DOWN = 6

/**
 * ── ★★★ THE TOUCH HAS A HEIGHT NOW (2026-08-28) ───────────────────────────────────────────────
 * `hollowTouching` tested `dx*dx + dz*dz < r*r` and nothing else: **a cylinder of infinite height**,
 * with neither call site guarding altitude. A caster's reach is 7.5, so it drained from 7.5 blocks
 * away at ANY elevation, including from a tree.
 *
 * ⚠⚠ EITHER DEFECT ALONE IS SURVIVABLE, WHICH IS WHY NEITHER WAS FOUND. The ratchet alone is a
 * Hollow sitting oddly in a branch. The missing height term alone never fires, because a Hollow
 * that stays on the ground is always at your elevation. Together they are an enemy that damages you
 * from somewhere you cannot see, reach or answer — and the ratchet is fixed above, so this term is
 * now defence in depth rather than the cure. It stays because the cure is one regression away.
 *
 * ★ NOT PLAIN 3D DISTANCE, AND THAT IS THE DESIGN. Folding y into the same radius would give the
 * caster a 7.5-block vertical reach, which is a different creature. Height is its own dial, clamped
 * against the form's OWN horizontal reach so the warden/stalker/caster triangle keeps meaning
 * something vertically too: a warden cannot drain you from a ledge it could not climb.
 *
 * ⏳ `HOLLOW_REACH_Y_MAX` IS A FEEL CALL AND IT IS ALEX'S. 4 blocks is chosen to be unarguably
 * inside the canopy failure (17+) and unarguably outside ordinary terrain relief (1-2). It is the
 * one number to move if the caster should or should not be able to drain across a gully.
 */
export const HOLLOW_REACH_Y_MAX = 4
/**
 * The floor, DERIVED so it cannot rot: a caster on the very ground the keeper stands on is already
 * `HOLLOW_HOVER` above her feet, plus the bob. A ceiling tighter than that would make the form
 * unable to touch someone standing inside it — the exact "why did nothing happen" bug a height
 * term is most likely to introduce, so the floor is computed from the hover rather than guessed.
 */
export const HOLLOW_REACH_Y_MIN = HOLLOW_HOVER + 0.5

/** The vertical half-height of a form's touch. Derived from its own reach; see the block above. */
export function reachY(horizontalReach: number): number {
  return Math.min(HOLLOW_REACH_Y_MAX, Math.max(HOLLOW_REACH_Y_MIN, horizontalReach))
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
  warden:  { hp: 60, speed: 2.0, radius: 1.15, reach: 1.25, body: 0.85, hover: 0, drain: 3.4, standoff: 0,   weight: 3,
             attack: 'press',  damage: 9, sap: 0,  strikeCd: 1.6 },
  // The pressure. Frail, fast, small. It is the reason you cannot stand still and mine while a
  // pack is out, which is the habit the night is supposed to break.
  // ★ The heaviest single hit in the game, and it is not a balance whim: a strike you can ALWAYS
  // deny by turning around has to be worth denying. A gentle ambush teaches nobody to look behind.
  stalker: { hp: 18, speed: 3.9, radius: 0.62, reach: 0.80, body: 0.34, hover: 0, drain: 0,   standoff: 0,   weight: 4,
             attack: 'ambush', damage: 14, sap: 0,  strikeCd: 2.2 },
  // The reason to move. It never closes and it barely has a body — it drains from across the
  // clearing, so a keeper who solves the other two by backing away has solved nothing.
  // ★ The ONLY form that floats — and the only one a wall cannot answer. That pairing is the point.
  caster:  { hp: 14, speed: 1.5, radius: 0.70, reach: 7.5,  body: 0,    hover: HOLLOW_HOVER, drain: 0,   standoff: 6.5, weight: 2,
             attack: 'sap',    damage: 0,  sap: 11, strikeCd: 2.8 },
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
  imp: Impair,
  /**
   * The keeper's forward vector, for the stalker's flee (2026-08-26). OPTIONAL, and the default is
   * "not being looked at" — a host that has not been updated gets the old behaviour (it advances)
   * rather than a stalker that cowers forever because a missing argument read as a stare.
   */
  fx = 0, fz = 0,
): void {
  const f = formOf(h)
  // ★ ROOTED STOPS THE DRIFT AND NOTHING ELSE. It still guttes, still bobs, still reads as alive —
  // Shackle clamps a body in iron, it does not switch it off. Returning early here (before the bob)
  // would freeze it mid-air like a paused video, which reads as the game hanging rather than as the
  // cast landing.
  let dx = px - h.x, dz = pz - h.z
  // ★ BLINDED SENDS IT THE WRONG WAY RATHER THAN NOWHERE, and that distinction is the whole tell.
  // A blinded Hollow that simply stopped would be indistinguishable from a rooted one, and the two
  // casts would feel identical. So its heading is rotated by a fixed per-body angle taken from
  // `phase` — deterministic (no rng in a frame loop), different per Hollow (a blinded pack scatters
  // instead of wheeling in formation), and constant for the duration so it commits to a wrong
  // direction rather than jittering on the spot.
  if (imp.blinded) {
    const a = h.phase * 1.7 + 2.2                       // ~126°..~485°: never near zero, so never "sighted"
    const cs = Math.cos(a), sn = Math.sin(a)
    const rx = dx * cs - dz * sn
    const rz = dx * sn + dz * cs
    dx = rx; dz = rz
  }
  const d = Math.hypot(dx, dz)
  const speed = f.speed * (1 - h.gutter)               // a guttering Hollow loses its will first
  // ★ THE CASTER HOLDS ITS LINE, AND HOLDS IT FROM BOTH SIDES. It closes to `standoff` and then
  // BACKS OFF if the keeper walks in — without the retreat it is just a slow stalker, because
  // every fight ends with the player standing on top of it, which is the one range its whole form
  // exists to deny. The melee forms have standoff 0, so this is a no-op for them and there is one
  // movement function rather than a melee one and a ranged one that drift apart.
  const stop = Math.max(0.5, f.standoff)
  let mx = 0, mz = 0

  // ── ★★ THE STALKER BREAKS OFF WHILE YOU LOOK AT IT (2026-08-26, Alex) ───────────────────────
  // It is the only form that answers to being seen. `seen` is LATCHED on the state so the flee has
  // hysteresis (see `keeperLooking`), and a blinded stalker is deliberately NOT let off: something
  // that cannot see you cannot know you are looking, so it keeps coming — which is the one moment
  // this form is easy, and it is a cast that bought it.
  if (f.attack === 'ambush' && !imp.blinded) {
    h.seen = keeperLooking(h, px, pz, fx, fz)
  } else {
    h.seen = false
  }
  if (h.seen && !imp.rooted && d > 1e-4) {
    // Backing off along the line you are looking down — it does not sprint, it withdraws. Slower
    // than its approach on purpose: a stalker that fled at full speed would be unkillable by anyone
    // who saw it, and the form is supposed to punish NOT looking, never to punish looking.
    const flee = f.speed * 0.75 * (1 - h.gutter)
    h.x -= (dx / d) * flee * dt
    h.z -= (dz / d) * flee * dt
    const wantY = groundAt(h.x, h.z) + 1 + f.hover
    h.y += (wantY - h.y) * Math.min(1, dt * 3)
    return
  }

  if (imp.rooted) {
    // Clamped: no translation this frame. Everything below the movement block still runs.
  } else if (d > stop) {
    mx = (dx / d) * speed * dt
    mz = (dz / d) * speed * dt
  } else if (f.standoff > 0 && d < f.standoff * 0.72 && d > 1e-4) {
    mx = -(dx / d) * speed * dt
    mz = -(dz / d) * speed * dt
  }

  if (f.hover > 0) {
    // A floater ignores the ground entirely — this is the caster, and a wall meaning nothing to it
    // is the whole reason it is the form that punishes walling up.
    h.x += mx
    h.z += mz
  } else if (mx !== 0 || mz !== 0) {
    // ★ A WALKER HAS FEET (Alex 2026-08-14). It can haul itself up `HOLLOW_STEP_UP` and no further,
    // so terrain finally means something to the melee forms.
    //
    // Axis-separated fallback, in this order: try the whole move, then X alone, then Z alone. That
    // is three `groundAt` probes in the worst case and it buys WALL-SLIDING for free — a warden that
    // meets a Stonewall mills along it looking for the end instead of freezing nose-first against
    // it. **It is emphatically not pathfinding** and must not be mistaken for it: it cannot solve a
    // U-shape and it is not supposed to. Milling at a wall IS the counterplay a wall should buy.
    const g0 = groundAt(h.x, h.z)
    const climbable = (nx: number, nz: number) => groundAt(nx, nz) - g0 <= HOLLOW_STEP_UP
    if (climbable(h.x + mx, h.z + mz)) { h.x += mx; h.z += mz }
    else if (climbable(h.x + mx, h.z)) { h.x += mx }
    else if (climbable(h.x, h.z + mz)) { h.z += mz }
    // else: blocked on both axes. It stays put this frame and keeps trying — a body against a wall.
  }

  // The bob is a FLOATER's tell, not a universal one: a thing with feet that sinusoidally rises out
  // of the ground reads as broken, and it was the clearest visual lie in the placeholder.
  const bob = f.hover > 0 ? Math.sin(time * 1.7 + h.phase) * 0.12 : 0
  const want = groundAt(h.x, h.z) + 1 + f.hover + bob
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
export function hollowTouching(h: HollowState, px: number, py: number, pz: number, imp: Impair): boolean {
  if (h.hp <= 0 || h.gutter >= 1) return false
  // ★ DISARMED STOPS THE DRAIN OUTRIGHT. Canon's Shackle "jams a manalic weapon mid-draw"; the
  // Hollow's weapon is the touch, so this is the whole of it.
  if (imp.disarmed) return false
  const f = formOf(h)
  // ★ BLINDED COLLAPSES REACH TO CONTACT, AND THIS IS WHERE THE STATUS TRIANGLE EARNS ITSELF.
  // The three forms already differ on `reach` (warden 1.25 · stalker 0.8 · CASTER 7.5), so one rule
  // means three different things: blinding a caster takes away the seven-metre drain that IS its
  // form, while blinding a warden barely touches its attack and only makes it wander. A status that
  // did the same thing to every body would be a fourth healthbar, which is the failure the form
  // table's own header warns about.
  //
  // It is a floor, not a multiplier: something that blunders into you still drains, because a blind
  // thing you are standing inside has found you by accident. `body` is that contact line, with a
  // small margin for the incorporeal caster (body 0) so blinding it does not make it literally
  // harmless to stand on top of.
  const r = imp.blinded ? Math.max(0.6, f.body) : f.reach
  const dx = px - h.x, dz = pz - h.z
  if (dx * dx + dz * dz >= r * r) return false
  // ★ AND IT HAS TO BE AT YOUR ELEVATION. `py` is the keeper's FEET, the same reference `h.y`
  // uses (both are a ground line plus one), so a body standing where you stand reads dy 0.
  // Clamped through `reachY` rather than reusing `r`, so blinding still cannot make a caster
  // hovering over your head harmless — see the block on `HOLLOW_REACH_Y_MAX`.
  return Math.abs(h.y - py) < reachY(r)
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

/**
 * ── ★★ IS THE KEEPER LOOKING AT IT? (2026-08-26) ──────────────────────────────────────────────
 * A dot product against the keeper's forward vector, with HYSTERESIS: a body already fleeing keeps
 * fleeing until it is well outside the cone, and one advancing does not turn until it is well
 * inside. Without the gap a stalker sitting exactly on the boundary flips state every frame and
 * jitters in place, which reads as a broken body rather than a wary one.
 *
 * ⚠ TAKES A FORWARD VECTOR, NOT A YAW. The host has the camera's direction already; converting it
 * to an angle here and back to a vector inside would be two trig calls per body per frame to
 * express the thing the caller was already holding.
 */
export const SEEN_ENTER = Math.cos((100 * Math.PI / 180) / 2)  // inside a ~100° cone: it knows
export const SEEN_EXIT  = Math.cos((130 * Math.PI / 180) / 2)  // outside ~130°: it dares again

export function keeperLooking(h: HollowState, px: number, pz: number, fx: number, fz: number): boolean {
  let dx = h.x - px, dz = h.z - pz
  const d = Math.hypot(dx, dz)
  if (d < 1e-4) return true          // standing inside you counts as seen; nothing to sneak behind
  dx /= d; dz /= d
  const fl = Math.hypot(fx, fz)
  if (fl < 1e-4) return h.seen ?? false   // no facing supplied — hold the last answer, never flip
  const dot = dx * (fx / fl) + dz * (fz / fl)
  // Hysteresis: the threshold to BECOME seen is tighter than the one to stop being seen.
  return h.seen ? dot > SEEN_EXIT : dot > SEEN_ENTER
}

/** What a strike took. `null` = it did not strike this tick. */
export interface HollowHit {
  /** HP taken — `press` and `ambush` only. */
  hp: number
  /** Mana taken — `sap` only. */
  mana: number
  /** Seconds of slow laid on the keeper (the warden's, now). */
  drain: number
  form: HollowForm
}

/**
 * Can this body strike the keeper right now, and what does it take?
 *
 * ⚠ THE AMBUSH GATE LIVES HERE, NOT IN THE HOST. A stalker may only land a blow from OUTSIDE the
 * keeper's view — that is the whole of Alex's design, and putting it in the host would mean any
 * second host (the play3d side, a future arena) could reach the same body and forget it. The rule
 * travels with the creature.
 *
 * ⚠ AND THE COOLDOWN TICKS EVEN WHEN IT CANNOT REACH. A stalker that banked its cooldown while you
 * faced it would hit the instant you turned, every time, which is a punish for turning around — the
 * opposite of what a blind-spot attacker should teach.
 */
export function hollowStrike(
  h: HollowState, dt: number, px: number, py: number, pz: number, imp: Impair, looking: boolean,
): HollowHit | null {
  const f = formOf(h)
  h.strikeCd = Math.max(0, (h.strikeCd ?? 0) - dt)
  if (imp.disarmed) return null
  if (h.strikeCd > 0) return null
  if (!hollowTouching(h, px, py, pz, imp)) return null
  // The stalker is the only form that asks. A warden does not care that you can see it — being
  // seen and coming anyway is what a wall IS.
  if (f.attack === 'ambush' && looking) return null
  h.strikeCd = f.strikeCd
  return { hp: f.damage, mana: f.sap, drain: f.drain, form: h.form }
}
