// cast-dispatch.ts — SLOT → MOVE → ARCHETYPE → an OUTCOME the host applies.
//
// ★ PURE. No react, no three, no DOM, no refs. Same rule as `voxel/`, for the same reason.
//
// ── ★ AN EXTRACTION, NOT A PORT (2026-08-12) ────────────────────────────────────────────────────
// `cast.ts` has mapped slot → move → archetype since 2026-08-03 and is well tested. What was NOT
// shared is the thing that RUNS a cast: ~120 lines welded into `play3d/Shimmer3D.tsx`, reading and
// writing a dozen refs that live in that component (hp, mana, stance, resist, castMult, stanceMove,
// surge, infusion, speedMult, cooldowns, pendingCast, the toast). The voxel world — the one Alex
// actually plays — has no cast layer at all, so "runes ARE the combat" (#294) is that dispatcher
// reaching a second world.
//
// Copying it would fail the same way copying the guns nearly did (`engine/weapons.ts`, 2026-08-07):
// the half that cannot travel is the one that resolves against play3d's TILE GRID, which this world
// has not got. So the split is the same and it is the whole design:
//
//   this file   decides WHAT HAPPENED  — pure, testable, identical in both worlds
//   the host    decides HOW IT LANDS   — its own hp/mana state, its own aim, its own hit detection
//
// A `CastOutcome` is therefore a DESCRIPTION, never an action. It says "spend 22 mana, add 35 hp,
// start a cooldown at t, and tell the player 'Mend — mended'". Applying that to a ref is one line in
// each host, and it is the only line either host needs to get right.
//
// ── ★ THE HONESTY RULE, EXTENDED — AND THIS IS THE REAL DESIGN DECISION ─────────────────────────
// `cast.ts` already rules that a canon move the sim cannot run is `archetype: 'unbuilt'` WITH a
// reason, because *"a silent no-op is how the old ward/restore/surge tags read as 'cast does
// nothing, must be a bug.'"* That rule was written for moves. It has to hold for WORLDS too.
//
// The voxel world can run projectiles and every self archetype today; it cannot yet place fields,
// terrain or statuses, because `field-effects.ts` / `conjured-terrain.ts` / `statuses.ts` all still
// resolve against play3d's grid and its named `hunter`/`guard` targets. If this file simply lacked
// those branches, Stonewall in the voxel world would be a key that does nothing — the exact failure
// `cast.ts` outlawed, re-created one level up.
//
// So a host DECLARES what it can run (`CastEnv.supports`) and an archetype outside that set refuses
// with a real, player-visible reason. **"Not in this world yet" becomes a first-class, testable
// state instead of a missing switch branch.** It is also the honest migration path: slice 2 adds
// 'field' to the voxel host's set and deletes nothing here.

import { castForMove, CAST_SLOTS, type CastSpec, type CastArchetype } from '../play3d/cast'

/** Why a cast did not happen. Every one of these is shown to the player; none is silent. */
export type CastRefusal =
  | 'empty-slot'    // nothing bound to this slot
  | 'unbuilt'       // canon move, no sim behaviour anywhere yet
  | 'unsupported'   // built, but THIS world cannot run the archetype yet
  | 'cooldown'      // still recovering
  | 'mana'          // cannot pay
  | 'already-whole' // a restore at full health, which must not burn mana or cooldown

export interface CastEnv {
  /** Monotonic ms. Passed in rather than read, so a test can sit at an exact instant. */
  now: number
  hp: number
  hpMax: number
  mana: number
  /** Per-slot cooldown expiry, indexed like `CAST_SLOTS`. */
  cooldownUntil: readonly number[]
  /** The move id of the stance currently held, if any — re-pressing it drops it. */
  stanceMoveId: string | null
  /** Archetypes this world can actually land. See the honesty rule above. */
  supports: ReadonlySet<CastArchetype>
}

/** A timed multiplier window. `surge` moves the keeper, `infusion` moves the weapon. */
export interface CastWindow { until: number; mult: number }

