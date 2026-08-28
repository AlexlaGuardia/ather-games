// Trees — the Forestry half of the world.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ── WHERE THIS SITS ─────────────────────────────────────────────────────────────────────────
//   depth rule → PRE-carve ore → carvers → POST-carve ore → **VEGETATION** → (player edits)
//
// Last, because a tree stands on finished ground: it needs the surface to exist, the carvers to
// have stopped moving it, and the ore to be in before anything is planted on top.
//
// ── ★ COMPOSITION, NOT A CATALOGUE (research steal from round 2) ─────────────────────────────
// Mojang ships nine trunk placers and eleven foliage placers because they have sixty biomes of
// silhouettes to tell apart. We have FOUR species, so a catalogue would be four bespoke generators
// that drift. Instead: two trunk implementations x two foliage implementations, and a species is a
// PARAMETER SET over them. Starwillow is the one that earns the forking trunk; the rest differ by
// height, radius and weight.
//
// ── ★ CROSS-COLUMN OWNERSHIP, SAME AS EVERYTHING ELSE ───────────────────────────────────────
// A canopy rooted near an edge spills into its neighbour. Mojang's answer is `in_square`: the
// trunk's ORIGIN is confined to the placing column, so exactly one column ever rolls a given tree,
// and neighbours clip whatever crosses. We already use this shape for carvers and ore — a column
// scans its neighbours' pure start functions and applies the overlap to its OWN sections. Nothing
// is pushed, so nothing has to wait.

import { Section, AIR } from './section'
import { MAT, TURF, LAND_DRESS } from './depth'
import { hash2, mixSeed } from './noise'
import { forestness } from './biome'
import { speciesFactor, treeDensityAt } from './character'

/**
 * How hard a lobe's radius is warped, as a fraction of r-squared. 0 is a perfect ellipsoid.
 *
 * ⚠ THIS IS THE SILHOUETTE DIAL, and it is deliberately large. Alex, 2026-08-13, looking at the
 * forest: the trees read as *primitives* — a pole with a ball on it. The canopy's SURFACE was
 * already fine (the mesher's crossed quads fray it nicely); what read as geometry was its SHAPE,
 * and no amount of surface detail rescues a sphere.
 */
const LUMP = 0.5

/** Wood materials. Continue past SEAM (which ends at 22) with room to spare. */
export const WOOD = {
  GOLDWOOD_LOG: 32, GOLDWOOD_LEAVES: 33,
  SHIMMEROAK_LOG: 34, SHIMMEROAK_LEAVES: 35,
  STARWILLOW_LOG: 36, STARWILLOW_LEAVES: 37,
  DAWNWOOD_LOG: 38, DAWNWOOD_LEAVES: 39,
} as const

/**
 * Is this material foliage? The ids alternate log/leaves per species, so leaves are the ODD ones in
 * the wood range — the same parity test `canLeaf` uses inline, named once now that the mesher, the
 * renderer and the census all have to agree on what a leaf is.
 *
 * ★ THIS IS THE SEAM FOR THE CANOPY'S LOOK, not just a tidy-up. Leaves leave the greedy sweep and
 * come back as crossed quads (see `greedy.ts`'s leaf pass), and the moment two files disagree about
 * which materials that applies to, a species' canopy renders as cubes while the rest render as
 * foliage — a difference nobody would trace back to a parity check.
 */
export const isLeafMat = (m: number): boolean =>
  m >= WOOD.GOLDWOOD_LEAVES && m <= WOOD.DAWNWOOD_LEAVES && m % 2 === 1

/**
 * Is this material a trunk? The other half of the same parity rule — logs are the EVEN ids in the
 * wood range.
 *
 * ★ NAMED HERE FOR THE SAME REASON `isLeafMat` IS. Leaf decay has to ask "is anything still holding
 * this canopy up", and a fourth hand-written species list (the mesher, the census and
 * `LOG_MATERIALS` in VoxelWorld are the others) is how a fifth species ships one day and decays a
 * whole forest because one of the four never heard of it.
 */
export const isLogMat = (m: number): boolean =>
  m >= WOOD.GOLDWOOD_LOG && m <= WOOD.DAWNWOOD_LOG && m % 2 === 0

export type TrunkShape = 'straight' | 'forking'
export type FoliageShape = 'blob' | 'layered'

export interface TreeSpecies {
  /** Matches the ruled NodeType in `world/resources.ts`. */
  id: string
  log: number
  leaves: number
  trunk: TrunkShape
  foliage: FoliageShape
  minHeight: number
  maxHeight: number
  /** Canopy radius at its widest. Sets the write margin, so it is a contract, not a hint. */
  radius: number
  /**
   * Blob species only: how hard the crown is flattened vertically. Semi-axis = radius / sqrt(squash),
   * so 1 is a sphere and anything past ~1.6 starts reading as a disc on a stick. See `foliageBlob`.
   * Optional because the layered placer builds its own profile out of tiers and never consults it.
   */
  squash?: number
  /**
   * Relative selection weight.
   *
   * ★ RARITY IS A WEIGHT, NOT A RARE FEATURE — the research is explicit about this. Making dawnwood
   * its own low-frequency placement pass would scatter it independently of the forest and it would
   * read as litter. As a weight it appears *within* woodland, which is what "rare tree" means.
   */
  weight: number
}

/**
 * The four ruled species. Names and drop tables are canon (`world/resources.ts`, minLevel 1/4/7/10);
 * heights, radii and weights are build tuning and are mine.
 */
