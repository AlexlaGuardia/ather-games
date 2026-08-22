// The bed-planting oracle. Run: npx tsx src/app/shimmer/voxel/planting.test.ts
import {
  bedKey, bedZoneId, plantBlocker, plantRefusalLine, plantInBed, cropAt, phaseAt, readyAt,
  harvestBed, clearBed, bedsToSave, bedsFromSave, type PlantedBeds,
} from './planting'
import { CROP_DEFS } from '../engine/farming'
import { createInventory, addItems, countItem } from '../engine/inventory'
import { createSkillSet } from '../engine/skills'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const WHEAT = CROP_DEFS['shimmerwheat']
// ⚠⚠ A REAL `ManaPool`, BUILT BY THE ENGINE — never a hand-rolled `{ cur, max } as any`. The first
// version of this rig faked one, and the fake had a field the real type does not (`cur`). That hid a
// live bug: `plantBlocker` read `mana.cur`, `undefined < 3` is false, and the mana gate never
// refused anything. **The `as any` is what let it through** — TypeScript would have named it
// instantly. A fixture cast to `any` has stopped describing the world and starts agreeing with
// whatever the code happens to do.
// ⚠⚠ THE POOL IS A PLAIN NUMBER AND A DRAIN CALLBACK, matching what the module now takes — and the
// history of this rig is the lesson. v1 faked `{ cur, max } as any`, which hid a dead mana gate
// (`plantBlocker` read a field the engine type does not have). v2 built a real engine `ManaPool`,
// which caught that — and then the HOST would not compile against it, because voxel3d keeps its own
// `{ cur, max, regen }`. **Two mana models exist and the module was right to take neither.**
const rig = (farming = 1, manaCur = 99) => {
  const inv = createInventory()
  addItems(inv, WHEAT.seedItemId, 3)
  const skills = createSkillSet()
  skills.farming.level = farming
  const pool = { cur: manaCur }
  const drain = (cost: number) => { pool.cur -= cost }
  return { beds: new Map() as PlantedBeds, inv, skills, pool, drain }
}

// ── 1. ★★ THE KEY CARRIES ALL THREE COORDINATES ────────────────────────────────────────────────
// The engine's PlantedCrop has tileX/tileY/zoneId, which is a flat grid. A keeper can stack beds on
// a terrace, so a key that drops `y` collides two beds at the same x/z — silently, by overwriting
// one crop with another.
{
  ok(bedKey(1, 2, 3) !== bedKey(1, 9, 3), '★★ two beds at the same x/z on different levels are different beds')
  ok(bedKey(1, 2, 3) === bedKey(1, 2, 3), 'and the same bed is the same key')
  ok(bedZoneId(7) === 'bed:7', 'y rides in the zone id, losslessly')

  // ⚠ A key built by string concat can collide across coordinates: "1,2,3" from (1,2,3) must not
  // equal a key from (12,3) or (1,23). Cheap to assert, invisible when wrong.
  ok(bedKey(1, 23, 3) !== bedKey(12, 3, 3), '★ the separator actually separates')
}

// ── 2. THE REFUSALS ARE SIX DIFFERENT SENTENCES ────────────────────────────────────────────────
{
  const r = rig()
  ok(plantBlocker(r.beds, 0, 0, 0, WHEAT.seedItemId, r.inv, r.skills, r.pool.cur) === 'ok', 'a fresh bed takes a seed')
  ok(plantBlocker(r.beds, 0, 0, 0, 'rubble', r.inv, r.skills, r.pool.cur) === 'not-a-seed', 'rubble is not a seed')

  const empty = rig(); empty.inv = createInventory()
  ok(plantBlocker(empty.beds, 0, 0, 0, WHEAT.seedItemId, empty.inv, empty.skills, empty.pool.cur) === 'none-in-bag',
    'an empty bag is its own answer')

  const dawn = CROP_DEFS['dawncap']
  const low = rig(1); addItems(low.inv, dawn.seedItemId, 1)
  ok(plantBlocker(low.beds, 0, 0, 0, dawn.seedItemId, low.inv, low.skills, low.pool.cur) === 'level',
    'a tier-4 crop refuses a level-1 keeper')

  const broke = rig(1, 0)
  ok(plantBlocker(broke.beds, 0, 0, 0, WHEAT.seedItemId, broke.inv, broke.skills, broke.pool.cur) === 'mana',
    'no mana is its own answer')

  const taken = rig()
  plantInBed(taken.beds, 0, 0, 0, WHEAT.seedItemId, taken.inv, taken.skills, taken.pool.cur, taken.drain)
  ok(plantBlocker(taken.beds, 0, 0, 0, WHEAT.seedItemId, taken.inv, taken.skills, taken.pool.cur) === 'occupied',
    '★ an occupied bed refuses a second seed')

  // ★ OCCUPIED IS CHECKED FIRST, on purpose: a keeper clicking a full bed should be told it is full,
  // not told about their mana. The bed is the thing they pointed at.
  const both = rig(1)
  plantInBed(both.beds, 0, 0, 0, WHEAT.seedItemId, both.inv, both.skills, both.pool.cur, both.drain)
  both.pool.cur = 0
  ok(plantBlocker(both.beds, 0, 0, 0, WHEAT.seedItemId, both.inv, both.skills, both.pool.cur) === 'occupied',
    '★★ occupied outranks mana — the keeper is told about the thing they clicked')

  for (const why of ['ok', 'occupied', 'not-a-seed', 'none-in-bag', 'level', 'mana'] as const) {
    const line = plantRefusalLine(why, WHEAT.seedItemId, rig().skills)
    ok(why === 'ok' ? line === '' : line.length > 0, `${why} has a sentence`)
    ok(!line.includes('undefined') && !line.includes('null'), `${why}'s sentence has no undefined/null in it`)
  }
}

