// The garden's BUBBLE, seen from outside — what a folded plot looks like standing in the Wilds.
//
// ★ PURE CORE. No react/three/DOM.
//
// ⚠ ONE HOST IMPORT SINCE 2026-08-20, NAMED HERE BECAUSE THE HEADER USED TO PROMISE NONE. The cave
// stands on the Wilds' ground, so its floor is a question only the height field can answer, and every
// consumer of that answer — the mound, the arrival standoff, the seam — has to agree about it or the
// door comes apart. The alternative was threading a floor parameter through `bubbleMaterialAt` to
// every call site, which puts the SAME number in four places and makes disagreeing about it possible.
// `height.ts` knows nothing about bubbles, so there is no cycle; the cost is that this file now sees
// the world's height field, and `bubble.test.ts` loads it transitively.
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
// ⚠ THE ONE HOST IMPORT, AND IT IS DELIBERATE. The cave stands ON the Wilds' ground, so its floor
// is a question only the height field can answer. `height.ts` imports noise/zones/holds and knows
// nothing about bubbles, so there is no cycle — but it is expensive (warped multi-octave), which is
// why `caveAnchor` is memoised rather than called per voxel. See its header.
import { columnHeight } from './height'

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
  /**
   * How far the wall bulges in and out, as a fraction of radius. Purely a look — but see
   * `maxShellRadius`: every reach bound in the build is written in terms of this, so raising it is
   * safe and lowering it never leaves a stale bound behind.
   */
  wobble: number
  /**
   * How MANY bulges there are, as the radius of the circle this module walks through noise space.
   * The lobe count around the wall is `2π · lobeFreq` and does not depend on the bubble's size, so
   * a lobe is always the same fraction of the wall — the shape reads the same on the radius-60
   * test bubble as on the shipped one, which is the only reason `bubble.test.ts` can prove anything
   * about a wall it is too slow to sweep at full size.
   */
  lobeFreq: number
  /**
   * How far the shell's top cap rises on a bulge, in blocks. Zero puts a dead-flat lid on the wall.
   *
   * ★ IT IS DRIVEN BY THE SAME FIELD AS `wobble`, ON PURPOSE — a bulge that also stands taller is
   * one puff, while two unrelated noises are a bumpy wall wearing a bumpy hat. See `lobeAt`.
   */
  crown: number
  /**
   * How far the cap frays, in blocks, on top of the crown.
   *
   * ★ THIS IS THE ONE PART OF THE SHAPE THAT IS **NOT** SCALE-FREE, AND THAT IS THE POINT. `crown`
   * and `wobble` ride `lobeAt`, which walks the UNIT CIRCLE — so a puff is always the same fraction
   * of the wall however big the wall is. A fringe wants the opposite: raggedness measured in BLOCKS,
   * because it is answering the block grid rather than the fold's size. Sampled in world space, it
   * is ~`fringeScale` blocks across on a bubble of any radius; ride the unit circle instead and the
   * same constant is 6-block tearing at r500 and per-column dither at the r60 test bubble.
   */
  fringe: number
  /** Size of one fray, in blocks. See `fringe`. */
  fringeScale: number
  /**
   * ★ THE PASSAGE'S BEARING, IN RADIANS, AND IT IS A PARAMETER BECAUSE IT IS THE PLAYER'S FRONT DOOR.
   * A single opening in a 6.3km circumference is undiscoverable by exploration, so the build must
   * put the player's arrival AT it rather than hoping they find it. Nothing here picks that spot.
   */
  passageBearing: number
  /** Half-width of the passage opening, in blocks, measured along the shell. */
  passageWidth: number
  /**
   * How tall the opening is above the Wilds' ground at that point.
   *
   * ── ★★ IT IS ALSO HOW TALL THE SEAM IS DRAWN, WHICH IS WHY IT GREW (2026-08-19) ──────────────
   * Alex: *"it blends too well."* `seam.ts` derives the ribbon from these two numbers on purpose —
   * so what is DRAWN can never promise a doorway that is not there — and `seam.test.ts` asserts every
   * ribbon point sits inside `inPassageVolume`. That pact means the seam cannot be made taller than
   * the opening: the only honest way to make the door read from across the country is for the
   * **door itself** to be taller.
   *
   * ⚠ NOTHING IS CARVED. The shell is never pierced (canon: a doorway-shaped hole IS the locked gate
   * the world forbids); this volume is the crossing TRIGGER and the seam's extent, nothing else. So
   * a taller passage costs no geometry and no wall — it means a keeper who jumps at the door still
   * crosses, which was always the intent.
   */
  passageHeight: number
  /**
   * The mound of cloud the door stands in, seen from the Wilds. `undefined` = a bare doorway in a
   * flat wall, which is what shipped before 2026-08-20. See `BubbleCave`.
   */
  cave?: BubbleCave
  materials: BubbleMaterials
}

