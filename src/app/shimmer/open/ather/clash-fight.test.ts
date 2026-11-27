// BETA M233 CLASH v2b: the live auto-battle engine (clash-fight.ts). Run: npx tsx src/app/shimmer/open/ather/clash-fight.test.ts
import { readFileSync } from 'node:fs'
import {
  createFight, step, cheer, runFight, tentEntrant, knownMoves, defaultBonded, bondedMove, clashMoveOf, twisted,
  TICK_HZ, DT, MELEE, CHEER_HEAL, MAX_S, CLOSE_SLACK, RING, KIND, DEFENSE, TWIST_MAX,
  type FightState, type Fighter, type FightEvent,
} from './clash-fight'
import { ALL_MOVES } from '../../engine/moves'
import { CLASH_SPECIES } from './fair-clash'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const fox = () => tentEntrant('fox', 'base', 'easy'), rabbit = () => tentEntrant('rabbit', 'base', 'easy')
/** a quiet fight: both stand still, read nothing, every cooldown parked, so one action can be tested alone */
function quiet(a = fox(), b = rabbit(), seed = 7): FightState {
  const s = createFight(a, b, seed)
  for (const f of s.f) { f._.read = 0; f.cd = { melee: 999, bonded: 999, defense: 999 }; f._.nextDecide = 1e9 }
  return s
}
const place = (f: Fighter, x: number, z = 0) => { f.x = x; f.z = z }
/** start an attack on fighter `side` that releases on the next tick */
const release = (s: FightState, side: 0 | 1, kind: 'melee' | 'bonded') => {
  const dur = kind === 'melee' ? MELEE.windup : s.f[side]._.bonded.windup
  s.f[side].act = { kind, phase: 'windup', t: dur - DT / 2, dur }
  s.f[1 - side].act = { kind: 'guard', phase: 'recover', t: 0, dur: 99 }   // the foe holds still (recover is not a block)
}
const evs = (log: { ev: FightEvent[] }) => log.ev

// ── the clock ──
ok(TICK_HZ === 20 && Math.abs(DT - 0.05) < 1e-12, 'fixed 20 Hz tick')

// ── MELEE: needs close range ──
{
  const s = quiet(); place(s.f[0], 0); place(s.f[1], MELEE.range - 0.2)
  release(s, 0, 'melee'); const hp = s.f[1].hp
  const l = step(s)
  ok(evs(l).some(e => e.kind === 'hit' && e.move === 'melee' && e.side === 0), 'melee in range: a hit event')
  ok(s.f[1].hp < hp, 'melee in range: the foe loses HP')
  ok(s.f[0].act.kind === 'melee' && s.f[0].act.phase === 'recover', 'after the hit: recover phase')
  ok(s.f[0].cd.melee > 0, 'melee goes on cooldown')
}
{
  const s = quiet(); place(s.f[0], -3); place(s.f[1], -3 + MELEE.range + CLOSE_SLACK + 0.3)
  release(s, 0, 'melee'); const hp = s.f[1].hp
  const l = step(s)
  ok(evs(l).some(e => e.kind === 'miss' && e.move === 'melee'), 'melee out of range: a miss')
  ok(s.f[1].hp === hp, 'melee out of range: no damage')
}