export const SPECIES: TreeSpecies[] = [
  // ⚠ goldwood is 58% of the forest, so its proportions ARE the world's tree silhouette. minHeight
  // rose 5→6 with the taller crown: at 5 the crown swallowed the whole trunk and it read as a bush.
  { id: 'goldwood', log: WOOD.GOLDWOOD_LOG, leaves: WOOD.GOLDWOOD_LEAVES,
    trunk: 'straight', foliage: 'blob', minHeight: 6, maxHeight: 9, radius: 3, weight: 58, squash: 1.15 },
  { id: 'shimmeroak', log: WOOD.SHIMMEROAK_LOG, leaves: WOOD.SHIMMEROAK_LEAVES,
    trunk: 'straight', foliage: 'blob', minHeight: 7, maxHeight: 11, radius: 4, weight: 26, squash: 1.25 },
  // ★ The one species that earns the second trunk placer — a forking silhouette is the whole reason
  // two implementations exist rather than one.
  { id: 'starwillow', log: WOOD.STARWILLOW_LOG, leaves: WOOD.STARWILLOW_LEAVES,
    trunk: 'forking', foliage: 'layered', minHeight: 8, maxHeight: 13, radius: 5, weight: 12 },
  { id: 'dawnwood', log: WOOD.DAWNWOOD_LOG, leaves: WOOD.DAWNWOOD_LEAVES,
    trunk: 'straight', foliage: 'layered', minHeight: 10, maxHeight: 15, radius: 4, weight: 4 },
]

export interface TreeConfig {
  /** Expected trunks per column (16x16) INSIDE woodland. Fractional; the remainder is a probability. */
  perColumn: number
  /** Expected trunks per column in open country — the lone meadow tree, not a thinner forest. */
  meadowPerColumn: number
  /** Largest canopy radius across all species — the scan margin. Declared, not derived at runtime. */
  maxSpread: number
  /** Trees refuse ground above this; the treeline. */
  maxAltitude: number
  species: TreeSpecies[]
}

export const DEFAULT_TREES: TreeConfig = {
  perColumn: 1.7,          // unchanged — this was always a fine density FOR A FOREST
  meadowPerColumn: 0.05,   // ~one lone tree per 20 open columns; a meadow is not a void
  // ⚠ 6 → 7 with the lobed crown (2026-08-13): a satellite lobe's centre sits off the trunk, so the
  // canopy's true reach is now the offset PLUS that lobe's own warped radius, not just `radius`.
  // Raising it is free — `treeScanRadius` still rounds to one column at section 16 — and the
  // oracle now measures the real reach rather than trusting this number (see trees.test.ts).
  maxSpread: 7,
  maxAltitude: 165,     // datum+45, rebalanced with it
  species: SPECIES,
}

// ★ THE WOODLAND MASK MOVED TO biome.ts (2026-08-07). "Am I in a forest" is a biome question and
// the planter is one consumer of it, alongside the labeler and the later ambience/spawn layers —
// they all read `forestness` from there, so no two systems can disagree about where a forest is.
// The mask's tuning (forestScale/forestThreshold/forestFull) lives in BiomeConfig for the same
// reason. Alex's rule is unchanged: a forest is a PLACE you enter and leave, not a global density.

/** Deterministic per-tree stream. xorshift32 — identical sequence in TS and Rust. */
function rng(seed: number) {
  let s = seed | 0
  if (s === 0) s = 0x9e3779b9
  return () => { s ^= s << 13; s |= 0; s ^= s >>> 17; s ^= s << 5; s |= 0; return (s >>> 0) / 4294967296 }
}

export interface TreeStart {
  x: number; z: number
  species: TreeSpecies
  height: number
  seed: number
}

/**
 * Which trees column (cx, cz) OWNS. Pure, O(1), no neighbour reads.
 *
 * ★ The origin is confined to this column's own 16x16 — that is `in_square`, and it is the entire
 * anti-double-generation story. Exactly one column ever rolls a given tree; there is no cross-column
 * "was this already placed?" lookup to perform, because there is nothing to double-roll.
 */
