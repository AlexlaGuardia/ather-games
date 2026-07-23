// ── Keeper's Arena — headless oracle (sim-first proof) ─────────────────────────
// Run: npx tsx src/app/shimmer/engine/arena.test.ts
//
// Renamed from arena.sim.ts (2026-07-09). It was never a scratch sim: it asserts real invariants
// and exits non-zero on failure, and it is the ONLY guard on engine/arena.ts — the live combat
// engine behind every fight in play3d (components/ArenaBattle.tsx). Its siblings
// party-battle.sim.ts and species-balance.sim.ts *were* print-only tuning reports and were deleted
// in the same pass; this one earned its .test.ts.
//
// The design thesis to prove BEFORE any renderer: the Keeper's scarce, timing-gated
// support kit is real skill expression — a good Keeper turns a losing fight. So we
// run the SAME hard matchup two ways:
//   (A) passive  — the Keeper never acts (spirits fight on instinct alone)
//   (B) skilled  — a scripted Keeper: interrupt heavy wind-ups (flash), soften a
//                  target (reach), sustain mana (breeze), panic-heal once (bag)
// If (B) wins far more than (A), the timing loop carries the game. We also assert
// hard invariants: no negative hp/mana, every fight RESOLVES (no real-time stalemate).

import { createSpirit, TEMPERAMENTS, type Spirit, type Species } from '../spirits/spirit'
import { createArena, tick, mulberry32, type ArenaState, type KeeperCommand } from './arena'
import { TIRE_AT, TIRE_RAMP } from './arena-moves'

// createSpirit() rolls IVs (seeds) and temperament off Math.random(), so until 2026-07-23
// this oracle was NOT reproducible: mulberry32 seeded the FIGHT but not the FIGHTERS, and
// the same constants scored a 33% party baseline on one run and 26.5% on the next. Every
// band here is ±6 points wide in noise, which is wide enough to pass or fail a tuning pass
// by luck — the exact trap party-balance.test.ts already avoids by pinning seeds. Roll the
// combatants off our own deterministic stream and reset it before each measurement, so we
// still sample IV variety across the 200 runs but get identical spirits every time.
let detRng = mulberry32(0x5EED)
const resetSpirits = () => { detRng = mulberry32(0x5EED) }

function mk(species: Species, level: number): Spirit {
  const s = createSpirit(species, species, 0, 0)
  s.level = level; s.bond = 60; s.happiness = 128
  s.seeds = Array.from({ length: 6 }, () => Math.floor(detRng() * 24) + 8)
  s.temperament = TEMPERAMENTS[Math.floor(detRng() * TEMPERAMENTS.length)]
  return s
}

const DT = 1 / 30
const CAP_S = 60

type Policy = (s: ArenaState, lastCmdT: number) => KeeperCommand | null

// A human Keeper can't fire 30 inputs/sec — gate scripted play to ~1 action / 0.3s.
const GATE = 0.3

const passive: Policy = () => null

const skilled: Policy = (s, lastCmdT) => {
  if (s.t - lastCmdT < GATE) return null
  const k = s.keeper
  const off = (id: 'flash' | 'breeze' | 'reach') => { const a = k.aid.find(x => x.id === id)!; return a.cdLeft <= 0 && k.mana >= a.cost }
  const ally = s.fighters.find(f => f.side === 'ally' && f.hp > 0)
  const lowAlly = s.fighters.find(f => f.side === 'ally' && f.hp > 0 && f.hp / f.maxHp < 0.3)
  // 1) a heavy move is winding up and past the reaction point → interrupt it
  const winding = s.fighters.find(f => f.side === 'enemy' && f.act?.phase === 'windup' && f.act.move.heavy && f.act.t / f.act.dur > 0.35)
  if (winding && off('flash')) return { type: 'aid', id: 'flash' }
  // 2) about to die → the one panic heal
  if (lowAlly && k.bagCdLeft <= 0) return { type: 'bag', targetId: lowAlly.id }
  // 3) sustain the kit
  if (k.mana < 4 && off('breeze')) return { type: 'aid', id: 'breeze' }
  // 4) soften the enemy so instinct-damage bites harder
  if (ally && off('reach')) return { type: 'aid', id: 'reach' }
  return null
}

interface RunResult { outcome: ArenaState['outcome']; badMana: boolean; badHp: boolean }

function runFight(seed: number, policy: Policy, allies: Spirit[], enemies: Spirit[]): RunResult {
  const s = createArena({ allies, enemies, seed })
  let lastCmdT = -1, badMana = false, badHp = false
  for (let step = 0; step < CAP_S / DT && s.outcome === 'ongoing'; step++) {
    const cmd = policy(s, lastCmdT)
    const cmds = cmd ? [cmd] : []
    if (cmd) lastCmdT = s.t
    tick(s, DT, cmds)
    if (s.keeper.mana < -1e-6) badMana = true
    if (s.fighters.some(f => f.hp < 0)) badHp = true
  }
  return { outcome: s.outcome, badMana, badHp }
}

