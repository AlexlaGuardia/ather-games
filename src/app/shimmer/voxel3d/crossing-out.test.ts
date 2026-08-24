// The crossing-out oracle. Run: npx tsx src/app/shimmer/voxel3d/crossing-out.test.ts
//
// Two claims, and they fail in opposite directions. A crossing that reports itself READY while
// nothing is painted sends a keeper into a town with no anchor. A crossing that reports itself
// unbuilt after the brush lands is a stale refusal nobody will think to go and clear — which is
// the failure this module is shaped to make impossible, since it asks the map rather than a flag.

import { ALL_ZONES } from '../world/all-zones'
import { getZone, gateFootprint, type Gate, type Zone } from '../world/zones'
import {
  LANDING_ZONE, LANDING_LABEL, ARRIVAL_KEY,
  landingGate, crossingReady, arrivalBlockedBy, packArrival,
} from './crossing-out'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const town = getZone(ALL_ZONES, LANDING_ZONE)
ok(!!town, 'the far end is a real shipped zone, not a dev instrument')
const gates: Gate[] = (town as (Zone & { gates?: Gate[] }) | undefined)?.gates ?? []
ok(gates.length > 0, `the town has doors to reason about (${gates.length})`)

// ── 1. readiness is read off the MAP, and tracks it in BOTH directions ───────────────────────
{
  const painted = landingGate() !== null
  ok(crossingReady() === painted, 'readiness agrees with whether a landing is painted')
  console.log(`  (landing ${painted ? 'IS painted — the crossing is live' : 'is NOT painted yet — #731, one brush stroke'})`)

  // ★ THE ASSERT THAT MATTERS IS THE SYNTHETIC ONE, because today's answer is "not painted" and a
  // test that only ever sees that answer cannot tell a working check from `return false`.
  const fake: Zone[] = [{ ...(town as Zone), gates: [...gates, { x: 4, y: 4, w: 1, h: 2, toZone: 'x', toX: 1, toY: 1, label: LANDING_LABEL }] } as Zone]
  ok(crossingReady(fake), 'paint a landing and the crossing turns itself on — no flag to flip')
  ok(landingGate(fake)?.label === LANDING_LABEL, 'and it is found by LABEL, the way the map editor names it')

  const unpainted: Zone[] = [{ ...(town as Zone), gates: gates.filter(g => g.label.toUpperCase() !== LANDING_LABEL) } as Zone]
  ok(!crossingReady(unpainted), 'unpaint it and the refusal comes back on its own')
}

// ── 2. an arrival may never be placed on a gate — it would bounce straight back ───────────────
{
  let checked = 0
  for (const g of gates) {
    const { w, h } = gateFootprint(g)
    ok(arrivalBlockedBy(g.x, g.y) !== null, `the top-left of ${g.label} is refused as an arrival`)
    ok(arrivalBlockedBy(g.x + w - 1, g.y + h - 1) !== null, `the far corner of ${g.label} is refused too`)
    checked++
  }
  ok(checked > 2, `every door in the square is checked (${checked})`)

  // ⚠ AND THE NEGATIVE HALF, or this is just a function that always says "blocked". A tile with no
  // gate on it must come back clear — otherwise the guard refuses every anchor Alex could pick and
  // reads as "the square has nowhere to stand".
  const far = { x: 0, y: 0 }
  ok(arrivalBlockedBy(far.x, far.y) === null || gates.some(g => g.x === 0 && g.y === 0),
     'a tile with no door on it is allowed')

  // ★ NON-SQUARE FOOTPRINTS ARE THE POINT: the landing is 1×2, the first on the map. A reader that
  // assumed `size ?? 2` would clear the second tile of it, and the keeper would bounce on arrival.
  const tall: Gate = { x: 40, y: 40, w: 1, h: 2, toZone: 'x', toX: 1, toY: 1, label: 'TALL' }
  const zt: Zone[] = [{ ...(town as Zone), gates: [tall] } as Zone]
  ok(arrivalBlockedBy(40, 41, zt) !== null, 'the SECOND tile of a 1×2 gate is inside it')
  ok(arrivalBlockedBy(41, 40, zt) === null, '…and the tile beside it is not')
}

// ── 3. the payload refuses rather than shipping a bouncing anchor ────────────────────────────
{
  const g = gates[0]
  const { w, h } = gateFootprint(g)
  ok(packArrival(g, g.x, g.y) === null, 'packing an arrival ON a door returns null, not a payload')
  const clear = packArrival(g, g.x + w + 3, g.y + h + 3)
  if (clear) {
    ok(clear.zone === LANDING_ZONE, 'the payload names the town')
    ok(clear.via === g.label, 'the payload records which door was used, so the far side need not guess')
    ok(Number.isInteger(clear.x) && Number.isInteger(clear.y), 'tile coordinates are whole tiles')
  } else {
    ok(false, 'a clear tile should pack (the probe tile landed on another door — widen it)')
  }
  ok(ARRIVAL_KEY.startsWith('ather:'), 'the handoff key is namespaced like the one already in the tree')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the door knows whether it opens — ${pass} passed`)
