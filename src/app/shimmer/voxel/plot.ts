// The Home Plot's ground — a bounded island of green walled in cloud, floating in a starry dark.
//
// ★ PURE CORE. No react/three/DOM, no host imports. Same contract as `depth.ts`/`trees.ts`.
//
// ── ★ WHY THIS IS A SEPARATE GENERATOR AND NOT A BIOME ───────────────────────────────────────────
// Canon (RULED 2026-08-13, `CANON_GAPS.md` › *Is the garden one contiguous ground, or POCKETS?*):
// **"plots are AUTHORED and BOUNDED; the folds are PROCEDURAL and endless."** `spirit-tales-bible.md`
// has said since 2026-06-02 that plots are *"warm dream-islands of green walled in cloud, floating
// in a starry dark,"* joined by passages, and that **"you do not cross the void."**
//
// The continuous generator in `height.ts`/`depth.ts` is the exact opposite of all of that: endless,
// procedural, and by construction it has no edge. Every knob it owns — rivers, biome bands, the
// story road, holds, ore batches, the carver — is a statement about a world that keeps going. A
// bounded island is not that world with a smaller number in it; **the boundary is the whole design**,
// and expressing it as a biome would mean teaching a dozen continent systems to stop at a line they
// have no concept of. So: its own module, its own entry point, and the continent's stages simply
// never run here.
//
// ── ★ WHAT THIS DELIBERATELY DOES NOT GENERATE, AND WHY IT IS NOT AN OMISSION ────────────────────
// **No ore. No caves. No respawning anything.** `engine/spawn-board.ts` already ruled the line and
// Alex reversed the first cut to get there: *"a home plot that refills itself is a farm you never
// have to leave, which quietly defeats a world that re-deals at all… HOME is where you grow things,
// WILD is where you gather them."* A plot that pays out materials would collapse the wilds loop this
// island exists to serve. Anything standing on the plot got carried here.

import { value2, fbm2 } from './noise'
import { AIR } from './section'

/**
 * The materials a plot is built from, supplied by the caller rather than imported.
 *
 * ★ THE PRECEDENT IS `plantWaystones(…, stoneMat, lanternMat)`, and the reason is the same: a pure
 * generator that hardcodes palette ids owns a piece of the registry it cannot see. Passing them in
 * also means this module ships and is fully testable BEFORE the cloud-wall material is registered —
 * which matters here, because that registration touches four files another window is live in.
 */
export interface PlotMaterials {
  /** The tended surface. */
  topsoil: number
  /** Under the turf. */
  subsoil: number
  /** The island's rock body. */
  stone: number
  /**
   * The keel — pressed cloud, HARD. `world/mother.md`: mana *"cools as it sinks, compresses as it
   * deepens."* Unbreakable by registry, which is what stops a keeper mining a hole out of the bottom
   * of their own island into the void.
   */
  floor: number
  /**
   * The rim — pressed cloud, SOFT. `spirit-tales-bible.md`: the walls ringing every plot are *"the
   * cloud-ocean itself, held back and pressed soft and glowing."*
   *
   * ⚠ SOFT AND HARD ARE TWO MATERIALS, NOT ONE USED TWICE, and canon is explicit about it —
   * `depth.ts`'s own PACKED_CLOUD note says *"pressed soft at the walls, pressed hard at the floor."*
   * A caller may pass the same id for both today; the SHAPE below is already correct for two.
   */
  wall: number
}

