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

// ── 3. THE DORMANT STATE IS THE SHIPPED STATE, AND IT MUST BE QUIET ─────────────────────────────
// Today nothing stages anything, so every load consumes null. Assert that this does nothing at all
// rather than doing something small and wrong.
{
  const store = memStore()
  ok(consumeArrival(store) === null, 'with nothing staged the arrival is null')
  ok(store.keys().length === 0, 'and reading an empty one-shot writes nothing')

  const cold = depart(store, { x: 60, y: 60 })   // shipped zones — no landing painted
  ok('refused' in cold && cold.refused === 'unpainted',
     'the departure is still refused by name on the shipped map — the dormant half, on purpose')
  ok(store.keys().length === 0, 'a refused departure stages nothing for the town to find')
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

console.log(`crossing-in: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
