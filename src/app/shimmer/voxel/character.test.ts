// Character oracle. Run: npx tsx src/app/shimmer/voxel/character.test.ts
//
// The layer's job is that country reads as SOMEWHERE, and the two ways that fails are opposite, so
// most of what is pinned here is a pair of bounds rather than a single claim:
//   · too soft — the sharpening gives out, every interior fills with confetti from its neighbours,
//     and the world reads as static instead of as places;
//   · too hard — the roll collapses to argmax, every border becomes a contour line, and we have
//     rebuilt the pre-1.18 seam the whole stack is arranged to avoid.
// A screenshot can tell you which of those you are looking at instantly and cannot tell you the
// distribution; these asserts are the other half. Neither replaces the other.

import {
  LAND_IDS, landWeights, landRollAt, dominantLand, landCharacter, surfaceBlockAt,
  CHARACTER_SHARP, type LandId,
} from './character'
import { columnHeight } from './height'
import { MAT, TURF, DEFAULT_DEPTH, materialAt } from './depth'
import { blockDef } from './registry'
// ⚠ Host-side import, and legal ONLY because purity.test.ts scans non-test files. The claim being
// checked spans the boundary — a ground is only real once the renderer can draw it — so the test
// has to see both sides.
import { TILE_MATERIALS, layerOf, FALLBACK_LAYER, TOP, SIDE, BOTTOM } from '../voxel3d/tex/tiles'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const DRESS = landCharacter({
  topsoil: MAT.TOPSOIL, loam: MAT.FOREST_LOAM, lush: MAT.LUSH_TURF, mud: MAT.MARSH_MUD,
  dry: MAT.DRY_GRASS, highland: MAT.HIGHLAND_TURF, scree: MAT.SCREE,
  subsoil: MAT.SUBSOIL, stone: MAT.STONE,
})

// ── 1. determinism, and the weights are a real distribution ─────────────────────────────────────
{
  const a = landWeights(4021, -1777, SEED)
  const b = landWeights(4021, -1777, SEED)
  ok(a.every((v, i) => v === b[i]), 'landWeights is deterministic')
  ok(landRollAt(4021, -1777, SEED) === landRollAt(4021, -1777, SEED), 'the roll is deterministic')
  ok(landWeights(4021, -1777, SEED + 1).some((v, i) => v !== a[i]), 'the weights answer to the seed')

  let bad = 0, unsummed = 0
  for (let z = -2000; z <= 2000; z += 137) for (let x = -2000; x <= 2000; x += 137) {
    const w = landWeights(x, z, SEED)
    if (w.length !== LAND_IDS.length) bad++
    let s = 0
    for (const v of w) { if (!Number.isFinite(v) || v < 0) bad++; s += v }
    if (Math.abs(s - 1) > 1e-9) unsummed++
  }
  ok(bad === 0, `every weight is finite and non-negative (${bad} bad)`)
  // ★ The meadow floor term exists for exactly this: a normalisation whose denominator can reach 0
  // is a NaN waiting for the one column where every band happens to miss, and a NaN surface block
  // renders as the magenta fallback layer in the middle of a field.
  ok(unsummed === 0, `the weights are normalised on every column (${unsummed} off)`)
}

// ── 2. every land is REACHABLE, and none of them owns the world ─────────────────────────────────
// A land that never rolls is dead code wearing a table entry; a land over the ceiling has stopped
// being a place and become the background. Measured over real country — ≥1200 units a side, per
// height.ts's own warning about sampling smaller than one feature of the field.
{
  const seen: Record<string, number> = {}
  let n = 0
  for (let z = -1600; z <= 1600; z += 8) for (let x = -1600; x <= 1600; x += 8) {
    const h = columnHeight(x, z, SEED)
    if (h <= DEFAULT_DEPTH.seaLevel + DEFAULT_DEPTH.beachHeight) continue
    seen[landRollAt(x, z, SEED)] = (seen[landRollAt(x, z, SEED)] || 0) + 1
    n++
  }
  for (const id of LAND_IDS) {
    const share = (seen[id] || 0) / n
    ok(share > 0.005, `${id} is reachable country, not dead code (${(share * 100).toFixed(1)}%)`)
    ok(share < 0.55, `${id} is a place, not the background (${(share * 100).toFixed(1)}%)`)
  }
  // The default has to actually be the default, or the world has no connective tissue between its
  // set pieces and every walk is a tour of exceptions.
  ok((seen['meadow'] || 0) / n > 0.15, 'open meadow is still what the world is between its places')
}