export function treeStartsAt(seed: number, cx: number, cz: number, size: number, cfg: TreeConfig = DEFAULT_TREES): TreeStart[] {
  const out: TreeStart[] = []
  const base = (hash2(cx, cz, seed ^ 0x7ee5) * 4294967296) | 0
  const g0 = rng(base)
  // The mask scales EXPECTED count, not a per-tree veto — so the forest edge thins gradually and a
  // meadow still rolls its occasional lone tree from the same stream (determinism untouched).
  // ── ★ SLICE ② (2026-08-19): the mask says WHERE a forest is, the land says whether this
  // country carries trees at all ─────────────────────────────────────────────────────────────
  // These are two questions and the multiplication is the point. `forestness` stays Alex's rule
  // (a forest is a place you enter and leave, never a global density); `treeK` is what makes a
  // barrens bare and a wood core dense INSIDE that. A tableland can sit under a forest mask and
  // still be open ground, which is exactly the case a single mask could never express.
  //
  // ⚠ BLENDED, NOT ROLLED. A trunk count is continuous, so it eases from 1.18 in a wood core to
  // 0.15 in a barrens with no border at all — see `blend` in character.ts on why the discrete/
  // continuous split is the whole design and not an optimisation.
  const expected = (cfg.meadowPerColumn + forestness(seed, cx, cz) * (cfg.perColumn - cfg.meadowPerColumn))
    * treeDensityAt(cx * size + size / 2, cz * size + size / 2, seed, LAND_DRESS)
  const whole = Math.floor(expected)
  const n = whole + (g0() < expected - whole ? 1 : 0)

  // ★ Weights are modulated BY PLACE (character.ts speciesFactor) before the pick: starwillow
  // takes the dells and marshes, goldwood the highlands and high plains, dawnwood the deep forest
  // cores — so the same four ruled species make visibly different woods. Computed once per column —
  // every trunk this column rolls faces the same woods — and the multiplier keeps rarity a weight,
  // never a separate placement pass.
  const w = cfg.species.map(sp => sp.weight * speciesFactor(sp.id, seed, cx, cz, LAND_DRESS))
  const total = w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < n; i++) {
    const s = mixSeed(base, i)
    const g = rng(s)
    // Weighted pick. Our choice, documented: research could not establish Mojang's random_selector
    // algorithm, so this is a normalized weighted pick and nobody should "correct" it toward an
    // unverified one.
    let roll = g() * total
    let species = cfg.species[cfg.species.length - 1]
    for (let j = 0; j < cfg.species.length; j++) { roll -= w[j]; if (roll <= 0) { species = cfg.species[j]; break } }
    out.push({
      x: cx * size + Math.floor(g() * size),
      z: cz * size + Math.floor(g() * size),
      species,
      height: species.minHeight + Math.floor(g() * (species.maxHeight - species.minHeight + 1)),
      seed: s,
    })
  }
  return out
}

/** How many columns out to scan for canopies that reach into this one. */
export const treeScanRadius = (size: number, cfg: TreeConfig = DEFAULT_TREES): number =>
  Math.ceil(cfg.maxSpread / size)

/** Only these may host a trunk. Sand and stone stay bare, which is what makes woodland read as woodland. */
// ⚠ WAS `new Set([MAT.TOPSOIL])` UNTIL 2026-08-19. The character layer gave the world eight more
// grounds, and a planter that only knows topsoil would have quietly deforested every dell, wood
// core, high plain and highland the moment they stopped being green #1 — a bug with no error, no
// wrong pixel, just a world that grows fewer trees each time a ground is added. `TURF` is the one
// definition; marsh mud and crag scree are absent from it on purpose, which is what makes a marsh
// and a crag read as places where big trees do not grow.
const PLANTABLE = TURF

/** Leaves may overwrite air and other leaves, never a log and never terrain. */
const canLeaf = (m: number): boolean => m === AIR || (m >= WOOD.GOLDWOOD_LEAVES && m <= WOOD.DAWNWOOD_LEAVES && m % 2 === 1)

interface Ctx {
  sections: (Section | null)[]
  ox: number; oy0: number; oz: number
  size: number; yTop: number
}

function put(c: Ctx, wx: number, wy: number, wz: number, mat: number, leaf: boolean): void {
  if (wx < c.ox || wx >= c.ox + c.size || wz < c.oz || wz >= c.oz + c.size) return
  if (wy < c.oy0 || wy >= c.yTop) return
  const si = ((wy - c.oy0) / c.size) | 0
  const sec = c.sections[si]
  if (!sec) return
  const li = sec.idx(wx - c.ox, wy - c.oy0 - si * c.size, wz - c.oz)
  if (leaf && !canLeaf(sec.data[li])) return
  sec.data[li] = mat
}

/**
 * Low-frequency radius warp — the lump that stops a lobe reading as a sphere.
 *
 * ★ HASHED ON THE OFFSET FROM THE LOBE'S OWN CENTRE, never on world position, and that is what
 * keeps the seam test green: (dx,dy,dz) are relative to the tree, so both column alignments compute
 * an identical warp for an identical voxel. It also means a species looks like itself wherever it
 * is planted, which a world-space hash would not give.
 *
 * ⚠ CELLS ARE GROUPED IN 2x2x2 BLOCKS, and the grouping is the entire point. Per-cell noise frosts
 * the silhouette evenly, which reads as a FUZZY SPHERE — still a sphere. Lumps have to be bigger
 * than the thing they are deforming before the eye stops solving for the primitive underneath.
 */
function lump(dx: number, dy: number, dz: number, seed: number): number {
  const h = hash2((dx >> 1) * 131 + (dy >> 1), dz >> 1, seed)
  return 1 + (h - 0.5) * LUMP
}

/**
 * Blob canopy — a squashed sphere. The common silhouette, and 84% of the forest by weight, so this
 * function very nearly IS what the world's trees look like.
 *
 * ── ★ `squash` IS THE UMBRELLA DIAL (2026-08-12) ────────────────────────────────────────────────
 * It divides the crown's vertical semi-axis, and it was a hardcoded 2.1 shared silently by every
 * blob species. At 2.1 a radius-3 goldwood resolves to a crown 6-7 wide and *3 tall* — one third of
 * the tree's height, sitting on a bare pole. That is not a canopy, it is a parasol, and it is what
 * Alex saw. A broadleaf crown wants its height near its width, so this belongs to the species.
 */
