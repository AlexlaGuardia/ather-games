// MAP METRICS — the authoring grammar for the CONTINUOUS half of the world.
//
// ★ PURE. No three, no react, no DOM. Every number here is DERIVED from the movement kit, so a
// map can be checked against the walker in a test instead of in a playtest.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────
// Canon ruled 2026-08-12 (`two-lines-two-games.md` › ONE STYLE, TWO MATERIALS): the Ather is
// quantized, Athernyx is continuous. Rune Hold, the Crucible and Expeditions all sit on the
// continuous side, so their geometry is AUTHORED rather than generated — and authored geometry
// can sit at any height, which is exactly the new failure mode. In the voxel garden a surface is
// at a whole or half block and the walker's verbs line up with the grid for free. Off the grid,
// nothing lines up unless someone makes it, and "someone" is this file.
//
// The look people mean by "Apex" is not polygon count. It is that every surface answers ONE
// question the same way every time: can I cross this without slowing down, can I take it with a
// press, or is it a wall? A map reads at a glance when its heights are drawn from a small set of
// tiers the movement kit actually produces. Author freehand and you get faces that LOOK vaultable
// and are not — which reads to a player as the controls being broken, not the map.
//
// ── THE SOURCE OF THE NUMBERS ────────────────────────────────────────────────────────────────
// The kit below is play3d's, Alex-tuned across the crucible sessions. It is restated here rather
// than imported because both existing copies are unimportable: `Shimmer3D.tsx` declares them as
// module-local `const`s in a .tsx, and `voxel3d/locomotion.ts` — which copied them — deliberately
// DIVERGES on FALL_OFF (0.55 there, 0.32 here) for half-block terrain that only exists in the
// Ather. Importing locomotion.ts would therefore import the wrong step for the mortal side.
// `metrics.test.ts` asserts this copy against BOTH, so a drift fails loudly instead of silently
// making every authored map wrong. That guard is the price of the third declaration; canon lists
// movement feel as unified across the seam, so the two halves agreeing is law, not tidiness.
//
// ⚠ ASSUMPTION, STATED: the ballistics below are pure (v² / 2g, no air drag), which matches the
// walker — it integrates gravity and applies friction only on the ground. AIR_CONTROL steers
// direction, not speed, so horizontal reach holds.

// ── ★ THE VERBS ARE UNIFIED. THE MANNEQUIN IS NOT. (found by this file's own guard, first run) ──
// Every SPEED and DISTANCE in the kit matches to the digit across both walkers — run, jump,
// gravity, slide, slide-hop, climb rise, mantle reach. The BODY does not:
//
//                     play3d          voxel3d          gap
//   standing eye      1.15            1.62             +41%
//   sliding eye       0.50            1.02             +104%
//   half-width        0.40            0.30             -25%
//
// This splits the file in two, and the split is load-bearing:
//   • KIT-derived tiers (gaps, ledges, apex, slide length) are SEAM-SAFE — same in both worlds.
//   • BODY-derived tiers (cover heights, lane widths, clearances) are walker-dependent, and cover
//     is the entire readability grammar of an arena. Authoring Rune Hold's cover against the wrong
//     eye would put every wall in the town at a height that reads correctly in one half of the
//     game and wrong in the other.
//
// ⚠ THE PICK, AND IT IS ALEX'S TO OVERTURN IN ONE LINE: the authoring body is the VOXEL walker's.
// It is human-scale (1.62 above the feet is exactly Minecraft's eye on a 1.8 body, against our
// BODY_H 1.75), it is the walker Alex actually plays daily, and the garden's terrain benching was
// tuned around it. play3d's 1.15 predates it and reads as a shorter mannequin at the same world
// scale. Nothing downstream hardcodes this — `coverTiersFor()` takes a body, so flipping the
// default re-derives every cover height in every map.

