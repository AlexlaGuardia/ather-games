// The wild tier-2+ crops. Run: npx tsx src/app/shimmer/voxel/wild-crops.test.ts
//
// ★ THE PROPERTY: **a keeper's experience of which crop is rare must come from its TIER and from
// nothing else.** Every assert below is a way of asking that, because the failure this feature is
// one flat density away from is not a crash — it is a perfectly working world in which the top of
// the ladder is the commonest plant in it, and a player reads terrain frequency as design.
import { columnHeight } from './height'
import { generatedAt } from './column'
import { MAT } from './depth'
import { biomeAt } from './biome'
import { DEFAULT_DEPTH } from './depth'
import { CROP_DEFS } from './crops'
import {
  CROP_OF_GROUND, GROUND_OF_CROP, CROP_ID_OF_MAT, CROP_DENSITY, GROUND_FREE_CELLS,
  WILD_TARGET_BY_TIER, wildDensity, isWildCrop, cropAt, herbAt, plantMaterialAt,
  FLORA, FLORA_MATERIALS, FLORA_KIND_COUNT, HERB_OF_GROUND,
} from './flora'

const SEED = 1337
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. ★★★ THE LADDER IS NOT INVERTED — the whole reason the density is derived ────────────────
// Measured through `generatedAt`, never through the field: the waterline gate sits between them and
// eats 82% of the basin, so a field count would balance Moonvine against plants standing on a lake
// bed that no keeper will ever pick. Same sweep and same method as `herbs.test.ts` § 11, so the two
// features' numbers are comparable rather than merely similar-looking.
{
  const count = new Map<number, number>()
  for (const m of Object.values(CROP_OF_GROUND)) count.set(m, 0)
  for (let x = -800; x < 800; x += 4) for (let z = -800; z < 800; z += 4) {
    const h = columnHeight(x, z, SEED)
    const m = generatedAt(x, h + 1, z, SEED, h)
    if (count.has(m)) count.set(m, count.get(m)! + 1)
  }
  const byTier = new Map<number, number[]>()
  for (const [mat, n] of count) {
    const t = CROP_DEFS[CROP_ID_OF_MAT[mat]].tier
    byTier.set(t, [...(byTier.get(t) ?? []), n])
  }
  const report = [...count].map(([m, n]) => `${CROP_ID_OF_MAT[m]}(t${CROP_DEFS[CROP_ID_OF_MAT[m]].tier}) ${n}`).join(' · ')

  ok([...count.values()].every(n => n > 0), `★ every one of the seven turns up in one sweep — ${report}`)

  // ⚠ THE ORDERING IS THE INVARIANT, NOT THE NUMBERS. `GROUND_DRY_CELLS` is a measurement and a
  // terrain change moves it without anyone touching flora.ts, so this fails when the LADDER
  // inverts — the thing that would actually be wrong — and stays quiet through ordinary tuning.
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const t2 = mean(byTier.get(2) ?? [0]), t3 = mean(byTier.get(3) ?? [0]), t4 = mean(byTier.get(4) ?? [0])
  ok(t2 > t3 && t3 > t4,
    `★★★ tier 2 is more findable than tier 3 is more findable than tier 4 (${t2.toFixed(0)} > ${t3.toFixed(0)} > ${t4.toFixed(0)}) — ${report}`)

  // ★ AND THE SPREAD WITHIN A TIER IS THE HERBS' ASSERT, borrowed for the same reason: two crops of
  // the same tier are the same rung, so a keeper must not find one trivial and the other hopeless.
  for (const [t, ns] of byTier) {
    const spread = Math.max(...ns) / Math.max(1, Math.min(...ns))
    ok(spread <= 4, `★ tier ${t}'s crops are within 4× of each other (${spread.toFixed(1)}×) — ${report}`)
  }

  // ⚠ THE GUARD THAT WOULD HAVE CAUGHT THE BUG THIS FEATURE WAS ONE LINE FROM SHIPPING: at a flat
  // density the meadow crop alone would outnumber every other crop combined. Stated as its own
  // assert because the ordering check above passes on averages and this one names the culprit.
  // ⚠⚠ MEASURED OCCUPANCY — AND IT IS WHAT KILLED THE SATURATION CAP THAT USED TO LIVE HERE. That
  // cap's own asserts could not be made to fail by removing it: the constant was policing itself.
  // Asking the SWEEP instead settled it in one run — without the cap the basin lands at 27.6% and
  // with it 18.1%, so the cap was defending against a carpet that does not exist and the comment
  // justifying it (*"86% of every free basin cell"*) was arithmetic nobody had checked. This assert
  // is the real protection: whatever any constant says, no crop may carpet its ground.
  for (const [mat, n] of count) {
    const g = GROUND_OF_CROP[mat]
    const occ = n / Math.max(1, GROUND_FREE_CELLS[g])
    ok(occ <= 0.40,
      `★★ ${CROP_ID_OF_MAT[mat]} does not carpet the ${g} — ${(occ * 100).toFixed(0)}% of its free cells (a plant you find, not a ground cover)`)
  }

  const meadow = count.get(CROP_OF_GROUND['meadow'])!
  const rest = [...count].filter(([m]) => m !== CROP_OF_GROUND['meadow']).reduce((s, [, n]) => s + n, 0)
  ok(meadow < rest,
    `★★ the meadow crop does not outnumber the other six combined (${meadow} vs ${rest}) — meadow is 131× the basin's dry cells, so this is what a flat density looks like`)
}

