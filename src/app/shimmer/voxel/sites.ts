// Structure SITES — where built things stand, as pure math over (seed, cell).
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ★ THE PLACEMENT IS MINECRAFT'S OWN, STOLEN DELIBERATELY (WORLDGEN-RESEARCH › structure
// placement): the world is tiled into cells of `spacing` columns; each cell rolls ONE jittered
// candidate, seeded by (world seed, cell coords, salt); a candidate that fails its checks KILLS
// the cell rather than retrying elsewhere. That makes placement O(1) pure math — any column can
// ask "does a site touch me?" with no cross-chunk state, the same property that keeps trees safe.
//
// ★ SITES STAND ON PADS. A candidate becomes a site only if its footprint sits on ground the
// plains pass can actually offer: a span check over pure `columnHeight` reads. This is the whole
// reason the flatness field exists — structures on lumpy ground generate sloppy and fragmented
// (Alex, 2026-08-07), so the filter refuses what the terrain refuses.
//
// ⚠ THE FIRST SITE TYPE IS A BLOCKOUT, NOT LORE. It spawns on GREYFIELD pads (drained ground,
// biome.ts) because that is where Alex wants built remains to appear — but WHAT stands in drained
// garden-country is a canon question (Moglin strongholds are ruled WILDS features, layer 3 of
// shimmer-geography.md). Filed in CANON_GAPS; until the ruling lands this places a neutral
// broken-stone ruin footprint that claims nothing about who built it. Swap the dressing when
// Magii rules; the plumbing here does not change.

import { hash2, mixSeed } from './noise'
import { columnHeight, type HeightConfig, DEFAULT_HEIGHT } from './height'
import { greyness, type BiomeConfig, DEFAULT_BIOME } from './biome'
import { DEFAULT_DEPTH, type DepthConfig } from './depth'
import { Section } from './section'
import { buildRuin, RUIN_REACH } from './ruins'
import { buildWarren, WARREN_REACH } from './warren'

/**
 * ★★ THE REACH A COLUMN MUST CLIP AGAINST IS THE LARGEST OF THEM, NOT THE RUIN'S ─────────────
 * A site now builds two things: a ruin on the surface, and — for the share of them that have a way
 * down (`warren.ts` › `hasDescent`) — a warren under it, which reaches FURTHER than the ruin does.
 * Clipping on `RUIN_REACH` alone would skip every column between the two reaches, so a warren would
 * lose its outer rooms at exactly the columns furthest from the shaft: silently, identically on
 * every load, and invisible from the surface. That is the same bug this file's own clip comment
 * records the assembler causing once already, and it is worse underground because nothing about the
 * ruin overhead would look wrong.
 */
export const SITE_REACH = Math.max(RUIN_REACH, WARREN_REACH)

export interface SiteConfig {
  /** Cell size in COLUMNS (16-block units). One candidate per cell. */
  spacing: number
  /** Jitter keeps a candidate at least this many columns off the cell edge, bounding reach. */
  separation: number
  /** Distinguishes this site type's stream from any future type with the same spacing. */
  salt: number
  /** Footprint edge in blocks. Also the pad the site demands. */
  footprint: number
  /** Max height span across the footprint — the pad test. Matches the plains pass's pad metric. */
  padSpan: number
  /** Minimum greyness at the centre: the first site type is a drained-ground thing. */
  greyMin: number
}

export const DEFAULT_SITES: SiteConfig = {
  // Tuned on the rendered map + a density sweep, and RE-tuned after the un-slice warp fix made
  // pads ~4× more common (the pad filter passes more cells, so the same spacing means more
  // ruins): spacing 14 ≈ 1.1 sites per 1000² of country. Walking a greyfield should risk a ruin,
  // not tour a suburb. ⚠ Any retune that moves pad share re-tunes THIS by side effect — re-sweep.
  spacing: 14,
  separation: 3,
  salt: 0x51735,
  footprint: 11,
  padSpan: 2,
  greyMin: 0.6,
}

export interface Site {
  /** Footprint centre, world blocks. */
  x: number
  z: number
  /** The pad's LOWEST surface — the build sits down onto the ground, never floats on the high side. */
  floor: number
  seed: number
}

/**
 * The one candidate cell (cx, cz) rolls, or null if the cell is dead. Pure and O(1)-ish: the
 * greyness gate is one field read and kills ~90% of cells before the footprint scan spends its
 * `footprint²` height reads.
 */