/** The movement VERBS — identical in both walkers. `metrics.test.ts` asserts that stays true. */
export const KIT = {
  RUN_SPEED: 6.5,
  SPEED_CAP: 14,
  GRAVITY: 22,
  JUMP_V0: 7.4,
  SLIDE_SPEED: 10,
  SLIDE_MIN_SPEED: 3.8,
  SLIDE_TIME: 0.6,
  SLIDEHOP_BOOST: 1.12,
  FALL_OFF: 0.32,
  CLIMB_MAX_RISE: 2.5,
  MANTLE_REACH: 1.4,
} as const

export interface Body {
  /** Camera height above the feet, standing. */
  eyeStand: number
  /** Camera height above the feet, mid-slide or crouched. */
  eyeSlide: number
  /** Half-width of the collider. */
  radius: number
}

/** The two mannequins, named so a map can be checked against either. */
export const BODIES = {
  voxel: { eyeStand: 1.62, eyeSlide: 1.02, radius: 0.3 },
  play3d: { eyeStand: 1.15, eyeSlide: 0.5, radius: 0.4 },
} as const satisfies Record<string, Body>

/** The body maps are authored against. See the ruling note above — one line to flip. */
export const BODY: Body = BODIES.voxel

// ── BALLISTICS ───────────────────────────────────────────────────────────────────────────────

/** Seconds airborne on a flat jump: 2·v₀/g. */
export const AIRTIME = (2 * KIT.JUMP_V0) / KIT.GRAVITY

/** Peak rise of a flat jump: v₀²/2g. ≈1.24 — which is why a 1-block step clears with a tap. */
export const JUMP_APEX = (KIT.JUMP_V0 * KIT.JUMP_V0) / (2 * KIT.GRAVITY)

/** How far a jump carries at a given takeoff speed. The gap tiers below are this, sampled. */
export function gapAt(speed: number): number {
  return Math.min(speed, KIT.SPEED_CAP) * AIRTIME
}

// ── GAP TIERS (horizontal) ───────────────────────────────────────────────────────────────────
// Three tiers, and the SPREAD between them is the design. A gap under GAP_RUN is free — anyone
// crosses it, so it is scenery, not a choice. Between GAP_RUN and GAP_SLIDEHOP is the only
// interesting band: it costs a slide-hop, which means it rewards a player who set up their speed
// three seconds earlier. Past GAP_CAP nothing crosses it and it reads as a boundary. Author the
// middle band on purpose and the map teaches its own movement tech.

/** Anyone at a standing run clears this. Free traversal. */
export const GAP_RUN = gapAt(KIT.RUN_SPEED)

/** Needs a slide-hop takeoff (slide floor × the hop's pop). The skill gap. */
export const GAP_SLIDEHOP = gapAt(KIT.SLIDE_SPEED * KIT.SLIDEHOP_BOOST)

/** The hard ceiling — nothing takes off faster than the speed cap. Beyond this is a boundary. */
export const GAP_CAP = gapAt(KIT.SPEED_CAP)

/**
 * Ground distance one slide covers. ★ THE MOST USEFUL NUMBER IN THIS FILE FOR STREET LAYOUT: a
 * corridor shorter than this cannot contain a slide, so sliding into it is punished rather than
 * rewarded and players stop trying. A lane meant to be slid needs at least this much straight
 * run, and a lane meant to be walked should be shorter than it.
 */
export const SLIDE_RUN = KIT.SLIDE_SPEED * KIT.SLIDE_TIME

// ── LEDGE TIERS (vertical, measured from the floor you leave) ────────────────────────────────

/** A step-down of at most this keeps you grounded — no fall state, no break in the run. */
export const STEP_FLOW = KIT.FALL_OFF

/** One block: the deliberate vault. A press, speed carried through. The staircase unit. */
export const LEDGE_VAULT = 1.0

/** Top reachable by jumping and grabbing: apex + mantle reach. The crate/balcony tier. */
export const LEDGE_MANTLE = JUMP_APEX + KIT.MANTLE_REACH

/** One grip's ceiling: jump, scramble up a face, grab the lip. Above this needs a route. */
export const LEDGE_CLIMB = JUMP_APEX + KIT.CLIMB_MAX_RISE + KIT.MANTLE_REACH