function foliageBlob(
  c: Ctx, g: () => number, cx: number, cy: number, cz: number, r: number, leaves: number, squash: number,
  lobeSeed: number,
): void {
  const r2 = r * r
  // The warp can push a cell past `r`, so the scan box has to be wider than the nominal radius or
  // the lump is clipped flat against the loop bound and reads as a shaved side.
  const box = Math.ceil(r * Math.sqrt(1 + LUMP / 2))
  for (let dy = -box; dy <= box; dy++) {
    for (let dz = -box; dz <= box; dz++) {
      for (let dx = -box; dx <= box; dx++) {
        // Squashed vertically so a canopy reads as a canopy rather than a ball on a stick.
        const d = dx * dx + dy * dy * squash + dz * dz
        // ★ THE RADIUS IS NO LONGER CONSTANT AROUND THE LOBE (2026-08-13). Everything below still
        // measures against `lim` rather than `r2`, so the rim nibble and the strands follow the
        // lumpy surface instead of the sphere it used to be.
        const lim = r2 * lump(dx, dy, dz, lobeSeed)
        if (d > lim) continue
        // Nibble the outer shell so the silhouette is not a perfect solid — a clean sphere reads
        // as geometry, a ragged one reads as foliage.
        //
        // ⚠ THE SHELL WAS FAR TOO THICK AND THE RATE FAR TOO HIGH (0.55 / 0.4, fixed 2026-08-12).
        // "Past 55% of r-squared" is not a rim, it is most of the volume — at radius 3 it caught
        // every cell but the innermost handful, so a 40% drop rate hollowed the CROWN rather than
        // fraying its edge. A cross-section showed goldwood resolving to 77 sparse, visibly
        // LOPSIDED voxels: not ragged, moth-eaten. 0.72/0.3 confines it to the true rim.
        //
        // ★ AND THE MESHER NOW CARRIES THIS LOAD. Per-cell yaw/width/offset jitter (see the leaf
        // pass in `greedy.ts`) makes the canopy's surface irregular on its own, so the generator no
        // longer has to buy raggedness by deleting foliage. Two systems were paying for the same
        // effect and the geometry could least afford it.
        // ⚠ SOFTENED AGAIN 2026-08-13 (0.72/0.3 → 0.82/0.18) — Alex, after the mesher's cull came
        // out: *"the leaves are still too thin."* The rim band and the drop rate multiply, so 0.72
        // at 30% was still removing ~1 in 8 of the whole crown, on top of a shell that is most of
        // what you see. Confined to the true outer skin now, and thinned there.
        if (d > lim * 0.82 && g() < 0.18) continue
        put(c, cx + dx, cy + dy, cz + dz, leaves, true)
      }
    }
  }

  // ★ THE UNDERSIDE IS THE OTHER HALF OF IT, and `squash` alone does not fix it: an ellipsoid's
  // bottom is a clean horizontal disc however tall you make the crown above it, and a clean
  // horizontal disc seen from below at eye level is a parasol. Real foliage hangs unevenly. A
  // handful of short strands under the rim is the cheapest thing that breaks that line — a dozen
  // voxels against the crown's hundred, and it is the only part of the tree the player walks under.
  //
  // ⚠ The rolls happen in a fixed order whatever lands in this stack, which is what keeps the seam
  // test green: `put` discards out-of-bounds writes but never consumes the stream, so a tree grows
  // identically from either column alignment. Do not make a `g()` call conditional on position.
  const strands = Math.round(r * 3)
  // ⚠ MEASURED AGAINST THE LOBE'S SMALLEST POSSIBLE RADIUS, not its nominal one. The warp means the
  // real shell under (dx,dz) sits anywhere in a one-cell band, and a strand that starts BELOW it is
  // a leaf floating under the crown — the exact debris the k=0 fix removed. Starting inside the
  // canopy costs one re-written leaf and can never disconnect; `len` gains a block to compensate.
  const rMin2 = r2 * (1 - LUMP / 2)
  for (let i = 0; i < strands; i++) {
    const dx = Math.round((g() * 2 - 1) * r)
    const dz = Math.round((g() * 2 - 1) * r)
    const len = 2 + Math.floor(g() * 2)
    const rem = rMin2 - dx * dx - dz * dz
    if (rem <= 0) continue
    const bottom = -Math.floor(Math.sqrt(rem / squash))
    // ⚠ START AT THE SHELL CELL ITSELF (k=0), NOT BELOW IT. Hanging from `bottom - 1` leaves a gap
    // wherever the nibble happened to remove the cell above, and a one-voxel leaf floating two
    // blocks under a crown reads as debris, not as foliage — a cross-section caught exactly that.
    // Re-writing a cell that is already a leaf costs nothing and guarantees the strand connects.
    //
    // Leaves-only, so a strand over the trunk column is refused by `canLeaf` rather than boring a
    // hole through the bark.
    for (let k = 0; k <= len; k++) put(c, cx + dx, cy + bottom - k, cz + dz, leaves, true)
  }
}

/**
 * ── ★ THE CROWN IS A CLUSTER OF LOBES, NOT ONE BLOB (2026-08-13) ────────────────────────────────
 * The second half of Alex's "these read as primitives". One ellipsoid centred over the trunk is a
 * ball on a stick however lumpy you make its skin, because its MASS is still a single centred
 * volume — and worse, it leaves the lower half of every trunk bare, which is the pole the eye sees.
 *
 * So a crown is now a main lobe plus two or three satellites hung BELOW and to the side of it. The
 * satellites are what fills the bare pole: they drape the canopy down around the upper trunk
 * instead of perching it on top, and because each carries its own lump seed no two crowns in the
 * forest share a silhouette.
 *
 * ★ THIS IS THE COMPOSITION RULE AGAIN, one level down. Four species already share two foliage
 * implementations; now the blob implementation is itself built out of a smaller primitive rather
 * than being one. A fifth species buys a different crown by changing counts, not by getting code.
 *
 * ⚠ REACH IS A CONTRACT. A satellite's centre offset plus its own warped radius must stay inside
 * `maxSpread`, because that number is what `treeScanRadius` hands the planter — a lobe that reaches
 * past it is a canopy sliced flat at a column boundary. The offset and radius fractions below are
 * chosen against it (worst case ~1.3 x radius, so radius 4 reaches ~5.9 against a spread of 7), and
 * the oracle measures the real thing rather than trusting this comment.
 */
