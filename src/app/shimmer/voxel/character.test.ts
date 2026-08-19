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
  treeDensityAt, speciesFactor, floraCharacterAt, landMix, sharpenWeights, accentAt, accentThreshold, findLands, interiorAt,
  CHARACTER_SHARP, type LandId,
} from './character'
import { treeStartsAt, DEFAULT_TREES, SPECIES } from './trees'
import { wildsSwallows } from './column'
import { floraAt, MAX_FLORA_K, MAX_FLOWER_K, MAX_TALL_K } from './flora'
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
// ⚠ §3 AND §4 READ THE RAW WEIGHTS ON PURPOSE, not `landMix`. The claim under test is the
// RELATIONSHIP between the underlying distribution and what the ground does with it — "where the
// fields say 70% dell, is the ground dell" — and measuring dominance on the sharpened vector would
// be asking the sharpening to grade its own work. Every other section asks "am I inside this land",
// which IS the sharpened question, and reads `landMix`.
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
  // ⚠ A MARSH IS TURF WITH MUD THROUGH IT, and that is a ruling the render forced (see the table).
  // Mud as the base read as a mudflat and, worse, left almost nothing able to grow on the one land
  // whose whole character is reeds. So the bare ground is the ACCENT here, and crag is the only
  // land that is bare all the way down.
  ok(DRESS.marsh.accent === MAT.MARSH_MUD && TURF.has(DRESS.marsh.surface),
    'a marsh grows reeds, with bare wet mud showing through it')
  ok(DRESS.crag.surface === MAT.SCREE && !TURF.has(DRESS.crag.surface),
    'a crag is the one land bare all the way down')
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

// ── 11. ★ SLICE ② — THE DIALS BLEND, AND BLENDING IS NOT THE SAME CLAIM AS ROLLING ────────────
// The ground rolls because a block is discrete. Every dial here is continuous and therefore blends,
// which buys a strictly stronger property: no seam at all, not even a dithered one.
//
// ★★ THE TEST IS THAT THE GRADIENT SCALES WITH THE SAMPLE SPACING, which is the honest way to ask
// "is this continuous" and the one a threshold cannot fake. A step function's jump is the same size
// however finely you sample across it; a ramp's shrinks in proportion. So halving the stride must
// roughly halve the largest observed delta. A first cut asserted `|delta| < 0.35` at a 4-block
// stride and went red the moment the blend was sharpened — correctly reporting a steeper ramp and
// wrongly calling it a seam, which is exactly the confusion this formulation removes.
{
  const maxDelta = (step: number) => {
    let m = 0, n = 0
    for (let z = -900; z <= 900; z += 53) {
      let prev: number | null = null
      for (let x = -900; x <= 900; x += step) {
        const d = treeDensityAt(x, z, SEED, DRESS)
        if (prev !== null) { m = Math.max(m, Math.abs(d - prev)); n++ }
        prev = d
      }
    }
    return { m, n }
  }
  const fine = maxDelta(1), coarse = maxDelta(4)
  ok(fine.n > 20000, `the walk covered ground (${fine.n} steps)`)
  ok(fine.m < coarse.m * 0.6,
    `★ tree density is a ramp, not a step — 4x finer sampling shrinks the max jump (${fine.m.toFixed(3)} vs ${coarse.m.toFixed(3)})`)
  ok(fine.m < 0.25, `and no single block changes the woods wholesale (${fine.m.toFixed(3)})`)

  // And it must actually VARY, or "blends" is being satisfied by a constant.
  let lo = Infinity, hi = -Infinity
  for (let z = -1200; z <= 1200; z += 37) for (let x = -1200; x <= 1200; x += 37) {
    const d = treeDensityAt(x, z, SEED, DRESS)
    lo = Math.min(lo, d); hi = Math.max(hi, d)
  }
  ok(hi - lo > 0.6, `tree density spans real range (${lo.toFixed(2)}..${hi.toFixed(2)})`)
}

