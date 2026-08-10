// Mist-difficulty oracle. Run: npx tsx src/app/shimmer/voxel3d/mist-difficulty.test.ts
//
// The thing actually being defended here is a DOCTRINE, not a set of numbers: an area's level is a
// property of the area (encounters.ts, 2026-07-23). The regression that would undo it is small and
// looks helpful — someone re-introduces a party term "so low-level keepers aren't walled out" — so
// the asserts below are written to fail on the SHAPE of that change, not on a magic constant:
// no function here takes the party at all, every level lands inside its region's band, and the band
// a mist patch uses is the same object the 2D ring uses rather than a copy that can drift.

import {
  bandFor, residentLevel, secondLevel, answersInPair, WORN_CAP, PAIR_CHANCE, RESIDENT_TIER,
} from './mist-difficulty'
import { MIST_ROSTERS, MIST_CORRIDORS, rosterFor, type ZoneId } from './mist-roster'
import { residentAt, recordWithdrawal, type MistLedger } from './mist-encounter'
import { ENCOUNTER_TABLES } from '../engine/encounters'
import { mistPatchAt, DEFAULT_MIST, type MistPatch } from '../voxel/mist'
import { zoneAt, ZONE_ANCHORS } from '../voxel/zones'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const RING: ZoneId[] = ['mycelial-path', 'spirit-meadow', 'twilight-thicket', 'mana-springs', 'the-outfields']

/** Every mist patch this seed actually generates, with the zone it belongs to. Real patches only —
 *  a synthetic MistPatch could satisfy every assert while the generator produces none. */
function realPatches(limit = 400): { p: MistPatch; zone: ZoneId | undefined }[] {
  const out: { p: MistPatch; zone: ZoneId | undefined }[] = []
  const R = 26
  for (let cz = -R; cz <= R && out.length < limit; cz++) {
    for (let cx = -R; cx <= R && out.length < limit; cx++) {
      const p = mistPatchAt(SEED, cx, cz, DEFAULT_MIST)
      if (p) out.push({ p, zone: zoneAt(p.x, p.z, SEED).zone?.id })
    }
  }
  return out
}
const PATCHES = realPatches()

// ── 1. band-set == roster-set: a region cannot half-arrive ──────────────────────────────────────
// The fail-closed pair. A zone with a ruled roster and no band would build a resident with no
// level; a zone with a band and no roster is a band nobody reads. Either is a silent half-feature.
{
  const rostered = (Object.keys(MIST_ROSTERS) as ZoneId[])
    .filter(z => (MIST_ROSTERS[z] ?? []).length > 0)
    .concat(Object.keys(MIST_CORRIDORS) as ZoneId[])
  let missing = 0
  for (const z of rostered) if (!bandFor(z)) { missing++; fails.push(`${z} has a roster but no level band`) }
  ok(missing === 0, 'every region whose mist calls something has a band to call it at')
  ok(bandFor('gloview-village' as ZoneId) === null || rosterFor('gloview-village').length === 0,
     'a region with no roster is never given a resident by the band alone')
  ok(bandFor(null) === null && bandFor(undefined) === null, 'no zone means no band — fails closed')
  ok(bandFor('garden' as ZoneId)?.[1] === 1, 'the garden stays the garden (Lv 1, and it grows no patches)')
}

// ── 2. the band is READ from the 2D ring, not transcribed ───────────────────────────────────────
// The drift this catches is the slow kind: someone retunes the Thicket in encounters.ts and the
// mist keeps the old numbers, so one region means two different difficulties depending on surface.
{
  let drift = 0
  for (const z of RING) {
    const table = ENCOUNTER_TABLES[z]
    if (!table) continue                       // the-outfields: no 2D twin, override by design
    const b = bandFor(z)!
    if (b[0] !== table.levels[0] || b[1] !== table.levels[1]) {
      drift++; fails.push(`${z} mist band ${b} != ring band ${table.levels}`)
    }
  }
  ok(drift === 0, 'a mist band IS its region\'s band — one number, one region')
  ok(!ENCOUNTER_TABLES['the-outfields'], 'the Outfields override exists because the ring has no such place')
}

// ── 3. the ladder rises walking out ─────────────────────────────────────────────────────────────
// What makes the map readable at all: "go there when you are stronger" needs an order.
{
  let inversions = 0
  for (let i = 1; i < RING.length; i++) {
    const a = bandFor(RING[i - 1])!, b = bandFor(RING[i])!
    if (b[0] < a[0] || b[1] < a[1]) { inversions++; fails.push(`${RING[i]} ${b} does not rise above ${RING[i - 1]} ${a}`) }
  }
  ok(inversions === 0, 'the mist bands rise along the ring, mycelial → outfields')
}

// ── 4. NO PARTY TERM ANYWHERE — the doctrine assert ─────────────────────────────────────────────
// Arity is the cheapest total proof: none of these functions can consult the player because none of
// them is handed the player. A future signature change that adds one fails here first.
{
  ok(residentLevel.length <= 3, 'residentLevel takes (patch, zone, nonce) and nothing about the keeper')
  ok(answersInPair.length <= 3, 'answersInPair takes no party')
  ok(secondLevel.length <= 4, 'secondLevel derives from the lead and the band, not the party')
  // And behaviourally: the same patch answers identically no matter who walks up, because there is
  // nowhere to pass "who" at all. Re-asserted against real ground so the arity check has teeth.
  const banded = PATCHES.filter(x => bandFor(x.zone))
  ok(banded.length > 0, `the seed generates banded patches to test (${banded.length})`)
  let unstable = 0
  for (const { p, zone } of banded) if (residentLevel(p, zone, 0) !== residentLevel(p, zone, 0)) unstable++
  ok(unstable === 0, 'a patch reports the same level every time it is asked')
}

