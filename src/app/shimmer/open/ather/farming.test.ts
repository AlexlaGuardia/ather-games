// Run: npx tsx src/app/shimmer/open/ather/farming.test.ts
// The farm room's pure model (ather/farming.ts): canon's crops and phases, grades, watering, the composter.
import { CROPS, GRADES, seedId, cropId, parseGraded, baseOf, newFarm, plant, water, phaseOf, harvest, compost, isArmed, DOSE_COST, CHARGE_CAP, WATER_MULT, ARMED_GROWTH_MULT, SEEDS_BACK, SEED_UPGRADE_RATE, type Farm, type CropId } from './farming'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const MIN = 60_000, T0 = 5_000_000

// canon's table, written out here on purpose (the module's copy is what is being checked)
const CANON: Record<string, [string, number, number]> = {
  goldleaf: ['Goldleaf', 1, 5], ather_wheat: ['Ather Wheat', 1, 8], dewdrop_vine: ['Dewdrop Vine', 1, 10],
  violetbloom: ['Violetbloom', 2, 20], stormgrass: ['Stormgrass', 2, 20], rootvine: ['Rootvine', 2, 25], tidepetal: ['Tidepetal', 2, 20],
  starbloom: ['Starbloom', 3, 45], heartleaf: ['Heartleaf', 3, 60], ather_lily: ['Ather Lily', 4, 120],
}
ok(Object.keys(CROPS).length === 10 && Object.keys(CANON).length === 10, 'canon: crop count is not 10')
for (const [id, [name, tier, min]] of Object.entries(CANON)) {
  const c = CROPS[id as CropId]
  ok(!!c && c.name === name && c.tier === tier && c.growMs === min * MIN, `canon: ${id} drifted from canon (${name}, tier ${tier}, ${min} min)`)
}
ok(WATER_MULT === 0.75, 'canon: watering must be exactly 0.75')

const seeded = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
const planted = (crop: CropId, grade: any = 'D', beds = 2): Farm => { const r = plant(newFarm(beds), 0, seedId(crop, grade), T0); if (!r.ok) throw new Error(r.why); return r.farm }
const armedFarm = (f: Farm, items = DOSE_COST): Farm => compost(f, [{ id: 'junk', n: items }]).farm