// ── 12. ★ SOME COUNTRY GROWS NO TREES, which is Alex's ask stated as an assert ────────────────
// *"producing a certain tree (or no trees)"*. Bare country is what makes wooded country read as
// wooded, so this fails if every land drifts up into the middle of the range during a retune.
{
  ok(DRESS.crag.treeK === 0, 'a crag grows no trees at all')
  ok(DRESS.barrens.treeK < 0.25, 'a barrens is very nearly bare')
  ok(DRESS.deepwood.treeK > DRESS.meadow.treeK, 'a forest core carries more than open meadow')
  // Belt and braces from the other side: a crag's GROUND is outside TURF, so the planter refuses
  // it even if treeK were changed. Two independent reasons, because this is the one Alex named.
  ok(!TURF.has(DRESS.crag.surface), 'and a crag could not host a trunk even if treeK said yes')

  // Measured through the real planter: bare land must actually come out bare.
  let cragCols = 0, cragTrees = 0, woodCols = 0, woodTrees = 0
  for (let cz = -90; cz <= 90; cz += 3) for (let cx = -90; cx <= 90; cx += 3) {
    const { id, t } = dominantLand(landMix(cx * 16 + 8, cz * 16 + 8, SEED))
    if (t < 0.6) continue
    const n = treeStartsAt(SEED, cx, cz, 16, DEFAULT_TREES).length
    if (id === 'crag' || id === 'barrens') { cragCols++; cragTrees += n }
    if (id === 'deepwood') { woodCols++; woodTrees += n }
  }
  ok(cragCols > 10 && woodCols > 10, `found both kinds of country (${cragCols} bare, ${woodCols} wood)`)
  const bareRate = cragTrees / Math.max(1, cragCols), woodRate = woodTrees / Math.max(1, woodCols)
  ok(bareRate < woodRate * 0.35,
    `★ bare country is visibly barer than wood (${bareRate.toFixed(2)} vs ${woodRate.toFixed(2)} trunks/column)`)
}

// ── 13. ★ THE SAME FOUR RULED SPECIES MAKE DIFFERENT WOODS ────────────────────────────────────
// Moved here from biome.test.ts with `speciesFactor` itself. Species NAMES are canon and there are
// four; where each likes to grow is build tuning and is mine. The claim is that a dell and a
// highland grow visibly different woods out of that same four — if they did not, the whole slice
// buys nothing for trees.
{
  for (const sp of SPECIES) {
    ok(speciesFactor(sp.id, SEED, 0, 0, DRESS) > 0, `${sp.id} has a sane multiplier everywhere`)
  }
  // ⚠ EVERY SAMPLED COLUMN IS ITSELF CHECKED TO BE IN THE LAND. The first cut found one column of
  // the target land and then swept an 8x8 CHUNK block from it — 128 blocks on a side, far larger
  // than the interior it had just found, so most of the sample was somewhere else and the shares it
  // compared were mostly the world's average against itself. It reported dawnwood at 0.07 in deep
  // wood against 0.12 in a dell, the exact reverse of the table, from a sample that was neither.
  const share = (want: LandId, sp: string) => {
    let hit = 0, total = 0, cols = 0
    for (let cz = -110; cz <= 110 && cols < 260; cz += 1) for (let cx = -110; cx <= 110 && cols < 260; cx += 1) {
      const d = dominantLand(landMix(cx * 16 + 8, cz * 16 + 8, SEED))
      if (d.id !== want || d.t < 0.62) continue
      cols++
      for (const t of treeStartsAt(SEED, cx, cz, 16, DEFAULT_TREES)) { total++; if (t.species.id === sp) hit++ }
    }
    return { share: total === 0 ? -1 : hit / total, total, cols }
  }
  const wDell = share('dell', 'starwillow'), wHigh = share('highland', 'starwillow')
  ok(wDell.total > 30 && wHigh.total > 5, `sampled real woods (dell ${wDell.total} trunks, highland ${wHigh.total})`)
  // ⚠ RATIOS, NOT ORDERING. `a > b` passed even with starwillow's dell multiplier collapsed from
  // 3.5 to 0.2 (mutation M11): a dell also suppresses goldwood, so the willow share drifts up on
  // its own and the bare comparison was reading that drift rather than the preference under test.
  // The real separations are 8.4x, 11.7x and 1.7x — these bars sit well inside them and well
  // outside anything the surrounding weights can produce by accident.
  ok(wDell.share > wHigh.share * 2.5,
    `★ starwillow takes the dells, not the heights (${wDell.share.toFixed(2)} vs ${wHigh.share.toFixed(2)})`)
  const gHigh = share('highland', 'goldwood'), gDell = share('dell', 'goldwood')
  ok(gHigh.share > gDell.share * 1.3, `★ goldwood takes the heights (${gHigh.share.toFixed(2)} vs ${gDell.share.toFixed(2)})`)
  const dDeep = share('deepwood', 'dawnwood'), dDell = share('dell', 'dawnwood')
  ok(dDeep.share > dDell.share * 2.5, `★ dawnwood concentrates in deep wood (${dDeep.share.toFixed(3)} vs ${dDell.share.toFixed(3)})`)
}

