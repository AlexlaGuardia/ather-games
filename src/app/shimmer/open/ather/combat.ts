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
import { stepChampion, hitChampion, CHAMP, type Champion } from './champion'
import { easeRemote } from '../shared/fight-share'   // M28: a non-host's Hollows ease to the host's snapshot

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
  /** cast statuses on this body, seconds left each (combat-casts.ts lays them; stepCombat honours and counts them down) */
  fx?: Partial<Record<HollowFx, number>>
}
/** The engine's statuses that mean something to a Hollow (engine/statuses.ts; `revealed`, `silenced`, `sealed`,
 *  `shieldBroken` do not: a Hollow neither hides, casts, nor carries a shield). */
export type HollowFx = 'rooted' | 'disarmed' | 'blinded' | 'slowed' | 'staggered' | 'vulnerable' | 'burning'
export const fxOn = (h: Hollow, k: HollowFx) => (h.fx?.[k] ?? 0) > 0
/** what a cast status does to a Hollow (build; tune with play) */
export const FX = { slowMult: 0.45, vulnerableMult: 1.3, burnDps: 5 } as const
/** A floater's spit: slow enough to see coming and side-step. */
export interface Spit { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg?: number }
export interface Round { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg: number; crit: number }
export interface Drop { id: number; x: number; y: number; z: number; amount: number; age: number }

export interface Keeper {
  hp: number; maxHp: number; sinceHurt: number
  ammo: number; reloading: number; sinceShot: number; bloom: number
  /** an infusion cast on the gun: rounds hit harder until the combat clock passes this */
  ampUntil?: number
  /** M29 FRAME (keeper-look.ts › FRAME_STATS): `hit` scales how close a blow or a spit must come (Small 0.88, Large 1.16),
   *  `takes` scales what a hit costs (Large 0.9 = +10% defence). Unset = the baseline 1. The page sets both from the look. */
  hit?: number
  takes?: number
  /** where the keeper's feet were on the last stepCombat (M59: which field's Mana Skin holds them when a blow lands) */
  at?: { x: number; z: number }
}
/** what a blow of `amount` costs this keeper (rounded, never below 1 so a hit always registers) */
export const blowCost = (k: Keeper, amount: number) => Math.max(1, Math.round(amount * (k.takes ?? 1)))
export const AMP_MULT = 1.3

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

/** A placed field: a ground area at (x,z), `r` m radius, until `until` (c.clock seconds). The numbers are castForMove's. */
export interface CombatField {
  id: number; moveId: string; x: number; y: number; z: number; r: number; until: number; nextTick: number
  dps: number; hps: number; cage: boolean; stopsShots: boolean; colour: string
  /** M59 MANA SKIN (name ruled athernyx ae322a9): the field's shell (spec.fieldHp: Threshold 20, Overpressure 60). While the
   *  keeper stands inside, every blow drains it before health (hurtKeeper). At 0 it POPS once and the field is gone. */
  shell?: number; shellMax?: number; popped?: boolean
}
/** A raised terrain piece (terrain casts): grid cells (1 m, the engine's rounding), each `base` to `base + rise` m tall, until `until`. The numbers are castForMove's. */
export interface CombatPiece {
  id: number; moveId: string; until: number
  cells: { x: number; z: number; base: number; rise: number }[]
}
/** Is the ground cell at (x,z) held by a raised piece? Returns the piece cell's top (m), or null. */
export function solidTop(c: Combat, x: number, z: number): number | null {
  const ps = c.pieces
  if (!ps?.length) return null
  const cx = Math.round(x), cz = Math.round(z)
  for (const p of ps) for (const q of p.cells) if (q.x === cx && q.z === cz) return q.base + q.rise
  return null
}
/** A veil's false keeper: foes that would aim at the keeper aim here until `until` (c.clock seconds). Heat Mirage: decoySecs, decoyOffset. */
export interface CombatDecoy { x: number; z: number; y: number; until: number; moveId: string }
export interface Combat {
  hollows: Hollow[]; rounds: Round[]; drops: Drop[]; spits: Spit[]
  /** BETA M28 shared fights: a NON-HOST in a party. The host runs the Hollows (fight-share.ts snapshots); here they only
   *  ease to the host's word: no AI, no spawning, no spit; a round that hits one flashes it and queues the hit in `netHits`
   *  (slice 3 sends them to the host), and never changes its hp (the host decides that). */
  remote?: boolean
  /** #1651 (Alex 11-19: Hollows hunt guests too): the HOST's party mates here, by their synced spot. Each Hollow chases the
   *  NEAREST keeper (me or one of these); what reaches one of them is an event ('hurt-other'), never my hp. Unset = solo. */
  others?: { id: string; x: number; y: number; z: number }[]
  netHits?: { id: number; dmg: number; head: boolean }[]
  keeper: Keeper; gun: WeaponDef
  nextId: number; seed: number
  clock?: number
  /** Fields placed by field casts (combat-casts.ts › stepFields): each lasts its spec's secs and ticks on its own clock. */
  fields?: CombatField[]
  /** Terrain raised by terrain casts (combat-casts.ts, stepPieces): Hollows cannot step into a cell, spit stops on it. */
  pieces?: CombatPiece[]
  /** The veil's decoy (combat-casts.ts › runCast 'veil'): Hollows target it instead of the keeper while it lasts. */
  decoy?: CombatDecoy | null
  /** The node's champion, when one is up (champion.ts). */
  champ?: Champion
  /** Champions that went back under, by node: the bar each had reached. */
  dormant?: Record<string, number>
  /** Events this step, for the scene (sounds, flashes) and the page (grey matter, death). */
  events: CombatEvent[]
}
export type CombatEvent =
  | { kind: 'hit'; id: number; head: boolean; killed: boolean }
  | { kind: 'hurt'; amount: number }
  | { kind: 'skin'; absorbed: number }
  | { kind: 'skin-pop' }
  /** #1651 (host only): a Hollow's blow or spit reached ANOTHER keeper in the party; `dmg` is RAW (their frame applies there) */
  | { kind: 'hurt-other'; id: string; dmg: number }
  | { kind: 'pickup'; amount: number }
  | { kind: 'fired' }
  | { kind: 'down' }
  | { kind: 'champ-wake'; nodeId: string }
  | { kind: 'champ-break'; nodeId: string; bar: number }
  | { kind: 'champ-down'; nodeId: string }

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

