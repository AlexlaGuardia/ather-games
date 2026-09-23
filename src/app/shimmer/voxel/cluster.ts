// A GARDEN CLUSTER — four whole folds, THE GREEN at their middle, and the ground that joins them.
//
// ★ PURE CORE. Arithmetic and `plot.ts`; no react/three/DOM, no column. Same contract as `plot.ts`
// and `glade.ts`: this file decides WHERE the cluster's ground is and WHOSE it is. It never builds
// a column — an adapter does that, the way `glade-column.ts` does for the Glade.
//
// Canon: `CANON/game/shimmer-geography.md` › **GARDEN CLUSTERS** (RULED 2026-09-23, /magii + Alex),
// its same-day amendment, THE GREEN AND WATER, and ONE FOLDS THE REST SIGN UP. Read those before
// changing a line here; every ⛔ below is one of their guards and not a preference.
//
// ── ★★ WHY THIS IS NOT A NEW SPACE, AND WHY THAT IS THE LOAD-BEARING DECISION ───────────────────
// Canon's first ruling is architectural and it is aimed straight at the obvious build: **"a cluster
// is ONE fold, not four folds with doors."** The tempting shape — four plots plus a permissions
// table that lets three other keepers through each one's threshold — is the shape canon forbids,
// because the guest law is *the keeper holds the fold open and it closes behind a leaving guest*,
// and four standing permanent invitations is a door with a lock three other people hold.
//
// **So a cluster is the plot space with four quarters in it.** No second `Space` id, no second door
// for `VoxelWorld` to police, no presence check, no absent keeper being borrowed from. A guest is
// HELD OPEN; a cluster-mate is FOLDED IN, and never left.
//
// ── ★★ THE SHAPE, AND WHY THE FIRST ONE WAS WRONG (Alex, 2026-09-22, looking at it) ─────────────
// The first cut laid the four folds on a 2×2 GRID and clipped each keeper's disc to its own cell.
// It was arithmetically tidy — quarters could not overlap, because a column was in exactly one cell
// — and Alex threw it out on sight, for two reasons that were both the clip's fault:
//
//   · ***"the amount of land they lose is too much."*** A clip is not a boundary, it is a deletion.
//     A max fold centred near the middle had the two inner sides of its own island cut away — ground
//     a solo keeper would have had, gone for joining a cluster. **Canon's whole spine is that ground
//     is never taken**, and the clip took some at formation, quietly, from the biggest folds.
//   · ***"it looks too janky… plus the dif tiers."*** A clipped disc has two hard straight edges and
//     a wobbled coast on the other two, so a quarter read as a bitten-off shape rather than as
//     somebody's island — and at mixed tiers the four bitten shapes did not line up with each other
//     at all.
//
// **So nothing is clipped now.** The centres are spaced at `PLOT_TIERS`' maximum, which is the one
// distance at which four whole folds can touch and can never overlap, and **every keeper keeps
// their entire island** — the only ground the Green takes is the corner canon says each one gives.
//
// ── ★ AND THE GAP IS CROSSED BY GROUND, NOT BY GROWING (Alex's call, the same breath) ───────────
// ***"what if tier 1 and 0 get valleys that can connect them to the middle and to adjacent
// gardens."*** That is the missing piece, and it inverts the problem in the right direction: the
// first cut made a small fold WAIT to be connected, so a tier-0 keeper stood on an island looking
// at a Green they could not walk to. Now the cluster is connected **from formation at every tier**,
// and what changes with a tier is how far you walk.
//
//   · a **spoke** runs from each fold to the Green, down its diagonal;
//   · a **rim** runs between each pair of adjacent folds, along the line between their centres;
//   · both are derived from ONE rule and are **exactly as long as the gap** — so at max tier, where
//     the fold already reaches, they have zero length and contribute nothing. The tier-dependence
//     falls out of the geometry instead of being a case in the code, which is what the grid version
//     had going for it and the only thing worth keeping from it.
//
// ⚠⚠ **THE WORD `join` IS A PLACEHOLDER AND IS DELIBERATELY NOT A WORLD-NOUN.** Alex's word is
// *valley*, and **`valley` is already canon**: the **Rebirth Valleys** are what greyfields become
// once the Lucernyx is freed (`game/shimmer-geography.md` › *The Greyfields*, ruled 2026-08-13),
// reclaimed country carrying mana-wells where the Anemonyx may breach. Naming a lane between two
// gardens after the campaign's biggest payoff is the same collision the register law caught twice
// already — *basin* for the mixing vessel, *prime* for *prize*. **An id is an address and a name is
// a claim**, so the build gets the address and the naming is in `CANON_GAPS.md` for the Magii seat.
// Rename the display strings when it is ruled; do not rename them here on a guess.
//
// ── ★ WHAT THIS FILE DELIBERATELY HAS NO WORD FOR ───────────────────────────────────────────────
// ⛔ **No folder, owner, leader, founder or head.** Canon, on the keeper who folds the cluster:
// *"THERE IS NO TITLE, and the absence is deliberate… a name for the role is the thing that would
// invite the ownership every guard above forbids, so the cheapest defence is not to mint one."* A
// field called `folder` would be the first step to all of it, so there isn't one, and the suite
// fails if anybody adds one. Who folded it is a fact about the past, like who raised the barn.
//
// ⛔ **And no presence, online flag or last-seen.** *Folded once, it holds.* The geometry is a
// function of the SLOTS and nothing else, so the world has no mechanism with which to un-make
// somebody's ground. Leaving is a choice somebody makes, not something the world does.

