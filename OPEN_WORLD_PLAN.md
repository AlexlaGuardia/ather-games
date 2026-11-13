# Open World — the plan

> Started 2026-11-13 (Jin, hub). Alex, after six weeks away: the voxel Shimmer was the test run, not
> the game. The game is an open-world Athernyx sandbox — "GTA in our universe, go wherever it takes
> you." The feel reference is a survival-crafting co-op game Alex loves; we learn its craft, we never
> copy it. The answer to "why play ours" is how we build it and the story Alex is holding (situational,
> he steers it as the journey takes shape — not a script up front).

## The four boxes every build must tick
1. **FPS** — first-person shooting. Guns are damage, casts are utility (ruled 09-28, still law).
2. **Movement** — ours, kept. The Apex-lineage walker Alex tuned since August.
3. **Adventure** — places worth going; the world pulls you outward.
4. **Home plot building** — snap pieces, not blocks.

## Rules of the build
- **Feel first, world second.** A small box that is fun for ten minutes, then repeat it with variety.
  A bigger map never fixed an unfun slice.
- **Systems over content.** The world is generated land + hand-stamped landmarks + creatures and
  weather that make their own stories. We cannot out-author a studio; we can out-system one.
- **Stylized low-poly, one palette atlas.** Cheap for agents to make, cohesive, runs on the UHD 630.
- **Stay on the web stack** (three 0.183 / R3F / Next, `breach-server`) for the slice. Native or
  Supra is decided after the slice proves the feel, not before.
- **Canon is law.** Region names, landmarks, who lives where = Magii. Shape, scale, placement = Jin.

## Salvage map (read from the code 11-13)
| Carries as-is | Carries re-grounded | Does not carry |
|---|---|---|
| locomotion tuning + 202 feel asserts | vault / climb / mantle / wall-jump (block faces → surface normals) | voxel chunks, block place/break |
| weapons maths, aim, recoil, FP hands | home plot (rules stay, blocks → snap pieces) | block terrain gen |
| `engine/` systems: crafting, alchemy, farming, day cycle, bank, dialogue, encounters, keeper moves | expedition generator (room graph stays, dressed in models) | `VoxelWorld.tsx` glue (12K lines) — rewritten lean |
| lobby / party / presence / `breach-server` | | |
| cartoon shader, sky, day-night, Blender station models | | |

## Stack (from two research passes, 11-13)
- **Collision:** pure-TS `LocoWorld` — seeded heightfield + box/cylinder/ramp primitives in a spatial
  hash. Same code on client and `breach-server` (authoritative movement for free). three-mesh-bvh only
  later, for authored non-convex meshes (caves, ruins). No Rapier: its corrected-move API fights our
  state machine, and it is a 1.2MB download.
- **Terrain:** `height(x,z) = noise + Σ stamps` (pads, plateaus, ridges, roads). Deterministic, so the
  server never downloads a heightmap. 32–64m chunks, 2–3 LOD rings with skirts, fog hides the edge.
- **Look:** warm gradient sky dome + matching fog (height fog) + toon ramp first; wind-animated
  instanced grass; vertex-colour / palette atlas; baked AO, blob shadows, no real-time shadows.
- **Budget (UHD 630):** ≤100 draw calls, ≤500K tris, pixel ratio ≤1.25. WebGL2; WebGPU only after a
  benchmark on Alex's desktop.
- **Assets:** Meshy → Blender script that decimates AND re-snaps to the palette atlas, with a tri/palette
  gate. That script is the investment that keeps a mixed-source kit cohesive.

## Phases (each ends with Alex touching it)
- **P0 Feel slice** — one small hillside: slopes, a cliff, a ledge, a pond. The walker on `TerrainWorld`
  passing the same feel oracle, plus sky/fog/toon. *Exit: Alex runs, slides, climbs and says "that's mine."*
  - [x] step 1: walker asks a `LocoWorld` (`f9d310ed`, oracle 202/0 unchanged)
  - [x] step 2: `TerrainWorld` (`open/terrain-world.ts`) — voxel oracle 202/0 through it (`LOCO_WORLD=terrain`), land oracle 14/0, both mutation-checked
  - [x] step 3: `/shimmer/open` — land, Core sky, first-person walker (`6ae9c1ab`); mood layer (toon, grass) still to do
- **P1 The gun** — one weapon with weight on the slice, targets, hit feedback.
- **P2 Home plot** — 8 pieces (foundation, floor, wall, door wall, window wall, roof flat+slope, stairs,
  beam), 4m cell + half-step. Effort goes into auto-orient to the nearest edge, ghost validity, and
  foundations that level on slopes. No structural integrity (players of the reference game resent it).
- **P3 One adventure** — one landmark worth walking to, one thing to find, one danger.
- **P4 The open world** — chunk streaming, regions with their own fog/weather/music, tool-gated return
  trips, co-op on `breach-server`.

## Open — Alex's call
- Region names and the map of the open world → via Magii when P3/P4 need them.
- The story layer: Alex's, steered as the journey takes shape.
