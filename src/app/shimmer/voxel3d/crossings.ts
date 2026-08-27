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
import { MAT } from '../voxel/depth'

/**
 * What a socket crosses. The two are different in KIND, not in degree — see the header.
 *
 * `gate` is deliberately singular in practice: canon rules exactly one home-gate per garden.
 *
 * ── ★★ THIS SAID `waymark` UNTIL 2026-08-24, AND THE GUARD WAS AIMED AT THE RETIRED WORD ─────
 * The header above brags that the gate/Ather split lives in the TYPES so a mislabel is a compile
 * error rather than something someone remembers — and it was, against the vocabulary ruled on
 * 08-13. The travel-layer ruling of **08-24** (`game/shimmer-geography.md` › THE GATE STATION)
 * restates the line one level finer: *"It is one gate and N **passages**."* A **waymark** is the
 * thing the keeper PLANTS; a **passage** is the crossing that runs to it. This socket is the
 * crossing, so it was named after the wrong object — a working type guard pointed one word off.
 * ⚠ `MAX_MARKS` still sizes the row, because the keeper's own planted marks are what the left arc
 * runs to. That is a fact about the count, not about the noun.
 */
export type SocketKind = 'gate' | 'passage'

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
 * ── ⚠⚠ 21 → 25 ON 2026-08-27, AND THE RULED WINDOW IS NOW MISSED BY FIVE ─────────────────────
 * Alex ruled 15-20. The tangent row could not get under 20.2 (the mound's own floor, recorded
 * below); the half-circle cannot get under 25. Swept across **15 seeds × 3 tiers**: 22 fouls the
 * threshold mound on 7 combinations, 23 on 1, and 24 on 1. The reason is geometric rather than a
 * matter of distance — on an arc the outermost socket TURNS to face the focus, so its frame reaches
 * radially toward the mound instead of sweeping past it tangentially, and the corner arrives about
 * three blocks sooner than the centre column suggests.
 *
 * ⚠ AND 24 IS THE NUMBER I NEARLY SHIPPED. It cleared all 8 seeds in my first sweep and failed on
 * the ninth — the oracle uses a different seed set from the one I had reached for, and it caught it
 * in one run. A constant tuned against a sample is tuned against that sample; say how many you
 * swept, and sweep the set the guard will actually use.
 *
 * ★ RECORDED, NOT ROUNDED, for the same reason the 20.2 note below was: *"he said 15-20 and I
 * shipped 24" is a thing he should be able to find later.* It is also a real trade he may want to
 * reverse — a tighter `COURT_RADIUS` would buy some of it back, at the cost of the station reading
 * as a huddle rather than a half-circle. The measurement is here so the argument can be had with
 * numbers instead of impressions.
 *
 * ⚠ ALEX'S DIAL. Placement in the fold is his call; this is derived so it follows the threshold if
 * the threshold ever moves, and it is one constant so he can slide it without touching geometry.
 */
export const COURT_ARC: number = 25

/** How far inside the coast the court's centre stands, in blocks. Clear of the wall, not inland. */
export const COURT_INSET: number = 16

/** Gap between adjacent socket centres, in blocks. 8 leaves 3 clear blocks between 5-wide frames. */
export const SOCKET_PITCH: number = 8

/** Sockets: one gate (Rune Hold, always up) plus one per waymark the keeper may hold. */
export const SOCKET_KINDS: SocketKind[] =
  ['gate', ...Array.from({ length: MAX_MARKS }, () => 'passage' as const)]

