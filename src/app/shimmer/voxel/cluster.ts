// A GARDEN CLUSTER — four keepers' folds folded into one place, and THE GREEN at their seam.
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
// and four standing permanent invitations is a door with a lock three other people hold. *"No
// gates, no locks, no keep-out"* would be gone.
//
// **So a cluster is the plot space with four quarters in it.** There is no second `Space` id, no
// second door for `VoxelWorld` to police, no presence check and no absent keeper being borrowed
// from. A guest is HELD OPEN; a cluster-mate is FOLDED IN, and never left. That is also what makes
// the shared save lawful without inventing a permission system for it.
//
// ── THE SHAPE ────────────────────────────────────────────────────────────────────────────────────
// Alex's design: *"a cap of four, in a square formation where the edges of a max size homeplot
// meet, where each overlap with a communal plot that will overlap all four, that appears in the
// center of them all when the cluster is formed."*
//
//        z+  ┌────────────┬────────────┐      · the cluster origin (0,0) is THE SHARED CORNER
//            │            │            │      · each quarter is a CELL of a 2×2 grid
//            │     nw     │     ne     │      · a keeper's ground is their own plot disc,
//            │      ·     │     ·      │        centred at (±offset, ±offset), CLIPPED to its cell
//            │            │ ▒▒▒│       │      · ▒ = THE GREEN, a square on the shared corner,
//            ├─────────▒▒▒┼▒▒▒▒┼───────┤        one sub-square GIVEN by each quarter
//            │         ▒▒▒│▒▒▒▒        │
//            │      ·     │     ·      │
//            │     sw     │     se     │
//            │            │            │
//        z-  └────────────┴────────────┘
//               x-                  x+
//
// Three properties fall out of the grid and all three are canon requirements, which is the reason
// to build it this way rather than as four overlapping discs:
//   · **quarters cannot overlap** — a column is in exactly one cell, so ownership is total and
//     exclusive, and *"the border between quarters stays real"* is arithmetic rather than etiquette;
//   · **the Green is at the one corner all four share**, which is the only point in a 2×2 grid that
//     every cell touches — *"four squares meet at one corner"*, canon's own words for why the cap
//     is four. The cap is the shape's consequence, not a number somebody picked;
//   · **each fold grows TOWARD the Green and cannot grow through it**, because the clip is the
//     cell minus the Green and growth only raises `capRadius`. Canon's no-decay collision
//     (*ground is never taken; a keeper's built interior is inviolate*) is therefore impossible to
//     violate here rather than merely avoided — the Green is reserved coast from formation.
//
// ⚠ THE QUARTER'S INNER EDGES ARE STRAIGHT AND THAT IS NOT A DEGRADED CIRCLE. A fold on its own is
// a disc ringed in cloud because it is bounded by the Ather. Two sides of a quarter are bounded by
// a NEIGHBOUR instead, and ground meeting ground is a straight seam, not a coast. `plot.ts`'s
// `edgeAt` wobble still draws the two OUTER sides, so a quarter reads as a keeper's own island with
// a corner of it given away — which is exactly what it is.
//
// ── ★ WHAT THIS FILE DELIBERATELY HAS NO WORD FOR ───────────────────────────────────────────────
// ⛔ **There is no folder, owner, leader, founder or head in this model, and the absence is the
// guard.** Canon, on the keeper who folds the cluster: *"THERE IS NO TITLE, and the absence is
// deliberate… a name for the role is the thing that would invite the ownership every guard above
// forbids, so the cheapest defence is not to mint one."* One keeper with Enchant folds for the
// group; they gain nothing, they can remove nobody, and the cluster does not depend on them
// staying. A field called `folder` on this config would be the first step to all three, so there
// isn't one — and `cluster.test.ts` fails if anybody adds one. Who folded it is a fact about the
// past, the way you remember who raised the barn; it belongs in the save's history, not in the
// geometry.
//
// ⛔ **And there is no presence, online flag or last-seen anywhere.** *Folded once, it holds.* A
// keeper who goes quiet leaves a quarter that sits exactly as it was; nothing greys, nothing
// vanishes, the Green never closes. The geometry is a function of the SLOTS and nothing else, so
// the world has no mechanism with which to un-make somebody's ground. Leaving is a choice somebody
// makes, not something the world does.

import {
  DEFAULT_PLOT, PLOT_TIERS, edgeAt, plotForTier,
  type PlotConfig,
} from './plot'

