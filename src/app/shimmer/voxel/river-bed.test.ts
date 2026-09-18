// ── THE RIVER BED GROWS NOTHING, AND THE BANK IS THE RIVER'S GROUND (2026-09-18) ────────────────
// Before this, `generatedAt`'s waterline gate read the SEA level only, so every river-channel cell
// (wet by construction) grew a plant voxel in its surface WATER cell: invisible to the renderer,
// and a hole plus a rim face in the water sheet for the mesher. Held from both sides here, through
// the generator — the field is what WOULD grow; the generator is what does.
import { columnHeight, riverField, riverness, SHORE_RN, waterSurfaceAt, riverCarve, riverFlowAt } from './height'
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

void AIR

// ── ★ THE ONE PLANT THAT STANDS IN THE WATER STANDS AT h+2 (2026-09-18, RULED: WAKEREED) ────────
// The gate above says nothing grows in the surface water cell; the Wakereed grows in the AIR cell
// over it, on the shallow shoulder only (one water cell over the bed), where the water moves. Held
// through the generator: the field says where it WOULD stand; this is where it does.
{
  let reeds = 0, atH1 = 0, notShoulder = 0, notOverWater = 0, notUnderAir = 0, still = 0, carveNot1 = 0
  for (let z = 1900; z < 2200; z++) for (let x = 200; x < 500; x++) {
    const rn = riverness(riverField(x, z, SEED))
    if (rn <= 0) continue
    const h = columnHeight(x, z, SEED)
    if (generatedAt(x, h + 1, z, SEED, h) === MAT.WAKEREED) atH1++
    if (generatedAt(x, h + 2, z, SEED, h) !== MAT.WAKEREED) continue
    reeds++
    if (materialAt(x, h + 1, z, SEED, h) !== MAT.WATER) notOverWater++
    if (materialAt(x, h + 2, z, SEED, h) !== AIR) notUnderAir++
    if (waterSurfaceAt(x, z, SEED) !== h + 1) notShoulder++
    if (riverCarve(x, z, SEED) !== 1) carveNot1++
    const [fx, fz] = riverFlowAt(x, z, SEED)
    if (fx === 0 && fz === 0) still++
  }
  ok(reeds > 50, `★ wakereed stands in the river (${reeds} on the 300² stretch)`)
  ok(atH1 === 0, `★★★ never in the surface water cell — the sheet stays whole (${atH1} at h+1)`)
  ok(notOverWater === 0, `★★ every reed stands over exactly one water cell (${notOverWater} did not)`)
  ok(notUnderAir === 0, `★ every reed's own cell is air by the fill rule (${notUnderAir} were not)`)
  ok(notShoulder === 0, `★ every reed stands where the water is one cell deep (${notShoulder} deeper)`)
  ok(carveNot1 === 0 && still === 0, `★ never mid-channel, never still: carve 1 and a flow at every reed (${carveNot1} / ${still})`)
}

console.log(`river-bed: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