// ── 3. ★★ ASK FIRST, SPEND SECOND ──────────────────────────────────────────────────────────────
// `plantCrop` drains mana BEFORE checking the seed is in the bag, so a bad plant through the raw
// engine burns mana for nothing and reads as "the bed sometimes doesn't work".
{
  const r = rig()
  const seedsBefore = countItem(r.inv, WHEAT.seedItemId)
  const manaBefore = r.pool.cur

  ok(plantInBed(r.beds, 0, 0, 0, 'rubble', r.inv, r.skills, r.pool.cur, r.drain) === null, 'a bad plant returns null')
  ok(r.pool.cur === manaBefore, '...and a non-seed costs no mana')
  ok(countItem(r.inv, WHEAT.seedItemId) === seedsBefore, '...and costs no seed')
  ok(r.beds.size === 0, '...and leaves the bed empty')

  // ⚠⚠ THE CASE THIS GUARD ACTUALLY EXISTS FOR, and my first version of this block MISSED IT —
  // a mutation deleting the `plantBlocker` call survived, because `'rubble'` is refused by
  // `plantCrop` at its FIRST line (`CROP_DEFS['rubble']` is undefined) before any mana moves.
  // The real hazard is a seed that is a REAL crop the keeper does not happen to hold: `plantCrop`
  // drains mana on line 3 and only checks the bag on line 4, so without the blocker that plant
  // costs mana and yields nothing. **A "bad input" fixture has to be bad in the specific way the
  // code under test is fragile to** — any old invalid value proves nothing.
  const none = rig()
  const dawn = CROP_DEFS['dawncap']
  none.skills.farming.level = dawn.minFarmingLevel      // level is fine, so it is not the refusal
  const noneMana = none.pool.cur
  ok(countItem(none.inv, dawn.seedItemId) === 0, 'the rig holds no dawncap seed')
  ok(plantInBed(none.beds, 0, 0, 0, dawn.seedItemId, none.inv, none.skills, none.pool.cur, none.drain) === null,
    'planting a real seed you do not hold is refused')
  ok(none.pool.cur === noneMana,
    '★★★ ...AND COSTS NO MANA — plantCrop drains before it checks the bag, and the blocker is what stops it')

  ok(plantInBed(r.beds, 0, 0, 0, WHEAT.seedItemId, r.inv, r.skills, r.pool.cur, r.drain) !== null, 'a good plant succeeds')
  ok(countItem(r.inv, WHEAT.seedItemId) === seedsBefore - 1, '★ a good plant spends exactly one seed')
  ok(r.pool.cur === manaBefore - WHEAT.manaCost, '★ ...and exactly its mana cost')
}

