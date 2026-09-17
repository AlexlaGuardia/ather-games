// The watering oracle. Run: npx tsx src/app/shimmer/voxel3d/watering.test.ts
import {
  JUG_ITEM, JUG_WATER_ITEM, JUG_POURS, WATER_HOLD_MS, WATER_RATE,
  waterBlocker, waterRefusalLine, waterBed, fillJug, settleWatering, isDamp, dampFraction, dampLeftLine,
  clearDamp, wateringToSave, wateringFromSave, wateringLabel, type WateredBeds, type Give,
} from './watering'
import { bedKey, plantInBed, cropAt, type PlantedBeds } from './planting'
import { CROP_DEFS } from '../engine/farming'
import { createInventory, countItem, removeItems } from '../engine/inventory'
import { createSkillSet } from '../engine/skills'
import { addToGrid } from './chest'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const WHEAT = CROP_DEFS['shimmerwheat']
const H = 3_600_000
const T0 = 1_700_000_000_000

// ★ THE HOST'S `give`, NOT `engine/inventory.addItems` — that one answers maxStack 1 for every id
// here and would have put four pours in four slots. Stack sizes are the voxel host's ladder; the
// rig mirrors its two rows for these ids.
const stackOf = (id: string) => (id === JUG_WATER_ITEM || id === JUG_ITEM ? JUG_POURS : 99)
const rig = () => {
  const inv = createInventory()
  const give: Give = (id, n) => addToGrid(inv.slots, id, n, stackOf)
  give(JUG_ITEM, 1)
  give(WHEAT.seedItemId, 3)
  const skills = createSkillSet()
  const beds: PlantedBeds = new Map()
  const watered: WateredBeds = new Map()
  const sow = (x: number, y: number, z: number, at: number) =>
    plantInBed(beds, x, y, z, WHEAT.seedItemId, inv, skills, 99, () => {}, () => at)!
  return { inv, give, skills, beds, watered, sow }
}

// ── 1. the vessel: fill, pour, hand the empty back ──────────────────────────────────────────────
{
  const r = rig()
  ok(fillJug(r.inv, r.give) === JUG_POURS, 'a fill carries JUG_POURS pours')
  ok(countItem(r.inv, JUG_ITEM) === 0 && countItem(r.inv, JUG_WATER_ITEM) === JUG_POURS, 'the empty jug became the water')
  ok(fillJug(r.inv, r.give) === 0, 'no empty jug → no fill, nothing spent')
  ok(countItem(r.inv, JUG_WATER_ITEM) === JUG_POURS, '…and the water is untouched')
  for (let i = 0; i < JUG_POURS; i++) ok(waterBed(r.watered, r.beds, i, 0, 0, r.inv, T0, r.give), `pour ${i + 1} lands`)
  ok(countItem(r.inv, JUG_WATER_ITEM) === 0, 'the water is spent')
  ok(countItem(r.inv, JUG_ITEM) === 1, '★ the last pour hands the empty jug back')
  ok(waterBlocker(r.watered, 9, 0, 0, r.inv, T0) === 'no-water', 'a fifth pour is refused: no water')
  ok(waterRefusalLine('no-water', r.watered, 9, 0, 0, T0).includes('pond'), '…and the sentence says where to get some')
}

// ── 2. a full bag: the fill never costs a jug for nothing ───────────────────────────────────────
{
  const r = rig()
  r.give(JUG_ITEM, 1)                                       // a stack of two: removing one frees no slot
  for (let i = 0; i < 30; i++) r.give(`filler_${i}`, 1)     // every other slot taken
  const jugsBefore = countItem(r.inv, JUG_ITEM)
  ok(fillJug(r.inv, r.give) === 0, 'no room for the water → the fill reports 0')
  ok(countItem(r.inv, JUG_ITEM) === jugsBefore, '★ …and the jug is handed back')
}

