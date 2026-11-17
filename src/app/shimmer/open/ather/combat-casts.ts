// What a worn cast DOES to the Wilds' fight (Alex 11-16: "the tactical and signature keys" — Q and X). The cast's
// numbers are play3d's (cast.ts › castForMove, one source for every host); this is the open world's hand for them.
//
//   projectile — instant along the aim (the open world's guns are hit-scan too): damage, the cast's statuses on what
//                it strikes, a shove, a grapple, a chain to the nearest others
//   status     — the cast's statuses on every Hollow round the aim point (castRange out, areaSize across)
//   restore    — the keeper heals
//   infusion   — the gun hits harder for surgeSecs
// surge and impulse move the KEEPER and live on the page (shared/casting.ts says which). The rest (field, terrain,
// channel, veil, gate) are not out here yet, and say so: never a silent no-op.
//
// ★ PURE. No React, no three: it reads and writes the Combat, and returns where to draw the flash.

import { castForMove, type CastSpec } from '../../play3d/cast'
import { HEAD_Y, BODY_Y, fxOn, type Combat, type Hollow, type HollowFx, type Terrain } from './combat'

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
    default:
      return null
  }
}

/** The move a cast slot holds, as play3d's spec (NO_CAST when empty or unknown). */
export const specOf = (moveId: string | null) => castForMove(moveId)
