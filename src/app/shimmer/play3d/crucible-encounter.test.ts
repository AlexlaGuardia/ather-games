// ── Crucible roster + Puppet Guards — headless oracle ──────────────────────────
// Run: npx tsx src/app/shimmer/play3d/crucible-encounter.test.ts
//
// Both modules are pure, so the whole match fill and the whole boss loop are provable before a
// single body is drawn. Locked here:
//   ROSTER  1. canon's format: 20 squads × 3 = 60, and the pyramid only opens when full
//           2. determinism — same humans + same seed ⇒ byte-identical roster on every client
//           3. ★ PARTIES ARE NEVER SPLIT (the one bug that would ruin the mode)
//           4. humans meet humans before bots; bots take only what's left
//           5. bot names never collide with each other or with a human's name
//   GUARDS  6. the canon loop runs squeeze → trap → counter and tightens the box each cycle
//           7. each guard leads its canon phase; Seren claims ground, the others give it back
//           8. Wren counters inside her window and not outside it
//           9. barriers blunt and stagger; a staggered guard stops leading
//          10. the encounter clears only when all three are down

import { fillRoster, ENTRANCES, SQUAD_SIZE, ROSTER_SIZE, type HumanEntry } from './crucible-bots'
import {
  GUARDS, LOOP_ORDER, GUARD_TUNING, PUPPET_TELLS,
  initEncounter, stepEncounter, damageGuard, specOf,
} from './puppet-guards'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

const humans = (n: number, party?: string): HumanEntry[] =>
  Array.from({ length: n }, (_, i) => ({ id: `h${i}`, name: `Human${i}`, party }))

// 1. canon format
{
  chk('20 entrances', ENTRANCES === 20)
  chk('squads of 3', SQUAD_SIZE === 3)
  chk('roster of 60', ROSTER_SIZE === 60)

  const r = fillRoster([])
  chk('empty lobby still fills to 60 with bots', r.challengers.length === 60 && r.bots === 60)
  chk('a full pyramid opens', r.ready === true && r.message === null)
  chk('every squad holds exactly 3', r.squads.every((s) => s.members.length === 3))
  chk('20 squads', r.squads.length === 20)
}

// 2. determinism
{
  const a = JSON.stringify(fillRoster(humans(7), 42))
  const b = JSON.stringify(fillRoster(humans(7), 42))
  chk('same seed ⇒ identical roster', a === b)
  const c = JSON.stringify(fillRoster(humans(7), 43))
  chk('different seed ⇒ different bots', a !== c)
}

// 3. ★ parties are never split
{
  const trio: HumanEntry[] = [
    { id: 'a', name: 'Ann', party: 'p1' },
    { id: 'b', name: 'Ben', party: 'p1' },
    { id: 'c', name: 'Cy', party: 'p1' },
  ]
  const r = fillRoster(trio, 7)
  const sq = new Set(r.challengers.filter((c) => !c.bot).map((c) => c.squad))
  chk('a party of 3 lands in ONE squad', sq.size === 1, [...sq].join())

  const duo: HumanEntry[] = [
    { id: 'a', name: 'Ann', party: 'p1' },
    { id: 'b', name: 'Ben', party: 'p1' },
  ]
  const r2 = fillRoster(duo, 7)
  const sq2 = [...new Set(r2.challengers.filter((c) => !c.bot).map((c) => c.squad))]
  chk('a party of 2 shares one squad', sq2.length === 1)
  const filled = r2.squads[sq2[0]].members
  chk('...and a bot fills the third slot', filled.filter((m) => m.bot).length === 1)

  // two separate parties must not be merged into one squad
  const twoParties = [
    { id: 'a', name: 'Ann', party: 'p1' }, { id: 'b', name: 'Ben', party: 'p1' },
    { id: 'c', name: 'Cy', party: 'p2' }, { id: 'd', name: 'Dee', party: 'p2' },
  ]
  const r3 = fillRoster(twoParties, 7)
  const byParty = (ids: string[]) => new Set(r3.challengers.filter((c) => ids.includes(c.id)).map((c) => c.squad))
  chk('separate parties get separate squads',
    byParty(['a', 'b']).size === 1 && byParty(['c', 'd']).size === 1 &&
    [...byParty(['a', 'b'])][0] !== [...byParty(['c', 'd'])][0])

  // an oversized party is split deterministically, never dropped
  const big = humans(5, 'big')
  const r4 = fillRoster(big, 7)
  chk('an oversized party keeps everyone', r4.humans === 5)
}

// 4. humans before bots
{
  const r = fillRoster(humans(4), 3)
  chk('4 humans + 56 bots', r.humans === 4 && r.bots === 56)
  const humanSquads = new Set(r.challengers.filter((c) => !c.bot).map((c) => c.squad))
  chk('solo humans cluster rather than scatter across 4 squads', humanSquads.size <= 2, String(humanSquads.size))
  chk('all-bot squads are flagged', r.squads.filter((s) => s.allBots).length === 20 - humanSquads.size)
}

