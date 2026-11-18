// What a worn cast DOES to the Wilds' fight (Alex 11-16: "the tactical and signature keys" — Q and X). The cast's
// numbers are play3d's (cast.ts › castForMove, one source for every host); this is the open world's hand for them.
//
//   projectile — instant along the aim (the open world's guns are hit-scan too): damage, the cast's statuses on what
//                it strikes, a shove, a grapple, a chain to the nearest others
//   status     — the cast's statuses on every Hollow round the aim point (castRange out, areaSize across)
//   restore    — the keeper heals
//   infusion   — the gun hits harder for surgeSecs
//   field      — a persistent ground area at the aim point (castRange out; 0 = under the keeper), for areaSecs. Each second
//                (FIELD_TICK_MS, engine/field-effects.ts) it does what the spec carries, and ONLY that:
//                  fieldDps   damage to Hollows inside        fieldHps   heals the keeper standing inside
//                  cage       Hollows inside are held (rooted)  fieldStopsShots  eats Hollow spit crossing it
//                No open-world meaning, so not done: fieldShps (the keeper has no shield), fieldHp / ward (nothing here
//                hits the field), hides (Hollows do not track by sight), surgeMult (Exhale's surge is the page's).
//   terrain    — the spec's shape (wall / ring / block / ledge, engine/conjured-terrain.ts shapeCells) rises at the aim point, shapeHeight
//                tiers (1 tier = 1 m here) tall, for areaSecs. Hollows cannot step into its cells and Hollow spit stops on it.
//                Pillar Tomb also lays its statuses on the Hollow nearest the aim and rises around it. NOT done (no hook here):
//                the keeper does not collide with it (the walker's LocoWorld is built by the page; a dynamic box needs a
//                refactor); the second-press topple (Monolith); a ledge's stair is drawn but only blocks (nobody climbs it).
//   veil       — Heat Mirage: a plain decoy stands decoyOffset m out along the aim for decoySecs; Hollows close on it, face it and spit at it
//                instead of the keeper (combat.ts › stepCombat reads c.decoy). Champions still track the keeper (champion.ts is not touched).
//   channel    — Meltbore: HELD. shared/use-casts.ts keeps the key's state and bills sustainDrain mana/s through play3d/sustain.ts (channelTick
//                below); release or an empty pool stops it, the cooldown starts on release. Its effect in canon is boring ONE block until it stops
//                existing; the Wilds hold no borable blocks (raised pieces are conjured matter, which a bore cannot chew: breach.ts), so here the
//                held beam is drawn along the aim and the seconds are paid and counted, and it opens nothing. Said out loud on release.
// surge and impulse move the KEEPER and live on the page (shared/casting.ts says which). The rest (gate) is not out here yet, and says so: never a silent no-op.
//
// ★ PURE. No React, no three: it reads and writes the Combat, and returns where to draw the flash.

import { castForMove, type CastSpec } from '../../play3d/cast'
import { beginSustain, sustainStep, type Sustain, type SustainEnd } from '../../play3d/sustain'
import { shapeCells } from '../../engine/conjured-terrain'
import { FIELD_TICK_MS } from '../../engine/field-effects'
import { HEAD_Y, BODY_Y, fxOn, type Combat, type CombatField, type CombatPiece, type Hollow, type HollowFx, type Terrain } from './combat'

type V3 = { x: number; y: number; z: number }
const HOLLOW_FX: ReadonlySet<string> = new Set<HollowFx>(['rooted', 'disarmed', 'blinded', 'slowed', 'staggered', 'vulnerable', 'burning'])
/** the open world draws every bolt this far at least (some canon bolts are a short throw: Tidal Arms reaches 14 m) */
const MIN_BOLT_M = 8
/** a status cast's ring is never smaller than this across, so a pin-point cast can still be landed on a body */
const MIN_AREA_M = 3

export interface CastHit { kind: 'bolt' | 'area' | 'self'; x: number; y: number; z: number; r: number; hit: number; to?: V3[] }

