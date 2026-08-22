// The meadow-seed oracle. Run: npx tsx src/app/shimmer/voxel/meadow-seed.test.ts
//
// ── WHAT THIS FILE USED TO BE, because the history is the lesson ────────────────────────────────
// This was `mana-seed.test.ts`, and it proved that grass could drop a wind-borne `mana_seed`. It was
// a good oracle about a thing canon retired underneath it: the 08-13 ruling ended the one-seed-that-
// rolls-1/10-at-the-pot model, so there are **ten** Mana Seeds and a seed already IS its species
// from the moment the Bloom cast it. A generic `mana_seed` therefore named something canon does not
// have — a category error, not a balance problem — and it survived nine days past its own retirement
// with `npm run canon` green throughout, because that gate diffs names and rosters and a retired
// item MODEL is neither.
//
// ⚠ THE ORACLE WAS NOT WRONG. Every assert in it was true of the code, and it had no way to ask the
// question that mattered. **A test proves the build does what it says; it cannot notice that the
// world stopped meaning it.** That is a different failure from a stale note or a blind gate and it
// is the one to remember: the file was green, correct, and about nothing.
//
// ── ★★★ RULED 2026-08-22 (/magii + Alex): a grass tuft yields a COMMON CROP SEED ────────────────
// The finding survives; only what is found changes. Canon *sanctions* the find — *"the randomness
// lives in the wind and in the finding"* — so deleting the drop would have removed the one place the
// build already did what canon endorses. See `voxel/meadow-seed.ts` for the fungal-Network reason
// this is more native than the thing it replaces.
import { dropsFor } from './mine'
import { MAT } from './depth'
import { blockDef, materialForItem } from './registry'
import { MEADOW_SEEDS, MEADOW_CROPS, MEADOW_SEED_CHANCE, isMeadowCrop } from './meadow-seed'
import { CROP_DEFS, ELEMENT_HERBS } from '../engine/farming'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const GRASSES = [MAT.TUFT, MAT.TALL_GRASS]

// ── 1. ★★ THE CANON CONSTRAINTS, ASSERTED AS EXCLUSIONS RATHER THAN AS A NAME LIST ──────────────
// The ruling permits common crop seeds and forbids two specific things. Asserting "the three names
// are shimmerwheat, glowroot, sunpetal" would go stale the day a tier-1 crop is added — and it would
// go stale SILENTLY IN THE PERMISSIVE DIRECTION, which is the one that ships a canon violation.
// So the exclusions are the asserts, and the names are merely reported.
{
  ok(MEADOW_SEEDS.length > 0, `the meadow yields something (${MEADOW_SEEDS.join(', ')})`)

  const herbCrops = new Set(Object.values(ELEMENT_HERBS).map(h => h.cropId))
  const herbLeak = MEADOW_CROPS.filter(id => herbCrops.has(id))
  ok(herbLeak.length === 0,
    `★★★ no element herb is ever handed out by grass — canon ruled their ground, and grass would undo it (leaked: ${herbLeak.join(', ') || 'none'})`)

  const spiritLeak = MEADOW_CROPS.filter(id => CROP_DEFS[id]?.bloomsSpirit)
  ok(spiritLeak.length === 0,
    `★★★ grass cannot mint a spirit — canon's Mana Seed accounting is ceremonial and tiny (leaked: ${spiritLeak.join(', ') || 'none'})`)

  ok(!MEADOW_SEEDS.includes('mana_seed'),
    '★★ the retired generic Mana Seed is gone from the table by name')

  // ★★ THE HERB GUARD, FALSIFIED WITH A SYNTHETIC CROP. The live check above is DOMINATED — all
  // four element herbs are tier 2, so the tier filter excludes them anyway and deleting `!isHerb`
  // leaves every other assert green (measured, by mutation). That makes canon's *"never one of the
  // four element herbs"* rest on a coincidence. The dominance is incidental: canon could rule a
  // tier-1 herb tomorrow, and it would evaporate silently in the permissive direction.
  const fakeHerb = { id: 'violetbloom', tier: 1 as const, bloomsSpirit: false }
  ok(!isMeadowCrop(fakeHerb, new Set(['violetbloom'])),
    '★★★ a TIER-1 element herb is still refused — the canon guard fires on its own, not via the tier filter')
  ok(isMeadowCrop({ id: 'violetbloom', tier: 1 as const, bloomsSpirit: false }, new Set()),
    '★ ...and the same crop passes when it is not an element herb, so the assert above is about the guard')

  const notTier1 = MEADOW_CROPS.filter(id => CROP_DEFS[id]?.tier !== 1)
  ok(notTier1.length === 0,
    `★ a tuft is the bottom of the ladder, not a shortcut up it — tier 2+ wants its own source (found: ${notTier1.join(', ') || 'none'})`)

  // ⚠ Every seed named must actually be a seed some crop is planted from. A typo here is invisible
  // in play: the drop appears, the bag holds it, and nothing can ever be planted with it.
  const plantable = new Set(Object.values(CROP_DEFS).map(c => c.seedItemId))
  const unplantable = MEADOW_SEEDS.filter(id => !plantable.has(id))
  ok(unplantable.length === 0, `every seed grass yields is one a crop is grown from (${unplantable.join(', ') || 'none'})`)
}

