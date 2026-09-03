// The ARRIVING half of the Ather crossing. Run: npx tsx src/app/shimmer/play3d/crossing-in.test.ts
//
// `engine/crossing.ts` shipped the contract and a full oracle on 2026-08-24 with NO caller on
// either side — so a keeper stepping into the Rune Hold gate had nowhere to arrive, and nothing was
// red, because a contract with no callers is perfectly self-consistent. This file guards the half
// that receives: `Shimmer3D.tsx` consuming the one-shot and standing the keeper up.
//
// ⚠ THE WIRING RESTS ON A MEASURED FACT ABOUT `rune-hold`, AND THAT FACT IS THE FRAGILE PART.
// The arrival takes the PLAIN-ZONE branch: `setZoneId` + a direct tile set. That is correct only
// while `rune-hold` is neither stitched into the composed world nor legacy-migrated. If it is ever
// absorbed into the garden world, `toWorld` becomes the right call and the plain branch would place
// the keeper at raw local coordinates inside a composed map — a legal, meaningless position, which
// is the failure mode the contract bans (0,0) by name for. Section 2 is that fact as a red test
// rather than as the comment I first wrote.

import { readFileSync } from 'node:fs'
import { consumeArrival, stageArrival, arrivalFor, type Store, type TilePos } from '../engine/crossing'
import { LANDING_ARRIVAL } from '../world/landing'
import { depart, LANDING_ZONE, LANDING_LABEL } from '../voxel3d/crossing-out'
import { ALL_ZONES } from '../world/all-zones'
import { getZone, type Gate, type Zone } from '../world/zones'
import { isStitched } from '../world/garden-world'
import { migrateLegacyPosition } from '../world/region-maps'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const memStore = (): Store & { keys: () => string[] } => {
  const m = new Map<string, string>()
  return {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v) },
    removeItem: k => { m.delete(k) },
    keys: () => [...m.keys()],
  }
}

// ── 1. ★★ THE WHOLE SEAM, END TO END, ON A PAINTED FIXTURE ──────────────────────────────────────
// The landing is not painted on the shipped map (that is Alex's brush, and the departure is
// correctly refused until it is). So the round trip is exercised against a fixture that HAS one —
// otherwise this file could only ever assert that nothing happens, which is not a test of arrival.
{
  const town = getZone(ALL_ZONES, LANDING_ZONE) as Zone & { gates?: Gate[] }
  ok(!!town, `${LANDING_ZONE} is a real zone on the shipped map`)
  const LANDING: Gate = { x: 4, y: 4, w: 1, h: 2, toZone: 'x', toX: 1, toY: 1, label: LANDING_LABEL }
  const painted: Zone[] = [{ ...town, gates: [...(town.gates ?? []), LANDING] } as Zone]

  const store = memStore()
  const out = depart(store, { x: 60, y: 60 }, painted)
  ok(!('refused' in out), 'a painted landing and a clear anchor depart')

  if (!('refused' in out)) {
    // What the arriving side actually runs.
    const staged = consumeArrival(store)
    ok(!!staged, 'the town finds a staged arrival on the next load')
    ok(staged?.zone === LANDING_ZONE, 'and it names the town, not the Ather')
    ok(staged?.x === 60 && staged?.y === 60, 'at exactly the tile the Ather staged')

    // ⚠ The guard the wiring performs before it moves anyone.
    ok(!!getZone(ALL_ZONES, staged!.zone), 'the staged zone resolves against the SHIPPED map, not the fixture')

    // One-shot. A second load must not re-place — that is the 08-15 self-feeding state.
    ok(consumeArrival(store) === null, 'the one-shot is spent; a second load is not re-placed')
    ok(store.keys().length === 0, 'and nothing is left behind in storage')
  }
}

// ── 2. ★★★ THE MEASURED FACT THE PLAIN-ZONE BRANCH RESTS ON ─────────────────────────────────────
// If either of these flips, `Shimmer3D`'s arrival is placing a keeper at local coordinates inside a
// world that no longer uses them, and NOTHING else would notice: the zone resolves, the numbers are
// finite, the keeper stands somewhere. Legal and meaningless.
{
  ok(isStitched(LANDING_ZONE) === false,
     `${LANDING_ZONE} is NOT stitched into the composed world — if it becomes so, the arrival must go through toWorld`)
  for (const [x, y] of [[60, 60], [48, 86], [22, 48], [1, 1]] as const)
    ok(migrateLegacyPosition(LANDING_ZONE, x, y) === null,
       `${LANDING_ZONE} (${x},${y}) has no legacy migration — the plain-zone branch is the right one`)
}

