// COMBAT IN THE WILDS — real time, in the walker (Alex 11-14: "everything real time… the hallows will basically be
// the drowned of the ather, the combat should feel like zombies").
//
// ★ CANON: the Hollows are canon (game/shimmer-geography.md › THE HOLLOWS 08-07; look locked in
// design-briefs/hollows.md 08-15: goopy bipeds, ONLY the ranged form floats, no colour of its own, wet so it borrows
// the world's). Their widened role (infesting the Wilds, dropping grey matter) is Alex's revamp, [OPEN] in
// CANON_GAPS. Guns in the Ather: Alex 08-07 (engine/weapons.ts header). The gun table is shared; hit detection is
// ours (each walker owns its own, per weapons.ts).
//
// Zombie feel, as build: slow, relentless, dangerous in NUMBERS not alone. A shambler drifts until it notices you,
// closes at a stagger, then commits to a lunge you can read and side-step. A hit staggers it. Each kill leaves a
// little grey matter to walk over.
//
// ★ PURE. No react, no three. The scene layer feeds it the keeper's eye and aim, and draws what it returns.

import { canFire, spreadDeg, bloomAfterShot, bloomAfterRest, weaponDef, type WeaponDef } from '../../engine/weapons'

export interface Terrain {
  heightAt: (x: number, z: number) => number
  /** May a Hollow stand here (dry land, no trunk)? */
  walkable: (x: number, z: number) => boolean
}

export type HollowKind = 'shambler' | 'floater'
export type HollowState = 'wander' | 'chase' | 'windup' | 'lunge' | 'recover' | 'stagger' | 'charge'
export interface Hollow {
  id: number; kind: HollowKind
  x: number; y: number; z: number; yaw: number
  hp: number; maxHp: number
  state: HollowState; t: number          // seconds left in the current state
  wx: number; wz: number                 // wander target
  lx: number; lz: number                 // lunge direction
  hitFlash: number
  hitThisLunge: boolean
}
/** A floater's spit: slow enough to see coming and side-step. */
export interface Spit { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }
export interface Round { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg: number; crit: number }
export interface Drop { id: number; x: number; y: number; z: number; amount: number; age: number }

export interface Keeper {
  hp: number; maxHp: number; sinceHurt: number
  ammo: number; reloading: number; sinceShot: number; bloom: number
}

export const KEEPER_HP = 100
export const REGEN_DELAY = 5, REGEN_RATE = 8
/** Shambler tuning (build pacing, Jin). Three Repeater body shots or two to the head. */
export const SHAMBLER = {
  hp: 30, wanderSpeed: 0.55, chaseSpeed: 1.7, notice: 24, forget: 40,
  lungeRange: 2.6, windup: 0.45, lungeSpeed: 6.5, lungeTime: 0.32, recover: 1.1,
  hitReach: 1.15, damage: 14, stagger: 0.28, radius: 0.42, height: 1.75,
}
/** The floater: the one Hollow that floats (design-briefs/hollows.md), the ranged form. Keeps its distance and spits. */
export const FLOATER = {
  hp: 20, hover: 2.2, keepNear: 9, keepFar: 16, notice: 30, forget: 44, speed: 2.1,
  charge: 0.75, recover: 2.2, spitSpeed: 11, spitLife: 3, spitR: 0.35, damage: 10, share: 0.25,
}
export const HEAD_Y = 1.55, HEAD_R = 0.26, BODY_Y = 0.85, BODY_R = 0.44
export const PICKUP_R = 1.4, MAGNET_R = 4.5

export interface Combat {
  hollows: Hollow[]; rounds: Round[]; drops: Drop[]; spits: Spit[]
  keeper: Keeper; gun: WeaponDef
  nextId: number; seed: number
  clock?: number
  /** Events this step, for the scene (sounds, flashes) and the page (grey matter, death). */
  events: CombatEvent[]
}
export type CombatEvent =
  | { kind: 'hit'; id: number; head: boolean; killed: boolean }
  | { kind: 'hurt'; amount: number }
  | { kind: 'pickup'; amount: number }
  | { kind: 'fired' }
  | { kind: 'down' }

