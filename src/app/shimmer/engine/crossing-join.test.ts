/**
 * THE JOIN — the whole crossing chain, end to end.
 *
 * ★ WHY THIS FILE EXISTS, AND BOTH LANES SAID SO INDEPENDENTLY. `engine/crossing.ts` covers the
 * HANDOFF: one write, clear-before-act, no committed middle. `voxel3d/crossing-out.ts` covers the
 * DEPARTURE: is there a landing, is the anchor inside a door. `world/rune-hold-doors.test.ts`
 * covers the town's DOORS. Each is green and **nothing covered the join** — whether a keeper who
 * walks the whole chain ends up somewhere they can actually stand.
 *
 * ⚠ THAT IS THE SHAPE THAT HAS COST THIS REPO MOST: two halves internally consistent about
 * different things, both green, the seam between them unowned. A test suite that reaches only to
 * its own module boundary has the same blind spot as an oracle that calls a helper directly while
 * the game reaches it through a gate.
 *
 * ★★ AND IT RUNS AGAINST A SYNTHETIC TOWN ON PURPOSE. The real map has no landing painted yet, so
 * every question here has exactly one answer today — and a check that only ever sees one answer
 * cannot be told from `return false`. The synthetic town exercises the painted case; the real map
 * is asserted separately, for the one thing it CAN answer.
 *
 * Run: `npx tsx src/app/shimmer/engine/crossing-join.test.ts`
 */
import { consumeArrival, arrivalFor, type Store, type TilePos } from './crossing'
import { depart, landingGate, crossingReady, LANDING_ZONE, LANDING_LABEL } from '../voxel3d/crossing-out'
import { walkable } from './player'
import type { Zone } from '../world/zones'
import { SOLID } from '../world/tiles'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const mkStore = () => {
  const m = new Map<string, string>()
  const ops: string[] = []
  const store: Store = {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { ops.push(`set:${k}`); m.set(k, v) },
    removeItem: (k) => { ops.push(`del:${k}`); m.delete(k) },
  }
  return { store, ops, size: () => m.size }
}

// A 20x20 town: open floor, a wall down column 5, the landing painted at (10,10) as a 1x2, and a
// second door at (2,2) so the "inside another door" case is real rather than hypothetical.
// ⚠ THE FIXTURE'S OWN IDS ARE READ FROM `SOLID`, NOT PICKED. My first cut used `WALL = 1` because
// one looks like a wall, and `SOLID[1]` is FALSE — so the wall column was walkable, the
// walkability assert could not fail, and the join check below would have passed on a fixture that
// could never have failed it. The fixture assert caught it, which is the only reason it did not
// ship as a green that proved nothing. ★ Assert a fixture before trusting it, and derive its
// constants from the thing they must agree with.
const FLOOR = SOLID.findIndex(v => !v)
const WALL = SOLID.findIndex(v => v)
const grid = Array.from({ length: 20 }, (_, y) => Array.from({ length: 20 }, (_, x) => (x === 5 ? WALL : FLOOR)))
const town = {
  id: LANDING_ZONE, name: 'Synthetic Rune Hold', grid,
  gates: [
    { x: 10, y: 10, w: 1, h: 2, toZone: 'r-home-plot', toX: 1, toY: 1, label: LANDING_LABEL },
    { x: 2, y: 2, toZone: 'the-passage', toX: 1, toY: 1, label: 'THE PASSAGE' },
  ],
  warps: [],
} as unknown as Zone
const ZONES = [town]

// ── 1. the synthetic town is what this file thinks it is ─────────────────────────────────────
// ★ A fixture asserted before it is trusted. The 2026-08-22 lesson: a fixture that drifted into a
// place where its subject does not exist measures an empty column and reports nothing wrong.
{
  ok(FLOOR >= 0 && WALL >= 0, `fixture: SOLID yields a real floor (${FLOOR}) and a real wall (${WALL})`)
  ok(walkable(grid, 11, 10), 'fixture: (11,10) is open floor')
  ok(!walkable(grid, 5, 10), '★ fixture: the wall column really is solid — so the walkability assert CAN fail')
  ok(!!landingGate(ZONES), 'fixture: the landing IS painted in the synthetic town')
  ok(crossingReady(ZONES), 'fixture: so the crossing reads ready')
}

