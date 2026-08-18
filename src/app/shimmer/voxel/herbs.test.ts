// The element-herb oracle. Run: npx tsx src/app/shimmer/voxel/herbs.test.ts
//
// Canon ruled these on 2026-08-18 (`game/shimmer-geography.md` › *★ WHERE THE FOUR ELEMENT HERBS
// GROW*, `game/alchemy.md` › *The four element herbs grow WILD*), and this file exists because a
// canon transcription is the one kind of build code that CANNOT be checked by playing: a Rootvine
// on a crag looks perfectly fine in the world and is wrong in the books. The rows below are the
// ruling, restated in the one place a future edit will trip over them.
//
// The ruling's own warning is the shape of the risk: **read the ground, not the element.** The
// obvious table — Earth herb → crag, because rock — is the one canon explicitly refuses, and it
// names Rootvine as the test case. Section 2 is that refusal, held.

import { herbAt, HERB_OF_GROUND, HERB_GROUND, plantMaterialAt, floraAt, FLORA, HERB_EDGE } from './flora'
import { MAT, isPlant, isHerb, HERB_MIN, HERB_MAX, PLANT_MIN, PLANT_MAX } from './depth'
import { biomeAt, type BiomeId } from './biome'
import { columnHeight } from './height'
import { generatedAt } from './column'
import { AIR } from './section'
import { DEFAULT_DEPTH } from './depth'
import { BLOCKS } from './registry'

const SEED = 1337
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const GROUNDS: BiomeId[] = ['basin', 'shore', 'river', 'greyfield', 'crag', 'highland', 'woodland', 'meadow']

// ── 1. ★ CANON'S FOUR ASSIGNMENTS, TRANSCRIBED ─────────────────────────────────────────────────
{
  ok(HERB_OF_GROUND.basin === MAT.VIOLETBLOOM, 'Violetbloom → basin (it hums; a sound needs stillness)')
  ok(HERB_OF_GROUND.highland === MAT.STORMGRASS, 'Stormgrass → highland (crackles in still air; unbroken sky)')
  ok(HERB_OF_GROUND.woodland === MAT.ROOTVINE, 'Rootvine → woodland (anchors deep; forest floor is the deep ground)')
  ok(HERB_OF_GROUND.shore === MAT.TIDEPETAL, 'Tidepetal → shore (beaded from the air; a river would scour it)')
  ok(Object.keys(HERB_OF_GROUND).length === 4, 'exactly four grounds carry a herb')
  // The two tables are each other's inverse. Kept as two because they answer opposite questions in
  // opposite hot paths; asserted so they cannot drift into disagreeing about a ruling.
  for (const [mat, ground] of Object.entries(HERB_GROUND)) {
    ok(HERB_OF_GROUND[ground] === Number(mat), `${ground} ⇄ ${mat}: the two herb tables agree`)
  }
}

// ── 2. ★★ THE LOOKUP CANON REFUSES — this is the ruling's own test case ────────────────────────
// *"the lookup would have put the Earth herb on rock. Rock has no depth."* If someone ever
// "corrects" the table by element, this is the assert that stops them.
{
  ok(HERB_OF_GROUND.crag === undefined,
    '★ the CRAG grows nothing — the Earth herb is NOT on rock, which is the ruling\'s named test case')
  ok(HERB_OF_GROUND.river === undefined, 'the RIVER grows nothing — moving water scours a beaded flower')
  ok(HERB_OF_GROUND.meadow === undefined, 'the MEADOW grows none of them — it is what a farm is made of')
  ok(HERB_OF_GROUND.greyfield === undefined, 'and the GREYFIELD grows nothing at all')
  ok(HERB_OF_GROUND.highland !== MAT.ROOTVINE && HERB_OF_GROUND.woodland === MAT.ROOTVINE,
    'Rootvine wants depth, and depth is old forest floor')
}