// ── 14. ★ THE CONSERVATIVE FLORA GATE IS ACTUALLY CONSERVATIVE ────────────────────────────────
// ⚠ THE ONE ASSERT IN THIS FILE THAT GUARDS A PERFORMANCE SHORTCUT'S CORRECTNESS. `floraAt` gates
// on the LARGEST multiplier any land can ask for, so it can read land character only for survivors
// and keep one hash on the world's hot path. A land tuned past one of those maxima does not throw
// and does not look wrong — it just silently stops growing the flora it was tuned to grow, in that
// land only. The gate constants must dominate the table, and here is where that is checked rather
// than remembered.
{
  for (const id of LAND_IDS) {
    const c = DRESS[id as LandId]
    ok(c.floraK <= MAX_FLORA_K + 1e-9, `${id}'s floraK is within the gate ceiling (${c.floraK} <= ${MAX_FLORA_K})`)
    ok(c.flowerK <= MAX_FLOWER_K + 1e-9, `${id}'s flowerK is within the gate ceiling (${c.flowerK} <= ${MAX_FLOWER_K})`)
    ok(c.tallK <= MAX_TALL_K + 1e-9, `${id}'s tallK is within the gate ceiling (${c.tallK} <= ${MAX_TALL_K})`)
  }
  // ...and the ceilings must be TIGHT, or the shortcut stops shortcutting: a ceiling far above the
  // table lets most of the world past the cheap gate and into the expensive read.
  const maxF = Math.max(...LAND_IDS.map(i => DRESS[i as LandId].floraK))
  ok(MAX_FLORA_K <= maxF * 1.25, `the flora ceiling tracks the table rather than towering over it (${MAX_FLORA_K} vs ${maxF})`)
}

// ── 15. ★ GROUND COVER ACTUALLY DIFFERS BY LAND, measured through the real field ───────────────
{
  const cover = (want: LandId) => {
    let cells = 0, plants = 0, tall = 0
    for (let z = -1400; z <= 1400 && cells < 4000; z += 3) for (let x = -1400; x <= 1400 && cells < 4000; x += 3) {
      const { id, t } = dominantLand(landMix(x, z, SEED))
      if (id !== want || t < 0.6) continue
      cells++
      const f = floraAt(x, z, SEED)
      if (f) { plants++; if (f.kind === 2) tall++ }
    }
    return { cells, rate: plants / Math.max(1, cells), tallShare: tall / Math.max(1, plants) }
  }
  const meadow = cover('meadow'), barrens = cover('barrens'), deep = cover('deepwood'), marsh = cover('marsh')
  ok(meadow.cells > 200 && barrens.cells > 100, `sampled enough of each land (${meadow.cells}/${barrens.cells})`)
  ok(meadow.rate > barrens.rate * 1.8,
    `★ a meadow is greener than a barrens (${meadow.rate.toFixed(3)} vs ${barrens.rate.toFixed(3)})`)
  ok(deep.rate < meadow.rate, `a wood core floor is dimmer than open meadow (${deep.rate.toFixed(3)} vs ${meadow.rate.toFixed(3)})`)
  if (marsh.cells > 50)
    ok(marsh.tallShare > meadow.tallShare,
      `★ a marsh reads as reeds — tall grass share (${marsh.tallShare.toFixed(2)} vs ${meadow.tallShare.toFixed(2)})`)
}

