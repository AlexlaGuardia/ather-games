// The plot's crossing court — where the keeper's ways OUT stand together.
//
// ★ PURE MATH. No three, no react, no DOM — same shape as `gate.ts` and `hollows.ts`: this file
// decides WHERE the court sits and WHICH cells belong to each socket's frame vs. its doorway.
// `VoxelWorld.tsx` is the only thing that calls setVoxel; nothing here touches a Column.
//
// ── ★★★ TWO KINDS STAND HERE AND CANON WILL NOT LET THEM BLUR ────────────────────────────────
// Alex, 2026-08-23: *"something more like the portals from Diablo — the runehold one is up from the
// start, then as the player unlocks gates for the ather they appear here, like a home plot gate
// station."* The shape is right and it is buildable, but the vocabulary in that sentence is not the
// world's, and the difference is load-bearing rather than pedantic:
//
//   · **The Rune Hold crossing IS a gate.** It crosses OUT of the Ather into the waking world, which
//     is the one thing canon lets the word mean (`world/gates.md`). It is the ONE home-gate, Greg
//     folds it *"because the keeper cannot"*, and it is GIVEN, never sold — which is exactly why it
//     stands here from the first minute and needs no unlock. Socket 0, always built.
//   · **Every Ather destination is a WAYMARK, and may never be called a gate.**
//     `game/shimmer-geography.md`, quoted verbatim in `voxel/waymark.ts`: *"Vocabulary the build may
//     now ship: waymark, passage, fold, threshold. Vocabulary it may NOT: a bought rune, or GATE for
//     anything that does not cross out of the waking world."*
//
// ⚠ THE DRIFT GATE CANNOT SEE THIS. `npm run canon` diffs names and rosters — ten checks, and it
// says so itself: it does not check prose, mechanics, or vocabulary. So a socket labelled "gate" in
// a panel would ship silently and become accidental canon. The split is kept in the TYPES here
// (`SocketKind`) so a mislabel is a type error rather than a matter of anyone remembering.
//
// ── ★★ WHY THIS IS NOT AT THE THRESHOLD, WHICH IS WHERE THE PICKER LIVES TODAY ────────────────
// `waymark.ts` already implements hub-and-spoke with the plot as hub, and the host asks the keeper
// to choose AT the fold-seam (`destination({ fromPlot: true })` → `at-plot-pick-one`). That put the
// choosing on the one spot in the world canon insists stays unbuilt:
//
//     `voxel3d/seam.ts`   — *"no gates" ⇒ NO FRAME, NO ARCH, NO LINTEL*
//     `voxel3d/VoxelWorld.tsx` — *"a build that puts a locked gate on a plot has misread the world"*
//     `voxel/plot.ts`     — *"no frame, no lintel, no door leaf and nothing drawn on the ground"*
//
// Moving the choosing into its own built place is therefore not a compromise with that rule, it is
// the rule finally getting what it asked for: the seam stays a soft gap you step through, and the
// architecture goes where architecture is allowed. ⚠ The fold-seam is NOT a socket here. It is
// two-way by Alex's 08-16 ruling and you LEAVE by walking through it; giving it a frame in the court
// would restate the seam as a door and re-break the rule from the other side.
//
// ── ★ THE PLACEMENT IS DERIVED, AND THE ONE THING IT ASSERTS IS THAT IT STANDS ON GROUND ──────
// `voxel3d/gate.ts` derived Moonwell Glade's arch as 300 blocks from the glade toward origin. That
// was correct on 2026-08-08 and expired on 08-15, when the fold was carved at origin with radius
// 500: the arch now stands at r=358, ~145 blocks INSIDE the shell, and `bubbleMaterialAt` claims
// **20 of 20 of its cells as fold-interior air on seeds 1/7/42/555**. Nothing caught it, because
// `bubbleSwallows` only checks `ZONE_ANCHORS` and an arch is in no landmark registry.
//
// ★ SO THE LESSON IS NOT "PIN THE COORDINATE" — a pinned coordinate is the failure `/goto garden`
// already shipped once. It is that a derived placement must be asserted against the generator that
// actually OWNS its ground, every seed, or the derivation quietly outlives its reason. `courtFits`
// below is that assert, and `crossings.test.ts` runs it across seeds.

