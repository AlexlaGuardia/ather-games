// hunter-ai.ts — the ground hunter's brain, lifted out of the range so more than one thing can use it.
//
// ── WHY THIS EXISTS (2026-08-12, #302) ────────────────────────────────────────────────────────
// The Crucible needs bots. `play3d/crucible-bots.ts` already fills the roster — canon rules the
// format (20 entrances x 3 challengers = 60, and the pyramid does not open until every slot is
// taken), and `fillRoster` builds that deterministically. But a roster is a list of NAMES. Nothing
// in it fights.
//
// The behaviour Alex asked to reuse already existed, inline in `Shimmer3D.tsx`'s frame loop: the
// firing-range ground hunter that closes to mid-range, orbit-strafes so it is not a static turret,
// and returns fire on a cooldown. Good behaviour, unreachable — welded into a 6000-line component
// and to that component's own refs. This is that behaviour as a module, following the same seam
// `engine/cast-dispatch.ts` and `engine/vitals.ts` were extracted along: **a pure function that
// returns an INTENT the host applies**, never one that moves anything itself.
//
// ── ★ THREE THINGS HAD TO CHANGE, AND EACH IS A REASON THIS IS AN EXTRACTION NOT A COPY ───────
//
// 1. **IT USED `Math.random()` — THREE TIMES — AND THAT WOULD HAVE BROKEN THE CRUCIBLE OUTRIGHT.**
//    Spawn bearing, spawn distance and the initial strafe phase were all `Math.random()`. That is
//    perfectly fine for one hunter in a private range. It is fatal for 60 bots in a shared match:
//    `crucible-bots.ts` is explicitly, deliberately deterministic — its header says a lobby that
//    shuffles differently per client is "a desync waiting to happen" — so a roster rebuilt from a
//    seed would have been handed brains that diverge on the first frame. Every draw here comes
//    from an injected `rng`, so the same seed gives the same fight on every client.
//
// 2. **IT READ THE TILE GRID DIRECTLY** (`gridRef.current[gz][gx]`, wall id masked out of the low
//    byte). That is the exact dependency that trapped the GUNS extraction and that the cast
//    dispatcher had to shed: a grid is the RANGE's way of knowing what is solid, not the world's.
//    So the caller passes `blocked(x, z)` and answers however it likes — a tile lookup in the
//    range, a DDA probe in the voxel world, a floor-doc lookup in the Crucible.
//
// 3. **STATUSES ARRIVE AS FLAGS, NOT AS A LOOKUP.** System 3's rule is that a status removes an
//    OPTION and never HP — rooted cannot step, disarmed cannot fire. Reading the status bag in
//    here would drag `statuses.ts` and a frame clock into a pure module for two booleans.
//
// ⚠ WHAT THIS DELIBERATELY DOES NOT DO: damage, projectiles, respawn *timing* policy, or picking a
// target. Those belong to whoever owns the fight — the range has orbs and one player; the Crucible
// has squads and a vault. Behaviour is shared; consequences are the host's.

import { mulberry32 } from './arena'

export interface HunterTuning {
  /** chase speed in tiles/sec — pressure, not a race */
  speed: number
  /** seconds between shots */
  fireCd: number
  /** how much of `speed` goes sideways into the orbit. 0 = a bee-line, which reads as a turret. */
  orbitMult: number
  /** stops closing once inside this, and orbits instead */
  closeRange: number
  /** how fast the orbit phase advances, radians/sec */
  orbitRate: number
  /** hp on (re)spawn */
  hp: number
  /** spawn ring, tiles from the target */
  spawnMin: number
  spawnSpan: number
  /** the first shot after a spawn is slower than the cadence — a bot that fires on arrival is a trap */
  firstShotCd: number
}

/** The range's numbers, unchanged — this extraction must not alter the feel Alex already tuned. */
export const RANGE_HUNTER: HunterTuning = {
  speed: 3.2, fireCd: 2.2, orbitMult: 0.6, closeRange: 9.5, orbitRate: 0.9,
  hp: 35, spawnMin: 12, spawnSpan: 4, firstShotCd: 1.2,
}

export interface HunterState {
  x: number
  z: number
  hp: number
  alive: boolean
  /** seconds until it may respawn; only meaningful while `!alive` */
  respawn: number
  /** seconds until it may fire again */
  fireCd: number
  /** orbit phase, radians */
  strafe: number
}

