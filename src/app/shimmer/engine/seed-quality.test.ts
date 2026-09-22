/**
 * ── THE PRIME SEED LINE: it breeds true, and it only GROWS if it is fed ───────────────────────
 * Run: npx tsx src/app/shimmer/engine/seed-quality.test.ts
 */
import {
  PRIME_SUFFIX, PRIME_CHANCE_UNFED, PRIME_CHANCE_CAP, primeSeedId, baseSeedId, isPrimeSeed,
  primeSeedChance, primeSeedsBack, primeYield, primeSeedIdsFor,
} from './seed-quality'
import { CROP_DEFS, CROP_IDS, plantCrop, harvestCrop, cropForSeed, type PlantedCrop } from './farming'
import { createInventory, addItems, countItem } from './inventory'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const defs = CROP_IDS.map(id => CROP_DEFS[id])
const ordinary = defs.find(d => !d.bloomsSpirit && d.minFarmingLevel === 0) ?? defs.find(d => !d.bloomsSpirit)!

// ── 1. the id mapping round-trips, and is idempotent ──────────────────────────────────────────
{
  const base = 'seed_atherwheat', prime = primeSeedId(base)
  ok(prime === base + PRIME_SUFFIX, 'the prime id is not the base plus the suffix')
  ok(baseSeedId(prime) === base, 'a prime id does not resolve back to its base')
  ok(primeSeedId(prime) === prime, 'priming a prime id doubled the suffix')
  ok(baseSeedId(base) === base, 'basing an ordinary id changed it')
  ok(isPrimeSeed(prime) && !isPrimeSeed(base), 'isPrimeSeed cannot tell them apart')
}

// ── 2. ★ A PRIME SEED STILL PLANTS ITS CROP — the whole reason quality rides in the id ────────
// If this breaks, a prime seed is an item you can hold and never sow, which would read as the
// reward being a brick.
{
  for (const d of defs) {
    if (d.bloomsSpirit) continue
    ok(cropForSeed(primeSeedId(d.seedItemId)) === d.id,
      `a prime ${d.seedItemId} does not resolve to crop ${d.id}`)
  }
}

// ── 3. ★★ THE CHANCE IS GATED ON FEEDING, WITH NO GRADIENT PROBLEM ───────────────────────────
// Unfed is zero on purpose: water is free and universal in this game, so a non-zero unfed chance
// would let the prime line arrive on its own and feeding would only change the speed.
{
  ok(primeSeedChance(false, 0) === PRIME_CHANCE_UNFED && PRIME_CHANCE_UNFED === 0,
    'an UNFED crop can hand back a prime seed — feeding is supposed to be the whole gate')
  ok(primeSeedChance(false, 99) === 0, 'farming level alone unlocked the prime line without feeding')
  ok(primeSeedChance(true, 0) > 0, 'a fed crop has no prime chance at all')
  ok(primeSeedChance(true, 99) <= PRIME_CHANCE_CAP, 'the prime chance exceeds its cap')
  ok(primeSeedChance(true, 10) > primeSeedChance(true, 0), 'farming level does not help at all')
  ok(PRIME_CHANCE_CAP < 1, 'the prime chance can reach certainty — the roll would stop being a roll')
}

// ── 4. ★★★ THE LOOP STAYS OPEN — the correction this design rests on ─────────────────────────
// The kind is guaranteed (a line cannot be lost) and the COUNT is what tending buys. Without the
// split, one prime seed would mean prime for ever and tending would stop mattering on harvest two.
{
  ok(primeSeedsBack(false) >= 1, 'an unfed prime crop failed to return a prime seed — the line can be LOST')
  ok(primeSeedsBack(false) === 1, 'an unfed prime line still GROWS — tending has stopped mattering')
  ok(primeSeedsBack(true) > primeSeedsBack(false), 'feeding a prime line does not grow it')
}

// ── 5. a prime planting is felt as abundance ──────────────────────────────────────────────────
{
  ok(primeYield(1) > 1, 'a prime planting yields no more than an ordinary one')
  ok(primeYield(0) >= 1, 'a prime planting rounded down to nothing')
}

