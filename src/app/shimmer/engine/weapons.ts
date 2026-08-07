// The weapon table and the ballistics math — extracted from Shimmer3D 2026-08-07.
//
// ── ★ WHY THIS IS AN EXTRACTION AND NOT A PORT ───────────────────────────────────────────────
// Alex asked to "port the guns into voxel3d". There was nothing portable to move: `WEAPONS` was a
// bare literal at Shimmer3D.tsx:1804 and everything that used it lived inside `FiringRange`, a
// ~650-line component that is not a gun system at all — it is FIVE systems sharing a useFrame:
// gunplay, the cast layer, persistent fields, conjured terrain, the status bag, and the hunter
// orbs. Copying it would have dragged play3d's whole combat model into the voxel world.
//
// And the one thing a copy could not have brought across is the part that matters: every collision
// check in there reads `gridRef.current[cz][cx]` — a `number[][]` tile grid. The voxel world has no
// such thing. **Collision is exactly the half that cannot be reused**, so this file takes the half
// that can (the table, the tuning, the math) and each walker owns its own hit detection.
//
// ── WHAT LIVES HERE ──────────────────────────────────────────────────────────────────────────
// Data and pure functions only. No react, no three, no world. Two walkers import the same table, so
// a tuning change lands in both and they can never disagree about what a Lance is — which was a
// real risk the moment guns existed in two places.
//
// ── CANON ────────────────────────────────────────────────────────────────────────────────────
// The three models and their slates are canon (`CANON/game/weapons.md`, REVIEW-PASSES rule 5: every
// slate is one of sidearm · shortbarrel · longbarrel · breacher · reacher). Names, slates and the
// 12-shot Repeater clip are Magii's. Damage, cooldowns, spread and bloom are Jin's — tuning is
// build, identity is canon.
//
// ⚠ Guns in the Ather is an ALEX RULING of 2026-08-07 that overturns the 2026-07-22 aegis in
// `world/lucernyx.md` ("a crosser leaves the gun behind"). It is recorded in CANON_GAPS.md and
// still needs authoring into the canon files. This module does not assert where guns may be used —
// that is the caller's gate, deliberately, so the ruling landing narrower costs one call site.

export type Slate = 'SIDEARM' | 'SHORTBARREL' | 'LONGBARREL' | 'BREACHER' | 'REACHER'

export interface WeaponDef {
  id: string
  name: string
  slot: Slate
  /** Held trigger keeps firing. Semi-auto fires once per press. */
  auto: boolean
  fireCd: number        // seconds between shots
  projSpeed: number     // units/sec
  projLife: number      // seconds before the round fizzles
  damage: number
  crit: number          // head-zone damage
  clip: number
  reloadTime: number    // seconds of recharge channel
  reloadMana: number    // mana for a FULL recharge; partials cost proportionally
  hipSpread: number     // deg — base hipfire cone half-angle
  adsSpread: number     // deg — aimed fire
  bloomPerShot: number  // deg added per round
  bloomMax: number      // deg cap
  bloomDecay: number    // deg/sec recovery while not firing
  adsBloomScale: number
  kickPitch: number     // rad of camera climb per round
  kickYaw: number       // rad max random horizontal drift
  converge: number      // range at which muzzle rounds meet the crosshair ray
  headR: number         // round head radius — tracers are THIN, the streak is the read
  trailR: number
  hipMove: number       // movement-speed multiplier while holding it hipfire
  adsMove: number       // ...and while aimed. The heavier the gun, the more it costs you.
}

/**
 * The three shipped models. Values are Shimmer3D's, moved verbatim — this extraction deliberately
 * changed no tuning, so a feel regression in play3d can be blamed on the move and nothing else.
 */
export const WEAPONS: WeaponDef[] = [
  // SPITTER (shortbarrel) — the run-and-gun automatic. Forgiving cone, fast rounds, big clip.
  { id: 'spitter', name: 'SPITTER', slot: 'SHORTBARREL', auto: true,
    fireCd: 0.11, projSpeed: 34, projLife: 1.8,
    damage: 7, crit: 11, clip: 24, reloadTime: 1.4, reloadMana: 10,
    hipSpread: 2.2, adsSpread: 0.25, bloomPerShot: 0.45, bloomMax: 2.6,
    bloomDecay: 5, adsBloomScale: 0.35, kickPitch: 0.0075, kickYaw: 0.0035,
    converge: 38, headR: 0.06, trailR: 0.045, hipMove: 0.85, adsMove: 0.55 },

  // LANCE (reacher) — slow heavy single-shot marksman. A laser when aimed, loose from the hip, so
  // it rewards ADS. Small clip, heavy kick, slows you the most. The Spitter's counterweight.
  { id: 'lance', name: 'LANCE', slot: 'REACHER', auto: false,
    fireCd: 0.5, projSpeed: 54, projLife: 2.4,
    damage: 22, crit: 34, clip: 8, reloadTime: 2.0, reloadMana: 12,
    hipSpread: 3.4, adsSpread: 0.14, bloomPerShot: 0.9, bloomMax: 3.6,
    bloomDecay: 6, adsBloomScale: 0.3, kickPitch: 0.021, kickYaw: 0.006,
    converge: 46, headR: 0.12, trailR: 0.085, hipMove: 0.70, adsMove: 0.42 },

  // REPEATER (sidearm) — the everyman backup. Canon's "12 shots before overheat". Lightest, so the
  // least movement penalty: the gun you keep up while running. Low damage; a finisher, not a punch.
  { id: 'repeater', name: 'REPEATER', slot: 'SIDEARM', auto: false,
    fireCd: 0.16, projSpeed: 40, projLife: 1.8,
    damage: 10, crit: 16, clip: 12, reloadTime: 1.1, reloadMana: 8,
    hipSpread: 1.6, adsSpread: 0.2, bloomPerShot: 0.35, bloomMax: 2.0,
    bloomDecay: 6, adsBloomScale: 0.35, kickPitch: 0.011, kickYaw: 0.004,
    converge: 34, headR: 0.07, trailR: 0.05, hipMove: 0.88, adsMove: 0.6 },
]

