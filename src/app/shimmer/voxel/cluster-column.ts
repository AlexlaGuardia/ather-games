// The cluster's column builder — the adapter between `cluster.ts`'s plan and a real `Column`.
//
// ★ WHY ITS OWN FILE, and it is the same argument `plot-column.ts` makes: `cluster.ts` imports
// noise and `plot.ts` and nothing else, and it is worth keeping that way. `column.ts` pulls in
// height, depth, carve, ore and trees — the whole continent, none of which a cluster wants. So the
// glue lives here, importing both, and neither of the two it joins knows about the other.
//
// ── ★★ THE Y MODEL: THE MIDDLE IS LOWER THAN THE FOLDS, AND THAT IS ALEX'S WORD MADE LITERAL ────
// He called the connecting ground ***valleys***. A valley is low ground between high ground, so the
// plan's two kinds of made ground — the Green and the lanes — are one landform seen twice: **the
// ground falls away from the folds.**
//
//   · the **Green** becomes a shallow BOWL: level at the folds' own plane where it meets them,
//     settling to `dip.depth` below it in the middle;
//   · a **lane** becomes the slope into that bowl, for exactly the same reason and by exactly the
//     same line of arithmetic;
//   · and the seam between them cannot crack, because there is no seam — one function of one
//     quantity (`foldGap`, the distance outside the nearest coast) answers for both.
//
// ★ THE ALTERNATIVE WAS A STEP, AND IT WOULD HAVE BEEN A BUG BEFORE IT WAS A LOOK. Flat middle at
// one height, folds at another, means a `dip.depth` cliff wherever they touch — and at max tier
// they touch along the Green's whole corner. A keeper walking home from the green would fall down
// it. The bowl removes the cliff by construction rather than by a ramp somebody has to remember to
// place at each of the eight junctions.
//
// ★ AND IT GIVES THE POOL A HOME BEFORE THE POOL EXISTS. Canon permits *"a pool on the Green — four
// keepers' carried water in one place, everyone pours in the same way everyone gives a corner"* and
// forbids any source. Water carried into the low middle of a bowl is where water would sit. Nothing
// here generates any; the shape simply stops the eventual pool from needing a hole dug for it.
//
// ── ★★ THE FOUR DOORS, AND NOTHING IS CARVED ────────────────────────────────────────────────────
// Canon: *"it is one fold with four thresholds onto it."* Each quarter keeps its own way out, on
// the bearing pointing AWAY from the middle — so the doors ring the cluster's outside and none of
// them opens onto the Green. A door facing in would be a door between cluster-mates, which is the
// permission system canon's first ruling exists to forbid.
//
// ★ AND IT NEEDED NO HOLE, WHICH IS THE PART WORTH KNOWING BEFORE TOUCHING IT. The obvious build
// is to punch a gap in the cluster's wall, and `plot.ts` already ruled that out for its own: the
// bore stops at the coast, *"the cave is an alcove with a solid back, and the back is where the
// shimmer stands"* — run it further and it is *"a literal hole in the fold's shell, with the void
// on the far side of it and nothing between a keeper and a fall."* So a threshold is a MOUND with
// an alcove in it, the crossing is the shimmer at its back, and **the shell is never pierced**.
// The cluster inherits all of that for free by handing its doorway columns back to the fold.
//
// ⚠ WHAT IS STILL NOT HERE: the crossing itself. This builds the door; wiring what happens when a
// keeper walks into the shimmer is the host's, and it needs the `Space` branch that does not exist
// yet. A cluster now has four doors and nowhere to arrive from.

import { Column, SECTION, Stage, refreshUniform } from './column'
import {
  DEFAULT_CLUSTER, QUARTERS, clusterAt, clusterReach, foldGap, quarterCentre, quarterLocal,
  quarterPlot, type ClusterConfig, type QuarterId,
} from './cluster'
import { plotHeight, plotMaterialAt, plotThreshold, type PlotConfig } from './plot'

/** How the made ground falls away from the folds. */
export interface ClusterDip {
  /** How far below the folds' plane the middle settles, in blocks. */
  depth: number
  /** Over how many blocks it gets there, measured out from the nearest coast. */
  ramp: number
  /** Thickness of the made ground's keel, hung under `baseY` like the plot's. */
  keel: number
}

