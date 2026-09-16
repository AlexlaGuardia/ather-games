// The wild forage — puff clusters and glow-moss (2026-09-16). Run: npx tsx src/app/shimmer/voxel/forage.test.ts
//
// ★ WHY THIS EXISTS: the same shape as `fruit.test.ts`, for the same reason. The cauldron's
// "not in this world" gate is DERIVED from registry drops, so a missing row darkens whatever brew
// takes a spore or a moss the day one exists, with nothing in the code looking wrong. This asks
// the derived question (obtainable?) and then the field (where do they stand, and in what shape?),
// so a ground-table edit that strands one shows up here — and so the moss's RIBBON shape, which is
// canon's *"marks paths at night"* made mechanical, cannot quietly become a blob.
import { inWorld } from '../voxel3d/obtainable'
import { forageAt, FORAGE_OF_GROUND, FORAGE_MATS, PUFF_DENSITY, plantMaterialAt, FLORA_MATERIALS, FLORA_KIND_COUNT, FLORA } from './flora'
import { MAT, isForage, isPlant, isSolid, DEFAULT_DEPTH } from './depth'
import { greyness, biomeAt, type BiomeId } from './biome'
import { columnHeight } from './height'
import { BLOCKS } from './registry'
import { ITEMS } from '../sprites/items'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }
const SEED = 1337

// ── 1. both drops are in the world, by derivation, and are real items ─────────────────────────
ok(inWorld('puff_spores'), 'puff spores are obtainable in the voxel world')
ok(inWorld('glow_moss'), 'glow-moss is obtainable in the voxel world')
for (const id of ['puff_spores', 'glow_moss']) ok(ITEMS.some(i => i.id === id), `${id} has an ItemDef (the bag can name and draw it)`)

// ── 2. the ranges agree ────────────────────────────────────────────────────────────────────────
ok(isForage(MAT.PUFF_CLUSTER) && isForage(MAT.GLOW_MOSS), 'both are in the forage range')
ok(isPlant(MAT.PUFF_CLUSTER) && isPlant(MAT.GLOW_MOSS), 'both answer isPlant (or they are solid cubes)')
ok(!isSolid(MAT.PUFF_CLUSTER) && !isSolid(MAT.GLOW_MOSS), 'neither is walk-into solid (the invisible-fence bug)')
ok(!isForage(MAT.KILN), 'the range starts after the kiln')
ok(FORAGE_MATS.every(m => FLORA_MATERIALS.has(m)), 'both forage materials are in the atlas exemption')
ok(FLORA_KIND_COUNT === FLORA_MATERIALS.size, `kind count and material set agree (${FLORA_KIND_COUNT} vs ${FLORA_MATERIALS.size})`)
ok((FLORA.PUFF as number) !== (FLORA.MOSS as number) && FLORA.PUFF > FLORA.FRUIT && FLORA.MOSS > FLORA.FRUIT, 'the two kinds have their own slots after FRUIT')

// ── 3. the moss emits; the puff does not ───────────────────────────────────────────────────────
const row = (m: number) => BLOCKS.find(b => b.material === m)
ok((row(MAT.GLOW_MOSS)?.emit ?? 0) > 0, 'glow-moss carries a light channel — "marks paths at night" is mechanical, not a render tint')
ok((row(MAT.GLOW_MOSS)?.emit ?? 0) < 7, 'and dimmer than a waymark — a path, not a lamp')
ok(!row(MAT.PUFF_CLUSTER)?.emit, 'a puff cluster does not glow')
ok(row(MAT.GLOW_MOSS)?.placeable === false && row(MAT.PUFF_CLUSTER)?.placeable === false, 'neither is placeable — the drop is the ingredient')

