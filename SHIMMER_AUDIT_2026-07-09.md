# Shimmer Audit — 2026-07-09 (jin-cc)

Scope: all of `src/app/shimmer/` (~75k LOC across engine, play3d, dev editors, sprites, world, save routes)
plus canon gate, build health, tests. Four parallel readers; every finding below re-verified by hand.

**Canon gate: 5 CLEAN.** Production `tsc`: clean. Nothing is blocked on a Magii ruling.

---

## Ruled out (do not act on)

- **"Save routes have no auth."** FALSE. The owner gate is live at `src/proxy.ts` — Next 16 renamed
  `middleware.ts` → `proxy.ts`, which is why a `find -name middleware.ts` came up empty. Verified:
  `/shimmer/save-*`, `/shimmer/dev`, `/shimmer/doctor` all return **403** on localhost and on
  ather.games; `/shimmer/play3d` returns 200. The save routes are owner-only. This downgrades every
  injection finding below from "remote code exec" to "malformed payload corrupts your own source."

---

## P0 — real bugs, shippable fixes

### 1. `newGame()` doesn't reset half the save — and `persist()` writes the leftovers back
`play3d/Shimmer3D.tsx:1623-1644`

Resets party, flags, skills, mana, inventory, tools, structures, defeated, zone, position.
Does **not** reset `beastsRef`, `activeBeastIdRef`, `chestsRef`, `geRef`, `plantedCropsRef`, wallet gold.
Then calls `persist()` at `:1642`, which writes all of them (`:1036-1056`).

Result: New Game keeps the previous run's companions, chests, planted crops, and exchange market.

**Extra, found during verification:** `persist()` merges `flags: { ...prev.flags, ...flagsRef.current }`
(`:1043`). `newGame` sets `flagsRef.current = {}`, but the merge with `prev.flags` from disk means
**old story flags survive New Game too.** The reset of `flagsRef` is defeated by its own save path.

### 2. Beast editor can't save `pet` / `eat` / `sleep` — it 400s
`dev/editors/BeastEditor.tsx:67-69` exposes `pet`, `eat`, `sleep`.
`save-sprite/route.ts:125-165` (`beastFrameMap`) never generates those keys.
POST → `constNames` undefined → `route.ts:841` returns `{ error: 'Unknown animation' }`, 400.

Paint any of those three, hit save, lose the work. The doctor already flags this as an ERROR
(`beast-map-sync`) — the finding was sitting there unread.

### 3. `engine/rinning.test.ts` is a false-green — it crashes on run
The classic-cast rewrite (`bc6deb8`, Alex-approved 07-09) deleted `hookQuality` and the `'waiting'`
phase. The test still imports `hookQuality` (`rinning.test.ts:2`) and asserts on `'waiting'` (`:12,13`).
`TypeError: hookQuality is not a function`, plus 6 of the repo's 15 `tsc` errors.

It looks like coverage on the most recently shipped system. It is not.

---

## P1 — structural, will slow the next feature

### 4. `Shimmer3D.tsx` is a 2640-line god component
41 `useState`, 73 `useRef`, 25 `useEffect`, 6 `useFrame` — the great majority inside one function
(`:943-2521`). Every new feature threads through it.

Ready-to-lift seams, near-zero risk, in order of cheapness:
- The 5 station menus are already self-contained IIFEs: brew `:2223`, craft `:2263`, chest `:2376`,
  exchange `:2398`, farm `:2447` → `StationMenus.tsx`
- Scene primitives `:185-498` (NPCMarkers, NodeMarkers, StructureMarkers, FloorTerrain, Tiles…) → `Zone3D.tsx`
- World FX `:669-740` (Follower, FishTell, HarvestPop) → `world-fx.tsx`
- Save/load `:1036-1153` → `useShimmerSave()`
- Skilling drivers `:956-1222`, `:1430-1512` → `useSkilling()`
- Battle orchestration `:1514-1720` → `useBattles()`