// phases at 25 / 50 / 100 %
{
  const f = planted('goldleaf'), b = f.beds[0]!, t = CROPS.goldleaf.growMs
  ok(phaseOf(b, T0, false) === 0 && phaseOf(b, T0 + t * 0.25 - 1, false) === 0, 'phase: 0 before 25%')
  ok(phaseOf(b, T0 + t * 0.25, false) === 1 && phaseOf(b, T0 + t * 0.5 - 1, false) === 1, 'phase: 1 at 25%')
  ok(phaseOf(b, T0 + t * 0.5, false) === 2 && phaseOf(b, T0 + t - 1, false) === 2, 'phase: 2 at 50%')
  ok(phaseOf(b, T0 + t, false) === 3, 'phase: 3 at 100%')
}
// watering is exactly 0.75; armed stacks
{
  const f = planted('rootvine'), t = CROPS.rootvine.growMs
  const w = water(f, 0, T0 + 1); ok(w.ok, 'water: refused a fresh bed')
  if (w.ok) {
    const b = w.farm.beds[0]!
    ok(phaseOf(b, T0 + t * 0.75 - 1, false) === 2 && phaseOf(b, T0 + t * 0.75, false) === 3, 'water: ready at exactly 0.75 of the time')
    const at = T0 + t * 0.75 * ARMED_GROWTH_MULT
    ok(phaseOf(b, at, true) === 3 && phaseOf(b, at - 1, true) === 2, 'armed: stacks with watering (0.75 x armed mult)')
    ok(!water(w.farm, 0, T0).ok, 'water: a bed can be watered twice')
  }
  ok(ARMED_GROWTH_MULT < 1 && ARMED_GROWTH_MULT > 0.5, 'tune: armed growth must be a small nudge')
  ok(phaseOf(f.beds[0]!, T0 + t * ARMED_GROWTH_MULT, true) === 3 && phaseOf(f.beds[0]!, T0 + t * ARMED_GROWTH_MULT, false) < 3, 'armed: unwatered armed bed is faster than unarmed')
}
// plant refusals
{
  const f = planted('goldleaf')
  ok(!plant(f, 0, seedId('starbloom'), T0).ok, 'plant: planted over a taken bed')
  ok(!plant(f, 5, seedId('starbloom'), T0).ok && !plant(f, -1, seedId('starbloom'), T0).ok, 'plant: bed out of range accepted')
  ok(!plant(f, 1, 'crop:goldleaf:D', T0).ok && !plant(f, 1, 'seed:nope:D', T0).ok && !plant(f, 1, 'goldleaf', T0).ok, 'plant: planted a non-seed or unknown seed')
  ok(!water(f, 1, T0).ok && !water(f, 9, T0).ok, 'water: watered an empty or missing bed')
}
// harvest: refusal, grade, seeds
{
  const f = planted('starbloom', 'C'), t = CROPS.starbloom.growMs
  const early = harvest(f, 0, T0 + t - 1, () => 0); ok(!early.ok && !early.ok && (early as any).why === 'not ready', 'harvest: allowed before ready')
  ok(!harvest(f, 1, T0 + t, () => 0).ok && !harvest(f, 7, T0 + t, () => 0).ok, 'harvest: empty/out-of-range bed accepted')
  const h = harvest(f, 0, T0 + t, () => 0)
  ok(h.ok, 'harvest: refused a ready bed')
  if (h.ok) {
    ok(h.crops.length === 1 && h.crops[0].id === 'crop:starbloom:C' && h.crops[0].n === 1, 'grade: crop grade is not its seed grade')
    ok(h.seeds.length === 1 && h.seeds[0].id === 'seed:starbloom:C' && h.seeds[0].n === SEEDS_BACK, 'seeds: unarmed harvest must return seeds at the SAME grade')
    ok(!h.spentDose && h.farm.charge === 0 && h.farm.beds[0] === null, 'composter: an unarmed harvest spent a dose, or the bed was not cleared')
  }
}
// armed harvest: upgrades, dose, yield
{
  const base = planted('starbloom', 'C'), t = CROPS.starbloom.growMs
  const f = armedFarm(base, DOSE_COST + 3)
  ok(isArmed(f) && !isArmed(base), 'composter: arms at one dose, not before')
  const all = harvest(f, 0, T0 + t, () => 0)
  ok(all.ok && all.seeds.length === 1 && all.seeds[0].id === 'seed:starbloom:B' && all.seeds[0].n === SEEDS_BACK, 'armed: rand 0 must upgrade ALL seeds one grade')
  ok(all.ok && all.spentDose && all.farm.charge === 3 && all.crops[0].id === 'crop:starbloom:C' && all.crops[0].n === 2, 'armed: spend exactly one dose, +1 crop, crop grade stays the seed grade')
  const none = harvest(f, 0, T0 + t, () => 0.95)
  ok(none.ok && none.seeds.length === 1 && none.seeds[0].id === 'seed:starbloom:C', 'armed: rand 0.95 must upgrade NONE')
  const mix = [0, 0.95]; let k = 0
  const half = harvest(f, 0, T0 + t, () => mix[k++])
  ok(half.ok && half.seeds.length === 2 && half.seeds.some(s => s.id === 'seed:starbloom:B') && half.seeds.some(s => s.id === 'seed:starbloom:C'), 'armed: each seed rolls independently')
  // S stays S; every grade steps by exactly one
  const s = armedFarm(planted('goldleaf', 'S')), hs = harvest(s, 0, T0 + CROPS.goldleaf.growMs, () => 0)
  ok(hs.ok && hs.seeds.every(x => x.id === 'seed:goldleaf:S'), 'grade: S went above S')
  GRADES.forEach((g, i) => {
    const hg = harvest(armedFarm(planted('goldleaf', g)), 0, T0 + CROPS.goldleaf.growMs, () => 0)
    ok(hg.ok && hg.seeds[0].id === seedId('goldleaf', GRADES[Math.min(i + 1, 4)]), `grade: ${g} did not step exactly one`)
  })
  // the rate over a batch
  const rnd = seeded(12345); let up = 0, total = 0
  for (let i = 0; i < 1000; i++) {
    const r = harvest(armedFarm(planted('goldleaf', 'D')), 0, T0 + CROPS.goldleaf.growMs, rnd)
    if (r.ok) for (const x of r.seeds) { total += x.n; if (x.id.endsWith(':C')) up += x.n }
  }
  const rate = up / total
  ok(total === 1000 * SEEDS_BACK && rate > 0.85 && rate < 0.95, `rate: upgrade rate ${rate.toFixed(3)} not about ${SEED_UPGRADE_RATE}`)
  // armed state is read live: unarmed farm, a bed one armed-tick short is not ready, once armed it is
  const live = planted('goldleaf'), tt = CROPS.goldleaf.growMs * ARMED_GROWTH_MULT
  ok(!harvest(live, 0, T0 + tt, () => 0).ok && harvest(armedFarm(live), 0, T0 + tt, () => 0).ok, 'armed: evaluated live at harvest')
}
// the composter
{
  const f = newFarm(1)
  ok(!isArmed(f) && !isArmed(compost(f, [{ id: 'x', n: DOSE_COST - 1 }]).farm) && isArmed(compost(f, [{ id: 'x', n: DOSE_COST }]).farm), 'composter: arming threshold is one dose')
  const c = compost(f, [{ id: 'goldleaf', n: 30 }, { id: 'crop:x:D', n: 30 }, { id: 'rock', n: 5 }])
  ok(c.farm.charge === CHARGE_CAP, 'composter: did not cap at CHARGE_CAP')
  ok(c.refused.reduce((a, r) => a + r.n, 0) === 65 - CHARGE_CAP && c.refused.some(r => r.id === 'rock' && r.n === 5), 'composter: refused list wrong when full')
  ok(compost(c.farm, [{ id: 'y', n: 3 }]).refused[0]?.n === 3 && compost(f, [{ id: 'y', n: 0 }]).farm.charge === 0, 'composter: full/zero feed wrong')
}
// ids
{
  for (const c of Object.keys(CROPS) as CropId[]) for (const g of GRADES) {
    ok(baseOf(seedId(c, g)) === c && baseOf(cropId(c, g)) === c, `baseOf: ${c}/${g}`)
    const p = parseGraded(cropId(c, g)); ok(!!p && p.kind === 'crop' && p.crop === c && p.grade === g, `parseGraded: ${c}/${g}`)
  }
  ok(seedId('starbloom', 'C') === 'seed:starbloom:C' && cropId('starbloom', 'C') === 'crop:starbloom:C', 'ids: shape')
  for (const j of ['', 'seed', 'seed:starbloom', 'seed:starbloom:Z', 'seed:starbloom:c', 'bag:starbloom:D', 'seed:nope:D', 'seed:starbloom:D:x', 'seed:toString:D', 'seed:__proto__:D'])
    ok(parseGraded(j) === null && baseOf(j) === null, `parseGraded: accepted junk "${j}"`)
}
console.log(`farming: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