// ── 3. THE EMPTY ONE-SHOT MUST BE QUIET, AND THE FULL ONE MUST ARRIVE ───────────────────────────
// ⚠ RE-AIMED 2026-09-03. This section asserted that the departure is REFUSED on the shipped map,
// which was true while nobody had painted THE LANDING and is false now that somebody has. The
// claim worth keeping is not "the crossing is dormant" — that was a fact about the calendar. It is
// that a load with nothing staged does nothing at all, and that a real departure reaches the town.
{
  const store = memStore()
  ok(consumeArrival(store) === null, 'with nothing staged the arrival is null')
  ok(store.keys().length === 0, 'and reading an empty one-shot writes nothing')

  const live = depart(store, LANDING_ARRIVAL)     // shipped zones — the landing is painted now
  ok(!('refused' in live), `the shipped map departs (${JSON.stringify(live)})`)
  ok(store.keys().length === 1, 'a real departure stages exactly one key for the town to find')
  const landed = consumeArrival(store)
  ok(landed?.zone === LANDING_ZONE && landed.x === LANDING_ARRIVAL.x && landed.y === LANDING_ARRIVAL.y,
     'and the town consumes it onto the anchor beside the door')
  ok(store.keys().length === 0, 'read-and-clear: the one-shot does not survive to re-place anyone')
}

// ── 4. A MALFORMED OR IMPOSSIBLE ARRIVAL IS DROPPED, NEVER A CRASH AND NEVER (0,0) ──────────────
{
  const store = memStore()
  store.setItem('shimmer:crossing:pending', '{ not json')
  ok(consumeArrival(store) === null, 'a malformed one-shot reads as no arrival')
  ok(store.keys().length === 0, 'and it is cleared, so it cannot fail forever')

  // A zone that has since been deleted: the payload is well-formed, so `consumeArrival` returns it
  // and the WIRING is what must refuse. Asserted here as the rule the caller has to apply.
  stageArrival(store, { zone: 'a-zone-that-was-deleted', x: 5, y: 5 })
  const ghost = consumeArrival(store)
  ok(!!ghost, 'a well-formed payload for a dead zone still parses')
  // ⚠ `getZone` returns **null**, not undefined, for a miss — so the wiring's guard is a truthiness
  // test and this assert has to be the same shape. My first version compared against `undefined`
  // and went red against correct code: a test written from the type's look rather than from the
  // function's behaviour. Measured, then asserted.
  ok(!getZone(ALL_ZONES, ghost!.zone), 'and the zone lookup is what catches it (null, not undefined)')
}

// ── 5. ★★ AND THE GAME HAS TO ACTUALLY RUN IT ───────────────────────────────────────────────────
// Sections 1-4 are green with `Shimmer3D.tsx` never calling any of it — which is precisely the state
// this whole file exists to end. A contract with no callers is perfectly self-consistent.
{
  const src = readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8')

  ok(/consumeArrival\(localStorage\)/.test(src), 'Shimmer3D consumes the one-shot from real storage')
  ok(/setZoneId\(staged\.zone\)/.test(src), 'and moves the keeper to the staged zone')
  ok(/posRef\.current!\.set\(staged\.x, posRef\.current!\.y, staged\.y\)/.test(src),
     'and to the staged tile — x and y, with the walker\'s own height left alone')
  ok(/if \(getZone\(ALL_ZONES, staged\.zone\)\)/.test(src),
     'guarded on the zone existing, so a dead zone drops the arrival instead of placing nobody somewhere')

  // ⚠⚠ PRECEDENCE IS POSITIONAL HERE — the block wins by running LAST. Asserting it by offset is
  // the only way to see that, and it is the difference between "staged beats saved" and "saved
  // silently beats staged", which look identical in a diff.
  const iSaved = src.indexOf('else if (data.zoneId && getZone(ALL_ZONES, data.zoneId))')
  const iStaged = src.indexOf('const staged = consumeArrival(localStorage)')
  ok(iSaved > 0 && iStaged > 0, 'both the save branch and the arrival block are present')
  ok(iStaged > iSaved, 'the arrival runs AFTER the save branches — staged beats saved, as the contract says')

  // And it must not be trapped inside the spirits block, which never runs for a save with no party.
  const spirits = src.indexOf('if (data?.spirits?.length)')
  const between = src.slice(spirits, iStaged)
  ok(spirits > 0 && (between.match(/\n      \}/g) ?? []).length >= 1,
     'the arrival sits outside the `data.spirits` block — an arrival cannot depend on owning a spirit')
}

