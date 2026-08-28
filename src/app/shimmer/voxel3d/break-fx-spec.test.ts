// The pure half of the block-break effect. Run: npx tsx src/app/shimmer/voxel3d/break-fx-spec.test.ts
//
// ★ THE ONLY ASSERT HERE THAT REALLY MATTERS IS §1, AND IT IS AN ABSENCE CHECK. Every other line
// pins a number I chose and can change my mind about. §1 asks whether any breakable block in the
// registry falls through `bucketOf` and lands nowhere — which is the failure this whole file exists
// to catch, because it happens LATER, to someone else, when a material is added by a window that
// has never opened this file. A block with no bucket throws no particles, silently, and looks
// exactly like a block whose particles someone forgot to enable.
//
// ⚠ AND §2 IS THE OTHER HALF OF THAT QUESTION, WHICH IS EASY TO FORGET TO ASK. "Everything maps"
// is satisfied perfectly by a function that returns 'stone' for all input. A guard that cannot
// distinguish a working classifier from a collapsed one is not measuring the classifier. So §2
// requires every bucket to be REACHED by some real material, and §3 pins the specific
// misclassifications the branch order exists to prevent.

import {
  bucketOf, recipeFor, chipColor, swingChips, ALL_BUCKETS, FALLBACK_COLOR,
  type BreakBucket,
} from './break-fx-spec'
import { ALL_BLOCKS, blockDef } from '../voxel/registry'
import { MAT, baseOf } from '../voxel/depth'
import { ORE } from '../voxel/ore'
import { WOOD } from '../voxel/trees'
import { MATERIAL_COLOR } from './attrs'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. EVERY BREAKABLE BLOCK LANDS IN A BUCKET ─────────────────────────────────────────────────
// Names the offenders rather than counting them: a red "3 blocks unbucketed" invites the cheapest
// fix that makes it 0, and the tally was never the thing that was wrong.
{
  const orphans: string[] = []
  for (const def of ALL_BLOCKS) {
    if (def.hardness === Infinity) continue        // unbreakable: never struck, never throws
    if (bucketOf(def.material) === null) orphans.push(`${def.name} (${def.material})`)
  }
  ok(orphans.length === 0, `every breakable block has a break bucket — unbucketed: ${orphans.join(', ')}`)
  ok(ALL_BLOCKS.length > 40, `the registry is actually loaded (${ALL_BLOCKS.length} blocks) — an empty list passes every assert above`)
}

// ── 2. AND THE CLASSIFIER HAS NOT COLLAPSED INTO ONE ANSWER ────────────────────────────────────
{
  const seen = new Map<BreakBucket, string>()
  for (const def of ALL_BLOCKS) {
    const b = bucketOf(def.material)
    if (b && !seen.has(b)) seen.set(b, def.name)
  }
  const missing = ALL_BUCKETS.filter(b => !seen.has(b))
  ok(missing.length === 0, `every bucket is reached by a real block — unreached: ${missing.join(', ')}`)
  ok(seen.size === ALL_BUCKETS.length, 'the buckets a real registry produces are exactly the buckets with recipes')
}

// ── 3. THE MISCLASSIFICATIONS THE BRANCH ORDER EXISTS TO PREVENT ───────────────────────────────
// Each of these passed through a WRONG branch in a draft of this file, so each is a real defect
// caught rather than a hypothetical.
{
  ok(bucketOf(ORE.RAW_MANA) === 'ore',
     "ore is not swallowed by stone — its skill is 'prospecting' too, so a plain skill test gets this wrong")
  ok(bucketOf(WOOD.GOLDWOOD_LOG) === 'wood', 'a log is wood')
  ok(bucketOf(WOOD.GOLDWOOD_LOG + 1) === 'leaf',
     'and its leaves are NOT — one id apart, told apart only by parity')
  ok(bucketOf(MAT.SAND) === 'sand', 'sand slumps rather than shattering')
  ok(bucketOf(MAT.STONE) === 'stone' && bucketOf(MAT.DEEP_STONE) === 'stone', 'plain rock is stone')
  ok(bucketOf(MAT.AIR) === null, 'air breaks into nothing')

  // ⚠ The HALF_BIT case: a slab is the same material wearing a flag, and `baseOf` is the only
  // reason it works. Without that strip a slab of every material in the game is unbucketed.
  const slab = ALL_BLOCKS.find(d => d.material !== baseOf(d.material))
  ok(!!slab, 'the registry actually contains a flagged (slab) material to test with')
  if (slab) ok(bucketOf(slab.material) === bucketOf(baseOf(slab.material)),
               'a slab breaks like the material it is a slab OF')
}