/** The four cells of the grid, named for the compass corner each one occupies. */
export type QuarterId = 'ne' | 'nw' | 'sw' | 'se'

export const QUARTERS: readonly QuarterId[] = ['ne', 'nw', 'sw', 'se'] as const

/**
 * The sign of each cell on each axis. `x >= 0` is east and `z >= 0` is north, so the axes
 * themselves belong to the north/east cells — an arbitrary but TOTAL tie-break, which is what
 * matters: every integer column has exactly one owner and there is no seam of unowned blocks
 * running through the middle of the cluster.
 */
export const QUARTER_SIGN: Record<QuarterId, { sx: 1 | -1; sz: 1 | -1 }> = {
  ne: { sx: 1, sz: 1 },
  nw: { sx: -1, sz: 1 },
  sw: { sx: -1, sz: -1 },
  se: { sx: 1, sz: -1 },
}

/**
 * A keeper in a slot. Their seed and tier, and nothing else.
 *
 * ★ THE SEED IS PER KEEPER, not per cluster, and that is the point of it: a quarter is the
 * keeper's OWN fold, with their own coast, and it must not be re-rolled by the act of joining.
 * ⚠ The `tier` is read through `plotForTier`, which clamps — it arrives from a save.
 */
export interface ClusterKeeper {
  seed: number
  tier: number
}

/**
 * ⛔ FOUR SLOTS, AND A SLOT IS EITHER A KEEPER OR `null`. `null` is **no ground at all** — see
 * `clusterAt`. It is never a keeper with a flag on them, because the moment an empty quarter is a
 * keeper-shaped thing in the data it becomes a keeper-shaped thing on the screen.
 */
export type ClusterSlots = Record<QuarterId, ClusterKeeper | null>

export interface ClusterConfig {
  /**
   * How far each quarter's plot centre sits from the shared corner, on each axis. The centre of
   * the `ne` quarter is at `(offset, offset)`.
   *
   * ★ IT IS FIXED AND IT IS WHAT MAKES "THE MIDDLE FILLS IN" TRUE. A plot grows by raising
   * `capRadius` around a centre that never moves, so a quarter at tier 0 stops well short of the
   * Green and a quarter at tier 2 reaches it. Canon: *"a cluster does NOT need four max-size plots.
   * It can form early and the middle fills in as the four grow."* If this were derived from the
   * members' current tiers, the ground would move under people as they levelled, which the
   * no-decay law forbids outright.
   */
  offset: number
  /** The Green's HALF-side, in blocks. The full square is `2 × green` across. */
  green: number
  slots: ClusterSlots
  /** The plot config every quarter is cut from; each keeper's tier is applied on top. */
  base: PlotConfig
}

export const NO_SLOTS: ClusterSlots = { ne: null, nw: null, sw: null, se: null }

/**
 * ── THE NUMBERS, AND THEY ARE MINE TO DIAL ──────────────────────────────────────────────────────
 * Canon's boundary is explicit: *"Every dimension and block count, the reserved square's size…
 * Jin's."* These are first numbers chosen to make the growth story legible, and the arithmetic is
 * written out so the next person can move them with their eyes open.
 *
 * `offset` 260 · `green` 120, against `PLOT_TIERS` [300, 400, 500] and a wobble that cuts in up to
 * 18% (so a tier-2 coast is 410 blocks at its shyest bearing):
 *   · the Green's near edge, straight in from a quarter centre, is at (260−120)·√2 ≈ 198 blocks —
 *     **inside even a tier-0 fold**, so a cluster formed on day one has its Green touching all of
 *     its quarters and is walkable immediately;
 *   · the Green's OUTER corners — (green, 0) and (0, green), where the Green meets the border with
 *     the next quarter along — are √(140² + 260²) ≈ 295 from the centre, so a **tier-0** fold
 *     (246 at its shyest) does not quite hold them and a **tier-1** one (328) does. That gap is the
 *     thing to look at: it is the middle visibly filling in as two friends grow, and if it reads as
 *     a hole rather than as a coast, lower `offset` before touching anything else.
 * ⚠ `offset` is bounded above by the tier-2 reach: at `offset` > 290 a MAX fold no longer reaches
 * the shared corner and the Green could never be met at all. `cluster.test.ts` asserts that bound
 * so the number cannot be nudged into a cluster that never closes.
 */