/**
 * ── ★★★ THE ROW IS A HALF-CIRCLE FACING THE THRESHOLD, WHICH IS WHAT CANON SAID ALL ALONG ──────
 * Alex, 2026-08-27, standing in his own garden: *"its currently just a straight line of half buried
 * archs."* Both halves of that sentence were literally true and both were canon drift.
 *
 * `game/shimmer-geography.md` › THE GATE STATION (ruled 08-24): **"Gregory pre-places a low
 * half-circle of sockets on the keeper's plot, facing the threshold."** The build laid them along
 * the coast TANGENT — a straight row, every frame facing back down one shared bearing. Measured on
 * seed 1337: the nearest socket sat 21.2 blocks from the threshold and the far one 42.5, so the row
 * was not merely un-curved, it receded. A keeper walking up from their door met the first arch
 * side-on and the last one twice as far away. That is a fence, not a station.
 *
 * ★ AN ARC ANSWERS BOTH WORDS AT ONCE. Sockets sit on a circle around a FOCUS — the spot the keeper
 * stands to read them — so every one is the same distance away and every one turns to face that
 * spot. "Facing the threshold" then falls out of where the arc OPENS: its mouth points back down
 * the walk from the door, so you arrive into the half-circle rather than alongside it.
 *
 * ⚠ THE GATE TAKES THE APEX, and canon is explicit that this is load-bearing rather than tidy:
 * *"home-cost lives on the gate and nowhere else… the 08-15 watch item is served by the centre
 * socket being visibly singular; render it unlike its neighbours."* So it is the one you walk
 * toward, and `socketCells` builds it larger. Passages fill outward from it, alternating sides —
 * which reproduces canon's own asymmetry (one left arc, two right) without hard-coding a table of
 * destinations this build does not have yet. ⚠ The Chord and Lingston routes in canon's table are
 * NOT built; every passage here runs to a keeper-planted waymark. That gap is canon's to fill, not
 * mine to invent.
 *
 * ⚠ ALEX'S DIAL, like `COURT_ARC`. A half-circle is the ruling; how wide the half-circle is, is a
 * look. 10 blocks puts a 5-wide frame's edges ~2 blocks from its neighbour's at four sockets.
 */
export const COURT_RADIUS: number = 10

/**
 * Where each socket sits on the arc, in radians from the apex. Index 0 (the gate) is the apex.
 *
 * ★ ALTERNATING OUTWARD, so adding a socket never walks the existing ones sideways — the same
 * property the old centred row had and the reason it was written that way. `Math.PI / 2` is the
 * half-circle's own half-span, so the outermost socket sits exactly at the mouth however many there
 * are, and the arc is a half-circle at any count rather than only at the shipped one.
 */
export function socketArcAngles(count: number = SOCKET_KINDS.length): number[] {
  if (count <= 1) return [0]
  // Slots either side of the apex; with `count` sockets there are `count - 1` gaps to place.
  const perSide = Math.ceil((count - 1) / 2)
  const step = (Math.PI / 2) / perSide
  const out = [0]
  for (let i = 1; i < count; i++) {
    const rank = Math.ceil(i / 2)              // 1,1,2,2,3,3…
    const side = i % 2 === 1 ? 1 : -1          // right, left, right, left…
    out.push(side * rank * step)
  }
  return out
}

/**
 * ── ★★ IS THIS SOCKET LIT? — the station DISPLAYS reach, it does not GRANT it ─────────────────
 * Canon, 08-24: *"Gregory pre-places a low half-circle of sockets... One is lit on day one; the
 * rest are dark. The station grants nothing — it displays reach the keeper has already earned."*
 *
 * ★ WHAT THIS REPLACED, AND WHY IT WAS A CANON DEFECT RATHER THAN A MISSING FEATURE. The build
 * laid a socket's stone only once the keeper held its waymark, from Alex's 08-23 words (*"as the
 * player unlocks gates for the ather they appear here"*) — so an unearned way was **nothing at
 * all**, not a dark one. A station whose sockets appear one at a time cannot display reach; it can
 * only report it after the fact, and the keeper never learns the ways exist. Dark is INFORMATION.
 * The 08-24 ruling supersedes the sentence that produced the old behaviour.
 *
 * ★ AND IT FIXES A LATENT BUG FOR FREE. The court is rebuilt only when the plot TIER changes, so a
 * socket that was supposed to appear on planting a waymark would not have stood up until the fold
 * next widened. Pulling player state out of the STONE leaves the geometry pure and puts the only
 * state-dependent cell in the lamp.
 */
export const socketLit = (s: Socket, marksHeld: number): boolean =>
  s.kind === 'gate' || marksHeld >= s.index