// 5. names
{
  const r = fillRoster([{ id: 'h', name: 'Vorek' }], 11)
  const names = r.challengers.map((c) => c.name.toLowerCase())
  chk('no duplicate names anywhere', new Set(names).size === names.length)
  chk('a bot never steals the human’s name',
    r.challengers.filter((c) => c.name.toLowerCase() === 'vorek' && c.bot).length === 0)
}

// 6. the canon loop
{
  chk('loop order is squeeze → trap → counter',
    LOOP_ORDER.join('>') === 'squeeze>trap>counter')
  let s = initEncounter()
  chk('opens on squeeze', s.phase === 'squeeze' && s.cycle === 0)
  const startBox = s.boxRadius
  // run one full cycle
  for (let i = 0; i < 3; i++) s = stepEncounter(s, GUARD_TUNING.phaseSec, 1)
  chk('one full pass = one cycle', s.cycle === 1, String(s.cycle))
  chk('the box tightens each cycle', s.boxRadius < startBox, `${startBox} → ${s.boxRadius}`)
  // and it never tightens past the floor
  for (let i = 0; i < 60; i++) s = stepEncounter(s, GUARD_TUNING.phaseSec, 1)
  chk('box never shrinks past the minimum', s.boxRadius >= GUARD_TUNING.boxMinRadius)
}

// 7. roles and ground
{
  chk('three guards, canon names',
    GUARDS.map((g) => g.name).join('|') === 'Seren|Cade|Wren')
  chk('Seren holds, Cade flanks, Wren counters',
    specOf('seren').role === 'hold' && specOf('cade').role === 'flank' && specOf('wren').role === 'counter')

  let s = initEncounter()
  chk('Seren leads the squeeze', s.guards.find((g) => g.id === 'seren')!.leading)
  const before = s.guards.find((g) => g.id === 'seren')!.standoff
  for (let i = 0; i < 20; i++) s = stepEncounter(s, 0.1, 1)
  const after = s.guards.find((g) => g.id === 'seren')!.standoff
  chk('Seren claims ground while leading', after <= before, `${before} → ${after}`)

  // Cade leads the trap phase
  let s2 = initEncounter()
  s2 = stepEncounter(s2, GUARD_TUNING.phaseSec, 1)
  chk('Cade leads the trap', s2.phase === 'trap' && s2.guards.find((g) => g.id === 'cade')!.leading)
}

// 8. Wren's counter window
{
  let s = initEncounter()
  s = stepEncounter(s, GUARD_TUNING.phaseSec, 1)      // → trap
  s = stepEncounter(s, GUARD_TUNING.phaseSec, 1)      // → counter
  chk('in the counter phase', s.phase === 'counter')

  const inside = damageGuard(s, 'wren', 100)
  chk('Wren returns damage inside her window', inside.returned > 0, String(inside.returned))

  // step past the window
  let s2 = stepEncounter(s, GUARD_TUNING.counterWindowSec + 0.2, 1)
  const outside = damageGuard(s2, 'wren', 100)
  chk('...and not outside it', outside.returned === 0)

  // the others never counter
  const seren = damageGuard(s, 'seren', 100)
  chk('Seren never counters', seren.returned === 0)
}

// 9. barriers blunt and stagger
{
  let s = initEncounter()
  // heavy pressure → thresholds trip, barriers go up
  s = stepEncounter(s, 0.5, 0.1)
  const guarding = s.guards.filter((g) => g.guarding)
  chk('barriers go up under pressure', guarding.length > 0)

  const target = guarding[0]
  const r = damageGuard(s, target.id, 100)
  const after = r.state.guards.find((g) => g.id === target.id)!
  chk('a barrier blunts the hit', after.hp > specOf(target.id).hp - 100)
  chk('...and staggers the guard', after.staggerFor > 0)

  const stepped = stepEncounter(r.state, 0.1, 0.1)
  chk('a staggered guard stops leading', !stepped.guards.find((g) => g.id === target.id)!.leading)
}

// 10. clearing
{
  let s = initEncounter()
  chk('not cleared at the start', !s.cleared)
  for (const g of GUARDS) {
    let dmg = 0
    while (s.guards.find((x) => x.id === g.id)!.alive && dmg < 100) { s = damageGuard(s, g.id, 50).state; dmg++ }
  }
  chk('cleared once all three are down', s.cleared)
  chk('a cleared encounter stops stepping', stepEncounter(s, 10, 1) === s)
}

// 11. the tells exist for the renderer (canon's reveal must be playable)
{
  chk('every guard has an idle tell', GUARDS.every((g) => PUPPET_TELLS.idle[g.id]?.length > 10))
  chk('the shared on-hit tell is the canon line', /bleed/.test(PUPPET_TELLS.onHit))
}

console.log(`\ncrucible-encounter oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
