// GUNPLAY for the open world's test lane (and, later, anywhere a keeper holds a manabox). PURE: no three, no react,
// randomness injected. The five racks hold each Slate's code-less anchor model (CANON game/weapons.md › Models):
// Repeater (sidearm), Spitter (shortbarrel), Backbone (longbarrel), Roar (breacher), Lance (reacher). Names and slates
// are canon; every number here is build (Jin), tuned by Alex at the lane.
//
// Spitter / Lance are engine/weapons.ts's defs, read as they are; the Repeater's fireCd is this file's (M151). Backbone (3-round burst) and Roar (pellets
// + knockback) need two fields that file does not have yet, so they live here as RangeGun extensions until the hub
// folds them into engine/weapons.ts. ⚠ Nothing in this file edits a weapons.ts value.

import type { OpticId } from './optics'
import { WEAPONS, canFire, spreadDeg, bloomAfterShot, bloomAfterRest, coneDirection, type WeaponDef } from '../../engine/weapons'
import { ECON, payReload } from './vitals-economy'

export interface RangeGun extends WeaponDef {
  /** M178: this gun's sight (shared/optics.ts). Absent = IRONS, every gun's default; a bought better sight (s2) names its optic here */
  optic?: OpticId
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
  /** M245 s2 (Alex 11-27): a PAIR, one gun each hand (the DB2 Twins): rounds alternate hands, LEFT first (pairHand); the 'fired'
   *  event / Muzzle carries which hand, for the two-gun rig (M152 s2) to read */
  pair?: boolean
}
/** M245 s2: which hand fires the n-th round of a pair's clip (0-based): LEFT first (rune 1, M152), then right, alternating */
export const pairHand = (n: number): 'left' | 'right' => (n % 2 === 0 ? 'left' : 'right')

/** M148: the Backbone's damage a round (was 10.4). M245 (Alex 11-27): 24 (the Hollows went to 100-150 hp), a round AS EVERYONE FIRES
 *  IT: on its baked M195 rhythm (M195_BACKBONE_RHYTHM, fp-gun GUN_RHYTHM_BAKED), which withRhythm scales damage by to keep the
 *  damage a second. So the ROW carries 24 x the row's cycle / the baked cycle (20.43), and the gun in hand fires 24. */
export const BACKBONE_DAMAGE = 24
/** M195 (Alex 11-26, the Gun Tuner paste): the Backbone's baked rhythm (fp-gun GUN_RHYTHM_BAKED reads it) */
export const M195_BACKBONE_RHYTHM = { BURST_GAP: 0.07, BURST_DELAY: 0.6 }
/** M245: what the Backbone's ROW carries a round so the baked rhythm fires BACKBONE_DAMAGE (row cycle 0.63 s, baked 0.74 s) */
export const BACKBONE_ROW_DAMAGE = BACKBONE_DAMAGE * (2 * 0.09 + 0.45) / (2 * M195_BACKBONE_RHYTHM.BURST_GAP + M195_BACKBONE_RHYTHM.BURST_DELAY)
/** M245 (Alex 11-27, BETA M245): the open world's BODY damage a round, every gun re-numbered with the Hollows' hp (shambler 45 -> 150,
 *  crawler 35 -> 120, floater 30 -> 100). engine/weapons.ts (play3d's guns) is untouched: these are applied over its values, as M177's
 *  speeds are. Champions (champion.ts CHAMP.barHp) are scaled by M245_CHAMP_SCALE so their time-to-kill holds. */
export const M245_DAMAGE: Record<string, number> = { repeater: 18, spitter: 16, backbone: BACKBONE_DAMAGE, roar: 12, lance: 108, 'charred-rifle': 77 }
/** M245: the damage a round a gun's ROW carries for M245_DAMAGE to be what it fires in hand (only the Backbone has a baked rhythm) */
const ROW_DAMAGE: Record<string, number> = { backbone: BACKBONE_ROW_DAMAGE }
/** M245 HEADSHOTS (Alex 11-27): HEAD = BODY x this, ONE table for every gun (bench guns too). Most guns 1.5x, shotguns 1.25x a pellet,
 *  precision rifles 2x. Replaces the M150 s5 Lance headKill insta-kill: a Lance head (216) drops a 150 shambler only because 216 > 150. */
