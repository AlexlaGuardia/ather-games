// Moonwell Glade as an ISLAND — Greg's pocket, seen from inside.
//
// ★ PURE CORE. Noise, the zone table and the AIR constant; no three/react/DOM, no column. Same
// shape as `plot.ts`: this file decides where the Glade's ground ENDS, where its cloud-wall stands,
// how deep its keel hangs and where its one seam opens. `glade-column.ts` is the adapter that
// applies those answers to a real `Column`; nothing here touches one.
//
// ── ★★ WHY THE GLADE IS A SPACE OF ITS OWN (Alex, 2026-09-16) ───────────────────────────────────
// *"moonwell glade is supposed to be an example of what the home plot could look like, but as it
// is now its just a settlement at the start of the story path."* Canon had already said so, twice:
//   · `game/shimmer-geography.md` › *the garden is POCKETS*: **"Every arrow in that loop is a
//     PASSAGE through a cloud-wall, never open ground. The loop is a graph of islands."**
//   · same file: **"Moonwell Glade is a pocket, and it is a PERMANENT HUB — never visit-once."**
//   · `game/shimmer-storyline.md` › Beat 0: the keeper lands AT Moonwell, stays, earns the fold,
//     and Greg *"sends you home to the pocket he just folded."*
// The build had the Glade as a ZONE of the Wilds continent — tended ground at (-150,-640) with a
// stone arch that opened after the fold onto 500 blocks of open country to the plot's seam. A
// walk is not a passage, and a clearing on a continent is not a pocket. So the Glade becomes what
// the plot already is: an island in the cloud, whose only ways out are seams.
//
// ── ★ WHY THIS IS NOT `plot.ts` WITH A CENTRE PARAMETER ─────────────────────────────────────────
// The plot's geometry carries invariants the Glade has no use for: additive growth (the coast may
// move, the interior a keeper built may not), the keel band that must not re-roll under a base,
// litter tiers, the cave-mound, a threshold that follows `capRadius` as it grows. Greg's ground is
// FIXED — it never grows, nobody builds its coast, and its surface is the Wilds' own terrain (so
// every blueprint, the pool and the five folk stand exactly where they stood when the Glade was a
// zone). Threading a centre and a "use the continent's height field" switch through every plot
// function to reuse ~60 lines of ring math is the mode-through-seven-stages trade `plot-column.ts`
// already argued against. The ring math is restated here, small, and tested on its own.
//
// ── THE SHAPE ────────────────────────────────────────────────────────────────────────────────────
//   · a disc of radius `radius` around the zone anchor, its edge wobbled BY BEARING ONLY (so the
//     outline is a closed curve — same rule as `plot.ts` › `edgeAt`), and the wobble only ever cuts
//     IN, so nothing generated lies past `radius`;
//   · inside it, the Wilds' own ground, with a keel of pressed cloud hung under it — a lens, deepest
//     at the centre, so the underside reads as an island and not a sawn-off cylinder;
//   · outside it, a ring of cloud-wall standing on nothing, `wallWidth` thick, from `wallSkirt`
//     under the ground to `wallHeight` over it; past the ring, the void. Cloud, then dark, then
//     stars — canon forbids dressing it.
//   · one seam, at `seamBearing`: the bearing from the Glade to the plot's fold. It is the way
//     Greg's fold lets a keeper out to their own ground and it is drawn by `seam.ts`, never cut
//     through the wall (a hole in a cloud-wall is the locked gate canon refuses, from the other side).

import { fbm2 } from './noise'
import { AIR } from './section'
import { ZONE_ANCHORS } from './zones'

const ANCHOR = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!

export interface GladeConfig {
  cx: number
  cz: number
  /** The island's greatest radius, in blocks. The wobble cuts in from it, never out. */
  radius: number
  /** Edge wobble as a fraction of radius — bearing-only noise, see `gladeEdgeAt`. */
  wobble: number
  /** Deepest the keel hangs under the ground, at the centre, on top of `rim`. */
  keel: number
  /** Ground thickness at the very lip — the island is never thinner than this under its turf. */
  rim: number
  /** Thickness of pressed cloud at the bottom of the keel. */
  cloudBand: number
  wallWidth: number
  /** The wall stands this far ABOVE the Wilds' ground at its own column… */
  wallHeight: number
  /** …and this far below it. Deep enough to meet the keel where the lens has thinned to nothing. */
  wallSkirt: number
  /** Bearing (radians, +x = 0) from the centre to the seam — toward the plot's fold at the origin. */
  seamBearing: number
  /** How far inside the coast the seam's floor cell stands, in blocks. */
  seamInset: number
  materials: { floor: number; wall: number }
}

export const DEFAULT_GLADE: GladeConfig = {
  cx: ANCHOR.x,
  cz: ANCHOR.z,
  // The zone's tended blend reaches rx 340 / rz 300; every authored thing (Greg, the pool, the
  // five buildings, the harness's standing spots) sits within ~60 of the anchor. 300 keeps the
  // whole tended crown and the approach road's last stretch, which now runs to the seam.
  radius: 300,
  wobble: 0.06,
  keel: 36,
  rim: 8,
  cloudBand: 5,
  wallWidth: 3,
  wallHeight: 12,
  wallSkirt: 40,
  seamBearing: Math.atan2(0 - ANCHOR.z, 0 - ANCHOR.x),
  seamInset: 2,
  materials: { floor: 1, wall: 56 },   // PACKED_CLOUD, CLOUD_WALL — literal ids, as plot.ts does
}

export const gladeDist = (x: number, z: number, cfg: GladeConfig = DEFAULT_GLADE): number =>
  Math.hypot(x - cfg.cx, z - cfg.cz)