function winRate(policy: Policy, allies: () => Spirit[], enemies: () => Spirit[], n: number) {
  resetSpirits()
  let win = 0, resolved = 0, badMana = false, badHp = false
  for (let i = 0; i < n; i++) {
    const r = runFight(i * 2654435761, policy, allies(), enemies())
    if (r.outcome === 'win') win++
    if (r.outcome !== 'ongoing') resolved++
    badMana ||= r.badMana; badHp ||= r.badHp
  }
  return { pct: (win / n) * 100, resolvedPct: (resolved / n) * 100, badMana, badHp }
}

// ── The hard matchup: your fox vs a stronger frog (high-pwr sweeper → its heavy
//    wind-up is what kills you; interrupting it is the whole game). ──
const N = 200
const allies = () => [mk('fox', 20)]
const enemies = () => [mk('frog', 24)]

console.log(`=== Keeper's Arena oracle — fox L20 vs frog L24, ${N} seeds/policy ===\n`)
const A = winRate(passive, allies, enemies, N)
const B = winRate(skilled, allies, enemies, N)
console.log(`  passive Keeper : ${A.pct.toFixed(1).padStart(5)}% win   (resolved ${A.resolvedPct.toFixed(0)}%)`)
console.log(`  skilled Keeper : ${B.pct.toFixed(1).padStart(5)}% win   (resolved ${B.resolvedPct.toFixed(0)}%)`)
console.log(`  skill delta    : ${(B.pct - A.pct >= 0 ? '+' : '')}${(B.pct - A.pct).toFixed(1)} pts\n`)

// ── PARTY scenario (matches /shimmer/arena harness): 3 allies vs 2 enemies ──
// Player-favored by design (you brought your team). Want: passive winnable (~45-65%),
// skilled clearly strong (~80%+). If passive is near 0, the party is getting AoE-wiped.
const pAllies = () => [mk('fox', 22), mk('owl', 22), mk('water-bear', 22)]
const pEnemies = () => [mk('frog', 22), mk('bat', 22), mk('rabbit', 22)]
const Ap = winRate(passive, pAllies, pEnemies, N)
const Bp = winRate(skilled, pAllies, pEnemies, N)
console.log(`=== PARTY — 3 allies vs 3 enemies, all L22, ${N} seeds/policy ===`)
console.log(`  passive Keeper : ${Ap.pct.toFixed(1).padStart(5)}% win   (resolved ${Ap.resolvedPct.toFixed(0)}%)`)
console.log(`  skilled Keeper : ${Bp.pct.toFixed(1).padStart(5)}% win   (resolved ${Bp.resolvedPct.toFixed(0)}%)\n`)

// ── PACING — fights must not drag, and levelling must LAND ─────────────────────
// Added 2026-07-23 after Alex reported skipping battles: the win-rate bands above were
// all green while a water-bear mirror ran 17-20 hits / 64s, because nothing here measured
// fight LENGTH. Worse, the drag got worse as you levelled — GRD_K was a flat constant
// while `grd` grew with level, so mitigation strengthened every level and a L50 mirror
// ran LONGER than a L5 one. Both are now asserted, so neither can come back quietly.
interface Pace { hitsToFirstKO: number; durS: number }

function pace(seed: number, allies: Spirit[], enemies: Spirit[]): Pace {
  const s = createArena({ allies, enemies, seed })
  const hitsOn: Record<string, number> = {}
  let hitsToFirstKO = 0, done = false
  for (let step = 0; step < CAP_S / DT && s.outcome === 'ongoing'; step++) {
    tick(s, DT, [])
    for (const e of s.events) {
      if (e.type === 'hit') hitsOn[e.to] = (hitsOn[e.to] ?? 0) + 1
      else if (e.type === 'ko' && !done) { done = true; hitsToFirstKO = hitsOn[e.who] ?? 0 }
    }
  }
  return { hitsToFirstKO, durS: s.t }
}

function avgPace(allies: () => Spirit[], enemies: () => Spirit[], n = 40): Pace {
  resetSpirits()
  const rs = Array.from({ length: n }, (_, i) => pace(i * 2654435761, allies(), enemies()))
  return {
    hitsToFirstKO: rs.reduce((a, p) => a + p.hitsToFirstKO, 0) / n,
    durS: rs.reduce((a, p) => a + p.durS, 0) / n,
  }
}

