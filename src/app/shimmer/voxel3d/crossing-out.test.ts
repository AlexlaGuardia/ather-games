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
  landingGate, crossingReady, arrivalBlockedBy, packArrival, depart,
} from './crossing-out'
import { consumeArrival, arrivalFor, type Store } from '../engine/crossing'
import { LANDING_ARRIVAL } from '../world/landing'

/** The landing exactly as Alex will paint it: 1×2, the map's first non-square gate. */
const LANDING: Gate = { x: 4, y: 4, w: 1, h: 2, toZone: 'x', toX: 1, toY: 1, label: LANDING_LABEL }

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
  const fake: Zone[] = [{ ...(town as Zone), gates: [...gates, LANDING] } as Zone]
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

// ── 4. THE DEPARTURE, END TO END, AND WATCHING EVERY WRITE ───────────────────────────────────
// ★ THE ATHER-SIDE HALF OF THE CROSSING FIXTURE. The hub's `crossing.test.ts` proves the contract
// in isolation; this proves that MY side actually obeys it — a module and its consumer separated
// by a gate, asserted through the gate rather than around it. `Store` is a three-method interface
// on purpose, so a Map is a valid store and none of this needs a browser.
{
  const ops: string[] = []
  const mem = new Map<string, string>()
  const store: Store = {
    getItem: k => { ops.push(`get ${k}`); return mem.get(k) ?? null },
    setItem: (k, v) => { ops.push(`set ${k}`); mem.set(k, v) },
    removeItem: k => { ops.push(`rm ${k}`); mem.delete(k) },
  }
  const painted: Zone[] = [{ ...(town as Zone), gates: [...gates, LANDING] } as Zone]

  // (a) unpainted — the refusal must still be reachable, and it must write nothing at all.
  //
  // ⚠ RE-AIMED 2026-09-03, AND WHICH KIND OF RED THIS WAS IS THE WHOLE NOTE. This case used to
  // call `depart(store, ...)` with the DEFAULT zones and lean on the shipped map having no landing.
  // THE LANDING is painted now, so the default answers 'blocked' instead of 'unpainted' and the
  // assert went red — **a location that expired, not an assertion that was wrong.** The refusal
  // path is not dead code the day it stops being the shipped state: unpaint the door and it is the
  // shipped state again. So it moves onto a synthetic unpainted town, where it cannot expire twice.
  ops.length = 0
  const bare: Zone[] = [{ ...(town as Zone), gates: gates.filter(g => g.label.toUpperCase() !== LANDING_LABEL) } as Zone]
  const cold = depart(store, { x: 20, y: 20 }, bare)
  ok('refused' in cold && cold.refused === 'unpainted', 'with no landing painted, the gate refuses by name')
  ok(ops.filter(o => !o.startsWith('get')).length === 0, `a refused departure writes NOTHING (${ops.join(',')})`)

  // ★ AND THE OTHER HALF, WHICH ONLY BECAME ASSERTABLE TODAY: on the SHIPPED map the departure
  // now succeeds. Without this the suite would still pass if painting the landing had done nothing.
  ops.length = 0
  const live = depart(store, LANDING_ARRIVAL)
  ok(!('refused' in live), `the shipped map departs for real (${JSON.stringify(live)})`)
  ok('staged' in live && live.staged.zone === LANDING_ZONE
     && live.staged.x === LANDING_ARRIVAL.x && live.staged.y === LANDING_ARRIVAL.y,
     'and it stages the anchor beside the door, not the door')

  // (b) painted but the anchor bounces — refused, and again nothing is written.
  ops.length = 0
  const onDoor = depart(store, { x: LANDING.x, y: LANDING.y }, painted)
  ok('refused' in onDoor && onDoor.refused === 'blocked', 'an anchor sitting on a door is refused')
  ok(ops.filter(o => !o.startsWith('get')).length === 0, `a blocked departure writes NOTHING (${ops.join(',')})`)

  // (c) a real departure — ⚠⚠ EXACTLY ONE WRITE. This is the contract's "no committed middle", and
  // it is asserted by COUNTING WRITES rather than by reading the end state: parking the keeper on
  // the Ather side as well would leave an end state that looks entirely fine, which is precisely
  // what makes a committed middle dangerous. Only the count can see it.
  ops.length = 0
  const go = depart(store, { x: 60, y: 60 }, painted)
  ok(!('refused' in go), 'a painted landing and a clear tile depart')
  const writes = ops.filter(o => !o.startsWith('get'))
  ok(writes.length === 1, `a departure performs exactly ONE write (${writes.length}: ${writes.join(',')})`)
  ok(writes[0].startsWith('set '), 'and that write is a set, never a removal')

  // (d) ★ THROUGH THE SEAM: what I stage is what the town consumes, and it knows WHY.
  if (!('refused' in go)) {
    const taken = consumeArrival(store)
    ok(!!taken && taken.zone === go.staged.zone && taken.x === go.staged.x && taken.y === go.staged.y,
       'the town consumes exactly the tile the Ather staged')
    const decided = arrivalFor(taken, null, { zone: LANDING_ZONE, x: 1, y: 1 })
    ok(decided.why === 'staged', 'and it reports it arrived BECAUSE it was staged, not by coincidence')
    // One-shot: a second load must not be re-placed.
    ok(consumeArrival(store) === null, 'the one-shot is spent — a second load is not re-placed')
    const again = arrivalFor(consumeArrival(store), null, { zone: LANDING_ZONE, x: 1, y: 1 })
    ok(again.why === 'first-visit', 'a keeper with nothing staged and no record is a first visit')
  }

  // (e) `via` must NOT cross. A field on the wire is a field the far side comes to depend on.
  ops.length = 0
  const g2 = depart(store, { x: 61, y: 61 }, painted)
  if (!('refused' in g2)) {
    const raw = mem.get([...mem.keys()][0]) ?? ''
    ok(!raw.includes('via'), `the wire payload carries only the tile (${raw})`)
    ok(g2.via.length > 0, 'while the caller still gets the door name for what it says on screen')
  }
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the door knows whether it opens — ${pass} passed`)