// ── 2. ★★ NOT A MIRROR — the two directions are one authored table ─────────────────────────────
// The herbs keep `HERB_GROUND` and `HERB_OF_GROUND` by hand, which is a copy and its source: they
// go stale together and agree perfectly while both are wrong. These are projections of one list.
{
  const grounds = Object.keys(CROP_OF_GROUND)
  ok(grounds.length === 7, `seven crops have ground (${grounds.length})`)
  ok(Object.keys(GROUND_OF_CROP).length === 7, 'the inverse has the same seven')
  ok(grounds.every(g => GROUND_OF_CROP[CROP_OF_GROUND[g]] === g),
    '★ ground → material → ground round-trips for all seven')
  ok(Object.values(CROP_OF_GROUND).every(m => isWildCrop(m)), 'every mapped material reports as a wild crop')
  ok(Object.values(CROP_OF_GROUND).every(m => CROP_DEFS[CROP_ID_OF_MAT[m]] !== undefined),
    '★ every wild crop names a crop that exists in CROP_DEFS — the glowfin_scale check, from the other end')
  ok(!('greyfield' in CROP_OF_GROUND), '★ a greyfield grows none of them — canon, not a dial')
  ok(new Set(Object.values(CROP_OF_GROUND)).size === 7, 'no two grounds share a crop material')
}

// ── 3. ★★★ A HERB ALWAYS BEATS A CROP ON A SHARED GROUND ───────────────────────────────────────
// Four of the seven share a ground with an element herb. The herb densities were compensated against
// a MEASURED land share, so anything that wins their cell re-tunes all four Infusions — and the
// alchemy economy under them — with nothing looking wrong. This is the assert that says the
// precedence in `plantMaterialAt` is the one written down, not the one the branch order happened to
// produce.
{
  const shared = Object.keys(CROP_OF_GROUND).filter(g => HERB_OF_GROUND[g])
  ok(shared.length === 4, `four grounds carry both a herb and a crop (${shared.join(', ')})`)
  let contested = 0, herbWon = 0
  for (const g of shared) {
    for (let x = -400; x < 400; x += 2) for (let z = -400; z < 400; z += 2) {
      const herb = herbAt(x, z, SEED, g as never)
      if (!herb) continue
      if (cropAt(x, z, SEED, g as never)) {
        contested++
        if (plantMaterialAt(x, z, SEED, g as never) === herb) herbWon++
      }
    }
  }
  ok(contested > 0,
    `★★ the two fields DO collide, so this assert is about something (${contested} contested cells) — if this ever reads 0 the check below is vacuous and proves nothing`)
  ok(contested === herbWon,
    `★★★ the herb takes every contested cell (${herbWon}/${contested}) — a crop displaces a tuft, never a Violetbloom`)
}

