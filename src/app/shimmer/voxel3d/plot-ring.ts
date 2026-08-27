// THE HOME PLOT'S RING — which of your spirits are about the fold, and where they are standing.
//
// ★ PURE. No react/three/DOM and no world reads. The host owns the roster, the fold config and the
// live ground probe; this owns the one question *"who is underfoot right now, and where."*
//
// ── ★★ CANON RULED THIS AND THE VOXEL WORLD NEVER BUILT IT ──────────────────────────────────────
// `game/shimmer-geography.md` › *Where a keeper's spirits live* (RULED 2026-07-30, Magii with Alex).
// Three rings, none of them storage: the handful **with you**, the ones **at the Home Plot** —
// *"visible, wandering, underfoot. This is the ring the player feels, and it is why the garden reads
// as inhabited rather than as a menu"* — and everyone else, **elsewhere in the garden**. There is no
// bank, no box, no depot; a container word would put the keeper on the collar's side of the one line
// the franchise turns on.
//
// ★ RING 2 IS `restingSpirits()`, AND THAT LIST ALREADY EXISTS. `engine/spirit-health.ts` split the
// roster into active and resting on the `inParty` flag long ago, and `grimoire-tab.tsx` already
// renders the two halves as *"with you"* and *"in garden"*. Nothing was missing but the seeing.
//
// ⚠ THE POPULATION IS THE HOST'S AND IT CAN BE EMPTY FOR A REASON THAT IS NOT THIS FILE'S FAULT.
// Nothing in voxel3d writes `inParty`, `MAX_PARTY` appears nowhere in voxel3d, and `potOps.gain`
// appends to the party with no ceiling — so until something rests the overflow, `restingSpirits()`
// is `[]` and this ring is correctly, invisibly empty. Handed to hub 2026-08-27 (their file). An
// empty ring here is NOT evidence this module is broken, and that is exactly why it is written down.
//
// ── ★★ WHAT CANON HANDS ME, IN ITS OWN WORDS ────────────────────────────────────────────────────
// *"Every NUMBER is Jin's — how many travel, how many the Plot holds at each stage of liberation,
// and whether the visible ones rotate. A rotating cast at the Plot is a rendering choice and
// canon-safe by construction, because the truth is that they all live there; which ones you happen
// to see is just where they wandered."* That last clause is what licenses everything below: the
// cast follows the keeper about their own fold, and no spirit is being spawned or despawned — the
// build is choosing which of the ones already living there is currently in frame.
//
// ⚠ AND ONE THING IS NOT MINE. What a **meeting** is — whether a spirit met outside a mist patch
// greets, ignores, flees or offers a bout — is `[OPEN]` in `CANON/CANON_GAPS.md` (athernyx
// `309db4c`). So a resident here wanders and is looked at, and this file exposes no interaction,
// no prompt and no range test. Placement, density, wander and draw budget are Jin's and proceed.

import type { PlotConfig } from '../voxel/plot'

/**
 * How many of your spirits are visibly about the plot at once.
 *
 * ★ DERIVED FROM `capRadius`, WHICH IS THE WHOLE POINT — canon: *"how many spirits are about your
 * plot is the same number as how much garden you have won back. That is the cap, and it is
 * diegetic, not an inventory limit wearing a fiction."* Reading the fold's own radius means the
 * yard and the crowd in it can never disagree, and nothing new has to be kept in sync. Same
 * construction as `chestCap`, deliberately — one number decides how far you may build, what you may
 * keep on it, and now who is standing on it.
 *
 * ⚠ THE DIVISOR IS A FIRST GUESS AND IT IS THE ONLY DIAL. At `PLOT_TIERS` [300, 400, 500] this is
 * **6 / 8 / 10**, so a day-one keeper's yard has a few faces in it and a keeper who has broken
 * three holds has canon's *"room for a crowd"*. It is also an upper bound that rarely binds early:
 * the real limit is how many spirits are actually resting, which is a small number until a keeper
 * has bloomed past their party.
 *
 * ⚠ IT IS A RENDERING BUDGET BEFORE IT IS A DESIGN NUMBER. Alex profiles the UHD 630 at 84%
 * GPU-bound with ~298 draws; a resident is a billboard and costs draws, not CPU. If this number
 * ever rises, measure the draw count before and after.
 */