export const HEAD_MULT: Record<string, number> = {
  repeater: 1.5, spitter: 1.5, backbone: 1.5, grinder: 1.5,
  roar: 1.25, twins: 1.25,
  lance: 2, 'charred-rifle': 2,
}
/** a gun's head (crit) damage a round: its body damage x HEAD_MULT (one decimal) */
export const headOf = (id: string, damage: number) => Math.round(damage * (HEAD_MULT[id] ?? 1.5) * 10) / 10
/** M245: pellets a round where Alex changed them (the Roar 9 -> 8) */
export const M245_PELLETS: Record<string, number> = { roar: 8 }
/** M245: each gun's damage / crit / pellets a round BEFORE the re-number (the before/after table and the champion scale) */
export const M245_BEFORE: Record<string, { damage: number; crit: number; pellets?: number }> = {
  repeater: { damage: 10, crit: 16 }, spitter: { damage: 7, crit: 11 }, backbone: { damage: 10.4, crit: 16.5 }, roar: { damage: 7, crit: 9, pellets: 9 },
  lance: { damage: 22, crit: 34 }, 'charred-rifle': { damage: 22, crit: 55 },
}
const reDamage = (g: RangeGun): RangeGun => {
  const d = M245_DAMAGE[g.id], row = ROW_DAMAGE[g.id]
  return row ? { ...g, damage: row, crit: row * (HEAD_MULT[g.id] ?? 1.5) } : d ? { ...g, damage: d, crit: headOf(g.id, d) } : g
}
/** M245: what non-gun damage on a Hollow (the fist, casts, a spirit's hit, burning) is scaled by to keep its hits-to-kill: the shambler's
 *  and floater's hp factor (150/45 = 100/30 = 10/3). */
export const M245_HOLLOW_SCALE = 10 / 3
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
    burst: 1, burstGap: 0, pellets: M245_PELLETS.roar, shove: 0.35, color: '#d0503c' },   // M245 (Alex 11-27): 8 pellets (was 9) x 12 (M245_DAMAGE)
  { ...base('lance'), burst: 1, burstGap: 0, pellets: 1, shove: 0.12, color: '#a070d8' },   // M245: the M150 s5 headKill rule is gone (HEAD_MULT 2x)
  // ★ THE CHARRED RIFLE (canon RULED 11-15, CANON_GAPS › "Kael leaves the Charred Rifle at the shipyard"; Alex: "its single
  // fire with a short charge up but packs a punch"). Kael's retired Prototype, left to the keeper with the shipyard; it can
  // NEVER take a sigil (world/manalic-weapons.md). A primary: one heavy round per pull after a 0.35 s charge. Numbers = build.
  { id: 'charred-rifle', name: 'CHARRED RIFLE', slot: 'LONGBARREL', auto: false,
    fireCd: 0.9, projSpeed: 70, projLife: 2.2,
    // M150 s5 (Alex 11-27: "the charred rifle I'd like it get the reacher's damage"): its damage a round = the Lance's (was 34).
    // M245: re-numbered to 77 by reDamage (M245_DAMAGE); this is the pre-M245 value it scales from.
    damage: base('lance').damage, crit: 55, clip: 5, reloadTime: 2.0, reloadMana: 12,
    hipSpread: 0.5, adsSpread: 0.06, bloomPerShot: 0, bloomMax: 0,
    bloomDecay: 6, adsBloomScale: 0, kickPitch: 0.03, kickYaw: 0.006,
    converge: 60, headR: 0.09, trailR: 0.07, hipMove: 0.85, adsMove: 0.55,
    burst: 1, burstGap: 0, pellets: 1, shove: 0.2, color: '#6b4a2f', charge: 0.35, noSigil: true },
] as RangeGun[]).map(quicken).map(reDamage)
/** M245: the factor champion bar hp (and a champion's wave adds, its heal, the guest-hit caps) is scaled by: the DEFAULT gun's
 *  (the Repeater, every newcomer's) damage factor, 18 / 10 = 1.8. The 09-24 keeper rule (a newcomer with the default gun keeps pace;
 *  wilds-teeth / wilds-merge sims) holds a champion fight to the newcomer's time-to-kill, and only this factor keeps it: the
 *  harmonic mean over all six guns (2.52, the factor that keeps the MEAN time-to-kill) stretched a newcomer's champion 24.9 -> 35.7 s
 *  and took deaths 0 -> 15 / 200 (over the rule's 6%). The precision rifles drop a champion faster than before (m245-damage.test). */
