// GUNPLAY for the open world's test lane (and, later, anywhere a keeper holds a manabox). PURE: no three, no react,
// randomness injected. The five racks hold each Slate's code-less anchor model (CANON game/weapons.md › Models):
// Repeater (sidearm), Spitter (shortbarrel), Backbone (longbarrel), Roar (breacher), Lance (reacher). Names and slates
// are canon; every number here is build (Jin), tuned by Alex at the lane.
//
// Spitter / Lance are engine/weapons.ts's defs, read as they are; the Repeater's fireCd is this file's (M151). Backbone (3-round burst) and Roar (pellets
// + knockback) need two fields that file does not have yet, so they live here as RangeGun extensions until the hub
// folds them into engine/weapons.ts. ⚠ Nothing in this file edits a weapons.ts value.

import { WEAPONS, canFire, spreadDeg, bloomAfterShot, bloomAfterRest, coneDirection, type WeaponDef } from '../../engine/weapons'
import { ECON, payReload } from './vitals-economy'

export interface RangeGun extends WeaponDef {
  /** rounds per trigger pull, fireCd apart is the BURST gap below; 1 = single */
  burst: number
  burstGap: number
  /** projectiles per round (a breacher's shell) */
  pellets: number
  /** metres a hit shoves the target plate back (the breacher's knockback; the others nudge) */
  shove: number
  /** the rack's colour: what the model is painted and what labels it */
  color: string
  /** seconds the trigger CHARGES before the round leaves (the Charred Rifle's short charge-up); 0 / absent = instant */
  charge?: number
  /** canon: a weapon that can never take a sigil (the Enchant Temple turns it away) */
  noSigil?: boolean
}

/** M148: the Backbone's damage a round. 10.4 = 49.5 a second held, 41.9 with reloads: never past the engine Repeater's (0.16 s) 62.5 / 42.0. */
export const BACKBONE_DAMAGE = 10.4
const base = (id: string) => WEAPONS.find(w => w.id === id)!
/** M151 (Alex 11-25): every gun fires while held, so the Repeater's cadence is the open world's own: 0.22 s = 45 a second held. */
export const REPEATER_CD = 0.22
/** M177 (Alex 11-25: "the visible projectile is still too bulky and slow"): the open world's rounds fly ~1.8x as fast (the newcomer sim's
 *  pack fight stays past wilds-teeth's 7 s: at 2.4x it fell 8.5 -> 6.9 s, a faster round misses a moving Hollow less);
 *  each gun's REACH (speed x life) is kept, so life = the old reach / the new speed. engine/weapons.ts (play3d's guns) is
 *  untouched: the faster number is applied here, over its values. Before: repeater 40, spitter 34, backbone 46, roar 38,
 *  lance 54, charred rifle 70 m/s. */
