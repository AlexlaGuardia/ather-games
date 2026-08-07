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
import { MAT, DEFAULT_DEPTH, type DepthConfig } from './depth'
import { Section } from './section'

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
  // Tuned on the rendered map + a density sweep: ~0.9 sites per 1000² of country (spacing 12
  // measured 0.56 — too rare to FIND on a playtest walk; 7 measured 1.44 — a subdivision).
  // Walking a greyfield should risk a ruin, not tour a suburb.
  spacing: 9,
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
 * How many cells out a column must scan so no site's footprint can cross in unseen. `separation`
 * keeps every candidate ≥ separation columns (48 blocks at default) off its cell edge, and a
 * footprint reaches footprint/2+1 ≈ 7 blocks — so a site can never leave its own cell, and one
 * ring of neighbours covers a column that sits against a cell boundary. The oracle asserts the
 * separation-vs-reach inequality so a retune that breaks it fails loudly instead of dropping
 * half a ruin at cell seams.
 */
export const siteScanCells = (_cfg: SiteConfig = DEFAULT_SITES): number => 1

/**
 * ── The ruin blockout ────────────────────────────────────────────────────────────────────────
 * A broken rectangular wall, crumbled by deterministic hash — read: "something STOOD here", and
 * nothing more specific than that, which is exactly as much as canon currently permits. Walls are
 * STONE (already mineable, already textured); the interior ground is left as generated (grey
 * soil), so the ruin reads as part of the drained country rather than furniture dropped on it.
 */
const WALL_MAX = 3

/** The wall height this position wants, 0 = a gap. Deterministic — same ruin, forever. */
function wallHeightAt(site: Site, dx: number, dz: number): number {
  const g = hash2(dx + 64, dz + 64, site.seed ^ 0x8a11)
  if (g < 0.30) return 0                                   // crumbled through — an entrance somewhere
  const c = hash2(dz + 128, dx + 128, site.seed ^ 0x77a1)
  return 1 + Math.floor(c * WALL_MAX)                      // 1..3, mostly low
}

/**
 * Write every block of `site` that lands inside this column. Same contract as growTree: bounded
 * writes, clipped to the column, any column touching the footprint reproduces its own slice.
 */
export function buildRuin(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, size: number, site: Site,
): void {
  const r = DEFAULT_SITES.footprint >> 1
  const yTop = oy0 + sections.length * size
  const put = (wx: number, wy: number, wz: number, mat: number) => {
    if (wx < ox || wx >= ox + size || wz < oz || wz >= oz + size) return
    if (wy < oy0 || wy >= yTop) return
    const si = ((wy - oy0) / size) | 0
    const sec = sections[si]
    if (!sec) return
    sec.set(wx - ox, wy - oy0 - si * size, wz - oz, mat)
  }
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const onWall = Math.abs(dx) === r || Math.abs(dz) === r
      if (!onWall) continue
      const hWall = wallHeightAt(site, dx, dz)
      if (hWall === 0) continue
      // Base AT the pad's lowest surface: on the low side the wall replaces the surface block, on
      // the high side its first course sits buried — either way it seats into the ground across
      // the pad's ≤2 span and can never float where the ground dips under it.
      for (let y = site.floor; y <= site.floor + hWall; y++) put(site.x + dx, y, site.z + dz, MAT.STONE)
    }
  }
}

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
      // Cheap clip: skip sites whose footprint cannot touch this column at all.
      const r = (cfg.footprint >> 1) + 1
      if (site.x + r < ox || site.x - r >= ox + size || site.z + r < oz || site.z - r >= oz + size) continue
      buildRuin(sections, ox, oy0, oz, size, site)
      placed++
    }
  }
  return placed
}
