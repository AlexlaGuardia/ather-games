// Waymarks — the keeper's own passages through the Ather.
//
// ★ PURE CORE. No react/three/DOM, nothing from outside this folder. The host owns the voxels, the
// save and the walker; this file owns what the NETWORK is and what may be done to it.
//
// ── ★ CANON, AND THE VOCABULARY IS PART OF IT ────────────────────────────────────────────────
// `game/shimmer-geography.md` closes its passages ruling with a line the build must obey to the
// letter: *"Vocabulary the build may now ship: **waymark, passage, fold, threshold**. Vocabulary it
// may NOT: a bought **rune**, or **gate** for anything that does not cross out of the waking
// world."* Nothing in this file may be called a gate. A gate crosses OUT of the Ather (the Rune
// Hold crossing, `world/gates.md` — that is the gate-rune, Greg gives the first, and it is a
// different feature). This is movement WITHIN the Ather, which canon calls passage-class and prices
// at *"no home-cost"*.
//
// ★ AND A PASSAGE IS NOT GATECRAFT AT ALL — IT IS A TAMED FOLD. `spirit-tales-bible.md` (06-03):
// Gregory *"did not build the garden, he folded it"*, coaxing the Ather's natural creases, and *"the
// cloud-walls and passages are tamed folds."* The Ather creases by itself; a keeper aims a crease.
// That is why this needs no Bind trifecta and no Eyuun-tier craft, and why the number of them is a
// build number rather than a cosmological one: canon hands over *"the number (three, or any),
// pricing, cooldowns, how a waymark renders, and whether a keeper may craft one before developing
// Enchant"* explicitly.
//
// ── ★ HUB AND SPOKE, AND CANON FIXES WHERE THE HUB IS ────────────────────────────────────────
// Ruled 2026-08-15 (`CANON_GAPS.md` › *Is a PASSAGE between pockets the same thing as an Eyuun
// GATE?*), and the ruling lands the split on Alex's own design line:
//
//     **Rune Hold ⟷ plot = the ONE home-gate** — Greg folds it *"because the keeper cannot"*,
//     GIVEN, never sold. That is the gate-rune feature and it is not this file.
//     **plot → Wilds = passages** — off waymarks, *"as many as the build wants."*
//
// So the hub is **the home plot**, by canon, and every waymark is a spoke that steps back to it.
// There is deliberately no spoke-to-spoke hop: a full mesh is a different claim about the world, and
// canon's shape is one fixed home end with routes running off it (the same shape as Gregory's
// brokered inter-garden routes).
//
// ★★ THE HUB IS THE PLOT ITSELF, AND THE PLANTED THRESHOLD IS GONE (2026-08-15, slice 2).
// This file shipped hours earlier with a `threshold` flag on the first waymark planted, because the
// plot had no host wiring and there was no plot cell for a passage to land in. Its own comment said
// the flag was a stand-in that would bind to the plot when the plot landed. The plot landed.
//
// ★ AND THE STAND-IN DID NOT JUST BECOME REDUNDANT — IT BECAME WRONG. A planted hub means a keeper
// can have a second home in the Wilds, which contradicts the ruling this feature is built on
// (*"Rune Hold ⟷ plot = the ONE home-gate; plot → Wilds = passages"* — the plot is the fixed end,
// singular). Leaving it as a harmless fallback would have shipped a way to opt out of canon.
//
// ★ IT ALSO DESIGNS OUT THIS FILE'S WORST FAILURE RATHER THAN HANDLING IT. The old headline assert
// was "pulling the hub must not strand you" — a keeper broke their threshold and every passage
// pointed at nothing, so `pull` promoted the oldest spoke. That whole class is now unrepresentable:
// **the hub is generated and derived (`plot.ts` › `plotThreshold`), so it cannot be broken, moved,
// or missing.** Deleting the promotion is the fix; keeping it would be machinery guarding a state
// that can no longer occur, which is how dead safety code outlives the danger and starts lying.
//
// ⚠ AND IT KEEPS THE BUILD OUT OF A STILL-OPEN QUESTION. My own `[OPEN]` (08-15) asks whether the
// plot is a landing a keeper may return to *from anywhere* — the 08-13 ruling says *"a landing is a
// property of the PLACE, never of the player"* and names *"a keeper-chosen arbitrary destination"*
// as the failure. Every end of every passage here is a place the keeper WALKED TO AND PLANTED
// SOMETHING ON. Whichever way that gap is ruled, none of this has to be undone.
//
// ── ★ WHAT IS RULED BUT NOT BUILT HERE, so nobody reads its absence as a decision ─────────────
//   · **Greg SELLS waymarks** — *"a destination he already walked to and bound."* That is a shop
//     surface plus Greg's dialogue plus the marks economy; this file is the network those purchases
//     would land in, and it is deliberately indifferent to where a waymark came from.
//   · **The long arc:** *develop Enchant → cast your own Waymark → stop buying Greg's.* His service
//     is outgrown, not permanently sold.
//   · **The Enchant gate is explicitly mine** (*"whether a keeper may craft one before developing
//     Enchant = Jin's build"*) and v1 does NOT gate it. Gating the only shipped half of the arc
//     behind a rune the build cannot yet develop would ship a feature no keeper can reach.
//
// ★ SO THE REAL COST OF A WAYMARK IS *WHERE*, NOT WHAT. With a small cap, planting one is a claim
// about which corner of the world you intend to keep coming back to — and moving it means walking
// there. That is the decision the feature exists to create; a generous cap deletes it and leaves a
// fast-travel menu.

