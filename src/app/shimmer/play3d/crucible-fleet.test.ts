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
import { createFleet, stepFleet, pickTarget, aliveCount, botRunes, type FleetTarget } from './crucible-fleet'
import { canSlot, isBuilt, laneRunes, ALL_BANDS } from './cast'
import { KEEPER_MOVES, moveById } from './keeper-moves'
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

// ── ★★★ PREMADE LOADOUTS (row 294) ─────────────────────────────────────────────────────────────
{
  const fleet = createFleet(fillRoster([{ id: 'you', name: 'You' }], 7), 7)

  // ★ LEGAL BY CONSTRUCTION, ASSERTED THROUGH THE PLAYER'S OWN GATE. A bot's kit is only worth
  // anything if it is a kit a keeper could hold — otherwise the Crucible quietly becomes a second
  // rules engine. This asks `canSlot`, the same function the loadout menu asks, so the Lane Law and
  // the birth-exclusive band both bind a challenger exactly as they bind the player.
  const illegal: string[] = []
  for (const m of fleet.members) {
    m.loadout.forEach((id) => {
      const kind = moveById(id)?.tier
      const band = ALL_BANDS.indexOf(kind as never)
      if (band < 0 || !canSlot(botRunes(m.birth), m.birth, band, id, { learned: KEEPER_MOVES.map((k) => k.id) })) {
        illegal.push(`${m.challenger.name} (${m.birth}) → ${id}`)
      }
    })
  }
  ok(illegal.length === 0, `every bot kit is legal for a PLAYER of that birth rune — ILLEGAL: ${illegal.slice(0, 3).join(', ')}`)

  // ⚠⚠ BUILT MOVES ONLY. An unbuilt move in a player's bag is the honesty rule working — it is
  // labelled in the HUD. In a bot's hands it is a challenger that winds up and does nothing, which
  // reads as a broken fight. Measured before the filter existed: 15 of 59 held one.
  const dead = fleet.members.flatMap((m) => m.loadout.filter((id) => !isBuilt(id)))
  ok(dead.length === 0, `no challenger holds an UNBUILT move — would cast into a no-op: ${dead.slice(0, 3).join(', ')}`)

  // ★ DETERMINISM IS THIS FILE'S WHOLE CONTRACT and the kit is now part of it — a roster that
  // rebuilt with different runes per client is the desync `crucible-bots.ts` was written to avoid.
  const kit = (seed: number) => createFleet(fillRoster([{ id: 'you', name: 'You' }], seed), seed)
    .members.map((m) => `${m.birth}:${m.loadout.join(',')}`).join('|')
  ok(kit(7) === kit(7), 'same seed ⇒ same runes and same kits, every client')
  ok(kit(7) !== kit(8), 'a different seed ⇒ a different field (or the seed is not reaching the kit)')

  // A second rune is DEVELOPED ALONG A LANE — canon's ordinary path, never off-lane, which canon
  // says must be DRIVEN and is nobody's default.
  const offLane = fleet.members.filter((m) => {
    const lanes = new Set([...laneRunes(m.birth, 'element'), ...laneRunes(m.birth, 'state')])
    return botRunes(m.birth).some((r) => r !== m.birth && !lanes.has(r))
  })
  ok(offLane.length === 0, `no challenger developed OFF-lane — canon says that must be driven: ${offLane.length}`)
  ok(fleet.members.some((m) => botRunes(m.birth).length === 1), 'not every challenger developed a 2nd rune (canon: "not everyone")')
  ok(fleet.members.some((m) => botRunes(m.birth).length === 2), '...and some did, or the draw is dead')

  // ⚠ THE COVERAGE DEBT, PRINTED. Some birth runes have no BUILT castable move at all, so those
  // challengers fight with the gun alone. That is the authoring gap showing up as a real fight
  // rather than a number in a test nobody reads — it is not a regression (every bot was gun-only
  // before today) and it closes itself as moves get built. It PRINTS; it does not fail.
  const mute = [...new Set(fleet.members.filter((m) => m.loadout.length === 0).map((m) => m.birth))]
  console.log(`  · birth runes with NO castable kit: ${mute.length ? mute.join(', ') : 'none'}`)
  ok(fleet.members.some((m) => m.loadout.length > 0), '★ at least some challengers can cast at all — else row 294 shipped nothing')

  // The brain asks for a band it actually has. `castBands` is a COUNT, so an index past the end is
  // the exact bug that shape invites.
  const c: HunterCtx = {
    targetX: 0, targetZ: 0, blocked: () => false, rng: Math.random,
    fallbackX: 0, fallbackZ: 0,
  }
  let casts = 0, outOfRange = 0
  for (let t = 0; t < 60 * 60; t++) {
    for (const r of stepFleet(fleet, [{ x: 0, z: 0, squad: -1, alive: true, index: -1 }], c, DT)) {
      if (r.intent.castBand === null) continue
      casts++
      if (r.intent.castBand < 0 || r.intent.castBand >= r.member.loadout.length) outOfRange++
    }
  }
  ok(casts > 0, '★ challengers actually cast over a minute of match time — else the wiring is inert')
  ok(outOfRange === 0, `a requested band is always one the challenger holds — OUT OF RANGE: ${outOfRange}`)
}

console.log(`\ncrucible-fleet: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
