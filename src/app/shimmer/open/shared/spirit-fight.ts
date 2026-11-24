// BETA M127 s1 (play, 2026-11-24): THE FIGHT BRAIN of the spirits walking with the keeper in the Wilds. Pure (no React, no
// three, no storage) but for one tiny live store the follow walk reads (`fightSlot`).
// Alex 11-24: "everything from damage to a passive effect.. staying within a certain range of the player.. focus on enemies the
// player is targeting.. not do too much but instead they pace themselves and judge how to best help"; "raise the range to 10 meters".
// CANON (RULED athernyx 4b74557): every spirit CHOOSES, every fight, whether she joins (she may just keep near); a Hollow can
// not touch, wound, drain, grey or TARGET a spirit (combat.ts never sees one: nothing here hands it a spirit's position); her
// help is her OWN act (no command, no button). s2 = per-species moves + temperament, s3 = learnset, s4 = tuning.
//
//  · TETHER: past FIGHT.tether m from the keeper she only comes back (to FIGHT.back m) before she does anything else.
//  · SHARED TARGET: the Hollow the keeper last hit (FIGHT.targetHold s), else the one they aim at. No target = no HIT.
//  · BRAIN: every FIGHT.think s she scores HIT / MEND / SLOW / nothing and does the best. Nothing wins often.
//  · PACING: her own cooldown, a rest after choosing nothing, and ONE help budget for the trio per fight. Their damage never
//    passes FIGHT.share of what the KEEPER has dealt in the same fight, so a keeper who does nothing gets nothing done.
//  · Off duty (no fight, not joining, nothing to walk to) fightSlot is null and M126's formation owns her place: a fight only
//    MOVES THE SLOT the same walk is already on, so neither hand-over jumps.
import { fxOn, type Combat, type Hollow } from '../ather/combat'

export type Act = 'hit' | 'mend' | 'slow'
export type V = { x: number; z: number }

/** THE DIALS (Jin's, start low) */
export const FIGHT = {
  tether: 10, back: 6,          // m: Alex's 10; past it she comes back to within `back` first
  stand: 8,                     // m: the furthest from the keeper she ever picks to stand
  reach: 7, off: 2.2,           // m: how far her HIT carries; how far off the Hollow she stops
  engageR: 25, quiet: 5,        // a Hollow on the keeper inside engageR = a fight; this many s of none = over
  targetHold: 4, aimR: 40, aimCos: 0.995,   // s a hit keeps the target; the aim ray's length and cone (~5.7 deg)
  think: 0.35, rest: 1.6,       // s between thoughts; s she lets pass after choosing nothing
  cooldown: 5,                  // s between one spirit's helps
  gap: 1.2,                     // s between any two helps of the trio
  helps: 10, share: 0.12,       // the trio's budget a fight: helps in all, and their damage as a part of the keeper's
  join: 0.7,                    // odds one spirit joins one fight
  hit: 5, hitRange: 16,         // damage a HIT does; a target further from the keeper than this is left alone
  mend: 6, mendUnder: 0.5,      // health a MEND gives; only under this part of full health
  slowN: 3, slowR: 6, slowSecs: 2.5,   // Hollows this close to the keeper, this many at least, slowed this long
  idle: 0.5, jitter: 0.25, crowd: 0.45, crowdFade: 3,   // 'nothing': its base score, its swing, and how much a fresh help (anyone's) adds to it
} as const

export type Situation = { targetD: number | null; hpFrac: number; near: number; engaged: number; sinceHelp: number; canDamage: boolean; canSlow: boolean; roll: number }
export type Scores = Record<Act | 'nothing', number>
/** what each action is worth now (0 = not on the table). `roll` 0..1 = her mood this thought. */
export function score(s: Situation): Scores {
  const F = FIGHT
  return {
    hit: s.targetD !== null && s.targetD <= F.hitRange && s.canDamage ? 0.42 + 0.06 * Math.min(4, s.engaged) + (s.targetD < 5 ? 0.12 : 0) : 0,
    mend: s.hpFrac > 0 && s.hpFrac < F.mendUnder ? 0.45 + 0.8 * (F.mendUnder - s.hpFrac) / F.mendUnder : 0,
    slow: s.near >= F.slowN && s.canSlow ? 0.4 + 0.12 * (s.near - F.slowN + 1) : 0,
    nothing: F.idle + (s.roll * 2 - 1) * F.jitter + F.crowd * Math.exp(-Math.max(0, s.sinceHelp) / F.crowdFade),
  }
}
export function pick(s: Scores): Act | 'nothing' {
  let best: Act | 'nothing' = 'nothing'
  for (const k of ['hit', 'mend', 'slow'] as const) if (s[k] > 0 && s[k] > s[best]) best = k
  return best
}