export function newCombat(seed = 1, gunId = 'repeater'): Combat {
  const gun = weaponDef(gunId)!
  return {
    hollows: [], rounds: [], drops: [], spits: [], gun, nextId: 1, seed, events: [],
    keeper: { hp: KEEPER_HP, maxHp: KEEPER_HP, sinceHurt: 99, ammo: gun.clip, reloading: 0, sinceShot: 99, bloom: 0 },
  }
}

const rnd = (c: Combat) => { c.seed = (c.seed * 1664525 + 1013904223) >>> 0; return c.seed / 4294967296 }

export function spawnHollow(c: Combat, T: Terrain, x: number, z: number, kind: HollowKind = 'shambler'): Hollow {
  const h: Hollow = {
    id: c.nextId++, kind, x, y: T.heightAt(x, z) + (kind === 'floater' ? FLOATER.hover : 0), z, yaw: rnd(c) * Math.PI * 2,
    hp: kind === 'floater' ? FLOATER.hp : SHAMBLER.hp, maxHp: kind === 'floater' ? FLOATER.hp : SHAMBLER.hp, state: 'wander', t: 0, wx: x, wz: z, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false,
  }
  c.hollows.push(h)
  return h
}

/** Keep a scatter of strays around the keeper: top up in a ring out of sight, cull the far ones. */
export function populate(c: Combat, T: Terrain, kx: number, kz: number, target: number, safe?: { x: number; z: number; r: number }) {
  c.hollows = c.hollows.filter(h => Math.hypot(h.x - kx, h.z - kz) < 130)
  for (let tries = 0; c.hollows.length < target && tries < 24; tries++) {
    const a = rnd(c) * Math.PI * 2, r = 55 + rnd(c) * 45
    const x = kx + Math.cos(a) * r, z = kz + Math.sin(a) * r
    if (!T.walkable(x, z) || !Number.isFinite(T.heightAt(x, z))) continue
    if (safe && Math.hypot(x - safe.x, z - safe.z) < safe.r) continue
    spawnHollow(c, T, x, z, rnd(c) < FLOATER.share ? 'floater' : 'shambler')
  }
}

/** Pull the trigger along an aim (unit vector). Returns false when the gun cannot fire. */
export function fire(c: Combat, eye: { x: number; y: number; z: number }, aim: { x: number; y: number; z: number }): boolean {
  const k = c.keeper, w = c.gun
  if (!canFire(w, k.sinceShot, k.ammo, k.reloading)) {
    if (k.ammo <= 0 && k.reloading <= 0) reload(c)
    return false
  }
  // a cone around the aim: pick a random direction inside spreadDeg
  const cone = (spreadDeg(w, k.bloom, false) * Math.PI) / 180
  const r = Math.sqrt(rnd(c)) * Math.tan(cone), th = rnd(c) * Math.PI * 2
  // two perpendiculars to aim
  const ux = Math.abs(aim.y) < 0.95 ? 0 : 1, uy = Math.abs(aim.y) < 0.95 ? 1 : 0
  let px = aim.y * 0 - aim.z * uy, py = aim.z * ux - aim.x * 0, pz = aim.x * uy - aim.y * ux
  const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl
  const qx = aim.y * pz - aim.z * py, qy = aim.z * px - aim.x * pz, qz = aim.x * py - aim.y * px
  let dx = aim.x + (px * Math.cos(th) + qx * Math.sin(th)) * r
  let dy = aim.y + (py * Math.cos(th) + qy * Math.sin(th)) * r
  let dz = aim.z + (pz * Math.cos(th) + qz * Math.sin(th)) * r
  const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl
  c.rounds.push({ x: eye.x + dx * 0.4, y: eye.y - 0.08 + dy * 0.4, z: eye.z + dz * 0.4, vx: dx * w.projSpeed, vy: dy * w.projSpeed, vz: dz * w.projSpeed, life: w.projLife, dmg: w.damage, crit: w.crit })
  k.ammo--; k.sinceShot = 0; k.bloom = bloomAfterShot(w, k.bloom)
  c.events.push({ kind: 'fired' })
  if (k.ammo <= 0) reload(c)
  return true
}

