# Shimmer 3D Plan
> The plan for shifting Shimmer from the 2D pixel-canvas renderer to stylized 3D (web/WebGL).
> Authored 2026-06-25 (Jin + Alex). Decision-of-record — update as phases land.
> Companions: `SHIMMER_MAINMAP_WIRE.md` (map state), `.claude/skills/jin/SHIMMER_SESSION.md` (session log).

## The bet
Pixel art is being put down. Going 3D isn't *more* art work — a model is built/grabbed **once** and
animates from a skeleton (no per-frame sprite redraw), and free packs + Blender + Mixamo cover the rest.
Shimmer's value is its **systems**, and those are renderer-agnostic.

## The one principle that makes this safe
**Systems are sacred; the renderer is swappable.** We replace only the *draw* layer. Movement, zones/warps,
collision, battle, quests, dialogue, skilling, inventory, the blockout grids — all stay. The 2D canvas was
always the placeholder ("build systems not art"). The full-map blockout we just shipped is the substrate.

## Locked decisions (Alex, 2026-06-25)
- **Stack:** Three.js via **React Three Fiber** (`@react-three/fiber` + `@react-three/drei`), same ather-games
  Next.js project. `three` is already a dep. **NOT Unity** (separate C# toolchain, GPU-heavy editor, pulls out
  of the web stack we're fluent in — parked).
- **Camera:** **top-down / isometric 3D** (Don't Starve / A Short Hike angle). Grid movement maps 1:1 to 3D
  x,z; zones/warps survive unchanged. FPS is Supra's lane, not Shimmer's.
- **Art sourcing:** **asset packs first** (Kenney / Quaternius — CC0, commercial-safe) to stand the world up
  fast; Blender + Mixamo (free auto-rig + animation) as the skill ramps. This is what lets pixels go down NOW.
- **Editor cap — the anti-black-hole rule:** NO in-app 3D editor suite. 3D content is authored in **external**
  tools (Blender/Mixamo/packs). The dev page stays the **data + validation** layer only. Prop placement rides
  the existing blockout grid (a cell id → a prop), edited the way we already do.

## The /dev page in 3D — it SHRINKS, it doesn't grow
**Retire (~11 — the highest-maintenance third):** SpriteEditor, PlayerEditor, BeastEditor, FurnitureEditor,
ItemEditor, BannerEditor, PuppetEditor, SpinnerEditor, StampManager, AutoLayer — plus the whole sprite
pipeline (`sprites/`, `save-sprite`'s regex source-mutation, the frame-map-in-3-places contract, the
durations / movement-phase sidecars, `save-battle-bg`). **This pipeline IS the black hole** — pixels going
away is what finally kills it.
**Keep (~21 — renderer-agnostic game data):** MovesEditor, EvolutionEditor, NodeEditor, ResourcesEditor,
ManaEditor, SkillsEditor, AlchemyEditor, FarmingEditor, EncounterEditor, QuestEditor, NPCEditor, SpiritConfig,
WeatherEditor, DayCycleEditor, ToolsEditor, GEEditor, VoiceProfilesEditor, the dialogue editor, DoctorPanel,
BattleTester. These edit data 3D needs identically.
**Becomes the map tool:** the **BlockoutEditor** (semantic cells → 3D kit pieces, 1:1). The heavy art-painting
MapEditor mostly retires.

## Phases
- **Phase 0 — Plan locked** (this doc). ✅
- **Phase 1 — Renderer seam, one zone walkable.** Add R3F; render a zone's floor + walls *extruded straight
  from a blockout grid*; a capsule character driven by the **existing** movement system; iso camera; behind a
  2D/3D flag. Proves the systems plug in unchanged. **Primitives only — no art blocker.** Owner: **Jin**
  (architecture-defining; everything hangs on this seam).
- **Phase 2 — Character + camera feel.** Real low-poly character (pack / Mixamo); nail movement + camera feel.
  Alex feel-gates. This is where the tone is decided.
- **Phase 3 — Kit + dress one zone.** A modular 3D tile-kit keyed to cell-ids; **Moonwell Glade** fully dressed
  = the look target. Then roll across the zones — **layouts are already blocked out**, so this is kit-placement,
  not redesign. *Delegatable once the kit pattern is set.*
- **Phase 4 — Creatures, battle, UI.** Spirit models; battle in 3D (or stylized-2D over the 3D world); HUD /
  menus stay 2D React overlay (normal + fine).
- **Phase 5 — Retire.** Delete the 2D renderer + the dead pixel editors + the sprite pipeline. Dev page shrinks
  to the keepers.

## Ownership / how we proceed
- **This is GAME work = Jin's lane, NOT Serberus.** Serb owns the substrate (backend / infra / cortex). The
  renderer + game systems are Jin's. Don't hand the whole thing to Serb — lane mismatch.
- **Jin drives Phase 1** (the seam sets the architecture; judgment-heavy, do it right by hand).
- **Once the patterns are locked** (renderer abstraction, blockout→geometry pipeline, camera/movement feel),
  the **repetitive** content/dressing work (Phase 3 across zones, asset wiring) becomes **delegatable** — to the
  `glass`/`pixel` shadows or cheaper Aider agents — with Jin reviewing. Delegate the grind, not the architecture.
- **Alex:** art sourcing (packs → Blender), the feel/taste gate, "is it fun / is it right."

## Risks / honest costs
- Renderer rewrite is real work (`renderer.ts` is 2D-canvas-specific: chunked bg bake, culling, blit) — but
  bounded, and the systems are kept.
- Every visible thing needs a 3D equivalent (content cost) — mitigated by packs + the already-done layouts.
- Art skill shifts Aseprite → Blender (a real personal ramp) — but per-frame sprite drudgery is gone.
- Camera/feel needs iteration — that's the fun, not a risk.

## Not in scope / don't confuse
- **Supra** = the from-scratch Rust/wgpu **FPS** engine (SWE-craft + resume track). Different game, different
  ambition. "Ship Shimmer in 3D" = R3F here, **not** Supra.