export interface CastRefused {
  kind: 'refused'
  slot: number
  spec: CastSpec
  reason: CastRefusal
  message: string
}

/**
 * What the host must apply. Every field is "no change" in its neutral value, so a host applies the
 * whole struct unconditionally and never has to branch on archetype — which is precisely the
 * knowledge we are trying not to duplicate into a second world.
 */
export interface CastApplied {
  kind: 'applied'
  slot: number
  spec: CastSpec
  message: string
  /** Always pay this. 0 for a stance DROP, which canon makes free and instant. */
  manaCost: number
  /** null = start no cooldown (again: dropping a stance is free). */
  cooldownUntil: number | null
  /** Absent = stance unchanged. Present = set it to `to` (null drops it). */
  stanceChange?: { to: CastSpec | null }
  hpDelta: number
  surge: CastWindow | null
  infusion: CastWindow | null
  /**
   * A PLACED archetype the frame loop must resolve against a live camera — the host walks its own
   * aim (see `castAimPoint`) and runs its own hit detection. Null for everything self-contained.
   */
  placed: CastSpec | null
}

export type CastOutcome = CastRefused | CastApplied

/** Archetypes that need an aim point and a world to land in. */
const PLACED: ReadonlySet<CastArchetype> = new Set<CastArchetype>(['projectile', 'field', 'terrain', 'status'])

/** Everything a host with hp/mana/speed can run without a world. Handy default for a new host. */
export const SELF_ARCHETYPES: ReadonlySet<CastArchetype> =
  new Set<CastArchetype>(['restore', 'stance', 'surge', 'infusion'])

const refuse = (slot: number, spec: CastSpec, reason: CastRefusal, message: string): CastRefused =>
  ({ kind: 'refused', slot, spec, reason, message })

/** Neutral outcome — every effect field at "no change". Each case below sets only what it means. */
const applied = (slot: number, spec: CastSpec, message: string, cooldownUntil: number | null): CastApplied =>
  ({ kind: 'applied', slot, spec, message, manaCost: spec.manaCost, cooldownUntil,
     hpDelta: 0, surge: null, infusion: null, placed: null })

/**
 * Resolve one keypress. Pure: same inputs, same outcome, always.
 *
 * ⚠ ORDER OF THE GATES IS LOAD-BEARING and it is not the obvious order.
 *   - `unsupported` is checked BEFORE cooldown and mana, so a world that cannot run a move never
 *     charges for it and never puts it on cooldown. A player pressing Stonewall in the voxel world
 *     must be told "not in this world yet", not silently drained.
 *   - `already-whole` is checked BEFORE paying, for the same reason — this is inherited behaviour
 *     from the play3d dispatcher and dropping it would make Mend a mana leak at full health.
 *   - the stance DROP is checked before cooldown, because canon (runes.md, the mana economy) makes
 *     releasing a held passive always allowed: a stance is a stance, not a permanent state.
 */