import {
  plotThreshold, plotHeight, insideCore, edgeAt, caveAt, plotForTier, PLOT_TIERS,
  DEFAULT_PLOT, type PlotConfig,
} from '../voxel/plot'
import { PLOT_TRIGGER_RADIUS } from './seam'
import { MAX_MARKS } from '../voxel/waymark'

/**
 * What a socket crosses. The two are different in KIND, not in degree — see the header.
 *
 * `gate` is deliberately singular in practice: canon rules exactly one home-gate per garden.
 */
export type SocketKind = 'gate' | 'waymark'

/**
 * How far around the coast the court sits from the fold-seam, **in blocks of arc**.
 *
 * ★ NEAR IT, NOT ON IT, AND BOTH HALVES ARE THE POINT. The seam is where the keeper already walks
 * to leave, so putting the court across the island would give the plot two unrelated exits and a
 * walk between them. Offsetting it along the coast keeps one "door end" of the garden while leaving
 * the seam itself bare. 60 blocks is far enough to read as its own building, near enough to share
 * the walk.
 *
 * ⚠⚠ THIS WAS A FIXED ANGLE (0.22rad) AND THAT WAS THE SAME BUG `plotThreshold` ALREADY FIXED,
 * WEARING POLAR COORDINATES. Its comment, one directory over: *"INSET IS IN BLOCKS NOW, NOT A
 * FRACTION OF THE RADIUS. As a fraction it silently walked the door further from the wall every
 * time the fold grew."* An ANGLE is a fraction of the circumference, so a constant angle is a
 * growing distance: measured across the three tiers, the court sat 61 · 80 · 100 blocks from the
 * seam while claiming to be one fixed separation. Nothing looked wrong at any single tier, which is
 * why it wanted measuring across all three rather than reading.
 *
 * ★ AN ARC LENGTH DIVIDED BY THE RADIUS IS THE ANGLE THAT KEEPS THE DISTANCE. Same rule, same
 * reason, one file apart — and the file that already held the answer is the one this module derives
 * its own position from.
 *
 * ⚠ ALEX'S DIAL. Placement in the fold is his call; this is derived so it follows the threshold if
 * the threshold ever moves, and it is one constant so he can slide it without touching geometry.
 */
export const COURT_ARC: number = 60

/** How far inside the coast the court's centre stands, in blocks. Clear of the wall, not inland. */
export const COURT_INSET: number = 16

/** Gap between adjacent socket centres, in blocks. 8 leaves 3 clear blocks between 5-wide frames. */
export const SOCKET_PITCH: number = 8

/** Sockets: one gate (Rune Hold, always up) plus one per waymark the keeper may hold. */
export const SOCKET_KINDS: SocketKind[] =
  ['gate', ...Array.from({ length: MAX_MARKS }, () => 'waymark' as const)]

export interface CourtAnchor {
  /** Centre column of the court's row of sockets. */
  x: number; z: number
  /** Ground altitude there — the row's base. `null` where the plot has no ground (see `courtFits`). */
  y: number | null
  /** Bearing from the plot's centre out to the court. Sockets face back along it. */
  bearing: number
}

/**
 * Where the court stands, derived from the plot's own geometry.
 *
 * ★ DERIVED FROM `edgeAt`, NOT FROM `capRadius`. The fold GROWS (Greg reads the grimoire and widens
 * it), and `plot.ts` records that growth re-rolls anything keyed to a fraction of the radius. Taking
 * the coast at this bearing and stepping a fixed number of BLOCKS inside it is the same rule
 * `plotThreshold` settled on for the same reason — the court stays its own distance from the wall
 * instead of drifting inland every time the keeper earns more ground.
 */