export function layStatuses(h: Hollow, kinds: readonly string[], secs: number): boolean {
  let any = false
  for (const k of kinds) if (HOLLOW_FX.has(k)) { h.fx = h.fx ?? {}; h.fx[k as HollowFx] = Math.max(h.fx[k as HollowFx] ?? 0, secs); any = true }
  if (any) h.hitFlash = 0.18
  return any
}

function damage(c: Combat, T: Terrain, h: Hollow, n: number) {
  if (n <= 0) return
  h.hp -= n * (fxOn(h, 'vulnerable') ? 1.3 : 1); h.hitFlash = 0.15
  const killed = h.hp <= 0
  c.events.push({ kind: 'hit', id: h.id, head: false, killed })
  if (killed) c.drops.push({ id: c.nextId++, x: h.x, y: T.heightAt(h.x, h.z), z: h.z, amount: h.kind === 'floater' ? 2 : 1, age: 0 })
}

/** The first Hollow the ray meets before the ground, within `range`. */
export function firstOnRay(c: Combat, T: Terrain, eye: V3, dir: V3, range: number): { h: Hollow; t: number } | null {
  let best: { h: Hollow; t: number } | null = null
  for (const h of c.hollows) {
    if (h.hp <= 0) continue
    const cy = h.kind === 'floater' ? h.y : h.y + (HEAD_Y + BODY_Y) / 2, rr = h.kind === 'floater' ? 0.6 : 0.75
    const ox = h.x - eye.x, oy = cy - eye.y, oz = h.z - eye.z, t = ox * dir.x + oy * dir.y + oz * dir.z
    if (t < 0 || t > range) continue
    const px = eye.x + dir.x * t - h.x, py = eye.y + dir.y * t - cy, pz = eye.z + dir.z * t - h.z
    if (px * px + py * py + pz * pz > rr * rr) continue
    if (!best || t < best.t) best = { h, t }
  }
  if (best) {   // the ground in between hides it
    for (let s = 0.5; s < best.t; s += 0.5) if (eye.y + dir.y * s < T.heightAt(eye.x + dir.x * s, eye.z + dir.z * s)) return null
  }
  return best
}

/** Where the aim meets the ground, no further than `range` (or the point at `range` above it). */
export function aimPoint(T: Terrain, eye: V3, dir: V3, range: number): V3 {
  for (let s = 0.5; s <= range; s += 0.5) {
    const x = eye.x + dir.x * s, z = eye.z + dir.z * s, y = eye.y + dir.y * s, g = T.heightAt(x, z)
    if (y <= g) return { x, y: g, z }
  }
  const x = eye.x + dir.x * range, z = eye.z + dir.z * range
  return { x, y: T.heightAt(x, z), z }
}