export interface PlotConfig {
  /**
   * ★ THE FOLD'S EXTENT — how far the keeper may build, AND where the ground ends, AND where the
   * cloud-wall stands. One number, because since 2026-08-16 they are one edge (see `edgeAt`).
   *
   * ★ HOW FAR THE KEEPER MAY BUILD, AND THIS MODULE IS DELIBERATELY AGNOSTIC ABOUT WHAT RAISES IT.
   *
   * Canon ruled that **liberation** decides ground and **resources** decide what stands on it; Alex's
   * plot design instead buys ground with blocks. That question is live (`CANON_GAPS.md`, 2026-08-15)
   * and **this generator does not need it answered** — the cap arrives as a number. Whichever way it
   * rules, nothing in this file changes. Do NOT teach it where the number came from.
   */
  capRadius: number
  /** Altitude of the plot's ground plane — the island sits at a fixed height in its own space. */
  baseY: number
  /** Peak-to-trough of the surface roll, in blocks. A tended garden, not wild terrain. */
  roll: number
  /** Rock+cloud thickness under the surface at the island's centre. Tapers to nothing at the rim. */
  keel: number
  /** How much of the keel's underside is cloud rather than rock. */
  cloudBand: number
  /** Thickness of the cloud wall ring, in blocks. */
  wallWidth: number
  /** How far the wall stands above the ground plane. */
  wallHeight: number
  /** Depth the wall sinks below the ground plane, so it reads as held rather than balanced. */
  wallSkirt: number
  /** How much the island's edge wanders, as a fraction of capRadius. Never grows it — see `edgeAt`. */
  wobble: number
  /** Bearing from centre to the threshold, in radians. */
  thresholdBearing: number
  /** How far INSIDE the coast the threshold stands, in blocks. The wall is what you face. */
  thresholdInset: number
  materials: PlotMaterials
}

/**
 * A first plot.
 *
 * ⚠ EVERY NUMBER HERE IS A FIRST GUESS AND IS MINE (build tuning, per the 08-13 boundary note:
 * *"Pocket size/shape, passage rendering + loading, how the void looks on screen, expansion pacing,
 * costs, every number = Jin's"*). They are set to be walked and argued with, not defended.
 *
 * `capRadius` 30 gives a ~60-block starting garden, walled at its coast. It was ~40 with a ten-block
 * moat of void around it until 2026-08-16; the moat is gone, so the same number now buys usable
 * ground instead of a gap. Still small enough to read at a glance, which is the fantasy ("your
 * corner of the Ather to tend"), and small enough that expansion is felt immediately.
 *
 * ⚠ THE OLD LINE HERE — *"the gap between them is the invitation"* — DESCRIBED THE BUG. The gap was
 * a ten-block ring of void the keeper could neither build on nor cross, and it is what put the
 * passage out of reach. Expansion is now felt by the **wall moving out**, not by a moat filling in.
 *
 * ★ THE FULLY-GROWN PLOT IS SIZED AGAINST THE ONE THAT SHIPPED. The old tilemap home plot was
 * 150x150 (`world/region-maps/home-plot.json`), so a cap of ~72 lands the endgame island on roughly
 * the same footprint players already had. Continuity by arithmetic rather than by accident.
 */
export const DEFAULT_PLOT: PlotConfig = {
  capRadius: 30,
  baseY: 96,
  roll: 2,
  keel: 14,
  cloudBand: 5,
  wallWidth: 2,
  wallHeight: 9,
  wallSkirt: 4,
  wobble: 0.18,
  thresholdBearing: 0,
  // ⚠ BLOCKS, not a fraction — 2 puts the keeper's back two paces off their own wall, close enough
  // that the passage is plainly what they are standing at. See `plotThreshold` for why the old
  // fractional inset was actively wrong once the fold can grow.
  thresholdInset: 2,
  materials: { topsoil: 5, subsoil: 4, stone: 3, floor: 1, wall: 1 },
}

/** Distance from the plot's centre. The plot's own space, so the centre is the origin. */
export const distFromCentre = (x: number, z: number): number => Math.hypot(x, z)

/**
 * The island's edge at the bearing of (x, z), in blocks from centre.
 *
 * ★ THE WOBBLE ONLY EVER CUTS IN, NEVER OUT, and that is load-bearing rather than cosmetic. `cap`
 * is a promise about how far the keeper may build, and an edge that wandered PAST `capRadius` would
 * make the generated ground contradict the promise at some bearings — ground outside the buildable
 * region, which reads as a bug and cannot be filled or removed sensibly. So the noise scales a
 * radius DOWN from the maximum. The island is organic; the bound is exact.
 */