// ── 2. ★★★ THE WHOLE CHAIN, AND IT ENDS SOMEWHERE THE KEEPER CAN STAND ───────────────────────
// This is the assertion nothing else in the tree makes. `depart` refuses a tile inside a door;
// `crossing.ts` hands the payload across; NEITHER asks whether the tile is WALKABLE. A keeper
// staged onto a wall arrives correctly, by both modules' lights, inside a rock.
{
  const s = mkStore()
  const anchor = { x: 11, y: 10 }
  const out = depart(s.store, anchor, ZONES)
  ok(!('refused' in out), 'a painted landing and a clear anchor departs')
  if (!('refused' in out)) {
    const got = consumeArrival(s.store)
    ok(got !== null, 'the payload survives the handoff')
    const place = arrivalFor(got, null, { zone: LANDING_ZONE, x: 11, y: 10 })
    ok(place.why === 'staged', 'and the keeper arrives BECAUSE they crossed, not by fallback')
    ok(place.at.zone === LANDING_ZONE, 'in the town the gate names')
    ok(walkable(grid, place.at.x, place.at.y), '★★ THE JOIN: the tile they stand up on is walkable')
    ok(s.size() === 0, 'and the one-shot is spent, so a reload does not re-place them')
  }
}

// ── 3. the chain refuses rather than staging a bad arrival ───────────────────────────────────
// ⚠ A refusal must write NOTHING. A departure that stages and then refuses is the committed middle
// with a friendlier name.
{
  const s = mkStore()
  const out = depart(s.store, { x: 2, y: 2 }, ZONES)   // inside THE PASSAGE's footprint
  ok('refused' in out && out.refused === 'blocked', 'an anchor inside another door is refused')
  ok(s.ops.length === 0, `a refused departure writes nothing at all (ops: ${s.ops.join(', ') || 'none'})`)
}
{
  const s = mkStore()
  const bare = { ...town, gates: [town.gates![1]] } as unknown as Zone   // no landing painted
  const out = depart(s.store, { x: 11, y: 10 }, [bare])
  ok('refused' in out && out.refused === 'unpainted', 'no landing painted — the crossing refuses')
  ok(s.ops.length === 0, 'and writes nothing')
}

// ── 4. ⚠ A WALL IS STILL A LEGAL ARRIVAL, AND THAT IS A REAL GAP, NAMED HERE ─────────────────
// `depart` checks doors, not terrain, so a caller CAN stage a keeper into the wall column. This
// asserts the gap exists rather than pretending it does not: the day someone adds a terrain check,
// this assert flips and tells them to move the coverage note with it. ★ A known hole with a test on
// it is a decision; a known hole with nothing on it is a surprise waiting for a walkthrough.
{
  const s = mkStore()
  const out = depart(s.store, { x: 5, y: 10 }, ZONES)   // the wall column
  ok(!('refused' in out), 'a solid tile is NOT refused today — depart checks doors, not terrain')
  if (!('refused' in out)) {
    const got = consumeArrival(s.store)!
    ok(!walkable(grid, got.x, got.y),
       '⚠ so the chain can still stage a keeper into a wall — the anchor must be a walkable tile, and only Alex painting one guarantees that')
  }
}

// ── 5. the REAL map, for the one thing it can answer today ───────────────────────────────────
// ⚠ Reported, not asserted green: the landing is unpainted, so the real chain correctly refuses.
// "Not built" and "broken" must not share a line.
{
  const s = mkStore()
  const real = depart(s.store, { x: 50, y: 50 })
  const unpainted = 'refused' in real && real.refused === 'unpainted'
  ok(unpainted || !('refused' in real), 'the real map either refuses cleanly or is ready — never an error')
  if (unpainted) console.log('  ⋯ the real landing is unpainted, so the real chain refuses. That is correct, not a failure.')
  ok(s.ops.length === 0 || !unpainted, 'and an unpainted refusal writes nothing to the real store shape')
}

console.log(`crossing join: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