import { DEFAULT_PLOT, PLOT_TIERS, edgeAt, plotForTier, type PlotConfig } from './plot'

export type QuarterId = 'ne' | 'nw' | 'sw' | 'se'

export const QUARTERS: readonly QuarterId[] = ['ne', 'nw', 'sw', 'se'] as const

export const QUARTER_SIGN: Record<QuarterId, { sx: 1 | -1; sz: 1 | -1 }> = {
  ne: { sx: 1, sz: 1 },
  nw: { sx: -1, sz: 1 },
  sw: { sx: -1, sz: -1 },
  se: { sx: 1, sz: -1 },
}

/**
 * The four adjacent pairs, in order round the ring. ⚠ NE/SW and NW/SE are **diagonal**, not
 * adjacent — they meet only at the Green, which is the whole point of a middle.
 */
export const RIM_PAIRS: readonly (readonly [QuarterId, QuarterId])[] = [
  ['ne', 'nw'], ['nw', 'sw'], ['sw', 'se'], ['se', 'ne'],
] as const

/**
 * A keeper in a slot: their seed and tier, and nothing else.
 *
 * ★ THE SEED IS PER KEEPER. A quarter is the keeper's OWN fold, with their own coast, and joining
 * must not re-roll it. ⚠ `tier` is read through `plotForTier`, which clamps — it comes from a save.
 */
export interface ClusterKeeper {
  seed: number
  tier: number
}

/**
 * ⛔ FOUR SLOTS, AND A SLOT IS EITHER A KEEPER OR `null`. `null` is **no ground at all** — no fold,
 * no Green corner, no spoke and no rim. It is never a keeper with a flag on them, because the
 * moment an empty quarter is a keeper-shaped thing in the data it becomes one on the screen.
 */
export type ClusterSlots = Record<QuarterId, ClusterKeeper | null>