// ── 15b. ★ ACCENTS ARE PATCHES AND THEY LAND AT THE SHARE THE TABLE ASKS FOR ──────────────────
// Two claims, and the world needed both. The SHARE keeps `accentThreshold`'s fitted quadratic
// honest — it approximates fbm2's quantiles, and an approximation nobody measures is a constant
// waiting to drift. The CONTIGUITY is the one a screenshot caught and no oracle did: the previous
// cut decided every block independently, so the accent came out as isolated single tiles and the
// marsh rendered as a lino floor. Independent blocks give a ~4x lower run length than patches do.
{
  for (const id of LAND_IDS) {
    const c = DRESS[id as LandId]
    if (!c.accent) continue
    let hit = 0, n = 0
    for (let z = -900; z <= 900; z += 7) for (let x = -900; x <= 900; x += 7) {
      n++; if (accentAt(x, z, SEED, c.accentP)) hit++
    }
    const got = hit / n
    ok(Math.abs(got - c.accentP) < 0.04,
      `${id}'s accent lands at the share the table asks for (${(got * 100).toFixed(1)}% vs ${(c.accentP * 100).toFixed(0)}%)`)
  }

  // ★ CONTIGUITY, measured as mean run length along a scanline. A per-block roll at p=0.22 gives
  // runs averaging 1/(1-p) ≈ 1.28 blocks — single tiles, which is the chessboard. Patches must be
  // several blocks across. This is the assert that would have caught the render bug.
  const runs = (p: number) => {
    let total = 0, count = 0, run = 0
    for (let z = -400; z <= 400; z += 13) {
      run = 0
      for (let x = -400; x <= 400; x++) {
        if (accentAt(x, z, SEED, p)) run++
        else if (run > 0) { total += run; count++; run = 0 }
      }
      if (run > 0) { total += run; count++ }
    }
    return count === 0 ? 0 : total / count
  }
  const r = runs(0.22)
  ok(r > 3, `★ accent patches are several blocks across, not single tiles (mean run ${r.toFixed(2)})`)
  ok(accentThreshold(0.22) > 0.5 && accentThreshold(0.22) < 0.75, 'the fitted threshold sits inside the field range')
  // Determinism, like everything else here.
  ok(accentAt(101, -37, SEED, 0.2) === accentAt(101, -37, SEED, 0.2), 'the accent field is deterministic')
}

// ── 15c. ★ `findLands` — the tour has to land you somewhere that EXISTS ────────────────────────
// The review tools (`/land`, `scripts/land-tour.mts`) both go through this, and its first run
// without an exclusion produced nine sites and EIGHT IDENTICAL PICTURES: every "nearest" answer
// from spawn sits inside the fold's bubble, where there is no ground at any altitude, so the
// teleports silently did nothing and the contact sheet was eight copies of the spawn view. That
// reads as "the biome layer does nothing" rather than as "the tour is broken", which is the worst
// possible failure for an instrument — it indicts the thing it was built to measure.
{
  const sites = findLands(0, 0, SEED, { exclude: wildsSwallows })
  ok(sites.length >= 7, `the tour finds most of the nine lands from spawn (${sites.length})`)
  ok(new Set(sites.map(s => s.id)).size === sites.length, 'each land appears at most once')
  for (const s of sites) {
    ok(!wildsSwallows(s.x, s.z), `★ ${s.id}'s site is outside the fold — somewhere a keeper can stand`)
    // The site must actually BE the land it claims, or the picture is evidence about nothing.
    ok(dominantLand(landMix(s.x, s.z, SEED)).id === s.id, `${s.id}'s site really is ${s.id}`)
    ok(s.t >= 0.62, `${s.id}'s site is a real interior (${s.t.toFixed(2)})`)
  }
  // Without the exclusion it must find swallowed sites — otherwise the guard above is vacuous and
  // would keep passing after someone removed the reason it exists.
  const naive = findLands(0, 0, SEED)
  ok(naive.some(s => wildsSwallows(s.x, s.z)),
    'and the exclusion is load-bearing: without it the search does propose sites inside the fold')
}

