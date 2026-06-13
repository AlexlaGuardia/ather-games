# Rekindle — design (game #3)

> Locked 2026-06-12. A cozy mana-conduction puzzle. Canon-by-construction (the
> machines of Aeterna were left running; nodes have gone dark — you bring the
> flow back). Clears the filter: real gimmick (the flow puzzle), canon-parallel,
> near-zero art (geometry + glow, not sprites).

## Fantasy
The engines hum on in the dark. Route **Ather** through a grid of **conduits** to
a dormant **core** — connect the network and it catches, glows, *rekindles*. Each
level is a little dead machine you bring back to light. Calm, tactile, no timer.

## Core mechanic (the gimmick)
Infinity-Loop / Pipes style, cozy variant:
- A grid of **conduit tiles** — straight, elbow, T, cross. **Tap/click to rotate.**
- Each tile has connector sides; rotation turns them. Two adjacent tiles connect
  when both have an open side facing each other.
- A **source** pushes Ather; flood-fill the flow through connected tiles.
- **Win** when every **core** is reached (lit). Connected tiles glow live; the
  rest stay dark. No timer — rotate until it all clicks and the machine wakes.

## MVP (slice 1 — rotate-to-rekindle)
- A grid of rotatable conduit tiles (CSS/SVG geometry, rotation transform on tap).
- One source, one core, one hand-made level.
- Connection detection (flood-fill from source over open-side adjacency).
- Live glow on energized tiles + a **rekindle** payoff (glow cascade + whoom) when
  the core catches → level complete. End-to-end.

## Then
- **Slice 2** — a level set (hand-authored data or a seeded generator) + a
  world-map / level-select of dormant machines + payoff polish (glow, sound).
- **Slice 3** — depth: **Ather colours** (cores need a colour; conduits carry it;
  **prisms split** one flow into two — ties to Mana'nana's Prism), plus special
  tiles (one-way conduit, blocker, valve). Difficulty curve. Maybe a **daily
  machine** (seeded → shareable), free retention via the toolkit RNG.

## Toolkit reuse
- `@/lib/arcade/sfx` — new patch: conduit rotate (soft click), flow-connect hum,
  core rekindle (whoom), level complete.
- `@/lib/arcade/rng` — seeded level gen → daily puzzle.
- `AtherBackdrop` — the dreamy atmosphere behind the grid.

## New to build
- The tile model (base connector sides + rotation → open sides).
- Grid render: rotatable tiles drawing their conduit segments + glow state.
- **Flood-fill connection** from source → cores; win check.
- Level data format (+ a simple generator for slice 2).

## Art direction — ATARI VECTOR-GLOW (Alex, 2026-06-12)
Retro-vector aesthetic: the **Tempest / Asteroids** lineage, not chunky 2600
blocks. Bright glowing **phosphor lines on black**. Conduits = neon vector
segments; cores = pulsing wireframe rings/polygons; the Ather = a bead of light
that travels the wire when it connects. CRT finish: soft bloom, faint scanlines,
a vignette, maybe a subtle flicker. Limited bold palette (classic arcade
cyan/amber/magenta/green on black). Thematically the canon fits — ancient Aeterna
machines *should* read as humming retro-tech consoles. Near-zero art: bold
primitives + glow, no sprites at all. (Catalog note: Mana'nana = glossy modern;
Rekindle = retro-vector — each game its own look under the "Arcade" frame.)

## Rendering
Best on a **canvas** for the vector-glow (stroked lines + shadowBlow glow +
additive bloom), though a CSS/SVG grid with `rotate()` + box-shadow could do a
simpler version. Tile = base connector sides rotated by its turn count; energized
sides stroke bright, dark sides dim. Connection = graph flood-fill from the source
over open-side adjacency each change. Touch-friendly (tap = rotate). A light CRT
overlay (scanlines + vignette) on top.

## Open choices (decide at build)
1. **Win rule** — "light all cores" (clear goal, recommended) vs "no loose ends"
   (the satisfying everything-clicks Infinity-Loop feel). Could do cores for v1,
   add tidiness as a star/bonus later.
2. **Levels** — hand-authored first (tighter, better feel) vs generator-first.
   Lean hand-authored for slice 1–2, generator for endless/daily later.
3. **Colours in v1 or v2** — I lean single-colour v1, colours in slice 3.

## Wiring (same as the others)
Route `/rekindle`; add a card to `/arcade` + the avatar menu apps list.