/**
 * Half the row's span, in blocks — the gap between the court's CENTRE and its nearest socket.
 *
 * ★★ THIS EXISTS BECAUSE THE CONSTANT USED TO MEASURE THE WRONG THING. `COURT_ARC` was the arc to
 * the row's MIDDLE, and the row is 24 blocks wide, so "the court is 18 blocks from the seam" put a
 * socket 6 blocks from it — inside the threshold mound, on every seed and every tier (`fouls-cave`
 * 24/24, swept). Alex asked for 15-20 blocks and the honest reading of that is *the nearest thing
 * you walk up to*, not the midpoint of a row he never sees marked.
 *
 * ⚠⚠ AND THE THRESHOLD MOUND SETS A FLOOR NEAR 20 THAT NO TUNING GETS UNDER. The plot's cave is 12
 * half-wide and swells 13 inward, so its diagonal reach is 17.7 blocks; add the frame's own
 * half-width and integer rounding and the first value clearing every seed AND every tier is 21,
 * landing the nearest socket at 20.2. Alex ruled 15-20, so the ruled window is satisfiable **only at
 * its very top edge** — 18 fouls the mound on 3 of 24 seed×tier combinations, 20 on 2. Recorded
 * rather than quietly rounded, because "he said 15-20 and I shipped 20.2" is a thing he should be
 * able to find later, and because the floor is a fact about the mound rather than a preference.
 *
 * ★ SO THE FIX IS TO MAKE THE NUMBER MEAN WHAT A PERSON MEANS BY IT, not to pick a bigger number
 * that happens to fit. Same move as blocks-not-fractions above: a constant whose name and value
 * disagree with the thing being asked about is a trap for whoever tunes it next — and the person
 * tuning it next is Alex, who is measuring by eye from the door.
 */
const ROW_HALF_SPAN = ((SOCKET_KINDS.length - 1) / 2) * SOCKET_PITCH

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
function layoutAt(offset: number, seed: number, cfg: PlotConfig): CourtAnchor {
  const bearing = cfg.thresholdBearing + offset
  const cb = Math.cos(bearing), sb = Math.sin(bearing)
  const r = Math.max(1, edgeAt(cb, sb, seed, cfg) - COURT_INSET)
  const x = Math.round(cb * r)
  const z = Math.round(sb * r)
  return { x, z, y: plotHeight(x, z, seed, cfg), bearing }
}

/**
 * The half-circle, placed — the ONE derivation of where a socket stands.
 *
 * ⚠⚠ IT IS A SHARED FUNCTION BECAUSE THE ALTERNATIVE ALREADY BIT ME, IN THIS FILE, TODAY. The arc
 * landed while `nearestSocketAt` still measured a tangent ROW, so `courtAnchor` bisected an offset
 * that solved a layout nothing built any more: the ruled "nearest socket 15-20 blocks from the
 * seam" came out at **31-33 across every seed and tier**, and the constant still read 21. Two
 * derivations of one placement, agreeing right up until one of them changed — the hand-kept-mirror
 * shape this repo keeps paying for, and the oracle caught it in the first run.
 */
function placeArc(a: CourtAnchor, t: { x: number; z: number }): Socket[] {
  const toDoor = Math.atan2(t.z - a.z, t.x - a.x)
  const angles = socketArcAngles(SOCKET_KINDS.length)
  return SOCKET_KINDS.map((kind, index) => {
    // Apex sits directly opposite the door, so the keeper faces it walking in.
    const th = toDoor + Math.PI + angles[index]
    return {
      index, kind,
      x: Math.round(a.x + Math.cos(th) * COURT_RADIUS),
      z: Math.round(a.z + Math.sin(th) * COURT_RADIUS),
      facing: th + Math.PI,        // face the focus: the outward radial, reversed
    }
  })
}

/** Distance from the threshold to the closest socket of the arc `offset` would produce. */
function nearestSocketAt(offset: number, seed: number, cfg: PlotConfig): number {
  const a = layoutAt(offset, seed, cfg)
  const t = plotThreshold(seed, cfg)
  let best = Infinity
  for (const s of placeArc(a, t)) best = Math.min(best, Math.hypot(s.x - t.x, s.z - t.z))
  return best
}