/**
 * One lobe of a crown, as an offset from the crown's origin.
 *
 * `squash` is the lobe's own vertical flattening, in `foliageBlob`'s sense — the vertical semi-axis
 * is `r / sqrt(squash)`. It lives on the LOBE and not on the crown because a layered tier is a lobe
 * squashed to a single cell tall, so one shape covers both placers and no caller needs a sentinel
 * to ask "is this a disc or a ball".
 */
export interface Lobe { dx: number; dy: number; dz: number; r: number; squash: number; seed: number }

/**
 * ── ★ THE CROWN'S LAYOUT IS A VALUE, NOT A SIDE EFFECT (2026-08-13) ────────────────────────────
 * Where the lobes sit is now a pure function of the tree's seed, computed from `hash2` rather than
 * drawn off the `g()` stream that `foliageBlob` is simultaneously consuming for its rim nibble.
 *
 * ★ THE REASON IS THAT SOMETHING OTHER THAN THE GENERATOR NEEDS TO KNOW THE ANSWER. Alex asked
 * whether the voxel world can hold 3D models. The cheapest honest experiment is a canopy drawn as
 * smooth geometry at exactly the places the voxel canopy occupies — same shape, different medium,
 * so what he judges is "smooth vs blocky" and not "cone vs blob". A renderer cannot replay an
 * interleaved rng stream to find that out; it can call a pure function.
 *
 * ⚠ SO DO NOT "TIDY" THESE BACK ONTO `g()`. Lobe placement drawn off the shared stream is placement
 * only the generator can ever know, and the renderer silently loses the ability to agree with it.
 * The stream stays for the things that are genuinely per-voxel (the nibble, the strands).
 */
export function crownLayout(r: number, squash: number, seed: number): Lobe[] {
  const out: Lobe[] = [{ dx: 0, dy: 0, dz: 0, r, squash, seed }]
  const roll = (k: number) => hash2(k, 0x51, seed)
  const n = 2 + Math.floor(roll(0) * 2)
  for (let i = 0; i < n; i++) {
    const ang = roll(i * 4 + 1) * Math.PI * 2
    const off = r * (0.4 + roll(i * 4 + 2) * 0.25)
    // Below the main lobe, never above it: a satellite on top would grow the tree's height and put
    // the mass back where it already was. Down is where the bare trunk is.
    //
    // ⚠ THE FIRST CUT DROPPED THEM 0.3-0.8r AND IT WAS NOT ENOUGH — measured, not eyeballed: the
    // canopy's mass-below-centre went 42% → 51% where the shape called for a clear break from a
    // centred ellipsoid. At radius 3 that range rounds to one or two blocks, which is a nudge, not
    // a second lobe. Dropping them 0.45-1.0r puts a satellite's own bulk beside the trunk rather
    // than just under the main crown's shoulder.
    out.push({
      dx: Math.round(Math.cos(ang) * off),
      dy: -Math.round(r * (0.45 + roll(i * 4 + 3) * 0.55)),
      dz: Math.round(Math.sin(ang) * off),
      r: Math.max(1, Math.round(r * (0.45 + roll(i * 4 + 4) * 0.2))),
      squash,
      seed: mixSeed(seed, i + 1),
    })
  }
  return out
}

// ★ THERE IS NO `crownLobes` ANY MORE, DELIBERATELY. It existed for about an hour and it was a
// second place that knew where a crown sits. `growTree` now draws straight off `crownAt` (below),
// so the generator and the renderer read the SAME function rather than two functions that agree.
//
// ⚠ The oracle is why. An assert was written to catch `crownAt` drifting from the generator, and it
// caught a wrong SEED — but a one-block vertical shift sailed straight through it, because a crown
// is several blocks tall and a lobe moved up one still lands in foliage. That is a weak proxy, and
// the fix for a weak proxy is not a cleverer assert: it is having nothing to disagree with.

/**
 * Layered canopy — stacked discs. Reads taller and more deliberate than the blob. Starwillow's two
 * limbs and dawnwood's spire.
 *
 * ── ★ THIS WAS A PAGODA ROOF, WHICH IS AN UMBRELLA WITH EXTRA STEPS (2026-08-12) ────────────────
 * The cross-section that caught the blob species caught these too, and I nearly shipped without
 * looking because they are only 16% of the forest by weight. Two faults, and they compounded:
 *
 *   1. `tiers = max(2, round(r))` with each tier ONE block tall gave dawnwood a **4-block crown on
 *      a 10-15 block trunk** — 27% of the tree's height. The blob species were fixed to ~50%.
 *   2. the radius shrank MONOTONICALLY from the bottom tier, so the widest disc was the LOWEST one.
 *      A stack that is widest at its base and tapers upward is precisely a parasol; making it taller
 *      without fixing the profile would have produced a taller parasol.
 *
 * So the profile now peaks about a third of the way up and tapers to a point above — a spire with a
 * narrowed base, which is a silhouette the blob cannot make and is the reason two placers exist.
 */
