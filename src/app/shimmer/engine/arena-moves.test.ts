// ── Arena movesets — headless oracle (the cinematic-battle sim pass) ────────────
// Run: npx tsx src/app/shimmer/engine/arena-moves.test.ts
//
// Proves the moveset port BEFORE the playback renderer touches it:
//   1. determinism — same seed ⇒ byte-identical event timeline (the pre-script contract)
//   2. kits load — evolved spirits fight with 4 canon moves, base forms with their 2
//   3. dodges are real and read agility — a fast evader dodges far more than a wall
//   4. the element wheel is live — the strong side of a matchup wins the mirror
//   5. cooldowns hold — no move re-fires inside its clock
//   6. statuses + telegraphs + variety — fights produce the choreography the renderer needs
//   7. pacing — evolved 1v1s land in a watchable cinematic band, and every fight resolves

import { createSpirit, type Spirit, type Species } from '../spirits/spirit'
import type { Element } from '../spirits/spirit'
import { simulate, type SimResult } from './arena'
import { kitForSpirit } from './arena-moves'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

function mk(species: Species, level: number, element: Element = 'base'): Spirit {
  const s = createSpirit(species, species, 0, 0)
  s.level = level; s.bond = 60; s.happiness = 128
  s.element = element
  return s
}

// ── 1) determinism — the whole cinematic contract rests on this ──
// NOTE: spirits must be the SAME objects across runs (createSpirit rolls random
// seeds/temperament) — which is exactly the mount's usage: pre-sim and replay share them.
{
  const ally = [mk('fox', 20, 'storm')], enemy = [mk('frog', 20, 'earth')]
  const a = simulate({ allies: ally, enemies: enemy, seed: 1337 })
  const b = simulate({ allies: ally, enemies: enemy, seed: 1337 })
  chk('same seed ⇒ same outcome', a.outcome === b.outcome)
  chk('same seed ⇒ same duration', a.duration === b.duration)
  chk('same seed ⇒ identical timeline', JSON.stringify(a.timeline) === JSON.stringify(b.timeline))
  const c = simulate({ allies: ally, enemies: enemy, seed: 7777 })
  chk('different seed ⇒ different fight', JSON.stringify(a.timeline) !== JSON.stringify(c.timeline))
}

// ── 2) kits ──
{
  chk('evolved spirit carries 4 moves', kitForSpirit(mk('fox', 30, 'storm')).length === 4)
  // Was: "base form carries its 2 starters" (length === 2). That asserted the bug — element moves
  // were gated behind evolution at lv34 while the whole shipped map bands at 2-22, so every spirit
  // in the playable game held Mana Pulse + Spirit Ward. Base spirits now learn a real kit (raw,
  // neutral-element) from lv9; the contract below is what replaced it.
  chk('base form carries a full kit by lv10', kitForSpirit(mk('fox', 10)).length === 4)
  chk('base form channels RAW — no rune, so no STAB or matchup',
    kitForSpirit(mk('fox', 20)).every(m => m.element === 'neutral'))
  chk('a freshly bloomed spirit has only the raw-mana pair', kitForSpirit(mk('fox', 3)).length === 2)
  const sig = kitForSpirit(mk('owl', 30, 'mana')).map(m => m.id)
  chk('bond-50 signature in the kit', sig.includes('oracle_sight'), sig.join(','))
}

// ── helpers over timelines ──
const count = (r: SimResult, type: string, pred: (e: any) => boolean = () => true) =>
  r.timeline.filter(f => f.e.type === type && pred(f.e)).length

// ── 3) dodges read agility — as a RATE per incoming attack (wall fights run longer,
//      so raw counts drown the signal in extra attempts) ──
{
  // the attacker must carry NO agi-touching moves for a clean read: fox MANA kit at low
  // bond = Mana Pulse / Spirit Ward / Mana Shard / Barrier — zero stat interference.
  // (First cut used fox EARTH — its Dust Blind blinded the evader to wall-speed. The
  // stages system erasing the dodge gap is a feature; this test just needs a clean lane.)
  const lowBond = (s: Spirit) => { s.bond = 10; return s }
  let evAtt = 0, evDodge = 0, waAtt = 0, waDodge = 0
  for (let i = 0; i < 40; i++) {
    // hummingbird (agi 72) and water-bear (agi 16) each get shot at by the same fox
    const h = simulate({ allies: [lowBond(mk('fox', 22, 'mana'))], enemies: [lowBond(mk('hummingbird', 22, 'storm'))], seed: i * 31 + 1 })
    const w = simulate({ allies: [lowBond(mk('fox', 22, 'mana'))], enemies: [lowBond(mk('water-bear', 22, 'earth'))], seed: i * 31 + 1 })
    evDodge += count(h, 'dodge', e => e.who.startsWith('e'))
    evAtt += count(h, 'dodge', e => e.who.startsWith('e')) + count(h, 'hit', e => e.to.startsWith('e'))
    waDodge += count(w, 'dodge', e => e.who.startsWith('e'))
    waAtt += count(w, 'dodge', e => e.who.startsWith('e')) + count(w, 'hit', e => e.to.startsWith('e'))
  }
  const evRate = evDodge / Math.max(1, evAtt), waRate = waDodge / Math.max(1, waAtt)
  chk('dodges happen at all', evDodge > 0)
  chk('fast evader dodge RATE ≥2x the wall', evRate >= waRate * 2, `evader=${(evRate * 100).toFixed(1)}% wall=${(waRate * 100).toFixed(1)}%`)
}