// ── 15d. ★★ A SITE IS ITS NEIGHBOURHOOD, NOT ITS POINT ────────────────────────────────────────
// The assert 15c could not make. `!wildsSwallows(x,z)` and `t >= 0.62` BOTH pass on a site pinned
// to the exclusion boundary, and that is exactly what shipped: the tour's contact sheet came back
// with eight of nine sites at 735-738 blocks — `maxShellRadius` 515 plus the tour's 220 clearance
// margin — because a nearest-search against a hard exclusion always answers on its edge. Nine
// compass bearings on one ring, every one the fringe of its land. The suite was green throughout,
// for the same reason the accent chessboard was green: every assert measured HOW MUCH land was at
// the point and none measured WHAT WAS AROUND IT.
{
  // 0.75 with headroom: at the shipped `examine` the worst land measures 83% (crag) and the mean
  // is 94%. A site pinned to the exclusion ring scores ~50% — half its neighbourhood is the
  // excluded disc — so the floor sits well clear of both the pass and the fail.
  const INTERIOR_FLOOR = 0.75
  const sites = findLands(0, 0, SEED, { exclude: wildsSwallows })
  for (const s of sites) {
    const measured = interiorAt(s.x, s.z, s.id, SEED, wildsSwallows)
    ok(measured >= INTERIOR_FLOOR,
      `★ ${s.id}'s site is INTERIOR, not fringe — ${(measured * 100).toFixed(0)}% of its surroundings are ${s.id}`)
    ok(Math.abs(measured - s.interior) < 1e-9, `${s.id} reports the interior it was scored on`)
  }
  // ⚠ THE PAIRED NEGATION, and it is the whole point of the section. A huge `distCost` makes the
  // score distance alone, which IS the first cut's sort key — so this reproduces the shipped bug on
  // demand. If it ever stops finding a fringe site, the fix above has become untested and this
  // section is decoration.
  const nearestOnly = findLands(0, 0, SEED, { exclude: wildsSwallows, distCost: 1e6 })
  ok(nearestOnly.some(s => interiorAt(s.x, s.z, s.id, SEED, wildsSwallows) < INTERIOR_FLOOR),
    'and sorting by distance alone still pins sites to the fringe: the interior score is load-bearing')
  // And it must actually be the BOUNDARY it pins them to, not merely somewhere worse — that is the
  // difference between "nearest is a bit worse" and the specific failure this section is named for.
  const ring = 515 + 0   // maxShellRadius(WILDS_BUBBLE); margin 0 here, so the ring is the shell
  ok(nearestOnly.filter(s => s.dist < ring + 60).length >= 5,
    `sorting by distance alone piles most sites onto the exclusion ring (~${ring}b)`)
}

// ── 15e. ★ THE EXCLUDED PROBE, PINNED WHERE IT ACTUALLY LIVES ─────────────────────────────────
// `interiorAt` keeps an excluded probe in the DENOMINATOR, so a point hard against the exclusion
// cannot score above ~0.5 however pure the reachable half is. That line was mutation-tested and
// the whole suite stayed green through it — because site selection is carried by scoring the
// neighbourhood at all and by spreading the examined sample, not by this. It is a guard, and a
// guard nothing can feel is decoration, so it is asserted here on the function rather than left
// to §15d where it would pass either way.
{
  // A point just outside the shell: reachable, but with the fold filling half its surroundings.
  const R = 520
  let pinned = 0
  for (let a = 0; a < 12; a++) {
    const th = (a * 2 * Math.PI) / 12
    const x = Math.round(R * Math.cos(th)), z = Math.round(R * Math.sin(th))
    if (wildsSwallows(x, z)) continue
    const id = dominantLand(landMix(x, z, SEED)).id
    const guarded = interiorAt(x, z, id, SEED, wildsSwallows)
    const blind = interiorAt(x, z, id, SEED)
    ok(guarded <= blind, `${id} at ${a}: counting the fold against a site can only lower its score`)
    if (guarded < blind) pinned++
  }
  ok(pinned > 0,
    '★ an excluded probe counts AGAINST a site: hard against the fold, the guarded score is strictly worse')
}