export function runCast(c: Combat, T: Terrain, eye: V3, dir: V3, spec: CastSpec): CastHit | null {
  const statuses = [...spec.statuses, ...spec.splashStatuses, ...spec.landStatuses]
  const secs = Math.max(spec.areaSecs, spec.splashSecs, spec.landSecs, 1)
  switch (spec.archetype) {
    case 'restore': {
      const k = c.keeper; k.hp = Math.min(k.maxHp, k.hp + spec.heal)
      return { kind: 'self', x: eye.x, y: eye.y - 1.5, z: eye.z, r: 1.5, hit: 0 }
    }
    case 'infusion': {
      c.keeper.ampUntil = (c.clock ?? 0) + Math.max(4, spec.surgeSecs)
      return { kind: 'self', x: eye.x, y: eye.y - 1.5, z: eye.z, r: 1, hit: 0 }
    }
    case 'projectile': {
      const range = Math.max(MIN_BOLT_M, spec.projSpeed * spec.projLife)
      const first = firstOnRay(c, T, eye, dir, range)
      const end = first ? { x: eye.x + dir.x * first.t, y: eye.y + dir.y * first.t, z: eye.z + dir.z * first.t } : aimPoint(T, eye, dir, range)
      if (!first) return { kind: 'bolt', ...end, r: 0.6, hit: 0, to: [] }
      const struck: Hollow[] = [first.h]
      for (let i = 0; i < spec.chain; i++) {
        const from = struck[struck.length - 1]
        let next: Hollow | null = null, nd = spec.chainRange
        for (const h of c.hollows) { if (h.hp <= 0 || struck.includes(h)) continue; const d = Math.hypot(h.x - from.x, h.z - from.z); if (d < nd) { nd = d; next = h } }
        if (!next) break
        struck.push(next)
      }
      for (const h of struck) {
        damage(c, T, h, spec.damage)
        layStatuses(h, statuses, secs)
        if (spec.shove > 0) {   // away along the bolt, or toward the keeper (Tidal Arms' grasp)
          const sgn = spec.shoveDir === 'toward' ? -1 : 1, l = Math.hypot(dir.x, dir.z) || 1
          const nx = h.x + (dir.x / l) * spec.shove * sgn, nz = h.z + (dir.z / l) * spec.shove * sgn
          if (T.walkable(nx, nz)) { h.x = nx; h.z = nz; h.y = T.heightAt(nx, nz) }
        }
        if (h.state === 'windup' || h.state === 'lunge') { h.state = 'stagger'; h.t = 0.4 }
      }
      return { kind: 'bolt', ...end, r: 0.6, hit: struck.length, to: struck.slice(1).map(h => ({ x: h.x, y: h.y + 1, z: h.z })) }
    }
    case 'status': {
      const p = aimPoint(T, eye, dir, Math.max(spec.castRange, 2))
      const r = Math.max(MIN_AREA_M, spec.areaSize) / 2
      let hit = 0
      for (const h of c.hollows) if (h.hp > 0 && Math.hypot(h.x - p.x, h.z - p.z) <= r + 0.5 && layStatuses(h, statuses, secs)) hit++
      return { kind: 'area', ...p, r, hit }
    }
    case 'field': {
      const p = spec.castRange > 0 ? aimPoint(T, eye, dir, spec.castRange) : { x: eye.x, y: T.heightAt(eye.x, eye.z), z: eye.z }
      const r = Math.max(MIN_AREA_M, spec.areaSize) / 2, now = c.clock ?? 0
      const f: CombatField = { id: c.nextId++, moveId: spec.moveId, x: p.x, y: p.y, z: p.z, r, until: now + spec.areaSecs, nextTick: now,
        dps: spec.fieldDps, hps: spec.fieldHps, cage: spec.cage, stopsShots: spec.fieldStopsShots, colour: spec.cage ? '#d8e0ff' : spec.fieldHps > 0 ? '#9be59b' : '#ffd9a0' }
      c.fields = [...(c.fields ?? []), f]
      return { kind: 'area', ...p, r, hit: c.hollows.filter(h => h.hp > 0 && Math.hypot(h.x - p.x, h.z - p.z) <= r + 0.5).length }
    }
    case 'terrain': {
      const p = aimPoint(T, eye, dir, Math.max(spec.castRange, 2))
      let foe: Hollow | null = null
      if (spec.entomb) { let nd = 3; for (const h of c.hollows) { const d = Math.hypot(h.x - p.x, h.z - p.z); if (h.hp > 0 && d < nd) { nd = d; foe = h } } }
      const at = foe ?? p, now = c.clock ?? 0
      const raw = shapeCells(spec.shape, at.x, at.z, dir.x, dir.z, spec.areaSize, spec.shapeHeight) as { x: number; z: number; rise?: number }[]
      const piece: CombatPiece = { id: c.nextId++, moveId: spec.moveId, until: now + spec.areaSecs,
        cells: raw.map(q => ({ x: q.x, z: q.z, base: T.heightAt(q.x, q.z), rise: q.rise ?? spec.shapeHeight })) }
      c.pieces = [...(c.pieces ?? []), piece].slice(-MAX_PIECES)   // oldest drops at the cap so a paid cast always appears
      let hit = 0
      if (foe) { if (layStatuses(foe, statuses, Math.max(spec.areaSecs, 1))) hit = 1 }
      else if (statuses.length) for (const h of c.hollows) if (h.hp > 0 && shapeInside(spec.shape, at, spec.areaSize, h) && layStatuses(h, statuses, Math.max(spec.areaSecs, 1))) hit++   // Cordon: foes sealed inside
      return { kind: 'area', ...p, r: Math.max(MIN_AREA_M, spec.areaSize) / 2, hit }
    }
    case 'veil': {
      const l = Math.hypot(dir.x, dir.z) || 1, now = c.clock ?? 0
      const x = eye.x + (dir.x / l) * spec.decoyOffset, z = eye.z + (dir.z / l) * spec.decoyOffset
      c.decoy = { x, z, y: T.heightAt(x, z), until: now + spec.decoySecs, moveId: spec.moveId }
      return { kind: 'area', x, y: c.decoy.y, z, r: 0.8, hit: 0 }
    }
    default:
      return null
  }
}