// ── 3. ⚠ NO FORAGE OF ANY KIND IN A GREYFIELD, EVER, BEFORE THE FREEING ────────────────────────
// Canon, not a dial: the barrenness IS the campaign readable in the landscape. Held twice over —
// the biome allowlist refuses the label, and the field refuses drained ground before the label even
// flips, because the fringe greys before the name changes.
{
  ok(herbAt(10, 10, SEED, 'greyfield') === 0, 'a greyfield hands over nothing, whatever the roll')
  let greyHerbs = 0, checked = 0
  for (let x = -3000; x < 3000; x += 37) for (let z = -3000; z < 3000; z += 41) {
    const h = columnHeight(x, z, SEED)
    const b = biomeAt(x, z, SEED, h, DEFAULT_DEPTH.seaLevel)
    if (b !== 'greyfield') continue
    checked++
    if (plantMaterialAt(x, z, SEED, b) !== 0 && isHerb(plantMaterialAt(x, z, SEED, b))) greyHerbs++
  }
  ok(checked > 50, `swept real greyfield country (${checked} columns)`)
  ok(greyHerbs === 0, `★ not one herb in ${checked} greyfield columns — canon, not a dial`)
}

// ── 4. a herb only ever grows on ITS ground ────────────────────────────────────────────────────
// The allowlist stated as behaviour rather than as a table read: for every ground, whatever grows
// there is either that ground's own herb or not a herb at all.
{
  let wrong = 0, found = 0
  for (const g of GROUNDS) {
    for (let x = 0; x < 4000; x += 7) {
      const m = herbAt(x, x * 3 + 11, SEED, g)
      if (!m) continue
      found++
      if (m !== HERB_OF_GROUND[g]) wrong++
    }
  }
  ok(found > 0, `herbs do actually turn up in a sweep (${found} hits)`)
  ok(wrong === 0, 'every herb found is the one canon puts on that ground — no cross-contamination')
}

// ── 5. ★ A HERB IS A PLANT, and the second range is why that needed asserting ──────────────────
// `isPlant` became two ranges when the herbs arrived (24-26 could not be extended: 27-30 are the
// pot and the chest, and a material id is written into every save). Anything that treated "plant"
// as one span is wrong from that day, and it would fail SILENTLY — a solid, opaque, unmowable herb.
{
  for (const m of [MAT.VIOLETBLOOM, MAT.STORMGRASS, MAT.ROOTVINE, MAT.TIDEPETAL]) {
    ok(isPlant(m), `${m} answers isPlant — the mesher, the walker and the light field all ask it`)
    ok(isHerb(m), `${m} answers isHerb`)
  }
  ok(HERB_MAX - HERB_MIN === 3, 'the herb range is exactly four wide')
  ok(!isHerb(PLANT_MIN) && !isHerb(PLANT_MAX), 'grass is not a herb')
  ok(isPlant(MAT.TUFT) && isPlant(MAT.FLOWER), 'and grass is still a plant')
  // ⚠ The gap between the ranges must stay non-plant: 27-30 are the pot's three states and the
  // chest. A range test that accidentally spanned them would make a chest see-through and walkable.
  for (let m = PLANT_MAX + 1; m < HERB_MIN; m++) {
    ok(!isPlant(m), `${m} (between the two ranges) is NOT a plant — the pot and the chest live here`)
  }
}

// ── 6. ★ A HERB OUTRANKS GRASS ON ITS OWN CELL ─────────────────────────────────────────────────
// Its ground is ordinary living country — a basin is grass — so if the grass field answered first, a
// patch would come up mostly tufts with a herb here and there: the patch would exist in the field
// and not on the ground.
{
  let contested = 0, won = 0
  for (let x = 0; x < 60000; x += 13) {
    const z = x * 7 + 3
    const herb = herbAt(x, z, SEED, 'basin')
    if (!herb) continue
    contested++
    if (plantMaterialAt(x, z, SEED, 'basin') === herb) won++
  }
  ok(contested > 20, `found contested cells (${contested})`)
  ok(won === contested, 'a herb wins its own cell every time, grass roll or not')
}

