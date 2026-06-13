# Expeditions — Overhaul Design (LOCKED 2026-06-11)

> **STATUS: BUILT + LIVE (2026-06-12).** `lib/expedition.ts` is the 64×64 square
> survival arena described here; `components/Breach.tsx` renders it. The "Existing
> code being replaced" section below is historical — the replacement happened.
> Refraction (a v0.6 leftover) was fully excised 2026-06-12. This doc is now a
> reference for the shipped design, not a TODO. Remaining build-order items are
> polish, not a rewrite.
>
> The old 37×37 lane-fed breach (v0.6) was replaced. This is the direction,
> locked with Alex in the 06-11 design session.
> History: the prior unfold-corridor design (64×40 → 64×120) was scrapped in favor of
> the square survival arena below.

## The pitch
Tower-style survival. A square arena, your core at the center, three guard posts in a
**trinity** around it. The **flood** — fluid-based creatures — pours in from **all
directions**. You don't win; you survive and chase score. The boss isn't a wave on a
clock; it's the fail state made into spectacle.

## The arena
- **64×64 square** grid. Core at center.
- **Trinity**: 3 guard posts the host places around the core, ~120° apart.
  - Each post auto-engages flood within a radius. **Radius is invisible** in combat
    (shown only on placement/hover) — low visual noise; the player feels seams, not circles.
  - Host can **rotate** the trinity (not just position it) to angle a seam away from a
    heavy arc.
  - Three posts at 120° = there are always **seams** between them where coverage thins.
  - **lv5 host stretch**: unlocks a 4th post (square formation) — triangle-seams → cross-seams.
- **Trinity = always-on base guards.** The 3 **sigil champions** anchor *on top* as the
  heavy hitters (existing leashed-turret system).

## The flood
- Fluid creatures, **variety of size + speed**, but **slow-leaning pace — nothing fast.**
  Keep it readable and tense, not twitchy.
- Spawn on the perimeter, **omnidirectional**, with a **pressure bias toward the
  weakest-covered arc** (the seams) — the flood probes your gaps. Tune so only a fraction
  bias to seams; rest random, or it's punishing.
- **Fluid-merge / pooling**: flood that isn't killed and lingers near the inner ring
  **merges into bigger units** (minnow → glob → behemoth). Slow leaks compound into
  organic mini-bosses. This is the variety engine — no scheduled boss clock.

## The loop
- Small flood **attrition the guards** — that's their teeth. They wear down / knock out
  the trinity posts before reaching the center.
- **Guard knockout = recoverable**: a downed post goes dark and **respawns on a cooldown**
  (or costs banked mana to re-raise). Losing a post is a crisis you can claw back from,
  not an instant spiral. (Recommended; flip to permanent for a brutal mode later.)
- Flood that slips a seam or passes a downed post **flows to the core and fills it.**
  The **core-fill meter is the main HUD tension gauge** (since ranges are invisible, the
  growing pool at the core is what the player reads).

## Pacing
- **No scheduled bosses.** Variety comes from merge-tiers (organic behemoths) + a
  **surge rhythm**: periodically the tide swells and slams **one arc** harder
  (telegraphed), probing a specific seam. That's the run's heartbeat instead of a timer.

## The book-closer
- When the **core fills / you're overwhelmed → Tsunamizilla rises and washes the board
  out.** The flood's apex form IS the death spectacle. Run ends. No fight — it's the
  period at the end of the sentence.

## Progression
- **Endless, score-attack.** Score = waves survived / flood drowned.
- **First clear of a node opens the next node** (one-time milestone, ties into the warp
  network already shipped). After that it's high-score push.
- **Prizes** at high-score milestones (200 / 300) — wire later in a polish pass.
- **No hard cap** (the 100 gate is dropped).

## Build order
1. Arena + core + trinity placement (position + rotate), invisible ranges.
2. Omnidirectional pressure-spawn (seam bias).
3. Flood variety (size/speed, slow-leaning) + fluid-merge tiers.
4. Guard attrition + recoverable knockout (cooldown respawn).
5. Core-fill meter → Tsunamizilla wash-out run-end.
6. Surge rhythm.
7. Score + node-open milestone. (Prizes = later polish.)

## Existing code being replaced
- `src/app/nolmir/lib/expedition.ts` (550 lines, v0.6 lane breach — BREACH_W/H = 37)
- `src/app/nolmir/components/Breach.tsx` (227 lines, renderer, PX=14)
- `src/app/nolmir/lib/expedmeta.ts`, route `src/app/nolmir/expeditions/page.tsx`
- Off-post coupling + the warp/node network stay; the breach map + lane model go.
