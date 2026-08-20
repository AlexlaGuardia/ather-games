// The underwater view — what the screen does when the EYE goes under.
//
// GBOARD's water block, hole #4: *"going under looks identical to standing in air."* The swim
// physics have been good since 08-08; nothing ever told the screen. This is the LOOK half, and it
// is deliberately a separate pure module from `day-night.tsx` so the decisions below can be
// asserted without a renderer — the rig imports the numbers, it does not own them.
//
// ── ★★ THE EYE, NOT THE BODY. THIS IS THE WHOLE REASON THE MODULE EXISTS ─────────────────────
// `locomotion.ts` sets `s.submerged` from CHEST (py + 1.0) AND FEET (py + 0.2). The eye rides at
// py + EYE_STAND (1.62). So there is a ~0.6-block band where the swim physics correctly own the
// tick while your head is plainly out in the air — treading is exactly that state, and treading is
// common (it is how you swim to a bank and hop out). A screen effect driven off `submerged` tints
// the world while your face is dry, and stays clear when you duck under a low surface. The two
// predicates answer different questions and neither substitutes for the other.
//   `submerged` = may I apply swim physics.   `submersion()` = is the camera in the water.
// Nothing here is handed a player, a LocoState or a body height — only where the eye is and what
// is in the two cells around it, so the wrong question cannot be asked through this door.
//
// ── ★★ UNDERWATER REPLACES THE MEDIUM; GLOOM AND MIST ONLY MODULATE IT ───────────────────────
// The canopy and a mist patch both pull fog MULTIPLICATIVELY (`day-night.tsx`: `pull = (1 - ...gd)
// * (1 - ...md)`), which is right for them — they thicken the air you are already looking through,
// and they compose. Water is not thicker air, it is a different substance, so it LERPS TO AN
// ABSOLUTE and it lands last. Get this wrong and the water inherits its neighbours: swimming at
// midnight under the Thicket canopy would be a visibly different pond from the same pond at noon
// in a meadow, and the deepest water in the game would be wherever the trees happened to be.
// A pond is a pond at every hour. The oracle asserts exactly that (§4).
//
// ── ★ LUMINOUS, NOT MURKY — the mist lesson, imported with its reason ────────────────────────
// `shimmer-skilling.md` rules the Ather's waters *"still, luminescent, and peaceful."* The reflex
// when a medium closes in is to cut the light, and `day-night.tsx`'s MIST block records what that
// produced there: a grey-brown murk that read as a dust storm. Same trap here, with a second
// pull toward it (real water DOES attenuate light, so "realistic" and "canon" point opposite ways
// and canon wins). Sun is cut — a surface scatters it and that is what makes the shafts read —
// but skylight is LIFTED, so going under is a change of colour, never a change of brightness.

// ── ★★ AND THE PROBE THAT ANSWERS IT HAS NO "NO" — BOTH OF THE WORLD'S CELL READERS LIE ──────
// `VoxelWorld.tsx` has two probes and NEITHER can say "I do not know", which is exactly the answer
// a streaming world owes you at the frontier:
//   `voxel()`      returns AIR            for an ungenerated column  (:4103)
//   `voxelSolid()` returns PACKED_CLOUD   for an ungenerated column  (:4123, "stand on it, do not
//                                          fall through it" — right for collision, a lie here)
// Both therefore answer "not water" for ground that has not loaded, and sprinting is 22 units/s
// against a bounded load radius, so a swimmer outruns generation routinely. Driving the view off
// either one alone makes the water blink off at the frontier and back on when the chunk lands.
// ★ The two lies disagree, and that is what makes the truth recoverable: a REAL packed-cloud block
// reads PACKED_CLOUD through both, while an unloaded column reads AIR through one and PACKED_CLOUD
// through the other. That pair is the only unknown-shaped answer in the file, so `Cell` below has
// a third state and `submersion` returns **null** for it — meaning HOLD, not "no". A hold is
// correct rather than merely safe: the last thing the camera knew about its own surroundings is a
// far better estimate than a sentinel that was chosen to make bodies stand up.
// ⚠ Do not "simplify" `Cell` back to a boolean. The boolean is the bug.

/** Must track `mesh-bridge.ts`'s water vertex shader (`transformed.y -= 0.1`): the rendered surface
 *  sits a tenth of a block below its cell top, so the cell boundary is NOT where the water is. */
export const WATER_RECESS = 0.1

/** How far below the surface the view is fully submerged. Small on purpose — this is the width of
 *  the meniscus, not a fade. It exists so the ±0.05 ripple in the same shader cannot strobe the
 *  effect while you tread, and so ducking reads as a dip rather than a switch. */
export const SUBMERGE_BAND = 0.22

/**
 * What the camera's cell is. Three states, because the world's probes have two and one of them is
 * a fiction — see the block above. `unknown` is not an error state; it is the honest reading at a
 * frontier the generator has not reached yet.
 */
export type Cell = 'water' | 'other' | 'unknown'

/**
 * How submerged the CAMERA is, 0..1 — or **null** meaning "hold whatever you had".
 *
 * Pure, and blind to the player by construction: it is handed an eye height and two cell readings,
 * never a body, a LocoState or a `submerged` flag, so the wrong question cannot be asked through
 * this door. Cells rather than a worldgen height query on purpose — `waterSurfaceAt()` describes
 * the world as first imagined, which is the same class of instrument as the `columnHeight` ground
 * probe that let Hollows glide through every wall a player ever built (`VoxelWorld.tsx:4133`).
 *
 * Water over your head means submerged outright; in the top cell of a body you get the sub-block
 * ramp, because that cell is mostly water but its top tenth is not.
 *
 * ⚠ `above === 'unknown'` while `eye === 'water'` should be unreachable — a column object holds
 * every y, so the two cells load together — but it is handled rather than asserted away: it falls
 * to the ramp, which is the reading that uses only the cell we actually know.
 */
