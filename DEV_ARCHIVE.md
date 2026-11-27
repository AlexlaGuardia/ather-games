# DEV_ARCHIVE: dev tools removed from ather.games

BETA M214 (2026-11-26). Alex: *'a graveyard of old tools... make this a usable place'*. These routes and hub tabs
were removed from the app with an ordinary commit. Git keeps every one of them. The sha below is the last commit
that edited the route; it still has the files, so any one comes back with:

```
git checkout <sha> -- <dir>
```

(or, from the removal commit itself: `git log --diff-filter=D --format=%h -1 -- <dir>` gives the removal sha; check out `<that>^`).

`src/app/shimmer/dev/dev-pages.test.ts` reads this table: a listed route that ships again, or gets re-registered, goes red.

## Routes (30)

| route | last sha | last edit | files | what it was |
|---|---|---|---|---|
| `/shimmer/dev/voice-test` | `755504d6` | 2026-06-13 | `src/app/shimmer/dev/voice-test` | Voice test page (pixel era). |
| `/shimmer/dev/dialogue` | `73c088fe` | 2026-06-24 | `src/app/shimmer/dev/dialogue` | Dialogue graph editor (2.4k lines). Only page.tsx, NodeGraph, NPCBrowser, PropertiesPanel went: types.ts + validate.ts stay because /shimmer/save-dialogue imports validate. No live reader of data/dialogues. |
| `/shimmer/dev/runehold` | `e410a0aa` | 2026-08-24 | `src/app/shimmer/dev/runehold` | Rune hold bench (voxel). |
| `/shimmer/dev/portraits` | `8a93658c` | 2026-08-26 | `src/app/shimmer/dev/portraits` | Grimoire portraits (voxel). |
| `/shimmer/dev/icons` | `697f3e83` | 2026-08-26 | `src/app/shimmer/dev/icons` | Item icon sheet (voxel). |
| `/shimmer/dev/building` | `e75edc3b` | 2026-08-27 | `src/app/shimmer/dev/building` | Building glass (voxel). |
| `/shimmer/dev/creep` | `4c1791da` | 2026-08-27 | `src/app/shimmer/dev/creep` | Creep bench (voxel). |
| `/shimmer/dev/hold` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/hold` | Hold bench (play3d). |
| `/shimmer/dev/seam` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/seam` | Seam glass (voxel). |
| `/shimmer/dev/grey` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/grey` | The Grey: a Hollow at its hour (voxel). |
| `/shimmer/dev/break` | `b00e1206` | 2026-09-01 | `src/app/shimmer/dev/break` | Break bench (voxel). |
| `/shimmer/dev/ring` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/ring` | Ring fog glass (voxel). |
| `/shimmer/dev/moves` | `c90d4af2` | 2026-09-02 | `src/app/shimmer/dev/moves` | Moves bench (play3d). Not the Moves editor tab, which stays. |
| `/shimmer/dev/clay` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/clay` | Clay Moglin doll (play3d). |
| `/shimmer/dev/hollow` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/hollow` | Hollow bench (voxel). |
| `/shimmer/dev/court` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/court` | Court glass (voxel). |
| `/shimmer/dev/hud` | `fd67dbbc` | 2026-09-16 | `src/app/shimmer/dev/hud` | Old HUD corner on five backdrops (voxel). Not src/app/shimmer/hud, which the live game uses. |
| `/shimmer/dev/worktable` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/worktable` | Voxel worktable (1.6k lines). The live one is /shimmer/dev/blueprints. |
| `/shimmer/dev/stations` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/stations` | Stations glass (play3d). |
| `/shimmer/dev/hearth` | `25fec2ab` | 2026-09-23 | `src/app/shimmer/dev/hearth` | Hearth glass (voxel). |
| `/shimmer/dev/hud-kit` | `b01e9eb7` | 2026-09-23 | `src/app/shimmer/dev/hud-kit` | HUD kit (voxel). |
| `/shimmer/dev/cluster` | `8b0aae33` | 2026-09-23 | `src/app/shimmer/dev/cluster` | Garden cluster plan (voxel). |
| `/shimmer/dev/beds` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/beds` | Beds and shelves (voxel). |
| `/shimmer/dev/station` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/station` | Gate station (play3d). |
| `/shimmer/dev/passage` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/passage` | Passage bench (play3d). |
| `/shimmer/dev/runehold-look` | `d646c975` | 2026-11-14 | `src/app/shimmer/dev/runehold-look` | Rune hold look (play3d). |
| `/shimmer/dev/panel` | `e5aa69a7` | 2026-09-28 | `src/app/shimmer/dev/panel` | Keeper panel over a fabricated keeper (play3d). |
| `/shimmer/dev/hud-mock` | `f50ea57b` | 2026-11-22 | `src/app/shimmer/dev/hud-mock` | HUD mock (voxel). |
| `/shimmer/arena` | `1555ca2f` | 2026-09-02 | `src/app/shimmer/arena` | Keeper's Arena cold-play harness. components/ArenaBattle.tsx stays (play3d/voxel3d mount it). |
| `/shimmer/voxel3d/tex` | `a70e9508` | 2026-09-09 | `src/app/shimmer/voxel3d/tex/page.tsx + layout.tsx + TexSpike.tsx + TileStrip.tsx` | Block texture spike route. The rest of voxel3d/tex stays: the live HUD draws item icons through tex/item-icon.ts. |

