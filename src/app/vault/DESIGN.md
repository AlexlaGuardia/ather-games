# Vault — design spine (sim-first) — canon RULED (CANON/game/vault.md, name LOCKED)

> **WORKING TITLE `bound`.** 🚩 CANON GAP — the real name + Athernyx theme is a Magii call
> (mirror of the Dewdrop/Dewbear ruling). The sim is theme-agnostic: entities are generic
> (runner / stomp-foe / spike / mote) so a canon re-skin is data/label only, zero logic.

## The verb
A one-button auto-runner. The runner moves right on its own, faster the farther you get; the
only input is **JUMP** — and jump is *variable* (tap = short hop, hold = float higher). You read
the terrain rushing at you and shape each arc to clear it.

## Why it earns a slot (the wedge vs Atherdash / Updraft)
The board already has two jump games, so this MUST NOT be a third rhythm-hopper:
- **Atherdash** = flat, fixed-height rhythm hop (timing on a beat).
- **Updraft** = vertical ascent dodge (climb).
- **Bound** = horizontal **platformer**: real terrain geometry. Three things none of the others have:
  1. **Variable jump arc** — tap vs hold changes height/length; you *shape* the jump, not just fire it.
  2. **Elevation** — ground sits at different heights (ledges/platforms), so you read-ahead and land, not just hop in place.
  3. **Stomp + bounce-combo** — land on a foe from above to kill it and bounce; chain stomps without
     touching ground for a rising multiplier (the Mario bounce-chain). Side-contact = death.
The skill = *reading mixed terrain ahead* (gap? ledge? stomp-foe? spike?) and managing your arc + chain.

## Sim model (pure, no canvas/React)
- World scrolls by `dist` (world units travelled). Runner screen-x is fixed; everything else is placed in world-x.
- **Terrain** = a list of platform segments `{x0, x1, top}`; the space between segments is a **gap** (pit).
  Generated ahead in chunks from the seed, culled behind. Height deltas between segments are bounded
  (always jump-clearable) and widen/raise with difficulty.
- **Physics:** gravity + variable jump (low-grav while rising & held, snappy fall), **coyote time**
  (jump just after leaving a ledge) and **jump buffer** (press just before landing still fires) — the
  fairness essentials, or a one-button platformer feels broken.
- **Entities** (placed on segments, scaled by difficulty):
  - **stomp-foe** — kill by falling onto its top (vy>0, feet above its mid) → bounce + combo++. Side hit = death.
  - **spike** — never stompable; any contact = death (forces a jump-over, mixes the read).
  - **mote** — collectible, often arced over a gap or above a ledge (reach = risk) → score.
- **Death:** fall into a gap (below the death line), side-hit a foe, or touch a spike.
- **Score** = distance (primary) + motes + stomp-combo bonus (combo persists only across consecutive
  aerial stomps; resets when you land on ground).
- **Difficulty** `diffAt(dist)`: run speed, gap width, height variance, foe/spike density all ramp; gentle on-ramp.
- **Deterministic** (mulberry32 seed) → free replays + a Daily + headless oracle agreement.

## Input API
- `pressJump(w)` / `releaseJump(w)` — button down/up (down buffers; up cuts a rising jump for the short hop).
- `tick(w, dt)` — advance physics, terrain, collisions, score; pushes events for FX/sound.

## Build order (sim-first discipline)
1. `lib/bound.ts` sim + `lib/bound.test.ts` green (physics, variable jump, coyote/buffer, stomp vs side-death,
   gap-death, spike-death, mote-collect, combo, determinism). **NO render yet.**
2. **Autoplay oracle gut-check** (the Seedfall/Driftling lesson) — a simple look-ahead bot proves a clean
   course is *survivable with skill* and the difficulty curve isn't a death-grind or a snooze. Tune consts.
3. Render + page + card art (D-step) — gated on Alex's cold-play of the feel + the Magii name ruling.