// ── 4) element wheel live — storm beats mana (1.5x lane) in the mirror ──
{
  let stormWins = 0
  const N = 60
  for (let i = 0; i < N; i++) {
    const r = simulate({ allies: [mk('fox', 22, 'storm')], enemies: [mk('fox', 22, 'mana')], seed: i * 977 + 5 })
    if (r.outcome === 'win') stormWins++
  }
  const pct = (stormWins / N) * 100
  chk('strong element wins the mirror (>60%)', pct > 60, `${pct.toFixed(0)}%`)
}

// ── 5) cooldowns hold ──
{
  const r = simulate({ allies: [mk('fox', 26, 'storm')], enemies: [mk('rabbit', 26, 'earth')], seed: 4242 })
  const lastStart = new Map<string, number>()
  const kit = new Map(kitForSpirit(mk('fox', 26, 'storm')).map(m => [m.id, m.cd]))
  let violations = 0
  for (const f of r.timeline) {
    if (f.e.type !== 'move_start' || f.e.who !== 'a0') continue
    const key = f.e.moveId
    const prev = lastStart.get(key)
    const cd = kit.get(key) ?? 0
    if (prev !== undefined && f.t - prev < cd - 0.05) violations++
    lastStart.set(key, f.t)
  }
  chk('no move re-fires inside its cooldown', violations === 0, `${violations} violations`)
}

// ── 6) the choreography surface: statuses, telegraphs, dodge + variety ──
{
  let statuses = 0, heavies = 0, moveIds = new Set<string>(), interrupts = 0
  for (let i = 0; i < 30; i++) {
    const r = simulate({ allies: [mk('firefly', 28, 'mana')], enemies: [mk('turtle', 28, 'water')], seed: i * 613 + 9 })
    statuses += count(r, 'status')
    heavies += count(r, 'move_start', e => e.heavy)
    for (const f of r.timeline) if (f.e.type === 'move_start') moveIds.add((f.e as any).moveId)
  }
  chk('statuses fire (ignition/regen/…)', statuses > 0)
  chk('heavies telegraph', heavies > 0)
  chk('fighters use a real spread of moves (≥5 distinct)', moveIds.size >= 5, [...moveIds].join(','))
  void interrupts
}

// ── 7) pacing — the cinematic band, and everything resolves ──
{
  const durations: number[] = []
  let unresolved = 0
  const pairs: [Species, Element, Species, Element][] = [
    ['fox', 'storm', 'frog', 'earth'], ['owl', 'mana', 'bat', 'storm'],
    ['axolotl', 'water', 'rabbit', 'earth'], ['hummingbird', 'storm', 'turtle', 'water'],
    ['firefly', 'mana', 'water-bear', 'earth'],
  ]
  for (const [as, ae, es, ee] of pairs) {
    for (let i = 0; i < 20; i++) {
      const r = simulate({ allies: [mk(as, 24, ae)], enemies: [mk(es, 24, ee)], seed: i * 271 + 3 })
      if (r.outcome === 'ongoing') unresolved++
      durations.push(r.duration)
    }
  }
  durations.sort((a, b) => a - b)
  const med = durations[Math.floor(durations.length / 2)]
  chk('every evolved 1v1 resolves', unresolved === 0, `${unresolved} hit the cap`)
  chk('median fight is a watchable length (8-50s)', med >= 8 && med <= 50, `median=${med.toFixed(1)}s`)
  console.log(`  (pacing: median ${med.toFixed(1)}s, p10 ${durations[Math.floor(durations.length * 0.1)].toFixed(1)}s, p90 ${durations[Math.floor(durations.length * 0.9)].toFixed(1)}s)`)
}

// ── 8) AI tiers — champion enemies are harder on decisions ALONE (same spirits, same stats) ──
{
  // MIRROR teams — identical species/levels/elements both sides, so the only lever
  // left is the enemy tier's decision quality. Wild-vs-wild ⇒ ~coin flip; champion
  // enemies must bend that coin.
  let wildWins = 0, champWins = 0
  const N = 60
  for (let i = 0; i < N; i++) {
    const mkSide = () => ({
      allies: [mk('fox', 22, 'storm'), mk('rabbit', 22, 'earth')],
      enemies: [mk('fox', 22, 'storm'), mk('rabbit', 22, 'earth')],
    })
    const a = mkSide()
    if (simulate({ ...a, seed: i * 131 + 7 }).outcome === 'win') wildWins++
    const b = mkSide()
    if (simulate({ ...b, seed: i * 131 + 7, enemyTier: 'champion' }).outcome === 'win') champWins++
  }
  const wPct = (wildWins / N) * 100, cPct = (champWins / N) * 100
  chk('champion tier bites (≥10pts harder than wild)', wPct - cPct >= 10, `vs wild ${wPct.toFixed(0)}% vs champion ${cPct.toFixed(0)}%`)
  console.log(`  (tiers: ally win ${wPct.toFixed(0)}% vs wild enemies, ${cPct.toFixed(0)}% vs champion — same spirits, decisions only)`)
}

if (bad) { console.error(`❌ arena-moves oracle: ${bad} failed, ${ok} passed`); process.exit(1) }
console.log(`✅ arena-moves oracle: ${ok}/${ok} — kits, determinism, dodges, element wheel, cooldowns, choreography, pacing.`)