// ── 4. COLOUR COMES FROM THE MESHER, AND AN UNKNOWN IS LOUD ────────────────────────────────────
{
  ok(chipColor(MAT.STONE) === MATERIAL_COLOR[MAT.STONE],
     'a stone chip is the colour the mesher paints stone — the same value, not a copy of it')
  ok(chipColor(9999) === FALLBACK_COLOR, 'an unmapped material throws magenta, never a plausible grey')
  ok(FALLBACK_COLOR === 0xff00ff, 'and the fallback is the loud one the tile atlas already uses')

  // The point of reading MATERIAL_COLOR rather than keeping a swatch: they cannot drift apart,
  // because there is only one of them. Assert the relationship, not the value — a hardcoded
  // 0x7d7a86 here would be exactly the second copy this design exists to avoid.
  let differing = 0
  for (const def of ALL_BLOCKS) {
    const c = MATERIAL_COLOR[baseOf(def.material)]
    if (c !== undefined && chipColor(def.material) !== c) differing++
  }
  ok(differing === 0, `every chip colour IS the mesher's colour (${differing} disagreed)`)
}

// ── 5. THE SWING RAMP ──────────────────────────────────────────────────────────────────────────
{
  const dt = 1 / 60
  const first = swingChips('stone', 0, dt)
  const last = swingChips('stone', 1, dt)
  ok(first > 0, 'the first contact already throws something — a swing that looks inert is the bug')
  ok(last > first, 'and a block about to give throws more than one just struck')

  // ⚠ THE ONE THAT WOULD HAVE KILLED IT SILENTLY: at 60fps every rate in the recipe table is well
  // under one chip per frame, so rounding inside `swingChips` would return 0 forever and the
  // feature would ship emitting nothing at all, with every other assert here green.
  ok(last < 1, 'the per-frame count is genuinely fractional at 60fps (the caller must accumulate)')
  ok(Math.abs(swingChips('stone', 1, dt * 2) - last * 2) < 1e-9, 'and it scales linearly with dt')

  ok(swingChips('stone', -5, dt) === first && swingChips('stone', 99, dt) === last,
     'progress is clamped, so a caller cannot spray by handing it a bad fraction')
}

// ── 6. THE RECIPES DIFFER IN THE WAYS THAT ARE THE FEATURE ─────────────────────────────────────
// Not the decimals — the SHAPE. These are the four sentences the design promises a player.
{
  const stone = recipeFor('stone'), wood = recipeFor('wood')
  const leaf = recipeFor('leaf'), sand = recipeFor('sand')
  ok(sand.speed < stone.speed * 0.5, 'sand slumps: it barely throws outward compared to stone')
  ok(sand.gravity > stone.gravity, 'and it falls harder')
  ok(leaf.gravity < stone.gravity * 0.2, 'a leaf hangs: near-zero gravity next to rubble')
  ok(leaf.life > stone.life * 2, 'and it is still in the air long after a chip has landed')
  ok(wood.burst < stone.burst && wood.size > stone.size, 'wood throws fewer, bigger splinters')
  ok(ALL_BUCKETS.every(b => recipeFor(b).life > 0 && recipeFor(b).burst > 0),
     'every recipe throws something that lives for a while')

  // Nothing rises yet, and that is the canon gap rather than an omission — if this goes red,
  // somebody answered the mana question in code instead of in CANON_GAPS.md.
  ok(ALL_BUCKETS.every(b => recipeFor(b).gravity > 0),
     'no bucket rises yet — freed mana is Magii\'s ruling, not a number to pick here')
}

// ── 7. THE ONE THING THE REGISTRY CANNOT TELL US, ASSERTED ANYWAY ──────────────────────────────
// `blockDef().skill` is the load-bearing input to the widest branch. If the vocabulary itself ever
// changes, this file's last branch quietly starts meaning something else.
{
  const skills = new Set(ALL_BLOCKS.map(d => blockDef(d.material)?.skill))
  ok(skills.has('prospecting') && skills.has('forestry'),
     "the tool vocabulary this file classifies by is still the one the registry speaks")
}

console.log(`break-fx-spec: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