/**
 * A planted waymark — always a SPOKE now. World coordinates of the BLOCK; the keeper arrives on top.
 *
 * ★ THE COORDINATE IS STORED, WHILE THE PLOT'S THRESHOLD IS DERIVED, and that asymmetry is the rule
 * the two lanes settled on: **derive what the world owns, store what the player placed.** A spoke's
 * position is a fact about an EDIT — a block the keeper set down, which no generator change moves —
 * so storing it is correct. The plot's threshold is a fact about TERRAIN, so storing it would be a
 * coordinate that can disagree with the ground it names.
 */
export interface Waymark {
  /** Stable id, minted by the host. Never reused — see `WaymarkNet.next`. */
  id: string
  x: number; y: number; z: number
  /** What the keeper called it. Empty is legal and renders as its coordinates. */
  name: string
}

export interface WaymarkNet {
  marks: Waymark[]
  /**
   * Monotonic id counter, persisted with the network.
   *
   * ⚠ IT IS SAVED, NOT DERIVED FROM `marks.length`. A length-derived id repeats after any removal,
   * and a repeated id lets a stale reference (a panel row the player is mid-click on, a travel
   * request from the frame before) resolve to a DIFFERENT waymark than the one it named. Same
   * reasoning as the Hollow ids: never-reused is cheaper than remembering.
   */
  next: number
}

export const emptyNet = (): WaymarkNet => ({ marks: [], next: 1 })

/**
 * How many passages a keeper may hold at once.
 *
 * Canon says the number is mine (*"three, or any"*). Three is the smallest count where WHERE they go
 * is a real decision: enough to keep a quarry, a treeline and a frontier, not enough to keep
 * everywhere. Raise it only after a playtest says the map feels big rather than because it feels
 * generous.
 *
 * ⚠ WAS 4 WHEN ONE OF THEM HAD TO BE SPENT ON THE HUB. The plot is the hub now and costs no
 * waymark, so holding the number at 4 would have quietly handed the keeper an extra passage as a
 * side effect of a plumbing change. Three spokes then, three spokes now.
 */
export const MAX_MARKS = 3

/** Every passage the keeper holds, in plant order. All of them run to the plot. */
export const spokesOf = (net: WaymarkNet): Waymark[] => net.marks

export const markKey = (x: number, y: number, z: number): string => `${x},${y},${z}`
export const markAt = (net: WaymarkNet, x: number, y: number, z: number): Waymark | null =>
  net.marks.find((m) => m.x === x && m.y === y && m.z === z) ?? null

/** Why a plant was refused. Every one is shown; none is silent. */
export type PlantRefusal = 'full' | 'occupied'

/**
 * Plant one. The host has already decided a waymark BLOCK belongs at (x,y,z) and taken the item.
 *
 * Returns the new net and the mark, or a refusal. Refusing rather than silently replacing matters:
 * a keeper at the cap who plants anyway must be told, not have their oldest passage quietly deleted.
 */
export function plant(
  net: WaymarkNet, x: number, y: number, z: number, name = '',
): { net: WaymarkNet; mark: Waymark } | { refused: PlantRefusal } {
  if (markAt(net, x, y, z)) return { refused: 'occupied' }
  if (net.marks.length >= MAX_MARKS) return { refused: 'full' }
  const mark: Waymark = { id: `w${net.next}`, x, y, z, name }
  return { net: { marks: [...net.marks, mark], next: net.next + 1 }, mark }
}

/**
 * Pull one out — the block was broken, or the keeper moved it.
 *
 * ★ NO PROMOTION, AND ITS ABSENCE IS THE POINT. This function used to promote the oldest spoke when
 * the hub was removed, because a hubless network stranded the keeper with passages leading nowhere.
 * The hub is the plot now: generated, derived, impossible to break. **The failure is designed out
 * rather than handled**, and the machinery that handled it is gone rather than left standing over a
 * state that can no longer occur.
 */
export function pull(net: WaymarkNet, id: string): { net: WaymarkNet; removed: Waymark | null } {
  const removed = net.marks.find((m) => m.id === id) ?? null
  if (!removed) return { net, removed: null }
  return { net: { ...net, marks: net.marks.filter((m) => m.id !== id) }, removed }
}


/** Rename. Empty names are legal — the panel falls back to coordinates. */
export function rename(net: WaymarkNet, id: string, name: string): WaymarkNet {
  if (!net.marks.some((m) => m.id === id)) return net
  return { ...net, marks: net.marks.map((m) => (m.id === id ? { ...m, name } : m)) }
}