export const M177_SPEED: Record<string, number> = { repeater: 72, spitter: 62, backbone: 82, roar: 68, lance: 100, 'charred-rifle': 125 }
const quicken = (g: RangeGun): RangeGun => {
  const v = M177_SPEED[g.id]
  return v ? { ...g, projSpeed: v, projLife: (g.projSpeed * g.projLife) / v } : g
}
export const RANGE_GUNS: RangeGun[] = ([
  { ...base('repeater'), fireCd: REPEATER_CD, burst: 1, burstGap: 0, pellets: 1, shove: 0.05, color: '#e0a640' },
  { ...base('spitter'), burst: 1, burstGap: 0, pellets: 1, shove: 0.03, color: '#3fb8a8' },
  // BACKBONE (longbarrel) — the workhorse: canon "balanced 3-round burst, mid-range, medium heat".
  { id: 'backbone', name: 'BACKBONE', slot: 'LONGBARREL', auto: false,
    // M148 (Alex 11-24): gap 0.09, 0.45 s between bursts, one 0.63 s cycle you can learn to time. Damage a round is the ONE
    // power dial (BACKBONE_DAMAGE below). Before, the Ather gave one 12 per 0.42 s tap = 28.6 a second (its fire() ignored `burst`).
    fireCd: 0.45, projSpeed: 46, projLife: 2.0,
    damage: BACKBONE_DAMAGE, crit: Math.round(BACKBONE_DAMAGE * 19 / 12 * 10) / 10, clip: 30, reloadTime: 1.6, reloadMana: 11,
    hipSpread: 1.6, adsSpread: 0.18, bloomPerShot: 0.4, bloomMax: 2.4,
    bloomDecay: 6, adsBloomScale: 0.35, kickPitch: 0.012, kickYaw: 0.004,
    converge: 40, headR: 0.08, trailR: 0.06, hipMove: 0.8, adsMove: 0.5,
    burst: 3, burstGap: 0.09, pellets: 1, shove: 0.06, color: '#5a86d8' },
  // ROAR (breacher) — canon "devastation, extreme heat, heavy knockback", wide spread, close.
  { id: 'roar', name: 'ROAR', slot: 'BREACHER', auto: false,
    fireCd: 0.8, projSpeed: 38, projLife: 0.55,
    damage: 7, crit: 9, clip: 6, reloadTime: 2.2, reloadMana: 14,
    hipSpread: 6.5, adsSpread: 4.2, bloomPerShot: 0, bloomMax: 0,
    bloomDecay: 6, adsBloomScale: 0, kickPitch: 0.04, kickYaw: 0.012,
    converge: 14, headR: 0.05, trailR: 0.04, hipMove: 0.78, adsMove: 0.6,
    burst: 1, burstGap: 0, pellets: 9, shove: 0.35, color: '#d0503c' },
  { ...base('lance'), burst: 1, burstGap: 0, pellets: 1, shove: 0.12, color: '#a070d8' },
  // ★ THE CHARRED RIFLE (canon RULED 11-15, CANON_GAPS › "Kael leaves the Charred Rifle at the shipyard"; Alex: "its single
  // fire with a short charge up but packs a punch"). Kael's retired Prototype, left to the keeper with the shipyard; it can
  // NEVER take a sigil (world/manalic-weapons.md). A primary: one heavy round per pull after a 0.35 s charge. Numbers = build.
  { id: 'charred-rifle', name: 'CHARRED RIFLE', slot: 'LONGBARREL', auto: false,
    fireCd: 0.9, projSpeed: 70, projLife: 2.2,
    damage: 34, crit: 55, clip: 5, reloadTime: 2.0, reloadMana: 12,
    hipSpread: 0.5, adsSpread: 0.06, bloomPerShot: 0, bloomMax: 0,
    bloomDecay: 6, adsBloomScale: 0, kickPitch: 0.03, kickYaw: 0.006,
    converge: 60, headR: 0.09, trailR: 0.07, hipMove: 0.85, adsMove: 0.55,
    burst: 1, burstGap: 0, pellets: 1, shove: 0.2, color: '#6b4a2f', charge: 0.35, noSigil: true },
] as RangeGun[]).map(quicken)
/** a burst gun's full cycle, first round to first round (its trigger held) */
export const burstCycle = (g: { burst: number; burstGap: number; fireCd: number }) => (g.burst - 1) * g.burstGap + g.fireCd
export const RHYTHM_DIALS = { gap: { min: 0.04, max: 0.16, step: 0.005 }, delay: { min: 0.3, max: 0.9, step: 0.01 } } as const
const clampTo = (v: number, d: { min: number; max: number }) => Math.max(d.min, Math.min(d.max, v))
/** M148: a burst gun on another rhythm (the gun tuner's dials). Damage per round follows the cycle, so a rhythm never changes the
 *  gun's damage per second. Same object back when nothing moves, and for every gun that fires single rounds. */
export function withRhythm<G extends RangeGun>(g: G, gap?: number, delay?: number): G {
  if (g.burst <= 1) return g
  const burstGap = Number.isFinite(gap) ? clampTo(gap!, RHYTHM_DIALS.gap) : g.burstGap, fireCd = Number.isFinite(delay) ? clampTo(delay!, RHYTHM_DIALS.delay) : g.fireCd
  if (burstGap === g.burstGap && fireCd === g.fireCd) return g
  const k = burstCycle({ burst: g.burst, burstGap, fireCd }) / burstCycle(g)
  return { ...g, burstGap, fireCd, damage: g.damage * k, crit: g.crit * k }
}
export const gunForSlate = (slate: string) => RANGE_GUNS.find(g => g.slot === slate) ?? null

