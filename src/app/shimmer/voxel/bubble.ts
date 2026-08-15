// The garden's BUBBLE, seen from outside — what a folded plot looks like standing in the Wilds.
//
// ★ PURE CORE. No react/three/DOM, no host imports.
//
// ── ★ THE SAME OBJECT FROM THE OTHER SIDE ────────────────────────────────────────────────────────
// `plot.ts` builds the island a keeper stands ON. This builds the wall of cloud a keeper stands
// OUTSIDE OF. Canon (`spirit-tales-bible.md`, ruled 2026-06-02): a plot is *"walled in cloud"*, and
// the wall is *"the cloud-ocean itself, held back and pressed soft and glowing."* Alex, 2026-08-15:
// *"a garden forms a bubble in the wilds when created."* So the Wilds does not simply lack the
// garden — it has the garden's OUTSIDE in it, and that outside is a landmark you can see coming.
//
// ── ★ WHY A SHELL AND NOT A BODY, WHICH IS A CORRECTNESS POINT BEFORE IT IS A PERF ONE ──────────
// At the asked-for radius of 1000, a solid bubble is ~4.2 BILLION voxels and its interior is
// 3.1 million columns of ground no player can ever reach — the fold is in there, and a keeper
// standing in the Wilds is by definition not inside it. Generating any of that would be work spent
// on a place that cannot be visited, and `insideShell` exists so the host can skip streaming it
// entirely. Only the skin is real. That also happens to make the asked-for radius free.
//
// ⚠ CONSEQUENCE THE HOST MUST HONOUR: the interior is NOT "empty space you may enter". It is
// unreachable by construction, and the shell is what keeps it that way. A hole in the shell is a
// walk into 1000 blocks of ungenerated nothing — see `bubble.test.ts`, which floods it.

import { fbm2 } from './noise'
import { AIR } from './section'

export interface BubbleMaterials {
  /** The wall — pressed cloud, SOFT. Same material as the plot's rim; the same wall, outside face. */
  wall: number
}

export interface BubbleConfig {
  /** Centre of the bubble in Wilds coordinates. */
  cx: number
  cz: number
  /** Radius of the shell, in blocks. */
  radius: number
  /**
   * Shell thickness. ⚠ Load-bearing at 3 rather than 1: a one-voxel skin on a sphere of this size
   * rasterises with diagonal seams a player can squeeze through, and `bubble.test.ts` floods
   * 8-connected specifically to refuse that. See the same lesson in `plot.ts`'s wall.
   */
  thickness: number
  /** Altitude the shell rises to, and sinks to. The Wilds' ground sits between them. */
  topY: number
  bottomY: number
  /** How much the wall's outline wanders, as a fraction of radius. Purely a look. */
  wobble: number
  /**
   * ★ THE PASSAGE'S BEARING, IN RADIANS, AND IT IS A PARAMETER BECAUSE IT IS THE PLAYER'S FRONT DOOR.
   * A single opening in a 6.3km circumference is undiscoverable by exploration, so the build must
   * put the player's arrival AT it rather than hoping they find it. Nothing here picks that spot.
   */
  passageBearing: number
  /** Half-width of the passage opening, in blocks, measured along the shell. */
  passageWidth: number
  /** How tall the opening is above the Wilds' ground at that point. */
  passageHeight: number
  materials: BubbleMaterials
}

/**
 * ⚠ EVERY NUMBER IS A FIRST GUESS AND MINE (build tuning, per the 08-13 boundary note). `radius`
 * is Alex's, asked for directly.
 *
 * ── ★ WHY THE RADIUS IS 500 AND NOT THE 1000 THAT WAS ASKED FOR (2026-08-15, Alex's call) ───────
 * Measured first: a radius-1000 bubble centred on this world's origin **swallows Moonwell Glade**
 * (657 blocks out — canon-ruled *"a pocket AND a permanent hub, never visit-once"*, and it holds the
 * ruled gate into the Sea of Folds) along with the first leg of the story road. Gloview Village
 * cleared it by only 156. The bubble would have rendered perfectly over the top of a place it had
 * deleted, which is the whole reason `bubbleSwallows` exists.
 *
 * ★ THE RADIUS WAS THE CHEAP THING TO MOVE, BECAUSE IT IS DECOUPLED FROM THE PLOT ENTIRELY. A
 * fully-grown plot is ~72; even at 500 the bubble is seven times that. A fold is not 1:1 with what
 * it contains, so this number buys nothing but presence on the horizon — no plot mechanic reads it,
 * and no amount of expansion pushes on it.
 *
 * ★ AND SHRINKING IT PAID FOR ITSELF: at 500 the wall stands **157 blocks off the glade's
 * doorstep**, which is inside the far end of the view slider (4-12 columns = 64-192 blocks). So the
 * keeper's own fold is a landmark on the skyline **from where Gregory is standing when he tells them
 * about it.** The tutorial geography argues for itself instead of needing a marker.
 *
 * ⚠ The centre stays a parameter. If the Wilds ever becomes its own space, 1000 costs nothing there
 * and this default should be revisited rather than inherited.
 */