export function submersion(eyeY: number, eye: Cell, above: Cell): number | null {
  if (eye === 'unknown') return null
  if (eye !== 'water') return 0
  if (above === 'water') return 1
  const surface = Math.floor(eyeY) + 1 - WATER_RECESS
  const below = surface - eyeY
  if (below <= 0) return 0
  if (below >= SUBMERGE_BAND) return 1
  return below / SUBMERGE_BAND
}

/**
 * The dial block. One constant each, all of it Alex's eye.
 *
 * `fogFar` 26 is the read that matters: far enough that a river bed and the bank you are swimming
 * for stay visible (a pond is ~3 deep and rivers here are `RIVER_DEPTH 3`, so this is never
 * claustrophobic in the shallows), close enough that the open basins finally have a horizon.
 * `fogNear` near-zero is what makes this a TINT rather than a distance haze — with fog starting at
 * arm's length every pixel of the view is water-coloured, which is the whole point and is why no
 * post-processing pass is needed for this feature.
 */
export const UNDER = {
  fogNear: 0.4,
  fogFar: 26,
  /** Fog + background. A deeper, greener sibling of the water's own surface colour (`attrs.ts`
   *  MAT.WATER 0x2f6f9e) — the same body of water seen from inside, not a second unrelated blue. */
  water: '#2b6f83',
  /** Skylight underwater. LIFTED toward aqua, never dimmed toward grey — see the header. */
  sky: '#5fb9c9',
  sunCut: 0.55,      // a surface scatters direct sun; shadows go soft, not black
  hemiLift: 0.25,    // skylight GAINS this fraction — the canon "luminescent", one constant
  /** Ease toward the target. Fast: `SUBMERGE_BAND` already does the smoothing that the eye reads,
   *  so this only exists to kill a single-frame pop, never to make going under a fade. */
  rate: 18,
  /** The crossing cue. A wash that fires as the surface passes the eye in EITHER direction and
   *  decays — entering, the water closes over you; leaving, it drains off. Without it the
   *  transition is legible but unmarked, and a surface you cross constantly should announce
   *  itself once rather than be inferred from a colour that is already there. */
  surgeDecay: 3.2,
  /** How hard the wash pulls the far plane in at full strength (fraction of `fogFar`). */
  surgePull: 0.45,
} as const

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Fog under water. `near`/`far` arrive already carrying the day/night mix and the gloom+mist pull;
 * this LERPS them to the absolutes above by `t` and therefore dominates at full submersion, which
 * is the §4 assert and the reason it is a lerp and not another multiplicative factor.
 *
 * `surge` (0..1) additionally squeezes the far plane for the crossing wash. It rides on top of the
 * lerp rather than inside it, so the wash cannot make ABOVE-water fog move: at t=0 the result is
 * the input untouched no matter what surge is doing.
 */
export function fogUnder(near: number, far: number, t: number, surge = 0):
  { near: number; far: number } {
  const k = clamp01(t)
  if (k === 0) return { near, far }
  const n = near + (UNDER.fogNear - near) * k
  const f = far + (UNDER.fogFar - far) * k
  return { near: n, far: f * (1 - UNDER.surgePull * clamp01(surge) * k) }
}

/**
 * How much the sky dome is veiled, 0..1.
 *
 * ★ THE DOME IS `fog: false` (`day-night.tsx`, the sky material) — it is drawn on the BackSide of a
 * camera-following sphere and scene fog deliberately does not touch it, which is correct for every
 * effect built before this one because gloom and mist both leave you under open sky. Underwater it
 * is the bug: fog would close the terrain to arm's length while a bright blue dome sat overhead,
 * and the result reads as a renderer fault rather than as water. So the dome takes the veil
 * directly. Separate from the water material's own `side: FrontSide` culling — from below, the
 * surface quads are not drawn at all, which is a DIFFERENT hole and deliberately not this one's.
 */
export function domeVeil(t: number): number {
  return clamp01(t)
}

/** The smoothed view state. `t` is what everything reads; `surge` is the crossing wash. */
export interface UnderState {
  t: number
  surge: number
}

export function newUnderState(): UnderState {
  return { t: 0, surge: 0 }
}

/**
 * Advance the view state one frame. Mutates in place — this runs inside `useFrame` and the rig's
 * standing rule is that nothing per-frame allocates.
 *
 * The wash fires when the eased `t` CROSSES the midpoint, so it triggers once per surface crossing
 * in either direction and cannot re-fire while you hold a depth. Keying it on the eased value
 * rather than the raw target is what stops the ripple from machine-gunning it while you tread:
 * the target flickers across the band, the eased value crosses the middle once.
 */
export function stepUnder(s: UnderState, target: number | null, dt: number): UnderState {
  // null = the world could not say. Hold t AND decay the surge: freezing the wash mid-flash would
  // park a bright ring on screen for as long as the frontier stayed unloaded.
  if (target === null) {
    s.surge = Math.max(0, s.surge - Math.max(0, dt) * UNDER.surgeDecay)
    return s
  }
  const was = s.t
  const k = Math.min(1, Math.max(0, dt) * UNDER.rate)
  s.t += (clamp01(target) - s.t) * k
  const crossed = (was < 0.5 && s.t >= 0.5) || (was >= 0.5 && s.t < 0.5)
  if (crossed) s.surge = 1
  else s.surge = Math.max(0, s.surge - Math.max(0, dt) * UNDER.surgeDecay)
  return s
}
