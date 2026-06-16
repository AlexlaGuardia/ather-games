# Atherdash — design + slice spec

> Scoped 2026-06-16 (/jin + /magii). Selected next build (GBOARD). Lane-runner — the catalog's missing genre.

## Concept

Subway-Surfers loop in the Ather: a **spark of Ather** (same protagonist kind as Updraft's mote — keep the family consistent) dashes forward down receding **elemental lanes**, reading and swapping to clear gates while the **Dying** chases from behind. Endless, score-chase.

**The twist that saves it from being "Updraft with lanes":** the lanes ARE the four canon elements (Mana / Storm / Earth / Water). Each gate is tuned to one element — you must be in the *matching* lane to pass it. So the core skill is **read-ahead under dodge pressure** (spot the gate's element, swap in time), not pure reflex. Updraft is timing; Atherdash is positional anticipation.

## Canon framing

Plain-word act → no `-nyx` (naming law, `world/arcade.md`). Name **Atherdash** confirmed — punchy, on-brand, consistent with the cabinet's act-named games (Rekindle/Ward/Updraft/Seedfall). Fits the Kindled Mug umbrella: a light-myth of the *flight* — running the elemental currents ahead of the Dying. The 4 lanes = the 4 canon elements (`core.md`). Full `world/arcade.md` entry gets written the day it ships (SOP).

## ⚑ THE SLICE (build this FIRST — validate feel, ship nothing else)

Goal: prove the **pseudo-3D perspective feels like fast forward motion + clean lane-swaps.** If the depth illusion doesn't sell motion, we stop and rethink before building anything on top (Gravitar lesson: the tell is in the build).

**In scope (only):**
- 3 lanes (start with 3; widen to 4 elements after feel is proven).
- Receding-lane perspective + a scrolling glowing ground (lane lines + dashes) that reads as speed.
- The spark sits at a fixed near-bottom Y; lane-swap lerps its x (~0.12s) on input.
- A few inert drifting markers spawning at the horizon, riding their lane forward, to read depth/parallax.
- Forward speed constant (no ramp yet). Vector-glow house style (dark field, glowing lines, bright spark).

**Explicitly OUT of the slice:** gates, elements, obstacles, scoring, juice, speed ramp, the Dying-chase, sfx. None of it until the motion feels right.

### Perspective approach (the technical crux)
Fake-3D ground plane with a vanishing point — no real 3D.
- `horizonY` ≈ upper third; vanishing point at `(VW/2, horizonY)`.
- Each entity has depth `z` ∈ [1 (far, at horizon) → 0 (near, at camera)].
- Project: `f = 1 - z` eased for perspective (try `p = (1-z)/(1 + z*K)` with K≈2-3 so near-camera rushes).
  - `screenY = horizonY + (nearY - horizonY) * p`
  - `screenX = vanishX + (laneNearX - vanishX) * p`
  - `scale   = p` (objects grow as they approach)
- Forward motion = decrement every entity's `z` by `speed*dt`; recycle ground dashes from 0→1. The acceleration-as-z→0 is what sells "rushing past."
- Lanes: `laneNearX[i]` spread across the bottom; they converge to `vanishX` at the horizon automatically via the projection.

### Input
- Desktop: ←/→ or A/D swap lane.
- Mobile: swipe L/R (NOT tap — and **the Ward gotcha**: MCP `left_click` can't dispatch real `pointerdown`/swipe, so lane-swap feel MUST be confirmed on a real device, not the automated browser).

### Feel gate (the decision)
Touch the slice. Does it read as *running forward fast* and do lane-swaps feel *crisp*? Yes → proceed to phases. No → rethink the projection/speed before building more.

## After the slice (phases, ranked)
1. **Elements + gates** — 4 element-lanes; gates demand the matching lane; wrong lane = fail/hit. The core game.
2. **Obstacles + the Dying-chase** — dodge hazards; a creeping void wall behind raises stakes (miss a gate = it gains).
3. **Score + speed ramp** — distance + clean-gate combo; speed climbs.
4. **Juice + sfx** — lane-swap whoosh, gate-pass chime, vector-glow trails, near-miss flash.
5. **Canon + launch** — `world/arcade.md` entry, catalog card art (gen_cards.py brief), coming-soon → live flip.

## Files (when built)
`src/app/atherdash/page.tsx` (canvas + perspective render + input), `lib/atherdash.ts` (pure sim: lanes, entities, z-stepping, gate logic — testable via tsx), `lib/sfx.ts`. Pattern: pure sim first, tests green, then UI (house convention).