// ── 3. still damp: one water per day per bed ────────────────────────────────────────────────────
{
  const r = rig()
  fillJug(r.inv, r.give)
  ok(waterBed(r.watered, r.beds, 1, 2, 3, r.inv, T0, r.give), 'first pour')
  ok(waterBlocker(r.watered, 1, 2, 3, r.inv, T0 + H) === 'still-damp', 'an hour later the bed refuses a second')
  ok(waterRefusalLine('still-damp', r.watered, 1, 2, 3, T0 + H) === 'the soil is still damp — dries in 23h', 'the refusal names the hour')
  ok(dampLeftLine(r.watered, 1, 2, 3, T0 + WATER_HOLD_MS - 10 * 60_000) === 'dries in 10m', 'under an hour it names minutes')
  ok(isDamp(r.watered, 1, 2, 3, T0 + WATER_HOLD_MS - 1) && !isDamp(r.watered, 1, 2, 3, T0 + WATER_HOLD_MS), 'damp until exactly the hold')
  ok(waterBlocker(r.watered, 1, 2, 3, r.inv, T0 + WATER_HOLD_MS) === 'ok', 'a day later it takes water again')
  ok(countItem(r.inv, JUG_WATER_ITEM) === JUG_POURS - 1, 'the refused pours cost nothing')
  const d = r.watered.get(bedKey(1, 2, 3))!
  ok(Math.abs(dampFraction(d, T0 + WATER_HOLD_MS / 2) - 0.5) < 1e-9, 'half a day in, the patch is half faded')
}

// ── 4. ★★ THE RATE: a crop watered for its whole life ripens at 75% ─────────────────────────────
{
  const r = rig()
  fillJug(r.inv, r.give)
  waterBed(r.watered, r.beds, 0, 0, 0, r.inv, T0, r.give)
  r.sow(0, 0, 0, T0)
  const D = WHEAT.growthMs
  // Settle on a 1.5s beat, the host's cadence, up to 74% of nominal — not ready yet.
  let t = T0
  while (t < T0 + D * 0.74) { t += 1500; settleWatering(r.watered, r.beds, t) }
  const isReady = (at: number) => { const c = cropAt(r.beds, 0, 0, 0)!; return at - c.plantedAt >= c.growthDuration }
  ok(!isReady(t), 'at 74% of nominal the crop is not ready')
  while (t < T0 + D * 0.76) { t += 1500; settleWatering(r.watered, r.beds, t) }
  ok(isReady(t), '★★ at 76% of nominal a watered crop IS ready — canon\'s 25%')
}

// ── 5. the cursor: a crop sown late in the day is paid only for the time it was in the ground ───
{
  const r = rig()
  fillJug(r.inv, r.give)
  waterBed(r.watered, r.beds, 0, 0, 0, r.inv, T0, r.give)
  settleWatering(r.watered, r.beds, T0 + 20 * H)            // the bed sat empty and damp for 20h
  const sowAt = T0 + 20 * H
  const c = r.sow(0, 0, 0, sowAt)
  settleWatering(r.watered, r.beds, sowAt + 60_000)         // one minute in the ground
  const paid = sowAt - c.plantedAt
  ok(Math.abs(paid - 60_000 * (WATER_RATE - 1)) < 1, `★★ credited for the minute it grew, not the 20h before it (paid ${paid}ms)`)
}

// ── 6. the window ends mid-growth: only the damp fraction is paid, then the entry is swept ──────
{
  const r = rig()
  fillJug(r.inv, r.give)
  const waterAt = T0
  waterBed(r.watered, r.beds, 0, 0, 0, r.inv, waterAt, r.give)
  const sowAt = waterAt + WATER_HOLD_MS - 2 * 60_000        // two minutes before it dries
  const c = r.sow(0, 0, 0, sowAt)
  settleWatering(r.watered, r.beds, sowAt + 10 * 60_000)    // ten minutes later: 2 damp, 8 dry
  const paid = sowAt - c.plantedAt
  ok(Math.abs(paid - 2 * 60_000 * (WATER_RATE - 1)) < 1, `only the two damp minutes were paid (paid ${paid}ms)`)
  ok(r.watered.size === 0, 'the dried bed is swept from the map')
  const before = c.plantedAt
  settleWatering(r.watered, r.beds, sowAt + 20 * 60_000)
  ok(c.plantedAt === before, 'a swept bed pays nothing more')
}

