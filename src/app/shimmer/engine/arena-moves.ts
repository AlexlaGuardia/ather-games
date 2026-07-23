// ── Arena movesets — the canon kits driving the Keeper's Arena (2026-07-22) ─────
//
// The cinematic-battle port: each fighter carries its REAL 4-move kit (engine/moves.ts,
// names canon per CANON/game/moves.md — the one registry) instead of anonymous melee
// bumping. A move is a timed ACTION — windup → execute → recover — with a range, a
// cooldown (replacing PP for real-time), live element effectiveness, and accuracy-vs-agi
// resolved as a VISIBLE dodge (the target sidesteps; nothing whiffs silently).
//
// The 7 states are the 7 choreography verbs the playback renderer performs:
//   solid=strike · compact=shield · expanding=wave · ignite=burst
//   flow=current · scatter=disruption · bind=lock
//
// Everything here is PURE + deterministic (all randomness through the arena rng) so the
// whole fight can be pre-scripted at mount and replayed identically — sim-first, same
// discipline as every cabinet.

import type { Spirit } from '../spirits/spirit'
import {
  getMovesForSpirit, getEffectiveness, effectivenessLabel, hasSTAB, toBattleElement,
  type Move, type MoveState, type StatusId, type BattleElement,
} from './moves'

// ── dials ───────────────────────────────────────────────────────────────────────
export const DMG_SCALE = 1.0          // global damage knob
export const STAB_MULT = 1.15         // same-element move bonus
export const HEAVY_POWER = 60         // power ≥ this ⇒ telegraphed heavy (danger ring, interruptible read)
export const DODGE_AGI_SLOPE = 0.003  // per point of agi difference
export const HIT_FLOOR = 0.55         // even wild swings connect sometimes
export const HIT_CEIL = 0.98          // nothing is a guaranteed hit
export const SIDESTEP = 0.9           // dodge displacement (floor units)
export const STAGE_MULT = 0.22        // per stat stage (±3 cap)
// Sudden-death ramp — the ONLY knob that shortens long fights without touching short ones,
// which is why the 2026-07-23 pacing pass leans on it instead of on HP_MULT or guard.
// Was 25s/+5%: too late and too shallow to save a tank matchup, so a water-bear mirror
// stalemated outright (L50: zero KOs inside the oracle's 60s cap) and Alex was skipping
// battles. At 14s/+16% a duel lands ~6 hits/22s and the worst case in the game — a
// high-guard, high-vig mirror — resolves in ~11 hits/40s. Raising TIRE_AT or lowering
// TIRE_RAMP brings the slog straight back; arena.test.ts's PACING block is the guard.
export const TIRE_AT = 14             // sudden-death: after this many seconds…
export const TIRE_RAMP = 0.16         // …damage climbs per second (spirits tire; no stall-fests)

// per-state action profile: range (0 = self/cast-in-place), aoe radius (0 = single target)
const STATE_PROFILE: Record<MoveState, { range: number; aoe: number }> = {
  solid:     { range: 1.1, aoe: 0 },
  compact:   { range: 0,   aoe: 0 },
  expanding: { range: 2.4, aoe: 1.4 },
  ignite:    { range: 1.6, aoe: 0 },
  flow:      { range: 1.4, aoe: 0 },   // flow damage moves are close currents; pure buffs are self-range anyway
  scatter:   { range: 2.0, aoe: 0 },
  bind:      { range: 1.8, aoe: 0 },
}

export interface ArenaMove {
  id: string; name: string
  element: BattleElement; state: MoveState
  power: number; accuracy: number
  windup: number; recover: number; cd: number
  range: number; aoe: number
  heavy: boolean
  effect?: StatusId; effectChance?: number
  selfEffect?: StatusId; selfEffectChance?: number
  statChanges?: Move['statChanges']
  cdLeft: number
}