export const DEFAULT_CLUSTER: ClusterConfig = {
  offset: 260,
  green: 120,
  slots: NO_SLOTS,
  base: DEFAULT_PLOT,
}

/** The cell a column falls in. Total: every column belongs to exactly one quarter. */
export const quarterFor = (x: number, z: number): QuarterId =>
  x >= 0 ? (z >= 0 ? 'ne' : 'se') : (z >= 0 ? 'nw' : 'sw')

/** How many corners have been given. The Green is exactly this many quarter-squares. */
export const cornersGiven = (cfg: ClusterConfig): number =>
  QUARTERS.reduce((n, q) => n + (cfg.slots[q] ? 1 : 0), 0)

/**
 * ⛔ A CLUSTER STARTS AT TWO. Four is the FRAME, never the entry condition (canon, amendment 2).
 * One keeper alone is a plot, which is the thing the cozy line is founded on and must never be
 * made to feel like a deficient cluster.
 */
export const isCluster = (cfg: ClusterConfig): boolean => cornersGiven(cfg) >= 2

/** A column's position in its quarter's own plot space — the origin `plot.ts` expects. */
export function quarterLocal(x: number, z: number, q: QuarterId, cfg: ClusterConfig): { x: number; z: number } {
  const s = QUARTER_SIGN[q]
  return { x: x - s.sx * cfg.offset, z: z - s.sz * cfg.offset }
}

/** That quarter's plot config at its keeper's tier, or `null` if the slot is open. */
export function quarterPlot(q: QuarterId, cfg: ClusterConfig): PlotConfig | null {
  const k = cfg.slots[q]
  return k ? plotForTier(k.tier, cfg.base) : null
}

/** Is this column inside the Green's SQUARE — ignoring whether the corner was given? */
export const inGreenSquare = (x: number, z: number, cfg: ClusterConfig): boolean =>
  Math.abs(x) < cfg.green && Math.abs(z) < cfg.green

/**
 * ── ★★ THE GREEN IS AS BIG AS THE FRIENDSHIP ────────────────────────────────────────────────────
 * Canon, and it is the best thing in the amendment: *"Each fold gives one corner. Two keepers make
 * half a Green; a fourth joining completes it. Nothing needs explaining — a player reads how many
 * friends a cluster has by looking at the middle."*
 *
 * So the Green is not a square that appears whole. It is **four given sub-squares**, and a
 * sub-square is there when its keeper is. That makes the middle a standing count of who has
 * arrived, drawn in ground, with no UI to read.
 *
 * ⚠ AND IT IS WHY THIS TAKES THE SLOT, NOT A SIZE. A Green stored as one number that grows would
 * be four corners' worth of ground centred on the corner — a square that swells — and a keeper
 * taking their corner back would shrink it evenly on all four sides, taking a bite out of ground
 * three other people gave. Given corners come back one corner at a time.
 */
export const inGreen = (x: number, z: number, cfg: ClusterConfig): boolean =>
  inGreenSquare(x, z, cfg) && cfg.slots[quarterFor(x, z)] !== null

/** What a column of the cluster is. */
export type ClusterPart =
  /** The Green — everyone's, nobody's home. */
  | 'green'
  /** A keeper's own ground, inside their fold's coast. */
  | 'quarter'
  /** The cloud wall ringing a quarter's OUTER coast. */
  | 'wall'
  /** Nothing. The Ather. Past a coast, or a slot nobody has filled. */
  | 'ather'

export interface ClusterColumn {
  part: ClusterPart
  /** Whose cell this column is in — always answered, even when the slot is open. */
  quarter: QuarterId
  /** The keeper of that cell, or `null` for an open slot. */
  keeper: ClusterKeeper | null
  /** Position in that quarter's own plot space. Meaningless for `green`; given anyway, it is cheap. */
  local: { x: number; z: number }
}