function foliageLayered(
  c: Ctx, g: () => number, cx: number, cy: number, cz: number, r: number, leaves: number, lobeSeed: number,
): void {
  const tiers = Math.max(3, Math.round(r * 1.6))
  // Sink the stack so its base overlaps the trunk instead of perching on the tip. Without this the
  // extra tiers all grow UPWARD and buy height by lengthening the bare pole underneath.
  const base = cy - Math.floor(tiers * 0.35)
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1)                       // 0 at the base, 1 at the tip
    const rr = r * (f < 0.3 ? 0.62 + (f / 0.3) * 0.38 : 1 - ((f - 0.3) / 0.7) ** 1.5)
    const rr2 = rr * rr
    const y = base + t
    // A disc warps too, and it needs it more than a blob does: a stack of clean circles is the most
    // machined shape in the forest. `t` rides the hash so consecutive tiers deform differently and
    // the stack cannot read as one extruded profile.
    const box = Math.ceil(rr * Math.sqrt(1 + LUMP / 2))
    for (let dz = -box; dz <= box; dz++) {
      for (let dx = -box; dx <= box; dx++) {
        const d = dx * dx + dz * dz
        const lim = rr2 * lump(dx, t, dz, lobeSeed)
        if (d > lim) continue
        // Rim only, same correction as the blob's nibble — and for the same reason: the mesher's
        // per-cell jitter now supplies the raggedness this used to buy by deleting foliage.
        if (d > lim * 0.82 && g() < 0.18) continue     // see foliageBlob's note (2026-08-13)
        put(c, cx + dx, y, cz + dz, leaves, true)
      }
    }
  }

  // The base tier is a flat disc and the player walks under it — same underside problem, same fix.
  // ⚠ Fixed roll order, for the seam test. See the note in `foliageBlob`.
  const strands = Math.round(r * 2)
  const rBase = r * 0.62
  for (let i = 0; i < strands; i++) {
    const dx = Math.round((g() * 2 - 1) * rBase)
    const dz = Math.round((g() * 2 - 1) * rBase)
    const len = 1 + Math.floor(g() * 2)
    if (dx * dx + dz * dz > rBase * rBase) continue
    for (let k = 0; k <= len; k++) put(c, cx + dx, base - k, cz + dz, leaves, true)
  }
}

/** Where a forking trunk splits, as a fraction of its height. One definition, three readers. */
const FORK_AT = (height: number) => Math.floor(height * 0.55)

/**
 * The two limbs of a forking trunk: their lean direction and where the walk ends up.
 *
 * ★ HASH-DERIVED, NOT ROLLED OFF `g()`, for the same reason `crownLayout` is — a limb's crown has
 * to be describable to something that is not the generator. This was the last piece of a tree's
 * STRUCTURE hiding inside the per-voxel rng stream.
 */
export function forkLimbs(start: TreeStart): { x: number; z: number; dx: number; dz: number }[] {
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const ai = Math.floor(hash2(1, 0x9c, start.seed) * 4) % 4
  const bi = (ai + 1 + Math.floor(hash2(2, 0x9c, start.seed) * 2)) % 4
  const forkAt = FORK_AT(start.height)
  const limb = start.height - forkAt
  // Steps happen on even `i`, so the walk moves ceil(limb / 2) times. Derived, never counted twice.
  const steps = Math.ceil(limb / 2)
  return [ai, bi].map(i => {
    const [dx, dz] = dirs[i]
    return { x: start.x + dx * steps, z: start.z + dz * steps, dx, dz }
  })
}

/**
 * How many LOG voxels this tree is made of.
 *
 * ★ THIS IS THE WOOD ECONOMY'S CONTINUITY GUARANTEE, and it exists because of a way the node model
 * could have broken the game silently. Today a tree is felled voxel by voxel and every log voxel
 * drops one log — so a goldwood pays 6-9 logs and a dawnwood pays 10-15. A node that drops "a log"
 * would cut the wood supply by an order of magnitude, and nothing would look broken: recipes would
 * still work, planking would still craft, the building grammar Alex shipped would just quietly
 * become unaffordable. Deriving the count from the trunk the tree ACTUALLY has keeps the payout
 * identical to the day before the change.
 *
 * ⚠ DERIVED FROM THE SAME WALK `growTree` PERFORMS, never counted by hand. The forking trunk is the
 * reason: starwillow is a stem plus TWO limbs, so it carries meaningfully more wood than its height
 * suggests, and a hand-written `height` would underpay the species that is hardest to cut.
 */
export function trunkVoxels(start: TreeStart): number {
  return trunkCells(start, 0).length
}

/**
 * Every log cell this tree occupies, in world coordinates.
 *
 * ★ THIS IS THE FELL VERB'S WHOLE FOUNDATION. Making a tree one object means one act has to know
 * which cells the tree IS — both to ask "does the cell the player just hit belong to a tree" and to
 * take the whole trunk down in one go.
 *
 * ⚠ IT REPRODUCES `growTree`'S WALK RATHER THAN DESCRIBING IT, and the forking branch is why: the
 * limb steps sideways on even `i` only, so its cells are not a formula anyone would write down
 * correctly from the shape. `trunkVoxels` is now literally this list's LENGTH, so the payout and
 * the removal cannot disagree about how big a tree is — which is the bug that would have paid a
 * player for wood the world never took away.
 */
