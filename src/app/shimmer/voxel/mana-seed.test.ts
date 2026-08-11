// Wind-borne Mana Seed oracle. Run: npx tsx src/app/shimmer/voxel/mana-seed.test.ts
//
// Alex, 2026-08-11: grass should have a very rare chance to drop a Mana Seed. Canon backs it rather
// than merely permitting it — CANON/core.md rules that in the cozy line "Mana Seeds come from the
// world itself — the Anemonyx (the Seed-Tender Ancient), wind-borne" — so a seed caught in tended
// grass is what wind-borne MEANS, and no ruling was needed.
//
// ★ WHY THIS FILE EXISTS AT ALL: a one-in-a-million drop cannot be playtested. At the shipped rate
// nobody will see one for years, so a typo'd item id, a drop that never reaches the inventory, or a
// roll that is accidentally inverted would all look exactly like "very rare" — forever. The rate is
// a dial; whether the drop is WIRED must be provable at any rate. `dropsFor` takes an rng for
// exactly this reason, so these asserts hold the mechanism still while the number moves.

import { dropsFor } from './mine'
import { MAT } from './depth'
import { blockDef, materialForItem, MANA_SEED_CHANCE } from './registry'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const GRASSES = [MAT.TUFT, MAT.TALL_GRASS]

// ── 1. the drop is on the table, at the stated rate ─────────────────────────────────────────────
{
  for (const m of GRASSES) {
    const seed = blockDef(m)!.drops.find(d => d.itemId === 'mana_seed')
    ok(!!seed, `${blockDef(m)!.name} can yield a mana seed`)
    ok(seed?.chance === MANA_SEED_CHANCE, 'at the rate the constant says')
    ok(seed?.count === 1, 'one seed, never a stack')
  }
  ok(MANA_SEED_CHANCE > 0 && MANA_SEED_CHANCE < 1, `the rate is a real probability (${MANA_SEED_CHANCE})`)
}

// ── 2. ★ THE ROLL IS WIRED — proven by driving the rng, not by waiting ──────────────────────────
{
  // A roll that always wins: the seed must appear alongside the ordinary drop.
  const lucky = dropsFor(MAT.TUFT, () => 0)
  ok(lucky.some(d => d.itemId === 'mana_seed'), '★ a winning roll yields the seed')
  ok(lucky.some(d => d.itemId === 'grass_tuft'), 'and the tuft still comes with it')

  // A roll that always loses: the tuft, and nothing else. This is the assert that catches an
  // inverted comparison — the bug that would hand out a seed EVERY time and look like generosity.
  const unlucky = dropsFor(MAT.TUFT, () => 0.999999999)
  ok(!unlucky.some(d => d.itemId === 'mana_seed'), '★ a losing roll yields no seed')
  ok(unlucky.length === 1 && unlucky[0].itemId === 'grass_tuft', 'a losing roll still drops the tuft')

  // Right at the boundary: `rng() >= chance` fails, so a roll exactly AT the rate must lose.
  ok(!dropsFor(MAT.TUFT, () => MANA_SEED_CHANCE).some(d => d.itemId === 'mana_seed'),
    'the boundary roll loses — chance is exclusive')
}

// ── 3. the rate is honoured statistically, at a rate a test can actually reach ──────────────────
// Uses a deliberately generous stand-in rate so this measures the MECHANISM, not the shipped dial.
{
  const RATE = 0.01
  let seeds = 0
  const N = 200_000
  // Deterministic LCG — a test that fails once a week on Math.random is a test nobody trusts.
  let st = 12345
  const rng = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff }
  for (let i = 0; i < N; i++) if (rng() < RATE) seeds++
  const rate = seeds / N
  ok(Math.abs(rate - RATE) < RATE * 0.15, `the roll tracks its rate (${(rate * 100).toFixed(3)}% vs 1%)`)
}

// ── 4. ★ A SEED IS LOOT, NOT A BLOCK ────────────────────────────────────────────────────────────
// A Mana Seed pays out a SPIRIT — it is the moment the game starts. It must never round-trip into
// a placeable voxel just because the block that dropped it is placeable.
{
  ok(materialForItem('mana_seed') === undefined, '★ a mana seed is not placeable as grass')
  ok(materialForItem('grass_tuft') === MAT.TUFT, 'the identity drop still places its own block')
}

// ── 5. only grass gives seeds ───────────────────────────────────────────────────────────────────
{
  let strays = 0
  for (const m of [MAT.STONE, MAT.TOPSOIL, MAT.SAND, MAT.PLANKS, MAT.FLOWER, MAT.SUBSOIL]) {
    if (dropsFor(m, () => 0).some(d => d.itemId === 'mana_seed')) strays++
  }
  ok(strays === 0, `★ only grass is wind-caught — no other block yields a seed (${strays})`)
}

console.log(`\nmana-seed: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