export interface ClusterConfig {
  /**
   * How far each fold's centre sits from the middle, on each axis.
   *
   * ⚠⚠ **IT MUST BE AT LEAST `PLOT_TIERS`' MAXIMUM, AND THAT IS A SAFETY BOUND, NOT A TASTE ONE.**
   * Two adjacent centres are `2 × offset` apart and two max folds are `2 × capRadius` across, so at
   * `offset` = 500 they may touch and can never overlap. A single block below it and two keepers'
   * ground occupies the same column — which is not a rendering problem, it is two people owning one
   * place, in a system whose entire spine is that a quarter is somebody's own. `cluster.test.ts`
   * asserts the bound.
   *
   * ★ AND IT IS FIXED, NEVER DERIVED FROM THE MEMBERS' TIERS. A plot grows around a centre that
   * never moves; spacing derived from current tiers would move ground under people as they levelled,
   * which the no-decay law forbids outright.
   */
  offset: number
  /**
   * The Green's HALF-side. The square is `2 × green` across.
   *
   * ⚠ BOUNDED FROM BELOW BY THE MAX FOLD'S REACH. The Green's corner sits at `(green, green)`,
   * which is `(offset − green) × √2` from a fold's centre; if that exceeds a max fold's shyest
   * coast the Green is an island nobody's ground ever touches, and the corners canon says each
   * keeper GIVES would be corners no keeper ever had. Asserted.
   */
  green: number
  /** Half-width of a spoke or a rim, in blocks. The lane is twice this across. */
  joinHalfWidth: number
  slots: ClusterSlots
  /** The plot config every fold is cut from; each keeper's tier is applied on top. */
  base: PlotConfig
}

export const NO_SLOTS: ClusterSlots = { ne: null, nw: null, sw: null, se: null }

const MAX_TIER = PLOT_TIERS[PLOT_TIERS.length - 1]

/**
 * ── THE NUMBERS, AND THEY ARE MINE TO DIAL ──────────────────────────────────────────────────────
 * Canon's boundary: *"Every dimension and block count, the reserved square's size… Jin's."*
 *
 * `offset` 500 = `PLOT_TIERS`' max, the tightest spacing at which four whole folds can touch and
 * can never overlap. `green` 220: the Green's corner is 396 blocks from a fold's centre, inside a
 * max fold's shyest coast (410), so **a maxed fold reaches the Green directly and its spoke has
 * zero length** — which is what makes Alex's *"tier 1 and 0 get valleys"* fall out rather than be
 * special-cased. A tier-1 fold (328 at its shyest) walks ~68 blocks of spoke; a tier-0 one (246)
 * walks ~150. `joinHalfWidth` 60 = a 120-wide lane against a 1,000-wide garden.
 */
export const DEFAULT_CLUSTER: ClusterConfig = {
  offset: MAX_TIER,
  green: 220,
  joinHalfWidth: 60,
  slots: NO_SLOTS,
  base: DEFAULT_PLOT,
}

export const quarterCentre = (q: QuarterId, cfg: ClusterConfig): { x: number; z: number } => ({
  x: QUARTER_SIGN[q].sx * cfg.offset, z: QUARTER_SIGN[q].sz * cfg.offset,
})

/** A column's position in that fold's own plot space — the origin `plot.ts` expects. */
export function quarterLocal(x: number, z: number, q: QuarterId, cfg: ClusterConfig): { x: number; z: number } {
  const c = quarterCentre(q, cfg)
  return { x: x - c.x, z: z - c.z }
}

export function quarterPlot(q: QuarterId, cfg: ClusterConfig): PlotConfig | null {
  const k = cfg.slots[q]
  return k ? plotForTier(k.tier, cfg.base) : null
}

export const cornersGiven = (cfg: ClusterConfig): number =>
  QUARTERS.reduce((n, q) => n + (cfg.slots[q] ? 1 : 0), 0)

/**
 * ⛔ A CLUSTER STARTS AT TWO. Four is the FRAME, never the entry condition (canon, amendment 2).
 * One keeper alone is a plot — the thing the cozy line is founded on, and never a deficient cluster.
 */
export const isCluster = (cfg: ClusterConfig): boolean => cornersGiven(cfg) >= 2

// ── THE GREEN ───────────────────────────────────────────────────────────────────────────────────