// ── ★★ ONE CURVE. THE GROUND ENDS WHERE THE WALL BEGINS (Alex, 2026-08-16) ──────────────────────
// The island used to stop at `coreRadius` 20 with the wall out at 30, leaving a **ten-block ring of
// void** between the ground and the fold's edge — and the threshold sat at 12, another twenty blocks
// short of it. So the keeper's own front door could not be walked to at all. Alex, describing what
// it should have been: *"island sits in the cloud bubble resting against the cloud wall so it can
// reach the passage."*
//
// **Canon had already said so, and the build had drifted from it.** The bible: plots are *"ringed by
// walls of cloud… Plots connect to one another by passages — **gates and gaps breached through the
// cloud-walls**."* A passage is a gap **through the wall**. A door standing in the middle of a field
// with the wall twenty blocks away is not that, and it is why the plot-side seam had no surface to
// be parallel to and had to billboard.
//
// So `coreRadius` is GONE and this is the only boundary the plot has: ground fills to it, the wall
// starts at it, and the build limit is it. Three things that had to agree now cannot disagree,
// which is the same reasoning `withinCap` used to give for being a separate circle — turned around,
// because under one curve there is nothing left to keep in sync.
//
// ⚠ CONSEQUENCE ALEX SHOULD FEEL: the starting garden went from ~40 blocks across to ~60. That is
// `capRadius` and it is one number to dial, not a shape to rebuild.
export function edgeAt(x: number, z: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT): number {
  const d = distFromCentre(x, z)
  if (d === 0) return cfg.capRadius
  // Sample on the unit circle so the noise is a function of BEARING only — otherwise the edge
  // ripples with distance too and the island's outline stops being a closed curve.
  const n = fbm2((x / d) * 2.3, (z / d) * 2.3, seed ^ 0x9107, 3)
  return cfg.capRadius * (1 - cfg.wobble * n)
}

/** Is this column inside the generated island? */
export const insideCore = (x: number, z: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT): boolean =>
  distFromCentre(x, z) <= edgeAt(x, z, seed, cfg)

/**
 * How close to the coast this column is: **0 deep inland, 1 at the very edge.**
 *
 * ── ★★ THE ONE THING THAT MAKES GROWING A FOLD SAFE (2026-08-16) ────────────────────────────────
 * Both the surface roll and the keel used to fade on `distFromCentre / edgeAt` — a FRACTION of the
 * radius. That is invisible while an island's size is fixed, and became a real bug the moment the
 * ground started filling to a wall that moves: a bigger fold had a deeper belly and a different
 * surface **everywhere**, so growing changed terrain under ground the keeper had already built on.
 * Measured on a +18 growth before the fix: **87.7% of columns changed keel depth, 18.4% changed
 * surface altitude.** The save is a diff against generated material, so all of that is edits
 * silently re-interpreted against ground that moved.
 *
 * Measured from the coast in BLOCKS, everything more than `keel` blocks inland is pinned at 0 and
 * **cannot move when the fold grows.** Growth becomes additive: a ring around the old shoreline
 * thickens into field, and nothing else changes.
 *
 * ⚠ ONE DEFINITION FOR BOTH, deliberately. They are the same question — *"how near the edge am
 * I"* — and two copies of it drift the first time one is retuned.
 */
export function coastT(x: number, z: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT): number {
  const e = edgeAt(x, z, seed, cfg)
  if (e <= 0) return 1
  const bevel = Math.max(1, Math.min(cfg.keel, e))
  return 1 - Math.min(1, Math.max(0, e - distFromCentre(x, z)) / bevel)
}