export const M245_DEFAULT_GUN = 'repeater'
export const M245_CHAMP_SCALE = M245_DAMAGE[M245_DEFAULT_GUN] / M245_BEFORE[M245_DEFAULT_GUN].damage
/** a burst gun's full cycle, first round to first round (its trigger held) */
export const burstCycle = (g: { burst: number; burstGap: number; fireCd: number }) => (g.burst - 1) * g.burstGap + g.fireCd
export const RHYTHM_DIALS = { gap: { min: 0.04, max: 0.16, step: 0.005 }, delay: { min: 0.3, max: 0.9, step: 0.01 }, fire: { min: 0.05, max: 1.5, step: 0.01 } } as const
const clampTo = (v: number, d: { min: number; max: number }) => Math.max(d.min, Math.min(d.max, v))
/** M148: a burst gun on another rhythm (the gun tuner's dials). Damage per round follows the cycle, so a rhythm never changes the
 *  gun's damage per second. Same object back when nothing moves.
 *  M197: a single-fire gun takes `delay` as its FIRE INTERVAL (seconds between rounds, RHYTHM_DIALS.fire); `gap` is ignored. */
/** M245: float dust off a rhythm-scaled number (24 x 0.63 / 0.74 x 0.74 / 0.63 reads 24, not 23.999999999999996) */
const tidy = (v: number) => Math.round(v * 1e9) / 1e9
export function withRhythm<G extends RangeGun>(g: G, gap?: number, delay?: number): G {
  if (g.burst <= 1) {
    const fireCd = Number.isFinite(delay) ? clampTo(delay!, RHYTHM_DIALS.fire) : g.fireCd
    if (fireCd === g.fireCd) return g
    const k = fireCd / g.fireCd
    return { ...g, fireCd, damage: tidy(g.damage * k), crit: tidy(g.crit * k) }
  }
  const burstGap = Number.isFinite(gap) ? clampTo(gap!, RHYTHM_DIALS.gap) : g.burstGap, fireCd = Number.isFinite(delay) ? clampTo(delay!, RHYTHM_DIALS.delay) : g.fireCd
  if (burstGap === g.burstGap && fireCd === g.fireCd) return g
  const k = burstCycle({ burst: g.burst, burstGap, fireCd }) / burstCycle(g)
  return { ...g, burstGap, fireCd, damage: tidy(g.damage * k), crit: tidy(g.crit * k) }
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

export interface Muzzle { x: number; y: number; z: number; dx: number; dy: number; dz: number; gun: string; hand?: 'left' | 'right' }

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
    const hand = w.pair ? pairHand(w.clip - g.ammo) : undefined   // M245 s2: a pair alternates hands
    g.ammo--; g.sinceShot = 0; g.bloom = bloomAfterShot(w, g.bloom)
    fired.push({ x: eye.x + aim.x * 0.6, y: eye.y - 0.12 + aim.y * 0.6, z: eye.z + aim.z * 0.6, dx: aim.x, dy: aim.y, dz: aim.z, gun: w.id, ...(hand ? { hand } : {}) })
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