// ── 2. the drops are on the table, at the stated rate ───────────────────────────────────────────
{
  for (const m of GRASSES) {
    const def = blockDef(m)!
    for (const seed of MEADOW_SEEDS) {
      const entry = def.drops.find(d => d.itemId === seed)
      ok(!!entry, `${def.name} can yield ${seed}`)
      ok(entry?.chance === MEADOW_SEED_CHANCE, `${seed} at the rate the constant says`)
      ok(entry?.count === 1, `${seed}: one seed, never a stack`)
    }
  }
  ok(MEADOW_SEED_CHANCE > 0 && MEADOW_SEED_CHANCE < 1, `the rate is a real probability (${MEADOW_SEED_CHANCE})`)
}

// ── 3. ★ THE ROLL IS WIRED — proven by driving the rng, not by waiting ──────────────────────────
{
  const lucky = dropsFor(MAT.TUFT, () => 0)
  for (const seed of MEADOW_SEEDS) ok(lucky.some(d => d.itemId === seed), `★ a winning roll yields ${seed}`)
  ok(lucky.some(d => d.itemId === 'grass_tuft'), 'and the tuft still comes with it')

  // The assert that catches an inverted comparison — the bug that hands out a seed EVERY time and
  // looks like generosity rather than like a defect.
  const unlucky = dropsFor(MAT.TUFT, () => 0.999999999)
  ok(!MEADOW_SEEDS.some(s => unlucky.some(d => d.itemId === s)), '★ a losing roll yields no seed')
  ok(unlucky.length === 1 && unlucky[0].itemId === 'grass_tuft', 'a losing roll still drops the tuft')

  // `rng() >= chance` fails, so a roll exactly AT the rate must lose.
  ok(!MEADOW_SEEDS.some(s => dropsFor(MAT.TUFT, () => MEADOW_SEED_CHANCE).some(d => d.itemId === s)),
    'the boundary roll loses — chance is exclusive')

  // ★ EACH SEED ROLLS INDEPENDENTLY, which is why one tuft can give two kinds. Asserted because the
  // tempting "pick one winner per tuft" rewrite would make the rarer crops feel like they compete
  // with the common ones, and it would pass every other assert in this file.
  ok(MEADOW_SEEDS.every(s => lucky.some(d => d.itemId === s)),
    '★ a winning roll yields EVERY seed, not one of them — the entries are independent')
}

// ── 4. ★ A SEED IS LOOT, NOT A BLOCK ────────────────────────────────────────────────────────────
// It must never round-trip into a placeable voxel just because the block that dropped it is placeable.
{
  for (const seed of MEADOW_SEEDS) ok(materialForItem(seed) === undefined, `★ ${seed} is not placeable as grass`)
  ok(materialForItem('grass_tuft') === MAT.TUFT, 'the identity drop still places its own block')
}

// ── 5. only grass gives seeds ───────────────────────────────────────────────────────────────────
{
  let strays = 0
  for (const m of [MAT.STONE, MAT.TOPSOIL, MAT.SAND, MAT.PLANKS, MAT.FLOWER, MAT.SUBSOIL]) {
    if (MEADOW_SEEDS.some(s => dropsFor(m, () => 0).some(d => d.itemId === s))) strays++
  }
  ok(strays === 0, `★ only grass fruits — no other block yields a seed (${strays})`)
}

console.log(`\nmeadow-seed: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
