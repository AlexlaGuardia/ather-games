// seed-back oracle — a harvest hands the crop's own seed back, so a farm can close its loop (2026-09-18).
// Run: npx tsx src/app/shimmer/engine/seed-back.test.ts
import { harvestCrop, seedBackBonusChance, SEED_BACK_BASE, SEED_BACK_BONUS, SEED_BACK_BONUS_CAP, type PlantedCrop } from './farming'
import { createInventory, countItem } from './inventory'
import { createSkillSet } from './skills'
import { CROP_DEFS, CROP_IDS } from '../voxel/crops'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { c ? pass++ : fails.push(m) }
const ripe = (cropId: string): PlantedCrop => ({ id: 't', cropId, tileX: 0, tileY: 0, zoneId: 'plot', plantedAt: 0, growthDuration: 1 })

for (const id of CROP_IDS) {
  const def = CROP_DEFS[id]
  if (def.bloomsSpirit) continue
  // worst roll: every chance fails → still exactly one seed back
  { const inv = createInventory(); const sk = createSkillSet(); sk.farming.level = def.minFarmingLevel
    const got = harvestCrop(ripe(id), inv, sk, 0, 1, () => 0.999)
    ok(countItem(inv, def.seedItemId) === SEED_BACK_BASE, `${id}: a bad roll still returns one seed (${countItem(inv, def.seedItemId)})`)
    ok(got.items[got.items.length - 1]?.itemId === def.seedItemId, `${id}: the seed is the LAST item in the toast, after the produce`) }
  // best roll: the second seed lands
  { const inv = createInventory(); const sk = createSkillSet(); sk.farming.level = def.minFarmingLevel
    harvestCrop(ripe(id), inv, sk, 0, 1, () => 0.0)
    ok(countItem(inv, def.seedItemId) === SEED_BACK_BASE + 1, `${id}: a good roll returns two`) }
}
// the bloom pays a spirit, never a seed
{ const inv = createInventory(); const sk = createSkillSet(); sk.farming.level = 99
  const got = harvestCrop(ripe('manabloom'), inv, sk, 0, 1, () => 0.0)
  ok(got.items.length === 0 && countItem(inv, CROP_DEFS.manabloom.seedItemId) === 0, 'the Mana Bloom hands back no seed — canon mints those') }
// the bonus ladder: base at the crop's level, +2%/level, capped
ok(seedBackBonusChance(0) === SEED_BACK_BONUS, 'at the crop\'s own level the second seed is the base chance')
ok(seedBackBonusChance(5) > seedBackBonusChance(0), 'a level above helps')
ok(seedBackBonusChance(99) === SEED_BACK_BONUS_CAP, 'and it caps')
ok(seedBackBonusChance(-3) === SEED_BACK_BONUS, 'below the crop\'s level is clamped, never negative')

if (fails.length) { console.log(fails.map(f => `  ✗ ${f}`).join('\n')); console.log(`❌ seed-back ${fails.length} failed, ${pass} passed`); process.exit(1) }
console.log(`✅ seed-back ${pass}/0`)