// ── 7. no ground given ⇒ no herbs, and grass is untouched ──────────────────────────────────────
// `ground` is optional because only the generator can answer it (it holds the column height that
// `biomeAt` needs). Its absence must mean "no herbs", never "guess" — a default of "assume meadow"
// would be the same trap as a denylist.
{
  let differs = 0
  for (let x = 0; x < 8000; x += 3) {
    const z = x * 5 + 1
    const bare = plantMaterialAt(x, z, SEED)
    const f = floraAt(x, z, SEED)
    const expect = !f ? 0 : f.kind === FLORA.TUFT ? MAT.TUFT : f.kind === FLORA.TALL ? MAT.TALL_GRASS : MAT.FLOWER
    if (bare !== expect) differs++
    if (isHerb(bare)) differs++
  }
  ok(differs === 0, 'without a ground, plantMaterialAt is exactly the grass field it always was')
}

// ── 8. patches are PLACES, not speckles ────────────────────────────────────────────────────────
// Canon called a herb *"a reason to travel"*; the build's answer is its own low-frequency field, the
// same idea flower drifts use one scale down. Asserted as clustering, not as a density number —
// rarity and patch size are explicitly mine to tune and this must not fight a balance pass.
{
  const hits: { x: number; z: number }[] = []
  for (let x = -1500; x < 1500; x += 2) for (let z = -1500; z < 1500; z += 2) {
    if (herbAt(x, z, SEED, 'woodland')) hits.push({ x, z })
  }
  ok(hits.length > 40, `Rootvine turns up across woodland country (${hits.length} in the sample)`)
  // A clustered field puts most hits near another hit; a uniform scatter at this density would not.
  const near = hits.filter(a => hits.some(b => a !== b && Math.abs(a.x - b.x) <= 8 && Math.abs(a.z - b.z) <= 8))
  ok(near.length > hits.length * 0.5,
    `herbs cluster into patches (${near.length}/${hits.length} have a neighbour within 8 blocks)`)
  ok(HERB_EDGE > 0.72, 'and a herb patch opens LESS often than a flower drift (0.72) — it is the rarer thing')
}

// ── 9. every herb block drops the item the infusion recipe names ───────────────────────────────
// The whole point of the ruling: `engine/alchemy.ts` names four item ids, and until today nothing in
// this world produced them. A block that dropped `violetbloom` instead of `violetbloom_petal` would
// look completely correct in the world and leave the cauldron exactly as dead as it was.
{
  const want: Record<number, string> = {
    [MAT.VIOLETBLOOM]: 'violetbloom_petal',
    [MAT.STORMGRASS]: 'stormgrass_blade',
    [MAT.ROOTVINE]: 'rootvine_coil',
    [MAT.TIDEPETAL]: 'tidepetal_bloom',
  }
  for (const [mat, item] of Object.entries(want)) {
    const def = BLOCKS.find(b => b.material === Number(mat))
    ok(def !== undefined, `${item}: the block is registered`)
    ok(def?.drops.some(d => d.itemId === item) === true, `★ it drops '${item}', the id the recipe names`)
    ok(def?.skill === null, `${item}: picked by hand — canon grades an ingredient by WHERE, never by what with`)
  }
}

// ── 10. the world really does grow all four ────────────────────────────────────────────────────
// The end-to-end fact, asserted against the REAL generator rather than the field in isolation: walk
// enough country and every one of canon's four is standing in it. This is the assert that fails if a
// ground exists in the table but never occurs on the map.
{
  // ⚠ ASKS `generatedAt`, NOT THE FIELD. The field is what WOULD grow; the generator is what does,
  // and between them sits the waterline gate — which is precisely where the first cut of this
  // feature put the flagship Mana herb on a lake bed. A field-only assert passed that happily.
  const seen = new Set<number>()
  for (let x = -6000; x < 6000 && seen.size < 4; x += 11) {
    for (let z = -6000; z < 6000 && seen.size < 4; z += 13) {
      const h = columnHeight(x, z, SEED)
      const m = generatedAt(x, h + 1, z, SEED, h)
      if (isHerb(m)) seen.add(m)
    }
  }
  for (const [mat, name] of [[MAT.VIOLETBLOOM, 'Violetbloom'], [MAT.STORMGRASS, 'Stormgrass'],
                             [MAT.ROOTVINE, 'Rootvine'], [MAT.TIDEPETAL, 'Tidepetal']] as const) {
    ok(seen.has(mat), `★ ${name} actually grows somewhere in the real world, not just in the table`)
  }
}