// ── BONDED: the keeper's pick (an INPUT: move id + twist), table keyed by move id ──
{
  const k = knownMoves('fox', 'base', 12)
  ok(k.length >= 3, 'a Lv12 fox knows the born pair and her species moves')
  ok(k.every(m => m.element === 'neutral'), 'canon: a base form carries no element move (all raw/neutral)')
  ok(knownMoves('fox', 'storm', 40).some(m => m.element !== 'neutral'), 'an evolved form throws real elements')
  ok(!knownMoves('fox', 'storm', 40).some(m => m.id === 'thunder_kit_rush'), 'the retired Bond signature is not a known move')
  const d = defaultBonded('fox', 'base', 12)
  ok(d.twist === 0 && d.id !== 'mana_pulse' && d.id !== 'spirit_ward' && k.some(m => m.id === d.id), `unset bonded = her first species move, no twist (${d.id})`)
  ok(bondedMove('fox', 'base', 12, { id: 'mana_pulse', twist: 0 }).id === 'mana_pulse', 'a set bonded move she knows is used')
  ok(bondedMove('fox', 'base', 12, { id: 'hydro_press', twist: 3 }).id === d.id, 'a bonded move she does NOT know falls back to the default')
  ok(bondedMove('fox', 'base', 12, { id: 'hydro_press', twist: 3 }).windup === clashMoveOf(k.find(m => m.id === d.id)!).windup, '...with no twist')
  for (const sp of CLASH_SPECIES) ok(!!defaultBonded(sp, 'base', 12).id && !!defaultBonded(sp, 'water', 40).id, `${sp}: a default bonded move at both tent levels`)
  // the twist: never more damage
  const m0 = clashMoveOf(ALL_MOVES['mana_shard'])
  for (let t = 0; t <= TWIST_MAX + 2; t++) ok(twisted(m0, t).power === m0.power, `twist ${t} never adds damage`)
  ok(twisted(m0, 1).windup < m0.windup, 'twist 1: a quicker wind-up')
  ok(twisted(m0, 2).range > m0.range, 'twist 2: longer reach')
  const vd = clashMoveOf(ALL_MOVES['vapor_drain'])
  ok(vd.riderChance < 1 && twisted(vd, 3).riderChance === 1, 'twist 3: the rider always lands')
  // ranged moves pay for reach
  const close = clashMoveOf(ALL_MOVES['mana_shard']), far = clashMoveOf(ALL_MOVES['aqua_stream'])
  ok(far.range > close.range && far.power < ALL_MOVES['aqua_stream'].power, 'a far move hits softer than its listed power')
}
{
  const s = quiet(tentEntrant('fox', 'base', 'easy', { id: 'mana_pulse', twist: 0 }))
  ok(s.f[0]._.bonded.id === 'mana_pulse', 'the entrant\'s bonded input reaches the fighter')
  place(s.f[0], 0); place(s.f[1], 1.2); release(s, 0, 'bonded'); const hp = s.f[1].hp
  const l = step(s)
  ok(evs(l).some(e => e.kind === 'hit' && e.move === 'bonded' && e.moveId === 'mana_pulse'), 'bonded in range: a hit carrying its move id')
  ok(s.f[1].hp < hp && s.f[0].cd.bonded > 0, 'bonded: damage + cooldown')
}
{
  const s = quiet(tentEntrant('axolotl', 'base', 'easy', { id: 'aqua_stream', twist: 0 }))
  const r = s.f[0]._.bonded.range
  place(s.f[0], -3); place(s.f[1], -3 + r + 0.6); release(s, 0, 'bonded')
  ok(evs(step(s)).some(e => e.kind === 'miss'), 'a ranged move gets no close-strike slack: past its reach = a miss')
  const s2 = quiet(tentEntrant('axolotl', 'base', 'easy', { id: 'aqua_stream', twist: 2 }))
  place(s2.f[0], -3); place(s2.f[1], -3 + r + 0.6); release(s2, 0, 'bonded')
  ok(evs(step(s2)).some(e => e.kind === 'hit'), 'twist 2 reach: the same distance now lands')
}