const wb = (lv: number) => () => [mk('water-bear', lv)]
const duelPace = avgPace(allies, enemies)
const partyPace = avgPace(pAllies, pEnemies)
const tankL5 = avgPace(wb(5), wb(5))
const tankL50 = avgPace(wb(50), wb(50))
const tankGap = avgPace(wb(20), wb(30))
const tankEven = avgPace(wb(20), wb(20))

console.log('=== PACING — hits until the first fighter falls ===')
const row = (l: string, p: Pace) => console.log(`  ${l.padEnd(24)} ${p.hitsToFirstKO.toFixed(1).padStart(5)} hits | ${p.durS.toFixed(1).padStart(5)}s`)
row('duel fox/frog', duelPace)
row('party 3v3', partyPace)
row('water-bear mirror L5', tankL5)
row('water-bear mirror L50', tankL50)
row('water-bear L20 vs L30', tankGap)
console.log()

// ── hard assertions ──
const fails: string[] = []

// Nothing should be a 15-hit slog. The tank mirror is the worst case in the game by
// design (two high-guard, high-vig bodies) — it is the ceiling, not the typical fight.
if (tankL50.hitsToFirstKO > 15) fails.push(`tank mirror drags (${tankL50.hitsToFirstKO.toFixed(1)} hits) — the slog is back`)
if (duelPace.hitsToFirstKO > 9) fails.push(`duel drags (${duelPace.hitsToFirstKO.toFixed(1)} hits)`)
// …and nothing should be over before the choreography reads. Moves telegraph and dodge;
// a 3-hit fight never shows them.
if (duelPace.hitsToFirstKO < 4) fails.push(`duel too fast (${duelPace.hitsToFirstKO.toFixed(1)} hits) — the moveset never reads`)

// Levelling must not silently change the pace of an even fight. This is the guard on
// GRD_K tracking level: if K ever goes back to a flat constant, high-level mirrors
// stretch out and this trips.
const drift = tankL50.hitsToFirstKO / tankL5.hitsToFirstKO
if (drift > 1.15 || drift < 0.85) fails.push(`levelling drifts fight length (L50 mirror is ${drift.toFixed(2)}× the L5 mirror) — mitigation is not tracking level`)

// A fight must be decided by the FIGHTERS, not by the sudden-death clock. Every band in
// this file went green on a build Alex rejected on sight — TIRE at 14s/+16% ended fights
// on schedule while damage ramped 5.2x, "almost like it forced it, with a super crit".
// Nothing here could see that, because a fight ending fast and a fight being *escalated*
// to an ending look identical in a win-rate or a hit count. So measure the ramp itself:
// by the time a normal fight resolves, tire should still be nearly invisible.
const tireAt = (durS: number) => 1 + Math.max(0, durS - TIRE_AT) * TIRE_RAMP
for (const [label, p] of [['duel', duelPace], ['party', partyPace]] as const) {
  const mult = tireAt(p.durS)
  if (mult > 1.5) fails.push(`${label} fights are being ended by the tire ramp (${mult.toFixed(2)}× damage by ${p.durS.toFixed(0)}s) — pace with HP_MULT, not TIRE`)
}

// Levelling must LAND: out-levelling something by 10 has to kill visibly faster, or
// the player's "my L6 feels the same" complaint is true again.
const gain = 1 - tankGap.hitsToFirstKO / tankEven.hitsToFirstKO
if (gain < 0.12) fails.push(`+10 levels barely matters (${(gain * 100).toFixed(0)}% fewer hits) — levelEdge is too weak to feel`)
if (A.badHp || B.badHp) fails.push('hp went negative')
if (A.badMana || B.badMana) fails.push('mana went negative')
if (A.resolvedPct < 100 || B.resolvedPct < 100) fails.push(`fights stalled (resolved A=${A.resolvedPct}% B=${B.resolvedPct}%)`)
if (A.pct > 55) fails.push(`passive too strong (${A.pct}%) — matchup isn't actually losing`)
if (B.pct - A.pct < 25) fails.push(`Keeper skill barely matters (+${(B.pct - A.pct).toFixed(1)}pts) — the timing loop is weak`)
// party balance: a fair 3v3 should be competitive at baseline (spirits fight on their own) and
// clearly won by an engaged Keeper — NOT one-sided against the player.
if (Ap.pct < 30 || Ap.pct > 68) fails.push(`party baseline off (passive ${Ap.pct}%) — want competitive ~40-60%`)
if (Bp.pct < 85) fails.push(`party Keeper too weak (skilled ${Bp.pct}%) — should reliably win`)

if (fails.length) { console.error('❌ ARENA ORACLE FAILED:\n  - ' + fails.join('\n  - ')); process.exit(1) }
console.log('✅ arena oracle: fights resolve, no negative hp/mana, and a skilled Keeper flips a losing fight.')