/** Move → real-time arena action. Cooldown replaces PP: strong + scarce ⇒ long clock. */
export function toArenaMove(mv: Move): ArenaMove {
  const status = mv.power === 0
  const prof = STATE_PROFILE[mv.state]
  const range = status && (!mv.effect || mv.statChanges?.every(c => c.target === 'self')) ? 0 : prof.range
  let windup = status ? 0.55 : 0.5 + (mv.power / 100) * 1.1
  if (mv.priority > 0) windup *= 0.65      // priority moves strike FAST
  if (mv.priority < 0) windup *= 1.3
  return {
    id: mv.id, name: mv.name, element: mv.element, state: mv.state,
    power: mv.power, accuracy: mv.accuracy,
    windup,
    recover: status ? 0.3 : 0.35 + (mv.power / 100) * 0.5,
    cd: 2.2 + mv.power * 0.03 + Math.max(0, 30 - mv.pp) * 0.08,
    range, aoe: prof.aoe,
    heavy: mv.power >= HEAVY_POWER,
    effect: mv.effect, effectChance: mv.effectChance,
    selfEffect: mv.selfEffect, selfEffectChance: mv.selfEffectChance,
    statChanges: mv.statChanges,
    cdLeft: 0,
  }
}

/** A spirit's live arena kit — its canon 4-move pool as timed actions. */
export function kitForSpirit(sp: Spirit): ArenaMove[] {
  return getMovesForSpirit(sp.species, sp.element, sp.level, sp.bond).map(toArenaMove)
}

// ── canon status effects (shimmer-battles.md §5), real-time timers ───────────────
export interface StatusState {
  ignitionT: number      // DOT — burning mana
  regenT: number         // heal over time
  crystallized: boolean  // brittle: grd -20%, next hit +25% then clears
  fortifyT: number       // grd +25% but slowed (locked in place)
  surgeT: number         // rattled: incoming +15%
  erosionT: number       // a random stat stage crumbles every 2s
  erosionTick: number
  anchorT: number        // rooted: no movement, no dodging
}
export const freshStatus = (): StatusState => ({
  ignitionT: 0, regenT: 0, crystallized: false, fortifyT: 0, surgeT: 0, erosionT: 0, erosionTick: 0, anchorT: 0,
})

const STATUS_DUR: Record<StatusId, number> = {
  ignition: 6, regen: 6, crystallize: 0, fortify: 5, surge: 4, erosion: 6, anchor: 3,
}

export interface StageState { pwr: number; grd: number; agi: number }
export const freshStages = (): StageState => ({ pwr: 0, grd: 0, agi: 0 })
export const stageMult = (stage: number) => 1 + STAGE_MULT * Math.max(-3, Math.min(3, stage))

export function applyStatus(st: StatusState, id: StatusId) {
  if (id === 'crystallize') { st.crystallized = true; return }
  if (id === 'ignition') st.ignitionT = Math.max(st.ignitionT, STATUS_DUR.ignition)
  else if (id === 'regen') st.regenT = Math.max(st.regenT, STATUS_DUR.regen)
  else if (id === 'fortify') st.fortifyT = Math.max(st.fortifyT, STATUS_DUR.fortify)
  else if (id === 'surge') st.surgeT = Math.max(st.surgeT, STATUS_DUR.surge)
  else if (id === 'erosion') { st.erosionT = Math.max(st.erosionT, STATUS_DUR.erosion); st.erosionTick = 2 }
  else if (id === 'anchor') st.anchorT = Math.max(st.anchorT, STATUS_DUR.anchor)
}

// ── move selection — instinct, not menus ────────────────────────────────────────
// The spirit reads the fight: sustain when hurt, shield the incoming heavy, otherwise
// throw its best answer to the foe's element. Small rng jitter keeps replays from
// feeling robotic across DIFFERENT fights while staying deterministic per seed.
//
// AI tiers grade DECISION QUALITY, never stats (bosses are stronger because they read
// the fight better, not because their numbers cheat):
//   wild     — instinct: nearest target, loose scoring, late heals
//   trained  — focuses the weakest foe, steadier scoring
//   champion — trained + near-perfect move scoring, earlier sustain, reliable shields
export type ArenaAITier = 'wild' | 'trained' | 'champion'