// ── 5. every level lands INSIDE its band, worn-in patches included ──────────────────────────────
// The ramp is the one thing that could climb out of a band and quietly re-create the treadmill.
{
  let outside = 0, sawTop = 0
  for (const { p, zone } of PATCHES) {
    const band = bandFor(zone)
    if (!band) { if (residentLevel(p, zone, 0) !== null) { outside++; fails.push(`unbanded ${zone} produced a level`) } ; continue }
    for (let n = 0; n <= 12; n++) {
      const lv = residentLevel(p, zone, n)!
      if (lv < band[0] || lv > band[1]) { outside++; fails.push(`${zone} n=${n} → lv ${lv} outside ${band}`) }
      if (n >= WORN_CAP && lv === band[1]) sawTop++
    }
  }
  ok(outside === 0, 'no patch, at any wear, leaves its region\'s band')
  ok(sawTop > 0, 'worked ground does climb toward the top of its band')
  ok(WORN_CAP >= 1 && WORN_CAP <= 4, `the wear ramp stays small (${WORN_CAP})`)
}

// ── 6. a much-worked gentle patch never out-ranks the next region ───────────────────────────────
// The concrete form of the same rule, stated the way a player would notice it breaking.
{
  const meadow = bandFor('spirit-meadow')!, thicket = bandFor('twilight-thicket')!
  const worked = PATCHES.filter(x => x.zone === 'spirit-meadow')
    .map(x => Math.max(...Array.from({ length: 20 }, (_, n) => residentLevel(x.p, x.zone, n)!)))
  ok(worked.every(lv => lv <= meadow[1]), 'a hammered meadow dell caps at the meadow band')
  ok(worked.every(lv => lv < thicket[0]), 'and never reaches the Thicket — travel keeps paying')
}

// ── 7. the pair is the ground's call, drawn from the same roster, and never a spirit's twin ─────
{
  let pairs = 0, sameKind = 0, offRoster = 0, belowBand = 0
  const ledger: MistLedger = {}
  for (const { p, zone } of PATCHES) {
    if (!bandFor(zone) || !rosterFor(zone).length) continue
    for (let n = 0; n <= 6; n++) {
      if (!answersInPair(p, zone, n)) continue
      pairs++
      const lead = residentLevel(p, zone, n)!
      const sec = secondLevel(p, zone, lead, n)
      if (sec < bandFor(zone)![0] || sec > lead) belowBand++
    }
  }
  ok(pairs > 0, `the ground does call pairs on this seed (${pairs})`)
  ok(belowBand === 0, 'a paired second sits below its lead but inside the band')
  // Assembled residents: the second is a different kind and a real roster member.
  for (const { p, zone } of PATCHES) {
    const r = residentAt(p, zone, ledger, 0)
    if (!r?.second) continue
    if (r.second.species === r.species) sameKind++
    if (!rosterFor(zone).includes(r.second.species)) offRoster++
  }
  ok(sameKind === 0, 'a pair is two kinds answering one gathering, never a spirit and its copy')
  ok(offRoster === 0, 'the second is always drawn from the ruled roster')
  ok(PAIR_CHANCE > 0 && PAIR_CHANCE < 0.5, `pairs stay the exception (${PAIR_CHANCE})`)
  // A one-species region can never pair — the exclusion is up front, not a lucky draw.
  ok(!answersInPair(PATCHES[0].p, 'gloview-village' as ZoneId, 0), 'an empty roster never pairs')
}

// ── 8. the resident stays wild ──────────────────────────────────────────────────────────────────
// Difficulty is levels. 'trained' means a spirit worked by a handler, which is the collar — the one
// thing a practice ground cannot be dressing for.
{
  ok(RESIDENT_TIER === 'wild', 'a mist resident fights on instinct at every band')
}

// ── 9. end to end through the ledger: withdrawal re-rolls the level with the species ────────────
{
  const banded = PATCHES.find(x => bandFor(x.zone) && rosterFor(x.zone).length > 1)!
  let ledger: MistLedger = {}
  const before = residentAt(banded.p, banded.zone, ledger, 0)!
  ledger = recordWithdrawal(ledger, banded.p, 0)
  ok(residentAt(banded.p, banded.zone, ledger, 1000) === null, 'a sparred patch stands empty while it is quiet')
  const after = residentAt(banded.p, banded.zone, ledger, 60 * 60 * 1000)!
  const band = bandFor(banded.zone)!
  ok(after.level >= band[0] && after.level <= band[1], 'what gathers next is still this ground')
  ok(before.level !== undefined && after.level !== undefined, 'both residents carry a level')
  // Every zone that generates a patch must produce a levelled resident or none — never a half one.
  let halfBuilt = 0
  for (const { p, zone } of PATCHES) {
    const r = residentAt(p, zone, {}, 0)
    if (r && !(r.level >= 1)) halfBuilt++
  }
  ok(halfBuilt === 0, 'no resident ever reaches the world without a level')
}

// ── 10. no patch generates in a zone with no band ───────────────────────────────────────────────
// The mirror of mist-roster's check, one axis over: a terrain retune that grows patches in Home
// would otherwise produce silhouettes with nothing behind them.
{
  const unbanded = PATCHES.filter(x => !bandFor(x.zone))
  ok(unbanded.length === 0 || unbanded.every(x => rosterFor(x.zone).length === 0),
     `every generated patch sits in a banded region (${unbanded.length} unbanded)`)
  ok(ZONE_ANCHORS.filter(z => z.mist > 0 && !bandFor(z.id) && rosterFor(z.id).length > 0).length === 0,
     'no zone grows mist it has a roster for but no band')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the ground sets the level, not the keeper — ${pass} passed`)