### 5. Idle re-render storm in the R3F tree
No `React.memo` anywhere in the scene subtree. Top-level `Shimmer3D` re-renders **every 500ms**
whenever mana is below max (regen interval `:1157-1170`) and **~11×/sec during a harvest channel**
(`:1489-1512`). Each render re-runs all of `Scene` and re-allocates every marker.

Worse, `Scene:845` and `:847` build fresh `.filter()` arrays inline, so `memo` alone wouldn't help.

Fix: `memo` on `Scene` + markers, `useMemo` the two filtered arrays keyed on `[zone.id, defeated, structures]`.
Drives idle render cost to ~zero. This is the cheapest perf win in the codebase.

### 6. Save routes interpolate unvalidated payload into source files
Owner-only (see "ruled out"), so this is *self*-corruption, not a vuln. Still a real footgun — a
malformed editor payload writes broken TypeScript into tracked source and breaks the build.

- `save-map/route.ts:401` — grid cells go straight into generated TS via `n.toString()`, no element validation
- `save-map/route.ts:469` — `type: '${n.nodeType}'`, unescaped; a quote in the value breaks the file.
  Same pattern for `structureId`/`furnitureId`/`itemId`/`chestType`/`toZone`/`requiredFlag`/`direction` (`:500-603`)
- `save-map/route.ts:398` — `Math.max(...grid.flat())` spreads the whole grid as args; large maps throw
  `RangeError`, and a non-number cell makes `maxVal` NaN → writes the literal `"NaN"` into source
- `save-sprite/route.ts:429-437` — `species` from the body becomes `${species}.ts` and is `join`ed onto
  `SPRITE_DIR` with only a 4-item blocklist, no allowlist. `species = "../../world/x"` creates a file there.

`save-dialogue/route.ts:16` and `save-structure/route.ts:41` already have the fix: `SAFE_ID = /^[a-zA-Z0-9_-]+$/`.
Copy it to `save-map`, `save-sprite`, `save-npc`. Coerce numerics; `JSON.stringify` interpolated strings.

---

## P2 — rot and waste

### 7. ~432 lines of confirmed-dead engine code (zero importers, repo-wide)
- `engine/reputation.ts` (267 lines) — a complete NPC gift/reputation system, never wired to anything
- `engine/dialogue.ts` (101) — superseded by `dialogue-runtime.ts`
- `engine/placed-structures.ts` (64) — orphaned duplicate of `engine/structures.ts`

Unsure: `arena.sim.ts`, `party-battle.sim.ts`, `species-balance.sim.ts` — no importers, no npm script.
Balance sims run by hand via `npx tsx`? If not, delete.

### 8. ~15 painted sprite consts that never render
Art on disk, not wired into any `_SPRITES` export. `bat.ts:89,108` · `firefly.ts:89,108` ·
`fox.ts:622,657,756` (three painted battle frames) · `hummingbird.ts:89,108,127,146` ·
`water-bear.ts:286,306,326,368,388,408,446` · `player.ts:831`.

The doctor flags all of these as `orphan-frame` WARN. Painting ≠ wiring, and nobody read the warnings.

### 9. Doctor blind spots
It never runs `checkSpriteFile` on `beasts.ts`, never range-checks spirit palettes (they live in
`palette.ts`, not inline, so the check silently skips all 10), and **never enforces the 16-color cap**
despite that being the stated contract. It also compares frame maps by *keys only*, never by values.

Consequence: `BEAST_SPRITES` (`sprites/beasts.ts:1223+`) has drifted from `beastFrameMap` — it has no
run phases at all, and `drifthorn.downright_walk` points at idle frames where the route targets step
frames. Beast step/run frames get painted and saved to consts the renderer never reads. Invisible today.

### 10. `world/tiles.ts` — 4042 lines, ~97% data
103 tile bitmaps + 5 **hand-maintained parallel boolean arrays** (`SOLID`/`ABOVE`/`VEIL`/`VEIL_DENSE`)
indexed positionally by tile id. Add or remove a tile without editing all five in lockstep and
collision silently desyncs. Move to per-tile JSON objects and the desync class disappears.

