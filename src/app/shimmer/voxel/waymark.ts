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
// ⚠ THE THRESHOLD IS A STAND-IN UNTIL THE PLOT IS WIRED, AND THAT IS TEMPORARY, NOT THE DESIGN.
// `voxel/plot.ts` exists (the world lane's bounded island) but has no host wiring yet, so there is
// no plot cell for a passage to land in. Until there is, the keeper's FIRST waymark carries the
// `threshold` flag and acts as the hub, and `designate` can move it. When the plot lands, the
// threshold binds to the plot and this flag becomes a fallback for a keeper who has not yet got one.
// Read the flag as *"where home currently is"*, never as *"the hub is wherever you first planted"*.
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

/** A planted waymark. World coordinates of the BLOCK; the keeper arrives on top of it. */
export interface Waymark {
  /** Stable id, minted by the host. Never reused — see `WaymarkNet.next`. */
  id: string
  x: number; y: number; z: number
  /** What the keeper called it. Empty is legal and renders as its coordinates. */
  name: string
  /** ★ The FIRST one planted. Exactly one per network, and it is the hub every spoke returns to. */
  threshold: boolean
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
 * How many a keeper may hold at once, threshold included.
 *
 * Canon says the number is mine (*"three, or any"*). Four = a threshold plus three spokes, which is
 * the smallest count where WHERE they go is a real decision: enough to keep a quarry, a treeline and
 * a frontier, not enough to keep everywhere. Raise it only after a playtest says the map feels big
 * rather than because it feels generous.
 */
export const MAX_MARKS = 4

/** The hub, or null before anything is planted. */
export const thresholdOf = (net: WaymarkNet): Waymark | null =>
  net.marks.find((m) => m.threshold) ?? null

/** Everything that is not the hub, in plant order. */
export const spokesOf = (net: WaymarkNet): Waymark[] => net.marks.filter((m) => !m.threshold)

export const markKey = (x: number, y: number, z: number): string => `${x},${y},${z}`
export const markAt = (net: WaymarkNet, x: number, y: number, z: number): Waymark | null =>
  net.marks.find((m) => m.x === x && m.y === y && m.z === z) ?? null

/** Why a plant was refused. Every one is shown; none is silent. */
export type PlantRefusal = 'full' | 'occupied'

/**
 * Plant one. The host has already decided a waymark BLOCK belongs at (x,y,z) and taken the item.
 *
 * ★ THE FIRST ONE IS THE THRESHOLD, DECIDED HERE AND NOT BY THE HOST. It is a property of the
 * network ("is there already a hub?"), and a host that computed it from its own state would get it
 * wrong the first time a save loaded with marks already in it.
 *
 * Returns the new net and the mark, or a refusal. Refusing rather than silently replacing matters:
 * a keeper at the cap who plants anyway must be told, not have their oldest passage quietly deleted.
 */
export function plant(
  net: WaymarkNet, x: number, y: number, z: number, name = '',
): { net: WaymarkNet; mark: Waymark } | { refused: PlantRefusal } {
  if (markAt(net, x, y, z)) return { refused: 'occupied' }
  if (net.marks.length >= MAX_MARKS) return { refused: 'full' }
  const mark: Waymark = {
    id: `w${net.next}`, x, y, z, name,
    threshold: thresholdOf(net) === null,
  }
  return { net: { marks: [...net.marks, mark], next: net.next + 1 }, mark }
}

/**
 * Pull one out — the block was broken, or the keeper moved it.
 *
 * ★★ REMOVING THE THRESHOLD PROMOTES THE OLDEST SPOKE. This is the case that decides whether the
 * feature survives contact: a network whose hub is gone has NO route at all — every spoke leads to a
 * place that no longer exists, and the keeper is stranded with three dead passages and no way to
 * rebuild the hub except by walking home. Silently promoting is not a fudge; it is what "the crease
 * answers to the hand that tends it" means when the hand moves house. The keeper is told.
 *
 * ⚠ Promotion is by PLANT ORDER, not by distance from anything. Order is stable, saveable and the
 * same on every machine; "nearest to spawn" is none of those and would pick differently after any
 * world edit.
 */
export function pull(net: WaymarkNet, id: string): { net: WaymarkNet; removed: Waymark | null; promoted: Waymark | null } {
  const removed = net.marks.find((m) => m.id === id) ?? null
  if (!removed) return { net, removed: null, promoted: null }
  let rest = net.marks.filter((m) => m.id !== id)
  let promoted: Waymark | null = null
  if (removed.threshold && rest.length > 0) {
    promoted = { ...rest[0], threshold: true }
    rest = [promoted, ...rest.slice(1)]
  }
  return { net: { ...net, marks: rest }, removed, promoted }
}

/**
 * Move the hub to an existing waymark.
 *
 * ★ WITHOUT THIS, "the first one you plant is home" IS A TRAP. A keeper plants their first waymark
 * at the quarry they happened to be standing in, and every passage they own for the rest of the
 * save runs to a hole in the ground. Re-designating costs nothing, cannot lose a mark, and is the
 * honest reading of *"the crease answers to the hand that tends it"* — a keeper moves house.
 */
export function designate(net: WaymarkNet, id: string): WaymarkNet {
  if (!net.marks.some((m) => m.id === id)) return net
  return { ...net, marks: net.marks.map((m) => ({ ...m, threshold: m.id === id })) }
}

/** Rename. Empty names are legal — the panel falls back to coordinates. */
export function rename(net: WaymarkNet, id: string, name: string): WaymarkNet {
  if (!net.marks.some((m) => m.id === id)) return net
  return { ...net, marks: net.marks.map((m) => (m.id === id ? { ...m, name } : m)) }
}

/** Why a passage would not open. */
export type TravelRefusal = 'unknown-mark' | 'no-threshold' | 'is-threshold' | 'same-mark'

/**
 * Where does stepping into the waymark at `fromId` let out?
 *
 * ★ THE WHOLE HUB-AND-SPOKE RULE IS THIS ONE FUNCTION, so there is exactly one place to argue with
 * it. A spoke goes to the threshold. The threshold goes to a NAMED spoke (the panel picks). Nothing
 * else resolves, and `'is-threshold'` is a distinct refusal from `'same-mark'` so the host can say
 * "choose where to go" rather than "you are already there".
 */
export function destination(
  net: WaymarkNet, fromId: string, toId?: string,
): { to: Waymark } | { refused: TravelRefusal } {
  const from = net.marks.find((m) => m.id === fromId)
  if (!from) return { refused: 'unknown-mark' }
  if (!from.threshold) {
    const hub = thresholdOf(net)
    if (!hub) return { refused: 'no-threshold' }
    if (hub.id === from.id) return { refused: 'same-mark' }
    return { to: hub }
  }
  if (!toId) return { refused: 'is-threshold' }
  const to = net.marks.find((m) => m.id === toId)
  if (!to) return { refused: 'unknown-mark' }
  if (to.id === from.id) return { refused: 'same-mark' }
  return { to }
}

/**
 * The cell a keeper should arrive in, given the destination waymark: the block's own cell, one up.
 *
 * Returned rather than applied, and deliberately NOT validated here — this file cannot see voxels.
 * The host does the fit check, exactly as it does for a blink (`locomotion.blinkKeeper`). Centring
 * on +0.5 matters: arriving on a cell corner puts the body half inside the neighbour, which the fit
 * check then rejects for a spot that was actually fine.
 */
export const arrivalOf = (m: Waymark): { x: number; y: number; z: number } =>
  ({ x: m.x + 0.5, y: m.y + 1, z: m.z + 0.5 })