/**
 * May the keeper place a block in this column?
 *
 * ★ EXPORTED BEFORE IT IS WIRED, ON PURPOSE. The placement gate is a host concern and lands later,
 * but the *rule* belongs beside the geometry that has to agree with it. Anything else invents a
 * second definition of "the plot's extent" in the host, and the two drift the first time the wall
 * moves.
 *
 * ⚠ IT USED TO BE A PERFECT CIRCLE ON PURPOSE — *"the fold's boundary is a made thing and reads as
 * one, against ground that reads as grown"* — and that reversed on 2026-08-16. It was a good line
 * while the ground stopped ten blocks short of the wall and the two edges were separate objects you
 * could see between. Once the ground fills to the wall they are **the same edge**, so a circle here
 * and a wobble there would mean the buildable limit and the ground disagreeing by up to `wobble` of
 * the radius — a keeper refused a block on ground they are standing on. One curve, no argument.
 */
export const withinCap = (x: number, z: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT): boolean =>
  distFromCentre(x, z) <= edgeAt(x, z, seed, cfg)

/**
 * ── ★ HOW MANY CHESTS ONE FOLD HOLDS (2026-08-15, Alex's spec: "10 per plot", tied to plot tier) ─
 *
 * **A chest for every three blocks of cap radius.** At the starting cap of 30 that is 10, which is
 * the number Alex asked for; a fully-grown plot (~72) holds 24. So storage is not a separate reward
 * track that has to be designed and balanced on its own — **it is the SAME number that decides how
 * far you may build**, which means whatever raises your ground raises what you can keep on it, in
 * one motion and with nothing to keep in sync.
 *
 * ⚠ AGNOSTIC ABOUT WHAT RAISES IT, exactly like `capRadius` itself — see that field's note. The
 * ground-versus-resources question is live in `CANON_GAPS.md` and this function does not need it
 * answered: it takes a config and returns a number, and rules either way without changing.
 *
 * ⚠ AND IT IS A PLOT RULE, NOT A WORLD RULE. Chests in the Wilds are uncapped, because the Wilds is
 * not a thing you are given — the scarcity here is the fold's, and it is what makes a bigger fold
 * worth having. A keeper who wants a hundred containers can have them; they just cannot have them
 * at home, where it is safe and warm and one step from the bench.
 */
export const chestCap = (cfg: PlotConfig = DEFAULT_PLOT): number =>
  Math.max(1, Math.floor(cfg.capRadius / 3))

/**
 * Is this column in the cloud-wall ring that marks the fold's edge?
 *
 * ⚠ IT STARTS AT `edgeAt`, NOT AT `capRadius` — the wall stands directly on the coast. Keyed to the
 * bare radius while the ground wobbled inside it, this would leave a **crescent of void between the
 * grass and the wall** on every bearing the edge cut in — a gap you could fall through, on the one
 * ground canon says holds you. The whole point of the 08-16 layout is that there is nothing between
 * the two.
 */
export const inWall = (x: number, z: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT): boolean => {
  const d = distFromCentre(x, z)
  const e = edgeAt(x, z, seed, cfg)
  return d > e && d <= e + cfg.wallWidth
}

/**
 * Surface altitude of the plot's ground at this column, or `null` where there is no ground.
 *
 * A gentle two-octave roll around `baseY`. Flat enough to build on and to read as tended; not so
 * flat it is a table. ⚠ The roll is faded out toward the rim so the edge meets the keel at a
 * predictable altitude — an island whose lip wanders vertically makes the drop-off read as ragged
 * damage rather than as an edge.
 */