export const inGreenSquare = (x: number, z: number, cfg: ClusterConfig): boolean =>
  Math.abs(x) < cfg.green && Math.abs(z) < cfg.green

/** Which quarter's sub-square of the Green a point falls in. `x >= 0` is east, `z >= 0` is north. */
export const greenQuadrant = (x: number, z: number): QuarterId =>
  x >= 0 ? (z >= 0 ? 'ne' : 'se') : (z >= 0 ? 'nw' : 'sw')

/**
 * ── ★★ THE GREEN IS AS BIG AS THE FRIENDSHIP ────────────────────────────────────────────────────
 * Canon: *"Each fold gives one corner. Two keepers make half a Green; a fourth joining completes
 * it. Nothing needs explaining — a player reads how many friends a cluster has by looking at the
 * middle."* So it is four GIVEN sub-squares, not a square that swells.
 *
 * ⚠ THAT SHAPE IS ALSO WHAT MAKES TAKING A CORNER BACK HUMANE. A Green stored as one size would
 * shrink evenly on all four sides when somebody left, taking a bite out of ground three other
 * people gave. Given corners come back one corner at a time.
 */
/**
 * ── ★★ WHOSE CORNER IS IT, WHEN THE FOLD IS NOWHERE NEAR IT? ────────────────────────────────────
 * Spaced folds raise the question honestly: a tier-0 keeper's ground is 400 blocks from the middle,
 * so *"each fold gives one corner"* looks like giving away something they never had.
 *
 * **Canon answers it in its own words and the answer is why `MIN_GREEN` is a hard bound.** Forming
 * a cluster *"RESERVES the seam square as coast, and each fold grows TOWARD it, never through it."*
 * A reservation is made against what the ground WILL be, not what it is — and `offset` is
 * `PLOT_TIERS`' maximum precisely so that a fully grown fold's coast **does** cover its corner of
 * the Green. So the corner given is real ground: the ground the grimoire entitles that keeper to,
 * held back at formation and never built on. Shrink the Green below `MIN_GREEN` and that stops
 * being true — the middle becomes an island made of corners nobody ever had.
 */

/**
 * ── ★★ THE MIDDLE IS WHOLE FROM THE MOMENT IT EXISTS (Alex, 2026-09-22) ─────────────────────────
 * ***"the middle should stay whole regardless."***
 *
 * ⚠⚠ **THIS OVERTURNS A CANON LINE RULED THE SAME DAY, AND THE OVERTURN IS FILED — DO NOT QUIETLY
 * RESTORE THE OLD SHAPE FROM THE CANON FILE.** The 09-23 amendment says *"each fold gives one
 * corner… two keepers make half a Green; a fourth joining completes it,"* and lists *the Green is
 * as big as the corners given* in its Boundary as canon. The build no longer does that. The entry
 * in `CANON_GAPS.md` carries it to the Magii seat; until it is authored in, this file and that
 * paragraph disagree **on purpose**, and the reason is recorded here so the next reader does not
 * "fix" the disagreement in the wrong direction.
 *
 * ★ AND IT IS THE MORE CANON-TRUE READING OF THE TWO, which is why it was not argued with. The
 * PRIMARY ruling's own sentence is *"it APPEARS when the cluster forms rather than being built —
 * **nobody made it, the folding made it**."* Something the folding made arrives whole; a thing
 * assembled from four contributions is a thing that was built, by four people, in instalments. The
 * amendment's partial Green quietly made the middle the one part of the cluster that WAS built.
 *
 * ★ AND CANON ALREADY HAS THE BETTER ANSWER TO WHAT THE AMENDMENT WAS FOR. Its stated purpose was
 * that *"a player reads how many friends a cluster has by looking at the middle"* — and the
 * glossary's own entry for *the Green* says an open slot **"shows as a place set at its table
 * (once the keepers have built one), never a gate or a Vacant sign."** A place set at a table reads
 * the count warmly and reads it as an INVITATION; a missing quarter of ground reads it as damage,
 * which is the exact thing the *"unfolded, never grey"* guard exists to prevent. The count survives
 * the overturn; only the mechanism changes, and it changes to the one canon already wrote.
 *
 * ⛔ WHAT DOES NOT CHANGE: an open slot still grows **no fold, no spoke and no rim**. Absence is
 * still absence everywhere else. It is the MIDDLE that is whole, not the cluster.
 */