// ── EVADE / GUARD: one per kind; a read of the foe's wind-up ──
ok(CLASH_SPECIES.every(sp => KIND[sp].defense === 'evade' || KIND[sp].defense === 'guard'), 'every species has evade OR guard')
ok(CLASH_SPECIES.some(sp => KIND[sp].defense === 'evade') && CLASH_SPECIES.some(sp => KIND[sp].defense === 'guard'), 'both defenses are in play')
{
  // evade: the fox reads the rabbit's melee wind-up and dashes; the strike finds no one
  const s = quiet(rabbit(), fox()); place(s.f[0], 0); place(s.f[1], 1.2)
  s.f[1]._.read = 1; s.f[1].cd.defense = 0
  s.f[0].act = { kind: 'melee', phase: 'windup', t: 0, dur: MELEE.windup }
  const all: FightEvent[] = []
  for (let i = 0; i < 12; i++) all.push(...step(s).ev)
  ok(all.some(e => e.kind === 'start' && e.side === 1 && e.move === 'evade'), 'evade: she answers a read wind-up with a dash')
  ok(all.some(e => e.kind === 'evaded' || e.kind === 'miss') && !all.some(e => e.kind === 'hit' && e.side === 0), 'evade: the read strike does not land')
  ok(s.f[1].cd.defense > 0, 'evade goes on cooldown')
}
{
  // the evade's moment of no-hit: in reach, but mid-dash, the strike passes through
  const s = quiet(); place(s.f[0], 0); place(s.f[1], 1.2); release(s, 0, 'melee'); s.f[1].iframeT = 0.2
  const hp = s.f[1].hp; const l = step(s)
  ok(l.ev.some(e => e.kind === 'evaded') && s.f[1].hp === hp, 'evade i-frames: an in-reach strike is evaded, no damage')
}
{
  // guard: the rabbit guards the fox's strike; it lands for much less
  const raw = quiet(); place(raw.f[0], 0); place(raw.f[1], 1.2); raw.rng = 1; release(raw, 0, 'melee')
  const h0 = raw.f[1].hp; step(raw); const full = h0 - raw.f[1].hp
  const s = quiet(); place(s.f[0], 0); place(s.f[1], 1.2); s.rng = 1
  s.f[0].act = { kind: 'melee', phase: 'windup', t: MELEE.windup - DT / 2, dur: MELEE.windup }
  s.f[1].act = { kind: 'guard', phase: 'active', t: 0, dur: DEFENSE.guard.time }
  const h1 = s.f[1].hp; const l = step(s); const cut = h1 - s.f[1].hp
  ok(evs(l).some(e => e.kind === 'guarded'), 'guard: a guarded event')
  ok(cut > 0 && cut < full * 0.5, `guard: most of the hit turned (${cut} of ${full})`)
}
{
  // no read without a wind-up in reach, and a read is made once per foe action
  const s = quiet(rabbit(), fox()); place(s.f[0], -5); place(s.f[1], 5)
  s.f[1]._.read = 1; s.f[1].cd.defense = 0
  s.f[0].act = { kind: 'melee', phase: 'windup', t: 0, dur: MELEE.windup }
  const l = step(s)
  ok(!l.ev.some(e => e.move === 'evade'), 'a wind-up out of reach is not answered')
}

// ── REPOSITION: close in / back off toward her kind's range ──
{
  const s = createFight(tentEntrant('water-bear', 'base', 'easy'), tentEntrant('owl', 'base', 'easy'), 3)
  for (const f of s.f) { f._.read = 0; f.cd = { melee: 999, bonded: 999, defense: 999 } }
  place(s.f[0], -6); place(s.f[1], 6)
  const d0 = Math.hypot(s.f[1].x - s.f[0].x, s.f[1].z - s.f[0].z)
  for (let i = 0; i < 40; i++) step(s)
  const d1 = Math.hypot(s.f[1].x - s.f[0].x, s.f[1].z - s.f[0].z)
  ok(d1 < d0 - 2, `reposition: far apart, they close in (${d0.toFixed(1)} -> ${d1.toFixed(1)})`)
  for (let i = 0; i < 400; i++) step(s)
  ok(s.f.every(f => Math.hypot(f.x, f.z) <= RING.r + 1e-9), 'nobody leaves the ring')
}
{
  const s = createFight(tentEntrant('owl', 'base', 'easy', { id: 'bolt_rush', twist: 0 }), tentEntrant('water-bear', 'base', 'easy'), 3)   // a FAR move: a drawn near one stands her in (stanceOf)
  for (const f of s.f) { f._.read = 0; f.cd = { melee: 999, bonded: 999, defense: 999 } }
  place(s.f[0], 0); place(s.f[1], 1.1); s.f[1].act = { kind: 'guard', phase: 'recover', t: 0, dur: 99 }
  for (let i = 0; i < 20; i++) step(s)
  const d = Math.hypot(s.f[1].x - s.f[0].x, s.f[1].z - s.f[0].z)
  ok(d > 2.5, `reposition: a far kind backs off to her range (${d.toFixed(1)} m)`)
}