export function siteAt(
  seed: number, cellX: number, cellZ: number,
  cfg: SiteConfig = DEFAULT_SITES,
  hcfg: HeightConfig = DEFAULT_HEIGHT,
  dcfg: DepthConfig = DEFAULT_DEPTH,
  bcfg: BiomeConfig = DEFAULT_BIOME,
): Site | null {
  const s = mixSeed((hash2(cellX, cellZ, seed ^ cfg.salt) * 4294967296) | 0, cfg.salt)
  const span = cfg.spacing - cfg.separation * 2
  const jx = cfg.separation + Math.floor(hash2(cellX, cellZ, s ^ 0xa11ce) * span)
  const jz = cfg.separation + Math.floor(hash2(cellZ, cellX, s ^ 0xb0b) * span)
  const x = (cellX * cfg.spacing + jx) * 16 + 8
  const z = (cellZ * cfg.spacing + jz) * 16 + 8

  if (greyness(x, z, seed, bcfg) < cfg.greyMin) return null

  const r = cfg.footprint >> 1
  let mn = Infinity, mx = -Infinity
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const h = columnHeight(x + dx, z + dz, seed, hcfg)
      if (h < mn) mn = h
      if (h > mx) mx = h
      if (mx - mn > cfg.padSpan) return null    // not a pad — the cell dies, no retry
    }
  }
  if (mn <= dcfg.seaLevel + dcfg.beachHeight) return null   // never in the water or on the beach

  return { x, z, floor: mn, seed: s }
}

/**
 * How many cells out a column must scan so no site can cross in unseen. `separation` keeps every
 * candidate ≥ separation columns (48 blocks at default) off its cell edge, and a ruin reaches at
 * most `RUIN_REACH` (22) blocks — so a site can never leave its own cell, and one ring of
 * neighbours covers a column that sits against a cell boundary. Both oracles assert the
 * separation-vs-reach inequality so a retune that breaks it fails loudly instead of dropping half
 * a ruin at cell seams. ⚠ THE TERM THAT MOVES IS NOW THE ENVELOPE, NOT THE FOOTPRINT: growing the
 * piece pool grows the reach, and at 48 vs 23 there is room — but it is a budget, not a licence.
 */
export const siteScanCells = (_cfg: SiteConfig = DEFAULT_SITES): number => 1

/**
 * ── The ruin itself lives in `ruins.ts` ──────────────────────────────────────────────────────
 * ★ THIS FILE IS PLACEMENT, THAT ONE IS BUILDING, and keeping the seam sharp is the point. Until
 * 2026-08-24 the building half was eleven lines here — one 11×11 rectangle crumbled by a hash, so
 * every ruin in the world was the same ruin. It is now a jigsaw assembler (Minecraft's own: a
 * start piece, breadth-first connectors, AABB-reject, a terminator pool at max depth). Nothing
 * about placement changed, which is exactly why the split is worth having: the density sweep, the
 * pad filter and the greyfield gate above are untouched and still tuned.
 *
 * ⚠ `footprint` NO LONGER BOUNDS WHAT STANDS HERE. It is still the PAD the site demands — the
 * flat ground a candidate has to find before it can exist — but the assembly reaches out to
 * `RUIN_REACH` blocks, so anything asking "how far can this ruin reach" must ask ruins.ts.
 */
export { buildRuin } from './ruins'

/**
 * Place every site whose footprint reaches this column. The tree-planting shape exactly: scan the
 * cells around this column's cell, ask each for its candidate, write the intersecting slice.
 */
export function placeSites(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, size: number, seed: number,
  cfg: SiteConfig = DEFAULT_SITES,
): number {
  const first = sections.find(Boolean)
  if (!first) return 0
  const c0x = Math.floor(Math.floor(ox / size) / cfg.spacing)
  const c0z = Math.floor(Math.floor(oz / size) / cfg.spacing)
  const rad = siteScanCells(cfg)
  let placed = 0
  for (let cz = c0z - rad; cz <= c0z + rad; cz++) {
    for (let cx = c0x - rad; cx <= c0x + rad; cx++) {
      const site = siteAt(seed, cx, cz, cfg)
      if (!site) continue
      // Cheap clip: skip sites whose RUIN cannot touch this column at all.
      // ⚠ THE PAD IS NOT THE REACH. This read `(footprint >> 1) + 1` while the ruin was one
      // 11×11 rectangle, and the day the assembler landed that clip would have thrown away every
      // slice more than 6 blocks from the centre — a ruin cut down to its middle room, on the
      // columns furthest from it, identically on every load. It is the assembler's envelope.
      const r = SITE_REACH + 1
      if (site.x + r < ox || site.x - r >= ox + size || site.z + r < oz || site.z - r >= oz + size) continue
      buildRuin(sections, ox, oy0, oz, size, site, seed)
      // ★ AFTER the ruin, and it has to be: the shaft comes up through the start piece's own
      // footprint, and `buildRuin` writes a rubble scatter across that floor. Cut first, the ruin
      // would sprinkle stone back into the top of the stairwell.
      buildWarren(sections, ox, oy0, oz, size, site, seed)
      placed++
    }
  }
  return placed
}
