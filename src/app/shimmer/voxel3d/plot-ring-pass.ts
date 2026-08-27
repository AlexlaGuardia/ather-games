// THE HOME PLOT'S RING, RENDERED — your own spirits, about your own fold, seen.
//
// ★ THE THREE SHELL ONLY. Every decision about WHO is standing about the plot and WHERE lives in
// `plot-ring.ts`, which is pure and has an oracle; every decision about how a body walks lives in
// `engine/burrows.ts`, which the moglin patrols already use. This file owns objects and a clock.
// If you find arithmetic here that decides placement, it belongs in one of those two files.
//
// ── ★ THE WALK IS DERIVED FROM WALL-CLOCK TIME, NOT INTEGRATED ──────────────────────────────────
// `patrolPose` is a pure function of (loop, now), the same law the moglin patrols and play3d's own
// ring already obey. So a resident's position survives a dropped frame, a tab that slept, and a
// reload, without a single stored velocity — and nothing accumulates drift. It is also why the tick
// below can be skipped entirely when the ring is empty and cost nothing.
//
// ── ★★ THE BODY IS ASKED FOR THE SAME WAY THE MIST RESIDENT ASKS ────────────────────────────────
// Portrait cutout first, 32x32 sprite second, and NOTHING if neither exists. That order is not a
// style choice: Alex ruled on 2026-08-27 that the 32x32 creature sprites were never finished — they
// are concept, not art — so a species with a locked canon cutout must wear it. Copied in shape from
// `mist-pass.ts` rather than re-reasoned, and it must stay in step with it: two renderers deriving a
// look from one art source is exactly how the sapling icon and the world mesher came to disagree
// about a shape neither of them was wrong about (PATTERNS, 2026-08-23).
//
// ⚠ NO HALO, AND THAT IS DELIBERATE. The mist resident wears an element-tinted manifestation glow
// because canon says a spirit MANIFESTS in the mist to spar. A spirit living in your garden is not
// manifesting; it is at home. Giving the ring the same glow would say, in the only language the
// world has for it, that every spirit on your lawn is offering you a bout — which is precisely the
// interaction that is still `[OPEN]`.
//
// ⚠ AND NO INTERACTION SURFACE AT ALL. No `nearest()`, no `aimed()`, no prompt. What a meeting is
// outside a mist patch is `[OPEN]` in `CANON/CANON_GAPS.md` (athernyx `309db4c`). When it is ruled,
// this file grows an `aimed()` the way `mist-pass` has one — asked of the file that decides where a
// body stands, never recomputed by the host.

import * as THREE from 'three'
import { patrolLoop, patrolPose, type PatrolLoop, type WanderDials } from '../engine/burrows'
import type { DealWindow } from '../engine/spawn-board'
import { createCreatureBody, type CreatureBody } from './creature-billboard'
import { createPortraitBody, hasPortrait } from './spirit-portrait-body'
import { speciesArt } from '../sprites/registry'
import { creatureHeight } from '../sprites/creature-size'
import { reflowRing, ringCap, DEFAULT_RING, type RingSlot, type Keeper } from './plot-ring'
import type { PlotConfig } from '../voxel/plot'

/**
 * Amble pace. A resident is at home, not on patrol — it drifts a few paces and stands about.
 *
 * ⚠ THESE ARE BLOCKS AND `play3d`'s PLOT_DIALS ARE TILES. The two files carry the same three
 * numbers and they are NOT one number wearing two names: play3d walks a tile grid at its own scale.
 * Written down because the next reader's instinct will be to deduplicate them, and that would tie
 * two worlds' feel to one dial for no reason beyond the coincidence of the digits.
 */
const PLOT_DIALS: WanderDials = { radius: 4.5, speed: 0.7, pauseS: 3.4 }

/** Spirits LIVE here. No emerge beat at a window boundary, so the window opened long ago and never
 *  ends — the same trick play3d's ring uses to keep `patrolPose` from fading them in on a loop. */
const ALWAYS: DealWindow = { index: 0, startMs: 0, endMs: Number.MAX_SAFE_INTEGER }

/** How often the cast is re-considered. The keeper cannot walk 90 blocks in less than this, and a
 *  reflow that finds nothing to do is cheap — but placement probes the world, so it is not free. */
const REFLOW_S = 1.1

/**
 * How far the body rises and falls as it breathes, as a FRACTION of its own height.
 *
 * ★ IT WAS A FLAT 0.06 BLOCKS, WHICH WAS FINE WHILE EVERY RESIDENT WAS THE SAME SIZE AND IS NOT NOW.
 * A Luminara is 4cm tall (`sprites/creature-size.ts`), so an absolute 6cm bob sinks a firefly through
 * the ground and back out on every breath. 0.12 is the old number divided by the Vulnyx it was tuned
 * against (0.06 / 0.5), so the fox breathes exactly as it did today and everything else is in scale.
 */
const BOB_FRAC = 0.12