/**
 * ⚠ `keel` 14 IS THE PLOT'S OWN, AND THE FIRST CUT'S 12 WAS WRONG IN A WAY ONLY THE SECTION SHOWED.
 * `plot.ts` hangs a fold's keel from `baseY` and bottoms out at `baseY − keel + 1` = 83. At 12 the
 * made ground stopped at 85, so the cluster's underside had a **notch** two blocks proud of the
 * islands either side of it — from below, a plank slotted between two islands rather than one body
 * with a dip in it. Nothing in the plan view could show that and no guard was asking; the
 * cross-section showed it in one glance.
 */
export const DEFAULT_DIP: ClusterDip = { depth: 5, ramp: 40, keel: 14 }

/**
 * A quarter's config: its own plot's, at its own tier, with its threshold turned to face out of the
 * cluster. ⚠ The cave is KEPT — an earlier cut cleared it, on the reasoning that a mound growing
 * out of a wall ring this file does not draw would be a free-floating hill of cloud in somebody's
 * garden. That was true only because the doorway columns were not being handed back to the fold;
 * they are now, so the fold draws its own ring under its own mound and the two arrive together.
 */
export function clusterQuarterPlot(q: QuarterId, cfg: ClusterConfig): PlotConfig | null {
  return quarterPlot(q, cfg)
}

/** Smooth in, smooth out — so the bowl has a lip rather than a crease. */
const smooth = (t: number): number => t * t * (3 - 2 * t)

/**
 * The made ground's surface: the Green's bowl and the lanes' slopes, as one curve.
 *
 * ⚠ MEASURED FROM THE COAST, LIKE EVERYTHING ELSE THE PLOT DOES. `plot.ts` learned this the
 * expensive way — a taper written as a fraction of the radius re-rolled 87.7% of an island's keel
 * the first time a fold grew. `foldGap` is blocks from the nearest coast, so a fold growing changes
 * the slope only in the ring it just covered, and never the middle.
 */
export function middleHeight(x: number, z: number, cfg: ClusterConfig, dip: ClusterDip = DEFAULT_DIP): number {
  const t = smooth(Math.min(1, Math.max(0, foldGap(x, z, cfg) / dip.ramp)))
  return Math.round(cfg.base.baseY - dip.depth * t)
}

/**
 * The top solid block of a cluster column, or `null` where there is no ground.
 *
 * A quarter answers with its own fold's surface, in its own space and on its own seed — so a
 * keeper's garden rolls exactly as it would alone. The Green and the lanes answer with the bowl.
 */
export function clusterHeight(
  x: number, z: number, cfg: ClusterConfig = DEFAULT_CLUSTER, dip: ClusterDip = DEFAULT_DIP,
): number | null {
  const c = clusterAt(x, z, cfg)
  if (c.part === 'quarter') {
    const plot = clusterQuarterPlot(c.quarter!, cfg)!
    const l = quarterLocal(x, z, c.quarter!, cfg)
    return plotHeight(l.x, l.z, c.keeper!.seed, plot)
  }
  if (c.part === 'green' || c.part === 'join') return middleHeight(x, z, cfg, dip)
  return null
}

/**
 * What is at (x, y, z) in a cluster?
 *
 * ★ ORDERED PREDICATE LIST, FIRST MATCH WINS — `plot.ts`'s shape and for its reason: O(1) at any y,
 * so a chunk builder can fill any section in any order without walking a column.
 */