export const inGreen = (x: number, z: number, cfg: ClusterConfig): boolean =>
  inGreenSquare(x, z, cfg) && isCluster(cfg)

// ── THE FOLDS ───────────────────────────────────────────────────────────────────────────────────

/** Is this column inside that quarter's own fold? `false` for an open slot. */
export function inFold(x: number, z: number, q: QuarterId, cfg: ClusterConfig): boolean {
  const k = cfg.slots[q]
  if (!k) return false
  const l = quarterLocal(x, z, q, cfg)
  return Math.hypot(l.x, l.z) <= edgeAt(l.x, l.z, k.seed, plotForTier(k.tier, cfg.base))
}

/**
 * How far this column lies OUTSIDE the nearest fold's coast, in blocks. Negative inside one.
 *
 * ★ EXPORTED BECAUSE THE MIDDLE'S HEIGHT IS A FUNCTION OF IT. `cluster-column.ts` drops the ground
 * away from the folds to make the Green a bowl and the lanes its slopes, and it must measure that
 * against the SAME coast the folds are drawn from — one definition, or the surface and the ground
 * it sits on disagree at the seam. (PATTERNS › `reading-one-layer-away`: the tell is two functions
 * whose names are both "edge".)
 */
export function foldGap(x: number, z: number, cfg: ClusterConfig): number {
  let best = Infinity
  for (const q of QUARTERS) {
    const k = cfg.slots[q]
    if (!k) continue
    const l = quarterLocal(x, z, q, cfg)
    best = Math.min(best, Math.hypot(l.x, l.z) - edgeAt(l.x, l.z, k.seed, plotForTier(k.tier, cfg.base)))
  }
  return best
}

/**
 * Whose fold this column is, or `null`. At most one can answer, because `offset >= capRadius`
 * makes two folds' discs incapable of overlapping — so this is a fact, not a priority order.
 */
export function foldAt(x: number, z: number, cfg: ClusterConfig): QuarterId | null {
  for (const q of QUARTERS) if (inFold(x, z, q, cfg)) return q
  return null
}

// ── THE JOINS — Alex's valleys, pending their canon name ────────────────────────────────────────

export type JoinKind = 'spoke' | 'rim'

export interface ClusterJoin {
  kind: JoinKind
  /** The quarters it runs between. A spoke names one; a rim names two. */
  between: readonly QuarterId[]
}

const SQRT2 = Math.SQRT2

/**
 * A SPOKE: the lane from a fold to the Green, down the diagonal it already sits on.
 *
 * ★ IT IS EXACTLY AS LONG AS THE GAP. The strip is bounded to the diagonal between the Green's
 * corner and the fold's centre, so a fold whose coast already crosses that span has a spoke lying
 * entirely inside its own ground, contributing nothing. Nothing tests the tier; the tier decides
 * the answer anyway.
 */
export function inSpoke(x: number, z: number, q: QuarterId, cfg: ClusterConfig): boolean {
  if (!cfg.slots[q]) return false
  const s = QUARTER_SIGN[q]
  // Distance along the quarter's diagonal, and perpendicular to it.
  const along = (x * s.sx + z * s.sz) / SQRT2
  const perp = Math.abs(x * s.sz - z * s.sx) / SQRT2
  // ⚠⚠ THE LANE RUNS ALL THE WAY IN, NOT TO THE GREEN'S CORNER — AND THE FLOOD FILL IS WHAT SAID SO.
  // The first cut started the strip at `green × √2`, the diagonal distance to the Green's corner,
  // which looks right and is wrong: the Green is a SQUARE, so along any bearing off the diagonal
  // its edge is nearer than its corner, and a wedge of Ather opened between the two. The lane and
  // the middle touched at exactly one point — a keeper could see the Green and not walk to it,
  // which is the precise failure this whole lane exists to remove. Running the strip to the middle
  // costs nothing, because `isGround` resolves the Green's square first, so the part of the spoke
  // inside it adds no ground and an un-given corner stays the Ather.
  return perp <= cfg.joinHalfWidth && along >= 0 && along <= cfg.offset * SQRT2
}