// ── 11. ★★ THE FOUR ARE COMPARABLY FINDABLE — the ratio, not the numbers ───────────────────────
// The bug this exists to prevent shipped for about ten minutes: at one flat density, Rootvine was
// **187× more common than Tidepetal**, because woodland is 13.6% of the land near spawn and shore is
// 0.6%. Canon makes all four the same tier at the same cost, so a player finding the Water Infusion
// impossible and the Earth one trivial would have been reading terrain frequency as game design.
//
// ⚠ ASSERTS THE RATIO, NOT THE DENSITIES. `HERB_TUNE` is mine to move and a terrain change can shift
// this without anyone touching flora.ts — so this fails when the four fall OUT OF BALANCE, which is
// the actual invariant, and stays quiet through ordinary tuning.
{
  const count: Record<number, number> = {
    [MAT.VIOLETBLOOM]: 0, [MAT.STORMGRASS]: 0, [MAT.ROOTVINE]: 0, [MAT.TIDEPETAL]: 0,
  }
  for (let x = -800; x < 800; x += 4) for (let z = -800; z < 800; z += 4) {
    const h = columnHeight(x, z, SEED)
    // Through the GENERATOR, so the waterline gate counts: a submerged Violetbloom is not a
    // Violetbloom a player can pick, and balancing against one would hide the whole problem.
    const m = generatedAt(x, h + 1, z, SEED, h)
    if (isHerb(m)) count[m]++
  }
  const found = Object.values(count)
  ok(found.every(n => n > 0), `every herb turns up in one sweep — ${JSON.stringify(count)}`)
  const spread = Math.max(...found) / Math.max(1, Math.min(...found))
  ok(spread <= 4, `★ the four are within 4× of each other (${spread.toFixed(1)}×) — nobody's element is `
    + 'secretly the hard one. Was 187× before HERB_TUNE compensated for ground frequency.')
}

// ── 12. ★★ NOTHING GROWS UNDER WATER — found by walking there, not by reading ─────────────────
// The generator's plant branch OVERWRITES whatever the depth rule would have put at h+1, water
// included, and it had no waterline gate at all. So every submerged column in the world was growing
// tufts and flowers on its bed — invisible (the renderer demands topsoil with air above), real in the
// save, breakable by a swimmer. Nobody had seen it in the months grass has existed.
//
// ★ IT ONLY BECAME LOAD-BEARING WITH THE HERBS: this build's `basin` is `h <= seaLevel`, and 82% of
// it is lake bed — so canon's Violetbloom, placed on the basin for *"low, sheltered, the air
// standing"*, generated underwater. I found it by teleporting to the densest patch for a screenshot
// and arriving neck-deep in a lake. **A field assert cannot catch this; only the generator can.**
{
  let wetPlants = 0, wetChecked = 0, dryPlants = 0
  for (let x = -1200; x < 1200; x += 5) for (let z = -1200; z < 1200; z += 5) {
    const h = columnHeight(x, z, SEED)
    const m = generatedAt(x, h + 1, z, SEED, h)
    if (h < DEFAULT_DEPTH.seaLevel) { wetChecked++; if (m !== AIR && isPlant(m)) wetPlants++ }
    else if (isPlant(m)) dryPlants++
  }
  ok(wetChecked > 200, `swept real submerged country (${wetChecked} columns under the waterline)`)
  ok(wetPlants === 0, `★ not one plant of any kind below the waterline (${wetPlants}) — grass and herbs alike`)
  ok(dryPlants > 500, `and dry ground is still green (${dryPlants} plants) — the gate did not mow the world`)
  // The rim survives, which is the whole reason Violetbloom still has a home: a basin's dry edge at
  // exactly sea level is the sheltered margin of a pool, and that IS canon's sentence.
  let rim = 0
  for (let x = -1200; x < 1200; x += 3) for (let z = -1200; z < 1200; z += 3) {
    const h = columnHeight(x, z, SEED)
    if (h !== DEFAULT_DEPTH.seaLevel) continue
    if (generatedAt(x, h + 1, z, SEED, h) === MAT.VIOLETBLOOM) rim++
  }
  ok(rim > 0, `★ Violetbloom grows on the dry rim of a basin (${rim} found) — it did not lose its ground`)
}

console.log(`element herbs: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