export function courtAnchor(seed: number, cfg: PlotConfig = DEFAULT_PLOT): CourtAnchor {
  // ── ★★ SOLVED, NOT APPROXIMATED, AND THE REASON IS A MEASUREMENT ─────────────────────────────
  // The first version converted `COURT_ARC` to an angle by dividing by the coast radius. That is
  // exact only on a perfect circle, and this coast is not one: `edgeAt` wobbles with bearing, so the
  // court's radius differs from the seam's and the error is radial. Swept across eight seeds and
  // three tiers it put the nearest socket anywhere from **17.7 to 23.3 blocks** out — one seed fully
  // outside the 15-20 Alex ruled, while the constant still read 18.
  //
  // ★ SO THE ANGLE IS BISECTED UNTIL THE DISTANCE IS THE ONE ASKED FOR. `nearestSocketAt` is
  // monotonic in the offset over this range (the row only walks away from the seam), 30 halvings
  // resolve far below a block, and the whole thing is integer-rounded at the end anyway. The cost is
  // paid once per column-load, not per voxel.
  //
  // ⚠ AND IT MEASURES THE SOCKET, NOT THE ROW'S CENTRE. Measuring the centre is what put an arch six
  // blocks from the seam inside the threshold mound on all 24 seed×tier combinations while reading
  // as a comfortable 18.
  let lo = 0, hi = Math.PI / 2
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (nearestSocketAt(mid, seed, cfg) < COURT_ARC) lo = mid
    else hi = mid
  }
  return layoutAt((lo + hi) / 2, seed, cfg)
}

export interface SocketCell {
  x: number; y: number; z: number
  /** True for the 3×3 interior — the crossing itself. False for the jambs and lintel. */
  doorway: boolean
  /** The one cell that carries the socket's light: the middle of the lintel course. */
  lamp: boolean
}

export interface Socket {
  index: number
  kind: SocketKind
  /** Centre column of this socket's frame. */
  x: number; z: number
  /**
   * Which way THIS socket faces, in radians — toward the court's focus.
   *
   * ⚠ PER SOCKET, NOT SHARED. The straight row gave every frame the anchor's one bearing, which is
   * exactly what made it read as a fence: four arches all square-on to the same direction. On an
   * arc each frame turns to face the spot the keeper stands, so the station addresses the keeper
   * instead of the coast. Anything laying cells must ask the SOCKET, never the anchor.
   */
  facing: number
}

/**
 * The half-circle of sockets, standing around a focus and turned to face it.
 *
 * The anchor is the FOCUS — the spot the keeper stands to read the station — and the arc opens back
 * toward the threshold, so the walk from the door arrives into its mouth. See `socketArcAngles`
 * for why the gate takes the apex and for what canon asked for.
 */
export function sockets(seed: number, cfg: PlotConfig = DEFAULT_PLOT): Socket[] {
  // ★ THE ARC OPENS TOWARD THE DOOR, ASKED OF THE DOOR ITSELF. `a.bearing` is the direction from the
  // plot's CENTRE out to the court, which is not the direction the keeper walks in from — the court
  // is offset around the coast from the threshold, so the two differ by exactly the arc the whole
  // `COURT_ARC` bisection exists to place. Facing by the anchor's bearing would turn the station out
  // to sea on every seed, correctly and uselessly.
  return placeArc(courtAnchor(seed, cfg), plotThreshold(seed, cfg))
}

/**
 * ── ⚠ MIGRATION ONLY: the straight tangent row this replaced on 2026-08-27 ────────────────────
 * Cut stone the host has already laid does not move when the derivation does. `staleCourts` makes
 * exactly this argument for a fold that GROWS; a change of shape is the same event with the same
 * consequence, and without this a keeper who never widens their fold again keeps the old fence
 * standing beside the new arc forever.
 *
 * ⚠ IT REPRODUCES THE OLD MATH EXACTLY AND MUST NOT BE "TIDIED" TO MATCH THE NEW ONE. Its entire
 * job is to name cells the retired code would have placed, so that the clear pass can find them.
 * The day it agrees with `sockets()` it stops clearing anything and starts doing nothing quietly.
 * Delete it only when no save can still be carrying a tangent row — not before.
 */