export function trunkCells(start: TreeStart, groundY: number): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = []
  const baseY = groundY + 1
  if (start.species.trunk === 'straight') {
    for (let i = 0; i < start.height; i++) out.push({ x: start.x, y: baseY + i, z: start.z })
    return out
  }
  const forkAt = FORK_AT(start.height)
  for (let i = 0; i < forkAt; i++) out.push({ x: start.x, y: baseY + i, z: start.z })
  const limb = start.height - forkAt
  for (const { dx, dz } of forkLimbs(start)) {
    let x = start.x, z = start.z
    for (let i = 0; i < limb; i++) {
      if (i % 2 === 0) { x += dx; z += dz }
      out.push({ x, y: baseY + forkAt + i, z })
    }
  }
  return out
}

/**
 * Grow one tree into whatever part of this stack it touches.
 *
 * The whole tree is generated every time regardless of how much lands here — it is a few hundred
 * writes of pure arithmetic, and recomputing keeps the function pure, which is worth far more than
 * caching: any column, any order, any thread, same tree.
 */
export function growTree(
  c: Ctx, start: TreeStart, groundY: number,
): void {
  const sp = start.species
  const g = rng(start.seed ^ 0x5bf0)
  const baseY = groundY + 1

  if (sp.trunk === 'straight') {
    for (let i = 0; i < start.height; i++) put(c, start.x, baseY + i, start.z, sp.log, false)
    // ★ THE GENERATOR READS THE SAME `crownAt` THE RENDERER DOES — see the note above. A blob crown
    // has exactly one description of where it is, and this is the code that consumes it.
    const crown = crownAt(start, groundY)
    if (crown) {
      for (const lo of crown.lobes)
        foliageBlob(c, g, crown.x + lo.dx, crown.y + lo.dy, crown.z + lo.dz, lo.r, sp.leaves, lo.squash, lo.seed)
    } else {
      foliageLayered(c, g, start.x, baseY + start.height - 2, start.z, sp.radius, sp.leaves, start.seed)
    }
    return
  }

  // ── forking ──────────────────────────────────────────────────────────────────────────────
  // A single stem, then two limbs that lean apart. Each limb gets its own canopy, which is what
  // makes the silhouette read as a different SPECIES rather than a taller version of the same one.
  const forkAt = FORK_AT(start.height)
  for (let i = 0; i < forkAt; i++) put(c, start.x, baseY + i, start.z, sp.log, false)

  let limbNo = 0
  for (const { x: tipX, z: tipZ, dx, dz } of forkLimbs(start)) {
    let x = start.x, z = start.z
    const limb = start.height - forkAt
    for (let i = 0; i < limb; i++) {
      // Lean every other block so the limb is a diagonal rather than a staircase of single steps.
      if (i % 2 === 0) { x += dx; z += dz }
      put(c, x, baseY + forkAt + i, z, sp.log, false)
    }
    // The walk above must land exactly where `forkLimbs` says it will, or the crown and the limb
    // that holds it part company. Same single-source rule as the blob crown — this is the walk,
    // that is the description of the walk, and the oracle pins them together.
    x = tipX; z = tipZ
    // ⚠ Each limb gets its OWN lump seed. Sharing one would deform both crowns identically, and a
    // forking tree whose two halves are mirror images is more obviously generated than a plain
    // sphere was — the fork is the silhouette people look at.
    foliageLayered(c, g, x, baseY + forkAt + limb - 2, z, sp.radius * 0.75, sp.leaves, mixSeed(start.seed, 0x1b + limbNo++))
  }
}

/**
 * Where a tree's crown actually sits in the world, for anything that has to agree with the canopy
 * without generating it — currently the smooth-canopy renderer (`voxel3d/canopy-mesh.ts`).
 *
 * ⚠ BLOB SPECIES ONLY, and it returns null rather than guessing for the others. The layered placer
 * builds a tiered profile that is not a set of lobes, and handing back a lobe list for it would be
 * a renderer quietly drawing a shape the world does not contain. `foliage === 'blob'` is 84% of the
 * forest by weight, which is enough to answer the question the renderer exists to ask.
 *
 * The centre matches `growTree`'s call exactly (`top - 1`, where top = groundY + 1 + height). If one
 * of those two ever moves, the smooth canopy floats off its own tree — so they are asserted together.
 */