export interface Round {
  x: number; y: number; z: number; vx: number; vy: number; vz: number
  life: number; age: number; dmg: number; crit: number; shove: number; gun: string
}
export interface GunState {
  gun: RangeGun; ammo: number; reloading: number; sinceShot: number; bloom: number
  burstLeft: number; burstT: number; wasDown: boolean
  /** M80: the keeper's mana bar; a reload pays ECON.reloadMana from it (unset = free). `dry` counts refused reloads. */
  mana?: { cur: number }
  dry?: number
}
export const holdGun = (gun: RangeGun): GunState =>
  ({ gun, ammo: gun.clip, reloading: 0, sinceShot: 99, bloom: 0, burstLeft: 0, burstT: 0, wasDown: false })

/** M176: would an E press start a reload? (full, running or short of mana = no) */
export const canReloadGun = (g: GunState) => g.reloading <= 0 && g.ammo < g.gun.clip && (!g.mana || g.mana.cur >= ((g.gun as { reloadPay?: number }).reloadPay ?? ECON.reloadMana))

export function reloadGun(g: GunState) {
  if (g.reloading > 0 || g.ammo >= g.gun.clip) return
  if (!payReload(g.mana, (g.gun as { reloadPay?: number }).reloadPay)) { g.dry = (g.dry ?? 0) + 1; g.burstLeft = 0; return }   // M80: reloads cost mana everywhere (M78 dial)
  g.reloading = g.gun.reloadTime; g.burstLeft = 0
}

export interface Muzzle { x: number; y: number; z: number; dx: number; dy: number; dz: number; gun: string }

/** One tick of the trigger. `down` = trigger held; `ads` = aiming down the sights (the tighter cone). Pushes rounds into `out`; returns the muzzle flashes it fired
 *  (one per round, not per pellet) so the host can flash, kick and play sound. */
export function stepGun(
  g: GunState, dt: number, down: boolean,
  eye: { x: number; y: number; z: number }, aim: { x: number; y: number; z: number },
  rand: () => number, out: Round[], ads = false,
): Muzzle[] {
  const w = g.gun, fired: Muzzle[] = []
  g.sinceShot += dt
  g.bloom = bloomAfterRest(w, g.bloom, dt)
  if (g.reloading > 0) { g.reloading -= dt; if (g.reloading <= 0) { g.reloading = 0; g.ammo = w.clip } }
  const pressed = down && !g.wasDown
  g.wasDown = down
  const shoot = () => {
    const spread = spreadDeg(w, g.bloom, ads)
    for (let p = 0; p < w.pellets; p++) {
      const [dx, dy, dz] = coneDirection(aim.x, aim.y, aim.z, spread, rand(), rand())
      // rounds leave a hair below and right of the eye, where the viewmodel's muzzle is, so a tracer is SEEN leaving
      out.push({ x: eye.x + dx * 0.6, y: eye.y - 0.12 + dy * 0.6, z: eye.z + dz * 0.6,
        vx: dx * w.projSpeed, vy: dy * w.projSpeed, vz: dz * w.projSpeed, life: w.projLife, age: 0,
        dmg: w.damage, crit: w.crit, shove: w.shove, gun: w.id })
    }
    g.ammo--; g.sinceShot = 0; g.bloom = bloomAfterShot(w, g.bloom)
    fired.push({ x: eye.x + aim.x * 0.6, y: eye.y - 0.12 + aim.y * 0.6, z: eye.z + aim.z * 0.6, dx: aim.x, dy: aim.y, dz: aim.z, gun: w.id })
    if (g.ammo <= 0) reloadGun(g)
  }
  // a burst in flight finishes on its own clock, trigger or not (that is what a burst IS)
  if (g.burstLeft > 0) {
    g.burstT -= dt
    while (g.burstLeft > 0 && g.burstT <= 0 && g.ammo > 0 && g.reloading <= 0) { shoot(); g.burstLeft--; g.burstT += w.burstGap }
    if (g.ammo <= 0) g.burstLeft = 0
    return fired
  }
  // ★ HOLDING THE TRIGGER FIRES ON EVERY GUN (Alex 11-15: "holding the trigger fires even if its only bursts at a
  // time"). A semi-auto held re-fires at its own fireCd; a burst gun held fires burst after burst, fireCd apart.
  // `pressed` still matters for one thing: a press on an empty clip starts the reload.
  const want = down
  if (want && canFire(w, g.sinceShot, g.ammo, g.reloading)) {
    shoot()
    if (w.burst > 1) { g.burstLeft = w.burst - 1; g.burstT = w.burstGap }
  } else if (pressed && g.ammo <= 0) reloadGun(g)
  return fired
}