export function legacyRowSockets(seed: number, cfg: PlotConfig = DEFAULT_PLOT): Socket[] {
  const a = courtAnchor(seed, cfg)
  const tx = -Math.sin(a.bearing), tz = Math.cos(a.bearing)
  const mid = (SOCKET_KINDS.length - 1) / 2
  return SOCKET_KINDS.map((kind, index) => {
    const off = (index - mid) * SOCKET_PITCH
    return {
      index, kind, facing: a.bearing,
      x: Math.round(a.x + tx * off), z: Math.round(a.z + tz * off),
    }
  })
}

/**
 * A frame's shape, by kind.
 *
 * ── ★★ THE GATE IS BUILT UNLIKE ITS NEIGHBOURS, AND CANON ASKS FOR THAT IN SO MANY WORDS ───────
 * `shimmer-geography.md` › THE GATE STATION: *"home-cost lives on the gate and nowhere else.
 * Calling the left arc 'gates' would quietly put a price on the free half of the travel layer — or,
 * worse, take it off the expensive one. The 08-15 watch item (a keeper who commutes to Rune Hold
 * freely spends it) is **served by the centre socket being visibly singular; render it unlike its
 * neighbours**."* The build gave every socket one frame and let the LAMP carry the whole
 * difference — so the one crossing that costs looked exactly like the three that are free.
 *
 * ⚠ NOT A DIFFERENT GRAMMAR, A BIGGER ONE. Canon also rules *"framed = tuned and kept by someone…
 * every socket on the station"*, so the gate may not be a bare spiral or anything else in kind —
 * it is the same arch, built taller and wider. A player reads *"that one is the important one"*
 * without being told, which is the whole point of the watch item.
 */
/**
 * ── ★★★ DEPTH IS WHY A TRILITHON READ AS A WALL WITH A HOLE IN IT (2026-08-27, Alex) ───────────
 * *"i was thinking more of a stone hedge look"* — and in PLAN this frame already was one: two
 * jamb columns carrying a lintel course, which is a trilithon. What it was missing is that it was
 * **one block thick**. A sheet of stone with a rectangle cut out of it reads as masonry however
 * you proportion it; a standing stone reads as a standing stone because you can see it has a SIDE.
 *
 * ★ AND DEPTH IS THE ONE AXIS THAT IS FREE. `SOCKET_PITCH` 8 with centres ~7.3 apart leaves about
 * one clear block beside the 7-wide gate frame, so WIDTH is spoken for and `COURT_RADIUS` /
 * `COURT_ARC` are Alex's ruled dials. Depth runs along the facing normal — perpendicular to the
 * arc — where a neighbour cannot be. So the henge is bought on the axis nothing else wants.
 *
 * `lintelDepth` overhangs the uprights for the same reason: a lintel proud of its posts is the
 * silhouette, and proud-in-depth costs nothing while proud-in-width costs the clearance we do not
 * have.
 *
 * ⚠ THE GATE KEEPS ITS +2 OVER A PASSAGE. `shimmer-geography.md` makes the centre socket's
 * singularity load-bearing (*"render it unlike its neighbours"*, serving the 08-15 home-cost watch
 * item), so every dial here moves BOTH kinds together and the gap is preserved on purpose. Canon's
 * own words: not a different grammar, a bigger one.
 *
 * ⚠ ALEX'S DIALS. Heights and depths are look, not law — turn them.
 */
const FRAME: Record<SocketKind, {
  half: number; height: number; doorHalf: number; doorHeight: number
  /** Blocks thick along the facing normal. 1 = the pre-08-27 sheet. */
  depth: number
  /** Thickness of the lintel course, which may overhang the uprights. >= depth. */
  lintelDepth: number
}> = {
  gate:    { half: 3, height: 7, doorHalf: 1, doorHeight: 4, depth: 2, lintelDepth: 3 },
  passage: { half: 2, height: 5, doorHalf: 1, doorHeight: 3, depth: 2, lintelDepth: 3 },
}