export function plotHeight(
  x: number, z: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT,
): number | null {
  if (!insideCore(x, z, seed, cfg)) return null
  // ⚠ SAME COAST-RELATIVE RULE AS THE KEEL, AND FOR THE SAME REASON. This was `d / edgeAt` too, so
  // growing the fold re-rolled the surface of ground the keeper was standing on — 18.4% of existing
  // columns changed altitude on a +18 growth. `coastT` is the one definition both use.
  const t = coastT(x, z, seed, cfg)
  const fade = 1 - t * t                       // full roll inland, flat at the lip
  // ── ★★ THE ROLL RISES FROM `baseY`; IT NEVER DIPS BELOW IT (2026-08-16, canon-required) ────────
  // It used to be `(n - 0.5) * roll * 2` — noise centred on the ground plane, so the surface rolled
  // BOTH WAYS around `baseY`. Growing the fold raises `fade`, which then moved a column's surface in
  // whichever direction its noise happened to sit: measured on a +18 growth, **257 columns lost a
  // block of ground.** Any keeper who had built there is left standing on air.
  //
  // Canon ruled the guard the same day (`shimmer-geography.md` › *the old shoreline becomes field*):
  // expansion may reshape the COAST, it may **never reach the interior a keeper built** — and the
  // reason given is not aesthetic. *"A player who learns that expanding costs them their base stops
  // expanding, and the whole grimoire-ledger arc dies with it."*
  //
  // ★ THE `keel`-BAND INVARIANCE IS NOT ENOUGH ON ITS OWN, WHICH IS WHY THIS EXISTS. That protects
  // ground well inland; a keeper may build right up to their shore, and the shore is exactly where
  // growth churns. **Making growth ADDITIVE covers everywhere at once**: the surface only ever rises
  // as the coast moves out, the keel only ever deepens, so no cell that was solid becomes air. A
  // build near the old shore gets filled in UNDER it, never dropped out from beneath it.
  //
  // ⚠ Costs a garden that dips below its own plane — `baseY` is the floor of the roll now, not its
  // mean. That is the whole price, and it buys "expanding never takes your work".
  const n = fbm2(x / 19, z / 19, seed ^ 0x50a7, 2)
  return Math.round(cfg.baseY + n * cfg.roll * fade)
}

/**
 * How thick the island is under its surface at this column.
 *
 * A lens: deepest at the centre, tapering to nothing at the lip, so the underside reads as a keel
 * rather than as a cylinder that was cut off. `sqrt(1 - t^2)` is the ellipse, which falls away
 * slowly near the middle and steeply at the edge — the profile a floating island wants.
 */
export function keelDepth(
  x: number, z: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT,
): number {
  const e = edgeAt(x, z, seed, cfg)
  if (e <= 0) return 0
  // ── ★★ THE TAPER IS MEASURED FROM THE COAST IN BLOCKS, NOT AS A FRACTION OF THE RADIUS ────────
  // It used to be `d / edgeAt`, which was invisible while the island's size was fixed and became a
  // real bug the moment growing the fold grew the ground (2026-08-16). A proportional taper means
  // raising the cap makes the belly deeper EVERYWHERE — measured on a +18 growth: **87.7% of the
  // existing island's columns changed keel depth**, while the surface held on 82% and the centre
  // column was bit-identical. The save is a DIFF against generated material, so every one of those
  // is a keeper's edit silently re-interpreted against terrain that moved under it.
  //
  // Measured from the coast instead, everything more than `bevel` blocks inland is at full depth
  // and **cannot change when the fold grows** — growth becomes additive. What does change is the
  // ring around the OLD coast, and that is the feature rather than the damage: your old shoreline
  // is inland now, so it thickens into field.
  //
  // ⚠ IT COSTS THE LENS ON A BIG PLOT, AND THAT IS THE TRADE. A young island is nearly all bevel and
  // still reads as a lens from below; a fully-grown one is a flat-bottomed disc with a rounded rim.
  // Invariance wins because the alternative is silent save damage on an ordinary gameplay action —
  // but if the underside ever needs to look domed again, `bevel` is the dial, and the cost is
  // written down here rather than rediscovered.
  const t = coastT(x, z, seed, cfg)
  // A little noise so the belly is not a perfect machined dome.
  const bump = (value2(x / 11, z / 11, seed ^ 0x0ee1) - 0.5) * 2
  return Math.max(1, Math.round(cfg.keel * Math.sqrt(Math.max(0, 1 - t * t)) + bump))
}

/**
 * The solid span of a ground column: `bottom` and `top` inclusive, exactly `keelDepth` voxels tall.
 *
 * ★ EXPORTED SO NOTHING RE-DERIVES IT. The keel's arithmetic is off-by-one bait, and a test that
 * recomputes `h - depth` independently is not checking the generator, it is checking that two
 * copies of the same guess agree. One definition, and the oracle asks it the same question the
 * mesher will.
 */