/** BETA M28 slice 3: a GUEST's round landed (fight-share relays it to the host). The host applies it as its own round
 *  would (the guest already folded in its own amp; the Hollow's 'vulnerable' is the host's to know). The KILL is not made
 *  here: the next stepCombat gives a Hollow taken to 0 between steps its kill event + drop (1f0e15d2), so a guest's kill
 *  drops exactly once, and the host's drop-watch tells every keeper. Unknown or dead id = ignored (it died first). */
/** #1651: the host says one of its Hollows reached ME (a guest). Raw damage; MY frame's defence applies, as if local. */
export function applyNetHurt(c: Combat, raw: number) {
  const k = c.keeper
  if (!(raw > 0) || raw > 50 || k.hp <= 0) return
  hurtKeeper(c, raw)
}

// ── M59 THE MANA SKIN ──────────────────────────────────────────────────────────────────────────────────────────────────
/** The field whose Mana Skin holds the keeper right now: the one with the most shell left, among the live, unpopped fields
 *  with a shell whose disc the keeper's feet stand in. None = blows go straight to health. */
export function skinField(c: Combat): CombatField | null {
  const at = c.keeper.at, now = c.clock ?? 0
  if (!at || !c.fields?.length) return null
  let best: CombatField | null = null
  for (const f of c.fields) if ((f.shell ?? 0) > 0 && !f.popped && f.until > now && Math.hypot(at.x - f.x, at.z - f.z) <= f.r && (!best || f.shell! > best.shell!)) best = f
  return best
}
/** What the HUD draws over the health bar: the skin holding the keeper and its full size (0 / 0 = none). */
export function skinOf(c: Combat): { skin: number; skinMax: number } {
  const f = skinField(c)
  return f ? { skin: f.shell!, skinMax: f.shellMax ?? f.shell! } : { skin: 0, skinMax: 0 }
}
function popSkin(c: Combat, f: CombatField) {
  f.shell = 0; f.popped = true; f.until = c.clock ?? 0   // "gone at the first hard blow": the field goes with its skin
  c.events.push({ kind: 'skin-pop' })
}
/** THE one way a blow reaches the keeper. The frame's defence first (blowCost), then the Mana Skin holding them takes what
 *  it can ({kind:'skin'}), popping once at 0 ({kind:'skin-pop'}); only the rest reaches health ({kind:'hurt'}, regen
 *  delay restarts, {kind:'down'} at 0). A blow the skin swallows whole leaves health and its regen alone. */