/** The deepest any frame reaches along its normal — what a clear pass and a fit check must cover. */
export const SOCKET_DEPTH = Math.max(...Object.values(FRAME).map(f => Math.max(f.depth, f.lintelDepth)))

/** The tallest frame on the station — what a footprint check has to leave room for. */
export const SOCKET_MAX_HEIGHT = Math.max(...Object.values(FRAME).map(f => f.height))
/** The widest half-span on the station. */
const SOCKET_HALF = Math.max(...Object.values(FRAME).map(f => f.half))

/**
 * Every cell one socket occupies: a frame one block thick with a walk-through doorway.
 *
 * ⚠ THIS USED TO SAY "same grammar as the Moonwell Glade arch on purpose — a crossing should read
 * as the same kind of built thing wherever the keeper meets one", and the 08-27 henge pass made
 * that FALSE: the station's frames are now thick with a proud lintel, and `gate.ts` is still the
 * one-block sheet both were copied from. Left divergent deliberately — Alex asked for the henge on
 * the STATION and the Glade arch is a different beat in a different place — but recorded here
 * rather than left as an accurate-sounding sentence that has stopped being true, which is the
 * failure mode this repo keeps paying for. If the Glade arch should follow, `gateCells` is the
 * same shape and the change is the same three lines.
 *
 * ── ★★★ IT STANDS ON THE GROUND NOW. IT USED TO STAND ONE COURSE INSIDE IT (2026-08-27) ────────
 * Alex: *"a straight line of **half buried** archs."* `groundY` is `plotHeight`, which is the
 * topmost SOLID block — the keeper stands at `groundY + 1`, which is what `plotThreshold` returns
 * and what `plotStandY` clamps to. Laying the frame's first course at `groundY` therefore buried it
 * by exactly one block on every socket, on every seed, at every tier: **measured 1 course buried
 * and a 3-high doorway walkable at 2.** An arch you duck through is not an arch.
 *
 * ⚠ `gate.ts` HAS THE SAME OFF-BY-ONE and it is fixed in the same pass. This is not a coincidence:
 * `gateCells` is where this frame's proportions were copied FROM, so the bug was inherited with the
 * shape. Whenever a derivation is copied, its defects are copied first — they are the part nobody
 * re-reads.
 *
 * ⚠ AND IT TAKES THE SOCKET'S OWN `facing`, not a shared bearing. On an arc every frame turns to
 * face the focus; a shared bearing is what made the old row a fence.
 */