/** A channel in flight: play3d/sustain.ts's Sustain plus the spec it bills by. */
export interface ChannelRun { spec: CastSpec; sustain: Sustain }
export const beginChannel = (spec: CastSpec, slot = 0): ChannelRun => ({ spec, sustain: beginSustain(slot, spec.moveId) })
/** One frame of a held channel: pays sustainDrain per second from `mana` while `holding`, credits only what was paid, stops on release or an empty pool. */
export function channelTick(run: ChannelRun, dt: number, mana: number, holding: boolean): { run: ChannelRun; mana: number; ended: SustainEnd | null } {
  if (!holding) return { run, mana, ended: 'released' }
  const st = sustainStep(run.sustain, dt, mana, run.spec.sustainDrain)
  return { run: { ...run, sustain: st.sustain }, mana: mana - st.manaSpent, ended: st.ended }
}
/** Where a held channel points: the ground the aim meets, or the point `range` out. */
export const channelAim = (T: Terrain, eye: V3, dir: V3, range = 12) => aimPoint(T, eye, dir, range)

export const MAX_PIECES = 6
/** Only a ring or block has an inside (a ring's radius / a block's side). */
const shapeInside = (shape: string, at: { x: number; z: number }, size: number, h: { x: number; z: number }) =>
  (shape === 'ring' || shape === 'block') && Math.hypot(h.x - at.x, h.z - at.z) <= (shape === 'ring' ? size : size / 2 + 0.5)
/** Expire raised terrain. (Blocking itself lives in combat.ts stepCombat via solidTop.) Call before stepCombat. */
export function stepPieces(c: Combat) {
  if (!c.pieces?.length) return
  const now = c.clock ?? 0
  if (c.pieces.some(p => p.until <= now)) c.pieces = c.pieces.filter(p => p.until > now)
}

/** Advance the placed fields by one frame: eat spit every frame, do the tick's work once per FIELD_TICK_MS, expire. Call before stepCombat. */
export function stepFields(c: Combat, T: Terrain, feet: { x: number; z: number }) {
  const fs = c.fields
  if (!fs?.length) return
  const now = c.clock ?? 0
  for (const f of fs) {
    if (f.stopsShots) c.spits = c.spits.filter(s => Math.hypot(s.x - f.x, s.z - f.z) > f.r)
    if (now < f.nextTick) continue
    f.nextTick += FIELD_TICK_MS / 1000
    if (f.nextTick < now) f.nextTick = now + FIELD_TICK_MS / 1000   // a stalled tab does not burst-apply
    if (f.hps > 0 && Math.hypot(feet.x - f.x, feet.z - f.z) <= f.r) c.keeper.hp = Math.min(c.keeper.maxHp, c.keeper.hp + f.hps)
    for (const h of c.hollows) {
      if (h.hp <= 0 || Math.hypot(h.x - f.x, h.z - f.z) > f.r + 0.5) continue
      if (f.cage) layStatuses(h, ['rooted'], FIELD_TICK_MS / 1000 + 0.3)
      if (f.dps > 0) damage(c, T, h, f.dps)
    }
  }
  c.fields = fs.filter(f => f.until > now)
}

/** The move a cast slot holds, as play3d's spec (NO_CAST when empty or unknown). */
export const specOf = (moveId: string | null) => castForMove(moveId)