// ── 4. the field: only on its ground, never on drained ground ──────────────────────────────────
const grounds = ['meadow', 'basin', 'woodland', 'shore', 'highland', 'crag', 'river', 'greyfield'] as BiomeId[]
for (const g of grounds) {
  const want = new Set(FORAGE_OF_GROUND[g] ?? [])
  const seen = new Map<number, number>()
  let N = 0
  for (let z = 0; z < 600; z += 2) for (let x = 0; x < 600; x += 2) {
    N++
    const m = forageAt(x, z, SEED, g)
    if (m) seen.set(m, (seen.get(m) ?? 0) + 1)
  }
  const wrong = [...seen.keys()].filter(m => !want.has(m))
  ok(wrong.length === 0, `${g} grows only its own forage (wrong: ${wrong.join(',')})`)
  for (const m of want) ok((seen.get(m) ?? 0) > 0, `${g} actually grows ${m === MAT.GLOW_MOSS ? 'glow-moss' : 'puff clusters'}`)
  if (want.has(MAT.PUFF_CLUSTER)) {
    const n = seen.get(MAT.PUFF_CLUSTER) ?? 0
    ok(n / N < PUFF_DENSITY * 0.5, `${g}: patches keep puffs rare (${((100 * n) / N).toFixed(2)}% of cells)`)
  }
  if (want.has(MAT.GLOW_MOSS)) {
    const n = seen.get(MAT.GLOW_MOSS) ?? 0
    ok(n / N < 0.05, `${g}: the moss is a ribbon, not a carpet (${((100 * n) / N).toFixed(2)}% of cells)`)
  }
}
let greyN = 0, greyForage = 0
for (let z = -1500; z < 2500; z += 8) for (let x = -2500; x < 1500; x += 8) {
  if (greyness(x, z, SEED) < 0.35) continue
  greyN++
  for (const g of Object.keys(FORAGE_OF_GROUND) as BiomeId[]) if (forageAt(x, z, SEED, g)) greyForage++
}
ok(greyN > 50 && greyForage === 0, `a greyfield grows no forage (${greyForage} on ${greyN} grey cells)`)

// ── 5. the moss is a RIBBON: its cells are connected, not scattered ────────────────────────────
// A contour band is a line: nearly every moss cell has another moss cell within two cells of it.
// Uniform scatter at the same density would leave most cells alone. This is the shape assert.
{
  const cells = new Set<string>()
  for (let z = 0; z < 400; z++) for (let x = 0; x < 400; x++) if (forageAt(x, z, SEED, 'woodland') === MAT.GLOW_MOSS) cells.add(`${x},${z}`)
  let joined = 0
  for (const k of cells) {
    const [x, z] = k.split(',').map(Number)
    let near = false
    for (let dz = -2; dz <= 2 && !near; dz++) for (let dx = -2; dx <= 2 && !near; dx++) {
      if ((dx || dz) && cells.has(`${x + dx},${z + dz}`)) near = true
    }
    if (near) joined++
  }
  ok(cells.size > 100, `enough moss to judge the shape (${cells.size} cells in 400²)`)
  ok(joined / cells.size > 0.9, `the moss runs in lines — ${((100 * joined) / cells.size).toFixed(0)}% of cells have a neighbour within 2`)
}

// ── 6. through the generator's own resolver: both stand in the real world at a findable rate ───
let puff = 0, moss = 0, cells = 0
for (let z = -1200; z <= 2800; z += 6) for (let x = -2600; x <= 1200; x += 6) {
  cells++
  const h = columnHeight(x, z, SEED)
  const m = plantMaterialAt(x, z, SEED, biomeAt(x, z, SEED, h, DEFAULT_DEPTH.seaLevel))
  if (m === MAT.PUFF_CLUSTER) puff++
  if (m === MAT.GLOW_MOSS) moss++
}
ok(puff > 20 && moss > 20, `both stand in the world (${puff} puff clusters, ${moss} moss in ${cells} sampled cells)`)
ok(puff / cells < 0.01 && moss / cells < 0.02, 'and neither is common enough to be filler')

console.log(`\nforage: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the forage stands where it should: puffs in huddles, moss in ribbons')
