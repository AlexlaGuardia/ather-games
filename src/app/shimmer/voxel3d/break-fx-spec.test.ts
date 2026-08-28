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

import { readFileSync } from 'fs'
import { join } from 'path'
import {
  bucketOf, recipeFor, chipColor, swingChips, ALL_BUCKETS, FALLBACK_COLOR,
  breathFor, BREATHING_BUCKETS, stepVelocity,
  type BreakBucket,
} from './break-fx-spec'
import { codeOnly } from '../testing/guard'

const DIR = join(process.cwd(), 'src/app/shimmer/voxel3d')
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

const ALL_ELEMENT_SEAMS = [ORE.ELEMENT_VIOLET, ORE.ELEMENT_STORM, ORE.ELEMENT_EARTH, ORE.ELEMENT_WATER]

// ── 3. THE MISCLASSIFICATIONS THE BRANCH ORDER EXISTS TO PREVENT ───────────────────────────────
// Each of these passed through a WRONG branch in a draft of this file, so each is a real defect
// caught rather than a hypothetical.
{
  ok(bucketOf(ORE.RAW_MANA) === 'rawmana',
     "raw mana is not swallowed by stone — its skill is 'prospecting' too, so a plain skill test gets this wrong")
  ok(bucketOf(ORE.ATHER_CRYSTAL) === 'crystal' && bucketOf(ORE.PURE_CORE) === 'crystal',
     'the lattice-bearing end of the ladder is crystal')
  // ⚠ THE BRANCH-ORDER TRAP THIS SPLIT INTRODUCED, AND IT IS SILENT. `isOre` spans the WHOLE ladder
  // RAW_MANA..ATHER_CRYSTAL, so if the `rawmana` test is ever moved below it every seam in the game
  // reads as crystal — no error, no unbucketed material, just the wrong break forever.
  ok(bucketOf(ORE.RAW_MANA) !== bucketOf(ORE.ATHER_CRYSTAL),
     'raw mana and ather crystal do NOT share a bucket — the lattice is what tells them apart')
  ok(ALL_ELEMENT_SEAMS.every(m => bucketOf(m) === 'crystal'),
     'every element seam is crystal — canon names them Crystal Seams and they hold a lattice')
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

// ── 8. THE BREATH — CANON'S RELATIONS, NEVER MY DECIMALS ──────────────────────────────────────
// `world/mother.md` › *What a broken mana block does* + `design-briefs/shimmer-resources.md` › *the
// light law now covers the BREAK*, both RULED 2026-08-28, commit `2ca6c9e`.
//
// ★ EVERY ASSERT BELOW IS A SENTENCE FROM CANON, NOT A NUMBER FROM THE TABLE. A test reading
// `crystal.burst === 4` would be the hand-kept mirror wearing a test's name — it would agree with
// the table perfectly and tell us nothing, and it would go red the first time Alex tunes the feel,
// which is HIS call. What must not change without a ruling is the ORDERING and the DIRECTION.
{
  const cb = breathFor('crystal'), rb = breathFor('rawmana')
  ok(cb !== null && rb !== null, 'both mana-bearing buckets breathe')

  // "The freed light rises, outward, and fades." Negative gravity IS the rise.
  ok(!!cb && cb.gravity < 0, 'a crystal breath RISES — canon: outward, toward the sun')
  ok(!!rb && rb.gravity < 0, 'a raw mana breath RISES')
  ok(!!cb && !!rb && cb.life > 0 && rb.life > 0 && cb.life < 4 && rb.life < 4,
     'and FADES — a breath is brief; canon keeps a break a leak, not a fountain')

  // "Crystal... only a thin breath lifts off the new faces." / "Raw mana... breathes out almost
  // entirely." That is a RELATION between the two, and it survives any retuning of either.
  ok(!!cb && !!rb && rb.burst > cb.burst,
     'raw mana breathes out MORE than crystal — the lattice is what holds mana still')

  // "Shards fall still lit from within" vs "leaves dull spent stone."
  ok(recipeFor('crystal').glow > 1, 'crystal shards fall LIT — they are still lattice')
  ok(recipeFor('rawmana').glow < 1, 'raw mana falls DULL — spent stone, the light has left it')
  ok(recipeFor('crystal').glow > recipeFor('rawmana').glow,
     'and lit is brighter than spent, which is the whole readable difference between the two breaks')

  // ⛔ ORDINARY MATTER NEITHER BREATHES NOR GLOWS — RULED, not merely conservative. "Only mana
  // breathes — a felled tree does NOT" (`design-briefs/shimmer-resources.md`, 2026-08-28, `828fe74`,
  // raised from this build). ⚠ DO NOT "IMPROVE" THIS INTO *"matter that was never alive does not
  // breathe"* — that generalisation was offered to the Magii seat and explicitly refused: the true
  // rule is NARROWER, not broader. Wood, leaves, plants, sand and stone all breathe nothing, and a
  // living/non-living test would start letting things through the day someone adds a mana-bearing
  // plant. The assert below is the whole rule and it is finished.
  const mundane = ALL_BUCKETS.filter(b => b !== 'crystal' && b !== 'rawmana')
  ok(mundane.every(b => breathFor(b) === null),
     `only mana-bearing blocks breathe — offenders: ${mundane.filter(b => breathFor(b)).join(', ')}`)
  ok(mundane.every(b => recipeFor(b).glow === 1),
     'ordinary matter carries no light of its own')
  ok(BREATHING_BUCKETS.length === 2, 'exactly two buckets breathe, derived from the table not restated')
}

// ── 8b. ⛔ A BREAK IS A LEAK, NOT A FOUNTAIN — HOW FAR THE BREATH ACTUALLY GOES ────────────────
// Canon, in the same ruling: **"mana rises where the world OPENS it, not where a keeper BREAKS it —
// the mana-well is the fountain, a break is a leak. Keep them different on sight."**
//
// ⚠⚠ § 8 ABOVE ASSERTS THAT THE BREATH RISES AND FADES. BOTH ARE MEMBERSHIP CLAIMS, AND NEITHER
// BOUNDS THE THING CANON ACTUALLY CONSTRAINS. The first version of these recipes passed every one
// of them while a raw mana breath climbed **2.7 blocks typically and 4.0 at the tail**, accelerating
// the whole way toward a 3.6 blocks/sec terminal rise — a plume taller than the keeper looking at
// it. That is a mana-well. Green suite, canon violation, and nothing in the oracle could see it,
// because "gravity is negative" answers *which way* and never *how far*.
//
// ★ SO FLY THE PARTICLE. `stepVelocity` is the world's own integrator, imported rather than
// re-typed — a copy of the physics here would prove a trajectory nothing in the game flies.
{
  const dt = 1 / 60
  /** Blocks risen over a life, using the world's integrator at 60fps. */
  const rise = (r: { gravity: number; drag: number }, vy0: number, life: number): number => {
    let y = 0, vy = vy0
    for (let t = 0; t < life; t += dt) { vy = stepVelocity(vy, r.gravity, r.drag, dt); y += vy * dt }
    return y
  }

  // The worst case the spawner can actually produce: `spawn` jitters life ×1.25, and the breath
  // launch speed is `speed × (0.5..1.4) × 0.5`. Assert the TAIL, not the average — the particle a
  // player's eye follows is the one that goes furthest, and an average would hide it.
  const CEILING = 1.0   // a block. The breath must read as lifting OFF the block, not leaving it.
  for (const b of BREATHING_BUCKETS) {
    const r = breathFor(b)!
    const tail = rise(r, r.speed * 1.4 * 0.5, r.life * 1.25)
    ok(tail > 0.05, `a ${b} breath actually leaves the block (rose ${tail.toFixed(2)})`)
    ok(tail < CEILING,
       `a ${b} breath stays a LEAK, not a fountain — longest-lived rises ${tail.toFixed(2)} blocks, ceiling ${CEILING}`)
  }

  // ★ AND THE TWO MUST STILL BE TELLABLE APART, or bounding them has flattened canon's own
  // distinction into one effect wearing two names.
  const cr = breathFor('crystal')!, rm = breathFor('rawmana')!
  ok(rise(rm, rm.speed * 1.4 * 0.5, rm.life * 1.25) > rise(cr, cr.speed * 1.4 * 0.5, cr.life * 1.25),
     'raw mana still breathes further than crystal after both are bounded')
}

// ── 8c. ⚠⚠ AND THE WORLD MUST ACTUALLY FLY THE INTEGRATOR § 8b FLIES ──────────────────────────
// § 8b is only worth anything because `stepVelocity` is the SAME arithmetic the game runs. If
// anyone ever re-inlines `Math.pow(drag, dt)` back into `tick()`, the oracle keeps happily flying
// this module while the world flies something else — both internally consistent, about different
// things. That is the module-and-its-consumer trap this repo has already paid for once, where a
// 371-assert oracle called a function directly and the game reached it through a pre-filter.
{
  const fx = codeOnly(readFileSync(join(DIR, 'break-fx.ts'), 'utf-8'))
  ok(/stepVelocity\s*\(/.test(fx), 'the GPU pass integrates through the shared stepVelocity')
  // All THREE axes, because a partial adoption is the version nobody notices: x and z pass gravity
  // 0 through the same function rather than keeping a second, simpler copy beside it.
  ok((fx.match(/stepVelocity\s*\(/g) ?? []).length >= 3,
     'all three axes go through it — a leftover inline axis is a second copy of the physics')
  ok(!/Math\.pow\(\s*drag/.test(fx),
     'and no inline drag maths survives in the pass — that is what § 8b would stop being able to see')
}

// ── 9. ⛔ THE NOUN. `motes` IS RULED AND MEANS SOMETHING ELSE ──────────────────────────────────
// 2026-07-21: "the drifting motes are the Anemonyx's wind-borne seeds." Using it for mining debris
// would put seeds in the air every time a keeper hits a rock. The cheapest way it comes back is
// somebody who never read that ruling reaching for the obvious English word.
//
// ⚠⚠ AND THE FIRST VERSION OF THIS GUARD COULD NOT HAVE PASSED. Both modules EXPLAIN the ban in
// their own prose, so a plain search for the word finds their documentation and reports it as the
// violation — a comment accurate enough to warn the next reader is what trips it. That is this
// repo's "documenting a marker created a marker" bug exactly, and my first draft answered it with a
// regex that whitelisted the sentences I happened to have written, which would rot the moment
// anyone reworded them.
//
// ★ THE FIX IS TO ASK THE RIGHT QUESTION: the ban is on what the CODE names the thing, not on
// whether the prose may discuss it. `testing/guard.ts` › `codeOnly` is the shared stripper that
// exists because six hand-rolled ones had already drifted into four behaviours.
{
  const specCode = codeOnly(readFileSync(join(DIR, 'break-fx-spec.ts'), 'utf-8'))
  const fxCode = codeOnly(readFileSync(join(DIR, 'break-fx.ts'), 'utf-8'))
  const banned = /\bmotes?\b/i          // word-boundaried: `remotes`/`promotes` are not the noun
  ok(!banned.test(specCode), 'no CODE in the spec module names the freed light "motes"')
  ok(!banned.test(fxCode), 'and none in the GPU pass does either')
  // ⚠ The negative above is satisfied by a module that says nothing at all, so assert the positive
  // too: the canon word is actually the one in use. An absence claim needs the presence beside it.
  ok(/breathFor/.test(specCode) && /breathFor/.test(fxCode),
     'the canon word "breath" is what both halves actually call it')
  // And prove the stripper really removed the prose, or the two asserts above are vacuous — both
  // files DO discuss "motes" in comments, so a working stripper must leave that behind.
  ok(/\bmotes?\b/i.test(readFileSync(join(DIR, 'break-fx-spec.ts'), 'utf-8')),
     'the spec still EXPLAINS the ban in prose — if this fails the guard above is testing nothing')
}

console.log(`break-fx-spec: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