/**
 * A RIM: the lane between two ADJACENT folds, along the line joining their centres.
 *
 * ⛔ BOTH SLOTS MUST BE FILLED. A lane to a quarter nobody has taken is ground leading nowhere, and
 * canon is explicit that an unfilled slot is *no ground at all* — absence, not a stub.
 */
export function inRim(x: number, z: number, a: QuarterId, b: QuarterId, cfg: ClusterConfig): boolean {
  if (!cfg.slots[a] || !cfg.slots[b]) return false
  const sa = QUARTER_SIGN[a], sb = QUARTER_SIGN[b]
  if (sa.sx === sb.sx) {
    // They share an x: the lane runs north/south along that side.
    return Math.abs(x - sa.sx * cfg.offset) <= cfg.joinHalfWidth && Math.abs(z) <= cfg.offset
  }
  // They share a z: the lane runs east/west along that side.
  return Math.abs(z - sa.sz * cfg.offset) <= cfg.joinHalfWidth && Math.abs(x) <= cfg.offset
}

/** The join a column stands on, or `null`. */
export function joinAt(x: number, z: number, cfg: ClusterConfig): ClusterJoin | null {
  for (const q of QUARTERS) if (inSpoke(x, z, q, cfg)) return { kind: 'spoke', between: [q] }
  for (const [a, b] of RIM_PAIRS) if (inRim(x, z, a, b, cfg)) return { kind: 'rim', between: [a, b] }
  return null
}

// ── THE ONE ENTRY POINT ─────────────────────────────────────────────────────────────────────────

export type ClusterPart =
  /** The Green — everyone's, nobody's home. */
  | 'green'
  /** A keeper's own fold. */
  | 'quarter'
  /** Ground the folding made, joining a fold to the Green or to a neighbour. */
  | 'join'
  /** The cloud wall, wherever the cluster's ground meets the Ather. */
  | 'wall'
  /** Nothing. The Ather — past the wall, and wherever a slot is held open. */
  | 'ather'

export interface ClusterColumn {
  part: ClusterPart
  /** Whose fold, or which sub-square, or which lane's owner — `null` on open Ather. */
  quarter: QuarterId | null
  keeper: ClusterKeeper | null
  join: ClusterJoin | null
}

/**
 * Ground, without asking about walls. The honest answer to *"can a keeper stand here"*, and the
 * probe the wall test is built on — kept separate from `clusterAt` so it cannot recurse.
 *
 * ⛔ Resolution order is canon's. **The Green wins over everything**: it is reserved coast from the
 * moment of formation and each fold grows *toward* it, so a fold whose coast crosses the Green's
 * line does not take it. The no-decay collision is therefore impossible rather than merely avoided
 * — ground a keeper could build on never included the middle.
 */
export function isGround(x: number, z: number, cfg: ClusterConfig = DEFAULT_CLUSTER): boolean {
  if (inGreenSquare(x, z, cfg)) return inGreen(x, z, cfg)
  return foldAt(x, z, cfg) !== null || joinAt(x, z, cfg) !== null
}