// ── 6. ★ EVERY CROP HAS A PRIME LINE, DERIVED — never a hand-kept list ────────────────────────
// A crop added next month must get its prime line for free, or it silently has none.
{
  const ids = primeSeedIdsFor(defs)
  const growable = defs.filter(d => !d.bloomsSpirit)
  ok(ids.length === growable.length, `${ids.length} prime seeds for ${growable.length} growable crops`)
  ok(new Set(ids).size === ids.length, 'two crops share a prime seed id')
  ok(!ids.some(i => cropForSeed(i) === null), 'a derived prime seed id resolves to no crop')
}

// ── 7. ★★ END TO END through the SHIPPED plant/harvest, not through the rates ─────────────────
{
  const skills = { farming: { level: 50, xp: 0 } } as never as Parameters<typeof plantCrop>[2]
  const mana = { current: 9999, max: 9999 } as never as Parameters<typeof plantCrop>[3]
  const inv = createInventory()
  const primeId = primeSeedId(ordinary.seedItemId)

  // Sowing a prime seed spends the PRIME one and marks the planting.
  addItems(inv, primeId, 1)
  const crop = plantCrop(ordinary.id, inv, skills, mana, 0, 0, 'z', primeId)
  ok(crop !== null, 'a prime seed could not be planted at all')
  ok(crop?.prime === true, 'a crop grown from a prime seed is not marked prime')
  ok(countItem(inv, primeId) === 0, 'planting a prime seed did not spend it')
  // ⚠ BAIL CLEANLY RATHER THAN CRASH. Every assert below needs a planted crop, and a null one is a
  // REAL failure mode (it is what a broken `baseSeedId` produces) — dying on a TypeError there
  // would report a stack trace instead of the sentence that says what broke.
  if (!crop) { console.log(`\nseed-quality: ${pass} passed, ${fails.length + 1} failed`); for (const f of [...fails, 'no prime crop was planted, so nothing below could be checked']) console.log('  ✗ ' + f); process.exit(1) }

  // ⚠ AND IT MUST NOT SPEND THE ORDINARY ONE — the trap of defaulting to `def.seedItemId`.
  const inv2 = createInventory()
  addItems(inv2, primeId, 1); addItems(inv2, ordinary.seedItemId, 5)
  plantCrop(ordinary.id, inv2, skills, mana, 0, 0, 'z', primeId)
  ok(countItem(inv2, ordinary.seedItemId) === 5, 'sowing a PRIME seed spent an ORDINARY one instead')

  // Harvesting it breeds true, both fed and unfed.
  for (const fed of [false, true]) {
    const bag = createInventory()
    const got = harvestCrop(crop, bag, { farming: { level: 50, xp: 0 } } as never, 0, 1, () => 0.99, fed)
    ok(countItem(bag, primeId) === primeSeedsBack(fed),
      `a ${fed ? 'fed' : 'unfed'} prime harvest returned ${countItem(bag, primeId)} prime seeds, want ${primeSeedsBack(fed)}`)
    ok(countItem(bag, ordinary.seedItemId) === 0, 'a prime crop also returned ORDINARY seeds — the line dilutes')
    ok(got.items.some(i => i.itemId === primeId), 'the harvest toast does not mention the prime seed')
  }

  // An ordinary UNFED crop never starts a line, even on a rigged always-succeed roll.
  const plain: PlantedCrop = { ...crop, prime: false }
  const bagU = createInventory()
  harvestCrop(plain, bagU, { farming: { level: 50, xp: 0 } } as never, 0, 1, () => 0, false)
  ok(countItem(bagU, primeId) === 0, 'an UNFED ordinary crop started a prime line on a lucky roll')
  // A FED one does, on the same rigged roll.
  const bagF = createInventory()
  harvestCrop(plain, bagF, { farming: { level: 50, xp: 0 } } as never, 0, 1, () => 0, true)
  ok(countItem(bagF, primeId) === 1, 'a FED ordinary crop did not start a prime line on a certain roll')
  ok(countItem(bagF, ordinary.seedItemId) >= 1, 'the ordinary seed-back stopped when the prime line arrived')
}

console.log(`\nseed-quality: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the line breeds true, and only grows if it is fed')