// ── 3. ★ INTERIORS ARE PURE — the confetti test, and the reason CHARACTER_SHARP exists ──────────
// Rolling the raw weights would dress a 70/30 column as 70/30 confetti. This is the assert that
// fails the moment the exponent is dropped: deep inside a land (dominance ≥ 0.7) the ground must be
// that land's, essentially always.
{
  let inside = 0, wrong = 0
  for (let z = -1500; z <= 1500; z += 7) for (let x = -1500; x <= 1500; x += 7) {
    const { id, t } = dominantLand(landWeights(x, z, SEED))
    if (t < 0.7) continue
    inside++
    if (landRollAt(x, z, SEED) !== id) wrong++
  }
  ok(inside > 500, `the interior test found interiors to check (${inside})`)
  ok(wrong / inside < 0.02, `a land's interior wears its own ground (${((wrong / inside) * 100).toFixed(1)}% confetti)`)
}

// ── 4. ★ BORDERS DITHER — the seam test, and the opposite failure from §3 ───────────────────────
// Where two lands are genuinely close, BOTH must appear, interleaved. If the roll ever collapses to
// argmax this goes to zero and the world grows contour lines — which is the exact mistake height.ts
// is built to refuse and the reason character is a weight rather than a label.
{
  let contested = 0, minority = 0
  for (let z = -1500; z <= 1500; z += 7) for (let x = -1500; x <= 1500; x += 7) {
    const w = landWeights(x, z, SEED)
    const { id, t } = dominantLand(w)
    const second = Math.max(...w.filter((_, i) => LAND_IDS[i] !== id))
    if (t - second > 0.08) continue          // not a border
    contested++
    if (landRollAt(x, z, SEED) !== id) minority++
  }
  ok(contested > 300, `the border test found borders to check (${contested})`)
  ok(minority / contested > 0.15, `borders interleave rather than stepping (${((minority / contested) * 100).toFixed(1)}% minority)`)
}

// ── 5. the table only names materials the world actually knows ──────────────────────────────────
// ⚠ THIS IS THE ONE THAT CATCHES A TYPO'D ID, and the failure it prevents is not subtle: an
// unregistered material has no `paintFor` case, and the tile switch's default is the ORE painter —
// which is how every tree once rendered as crystal. It also breaks unmineably, since `blockDef`
// backs hardness and drops.
{
  for (const id of LAND_IDS) {
    const c = DRESS[id as LandId]
    ok(!!blockDef(c.surface), `${id}'s ground is a registered block`)
    ok(c.accent === 0 || !!blockDef(c.accent), `${id}'s accent is a registered block`)
    ok(c.accentP >= 0 && c.accentP <= 1, `${id}'s accent probability is a probability`)
  }
}