/**
 * ── ★ ONE CLOUD WALL, BECAUSE A CLUSTER IS ONE FOLD ─────────────────────────────────────────────
 * The wall is not each fold's private ring any more; it is the outline of the whole cluster,
 * wherever its ground meets the Ather. That is both simpler and more canon-true, and it deletes a
 * question the grid version needed a special case for (*is this wall standing between two
 * keepers?*) — ground that continues is not an edge, so no wall is generated there in the first
 * place.
 *
 * ★ AND IT MAKES THE LANES READ RIGHT FOR FREE. The wall parts exactly where a spoke or a rim
 * leaves a fold, which is canon's own image of a way out of a pocket: *"gates and gaps breached
 * through the cloud-walls."* Nothing is carved; the gap is where the ground goes.
 *
 * ⚠ IT ALSO RINGS THE HOLES. The Ather between the lanes and the folds is inside the cluster's
 * outline and is still the Ather, so it is walled too — which is what stops a keeper walking off
 * the inside of their own cluster.
 */
function wallDistance(x: number, z: number, cfg: ClusterConfig): number {
  let best = Infinity
  // To a fold: the coast is a wobbled circle, so measure from the centre against that bearing's edge.
  for (const q of QUARTERS) {
    const k = cfg.slots[q]
    if (!k) continue
    const l = quarterLocal(x, z, q, cfg)
    const d = Math.hypot(l.x, l.z)
    best = Math.min(best, d - edgeAt(l.x, l.z, k.seed, plotForTier(k.tier, cfg.base)))
  }
  // To the Green: the nearest GIVEN sub-square, as an axis-aligned box.
  for (const q of QUARTERS) {
    if (!cfg.slots[q]) continue
    const s = QUARTER_SIGN[q]
    best = Math.min(best, boxDistance(x, z,
      Math.min(0, s.sx * cfg.green), Math.max(0, s.sx * cfg.green),
      Math.min(0, s.sz * cfg.green), Math.max(0, s.sz * cfg.green)))
  }
  // To a lane: rims are boxes; a spoke is a rotated strip, so measure it in its own frame.
  for (const [a, b] of RIM_PAIRS) {
    if (!cfg.slots[a] || !cfg.slots[b]) continue
    const sa = QUARTER_SIGN[a], sb = QUARTER_SIGN[b], w = cfg.joinHalfWidth
    best = sa.sx === sb.sx
      ? Math.min(best, boxDistance(x, z, sa.sx * cfg.offset - w, sa.sx * cfg.offset + w, -cfg.offset, cfg.offset))
      : Math.min(best, boxDistance(x, z, -cfg.offset, cfg.offset, sa.sz * cfg.offset - w, sa.sz * cfg.offset + w))
  }
  for (const q of QUARTERS) {
    if (!cfg.slots[q]) continue
    const s = QUARTER_SIGN[q]
    const along = (x * s.sx + z * s.sz) / SQRT2
    const perp = Math.abs(x * s.sz - z * s.sx) / SQRT2
    best = Math.min(best, boxDistance(along, perp,
      0, cfg.offset * SQRT2, -cfg.joinHalfWidth, cfg.joinHalfWidth))
  }
  return best
}

/** Distance from a point to an axis-aligned box; 0 inside it. */
function boxDistance(x: number, z: number, x0: number, x1: number, z0: number, z1: number): number {
  const dx = Math.max(x0 - x, 0, x - x1)
  const dz = Math.max(z0 - z, 0, z - z1)
  return Math.hypot(dx, dz)
}