// ── CHEER: once per match, +20% max HP, capped ──
{
  const s = quiet(); const f = s.f[0]
  f.hp = Math.round(f.maxHp * 0.3)
  const before = f.hp
  ok(cheer(s, 0) === true, 'first cheer is taken')
  ok(f.hp === Math.min(f.maxHp, before + Math.round(f.maxHp * CHEER_HEAL)), 'cheer heals 20% of max HP')
  ok(f.cheered, 'cheer is marked spent')
  const mid = f.hp
  ok(cheer(s, 0) === false && f.hp === mid, 'a second cheer does nothing')
  ok(cheer(s, 1) === true, 'each side has its own cheer')
  f.hp = f.maxHp - 1; s.f[1].cheered = false; s.f[1].hp = s.f[1].maxHp - 1
  cheer(s, 1); ok(s.f[1].hp === s.f[1].maxHp, 'cheer never overheals')
  const ev = step(s, { cheer: [true, true] }).ev
  ok(!ev.some(e => e.kind === 'cheer'), 'a cheer pressed in step after it is spent: no event')
  const s2 = quiet(); s2.f[1].hp = 0; ok(cheer(s2, 1) === false, 'no cheer for a downed spirit')
  const s3 = quiet(); const l = step(s3, { cheer: [true, false] })
  ok(l.ev.some(e => e.kind === 'cheer' && e.side === 0), 'step input: a cheer event in the tick log')
}

// ── DETERMINISM ──
{
  const a = runFight(fox(), rabbit(), 42, { keepLog: true, cheer: [{ at: 0.3 }, { at: 0.3 }] })
  const b = runFight(fox(), rabbit(), 42, { keepLog: true, cheer: [{ at: 0.3 }, { at: 0.3 }] })
  ok(JSON.stringify(a.log) === JSON.stringify(b.log), 'same entrants + seed + cheers = the same fight, tick for tick')
  const c = runFight(fox(), rabbit(), 43, { keepLog: true })
  ok(JSON.stringify(a.log) !== JSON.stringify(c.log), 'a different seed plays a different fight')
  // the log the renderer plays
  const l0 = a.log[0]
  ok(l0.f.length === 2 && ['x', 'z', 'face', 'hp', 'maxHp', 'act', 'phase'].every(k => k in l0.f[0]), 'each tick logs both fighters: position, facing, HP, action + phase')
  ok(a.log.some(l => l.f.some(f => f.phase === 'windup')), 'wind-ups are visible in the log')
  ok(a.log.some(l => l.ev.some(e => e.kind === 'start')) && a.log.some(l => l.ev.some(e => e.kind === 'hit')), 'move starts and hits are logged')
  ok(a.log[a.log.length - 1].ev.some(e => e.kind === 'end'), 'the last tick carries the end')
  ok(a.seconds <= MAX_S && (a.reason === 'ko' || a.reason === 'time'), 'a fight ends')
  ok(a.log.length === Math.round(a.seconds * TICK_HZ), 'one log per tick')
  ok(a.log.filter(l => l.ev.some(e => e.kind === 'cheer' && e.side === 0)).length <= 1, 'the sim keeper cheers at most once')
}

// ── a library the renderer can import ──
{
  const src = readFileSync(new URL('./clash-fight.ts', import.meta.url), 'utf8')
  ok(!/from ['"](react|three)/.test(src), 'no React, no three')
  ok(!/Math\.random/.test(src.replace(/^\s*\/\/.*$/gm, '')), 'no Math.random: every roll is the seeded generator')
  ok(!/PartyBattleScene|calcPartyDamage/.test(src.replace(/^\s*\/\/.*$/gm, '')), 'not built on the turn-based battle')
}

console.log(`clash-fight.test: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