// ── 4. GROWTH AND THE UNRIPE PICK ──────────────────────────────────────────────────────────────
{
  const r = rig()
  ok(phaseAt(r.beds, 0, 0, 0) === null, 'an empty bed has no phase')
  ok(readyAt(r.beds, 0, 0, 0) === false, 'an empty bed is not ready')

  plantInBed(r.beds, 0, 0, 0, WHEAT.seedItemId, r.inv, r.skills, r.pool.cur, r.drain)
  ok(phaseAt(r.beds, 0, 0, 0) === 0, 'a fresh crop is phase 0')
  ok(readyAt(r.beds, 0, 0, 0) === false, 'and not ready')

  // ★★ AN UNRIPE PICK MUST LEAVE THE CROP EXACTLY WHERE IT WAS. Otherwise one mistimed click
  // destroys a fifty-minute dawncap, silently, and looks identical to a harvest that yielded nothing.
  ok(harvestBed(r.beds, 0, 0, 0, r.inv, r.skills) === null, 'an unripe bed hands back nothing')
  ok(r.beds.size === 1, '★★★ ...and the crop is still in the ground')
  ok(cropAt(r.beds, 0, 0, 0) !== undefined, '★★★ ...and still findable')

  // Wind the clock back past the growth duration rather than waiting five real minutes.
  //
  // ⚠ GUARDED, BECAUSE THE MUTATION THAT PROVES THE ASSERT ABOVE **CRASHES HERE INSTEAD OF FAILING**.
  // Make `harvestBed` delete an unripe crop and the two asserts above go red correctly — then this
  // line dereferences `undefined` and the process dies before the summary prints. A crash reads as a
  // broken TEST, not a broken world (PATTERNS, 08-19: it is the instrument failure that scored a
  // mutation as green). The oracle must survive its own red and still report it.
  const crop = cropAt(r.beds, 0, 0, 0)
  ok(crop !== undefined, 'the crop survived the unripe pick, so the rest of this section can run')
  if (crop) crop.plantedAt = Date.now() - WHEAT.growthMs - 1000
  ok(phaseAt(r.beds, 0, 0, 0) === 3, 'a grown crop is phase 3')
  ok(readyAt(r.beds, 0, 0, 0) === true, 'and ready')

  const got = harvestBed(r.beds, 0, 0, 0, r.inv, r.skills)
  ok(got !== null, 'a ripe bed harvests')
  ok((got?.items.length ?? 0) > 0, `...and yields something (${got?.items.map(i => i.itemId + '×' + i.count).join(', ')})`)
  ok((got?.xpGained ?? 0) > 0, '...and pays farming xp')
  ok(r.beds.size === 0, '★ ...and empties the bed')
}

// ── 5. A DESTROYED BED MUST NOT LEAVE ITS CROP BEHIND ──────────────────────────────────────────
// A record outliving its bed occupies the key forever: put a new bed on the same voxel and it
// refuses every seed with "something is already growing there", pointing at nothing.
{
  const r = rig()
  plantInBed(r.beds, 4, 5, 6, WHEAT.seedItemId, r.inv, r.skills, r.pool.cur, r.drain)
  ok(clearBed(r.beds, 4, 5, 6) === true, 'clearing a planted bed reports that it cleared something')
  ok(r.beds.size === 0, '★ ...and the crop is gone')
  ok(clearBed(r.beds, 4, 5, 6) === false, '★ clearing an empty bed reports nothing — so a caller can be tested')
  ok(plantBlocker(r.beds, 4, 5, 6, WHEAT.seedItemId, r.inv, r.skills, r.pool.cur) === 'ok',
    '★★ ...and the voxel takes a seed again')
}

// ── 6. THE SAVE ROUND-TRIPS, AND REFUSES A FOREIGN ONE ─────────────────────────────────────────
{
  const r = rig()
  plantInBed(r.beds, 4, 5, 6, WHEAT.seedItemId, r.inv, r.skills, r.pool.cur, r.drain)
  plantInBed(r.beds, 7, 8, 9, WHEAT.seedItemId, r.inv, r.skills, r.pool.cur, r.drain)

  const back = bedsFromSave(bedsToSave(r.beds))
  ok(back.size === 2, 'both beds survive a round trip')
  ok(cropAt(back, 4, 5, 6) !== undefined && cropAt(back, 7, 8, 9) !== undefined,
    '★★ ...at the same coordinates, y included — the key is rebuilt, never stored')

  ok(bedsFromSave(undefined).size === 0, 'a missing save loads empty rather than throwing')
  ok(bedsFromSave([]).size === 0, 'an empty save loads empty')

  // ⚠ play3d writes crops with real zone ids ("r-home-plot"). Without the guard those land in voxel
  // beds at coordinates that mean something else entirely.
  const foreign = [{ ...cropAt(r.beds, 4, 5, 6)!, zoneId: 'r-home-plot' }]
  ok(bedsFromSave(foreign).size === 0, "★★★ a crop from another surface's save is refused, not misplaced")
}

console.log(`\nplanting: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
