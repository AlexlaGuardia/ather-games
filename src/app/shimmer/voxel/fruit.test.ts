// The two wild fruit bushes (2026-09-15). Run: npx tsx src/app/shimmer/voxel/fruit.test.ts
//
// ★ WHY THIS EXISTS: `shimmer_salve` and `bond_philter` sat behind the cauldron's "not in this
// world" refusal for a month because nothing grew Sunfruit or Moonberry, and the refusal is
// DERIVED from the registry drops — so the day a registry row for the bush goes missing, the two
// brews go dark again with nothing in the code looking wrong. This file asks the derived question
// (is the fruit obtainable?) rather than the registry one (is there a row?), and it asks the field
// where the bushes stand, so a ground table edit that strands one fruit shows up here.
import { inWorld } from '../voxel3d/obtainable'
import { fruitAt, FRUIT_OF_GROUND, FRUIT_MATS, FRUIT_DENSITY, plantMaterialAt, FLORA_MATERIALS, FLORA_KIND_COUNT } from './flora'
import { MAT, isFruit, isPlant } from './depth'
import { greyness, biomeAt, type BiomeId } from './biome'
import { columnHeight } from './height'
import { DEFAULT_DEPTH } from './depth'
import { POTION_DEFS } from '../engine/alchemy'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }
const SEED = 1337

// ── 1. both fruit are in the world, by derivation ───────────────────────────────────────────────
ok(inWorld('sunfruit'), 'sunfruit is obtainable in the voxel world')
ok(inWorld('moonberry'), 'moonberry is obtainable in the voxel world')
for (const d of Object.values(POTION_DEFS as Record<string, { id: string; recipe: { itemId: string }[] }>)) {
  if (d.id !== 'shimmer_salve' && d.id !== 'bond_philter') continue
  const missing = d.recipe.filter(r => !inWorld(r.itemId)).map(r => r.itemId)
  ok(missing.length === 0, `${d.id} has every ingredient in-world (missing: ${missing.join(', ')})`)
}

// ── 2. the ranges agree ─────────────────────────────────────────────────────────────────────────
ok(isFruit(MAT.SUNFRUIT_BUSH) && isFruit(MAT.MOONBERRY_BUSH), 'both bushes are in the fruit range')
ok(isPlant(MAT.SUNFRUIT_BUSH) && isPlant(MAT.MOONBERRY_BUSH), 'both bushes answer isPlant (or they are solid cubes)')
ok(!isFruit(MAT.CAULDRON_LIT), 'the range starts after the last station')
ok(FRUIT_MATS.every(m => FLORA_MATERIALS.has(m)), 'both fruit materials are in the atlas exemption')
ok(FLORA_KIND_COUNT === FLORA_MATERIALS.size, `kind count and material set agree (${FLORA_KIND_COUNT} vs ${FLORA_MATERIALS.size})`)

// ── 3. the field: only on its ground, rare, in patches, never on drained ground ────────────────
const grounds = ['meadow', 'basin', 'woodland', 'shore', 'highland', 'crag', 'river', 'greyfield'] as BiomeId[]
for (const g of grounds) {
  const want = FRUIT_OF_GROUND[g] ?? 0
  let n = 0, wrong = 0, N = 0
  for (let z = 0; z < 600; z += 2) for (let x = 0; x < 600; x += 2) {
    N++
    const m = fruitAt(x, z, SEED, g)
    if (m) { n++; if (m !== want) wrong++ }
  }
  if (want) ok(n > 0 && wrong === 0, `${g} grows only its own fruit (${n} bushes, ${wrong} wrong)`)
  else ok(n === 0, `${g} grows no fruit (${n})`)
  if (want) ok(n / N < FRUIT_DENSITY * 0.5, `${g}: patches keep bushes rare (${((100 * n) / N).toFixed(2)}% of cells)`)
}
// Drained ground: find grey cells and assert none fruit.
let greyN = 0, greyFruit = 0
for (let z = -1500; z < 2500; z += 8) for (let x = -2500; x < 1500; x += 8) {
  if (greyness(x, z, SEED) < 0.35) continue
  greyN++
  for (const g of Object.keys(FRUIT_OF_GROUND) as BiomeId[]) if (fruitAt(x, z, SEED, g)) greyFruit++
}
ok(greyN > 50 && greyFruit === 0, `a greyfield grows no fruit (${greyFruit} on ${greyN} grey cells)`)

// ── 4. through the generator's own resolver: bushes exist in the real world at a findable rate ─
let sun = 0, moon = 0, cells = 0
for (let z = -1200; z <= 2800; z += 6) for (let x = -2600; x <= 1200; x += 6) {
  cells++
  const h = columnHeight(x, z, SEED)
  const m = plantMaterialAt(x, z, SEED, biomeAt(x, z, SEED, h, DEFAULT_DEPTH.seaLevel))
  if (m === MAT.SUNFRUIT_BUSH) sun++
  if (m === MAT.MOONBERRY_BUSH) moon++
}
ok(sun > 20 && moon > 20, `both fruit stand in the world (${sun} sunfruit, ${moon} moonberry bushes in ${cells} sampled cells)`)
ok(sun / cells < 0.01 && moon / cells < 0.01, 'and neither is common enough to be filler')

console.log(`\nfruit: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the two fruit bushes stand where they should and feed the two brews')