export function clusterAt(x: number, z: number, cfg: ClusterConfig = DEFAULT_CLUSTER): ClusterColumn {
  if (inGreenSquare(x, z, cfg)) {
    const q = greenQuadrant(x, z)
    // ★ Whole from the moment the cluster exists — including the quadrants whose keepers have not
    // arrived. `quarter` still names whose sub-square this is, because the table set for an absent
    // friend has to be set SOMEWHERE, and that is the answer.
    if (isCluster(cfg)) return { part: 'green', quarter: q, keeper: cfg.slots[q], join: null }
    return { part: 'ather', quarter: q, keeper: null, join: null }
  }

  const fold = foldAt(x, z, cfg)
  if (fold) return { part: 'quarter', quarter: fold, keeper: cfg.slots[fold], join: null }

  const join = joinAt(x, z, cfg)
  if (join) return { part: 'join', quarter: join.between[0], keeper: null, join }

  // ⛔ AN OPEN SLOT IS THE ATHER — NO GROUND AT ALL, AND NEVER GREY. Canon's *"guard most likely to
  // ship wrong"*, and worth restating why the obvious build is the wrong one: the cheap way to show
  // an empty quarter is to generate its ground and drain the colour out of it, which every game
  // does for a locked area. Here that is a **visual lie** — grey is *the absence of resonance*, the
  // greyfield's own signature, so a drained quarter would say something DIED there. An unfilled
  // slot is the opposite: a place held open, absence rather than decay. Nothing is generated in it,
  // so there is nothing downstream to tint.
  const d = wallDistance(x, z, cfg)
  if (d > 0 && d <= cfg.base.wallWidth) return { part: 'wall', quarter: null, keeper: null, join: null }
  return { part: 'ather', quarter: null, keeper: null, join: null }
}

/** How far the cluster reaches from the middle — what a renderer or worker must be ready to draw. */
export function clusterReach(cfg: ClusterConfig = DEFAULT_CLUSTER): number {
  let reach = cfg.green
  for (const q of QUARTERS) {
    const plot = quarterPlot(q, cfg)
    if (!plot) continue
    reach = Math.max(reach, Math.hypot(cfg.offset, cfg.offset) + plot.capRadius + plot.wallWidth)
  }
  return reach
}

/**
 * ── ★★ A KEEPER MAY ALWAYS TAKE BACK THEIR OWN CORNER ───────────────────────────────────────────
 * Canon's humane asymmetry, and the only unmaking in the system: *"the world never unfolds a
 * cluster, but a keeper may always take back their own corner… Without this, 'holds' is a cage."*
 * It unmakes **exactly one thing**: nobody's plot changes, no ground is lost, the seam holds for
 * the rest, and the Green shrinks by that corner and no more.
 *
 * ⚠ Returns a new config and mutates nothing — the keeper's fold is not deleted by this, it stops
 * being part of the cluster, and their fold is a fold again.
 */
export const takeBackCorner = (cfg: ClusterConfig, q: QuarterId): ClusterConfig =>
  ({ ...cfg, slots: { ...cfg.slots, [q]: null } })

/**
 * ⛔ FILLING A SLOT TAKES EVERYONE ALREADY IN — *"you cannot give away someone else's corner."*
 * The consent FLOW is a UI question and is mine; that consent is unanimous is not.
 *
 * ★ AND NOTHING HERE ASKS FOR A RUNE OR A LEVEL. *"Joining needs no rune, no level, no craft — only
 * consent."* One keeper with Enchant folded the frame once, at formation; a later friend **signs**,
 * they do not fold. So a friend far behind can still be folded in — *more, never only*, read at the
 * door instead of at the reward.
 */
export function signIn(
  cfg: ClusterConfig, q: QuarterId, keeper: ClusterKeeper, consenting: readonly QuarterId[],
): ClusterConfig | null {
  if (cfg.slots[q]) return null
  const need = QUARTERS.filter(o => cfg.slots[o] !== null)
  if (!need.every(o => consenting.includes(o))) return null
  return { ...cfg, slots: { ...cfg.slots, [q]: keeper } }
}

/** The tightest lawful spacing — below it two keepers' folds can occupy the same column. */
export const MIN_OFFSET = (base: PlotConfig = DEFAULT_PLOT): number => MAX_TIER

/** The smallest Green a max fold can still reach, so the corners given are corners somebody had. */
export const MIN_GREEN = (cfg: ClusterConfig): number =>
  cfg.offset - (MAX_TIER * (1 - cfg.base.wobble)) / SQRT2