const BY_ID = new Map(WEAPONS.map(w => [w.id, w]))
export const weaponDef = (id: string): WeaponDef | undefined => BY_ID.get(id)
/** Clamped so a stale index from a save can never crash the sim — it just hands back the Spitter. */
export const weaponAt = (i: number): WeaponDef => WEAPONS[Math.max(0, Math.min(WEAPONS.length - 1, i | 0))]

/** ADS zoom, shared so both walkers aim the same. */
export const ADS_FOV = 50

// ── the math, all pure ────────────────────────────────────────────────────────────────────────

/**
 * The cone half-angle a shot leaves the barrel inside, in degrees.
 *
 * Bloom is ADDED to the base cone rather than replacing it, and ADS scales BOTH — that is what
 * makes aimed fire feel like a different weapon rather than the same one with a smaller number.
 */
export function spreadDeg(w: WeaponDef, bloom: number, ads: boolean): number {
  const base = ads ? w.adsSpread : w.hipSpread
  return base + bloom * (ads ? w.adsBloomScale : 1)
}

/** Bloom after firing one round. Caps, so holding the trigger has a floor of accuracy. */
export const bloomAfterShot = (w: WeaponDef, bloom: number): number =>
  Math.min(w.bloomMax, bloom + w.bloomPerShot)

/** Bloom recovery. Never below zero — a negative cone would invert the spread math downstream. */
export const bloomAfterRest = (w: WeaponDef, bloom: number, dt: number): number =>
  Math.max(0, bloom - w.bloomDecay * dt)

/**
 * Can this weapon fire right now?
 *
 * `sinceLast` rather than a stored timestamp so the caller owns the clock — a sim that can be
 * paused, and a test that can step time, both need that.
 */
export function canFire(w: WeaponDef, sinceLast: number, ammo: number, reloading: number): boolean {
  return reloading <= 0 && ammo > 0 && sinceLast >= w.fireCd
}

/**
 * Mana for a recharge, proportional to how empty the clip is.
 *
 * ★ Reloading a nearly-full clip must not cost a full clip's mana, or the optimal play becomes
 * "always run dry first" — which is the opposite of what a reload cost is for.
 */
export function reloadCost(w: WeaponDef, ammo: number): number {
  const missing = Math.max(0, Math.min(w.clip, w.clip - ammo))
  return (w.reloadMana * missing) / w.clip
}

/** Movement multiplier for the stance you are in. Holstered is the caller's business (always 1). */
export const moveMult = (w: WeaponDef, ads: boolean): number => (ads ? w.adsMove : w.hipMove)

/**
 * Per-round camera kick. `rand` is injected, never `Math.random()` — the sim has to be
 * deterministic for a replay or a test, and a module reaching for global randomness is exactly how
 * that gets lost. Same discipline the voxel core uses for its seeds.
 */
export function recoilKick(w: WeaponDef, rand: () => number): { pitch: number; yaw: number } {
  return { pitch: w.kickPitch, yaw: (rand() * 2 - 1) * w.kickYaw }
}

/**
 * A unit direction inside the spread cone, given a forward vector and two [0,1) randoms.
 *
 * Returned as a plain triple, not a THREE.Vector3: this module is host-agnostic and the caller
 * already has a vector type. The cone is built on an arbitrary perpendicular basis, which is
 * correct for a circular cone — no preferred axis, so the scatter has no visible grain.
 */
export function coneDirection(
  fx: number, fy: number, fz: number,
  spreadDegrees: number,
  r1: number, r2: number,
): [number, number, number] {
  const flen = Math.hypot(fx, fy, fz) || 1
  const ux = fx / flen, uy = fy / flen, uz = fz / flen
  if (spreadDegrees <= 0) return [ux, uy, uz]

  // Any vector not parallel to the forward one gives a valid basis; picking by smallest component
  // avoids the degenerate case where the seed is (nearly) the forward vector itself.
  const ax = Math.abs(ux), ay = Math.abs(uy), az = Math.abs(uz)
  const sx = ax <= ay && ax <= az ? 1 : 0
  const sy = ay < ax && ay <= az ? 1 : 0
  const sz = sx === 0 && sy === 0 ? 1 : 0
  // right = normalize(seed × forward); up = forward × right
  let rx = sy * uz - sz * uy, ry = sz * ux - sx * uz, rz = sx * uy - sy * ux
  const rl = Math.hypot(rx, ry, rz) || 1
  rx /= rl; ry /= rl; rz /= rl
  const vx = uy * rz - uz * ry, vy = uz * rx - ux * rz, vz = ux * ry - uy * rx

  // sqrt(r1) gives a UNIFORM disc rather than a centre-heavy one. Without it every gun feels more
  // accurate than its cone says, because most samples land near the axis.
  const theta = Math.tan((spreadDegrees * Math.PI) / 180) * Math.sqrt(r1)
  const phi = r2 * Math.PI * 2
  const ox = Math.cos(phi) * theta, oy = Math.sin(phi) * theta
  const dx = ux + rx * ox + vx * oy
  const dy = uy + ry * ox + vy * oy
  const dz = uz + rz * ox + vz * oy
  const dl = Math.hypot(dx, dy, dz) || 1
  return [dx / dl, dy / dl, dz / dl]
}