export function socketCells(s: Socket, groundY: number): SocketCell[] {
  const f = FRAME[s.kind]
  const tx = -Math.sin(s.facing), tz = Math.cos(s.facing)
  // ── ★★ THE NORMAL POINTS AT THE KEEPER, SO DEPTH IS LAID BACKWARDS FROM IT ─────────────────
  // Measured, not assumed — my first version claimed the opposite in a comment and was wrong:
  // stepping 2 along `(cos, sin)` moves a socket from 10.0 to 8.0 blocks from the focus, so the
  // normal points INWARD, at the spot the keeper stands to read the arc.
  // ⚠ THAT MATTERS FOR MORE THAN A COMMENT. Extruding along +n would have grown every stone two
  // blocks INTO the walk, quietly turning `COURT_RADIUS` 10 into an 8-block court while its
  // docstring still said 10 — a dial that silently stops meaning what it measures, which is the
  // same defect `COURT_ARC` was fixed for on this very file. So `d` runs from -(depth-1) to 0:
  // **d = 0 is the face the keeper meets**, the radius keeps its meaning, and the stone thickens
  // away behind it.
  const nx = Math.cos(s.facing), nz = Math.sin(s.facing)
  const baseY = groundY + 1
  const cells: SocketCell[] = []
  // ⚠ DEDUPED BY CELL, NOT TRUSTED TO BE DISTINCT. `Math.round` on two different (h, d) pairs can
  // land on ONE voxel — the frame is turned to an arbitrary bearing, so its lattice does not line
  // up with the world's. A duplicate would be harmless to the host (it writes the same block twice)
  // and is NOT harmless to a count-based assert, which is exactly the shape this repo has been
  // caught by: a number that adds up for the wrong reason.
  const seen = new Set<string>()
  for (let h = -f.half; h <= f.half; h++) {
    for (let y = 0; y < f.height; y++) {
      const lintel = y >= f.doorHeight
      // ★ THE LINTEL'S EXTRA THICKNESS GOES ON THE FACE YOU CAN SEE. Uprights run [-(depth-1), 0];
      // the lintel keeps that back edge and reaches PAST d = 0 by whatever `lintelDepth` adds, so
      // it juts out over a keeper walking up to it. A lintel proud of its posts is the whole
      // silhouette of a trilithon, and proud-in-depth is free where proud-in-width is not.
      const back = -(f.depth - 1)
      const front = lintel ? f.lintelDepth - f.depth : 0
      for (let d = back; d <= front; d++) {
        const x = Math.round(s.x + tx * h + nx * d)
        const z = Math.round(s.z + tz * h + nz * d)
        const key = `${x},${baseY + y},${z}`
        if (seen.has(key)) continue
        seen.add(key)
        cells.push({
          x, y: baseY + y, z,
          // ⚠ THE DOORWAY IS AIR THROUGH THE WHOLE DEPTH. Flagging only the front face would leave
          // the stone behind it solid and turn a two-block-thick arch into a two-block-thick WALL
          // — the keeper walks into the opening and stops. Depth is the whole change here, so this
          // is the line that change could most easily get wrong.
          doorway: h >= -f.doorHalf && h <= f.doorHalf && y < f.doorHeight,
          // ★ ONE CELL CARRIES THE LIGHT: the middle of the lintel course, on the face the keeper
          // reads it from (d === 0). Lit and dark sockets are the SAME frame — canon rules every
          // socket on the station framed, because *"a frame is the tuning made physical"* and Greg
          // means to keep all of them. So the difference a keeper reads across the plot is the
          // lamp, not the architecture. ⚠ It must stay exactly ONE cell: `socketLit` drives it and
          // the host re-checks `c.lamp` per cell, so a lamp per depth layer would be N lanterns.
          lamp: h === 0 && y === f.height - 1 && d === 0,
        })
      }
    }
  }
  return cells
}

/**
 * ── ★★ WHAT MATERIAL ONE CELL WANTS — and this belongs HERE, not in the host ─────────────────
 * The file's header says it decides WHERE the court sits and WHICH cells belong to a frame vs a
 * doorway, and that `VoxelWorld.tsx` only lays the stone. The MATERIAL was the half that never
 * made the trip: the host held `held ? (doorway ? AIR : CUT_STONE) : AIR`, so the rule that an
 * unearned socket does not exist lived in a render file where no oracle could reach it.
 *
 * ⚠ THAT IS WHY MY FIRST VERSION OF THE PRE-PLACED ASSERT WAS DECORATION. `sockets()` has always
 * returned every socket, so *"every socket is placed regardless of reach"* was green before the
 * fix and after it — it asserted the list, while the defect was in the laying. Asking this function
 * instead means the assert fails if an unlit socket ever goes back to being air.
 */
export function socketMaterial(c: SocketCell, lit: boolean): number {
  if (c.doorway) return MAT.AIR          // the crossing itself is always walk-through
  if (c.lamp) return lit ? MAT.MANA_LANTERN : MAT.CUT_STONE
  return MAT.CUT_STONE                   // the frame stands whether the way is earned or not
}