// ── 16. ★ ONE DISTRIBUTION, READ TWO WAYS — the roll and the dials must not disagree ──────────
// Found by this suite on 2026-08-19: the roll sharpened and the blend did not, so a dell got its
// ground from a confident distribution and its CHARACTER from a diluted one — `tallK` 3.0 arriving
// as ~1.6, a marsh reading as slightly long grass instead of reeds. The two must read the same
// vector. This asserts it structurally rather than by eye.
{
  ok(CHARACTER_SHARP >= 2, 'the sharpening exponent is actually sharpening (see §3)')

  // Every land must be able to speak for its own interior. Before the unification, dell, marsh,
  // highland and crag NEVER cleared 0.62 anywhere in a 240x240-chunk window.
  const peak: Record<string, number> = {}
  for (let cz = -110; cz <= 110; cz += 2) for (let cx = -110; cx <= 110; cx += 2) {
    const { id, t } = dominantLand(landMix(cx * 16 + 8, cz * 16 + 8, SEED))
    peak[id] = Math.max(peak[id] ?? 0, t)
  }
  for (const id of LAND_IDS)
    ok((peak[id] ?? 0) > 0.62, `${id} reaches a real interior somewhere (peak ${(peak[id] ?? 0).toFixed(2)})`)

  // And the dials must READ that vector: a land deep inside itself gets its OWN character, not an
  // average of the world's. Checked against the table, so it cannot rot into a remembered number.
  for (const id of ['marsh', 'barrens', 'deepwood', 'crag', 'dell'] as LandId[]) {
    let best = -1, bx = 0, bz = 0
    for (let cz = -110; cz <= 110; cz += 2) for (let cx = -110; cx <= 110; cx += 2) {
      const x = cx * 16 + 8, z = cz * 16 + 8
      const d = dominantLand(landMix(x, z, SEED))
      if (d.id === id && d.t > best) { best = d.t; bx = x; bz = z }
    }
    ok(best > 0.7, `${id} has a deep interior to sample (${best.toFixed(2)})`)
    if (best <= 0.7) continue
    const lc = floraCharacterAt(bx, bz, SEED, DRESS)
    const want = DRESS[id]
    // ⚠ THE BAR IS 0.85, NOT 0.55, AND THAT IS WHAT MAKES IT AN ASSERT. Measured with the shared
    // sharpened mix, a deep interior lands at 0.95-1.16 of its own table value. A loose bar passed
    // the very bug this section was written for (mutation M10: the dials reading raw weights put a
    // marsh at ~0.63 of its own reeds, which is the dilution that made this unification necessary).
    ok(lc.tallK > want.tallK * 0.85 && lc.tallK < want.tallK * 1.35 + 0.1,
      `★ ${id} deep inside itself gets its own reeds/turf (tallK ${lc.tallK.toFixed(2)} vs ${want.tallK})`)
    ok(lc.floraK > want.floraK * 0.85 && lc.floraK < want.floraK * 1.35 + 0.05,
      `★ ${id}'s ground cover is its own, not the world's average (${lc.floraK.toFixed(2)} vs ${want.floraK})`)
    // ...and the SAME must hold for tree density, which reads the mix through a different function.
    // Without this line a dilution confined to `treeDensityAt` passes the whole suite.
    const td = treeDensityAt(bx, bz, SEED, DRESS)
    ok(td > want.treeK * 0.85 - 0.06 && td < want.treeK * 1.35 + 0.06,
      `★ ${id} deep inside itself gets its own tree density (${td.toFixed(2)} vs ${want.treeK})`)
  }
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the country wears its character — ${pass} passed. Now go LOOK at it (:3200 /shimmer)`)