### 11. Editor duplication — ~600-900 LOC collapsible
23 of 29 editors hand-roll the same `fetch('/shimmer/save-*') → status → onDeploy()` block plus a
load-on-mount effect. `useEditorResource(route, {load, serialize})` collapses it and would fix the
inconsistent error swallowing in one move. `dev/hooks/useShortcut.ts` has **zero callers** (dead).
`useAutoSave` + crash recovery is built but adopted by only 2 of 29 editors.

### 12. Stale comment lying about the code
`Shimmer3D.tsx:1006-1007` says "No overworld follower render / care loop in the walker yet." The
follower render exists (`:669`, mounted `:850`). Only the care loop is missing. This is exactly the
comment someone reads when deciding whether to build the care loop.

---

## Process finding — a canon gap that never reached the queue

`SHIMMER_SESSION.md:128-130` flags the **Sporeling collision**: the build treats it as a Forestry@15
beast, while `CANON_GAPS.md:49` already **RULED** Sporeling → "Sporebloom" (Alchemy). Ruled one way in
canon, built the other way in code, and the ambiguity was logged only in the session file — which is
the exact failure mode `SHIMMER-CANON-BOUNDARY.md` warns about, since Magii never opens the game repo.

Not blocking today. Should be filed as `[OPEN]` in `CANON_GAPS.md` before more skilling work stacks on it.

---

## Also worth knowing

- The 2D overworld (`page.tsx`, 4967 lines) is **superseded**, not dead. `/room` links to
  `/shimmer/play3d` (`src/app/room/page.tsx:20`); the only inbound link to bare `/shimmer` is the dev
  hub's convenience link. In-file comment `:1471`: "pixels are retired pending the 3D pass."
  Mine it for logic to port to 3D. Don't polish it.
- **No lint script exists.** `package.json` has `dev`/`build`/`start`/`canon`/`canon:report` only.
  `play3d/` and `engine/` — the newest, most active code — are covered by neither lint nor the doctor.
- **Tests:** two files touch shimmer. `renderer.chunks.test.ts` passes (20/20). `rinning.test.ts` is
  broken (P0 #3). `arena`, `skills`, `crafting`, `exchange`, `farming`, `inventory`, `tools` — the
  entire gameplay engine — have zero committed tests. The "18,000 assertions" sweeps were throwaway.
- `engine/multiplayer.ts:36,278` — the only two `any`s in engine+play3d, both on the untyped WebSocket
  payload seam. Type them before multiplayer ships.
- `Shimmer3D.tsx:1443,2181` — two unguarded non-null assertions on tool-map lookups (`equippedToolsRef
  .current[skillId]!.toolId`, `t!.usesRemaining`). Low probability, but they're the two that throw.

---

## Recommended order

1. Fix `newGame()` reset + the `prev.flags` merge (P0 #1) — a player-visible bug in the live walker
2. Fix `rinning.test.ts` (P0 #3) — cheap, and it's rot on the newest system
3. Add `pet`/`eat`/`sleep` to `beastFrameMap` (P0 #2) — unblocks the care-loop art you'd need next anyway
4. `memo` + `useMemo` the scene subtree (P1 #5) — cheapest perf win, ~20 lines
5. `SAFE_ID` + numeric coercion on the three unguarded save routes (P1 #6)
6. Extract the 5 station-menu IIFEs out of `Shimmer3D.tsx` (P1 #4) — start the decomposition where it's free
7. Delete the 432 dead engine lines + wire or delete the 15 orphan sprites (P2 #7, #8)
8. File the Sporeling gap as `[OPEN]`

Note that #3 (beast frame map) and #12 (the stale comment) both sit directly on the path of the
**Mana'mal care loop** — the feature that was queued next. That's not a coincidence; it's what a
half-finished system looks like from the outside.
