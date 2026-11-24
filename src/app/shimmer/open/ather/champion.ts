// THE NODE'S CHAMPION — the big Hollow that rises out of an infected node (Alex 11-14): three health bars; each break
// summons a wave; the second bar changes the attack COMBINATIONS; the third is PANIC, random patterns; every attack
// telegraphed. Kill it: a big chunk of grey matter, and the node clears for now.
//
// Build vocabulary only: "champion" is not a canon name and never shows in the UI (the HUD says HOLLOW). Look follows
// design-briefs/hollows.md (goop, no colour of its own); it walks, because only the ranged form floats.
//
// Three attacks, each with a tell you can read and a way out:
//   SLAM   — rears up, a ring grows on the ground round it; be outside the ring when it lands.
//   LUNGE  — locks a line at you, a strip shows it; step off the line.
//   VOLLEY — swells and brightens, then a fan of slow spits; strafe across the fan.
// Bar 1: one attack at a time, chosen by range. Bar 2: two-attack COMBOS. Bar 3: panic, 1–3 random attacks with a
// short rest, but a windup never drops below PANIC_MIN_WINDUP: always telegraphed.
//
// ★ PURE, like combat.ts (which steps it and routes rounds into it).

import { spawnHollow, hurtKeeper, structFree, sees, STEER_LOOK, type Combat, type Terrain } from './combat'
import { steer, type SteerMem } from './obstacles'
import type { WildsNode } from './nodes'

export type Attack = 'slam' | 'lunge' | 'volley'
export type ChampState = 'rise' | 'idle' | 'windup' | 'act' | 'recover' | 'submerge' | 'home'
export interface Champion {
  nodeId: string; nx: number; nz: number          // the node it guards
  x: number; y: number; z: number; yaw: number
  bar: 0 | 1 | 2; hp: number
  state: ChampState; t: number                    // seconds left in the state
  attack: Attack | null; queue: Attack[]
  ax: number; az: number                          // locked aim (unit) for lunge/volley
  hitDone: boolean; hitFlash: number
  sink: number                                     // 0 = standing, 1 = under the ooze (draw only)
  sm?: SteerMem                                    // M117 s3: which way round a structure it committed to
}

export const CHAMP = {
  barHp: 150, bars: 3, radius: 1.0, height: 3.6,
  headY: 3.15, headR: 0.55, bodyY: 1.7, bodyR: 1.0,
  walk: 1.35, keepNear: 3.5, leash: 55, rise: 2.0, submerge: 3.2,
  // attacks: windup = the tell; then the act
  slam: { windup: 1.0, r: 5.5, damage: 24, act: 0.25 },
  lunge: { windup: 0.8, len: 11, width: 1.7, damage: 20, act: 0.45 },
  volley: { windup: 0.9, n: 5, fan: 0.42, speed: 10, damage: 10, act: 0.2 },
  recover: [1.6, 1.25, 0.8] as const,              // rest after a combo, per bar
  comboGap: 0.35,
  slamRange: 7,
  panicWindupScale: 0.72,
  chunk: 30,                                       // grey matter for the kill
}
export const PANIC_MIN_WINDUP = 0.55
/** The waves a break summons: [shamblers, floaters], ringed round the node. */
export const WAVES: [number, number][] = [[4, 0], [4, 2]]

const rnd = (c: Combat) => { c.seed = (c.seed * 1664525 + 1013904223) >>> 0; return c.seed / 4294967296 }

export function wakeChampion(c: Combat, T: Terrain, n: WildsNode): Champion {
  const bar = (c.dormant?.[n.id] ?? 0) as 0 | 1 | 2   // a champion that went back under resumes on the bar it reached
  const ch: Champion = {
    nodeId: n.id, nx: n.x, nz: n.z, x: n.x, y: T.heightAt(n.x, n.z), z: n.z, yaw: 0,
    bar, hp: CHAMP.barHp, state: 'rise', t: CHAMP.rise, attack: null, queue: [], ax: 0, az: 1, hitDone: false, hitFlash: 0, sink: 1,
  }
  c.champ = ch
  c.events.push({ kind: 'champ-wake', nodeId: n.id })
  return ch
}

/** May a round hurt it right now? Not while it rises, sinks or walks home. */
export const champVulnerable = (ch: Champion) => ch.state !== 'rise' && ch.state !== 'submerge' && ch.state !== 'home'

export function windupOf(ch: Champion, a: Attack): number {
  const w = CHAMP[a].windup
  return ch.bar === 2 ? Math.max(PANIC_MIN_WINDUP, w * CHAMP.panicWindupScale) : w
}