export const DEFAULT_BUBBLE: BubbleConfig = {
  cx: 0,
  cz: 0,
  radius: 500,
  thickness: 3,
  topY: 190,
  bottomY: 20,
  wobble: 0.01,
  passageBearing: 0,
  passageWidth: 6,
  passageHeight: 8,
  materials: { wall: 1 },
}

/**
 * Does this bubble sit clear of everything it must not swallow?
 *
 * ★ A GUARD FOR THE WIRING, BECAUSE THE CENTRE IS THE ONE THING THIS MODULE CANNOT CHECK FOR ITSELF.
 * Measured 2026-08-15: a radius-1000 bubble centred on the CURRENT world's origin engulfs Moonwell
 * Glade (657 blocks out) and the first leg of the story road. The glade is canon-ruled *"a pocket
 * AND a permanent hub, never visit-once"* and holds the ruled gate into the Sea of Folds, so a build
 * that quietly buried it would take a whole layer's door with it — and it would look like nothing at
 * all, because the bubble renders perfectly well over the top of a place it deleted.
 *
 * Returns the landmarks that fall inside, so a caller can name them rather than just fail. Call it
 * at wiring time with whatever the target world holds; an empty list is the answer you want.
 */
export function bubbleSwallows(
  cfg: BubbleConfig, landmarks: readonly { id: string; x: number; z: number }[],
): { id: string; dist: number }[] {
  return landmarks
    .map(l => ({ id: l.id, dist: Math.hypot(l.x - cfg.cx, l.z - cfg.cz) }))
    .filter(l => l.dist <= cfg.radius)
}

/** Distance from the bubble's axis. The bubble is a cylinder-with-a-cap, not a sphere — see below. */
export const distFromAxis = (x: number, z: number, cfg: BubbleConfig = DEFAULT_BUBBLE): number =>
  Math.hypot(x - cfg.cx, z - cfg.cz)

/**
 * The shell's radius at this bearing.
 *
 * ★ WOBBLE CUTS BOTH WAYS HERE, UNLIKE THE PLOT'S EDGE, and the difference is deliberate. The plot's
 * wobble may only cut IN because `capRadius` is a promise about buildable ground. Nothing is
 * promised out here — the shell is scenery and a boundary, so it may breathe in both directions and
 * look less machined for it.
 */
export function shellRadiusAt(x: number, z: number, seed: number, cfg: BubbleConfig = DEFAULT_BUBBLE): number {
  const d = distFromAxis(x, z, cfg)
  if (d === 0) return cfg.radius
  const ux = (x - cfg.cx) / d, uz = (z - cfg.cz) / d
  const n = fbm2(ux * 3.1, uz * 3.1, seed ^ 0x8b1e, 3) - 0.5
  return cfg.radius * (1 + cfg.wobble * n * 2)
}

/** Is this column strictly inside the bubble — the fold's own space, which the Wilds must not fill? */
export const insideShell = (x: number, z: number, seed: number, cfg: BubbleConfig = DEFAULT_BUBBLE): boolean =>
  distFromAxis(x, z, cfg) < shellRadiusAt(x, z, seed, cfg)

/** Is this column part of the shell itself? */
export const inShell = (x: number, z: number, seed: number, cfg: BubbleConfig = DEFAULT_BUBBLE): boolean => {
  const d = distFromAxis(x, z, cfg)
  const r = shellRadiusAt(x, z, seed, cfg)
  return d >= r && d < r + cfg.thickness
}

/** Angular half-width of the passage at the shell, derived from a width in blocks. */
const passageHalfAngle = (cfg: BubbleConfig): number => cfg.passageWidth / Math.max(1, cfg.radius)

/**
 * Is this column in the passage's doorway?
 *
 * The opening is an arc, not a rectangle: a fixed block width at this radius is a very small angle,
 * and computing it as an angle keeps the doorway the same size in blocks if the radius is retuned.
 */
export function inPassage(x: number, z: number, cfg: BubbleConfig = DEFAULT_BUBBLE): boolean {
  // ⚠ A ZERO-WIDTH DOOR IS NO DOOR, AND WITHOUT THIS LINE IT WAS STILL ONE COLUMN WIDE. The half
  // angle goes to 0 and the test below is `delta <= halfAngle`, which is satisfied exactly on the
  // bearing — so a shell asked to seal itself kept a single-column gap, and an 8-connected flood
  // walked straight through it into the interior. Caught by `bubble.test.ts` sealing the door to
  // test the wall; it would otherwise have surfaced as a player falling into the fold.
  if (cfg.passageWidth <= 0) return false
  const dx = x - cfg.cx, dz = z - cfg.cz
  if (dx === 0 && dz === 0) return false
  const bearing = Math.atan2(dz, dx)
  // Shortest angular distance, so a doorway at bearing 0 is not cut in half by the ±PI seam.
  let delta = Math.abs(bearing - cfg.passageBearing) % (Math.PI * 2)
  if (delta > Math.PI) delta = Math.PI * 2 - delta
  return delta <= passageHalfAngle(cfg)
}