/**
 * Every cell a clear pass must sweep for ONE socket site — deliberately wider than what
 * `socketCells` lays.
 *
 * ── ⚠⚠ A CLEAR PASS THAT ASKS THE CURRENT GEOMETRY CANNOT FIND THE PREVIOUS GEOMETRY ───────────
 * That is the trap this exists to close, and it is the mirror of the hand-kept-mirror bug: here the
 * two derivations MUST disagree. Stone already in the world was laid by the code that has just been
 * replaced — the 08-27 pass moved every frame off the tangent onto an arc AND lifted its base one
 * course out of the ground, so a sweep built from the new `socketCells` misses the old buried
 * course entirely and leaves a ring of half-sunk stone behind the new station.
 *
 * ★ SO IT SWEEPS A COLUMN RANGE, NOT A SHAPE: from the ground itself (where the buried course sat)
 * up past the tallest frame on the station, across the widest half-span. Bounded, and safe because
 * the host only ever clears CUT_STONE and MANA_LANTERN — a keeper's own build in that volume is
 * some other material and is left alone. ⚠ A keeper who built with cut stone inside a retired
 * court's footprint loses it; that is a real cost, accepted because the alternative is abandoned
 * architecture nobody can remove, and recorded here rather than discovered later.
 */
export function courtClearCells(s: Socket, groundY: number): { x: number; y: number; z: number }[] {
  const tx = -Math.sin(s.facing), tz = Math.cos(s.facing)
  const nx = Math.cos(s.facing), nz = Math.sin(s.facing)
  const out: { x: number; y: number; z: number }[] = []
  const seen = new Set<string>()
  for (let h = -SOCKET_HALF; h <= SOCKET_HALF; h++) {
    // From `groundY` (the pre-08-27 buried course) through the tallest frame's lintel.
    for (let y = 0; y <= SOCKET_MAX_HEIGHT; y++) {
      // ⚠⚠ AND ACROSS THE FULL DEPTH, INCLUDING d = -1. The 08-27 henge pass made frames thick
      // along the normal; a sweep built for the old SHEET would leave every layer behind the front
      // face standing, which is the abandoned-architecture failure this function's header exists to
      // prevent, one axis over. The extra course BEHIND the origin costs nothing and covers a frame
      // laid by any future derivation that straddles instead of extruding forward — the same
      // reasoning as starting at `groundY` to catch the buried course.
      for (let d = -1; d <= SOCKET_DEPTH; d++) {
        const x = Math.round(s.x + tx * h + nx * d)
        const z = Math.round(s.z + tz * h + nz * d)
        const key = `${x},${groundY + y},${z}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ x, y: groundY + y, z })
      }
    }
  }
  return out
}

/**
 * Bumped whenever the court's SHAPE changes, so placed stone is rebuilt without waiting for a fold
 * to widen.
 *
 * ★★ THE HOST KEYED ITS REBUILD ON THE TIER ALONE, and that was right for the only event that used
 * to move the court. A geometry change is the same event — the derivation moved, the stone did not
 * — and without this a keeper at their final tier would keep the straight buried row forever,
 * because the tier never changes again. `staleCourts`' own header makes this argument for growth;
 * this is that argument finishing its sentence.
 *
 * 1 = the tangent row (pre-2026-08-27). 2 = the half-circle, un-buried, gate at the apex.
 * 3 = the henge (2026-08-27): frames thick along the normal, a lintel proud of its posts, both
 *     kinds a course taller. A keeper who already stood a rev-2 court has SHEET frames in the
 *     world; without this bump they would keep them forever, since the tier never changes again
 *     once they are at their final fold.
 */
export const COURT_REV = 3

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
    for (const c of socketCells(s, h))
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
): { tier: number; anchor: CourtAnchor }[] {
  const t = Math.max(0, Math.min(PLOT_TIERS.length - 1, Math.round(tier || 0)))
  const here = courtAnchor(seed, plotForTier(t, base))
  // ★ THE TIER TRAVELS WITH THE ANCHOR SO THE HOST NEED NOT RE-DERIVE IT. Returning bare anchors
  // forced the caller to loop the tiers itself to find the sockets to clear — which is this
  // function's own staleness rule, restated in a second place, agreeing with it right up until one
  // of them changed. That is the hand-kept-mirror shape, and it nearly shipped here.
  const out: { tier: number; anchor: CourtAnchor }[] = []
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
    out.push({ tier: i, anchor: a })
  }
  return out
}