/** Why a passage would not open. */
export type TravelRefusal = 'unknown-mark' | 'at-plot-pick-one'

/**
 * The id of the keeper's own front door — the fold-seam they came in through.
 *
 * ⚠ IT IS NOT A `Waymark` AND MUST NEVER BE PUT IN `net.marks`. A waymark is a thing the keeper
 * PLANTED, which is why its coordinate is stored (see `Waymark`); the door is a fact about the
 * keeper's own fold, derived by the host from the bubble every time it is asked. Putting it in the
 * net would give it a stored coordinate, let `pull` delete it, and make it count against `MAX_MARKS`
 * — three ways to lose the one exit that is not allowed to be losable.
 *
 * ★ The literal is prefixed so it can never collide with a minted id (`WaymarkNet.next` counts).
 */
export const DOOR_ID = '@door'

/**
 * Where does stepping into a passage let out?
 *
 * ★ THE WHOLE HUB-AND-SPOKE RULE IS THIS ONE FUNCTION, so there is exactly one place to argue with
 * it. A waymark out in the Wilds goes to THE PLOT — `{ toPlot: true }`, not a `Waymark`, because
 * the plot's arrival point is derived from the terrain by `plot.ts` and this pure module has no
 * business holding a coordinate for it. Standing at the plot's own threshold, the keeper picks a
 * named waymark and steps out to it.
 *
 * ⚠ `fromPlot` IS PASSED, NOT INFERRED. A waymark and the plot's threshold are in two different
 * coordinate spaces that share every number, so nothing here can tell them apart by position — the
 * host knows which space the keeper is in and says so. Inferring would be the same class of bug as
 * the worker cache that was right about its key and wrong about its universe.
 *
 * ── ★★ THE DOOR IS ALWAYS A DESTINATION — RULED BY ALEX 2026-08-16 ("the fold seam is two-way") ──
 * This function used to refuse `no-passages` from a plot with an empty net, faithfully implementing
 * the 08-15 split (*"the plot → a Wilds location = a passage, bought off a waymark"*). Alex hit the
 * consequence live: **a keeper crosses IN through their fold's seam, arrives holding zero marks, and
 * the ruling gives them nothing to leave by.** Worse in practice than in principle — the host drew
 * the threshold anyway and it sat there silently inert, a visible front door that did nothing.
 *
 * The ruling: **a keeper's own fold-seam is a two-way passage.** Stepping into the threshold puts
 * them back out at their own door needing no waymark, because it is THE SAME PASSAGE THEY CAME IN
 * THROUGH — not a new destination, not a purchase, nothing Greg has to give. Waymarks are unchanged
 * and stay what the split made them: EXTRA places to step out to, bought off a planted mark.
 *
 * ⚠ SO `no-passages` IS GONE RATHER THAN LEFT UNREACHABLE. Once the door always answers, an empty
 * net is not a refusal — it is the case with exactly one destination and nothing to choose between.
 * A refusal kept "just in case" is a state the code claims can happen and cannot, which is how a
 * dead limb starts lying (this repo has one such limb already documented in `pipeline_config`).
 *
 * ⚠ AND THE PICKER STILL OPENS WHEN THERE ARE MARKS. With the door plus N spokes there IS a choice,
 * so a bare step still refuses `at-plot-pick-one` and the host asks. Sending the keeper out the door
 * whenever they did not name a destination would silently make the door the only reachable exit for
 * anyone who steps without opening the panel — the opposite bug, one week later.
 */
export function destination(
  net: WaymarkNet, opts: { fromPlot: true; toId?: string } | { fromPlot: false; fromId: string },
): { to: Waymark } | { toPlot: true } | { toDoor: true } | { refused: TravelRefusal } {
  if (!opts.fromPlot) {
    if (!net.marks.some((m) => m.id === opts.fromId)) return { refused: 'unknown-mark' }
    return { toPlot: true }
  }
  if (opts.toId === DOOR_ID) return { toDoor: true }
  // Nothing planted: the door is the only way out, so there is nothing to ask about.
  if (net.marks.length === 0) return { toDoor: true }
  if (!opts.toId) return { refused: 'at-plot-pick-one' }
  const to = net.marks.find((m) => m.id === opts.toId)
  if (!to) return { refused: 'unknown-mark' }
  return { to }
}

/**
 * The cell a keeper should arrive in, given the destination waymark: the block's own cell, one up.
 * (The PLOT's arrival is `plot.ts` › `plotThreshold` — derived there, never mirrored here.)
 *
 * Returned rather than applied, and deliberately NOT validated here — this file cannot see voxels.
 * The host does the fit check, exactly as it does for a blink (`locomotion.blinkKeeper`). Centring
 * on +0.5 matters: arriving on a cell corner puts the body half inside the neighbour, which the fit
 * check then rejects for a spot that was actually fine.
 */
export const arrivalOf = (m: Waymark): { x: number; y: number; z: number } =>
  ({ x: m.x + 0.5, y: m.y + 1, z: m.z + 0.5 })