export function courtAnchor(seed: number, cfg: PlotConfig = DEFAULT_PLOT): CourtAnchor {
  // The coast at the SEAM's bearing is what the arc is measured on: using the court's own bearing
  // would need the answer to compute the question.
  // ⚠ A CLARITY CHOICE, NOT A MECHANISM, AND IT SAYS SO BECAUSE A MUTATION PROVED IT. Swinging this
  // sample a full radian away left every assert green — `edgeAt` varies only by `wobble` with
  // bearing, so the two radii agree to within a couple of blocks and nothing downstream can feel the
  // difference. Claiming it as the reason the arc holds would be a comment asserting a mechanism no
  // test can reach, which this repo has had to delete before.
  const seamR = Math.max(1, edgeAt(Math.cos(cfg.thresholdBearing), Math.sin(cfg.thresholdBearing), seed, cfg))
  const bearing = cfg.thresholdBearing + COURT_ARC / seamR
  const cb = Math.cos(bearing), sb = Math.sin(bearing)
  const r = Math.max(1, edgeAt(cb, sb, seed, cfg) - COURT_INSET)
  const x = Math.round(cb * r)
  const z = Math.round(sb * r)
  return { x, z, y: plotHeight(x, z, seed, cfg), bearing }
}

export interface SocketCell {
  x: number; y: number; z: number
  /** True for the 3×3 interior — the crossing itself. False for the jambs and lintel. */
  doorway: boolean
}

export interface Socket {
  index: number
  kind: SocketKind
  /** Centre column of this socket's frame. */
  x: number; z: number
}

/**
 * The row of sockets, laid along the coast tangent so every frame faces the same way — back down
 * the bearing, toward the garden. Centred on the anchor, so adding a socket grows the row from the
 * middle rather than walking the whole court sideways.
 */
export function sockets(seed: number, cfg: PlotConfig = DEFAULT_PLOT): Socket[] {
  const a = courtAnchor(seed, cfg)
  // Tangent to the bearing: the row runs across the direction the keeper faces, not along it.
  const tx = -Math.sin(a.bearing), tz = Math.cos(a.bearing)
  const mid = (SOCKET_KINDS.length - 1) / 2
  return SOCKET_KINDS.map((kind, index) => {
    const off = (index - mid) * SOCKET_PITCH
    return { index, kind, x: Math.round(a.x + tx * off), z: Math.round(a.z + tz * off) }
  })
}

/** Half-width of a socket frame, in blocks (5 wide ⇒ jamb, 3 doorway, jamb). */
const SOCKET_HALF = 2
/** Frame height, in blocks (3 of doorway plus a lintel course). */
const SOCKET_HEIGHT = 4

/**
 * Every cell one socket occupies: a 5-wide × 4-high frame one block thick, with a 3×3 doorway.
 *
 * Same proportions as the Moonwell Glade arch on purpose — a crossing should read as the same kind
 * of built thing wherever the keeper meets one. `baseY` is the ground at that socket's own column,
 * asked per socket rather than shared, so a row crossing a roll in the ground still sits on it.
 */
export function socketCells(s: Socket, baseY: number, bearing: number): SocketCell[] {
  const tx = -Math.sin(bearing), tz = Math.cos(bearing)
  const cells: SocketCell[] = []
  for (let h = -SOCKET_HALF; h <= SOCKET_HALF; h++) {
    for (let y = 0; y < SOCKET_HEIGHT; y++) {
      cells.push({
        x: Math.round(s.x + tx * h),
        y: baseY + y,
        z: Math.round(s.z + tz * h),
        doorway: h >= -1 && h <= 1 && y <= 2,
      })
    }
  }
  return cells
}

/** Why the court could not stand where it was derived. Every one is a placement bug, not a refusal. */
export type CourtMisfit =
  | 'no-ground'          // the anchor column has no plot ground at all — the Glade arch's failure
  | 'socket-off-island'  // a socket in the row fell outside the island's edge
  | 'socket-no-ground'   // a socket's own column has no ground under it
  | 'fouls-seam'         // a socket sits inside the fold-seam's crossing trigger
  | 'fouls-cave'         // a socket sits in the threshold mound's cloud or its bore