export function hurtKeeper(c: Combat, raw: number) {
  const k = c.keeper
  if (k.hp <= 0) return
  let cost = blowCost(k, raw)
  const f = skinField(c)
  if (f) {
    const absorbed = Math.min(f.shell!, cost)
    f.shell! -= absorbed; cost -= absorbed
    c.events.push({ kind: 'skin', absorbed })
    if (f.shell! <= 0) popSkin(c, f)
  }
  if (cost <= 0) return
  k.hp = Math.max(0, k.hp - cost); k.sinceHurt = 0
  c.events.push({ kind: 'hurt', amount: cost })
  if (k.hp <= 0) c.events.push({ kind: 'down' })
}
/** The EMP (Meltbore's shieldStrip, Alex 11-18): pops the skin holding the keeper outright. ⚠ Nothing in the open world aims
 *  a shieldStrip AT the keeper yet (Hollows carry no EMP); this is the hook for when something does. */
export function stripSkin(c: Combat): boolean {
  const f = skinField(c)
  if (!f) return false
  popSkin(c, f); return true
}

export function applyNetHit(c: Combat, id: number, dmg: number) {
  const h = c.hollows.find(o => o.id === id)
  if (!h || h.hp <= 0 || !(dmg > 0) || dmg > 200) return
  h.hp -= dmg * (fxOn(h, 'vulnerable') ? FX.vulnerableMult : 1); h.hitFlash = 0.12
  if (h.state !== 'lunge' && h.state !== 'charge') { h.state = 'stagger'; h.t = SHAMBLER.stagger }
}

/** Keep a scatter of strays around the keeper: top up in a ring out of sight, cull the far ones. */
export function populate(c: Combat, T: Terrain, kx: number, kz: number, target: number, safe?: { x: number; z: number; r: number }, infested?: (x: number, z: number) => boolean) {
  c.hollows = c.hollows.filter(h => Math.hypot(h.x - kx, h.z - kz) < 130)
  for (let tries = 0; c.hollows.length < target && tries < 24; tries++) {
    const a = rnd(c) * Math.PI * 2, r = 55 + rnd(c) * 45
    const x = kx + Math.cos(a) * r, z = kz + Math.sin(a) * r
    if (!T.walkable(x, z) || !Number.isFinite(T.heightAt(x, z))) continue
    if (safe && Math.hypot(x - safe.x, z - safe.z) < safe.r) continue
    if (infested && !infested(x, z)) continue   // cleared ground stays quiet (nodes.ts › ownerOf)
    spawnHollow(c, T, x, z, rnd(c) < FLOATER.share ? 'floater' : 'shambler')
  }
}