export function reload(c: Combat) {
  const k = c.keeper
  if (k.reloading > 0 || k.ammo >= c.gun.clip) return
  k.reloading = c.gun.reloadTime
}

/** Closest approach of segment a→b to point p, squared. */
function segDist2(ax: number, ay: number, az: number, bx: number, by: number, bz: number, px: number, py: number, pz: number) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = dx * dx + dy * dy + dz * dz
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / L)) : 0
  const ex = ax + dx * t - px, ey = ay + dy * t - py, ez = az + dz * t - pz
  return ex * ex + ey * ey + ez * ez
}

/** One step. `feet` is the keeper's feet position. */
export function stepCombat(c: Combat, T: Terrain, feet: { x: number; y: number; z: number }, dt: number) {
  c.events = []
  c.clock = (c.clock ?? 0) + dt
  const k = c.keeper
  k.sinceShot += dt; k.sinceHurt += dt
  k.bloom = bloomAfterRest(c.gun, k.bloom, dt)
  if (k.reloading > 0) { k.reloading -= dt; if (k.reloading <= 0) { k.reloading = 0; k.ammo = c.gun.clip } }
  if (k.sinceHurt > REGEN_DELAY && k.hp > 0) k.hp = Math.min(k.maxHp, k.hp + REGEN_RATE * dt)

  // rounds
  for (const r of c.rounds) {
    const ox = r.x, oy = r.y, oz = r.z
    r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; r.life -= dt
    if (r.y < T.heightAt(r.x, r.z)) { r.life = 0; continue }
    let best: { h: Hollow; head: boolean } | null = null
    for (const h of c.hollows) {
      if (h.hp <= 0 || Math.hypot(h.x - r.x, h.z - r.z) > 6) continue
      if (h.kind === 'floater') {
        if (segDist2(ox, oy, oz, r.x, r.y, r.z, h.x, h.y, h.z) < 0.5 * 0.5) { best = { h, head: false }; break }
        continue
      }
      if (segDist2(ox, oy, oz, r.x, r.y, r.z, h.x, h.y + HEAD_Y, h.z) < HEAD_R * HEAD_R) { best = { h, head: true }; break }
      if (segDist2(ox, oy, oz, r.x, r.y, r.z, h.x, h.y + BODY_Y, h.z) < BODY_R * BODY_R * 1.6) best = { h, head: false }
    }
    if (best) {
      const h = best.h
      h.hp -= best.head ? r.crit : r.dmg; h.hitFlash = 0.12; r.life = 0
      if (h.state !== 'lunge' && h.state !== 'charge') { h.state = 'stagger'; h.t = SHAMBLER.stagger }
      const killed = h.hp <= 0
      c.events.push({ kind: 'hit', id: h.id, head: best.head, killed })
      if (killed) c.drops.push({ id: c.nextId++, x: h.x, y: T.heightAt(h.x, h.z), z: h.z, amount: (h.kind === 'floater' ? 2 : 1) + Math.floor(rnd(c) * 3), age: 0 })
    }
  }
  c.rounds = c.rounds.filter(r => r.life > 0)
  c.hollows = c.hollows.filter(h => h.hp > 0)

  // hollows
  for (const h of c.hollows) {
    h.hitFlash = Math.max(0, h.hitFlash - dt); h.t -= dt
    const dx = feet.x - h.x, dz = feet.z - h.z, d = Math.hypot(dx, dz)
    if (h.kind === 'floater') { stepFloater(c, T, h, feet, d, dx, dz, dt); continue }
    let speed = 0, mx = 0, mz = 0
    switch (h.state) {
      case 'wander':
        if (d < SHAMBLER.notice && k.hp > 0) { h.state = 'chase'; break }
        if (h.t <= 0 || Math.hypot(h.wx - h.x, h.wz - h.z) < 1) {
          h.wx = h.x + (rnd(c) - 0.5) * 16; h.wz = h.z + (rnd(c) - 0.5) * 16; h.t = 3 + rnd(c) * 4
        }
        mx = h.wx - h.x; mz = h.wz - h.z; speed = SHAMBLER.wanderSpeed
        break
      case 'chase':
        if (d > SHAMBLER.forget || k.hp <= 0) { h.state = 'wander'; h.t = 0; break }
        if (d < SHAMBLER.lungeRange) { h.state = 'windup'; h.t = SHAMBLER.windup; h.lx = dx / d; h.lz = dz / d; break }
        mx = dx; mz = dz; speed = SHAMBLER.chaseSpeed * (0.8 + 0.35 * Math.sin(h.id * 1.7 + h.x * 0.3))   // the stagger
        break
      case 'windup':
        h.yaw = Math.atan2(h.lx, h.lz)
        if (h.t <= 0) { h.state = 'lunge'; h.t = SHAMBLER.lungeTime; h.hitThisLunge = false }
        break
      case 'lunge':
        mx = h.lx; mz = h.lz; speed = SHAMBLER.lungeSpeed
        if (!h.hitThisLunge && d < SHAMBLER.hitReach && Math.abs(feet.y - h.y) < 1.6 && k.hp > 0) {
          h.hitThisLunge = true
          k.hp = Math.max(0, k.hp - SHAMBLER.damage); k.sinceHurt = 0
          c.events.push({ kind: 'hurt', amount: SHAMBLER.damage })
          if (k.hp <= 0) c.events.push({ kind: 'down' })
        }
        if (h.t <= 0) { h.state = 'recover'; h.t = SHAMBLER.recover }
        break
      case 'recover': case 'stagger':
        if (h.t <= 0) h.state = d < SHAMBLER.notice ? 'chase' : 'wander'
        break
    }
    if (speed > 0) {
      const l = Math.hypot(mx, mz) || 1
      const nx = h.x + (mx / l) * speed * dt, nz = h.z + (mz / l) * speed * dt
      if (T.walkable(nx, nz)) { h.x = nx; h.z = nz }
      else if (T.walkable(nx, h.z)) h.x = nx
      else if (T.walkable(h.x, nz)) h.z = nz
      else if (h.state === 'wander') h.t = 0
      if (h.state !== 'lunge') h.yaw = Math.atan2(mx, mz)
    }
    h.y = T.heightAt(h.x, h.z)
  }
  // keep a crowd from stacking into one body
  for (let a = 0; a < c.hollows.length; a++) for (let b = a + 1; b < c.hollows.length; b++) {
    const A = c.hollows[a], B = c.hollows[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), min = SHAMBLER.radius * 2
    if (d > 0.001 && d < min) { const p = (min - d) / 2 / d; A.x -= dx * p; A.z -= dz * p; B.x += dx * p; B.z += dz * p }
  }

  // spits
  for (const p of c.spits) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 2.5 * dt; p.life -= dt
    if (p.y < T.heightAt(p.x, p.z)) { p.life = 0; continue }
    const bx = p.x - feet.x, bz = p.z - feet.z, by = p.y - (feet.y + 0.9)
    if (k.hp > 0 && bx * bx + bz * bz < (FLOATER.spitR + 0.35) ** 2 && Math.abs(by) < 1.0) {
      p.life = 0; k.hp = Math.max(0, k.hp - FLOATER.damage); k.sinceHurt = 0
      c.events.push({ kind: 'hurt', amount: FLOATER.damage })
      if (k.hp <= 0) c.events.push({ kind: 'down' })
    }
  }
  c.spits = c.spits.filter(p => p.life > 0)

  // drops: drift to the keeper inside the magnet, collect inside the pickup radius
  for (const p of c.drops) {
    p.age += dt
    const dx = feet.x - p.x, dz = feet.z - p.z, d = Math.hypot(dx, dz)
    if (d < MAGNET_R && p.age > 0.4) { const s = Math.min(d, (8 + (MAGNET_R - d) * 3) * dt); p.x += (dx / d) * s; p.z += (dz / d) * s; p.y = T.heightAt(p.x, p.z) }
    if (d < PICKUP_R && p.age > 0.4 && k.hp > 0) { c.events.push({ kind: 'pickup', amount: p.amount }); p.amount = 0 }
  }
  c.drops = c.drops.filter(p => p.amount > 0 && p.age < 300)
}