export const ringCap = (cfg: PlotConfig): number => Math.max(1, Math.floor(cfg.capRadius / 50))

/** One spirit, standing somewhere about the fold. */
export interface RingSlot {
  /** The resting spirit occupying this slot, by `Spirit.id`. */
  id: string
  /** The wander CENTRE in plot-space blocks — not the body's position, which the walk derives. */
  hx: number
  hz: number
  /** Bumped on every re-home. Part of the patrol key, so a new corner means a genuinely new walk. */
  gen: number
}

/**
 * The dials that decide where a resident may be put and when it may be moved. Blocks and radians.
 *
 * ⚠ `sight` AND `cone` ARE NOT A DRAW DISTANCE — they are the answer to *"could the keeper have
 * been looking at this spot."* They exist to make the rotation unwitnessed, and they must stay
 * conservative in the direction of assuming you WERE looking. Shrinking them does not save work; it
 * buys a spirit blinking out of a corner of the eye, which reads as a bug and cannot be un-seen.
 */
export interface RingDials {
  /** Nearest and furthest a fresh home may be placed from the keeper. */
  nearMin: number
  nearMax: number
  /** Past this, a resident is far enough behind to be recycled — if it is also unseen. */
  farOut: number
  /** Half-angle of the forward cone treated as "the keeper can see this". */
  cone: number
  /** How far the keeper is assumed to be able to make out a resident at all. */
  sight: number
}

/**
 * ⚠ `nearMin` 14 IS A COMFORT NUMBER, NOT A CLEARANCE ONE. Closer than that and a resident arrives
 * inside the keeper's personal space; `sight`/`cone` already stop it arriving in view at any range.
 * `farOut` 90 sits deliberately past `sight` 120 being *comfortable* — a resident is recycled only
 * when it is both far AND behind, so the two conditions overlap rather than race.
 */
export const DEFAULT_RING: RingDials = {
  nearMin: 14, nearMax: 42, farOut: 90, cone: Math.PI * 0.45, sight: 120,
}

/** Where the keeper is and which way they are looking. `yaw` is the heading in world radians. */
export interface Keeper { x: number; z: number; yaw: number }

/**
 * Could the keeper plausibly be looking at (x, z) right now?
 *
 * ★ FAILS TOWARD "YES", ON PURPOSE. Every caller uses this to decide whether a move would be
 * WITNESSED, so a wrong "no" ships a visible pop and a wrong "yes" costs one skipped placement that
 * the next tick retries for free. The asymmetry is the whole design of the predicate.
 */
export function inView(k: Keeper, x: number, z: number, d: RingDials = DEFAULT_RING): boolean {
  const dx = x - k.x, dz = z - k.z
  const dist = Math.hypot(dx, dz)
  if (dist > d.sight) return false
  // Standing on top of it counts as seen — a bearing from a zero-length vector is meaningless.
  if (dist < 1e-6) return true
  const bearing = Math.atan2(dz, dx)
  let off = bearing - k.yaw
  while (off > Math.PI) off -= Math.PI * 2
  while (off < -Math.PI) off += Math.PI * 2
  return Math.abs(off) <= d.cone
}