// ── 7. a closed tab: one settle on load pays the whole interval, no more ────────────────────────
{
  const a = rig(), b = rig()
  for (const r of [a, b]) { fillJug(r.inv, r.give); waterBed(r.watered, r.beds, 0, 0, 0, r.inv, T0, r.give); r.sow(0, 0, 0, T0) }
  let t = T0
  while (t < T0 + 3 * 60_000) { t += 1500; settleWatering(a.watered, a.beds, t) }   // a: beat every 1.5s
  settleWatering(b.watered, b.beds, t)                                                // b: one settle at the end
  ok(Math.abs(cropAt(a.beds, 0, 0, 0)!.plantedAt - cropAt(b.beds, 0, 0, 0)!.plantedAt) < 1, '★ the integrator is path-independent')
  // And a save/load round trip in between changes nothing.
  const saved = JSON.parse(JSON.stringify(wateringToSave(b.watered)))
  const back = wateringFromSave(saved)
  settleWatering(back, b.beds, t + 60_000)
  const c = rig(); fillJug(c.inv, c.give); waterBed(c.watered, c.beds, 0, 0, 0, c.inv, T0, c.give); c.sow(0, 0, 0, T0)
  settleWatering(c.watered, c.beds, t + 60_000)
  ok(Math.abs(cropAt(b.beds, 0, 0, 0)!.plantedAt - cropAt(c.beds, 0, 0, 0)!.plantedAt) < 1, 'a round-tripped cursor pays the same')
}

// ── 8. re-water a dry bed the beat has not swept: the old day is settled, the new one is fresh ──
{
  const r = rig()
  fillJug(r.inv, r.give)
  waterBed(r.watered, r.beds, 0, 0, 0, r.inv, T0, r.give)
  const c = r.sow(0, 0, 0, T0 + WATER_HOLD_MS - 60_000)     // sown a minute before it dries
  const again = T0 + WATER_HOLD_MS + 5 * H                   // five hours dry, no beat ran
  ok(waterBed(r.watered, r.beds, 0, 0, 0, r.inv, again, r.give), 're-water lands')
  const paid = (T0 + WATER_HOLD_MS - 60_000) - c.plantedAt
  ok(Math.abs(paid - 60_000 * (WATER_RATE - 1)) < 1, '★ the old day\'s last minute was paid, the five dry hours were not')
  ok(r.watered.get(bedKey(0, 0, 0))!.creditedTo === again, 'the new day\'s cursor starts now')
}

// ── 9. broken bed, save shape, labels ───────────────────────────────────────────────────────────
{
  const r = rig()
  fillJug(r.inv, r.give)
  waterBed(r.watered, r.beds, 4, 5, 6, r.inv, T0, r.give)
  ok(clearDamp(r.watered, 4, 5, 6) && !clearDamp(r.watered, 4, 5, 6), 'clearDamp says whether it cleared')
  ok(wateringFromSave(undefined).size === 0 && wateringFromSave(null).size === 0 && wateringFromSave('x').size === 0, 'absent/garbage saves load as empty')
  ok(wateringFromSave([{ x: 1, y: 2, z: 3, until: 'soon', creditedTo: 0 }]).size === 0, 'a malformed row is skipped, not thrown')
  ok(wateringLabel(JUG_ITEM) === 'Clay Jug' && wateringLabel(JUG_WATER_ITEM) === 'Jug of Water' && wateringLabel('rubble') === null, 'labels')
  // The pour must not be re-derived: a bag whose water was removed behind the blocker still refuses.
  fillJug(r.inv, r.give); removeItems(r.inv, JUG_WATER_ITEM, countItem(r.inv, JUG_WATER_ITEM))
  ok(!waterBed(r.watered, r.beds, 7, 7, 7, r.inv, T0, r.give) && !r.watered.has(bedKey(7, 7, 7)), 'a refused pour writes nothing')
}

console.log(`\nwatering: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
