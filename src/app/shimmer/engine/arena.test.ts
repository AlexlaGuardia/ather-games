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

import { createSpirit, type Spirit, type Species } from '../spirits/spirit'
import { createArena, tick, type ArenaState, type KeeperCommand } from './arena'

function mk(species: Species, level: number): Spirit {
  const s = createSpirit(species, species, 0, 0)
  s.level = level; s.bond = 60; s.happiness = 128
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

// ── hard assertions ──
const fails: string[] = []
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
