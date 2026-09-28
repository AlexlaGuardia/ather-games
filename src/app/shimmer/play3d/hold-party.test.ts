/**
 * CO-OP BREACH, the sim half (2026-09-28): one Breach, up to three keepers. The flood's field has a source per
 * keeper, so each body goes for whoever is nearest by the building; strikes land on the keeper struck; every
 * keeper's room is active; a pickup is credited to whoever walked over it. ONE keeper must be the old game exactly.
 * Run: `npx tsx src/app/shimmer/play3d/hold-party.test.ts`
 */
import { parseLanding, startHold, stepHold, stepHoldParty, activeRooms, holdSpots, ownerOpenAll, type HoldState, type HoldKeeper } from './hold'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const map = parseLanding()
const spots = holdSpots(map)
const spot = (label: string) => { const s = spots.find(x => x.label === label)!; return { x: s.x, z: s.z, y: s.y } }
const roof = spot('Roof'), lobby = spot('Lobby')
const snap = (s: HoldState) => JSON.stringify({ r: s.round, f: s.flood.map(b => [b.id, b.kind, +b.x.toFixed(4), +b.z.toFixed(4), +b.y.toFixed(4), b.hp, b.phase]), p: s.planks, sal: s.salvage })

// ── A. a party of one IS the old game, frame for frame ────────────────────────────────────────────
{
  const a = startHold(map, 77), b = startHold(map, 77)
  let strikeA = 0, strikeB = 0
  for (let i = 0; i < 1500; i++) {
    strikeA += stepHold(a, 1 / 30, roof.x, roof.z, roof.y).strike
    strikeB += stepHoldParty(b, 1 / 30, [roof]).strikes[0]
  }
  ok(snap(a) === snap(b), '★★ a party of one steps exactly as stepHold (flood, planks, salvage, 50s of play)')
  ok(strikeA === strikeB && strikeA > 0, `★ and the keeper takes the same strikes (${strikeA})`)
}

// ── B. two keepers, two rooms: both rooms are active, the field has two sources ───────────────────
{
  const s = startHold(map, 5)
  ownerOpenAll(s)
  const two: HoldKeeper[] = [roof, lobby]
  stepHoldParty(s, 1 / 30, two)
  ok(s.heres.length === 2 && s.heres[0] !== s.heres[1], `each keeper's room is known (${s.heres.join(' + ')})`)
  const act = activeRooms(s)
  ok(act.has(s.heres[0]) && act.has(s.heres[1]), '★ both keepers\' rooms are active (spawns come near either)')
  const zeros = Array.from(s.field).filter(v => v === 0).length
  ok(zeros === 2, `★ the flood's field has a source at each keeper (${zeros} cells at distance 0)`)
  ok(s.fieldKey.split(',').length === 2, 'the field is rebuilt when EITHER keeper changes cell')
}

// ── C. strikes land on the keeper struck, not on the party ────────────────────────────────────────
{
  const s = startHold(map, 9)
  // one body of the flood already inside, at keeper A's elbow; keeper B two floors down
  s.flood.push({ id: 999, kind: 'drift', hp: 50, maxHp: 50, speed: 2, tearT: 0, strikeT: 0, alive: true, vx: 0, vz: 0,
    x: roof.x + 0.4, z: roof.z, y: roof.y, phase: 'inside', win: -1, vent: -1 })
  const o = stepHoldParty(s, 1 / 30, [roof, lobby])
  ok(o.strikes[0] > 0, `the keeper the body is standing at is struck (${o.strikes[0]})`)
  ok(o.strikes[1] === 0, `★ the other keeper takes nothing (${o.strikes[1]}) — damage is per keeper, never shared`)
  // and it goes for the NEAREST: the same body beside B strikes B, not A
  const t = startHold(map, 9)
  t.flood.push({ id: 998, kind: 'drift', hp: 50, maxHp: 50, speed: 2, tearT: 0, strikeT: 0, alive: true, vx: 0, vz: 0,
    x: lobby.x + 0.4, z: lobby.z, y: lobby.y, phase: 'inside', win: -1, vent: -1 })
  const o2 = stepHoldParty(t, 1 / 30, [roof, lobby])
  ok(o2.strikes[1] > 0 && o2.strikes[0] === 0, `★ a body beside keeper 2 strikes keeper 2 (${o2.strikes.join(', ')})`)
}

// ── D. a pickup is credited to whoever walked over it ─────────────────────────────────────────────
{
  const s = startHold(map, 3)
  s.drops.push({ id: 900, kind: 'glimmer', x: lobby.x, z: lobby.z, y: lobby.y, ttl: 10 })
  stepHoldParty(s, 1 / 30, [roof, lobby])
  ok(s.pickups.length === 1 && s.pickupBy[0] === 1, `★ keeper 2 stood on it, so keeper 2 took it (by ${s.pickupBy[0]})`)
  const solo = startHold(map, 3)
  solo.drops.push({ id: 901, kind: 'glimmer', x: roof.x, z: roof.z, y: roof.y, ttl: 10 })
  stepHold(solo, 1 / 30, roof.x, roof.z, roof.y)
  ok(solo.pickups.length === 1 && solo.pickupBy.length === 0, 'solo: the pickup lands as before and nothing reads an attribution')
}

// ── E. an empty party steps the world without crashing (a keeper between reconnects) ──────────────
{
  const s = startHold(map, 1)
  let threw = false
  try { for (let i = 0; i < 300; i++) stepHoldParty(s, 1 / 30, []) } catch { threw = true }
  ok(!threw, 'a party with nobody in it for a moment (all reconnecting) steps without throwing')
}

console.log(`hold-party: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