export interface PlotRing {
  /** Add this one object to the scene. Empty until the host hands over a roster. */
  group: THREE.Group
  /**
   * Advance the ring.
   *
   * `restingIds` is the host's answer to *"who is in ring 2"* — `restingSpirits(party).map(s => s.id)`.
   * ⚠ IT IS AN ARGUMENT RATHER THAN A ROSTER READ, so this file holds no opinion about how a spirit
   * comes to be resting, and an empty list is a legitimate answer that draws nothing.
   *
   * `speciesOf` maps an id to its species — asked of the host for the same reason.
   * `accept` is the host's ground question: is this a spot inside the fold that a body may stand on.
   * `groundAt` is the host's LIVE ground probe, so a resident stands on dug and built ground rather
   * than on the world as first imagined (the seam `footing.ts` and `mist-pass` already use).
   */
  tick(
    keeper: Keeper, nowMs: number, dt: number,
    cfg: PlotConfig,
    restingIds: readonly string[],
    speciesOf: (id: string) => string | null,
    accept: (x: number, z: number) => boolean,
    groundAt: (x: number, z: number, hint: number) => number,
  ): void
  /** How many bodies are drawn right now — for the diagnostics readout and for a draw-cost check. */
  count(): number
  dispose(): void
}

/** One resident on screen: its slot, its walk, and the body wearing it. */
interface Live {
  slot: RingSlot
  loop: PatrolLoop
  body: CreatureBody
  /** Ground height at the wander centre, probed once per home rather than per frame. */
  gy: number
  /** This species' drawn height, in blocks. Read once at build so the body and its lift agree. */
  h: number
}

/**
 * Build a body for a species, portrait first. Returns null when a species has neither — which is a
 * real answer, not a failure: nothing is drawn, and no stand-in is invented. `mist-pass` makes the
 * same choice for the same reason, and an invented placeholder is how unfinished art ships.
 *
 * ★ `h` IS PASSED IN RATHER THAN LOOKED UP HERE, so the body's height and the height the walk lifts
 * it by are the SAME number and cannot drift. Two reads of one table are still two numbers.
 */
function bodyFor(species: string, h: number): CreatureBody | null {
  if (hasPortrait(species)) return createPortraitBody(species, { height: h })
  const art = speciesArt(species)
  if (!art) return null
  return createCreatureBody(species, { anims: art.anims, palette: art.palette }, { height: h })
}

export function createPlotRing(seed: number): PlotRing {
  const group = new THREE.Group()
  // Residents are far apart and the camera moves through them; culling per body buys nothing and
  // costs a bounds update on a sprite whose bounds are meaningless once it faces the camera.
  group.frustumCulled = false
  const live = new Map<string, Live>()
  let untilReflow = 0
  let nonce = 0

  const drop = (id: string) => {
    const l = live.get(id)
    if (!l) return
    group.remove(l.body.object)
    l.body.dispose()
    live.delete(id)
  }

  return {
    group,
    count: () => live.size,
    tick(keeper, nowMs, dt, cfg, restingIds, speciesOf, accept, groundAt) {
      // ★ THE EARLY OUT IS THE PERF STORY. A keeper with nobody resting — which is every keeper
      // until the party has a ceiling — pays one Set-free comparison per frame and nothing else.
      if (restingIds.length === 0 && live.size === 0) return

      untilReflow -= dt
      if (untilReflow <= 0) {
        untilReflow = REFLOW_S
        nonce += 1
        const before = [...live.values()].map(l => l.slot)
        const after = reflowRing(before, keeper, restingIds, ringCap(cfg), seed, nonce, accept, DEFAULT_RING)
        const now = new Set(after.map(s => s.id))
        for (const id of [...live.keys()]) if (!now.has(id)) drop(id)
        for (const slot of after) {
          const had = live.get(slot.id)
          if (had && had.slot.gen === slot.gen) continue   // same corner, same walk, nothing to do
          const species = speciesOf(slot.id)
          const h = had?.h ?? creatureHeight(species)   // null species -> the modest fallback, never NaN
          const body = had?.body ?? (species ? bodyFor(species, h) : null)
          if (!body) { if (had) drop(slot.id); continue }
          if (!had) group.add(body.object)
          // ⚠ THE PATROL KEY CARRIES THE GENERATION. Without it a spirit that re-homes rebuilds the
          // IDENTICAL loop around a new centre and walks the same shape forever, which reads as the
          // garden being one path with different scenery.
          const loop = patrolLoop(
            slot.hx, slot.hz,
            (x, z) => accept(x, z),
            `plot:${slot.id}:${slot.gen}`,
            PLOT_DIALS,
          )
          const gy = groundAt(Math.round(slot.hx), Math.round(slot.hz), Math.round(cfg.baseY))
          live.set(slot.id, { slot, loop, body, gy, h })
        }
      }

      for (const l of live.values()) {
        const pose = patrolPose(l.loop, l.slot.hx, l.slot.hz, nowMs, ALWAYS)
        const bob = Math.sin(nowMs / 1000 * 1.6 + l.loop.phaseS) * (l.h * BOB_FRAC)
        // `pose.y` is the walk's second GROUND axis (the engine is 2D and calls it y); here it is z.
        // ⚠ HALF THE BODY'S OWN HEIGHT, NOT HALF A SHARED CONSTANT. A sprite's origin is its centre,
        // so this is what puts its FEET on the ground — get it wrong and a small spirit is buried and
        // a large one floats, both silently.
        l.body.object.position.set(pose.x, l.gy + l.h / 2 + bob, pose.y)
        l.body.update(nowMs, pose.facing, keeper.x, keeper.z, pose.paused ? 'idle' : 'walk')
      }
    },
    dispose() {
      for (const id of [...live.keys()]) drop(id)
    },
  }
}