/** The next string of attacks, by bar. */
export function planCombo(c: Combat, ch: Champion, d: number): Attack[] {
  if (ch.bar === 0) return [d < CHAMP.slamRange ? 'slam' : 'lunge']
  if (ch.bar === 1) {
    const combos: Attack[][] = d < CHAMP.slamRange ? [['slam', 'lunge'], ['slam', 'volley']] : [['volley', 'lunge'], ['lunge', 'slam']]
    return combos[Math.floor(rnd(c) * combos.length)]
  }
  const all: Attack[] = ['slam', 'lunge', 'volley'], n = 1 + Math.floor(rnd(c) * 3)
  return Array.from({ length: n }, () => all[Math.floor(rnd(c) * 3)])
}

/** A round reached it. Returns true if the round is spent on it. */
export function hitChampion(c: Combat, T: Terrain, ch: Champion, head: boolean, dmg: number, crit: number) {
  if (!champVulnerable(ch)) { c.events.push({ kind: 'hit', id: -1, head: false, killed: false }); return }
  ch.hp -= head ? crit : dmg; ch.hitFlash = 0.12
  c.events.push({ kind: 'hit', id: -1, head, killed: false })
  if (ch.hp > 0) return
  if (ch.bar < 2) {
    // break: it sinks back into the ooze and the node answers with a wave
    const [ns, nf] = WAVES[ch.bar]
    for (let k = 0; k < ns + nf; k++) {
      const a = (k / (ns + nf)) * Math.PI * 2 + rnd(c) * 0.5, r = 12 + rnd(c) * 5
      let x = ch.nx + Math.cos(a) * r, z = ch.nz + Math.sin(a) * r
      if (!T.walkable(x, z)) { x = ch.nx + Math.cos(a) * 6; z = ch.nz + Math.sin(a) * 6 }
      const h = spawnHollow(c, T, x, z, k < ns ? 'shambler' : 'floater')
      h.state = 'chase'
    }
    c.events.push({ kind: 'champ-break', nodeId: ch.nodeId, bar: ch.bar })
    ch.state = 'submerge'; ch.t = CHAMP.submerge; ch.attack = null; ch.queue = []
    ch.bar = (ch.bar + 1) as 0 | 1 | 2; ch.hp = CHAMP.barHp
    return
  }
  c.drops.push({ id: c.nextId++, x: ch.x, y: T.heightAt(ch.x, ch.z), z: ch.z, amount: CHAMP.chunk, age: 0 })
  c.events.push({ kind: 'champ-down', nodeId: ch.nodeId })
  c.champ = undefined
}

/** M59: through the one hurt path (frame defence, then the Mana Skin, then health) */
const hurt = (c: Combat, amount: number) => hurtKeeper(c, amount)

function startAttack(c: Combat, ch: Champion, a: Attack, fx: number, fz: number) {
  ch.attack = a; ch.state = 'windup'; ch.t = windupOf(ch, a); ch.hitDone = false
  const l = Math.hypot(fx - ch.x, fz - ch.z) || 1
  ch.ax = (fx - ch.x) / l; ch.az = (fz - ch.z) / l; ch.yaw = Math.atan2(ch.ax, ch.az)
}

