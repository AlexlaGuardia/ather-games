// BETA M233 v2a: THE BOUT RUNNER SEAM. The Clash ring (clash-ring.tsx) plays a bout as a timeline: where each spirit stands,
// which way she faces, her HP and what she is doing at time t, plus the bout's events (start / hit / end). It never asks HOW the
// bout was decided. v2b-2 swaps the live auto-battle engine (clash-fight.ts, sprites lane) in behind this interface with no UI
// change. M233 v2b-2 (folded into v2a, hub 11-27): fightRunner = THE LIVE ENGINE (clash-fight.ts, sprites lane), stepped in
// real time as the ring asks for frames, with her CHEER as an input. The ring uses it; the placeholder stays as the seam's spare.
// PLACEHOLDER RUNNER: the bout is decided by the battle engine we already have, run HEADLESS at s3's tent settings
// (engine/party-battle.ts, evened spirits, the troupe's play per tier; her side presses). Each landed blow becomes a timed hit
// in the ring: the striker closes in, strikes, the two back off and circle. A troupe bout runs PLACEHOLDER_S.troupe seconds,
// hers PLACEHOLDER_S.keeper. Pure; no React.
import type { Spirit } from '../../spirits/spirit'
import { createPartyBattle, currentActor, chooseAction, takeAction } from '../../engine/party-battle'
import { CLASH_AI, CLASH_TROUPE_MANA, type ClashTier } from './fair-clash-rules'
import { tacticsOf } from './clash-lessons'   // M233 v2c
import { createFight, step, tentEntrant, resolveBonded, bondSeed, type Bonded, DT, RING, type FightState, type FighterSnap, type FightEvent, type TickLog } from './clash-fight'

export type BoutAct = 'idle' | 'walk' | 'windup' | 'strike' | 'evade' | 'guard' | 'hit' | 'down' | 'win'
/** a short word the ring floats over her for a moment (a landed blow, a dodge, a block, a miss, her cheer) */
export type BoutCue = 'hit' | 'evaded' | 'guarded' | 'miss' | 'cheer' | null
export interface BoutPose { x: number; z: number; face: number; hp: number; act: BoutAct; cue?: BoutCue; cheered?: boolean }
export type Side = 'a' | 'b'
export interface BoutEvent { t: number; kind: 'start' | 'hit' | 'end'; by?: Side; hp?: number }
export interface BoutPlay {
  /** both spirits at bout time t (seconds; call with t rising) */
  at(t: number): { a: BoutPose; b: BoutPose }
  /** the bout is over at t (the ring then holds on the winner and moves the tree) */
  over(t: number): boolean
  /** the winner once over(t) */
  winner(): Side | null
  /** the keeper's CHEER for side s (once a match): true when it landed */
  cheer?(s: Side): boolean
  /** a timeline's fixed length (placeholder); a live bout has none */
  duration?: number
  events?: BoutEvent[]
  /** M238: the bonded move each side throws this bout (the keeper's favourite, or the seeded random one) */
  bonded?: { a: Bonded; b: Bonded }
  /** M233 v2c: every engine event so far (side 0 = 'a'), the fight's seed and state (clash-lessons.ts reads a finished bout) */
  log?: FightEvent[]; seed?: number; state?: FightState
}
export interface BoutSide { spirit: Spirit; /** her spirit (the keeper's side) */ keeper?: boolean
  /** M238: her favourite + twist and her known move ids (spirit-bond-move.ts); unset = a seeded random known move */
  bonded?: Bonded | null; known?: readonly string[]
  /** M233 v2c: her LESSONS (clash-lessons.ts ids, on her pot): the engine reads them as tactics */
  lessons?: readonly string[] }
export interface BoutRunner { name: string; run(a: BoutSide, b: BoutSide, o: { tier: ClashTier; /** a fixed fight seed (checks); none = fresh */ seed?: number }): BoutPlay }

/** the placeholder's bout lengths (s): short, so a run stays a minute or two (the live engine aims at 60-90 s a bout) */
export const PLACEHOLDER_S = { troupe: 7, keeper: 12 } as const
/** the ring the spirits pace in (m, from the centre); clash-ring.tsx draws its sand to RING_R */
export const RING_R = 7
export const FAR = 5, NEAR = 2

interface Blow { by: Side; hpA: number; hpB: number }