export function columnSpan(
  x: number, z: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT,
): { bottom: number; top: number } | null {
  const h = plotHeight(x, z, seed, cfg)
  if (h === null) return null
  // ⚠ THE BOTTOM HANGS FROM `baseY`, NOT FROM `h` — the last four voxels of the additive-growth fix
  // (2026-08-16). Anchored to the surface, raising a column by one block lifted its whole keel and
  // emptied the cell underneath: ground removed, by a change whose entire point was to add some.
  // Hung from the ground PLANE, a rising surface can only stack soil on top of a keel that stays
  // put, and `keelDepth` itself only ever deepens as the coast moves out. Both directions additive.
  return { bottom: cfg.baseY - keelDepth(x, z, seed, cfg) + 1, top: h }
}

/**
 * What is at (x, y, z) in the plot's own space?
 *
 * ★ ORDERED PREDICATE LIST, FIRST MATCH WINS — the same shape as `depth.ts`'s rule, for the same
 * reason: it is O(1) at any y, so a chunk builder can fill any section in any order without walking
 * a column. The order below IS the design: wall beats air (it stands over the void), ground beats
 * wall (the ring never eats the garden it rings).
 *
 * ★★ AND THE CLOUD BAND IS TESTED BEFORE THE SOIL, WHICH IS NOT THE OBVIOUS ORDER. Written the
 * intuitive way — turf, subsoil, then whatever is left — the soil layers eat the entire keel on the
 * thin rim columns, and 31 of them came out with no cloud underneath at all. Those are exactly the
 * columns a keeper can stand on at the lip, so the island had a ring of ordinary diggable dirt with
 * the VOID directly beneath it. The floor material's `hardness: Infinity` is the only thing stopping
 * a keeper mining out of the bottom of their own plot, and it protects nothing if the soil rule
 * outranks it. **The keel is a floor first and a surface second.**
 *
 * The visible consequence is a feature rather than a cost: at the very lip, where the island is
 * thinner than `cloudBand`, cloud wins the whole column — so the green fades into the cloud it was
 * pressed out of, which is what *"islands of green walled in cloud"* describes anyway.
 */
export function plotMaterialAt(
  x: number, y: number, z: number, seed: number, cfg: PlotConfig = DEFAULT_PLOT,
): number {
  const m = cfg.materials
  const h = plotHeight(x, z, seed, cfg)

  // 1. The cloud wall — a ring standing on nothing, outside the buildable cap.
  if (h === null && inWall(x, z, seed, cfg)) {
    if (y <= cfg.baseY + cfg.wallHeight && y >= cfg.baseY - cfg.wallSkirt) return m.wall
    return AIR
  }

  // 2. Outside the island: the void. ★ EMPTY ON PURPOSE — canon calls the void "not unbuilt space,
  //    not to be dressed with scenery so it looks finished. Cloud-wall, then dark, then stars."
  //    Anything returned here is a decision to contradict that.
  if (h === null) return AIR

  // 3. Above the ground, and below the keel: the void either way.
  if (y > h) return AIR
  const bottom = cfg.baseY - keelDepth(x, z, seed, cfg) + 1   // see `columnSpan` — hung from the plane
  if (y < bottom) return AIR

  // 4. The keel, FIRST — see the note above. This is the floor of the plot and it outranks the turf.
  if (y < bottom + cfg.cloudBand) return m.floor

  // 5. Then the turf and what is under it, in whatever depth the keel left.
  if (y === h) return m.topsoil
  if (y >= h - 2) return m.subsoil
  return m.stone
}