## Hub editor tabs (18)

Removed from `/shimmer/dev?mode=...` (EDITOR_MAP, TAB_GROUPS, the Ctrl-K palette). Files live in
`src/app/shimmer/dev/editors/`; bring one back from the M214 removal commit's parent. Rule used: a tab stays only
if the live open world (`src/app/shimmer/open/**`, static import closure) reads the data it edits.

| mode | tab | file(s) | why it went |
|---|---|---|---|
| `sprites` | Art | `SpriteEditor.tsx (+ GrimoireSelector, SpiritConfig)` | pixel spirit sprites; no live renderer |
| `player` | Player | `PlayerEditor.tsx` | pixel player sprites (alex/gregory/kael/player.ts): not reached by open/. The Doctor player-map checks now skip (they read this file). |
| `furniture` | Objects | `FurnitureEditor.tsx` | pixel furniture frames; no live reader |
| `nodes` | Nodes | `NodeEditor.tsx` | pixel node frames/palettes; only MapEditor drew them |
| `map` | Map | `MapEditor.tsx (+ StampManager, AutoLayerRules)` | 2D tile maps (world/zones etc.), not reached by open/. autolayer-engine.ts stays (world/autolayer-rules imports it) |
| `structures` | Structures | `StructureBuilder.tsx` | world/structures: not reached by open/ |
| `npcs` | NPCs | `NPCEditor.tsx` | world/npcs: not reached by open/ |
| `battle` | Battle | `BattleTester.tsx` | pixel battle scenes: not reached by open/ |
| `banner` | Banner | `BannerEditor.tsx` | pixel-era banner tool |
| `puppet` | Puppet | `PuppetEditor.tsx` | engine/puppet: not reached by open/ |
| `exchange` | Exchange | `GEEditor.tsx` | engine/exchange: not reached by open/ |
| `encounters` | Encounters | `EncounterEditor.tsx` | engine/encounters: not reached by open/ |
| `quests` | Quests | `QuestEditor.tsx` | engine/quests: not reached by open/ (the live quests are open/shared) |
| `grimoire` | Grimoire | `GrimoireEditor.tsx` | spirits/grimoire: not reached by open/ (the live grimoire is a different thing) |
| `doctor` | Doctor | `DoctorPanel.tsx` | M214 s2, Alex 11-26. Checks panel over /shimmer/doctor (last sha `755504d6`). The route + checks.ts stay: canon-drift and subjects.test read them. |
| `meshbench` | Mesh Bench | `MeshBench.tsx` | M214 s2, Alex 11-26. Voxel greedy-mesh bench (last sha `bc438122`); voxel/greedy stays, the live item icons mesh through it. |
| `weather` | Weather | `WeatherEditor.tsx` | engine/weather: not reached by open/ |
| `spinner` | Spinner | `SpinnerEditor.tsx` | Luna thinking-config on :8200, not the game |

## Kept tabs, and the live reader that kept each

Creative mode (`terrain`, open/ world builder) · Gallery (`spirits`, M213) · Tools (engine/tools <- game-hud) · Alchemy (engine/alchemy) ·
Skills (engine/skills <- game-hud) · Moves (engine/moves <- spirit-growth) · Day/Night (day-cycle) · Items (ITEM_ICONS, painted by the live
HUD through voxel3d/tex/item-icon.ts) · Evolution (spirits/evolution-config <- second-form-gate, live since 11-26) · Farming
(voxel/crops.ts CROP_DEFS <- voxel/registry) · Resources (world/resources <- open/ather/forestry) · Mana (engine/mana <- alchemy).
Route kept: `/shimmer/play3d/birth` (on the audit's list, but the live Options dev panel links to it and its
BirthScreen writes the live keeper's birth rune, the same screen open/birth-gate.tsx mounts).
Doctor and Mesh Bench were kept in doubt in s1 and dropped in M214 s2 (Alex 11-26).