export function clusterMaterialAt(
  x: number, y: number, z: number, cfg: ClusterConfig = DEFAULT_CLUSTER, dip: ClusterDip = DEFAULT_DIP,
): number {
  const m = cfg.base.materials
  const c = clusterAt(x, z, cfg)

  // 1. A KEEPER'S OWN FOLD — delegated whole, so a quarter is bit-for-bit the island the keeper
  //    would have stood on alone. ⚠ `plotMaterialAt` also owns the plot's WALL ring, which would be
  //    a ring of cloud around each quarter inside a cluster that canon says is one fold. It cannot
  //    fire here: this branch is only reached for a column `clusterAt` already resolved as ground
  //    inside the coast, and the ring's own rule is `d > edge`. The cluster's wall is rule 3.
  if (c.part === 'quarter') {
    const plot = clusterQuarterPlot(c.quarter!, cfg)!
    const l = quarterLocal(x, z, c.quarter!, cfg)
    return plotMaterialAt(l.x, y, l.z, c.keeper!.seed, plot)
  }

  // 2. THE MADE GROUND — the Green and the lanes, one body.
  if (c.part === 'green' || c.part === 'join') {
    const top = middleHeight(x, z, cfg, dip)
    if (y > top) return 0
    const bottom = cfg.base.baseY - dip.keel + 1
    if (y < bottom) return 0
    // ── ★★ THE MADE GROUND HAS NO ROCK BODY, AND THAT IS THE STATEMENT, NOT A SHORTCUT ──────────
    //    Turf, one course of soil, and pressed cloud all the way down. A fold is an ISLAND: it has
    //    a stone core because it grew. The Green and the lanes are what the folding pressed out of
    //    the cloud — canon's *"nobody made it, the folding made it"* — so a keeper who digs into
    //    the middle finds the cloud it was made from, not bedrock that was never there.
    //
    //    ⚠ IT IS ALSO A VISIBLE TELL AND THE SECTION IS WHERE IT WAS DECIDED. Side by side, the
    //    folds show six or seven courses of stone and the middle shows none, so the eye reads the
    //    middle as newer and MADE without a word of UI. The first cut got this by accident — the
    //    plot's layering left no room for stone at the bowl's floor and a single sliver of it at
    //    the lip, which is the worst of both: a statement nobody chose, contradicted in one band.
    //
    //    ★★ AND THE CLOUD IS STILL TESTED BEFORE THE SOIL, carried from `plotMaterialAt`, which
    //    paid for it: written turf-then-soil-then-rest, the soil courses eat a thin column's whole
    //    keel and leave ordinary diggable dirt with the VOID under it. The floor material's
    //    `hardness: Infinity` is the only thing stopping a keeper mining out of the bottom of the
    //    world, and it protects nothing if the soil rule outranks it. **The keel is a floor first
    //    and a surface second**, which is why the two soil courses are carved out of the top rather
    //    than the cloud being carved out of the bottom.
    if (y === top) return m.topsoil
    if (y === top - 1) return m.subsoil
    return m.floor
  }

  // 3. A DOORWAY — handed back to the fold whole, so the mound, its alcove and the ring it grows
  //    out of are `plot.ts`'s own geometry with `plot.ts`'s own safety gates. In particular the
  //    cave decides nothing below its floor and only ever fills air, so a door cannot eat the turf
  //    a keeper built on — the 08-18 burial wearing a nicer coat, and the gate that stops it.
  if (c.part === 'door') {
    const plot = clusterQuarterPlot(c.quarter!, cfg)!
    const l = quarterLocal(x, z, c.quarter!, cfg)
    return plotMaterialAt(l.x, y, l.z, c.keeper!.seed, plot)
  }

  // 4. THE CLUSTER'S ONE CLOUD WALL. It rings the whole outline — every fold's outer coast, the
  //    lanes' sides and the holes between them — because a cluster is one fold. Hung from `baseY`
  //    rather than from the local surface, exactly as the plot hangs its own.
  if (c.part === 'wall') {
    const lo = cfg.base.baseY - cfg.base.wallSkirt
    const hi = cfg.base.baseY + cfg.base.wallHeight
    return y >= lo && y <= hi ? m.wall : 0
  }

  return 0
}

/**
 * The y band a cluster can possibly occupy — what a host has to fill, and nothing above or below.
 *
 * ⚠ IT WALKS THE FOUR QUARTERS, AND THE FIRST VERSION OF THIS NOTE GAVE A FALSE REASON FOR IT. It
 * said a maxed fold hangs lower than a young one, so a range from `cfg.base` alone would be short
 * for a mixed cluster. **That is not true and the suite caught me asserting it:** `plotForTier`
 * changes `capRadius` and nothing else, and `keelDepth` is `keel × √(1−t²)` with `t` measured from
 * the COAST — so the deepest point of a tier-0 fold and a tier-2 fold are the same block. A tier
 * makes a fold wider, never deeper.
 *
 * The loop stays, as **defence rather than arithmetic**: a quarter's config is its own, and nothing
 * in the type system says four quarters share a keel, a roll or a wall height. If a future tier
 * ever does change one, this reads it instead of being quietly short — and a range that is short
 * does not fail loudly, it silently omits ground at the bottom of the world where nobody looks.
 */