/**
 * ── ★ THE THRESHOLD — where the keeper's fold opens, and where the island catches them ──────────
 *
 * Canon (`game/shimmer-geography.md:268`): *"the spot where a keeper's personal fold opens."* It is
 * one place doing two jobs, and the second is why it belongs in the generator rather than in a save:
 *
 * **★ YOU CANNOT FALL OUT OF YOUR OWN FOLD** (ruled 2026-08-15): *"a keeper who goes over the edge is
 * not falling out of the world — they are falling through their own fold, which returns them to
 * their threshold. No death, no fall damage, no dropped inventory… The fall is a soft return, never
 * a penalty."* So the threshold is the one coordinate on the island that must ALWAYS be a safe place
 * to stand, and it has to exist before any save does — a keeper falls off on their first day.
 *
 * ⚠ IT IS DERIVED, NOT STORED, and that is deliberate. A stored threshold is a coordinate that can
 * disagree with the terrain (a save from before a generator change returns the keeper into rock, or
 * into the void). Derived from the same functions that build the ground, it cannot.
 */
export function plotThreshold(
  seed: number, cfg: PlotConfig = DEFAULT_PLOT,
): { x: number; z: number; y: number } {
  // ── ★★ AT THE WALL, WHICH IS THE WHOLE 2026-08-16 CHANGE ────────────────────────────────────
  // It used to sit at 0.62 of the old `coreRadius` — twelve blocks out, with the wall another
  // twenty beyond that and nothing but void in between. The keeper arrived in the middle of a field
  // and there was no passage to walk to. Now it stands `thresholdInset` blocks INSIDE the coast,
  // with the cloud-wall directly in front of them: you walk up to the wall and step through the gap,
  // which is the same gesture as the Wilds side and what canon means by *"gaps breached through the
  // cloud-walls."*
  //
  // ★ AND THE OLD GUARD AGAINST THIS IS NOW MOOT RATHER THAN IGNORED. The reason for the inset was
  // that *"a threshold that lands on the rim would put the soft return one step from the drop it
  // just caught the keeper from."* True while the rim was a lip over the void — but the wall now
  // stands ON the coast, so the edge is not a drop you can walk off; it is a wall you bump into.
  // The failure that inset was defending against cannot happen on this geometry.
  //
  // ⚠ INSET IS IN BLOCKS NOW, NOT A FRACTION OF THE RADIUS. As a fraction it silently walked the
  // door further from the wall every time the fold grew — the arrival would have drifted inland as
  // the keeper expanded, which is exactly backwards.
  const b = cfg.thresholdBearing
  const e = edgeAt(Math.cos(b), Math.sin(b), seed, cfg)
  const r = Math.max(1, e - cfg.thresholdInset)
  const x = Math.round(Math.cos(b) * r)
  const z = Math.round(Math.sin(b) * r)
  const h = plotHeight(x, z, seed, cfg)
  // ★ FALLING BACK TO THE CENTRE IS A REAL GUARD, NOT DEFENSIVE PADDING. If a future inset or wobble
  // ever put this outside the ground, the "soft return" would deposit the keeper into the void on a
  // loop — falling, returning, falling. The centre is inside the island by construction.
  if (h === null) return { x: 0, z: 0, y: plotHeight(0, 0, seed, cfg)! + 1 }
  return { x, z, y: h + 1 }
}

/**
 * Has the keeper gone over the edge and out from under their own island?
 *
 * The geometric half of the soft return; the host does the moving. Deliberately asks about ALTITUDE
 * rather than about being outside the island's footprint — a keeper standing in the open air inside
 * the cap (on the ground they have not built out to yet) has not fallen anywhere, and snatching them
 * back the moment they step off the generated core would make expansion feel like a wall.
 */
export const hasFallenOut = (y: number, cfg: PlotConfig = DEFAULT_PLOT): boolean =>
  y < plotYRange(cfg).min

/**
 * The lowest and highest y this generator can ever write, for a caller sizing a column.
 *
 * Stated rather than derived at runtime: a plot occupies a thin slab of a 256-tall world, and a
 * chunk builder that meshes all 256 for it is doing 16x the work for nothing.
 */
export function plotYRange(cfg: PlotConfig = DEFAULT_PLOT): { min: number; max: number } {
  return {
    min: cfg.baseY - cfg.roll - cfg.keel - 2,
    max: cfg.baseY + Math.max(cfg.wallHeight, cfg.roll) + 1,
  }
}