// ── SIGHT TIERS ──────────────────────────────────────────────────────────────────────────────
// Cover is a height RELATIVE TO AN EYE, and this kit has two eyes. That is the whole grammar:
// one wall can be cover to a sliding player and a shooting rest to a standing one, which is what
// makes an arena legible without a single label.

/** Cover tiers for an arbitrary mannequin — so a map can be swept against either walker. */
export function coverTiersFor(body: Body) {
  return {
    /** Breaks the line of a SLIDING player only. Kerbs, planters, low walls. */
    slide: body.eyeSlide,
    /** Breaks a STANDING line of sight. */
    stand: body.eyeStand,
    /** Blocks sight completely but is still climbable — the Apex crate. Cover AND a route. */
    full: LEDGE_MANTLE,
  }
}

// ── ★★★ THERE ARE NO PRE-COLLAPSED BODY-DERIVED CONSTANTS, AND THAT IS THE WHOLE FIX ─────────
// This file used to export `COVER_SLIDE` / `COVER_STAND` / `COVER_FULL` / `BODY_D` / `PASS_MIN` /
// `LANE_*` as module constants, each one `coverTiersFor(BODY)` or `2 * BODY.radius` resolved once at
// import. The header two screens up already explains that these tiers are **walker-dependent** and
// that the two mannequins differ by up to 104% — so those exports answered, context-free and
// silently, a question that has two answers.
//
// ★ THE PARAMETERISATION WAS ALWAYS CORRECT; THE COLLAPSE IS WHAT WAS WRONG. `coverTiersFor()` has
// taken a body since the file was written, and line 54 says so. A caller who wrote `COVER_STAND`
// still got one body, with nothing at the call site to suggest a choice had been made on their
// behalf. **A value that differs by context must not be reachable as a context-free import** — that
// is the module-constant trap this codebase has now paid for four times in two days (a save slot
// cached at import pinning a tab to the anonymous purse; a profiler row that was one name over two
// regions; a secret read as a module constant posting an empty key).
//
// ⚠ SO THEY ARE DELETED RATHER THAN KEPT ALONGSIDE THE FUNCTIONS. Keeping them "for convenience"
// leaves the footgun loaded and pointed at exactly the person who does not yet know there are two
// bodies. Every caller now names a body, and naming it is one word.
//
// ⚠⚠ WHAT THIS DELIBERATELY DOES **NOT** DECIDE: which body a given space is authored against.
// `BODY` above is unchanged and still the default pick, still Alex's to overturn in one line. It was
// tempting to key the body off the SPACE — mortal side asks for play3d's, Ather side for voxel's —
// and canon's two-materials ruling makes that sound derivable. It is not: this file's own note says
// play3d's 1.15 *"predates it and reads as a shorter mannequin at the same world scale"*, and GBOARD
// records the divergence as **"an open question, not a fact to enshrine."** Keying cover off the
// space would enshrine a possibly-stale mannequin as a design principle, invisibly, inside a
// refactor. De-pinning is a bug fix; choosing per space is a decision, and it is not this commit's.

/** Body diameter. Nothing passable may be narrower. */
export const bodyDiameter = (body: Body): number => 2 * body.radius

/**
 * Width tiers for an arbitrary mannequin — the counterpart to `coverTiersFor`.
 *
 * ★ A ONE-BLOCK WALL IS THE ARENA'S PIVOT PIECE AND ITS READ DEPENDS ON THE BODY. Against the
 * voxel mannequin (eyeSlide 1.02) a 1.0 wall sits just UNDER the sliding eye and well under the
 * standing one — so it reads as a shooting rest either way, and true slide-cover starts at ~1.1.
 * Against play3d's shorter body it is the classic waist-high piece (hide sliding, shoot standing).
 * That piece is what a street is built out of, and it changes character with the mannequin.
 */
export function widthTiersFor(body: Body) {
  const d = bodyDiameter(body)
  return {
    /** Body diameter. Nothing passable may be narrower. */
    bodyD: d,
    /** Minimum passable gap — body plus clearance, so a slide does not catch a shoulder. */
    passMin: d + 0.1,
    /** Single-file. One player flows, two collide — the pinch that makes a flank cost something. */
    laneSingle: d * 2,
    /** Two abreast. A street a squad moves down without breaking formation. */
    lanePair: d * 4,
    /** A main street / arena floor: room for lurch and slide-hop to be used. */
    laneStreet: d * 8,
  }
}