export interface HunterCtx {
  /** where it is trying to get to / shoot at */
  targetX: number
  targetZ: number
  /** true if a hunter standing at (x,z) would be inside something solid */
  blocked: (x: number, z: number) => boolean
  /** System 3: an option removed, never HP */
  rooted?: boolean
  disarmed?: boolean
  /** deterministic source for every draw. Same seed ⇒ same fight on every client. */
  rng: () => number
  /** where to put it if the spawn ring lands somewhere solid */
  fallbackX: number
  fallbackZ: number
}

/** What the host should do. The hunter never moves or fires itself. */
export interface HunterIntent {
  /** it took a step to here (already collision-checked); null = it did not move */
  moveTo: { x: number; z: number } | null
  /** it wants a shot this tick, aimed at the target the host passed in */
  fire: boolean
  /** it came back this tick, at here */
  spawnedAt: { x: number; z: number } | null
}

export function createHunter(t: HunterTuning = RANGE_HUNTER): HunterState {
  return { x: 0, z: 0, hp: t.hp, alive: false, respawn: 0, fireCd: t.firstShotCd, strafe: 0 }
}

/** A per-bot deterministic stream. Seed by roster index so two bots never share a walk. */
export function hunterRng(seed: number, index: number): () => number {
  return mulberry32((seed * 0x9e3779b1 + index * 0x85ebca6b) >>> 0)
}

/**
 * Advance one hunter by `dt` seconds and say what the host should do about it.
 *
 * Mutates `state` (position, cooldowns, phase) because a fleet of 60 allocating an object per tick
 * is the kind of thing `render-audit` exists to catch — but every DECISION leaves as the returned
 * intent, so the caller still owns damage, projectiles and death.
 */
export function stepHunter(state: HunterState, ctx: HunterCtx, dt: number, t: HunterTuning = RANGE_HUNTER): HunterIntent {
  const intent: HunterIntent = { moveTo: null, fire: false, spawnedAt: null }

  if (!state.alive) {
    state.respawn -= dt
    if (state.respawn > 0) return intent
    // Spawn on a ring at a random bearing. If that lands in something solid, tuck at the fallback
    // the host nominated rather than inside a wall — a bot spawned in geometry is invisible and
    // unkillable, which reads as the match being broken rather than as one bad spawn.
    const ang = ctx.rng() * Math.PI * 2
    const d = t.spawnMin + ctx.rng() * t.spawnSpan
    let x = ctx.targetX + Math.cos(ang) * d
    let z = ctx.targetZ + Math.sin(ang) * d
    if (ctx.blocked(x, z)) { x = ctx.fallbackX; z = ctx.fallbackZ }
    state.x = x; state.z = z
    state.hp = t.hp
    state.alive = true
    state.fireCd = t.firstShotCd
    state.strafe = ctx.rng() * Math.PI * 2
    intent.spawnedAt = { x, z }
    return intent
  }

  // Face the target, then close to mid-range and orbit. The sine on the perpendicular is what stops
  // it reading as a turret: it drifts across your aim instead of sitting in it.
  let tx = ctx.targetX - state.x
  let tz = ctx.targetZ - state.z
  const dist = Math.hypot(tx, tz)
  if (dist > 0.01) { tx /= dist; tz /= dist }

  state.strafe += dt * t.orbitRate

  let sx = 0, sz = 0
  if (dist > t.closeRange) { sx += tx * t.speed * dt; sz += tz * t.speed * dt }
  const orbit = Math.sin(state.strafe) * t.speed * t.orbitMult * dt
  sx += -tz * orbit
  sz += tx * orbit

  if (!ctx.rooted) {
    const nx = state.x + sx, nz = state.z + sz
    // One test, at the destination. A hunter that clips a corner is better than one that snags on
    // it — the range's version made exactly this trade and it is part of the tuned feel.
    if (!ctx.blocked(nx, nz)) {
      state.x = nx; state.z = nz
      intent.moveTo = { x: nx, z: nz }
    }
  }

  state.fireCd -= dt
  if (state.fireCd <= 0 && !ctx.disarmed) {
    state.fireCd = t.fireCd
    intent.fire = true
  }
  return intent
}
