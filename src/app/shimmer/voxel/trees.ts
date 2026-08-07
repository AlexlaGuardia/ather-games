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
import { MAT } from './depth'
import { hash2, mixSeed } from './noise'
import { forestness, speciesFactor } from './biome'

/** Wood materials. Continue past ORE (which ends at 22) with room to spare. */
export const WOOD = {
  GOLDWOOD_LOG: 32, GOLDWOOD_LEAVES: 33,
  SHIMMEROAK_LOG: 34, SHIMMEROAK_LEAVES: 35,
  STARWILLOW_LOG: 36, STARWILLOW_LEAVES: 37,
  DAWNWOOD_LOG: 38, DAWNWOOD_LEAVES: 39,
} as const

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
  { id: 'goldwood', log: WOOD.GOLDWOOD_LOG, leaves: WOOD.GOLDWOOD_LEAVES,
    trunk: 'straight', foliage: 'blob', minHeight: 5, maxHeight: 8, radius: 3, weight: 58 },
  { id: 'shimmeroak', log: WOOD.SHIMMEROAK_LOG, leaves: WOOD.SHIMMEROAK_LEAVES,
    trunk: 'straight', foliage: 'blob', minHeight: 7, maxHeight: 11, radius: 4, weight: 26 },
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
  maxSpread: 6,
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
  const expected = cfg.meadowPerColumn + forestness(seed, cx, cz) * (cfg.perColumn - cfg.meadowPerColumn)
  const whole = Math.floor(expected)
  const n = whole + (g0() < expected - whole ? 1 : 0)

  // ★ Weights are modulated BY PLACE (biome.ts speciesFactor) before the pick: starwillow crowds
  // the low ground, goldwood the hills, dawnwood the deep forest cores. Computed once per column —
  // every trunk this column rolls faces the same woods — and the multiplier keeps rarity a weight,
  // never a separate placement pass.
  const w = cfg.species.map(sp => sp.weight * speciesFactor(sp.id, seed, cx, cz))
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
const PLANTABLE = new Set<number>([MAT.TOPSOIL])

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

/** Blob canopy — a squashed sphere. The common silhouette. */
function foliageBlob(c: Ctx, g: () => number, cx: number, cy: number, cz: number, r: number, leaves: number): void {
  const r2 = r * r
  for (let dy = -r; dy <= r; dy++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        // Squashed vertically so a canopy reads as a canopy rather than a ball on a stick.
        const d = dx * dx + dy * dy * 2.1 + dz * dz
        if (d > r2) continue
        // Nibble the outer shell so the silhouette is not a perfect solid — a clean sphere reads
        // as geometry, a ragged one reads as foliage.
        if (d > r2 * 0.55 && g() < 0.4) continue
        put(c, cx + dx, cy + dy, cz + dz, leaves, true)
      }
    }
  }
}

/** Layered canopy — stacked discs of shrinking radius. Reads taller and more deliberate. */
function foliageLayered(c: Ctx, g: () => number, cx: number, cy: number, cz: number, r: number, leaves: number): void {
  const tiers = Math.max(2, Math.round(r))
  for (let t = 0; t < tiers; t++) {
    const rr = r * (1 - t / (tiers + 0.6))
    const rr2 = rr * rr
    const y = cy + t
    for (let dz = -Math.ceil(rr); dz <= Math.ceil(rr); dz++) {
      for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx++) {
        const d = dx * dx + dz * dz
        if (d > rr2) continue
        if (d > rr2 * 0.6 && g() < 0.35) continue
        put(c, cx + dx, y, cz + dz, leaves, true)
      }
    }
  }
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
    const top = baseY + start.height
    if (sp.foliage === 'blob') foliageBlob(c, g, start.x, top - 1, start.z, sp.radius, sp.leaves)
    else foliageLayered(c, g, start.x, top - 2, start.z, sp.radius, sp.leaves)
    return
  }

  // ── forking ──────────────────────────────────────────────────────────────────────────────
  // A single stem, then two limbs that lean apart. Each limb gets its own canopy, which is what
  // makes the silhouette read as a different SPECIES rather than a taller version of the same one.
  const forkAt = Math.floor(start.height * 0.55)
  for (let i = 0; i < forkAt; i++) put(c, start.x, baseY + i, start.z, sp.log, false)

  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const a = dirs[Math.floor(g() * 4) % 4]
  const b = dirs[(dirs.indexOf(a) + 1 + Math.floor(g() * 2)) % 4]
  for (const [dx, dz] of [a, b]) {
    let x = start.x, z = start.z
    const limb = start.height - forkAt
    for (let i = 0; i < limb; i++) {
      // Lean every other block so the limb is a diagonal rather than a staircase of single steps.
      if (i % 2 === 0) { x += dx; z += dz }
      put(c, x, baseY + forkAt + i, z, sp.log, false)
    }
    foliageLayered(c, g, x, baseY + forkAt + limb - 2, z, sp.radius * 0.75, sp.leaves)
  }
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