// ── 6. ★ WHAT GROWS AND WHAT DOES NOT IS CHARACTER, not an accident of the TURF set ─────────────
// Marsh and crag are the two lands that must stay bare, and they stay bare because their ground is
// outside TURF. Asserting it here means "make mud plantable" cannot be done quietly in another file
// — it has to come and delete this line, which is where someone reads why it was true.
{
  ok(!TURF.has(MAT.MARSH_MUD), 'marsh mud grows nothing — a marsh is not a lawn')
  ok(!TURF.has(MAT.SCREE), 'scree grows nothing — a crag is bare by construction')
  ok(TURF.has(DRESS.meadow.surface) && TURF.has(DRESS.woodland.surface)
    && TURF.has(DRESS.deepwood.surface) && TURF.has(DRESS.dell.surface)
    && TURF.has(DRESS.tableland.surface) && TURF.has(DRESS.highland.surface),
    'every land that should grow things has ground that grows things')
  ok(DRESS.marsh.surface === MAT.MARSH_MUD && DRESS.crag.surface === MAT.SCREE,
    'the two bare lands are the two bare grounds')
}

// ── 7. ★ NO BARE STONE IS DITHERED ONTO SOIL — the layering law, learned the hard way ───────────
// depth.test.ts §5 asserts soil never sits under stone in a column. A STONE surface accent on an
// otherwise gentle column violates that directly, and it did: five inversions on the first cut.
// Bedrock at the surface is the CLIFF rule's business, and it already outranks land character.
{
  for (const id of LAND_IDS) {
    const c = DRESS[id as LandId]
    ok(c.accent !== MAT.STONE && c.accent !== MAT.DEEP_STONE,
      `${id} does not dither bare rock onto its ground (that is the cliff rule's job)`)
  }
}

// ── 8. the whole stack agrees: what depth.ts puts on the surface is a ground, never a surprise ──
{
  const KNOWN = new Set<number>([
    MAT.TOPSOIL, MAT.FOREST_LOAM, MAT.LUSH_TURF, MAT.MARSH_MUD, MAT.DRY_GRASS, MAT.HIGHLAND_TURF,
    MAT.SCREE, MAT.SUBSOIL, MAT.SAND, MAT.STONE, MAT.GREY_SOIL, MAT.PATH, MAT.SPRING_CRUST, MAT.WATER,
  ])
  let unknown = 0
  for (let z = -900; z <= 900; z += 11) for (let x = -900; x <= 900; x += 11) {
    const h = columnHeight(x, z, SEED)
    if (!KNOWN.has(materialAt(x, h, z, SEED, h))) unknown++
  }
  ok(unknown === 0, `every generated surface voxel is a known ground (${unknown} surprises)`)

  let bad = 0
  for (let z = -600; z <= 600; z += 13) for (let x = -600; x <= 600; x += 13)
    if (!blockDef(surfaceBlockAt(x, z, SEED, DRESS))) bad++
  ok(bad === 0, `surfaceBlockAt only ever answers with a registered block (${bad} bad)`)
}

// ── 9. ★ EVERY GROUND HAS A TEXTURE SLOT AND A PAINTER — the "renders as crystal" trap ─────────
// `TILE_MATERIALS` position IS the texture-array slot, and `paintFor`'s switch DEFAULTS TO THE ORE
// PAINTER. So a ground added to the world and forgotten in that file does not fall back to plain
// dirt — it renders as a crystal seam, in a meadow, at 45% of the world's surface. tiles.ts says so
// twice in its own comments because it has already happened once, to the trees. This is the assert
// that makes saying it a third time unnecessary.
{
  for (const id of LAND_IDS) {
    const c = DRESS[id as LandId]
    for (const m of [c.surface, c.accent]) {
      if (!m) continue
      ok(TILE_MATERIALS.includes(m), `${id}'s ${m === c.surface ? 'ground' : 'accent'} has a texture slot`)
      for (const face of [TOP, SIDE, BOTTOM])
        ok(layerOf(m, face) !== FALLBACK_LAYER, `${id}'s ${m} does not sample the magenta fallback (face ${face})`)
    }
  }
}

// ── 10. the sharpening dial is where the file says it is ────────────────────────────────────────
{
  ok(CHARACTER_SHARP >= 2, 'the sharpening exponent is actually sharpening (see §3)')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the country wears its character — ${pass} passed. Now go LOOK at it (:3200 /shimmer)`)