export function stepChampion(c: Combat, T: Terrain, feet: { x: number; y: number; z: number }, dt: number) {
  const ch = c.champ
  if (!ch) return
  ch.t -= dt; ch.hitFlash = Math.max(0, ch.hitFlash - dt)
  const dx = feet.x - ch.x, dz = feet.z - ch.z, d = Math.hypot(dx, dz)
  const fromNode = Math.hypot(feet.x - ch.nx, feet.z - ch.nz)
  // leash: walk away and it goes home, healing the bar it was on (broken bars stay broken)
  if (ch.state !== 'home' && ch.state !== 'submerge' && ch.state !== 'rise' && (fromNode > CHAMP.leash || c.keeper.hp <= 0)) {
    ch.state = 'home'; ch.attack = null; ch.queue = []
  }
  switch (ch.state) {
    case 'rise':
      ch.sink = Math.max(0, ch.t / CHAMP.rise)
      if (ch.t <= 0) { ch.state = 'idle'; ch.t = 0.6; ch.sink = 0 }
      break
    case 'submerge': {
      const half = CHAMP.submerge / 2
      ch.sink = ch.t > half ? 1 - (ch.t - half) / half : ch.t / half   // down, then back up
      if (ch.t <= 0) { ch.state = 'idle'; ch.t = 0.8; ch.sink = 0 }
      break
    }
    case 'home': {
      const hx = ch.nx - ch.x, hz = ch.nz - ch.z, hd = Math.hypot(hx, hz)
      if (hd > 0.5) { ch.x += (hx / hd) * CHAMP.walk * 2 * dt; ch.z += (hz / hd) * CHAMP.walk * 2 * dt; ch.yaw = Math.atan2(hx, hz) }
      ch.hp = Math.min(CHAMP.barHp, ch.hp + 40 * dt)
      if (hd <= 0.5 && fromNode < CHAMP.leash - 10 && c.keeper.hp > 0) { ch.state = 'idle'; ch.t = 0.5 }
      // home with nobody near: it sinks back under (prod 11-15: one stuck at home blocked every other node from waking,
      // since only one champion is up at a time). It remembers the bar it reached; broken bars stay broken.
      else if (hd <= 0.5 && fromNode > CHAMP.leash) { (c.dormant ??= {})[ch.nodeId] = ch.bar; c.champ = undefined; return }
      break
    }
    case 'idle': {
      ch.yaw = Math.atan2(dx, dz)
      if (d > CHAMP.keepNear) {
        // M117 s3: round a building, never through it
        const sfree = structFree(T, ch, CHAMP.radius, CHAMP.height)
        const v = sfree ? steer(sfree, ch.x, ch.z, dx, dz, STEER_LOOK + CHAMP.radius, (ch.sm ??= {}), dt) : { x: dx / d, z: dz / d }
        if (v) {
          const nx = ch.x + v.x * CHAMP.walk * dt, nz = ch.z + v.z * CHAMP.walk * dt
          if (T.walkable(nx, nz) && (!sfree || sfree(nx, nz))) { ch.x = nx; ch.z = nz }
        }
      }
      if (ch.t <= 0) { ch.queue = planCombo(c, ch, d); startAttack(c, ch, ch.queue.shift()!, feet.x, feet.z) }
      break
    }
    case 'windup':
      // a volley keeps tracking during the tell; a lunge and a slam are committed
      if (ch.attack === 'volley') { const l = d || 1; ch.ax = dx / l; ch.az = dz / l; ch.yaw = Math.atan2(ch.ax, ch.az) }
      if (ch.t <= 0) { ch.state = 'act'; ch.t = CHAMP[ch.attack!].act; actStart(c, T, ch, feet) }
      break
    case 'act':
      if (ch.attack === 'lunge') {
        const sp = CHAMP.lunge.len / CHAMP.lunge.act, nx = ch.x + ch.ax * sp * dt, nz = ch.z + ch.az * sp * dt
        const sfree = structFree(T, ch, CHAMP.radius, CHAMP.height)   // M117 s3: a lunge stops at a wall
        if (T.walkable(nx, nz) && (!sfree || sfree(nx, nz))) { ch.x = nx; ch.z = nz }
        if (!ch.hitDone && d < CHAMP.radius + 0.6 * (c.keeper.hit ?? 1) && Math.abs(feet.y - ch.y) < 2.5 && sees(T, ch.x, ch.y + CHAMP.bodyY, ch.z, feet.x, feet.y + 0.9, feet.z)) { ch.hitDone = true; hurt(c, CHAMP.lunge.damage) }
      }
      if (ch.t <= 0) {
        const next = ch.queue.shift()
        if (next) { startAttack(c, ch, next, feet.x, feet.z); ch.t += CHAMP.comboGap }
        else { ch.attack = null; ch.state = 'recover'; ch.t = CHAMP.recover[ch.bar] }
      }
      break
    case 'recover':
      if (ch.t <= 0) { ch.state = 'idle'; ch.t = 0.2 }
      break
  }
  ch.y = T.heightAt(ch.x, ch.z)
}

function actStart(c: Combat, T: Terrain, ch: Champion, feet: { x: number; y: number; z: number }) {
  if (ch.attack === 'slam') {
    const d = Math.hypot(feet.x - ch.x, feet.z - ch.z)
    // M117 s3: a wall between takes the slam (cover is real)
    if (d < CHAMP.slam.r && Math.abs(feet.y - ch.y) < 2.5 && sees(T, ch.x, ch.y + CHAMP.bodyY, ch.z, feet.x, feet.y + 0.9, feet.z)) hurt(c, CHAMP.slam.damage)
  } else if (ch.attack === 'volley') {
    const V = CHAMP.volley, y0 = ch.y + CHAMP.headY
    for (let k = 0; k < V.n; k++) {
      const a = (k / (V.n - 1) - 0.5) * 2 * V.fan, ca = Math.cos(a), sa = Math.sin(a)
      const vx = (ch.ax * ca - ch.az * sa) * V.speed, vz = (ch.ax * sa + ch.az * ca) * V.speed
      c.spits.push({ x: ch.x + ch.ax, y: y0, z: ch.z + ch.az, vx, vz, vy: 1.2, life: 3, dmg: V.damage })
    }
  }
}

/** Telegraphs for the scene: what is about to land, and how far through its tell. */
export interface Tell { kind: Attack; x: number; z: number; ax: number; az: number; p: number }
export function tellOf(ch: Champion | undefined): Tell | null {
  if (!ch || ch.state !== 'windup' || !ch.attack) return null
  const w = windupOf(ch, ch.attack)
  return { kind: ch.attack, x: ch.x, z: ch.z, ax: ch.ax, az: ch.az, p: Math.min(1, 1 - ch.t / w) }
}