/** Pull the trigger along an aim (unit vector). Returns false when the gun cannot fire. */
/** `ads` = aiming down the sights (Alex 11-18): the tighter cone (gunplay's adsSpread), the same rule the range uses. */
export function fire(c: Combat, eye: { x: number; y: number; z: number }, aim: { x: number; y: number; z: number }, ads = false): boolean {
  const k = c.keeper, w = c.gun
  if (!canFire(w, k.sinceShot, k.ammo, k.reloading)) {
    if (k.ammo <= 0 && k.reloading <= 0) reload(c)
    return false
  }
  // a cone around the aim: pick a random direction inside spreadDeg
  const cone = (spreadDeg(w, k.bloom, ads) * Math.PI) / 180
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

/** Does the ground rise above the segment a→b anywhere along it? Marched at RAY_STEP (BETA M16: the Wilds have hills now, and
 *  a round or a spit stepped ~10-30 m in one slow frame used to test only its END point, so it passed clean through a crest).
 *  The end point is tested too; the start is where the shot was last frame, already above ground. */
export const RAY_STEP = 4
export function throughGround(T: Terrain, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / RAY_STEP))
  for (let k = 1; k <= n; k++) { const t = k / n; if (ay + (by - ay) * t < T.heightAt(ax + (bx - ax) * t, az + (bz - az) * t)) return true }
  return false
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
  k.at = { x: feet.x, z: feet.z }   // M59: the skin under the keeper is read from here (hurtKeeper)
  k.sinceShot += dt; k.sinceHurt += dt
  k.bloom = bloomAfterRest(c.gun, k.bloom, dt)
  if (k.reloading > 0) { k.reloading -= dt; if (k.reloading <= 0) { k.reloading = 0; k.ammo = c.gun.clip } }
  if (k.sinceHurt > REGEN_DELAY && k.hp > 0) k.hp = Math.min(k.maxHp, k.hp + REGEN_RATE * dt)

  // rounds
  for (const r of c.rounds) {
    const ox = r.x, oy = r.y, oz = r.z
    r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; r.life -= dt
    if (throughGround(T, ox, oy, oz, r.x, r.y, r.z)) { r.life = 0; continue }
    const ch = c.champ
    if (ch && Math.hypot(ch.x - r.x, ch.z - r.z) < 4) {
      const head = segDist2(ox, oy, oz, r.x, r.y, r.z, ch.x, ch.y + CHAMP.headY, ch.z) < CHAMP.headR * CHAMP.headR
      if (head || segDist2(ox, oy, oz, r.x, r.y, r.z, ch.x, ch.y + CHAMP.bodyY, ch.z) < CHAMP.bodyR * CHAMP.bodyR * 1.6) {
        r.life = 0; hitChampion(c, T, ch, head, r.dmg, r.crit); continue
      }
    }
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
    if (best && c.remote) {   // M28: a non-host's round: feedback now, the host decides the damage (slice 3)
      const h = best.h, dmg = (best.head ? r.crit : r.dmg) * ((k.ampUntil ?? 0) > (c.clock ?? 0) ? AMP_MULT : 1)
      h.hitFlash = 0.12; r.life = 0
      ;(c.netHits ??= []).push({ id: h.id, dmg, head: best.head })
      c.events.push({ kind: 'hit', id: h.id, head: best.head, killed: false })
      continue
    }
    if (best) {
      const h = best.h
      const mult = (fxOn(h, 'vulnerable') ? FX.vulnerableMult : 1) * ((k.ampUntil ?? 0) > (c.clock ?? 0) ? AMP_MULT : 1)
      h.hp -= (best.head ? r.crit : r.dmg) * mult; h.hitFlash = 0.12; r.life = 0
      if (h.state !== 'lunge' && h.state !== 'charge') { h.state = 'stagger'; h.t = SHAMBLER.stagger }
      const killed = h.hp <= 0
      c.events.push({ kind: 'hit', id: h.id, head: best.head, killed })
      if (killed) c.drops.push({ id: c.nextId++, x: h.x, y: T.heightAt(h.x, h.z), z: h.z, amount: (h.kind === 'floater' ? 2 : 1) + Math.floor(rnd(c) * 3), age: 0 })
    }
  }
  c.rounds = c.rounds.filter(r => r.life > 0)
  // a Hollow taken to 0 OUTSIDE this step (a cast lands between steps) dies like any other: event + drop. A round's kill
  // above already pushed both (11-19, sprites' prod find: it was swept here silently, no kill event, no grey matter).
  for (const h of c.hollows) if (h.hp <= 0 && !c.events.some(e => e.kind === 'hit' && e.id === h.id && e.killed)) {
    c.events.push({ kind: 'hit', id: h.id, head: false, killed: true })
    c.drops.push({ id: c.nextId++, x: h.x, y: T.heightAt(h.x, h.z), z: h.z, amount: (h.kind === 'floater' ? 2 : 1) + Math.floor(rnd(c) * 3), age: 0 })
  }
  c.hollows = c.hollows.filter(h => h.hp > 0)

  // hollows
  for (const h of c.hollows) {
    h.hitFlash = Math.max(0, h.hitFlash - dt); h.t -= dt
    if (c.remote) { easeRemote(h, dt); h.y = T.heightAt(h.x, h.z) + (h.kind === 'floater' ? FLOATER.hover : 0); continue }   // M28: the host's word
    if (h.fx) {
      for (const key in h.fx) { const kk = key as HollowFx; h.fx[kk] = Math.max(0, (h.fx[kk] ?? 0) - dt) }
      if (fxOn(h, 'burning')) h.hp -= FX.burnDps * dt
    }
    const held = fxOn(h, 'rooted') || fxOn(h, 'staggered'), blind = fxOn(h, 'blinded'), unarmed = fxOn(h, 'disarmed')
    // a veil's decoy stands in for the keeper: foes close on it, face it and spit at it (the real keeper is still hit by what reaches them)
    let tgt: { x: number; y: number; z: number } = c.decoy && c.decoy.until > (c.clock ?? 0) ? c.decoy : feet
    let ty = feet.y, alive = k.hp > 0
    // #1651: in a party the host's Hollows hunt the NEAREST keeper (a downed one goes home and leaves `others`)
    if (c.others?.length) {
      let best = alive ? Math.hypot(tgt.x - h.x, tgt.z - h.z) : Infinity
      for (const o of c.others) { const od = Math.hypot(o.x - h.x, o.z - h.z); if (od < best) { best = od; tgt = o; ty = o.y; alive = true } }
    }
    const dx = tgt.x - h.x, dz = tgt.z - h.z, d = Math.hypot(dx, dz)
    if (h.kind === 'floater') {
      // a held, blinded or disarmed floater hangs where it is and spits nothing; a slowed one does all of it at half pace
      if (!(held || blind || unarmed)) stepFloater(c, T, h, { x: tgt.x, y: ty, z: tgt.z }, d, dx, dz, fxOn(h, 'slowed') ? dt * FX.slowMult : dt, alive)
      continue
    }
    // blinded: it has lost you, and blunders about; disarmed: it will not wind up to lunge
    if (blind && (h.state === 'chase' || h.state === 'windup')) { h.state = 'wander'; h.t = 0 }
    if (unarmed && h.state === 'windup') { h.state = 'chase' }
    let speed = 0, mx = 0, mz = 0
    switch (h.state) {
      case 'wander':
        if (d < SHAMBLER.notice && alive && !blind) { h.state = 'chase'; break }
        if (h.t <= 0 || Math.hypot(h.wx - h.x, h.wz - h.z) < 1) {
          h.wx = h.x + (rnd(c) - 0.5) * 16; h.wz = h.z + (rnd(c) - 0.5) * 16; h.t = 3 + rnd(c) * 4
        }
        mx = h.wx - h.x; mz = h.wz - h.z; speed = SHAMBLER.wanderSpeed
        break
      case 'chase':
        if (d > SHAMBLER.forget || !alive) { h.state = 'wander'; h.t = 0; break }
        if (d < SHAMBLER.lungeRange && !unarmed) { h.state = 'windup'; h.t = SHAMBLER.windup; h.lx = dx / d; h.lz = dz / d; break }
        mx = dx; mz = dz; speed = SHAMBLER.chaseSpeed * (0.8 + 0.35 * Math.sin(h.id * 1.7 + h.x * 0.3))   // the stagger
        break
      case 'windup':
        h.yaw = Math.atan2(h.lx, h.lz)
        if (h.t <= 0) { h.state = 'lunge'; h.t = SHAMBLER.lungeTime; h.hitThisLunge = false }
        break
      case 'lunge':
        mx = h.lx; mz = h.lz; speed = SHAMBLER.lungeSpeed
        if (!h.hitThisLunge && !unarmed && Math.hypot(feet.x - h.x, feet.z - h.z) < SHAMBLER.hitReach * (k.hit ?? 1) && Math.abs(feet.y - h.y) < 1.6 && k.hp > 0) {
          h.hitThisLunge = true
          hurtKeeper(c, SHAMBLER.damage)
        }
        if (!h.hitThisLunge && !unarmed && c.others) for (const o of c.others) if (Math.hypot(o.x - h.x, o.z - h.z) < SHAMBLER.hitReach && Math.abs(o.y - h.y) < 1.6) {
          h.hitThisLunge = true; c.events.push({ kind: 'hurt-other', id: o.id, dmg: SHAMBLER.damage }); break   // #1651: their frame applies on their side
        }
        if (h.t <= 0) { h.state = 'recover'; h.t = SHAMBLER.recover }
        break
      case 'recover': case 'stagger':
        if (h.t <= 0) h.state = d < SHAMBLER.notice ? 'chase' : 'wander'
        break
    }
    if (held) speed = 0
    else if (fxOn(h, 'slowed')) speed *= FX.slowMult
    if (speed > 0) {
      const l = Math.hypot(mx, mz) || 1
      const nx = h.x + (mx / l) * speed * dt, nz = h.z + (mz / l) * speed * dt
      // a raised piece is a wall: a Hollow already standing in one (it rose on them) may walk out, never in
      const out = solidTop(c, h.x, h.z) !== null, free = (x: number, z: number) => T.walkable(x, z) && (out || solidTop(c, x, z) === null)
      if (free(nx, nz)) { h.x = nx; h.z = nz }
      else if (free(nx, h.z)) h.x = nx
      else if (free(h.x, nz)) h.z = nz
      else if (h.state === 'wander') h.t = 0
      if (h.state !== 'lunge') h.yaw = Math.atan2(mx, mz)
    }
    h.y = T.heightAt(h.x, h.z)
  }
  // a burn can finish one off between rounds: it drops like any other
  for (const h of c.hollows) if (h.hp <= 0) {
    c.events.push({ kind: 'hit', id: h.id, head: false, killed: true })
    c.drops.push({ id: c.nextId++, x: h.x, y: T.heightAt(h.x, h.z), z: h.z, amount: (h.kind === 'floater' ? 2 : 1) + Math.floor(rnd(c) * 3), age: 0 })
  }
  c.hollows = c.hollows.filter(h => h.hp > 0)
  // keep a crowd from stacking into one body
  for (let a = 0; a < c.hollows.length; a++) for (let b = a + 1; b < c.hollows.length; b++) {
    const A = c.hollows[a], B = c.hollows[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), min = SHAMBLER.radius * 2
    if (d > 0.001 && d < min) { const p = (min - d) / 2 / d; A.x -= dx * p; A.z -= dz * p; B.x += dx * p; B.z += dz * p }
  }

  stepChampion(c, T, feet, dt)

  // spits
  for (const p of c.spits) {
    const px0 = p.x, py0 = p.y, pz0 = p.z
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 2.5 * dt; p.life -= dt
    if (throughGround(T, px0, py0, pz0, p.x, p.y, p.z)) { p.life = 0; continue }
    const top = solidTop(c, p.x, p.z)
    if (top !== null && p.y < top) { p.life = 0; continue }   // stopped by a raised piece
    const bx = p.x - feet.x, bz = p.z - feet.z, by = p.y - (feet.y + 0.9)
    if (k.hp > 0 && bx * bx + bz * bz < (FLOATER.spitR + 0.35 * (k.hit ?? 1)) ** 2 && Math.abs(by) < 1.0) {
      p.life = 0; hurtKeeper(c, p.dmg ?? FLOATER.damage)
    }
    if (p.life > 0 && c.others) for (const o of c.others) {   // #1651: a spit can reach a party mate
      const ox = p.x - o.x, oz = p.z - o.z, oy = p.y - (o.y + 0.9)
      if (ox * ox + oz * oz < (FLOATER.spitR + 0.35) ** 2 && Math.abs(oy) < 1.0) { p.life = 0; c.events.push({ kind: 'hurt-other', id: o.id, dmg: p.dmg ?? FLOATER.damage }); break }
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

function stepFloater(c: Combat, T: Terrain, h: Hollow, feet: { x: number; y: number; z: number }, d: number, dx: number, dz: number, dt: number, alive = c.keeper.hp > 0) {
  let mx = 0, mz = 0, speed = 0
  switch (h.state) {
    case 'wander':
      if (d < FLOATER.notice && alive) { h.state = 'chase'; h.t = 1 + rnd(c) * 1.5; break }
      if (h.t <= 0) { h.wx = h.x + (rnd(c) - 0.5) * 20; h.wz = h.z + (rnd(c) - 0.5) * 20; h.t = 4 + rnd(c) * 4 }
      mx = h.wx - h.x; mz = h.wz - h.z; speed = FLOATER.speed * 0.4
      break
    case 'chase':   // hold a band of distance, circling a little; spit when the timer runs out
      if (d > FLOATER.forget || !alive) { h.state = 'wander'; h.t = 0; break }
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
    if (Number.isFinite(T.heightAt(nx, nz)) && (solidTop(c, h.x, h.z) !== null || solidTop(c, nx, nz) === null)) { h.x = nx; h.z = nz }
  }
  const want = T.heightAt(h.x, h.z) + FLOATER.hover + Math.sin(h.id + performanceSafeNow(c) * 1.3) * 0.25
  h.y += (want - h.y) * Math.min(1, dt * 3)
}
/** A clock that lives in the sim (tests step time), for the floater's bob. */
const performanceSafeNow = (c: Combat) => (c.clock = (c.clock ?? 0))

/** After the fold returns a downed keeper home: full health, a full clip, the Wilds' crowd forgets them. */
export function revive(c: Combat) {
  c.keeper.hp = c.keeper.maxHp; c.keeper.sinceHurt = 99; c.keeper.ammo = c.gun.clip; c.keeper.reloading = 0
  c.hollows = []; c.rounds = []; c.spits = []; c.fields = []; c.pieces = []; c.decoy = null; c.champ = undefined
}