// ── targets: a silhouette plate on a post, facing up the lane ──────────────────────────────────────────────────────
export const PLATE = { w: 0.62, h: 0.9, cy: 1.25, headR: 0.19, headY: 1.95 }
export interface Target { id: number; x: number; y: number; z: number; yaw: number; swing: number; swingV: number; hits: number; flash: number; lastZone: 'head' | 'body' | null }
export interface Hit { target: number; zone: 'head' | 'body'; dmg: number; x: number; y: number; z: number; range: number }
export interface Impact { x: number; y: number; z: number; nx: number; ny: number; nz: number; gun: string; target: boolean }

/** Moves rounds one tick. A round dies on a target plate (Hit), on the world (`solid`), or of age. */
export function stepRounds(
  rounds: Round[], dt: number, targets: Target[], solid: (x: number, y: number, z: number) => boolean,
  from: { x: number; z: number },
): { hits: Hit[]; impacts: Impact[] } {
  const hits: Hit[] = [], impacts: Impact[] = []
  for (let i = rounds.length - 1; i >= 0; i--) {
    const r = rounds[i]
    const ax = r.x, ay = r.y, az = r.z
    const bx = ax + r.vx * dt, by = ay + r.vy * dt, bz = az + r.vz * dt
    let dead = false
    for (const t of targets) {
      // the plate's plane: normal = facing (sin yaw, 0, cos yaw), tilted back by its swing
      const nx = Math.sin(t.yaw), nz = Math.cos(t.yaw)
      const da = (ax - t.x) * nx + (az - t.z) * nz, db = (bx - t.x) * nx + (bz - t.z) * nz
      if (da < 0 || db > 0) continue                           // only from the front, crossing the plane
      const f = da / (da - db)
      const hx = ax + (bx - ax) * f, hy = ay + (by - ay) * f, hz = az + (bz - az) * f
      const side = (hx - t.x) * nz - (hz - t.z) * nx          // along the plate
      const up = hy - t.y
      const head = Math.hypot(side, up - PLATE.headY) <= PLATE.headR
      const body = Math.abs(side) <= PLATE.w / 2 && Math.abs(up - PLATE.cy) <= PLATE.h / 2
      if (!head && !body) continue
      const zone = head ? 'head' : 'body'
      const dmg = head ? r.crit : r.dmg
      t.hits++; t.flash = 1; t.lastZone = zone; t.swingV += r.shove * 9
      hits.push({ target: t.id, zone, dmg, x: hx, y: hy, z: hz, range: Math.hypot(hx - from.x, hz - from.z) })
      impacts.push({ x: hx, y: hy, z: hz, nx, ny: 0, nz, gun: r.gun, target: true })
      dead = true; break
    }
    if (!dead && solid(bx, by, bz)) {
      const l = Math.hypot(r.vx, r.vy, r.vz) || 1
      impacts.push({ x: ax, y: ay, z: az, nx: -r.vx / l, ny: -r.vy / l, nz: -r.vz / l, gun: r.gun, target: false })
      dead = true
    }
    r.age += dt; r.life -= dt
    if (dead || r.life <= 0) { rounds.splice(i, 1); continue }
    r.x = bx; r.y = by; r.z = bz
  }
  for (const t of targets) {
    // a plate on a sprung hinge: shoved back, swings home
    t.swingV += (-t.swing * 60 - t.swingV * 7) * dt
    t.swing = Math.max(-0.2, Math.min(1.1, t.swing + t.swingV * dt))
    t.flash = Math.max(0, t.flash - dt * 4)
  }
  return { hits, impacts }
}