export function clusterYRange(
  cfg: ClusterConfig = DEFAULT_CLUSTER, dip: ClusterDip = DEFAULT_DIP,
): { min: number; max: number } {
  const b = cfg.base.baseY
  let min = Math.min(b - dip.keel + 1, b - cfg.base.wallSkirt)
  let max = Math.max(b + cfg.base.wallHeight, b)
  for (const q of QUARTERS) {
    const plot = clusterQuarterPlot(q, cfg)
    if (!plot) continue
    min = Math.min(min, plot.baseY - plot.keel - 2)
    max = Math.max(max, plot.baseY + plot.roll + plot.wallHeight + 1)
  }
  return { min, max }
}

/**
 * Fill a column with a cluster's ground. Mirrors `generateColumn`'s post-conditions — uniform table
 * refreshed, stage `Ready` — so a host can treat the two as interchangeable at the call site.
 *
 * ⚠ NO `overrides` MAP, and its absence is correct rather than missing — the same argument
 * `generatePlotColumn` makes. `Column.overrides` exists because the continent writes trees, ore and
 * ruins AFTER the depth rule and `materialAt` cannot see them. A cluster has no later stages:
 * `clusterMaterialAt` IS the whole world here and can simply be asked again.
 */
export function generateClusterColumn(
  col: Column, cfg: ClusterConfig = DEFAULT_CLUSTER, dip: ClusterDip = DEFAULT_DIP,
): Column {
  const { min, max } = clusterYRange(cfg, dip)
  const lo = Math.max(0, min)
  const hi = Math.min(col.sections.length * SECTION - 1, max)

  for (let z = 0; z < SECTION; z++) {
    for (let x = 0; x < SECTION; x++) {
      const wx = col.wx + x, wz = col.wz + z
      for (let y = lo; y <= hi; y++) {
        const mat = clusterMaterialAt(wx, y, wz, cfg, dip)
        if (mat === 0) continue                     // sections start empty; skip the writes
        const s = (y / SECTION) | 0
        col.sections[s].set(x, y - s * SECTION, z, mat)
      }
    }
  }
  refreshUniform(col)
  col.stage = Stage.Ready
  return col
}

/**
 * The value `recordEdit` must diff a cluster cell against.
 *
 * ★★ DO NOT USE `column.ts`'s `generatedVoxel` HERE, AND DO NOT USE `plotGeneratedVoxel` EITHER.
 * The first would answer with the CONTINENT's depth rule and write the whole cluster into the save
 * as player edits on first load — the trap `plot-column.ts` documents. The second is subtler and
 * worse for being nearly right: it would answer correctly inside a quarter and then answer with the
 * plot's own **wall ring** and **void** for every column of the Green, the lanes and the cluster's
 * wall — ground this file put there that `plot.ts` has never heard of. A diff baseline that
 * disagrees with what was generated does not fail loudly; it freezes the terrain, because every
 * future change to the shape is masked by a save full of edits asserting the old shape was
 * deliberate.
 */
export function clusterGeneratedVoxel(
  col: Column, lx: number, y: number, lz: number,
  cfg: ClusterConfig = DEFAULT_CLUSTER, dip: ClusterDip = DEFAULT_DIP,
): number {
  return clusterMaterialAt(col.wx + lx, y, col.wz + lz, cfg, dip)
}

/**
 * Where each keeper's door stands, in cluster space — the spot a host lands somebody on, and the
 * spot the crossing's shimmer is drawn at.
 *
 * ★ TAKEN FROM `plotThreshold`, NEVER RE-DERIVED. It already owns the inset, the fallback for a
 * threshold that would land off the ground, and the rule that the door follows the coast as the
 * fold grows. A second copy of that arithmetic here is the `reading-one-layer-away` shape: two
 * functions whose names are both "threshold", agreeing until a fold grows.
 */
export function clusterThresholds(
  cfg: ClusterConfig = DEFAULT_CLUSTER,
): { quarter: QuarterId; x: number; z: number; y: number }[] {
  const out: { quarter: QuarterId; x: number; z: number; y: number }[] = []
  for (const q of QUARTERS) {
    const k = cfg.slots[q], plot = clusterQuarterPlot(q, cfg)
    if (!k || !plot) continue
    const t = plotThreshold(k.seed, plot)
    const c = quarterCentre(q, cfg)
    out.push({ quarter: q, x: c.x + t.x, z: c.z + t.z, y: t.y })
  }
  return out
}

/** How many blocks across a host must be ready to build. Derived from the widest slot. */
export const clusterSpan = (cfg: ClusterConfig = DEFAULT_CLUSTER): number => Math.ceil(clusterReach(cfg)) * 2