// ── 4. ★ THE DENSITY IS FALSIFIABLE — fed its inputs rather than asserted at its output ────────
// The `isMeadowCrop(c, herbCrops)` pattern. Asserting the seven numbers it produces today would
// pin the measurement; feeding it a synthetic ground proves the compensation is what is doing the
// work, and goes red if someone replaces it with a constant.
{
  ok(wildDensity('basin', 2) > wildDensity('meadow', 2),
    '★ the same tier is denser on the smaller ground — the dial compensates for the GROUND')
  ok(wildDensity('basin', 2) > wildDensity('basin', 4),
    '★ and rarer at a higher tier on the same ground — the dial reads the CROP\'s tier')
  const flat = { basin: 1000, meadow: 1000 }
  ok(wildDensity('basin', 2, flat) === wildDensity('meadow', 2, flat),
    'given equal ground it stops compensating — the ground term is real, not decoration')
  ok(wildDensity('nowhere', 2) === 0, 'an unmeasured ground yields nothing rather than Infinity')
  ok(wildDensity('basin', 9) === 0, 'an untiered crop yields nothing rather than NaN')
  ok(Object.keys(CROP_DENSITY).length === 7 && Object.values(CROP_DENSITY).every(d => d > 0 && d <= 1),
    `every ground's density is a real probability (${JSON.stringify(CROP_DENSITY)})`)
}

// ── 5. ★★ THE TUFT RULING IS UNTOUCHED — the half of canon this feature must not move ──────────
// Canon: *the seed is the meadow's, the plant is the ground's.* The whole ruling turns on the tuft
// still yielding level-1 stock only, and the meadow is the one ground where the two can be confused
// (Atherwheat, tier 4, grows there). If this feature ever leaks into the seed table, the ruling it
// was built from is the thing that breaks.
{
  const meadowCrop = CROP_OF_GROUND['meadow']
  ok(CROP_DEFS[CROP_ID_OF_MAT[meadowCrop]].tier === 4,
    '★ the meadow really does carry a tier-4 plant, so the confusion this guards is a live one')
  // A wild crop is a PLANT material standing on the ground; a seed is an ITEM a tuft drops. They
  // must not be the same id, or picking a tuft and meeting a plant become the same act.
  ok(!Object.values(CROP_OF_GROUND).some(m => m === MAT.TUFT || m === MAT.TALL_GRASS || m === MAT.FLOWER),
    '★★ no wild crop is a grass material — meeting a plant and breaking a tuft stay two acts')
}

// ── 6. THE KIND-COUNT GUARD STILL BALANCES ─────────────────────────────────────────────────────
// Two derivations compared, not a value against a copy of itself. Adding CROP had to reach both.
{
  ok(FLORA.CROP !== undefined, 'the CROP kind exists')
  ok(FLORA_KIND_COUNT === FLORA_MATERIALS.size,
    `★★ the kind enums and the material set still agree (${FLORA_KIND_COUNT} vs ${FLORA_MATERIALS.size}) — this is what goes red when a kind is added without a material`)
  ok(Object.values(CROP_OF_GROUND).every(m => FLORA_MATERIALS.has(m)),
    'every wild crop material is in FLORA_MATERIALS')
}

// ── 7. NO GROUND, NO CROPS — the generator's signature, same contract as the herbs ─────────────
// `plantMaterialAt` without a `ground` must be exactly the grass field it always was, or a Dawncap
// comes up in a seed pot.
{
  let cropsWithoutGround = 0
  for (let x = -200; x < 200; x += 3) for (let z = -200; z < 200; z += 3) {
    if (isWildCrop(plantMaterialAt(x, z, SEED))) cropsWithoutGround++
  }
  ok(cropsWithoutGround === 0,
    `★ without a ground there are no crops (${cropsWithoutGround}) — the pot, the tests and any field reader keep getting plain grass`)
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ wild crops: rarity comes from tier, not from terrain — ${pass} passed`)