export interface ChooserView {
  hpFrac: number
  stages: StageState
  fortified: boolean
  incomingHeavy: boolean          // an enemy heavy is winding at me
  targetElement: BattleElement
  targetAnchored: boolean
  defending: boolean              // stance === 'defend' ⇒ no damage windups, kit turns supportive
  tier: ArenaAITier
}

const TIER_JITTER: Record<ArenaAITier, number> = { wild: 0.2, trained: 0.1, champion: 0.02 }

export function chooseMove(kit: ArenaMove[], v: ChooserView, rng: () => number): ArenaMove | null {
  const ready = kit.filter(m => m.cdLeft <= 0)
  if (!ready.length) return null

  // 1) hurt → the kit's sustain (a flow heal / regen move). Champions don't wait until desperate.
  if (v.hpFrac < (v.tier === 'champion' ? 0.55 : 0.45)) {
    const heal = ready.find(m => m.selfEffect === 'regen' && m.power === 0)
    if (heal) return heal
  }
  // 2) a heavy bearing down → raise the shield. Champions always take the read; instinct
  //    skips it when already stacked.
  if (v.incomingHeavy && !v.fortified && (v.tier === 'champion' || v.stages.grd < 2)) {
    const shield = ready.find(m => m.state === 'compact')
    if (shield) return shield
  }
  if (v.defending) {
    // defend stance: supportive casts only — shields, currents, self-buffs; never a damage windup
    const support = ready.filter(m => m.power === 0).filter(m => !selfBuffMaxed(m, v))
    return support[0] ?? null
  }
  // 3) damage moves, scored by what actually bites this foe
  const dmg = ready.filter(m => m.power > 0)
  if (dmg.length) {
    const j = TIER_JITTER[v.tier]
    let best: ArenaMove | null = null, bs = -1
    for (const m of dmg) {
      const s = m.power
        * getEffectiveness(m.element, v.targetElement)
        * (1 - j / 2 + rng() * j)
      if (s > bs) { bs = s; best = m }
    }
    return best
  }
  // 4) nothing but status left — cast it if it still does something
  const status = ready.filter(m => !selfBuffMaxed(m, v))
  return status[0] ?? null
}

function selfBuffMaxed(m: ArenaMove, v: ChooserView): boolean {
  if (!m.statChanges || m.power > 0 || m.effect) return false
  const selfOnly = m.statChanges.every(c => c.target === 'self')
  if (!selfOnly) return false
  // every stat this buff raises is already at +2 or better → skip it
  return m.statChanges.every(c => (v.stages[c.stat as keyof StageState] ?? 0) >= 2)
}

// ── hit resolution helpers ──────────────────────────────────────────────────────
/** Chance for attacker (agi a) to land on defender (effective agi d). Anchored foes can't dodge. */
export function hitChance(accuracy: number, atkAgi: number, defAgi: number, defAnchored: boolean): number {
  if (defAnchored) return 1
  const p = accuracy / 100 + (atkAgi - defAgi) * DODGE_AGI_SLOPE
  return Math.max(HIT_FLOOR, Math.min(HIT_CEIL, p))
}

/** Raw pre-guard damage for a move at sim-time `t` (past TIRE_AT the ramp kicks in — spirits tire, no stall-fests). */
export function moveDamage(atk: number, pwrStage: number, m: ArenaMove, atkElement: BattleElement, defElement: BattleElement, t: number): { base: number; eff: number; label: 'super' | 'weak' | 'neutral' } {
  const eff = getEffectiveness(m.element, defElement)
  const stab = hasSTAB(atkElement, m.element) ? STAB_MULT : 1
  const tire = 1 + Math.max(0, t - TIRE_AT) * TIRE_RAMP
  const base = atk * (m.power / 100) * DMG_SCALE * eff * stab * stageMult(pwrStage) * tire
  return { base, eff, label: effectivenessLabel(eff) }
}

export { getEffectiveness, effectivenessLabel, hasSTAB, toBattleElement }
export type { MoveState, StatusId, BattleElement }