/**
 * Does the derived court actually stand on this seed's plot?
 *
 * ★ THIS IS THE GUARD `gate.ts` NEVER HAD, and it is written to fail in the direction that gets
 * noticed. Each misfit names WHICH socket and WHY rather than returning a boolean — a bare false
 * here would be a red count with no cause, and this repo has already recorded that the tempting fix
 * for a red count is to make the count go away.
 */
export function courtFits(
  seed: number, cfg: PlotConfig = DEFAULT_PLOT,
): { ok: true } | { ok: false; why: CourtMisfit; socket?: number } {
  const a = courtAnchor(seed, cfg)
  if (a.y === null) return { ok: false, why: 'no-ground' }
  const t = plotThreshold(seed, cfg)
  for (const s of sockets(seed, cfg)) {
    if (!insideCore(s.x, s.z, seed, cfg)) return { ok: false, why: 'socket-off-island', socket: s.index }
    const h = plotHeight(s.x, s.z, seed, cfg)
    if (h === null) return { ok: false, why: 'socket-no-ground', socket: s.index }
    // Clear of the crossing trigger, or stepping between sockets would fire the fold-seam.
    // +SOCKET_HALF because the FRAME's edge is what has to clear it, not its centre column.
    if (Math.hypot(s.x - t.x, s.z - t.z) <= PLOT_TRIGGER_RADIUS + SOCKET_HALF)
      return { ok: false, why: 'fouls-seam', socket: s.index }
    // Clear of the threshold mound: cloud there would swallow the frame exactly as the fold
    // swallowed the Glade arch, and the bore would cut a hole through it.
    for (const c of socketCells(s, h, a.bearing))
      if (caveAt(c.x, c.y, c.z, seed, cfg) !== null)
        return { ok: false, why: 'fouls-cave', socket: s.index }
  }
  return { ok: true }
}


/**
 * Where courts raised at SMALLER folds are still standing.
 *
 * ★★ THE COURT MOVES WHEN GREG WIDENS THE FOLD, AND PLACED VOXELS DO NOT MOVE WITH IT. That is the
 * whole reason this exists. `plotThreshold` may be re-derived freely because it is a fact about
 * TERRAIN — nothing is left behind when it slides. The court is *built*: cut stone the host has
 * already put in the world. Derive it at tier 2 without clearing tier 1 and the keeper owns two
 * abandoned stone courts, ~88 blocks apart (measured across the shipped tiers).
 *
 * ★ NO NEW SAVE FIELD, ON PURPOSE. The tier is already in the save, and every lower tier's anchor
 * is a pure function of it — so the host clears tiers `0..current-1` and builds at `current`, which
 * is idempotent and self-healing for a save written by an older session that never cleared at all.
 * Storing "where I last built it" would be a second copy of a derivable fact, and this repo has
 * paid for that shape more than once.
 */
export function staleCourts(
  seed: number, tier: number, base: PlotConfig = DEFAULT_PLOT,
): CourtAnchor[] {
  const t = Math.max(0, Math.min(PLOT_TIERS.length - 1, Math.round(tier || 0)))
  const here = courtAnchor(seed, plotForTier(t, base))
  const out: CourtAnchor[] = []
  for (let i = 0; i < t; i++) {
    const a = courtAnchor(seed, plotForTier(i, base))
    // A lower tier whose court lands on the same column as the current one needs no clearing, and
    // clearing it would delete the court that is supposed to be standing there.
    //
    // ⚠ UNREACHABLE AT THE SHIPPED NUMBERS, AND IT SAYS SO. The tiers step 100 blocks apart, so two
    // courts never share a column and a mutation removing this line leaves the suite green. It is
    // kept because it is the correct rule and the tier ladder is a table someone may edit — but a
    // guard that cannot currently fail must admit it rather than pose as tested coverage.
    // (It also makes the `t` clamp above redundant, and the clamp makes it redundant: neither is
    // provable while the other stands. Both are kept deliberately; neither is load-bearing today.)
    if (a.x === here.x && a.z === here.z) continue
    out.push(a)
  }
  return out
}
