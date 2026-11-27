// Run: npx tsx src/app/shimmer/open/ather/moglins-farmer.test.ts
// THE FARMER (moglins.ts tick + farming.ts + water.ts): a farmer in the Farm waters growing beds from the tap's tanks, as often
// as its yield grade says (fair = 3 an hour, rare = 7), never plants or harvests; no tap / dry tanks / nothing growing = nothing
// watered AND nothing banked. Numbers absolute on purpose.
import { tick, dutyLine, PER_HOUR, type Village, type MoglinRecord } from './moglins'
import { scoreIn } from './moglin-stats'
import { newFarm, plant, seedId, type Farm } from './farming'
import { settle, freshWater, wholeOf, plumbingOf, type WaterSave } from './water'
import type { Works, Room } from './rooms'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const H = 3_600_000, T0 = 50_000_000

const room: Room = { id: 'farm-1', kind: 'farm', x: 0, z: 0, q: 0, placedAt: 0, doneAt: 1 }
const works = (taps: number, tanks: number): Works => ({ v: 1, rooms: [room], chests: [], pieces: [
  ...Array.from({ length: taps }, (_, i) => ({ id: `t${i}`, item: 'water_tap', x: i * 3, z: 10, q: 0, placedAt: 0 })),
  ...Array.from({ length: tanks }, (_, i) => ({ id: `k${i}`, item: 'water_tank', x: i * 3, z: 14, q: 0, placedAt: 0 })),
] })
const farmer = (yieldG: 1 | 5, roomId: string | null = 'farm-1'): MoglinRecord => ({ id: 'm1', name: 'Pib', home: 's1', grades: { craft: 1, yield: yieldG, trade: 1 }, dream: '', profession: 'farmer', recruitedAt: 0, room: roomId ?? undefined, acc: 0 })
const village = (m: MoglinRecord, last = T0): Village => ({ v: 1, moglins: [m], lastTick: last })
// six beds of Ather Lily (120 min, canon) planted at T0, so they are still growing over every tick below (all within 1 h)
const sixBeds = (): Farm => { let f = newFarm(6); for (let i = 0; i < 6; i++) { const p = plant(f, i, seedId('ather_lily'), T0); if (p.ok) f = p.farm } return f }
const fullTanks = (w: Works, at: number): WaterSave => settle(settle(freshWater(T0 - 10 * H), plumbingOf(w.pieces), T0 - 10 * H), plumbingOf(w.pieces), at)

// M65 s2 (a238045c) put a Moglin's pace on its 0-10 SCORE (PER_HOUR = 2 + 1 + 0.4 x score), and the score on a stat roll seeded by its id, so
// `grades` alone no longer fixes the rate. This id rolls fair = score 2 = 3.8 an hour, rare = score 7 = 5.8 an hour. Pinned here, absolute.
{
  const rate = (g: 1 | 5) => PER_HOUR(scoreIn(farmer(g), 'farm', 'yield'))
  ok(Math.abs(rate(1) - 3.8) < 1e-9 && Math.abs(rate(5) - 5.8) < 1e-9, `setup: fair 3.8 / rare 5.8 an hour (got ${rate(1)} / ${rate(5)})`)
}
// 1. a fair farmer (3.8 an hour) with full tanks: 20 minutes = 1 bed, 1 water
{
  const w = works(1, 1), water = fullTanks(w, T0)
  ok(wholeOf(water, plumbingOf(w.pieces), T0) === 12, 'setup: tap + tank full = 12')
  const t = tick(village(farmer(1)), w, T0 + 20 * 60_000, { farm: sixBeds(), water })
  ok(t.tended === 1, `fair farmer, 20 min: 1 bed (got ${t.tended})`)
  ok(t.grounds!.farm.beds.filter(b => b?.watered).length === 1 && t.grounds!.farm.beds[0]!.watered, 'bed 1 watered first')
  ok(Math.abs(t.village.moglins[0].acc! - (3.8 / 3 - 1)) < 1e-9, 'acc spent by exactly the one tend (3.8/3 - 1 left)')
}
// 2. a rare farmer (5.8 an hour) for 80 min = 7.73 tends: 6 beds (all there are), 6 water; the 7th tend has nothing to water and banks nothing
{
  const w = works(1, 1), water = fullTanks(w, T0)
  const t = tick(village(farmer(5)), w, T0 + 80 * 60_000, { farm: sixBeds(), water })
  ok(t.tended === 6, `rare farmer, 80 min, 6 beds: 6 (got ${t.tended})`)
  ok(t.village.moglins[0].acc === 0, 'nothing left to water: no debt banked')
  // water: 12 at T0 + the tap's fill (40 an hour), capped 12, minus 6 at the end = 6
  ok(wholeOf(t.grounds!.water, plumbingOf(w.pieces), T0 + 80 * 60_000) === 6, `tanks 12 -> 6 (got ${wholeOf(t.grounds!.water, plumbingOf(w.pieces), T0 + 80 * 60_000)})`)
}
// 3. no tap: nothing watered, nothing banked
{
  const w = works(0, 2)
  const t = tick(village(farmer(5)), w, T0 + H, { farm: sixBeds(), water: freshWater(T0) })
  ok(t.tended === 0 && t.village.moglins[0].acc === 0, 'no tap: 0 watered, 0 banked')
  ok(t.grounds!.farm.beds.every(b => !b?.watered), 'no tap: beds untouched')
}
// 4. dry tanks: a tap set just now (0 water) waters nothing
{
  const w = works(1, 0), water = settle(freshWater(T0 + H), plumbingOf(w.pieces), T0 + H)
  const t = tick(village(farmer(5)), w, T0 + H, { farm: sixBeds(), water })
  ok(t.tended === 0, 'dry tanks: 0 watered')
}
// 5. a ready bed is not watered; an empty bed is not watered; a watered bed is not watered twice
{
  const w = works(1, 1), water = fullTanks(w, T0)
  let f = newFarm(6)
  const g = plant(f, 0, seedId('goldleaf'), T0 - H); if (g.ok) f = g.farm          // ready (5 min crop, an hour ago)
  const r = plant(f, 3, seedId('stormgrass'), T0); if (r.ok) f = r.farm            // growing (M204 s3: the old earth herb retired)
  const t = tick(village(farmer(5)), w, T0 + 12 * 60_000, { farm: f, water })
  ok(t.tended === 1 && t.grounds!.farm.beds[3]!.watered && !t.grounds!.farm.beds[0]!.watered, 'only the growing bed is watered')
  const t2 = tick(t.village, w, T0 + 40 * 60_000, t.grounds)
  ok(t2.tended === 0, 'a watered bed is never watered twice')
}
// 6. no grounds passed (old caller), or the farmer not in a room: nothing, no throw
{
  const t = tick(village(farmer(5)), works(1, 1), T0 + H)
  ok(t.tended === 0 && t.grounds === undefined, 'no grounds: nothing tended')
  const t2 = tick(village(farmer(5, null)), works(1, 1), T0 + H, { farm: sixBeds(), water: fullTanks(works(1, 1), T0) })
  ok(t2.tended === 0, 'a farmer with no room tends nothing')
}
// 7. the duty line names the rate and keeps planting/harvest the keeper's
ok(/6 an hour/.test(dutyLine(farmer(5), 'farm')) && /harvesting are yours/.test(dutyLine(farmer(5), 'farm')), 'duty line: rate + the beds stay yours')

console.log(`moglins-farmer: ${pass}/${fails.length}`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