// ── ★ HIT-SCAN (Alex 11-15: "it should feel like hit scan") ──────────────────────────────────────────────────────────
// The shot lands the instant the trigger breaks, along the aim (inside the gun's cone). The round the player SEES is a
// visual only, a fast streak from the barrel to the point already hit (tracers.tsx). v1 flew real projectiles at
// 34-54 m/s: at 25 m the hit came half a second after the shot, and a strafing shooter watched rounds slide off the
// line they were fired along. projSpeed/projLife are now only the streak's look and the gun's reach.
export const HITSCAN_RANGE = 120
export interface ScanResult { x: number; y: number; z: number; nx: number; ny: number; nz: number; dist: number; hit: Hit | null }

/** Cast one shot from `eye` along unit `dir`: the nearest plate (front face, body or head) or the world. Applies the
 *  hit to the plate (flash, shove, count) and returns where the shot ended. */
export function hitscan(
  eye: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number },
  targets: Target[], solid: (x: number, y: number, z: number) => boolean,
  shot: { dmg: number; crit: number; shove: number }, from: { x: number; z: number }, range = HITSCAN_RANGE,
): ScanResult {
  // the world first: march to the first solid sample, then bisect for a clean surface point
  let wall = range
  const STEP = 0.25
  for (let d = STEP; d <= range; d += STEP) {
    if (solid(eye.x + dir.x * d, eye.y + dir.y * d, eye.z + dir.z * d)) {
      let a = d - STEP, b = d
      for (let k = 0; k < 8; k++) { const m = (a + b) / 2; if (solid(eye.x + dir.x * m, eye.y + dir.y * m, eye.z + dir.z * m)) b = m; else a = m }
      wall = a; break
    }
  }
  // then every plate in front of that wall: the nearest one the ray crosses inside its silhouette
  let best: { t: Target; d: number; zone: 'head' | 'body'; x: number; y: number; z: number } | null = null
  for (const t of targets) {
    const nx = Math.sin(t.yaw), nz = Math.cos(t.yaw)
    const denom = dir.x * nx + dir.z * nz
    if (denom >= -1e-6) continue                              // only the face, from in front
    const d = -((eye.x - t.x) * nx + (eye.z - t.z) * nz) / denom
    if (d <= 0 || d >= wall || (best && d >= best.d)) continue
    const hx = eye.x + dir.x * d, hy = eye.y + dir.y * d, hz = eye.z + dir.z * d
    const side = (hx - t.x) * nz - (hz - t.z) * nx, up = hy - t.y
    const head = Math.hypot(side, up - PLATE.headY) <= PLATE.headR
    const body = Math.abs(side) <= PLATE.w / 2 && Math.abs(up - PLATE.cy) <= PLATE.h / 2
    if (head || body) best = { t, d, zone: head ? 'head' : 'body', x: hx, y: hy, z: hz }
  }
  if (best) {
    const t = best.t, nx = Math.sin(t.yaw), nz = Math.cos(t.yaw)
    t.hits++; t.flash = 1; t.lastZone = best.zone; t.swingV += shot.shove * 9
    const hit: Hit = { target: t.id, zone: best.zone, dmg: best.zone === 'head' ? shot.crit : shot.dmg, x: best.x, y: best.y, z: best.z, range: Math.hypot(best.x - from.x, best.z - from.z) }
    return { x: best.x, y: best.y, z: best.z, nx, ny: 0, nz, dist: best.d, hit }
  }
  return { x: eye.x + dir.x * wall, y: eye.y + dir.y * wall, z: eye.z + dir.z * wall, nx: -dir.x, ny: -dir.y, nz: -dir.z, dist: wall, hit: null }
}

/** The plates' springs, stepped on their own now that nothing flies (stepRounds still does this for projectiles). */
export function stepPlates(targets: Target[], dt: number) {
  for (const t of targets) {
    t.swingV += (-t.swing * 60 - t.swingV * 7) * dt
    t.swing = Math.max(-0.2, Math.min(1.1, t.swing + t.swingV * dt))
    t.flash = Math.max(0, t.flash - dt * 4)
  }
}