/** decide the bout headless with the turn-based engine; answers the winner and each landed blow (HP after it, 0..1) */
export function decideBout(a: BoutSide, b: BoutSide, tier: ClashTier): { winner: Side; blows: Blow[] } {
  const s = createPartyBattle([a.spirit], [b.spirit], { ally: a.keeper ? undefined : CLASH_TROUPE_MANA[tier], enemy: CLASH_TROUPE_MANA[tier] })
  const A = s.allies[0], B = s.enemies[0], blows: Blow[] = []
  let ha = A.hp, hb = B.hp
  while (s.outcome === 'pending' && s.round <= 80) {
    const actor = currentActor(s); if (!actor) break
    const ai = actor.side === 'ally' && a.keeper ? { focusFire: true, spendMana: true, stance: 'press' as const } : CLASH_AI[tier]
    takeAction(s, chooseAction(s, actor, ai))
    if (A.hp !== ha || B.hp !== hb) {
      const by: Side = B.hp < hb ? 'a' : 'b'
      blows.push({ by, hpA: Math.max(0, A.hp / A.maxHp), hpB: Math.max(0, B.hp / B.maxHp) })
      ha = A.hp; hb = B.hp
    }
  }
  const winner: Side = s.outcome === 'win' ? 'a' : s.outcome === 'lose' ? 'b' : A.hp / A.maxHp >= B.hp / B.maxHp ? 'a' : 'b'
  return { winner, blows }
}

/** lay a decided bout out on a timeline in the ring */
export function timeline(winner: Side, blows: Blow[], duration: number, seed = 1): BoutPlay {
  const t0 = 1.4, t1 = duration - 1.6, n = Math.max(1, blows.length)
  const hits = blows.map((bl, i) => ({ ...bl, t: t0 + (t1 - t0) * (n === 1 ? 1 : i / (n - 1)) }))
  const events: BoutEvent[] = [{ t: 0, kind: 'start' }, ...hits.map(h => ({ t: h.t, kind: 'hit' as const, by: h.by, hp: h.by === 'a' ? h.hpB : h.hpA })), { t: duration, kind: 'end', by: winner }]
  const ph = (seed % 97) * 0.13
  const at = (tt: number) => {
    const t = Math.max(0, Math.min(duration, tt))
    let hpA = 1, hpB = 1, near = 0, striker: Side | null = null, lastHit = -9
    for (const h of hits) {
      if (h.t <= t) { hpA = h.hpA; hpB = h.hpB; lastHit = h.t }
      const d = Math.abs(t - h.t)
      if (d < 0.55) { const w = 1 - d / 0.55; if (w > near) { near = w; striker = h.by } }
    }
    // walk in from the far sides over the first second, then circle; close in round each blow
    const enter = Math.min(1, t / 1.2), sep = (RING_R * 1.5) * (1 - enter) + FAR * enter - (FAR - NEAR) * near
    const ang = ph + t * 0.32, cx = Math.sin(t * 0.45 + ph) * 0.35, cz = Math.cos(t * 0.37 + ph) * 0.3
    const dx = Math.cos(ang), dz = Math.sin(ang)
    // the striker carries the lunge: she covers more of the gap
    const ka = striker === 'a' ? 0.7 : striker === 'b' ? 0.3 : 0.5
    const gap = sep, mx = cx + dx * (gap * (ka - 0.5)), mz = cz + dz * (gap * (ka - 0.5))
    const ax = mx - dx * gap / 2, az = mz - dz * gap / 2, bx = mx + dx * gap / 2, bz = mz + dz * gap / 2
    const faceA = Math.atan2(bx - ax, bz - az), faceB = Math.atan2(ax - bx, az - bz)
    const end = t >= duration - 1.6 && t >= (hits[hits.length - 1]?.t ?? 0)
    const actOf = (me: Side): BoutAct => {
      if (end) return winner === me ? 'win' : 'down'
      if (near > 0.35 && striker === me) return 'strike'
      if (near > 0.35 && striker && striker !== me && t - lastHit < 0.5 && t >= lastHit) return 'hit'
      return t < 1.2 || near > 0 ? 'walk' : 'idle'
    }
    if (end) { if (winner === 'a') hpB = 0; else hpA = 0 }
    return { a: { x: ax, z: az, face: faceA, hp: hpA, act: actOf('a') }, b: { x: bx, z: bz, face: faceB, hp: hpB, act: actOf('b') } }
  }
  return { duration, winner: () => winner, over: t => t >= duration, events, at }
}

/** the placeholder runner: the old engine decides, the ring plays it as a short paced bout */
export const placeholderRunner: BoutRunner = {
  name: 'placeholder',
  run(a, b, o) {
    const { winner, blows } = decideBout(a, b, o.tier)
    return timeline(winner, blows, a.keeper || b.keeper ? PLACEHOLDER_S.keeper : PLACEHOLDER_S.troupe, a.spirit.name.length * 7 + b.spirit.name.length)
  },
}