// ── 6. arrivalFor STILL AGREES ABOUT WHY, even though the wiring does not call it ───────────────
// It is deliberately unused in production (Shimmer3D's saved position is not a TilePos; forcing it
// would mean restating a three-branch resolution). Kept honest here so it does not rot unnoticed.
{
  const staged: TilePos = { zone: LANDING_ZONE, x: 7, y: 8 }
  const saved: TilePos = { zone: LANDING_ZONE, x: 1, y: 2 }
  const landing: TilePos = { zone: LANDING_ZONE, x: 3, y: 4 }
  ok(arrivalFor(staged, saved, landing).why === 'staged', 'staged beats saved')
  ok(arrivalFor(null, saved, landing).why === 'returning', 'saved beats the landing')
  ok(arrivalFor(null, null, landing).why === 'first-visit', 'and a keeper with neither is a first visit')
  ok(arrivalFor(null, null, landing).at.x !== 0 || arrivalFor(null, null, landing).at.y !== 0,
     'the fallback is a real landing, never (0,0) — banned by name in the contract')
}

// ── 7. ★★★ AND THE THING THE ARRIVAL HAS TO BEAT MUST BE ABLE TO RUN AT ALL ────────────────────
// Section 5 proves the arrival runs LAST. Precedence is only meaningful if the loser can run: the
// saved-position resolution spent months INSIDE `if (data?.spirits?.length)`, so for a keeper with
// no spirit it never ran, and "staged beats saved" was a rule about a branch that was dead anyway.
//
// ⚠ WHAT IT COST, MEASURED IN A BROWSER AGAINST THE BUILT ARTIFACT (2026-08-27, play lane): a
// staged arrival placed the keeper in Rune Hold and the save recorded it — and the next load stood
// them back in the Home Plot. The crossing worked and then undid itself, which reads to a player as
// the crossing being broken. Greg's gift is the only source of a first spirit, so the keepers who
// had this were the newest ones.
//
// ★ THE ASSERT IS ON THE GUARD, NOT ON A LINE NUMBER OR A BRACE COUNT. Whichever `if (…) {` most
// recently opened before the position restore IS the condition it runs under, so asking which one
// is nearer is asking the real question — and it stays true through reindentation, added branches
// and moved comments, none of which a brace tally survives.
{
  const src = readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8')
  const restore = src.indexOf("if (typeof data.playerTileX === 'number' && typeof data.playerTileY === 'number')")
  ok(restore > 0, 'the saved-position restore is still findable')

  const before = src.slice(0, restore)
  const bySpirits = before.lastIndexOf('if (data?.spirits?.length) {')
  const byData = before.lastIndexOf('if (data) {')
  ok(bySpirits > 0, 'the spirits block is still there to be confused with')
  ok(byData > bySpirits,
     'the saved position is restored under `if (data)`, NOT inside the spirits block — a keeper who owns no spirit still stands where they left off')

  // And the zone resolution travels with it: all three branches must be under the same guard, or a
  // spirit-less keeper keeps their tile and loses their zone, which is a worse place than either.
  const zoneBranch = src.indexOf('else if (data.zoneId && getZone(ALL_ZONES, data.zoneId))')
  ok(zoneBranch > restore && src.slice(restore, zoneBranch).indexOf('if (data?.spirits?.length) {') < 0,
     'the zone branches sit with the tile restore, under the same guard')
}

console.log(`crossing-in: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
