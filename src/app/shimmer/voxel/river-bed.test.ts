// ── THE RIVER BED GROWS NOTHING, AND THE BANK IS THE RIVER'S GROUND (2026-09-18) ────────────────
// Before this, `generatedAt`'s waterline gate read the SEA level only, so every river-channel cell
// (wet by construction) grew a plant voxel in its surface WATER cell: invisible to the renderer,
// and a hole plus a rim face in the water sheet for the mesher. Held from both sides here, through
// the generator — the field is what WOULD grow; the generator is what does.
import { columnHeight, riverField, riverness, SHORE_RN, waterSurfaceAt } from './height'
import { generatedAt } from './column'
import { materialAt, MAT, isPlant, DEFAULT_DEPTH } from './depth'
import { biomeAt } from './biome'
import { AIR } from './section'

const SEED = 1337
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// The stretch by the meadow where the census found 846 plants standing in the water (of 1531).
let wet = 0, wetPlants = 0, wetNonWater = 0
let bank = 0, bankPlants = 0, bankStarbean = 0, bankGoldleaf = 0, bankWrongGround = 0
for (let z = 2016; z < 2064; z++) for (let x = 256; x < 448; x++) {
  const rn = riverness(riverField(x, z, SEED))
  if (rn <= 0) continue
  const h = columnHeight(x, z, SEED)
  const m = generatedAt(x, h + 1, z, SEED, h)
  if (rn >= SHORE_RN) {
    wet++
    if (isPlant(m)) wetPlants++
    // What the generator's own fill rule says should be there — water, or a pier/deck.
    if (m !== MAT.WATER && m !== materialAt(x, h + 1, z, SEED, h)) wetNonWater++
  } else {
    bank++
    if (isPlant(m)) bankPlants++
    if (m === MAT.STARBEAN) bankStarbean++
    if (m === MAT.GOLDLEAF) bankGoldleaf++
    if (biomeAt(x, z, SEED, h, DEFAULT_DEPTH.seaLevel) !== 'river') bankWrongGround++
  }
}
ok(wet > 1000, `the stretch is a real river (${wet} wet cells)`)
ok(wetPlants === 0, `★★★ no plant stands in a river's surface water cell (${wetPlants} of ${wet})`)
ok(wetNonWater === 0, `★★ every wet cell holds exactly what the fill rule puts there (${wetNonWater} differ)`)
ok(bank > 200, `the bank ribbon exists (${bank} dry cells with riverness > 0)`)
ok(bankWrongGround === 0, `★ every dry bank cell is 'river' ground (${bankWrongGround} were not)`)
ok(bankPlants > 0, `★ the bank grows (${bankPlants} plants on ${bank} cells)`)
ok(bankStarbean > 0, `★★ Starbean exists DRY — canon's river crop has a cell to stand on (${bankStarbean})`)
ok(bankGoldleaf > 0, `★ goldleaf's river row lands on the bank (${bankGoldleaf})`)

// ── The gate is the generator's material, not a water threshold: a wet cell is wet because
// waterSurfaceAt says so, and the plant branch must agree with that exact function.
{
  let agree = 0, total = 0
  for (let z = 2016; z < 2064; z += 3) for (let x = 256; x < 448; x += 3) {
    const h = columnHeight(x, z, SEED)
    const isWet = waterSurfaceAt(x, z, SEED) >= h + 1
    const m = generatedAt(x, h + 1, z, SEED, h)
    total++
    if (isWet ? !isPlant(m) : true) agree++
  }
  ok(agree === total, `★ generatedAt never plants where waterSurfaceAt is at or above h+1 (${agree}/${total})`)
}

console.log(`river-bed: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
void AIR