/**
 * ── THE ONE ENTRY POINT ─────────────────────────────────────────────────────────────────────────
 * What is at (x, z)? Resolved in the order the canon guards demand:
 *
 * 1. **The Green wins over everything**, because it is reserved coast from the moment of formation
 *    and each fold grows *toward* it. A quarter's disc may reach across the Green's line as its
 *    tier rises; the Green is what is there. That is the whole no-decay fix expressed as one
 *    early return — the Green can never be carved out of ground a keeper built on, because ground
 *    a keeper could build on never included it.
 *
 * 2. ⛔ **AN OPEN SLOT IS `ather` — NO GROUND AT ALL, AND NEVER GREY.** This is canon's *"guard most
 *    likely to ship wrong"*, and it is worth stating why the obvious build is the wrong one. The
 *    cheap way to show an empty quarter is to generate its ground and drain the colour out of it,
 *    which every game does for a locked area. Here that is a **visual lie**: grey is *the absence
 *    of resonance*, the greyfield's own signature, and a drained quarter would tell the player
 *    something DIED there. An unfilled slot is the opposite — a place held open, absence rather
 *    than decay — so nothing is generated in it at all and the Ather shows through. ⚠ Any renderer
 *    downstream inherits this: do not tint it, do not grey it, do not ruin it.
 *
 * 3. Otherwise the keeper's own fold decides, through `plot.ts`'s coast — `edgeAt` with the column
 *    in that quarter's local space, so each keeper's island wobbles on their own seed.
 */
export function clusterAt(x: number, z: number, cfg: ClusterConfig = DEFAULT_CLUSTER): ClusterColumn {
  const quarter = quarterFor(x, z)
  const keeper = cfg.slots[quarter]
  const local = quarterLocal(x, z, quarter, cfg)

  if (inGreen(x, z, cfg)) return { part: 'green', quarter, keeper, local }
  // Inside the Green's square with the corner ungiven: still nothing, and NOT the owning quarter's
  // ground either — a corner that was never given is not a corner somebody may build on.
  if (inGreenSquare(x, z, cfg)) return { part: 'ather', quarter, keeper, local }

  if (!keeper) return { part: 'ather', quarter, keeper, local }

  const plot = plotForTier(keeper.tier, cfg.base)
  const d = Math.hypot(local.x, local.z)
  const edge = edgeAt(local.x, local.z, keeper.seed, plot)
  if (d <= edge) return { part: 'quarter', quarter, keeper, local }

  // ── ★ THE WALL RINGS THE OUTER COAST ONLY ─────────────────────────────────────────────────────
  // A fold is walled where it meets the Ather. Two of a quarter's sides meet a NEIGHBOUR instead,
  // and canon is unambiguous that a cluster is one place: a cloud wall standing on the border
  // between two quarters would be *"a door with a lock"* built out of weather. So the ring is cut
  // where the column lies outside its own cell — which is exactly the two inner sides.
  //
  // ⚠ AND THE BORDER WITH AN **OPEN** SLOT GETS NO WALL EITHER, ON PURPOSE. It is a place held
  // open, and a wall is what a held-open place must not read as. The keeper sees the Ather where
  // their friend's ground will be. Falling out of it is `plot.ts`'s existing problem and answer
  // (`hasFallenOut`), not a reason to close the frame. ⚖ If it reads as a cliff rather than as an
  // invitation, the fix is a low sill in the wall's own cloud — never a full-height wall.
  if (inWallRing(local, d, edge, quarter, plot, cfg)) return { part: 'wall', quarter, keeper, local }

  return { part: 'ather', quarter, keeper, local }
}

/**
 * Is this column standing in a quarter's cloud wall?
 *
 * ── ★★ A WALL STANDS WHERE THE FOLD MEETS THE ATHER, AND NOWHERE ELSE ───────────────────────────
 * A fold on its own is ringed in cloud because every bearing off it is the void. A quarter is not
 * on its own, so the ring has to be cut in two places — and the first cut this file shipped was
 * **dead code**: it asked whether the column had crossed into the neighbour's cell, which
 * `clusterAt` has already made impossible by resolving the owning cell first. The suite was green
 * and the cut had never once fired. What it was missing:
 *
 * 1. ⛔ **NO WALL BETWEEN A KEEPER AND THE GREEN.** A fold below max tier does not reach the
 *    shared corner yet, so it has a coast facing INWARD — and the naive ring put a cloud wall
 *    along it, hugging the Green. That is the opposite of what canon asks the middle to say: the
 *    gap is *ground that has not grown yet*, the thing a player is supposed to watch fill in, and
 *    a wall would hide it behind weather and read as a keep-out besides. So bearings that point
 *    back at the shared corner are never walled.
 * 2. ⛔ **NO WALL BETWEEN TWO KEEPERS' GROUND.** Where a quarter's coast meets a neighbour's, the
 *    ground continues and a cluster is one place; cloud there would be *"a door with a lock"*
 *    built out of weather. So a ring column is dropped when the ground picks up again just past it.
 *
 * What is left is the cluster's outside, which is the only edge that faces the Ather.
 */
