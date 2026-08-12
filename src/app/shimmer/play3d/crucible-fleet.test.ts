// Crucible-fleet oracle — sixty brains that have to stay in lockstep.
// Run: npx tsx src/app/shimmer/play3d/crucible-fleet.test.ts
//
// `fillRoster` is deterministic and `stepHunter` is deterministic given its rng. This file is where
// both guarantees can be silently thrown away, in two ways that look identical to a working match
// on the client that wrote them:
//   - A SHARED rng stream. Then a bot's draws depend on the order every other bot drew in, and
//     order is exactly what diverges when one client drops a frame.
//   - ORDER-DEPENDENT targeting. Squads spawn on a ring, so mirrored distances are the NORMAL case
//     at the opening convergence — a tie broken by iteration order forks the match immediately.
// Both are asserted, and both are mutation-verified.

import { fillRoster, type HumanEntry } from './crucible-bots'
import { createFleet, stepFleet, pickTarget, aliveCount, type FleetTarget } from './crucible-fleet'
import { type HunterCtx } from '../engine/hunter-ai'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const HUMANS: HumanEntry[] = [{ id: 'p1', name: 'Alex' }]
const ctx = (): HunterCtx => ({
  targetX: 0, targetZ: 0, blocked: () => false, rng: () => 0.5,
  fallbackX: 0, fallbackZ: 0, rooted: false, disarmed: false,
})
const DT = 1 / 60

// ── the fleet covers the bots and only the bots ──────────────────────────────────────────────
{
  const roster = fillRoster(HUMANS, 7)
  const fleet = createFleet(roster, 7)
  ok(fleet.members.length === roster.bots, 'every bot gets a brain')
  ok(fleet.members.every((m) => m.challenger.bot), 'and no human does — they have a player')
  ok(roster.humans === 1 && roster.bots === 59, 'fixture: one human, fifty-nine bots')
  ok(fleet.members.every((m) => !m.state.alive), 'nobody starts placed — the host decides where "out" is')
}

// ── ★ DETERMINISM ────────────────────────────────────────────────────────────────────────────
{
  const run = () => {
    const fleet = createFleet(fillRoster(HUMANS, 7), 7)
    const c = ctx()
    const bodies: FleetTarget[] = fleet.members.map((m, i) => ({
      x: Math.cos(i) * 20, z: Math.sin(i) * 20, squad: m.challenger.squad, alive: true, index: m.index,
    }))
    const trace: number[] = []
    for (let t = 0; t < 60; t++) {
      stepFleet(fleet, bodies, c, DT)
      for (const m of fleet.members) trace.push(m.state.x, m.state.z)
    }
    return trace
  }
  const a = run(), b = run()
  ok(a.length === b.length && a.every((v, i) => v === b[i]),
     '★ same seed ⇒ byte-identical fleet trace (sixty bots, sixty ticks)')
}
{
  // ★ THE ONE THAT CATCHES A SHARED STREAM. Two bots must not walk the same walk, and — more
  // subtly — stepping a bot must not depend on how many bots were stepped before it.
  const fleet = createFleet(fillRoster(HUMANS, 7), 7)
  const c = ctx()
  const bodies: FleetTarget[] = [{ x: 0, z: 0, squad: -1, alive: true, index: -1 }]
  for (let t = 0; t < 30; t++) stepFleet(fleet, bodies, c, DT)
  const spots = new Set(fleet.members.map((m) => `${m.state.x.toFixed(4)},${m.state.z.toFixed(4)}`))
  ok(spots.size > fleet.members.length * 0.9,
     '★ bots do not stack — each has its own stream, so each spawns and orbits its own way')
}
{
  // Stepping one member alone must give the same result as stepping it inside the fleet.
  const full = createFleet(fillRoster(HUMANS, 7), 7)
  const solo = createFleet(fillRoster(HUMANS, 7), 7)
  const c = ctx()
  const bodies: FleetTarget[] = [{ x: 0, z: 0, squad: -1, alive: true, index: -1 }]
  for (let t = 0; t < 20; t++) stepFleet(full, bodies, c, DT)
  // step ONLY the last member, by hiding the rest behind a fleet of one
  const lastIdx = solo.members.length - 1
  const one = { members: [solo.members[lastIdx]], seed: solo.seed }
  for (let t = 0; t < 20; t++) stepFleet(one, bodies, c, DT)
  const A = full.members[lastIdx].state, B = one.members[0].state
  ok(A.x === B.x && A.z === B.z,
     '★ a bot steps identically alone or in a crowd — no member reads another\'s stream')
}

// ── ★ targeting ──────────────────────────────────────────────────────────────────────────────
{
  const fleet = createFleet(fillRoster(HUMANS, 7), 7)
  const me = fleet.members[0]
  me.state.x = 0; me.state.z = 0
  const mate: FleetTarget = { x: 1, z: 0, squad: me.challenger.squad, alive: true, index: 999 }
  const foe: FleetTarget = { x: 10, z: 0, squad: (me.challenger.squad + 1) % 20, alive: true, index: 998 }
  ok(pickTarget(me, [mate, foe])?.index === 998, '★ it fights the far stranger, never the near squadmate')
  ok(pickTarget(me, [mate])===null, 'a squad alone on the floor has nobody to fight')

  const dead: FleetTarget = { ...foe, index: 997, x: 2, alive: false }
  ok(pickTarget(me, [dead, foe])?.index === 998, 'it does not aim at the dead')

  const player: FleetTarget = { x: 3, z: 0, squad: -1, alive: true, index: -1 }
  ok(pickTarget(me, [player, foe])?.index === -1, 'the player is nobody\'s squadmate and is fair game')
}
{
  // ★ Mirrored distances are the NORMAL case on a spawn ring, not an edge.
  const fleet = createFleet(fillRoster(HUMANS, 7), 7)
  const me = fleet.members[0]
  me.state.x = 0; me.state.z = 0
  const other = (me.challenger.squad + 1) % 20
  const left: FleetTarget = { x: -5, z: 0, squad: other, alive: true, index: 500 }
  const right: FleetTarget = { x: 5, z: 0, squad: other, alive: true, index: 400 }
  ok(pickTarget(me, [left, right])?.index === 400, '★ an exact tie breaks on index...')
  ok(pickTarget(me, [right, left])?.index === 400, '★ ...and gives the SAME answer whichever order they arrive in')
}

// ── a thinning arena ─────────────────────────────────────────────────────────────────────────
{
  const fleet = createFleet(fillRoster(HUMANS, 7), 7)
  ok(aliveCount(fleet) === 0, 'nobody is alive before the first tick')
  const c = ctx()
  stepFleet(fleet, [{ x: 0, z: 0, squad: -1, alive: true, index: -1 }], c, DT)
  ok(aliveCount(fleet) === fleet.members.length, 'they all arrive on the first tick')

  // A bot with nobody left to fight must keep ticking, not freeze.
  const lone = fleet.members[0]
  const before = lone.state.strafe
  for (let t = 0; t < 30; t++) stepFleet({ members: [lone], seed: 7 }, [], c, DT)
  ok(lone.state.strafe > before, 'a bot with nobody to fight keeps its clocks running rather than hanging')
}

console.log(`\ncrucible-fleet: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