/** a steady 0..1 from a spirit and a fight (the same spirit in the same fight always answers the same) */
export function roll01(id: string, n: number, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0
  for (const ch of `${id}|${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** CANON: her own choice, every fight */
export const joins = (id: string, fight: number, seed: number) => roll01(id, fight, seed) < FIGHT.join

/** may `dmg` more be dealt by the trio? (the hard cap: never past `share` of the keeper's own damage this fight) */
export const mayDeal = (spiritDealt: number, keeperDealt: number, dmg: number) => spiritDealt + dmg <= FIGHT.share * keeperDealt + 1e-9

/** past the tether = come back; then stay coming back until within `back` */
export const tethered = (d: number, coming: boolean) => d > FIGHT.tether || (coming && d > FIGHT.back)

/** where she stands to work on `t`: `off` short of it on the keeper's side, fanned by `lane`, never past `stand` m from the keeper */
export function workSpot(k: V, t: V, lane: number): V & { face: number } {
  const d = Math.hypot(t.x - k.x, t.z - k.z) || 1, r = Math.max(1.6, Math.min(FIGHT.stand, d - FIGHT.off))
  const a = Math.atan2(t.x - k.x, t.z - k.z) + lane * 0.45
  const p = { x: k.x + Math.sin(a) * r, z: k.z + Math.cos(a) * r }
  return { ...p, face: Math.atan2(t.x - p.x, t.z - p.z) }
}

export type Helper = { id: string; x: number; z: number }
export type Done = { id: string; kind: Act; x: number; y: number; z: number; amount: number; target?: number }
type Mind = { joined: boolean; cool: number; think: number; want: Act | 'nothing'; coming: boolean; goal: 'hit' | null; goalT: number }
export type SpiritFight = {
  seed: number; n: number; on: boolean; quiet: number; t: number; lastHelp: number; helps: number
  keeperDealt: number; spiritDealt: number; frameDealt: number; hp: number
  target: number | null; targetT: number; minds: Map<string, Mind>; slots: Map<string, V & { face: number }>
  /** totals since the page opened (checks read them): what was chosen, how far from the keeper anyone got after settling */
  seen: { hit: number; mend: number; slow: number; nothing: number; onTarget: number; fights: number; joined: number; stayed: number; dealt: number; returns: number }
}
export const newSpiritFight = (seed: number): SpiritFight => ({ seed, n: 0, on: false, quiet: 0, t: 0, lastHelp: -99, helps: 0, keeperDealt: 0, spiritDealt: 0, frameDealt: 0, hp: -1,
  target: null, targetT: -99, minds: new Map(), slots: new Map(),
  seen: { hit: 0, mend: 0, slow: 0, nothing: 0, onTarget: 0, fights: 0, joined: 0, stayed: 0, dealt: 0, returns: 0 } })

const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.z - b.z)
const ENGAGED = (h: Hollow) => h.state !== 'wander'

/** every live Hollow's health, taken at the top of the frame; `noteKeeper` reads what the KEEPER took off it */
export const healthOf = (C: Combat) => new Map(C.hollows.map(h => [h.id, h.hp]))
/** after the step: the keeper's damage this frame (a pooled body carries its parts' health, so a merge is worth 0), who they hit, and pools */
export function noteKeeper(F: SpiritFight, C: Combat, before: ReadonlyMap<number, number>) {
  let lost = 0
  const now = new Map(C.hollows.map(h => [h.id, h.hp]))
  for (const [id, hp] of before) lost += Math.max(0, hp) - Math.max(0, now.get(id) ?? 0)
  const mine = Math.max(0, lost - F.frameDealt); F.frameDealt = 0
  for (const e of C.events) {
    if (e.kind === 'hit' && !e.killed) { F.target = e.id; F.targetT = F.t }   // the champion is -1: no body here, so no shared target
    if (e.kind === 'merge' && F.target === e.gone) F.target = e.id
  }
  if (mine > 0) F.quiet = 0
  if (F.on) F.keeperDealt += mine
}
/** the shared target: the last one hit while that is fresh, else the one the keeper aims at */
export function sharedTarget(F: SpiritFight, C: Combat, eye: { x: number; y: number; z: number }, aim: { x: number; y: number; z: number }): Hollow | null {
  if (F.target !== null && F.t - F.targetT < FIGHT.targetHold) {
    if (F.target < 0) return null
    const h = C.hollows.find(q => q.id === F.target && q.hp > 0); if (h) return h
  }
  let best: Hollow | null = null, bd: number = FIGHT.aimR
  for (const h of C.hollows) {
    if (h.hp <= 0) continue
    const dx = h.x - eye.x, dy = h.y + (h.kind === 'floater' ? 0 : 0.8) - eye.y, dz = h.z - eye.z, d = Math.hypot(dx, dy, dz) || 1
    if (d < bd && (dx * aim.x + dy * aim.y + dz * aim.z) / d > FIGHT.aimCos) { best = h; bd = d }
  }
  return best
}

/** ONE FRAME, before stepCombat. `spirits` = where each really stands. Applies their helps to C between steps, the way a cast
 *  lands: a Hollow taken to 0 is swept by the next stepCombat with ONE kill event + ONE drop, like any other. */
export function stepSpirits(F: SpiritFight, C: Combat, feet: { x: number; y: number; z: number }, eye: { x: number; y: number; z: number }, aim: { x: number; y: number; z: number }, spirits: readonly Helper[], dt: number): Done[] {
  const D = FIGHT, out: Done[] = [], k = C.keeper
  F.t += dt; F.slots.clear()
  const hurt = F.hp >= 0 && k.hp < F.hp - 1e-6; F.hp = k.hp
  const engaged = C.hollows.filter(h => h.hp > 0 && ENGAGED(h) && dist(h, feet) < D.engageR)
  if (k.hp > 0 && (engaged.length || (hurt && C.hollows.length))) F.quiet = 0; else F.quiet += dt
  const on = k.hp > 0 && F.quiet < D.quiet && (F.on || engaged.length > 0)
  if (on && !F.on) { F.n++; F.helps = 0; F.keeperDealt = 0; F.spiritDealt = 0; F.minds.clear(); F.seen.fights++ }
  if (!on && F.on) F.minds.clear()
  F.on = on
  if (!on) return out
  const target = sharedTarget(F, C, eye, aim), td = target ? dist(target, feet) : null
  const nearBy = C.hollows.filter(h => h.hp > 0 && dist(h, feet) < D.slowR)
  const help = (m: Mind, d: Done) => { m.cool = D.cooldown; m.goal = null; m.think = D.rest; F.helps++; F.lastHelp = F.t; F.seen[d.kind]++; out.push(d) }
  spirits.forEach((s, i) => {
    let m = F.minds.get(s.id)
    if (!m) { const j = joins(s.id, F.n, F.seed); m = { joined: j, cool: roll01(s.id, F.n, F.seed + 7) * 2, think: 0, want: 'nothing', coming: false, goal: null, goalT: 0 }; F.minds.set(s.id, m); if (j) F.seen.joined++; else F.seen.stayed++ }
    m.cool -= dt; m.think -= dt
    const was = m.coming
    m.coming = tethered(dist(s, feet), m.coming)
    if (m.coming) { if (!was) F.seen.returns++; m.goal = null; return }   // the formation slot beside the keeper IS the way back
    if (!m.joined) return                                                 // her choice: she keeps near
    const budget = F.helps < D.helps, free = F.t - F.lastHelp >= D.gap
    if (m.goal === 'hit') {
      m.goalT -= dt
      const dmg = target ? Math.min(D.hit, target.hp) : 0
      if (!target || td! > D.hitRange || !budget || m.goalT <= 0 || !mayDeal(F.spiritDealt, F.keeperDealt, dmg)) { m.goal = null; m.think = D.rest }
      else {
        F.slots.set(s.id, workSpot(feet, target, i - (spirits.length - 1) / 2))
        if (dist(s, target) <= D.reach && free) {
          target.hp -= dmg; target.hitFlash = 0.12; F.spiritDealt += dmg; F.frameDealt += dmg; F.seen.dealt += dmg; F.seen.onTarget++
          help(m, { id: s.id, kind: 'hit', x: target.x, y: target.y + (target.kind === 'floater' ? 0 : 0.8), z: target.z, amount: dmg, target: target.id })
        }
        return
      }
    }
    if (m.cool > 0 || m.think > 0 || !budget || !free) return
    m.think = D.think
    const sc = score({ targetD: td, hpFrac: k.hp / k.maxHp, near: nearBy.length, engaged: engaged.length, sinceHelp: F.t - F.lastHelp,
      canDamage: !!target && mayDeal(F.spiritDealt, F.keeperDealt, Math.min(D.hit, target.hp)), canSlow: nearBy.some(h => !fxOn(h, 'slowed')), roll: roll01(s.id, Math.round(F.t * 60), F.seed + 13) })
    m.want = pick(sc)
    if (m.want === 'nothing') { m.think = D.rest; F.seen.nothing++ }
    else if (m.want === 'hit') { m.goal = 'hit'; m.goalT = 3; F.slots.set(s.id, workSpot(feet, target!, i - (spirits.length - 1) / 2)) }
    else if (m.want === 'mend') { const amount = Math.min(D.mend, k.maxHp - k.hp); k.hp += amount; F.hp = k.hp; help(m, { id: s.id, kind: 'mend', x: feet.x, y: feet.y, z: feet.z, amount }) }
    else { for (const h of nearBy) h.fx = { ...h.fx, slowed: Math.max(h.fx?.slowed ?? 0, D.slowSecs) }; help(m, { id: s.id, kind: 'slow', x: feet.x, y: feet.y, z: feet.z, amount: nearBy.length }) }
  })
  return out
}

// ── the live fight: the follow walk (ather/spirit-model.tsx) asks where a spirit's fight puts her; null = M126's formation ──
let live: SpiritFight | null = null
export function setLiveFight(f: SpiritFight | null) { live = f }
export const fightSlot = (id: string): (V & { face: number }) | null => live?.slots.get(id) ?? null