/** A small deterministic stream, so a given (seed, nonce) always proposes the same corners. */
function stream(seed: number, nonce: number): () => number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(nonce | 0, 0x85ebca6b)) >>> 0
  return () => {
    h = (h + 0x6d2b79f5) >>> 0
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** How many corners are tried before a placement gives up for this tick. Bounds the worst frame. */
const TRIES = 12

/**
 * Propose a corner of the garden for a resident to keep: in the near band around the keeper, out of
 * view unless this is a `fresh` world where nothing has been seen yet, and acceptable to the host.
 *
 * `accept` is the host's ground question — inside the fold, standable, not inside a wall. It is a
 * parameter rather than an import because the honest answer needs the LIVE world (dug and built
 * ground), which this file must never reach for. Returns null when no corner cleared the bar; the
 * caller simply tries again next tick, which is why there is no fallback placement here. A fallback
 * would put a spirit somewhere wrong rather than nowhere, and nowhere is recoverable.
 */
export function pickHome(
  k: Keeper, seed: number, nonce: number,
  accept: (x: number, z: number) => boolean,
  fresh: boolean,
  d: RingDials = DEFAULT_RING,
): { x: number; z: number } | null {
  const rnd = stream(seed, nonce)
  for (let i = 0; i < TRIES; i++) {
    const a = rnd() * Math.PI * 2
    // sqrt so corners spread by AREA rather than crowding the inner edge of the band.
    const r = Math.sqrt(d.nearMin * d.nearMin + rnd() * (d.nearMax * d.nearMax - d.nearMin * d.nearMin))
    const x = k.x + Math.cos(a) * r
    const z = k.z + Math.sin(a) * r
    if (!fresh && inView(k, x, z, d)) continue
    if (!accept(x, z)) continue
    return { x, z }
  }
  return null
}

/**
 * The whole step: who is standing about the fold after this tick.
 *
 * Pure — takes the current slots and returns a NEW array, so a caller can diff or discard. The
 * order of operations is the design:
 *
 *  1. **Drop slots whose spirit stopped resting.** Called back into the party, or gone from the
 *     roster entirely. This one ignores `inView` deliberately: the spirit is genuinely no longer in
 *     ring 2, and the keeper who just called it to their side is not surprised to see it leave.
 *  2. **Trim to the cap** — a fold can only shrink by a save being edited, but a cap that binds
 *     must bind, and dropping the LAST slots keeps the cast stable rather than reshuffling it.
 *  3. **Recycle the far and unseen** — a resident behind you and past `farOut` gives up its corner
 *     so the cast can follow you around a fold that is 600 blocks across. Nothing is despawned in
 *     the fiction: it wandered off, and someone else wandered into view.
 *  4. **Fill spare slots** from resting spirits not already standing somewhere.
 *
 * ⚠ STEPS 3 AND 4 ARE THE SAME MOTION AND MUST STAY IN THIS ORDER — recycling first is what frees
 * the spirit that step 4 may then re-place at a fresh corner. Reversed, the cast can never rotate.
 */
export function reflowRing(
  slots: readonly RingSlot[],
  k: Keeper,
  restingIds: readonly string[],
  cap: number,
  seed: number,
  nonce: number,
  accept: (x: number, z: number) => boolean,
  d: RingDials = DEFAULT_RING,
): RingSlot[] {
  const resting = new Set(restingIds)
  let out = slots.filter(s => resting.has(s.id))
  if (out.length > cap) out = out.slice(0, cap)

  // 3 — the far and unseen let go of their corner.
  const kept: RingSlot[] = []
  const freed: RingSlot[] = []
  for (const s of out) {
    const far = Math.hypot(s.hx - k.x, s.hz - k.z) > d.farOut
    if (far && !inView(k, s.hx, s.hz, d)) freed.push(s)
    else kept.push(s)
  }

  // 4 — fill up to the cap. A freed spirit is eligible again immediately: it did not leave the
  // garden, it left the frame, and the rotation is the point.
  const standing = new Set(kept.map(s => s.id))
  const genOf = new Map(freed.map(s => [s.id, s.gen] as const))
  const waiting = restingIds.filter(id => !standing.has(id))
  // Rotate the waiting list by the nonce so the same few faces do not always win the free slots.
  const start = waiting.length > 0 ? Math.abs(nonce) % waiting.length : 0
  const fresh = kept.length === 0
  let tried = 0
  for (let i = 0; i < waiting.length && kept.length < cap; i++) {
    const id = waiting[(start + i) % waiting.length]
    const home = pickHome(k, seed, nonce + tried * 7919, accept, fresh, d)
    tried += 1
    if (!home) break   // the world refused every corner this tick; try again next tick.
    kept.push({ id, hx: home.x, hz: home.z, gen: (genOf.get(id) ?? 0) + 1 })
  }
  return kept
}