function inWallRing(
  local: { x: number; z: number }, d: number, edge: number,
  q: QuarterId, plot: PlotConfig, cfg: ClusterConfig,
): boolean {
  if (d <= edge || d > edge + plot.wallWidth) return false
  const s = QUARTER_SIGN[q]
  // (1) Both components pointing back toward the shared corner = a bearing facing the middle.
  if (local.x * s.sx < 0 && local.z * s.sz < 0) return false
  // (2) Step past the ring on the same bearing. If somebody's ground is there, the fold has not
  // ended — it has met a neighbour.
  const t = (edge + plot.wallWidth + 1) / d
  const px = s.sx * cfg.offset + local.x * t, pz = s.sz * cfg.offset + local.z * t
  return !isGround(px, pz, cfg)
}

/**
 * Ground, without asking about walls — the probe `inWallRing` needs, and the honest answer to
 * *"can a keeper stand here"*. Kept separate from `clusterAt` so the probe cannot recurse.
 */
export function isGround(x: number, z: number, cfg: ClusterConfig = DEFAULT_CLUSTER): boolean {
  if (inGreenSquare(x, z, cfg)) return inGreen(x, z, cfg)
  const q = quarterFor(x, z)
  const keeper = cfg.slots[q]
  if (!keeper) return false
  const plot = plotForTier(keeper.tier, cfg.base)
  const l = quarterLocal(x, z, q, cfg)
  return Math.hypot(l.x, l.z) <= edgeAt(l.x, l.z, keeper.seed, plot)
}

/**
 * The cluster's full extent from the shared corner, in blocks — what a renderer or a worker has to
 * be ready to draw. Derived from the widest slot, never from the tier cap, so an early cluster is
 * cheap and a maxed one is honest.
 */
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
 * Canon's humane asymmetry, and the only unmaking in the whole system: *"the world never unfolds a
 * cluster, but a keeper may always take back their own corner… Without this, 'holds' is a cage."*
 *
 * It is the unmaking of **exactly one thing**. Nobody's plot changes, no ground is lost, the seam
 * holds for the rest, and the Green shrinks by that corner and no more — which is guaranteed here
 * by the Green being made of given sub-squares rather than of a size.
 *
 * ⚠ IT RETURNS A NEW CONFIG AND MUTATES NOTHING, because the caller usually still needs the old
 * one: the keeper's quarter is not deleted by this, it stops being part of the cluster, and their
 * fold is a fold again.
 */
export const takeBackCorner = (cfg: ClusterConfig, q: QuarterId): ClusterConfig =>
  ({ ...cfg, slots: { ...cfg.slots, [q]: null } })

/**
 * ⛔ FILLING A SLOT TAKES EVERYONE ALREADY IN — *"you cannot give away someone else's corner"*
 * (canon, amendment 4). So this takes the consenting quarters and refuses unless every keeper
 * already in the cluster is among them. The consent FLOW is a UI question and is mine; that
 * consent is unanimous is not.
 *
 * ★ AND NOTHING HERE ASKS FOR A RUNE OR A LEVEL. *"Joining needs no rune, no level, no craft —
 * only consent."* One keeper with Enchant folded the frame, once, at formation; a later friend
 * signs, they do not fold. Joining a made frame is signing, not folding — so a friend far behind
 * can still be folded in, which is *more, never only* read at the door instead of at the reward.
 */
export function signIn(
  cfg: ClusterConfig, q: QuarterId, keeper: ClusterKeeper, consenting: readonly QuarterId[],
): ClusterConfig | null {
  if (cfg.slots[q]) return null
  const need = QUARTERS.filter(o => cfg.slots[o] !== null)
  if (!need.every(o => consenting.includes(o))) return null
  return { ...cfg, slots: { ...cfg.slots, [q]: keeper } }
}

/** The tier at which a fold can reach the shared corner at all — the bound `offset` lives under. */
export const MAX_OFFSET_FOR_REACH = (base: PlotConfig = DEFAULT_PLOT): number =>
  (PLOT_TIERS[PLOT_TIERS.length - 1] * (1 - base.wobble)) / Math.SQRT2