export function crownAt(start: TreeStart, groundY: number): {
  x: number; y: number; z: number; lobes: Lobe[]
} | null {
  const sp = start.species
  const baseY = groundY + 1

  if (sp.trunk === 'straight' && sp.foliage === 'blob') {
    return {
      x: start.x,
      y: baseY + start.height - 1,
      z: start.z,
      // ⚠ `start.seed`, NOT the `^ 0x5bf0` the per-voxel rng is seeded with — `growTree` derives
      // the stream separately. Getting this wrong produces a perfectly plausible crown in the wrong
      // place, which is the failure that looks like a bug in the ground height rather than a seed.
      lobes: crownLayout(sp.radius, sp.squash ?? 1.2, start.seed),
    }
  }

  // ── layered crowns ──────────────────────────────────────────────────────────────────────────
  // ★ A TIER IS A LOBE THAT HAS BEEN SAT ON. `foliageLayered`'s radius profile is a pure function
  // of the tier index — no rng touches it — so the whole stack is describable, and describing it as
  // squashed lobes means one renderer covers every species instead of growing a second code path.
  // The `squash` here is per-lobe rather than per-crown, which is what makes a disc a disc.
  const tierLobes = (r: number, seed: number, originDx: number, originDz: number, dyBase: number): Lobe[] => {
    const tiers = Math.max(3, Math.round(r * 1.6))
    const base = dyBase - Math.floor(tiers * 0.35)
    const out: Lobe[] = []
    for (let t = 0; t < tiers; t++) {
      const f = t / (tiers - 1)
      const rr = r * (f < 0.3 ? 0.62 + (f / 0.3) * 0.38 : 1 - ((f - 0.3) / 0.7) ** 1.5)
      if (rr < 0.5) continue                      // a tier under half a cell writes nothing
      // One cell tall against a radius of `rr`: vertical semi-axis 0.5 means squash = (rr/0.5)^2.
      out.push({ dx: originDx, dy: base + t, dz: originDz, r: rr, squash: 4 * rr * rr, seed: mixSeed(seed, t + 1) })
    }
    return out
  }

  if (sp.trunk === 'straight') {
    return {
      x: start.x, y: baseY + start.height - 2, z: start.z,
      lobes: tierLobes(sp.radius, start.seed, 0, 0, 0),
    }
  }

  // ── forking (starwillow) ────────────────────────────────────────────────────────────────────
  // Two limbs, each with its own tier stack at its own tip, each with its own lump seed — mirrored
  // crowns read as generated harder than a plain sphere ever did.
  const forkAt = FORK_AT(start.height)
  const limb = start.height - forkAt
  const lobes: Lobe[] = []
  forkLimbs(start).forEach((lm, i) => {
    lobes.push(...tierLobes(
      sp.radius * 0.75, mixSeed(start.seed, 0x1b + i),
      lm.x - start.x, lm.z - start.z, forkAt + limb - 2,
    ))
  })
  return { x: start.x, y: baseY, z: start.z, lobes }
}

/**
 * Every voxel a tree would occupy, as absolute cells — trunk and canopy together.
 *
 * ★★ THIS CALLS `growTree` RATHER THAN DESCRIBING IT, and that is the entire point. A sapling has
 * to become a tree at RUNTIME, and the obvious way to do that is a second tree-drawing routine in
 * the host. That routine would then drift from the generator, and a planted goldwood would slowly
 * stop looking like a wild one — the exact class of bug this file spent the day deleting (there
 * were three descriptions of a crown this morning; there is one now).
 *
 * So: a scratch stack, the real generator, and a diff. A planted tree is byte-identical to a wild
 * tree of the same seed because it IS one.
 *
 * ⚠ The scratch has to be wider than the tree in every direction or the canopy is clipped by the
 * scratch itself and a planted tree comes out shaved — `maxSpread` on each side, plus the height.
 */
export function growTreeCells(
  start: TreeStart, groundY: number, cfg: TreeConfig = DEFAULT_TREES,
): { x: number; y: number; z: number; mat: number }[] {
  const S = 32
  const pad = cfg.maxSpread + 1
  if (pad > S / 2) throw new Error('scratch too small for maxSpread')
  // Origin placed so the trunk sits at the scratch's centre column, with the ground low enough that
  // the whole canopy fits above it.
  const ox = start.x - S / 2, oz = start.z - S / 2
  const oy0 = groundY - 4
  const sections = [new Section(S), new Section(S), new Section(S)]
  const c: Ctx = { sections, ox, oy0, oz, size: S, yTop: oy0 + sections.length * S }
  growTree(c, start, groundY)

  const out: { x: number; y: number; z: number; mat: number }[] = []
  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si]
    for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const m = sec.get(x, y, z)
      if (m === AIR) continue
      out.push({ x: ox + x, y: oy0 + si * S + y, z: oz + z, mat: m })
    }
  }
  return out
}

/**
 * Plant every tree that can reach this stack.
 *
 * `surfaceAt` and `materialAt` are the pure generator functions — a trunk needs to know the ground
 * height and what the ground is MADE of at its own coordinate, which may lie in a neighbouring
 * column. Calling a pure O(1) function at any coordinate is free and order-independent; reading a
 * neighbouring column's stored state would be the synchronous dependency the pipeline refuses.
 */
export function plantTrees(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, size: number, seed: number,
  surfaceAt: (x: number, z: number) => number,
  groundMaterialAt: (x: number, z: number, h: number) => number,
  cfg: TreeConfig = DEFAULT_TREES,
): number {
  const first = sections.find(Boolean)
  if (!first) return 0
  const c: Ctx = { sections, ox, oy0, oz, size, yTop: oy0 + sections.length * size }
  const rad = treeScanRadius(size, cfg)
  const c0x = Math.floor(ox / size), c0z = Math.floor(oz / size)
  let planted = 0

  for (let cz = c0z - rad; cz <= c0z + rad; cz++) {
    for (let cx = c0x - rad; cx <= c0x + rad; cx++) {
      for (const st of treeStartsAt(seed, cx, cz, size, cfg)) {
        const h = surfaceAt(st.x, st.z)
        if (h >= cfg.maxAltitude) continue                        // above the treeline
        if (!PLANTABLE.has(groundMaterialAt(st.x, st.z, h))) continue   // sand, stone and water stay bare
        growTree(c, st, h)
        planted++
      }
    }
  }
  return planted
}