/**
 * Everything an authoring pass needs for one mannequin, asked once.
 *
 * ★ ONE CALL SO A MAP CANNOT MIX BODIES HALFWAY THROUGH. Asking `coverTiersFor(a)` in one place and
 * `widthTiersFor(b)` in another is the collapse bug rebuilt by hand, one function lower — a town
 * whose walls suit one walker and whose doorways suit the other, with every assert green.
 */
export function metricsFor(body: Body) {
  return { body, cover: coverTiersFor(body), widths: widthTiersFor(body) }
}

// ── THE CLASSIFIER ───────────────────────────────────────────────────────────────────────────

export type FaceRead =
  | 'flow'      // crossed at speed, no input
  | 'ambiguous' // ★ the dead band — see below
  | 'vault'     // one press, speed carried
  | 'mantle'    // jump + grab
  | 'climb'     // scramble + grab; one grip
  | 'wall'      // boundary: needs an authored route

/**
 * What a face of this height READS as to the walker. This is the oracle hook: a map's geometry
 * can be swept and every face asserted to land on a tier the player has a verb for.
 *
 * ★ THE AMBIGUOUS BAND IS THE POINT, AND IT IS NEW TO THE CONTINUOUS SIDE. A face between
 * STEP_FLOW and LEDGE_VAULT is too tall to cross at speed and too short to read as an obstacle.
 * The voxel garden CANNOT produce one — surfaces there sit at whole or half blocks, and the
 * walker's step band was widened to 0.55 precisely so a half-block is a step in both directions.
 * Authored geometry produces them constantly and by accident: a kerb at 0.4, a doorstep at 0.6, a
 * terrace lip at 0.8. Each one stops a run dead for no reason the player can see, and the player
 * blames the controls. Sweep for these before blaming the movement kit.
 */
export function readsAs(height: number): FaceRead {
  if (height <= STEP_FLOW) return 'flow'
  if (height < LEDGE_VAULT) return 'ambiguous'
  if (height <= LEDGE_MANTLE) return height <= LEDGE_VAULT ? 'vault' : 'mantle'
  if (height <= LEDGE_CLIMB) return 'climb'
  return 'wall'
}

/**
 * Snap an authored height to the nearest tier the walker actually has a verb for. Use when
 * placing geometry: author the intent, run it through here, and the map cannot grow a dead face.
 */
export function snapHeight(height: number, body: Body): number {
  // ⚠ THE BODY IS REQUIRED, AND IT USED TO BE INVISIBLE. This ladder contains the STANDING EYE, so
  // it is body-dependent — and it read `COVER_STAND`, the pinned constant. `snapHeight` is the
  // function a map-authoring pass actually calls on every piece of geometry it places, which made
  // it the single highest-traffic place the wrong mannequin could enter a town, silently, one
  // snapped face at a time. Everything else in the ladder is kit-derived and seam-safe.
  const tiers = [0, STEP_FLOW, LEDGE_VAULT, coverTiersFor(body).stand, LEDGE_MANTLE, LEDGE_CLIMB]
  return tiers.reduce((best, t) => (Math.abs(t - height) < Math.abs(best - height) ? t : best), 0)
}

/**
 * ⚠ OPEN — the free step-UP on the continuous side is unverified. `FALL_OFF` governs stepping
 * DOWN, and it is measured. Going up, play3d eases onto a resolved floor (`Shimmer3D.tsx:1476`)
 * whose resolver reads TILE TIERS, so what a mesh collider will accept as a free rise is not
 * established — there is no continuous collider yet. STEP_FLOW is used symmetrically above
 * because that is the conservative read (a rise no larger than a free drop cannot surprise
 * anyone), but it is an assumption, not a measurement. Re-derive when the mesh collider lands.
 */
export const STEP_UP_VERIFIED = false