/** The island's edge at the bearing of (x, z), in blocks from centre. Cuts in from `radius`, never out. */
export function gladeEdgeAt(x: number, z: number, seed: number, cfg: GladeConfig = DEFAULT_GLADE): number {
  const d = gladeDist(x, z, cfg)
  if (d === 0) return cfg.radius
  const n = fbm2(((x - cfg.cx) / d) * 2.3, ((z - cfg.cz) / d) * 2.3, seed ^ 0x61ade, 3)
  return cfg.radius * (1 - cfg.wobble * n)
}

/** Cheapest possible reject: past this, nothing of the Glade exists at any bearing. */
export const gladeReach = (cfg: GladeConfig = DEFAULT_GLADE): number => cfg.radius + cfg.wallWidth

export const insideGlade = (x: number, z: number, seed: number, cfg: GladeConfig = DEFAULT_GLADE): boolean =>
  gladeDist(x, z, cfg) <= gladeEdgeAt(x, z, seed, cfg)

export const inGladeWall = (x: number, z: number, seed: number, cfg: GladeConfig = DEFAULT_GLADE): boolean => {
  const d = gladeDist(x, z, cfg)
  if (d > gladeReach(cfg)) return false
  const e = gladeEdgeAt(x, z, seed, cfg)
  return d > e && d <= e + cfg.wallWidth
}

/** 0 at the centre, 1 at the coast — the same coast-relative measure the plot's keel uses. */
export function gladeCoastT(x: number, z: number, seed: number, cfg: GladeConfig = DEFAULT_GLADE): number {
  const e = gladeEdgeAt(x, z, seed, cfg)
  return e <= 0 ? 1 : Math.min(1, gladeDist(x, z, cfg) / e)
}

/** How far the keel hangs under `rim` at this column. An elliptical lens: thick inland, nothing extra at the lip. */
export function gladeKeelDepth(x: number, z: number, seed: number, cfg: GladeConfig = DEFAULT_GLADE): number {
  const t = gladeCoastT(x, z, seed, cfg)
  return Math.round(cfg.keel * Math.sqrt(Math.max(0, 1 - t * t)))
}

/**
 * The one decision per column, made once. `gladeMaskAt` and the column builder both read it, so
 * the diff baseline (`gladeGeneratedVoxel`) and the generated island cannot disagree — which is
 * the regrown-trees bug `plot-column.ts` records.
 *
 * ★ PER COLUMN, NOT PER CELL, AND THAT IS THE BUBBLE'S LESSON (`bubble.ts` › `bubbleMaterialAt`):
 * a mask that evaluated its noise per voxel would pay 65,536 fbm calls a column and the world would
 * stop streaming. Everything below depends on (x, z, h) alone; the altitude bands are plain compares.
 */
export type GladePlan =
  | { kind: 'void' }
  | { kind: 'wall'; lo: number; hi: number }
  | { kind: 'inside'; bottom: number; floorTop: number }

export function gladePlanAt(x: number, z: number, seed: number, h: number, cfg: GladeConfig = DEFAULT_GLADE): GladePlan {
  const d = gladeDist(x, z, cfg)
  if (d > gladeReach(cfg)) return { kind: 'void' }
  const e = gladeEdgeAt(x, z, seed, cfg)
  if (d > e) {
    if (d <= e + cfg.wallWidth) return { kind: 'wall', lo: h - cfg.wallSkirt, hi: h + cfg.wallHeight }
    return { kind: 'void' }
  }
  const bottom = h - cfg.rim - gladeKeelDepth(x, z, seed, cfg)
  return { kind: 'inside', bottom, floorTop: bottom + cfg.cloudBand }
}

/** What this cell is under a column's plan. `null` = keep the Wilds' answer; a material = replace it. */
export function gladeBandAt(plan: GladePlan, y: number, cfg: GladeConfig = DEFAULT_GLADE): number | null {
  switch (plan.kind) {
    case 'void': return AIR
    case 'wall': return y >= plan.lo && y <= plan.hi ? cfg.materials.wall : AIR
    case 'inside':
      if (y < plan.bottom) return AIR
      if (y < plan.floorTop) return cfg.materials.floor
      return null
  }
}

/** Per-cell convenience over the plan — for callers that ask about one cell, not a column. */
export const gladeMaskAt = (
  x: number, y: number, z: number, seed: number, h: number, cfg: GladeConfig = DEFAULT_GLADE,
): number | null => gladeBandAt(gladePlanAt(x, z, seed, h, cfg), y, cfg)

/**
 * Where the seam stands: `seamInset` blocks inside the coast at `seamBearing`, on the ground.
 * ⚠ DERIVED, never stored — the coast wobbles per seed (`plotThreshold` states the same rule).
 * The ground height is the caller's, because this file does not see the height field.
 */
export function gladeSeamSpot(
  seed: number, groundAt: (x: number, z: number) => number, cfg: GladeConfig = DEFAULT_GLADE,
): { x: number; z: number; y: number; bearing: number } {
  const b = cfg.seamBearing
  // One evaluation: the edge depends on bearing alone, so any point along it gives the same answer.
  const e = gladeEdgeAt(cfg.cx + Math.cos(b) * cfg.radius, cfg.cz + Math.sin(b) * cfg.radius, seed, cfg)
  const r = e - cfg.seamInset
  const x = Math.floor(cfg.cx + Math.cos(b) * r)
  const z = Math.floor(cfg.cz + Math.sin(b) * r)
  return { x, z, y: groundAt(x, z) + 1, bearing: b }
}