export function resolveCast(slot: number, loadout: readonly (string | null)[], env: CastEnv): CastOutcome {
  const moveId = loadout[slot] ?? null
  const spec = castForMove(moveId)

  if (!moveId) {
    return refuse(slot, spec, 'empty-slot', `No ${CAST_SLOTS[slot] ?? 'slot'} bound — your book has none for your runes`)
  }
  if (spec.archetype === 'unbuilt') {
    return refuse(slot, spec, 'unbuilt', `${spec.label} — not built yet (${spec.why})`)
  }
  if (!env.supports.has(spec.archetype)) {
    return refuse(slot, spec, 'unsupported', `${spec.label} — not in this world yet`)
  }

  // A held stance toggles OFF for free and instantly; everything else waits out its cooldown.
  const dropping = spec.archetype === 'stance' && env.stanceMoveId === moveId
  if (dropping) {
    const out = applied(slot, spec, `${spec.label} released`, null)
    out.manaCost = 0
    out.stanceChange = { to: null }
    return out
  }
  if (env.now < (env.cooldownUntil[slot] ?? 0)) {
    return refuse(slot, spec, 'cooldown', `${spec.label} — recovering`)
  }
  if (spec.archetype === 'restore' && env.hp >= env.hpMax) {
    return refuse(slot, spec, 'already-whole', 'Already whole')
  }
  if (env.mana < spec.manaCost) {
    return refuse(slot, spec, 'mana', `${spec.label} — not enough mana`)
  }

  const cd = env.now + spec.cooldownMs

  switch (spec.archetype) {
    case 'stance': {
      const out = applied(slot, spec, `${spec.label} held — mana recovery paused`, cd)
      out.stanceChange = { to: spec }
      return out
    }
    case 'restore': {
      const out = applied(slot, spec, `${spec.label} — mended`, cd)
      // Clamped here, not by the host: two hosts clamping independently is two chances to disagree
      // about the cap, and the cap is the whole point of the already-whole gate above.
      out.hpDelta = Math.min(spec.heal, env.hpMax - env.hp)
      return out
    }
    case 'surge': {
      const out = applied(slot, spec, spec.label, cd)
      out.surge = { until: env.now + spec.surgeSecs * 1000, mult: spec.surgeMult }
      return out
    }
    // ★★ A CHANNEL STARTS NO COOLDOWN HERE, AND THAT `null` IS THE WHOLE CASE. `sustain.ts` rule 3:
    // *"the cooldown starts on RELEASE, never on press"* — start it at the press and a ten-second
    // channel costs the same recovery as a tap, which quietly makes holding strictly better than
    // tapping, for free, with nothing on screen to say so. The host closes the channel and calls
    // `sustainCooldownUntil(releasedAt, cooldownMs)`; this function cannot, because it does not know
    // when the key comes up.
    //
    // ⚠ IT IS ALSO NOT `placed`. Every placed archetype is an entity dropped at an aim point and then
    // left alone; a channel is the opposite — it has no entity and it is never left alone, because
    // it must be re-decided every frame against the mana that is left. The host recognises it by
    // `out.spec.archetype === 'channel'` rather than by a new outcome field, so nothing here has to
    // learn what a bore is.
    case 'channel': {
      // The press pays `manaCost` (applied() already sets it) and buys the right to hold. Everything
      // the move actually does is bought by the seconds after this frame.
      return applied(slot, spec, `${spec.label} — held`, null)
    }
    case 'infusion': {
      const out = applied(slot, spec, `${spec.label} — your shots burn`, cd)
      out.infusion = { until: env.now + spec.surgeSecs * 1000, mult: spec.surgeMult }
      return out
    }
    default: {
      // Everything PLACED goes down one wire: pay, hand the spec to the frame loop, start the
      // cooldown. A bolt, a firewall, a stonewall and a shackle land by ONE rule, not four.
      const out = applied(slot, spec, spec.archetype === 'projectile' ? '' : spec.label, cd)
      out.placed = spec
      return out
    }
  }
}

/**
 * THE AIM POINT for every placed cast: flatten the camera forward onto the ground plane and walk
 * `range` along it from the caster's feet.
 *
 * ⚠ Flattening is deliberate and it is not a rounding convenience — looking at the sky must not put
 * your Stonewall in orbit. The fallback matters just as much: staring straight down (or up) makes
 * the horizontal component ~0, and normalising that is a divide-by-zero that lands the cast on top
 * of you or at NaN. `fallbackX/Z` is the caster's facing, so a cast always goes SOMEWHERE sensible.
 */
export function castAimPoint(
  dirX: number, dirZ: number, px: number, pz: number, range: number,
  fallbackX = 0, fallbackZ = -1,
): { x: number; z: number } {
  let fx = dirX, fz = dirZ
  let len = Math.hypot(fx, fz)
  if (len < 1e-4) { fx = fallbackX; fz = fallbackZ; len = Math.hypot(fx, fz) || 1 }
  return { x: px + (fx / len) * range, z: pz + (fz / len) * range }
}
