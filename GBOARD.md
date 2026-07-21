# GBOARD — Akatskii Games Board

The games catalog board — sibling to PBOARD / TBOARD / BBOARD / SBOARD. Concepts,
queue, shipped. Playable games live at `/arcade`.

**The filter** — every idea must clear all three:
real **gimmick** (not watch-and-wait) · **canon-parallel** (serves Athernyx, not
"doing it to do it") · **light on art**.

**House look** — retro **Atari vector-glow** for the arcadey ones (phosphor lines on
black, CRT bloom). Mana'nana went glossy-modern; each game gets its own skin under
the Arcade frame.

## 🗓️ STATE OF THE ARCADE — POLISH LAP (reconciled 2026-07-01) [jin]
> **The new-cabinet pipeline is CLOSED — all 14 cabinets are live.** The 06-25 nine-day push delivered its
> two sanctioned builds (**Dewdrop** + **Vault**), plus **Driftling** + **Squall** in the same arc, fulfilling
> the standing strategy — **"two more cabinets, then STOP adding and polish the lineup."** Vault's render
> shipped 06-29 (render shell + stomp-double-jump + Daily + leaderboard), so **no cabinet is mid-build.**
> Its only remainders (Alex feel-test + card art) fold into the polish lap like everything else.
>
> **Where we actually are:** **12 live play cabinets** (Mana'nana · Rekindle · Ward · Updraft · Seedfall ·
> Voranyx · Atherdash · Driftling · Squall · Dewdrop · Vault · Nolmir) + Magii (world wall) + Shimmer (room
> wall). Back-room/held: Lucernyx, Gravitar. **Feature-complete on cabinet count. This is the polish lap now.**
> **Shimmer (room wall → 3D walker) side-track, 2026-07-05 (`1718a57`):** placeable stations expanded past
> brew/craft to 5 — added **Chest / Exchange Booth / Farm Planter** on a generalized station-menu system.
> Full detail + Left off/Next lives in `SHIMMER_SESSION.md` (its own session cadence, not cabinet-shaped).
>
> **Shimmer save-route guards SHIPPED 2026-07-10 (`a97cd9c`)** — `shimmer/lib/safe.ts` + 57 mutation-checked
> assertions; closed the audit's P1. Two real defects behind it (a sprite-dir write escape, an arbitrary file
> read via `save-npc`'s `spriteFile`), not just cosmetics. Detail in `SHIMMER_SESSION.md` + the audit doc.
>
> **Shimmer Decisions (don't relitigate):**
> - **✖ KILLED — Mana'mal care loop / races / menagerie (Alex, 2026-07-05).** Companions stay **simple**:
>   one flat passive perk each, no feed→happiness→perk-strength tending, no races mini-game, no home-plot
>   menagerie. *Why:* keeps the cozy gatherer from turning into a pet-management sim; the companion is a
>   quiet passive bonus, not a system you maintain. Fits the Keepers/anti-collar ethos. It got re-pitched
>   twice after being killed (2026-07-08, 2026-07-09) because it was still sitting in `SHIMMER_SESSION.md`'s
>   NEXT line with no decision recorded anywhere — hence this entry. **Do not propose it again.**
>   Consequence: the happiness field is vestigial (pinned full); `getPerkStrength()`'s happiness scaling can
>   be stripped whenever someone is in that file.
> - **Sporeling/companion tiers are CANON** (`athernyx/CANON/game/shimmer-skilling.md` §Two-Tier Companions),
>   ruled 2026-07-09. Drifthorn→Forestry@15, Sporeling→Alchemy@15, Sporehound→Alchemy@100. Not a build call.
>
> **THE TWO LANES NOW (no more new-game pipeline):**
> 1. **★ The POLISH LAP** — the whole backlog of taste-calls, run one game per session (cold-play → feel
>    tune → gx-* check → mobile → card art → bump block). The consolidated checklist ↓ is the spine;
>    **Seedfall first** (Alex's favourite, the proven winner). New cabinets (Driftling/Squall/Dewdrop/Vault)
>    are also pending Alex's device cold-play — they fold into this lap.
>    - **Card art backlog — ✅ CLEARED + WIRED + VERIFIED IN HALL 2026-07-01** (`4499727` Vault+Dewdrop,
>      `1d866ae` Squall+Driftling, `c554cb9` catalog wiring). The 4 new cards existed on disk but the hall's
>      `CARD_ART` allowlist (`CatalogGrid.tsx`) didn't include them → they rendered as bare glyph+text; added
>      the four, browser-verified all 12 cabinets show art at `/arcade/all`. ✅ **Title-screen backdrops for
>      the 4 new games DONE 2026-07-01** (Vault `a010998`, Squall `af6f700`, Dewdrop `1d3fd85`, Driftling
>      `d885e16`) — each start screen shows its card behind the text (per-card opacity + scrim tuned for
>      legibility, browser-verified), matching atherdash/seedfall/ward/voranyx/updraft.
>      Remaining polish work is **all pending Alex's device** (feel-tune, mobile/overlay reads).
>    - **Everything else is pending Alex's hands** (feel-tune, mobile/overlay reads) — headless can't judge.
> 2. **Room loose ends** — ✅ daily-leaderboard render VERIFIED + clip FIXED across all 7 games 2026-07-01
>    (`bb55f38`). Remaining: the Room's small lane (Folk volume on the Desk, news automation, 390px wall-turn
>    pass). See `### The Room` block.
>
> **▶ PENDING-ALEX LAP — the consolidated checklist (the polish-lap spine; new cabinets fold in below):**
> - [ ] **Atherdash** — hop timing window fair? slide→hop rhythm readable? base speed right? *(knobs: `SPEED`/`SPEED_MAX`/`SPEED_RAMP_DIST`, `JUMP_DUR`, `PIT_GAP_Z`/`PIT_LEAD`)*
> - [ ] **Ward** — enemy tune: Drifter weave gentleness, Darter warning time, Husk feel, intro wave *(knobs: `DRIFT`/`DART`/`HUSK` consts)*
> - [~] **Seedfall ⭐ (Alex's FAVOURITE)** — **ZONE REWORK shipped 2026-07-11 (`4af4f59`).** Playtest fix for "bird too often + maps all the same": the fall now runs the **four canon bands** (`CANON/game/seedfall.md`) — seeding-floor → canopy → **Driftfolds (openings BREATHE)** → clearing — each with its own palette + branch colour + wayfinding label; the bird (**renamed Havari→Skirl**, canon collision with **Hovari**) now **roosts in the canopy only** (~2 passes/run, was ~7-8). Proven at sim level + drift-gate 5/5. **NEXT: Alex device feel** (band lengths, fold breathe-rate `FOLD_RATE`, Skirl 720px spacing — knobs atop `lib/seedfall.ts`) + the blessed-but-deferred **collectible motes**. Original polish note kept below:
> - [ ] **Seedfall ⭐ (Alex's FAVOURITE — polish FIRST, it's the proven winner)** — full descent feel (drift authority vs branch spacing, fall speed) + Havari catch/dodge readability (1.4s warn) + soil-approach landing + game-over overlays + **the new wind-puff thrust read** *(knobs atop `seedfall.ts` + `genBranches`)*. ✅ **Card art DONE 2026-06-30** (`e7a04d9`). ✅ **Thrust reworked to wind-puff gusts 2026-07-01** (`693a613` — updraft pillow on both-held, lateral gust from upwind side; render-only). **All solo work done — waiting on Alex's device pass.**
> - [ ] **Driftling** — device cold-play: drift authority, eat/threat readability, evolve-payoff moment, nursery-start curve *(knobs atop `lib/driftling.ts`)*. ✅ card art DONE 07-01 (`1d866ae`).
> - [ ] **Squall** — device cold-play (STILL never visually verified — extension needs Alex's host-perm grant): pattern density/cadence, bullet speeds, telegraph warn times *(knobs: `fireDirector` gap, per-pattern `spd`, `RAMP_T`, `GRAZE_R`)*. ✅ card art DONE 07-01 (`1d866ae`). ✅ **Daily + leaderboard WIRED 2026-07-03 (`39af949`)** — endless/daily toggle, share, DailyLeaderboard, API allowlisted; round-trip verified via curl.
> - [ ] **Driftling + Dewdrop** — ✅ **Daily WIRED 2026-07-03 (`aff36d2`)** (toggle/share/DailyLeaderboard/API allowlist/scroll-fix, curl-verified). Device cold-play still pending: Driftling drift/eat/evolve feel + nursery curve; Dewdrop D-pad + maze difficulty *(knobs atop each `lib/*.ts`)*.
> - [ ] **Dewdrop** — cold-play tune already started (`a8c54ac`): scatter/chase waves, wildbloom duration, ghost-vs-player speed gap *(consts atop `lib/dewdrop.ts`)* + maze art/layout (deferred, Alex taste). ✅ **Desktop keyboard controls FIXED 2026-07-11 (`703cbeb`).** Tester's "keys near impossible / jam in a corner" was a real desktop-only bug: keyboard summed held keys into a vector and resolved ties toward horizontal, so ↑/↓ were eaten while ←/→ was held — you couldn't turn vertical while holding a horizontal key. Now held keys are press-ordered, most-recent wins (real-stick feel); any arrow/WASD also launches from the ready screen (was D-pad-only). Verified: keyboard-launch live; turn proven vs the real sim (old jams at wall netYDrop 0, new turns up netYDrop 13). Mobile D-pad was never affected (one dir at a time).
> - [x] **START button — rolled out to all 9 real-time games ✅ 2026-07-11 (`724051a`)** — ✅ **built + wired on Dewdrop 2026-07-11 (`88f5970`).** Shared `_components/ArcadeStart.tsx` (`<StartButton>` + `useStartKey` Enter/Space). Decouples launch from first move: START flips ready→playing with NO heading (idle at spawn, read the board), first direction only steers. Fixes Alex's "press one dir and it locks in" on Dewdrop. **DONE — Alex okayed the Dewdrop look, rolled out.** Now on Dewdrop + Atherdash + Updraft + Seedfall + Vault + Squall + Driftling + Ward + Voranyx (each start() adapted to its movement model). **Skipped by design:** Mana'nana (match-3) + Rekindle (puzzle) — tapping a tile/entering a puzzle is already a deliberate move, no launch-vs-move collision. Verified live: all show START + launch on Enter/click; vault suppresses START on the story trail; seedfall decoupling spot-checked. **Micro-notes:** (a) ✅ updraft first-gate timing FIXED 2026-07-11 (`25a135d`, exported `launch()` → VW+40); (b) manana/rekindle START is Alex's call if he wants it for pure consistency. to the other 10 (each = drop `<StartButton>` in the ready overlay + a 5-line `start()` that flips state without a dir + guard direction-input to playing-only). Coasting stays.
> - [~] **Updraft** — **AIRS REWORK shipped 2026-07-11 (`25a135d`).** Seedfall playbook applied to its canon sibling (`CANON/game/updraft.md`): the endless climb cycles four looping airs — Open Current(wide) → Gate-Reach(tight) → **Rising Thermal**(gravity eases, a real lift) → **Churn**(void-gate gaps DRIFT) — each with palette + gate colour + label; endless ramp (scroll 156→210) + per-air gaps; START first-gate timing fixed (`launch()`→VW+40). Proven at sim level (thermal 87→35px, churn ±46, all 4 airs) + drift-gate 5/5 + live 200. **AGENCY FIX 2026-07-11 (`later commit`):** first pass stole control (thermal eased gravity, churn drifted gaps) — Alex: "kills it, pushes you into an obstacle you'd have glided through." Ripped both out; airs now vary by STATIC layout only (width/spacing/palette/label/ramp + gap-position patterns: thermal rides high, churn = fixed zigzag). Gravity constant, gates never move. Lesson → `feedback_game_variety_preserve_agency.md`. **NEXT: Alex device feel** — knobs atop `lib/updraft.ts` (`AIR_LEN`/`airGap`/`airSpacing`/ramp). Matched pair w/ Seedfall (the climb + the fall).
> - [~] **Vault — enemy/obstacle GLOW-UP shipped 2026-07-11 (`458228d`).** Alex "levels are bland, step it up." The grey hazards were generic shapes (spike=flat triangle, foe=rounded rect+2 dots) so the light-vs-greying contrast fell flat. Render-only: rooted corruption → jagged crystalline shard-cluster; grey void-spawn → unstable dome + dissolving underside + void-BLACK hollow core (blank/soulless canon read); light motes → pulsing halo (precious). Stable per-entity hash (no flicker), runner left as-is. **This was Alex's gated item** ("don't go crazy on maps until enemies/obstacles glow-up") → now UNLOCKS **per-area map theming** (the 6 `AREAS[].accent` tints) = the natural next step. v1, pending Alex taste pass; iterate any that don't read. **DESCENT THEMING shipped 2026-07-11 (`ac07793`)** — the 2nd half of "levels bland": per-area sky/ground wash (First Light warm-gold+living-green → Grey Heart colorless+dead-grey), derived from cfg.id, endless samples accents by difficulty. Enemies + environment both stepped up now.
> - [~] **Voranyx — bigger Silt (no cage) shipped 2026-07-11 (`49ad709`).** Alex: past ~len150 it caged + small ones spawned in unavoidably. Cause: shrinking void-ring floored at 560r (1120 across) but a len150 worm is ~1440u long. Fix: ARENA_R0 1500→3200, RMIN 560→2200 (4400 floor = ~3× a big worm), SHRINK 6.5→5.0; rivals spawn area-uniform + ≥SPAWN_CLEAR(780u) from the player's head (no ambush); food density held constant via foodTarget(radius) (900 at full ring, restock 6→24/tick); specks span 2400→6800. Sim-proven (floor ring 3× worm, nearest rival 2828u). **NEXT: Alex device feel** (knobs atop lib: ARENA_*, SPAWN_CLEAR, FOOD_TARGET; zoom floor in page).
> - [~] **Driftling — ENDLESS OCEAN redesign, foundation shipped 2026-07-11 (`aacbee2`).** Alex: map too small + invisible borders; pivot to an endless ocean you journey RIGHT through as a 3-min time-attack ("how deep can you get"). Done: fixed 2400x1800 box removed (borders gone); danger keyed to DEPTH (depthTier(x), spawns sized by where they appear — shallows tiny → deep giants, proven avg 0.3→5.4); endless right + shallow-edge + vertical band; 3-min clock (MATCH_TIME) ends run OR eaten; score = maxX depth + growth; water darkens shallow-teal→black-abyss; clock HUD. **NEXT (layers): (1) Magii canon pass on the ocean zones + Rinn ladder (tier skin already flagged pending-bless), (2) schools of fish (boids) that scatter from predators, (3) patrolling predators (telegraphed, Updraft agency rule), (4) the drift current.** Sim skin re-skins freely (reads indices).
> - [ ] **gx-* look on real mobile across all 11** — esp. the game-OVER overlays headless can't reach
> - [ ] **Arcade cabinet dial** — final warmth/dim/red-skew on `<ArcadeCabinet>` (one component → changes everywhere)
> - [x] **Daily leaderboard** — ✅ **VERIFIED + FIXED 2026-07-01** (`bb55f38`). Browser-verified the board renders inside the game-over overlay (Vault + Updraft played to death live). **Found + fixed a real clip:** the `justify-center` overlay in the fixed-height cabinet screen + the leaderboard = content taller than the screen → board (+ RENAME) spilled below, occluded by the control deck, no scroll to recover. Wrapped all 7 leaderboard overlays (vault/updraft/atherdash/voranyx/ward/seedfall/manana) in `overflow-y-auto` + `min-h-full` inner flex (centers when short, scrolls when tall).
> - [ ] **Daily toggle + share** — does Endless/Daily read right; is the share line satisfying
> - [ ] **Mana'nana** — taste call: keep the candy match-3 look, or push it into the squared gx-* family
> - [~] **Nolmir** — 📦 **SHELVED 2026-07-16, don't pick up.** (Was: unified return beat + rehearse the warp ceremony + mobile-idle direction call.) Parked pending a proper home — it's an idle game in a cabinet frame; 4 passes at "too much" all missed. See the Nolmir block.
> - [x] **Nolmir density — progressive disclosure SHIPPED 2026-07-12, jin-cc (`ac9608a`).** Alex flagged the Starforge as "too much at once": `ROOMS.map` opened all 5 room tabs (Core/Orrery/Refinery/Armory/Gate) on a fresh save, nothing eased in. Now first touch = Orrery + Core only; Refinery unfolds on the 1st claimed planet, Armory on the 2nd (or any mana-bought guard investment), Gate when heat hits warp. New `revealedRooms(forge)` in `lib/starforge.ts` keyed to MONOTONIC signals only (planet claims / node counter / permanent investments) so a room never vanishes under a player standing in it; every gate latches on `node>1` so a post-first-warp veteran keeps the full deck forever. `activeRoom` falls back to Orrery if the current tab isn't revealed; a soft `unlock` chime rings on each new room. +10 assertions in `starforge.test.ts` (68 total, all green). Build + canon clean. **Live browser-verify was BLOCKED** — the Chrome extension went unresponsive (the known Nolmir renderer-freeze flake); logic is test-proven, but the *unfold feel* (chime, tab appearing) wants an Alex device pass. **The currency-TRIM half is deliberately untouched — still Alex's-eye** (8 currencies; the HUD already hides echoes/networkRate until >0).
> - [x] **Voranyx** — phone playtest PASSED 2026-06-15 (no action; here for completeness)
>
> **▶ NEW-CABINET PIPELINE — CLOSED after Vault.** The "two more then stop" strategy is fulfilled
> (Dewdrop + Vault). The remaining ONE build is **Vault's render** (sim done, canon ruled; see its block below). All
> other concepts (Tempest, Rune-weaving, Breakout) stay parked in the Queue — **don't pitch new games
> until the polish lap is done** (Alex's standing call, 2026-06-26).
>
> ---

## 🖥️ Cross-cutting — DESKTOP MODE (building, jin-cc, 2026-07-12, `0a01548`)
> A tester on **desktop** flagged screen-size + controls. Root cause: the arcade is **mobile-native** —
> the phone-shaped cabinet (header → screen → thumb deck) just floats small in a monitor with big dead
> margins, and **4/11 games (manana, rekindle, ward, updraft) have NO gameplay keyboard at all** — the
> canvas is `pointer-events-none`, so on desktop you literally mouse-click the on-screen FLY button to
> play. (The `ArcadeControls` comment claiming "keyboard still drives on desktop" was false for those 4.)
> **Alex's call (2026-07-12): "Big-screen cabinet"** — keep the cabinet furniture, but on desktop grow the
> screen to fill the height, drop the touch deck for a slim keybind plate, keyboard drives.
>
> **Mechanism (shared, one switch → all cabinets):** `fit.ts` `screenMaxW` reads CSS vars
> `--ac-reserve`/`--ac-wscale`/`--ac-vwcap`; **mobile leaves them unset so the old expression is
> reproduced byte-for-byte** (zero phone change, no hydration flash). `ArcadeCabinet` sets them + toggles
> `.ac-deck`/`.ac-keys` under one global `@media (hover:hover) and (pointer:fine)`. `ArcadeControls` gets a
> `keyLegend` prop → gold keycap plate on desktop, deck hidden (only when a legend exists, so a
> keyboard-less game never loses its sole input).
>
> - [x] **Updraft = reference game** (`0a01548`) — Space/↑/W + click-to-flap gameplay input, keyLegend wired.
>   Verified live: deck hidden, plate shown, screen grown, Space drove a run to score 7.
> - [x] **All 7 deck-games rolled out** (`45c232b`) — seedfall/driftling/squall/dewdrop/vault/voranyx/atherdash
>   each got a `keyLegend` matching their real keys (← → / W A S D / Space). All already had full keyboard,
>   so it was pure wiring. Verified live: squall(stick)/atherdash(multi-key)/dewdrop(dpad) all hide the deck +
>   show the plate, overflowY 0.
> - [x] **ward + rekindle need nothing** — they're direct-**click** puzzles (no deck ever), and they use
>   `screenMaxW`, so they inherited the bigger desktop screen from the shared vars for free. Verified live:
>   mouse-playable, no overflow clip (screen height = viewport − reserve, chrome fits exactly).
> - [x] **manana board-clip FIXED** (`52ff2f0`) — on short desktop windows the board clipped its bottom rows.
>   Root cause deeper than expected: `boardPx` stayed null because the sizing effect keyed on `[mounted]` but
>   `boardWrapRef` only mounts on the 'board' view — it first ran on the 'home' front door with a null ref,
>   bailed, never re-ran on entering a game, so the board fell back to `width:100%` (a width-square ignoring
>   available height; the height-fit was effectively dead, only looked fine on tall windows). Fixed: key on
>   `[mounted, view]` + window/visualViewport resize listeners. Verified: 543px window board 259px (fits) vs
>   506px (clipped) before. (manana controls were always mouse-native, fine on desktop.)
> - [ ] **Crispness pass (optional, deferred):** canvas backing store is fixed at `VW×VH×dpr`; a big
>   *landscape* desktop screen may upscale/blur. Size the backing store off displayed px for those. Portrait
>   games stay crisp (they downscale when filling height). No game looked soft in verification — do if noticed.
> - **Files:** `lib/arcade/fit.ts`, `_components/ArcadeCabinet.tsx`, `_components/ArcadeControls.tsx`,
>   `updraft/page.tsx` + the 7 deck-games' `page.tsx`.

## 🔁 Cross-cutting — THE DAILY CHALLENGE (shipped 2026-06-21, `b4c3ddb`→`7902b30`)
> Retention loop: one seeded run per UTC day, the SAME course for everyone, shareable score.
- **Shared lib `src/lib/arcade/daily.ts`** (reusable like ArcadeCabinet): `dailyKey`/`dailySeed`/
  `dailyNumber` (#1 = 2026-01-01) + per-game daily-best storage + Wordle-style `dailyShare` + clipboard.
  Opt in with ~6 lines: seed the world from `dailySeed()`, save with `saveDailyBest`, add the toggle + share.
- **Live on ALL 10 score-chase games:** Atherdash · Ward · Updraft · Voranyx · Mana'nana · Seedfall ·
  **Vault** (joined 2026-06-29) · **Squall · Driftling · Dewdrop** (all joined 2026-07-03) — Endless/Daily
  toggle on the start screen (Mana'nana: under the score row), separate daily-best track, Share on game over.
- **✅ AUDIT FINDING CLOSED 2026-07-03 (`39af949` Squall, `aff36d2` Driftling+Dewdrop).** The three newest
  cabinets shipped daily-ready (deterministic `makeWorld(seed)`, mulberry32) in the 06-26 arc but were never
  wired into the Daily loop — 7 of 10 score games had it, these 3 didn't. All three now match: toggle,
  deterministic daily seed, daily-best, share, DailyLeaderboard on the end overlay (+ the overflow-y-auto
  scroll-fix none of them had), API allowlisted. Round-trips curl-verified. Feel/render pending Alex's device.
- **Rekindle** has its own puzzle daily; its date helpers now re-export from the shared lib (one source).
- **Excluded by design:** Lucernyx (vs-AI win/lose, now SHELVED) · Rekindle (puzzle ★-rating, not higher-is-better). Seedfall JOINED 2026-06-22 (descent redesign gave it a depth score).
- **✅ Server-side leaderboard SHIPPED (2026-06-22):** `api/arcade/leaderboard/route.ts` (file-backed,
  per-day top-20, upsert-best-by-player) + `lib/arcade/leaderboard.ts` client + reusable
  `_components/DailyLeaderboard.tsx`, wired on the 5 score games + Seedfall + Vault. No auth (scores
  client-submitted, fine for a personal arcade). ⚠ **only unverified bit = the board RENDERING inside
  each game-over overlay** (logic+API proven via curl; visual unseen) → THIS WEEK lane 4.
- ⚠ PENDING Alex feel: does the daily toggle + share read right (this-week lap).

## 🔎 Cross-cutting — DISCOVERABILITY / SHARE METADATA (2026-07-03, jin-cc)
> The site's a build-in-public front for sharing game links — so the links have to render as the game.
- **Per-game share metadata SHIPPED (`525363c`):** every game was `'use client'` → all 12 shared as the
  generic "ather.games" card (no per-game title/image). Added a server-component `layout.tsx` per live game
  exporting real `title` (game name) + `description` (registry tagline) + the **card art as the OG/Twitter
  `summary_large_image`** (1344×768). Layout returns children → the client page renders unchanged. Verified:
  build clean, all 12 routes 200, `<title>`/`og:title`/`og:image` render per-game, OG images reachable.
- **sitemap.xml + robots.txt SHIPPED (`af8dbac`):** both were 404. `sitemap.ts` is registry-driven (front door
  + hubs + every LIVE game = 17 URLs, back-room excluded, stays in sync); `robots.ts` allows indexing but
  disallows `/api/` + owner-only `/shimmer/dev`, points at the sitemap. Verified both 200.
- **Open:** proper 1200×630 OG crops (cards are 1.75:1, platforms letterbox slightly — fine for now); OG for
  the Room/hubs (they inherit the good root default, which is correct for the brand front door).

## 🧭 Cross-cutting — SITE NAVIGATION / WAYFINDING (RULED + BUILDING 2026-07-07, jin-cc)
> **Ruled the pattern (Alex + Jin, 2026-07-07):** one `SiteNav` quick-menu replaces the ad-hoc trio
> (`RoomReturn` pill + `ArcadeHeaderBack` + per-game internal exits). The loudest pain = **game→game**
> (today you get pulled ALL the way back to the Room to move sideways). So the drawer's HERO is lateral hops.
>
> **The design — hybrid drawer, orientation folded in:**
> - Persistent footprint = **one button** (top-left, where the RoomReturn pill sat). Only always-on chrome;
>   zero canvas stolen. Tap → slide-over drawer. The "hybrid" = the **breadcrumb lives INSIDE the drawer
>   header** (Room ▸ Arcade ▸ <game>, tap-to-jump-up) — orientation on demand, not an always-on bar.
> - **Drawer body (game→game is the hero):** ↔ Recently played (new `lib/recents.ts`, the hop tool) ·
>   ★ Favorites (reuse `lib/favorites`, MAX_FAVS 3) · ⤨ Surprise me (random live game not played lately) ·
>   ▦ All games → (`/arcade/all` for the long tail). Then ↺ <game> Home (contextual, only if the game has
>   an internal home) · ⌂ The Room (scenic front door, no longer the forced turnstile) · 🔊 Sound (optional
>   per-game).
> - **Recents = zero per-game wiring:** SiteNav records its own `gameId` on mount, so every game that mounts
>   it auto-fills recents. gx-styled (kill browser feel), mobile sheet.
>
> **Decisions (don't relitigate):** button stays top-left (muscle memory) · the Room's scenic walk-in stays
> forced ONLY on first `/` arrival, everything after is the drawer · breadcrumb is IN the drawer, no always-on
> bar (fights the game-UI-layer "kill browser feel" rule) · Room is NOT replaced, it stays the experiential
> arrival — SiteNav is the utility layer beside it.
>
> **Rollout leverage:** `ArcadeCabinet` renders the back-affordance at ~L54, so swapping RoomReturn→SiteNav
> THERE lights up all ~9 cabinet games in one edit (add an `id` passthrough). Standalones (Mana'nana, Nolmir,
> `/arcade/all`) get touched individually; deprecate RoomReturn + ArcadeHeaderBack once migrated.
>
> **Phases:** ① core on ONE game — `lib/recents.ts` + `SiteNav.tsx`, wired into **Mana'nana** first (it has a
> Home to link = best test), verify the whole drawer live. ② roll out via ArcadeCabinet + standalones,
> retire the old two. ③ juice (drawer slide, recents chips, surprise-me feel) + Alex phone pass.
> **Left off (2026-07-07 cont., after a laptop crash mid-build — recovered):** Phase 1 was written but
> uncommitted when the laptop died; recovered clean (built exit 0, no dead imports) + committed `8f855d3`.
> **Phase 2 SHIPPED `a80fa5e`:** ArcadeCabinet renders `<SiteNav gameId wall>` (one edit → all 11 cabinet
> games); `arcade/all` dropped RoomReturn+ArcadeHeaderBack for the drawer; Nolmir swapped. All build clean,
> routes 200, pushed.
> **✅ ☰ MOVED TO TOP-RIGHT (`40aaee0`):** left corner covered games' own back buttons; now a consistent
> top-right corner + slide-from-right drawer everywhere. manana's audio/surge nudged inward to sit beside it.
> Same commit reclaimed manana's dead `100svh-5rem` bottom bar (leftover from the removed mode pills).
> **✅ LAST SURFACES MIGRATED + OLD NAV RETIRED (`e299baa`, `0fb0b4a`):** grimoire → SiteNav w/ custom
> `Room ▸ AtherPages` crumbs; `/shimmer` 2D title (owner-only, `/shimmer` redirects non-owners to /room) → SiteNav;
> **RoomReturn + ArcadeHeaderBack DELETED** (trio fully gone). **play3d (the PUBLIC walker) had NO exit at all** —
> folded ⌂ The Room + ▦ All games into its existing HUD ☰ menu (native menuBtn, no second button; autosave makes
> hard-nav safe).
> **▶ NEEDS ALEX DEVICE PASS:** (1) manana — ☰ sits clean next to 🔊 on Home+board, bottom flush (no black gap)?
> (2) play3d — the two new menu items feel/reachable on a phone? (3) the drawer feel generally (manana = fullest wiring),
> now incl. the 170ms slide-out — is the close speed right? Knob: `CLOSE_MS` in `SiteNav.tsx` (must match the
> `sitenav-slide-out` duration).
> **⚑ ~~FINDING~~ — CORRECTED + FIXED 2026-07-10 (`0fb8e59`).** The old entry claimed a `shimmer` chip sends the
> public to `/room`. **It can't** — shimmer is `tier: "coming-soon"`, so `liveGames()` (which filters `tier === "live"`
> *and* `ROOM_WALL_IDS`) excludes it from surprise-me; `CatalogGrid` renders coming-soon as a plain dimmed `div` with
> **no `<Link>` and no pin button**, so it can't be favorited; and recents only fill where `SiteNav` mounts with a
> `gameId`, which play3d doesn't. Three independent closed paths. **The board was right that the jump pool was
> unfiltered and wrong about which game fell through.** The real instance was **Lucernyx** (`tier: "back-room"`,
> shelved): `refresh()` resolved recents/favs with `gameById`, which has no tier filter, and localStorage outlives a
> game's tier — so a Lucernyx chip sat in the live drawer, routing into a redirect. Now resolved against `liveGames()`.
> *Lesson: a board entry naming a specific bug is a hypothesis, not a fact — re-read the registry before acting on it.*
>
> **✅ Phase 3 SHIPPED 2026-07-10 (`0fb8e59`):** drawer **exit animation** (it slid in, then vanished on a hard cut;
> `closing` state holds it for one 170ms slide-out, reduced-motion unmounts instantly rather than gating unmount on an
> animation that may never run) · **focus management** — it claimed `aria-modal` while leaving focus on the page behind,
> so Tab walked the game; focus now enters on open, wraps at both ends, returns to the ☰ on close (+ the missing
> `aria-expanded`) · **tier filter** on recents/favs (above) · **Nolmir's redundant "← arcade" link removed** (header
> `justify-between` → 3-col grid so the title stays centred without the link propping the left slot open).
> **Already shipped earlier, board was stale:** ★-favorite-from-the-drawer (`toggleFavHere`) exists and works.
> **✅ recents→"resume" SHIPPED 2026-07-12, jin-cc:** new `src/lib/saves.ts` — a registry of per-game save probes
> (`hasSave`/`saveHint`/`isSaveBacked`); a recents chip with a live save now reads as "Resume" (gold-tinted border,
> trailing ↻, a progress hint: nolmir "Node N" from `forge.v2`, manana "Quest N" from `quest.level`). The hint guards
> against "played once" — manana's lone high score does NOT trigger resume, only real quest progress does. Every
> save-backed game already auto-loads on mount, so the tap genuinely continues. Registry-driven: a game earns the
> affordance by registering a probe, nothing more. **play3d not wired** — it shares Shimmer's `ather:save:shimmer`
> slot and Shimmer is a room-wall (excluded from the recents pool), so it never reaches the strip today; drop a probe
> under its id if that changes. Verified live on `ather.games` (DOM assertions: gold border + hint + ↻ present for
> seeded nolmir/manana, absent for a no-save chip).
> **▶ Still open:** Alex's phone pass on the drawer feel (`CLOSE_MS` knob).
> **Files:** `src/lib/recents.ts`, `src/lib/saves.ts`, `_components/SiteNav.tsx`, `_components/ArcadeCabinet.tsx`,
> `manana/page.tsx` + `manana/Home.tsx`, `arcade/all/page.tsx`, `nolmir/page.tsx`, `grimoire/page.tsx`,
> `shimmer/page.tsx`, `shimmer/play3d/Shimmer3D.tsx`.

## 💰 Cross-cutting — THE MARKS ECONOMY (one currency across all of ather.games)
> **The vision (Alex, long-standing): one global Marks wallet for every game, tying the arcade into one world.** Ruled into canon 2026-07-12 (/magii + Alex, `athernyx world/rune-hold.md` › The Hub): **Marks = the realm's copper coin** (already in the athernyx glossary — NOT invented). The whole ather.games hub is canonically **Rune Hold** (an outdoor town center, doors = storefronts): 🍺 **Kindled Mug** → the games (EARN marks) · ✧ **Spirit Corner** → Shimmer (Greg's Ather-Bubble gate, canon-literal "a personal shimmer") · 📖 **Eyuun's Bookstore** → books/lore (the 07-04 audiobook player) · 🏪 **The Passage** → the market (SPEND marks; seed of the canon Grand Exchange) · 📌 **Notice Board** → news. Register = the enduring Year-1500 Rune Hold; the Year-600 occupation stays STORY.
> **✅ Phase 0 SHIPPED 2026-07-12, jin-cc (`30b6829`, built + live :3200, pushed — "NOT pushed" corrected 2026-07-16; it reached `origin/master` the same day under later commits):** `src/lib/wallet.ts` — the global Marks store (per-browser localStorage; `getMarks/addMarks/spendMarks/setMarks/walletExists` + a `MARKS_EVENT` on change for live HUDs; non-negative floor). **Folded Nolmir's marks into it:** the wallet is now the source of truth and `nolmir/lib/host.ts` mirrors it on load/save, so all ~15 `host.marks` call sites stay untouched; a legacy Nolmir save's marks migrate into the wallet exactly once. 23-assertion `wallet.test.ts` (math + overspend guard + event hygiene + the migration contract, via a window/localStorage shim); 111 Nolmir tests + canon still green. Live-driving the HUD blocked by the frozen-renderer flake on canvas pages — test-proven, wants an Alex device pass.
> **⚠→✅ RECONCILIATION 2026-07-12, jin-cc (`5e4ad71`, pushed, live):** caught that a shared marks wallet ALREADY existed — `use-wallet.ts` (keyed `ather:save:wallet`, used by the **Magii card game + Shimmer**). The Phase-0 `lib/wallet.ts` had made a SECOND store (`ather.marks`) for Nolmir + the readout — currency was SPLIT in two. Fixed: `lib/wallet.ts` now backs the same `ather:save:wallet` key + `{marks,totalEarned,totalSpent}` shape; `use-wallet.ts` is a thin wrapper over it (API-compatible, `loading` contract preserved so the card game's WELCOME_STAKE never re-seeds). **Reverted the Nolmir fold** — Nolmir's ✶ are INTERNAL (it mints marks passively/idle; as global marks that's an uncapped 2nd faucet fighting the card=faucet economy). Verified LIVE on real data: card game + SiteNav readout both read the same 393 from `ather:save:wallet`; old key gone. wallet.test.ts → 27 assertions (legacy-blob compat + totals). **The economy design (Alex):** card game = the FAUCET (clear double-down → flat: win `10 + 0.3×score`, else 10; avg win ~150 → ~55 marks); arcade games = SINKS (cost 1-5 marks/play, reward = leaderboards + later cosmetics); Nolmir = its own internal machine; welcome-stake 100 + guaranteed ≥10 floor = no lockout.
> **✅ Phase 1 (HUD) SHIPPED 2026-07-12, jin-cc (`c0d4dfc`, pushed, live):** shared **Marks readout** in the SiteNav drawer (under the breadcrumb) — one purse across every game. Subscribes to `MARKS_EVENT` + the storage event at the always-mounted component level (outlives the drawer open/close). **Verified live on ather.games** (grimoire): renders `✶ N marks`; dispatching the event updated the readout 0→777 in real time.
> **✅ Phase 2a (the FAUCET) SHIPPED 2026-07-12, jin-cc (`28e115b`, pushed, live):** Magii card game — cleared double-down entirely (sit down → deal → play straight through), flat prize on game-over: **win → round(10 + 0.3×score), everyone else → 10.** No ante, no forfeit; welcome-stake 100 + 10 floor = no lockout. Removed DoubleDownModal/ANTE/wagerRef/setDoubleDown. Verified live: Sit Down goes straight to the board, no stakes modal. (Full game-over payout wants a device playthrough to see +55ish/+10 fire — pairs with mobile testing.)
> **▶ NEXT (build order):** ~~(1) HUD~~ ✅ · ~~reconcile~~ ✅ · ~~(2a) card faucet~~ ✅. **(2b) arcade SINKS** — charge 1-5 marks/play; DESIGN OPEN (Alex): per-game price, where the charge lands (page-load vs a "sit/insert-coin" start vs per-run), and the broke-player UX (free-play-no-leaderboard vs redirect-to-earn vs block). **(3)** Passage market / cosmetics sink. **(4)** re-skin Room walls as Rune Hold storefronts.
> **✅ FIXED — Magii MOBILE cards cut off (2026-07-12, jin-cc, `f4180d8`, pushed, live):** the fan's `w-full` chain was broken above it (player-area wrapper + PlayerArea root lacked `w-full`), so it measured up to `max-w-[660px]` even on a 390px screen and the board's `overflow-hidden` clipped the last 2 cards (+ slid the discard pile off the left). Chained `w-full` to the fan → `fanW` = real board width → step-math fits all 8. Verified 8/8 visible at narrow viewport, no overflow. Also hid the redundant header 'Magii' title on mobile where the back-to-room pill overlapped it. — wire a marks earn into ONE score-chase game (scaled to score, capped) to prove the earn loop before rolling across the arcade — balancing is the real work, start with 2-3 games not all 13. (3) a **sink** — the Passage market surface (v1 sink) and/or Shimmer spend. (4) re-skin the Room's walls as Rune Hold storefronts → grow into the town square (big Jin build, stageable). **Design open (GBOARD, not canon):** per-game payout curves; what the Passage v1 sink actually sells.

## 🎨 Cross-cutting — PRE-RENDERED 3D ART (render-to-sprite, PROVING 2026-07-21, jin-cc)
> **The vision (Alex, 2026-07-21):** nicer arcade art than flat vector/pixel, the **Clash Royale** look. Clash's units
> aren't 3D at runtime — Supercell models + animates in 3D, then **bakes each to a flat sprite sheet** the game plays
> as 2D. Old trick (Donkey Kong Country, Diablo, RollerCoaster Tycoon): "pre-rendered 3D" / render-to-sprite. Gives real
> 3D volume + lighting + frame-consistency for FREE, at **2D runtime cost** — no 3D engine, drops into our existing
> canvas exactly like any sprite. This is the "nicer art" lane, and it suits Alex (model/pose once, machine renders every
> frame) better than hand-drawing frame-by-frame.
> **✅ PIPELINE PROVEN + $0 (2026-07-21):** headless **Blender 4.2.9 LTS** at `/opt/blender` (CPU/Cycles, film-transparent,
> ~40s per 8-frame 128px render on this box). Fully scriptable — a `.py` builds the model + lights + ortho camera + a
> frame loop, renders RGBA PNGs; Pillow packs the strip. **Nothing to buy** (Blender free; Mixamo not needed for our own).
> **✅ FIRST HIT — Vault void-spawn foe:** modeled an original grey void-spawn (lumpy dome + recessed void + cold dead
> glint-eyes — a RESKIN of the existing canon foe, no lore invented) → `public/vault/foe-void.png` (1024×128, 8-frame
> breathe loop), wired into `vault/page.tsx` `drawFoe` as a sprite blit with the **procedural draw kept as fallback**.
> Live on ather.games/vault. Render script in-repo at `tools/render/voidspawn.py`.
>
> **THE FILTER — what qualifies (so we don't over-invest):** a target must be a *discrete entity that gains from 3D
> volume* AND a *hero/repeated readable element*. Render is REAL hours per creature, so a cabinet gets **1-3 rendered
> elements max, not a full reskin.**
> - ✅ YES: creatures/enemies, bosses, hazards/obstacles with form (spikes, rocks), hero props/pickups that want shine.
> - ✋ KEEP VECTOR/light: backgrounds, ground/terrain, UI/HUD, **abstract light entities** (Vault's player-mote + the
>   collectible motes are canon *light*, not creatures), and **particle FX** (Alex 2026-07-21: these already look great).
> - ⚠ Per-cabinet **render camera must match that game's view** (side vs top-down vs 3/4) — set per target.
>
> **THE REGISTER — what we hit / plan to hit:**
> - **HIT:** Vault · grey void-spawn foe (`foe-void.png`).
> - **PLAN TO HIT (next):** Vault · **rooted grey spikes/thorns** (Alex flagged these — currently still vector; render
>   as lit crystalline shards, the natural #2 for the cabinet).
> - **✖ JUICE PASS REVERTED — the direction is MODELS, not juicing (Alex 2026-07-21, ather-games reverted post-`c0a99d8`).**
>   A procedural "living-light wisp" mote pass shipped and Alex killed it: *"you're just drawing with shapes — that's not a
>   sprite, that's circles in an arrangement, and it looks nothing like the silhouette."* **The standing rule this sets:**
>   placeholder primitives are FINE as placeholders while testing mechanics, but **do NOT spend time juicing primitives when
>   we can produce real models.** Effort goes into the model-production pipeline, not hand-drawing with canvas shapes. The
>   mote **stays a placeholder orb** for now.
> - **Canon still stands (`CANON/game/vault.md` "The mote's FORM"):** the mote is light, faceless, never a creature. **But
>   the "art-medium law" (living light stays live-glow, never baked) now has TENSION with Alex's "produce models" want** —
>   the light's eventual real form (a produced/animated light-wisp asset vs live glow) is **reopened**, a Magii+Alex call,
>   not decided here. Until then: placeholder orb.
> - **TO-AUDIT (later pass):** walk each cabinet (Rekindle · Ward · Updraft · Seedfall · Voranyx · Atherdash · Driftling ·
>   Squall · Dewdrop · Mana'nana) and slot its hero entities/hazards into HIT/PLAN/NO-FIT. Don't guess fit blind — audit
>   the actual entities first. Leaderboard the strongest candidates; ship a cabinet's render pass as one unit.
>
> **Files:** pipeline `/opt/blender` (4.2.9 LTS, not in git) · render scripts `tools/render/*.py` · assets `public/<game>/*.png`
> · wiring per-cabinet render fn (Vault: `page.tsx` `drawFoe`, sprite-blit + procedural fallback).

## 🔊 Cross-cutting — THE AUDIO LAYER (music beds + VO commentator, 2026-07-06→07, jin-cc)
> **A reusable audio stack, extracted from Mana'nana and rolled across the score-chase games.** Three shared libs
> under `src/lib/arcade/`:
> - **`musicBed.ts`** — a looping Web Audio music bed (gapless MP3 loop + a GainNode for ducking under VO). Each game
>   makes one with its own track; `stop()` on unmount so music never follows you out.
> - **`voBank.ts`** — the cozy commentator (ElevenLabs **George**, HTMLAudioElement clips). The feel is the THROTTLE:
>   per-trigger probability + a global cooldown + priority. Canon-neutral lines (no Magii gate). Reproducible via
>   `scripts/gen_<game>_vo.py`.
> - **`audioContext.ts`** — **ONE shared AudioContext** for the whole arcade. Root-caused + fixed a real bug: sfx AND
>   music each minted their own context and never closed them, so bouncing through games hit the browser cap (~6 desktop,
>   ~4 iOS) and later games went silent (the Updraft symptom). Now sfx + every music bed hang a GainNode off one context.
> **Live on:** Mana'nana (music + George VO), **Squall / Vault / Updraft** (music + George VO each). Clips gitignored
> (`public/*/music.mp3`, `public/*/vo/`). **Device-tune** = per-game throttle in each `<game>/vo.ts`, bed volume in `music.ts`.
> **Files:** `lib/arcade/{musicBed,voBank,audioContext,sfx}.ts` · per-game `music.ts`/`vo.ts` · `scripts/gen_*_vo.py`.

## 🧩 Cross-cutting initiative — THE GAME-UI LAYER (active, jin leads, 2026-06-18)
> **Killing the "browser feel"** — games play like games but the menus/chrome read like a website.
> Full research + recipe: **`/GAME_UI_LAYER.md`**. Reusable opt-in kit: **`src/app/gameui.css`**
> (`.gx-card` plate · `.gx-scan` CRT texture · `.gx-title`/`.gx-label` squared type via `--font-game`
> Chakra Petch · `.gx-btn` · `.gx-chrome` kill-list resets). Alex blessed the direction + handed jin
> the rollout (taste dial — corner sharpness / glow level — stays his to tune).
> **Rollout checklist:**
> - [x] **Arcade catalog** (`/arcade/all`) — soft cards → framed CRT plates (`d3ada82`). PROOF.
> - [x] **Nolmir deck** — tiles → sharp CRT plates (gx-scan + 3px), gx-chrome kill-list, digest sharpened. Verified live, 0 errors.
> - [x] **Per-game start/over overlays + HUDs** (title plates + framed CTAs + squared HUD type) — **DONE 8/8**
>   (gx-title/label/value + gx-chrome kill-list + sharper buttons). Voranyx·Seedfall·Updraft·Rekindle `f2deed2`/`cb00971`,
>   Atherdash·Lucernyx·Ward `2dd83b2` (06-22). **Mana'nana = deliberate LIGHT pass** (kill-list + squared micro-labels
>   only) — kept its candy match-3 identity (bold sans title, rounded-full pills, amber); don't force the squared face on it.
> - [x] Arcade landing retired — `/arcade` (old flat hub) now redirects to `/room` (`a23cd1c`, 06-22).
>
> **▶ CABINET CONTROL DECK (active, jin, 2026-06-29 — Alex blessed the direction "good start"):** a reusable
> **`_components/ArcadeControls.tsx`** — a recessed gold-trim control panel that bolts UNDER the screen
> (arcade buttons + optional fixed-base joystick) so the canvas stays clean and the page reads like a tall
> cabinet. Spec-driven: a game points `onPress`/`onRelease` (buttons) or a `-1..1` vector (`onStick`) at it.
> **Design rule (Alex):** the SCREEN stays NEUTRAL (display only — no tap, no cursor), the BUTTON calls the
> eye (idle attract-pulse on the primary). **Proven on Vault** (one big VAULT button, screen neutralized).
> Archetype map for rollout: 1-btn = Vault✓/Updraft✓ · 2-btn = Seedfall✓(L/R)/Atherdash✓(L/R+jump) · stick =
> Squall✓/Driftling✓/Voranyx✓/Dewdrop✓ · direct-touch frame-only = Ward/Mana'nana/Rekindle (no deck by design).
> **✅ ROLLOUT COMPLETE 2026-06-30 (jin-cc):** all 8 deck-eligible cabinets wired. Last 4 this session —
> Seedfall + Atherdash (2-btn; Seedfall gained L/R keys it never had), Driftling + Dewdrop (fixed deck stick,
> floating thumb-stick retired, screen neutralized to pure display). tsc + build clean, 4 routes 200.
> **TASTE CALLS RESOLVED (Alex 06-30):** (a) stick games = **fixed deck stick** (matches Squall/Voranyx);
> (b) deck shows on **desktop too** (mirrors the keybinds — already the component's behavior, no gating).
> **Room pill ALWAYS-ON 2026-06-30** (was from-room-gated → direct visits looked like dead-ends; now every cabinet always shows it). Audit 06-29: all cabinet games have it; Nolmir was a dead-end → FIXED (RoomReturn
> added); Gravitar = back-room/cut (skipped). **No public dead-ends remain.**
>
> **✅ SHARED MOBILE-FIT + 2x DECK 2026-07-06 (jin-cc, `c9f032c`→`7d0b3eb`):** killed the mobile control cut-off
> ACROSS ALL 11 cabinets. Root cause: cabinets stack header/screen/deck under `useNoScroll`, nothing fit the
> stack to viewport height (`min-h-screen`=100vh ignored the phone URL bar); only 3 games had an ad-hoc
> `min(px,Nvh)` band-aid. New shared `src/lib/arcade/fit.ts` — **`screenMaxW`** (screen: aspect + `dvh`
> height-fit), **`deckMaxW`** (thumb-comfortable deck width), **`cabinetMaxW`=max(screen,deck)** (housing +
> header/score/footer). Shell `min-h-screen`→`min-h-dvh`+`max-h-dvh`. Portrait screen now sits centered in a
> dark bezel inside the wider cabinet (reads like a real cabinet). **2x button pass (Alex):** round 72/56→144/112,
> D-pad 52→104, joystick 46→92/knob 26→52; `DECK_RESERVE`=320. Rolled to all games (9 via 3 parallel agents),
> type-clean + built, verified live at 500x755 across every variant. **✅ ALEX-APPROVED 2026-07-06** after a
> phone-feedback loop: 2x buttons overtook the screen → dialed to **1.5x**; grew screen 65%→71% (trimmed deck,
> normalized joystick gate so one `DECK_RESERVE`=222 fits all). The "reddish footer" Alex saw = **cabinet-hall.webp
> backdrop bleeding red neon** below the cabinet on tall phones (NOT the accent glow) → dimmed hall brightness
> 1.1→0.32 + scrim 0.62/0.82. **KNOWN CEILING:** portrait games ~77% width on phone (aspect-locked 2:3 +
> deck-below rule); wider needs a header-HUD-overlay pass OR controls-over-canvas (reverses the neutral-screen
> rule) — both deferred/offered, Alex happy at current. Minor open: a couple start-overlays run tall for their screen.
> **✅ FULL MOBILE SWEEP DONE 2026-07-06** — measured all 11 cabinets live; fixed real overflow the pattern hid:
> removed 3 redundant footers (squall/updraft/voranyx duplicated the deck hint → clipped), fixed dewdrop
> (4-way D-pad = 3-row deck + near-square screen → own `DPAD_RESERVE`=342 + dpad 78→64), updraft header
> `mb-4`→`mb-2`. Every cabinet now fits with no control cut-off. Reserve model: `DECK_RESERVE`=222 (stick/button),
> `DPAD_RESERVE`=342 (dewdrop). **Future proper fix if this gets fiddly again: flexbox cabinet (screen=flex-1,
> auto-fits leftover space, kills all reserve tuning) — deferred, current fixed-reserve holds for the 11.**
>
> **▶ VEHICLE = the ARCADE POLISH LAP (planned 2026-06-21, Alex):** the start/over + HUD rollout now rides a
> per-game polish lap — **one game per session**, same checklist (cold play → feel fixes → UI-layer pass → mobile →
> card art → bump block). Recommended order: **Atherdash → Lucernyx → Ward → Mana'nana → Voranyx/Seedfall/Updraft/
> Rekindle**. Full plan + the lap steps live in the **`▶ NEXT SESSION` block of SHIMMER_SESSION.md** (boot pointer).

## 🎮 Shipped — per-game roadmaps
> Each block is the durable state of one game: where we left off, what's next, why.
> SHIMMER_SESSION.md is the dated session *log*; these blocks are the source of truth
> for "I haven't touched this in a week — where was I?"
> **Status:** 🟢 live (public) · 🔵 back-room (built, held) · 🟡 building · ⚪ parked
> **Template:** Left off / Next (ranked, with the knobs) / Parked / Decisions (the why) / Files

| Game | Status | Last touched | What it is |
|------|--------|--------------|------------|
| The Room | 🟢 live | 2026-07-04 | the hub — arcade hall, Desk wall, Grimoire/AtherPages, Momo→Bookstore, nav spine |
| Eyuun's Bookstore | 🟢 live | 2026-07-04 | public audiobook player — Athernyx narrations off the Desk (Secrets hero + 15 Spirit Tales) |
| Nolmir | 📦 shelved (live) | 2026-07-16 | idle Athernyx defense/arena — parked pending a proper home; see its block |
| Mana'nana | 🟢 live | 2026-06-22 | match-3, blooming specials |
| Rekindle #3 | 🟢 live | 2026-06-22 | conduit puzzle + Aeterna node-map |
| Ward #4 | 🟢 live | 2026-06-22 | Missile Command / touch aim-trainer |
| Updraft #5 | 🟢 live | 2026-06-22 | one-tap flight (Flappy) |
| Seedfall #6 | 🟢 live | 2026-07-01 | the long drop — scrolling descent, weave branches + dodge Havari (Daily) |
| Voranyx #7 | 🟢 live | 2026-06-22 | glowing slither in the Silt |
| Lucernyx #8 | ⚫ shelved | 2026-06-22 | turn-based board of rekindling — pulse overtuned, back-room |
| Gravitar #9 | ⚪ parked | 2026-06-15 | physics-orbit — concept didn't land (cut) |
| Atherdash #10 | 🟢 live | 2026-06-22 | lane-runner — element-lanes ahead of the Dying (slice) |
| Driftling #11 | 🟢 live | 2026-07-01 | food-chain evolution — eat small, flee big, first bite forks your branch |
| Squall #12 | 🟢 live | 2026-07-01 | defenseless bullet-hell — read the void's patterns, weave, survive |
| Dewdrop #13 | 🟢 live | 2026-06-26 | Pac-Man riff — Dewbear vs collar-Moglins, wildbloom snaps the collar |
| Vault #14 | 🟢 live | 2026-06-29 | auto-runner — mote of light crosses the greying, leaps the void's tears (render shipped, pending Alex feel-test) |
| Anima | 🔬 tech demo | 2026-06-21 | procedural character (IK rig + verlet cloak), ZERO art files — linked in Room |

---

### Eyuun's Bookstore — 🟢 live · the public listening room → `/bookstore`
*Last touched: 2026-07-04 — shipped (`476e301`); Bk3 added to the public shelf*
**What it is:** an **audiobook player** (the "listen" half of the Atelier, brought public to spread the
  universe). Reached by clicking **Momo at the Front Desk**. Secrets of Athernyx (Eyuun's own book) is the
  hero; the 15 Spirit Tales sit on the shelf. Play/pause, prev/next chapter, seek, speed 1–2×, auto-advance,
  localStorage resume.
**Left off:** 2026-07-04 — **added Bonn Bk3 (The Hollow Crown)** to the public shelf: `+3` in `PUBLISHED_IDS`
  (bookstore/lib/manifest.ts allowlist) → 3 Spirit Tales now live. On the akatskii-web listen side: re-narrated
  Ch3 (was stale pre-edit; `build_audio --book 3 --out <listen> --cover <redo2_a>`, idempotent) + swapped the
  manifest cover from the old atrium v2 to the real published cover. **Publish a book → add its manifest id here.**
  ★ Gotchas: `build_audio` defaults `--out` to the local `audio/` dir (pass `--out /root/akatskii-web/public/listen`);
  Next **fetch-cache persists across pm2 restart** (`revalidate:300`) — `rm -rf .next/cache/fetch-cache` to force;
  do NOT `rm .next/server/app/<route>` on a live server (500 until rebuild).
  Serves ~500MB narration **same-origin** via a `/listen` rewrite → local akatskii-web (:3100) — cross-origin
  akatskii.com media stalls (CF hotlink hang), same-origin streams clean w/ range. Files: `src/app/bookstore/`.
**Next:** Alex cold-play desktop + phone (390px bottom-bar fit, dark-cover legibility). **Decision:** it's
  audio-only by design — NOT a text reader (Alex reframed 07-04). **Coupling:** depends on akatskii-web (:3100)
  being up. Memory: `project_eyuun_bookstore`.

### The Room — 🟢 live · the hub everything ties back to → `/room`
*Last touched: 2026-07-03 — news fallback freshened + Daily ship in the feed; desk-panel fix teed for co-review*
**What it is:** the spatial front door of ather.games (since `/`→`/room`). A 4-wall room you turn
  between, each wall a destination: **Mug door** (profile/settings), **Shimmer TV** (→ the 3D game),
  **Arcade arch** (→ `/arcade/all`, the cabinet hall), **Desk wall** (in-place UI — **Grimoire** link
  left + live **News** feed right, fed by `/room/news.json`, editable with no rebuild). Cabinets return
  here via `<RoomReturn>` facing the right wall.
**Left off:** Nav is room-centric, zero dead-ends — `/arcade` (old flat hub) redirects to `/room`
  (`a23cd1c`), every cabinet carries a RoomReturn pill, stale "← arcade" header/footer links removed
  (`af25be2`). Desk wall surfaces Grimoire + News. AtherPages (Folk volume) shipped behind `/grimoire`
  but the Desk only links the Grimoire volume.
**Next (this week's room lane):**
  1. ~~**Verify-and-close the `?from=room` TODO**~~ ✅ **CLOSED 2026-06-26 (code-confirmed).** The chain
     holds by construction: arch → `/arcade/all?from=room` mounts `<RoomReturn wall={1}>` which writes the
     sticky `ag_from_room` sessionStorage flag; cabinet cards are same-tab `<Link>` (no `_blank`, so the
     flag carries); every game's `<ArcadeCabinet>` renders `<RoomReturn>` unconditionally and reads the
     flag → pill shows for the whole room→hall→game→hall loop. Per-card param propagation is NOT needed.
     *(Edge cases ruled out: no `target="_blank"` cards; RoomReturn render is unconditional.)*
  2. ~~**Desk wall → surface the Folk volume**~~ ✅ **DONE 2026-07-01 (`3e7c5c6`).** Reframed the single
     Grimoire card into an **AtherPages** card with two deep-linked sub-entries — The Grimoire (spirits, cyan →
     `/grimoire?from=room`) + The Folk (people, gold → `/grimoire?v=folk&from=room`), each with its own thumbs.
     Verified live: both render on the Front Desk; the Folk link lands on the Folk volume w/ the room pill intact.
  3. ~~**News feed automation**~~ ✅ **DONE 2026-07-01 (`85d535a`).** Built `scripts/news.py` — `add "<tag>"
     "<title>" [--date]` prepends a dated line + rewrites valid JSON (cap 14, dedup, NO rebuild — the Desk fetches
     news.json at runtime); `suggest [N]` surfaces candidate ships from recent feat/art commits. `add` is the
     ship-moment hook (call it like a cortex signal). **Deliberately NOT blind commit-scraping** — the feed is
     player-facing copy, so suggest proposes + a curated add picks. Dogfooded it to freshen the stale feed (was
     newest 06-21) with the real ships (Driftling/Squall/Dewdrop/Vault, Shimmer 3D, the Folk volume).
  4. ✅ **Desk side-panels off-screen — FIXED + VERIFIED LIVE 2026-07-03 (`d258847`).** Root cause: AtherPages
     (left 1%) + News (right 99%) sit at the wall's edges; the approach-dolly magnified the wall ~2× and pushed
     them off. Geometry showed ANY dolly over ~15px clips them, so the fix was to **drop the desk approach-dolly
     to 0** — panels stay at their in-frame rest positions, approach reads as a brighten (dim 0.55 → full + a
     hair up). Screenshot-verified on ather.games/room?wall=2 (browser access unblocked). *(If Alex later wants
     the immersive zoom back WITH panels in-frame, the follow-up is the screen-space HUD — but the bug is gone.)*
  5. **News fallback freshened 2026-07-03** — `DESK_NEWS_FALLBACK` was mid-June/stale; synced to the current
     top ships so an offline/failed fetch isn't stale. Live feed also got the Daily-Challenge ship (news.py).
  6. **Mobile pass on the wall-turn** — confirm the 4-wall turn + Desk in-place UI read well at 390px (folds
     in with #4 — the screen-space HUD should also fix the mobile desk read).
**Recent (2026-07-03):** greeter is now **Momo** (canon-locked Duskpuff, commercial Kontext base, bg-cut + de-glowed — `c320193`/`93c6d5f`); the **Front Desk approach step is REMOVED** (`318be76`) — no dolly, no click-to-approach, panels live the instant you face it. Desk off-screen-panel fix earlier (`d258847`).
**Parked:** more walls (a 5th destination) · ambient room audio · attendant/NPC presence.
  **★ PARKED IDEA — Eyuun's Bookstore (Alex 2026-07-03, its OWN session):** make the Desk **greeter clickable**
  → **Eyuun's Bookstore**, a cleaner inline-view successor to the Atelier (browse/read the Athernyx books
  in-place). Reading front-door for the franchise, wired into the Room. Detail: CC memory `project_eyuun_bookstore`.
  Do NOT build inline with other work — it's a dedicated session. Relates to the Atelier / Raven book builder.
**Decisions:** **room-centric nav** — the room pill is the ONLY back (no duplicate header links);
  cabinets tie as items in the hall, the room WALLS are the bespoke-art destinations (see the
  cabinet-not-world policy in Atherdash). News is **data-driven** (`news.json`) so it updates without a build.
**Files:** `src/app/room/page.tsx` (walls + DeskWall + ArcadeArch) · `_components/RoomReturn.tsx`
  (sticky from-room) · `public/room/news.json` (live feed) · `scripts/news.py` (add/suggest feed tooling) · `/grimoire` (AtherPages, off the Desk)

### Nolmir — 📦 SHELVED (still live at `/nolmir`) · idle Athernyx defense/arena
*Last touched: 2026-07-16 — SHELVED pending a proper home (Alex's call)*

**📦 SHELVED 2026-07-16 (Alex): "it still feels weird… a lot to take in compared to the other games. We might
need to shelf this one until we can give it a proper home."** Stop pouring fix passes in. Code untouched, route
stays LIVE, save data intact — this is a ROADMAP park, not a teardown.
  - **Why it's structural, not a fix-list item — FOUR passes all aimed at "too much" and none landed:**
    (1) 07-10 wayfinding audit (`bb856d2`) — nav was a maze, no route home; (2) 07-10 one-screen redesign
    (`057e54a`) — Expeditions overflowed **2.6× viewport**; (3) 07-12 progressive disclosure (`ac9608a`) — all 5
    Starforge tabs opened on a fresh save; (4) currency trim — **never done, still 8 currencies**. Four angles,
    same complaint survives.
  - **The diagnosis: genre/frame mismatch.** Nolmir is an IDLE game sitting in a CABINET frame. The arcade is
    pick-one, play 3min, leave. Idle games are *supposed* to be dense, systemic, accretive — they pay off over
    return visits. Every pass has tried to make an idle game legible in a frame that punishes what makes idle
    games good. It reads as "a lot" because it correctly IS a lot; the frame is what's wrong, not the density.
  - **⭐ INDEPENDENT CONFIRMATION — the economy exiled it first, on pure economy logic.** The wallet
    reconciliation (`5e4ad71`, 07-12) had to **revert Nolmir out of the global Marks wallet**: it mints marks
    passively/idle = an uncapped 2nd faucet fighting the card=faucet economy. Board's own words: *"Nolmir = its
    own internal machine."* It is already **in the hub but not OF it** — the one game that can't share the
    economy. Nobody was thinking about feel when that call was made, and it landed on the same seam.
  - **"A proper home" — the design thesis (pure game-design, GBOARD's call, NOT canon):** an idle game isn't a
    cabinet you sit at, it's **a place you return to**. The likely shape is a standing holding/property you own
    and check on, not a peer tile in the arcade grid. ⚠ If that home turns out to be a Rune Hold *building* or
    any new world-fact, that is **Magii's ruling** (Rune Hold is ruled canon, `athernyx world/rune-hold.md` ›
    The Hub) → log a gap in `CANON_GAPS.md`, do NOT invent it here.
  - **Left ON the arcade floor deliberately** (`games.ts` still `tier:"live"`; catalog + recents/resume probe
    untouched). It works and may have real save progress — shelving the roadmap ≠ breaking a live URL. If Alex
    wants it pulled off the floor too, that's a small change (`games.ts` tier + the `saves.ts` probe), ~10min.
  - **Was open when shelved (do NOT pick these up):** ~~device pass on the disclosure/drawer feel~~ · ~~currency
    trim (8 → fewer)~~ · ~~unified return beat + warp ceremony + mobile-idle direction call~~ — all superseded;
    they're fix-list items and the fix list is not the problem. Revisit only WITH a home.
**🖥️ ONE-SCREEN REDESIGN (2026-07-10, jin-cc) — Alex: "make it fit on one screen, scrolling isn't the way."**
  Measured overflow at a ~540px window: **Expeditions +781px (2.6× viewport)** — the disaster, six panels stacked
  in a right column; **Crucible +146** (mild); **Starforge** already tabbed, 3 of 5 tabs fit at 0, Core +290 /
  Refinery +51. **Direction chosen by Alex: HERO + OVERLAYS** — the hall's visual owns the screen, deep controls
  open as dismissible overlays (not stacked). Shared helpers built: `components/Panel.tsx` (scrim + Esc + internal
  scroll overlay), `components/useFitScale.ts` (scales a fixed hero to its box via a click-safe CSS transform).
  - **✅ EXPEDITIONS SHIPPED (`057e54a`, pushed, live):** `h-[100dvh]` frame, `overflow-hidden` — page never scrolls.
    Arena is the hero (640→464 scaled to fit). Control dock over it: prep = squad slots + Staging + Workshop + OPEN
    THE GATE; run = the HUD; after = Back. Overlays: STAGING (roster+talents+doctrine+tier), WORKSHOP (upgrades+
    records), RESULTS. **Verified live at 543px: 0 page scroll in prep AND run** (was +781); full place→gate→run
    flow works; overlays scroll internally + Esc-close; no console errors.
  - **✅ STARFORGE mobile chrome slimmed (`ba1b1a9`):** sibling emblems `hidden sm:flex` (drop on mobile, ☰ covers
    nav), 5 tabs → one horizontally-scrollable row (was wrapping to 2), subtitle hidden mobile, top tightened.
    Chrome ~45%→~19% of height. Mobile visual pending Alex's phone (extension can't emulate narrow viewport).
  - **★ REFRAME (Alex, 2026-07-10): Nolmir is a LANDSCAPE game; web can't force orientation (iOS Safari ignores
    the Screen Orientation lock API).** So stop contorting the landscape halls into portrait — GATE portrait phones
    instead. **✅ `RotateGate` SHIPPED (`ee7d8c0`):** wraps all of Nolmir at the layout; on `(orientation:portrait)
    and (pointer:coarse)` drops a "turn your device" prompt over the (still-mounted, still-accruing) game, lifts on
    rotate. Desktops never gated. NOT a manifest lock (manifest is app-wide, would break portrait cabinets). Gates
    the deck too (rotate once at entry). **In landscape the existing layouts already work** — a landscape phone
    (~2.1:1) is wider than the Orrery, so the void mostly resolves. The portrait-void crop question is moot now.
  - **▶ NEXT: same frame → Crucible** (was +146, minor) + Starforge Core/Refinery tab fit (Core +290), now that
    landscape is the target. **⚑ Alex phone pass on: the rotate gate + the slimmed Starforge + Expeditions, live.**
**🧭 NAV AUDIT + FIX (2026-07-10, jin-cc, `bb856d2`, pushed, live).** Alex flagged the interface as "messy and
**🧭 NAV AUDIT + FIX (2026-07-10, jin-cc, `bb856d2`, pushed, live).** Alex flagged the interface as "messy and
  complicated, had me avoiding it." The audit found the mess was the MAP, not the density: the SiteNav drawer was
  mounted ONLY on the deck — Starforge + Expeditions had **no menu and no route home at all** (only sideways hops
  between halls). And the names lied — deck tile said "The Orrery" but opened a page titled "THE STARFORGE" (Orrery
  is one of its 5 tabs); `/nolmir/crucible` still titled itself **"NOLMIR"** (stale front-door leftover). Plus the
  crucible `[edit]`→`/nolmir/dev` link rendered for everyone → non-owners hit the proxy's bare "Forbidden" page, no
  way back. **Fixed:** SiteNav on all 3 halls w/ a `Nolmir ▸ <hall>` breadcrumb (Nolmir crumb = home); a `deck`
  (home) emblem added to each hall's sibling row (now Deck + 2 siblings = one tap anywhere); inline mute → drawer
  sound row (manana pattern, clears the corner for ☰); tile "The Orrery"→"The Starforge"; crucible h1 "NOLMIR"→
  "THE CRUCIBLE"; `[edit]` owner-gated via new `useIsOwner()` hook (`/api/owner` probe — httpOnly cookie isn't
  JS-readable). Verified live both owner paths. **★ THE DENSITY IS A SEPARATE PASS (Alex's eye):** 8 currencies,
  ~13 panels behind 3 tiles. Fixing the map first may change how crowded it actually feels — reassess before cutting.
**🧪 REGRESSION GUARD (2026-07-03, jin-cc):** the ~90K economy had 1 test file (expedmeta, 13). Added
**🧪 REGRESSION GUARD (2026-07-03, jin-cc):** the ~90K economy had 1 test file (expedmeta, 13). Added
  **starforge.test.ts (59)** + **away.test.ts (16)** = **88 total** guarding the idle math that breaks
  silently: settle idempotency (starforge + the homecoming — *whoever loads first banks the haul*), 48h
  offline cap, no-leak accrual, heat/upkeep (mana never negative, lines fray unpaid), transmute (whole units
  sold, dust kept), research gating/ramp, cost curves, genSystem determinism, and the warp carry. Run:
  `for f in src/app/nolmir/lib/*.test.ts; do npx tsx "$f"; done`. **All green, no bugs in covered paths.**
  **Coverage now 118 assertions (was 13):** + **sim.test.ts (14)** guards the Crucible `runMatch` — the idle
  economy's foundation (away.ts settles by seed, trusts determinism): determinism + 200-seed invariant sweep
  (yield≥0, deepest∈[0,1], bounded ticks, victory names a valid winner + reached gauntlet, non-degenerate),
  mods bite the outcome, yieldMult scales. ~22s to run. All green, no bugs.
  **⚑ ONE FINDING FOR ALEX (not changed — prestige-balance call):** `doWarp` carries research/castings/sigils
  but NOT `owned` (per-creature guard levels/xp) → a warp keeps WHICH guards you equip but resets their earned
  progression. The comment says warp carries "the guards" — so this reads like an oversight, but whether guard
  levels should survive a prestige is Alex's call. One-line fix if yes (add `owned`/`collection` to the carry).
**Economy map (2026-06-17, grounded in code):** currencies = **corelight** (Orrery spine: core-tap
  `rigs×1.5^conduit×2.2^depth×research` + node beam-back + transmute) · **ore** (6 tiers, mined) ·
  **refined** (steelglass/voidplate/embershard — the ONLY research currency) · **mana** (Crucible
  matches → planet UPKEEP) · **marks** (Expeditions → workshop + champions) · **exp** (Crucible →
  host level, warp-proof) · **guard-xp** (use-not-coin). **Coupling:** Orrery research buffs all 3
  pillars; **claim planets w/ corelight, KEEP w/ mana** (the spiral — heat↑→upkeep↑→must run Crucible);
  marks→champions→appear as Crucible guards; warp = prestige (exp/marks/research persist).
**Recent ships (2026-06-17→18, collapsed — detail in git):** **all three pillars now idle** —
  Expeditions garrison salvages marks while away (`5892d89`, 48h cap, nudge-not-grind); **unified
  return beat** extracted to `lib/away.ts` `settleHomecoming` so the deck collects the WHOLE ship in
  ONE itemized digest (`d895da5`); **collect juice** on that digest — staggered rows + count-up +
  sfx + hidden-tab fallback (`4f0683f`).
**Left off:** All 3 modes (Starforge / Orrery / Crucible-Expeditions) + THE LOOP + warp
  live. **2026-06-15 — built the COMMAND DECK (`d54f82b`, `/nolmir/deck`):** one screen for
  the whole ship — three mode tiles with live "ready" pulls (Crucible next-answer countdown /
  matches awaiting; Orrery corelight ticking + heat→warp, "THE GATE IS KEYED" on warp-ready;
  Expeditions marks / champions rested-or-afield) + a consolidated *WHILE YOU HELD NO WATCH*
  digest on return. Reads existing load/settle fns; collecting still happens per-mode. Linked
  from the hub header. The fix for "deep systems, disconnected surfaces."
  • **✅ Deck PROMOTED to the `/nolmir` front door (`96cb812`):** opening Nolmir now lands on the
    whole-ship deck; the crucible hub moved to `/nolmir/crucible` (cross-links repointed).
  • **✅ WARP CEREMONY (`0a443f8`, `components/WarpCeremony.tsx`):** STEP THROUGH was instant — now
    a ~4.7s canvas sequence (gate keys → Node falls behind beaming light home → echoes crystallize →
    arrival wheels in → ENTER THE SYSTEM), staged canon text per beat. Plus a **`rehearse ▸`** button
    in the Gate room to watch/tune it **without spending the warp** (Alex's gate is keyed + un-jumped).
  • **✅ Deck mobile pass — verified great on a 390px phone** (no fixes needed; it's the reserved
    mobile-idle shape, ready). • **✅ Gate fixed (`f6d09e0`):** proxy.ts is Next 16's middleware
    (wired all along — "stale artifact" read was wrong); broadened the matcher to cover all game
    routes. • **✅ Orrery "numbers go up" juice (`5973bb4`):** rising ±N ◈ floater off the corelight
    readout + emerald/rose flash on the number, wired into buyCorelight (spend) + transmute (gain).
**Next:**
  1. **⚑ Alex feel-test the unified return beat** — needs **>20min away** to bank a real Crucible haul
     (one match interval). Confirm the digest reads as one satisfying collect; does the haul feel earned?
  2. **More juice (cont.)** — ✅ deck collect count-up (`4f0683f`) AND ✅ in-mode gain floaters +
     level-up beat (`fc19a1e`): extracted the Orrery floater into a shared `components/gainfx.tsx`
     (`useGainFx`/`FloatLayer`/`flashCls`/`GainFxStyles`), wired Crucible (mana floater + host
     LEVEL-UP beat, watches displayed level → fires on live wins AND away-settle) + Expeditions
     (marks floater on spoils/spends). Starforge refactored onto it, floater proven live (−25 ◈).
     ✅ **Planet milestone beats SHIPPED 2026-07-03 (`8240a65`):** claiming a NEW world fires a toast —
     "First World Claimed" / "World Claimed" (named + counted) / "System Claimed" (full system, big fanfare).
     Ref-guarded effect keyed on worked-world count (arms silent on load, ignores deepen/settle churn);
     decision lifted to a pure `lib/milestones.ts` + unit-tested (16 assertions). ⚑ **Toast feel = Alex's eye.**
  3. **Alex: rehearse the crossing** (Orrery → Gate → rehearse ▸) — tune the warp ceremony beat/feel
     before the real first warp. · Decide the **mobile-idle direction** · sprites = Alex (next weekend).
**Parked:** dedicated mobile build (still the long-term home; desktop arcade is the interim).
**✅ 2026-06-18 — flipped back-room → `live` in the arcade** (`games.ts`, Alex's call): a clickable
  PLAY card so he can playtest without the owner-cookie/redirect friction. Verified: public no-cookie
  `/nolmir` = 200 (was 307), catalog lists it. Dropped "(held for mobile)" from the tagline. Trivially
  reversible (flip the tier back). ✅ **Card art generated** (`dcc1d43`): a glowing forge-core in a dark
  orbital system (`public/nolmir/card.webp`, FLUX-schnell, added to CatalogGrid CARD_ART).
**Decisions:** was back-room (reserved for a future **mobile** idle game); now **live in the arcade**
  for playtest ease (2026-06-18) — still mobile-destined long-term, the desktop deck just serves the
  interim. Deck
  is a **read/route hub**, not a settler — but settling-on-load is idempotent-by-timestamp, so the deck
  banking corelight/marks is safe (whoever loads first banks; the mode page sees ~0). **All three
  pillars idle now** (Alex's call 2026-06-17: Nolmir is a true idle game, not one idle pillar + two
  active). Idle is a **nudge** (48h ≈ one active run), never a replacement. Anti-cash-grab stands.
**Files:** `src/app/nolmir/` — `deck/page.tsx` (the hub) · Starforge / Orrery / Crucible / Expeditions + warp
**✅ Infra (gate fixed `f6d09e0`):** the owner gate is `src/proxy.ts` — in **Next 16, proxy.ts
  IS the middleware convention** (correctly wired; my "stale artifact" read was wrong — a `middleware.ts`
  alongside it is a build error). The real gap was the **matcher**, which only ran on /shimmer /magii
  /nolmir /api → newer coming-soon routes slipped through (that's how /lucernyx was reachable).
  Broadened to run on all pages; classify() reads the GAMES registry so it now auto-covers every
  game route. Verified: live 200 · back-room/coming-soon 307→/arcade · dev tooling 403 · /owner 401.

### Mana'nana — 🟢 live · match-3, blooming specials → `/manana`
*Last touched: 2026-07-08 — difficulty-curve pass (eased Lv9/10/14 walls) + reward-loop polish (level-cleared fanfare, living trail token, trail finish line). 07-07 audio layer to shared libs; 07-06 home + Story roadmap*
**★ 2026-07-08 SESSION (jin-cc, all pushed):**
  - **Difficulty pass** — Alex hit walls at Lv9 (score 3500→2000), Lv10 (storm 34/13→28/20 moves), Lv14 finale (6000/18→4000/20). Curve audit flagged the outliers; watch next = Lv12 (9 puffs/12) + Lv11 (8 collars), left for play data. Full feel-sweep deferred until Alex runs the ladder end-to-end.
  - **Orb-clear juice** (`7e97b15`) — clears read as instant-vanish; added radial ripple stagger + per-orb burst ring + punchier pop + more motes. Knobs: `RIPPLE_STEP`/`RIPPLE_MAX` + `manana-pop`/`manana-burst` in page.tsx.
  - **Reward-loop polish** (`f6f6297`) — win was an instant cut to the trail; now a 1.5s board fanfare (burst-wave from centre + gold ring + "✦ level ✦" banner) before the token-hop. Trail token gains idle-bob + ground-shadow + squash landing. Timers in `win()`.
  - **Finish line** (`0b5729d`) — trail ended abruptly; added a finish marker at the foot (Ather Winds' gate): dim/sealed while climbing, lights gold + token crosses on full-ladder clear; auto-scrolls to it when done.
  - **▶ NEEDS ALEX DEVICE PASS:** fanfare timing/feel (too long/short?), ripple feel on big cascades, finish-line read. **TODO(art):** swap 🐾 trail token for a real Mana'mal sprite (Momo/Duskpuff) — wrapper ready in Roadmap.tsx.
**Left off:** Cloud-puff obstacle live (CSS stub, Shimmer-canon palette), detonation FX
  (row/col beams, star flash, prism ring, capped motes), and iOS sound+scroll fixes
  **confirmed on a real iPhone**. Orbs are canon elements (SVG rune-marks: Mana/Storm/
  Earth/Water + Ather + Love).
**Next:**
  0. ✅ **SPECIAL+SPECIAL COMBOS SHIPPED 2026-07-06 (`a08d6a6`)** — the depth layer. surge+surge=plus,
     star+surge=thick cross, star+star=5x5, prism+surge/star=colour-sweep-to-special, prism+prism=board nuke.
     `specialCombo()` in match3.ts; flows through the existing resolve/FX/score pipeline (no page rewrite).
     8 clear-set + 4 full-cascade assertions. ▶ Alex playtest for feel/balance (prism+prism is a big score spike).
  1. ✅ **QUESTS MODE SHIPPED 2026-07-06 (`523daad`)** — the objective ladder / spine. New 'quest' mode:
     12 element-themed levels (collect N element · scatter clouds · bloom N specials · reach score), each a
     goal + move budget; clear→advance, localStorage progress. `lib/quests.ts` pure engine (19 assertions);
     resolve() now reports colorCounts. Goal HUD + win/lose overlays. Verified live (mode/HUD/budget/tracking).
     ▶ Alex playtest for difficulty curve (move budgets + goal targets per level) + win-overlay feel.
  1b. ✅ **T/L SHAPE SPECIALS SHIPPED 2026-07-06 (`ff69d90`)** — shape now matters, not just run length.
     H-run × V-run crossing: **L (corner) → burst** (NEW 3×3 box-bomb special), **T (junction) → star**.
     (mapping is a one-line flip if Alex wants T↔L swapped.) Fixed a latent mono-colour infinite loop via a
     guaranteed-progress guard. 5 shape assertions green. ▶ Alex playtest the burst feel + T/L mapping.
  1c. ✅ **COLLAR OBSTACLE + CALLOUTS SHIPPED 2026-07-06 (`7fe607e`)** — collared orb = Folk-canon blocker
     (locked colour orb; a clear on/beside it SNAPS the collar, freeing it to a normal orb — "free the spirit").
     Distinct from puffs (carries colour, falls, freed not removed). New quest goal 'free N collars' + 2 levels
     (Snap the Collar / The Warren) → ladder now 14. Plus SPECIAL/COMBO CALLOUTS (SURGE!/PRISM!/STAR!/BURST!/
     COMBO! flash) teaching the roster. 7 collar assertions; collars render+seed+HUD confirmed live. ▶ Alex
     playtest freeing feel + callout timing.
  1d. ✅ **ATHER SURGE POWER SHIPPED 2026-07-06 (`61fbcb3`)** — the ather meter now charges a triggerable
     power, not just auto +moves. Clearing orbs fills a header lightning button (48 orbs); tap when full to
     forge 3 random specials onto the board (weighted surge/star/burst) for you to wield + combo. No move cost;
     resets per game; excluded from bloom-goal counting. atherSurge() pure (7 assertions). ▶ Alex playtest charge feel.
  1e. ✅ **COZY COMMENTATOR VO SHIPPED 2026-07-06 (`c08c7f0`)** — a warm British sportscaster (ElevenLabs
     "George") reacts to game state: open, combo tiers (nice/impressive/big), running-low-on-moves, milestone,
     shuffle, game over. Cozy-not-Candy-Crush: the feel is the THROTTLE (`lib/vo.ts` VoBank — per-tier
     probability + 2.8s global cooldown + priority so big moments talk over chatter). One mute toggle governs
     sfx+voice. Alex ear-picked George over edge-Ryan/11L-Alice in an A/B. Clips in `public/manana/vo`
     (gitignored); `scripts/gen_manana_vo.py` reproduces them. Lines canon-neutral (no Magii gate). ▶ Alex
     DEVICE PASS: the throttle/sparseness feel — talks too much? too rare? tune PROB/MIN_GAP in `lib/vo.ts`.
  1f. ✅ **MUSIC BED + DUCKING SHIPPED 2026-07-06 (`3679dae`)** — Alex's looping backdrop track wired through a
     Web Audio bus (`lib/music.ts`), NOT a plain `<audio>` tag: gapless MP3 loop + a real GainNode so every
     spoken George line dips the music ~1s then swells back (voice cuts through). Quiet bed (0.32); starts on
     first gesture; one mute toggle governs sfx+voice+music. VoBank got an `onSpeak` hook (stays decoupled).
     Track = `public/manana/music.mp3` (gitignored, server-side). ▶ Alex DEVICE PASS: bed volume (BASE_VOL) +
     duck depth/recover (DUCK_TO/DUCK_RECOVER_S) feel + is the loop seam clean? All knobs in `lib/music.ts`.
  1g. ✅ **HOME + STORY ROADMAP SHIPPED 2026-07-06 (`5c1a042`)** — the game got a SHAPE. `Home.tsx` front door
     (Story/Endless/Daily + records + mute) and `Roadmap.tsx` = a **winding board-game trail** of the 14 quest
     levels as pitstops with a **game-piece that hops forward on each win** (the "pitstop" payoff — win returns
     to the trail, not a board overlay). Waypoint bands cite the garden's REAL canon geography in canon order
     (Moonwell Glade→Mycelial Path→Mana Springs→Spirit Meadows→Gloview Village→The Outfields→Voranyx Caverns→
     Ather Winds, per `CANON/game/shimmer-geography.md` — cited, not invented; level→zone map is soft design).
     `page.tsx` gained a `view` state (home|roadmap|board). Alex picked the winding-trail metaphor over region-
     bands/node-chain. Build EXIT=0, /manana 200. **▶ Alex DEVICE PASS: the whole flow** — home feel, trail
     readability on a phone, the win token-hop, tap-to-play. This is a SKELETON. **▶ NEXT:** transition polish
     (home→trail slide, pitstop→board bloom, win token-hop juice) + theme the trail art + swap 🐾 placeholder
     token for a real Mana'mal + decide if the in-board mode toggle stays (Home covers it now).
  2. Paint a **cloud-puff sprite** in Aseprite → swap the CSS `PuffCell` stub (drop-and-convert).
  3. Combo discoverability polish — a first-combo celebration / subtle glow between two adjacent specials.
  4. Optional puff balance tune; `robots` index intent in `layout.tsx`.
**Parked:** pre-tinted orb bases per element · pixel-art widget icons (mug / cabinet).
**Decisions:** kept the **CSS gradient orbs** over a painted pixel-orb (Alex prefers them —
  the Void-orb experiment was reverted); cloud-puff chains stay **emergent**, not hardcoded
  (that's the difficulty); detonation kept **clean** over maximalist (his call).
**Files:** `manana/lib/match3.ts` · `page.tsx` · `tiles.ts` (T34 puff palette) · `runes.tsx` · `lib/sfx.ts` · `lib/vo.ts` (commentator) · `lib/music.ts` (bed+ducking) · `scripts/gen_manana_vo.py`

### Rekindle (#3) — 🟢 live · conduit puzzle + Aeterna node-map → `/rekindle`
*Last touched: 2026-06-22 — gx-* UI pass (map tiles → gx-card plates, squared chrome on both views)*
**Left off:** v2 mechanics live — **colour purity** (mixed hues muddy a junction) +
  **charge budget** (rotations cost; run dry = the dark wins) + 3-star scoring. Slice 2
  **Aeterna network** node-map (5 nodes + a finale), each puzzle a dead machine that lights
  a node + unlocks a lore fragment. Seeded generator (daily + endless), 40/40 guaranteed-
  solvable. **Lore fragments are DRAFT.**
**Next:**
  1. **/magii (Sable) canon pass on the lore** — the one real blocker on the narrative-meta thesis.
  2. More nodes / regions.
  3. Real hazard levels (forced near-merges).
  4. Slice 3 = **prisms** (split a flow — ties to Mana'nana's Prism).
  5. Colour-generated dailies.
**Parked:** —
**Decisions:** lore stays **draft until /magii blesses it** — do NOT canonize from the
  Luna/Jin seat; generator guarantees solvability **by construction** (spanning-tree boards),
  not by a solver; take the **story-unlock, not lives/IAP** (catalog thesis).
**Files:** `rekindle/lib/puzzle.ts` · `lib/generate.ts` · `lib/world.ts` · `components/WorldMap.tsx`

### Ward (#4) — 🟢 live · Missile Command / touch aim-trainer → `/ward`
*Last touched: 2026-06-21*
**🆕 FEEL-LAP DONE (2026-06-21, `7031fb5`) — ENEMY VARIETY.** Alex cold-play: too easy (only
  faller + splitter to read). Added 3 kinds, each a distinct aim skill, staged by wave (fresh
  threat + difficulty bump): **Drifter** (w4, TRACK — weaves, wavy-wake tell), **Darter** (w6,
  REACT — winds up then snaps, red charging reticle), **Husk** (w7, FOLLOW-UP — armored 2-hit,
  cracking shell; where the ammo economy earns its keep). Foundation: kind discriminator,
  per-bloom hit-set, generalized ground-impact (lateral kinds hit whatever spire they land on),
  crack/dart FX. 59 sim tests (+10). Tells verified distinct on-screen; mobile 390px confirmed;
  card art ✓. **Ward lap = cold-play ✓ feel ✓ cabinet ✓ mobile ✓ card ✓.** ⚠ PENDING Alex tune
  pass (DRIFT/DART/HUSK constants: weave gentleness, dart warning, husk feel, intro wave). Ammo
  kept generous per Alex ("they'll need it when it's hard" — the Husk makes that true).
**Left off:** Shipped + four depth passes all live — **splitters/MIRVs** (wave 3+ fork at
  altitude, kill high for a 3x clean-kill), **tiered game-over taunts**, **multi-kill
  scoring + juice** (one ring on a cluster → escalating bonus + ×N floater + arpeggio),
  **post-run scorecard** (accuracy / downed / best-chain / clean). Shares Rekindle's cyan/CRT skin.
**Next:**
  1. **Daily** — seeded wave script, shareable (reuse Rekindle's date-seed pattern).
  2. **Variety** — a **strafing** blight (tracking skill) + a **blink/pop-up** threat (reaction).
  3. **Adaptive difficulty** — scale wave speed/count to recent accuracy.
  4. **Foreground-tab playtest (Alex)** — tune base feel: bloom grow-time, ammo generosity,
     blight speed, splitter telegraph readability.
**Parked:** warm-amber "missile-command" alert palette skin (optional) · canon tie-in via
  /magii (which spires? blight = the dark Rekindle fights).
**Decisions:** pure arcade, **no node-map** (Rekindle owns the meta network); designed as a
  **touch aim-trainer** (mined Aimlabs/Kovaak's/Missile-Command). Gotchas: MCP `left_click`
  doesn't dispatch `pointerdown` → test with real PointerEvents; a hidden tab throttles rAF
  (sim looks frozen — **not a bug**).
**Files:** `ward/lib/ward.ts` (41 tests) · `lib/sfx.ts` · `page.tsx`

### Updraft (#5, was "Laz") — 🟢 live · one-tap flight (Flappy) → `/updraft`
*Last touched: 2026-07-07 — music bed + George VO commentator (shared audio layer); 06-22 gx-* UI pass*
**Left off:** Shipped. Lazerin rides the Ather currents — tap to climb, thread the void
  gates, endless score-chase. Hybrid bg (faint FLUX nebula behind procedural parallax
  spires + starfield). Uses shared `useNoScroll`. The pick-up-die-retry palate cleanser.
**Next:**
  1. *(Optional)* async seam — daily / leaderboard / ghost, **if** the arcade grows leaderboards.
     Otherwise **feature-complete by design.**
**Parked:** any lore weight (intentionally canon-light).
**Decisions:** **canon-light on purpose** (Lazerin, no lore load); keep it **ultra-short and
  minimal** — it's the cleanser, not a depth game; renamed Laz → Updraft (Alex's call).
**Files:** `updraft/lib/updraft.ts` (17 tests) · `page.tsx` · `public/updraft/nebula.webp`

### Seedfall (#6) — 🟢 live · the long drop (scrolling descent) → `/seedfall`
*Last touched: 2026-07-01 — thrust reworked to wind-puff gusts (`693a613`); card regen 06-30; redesign 06-22*
**Left off:** **Full redesign.** The old static soft-lander was boring (a one-decision run, no
  score). Rebuilt as a **scrolling descent**: camera tracks the falling seed (depth = score), you
  **weave leafy branches** (one walking gap each, narrows/tightens with depth) and **out-drift a
  curious Havari** (bird spirit — swoops to snatch the seed = run ends; framed as a force-of-world,
  not a villain, per canon), and the **soft-landing on the garden soil is preserved as the climactic
  finale** (perfect/soft = big score bonus + plants the garden). Kept the floaty drift physics &
  two-zone hold; single-side thrust also lifts so weaving naturally slows you. **Now joins the Daily
  loop + the new server leaderboard** (was excluded for having no score). endless/daily mode toggle,
  depth HUD, gx-* chrome. **Balance (sim):** retuned languid (GRAVITY 78→54, MAX_VY 250→170, walking
  gaps) — oracle perfect-play reaches the soil **41%** threading 13/15 branches (median depth 3685/
  4200, 0 caught); most runs end on a deep branch w/ a depth score = the score-chase tail. 22 sim
  tests green, build clean, start screen headless-verified.
**⚠ PENDING ALEX device pass:** the whole descent FEEL (drift authority vs branch spacing, fall
  speed), the **Havari catch-rate / dodge feel** (bots can't judge it), the soil-approach landing,
  and the game-over overlays (headless can't get past hold-to-drop). Knobs = consts atop `seedfall.ts`
  + `genBranches`. ✅ **Card art regen'd for the descent 2026-06-30 (`e7a04d9`)** — FLUX brief rewritten to
  the long canopy plunge (seed-mote weaving gaps, swooping Havari, garden-glow floor); old static-lander card retired.
  ✅ **Thrust visual reworked 2026-07-01 (`693a613`)** — old "rocket lines" → **wind-puff gusts**: both-held =
  updraft pillowing up under the seed, single-side = lateral gust sweeping from the upwind side. Render-only,
  matches the languid-airy soul. **All solo-doable Seedfall work is now done — the block waits on Alex's device pass.**
**Decisions:** redesign over polish — the cozy mood stays (languid drift, the garden payoff) but it
  earns a score axis + escalation so it's replayable; Havari = curious not malicious (canon).
**Files:** `seedfall/lib/seedfall.ts` (22 tests) · `seedfall.test.ts` · `lib/sfx.ts` (+thread/+caught) · `page.tsx`

### Voranyx (#7) — 🟢 live · glowing slither in the Silt → `/voranyx`
*Last touched: 2026-06-22 — gx-* UI pass (squared chrome + HUD); template for the lap look*
**Left off:** SP-vs-AI build, **canon-grounded first** (`athernyx/CANON/world/voranyx.md`, DRAFT).
  **2026-06-15 — addressed the mid-game cramping + did a mobile pass:**
  • **Arena bigger / squeeze slower** — `ARENA_R0` 1000→1500, `ARENA_RMIN` 380→**560**,
    `ARENA_SHRINK` 9→**6.5**, `FOOD_TARGET` 240→**480** (density held). Worm-vs-arena at mass 50
    dropped 0.63×→**0.43×** (headless); the ring no longer floors before a typical death.
  • **Zoom backs off harder** — `1.0 - mass*0.0052`, floor **0.5** (~0.74 @ mass 50, was 0.855).
  • **Floating relative joystick for touch** — thumb-anchored drag, never occludes the head;
    mouse keeps cursor-follow. (`ddc5952`, `f2120b8`.)
  • **✅ Alex phone playtest PASSED (2026-06-15)** — mid-game breathes now AND the joystick
    feels great on both. Tuning + mobile control are validated; Voranyx is in a good resting state.
**Next:** *(nothing urgent — parked in a good state)*
  1. Optional: stick-pushed-to-edge = boost (fold the boost pad into the joystick, true one-thumb).
  2. Optional: if the squeeze ever feels *too* slow → nudge `ARENA_SHRINK` back up (6.5→7.5).
**Parked:** the **MP seam** (multiplayer serpents — built toward, deferred) · a Sable canon
  pass on the cloud-ocean placement note in `voranyx.md`.
**Decisions:** **canon before code**; boost **decoupled from length** (motes, not tail-burn);
  world-space **procedural deep, no fixed bg** (fixed image wrong for a panning camera);
  **trust the hands-on read over headless** (headless said mass 48-85 fine, hands-on caught the
  cramping); on mobile, **relative joystick > absolute-aim** (absolute = thumb covers the head).
**Files:** `voranyx/lib/voranyx.ts` (20 tests) · `page.tsx`

### Lucernyx (#8) — ⚫ SHELVED (back-room) · turn-based board of rekindling → `/lucernyx`
*Last touched: 2026-06-22*
**⚫ SHELVED 2026-06-22 (Alex's call):** "the gameplay isn't worth the hassle of trying to make it enjoyable."
  Parked to `back-room` (tier flipped in `lib/games.ts`, gated like Gravitar; code kept, public never sees it).
  **Root cause we diagnosed (the "win after 1 torch" bug Alex hit):** the Rekindle Pulse is overtuned — sim over
  2025 torches showed it converts **2.29 enemy pieces per torch on avg, 79% of torches flip 2+, 54% flip the full 3**.
  That material avalanche (a) ends ~4% of games via board-lock/wipeout *before* anyone lights 3 torches (then the
  tiebreak crowns a sub-3-torch winner while the overlay hardcodes "Three torches lit" — the lying victory msg), and
  (b) punishes clustering pieces in the back ranks (the flare goes off on the defender's home cluster). The fix
  existed (PULSE_CAP 3→1, sub-3-torch lock = draw not win, honest copy) but the broken mechanic IS the game's whole
  hook, so Alex chose to shelve rather than rebalance. **Lesson:** a single high-cap swing mechanic that's also the
  win-engine self-snowballs; if the gimmick can end the game sideways, it'll do it more than you think (measure it).
  **Revive = rebalance the pulse first** (PULSE_CAP 3→1,
  sub-3-torch lock = draw not win, honest copy) — but the broken mechanic IS the hook, so a revive
  is really a redesign. Code kept in git, gated like Gravitar.
**What it was (one line):** lantern Ancient, checkers-slide + jump-to-convert grey pieces to your
  light, run a piece to the enemy home rank → torch; first to 3 wins. Greedy AI, sim-first (28 tests).
  Element-terrain rooting was tried then CUT (`398548b`) — caused stalemates + ghost-moves.
**Files:** `lucernyx/lib/lucernyx.ts` (28 tests) · `lib/lucernyx.test.ts` · `page.tsx` *(full build-log in git history pre-`398548b`)*

### Gravitar (#9) — ⚪ PARKED/CUT · physics-orbit slingshot → `/gravitar` *(back-room, hidden)*
*Last touched: 2026-06-15*
**⚰ Verdict (Alex playtest 2026-06-15): the CONCEPT isn't fun. Cut.** Not a build problem —
  well-built, 18 tests, vector-glow clean — but the core loop (fight gravity to collect dots) is a
  navigation chore with thin reward. Pulled from the live catalog → `back-room` (code kept in git).
**The lesson (worth keeping):** the *tell was in the build* — the whole thing fought its tuning
  (bots couldn't survive; needed non-Newtonian speed-caps + bounce-walls just to be navigable). When
  a core loop needs that much scaffolding to not be miserable, the foundation is thin. Classic Gravitar's
  fun was **combat + bunkers**; stripping that for a pure collect-loop kept the chore, dropped the thrill.
  A gimmick rarely saves a base loop that isn't fun. **Physics-orbit-navigation is novel but doesn't carry a game alone.**
**Possible reuse (only if it ever calls — NOT a save of this game):** the gravity sim is solid tech.
  The one frame that could be fun with it = a **one-shot "gravity-golf" puzzle** — aim + power, launch a
  spark, gravity curves it, thread it to a goal (relight an Orrery node) in fewest shots. A *different,
  deliberate* loop (aim-and-watch), not continuous-piloting stress. Reuses ~80% of `lib/gravitar.ts`.
**Files (kept):** `gravitar/lib/gravitar.ts` (18 tests, reusable physics) · `lib/sfx.ts` · `page.tsx`

### Atherdash (#10) — 🟢 live · lane-runner, element-lanes vs the Dying → `/atherdash`
*Last touched: 2026-06-21*
**🆕 PAGE-TIE shipped (`9cdfff0`, 2026-06-21) — first arcade CABINET tied to the room.** Reused
  `/arcade/hall-bg.webp` (brightened) full-bleed behind the page + CSS **cabinet housing** (dark panel,
  gold `#d4a843` trim, title = marquee plate) → the game reads as a lit cabinet IN the hall the room's
  Arcade arch shows. `RoomReturn wall={1}` (gated `?from=room`) lands back facing the arch. Applies to
  direct visitors too; room-pill just hides. ✅ **TODO CLOSED 2026-06-26** — back-pill confirmed via the
  sticky `ag_from_room` flag (set at the hall on the arch hop, read by every cabinet); no per-card propagation needed.

  **✅ POLICY DECIDED (Alex green-lit 2026-06-21) — cabinets, not bespoke worlds.** Arcade games tie as
  cabinets in ONE shared hall; per-game identity = cabinet skin (trim/glow keyed to palette), NOT a
  bespoke gen'd environment per game (that's a never-ending art tax + dissolves the "one hall" fiction;
  room WALLS earned bespoke art because they're destinations, cabinets are items in a collection). Spend
  the gen budget ONCE on a great SHARED hall composed for the at-a-cabinet view (light in the MARGINS,
  not just a center corridor). Full rationale: memory `project_arcade_cabinet_not_world`.
  **✅ COMPLETE (`153ac26`→`846d88b`):** gen-once `/arcade/cabinet-hall.webp` + reusable
  `<ArcadeCabinet>` (`_components/`, props accent/wall/maxWidth; gold housing = shared furniture,
  accent = screen-spill). **Whole catalog tied:** 7 games on the shell — Atherdash/Ward/Lucernyx/
  Voranyx/Seedfall/Updraft + Rekindle (BOTH map+play views); **Mana'nana deliberately full-bleed**
  (own AtherBackdrop, RoomReturn-only — a cabinet would cage the match-3 board). Gravitar cut;
  Shimmer/Magii = room walls. **PENDING Alex device pass:** look across games + final warmth/dim/
  red-skew (one component → change once, everywhere). ✅ **`?from=room` TODO CLOSED 2026-06-26** (sticky flag; see Room block).
**🆕 ARCADE-LAP slice 1+2 shipped (`afaa451`, 2026-06-21) — the SECOND AXIS.** Alex cold-played on
  mobile: "smooth, could be a bit slower, maybe tap-to-jump + levels with ramps/pitfalls." Built:
  - **Slice 1 — speed ramp.** Forward speed is no longer flat. `speedAt(dist)` opens at **base 0.60**
    (was 0.74) and eases to **0.86** over `SPEED_RAMP_DIST 70` — forgiving start, earns its speed.
  - **Slice 2 — tap-to-jump + pitfalls.** `jump()` opens a `JUMP_DUR 0.6s` hop window; **grounded-only**
    (no double-hop = can't sit airborne). **Pitfalls** = full-width gaps you can't slide around — must
    HOP. Clean axis split: **gates = slide skill, pits = jump skill** (jump ignores gates, lane ignores
    pits). Pits spawn **centred between gates** (`PIT_GAP_Z 2.4` = 4×`GATE_GAP_Z`, `PIT_LEAD 2.3`) →
    steady slide→hop rhythm, never simultaneous. Render: void-gap band + glowing danger lips, airborne
    spark arc (`JUMP_H 64`) + shrinking ground shadow. sfx `jump`/`fall`; over-screen reads cause
    ("the gap takes you" vs "the wall takes you"). **47 sim tests green** (was 36). Build clean, :3200
    restarted, ready screen headless-verified.
  - ⚠ **PENDING ALEX FEEL-TEST (his hands — headless can't dispatch the launch tap):** does the hop
    *timing window* feel fair? slide→hop rhythm readable? base speed right now, or slower/faster? Knobs:
    `SPEED`/`SPEED_MAX`/`SPEED_RAMP_DIST`, `JUMP_DUR`, `PIT_GAP_Z`/`PIT_LEAD` in `lib/atherdash.ts`.
  - **NEXT in the design (his picks, ranked):** ramps (auto-launch + score-mult breather) → **element
    ZONES** (themed biomes bias the obstacle mix + entry banner = "levels") → the Dying-chase stakes
    layer → `gx-*` UI-layer pass → card art parity.
**Juice + sfx pass shipped (`d504e32`, Phase 4 pulled early while Alex at work):** sound on the
  shared arcade engine (`lib/sfx.ts`) — lane-swap whoosh, gate-pass chime, wall-hit thud, end sigh,
  mute toggle. Visual juice (ref-driven, no re-render): gate-pass burst (element-coloured ring + mote
  fountain), crash burst (red ring + scatter) + decaying screen-shake, swap smear trailing the spark
  mid-lerp. Build clean, public 200, no console errors. **Audio feel-test pending Alex's gesture**
  (and the browser MCP was timing out on his device while at work — visual verify deferred to him).
**Left off:** **SLICE feel-gate PASSED on Alex's real device 2026-06-17** ("nailed that first pass!
  maybe a bit fast") → went straight into **PHASE 1, the core game.** Live + public (flipped to `live`
  for the phone test — no traffic, just Alex; flip back to coming-soon anytime if the slice-state card
  bugs him). Now playable end-to-end:
  - **4 canon element-lanes** — Water/Storm/Earth/Mana, left→right, colours = the Mana'nana orbs
    (`#37a3e6` / `#f0a526` / `#48b56f` / `#9b5ad2`). Element-coloured lane dashes + a faint corridor
    wash teach lane=element at rest.
  - **Gates** rush from the horizon, each opens ONE element lane (a glowing portal); the other three
    are dim void **walls** (the Dying). Be in the matching lane at the hit plane (`GATE_HIT_Z 0.085`,
    aligned to where the spark visually sits) or you hit the wall. Steady track cadence (`GATE_GAP_Z
    0.6`, `LEAD_DIST 0.72` breath before the first). Read-ahead under swap pressure = the verb.
  - **Loop:** ready → playing → over. Score = gates threaded, best in localStorage. Ready overlay has
    the element legend; over screen has score/best/retry. **SPEED 0.92→0.74** (Alex's "bit fast").
  - Sim `lib/atherdash.ts` **36 tests green** (added: input-gating, gate cadence, pass/crash, resolve-
    once, score). Build clean, owner+public 200, **zero console errors** (browser MCP screenshot was
    glitching mid-session so the visual was Alex's live device, not an automated cap).
**Next:**
  1. **⚑ Alex playtest the loop:** is the read-ahead window fair (gate lead vs swap speed)? Gate
     cadence too sparse/dense? 4 lanes readable at distance, or do the blue/violet lanes blur? Knobs
     in `lib/atherdash.ts`: `SPEED 0.74`, `GATE_GAP_Z 0.6`, `LEAD_DIST`, `GATE_HIT_Z`, `NEAR_LANE_DX 96`.
  2. ✅ **Phase 4 juice/sfx — DONE early** (`d504e32`). If anything, tune amounts after the feel-test
     (shake too strong? chime too quiet? swap smear too subtle?).
  3. Phase 2 — the Dying-chase (a void wall creeping behind; a miss lets it gain) + maybe non-gate
     obstacles · Phase 3 — distance score + speed ramp + difficulty curve (tighter gaps).
  4. Phase 5 — canon `world/arcade.md` entry (still to do) + ✅ card art (`dcc1d43` — receding neon
     lane-corridor to a gate) + ✅ title screen (card.webp as a dimmed -z-10 backdrop on the ready
     overlay, same pattern as Ward/Updraft). Only the canon `world/arcade.md` entry remains for Phase 5.
**Decisions:** **slice-first paid off** (motion proven before mechanics). **4 fixed element-lanes**,
  spark stays neutral **Ather** (the player rides *through* the elements, isn't one). **Wrong lane =
  instant death** (Flappy-class pick-up-die-retry; the Dying-chase in Phase 2 will add a softer
  pressure layer). **Fake-3D** — single `persp(z)=(1−z)/(1+z·K)` shared by sim + render so they never
  drift. **Name = plain-word act** (no `-nyx`). **Swipe not tap** on mobile (lane choice, not fire).
  **Mobile UPDATED 2026-06-21:** swipe L/R = lane (unchanged); a **TAP now = jump** (was a no-op in
  play). Two-axis input = the Subway-Surfers formula; the element-read stays the primary skill.
**Files:** `atherdash/lib/atherdash.ts` (47 tests) · `lib/atherdash.test.ts` · `page.tsx` · `DESIGN.md`

### Driftling (#11) — 🟢 live · food-chain evolution → `/driftling`
*Last touched: 2026-07-03 — Daily + leaderboard wired (`aff36d2`); card art 07-01; shipped 06-26*
**Left off:** Shipped live + public. flOw/Feeding-Frenzy DNA: drift the cloud-ocean, eat smaller, flee
  bigger, **evolve in discrete tiers** off a swappable `LADDER` table. Wedge = **the first element you
  eat forks your branch** (Storm ≠ Earth ≠ Water ≠ Mana). Render = vector-glow ocean, camera-follow,
  element-coloured fish-glyphs with readability cues (threat = pulsing danger-ring, prey = bright spark),
  threat **chevrons** (off-screen-bigger arrow), evolve/fork **payoff burst**, tier/score/evolve HUD,
  best-score + run-summary death. **Touch joystick** (Alex: "felt good") + **slower growth** (FOOD_PER_SIZE
  1.3→0.95, evolve thresholds stretched). 27 sim tests green.
**Next:**
  1. **⚑ Alex device cold-play** — drift authority, eat/threat readability, the evolve-payoff moment,
     whether the nursery-start difficulty curve feels right. Knobs = consts atop `lib/driftling.ts`.
  2. ✅ **Card art DONE 2026-07-01** (`1d866ae`) — dreamlike cloud-ocean, element-colored fish-glyphs at varied sizes (kept element-agnostic — no named apex). In-game creature-art polish still deferred (Alex's taste).
**Parked:** **Rinn-kin element↔apex mapping** = a /magii canon gap (sim is element-agnostic so it doesn't
  block; canon re-skins via the LADDER/APEX tables only, zero logic). Jin's non-binding proposal in DESIGN.md.
**Decisions:** sim-first (oracle retuned for the **languid identity** — nursery start, threat exposure ramps
  with tier, median run reaches apex, deaths still live); element-AGNOSTIC core so canon is never the blocker.
  NOT Voranyx (that's slither-length + body-collision; this is discrete evolution tiers + size hierarchy).
**Files:** `driftling/lib/driftling.ts` (27 tests) · `driftling.test.ts` · `lib/sfx.ts` · `page.tsx` · `DESIGN.md`

### Squall (#12) — 🟢 live · defenseless bullet-hell → `/squall`
*Last touched: 2026-07-07 — music bed + George VO commentator (shared audio layer); 07-03 Daily + leaderboard*
**Left off:** Shipped live + public. Pure-evasion bullet-hell — **no shield, no shots**, brand-new
  "defenseless survival" mood. The void rains **5 telegraphed patterns** escalating with survival time
  (rain comb / side sweep / aimed fan / ring burst / rotating spiral), each fair (edge-entered or warned).
  **Tiny hitbox + graze** risk-reward (close passes bank score). Render = vector-glow storm, **telegraph
  readability** (aim = live dashed line, burst = expanding preview ring, spiral = rotating tick, all pulse
  toward fire), visible hot-white **hitbox pinpoint** + graze aura/flash, HUD, best-score + run-summary death,
  touch joystick / mouse-follow / WASD. 20 sim tests green.
**Next:**
  1. **⚑ Alex device cold-play (STILL never visually verified — extension needs a host-perm grant)** — pattern
     density/cadence, bullet speeds, telegraph warn times. Knobs: `fireDirector` gap, per-pattern `spd`,
     `RAMP_T`, `GRAZE_R` in `lib/squall.ts`.
  2. ✅ **Card art DONE 2026-07-01** (`1d866ae`) — lone cyan spark in a radial storm of violet bullet-streaks.
  3. ✅ **Daily + leaderboard WIRED 2026-07-03** (`39af949`) — endless/daily toggle, deterministic daily seed,
     today's-best track, share-result, DailyLeaderboard on game-over (dead overlay got the overflow-y-auto
     scroll-fix too), squall added to the API allowlist. Round-trip verified via curl. Feel still pending Alex.
**Parked:** —
**Decisions:** **#2-cabinet call: Squall over Pac-Man** at the time — Driftling is eat/flee/flip, Pac-Man is
  too (predator-flip), so Squall (no offense) gives the board real contrast. (Pac-Man later shipped anyway as
  Dewdrop.) Opening softened for a fair casual on-ramp (roomier gaps, slower early bullets, RAMP_T 115).
**Files:** `squall/lib/squall.ts` (20 tests) · `squall.test.ts` · `lib/sfx.ts` · `page.tsx`

### Dewdrop (#13) — 🟢 live · Pac-Man riff, Dewbear vs the Moglins → `/dewdrop`
*Last touched: 2026-07-03 — Daily + leaderboard wired (`aff36d2`); 4-way D-pad + card backdrop 07-01; tuned 06-26*
**Left off:** Shipped live + public + tuned. A wild **Dewbear** hoovering **dewdrops** in the collar-Moglins'
  burrow-warren; the 4 hunters = the Moglins (**Burr**=chaser, **Bramble**=ambush, **Nettle**=flank,
  **Hemlock**=overseer + top hat); power-pellet = **wildbloom** → collars snap, Moglins **deflate** + flee
  (the books' deflate payoff = the predator-flip). Render = phosphor burrow, chomping dew-blue Dewbear, 4
  distinct Moglins (deflate + eyes-home states), joystick+WASD, lives, win/lose + best-score, sfx. 20 tests.
  **Alex cold-play → tuned:** maze 19×21→15×17 (bigger cells), speeds slowed (PLAYER 4.0 / GHOST 3.5), +
  fixed a real FP movement bug (exact-step skipped centre-decisions → added 1e-6 epsilon to `advance()`).
**Next:**
  1. **⚑ Alex cold-play the D-pad** — replaced the deck stick with a 4-way D-pad (`1d3fd85`, his call: narrow
     hallways + stick felt awkward for timing turns). Tap-to-turn, heading persists. **If still too hard after the
     D-pad**, the difficulty levers are: maze cell size / corridor width (`lib/dewdrop.ts` maze gen — currently
     15×17) + ghost-vs-player speed gap (PLAYER 4.0 / GHOST 3.5) + scatter/chase waves + wildbloom duration.
     (Held off widening the maze so the D-pad gets judged first.)
  2. **Maze art/layout** = a later design pass (Alex's taste). Current maze is a guaranteed-connected
     placeholder (hand-authored maze was sealed/disconnected → generated by construction).
  ✅ **Card art DONE 2026-07-01** (`4499727`); **start-screen backdrop DONE** (`1d3fd85`, opacity 0.45 + scrim).
  **NEW reusable: `ArcadeControls` gained a `dpad` mode** (cross of 4 square keys) — available for any future direction/maze game.
**Parked:** —
**Decisions:** **Magii ruled it onto canon** (`athernyx/CANON/game/dewbear-maze.md`, committed `0c15ae6`) —
  Alex named it **Dewdrop**. The Pac-Man riff was Jin's pick of the floated classics (predator-flip verb the
  lineup lacked; 4 hunters = 4 elements/Moglins; phosphor maze = cheap art). Was the **working title
  `pacmaze`** sim before the canon weld (`f9cdbe1` → Dewdrop `fdeb8bc`); `pacmaze/` dir is gone (renamed).
**Files:** `dewdrop/lib/dewdrop.ts` (20 tests) · `page.tsx` · canon `athernyx/CANON/game/dewbear-maze.md`

### Vault (#14) — 🟢 live · auto-runner, a mote crosses the greying → `/vault` *(BIG feature arc 07-07; MAP EDITOR 07-08)*
*Last touched: 2026-07-08 — MAP EDITOR phase 3: dirty indicator + VERTICAL LAYERS (`9cef9cb`). Phases 1-2 same day. 07-07 arc: Story → audio → fuel/hearts → ladder.*
**★ 2026-07-08 — MAP EDITOR, phase 3: DIRTY INDICATOR + VERTICAL LAYERS (jin-cc, `59a9fc1`+`9cef9cb`, pushed, live).** Two things:
  1. **Dirty-vs-live indicator.** The slot badge reads `● unsaved edits` (amber) when the editor differs from what's published, `● live · matches` (green) when in sync, `procedural · not published` (grey) otherwise; Save button dims when clean+live, shows `•` when there are changes. Compares gameplay fields only (seed is cosmetic for authored levels).
  2. **★ VERTICAL LAYERS (Alex's direction — maps stack routes ABOVE the frame; player sees a sliver).** A **render-only vertical-follow camera** (`camY` on `World`, eased in `render()`): pulls up toward the light when it climbs above ~y34, clamped so it NEVER scrolls below the normal frame. **Zero-regression by design:** procedural content (tops ≥ TOP_MIN=96) → `camLo=0` → `camY` stays 0 → Endless/Daily + every existing published level are byte-identical; the camera only engages when a platform is authored up in the headroom. Segs above TOP_MIN render as **floating slabs** (thin ledges, not columns to the floor). New const `WORLD_CEIL=-260` = the authorable ceiling (~1.3 screens of headroom). **Editor** now shows the full authorable height with `frame top` / `normal ceiling` / headroom guides, and platform/mote/stair clamps raised to WORLD_CEIL so you can build up there. **Reachability:** a ground hold-jump rises ~174px; a stomp banks a double-jump — so alt routes into the headroom need intermediate stepping platforms (that IS the climb). **⚠ Alex published his own hand-edited First Light L1 (`a1-l1`) — do not delete/overwrite it.**
  - **▶ NEXT (phase 4, Alex's hands):** author a tall level + feel the camera; tune the camera lerp (0.18) / vertical offset (0.6·VH) + the editor's default vertical framing to taste; slot thumbnails; batch-publish. Still open: 07-07 device-tune knobs (level lengths, deep-area a5/a6 softening).
  - **⏸ PARKED 2026-07-08 (Alex):** map-editor thread paused pending a **drawing tablet** — level-drawing UX will be far better with one. Everything is shipped, live, and clean (engine authored-level support, ladder editor, Save-to-Live pipeline, dirty indicator, vertical-layer camera + tall authoring). Nothing half-built; resume by opening `/vault/dev` and picking up phase-4. This is a deliberate pause, not abandoned work.
**★ 2026-07-08 — MAP EDITOR, phase 2: LADDER EDITOR + SAVE TO LIVE (jin-cc, `5e58ae9`, pushed).** The editor now edits the REAL ladder, not one scratch level. **Area × Level dropdowns** pick a slot; each loads **scratch → live → a procedural seed** (fresh slots auto-seed from `bakeLevel(levelSeed,levelCfg)` so you start from a plausible layout). **Reroll + Test-Play use the slot's `levelCfg`** (its real difficulty band / speed / hazards) — no more generic ENDLESS_CFG. **"Save to Live"** publishes the slot's `AuthoredLevel` to `public/vault/authored-levels.json` (a JSON store, keyed by `authoredKey(a,i)`=`a3-l7`) via `POST /vault/dev/save`; served instantly by `next start` with **NO rebuild**. The game fetches that store on mount (`page.tsx`) and plays `makeAuthoredWorld()` for any published slot, else procedural — so Endless/Daily stay procedural, Story slots go authored only where published. **Load Live** (pull the published copy back to edit) + **Unpublish** (revert slot to procedural) + **● badges** on published slots in the dropdowns. Per-slot scratch autosave (`vault.dev.slot:${key}`). Verified: build clean, backend round-trip + live-serve + browser publish loop; also gitignored/untracked `.shimmer-backups` (−43k tracked lines).
  - **▶ NEXT (phase 3): ✅ DONE (dirty indicator + vertical layers — see phase-3 entry above).**
**★ 2026-07-08 — MAP EDITOR, phase 1 (jin-cc, `64821f8`, pushed).** Vault was procedural-stream-only (a "level" = fixed seed + goalDist, nothing hand-placed). Introduced **authored levels**: `AuthoredLevel` data + `bakeLevel()` (snapshot the generator to a finite span) + `makeAuthoredWorld()` (play it back, streaming off, finish at `end`); `tick()` skips `generate()` when authored; `generate()` gained a cull toggle. 14 engine assertions (finite/no-stream/winnable/deterministic) in `vault.authored.test.ts`. **Editor `/vault/dev`** (desktop, noindex, self-contained — no game-page changes): **seed-then-tweak** (Alex's pick) — Reroll bakes a procedural level, then draw platforms / drop motes+foes+spikes / move / erase / set finish; **Test Play** runs the real engine in-place (blockout render — skin is cosmetic, layout reads clearer); Export/Import JSON; localStorage autosave.
  - **▶ NEEDS ALEX DESKTOP PASS:** the editor feel (place/drag ergonomics, zoom, test-play). **Design decision (mine, confirmable):** Endless/Daily STAY procedural (that's "the crossing without end"); only the **Story ladder** goes authored.
  - **▶ NEXT (phase 2): ✅ DONE 2026-07-08 (see phase-2 entry above).** Authored levels wired into ladder slots (per-slot picker + Save to Live + per-area cfg in test-play). Device-tune knobs from the 07-07 arc still open.
**★ 2026-07-07 ARC (one long session, all pushed) — Vault went from a bare score-runner to the most-developed cabinet:**
  1. **STORY MODE (the crossing, canon-ruled).** Magii ruled the crossing is **eternal — no arrival** (`game/vault.md`,
     07-07): Story = the myth told as a **descent** into the greying, seamless handoff to Endless. Built the sim to be
     movement-aware (per-run difficulty band + hazard toggles + goal), Endless byte-identical. 6 movement names blessed
     by Magii (First Light · The Tears Widen · The Grey Wakes · The Rooted Grey · The Dying Gains Ground · The Grey Heart).
  2. **AUDIO (see the cross-cutting AUDIO LAYER section).** Own music bed (`vault/music.ts`) + cozy George VO commentator
     (`vault/vo.ts`, 15 clips) on the shared MusicBed + VoBank; ducking, mute-synced, one shared AudioContext.
  3. **★ MOTES FUEL THE LIGHT + HEARTS (Alex's design, forgiving/drowning model).** The mote now carries **HEARTS**
     (resilience) + **FUEL** (its lit-ness). **Void/gaps stay lethal** (platforming teeth); **foes/spikes cost a heart**
     (+1s invuln), not instant death; **fuel drains as you carry**, **motes refill it** (score AND fuel); run dry → the
     greying pulses, every 3rd tic takes a heart; 0 hearts = the light guts to grey. The **light's size+brightness = the
     fuel gauge** (bright/big fed → small/dim/grey starving), sprites +35%. HUD = hearts pips + fuel bar. 37/37 physics tests.
  4. **★ AREAS × LEVELS LADDER (Alex's direction — the current shape).** Story is now a **level ladder**: each **AREA**
     (=a look + hazard set + difficulty band; the 6 movements) holds **levels** you beat linearly to advance. **10/area now,
     framework scales to ~100** (bump `LEVELS_PER_AREA`). Levels are **procedural** — `levelCfg(a,i)`+`levelSeed(a,i)`, a
     short **fixed-seed** run whose difficulty steps floor→ceil per area, LENGTH grows across the ladder (~35s early →
     ~83s late). **Two-tier trail**: areas descent → tap an area → its 10-level grid → play (verified live at mobile width).
     Per-area progress persisted (`vault.progress.v2`), linear unlock.
  5. **BUGS FIXED same session:** platform **fall-through** (swept collision — only bit on real-device frame drops, the
     60fps oracle never saw it); VO **carrying-spam** (fired every ~1.3s → ~7-8s); end-of-match + trail **mobile layout**
     (result screens + trail lifted OUT of the landscape letterbox into full-height panels — buttons were clipped/hidden
     under the controller deck).
**Left off (2026-07-07):** the areas×levels ladder is live and playable end-to-end; Alex device-tested the fuel/hearts
  loop ("pretty good") + the two-tier trail. Difficulty retuned for the long format (fuel drain 5.5→4.0, sparser hazMul,
  length cap ~83s). `vault.levels.oracle.ts`: gating + fair-start + within-area + descent all green; a1/a2 ~99%, a3
  75→41%, a4 35→9% — **deep foe areas (a5/a6) read near-0 for the hop-only bot (can't stomp) = explicitly device-tuned**.
**Next (ranked — all feel/content, Alex's hands):**
  1. **Device-tune the ladder:** level lengths across the 30-45→90s ramp; soften the deep areas (a5/a6). Knobs in
     `lib/vault.ts`: `AREAS[]` (diffFloor/Ceil/hazMul), `levelCfg` targetSec, `MAX_HEARTS`/`FUEL_DRAIN`/`MOTE_FUEL`/`GRAY_TIC`, sprite sizes.
  2. **Per-area LOOKS** — areas currently share the render; each `AREAS[a].accent` is set but rich per-area theming
     (palette/backdrop per stretch) is future work (Alex: don't go crazy on maps until enemies/obstacles improve).
  3. **Enemies/obstacles glow-up** — Alex flagged these "need a lot of work"; the level framework is built to absorb
     more/better hazards without touching structure.
**Parked (Alex, later):** ⭐ **end-of-run STARS** for the flame's remaining intensity (a mastery layer riding on fuel-at-win).
**Decisions:** crossing is **eternal**, told as a descent (canon). **Void lethal / grey forgiving** risk split (leaps keep
  teeth, hearts absorb the grey). Levels **procedural + fixed-seed** (learnable, and 100/area is a number not 100 maps).
  Areas = looks; the whole thing stays sim-first + oracle-guarded.
**Files:** `lib/vault.ts` (sim + AREAS/levels + fuel/hearts + progress) · `lib/vault.test.ts` (37) · `lib/vault.levels.oracle.ts` ·
  `Trail.tsx` (two-tier) · `page.tsx` · `music.ts` · `vo.ts` · `scripts/gen_vault_vo.py` · canon `athernyx/CANON/game/vault.md`

### Anima — 🔬 tech demo · procedural character, ZERO art files → `/anima`
*Last touched: 2026-06-21*
**What it is:** a proof-of-concept that a *living* character can animate with **no sprites, no painted
  frames** — a 2-bone IK skeleton + procedural walk gait + breathing idle + a verlet cloak that lags and
  flows. Every pose is computed, not drawn, so one rig replaces N painted frames. Click/tap = walk; toggle
  the skeleton to see the rig. Linked from the Room.
**Why it's on the board (not a game — but load-bearing):** it's the **direct answer to "art is the blocker"**
  — the recurring deferral across every game ("placeholder pill, real art is Alex's taste/hands"). Procedural
  animation is the **build-systems-not-art** thesis made literal. If it holds up, it's a path to characters in
  Shimmer / the arcade without an art pipeline.
**Next (open, not scheduled):** decide if it graduates — does a procedural character get used in a real game
  (Shimmer overworld? a cabinet mascot?), or stay a demo. Alex's call; no build pending.
**Files:** `anima/page.tsx` (self-contained, ~15KB)

## 🧭 Catalog direction — narrative meta (2026-06-12, Alex)
Gardenscapes insight: the puzzle is the currency, the **story you unlock is the draw.**
Our edge = a deep canon already built. Each game = a system/region of one "wake Aeterna"
restoration arc (Rekindle=conduits, Mana'nana=gardens, Ward=spires…), puzzles unlock
canon. **Take the story-unlock, NOT the lives/energy/IAP** (against Nolmir's anti-cash-grab
thesis). Must stay expressible in vector-glow (a dark network lighting up, not painted
scenes). Lore routes through /magii for canon safety.

## 🌱 Queue — what's actually next *(cleaned 2026-06-14: kept only what adds a mechanic the 7 don't)*
- **Gravitar** → ✅ **BUILT 2026-06-15** (live, `/gravitar`). Graduated to its Shipped block above (#9).
- **Tempest** *(lead)* — hold a rune-well as the void climbs the lanes. Distinct *input* (positional
  lane-hold) but the same job as Ward (hold off the void) — second priority for that reason.
- **Rune-weaving** — trace runes to channel mana. A new input mode (gesture/tracing), runes
  are deep canon, distinct enough from Rekindle (draw vs rotate).

## 💡 Fresh riffs *(2026-06-14 — stock the queue, each adds a mechanic the 7 lack)*
- **Driftling** *(food-chain evolution)* — flOw / Feeding Frenzy / Deeeep.io DNA. Start tiny
  adrift in the **cloud-ocean** (canon!), eat smaller, get eaten by bigger, tier up into a
  bigger form. NOT Voranyx — that's slither-length + body-collision; this is discrete
  **evolution tiers** + an eat-or-be-eaten **size hierarchy** (the drama is the moment you
  finally outgrow the thing that hunted you). Wedge: the **first element you eat forks your
  evolution branch** (Storm-line ≠ Earth-line). Finally earns the cloud-ocean a game. Canon
  ladder needs a /magii pass (real Athernyx creatures up the chain, not generic fish).
  **Pinned (Alex 2026-06-16):** the canon ladder = the **Rinn-kin "fish"** (`athernyx/CANON/world/rinn.md` / `manamals.md`) — a rich existing list, so lore is NOT the blocker; the only reason to defer is mechanical distance from Voranyx. Revisit once the catalog has filled out more.
- **Ather Dash** *(lane-runner)* — Subway-Surfers loop: run through the Ather, dodge obstacles,
  reach the next gate. **The twist that saves it from being Updraft-with-lanes:** the lanes are
  **elements** (Storm/Earth/Water/Mana) and each gate is tuned — you must be in the *matching*
  lane to pass it. So it's **read-ahead** (spot the gate's element, swap in time) under dodge
  pressure, not pure reflex. Ours + canon (the 4 elements); Updraft is pure timing, this is
  positional anticipation. *(replaced Shardfall, which was Asteroids with no twist of its own.)*
  → ✅ **BUILT 2026-06-17** (slice, coming-soon, name **Atherdash**). Spec graduated to its
  Shipped roadmap block above (#10). Slice feel-gate passes in-browser; pending Alex's real-device call.
- **Squall** *(bullet-hell dodge)* — pure evasion, no offense. Read the void's projectile
  patterns, weave through, score = survival time. A brand-new **mood**: defenseless survival.
  Vector-glow bullet patterns are gorgeous and cheap to draw.
- **Lucernyx** → ✅ **BUILT 2026-06-15** (playable slice, coming-soon). Spec graduated to its
  Shipped roadmap block above (#8). The full original spec lives in git history (this entry) +
  canon at `athernyx/CANON/world/mother.md`.
- *Bench (not committed):* **Breakout** (bounce an Ather mote to shatter the void-crust);
  **Orrery pinball** — held, overlaps Gravitar's physics.

## 🕹️ Classics to riff into the Ather *(2026-06-25, Alex — refueling the ammo, not committed)*
> Alex's instinct: take a classic, weld it to canon, add OUR twist. Same recipe the whole catalog
> was built on. Run each through the filter (real gimmick · canon-parallel · light on art) before it
> graduates to the Queue.
- **Pac-Man riff → ✅ SHIPPED LIVE as DEWDROP (2026-06-26, `fdeb8bc`)** — `ather.games/dewdrop`, public.
  Magii ruled it onto canon (`athernyx/CANON/game/dewbear-maze.md`): a wild **Dewbear** hoovering
  **dewdrops** in the **collar-Moglins' burrow-warren**; the 4 hunters = the Moglins (Burr=chaser,
  Bramble=ambush, Nettle=flank, Hemlock=overseer+tophat); power-pellet = **wildbloom** → collars snap,
  Moglins **deflate** + flee (the books' deflate payoff = the predator-flip). Alex named it **Dewdrop**.
  Render: phosphor burrow, chomping dew-blue Dewbear, 4 distinct Moglins (deflate + eyes-home states),
  joystick+WASD, lives, win/lose + best-score, sfx. 20 tests green. **Maze art/layout = later design pass.**
  ▶ Alex cold-play → tune speeds / wave timings / fright duration (`lib/dewdrop.ts` consts).
- *(historical)* Pac-Man riff — maze chase + the predator-flip the lineup lacked.
  ✅ **SIM-FIRST SHIPPED 2026-06-26 (`f9cdbe1`):** `src/app/pacmaze/lib/pacmaze.ts` (working title
  `pacmaze`) — Pac-style movement (queued turns/walls/tunnel), ather-motes→win, **rune-bloom flip**
  (combo 200·2^n, eyes rush home), **4 elemental shades** w/ distinct AI (water=chase, storm=ambush,
  earth=flank, mana=hound-then-peel) + scatter/chase waves, lives+reset. 19 tests green (incl. flood-fill
  connectivity). Maze = guaranteed-connected pillar lattice placeholder; real maze art/layout = later pass.
  🚩 **CANON GAP — the game's NAME is a /magii call** (Alex bridges to Magii). NOT registered / not live;
  render is gated on the name. Canon weld: 4 shades = 4 elements, motes = ather, bloom banishes the void,
  setting = the Silt / Voranyx caverns.
- **▶ STRATEGY (Alex, 2026-06-26): TWO more new cabinets, then STOP adding — improve the lineup.**
  ✅ **FULFILLED:** Pac-Man (this) shipped as **Dewdrop** + the **Mario-style auto-runner** is **Vault**
  (working title `bound`; sim done `7503b55`, canon ruled, render is the last task — see its Shipped block
  #14). After Vault's render lands,
  the door on new cabinets is CLOSED → pivot fully to **polishing the existing lineup** (PENDING-ALEX
  feel-lap, Seedfall ⭐ first, cabinet dial, leaderboard-overlay verify, mobile sweep). Don't pitch more
  new games until the lineup pass is done.
- **Bricks / Breakout riff** *(cheap + fast, NEEDS its wedge)* — was already on the bench
  ("bounce an Ather mote to shatter the void-crust"). Cheapest art of anything we'd build (paddle +
  ball + blocks = vector heaven). Risk: it's the classic with the *least* twist of its own → would be
  filler without a real gimmick. **The wedge that saves it: the mote takes on the last element it
  touched**, so you chain-break matching-element bricks (plugs into the shared element system). With
  the wedge = a legit palate-cleanser cabinet (Updraft tier); without it = filler. Canon = sealing
  the void-crust over the Silt.
- **Auto-run platformer riff (the "Mario, scoped") → ✅ BUILT as VAULT (sim, 2026-06-28 `7503b55`; working
  title `bound`).** The overlap tension was solved exactly as flagged: Vault earns its slot with **platformer
  geometry** none of the others have — **variable jump arc** (shape it, don't just fire), **elevation**
  (ledges to read-ahead + land on), **stomp + bounce-combo**. **Canon ruled** (`vault.md`, name LOCKED —
  a mote crosses the greying; Updraft's sibling). Graduated to its Shipped block (#14); render = the only
  remaining work. The LAST sanctioned new cabinet (closes the "two more" strategy).

## ⚰️ Killed — covered by a shipped game *(don't re-pitch)*
- **The Dive** (fall through the cloud-ocean, dodge-and-collect) → vertical-flight mood
  taken by **Updraft**. Best canon hook of the three, but it's covered.
- **Spirit garden** (tend a plot, spirits bond over time) → **Seedfall**'s persistent garden.
- **One-screen last stand** (real-time blight defense) → that *is* **Ward**.

## 🅿️ Parked
- **The Cloud-Ocean Angler** — fishing the clouds. Said aloud it didn't hold: thin
  gimmick, heavy art, not truly canon-parallel. Plan kept at `src/app/angler/DESIGN.md`.