/**
 * ── ★★ THE CLOUD CAVE, WILDS SIDE — THE SAME DOOR FROM OUTSIDE ─────────────────────────────────
 * Alex, 2026-08-20: *"the passage between home plot and the wilds on the wilds side should have the
 * same look as in the homeplot."* `plot.ts`'s `PlotCave` built the mound a keeper sees from inside
 * their garden; this is its outside face. One door, two faces, and they should read as one object.
 *
 * ★ IT SWELLS OUTWARD, WHICH IS THE ONE STRUCTURAL DIFFERENCE AND IT CHANGES EVERY BOUND. The plot's
 * mound grows INWARD off the coast, into ground the fold already owns, and `plot.ts` clips it against
 * `edgeAt` so it cannot hang in the void. This one grows into the WILDS — open country with its own
 * terrain, its own ground altitude and its own generator that has already answered for every cell the
 * mound is about to stand on. So the clips here are the opposite ones: never past `depth` outward,
 * never below the ground it stands on, and never into the shell band behind it.
 *
 * ★ AND THE BORE HAS TO BE BIG, WHICH IS NOT A TASTE CALL — IT IS THE SEAM'S SIZE (`seam.ts`). The
 * Wilds ribbon is `passageWidth · 0.85` half-wide and `passageHeight · 0.9` tall = 7.65 × 21.6 at the
 * shipped numbers, ~8× the plot seam's cross-section, because the 08-19 pass made the outside door a
 * landmark readable from across the country. A bore sized like the plot's (4 × 7) would bury the
 * shimmer in cloud and the crossing would present as a solid lump you walk into. `seam.test.ts`
 * asserts the ribbon sits in the BORE for exactly this reason — the mound may never eat the door.
 */
