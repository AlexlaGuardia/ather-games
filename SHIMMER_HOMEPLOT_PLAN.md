# Shimmer — Editable Home Plot (Scope)

> Alex greenlit this as the next build (2026-06-23), after big-map chunking + the
> jitter/scaling fix. Canon: the **Garden IS the home plot** — your private, persistent
> space where spirits live and you grow things (CANON/game/shimmer-multiplayer.md:32,
> shimmer-multiplayer-plan.md:83, design.md:127). "Owner can place/move/remove; visitors
> interact only." This scopes the **single-player** editable plot. Verify current code at
> build time; this is grounded in the 2026-06-23 state-map (see below).

## v1 boundary (what we build NOW)
- **The Garden becomes the player's editable home plot.** Edits layer per-player over the
  base zone (terrain + any design content stays; the player adds their own objects).
- **Place / move / remove OBJECTS** = furniture + structures, via an explicit **edit mode**.
- **Persists per-player** (furniture already does; structures need a save field added).
- Crops/planting already work and stay as-is.

## Explicitly DEFERRED (not v1 — don't scope-creep)
- **Multiplayer / visitors / invites / instancing / server-DB persistence** — the canon
  multiplayer layer is a separate, much larger build (netcode). v1 is single-player, saved
  to the existing per-player shimmerfile.
- **Terrain / tile-layout editing by the player** — heavy (per-player tilemap diffs). v1 is
  objects-on-top only. Canon implies the owner *could* alter layout; revisit later.
- Multiple plots / plot expansion / sharing.

## Already done (leverage — from the state map)
- Player furniture **place/move/delete in-game** + **per-player save** — WORKING
  (engine/furniture.ts; page.tsx:291-311 merge, :371 ref, :550-558 load, :835 save).
- Crops plant/grow/harvest, per-player — WORKING (engine/farming.ts).
- Dev **MapEditor** (?mode=map) + **StructureBuilder** — WORKING. These author the *catalog*
  of placeable furniture/structures; the home plot consumes that catalog at runtime.
- Structures are currently **dev-only (STUB for players)** — promoting them is core v1 work.

## Build list
1. **Edit-mode toggle** — a clear "Build" button (HUD) to enter/exit build mode on the home
   plot. Gate placement/move/remove behind it (vs. today's ad-hoc placement). Scope edit mode
   to the home plot zone only.
2. **Build palette (mobile-first)** — a panel to pick what to place (furniture + structures),
   sourced from the existing catalogs. Tap item → ghost preview → tap tile to place.
3. **Move + remove UX** — select a placed object → drag/move or delete. (Place exists; this
   completes the place/move/remove triad canon calls for.) Touch-friendly.
4. **Promote structure placement to players** — wire StructureBuilder's structures into the
   palette + runtime placement (today dev-only). Add a per-player **structures** save field
   + load/merge (mirror the furniture path).
5. **Validation** — can't place on impassable/occupied tiles, can't overlap, stays in-bounds.
6. **Polish** — placement sfx, snap-to-grid feedback, ghost preview, undo last placement.

## Open design defaults (Alex: flag any you'd change)
- **D1: Home plot = the start Garden** (canon-backed). Alt = a separate dedicated plot you
  warp into. Defaulting to the Garden.
- **D2: v1 = furniture + structures only, no terrain editing.** Defaulting yes.
- **D3: Keep the Garden's existing authored content** (player decorates around it), vs. thin
  it to a blanker canvas so the plot feels like *yours*. Defaulting to keep + iterate by feel.

## Verify-at-build
Re-read the current furniture placement interactions (page.tsx ~1785/1954) and how the build
catalog is sourced before wiring the palette — the state-map is from an Explore pass, confirm
exact entry points. Run the doctor after. Mobile-pass the palette + move/remove (phone primary).

## Sequence
Editable home plot (this) → then the terrain-generator thread for the big world (separate).
The plot is a small fixed zone, independent of the big-map work — they don't block each other.