/**
 * What the bubble puts at (x, y, z), or `null` where the bubble has no opinion and the Wilds'
 * ordinary generator should answer.
 *
 * ★ RETURNING `null` RATHER THAN AIR IS THE WHOLE INTEGRATION CONTRACT. `AIR` is an answer — it
 * would punch a hole in whatever terrain the Wilds generated at that cell. `null` means "not mine",
 * which is what almost every column in the world needs to hear from this module.
 */
export function bubbleMaterialAt(
  x: number, y: number, z: number, seed: number, h: number, cfg: BubbleConfig = DEFAULT_BUBBLE,
): number | null {
  // ── ★★ THE CHEAP REJECT COMES FIRST, AND IT IS NOT A MICRO-OPTIMISATION (2026-08-15) ──────────
  // This function is called ONCE PER VOXEL BY THE WHOLE WORLD'S GENERATOR (`column.ts` ›
  // `generatedAt`), which is 65,536 calls per column, for every column a player ever walks to. The
  // first wiring went straight to `insideShell` then `inShell`, and each of those calls
  // `shellRadiusAt` — a three-octave fbm. So every voxel in the Wilds, ten thousand blocks from the
  // bubble, paid TWO noise evaluations to be told it was nowhere near a bubble.
  //
  // It shipped, and the symptom was not a frame-rate dip: it was the world failing to STREAM. The
  // columns nearest a keeper standing at the wall are the shell's own, generation fell far enough
  // behind that the settle gate never saw ground, and the player hung in the air over an
  // ungenerated world with the HUD reading "generating…" forever. A slow generator does not look
  // slow — it looks broken.
  //
  // A hypot against the widest the shell can possibly reach answers "not mine" for ~every column in
  // the world with no noise at all. Keep this first.
  const d = distFromAxis(x, z, cfg)
  if (d > cfg.radius * (1 + cfg.wobble) + cfg.thickness) return null

  // ★ AND ONE `shellRadiusAt`, NOT TWO. `insideShell` and `inShell` each recompute it; asking both
  // means the same fbm twice for every cell that got this far. Read it once and branch on it.
  const r = shellRadiusAt(x, z, seed, cfg)

  // The fold's own space. The Wilds does not generate here — not as ground, and not as air with
  // ground under it. Unreachable by construction, so nothing is spent on it.
  if (d < r) return AIR
  if (d >= r + cfg.thickness) return null

  if (y > cfg.topY || y < cfg.bottomY) return null

  // ★★ THE SHELL IS NEVER PIERCED, NOT EVEN AT THE PASSAGE — reversed 2026-08-15, and the first
  // version of this file was wrong. It cut a doorway-shaped hole clean through. Three things say no,
  // and they arrived from three different directions:
  //
  // 1. **CANON.** A threshold is *"a soft seam in the cloud, a shimmer in the air, ground that simply
  //    continues. No gates, no locks, no keep-out… A build or a book that puts a locked gate on a
  //    plot has misread the world"* (`game/shimmer-geography.md:272`). A hole cut through a wall is
  //    a gate — it is the exact silhouette canon names as the misreading.
  // 2. **THERE IS NOTHING ON THE OTHER SIDE TO WALK INTO.** The plot is a separate coordinate space,
  //    and this bubble's interior is unreachable by construction and never generated. A hole does
  //    not lead to the garden; it leads to 500 blocks of ungenerated nothing. So the crossing was
  //    always going to be a TRIGGER rather than a corridor — and once it is a trigger, the hole is
  //    load-bearing for no one and dangerous if the trigger ever fails to fire.
  // 3. **IT MAKES THE SHELL'S OWN INVARIANT CONDITIONAL.** `bubble.test.ts` had to SEAL the door to
  //    prove the wall holds, which means the shipped configuration was the one arrangement never
  //    tested. With the shell continuous, the flood runs against exactly what ships.
  //
  // So `inPassage` marks a VOLUME, not a cut. The wall stands unbroken through it; the keeper steps
  // into the seam and is moved. What the seam LOOKS like is a render question and Alex's call — do
  // not answer it here with a material.
  return cfg.materials.wall
}

/**
 * Should a crossing fire for a keeper standing here?
 *
 * The whole trigger in one call, so the host does not re-derive the altitude band and drift from it.
 * `h` is the Wilds' surface altitude at this column — the seam stands ON the ground, and the ground
 * moves.
 */
export function inPassageVolume(
  x: number, y: number, z: number, seed: number, h: number, cfg: BubbleConfig = DEFAULT_BUBBLE,
): boolean {
  if (!inPassage(x, z, cfg)) return false
  if (y < h || y >= h + cfg.passageHeight) return false
  // Only at the wall itself. A trigger that reached inward would fire across the whole interior;
  // one that reached outward would grab a keeper walking past on their own business.
  const d = distFromAxis(x, z, cfg)
  const r = shellRadiusAt(x, z, seed, cfg)
  return d >= r - 1 && d < r + cfg.thickness + 1
}