// ── THE LIVE ENGINE (clash-fight.ts) behind the seam ──
/** the engine's ring (RING.r m) drawn at the ring's size */
export const VIEW = RING_R / RING.r
const CUE_S = 0.6
const cueOf = (k: FightEvent['kind']): BoutCue => (k === 'hit' ? 'hit' : k === 'evaded' ? 'evaded' : k === 'guarded' ? 'guarded' : k === 'miss' ? 'miss' : k === 'cheer' ? 'cheer' : null)
/** who an event's word floats over: a blow / miss over the one struck, a dodge or block over the defender, a cheer over her */
const cueSide = (e: FightEvent): 0 | 1 => (e.kind === 'cheer' ? e.side : e.kind === 'evaded' || e.kind === 'guarded' ? (1 - e.side) as 0 | 1 : (1 - e.side) as 0 | 1)
function actOf(f: FighterSnap, moving: boolean): BoutAct {
  if (f.act === 'melee' || f.act === 'bonded') return f.phase === 'windup' ? 'windup' : 'strike'
  if (f.act === 'evade') return 'evade'
  if (f.act === 'guard') return 'guard'
  if (f.act === 'stagger') return 'hit'
  return f.act === 'reposition' || moving ? 'walk' : 'idle'
}
/** a live bout: the engine stepped up to the asked time (20 Hz, positions eased between ticks) */
export function liveBout(s: FightState, hold = 1.2, onTick?: (l: TickLog) => void): BoutPlay {
  // M243: onTick = every engine tick as it is stepped (the /shimmer/dev?mode=fair log); the game passes none
  let prev = step(s), last = prev
  onTick?.(prev)
  const press: [boolean, boolean] = [false, false], cues: { t: number; side: 0 | 1; c: BoutCue }[] = []
  const log: FightEvent[] = [...prev.ev]   // M233 v2c: the bout's whole event log (the lessons read it)
  const pose = (i: 0 | 1, t: number): BoutPose => {
    const a = prev.f[i], b = last.f[i], k = Math.max(0, Math.min(1, (t - last.t) / DT + 1))
    const x = (a.x + (b.x - a.x) * k) * VIEW, z = (a.z + (b.z - a.z) * k) * VIEW
    const moving = Math.hypot(b.x - a.x, b.z - a.z) > 0.02
    const cue = cues.filter(c => c.side === i && t - c.t < CUE_S).pop()?.c ?? null
    const act: BoutAct = s.over ? (s.winner === i ? 'win' : 'down') : actOf(b, moving)
    return { x, z, face: b.face, hp: s.over && s.winner !== i ? 0 : Math.max(0, b.hp / Math.max(1, b.maxHp)), act, cue, cheered: b.cheered }
  }
  return {
    at(t) {
      while (!s.over && last.t + DT <= t) {
        prev = last; last = step(s, { cheer: [press[0], press[1]] }); press[0] = press[1] = false; onTick?.(last); log.push(...last.ev)
        for (const e of last.ev) { const c = cueOf(e.kind); if (c) cues.push({ t: last.t, side: cueSide(e), c }) }
        if (cues.length > 40) cues.splice(0, cues.length - 40)
      }
      return { a: pose(0, t), b: pose(1, t) }
    },
    over: t => s.over && t >= s.t + hold,
    winner: () => (s.winner === null ? null : s.winner === 0 ? 'a' : 'b'),
    cheer(side) { const i = side === 'a' ? 0 : 1; if (s.over || s.f[i].cheered || press[i]) return false; press[i] = true; return true },
    log, seed: s.seed, state: s,
  }
}
/** the live runner: both spirits as the tent's evened entrants (clash-fight.ts tentEntrant), a fresh seed per bout */
export const fightRunner: BoutRunner = {
  name: 'clash-fight',
  run(a, b, o) {
    const e = (x: BoutSide) => ({ ...tentEntrant(x.spirit.species, (x.spirit.element ?? 'base'), o.tier, x.bonded), name: x.spirit.name, known: x.known, tactics: tacticsOf(x.lessons) })
    const ea = e(a), eb = e(b), seed = o.seed ?? (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
    return { ...liveBout(createFight(ea, eb, seed)), bonded: { a: resolveBonded(ea, bondSeed(seed, 0)), b: resolveBonded(eb, bondSeed(seed, 1)) } }
  },
}