function stepFloater(c: Combat, T: Terrain, h: Hollow, feet: { x: number; y: number; z: number }, d: number, dx: number, dz: number, dt: number) {
  const k = c.keeper
  let mx = 0, mz = 0, speed = 0
  switch (h.state) {
    case 'wander':
      if (d < FLOATER.notice && k.hp > 0) { h.state = 'chase'; h.t = 1 + rnd(c) * 1.5; break }
      if (h.t <= 0) { h.wx = h.x + (rnd(c) - 0.5) * 20; h.wz = h.z + (rnd(c) - 0.5) * 20; h.t = 4 + rnd(c) * 4 }
      mx = h.wx - h.x; mz = h.wz - h.z; speed = FLOATER.speed * 0.4
      break
    case 'chase':   // hold a band of distance, circling a little; spit when the timer runs out
      if (d > FLOATER.forget || k.hp <= 0) { h.state = 'wander'; h.t = 0; break }
      if (d > FLOATER.keepFar) { mx = dx; mz = dz } else if (d < FLOATER.keepNear) { mx = -dx; mz = -dz } else { mx = -dz; mz = dx }
      speed = FLOATER.speed
      h.yaw = Math.atan2(dx, dz)
      if (h.t <= 0 && d < FLOATER.keepFar + 4) { h.state = 'charge'; h.t = FLOATER.charge }
      break
    case 'charge':
      h.yaw = Math.atan2(dx, dz)
      if (h.t <= 0) {
        // aim at where the keeper is, from the floater's body; a slow arc
        const ty = feet.y + 0.9, sy = h.y, l = Math.hypot(dx, dz) || 1, flight = l / FLOATER.spitSpeed
        c.spits.push({ x: h.x, y: sy, z: h.z, vx: (dx / l) * FLOATER.spitSpeed, vz: (dz / l) * FLOATER.spitSpeed, vy: (ty - sy) / flight + 1.25 * flight, life: FLOATER.spitLife })
        h.state = 'recover'; h.t = FLOATER.recover
      }
      break
    case 'recover': case 'stagger':
      mx = -dz; mz = dx; speed = FLOATER.speed * 0.5
      if (h.t <= 0) { h.state = d < FLOATER.notice ? 'chase' : 'wander'; h.t = 0.5 + rnd(c) }
      break
  }
  if (speed > 0) {
    const l = Math.hypot(mx, mz) || 1
    const nx = h.x + (mx / l) * speed * dt, nz = h.z + (mz / l) * speed * dt
    if (Number.isFinite(T.heightAt(nx, nz))) { h.x = nx; h.z = nz }
  }
  const want = T.heightAt(h.x, h.z) + FLOATER.hover + Math.sin(h.id + performanceSafeNow(c) * 1.3) * 0.25
  h.y += (want - h.y) * Math.min(1, dt * 3)
}
/** A clock that lives in the sim (tests step time), for the floater's bob. */
const performanceSafeNow = (c: Combat) => (c.clock = (c.clock ?? 0))

/** After the fold returns a downed keeper home: full health, a full clip, the Wilds' crowd forgets them. */
export function revive(c: Combat) {
  c.keeper.hp = c.keeper.maxHp; c.keeper.sinceHurt = 99; c.keeper.ammo = c.gun.clip; c.keeper.reloading = 0
  c.hollows = []; c.rounds = []; c.spits = []
}