export interface BubbleCave {
  /** How far the mound swells OUTWARD from the shell's outer face, in blocks. Also the tunnel run. */
  depth: number
  /** Half-width across the passage bearing, in blocks. */
  halfWidth: number
  /** How far it rises above the door's floor, in blocks. */
  height: number
  /** Half-width of the arched mouth bored through it, in blocks. ⚠ Must contain the seam ribbon. */
  boreHalfWidth: number
  /**
   * How high the mouth's straight walls run before the arch springs, in blocks.
   *
   * ── ⚠⚠ THIS FIELD EXISTS BECAUSE A PLAIN ELLIPSE CANNOT HOLD THE DOOR (found 2026-08-20) ──────
   * The bore was one ellipse, sized so its centre and its axis cleared the seam comfortably, and the
   * pact assert in `seam.test.ts` came back RED on all six seeds: 2-7 ribbon points per seed standing
   * in cloud. The arithmetic is unforgiving and it is the corners that lose. The Wilds ribbon is a
   * RECTANGLE 7.65 half-wide and 21.6 tall; an ellipse of half-width 9 has already narrowed to 12.1
   * by the time it reaches that width, so the ribbon's top corners were nine blocks inside the body.
   * **An ellipse that contains a rectangle's centre and its edges still cuts its corners off.**
   *
   * ★ THE FIX IS THE SHAPE CANON ALREADY DESCRIBES. `plot.ts`: *"the mouth is an arch because an arch
   * is what a hole in something soft settles into, not because it is architecture."* An arch is
   * straight-sided to the springline and curved above it — which holds a rectangle to full width for
   * its whole height, and needs no more mound to do it. Widening the ellipse instead would have taken
   * the bore to half-width 13 and the body to 22, doubling the mound to keep the same cloud around
   * a door that was already the right size.
   */
  boreSpring: number
  /** Total height of the arched mouth, springline plus cap, in blocks. ⚠ Must contain the ribbon. */
  boreHeight: number
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
 * ── ⚠⚠ AND THAT LAST PARAGRAPH IS ARITHMETIC, NOT AN OBSERVATION (flagged 2026-08-16) ────────────
 * **Nobody has ever seen the fold from the glade.** 157 < 192 is a true sum about the slider's far
 * end; it is not a sighting. Asked for one on 2026-08-16 the hub window flew the glade with the day
 * pinned and found the wall absent at viewRadius 9 (correct — 144 blocks) **and still absent at 12
 * with 398 columns loaded after a 60s settle** — which is evidence and not proof, because that box
 * runs SwiftShader and probably never finished streaming the ring's far edge. Unverifiable there.
 *
 * ★ IT MATTERS BECAUSE IT IS LOAD-BEARING: this is the stated REASON the radius is 500, so it will
 * be cited the next time someone retunes it. And if the sightline only holds at slider MAX, it is
 * not the tutorial's geography — it is a thing most players never see. **Needs Alex's GPU, once.**
 * Until then this is a hypothesis with a good argument behind it, which is not the same as a fact.
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
  wobble: 0.03,
  lobeFreq: 5.5,
  crown: 16,
  fringe: 2.5,
  fringeScale: 4,
  passageBearing: 0,
  // 6 → 9 and 8 → 24 (2026-08-19). The doorway was 12 blocks across and 8 tall in a wall that stands
  // ~69 blocks over the ground and runs 6.3km around: at any distance it was a scratch. Now 18 across
  // and 24 tall — a third of the wall's height, which is what makes it a landmark rather than a
  // detail you find by walking into it. ⚠ These feed `inPassageVolume` (the crossing trigger) AND
  // the seam's drawn size; they cannot be tuned independently and must not be.
  passageWidth: 9,
  passageHeight: 24,
  // ── ★ SIZED AGAINST THE SEAM, NOT AGAINST THE PLOT'S MOUND (2026-08-20) ──────────────────────
  // The bore must swallow the Wilds ribbon (7.65 half-wide × 21.6 tall — `seam.ts`) CORNERS AND ALL,
  // which is what `boreSpring` 23 buys: straight walls past the ribbon's full height, then a 7-block
  // cap. The body is then sized to leave real cloud AROUND that hole — 17 half-width against a 9
  // half-width bore is 8 blocks of flank, 40 against 30 is ten over the crown. Shrink either of the
  // first two toward the second and the mound stops reading as a body with a hole in it and starts
  // reading as a tube. ⚠ The pact is asserted in `seam.test.ts` §8, on six seeds; it has been seen
  // red, so it is evidence rather than decoration.
  //
  // ⚠ `depth` 14 IS ALSO THE ARRIVAL DISTANCE AND THE `/goto garden` LANDING — see `approachStandoff`.
  // It is not a free number; tune it and both of those move with it, which is the intent.
  cave: { depth: 14, halfWidth: 17, height: 40, boreHalfWidth: 9, boreSpring: 23, boreHeight: 30 },
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
 *
 * ── ★★ FEED IT THE REGISTRY, NOT A LITERAL (2026-08-16, the world lane's find) ──────────────────
 * For a day this function was correct and answered a question nobody was asking. Its only caller was
 * a test holding a hand-written three-item list, and that list omitted the `garden` anchor — which
 * sits at (0,0), the exact centre of the shipped bubble. So the guard whose own comment calls it
 * *"the thing that will actually protect the world"* reported clean while the world's most-used
 * anchor was buried, and `/goto garden` shipped as a permanent hang. **A guard checked against a
 * literal is a guard checked against the author's memory.** Same family as the handoff-sort lie:
 * believe the registry, not the note.
 *
 * ── ★ `exempt` EXISTS SO AN INTENDED COLLISION IS DECLARED RATHER THAN OMITTED ──────────────────
 * The garden anchor being inside the bubble IS correct — the bubble is that fold's outside, and the
 * zone it names shapes the terrain AROUND it. But "intended" and "forgotten" look identical to a
 * filtered list, and the only difference that matters is whether anyone wrote down which one it is.
 * An id passed here must carry its reason at the call site; anything not named is still caught.
 */
export function bubbleSwallows(
  cfg: BubbleConfig, landmarks: readonly { id: string; x: number; z: number }[],
  exempt: readonly string[] = [],
): { id: string; dist: number }[] {
  // ⚠ `maxShellRadius`, NOT `cfg.radius` — the difference is the bulge, and the bulge got 3× bigger
  // on 2026-08-16. Against a ±5-block wobble a flat radius was a rounding error; against ±15 it is a
  // 15-block band in which a landmark is genuinely buried and this guard says it is fine. A guard
  // asked about the mean of a shape it exists to check the extremes of is the same failure as
  // asking it about a hand-written literal, one abstraction down.
  const reach = maxShellRadius(cfg)
  return landmarks
    .filter(l => !exempt.includes(l.id))
    .map(l => ({ id: l.id, dist: Math.hypot(l.x - cfg.cx, l.z - cfg.cz) }))
    .filter(l => l.dist <= reach)
}

/** Distance from the bubble's axis. The bubble is a cylinder-with-a-cap, not a sphere — see below. */
export const distFromAxis = (x: number, z: number, cfg: BubbleConfig = DEFAULT_BUBBLE): number =>
  Math.hypot(x - cfg.cx, z - cfg.cz)

/**
 * The furthest the shell's inner face can stand from the axis, and the furthest any wall voxel can.
 *
 * ★ EVERY REACH BOUND IN THE BUILD GOES THROUGH THESE TWO, BECAUSE A BOUND THAT UNDERSTATES THE
 * SHAPE IS A HOLE. `bubbleMaterialAt`'s cheap reject and `column.ts`'s `columnTouchesBubble` both
 * answer "not mine" below a threshold — a false NO there leaves a gap in the wall, which is the one
 * failure this module has no other defence against (`columnTouchesBubble`'s own header says so).
 * They were two hand-written copies of `radius * (1 + wobble) + thickness`, correct only for as
 * long as nobody changed the shape. This session changed the shape.
 *
 * ⚠ `lobeAt` is bounded on ±0.5 BY CONSTRUCTION (`fbm2` returns 0..1), so these are exact rather
 * than generous. If the lobe field ever gains a term that is not `fbm2`, this bound is what has to
 * learn about it first.
 */
export const maxShellRadius = (cfg: BubbleConfig): number => cfg.radius * (1 + cfg.wobble)
export const maxShellReach = (cfg: BubbleConfig): number => maxShellRadius(cfg) + cfg.thickness

/**
 * The furthest ANY voxel this module owns can stand from the axis — the shell plus the cave's mound.
 *
 * ── ⚠⚠ THIS IS THE BOUND THE CHEAP REJECT MUST USE, AND GETTING IT WRONG IS INVISIBLE ──────────
 * `maxShellReach` answers for the shell and is still exactly right for that. The mound stands
 * `cave.depth` blocks OUTSIDE the shell's outer face, so a reject written against the shell's bound
 * does not fail loudly — it slices the mound off flat at `maxShellReach` and leaves a clean vertical
 * wall of cloud with the nose of the cave missing. Every assert about the cave's shape still passes,
 * because they all sample inside the bound. **The picture is the only place it shows.**
 *
 * Same family as the note on `maxShellReach` itself: two hand-written copies of a bound is how the
 * shape and the reject drift apart. One name, both callers (`bubbleMaterialAt`'s reject and
 * `column.ts`'s `columnTouchesBubble`).
 */
export const maxBubbleReach = (cfg: BubbleConfig): number =>
  maxShellReach(cfg) + (cfg.cave?.depth ?? 0)

/**
 * The bubble's lobe field at this bearing: one signed number in [-0.5, +0.5], read once and used
 * for every part of the shape that has to agree with itself.
 *
 * ── ★★ ONE FIELD, TWO EFFECTS — THIS IS WHAT MAKES IT A PILE OF CLOUDS (2026-08-16, Alex's call) ──
 * The wall shipped as a near-perfect cylinder with a dead-flat lid: wobble 0.01 is ±5 blocks over a
 * 3km circumference, which is not a wobble, and all the cloud character lived in the TEXTURE. At 170
 * blocks tall a player reads the silhouette long before the tile, and the silhouette said *dome*.
 *
 * The fix is shape, and the whole trick is that the bulge and the crown are the SAME number. A puff
 * that pushes out also stands taller, so the eye groups them into discrete heaps. Drive the top cap
 * off its own independent noise instead and you get a bumpy wall wearing an unrelated bumpy hat —
 * which reads as a defect in a smooth wall rather than as cloud.
 *
 * ★ SAMPLED ON THE UNIT CIRCLE, so it is a function of BEARING ALONE, and that is load-bearing far
 * beyond this file. `column.ts` decides a whole 256-block vertical from ONE probe at mid-shell, and
 * is only allowed to because the expensive half of the answer does not vary with `y`. A lobe field
 * that took an altitude would be honest cloud and would reinstate the streaming stall this module's
 * header spends thirteen lines on: 65,536 fbm evaluations per column, the world failing to generate
 * fast enough for the settle gate, and a keeper hung in the air over the HUD reading "generating…".
 * **The vertical shape is bought in the CAP, which is per-column, not in the radius, which is not.**
 */
export function lobeAt(x: number, z: number, seed: number, cfg: BubbleConfig = DEFAULT_BUBBLE): number {
  const d = distFromAxis(x, z, cfg)
  if (d === 0) return 0
  const ux = (x - cfg.cx) / d, uz = (z - cfg.cz) / d
  return fbm2(ux * cfg.lobeFreq, uz * cfg.lobeFreq, seed ^ 0x8b1e, 3) - 0.5
}

/**
 * The shell's radius at this bearing.
 *
 * ★ WOBBLE CUTS BOTH WAYS HERE, UNLIKE THE PLOT'S EDGE, and the difference is deliberate. The plot's
 * wobble may only cut IN because `capRadius` is a promise about buildable ground. Nothing is
 * promised out here — the shell is scenery and a boundary, so it may breathe in both directions and
 * look less machined for it.
 *
 * ⚠ THE BULGE IS LIMITED BY SLOPE, NOT BY AMPLITUDE, and the two are easy to confuse. `thickness` is
 * measured RADIALLY (`d >= r && d < r + thickness`), so where the wall leans, the skin a player
 * would have to squeeze through is `thickness · cos(lean)` — thinner than it says on the config. The
 * lean is roughly `wobble · lobeFreq · 2π`, which means doubling the lobe COUNT costs exactly as
 * much wall as doubling the bulge DEPTH. `bubble.test.ts` floods 8-connected against the shipped
 * numbers rather than trusting either of them; tune against that flood, never against a screenshot.
 */
export function shellRadiusAt(x: number, z: number, seed: number, cfg: BubbleConfig = DEFAULT_BUBBLE): number {
  const d = distFromAxis(x, z, cfg)
  if (d === 0) return cfg.radius
  return cfg.radius * (1 + cfg.wobble * lobeAt(x, z, seed, cfg) * 2)
}

/**
 * How high the shell stands in this column — its own top cap, not the config's flat one.
 *
 * ★ THIS IS THE HALF OF "A PILE OF CLOUDS" A PLAYER ACTUALLY SEES. The wall rises ~60 blocks above
 * the Wilds' ground, so the skyline is the only part of it in view from any distance, and a skyline
 * that is a perfectly level line at y190 for 3km reads as a TANK — no amount of billowing texture
 * on the face argues with it. Crowning the cap is what turns the same wall into heaped cloud.
 *
 * ⚠ CALLERS MUST ASK RATHER THAN READ `cfg.topY`. It is now the MEAN of the cap, not the top of it;
 * a caller that fills up to `topY` leaves the crowns unbuilt and puts the flat lid back, one file
 * over, where nothing would look wrong until someone stood outside and looked up.
 *
 * ── ★★ TWO TERMS, AND THE SECOND ONE IS WHY IT READS AS CLOUD AND NOT AS STAIRS (2026-08-16) ─────
 * Shipped with the crown alone, the silhouette came back **blocky sawtooth** rather than puffs, and
 * the cause is arithmetic rather than taste: a smooth low-frequency field rounded to whole blocks is
 * FLAT for a long run near every peak and trough, then steps once. That is a terrace, and no amount
 * of crown fixes it — a bigger crown just builds taller terraces.
 *
 * So the cap carries a second, small, fast term whose only job is to break those runs. The edge
 * frays by a couple of blocks over ~7, which is the difference between a wall that was CUT to a
 * curve and cloud that simply stops. **`crown` is the shape; `fringe` is the edge.**
 *
 * ⚠ AND THE FRINGE IS DELIBERATELY NOT PART OF THE ONE-FIELD COUPLING. `crown` must ride `lobeAt`
 * or the heaps stop being heaps (see `lobeAt`); the fringe must NOT, or it is just more crown at a
 * higher frequency and terraces the same way. `bubble.test.ts` asserts the coupling with the fringe
 * as its tolerance rather than asserting it exactly — the weaker claim is the true one, and an
 * independent crown noise still fails it by an order of magnitude.
 */
export const shellCapTop = (x: number, z: number, seed: number, cfg: BubbleConfig = DEFAULT_BUBBLE): number =>
  capFromLobe(lobeAt(x, z, seed, cfg), x, z, seed, cfg)

/**
 * The cap, for a caller that already holds the lobe.
 *
 * ⚠ IT EXISTS SO THERE IS EXACTLY ONE COPY OF THIS EXPRESSION. `bubbleMaterialAt` reads the lobe
 * once and derives the radius and the cap from it, so it cannot call `shellCapTop` without paying
 * for a second `fbm2` on every cell in the shell band — but a hand-inlined second copy of the cap
 * arithmetic is how `column.ts` and this file end up disagreeing about where the wall stops, which
 * is a hole at the top of the world that only shows from outside, in the air, looking up.
 */
const capFromLobe = (n: number, x: number, z: number, seed: number, cfg: BubbleConfig): number =>
  Math.round(cfg.topY + cfg.crown * n * 2 + cfg.fringe * fringeAt(x, z, seed, cfg) * 2)

/**
 * The fray on the cap's edge: fast, small, and measured in blocks. See `shellCapTop` and `fringe`.
 *
 * ⚠ SAMPLED IN WORLD SPACE ON PURPOSE — every other term in this module reads the bearing. This one
 * is answering the BLOCK GRID, so it has to be told about blocks.
 */
export function fringeAt(x: number, z: number, seed: number, cfg: BubbleConfig = DEFAULT_BUBBLE): number {
  const s = Math.max(1, cfg.fringeScale)
  return fbm2(x / s, z / s, seed ^ 0x51ed, 2) - 0.5
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
 * Where the Wilds-side cave stands: the point on the shell's OUTER FACE at the passage bearing, the
 * bearing itself, and the ground altitude there — which is the tunnel's floor.
 *
 * ── ⚠⚠ MEMOISED, AND THAT IS A CORRECTNESS-SHAPED PERFORMANCE PROBLEM ──────────────────────────
 * `bubbleCaveAt` is reached once per voxel for every column in a 14-block ring around a 3km wall,
 * which is ~4M calls for a keeper who walks the perimeter. This function costs an `fbm2` (the shell
 * radius) plus a `columnHeight` (warped, multi-octave, the single most expensive call in the
 * generator) — so calling it per voxel reinstates the exact failure `bubbleMaterialAt`'s header
 * spends thirteen lines on: the world stops STREAMING, the settle gate never sees ground, and the
 * keeper hangs in the air over a HUD that says "generating…". A slow generator does not look slow.
 *
 * ★ IT IS SAFE TO CACHE BECAUSE IT IS PURE IN (seed, cfg) AND THE WORLD HAS ONE BUBBLE. Keyed on
 * everything the answer actually depends on, so a test that builds a second config gets its own
 * entry rather than the first one's answer — which would be a silent wrong-door bug of exactly the
 * kind `seam.ts` already warns about with `DEFAULT_BUBBLE` vs `WILDS_BUBBLE`.
 */
const anchorCache = new Map<string, { x: number; z: number; y: number; bearing: number }>()

export function caveAnchor(seed: number, cfg: BubbleConfig = DEFAULT_BUBBLE) {
  const k = `${seed}|${cfg.cx}|${cfg.cz}|${cfg.radius}|${cfg.wobble}|${cfg.lobeFreq}|${cfg.thickness}|${cfg.passageBearing}`
  const hit = anchorCache.get(k)
  if (hit) return hit
  const b = cfg.passageBearing
  // ★ ONE EVALUATION, NOT AN ITERATION — `shellRadiusAt` normalises its input, so the radius depends
  // on the BEARING alone. Same trick as `wildsSeamAnchor` and `passageApproach`.
  const r = shellRadiusAt(cfg.cx + Math.cos(b) * cfg.radius, cfg.cz + Math.sin(b) * cfg.radius, seed, cfg)
  const d = r + cfg.thickness
  const x = Math.floor(cfg.cx + Math.cos(b) * d)
  const z = Math.floor(cfg.cz + Math.sin(b) * d)
  const a = { x, z, y: columnHeight(x, z, seed), bearing: b }
  anchorCache.set(k, a)
  return a
}

/** What the Wilds-side cave puts at a point: its cloud body, the air of its mouth, or nothing. */
export type BubbleCavePart = 'shell' | 'bore' | null

/**
 * The mound, as pure geometry: a half-ellipsoid of cloud swelling OUTWARD off the shell, with an
 * arched tunnel bored along the passage bearing.
 *
 * ── ★★ IT MAY ADD CLOUD AND OPEN ITS OWN MOUTH, AND THAT IS THE WHOLE SAFETY ARGUMENT ──────────
 * The Wilds is not empty ground. Every cell this shape touches has already been answered by the
 * continent's generator, and `bubbleMaterialAt` runs BEFORE that generator — so anything returned
 * here overrides real terrain rather than decorating it. Three clips keep that honest:
 *
 *   1. **`u` IS BOUNDED AT BOTH ENDS.** Below 0 is the shell band, which this must never touch (the
 *      wall is unpierced — `bubbleMaterialAt`'s own three-reason note). Above `depth` is open Wilds,
 *      and an unbounded bore is a tunnel that runs to the edge of the world. ⚠ `plot.ts`'s bore has
 *      NO upper bound on `u` and is correct without one, because `plotMaterialAt` only consults it
 *      where the column is already air. **That reasoning does not travel to this file** — copy the
 *      shape across without the bound and you carve a 9-block corridor across the continent.
 *   2. **THE BODY NEVER REPLACES TERRAIN** (`y <= h` returns null). Cloud goes in the air above
 *      whatever ground it lands on, never into it — so the mound cannot bury a keeper's standing
 *      position, cannot delete a hill, and cannot swallow anything built out here.
 *   3. **THE BODY SKIRTS DOWN TO THE GROUND IT STANDS ON** (`ws = max(0, w)`). Measured at the live
 *      door on seed 1337: the Wilds rises **5 blocks over the 14-block tunnel run** and spreads 6
 *      across the footprint. A rigid ellipsoid floored at the anchor would therefore hang in the air
 *      on the downhill flank — a mound of cloud with daylight under it. Clamping `w` at 0 means every
 *      cell between the local ground and the door's floor takes the ellipsoid's WIDEST slice, so the
 *      body fills down to meet whatever is under it. That skirt is also the tunnel's walkway.
 *
 * ★ THE BORE IS TESTED BEFORE THE BODY, the same order `plot.ts` argues for: the mouth is defined as
 * the ABSENCE of the body, so a body-first rule fills the doorway and the cave reads as a solid lump
 * with a shimmer painted on it.
 *
 * ★ THE BORE MAY CUT TERRAIN, ON PURPOSE. The ground rises across the footprint, so an arch that
 * refused to carve would open into a hillside — a doorway with dirt in it. Bounded to the mound's
 * own footprint, that carve is the tunnel; unbounded it is the corridor in clip 1.
 */
export function bubbleCaveAt(
  x: number, y: number, z: number, seed: number, h: number, cfg: BubbleConfig = DEFAULT_BUBBLE,
): BubbleCavePart {
  const c = cfg.cave
  if (!c || c.depth <= 0) return null
  const a = caveAnchor(seed, cfg)
  const cb = Math.cos(a.bearing), sb = Math.sin(a.bearing)
  const dx = x - a.x, dz = z - a.z
  // `u` runs OUTWARD from the shell's face into the Wilds, `v` across the doorway, `w` up from the
  // floor. The plot's cave negates its bearing because "deeper" there means inward; out here deeper
  // means away from the fold, so the bearing is used as it stands. ⚠ The sign is the difference
  // between a mound on the door and a mound on the far side of the world.
  const u = dx * cb + dz * sb
  if (u < 0 || u > c.depth) return null
  const v = -dx * sb + dz * cb
  // ⚠ A PURE EARLY-OUT, AND IT SAYS SO BECAUSE IT CANNOT FAIL. The body's own ellipsoid already
  // rejects `|v| > halfWidth`, and the bore's half-width is smaller still — so deleting this line
  // changes no cell in the world, which a mutation sweep confirmed by surviving. It is here to skip
  // the arithmetic below for the ~90% of the footprint's bounding box that is off to the sides.
  // Unlabelled it is indistinguishable from a load-bearing clip, which is exactly how a real hole
  // gets left in place by someone tidying up what looks like a duplicate check.
  if (Math.abs(v) > c.halfWidth) return null
  const w = y - a.y
  // ── ★ THE MOUTH IS AN ARCH: STRAIGHT WALLS TO THE SPRINGLINE, AN ELLIPTICAL CAP ABOVE ────────
  // Full width for the whole of the door's own height, which is the only way a rectangular seam fits
  // in it — see `boreSpring` for what the plain ellipse cost. Above the springline the cap closes in,
  // so the mouth still settles rather than reading as a cut rectangle.
  if (w >= 0 && Math.abs(v) <= c.boreHalfWidth) {
    if (w <= c.boreSpring) return 'bore'
    const cap = Math.max(1, c.boreHeight - c.boreSpring)
    const t = (w - c.boreSpring) / cap
    if (t <= 1 && (v / c.boreHalfWidth) ** 2 + t ** 2 <= 1) return 'bore'
  }
  if (y <= h) return null
  // ── ★ THE SKIRT, WRITTEN AS A COLUMN FILL — AND THAT IS LEGIBILITY, NOT A FIX ────────────────
  // How tall is the mound over this (u, v), and is this cell under it? Everything from the local
  // surface up to that top is cloud, which is what lets the body meet ground that sits below the
  // door's floor instead of hanging in the air over it. Measured at the live door on seed 1337 the
  // Wilds rises 5 blocks across the footprint, so the skirt has real work to do.
  //
  // ⚠ THIS REPLACED `ws = max(0, w)` FED INTO THE ELLIPSOID, AND I FIRST WROTE THAT UP AS A BUGFIX
  // WITH A STORY ABOUT THE MOUND TAPERING INWARD AS IT CAME DOWN. That story was false. Swept over
  // the whole footprint the two forms disagree on **123 of 39,375 cells**, all of them the exact rim
  // where the radicand is zero — `max(0, w)` uses the w=0 slice below the floor, which IS the widest
  // slice, so there was never a taper. The form that genuinely differs is the UNCLAMPED ellipsoid
  // (7,700 cells), and that one this file never had.
  //
  // ★ KEPT ANYWAY, because it states the intent in the shape of the question being asked, and a
  // reader can see the skirt in it. But a rewrite that changes 0.3% of a footprint is a rewrite, and
  // calling it a fix is how a comment starts lying about what the code does. Checked, not argued.
  const rad = 1 - (u / c.depth) ** 2 - (v / c.halfWidth) ** 2
  if (rad <= 0) return null
  if (w <= c.height * Math.sqrt(rad)) return 'shell'
  return null
}

/**
 * How far beyond the shell's outer face the door's approach stands, in blocks.
 *
 * ⚠ IT HAS TO CLEAR THE CROSSING TRIGGER, NOT JUST THE WALL. `inPassageVolume` accepts about a block
 * past the shell's outer face, so a standoff of 1 or 2 would drop the keeper straight THROUGH the
 * door they were brought to see. 10 puts them a few paces back on open ground, looking at it.
 */
export const APPROACH_STANDOFF = 10

/**
 * The standoff a keeper actually arrives at — the clear 10 plus whatever the mound occupies.
 *
 * ── ★★ DERIVED FROM THE CAVE, NOT A CONSTANT, AND THE PLOT SIDE LEARNED THIS FIRST ─────────────
 * `VoxelWorld.arriveStandoff` is the mirror of this one file over, and its header records what a
 * pinned literal cost: the flat 6 was measured against a door standing in open ground, and the day
 * a 13-block tunnel appeared in front of that door the same 6 landed the keeper **five blocks inside
 * a cloud pipe**, nose to the shimmer, with the world they had just entered entirely out of frame.
 *
 * The mound out here is 14 deep, so an un-derived 10 does the identical thing in the identical way,
 * from the other side. Both sides now take their standoff from their own cave's depth, which is the
 * only arrangement where tuning a mound cannot silently strand an arrival inside it.
 *
 * ⚠ EVERY OUTSIDE ADDRESS OF THE FOLD GOES THROUGH `passageApproach`, so this moves all of them at
 * once: the walking crossing out of the garden, the `toDoor` travel option, and `/goto garden`. That
 * is the point — one door, one outside address, no drift.
 *
 * ★ THE STRUCTURE IS THE PLOT'S RULE; THE CONSTANT IS NOT, AND THAT IS DELIBERATE. `arriveStandoff`
 * is `thresholdInset + cave.depth + 3`, so this file first shipped `depth + 3` to match it exactly.
 * Rendered, that was too close to see anything: the plot's mound is **15 blocks tall** and three
 * paces frames it, while this one is **40** against a wall that stands ~67 over the ground, and from
 * three paces a keeper sees cloud filling the whole screen with a shimmer on it — which is precisely
 * the read the mound was built to replace. **The rule travels; the number it was tuned against does
 * not.** Ten blocks clear (`APPROACH_STANDOFF`, whose own header already says "a few paces back on
 * open ground, looking at it") puts the cave in frame. Both sides still derive from their own cave's
 * depth, which is the part that actually had to match.
 *
 * ⚠ MEASURED, NOT PICKED, AND THE MEASUREMENT SAYS THE NUMBER IS NOT DELICATE. Swept over ten seeds:
 * every standoff from 15 to 24 puts the keeper on ground with room to stand on all ten, with two
 * lone exceptions further out (19 on seed 6, 26 on seed 777771 — trees). So this is a FRAMING choice
 * inside a wide safe band, not a fit constraint. If the arrival wants more of the 40-block mound in
 * frame, raise it; nothing breaks until it walks into the forest.
 */
export const approachStandoff = (cfg: BubbleConfig = DEFAULT_BUBBLE): number =>
  APPROACH_STANDOFF + (cfg.cave?.depth ?? 0)

/**
 * Where a keeper should be put down when they ask for a place that is inside this bubble: on real
 * ground outside the wall, on the door's own bearing, facing it.
 *
 * ── ★★ THE FIX FOR "TELEPORTED INTO A PLACE THAT HAS NO GROUND" (2026-08-16) ────────────────────
 * `/goto garden` handed `tp` a landing from `columnHeight` — the CONTINENT's rule, which knows
 * nothing about this bubble — so the keeper arrived at y134 in a column with **zero solid cells at
 * any altitude** and hung there forever. The destination was never wrong as a *place*; it was wrong
 * as a *coordinate*. The fold's centre is not somewhere you stand, it is somewhere you enter, and
 * the only standable answer to "take me to the garden" is its door.
 *
 * ★ ONE EVALUATION, NOT AN ITERATION — `shellRadiusAt` normalises its input, so the radius depends
 * on the BEARING alone and any point along it gives the same answer. Same trick as `wildsSeamAnchor`,
 * which lands one block off the wall because it is drawing the seam; this stands back to look at it.
 */
export function passageApproach(
  seed: number, cfg: BubbleConfig = DEFAULT_BUBBLE, standoff: number = approachStandoff(cfg),
): { x: number; z: number } {
  const b = cfg.passageBearing
  const r = shellRadiusAt(cfg.cx + Math.cos(b) * cfg.radius, cfg.cz + Math.sin(b) * cfg.radius, seed, cfg)
  const d = r + cfg.thickness + standoff
  return { x: Math.floor(cfg.cx + Math.cos(b) * d), z: Math.floor(cfg.cz + Math.sin(b) * d) }
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
  // ⚠ `maxBubbleReach`, NOT `maxShellReach` — the cave's mound stands outside the shell and this
  // reject is the only thing standing between it and being sliced off flat. See `maxBubbleReach`.
  if (d > maxBubbleReach(cfg)) return null

  // ★ AND ONE NOISE EVALUATION, NOT THREE. `insideShell` and `inShell` each recompute the radius, and
  // since 2026-08-16 the cap needs the same field again; asking each in turn means the same fbm three
  // times for every cell that got this far. Read the lobe once and derive all of it.
  const n = lobeAt(x, z, seed, cfg)
  const r = cfg.radius * (1 + cfg.wobble * n * 2)

  // The fold's own space. The Wilds does not generate here — not as ground, and not as air with
  // ground under it. Unreachable by construction, so nothing is spent on it.
  if (d < r) return AIR
  // ── ★★ OUTSIDE THE WALL IS THE CAVE'S GROUND, AND IT IS ASKED BEFORE THE CAP (2026-08-20) ────
  // Everything past the shell's outer face used to be a flat `null`. The mound lives exactly there.
  //
  // ⚠ IT HAS TO BE ASKED HERE AND NOT BELOW THE CAP TEST. The cap (`capFromLobe`) is the SHELL's
  // top in this column and the mound is neither bounded by it nor related to it — a mound tested
  // after the cap would be cut off at the wall's own skyline, which on the crowned side of a lobe is
  // a clean horizontal slice through the cloud with nothing to say it was ever meant to be round.
  if (d >= r + cfg.thickness) {
    const c = bubbleCaveAt(x, y, z, seed, h, cfg)
    // ⚠ AIR IS AN ANSWER, and out here it is the one that overrides the continent. That is correct
    // for the bore and ONLY for the bore — it is what makes the mouth a mouth rather than a dent in
    // a hillside — and it is safe because `bubbleCaveAt` bounds the arch to the mound's footprint.
    if (c === 'bore') return AIR
    if (c === 'shell') return cfg.materials.wall
    return null
  }

  // The cap is this column's own, crowned off the same lobe — see `shellCapTop`. Derived from `n`
  // rather than called, so the crown costs nothing on top of the radius that was already computed.
  if (y > capFromLobe(n, x, z, seed, cfg) || y < cfg.bottomY) return null

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
