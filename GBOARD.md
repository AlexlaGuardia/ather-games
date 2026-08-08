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
> - [~] **Driftling — ENDLESS OCEAN redesign, foundation shipped 2026-07-11 (`aacbee2`).** Alex: map too small + invisible borders; pivot to an endless ocean you journey RIGHT through as a 3-min time-attack ("how deep can you get"). Done: fixed 2400x1800 box removed (borders gone); danger keyed to DEPTH (depthTier(x), spawns sized by where they appear — shallows tiny → deep giants, proven avg 0.3→5.4); endless right + shallow-edge + vertical band; 3-min clock (MATCH_TIME) ends run OR eaten; score = maxX depth + growth; water darkens shallow-teal→black-abyss; clock HUD. **LAYER STATUS (corrected 2026-07-24, jin-cc):** (1) Magii canon pass on the ocean zones + Rinn ladder — still OPEN, /magii call. (2) schools of fish (boids that scatter from predators) — ✅ ALREADY BUILT (sim `spawnSchool`+`flock`, renders generically; the old NEXT was stale). (3) patrolling predators (telegraphed, Updraft agency rule) — OPEN, the next AI build; today threats just gently home + pulse a red danger ring, no distinct cruise→telegraph→lunge hunter yet. (4) **the drift current — ✅ SHIPPED 2026-07-24 (`current(x,y,t)` flow field advects player + all creatures; MOTES streak along the flow so it's readable; peak push < 40% of BASE_MAXV = always fightable; +4 tests, 31 green).** Knobs atop `lib/driftling.ts` (`CURRENT_STRENGTH`/`_RIGHT_BIAS`/`_WAVE_*`/`_EVOLVE`) — Alex feel-tune. **Left off (2026-07-24, jin-cc): drift current + a feel-pass + a background all landed this session, Alex confirmed "much better."** (a) VISIBLE world bounds + soft-edge cushion (`EDGE_SOFT`/`EDGE_PUSH`) — surface/seafloor/shelf render + slide into view as you near them, you glide to a stop instead of slamming, creatures honor the same bounds (killed the "fish pass through walls I slam" asymmetry). (b) Growth slowed `FOOD_PER_SIZE` 0.95→0.45 (~2× longer climb). (c) BACKGROUND (`9f65d0f`): god rays from the surface (sway+fade with depth) + far parallax silhouettes (kelp/reef shallow → jagged spires abyss), dim + behind the glow; `RAYS`/`BG`/`rayStr` atop page.tsx to taste. **Next build = layer 3 patrolling predators (cruise→telegraph→lunge, Updraft agency rule); today threats only gently home + pulse a red ring.** Sim skin re-skins freely (reads indices). *Last touched 2026-07-24.*
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

## 🔑 Cross-cutting — ACCOUNTS · PARTY · PRESENCE (the identity layer, SHIPPED 2026-07-25, jin-cc) · *Last touched 2026-07-25*
> **What it is:** the layer three features were all waiting on — friend visits, trusted arcade
> scores, and playing the Magii card game with people. `player_id` was client-claimed, so every
> trust decision downstream ("whose garden", "whose score", "who is at my table") was theatre.
> A server vouches now.
>
> **Shipped, all live on :3200:**
> - **Accounts (Phase A, `38c08eb`)** — Google OAuth, 4 routes, httpOnly `ather_session` HS256 JWT
>   the FastAPI WS server can verify with a shared secret. Accounts DB is **`node:sqlite`** (core in
>   Node 24) — the spec's `better-sqlite3` was dropped: same sync API, zero deps, no native build.
>   `/api/shimmerfile` + `/check` are real. Arcade leaderboard identity now comes off the session,
>   so a signed-in score cannot be posted as someone else.
> - **Privacy (`a51fce9`)** — `/privacy` + a REAL account delete (`DELETE /api/auth/account`).
>   **No cookie banner, deliberately:** every cookie here is strictly necessary and there is zero
>   analytics/ad/third-party. A banner is for tracking. ⚠ **That page is written to match the code —
>   the day this site gains analytics, server-side garden saves, or stored chat, it is false.**
> - **Account widget (`53b20e0`)** — one pill whose LABEL is the state (Sign in → Claim name → your
>   username), in `_components/` so any page's corner cluster can take it.
> - **Friends (Phase B, `7725076`)** — `/api/friends`; the panel existed as a stub and was never
>   mounted anywhere, now a modal off the widget. Simultaneous adds CONVERGE (if they already asked
>   you, add accepts instead of opening a crossed second edge).
> - **Party goes SITE-LEVEL (`5754050`)** — `@/lib/party`, above the games. One group carries world →
>   card table, so **per-game invite UI is unnecessary**: Sit Down will just read the party. An
>   invite link is consumed on ANY page and stripped from the URL. Roles kept separate so they cannot
>   drift: **PARTY** = the group · **FRIENDS** = the address book · **CODE/LINK** = the fallback
>   address for someone with no account.
> - **Presence socket (shimmer-server `b387ea5` + `e8cfe40`)** — `/presence`: account id → sockets,
>   no instance/position/matchmaking, so a friend reading the bookstore is reachable. Click a friend
>   → they get a toast → Join drops them into your party code.
>
> **★ Two finds worth keeping:**
> - **The impersonation test caught a live leak.** Trust was tracked per ACCOUNT while sockets are
>   per CONNECTION, so an unverified socket claiming a signed-in user's id joined their bucket and
>   was handed their invite. Anonymous sockets are now filed under an `anon:` key that cannot collide
>   with a real id — unaddressable by construction, not by a check someone must remember.
>   `test_presence.py` guards it.
> - **The owner-tool gate matched `/api/shimmer` as a bare prefix**, which also swallowed
>   `/api/shimmerfile` — the username picker would have 403'd for every non-owner. Boundary is
>   `/api/shimmer/` now.
>
> **Left off:** the chain works end to end for two accounts; Alex signed in on a second account and
> added a friend. **✅ The payoff landed 2026-07-29 — see the Magii block below: Sit Down reads the
> party and seats them, regulars hold the empty chairs.** **Next:** ephemeral
> party chat on the same socket (relay only, never stored — persistent DMs would need storage,
> retention, a real BLOCK the friends model has none of, and would make `/privacy` false).
>
> **⚠ ONE UNVERIFIED LINK:** does the `ather_session` cookie ride the WS upgrade through the
> Cloudflare tunnel? Needs a real signed-in browser — load `/room`, then
> `pm2 logs shimmer-server | grep presence+` and look for `trusted=True`. If false, mint a
> short-lived signed ticket from `/api/auth/session` and pass it in the query; nothing else changes.
>
> **⚠ Google project:** ather.games shares project `874025740228` (ONE consent screen) with the
> cockpit, and their needs CONFLICT — ather.games wants In-production for public sign-in, the planner
> needs the SENSITIVE `calendar.events` scope which in production requires verification. **Publishing
> the shared project breaks the planner.** Give ather.games its own project, then publish it freely
> (non-sensitive scopes only). Until then, a second tester must be added as a test user.

## 💰 Cross-cutting — THE MARKS ECONOMY (one currency across all of ather.games)
> **The vision (Alex, long-standing): one global Marks wallet for every game, tying the arcade into one world.** Ruled into canon 2026-07-12 (/magii + Alex, `athernyx world/rune-hold.md` › The Hub): **Marks = the realm's copper coin** (already in the athernyx glossary — NOT invented). The whole ather.games hub is canonically **Rune Hold** (an outdoor town center, doors = storefronts): 🍺 **Kindled Mug** → the games (EARN marks) · ✧ **Spirit Corner** → Shimmer (Greg's Ather-Bubble gate, canon-literal "a personal shimmer") · 📖 **Eyuun's Bookstore** → books/lore (the 07-04 audiobook player) · 🏪 **The Passage** → the market (SPEND marks; seed of the canon Grand Exchange) · 📌 **Notice Board** → news. Register = the enduring Year-1500 Rune Hold; the Year-600 occupation stays STORY.
> **✅ Phase 0 SHIPPED 2026-07-12, jin-cc (`30b6829`, built + live :3200, pushed — "NOT pushed" corrected 2026-07-16; it reached `origin/master` the same day under later commits):** `src/lib/wallet.ts` — the global Marks store (per-browser localStorage; `getMarks/addMarks/spendMarks/setMarks/walletExists` + a `MARKS_EVENT` on change for live HUDs; non-negative floor). **Folded Nolmir's marks into it:** the wallet is now the source of truth and `nolmir/lib/host.ts` mirrors it on load/save, so all ~15 `host.marks` call sites stay untouched; a legacy Nolmir save's marks migrate into the wallet exactly once. 23-assertion `wallet.test.ts` (math + overspend guard + event hygiene + the migration contract, via a window/localStorage shim); 111 Nolmir tests + canon still green. Live-driving the HUD blocked by the frozen-renderer flake on canvas pages — test-proven, wants an Alex device pass.
> **⚠→✅ RECONCILIATION 2026-07-12, jin-cc (`5e4ad71`, pushed, live):** caught that a shared marks wallet ALREADY existed — `use-wallet.ts` (keyed `ather:save:wallet`, used by the **Magii card game + Shimmer**). The Phase-0 `lib/wallet.ts` had made a SECOND store (`ather.marks`) for Nolmir + the readout — currency was SPLIT in two. Fixed: `lib/wallet.ts` now backs the same `ather:save:wallet` key + `{marks,totalEarned,totalSpent}` shape; `use-wallet.ts` is a thin wrapper over it (API-compatible, `loading` contract preserved so the card game's WELCOME_STAKE never re-seeds). **Reverted the Nolmir fold** — Nolmir's ✶ are INTERNAL (it mints marks passively/idle; as global marks that's an uncapped 2nd faucet fighting the card=faucet economy). Verified LIVE on real data: card game + SiteNav readout both read the same 393 from `ather:save:wallet`; old key gone. wallet.test.ts → 27 assertions (legacy-blob compat + totals). **The economy design (Alex):** card game = the FAUCET (clear double-down → flat: win `10 + 0.3×score`, else 10; avg win ~150 → ~55 marks); arcade games = SINKS (cost 1-5 marks/play, reward = leaderboards + later cosmetics); Nolmir = its own internal machine; welcome-stake 100 + guaranteed ≥10 floor = no lockout.
> **✅ Phase 1 (HUD) SHIPPED 2026-07-12, jin-cc (`c0d4dfc`, pushed, live):** shared **Marks readout** in the SiteNav drawer (under the breadcrumb) — one purse across every game. Subscribes to `MARKS_EVENT` + the storage event at the always-mounted component level (outlives the drawer open/close). **Verified live on ather.games** (grimoire): renders `✶ N marks`; dispatching the event updated the readout 0→777 in real time.
> **✅ Phase 2a (the FAUCET) SHIPPED 2026-07-12, jin-cc (`28e115b`, pushed, live):** Magii card game — cleared double-down entirely (sit down → deal → play straight through), flat prize on game-over: **win → round(10 + 0.3×score), everyone else → 10.** No ante, no forfeit; welcome-stake 100 + 10 floor = no lockout. Removed DoubleDownModal/ANTE/wagerRef/setDoubleDown. Verified live: Sit Down goes straight to the board, no stakes modal. (Full game-over payout wants a device playthrough to see +55ish/+10 fire — pairs with mobile testing.)
> **▶ NEXT (build order):** ~~(1) HUD~~ ✅ · ~~reconcile~~ ✅ · ~~(2a) card faucet~~ ✅. **(2b) arcade SINKS** — charge 1-5 marks/play; DESIGN OPEN (Alex): per-game price, where the charge lands (page-load vs a "sit/insert-coin" start vs per-run), and the broke-player UX (free-play-no-leaderboard vs redirect-to-earn vs block). **(3)** Passage market / cosmetics sink. **(4)** re-skin Room walls as Rune Hold storefronts.
> **✅ FIXED — Magii MOBILE cards cut off (2026-07-12, jin-cc, `f4180d8`, pushed, live):** the fan's `w-full` chain was broken above it (player-area wrapper + PlayerArea root lacked `w-full`), so it measured up to `max-w-[660px]` even on a 390px screen and the board's `overflow-hidden` clipped the last 2 cards (+ slid the discard pile off the left). Chained `w-full` to the fan → `fanW` = real board width → step-math fits all 8. Verified 8/8 visible at narrow viewport, no overflow. Also hid the redundant header 'Magii' title on mobile where the back-to-room pill overlapped it. — wire a marks earn into ONE score-chase game (scaled to score, capped) to prove the earn loop before rolling across the arcade — balancing is the real work, start with 2-3 games not all 13. (3) a **sink** — the Passage market surface (v1 sink) and/or Shimmer spend. (4) re-skin the Room's walls as Rune Hold storefronts → grow into the town square (big Jin build, stageable). **Design open (GBOARD, not canon):** per-game payout curves; what the Passage v1 sink actually sells.

## 🎨 Cross-cutting — PRE-RENDERED 3D ART (render-to-sprite, PROVING 2026-07-21, jin-cc)
> **★ OPEN PIPELINE BUG — Meshy GLB props look "full of cracks" (Alex, 2026-07-24). `glb_optimize.py` is MISSING A
> SMOOTHING STEP.** Diagnosis: the optimizer decimates (e.g. 489k→6000 tris) then exports straight to Draco with **zero
> normal handling** — no `shade_smooth`, no auto-smooth, no `calc_normals`. So every low-poly facet keeps a hard normal
> and reads as a seam/crack across curved surfaces. Affects EVERY asset from this pipeline (gun_bench, the 5 stations),
> so it's a one-place fix. **NEXT{Shimmer render pipeline: add a smoothing step to `tools/render/glb_optimize.py` after
> decimate, before export — recalc normals outward + shade-smooth with an AUTO-SMOOTH angle (~30-40°) so curved faces
> smooth while genuine hard edges (the bench corners, a barrel) stay crisp. Blender 4.2: `bpy.ops.object.shade_smooth()`
> + the "Smooth by Angle" modifier / `shade_auto_smooth`, applied per-object. If literal GAPS remain after that, bump
> Draco position-quantization bits in the export (default ~14 can split welded verts). Re-run on gun_bench.glb + the 5
> stations to fix them all at once. This is the 'smoothing step' the assets have been missing.}**
> **✅ ASSET #2 + `/picaso` AGENT CODIFIED (2026-07-21, jin-cc).** Stood up the render-to-sprite pipeline as a reusable
> **agent** (`.claude/agents/picaso.md`). The proven loop: grill → canon-gate → bpy producer → headless render →
> **look-at-the-PNG-and-critique** → iterate craft alone → STOP for identity/canon calls → hand sprite to the sprites lane.
> Boundary: material/lighting/camera = picaso's call; the identity element (a sigil, a silhouette that becomes a locked
> ref) = Alex's eye. **First hit through the agent — THE MARK coin family:** one struck bpy model → 3 metal+wear passes
> (copper Mark / silver Crown / gold Sovereign), milled edge, denticle legend band, Bind seal struck as a **barred
> gate-rune**. Built against the LOCKED canon brief `athernyx/CANON/design-briefs/coin-family.md` (look ruled by /magii
> same day; renders recorded back as the locked ref). Producer `tools/render/coin.py` → `public/coins/coin-{mark,crown,
> sovereign}.png`. **NEXT: wire the coin into the Marks HUD/inventory (sprites lane) + move the render node to elitedesk
> so asset windows can tag-team renders without OOMing the game server.** Assets are now a tag-team lane (hub + window 2).

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
> - **HIT:** Vault · grey void-spawn foe (`foe-void.png`) · **blight-thorns** (`spike-thorns.png`, 3 wooden-thorn variants
>   w/ silver glowing tips, Alex-directed 2026-07-21; `drawSpike` picks a variant by seed, procedural fallback kept).
> - **PLAN TO HIT (next):** a NEW obstacle — the **hanging thorn-vine** (Alex idea 2026-07-21). *Design (Jin):* Vault's
>   FIRST ceiling hazard — every hazard today is ground-based and the answer is always "jump higher," so over-jumping is
>   never punished. A hanging vine makes the HOLD (float higher) dangerous → the variable jump goes two-sided (tap low to
>   pass under vs hold to clear a gap), and pairs with a gap below to make a "squeeze" corridor you thread. Deepens the one
>   input instead of adding a new one — the good kind. *Canon flag (Magii):* what it IS + what it hangs FROM is a ruling
>   before it ships lore-bearing (Vault's an open-sky crossing; nothing overhead is established). Prototype w/ placeholder
>   art; settle canon before baking a model.
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
> - **VAULT MAP EDITOR (`/vault/dev`) — de-staled + 4× height (2026-07-21, Alex):** the editor is alive/capable (slot
>   picker, drag platforms/stairs, place motes/foes/spikes, in-engine test-play, publish-live). **Placed foes/spikes already
>   render as the void-spawn / blight-thorn MODELS in-game** (editor shows blockout shapes for editing clarity, real sprites
>   in play) — so "assets are placeable" is already true; NEW asset types (vine, structure-ledge as a distinct piece) get
>   their own tool when added. **Map height bumped to 4× screen** (`WORLD_CEIL -260→-810`; editor-only ceiling, game camera
>   follows up unbounded) + editor zoom + screen-height rulers so a tall map is navigable. Toward hidden areas + collectible
>   tokens. **⚠ THE REAL NEXT STEP (needs Alex's nod — touches the tuned collision):** authored maps still use SINGLE-LANE
>   collision (`segAt` returns the first seg), so two platforms at the SAME x aren't both walkable → no true high/low
>   BRANCHING in authored mode yet. The multi-surface collision from the endless blockout must extend to authored `segs`.
>   Pairs with feeling the endless blockout first.
> - **TO-AUDIT (later pass):** walk each cabinet (Rekindle · Ward · Updraft · Seedfall · Voranyx · Atherdash · Driftling ·
>   Squall · Dewdrop · Mana'nana) and slot its hero entities/hazards into HIT/PLAN/NO-FIT. Don't guess fit blind — audit
>   the actual entities first. Leaderboard the strongest candidates; ship a cabinet's render pass as one unit.
>
> **Files:** pipeline `/opt/blender` (4.2.9 LTS, not in git) · render scripts `tools/render/*.py` · assets `public/<game>/*.png`
> · wiring per-cabinet render fn (Vault: `page.tsx` `drawFoe`, sprite-blit + procedural fallback).

## 👹 Cross-cutting — THE ENEMY TAXONOMY: three lanes, three enemy families (Alex, 2026-08-05)

> **Written down so it stops being re-decided.** Each lane has its own enemy family, its own combat verb, and its own reason a different toolkit is the answer. This is the map; the per-lane blocks carry the builds.
>
> | Lane | Realm | Who fights | The enemy | Why THIS toolkit |
> |---|---|---|---|---|
> | **Ather** (regions) | `ather` — weapons holstered by construction | your **spirits**, and your runes | **Moglins** — the collar-raiders | Guns cannot go here at all, so runes aren't *an* answer, they're the only one. And the enemy has **no HP**: the collar is the fight. |
> | **The Crucible** | `outside` — weapons live | you, with manabox + runes | 60 challengers in squads of three · the **Three Puppet Guards** on the Throne · *(⚠ a rank-and-file class is UNRULED — see below)* | Both toolkits legal, so the rune kit has to earn its place on things a gun can't answer: terrain, fields, statuses. |
> | **Expeditions** | — | your guards | the **Nolmir** and other alien species | Canon already frames Expeditions as guard-survival against *"the nameless thing that took the Nolmir"* (`game/nolmir.md` Mode 3). |
>
> ### ★ The Nolmir connection nobody had written down
> `game/nolmir.md` makes the Nolmir a **Crucible-hosting species** who *"tap a planet's core through your Starforge… design your own Crucible — a gauntlet challengers answer, fight, and mostly die in… and when this location runs too hot, you warp on — **leaving the Starforge behind, still running**."*
>
> Read that next to Pyramid Zero — *"the original receiver for the Starforge network"*, a moon-sized pyramid that **warped in** — and the Crucible stops being Lazerin's idea at all. **He is squatting in a left-behind Nolmir machine, running a Nolmir game, and canon already calls him the landlord, not the architect.** It also names the makers behind the 08-05 material ruling ("Alkin manatech is a clumsy copy of THIS"): the copy runs Nolmir → Starforge → Eyuun's Aeterna → Citadel manatech.
> ⚠ **Not asserted as canon by jin** — `world/mother.md` explicitly keeps the Ather/Starforge bridge *"FLAGGED, not bridged… For Sable."* Recorded as a connection to rule, not a fact to build on.
>
> ### ⚠ UNRULED — filed 2026-08-05 (`athernyx CANON_GAPS.md`)
> Alex described the Crucible's enemies as *"the Alkin enemies Laz **resurrects** as **grey guards**"*. Canon says **rebuilt**, repeatedly and pointedly — *"Puppets wearing the shapes of the only company he ever had."* The reveal ("they don't bleed right") only lands if there was **never anyone inside**, so rebuilt-vs-resurrected is a genre change, not a synonym. And "grey" is no longer free: the 08-05 greying ruling makes grey mean **drained**. **Do not populate the Crucible until this is ruled.**
>
> ### Files
> `play3d/collar-raid.ts` (Ather) · `play3d/puppet-guards.ts` + `play3d/crucible-bots.ts` + `play3d/crucible-phases.ts` (Crucible) · `src/app/nolmir/` (Expeditions)

## 🏛️ Shimmer — **BUILDING IS THE DIFFERENTIATOR: blocks build the shell, pieces dress it** (Alex, 2026-08-06) · *Last touched 2026-08-07*

> **The call, in Alex's words:** *"here's the thing that sets our game apart from minecraft.. the building.. the material cost comes from blocks but the look will be more like Sims so we don't have to have blocky buildings."* Full spec: **`STRUCTURE-LAYER.md`**.
>
> **Left off:** direction recorded + spec written. Nothing implemented. Persistence and trees are still ahead of it.
>
> **Next:** ① persistence (a structure layer with no save is a demo) ② six-piece catalogue — **door, window, roof slope, roof cap, stair, beam/trim** (floors and walls are BLOCKS now, not pieces) and prove the *placement loop* ③ the save-template verb, which is the authoring tool AND the generator's input ④ then the rest of the catalogue.
>
> ### Decisions
> - **★ REVISED SAME DAY — SIMS WAS THE WRONG SCALE, AND ALEX CAUGHT IT.** He said *"the more I think about it this Sims building is going to look off"* and the reason is **foundations**: The Sims looks clean because **lots are flat**, and our terrain steps up to 3 voxels between adjacent columns. A room-scale wall on that floats, sinks, or clips — fixable only by flattening terrain before every build, which I had deferred as "not v1" and which was in fact load-bearing. **Once flattening is mandatory the differentiator has been spent on a chore.** The idea was right, the SCALE was wrong.
> - **★ THE REFERENCE IS VALHEIM, NOT THE SIMS.** Not voxel, not blocky, and its buildings read beautifully — because its pieces are grid-aligned and roughly **block-thick**, so they sit *with* terrain instead of fighting it, while still being real geometry rather than cubes.
> - **★ THE MODEL: BLOCKS BUILD THE SHELL, PIECES DRESS IT.** One stack, not two competing systems. **Blocks are structure** (walls, floors, foundations — the flat surfaces nobody looks at; they meet uneven ground the way terrain does, so **no flattening is needed at all**). **Pieces are the look** (door, window, roof slope, stair, beam, trim — exactly the elements that are *ugly as cubes*). This also settles the raw-block question BETTER than the first version: blocks are not a loophole that collapses this into Minecraft, they are **half of it** — what makes it not-Minecraft is that the elements carrying the look are designed geometry.
> - **★ GENERATION: HAND-BUILT TEMPLATES, AND THEY ARE THE SAME PIECES.** Alex asked how buildings would be generated. Yes, pre-built — that is the standard answer, not a compromise (Minecraft villages are hand-authored segments assembled under placement rules). **The payoff: the player and the generator use the SAME piece system, so anything Alex builds by hand becomes a template the generator can place.** Build one Gloview cottage in-game, save it, the world scatters variations. **The 8 canon holds, Gloview and the tutorial glade get authored BY PLAYING**, not by writing data. Variation from a small template set + rules, never from generating architecture from nothing — that is what always looks generated.
> - **★ THE TRICK THAT KEEPS IT CHEAP (unchanged by the revision): a placed piece writes OCCUPANCY into the voxel grid while rendering as a mesh.** Collision stays the cheap voxel lookup already built (`voxelSolid`, the capsule check) — Sims-looking buildings with **no second collision system**. This is the whole reason the idea is affordable.
> - **★ `InstancedMesh` PER PIECE TYPE, NON-NEGOTIABLE.** One geometry + one material, thousands of copies. A mesh-and-material per placed wall is exactly the allocation that got this page BLOCKED from WebGL on 08-06; `render-audit.test.ts` would catch it, but it should never be written.
> - **Storage is nearly free** — a placement list (id, position, rotation), not voxels. Composes directly with the ruled persistence rule (a chunk is stored only if it holds player edits).
> - **★ THIS MAKES THE CARTOON DIRECTION LOAD-BEARING, NOT DECORATIVE.** Blocky terrain beside clean architecture is jarring under realistic shading; under flat-toned, outlined, stylised shading they reconcile, because everything reads as *drawn* rather than *simulated*. The two 08-06 calls reinforce each other more than either does alone.
> - **The 3D pipeline already exists** — `world/prop-models.tsx` loads GLTF with DRACO + preload. Building pieces use that path, not the voxel one. The old `world/structures.ts` (2D tile stamps) retires with the tile world.
> - **⛔ MESHY IS STILL NOT THE ANSWER, for a different reason than flora.** Building pieces ARE a bounded, hand-designed set of dead-grey architectural props — the pre-render lane the art-medium law already scopes, so the *pipeline* is right. But modular snap-together pieces need **clean, precise, dimension-exact** geometry, and Meshy makes *organic* meshes. This is the **picaso / headless-Blender** path. (Correcting the earlier flora answer only in scope: the lane fits, the tool still does not.)
> - **Honest cost:** a piece catalogue is real art work. **Six pieces first**, prove placement/snapping/rotation/cost, then commission the rest. Do not model forty pieces against an unproven loop.
>
> **Files:** `STRUCTURE-LAYER.md` (spec) · `world/prop-models.tsx` (the GLTF path) · `voxel/registry.ts` (material costs) · `voxel3d/` (host) · ⛔ `world/structures.ts` (retires).

## 🧱 Shimmer — GOES VOXEL, STAYS ON WEB (Alex, 2026-08-06, jin-cc) · *Last touched 2026-08-07 eve*

> **The direction call.** Minecraft model: spawn → pick a birth rune → the Greg tutorial → open country, **every block mineable and craftable**. Built on the web now; the **Supra** port is designed in from day one rather than hoped for. Full design: **`VOXEL-WORLD-MODEL.md`** (`4c54686`) — read it before touching materials or chunk storage.
>
> **Left off (2026-08-07, jin-cc):** the world is **built, reachable, and entered through birth**. Voxel core = 17 files, ~365 asserts, zero react/three/DOM. Generation → mining → drops → building pieces → IndexedDB persistence all live at `/shimmer/voxel3d`. **Reachability fixed (`46be393`)** — it was URL-only, which is why Alex had played almost none of it; there is now an owner-only door in the play3d ☰ menu and room/play3d exits in the voxel HUD. **Birth gates the dimension (`3e4b945`)** — `voxel3d/page.tsx` runs the rune ritual before the world mounts, and `lib/ather-epoch.ts` resets every existing character (server saves cleared; accounts/usernames/friends kept; backup in `/root/backups/ather-accounts/`). **Starter put back on canon (`adb7697`)** — Greg gifts a Mana Seed + pot + table, and a spirit blooms from the pot at 1/10 per species instead of being handed over.
>
> **✅ play3d birth-after-reset FIXED 2026-08-07 (`be64a07` + `8b22d7b`, deployed + pushed) — it was TWO bugs.** (1) **The race:** `Shimmer3D` opened the ritual at mount off the `birthPending` latch, then its own async `loadWithCloudFallback` resolved a few hundred ms later and called `setBirthOpen(false)` + cleared the latch — leaving save / no rune / no latch, the one shape that never re-prompts. It hung on a fetch, which is why it flapped between identical runs. Fix: `hydrateFromCloud` moved UP into `play3d/page.tsx`'s boot gate (third leg of the same `Promise.all` as world-data), birth decided **once** against settled storage, `Shimmer3D` mounts only for a keeper already born. Same shape as `voxel3d/page.tsx` — born first, world second. (2) **The corpse, found by reading Alex's live browser instead of reasoning about it:** he was *already* in that state (epoch-2 save, level-8 Dewbear, no rune, no latch) and the race fix alone would NOT have healed him, because the gate still carried the legacy-returning-save arm. Dropped it. **★ Within an epoch a save and a rune cannot legitimately disagree** — `ather-epoch.ts` clears `ather:save:shimmer` and `ather:shimmer:birthRune` *together* — so `!hasRune` is the whole answer and the `birthPending` latch is now vestigial. **Generalize: when a reset clears two keys together, any later rule that treats them as independent evidence is wrong by construction.** Verified on that browser: ritual opens 3/3 reloads with **no canvas behind it**, a simulated rune skips it and mounts the world with the 5988-char garden intact, then restored to unborn so Alex picks his own rune. Cross-device falls out right too: a blank phone hydrates the garden but the rune never rode in the save blob, so it asks for one and keeps the garden — better than spawning runeless, which is what the old rule did there.
>
> **✅ PORT STEP 2-4 SHIPPED 2026-08-07 — crafting, the tools hotbar, the guns, and the light field.**
> - **CRAFTING (`859aebb`) — and it was already a LIVE BUG.** Did NOT port `engine/crafting.ts` (a station catalogue: 5 recipes all "place a station", mana on everything, counts across a `BankState` voxel has not got). Built `voxel/recipes.ts` — pure core, data-shaped like `registry.ts`, mana charged only where mana is channelled. **★ `registry.ts` had log blocks dropping finished PLANKS**, inherited verbatim from `resources.ts` where a *node* handed over milled timber. In a voxel world that broke the game silently: the three forestry blades cost bark/sap, both SECONDARY NODE drops, no block makes them → all three blades uncraftable → forestry stuck at the basic tier-1 Worn Blade → **STARWILLOW (minTier 2) and DAWNWOOD (minTier 3) could never be cut.** The generator was placing two ruled species nobody could harvest. Nothing errored; pressing C just did nothing. Logs drop logs now; 1 log → 4 planks OR 2 bark. **The durable part is the REACHABILITY assert** — every recipe/tool input must trace to a block drop. `pieces.test.ts` already had a narrow version and it FAILED on the change (the test doing its job); widened from block-drops to *obtainable*, not deleted.
> - **NODES ARE STALE (Alex, 2026-08-07)** — *"nodes are another stale resource, we no longer need them."* **★ This takes `spawn-board` (54 refs, the HEAVIEST coupled system in PLAY3D-MIGRATION) OFF the port list entirely** — its whole job was re-dealing nodes. `harvesting.ts` + `node-placements.ts` go with it. Port list drops from three heavy systems to two, and `player` (20 refs) was already solved once in the test bed.
> - **HOTBAR + SPADE + DRAW LOCK (`0db6e1d`).** **★ Farming was the one canon skill with NO tool** (blades/spikes/rinsticks = forestry/prospecting/rinning), so the spade is the missing *fourth*, not an invented fifth — no canon ruling needed. **★ It could NOT be `skill: 'farming'`:** `skill` is a GATE (`breakSeconds` refuses on family mismatch — that is what makes "a spike will not cut a tree" true) and soil/sand are `skill: null` so **bare hands work and must keep working**, or a fresh keeper spawns unable to dig dirt. Added `fastSkill`: on an ungated block it names the family that does the job properly. Hands work, right tool is faster. No `basic_spade` — an upgrade, never a key — and the test asserts soil stays bare-hand diggable. Hotbar = slots 0-3 fixed tool families + 4-7 mined, scroll or 1-8. Selected tool used as-is; holding a BLOCK falls back to auto-pick, so choosing is meaningful but forgetting is survivable. Draw lock (F) blocks the VERBS, never hides the row. **Near-miss: F was already the fly toggle** — the binding would have drawn your weapon AND launched you. Fly → V.
> - **GUNS (`827519b`) — an EXTRACTION, not a port.** `WEAPONS` was a bare literal at `Shimmer3D.tsx:1804` and everything using it lived in `FiringRange`, a ~650-line component that is **five systems in one `useFrame`** (gunplay + cast layer + fields + conjured terrain + status bag + hunter orbs). **★ And the half a copy could never bring is collision — every check reads `gridRef.current[cz][cx]`, a tile grid this world has not got.** So `engine/weapons.ts` holds the shared half (table + tuning + pure ballistics, values VERBATIM); **play3d imports it too**, so two walkers can never disagree about what a Lance is. Voxel owns hit detection via the voxel DDA already used for mining. Projectiles not hitscan (the table defines `projSpeed` per model; also a projectile can be led/dodged once mobs land). Each round raycasts the **segment travelled, not its endpoint** — a Lance covers ~0.9 units/frame and endpoint sampling tunnels through thinner walls. **One shared tracer geo+material**: a material per projectile is a shader program per projectile = the exact allocation that got this page BLOCKED from WebGL on 08-06, and full-auto would hit it in a second. 52 asserts; two target the cone sampler because it is invisible when wrong — the degenerate-basis NaN on axis-aligned forward (reads in-game as *"the gun sometimes does nothing"*) and the missing `sqrt(r1)` that makes every gun shoot tighter than its cone claims.
> - **LIGHT FIELD (`7dade45`)** — prerequisite for darkness-gated mobs. There was **no light model at all** (flat `ambientLight 0.4`, no day/night), so "dark" could not be asked. **★ TWO CHANNELS, NOT ONE, IS THE WHOLE DESIGN:** sky floods down and is stored *once*, scaled by the clock only when READ; block light BFSes from emitters and never scales. Collapse them and you lose a cave dark at noon AND a surface that darkens at dusk, both of which come free because only the multiplier moves — one value means re-flooding the world every time the sun does. It also gives the torch its meaning: block light ignores the clock, so a lit room is safe at midnight. **★ It drives SPAWNING, not rendering, deliberately** — per-voxel light as a vertex attribute breaks greedy meshing exactly as per-block texture variation would have (a flat lit floor goes 1 quad → 1024), the same trap in a third disguise. Minecraft's modern rule verbatim: **block light must be 0** (not the old ≤7), which is literally Alex's "complete darkness"; block light is an absolute **VETO**, not a contribution, because a sum would let a bright day mask an unlit corner and a dark night overwhelm a torch. Sky falling straight DOWN does not decay. Flat `Int32Array` BFS queue — 16×256×16 = 65,536 cells, recursion blows the stack on the first deep cave. Out-of-box reads dark AND solid, never open air (the 08-06 absence-is-never-air rule). **Canon fit:** the night-tide line *"tended light holds grey off; when it banks, untended grey has range"* **IS** `dayFactor` scaling sky light — and `shimmer-geography.md` already rules that what spawns at night is Jin's, so the mechanic needed no ruling.
>
> **⛔ BLOCKED ON CANON — do not build the creature.** Two entries filed in `athernyx/CANON/CANON_GAPS.md` (commits `378e396`, `ae8c133`, **local only — magii's pen pushes**): (1) Alex ruled guns cross into the Ather 2026-08-07, overturning the 07-22 aegis in `world/lucernyx.md` — **needs authoring**, and the knock-ons are the aegis section, Greg's now-false *"better to leave the violence behind"* door line, and what carries the two-moral-climates distinction now that guns are on both sides. (2) **What do the guns FIGHT here?** The 08-05 taxonomy gives the Ather **Moglins with NO HP** (*"the collar is the fight"*) and justified it with *"guns cannot go here at all"* — which the gun ruling voided. A gun has no verb against a no-HP enemy.
>
> **✅ THE DOORS FLIPPED 2026-08-07 (Alex) — voxel3d IS Shimmer; play3d is the owner-only LEGACY route (`36202c4`, deployed + pushed).** Alex: *"the voxel map is the rework that i wanted to make the main game.. i keep saying that these play3d maps are stale and need to be archived."* He was right and it was on record (08-06 he asked how to swap the voxel stack in for play3d; the 07-21 "play3d IS Shimmer, 2D archived" call is the same move one level down). **★ THE ROUTING WAS THE PROBLEM, NOT THE CODE.** Every entrance still opened on play3d — `/shimmer` redirected there, the room's Shimmer wall pointed there, and voxel sat behind an owner-only item in play3d's ☰ menu. Direction said one thing and routing said another, so **routing won**, which is why the rework went almost unplayed. Flipped all doors together (a half-flip only moves the confusion): `/shimmer` → voxel3d · room wall → voxel3d · `proxy.ts` play3d gated / voxel3d public · voxel HUD gets an owner-only "play3d (legacy)" exit and drops the TEST BED label · play3d's menu item becomes the way BACK, ungated.
> - **⚠ play3d is NOT archived and must not be deleted.** `PLAY3D-MIGRATION.md` measured **16 of 23** engine systems as porting untouched — it is the **supply line** for the port, not a rival. You do not archive the source you are still mining. Owner-gated rather than removed, so nothing wanders back onto the world model we are leaving while the port keeps taking from it.
> - **★ A GATED ROUTE CAN NEVER BE A DEFAULT LANDING.** Swept for stragglers and found `DEFAULT_RETURN` + the OAuth callback's `fail()` both hardcoding `/shimmer/play3d` — so every non-owner signing in would have been bounced to `/room`, a sign-in that silently fails to return you to the game. Both read `DEFAULT_RETURN` now and the open-redirect test asserts against it rather than a fourth copy of the literal. **When you gate a route, grep for every place that route is a fallback**, not just every place it is linked.
> - Verified on :3200 — `/shimmer` 307→voxel3d · play3d 307→/room public, 200 with the owner cookie · voxel3d 200 public · the room chunk carries voxel3d · a denied OAuth callback lands on voxel3d.
>
> **✅ PORT STEPS 4-5 + THE WORLD PASS SHIPPED 2026-08-07 PM (`2cba079`→`9f236aa`, deployed) — clock, forest, paths, and a movement stack Alex signed off on.** Full detail in SHIMMER_SESSION.md (this day's wrap); the load-bearing bits: **day/night** rig drives sky/lights off `engine/day-cycle.ts` unchanged (dayFactor armed; `?hour=` pins for art passes) · **trees were painting as ORE** (wood ids in the tile slot table, no painter case — the switch default is the ore artist; add a case when you append to TILE_MATERIALS) · **`forestness()` woodland mask** = forests are places, clearings are the spawn layer's open night ground · **`shapedPV` flat valley floors** = the terrain grows its own travel corridors (flat 19.6%→29.1%; GENERATOR_VERSION 3) · **streaming remesh queue** (deduped, 12ms/frame, nearest-first — the adopt path was meshing col+4 neighbours inline) · **★ `voxel3d/locomotion.ts`** — play3d's Apex locomotion pure + solid-probe driven, **41-assert oracle**, playtest-tuned across 6 commits: Shift=slide (its sprint life was "the dash"), vault = jump INTO a faced 1-block step (auto step-up ruled OUT), held-jump COMBO chains vaults up staircases, climb/hang need the wall FACED (WALL_FACING 0.5), coyote 0.12s fixed the downhill dead-jump, mantle-lerp blink fixed (divide by the duration the lerp STARTED with). Alex: *"the movement im really happy with already."*
>
> **✅ ① BIOMES SHIPPED 2026-08-07 eve (`972c1dc`, deployed) — places, not climate.** `voxel/biome.ts` = sibling label over the same fields (both inherited rules held: biome never feeds height, material never derives from a biome id — BANDS over fields decide surface/species/label, so consumers cannot disagree). **No temperature/humidity: the Ather's one climate axis is MANA** — new `richness` field (tended⇄drained) carves **greyfields** (~8% of land, large fields, dithered guttering fringes = the canon look), surfaced as `MAT.GREY_SOIL` (digs like soil, drops SUBSOIL — "the mana is gone, not the dirt", placeable:false so grey never becomes decor). This is the ground the Hollow layer (④) stands on. Woodland mask MOVED trees.ts→biome.ts (one boundary, many consumers); species weights modulate by place (starwillow→low ground, goldwood→hills, dawnwood→forest cores; rare-stays-rare, you now know where to LOOK); trunks refuse grey ground free via PLANTABLE. HUD names the biome underfoot. Labels: basin/shore/greyfield/crag/highland/woodland/meadow — internal build vocabulary, no lore names invented (canon gate ran clean 6/6). **`scripts/terrain-profile.mts`** renders height+biome side-by-side — the first render caught the grey band SMEARING along flow lines (⚠ `warped2`'s 4th arg is WARP not octaves; richness runs 0.6 vs continentalness's 4). GENERATOR_VERSION 3→4. Oracles 17/17.
>
> **✅ PLAINS PASS SHIPPED 2026-08-07 late (`9968ad5`, deployed) — flats are a FIELD, benches are the mechanism.** Alex: too many valleys/hills, structures need flat ground or they generate sloppy. The metric is **PADS** (12×12 windows spanning ≤1 voxel): shipped country measured **1.0%** → now **7.6%** (and 4.3% at 20×20≤2), flat share 33%→46%, mean |dh| 0.54→0.44. **Two measured failures first:** deepening erosion's damping barely moved pads (dead ridges on a DRIFTING BASE still break every pad — the base is the pad-killer), and hanging flats off erosion's high tail = ~6% of country in stringy warp-filaments with no interior. The fix: a dedicated gently-warped `flatness` field (blobby regions, scale 900 — same shape lesson as the greyfield smear); in its band the ridge term dies AND the base snaps to **benches** (level steps + smoothed ramp risers, altitude preserved → high plains are mesas, nothing melts seaward). Valley floors widened (VALLEY_FLOOR −0.35→−0.22), datum recalibrated 3.5→0.5, GENERATOR_VERSION 4→5. Height oracle gained a pad assert; trees.test sites now FILTER to tree-friendly ground off the same fields (blind sampling starved on every retune). **⚠ Tuning law now pinned in height.ts: measure ≥1200 units — a 420-unit sample fits inside ONE flatness feature and returns noise.**
>
> **✅ RUIN SITES SHIPPED 2026-08-07 late (`3dedf88`, deployed) — something stood in the drained country.** `voxel/sites.ts` = the researched MC placement scheme verbatim-in-spirit: cells roll ONE jittered candidate off (seed, cell, salt), failed checks KILL the cell, placement is pure O(1) math so any column derives its sites with no cross-chunk state. A candidate needs a real PAD (span ≤2 over the footprint) on drained ground (greyness ≥0.6) above the beach — the plains pads + grey band ARE the placement filter. Density ~0.9/1000² by sweep. The build is a neutral broken-stone ruin BLOCKOUT (walls seat at the pad's LOWEST surface, never float; deterministic crumble; gaps = entrances). **Canon gap FILED** (CANON_GAPS `[OPEN] What STOOD in the drained country?`) — ruling swaps the dressing, not the plumbing. GENERATOR_VERSION 5→6; sites oracle 890 asserts (determinism/contract/density/anti-seam/anti-float); terrain-profile marks sites on both panels.
>
> **✅ RIVERS SHIPPED 2026-08-07 late (`23a0f40`, deployed).** A river = the zero-line of a signed field (MC 1.18's trick) — **in a field of its OWN (scale 650)**: the first cut reused weirdness and the map showed a capillary tangle (a ridge field oscillates often; a river is RARE — same lesson family as the greyfield smear). Now: a few real meandering rivers per frame, oxbows, pooled widenings. Channel = 1-3 voxels carved out of `columnHeight` (rounded identically in carve + fill so water can't disagree with banks); filled to one below the banks (guarded to ≤3 voxels above surface — air stays on the fast path); sand bed. **Zero new hooks for consumers:** trees refuse sand, site pads reject channels via carved span, water non-solid = wadeable; bench-edge crossings = small waterfalls. Biome label `river` + HUD. Rivers oracle (dry-ditch/over-bank at ZERO tolerance; banks-mean transects); depth.test water ceiling gained the river clause. GENERATOR_VERSION 6→7.
>
> **✅ TIER-1 WATER SHIPPED 2026-08-07 late (`640d8e2`, deployed).** Water reads as liquid with ZERO simulation: quads split into the world's ONE transparent pass (attrs.ts `buildAttrsSplit`; inside one draw, index order could put blended water in front of its own bed), surface recessed 0.1 into its channel, two-phase vertex ripple, two drifting texture samples (one scroll = conveyor, two = water), opacity 0.78 / depthWrite off. One shared water material — two programs total; dry sections pay nothing. Split exposed + fixed an eviction bug (`lastIndexOf(':')` on the new `:w` keys would have silently evicted every water mesh per sweep). **⏸ TIER-2 PARKED: MC-style spreading sim** (flow levels, downhill spread, edit-triggered updates — ~3/10 lag in bursts, real cost is complexity: per-voxel flow state, partial-height meshing, drained-lake persistence). Build it when the mining loop touches water — today digging a lakeside leaves a standing water wall, and nobody mines lakes yet.
>
> **✅ THE HOLLOWS SHIPPED 2026-08-07 late (`e4599cb`, deployed) — the night tide's payoff, blockout.** The world's first enemy, built the day its ground shipped. `voxel3d/hollows.ts` = the ruling as code: eligibility = **drained (greyness ≥0.5) + dark + dry, all three**; the oracle's one CANON assert is a Hollow can NEVER body on healthy ground (darkness = condition, drain = cause — 'spawns where it's dark' is the named 2026-06-16 failure). Rises from nothing, GLIDES at fixed hover (a smear has no feet; terrain doesn't slow it — quietly the scariest thing about it) but under run speed: running always works. Rounds absorbed by the first body on the segment; disperse (HP 30) drops a raw mana shard — frequency returned, condensing. Dawn gutters all. Spatially opt-in: living country stays cozy. **Owed:** locked look (design-brief + /picaso, reserved by the ruling) · damage-to-player loop (after Alex feels them) · cast-disperse parity when runes reach the voxel world.
>
> **✅ SPAWN CYCLE + MANA LANTERN SHIPPED 2026-08-07 eve (`e872368`, deployed) — the light field gets its consumer, and the night gets its counterplay.** The blockout's ring-roll (18-40 around the keeper — the tide followed the player like a spotlight) replaced by the real cycle: **chunk scan** over loaded columns → **`spawnDark` at the surface voxel** (the 08-07 two-channel light field, first live consumer) → **24-block player exclusion** → **pack-spawn 1-4** (each mate re-validates its OWN ground — no smearing a pack onto tended ground) → **mob cap scaled by loaded world** (`hollowCap` ~5%, floor 2, ceiling 10 — view distance no longer changes danger). "Dark" is the FIELD's word now, not the clock's: block light is an absolute veto (`spawnDark`), sky light scales with `dayFactor`. **MANA LANTERN = the first emitter** (registry `emit: 14` — data, purity-clean; hand-craft 1 raw mana shard + 2 goldwood planks → 4; breaks into itself; painter case added WITH the slot append per the ore-artist lesson) — *tended light holds grey off* is now a thing a keeper DOES: lantern your yard on grey ground and it stays yours at midnight. Light fields cached per column with a 16-block apron (edge lantern protects next door), lazy on scan, invalidated by any edit their 3×3 box sees, evicted with the column. Oracle 13→22. **Deliberate scope:** Hollows stay SURFACE creatures — the glide rides `columnHeight`, so cave spawning (and cave-dark daytime Hollows) waits for a ground-following that respects caves; `openToSky` reads generated surface, so a player ROOF doesn't darken its room for spawning — free until daytime interior spawning exists.
>
> **★ WORLDGEN V2 OPENED + LAYOUT BLESSED (2026-08-07 night).** Alex's ordering ruling: **rivers first → biomes → land conforms** (v12 already tipped this; now official). **Zone layout v2 BLESSED** (`scripts/zone-sketch.mts` → ather.games/zone-sketch.png): the ruled loop as anchored regions — west arm Mycelial→Meadows+Thicket, east arm Springs→Gloview→Outfields→sealed Ather Winds, greying rim beyond all. **Zone characters (Alex):** Mana Springs = HOT SPRINGS (steaming pools/terraces) · Spirit Meadows = ROLLING HILLS, sparse lone trees · Twilight Thicket = DENSE FOREST (closed canopy, dim floor). **Each zone: 2-3 MIST PATCHES** — dense-mana mist, spirits manifest to spar, roster zone-exclusive (mechanic = practice-frame, build-safe; species-per-region ROSTER flagged in CANON_GAPS — encounter build proceeds, roster assignment waits). **Pushbacks accepted:** biome NEVER feeds height (region fields as siblings deliver the outcome); canon zones are LAYOUT-anchored, not noise; sea 67 rejected (MC-brain — MC invented deepslate because 62 starved the underground), the real lever = sea/datum split, candidate 100/120 pending Alex.
> **✅ V2 PHASE 1 SHIPPED 2026-08-08 (`130f15b`, deployed, GENERATOR_VERSION 13):** ② vertical rebalance DONE (sea 100/datum 120; ore bands rode down AND counts scaled — unshrunk counts doubled density in the halved rock; deepStone/treeline/calibration all re-anchored) + ① ZONES DONE (`voxel/zones.ts`: 8 anchored regions, warped-edge membership, sibling law — height/label/forest all read ONE membership; Meadows roll w/ forest 0.06, Thicket forest 0.97, Springs benches forced; zones TENDED = grey starved inside, rim ramp feeds grey outward → ruins+Hollows follow, distance-from-home = difficulty axis; zones oracle 19 asserts; 8k map renders every zone in place). **Remaining:** ③ river-approach smoothing (the fragmented levee wall) ④ mist-patch encounters (site-pattern pads + arena spar; roster waits on Magii) ⑤ zone dressing: HOT-SPRING POOLS (springs benches are ready for water), meadow flora, thicket canopy gloom.
> **✅ SPRINGS MOUNTAIN + HOT-SPRING POOLS SHIPPED 2026-08-08 PM (`d5e8b9f`, deployed, GENERATOR_VERSION 14).** The ⑤ headline item, plus the mountains rework it needed: **zone anchors grow a `lift` axis** (peaked profile over the membership ellipse, noise-bent flanks, applied BEFORE benching — so benching turns the mountainside into a terrace stack for free, and steeper flank = tighter terraces, the Pamukkale shape). Springs now run **lift 64 / benchK 2 / reliefK 0** (1.6 left low-plains-field ground only 60% benched = sloped steps no pool could rim; ridge noise likewise had to die — the drama is the massif now, peak ~194). **POOLS:** own blobby field gated to Springs interior (t=1) × bench-flat middles (FLAT_LO 0.12 phase margin = a standing water face is IMPOSSIBLE by construction — max |∇base+lift| ≈ 0.4 vs 0.96 voxels margin) × outside river bands/hold pads; carve 2-3, fill to one below own rim → flat contained water, NO water table involved (the river system's three-model lesson, sidestepped: a bench flat is level by construction). Measured: 2.5% pool + 2.3% crust over the ellipse. **SPRING_CRUST** (MAT 13, pale calcite-teal, deposit-ring tile) wears beds + aprons + basin walls, wins over the cliff rule, drops itself, placeable. **STEAM** (`voxel3d/steam.ts`): one Points pass, one shader, 140 particles; asks `springsPoolAt` where to rise (retune moves pools → steam follows free) and sleeps outside the zone (idle cost = one zoneAt/1.5s). `springs.test.ts` oracle 13 (massif height, mod-8 terrace levels over 31k flats, per-pool rim equality, zero exposed faces, zero leaks outside the ellipse); depth.test taught pools = the second legal water above sea; terrain-profile.mts grew `--cx/--cz` + pool marking (springs map LOOKED at: massif + contour-crescent pools ✓). **⑤ remaining:** meadow flora, thicket canopy gloom.
> **✅ MEADOW FLORA SHIPPED 2026-08-08 PM (`95c7c72`, deployed).** Ground cover everywhere life is: `voxel/flora.ts` (pure SELECTION field — tufts 16%, tall 3.5%, flowers only in DRIFTS via own 90-scale field; Meadows ×1.9, Thicket floor ×0.28, Springs ×0.55 so crust reads; dies at greyness 0.85 = grass gives out BEFORE the soil greys) + `voxel3d/flora-mesh.ts` (4 InstancedMesh draws — tuft/tall/stem/head, instanceColor tints blooms only, procedural blade textures, shader wind with position-phase so gusts ROLL; live-voxel probe demands topsoil+air = roads/crust/dug holes/placed blocks stay bare free; per-column spot cache, sync deferred until streaming quiet). Oracle 10. **Same session: `/goto` console cmd** (bare = bearings to every ruled place, named = tp; Alex couldn't find the Springs on foot) **+ build-preview fix** (ghost only; wireframe = deconstruct target — the two-box read was confusing) **+ piece auto-facing** (yaw-derived, R = quarter-turn override). **⑤ remaining: thicket canopy gloom.**
> **✅ CANOPY GLOOM SHIPPED 2026-08-08 PM (`d07e123`, deployed) — ⑤ ZONE DRESSING COMPLETE.** The Thicket's "dim floor" as atmosphere: under dense canopy the sun cuts 80%, skylight goes leaf-filtered moss green (hue shift never grey — night palette's own rule), fog pulls in 45%. Gloom = smoothstep(0.62→0.95) over the SAME forestness mask the planter reads (sibling law: Thicket saturates it to 0.97 via membership; deep wild woods earn lesser gloom free), smoothed ~0.5s (canopy edge = entering shade, not a switch), **gated by daylight** (canopy blocks sun; night has little to block → the never-fully-dark floor holds without a special case). Dials: `GLOOM` block atop day-night.tsx. **Deliberate scope:** light-FIELD attenuation through leaves (mechanical dark → spawn implications) NOT built — Thicket is tended so Hollows can't spawn there anyway (dark AND drained required); revisit only if wild-woodland grey patches should host daytime Hollows. **Worldgen v2 zone dressing = DONE. Remaining v2: ④ mist-patch encounters (roster waits on Magii).**
>
> **✅ 2026-08-08 NIGHT SESSION — spawn cycle to MC's shape, UI to the whiteboard, MOONWELL GLADE TUTORIAL.** (1) Spawn cycle reworked after a failed night-walk: MC-style full-column sweep/0.4s + 1.18 light rule (block 0, internal sky ≤7 → tide at deep dusk), ±5 triangular packs, cap 0.1/col, oracle 25. (2) Tool UI per Alex's whiteboard: hotbar 8 fixed item slots, four round tool sockets arcing off its right end (auto-pick `skill ?? fastSkill`, active glows, XP rings), clock dial top-right. (3) **Moonwell Glade = spawn + tutorial + returnable home base (Alex ruling, canon-checked — Gregory's home + the ruled "door to the wider realm"):** Greg NPC, chain gift-shard→cut→planks→lantern→place→report, NE gate arch opens on completion + persists; raven-written lines; localStorage `voxel3d:tutorial:<seed>`. The gate relocates where the wilds (and grey country) begin — the 600-block-to-first-Hollow problem dissolves by placement. **Owed:** glade enclosure ring + Moonwell pool (phase 2), Greg art pass, Alex full-loop playtest → then damage-to-player + cast-disperse parity.
>
> **Next (ruled by Alex at wrap, 2026-08-07 + terrain session):** ① **Alex NIGHT-WALK a greyfield: meet a Hollow, shoot it, run from one** — call the fear (speed/cap/hover are dials), the body's read, and whether the damage loop comes next. ② **Alex feel-pass: plains + greyfields + rivers (now wet-looking) + FIND A RUIN** (map has markers; HUD names the biome); rule the ruin's read, river width/depth feel, + how far biome look goes (grey trees? crag bare rock?). ③ re-aim **Greg's dialogue** to the seed (cozy register → **dispatch @raven**). ④ **grimoire**: real item or UI unlock — design call. ⑤ ~~spawn cycle~~ ✅ SHIPPED 2026-08-07 eve (`e872368`, block above) — night-walk item ① now also covers: craft a lantern, light a patch of greyfield, watch the tide refuse it. ⑥ rinning block answer + crop blocks for farming. ⑦ class-1 structures (tutorial glade, Gloview, the 8 holds) — these want the pads too.
>
> **✅ 2026-08-08 DAY SESSION — the story in the ground, the player in the save, the probe grows up.** Shipped in one run (SHIMMER_SESSION.md has the wrap): mouse-handoff contract from play3d (+ drei's document-wide click-to-lock disarmed — it ignored `enabled` and seized the mouse on every craft click) · crafting table placeable + station gating (bench = tools, hand = refine/lantern/table; Greg gifts the table per canon) · view radius = settings slider 4-12 (despawn line derives from load edge) · sky DOME w/ in-shader sun (★ NO MOON IN THE ATHER — Alex ruling, CANON_GAPS has "what silvers the night") · dev console → MC-shaped CHAT (T/Enter//, one log, HUD fade feed, tab-complete off the registry, `~` coords, owner-gated cheats) · **STORY-PATH WORLDGEN** (Alex: glade → Gloview 500 → holds 750/1003/1098 → Ather Winds; worn road + lantern waystones = the road holds the grey off at night via the spawn gate itself; village re-sited from the old sketch) · river-approach band widened 7× (the "wall with a river behind it" = the parked ③) · **bridges** (deck flush with banks BY CONSTRUCTION — both end at table+1; plank block placeable by players now) · **hold blockouts** (pads, walls, road-piercing lit gates, offset keeps; Thistle + Vetch re-sited river-free) · **pieces pass** (fence #7 + GENERATED dressing: parapets/keep roofs in the player's own catalogue; tombstones persist ABSENCE, occupancy never enters the save) · **cell probe + SWIMMING** (boolean→code; submerged swims, treading = fall cap + perpetual-coyote bank exit; feel contract 58) · **half slabs #8** (CELL_HALF live: stand at +0.5, half-rises auto-step, full blocks still vault — asserted; ★ greedy had NO structure exclusion — every piece wore a magenta occupancy cube until tonight) · **player persistence** (PlayerSave: pos+facing+inv+tools+skills, autosave 5s + pagehide, Y-clamped vs moving worldgen) · build-mode wheel walks the piece catalogue · **fence CONNECTIONS** (MC's derived-state model: post mesh + arm mesh, arms emitted per connected side at sync toward fences/walls/terrain, re-derived on terrain edits — two draw calls for every configuration).
>
> **📋 PARKED — TERRAIN SLUMP (half-step softening), next voxel session's big rock (Alex + jin, ruled 2026-08-08).** Where natural ground steps down 1 block, the generator lays a HALF-LAYER of the same material hugging the step face — "the dirt slumped". Everything it needs shipped tonight: CELL_HALF collision, +0.5 standing, blocked-move step-up. Remaining work: half-height flag in the section encoding (Uint16 has spare bits), mesher emits half-cuboids for flagged natural cells (greedy currently full-cube only), a gen pass, probe maps flag→CELL_HALF, mining strips flag→base material. **★ The design twist to keep: slump strength rides `zone.tended`** — the garden STROLLS, the wilds stay stepped, greyfields sharpen; terrain personality on the axis the world already uses for safety and color. **⚖ Ruling Alex owes before build: stroll-vs-clamber** — slumped country means the vault press stops being how you climb hills (it stays for built walls / 2-highs / cliffs). Sister item, cheaper: stair CORNER variants via the same derived-state trick as fence arms (3 shapes, straight/inner/outer, from neighbour stair facings).
>
> **Decision (2026-08-07):** a **world reset is a client-side epoch stamp, not a server delete**. A Shimmer character lives in localStorage; `accounts.db` only mirrors it. Deleting the `saves` rows loses a race — a browser still holding the old save re-uploads it (measured: a row verified deleted was back minutes later, and the pull then *closed the birth modal*). So the epoch travels **inside** the save: `cloud-sync.ts` stamps on push, `pullCloudSave` refuses unstamped. Bump `ATHER_EPOCH` to reset everyone, including accounts that have not logged in yet.
>
> ### ✅ BLOCK TEXTURE SPIKE DONE 2026-08-06 (`4b65965`→`2fc15c4`, jin-cc texture lane) — **texture arrays, not an atlas**
> Route **`/shimmer/voxel3d/tex`** — one terrain patch rendered TWICE from the SAME `BufferGeometry`, 32px tiles left / 64px right, so tile size is the only variable. Keys: `1` flat · `2` textured · `V` per-block variation · `M` mipmaps · `T` tiles. `?cam=x,y,z&look=x,y,z` pins a viewpoint (an A/B from two different spots is not an A/B).
> - **★ THE ANSWER: a `sampler2DArray` textures blocks at ZERO cost to the greedy mesher.** Each material is its own layer, so `RepeatWrapping` tiles across a merged quad with no bleed. Measured intact: **67,629 quads from 244,685 faces (3.6×)**. An **atlas cannot do this** — wrapping walks into the neighbour tile, and the usual escape is one-quad-per-block, which throws the entire mesher win away. Costs **one float per vertex**; UVs are derived in-shader from position + normal (axis-aligned unit cubes), so there is **no UV buffer at all**.
> - **`voxel/` was never touched.** Face direction comes from the per-vertex NORMAL the mesher already emits, which is exact for axis-aligned quads — so top/side/bottom variants work today with the pure core untouched.
> - **★ PER-BLOCK VARIATION MUST BE PER-FRAGMENT, NOT PER-VERTEX.** The obvious attribute-based version silently destroys the mesher: two adjacent blocks that differ can no longer merge, and a flat 32×32 floor goes from **1 quad back to 1024** — the atlas mistake in a new hat. Instead the block coord is recovered per-fragment (`floor(worldPos - normal*0.5)`), so variation happens INSIDE a merged quad. **World** position, not object: object space restarts at every section origin, so hashing it stamps the same 16-block pattern into every section. Value only, never hue; ore exempt via the emissive mask.
> - **★ AND IT WORKS WHERE DECORATION CANNOT.** Grass tufts and flowers break up a *surface*; nothing scatters flowers 60 blocks down, which is where mining / Prospecting / the ten strongholds live.
> - **★ THE V AXIS IS NEGATED ON SIDE FACES — this is the art contract, not a hack.** Texture row 0 is the TOP of an image file, but `v` grows with world Y, so without the flip **every hand-painted tile imports upside down.**
> - **★ ALPHA IS AN EMISSIVE MASK, NOT OPACITY** — only the crystal inside an ore block glows, not the whole block. The HUD swatch must force alpha opaque or every non-glowing tile blits transparent. One byte, two consumers, two meanings.
> - **Ore, art-directed by Alex over two passes:** soft radial blobs read as **gumballs** → **Manhattan distance = a DIAMOND silhouette** (at 32px the silhouette does the work: circle = bubble, diamond = cut stone) + **three FLAT tones on a diagonal, no gradient** (a smooth ramp is what makes a shape look inflated) + dark rim seating it in rock + single-texel flecks. Then: shards **clipped at the tile edge** → contained, inset per-axis by `r*sx`/`r*sy` (inset by `r` alone lets the wider ones clip out = the same bug disguised). The toroidal wrap I started with was only half-right — halves DO complete across *adjacent* ore blocks, but ore is scattered singles, so the common case was one isolated block showing two clipped halves.
> - **✅ TILE SIZE RULED 2026-08-06 (Alex): 64.** Overrides the 32 recommendation below, which stands as the reasoning rather than the answer. **Consequence to accept, stated once:** 1 texel = 1 screen px only out to **~11 blocks** (vs ~22 at 32px), so past that the GPU is showing a mip and the extra resolution is not on screen — and each tile is **4× the pixels to hand-paint**. Alex's call; look is his. **There is no TILE_SIZE constant yet** — the spike hard-codes `makeTileArray(32)`/`(64)` for the A/B, so the wiring job must introduce one rather than inherit 32 by accident.
> - **Tile size: 32 recommended, not yet ruled — SUPERSEDED, kept for the reasoning.** At fov75/1080p a block covers ~`704/d` screen px, so 1 texel = 1 screen px out to **~22 blocks @32px · ~11 @64 · ~5.5 @128** — past that the GPU shows a mip level and the extra resolution is *not on screen*. **128 rejected:** 16× the pixels to hand-paint per tile and it stops reading as pixel art. **Memory is not the constraint** (43 layers @64px = 688KB).
> - **⚠ KNOWN, DELIBERATELY UNFIXED:** every ore block shows the identical cluster, so a large vein reads as a stamped repeat. Fix is variant layers selected per-block by the same `hashBlock` the jitter uses — no geometry, no meshing cost. Not worth the layers until a real vein looks wrong.
> - **⛔ MESHY IS NOT FOR VOXEL FLORA (ruled 2026-08-06, jin).** Asked directly whether flowers and
>   similar should come from Meshy. **No, and it would fight the aesthetic three ways.** (1) Meshy
>   makes *organic* meshes — smooth geometry in a blocky, 64px pixel-art world reads as an import
>   from another game. (2) Every generated mesh is its own geometry **and material**, which is
>   precisely the per-object allocation that got this page BLOCKED from WebGL today; thousands of
>   flowers as individual meshes is that bug at scale. (3) It costs credits, against a free-first
>   standing preference. **Flora is a CROSS-PLANE: two intersecting quads with a cutout texture,
>   drawn from the same tile array that already exists** — near-zero cost, matches Minecraft, and
>   reuses the texture work rather than opening a second pipeline. ⚠ One real gotcha: alpha in this
>   shader is an **emissive mask, not opacity**, so cutout flora needs its own material or an
>   explicit flag — do not assume the ore alpha channel means transparency.
>   **Meshy keeps its existing lane** (the arcade / pre-render prop path, per the art-medium law:
>   living things stay live-glow, only dead grey things get pre-rendered). Voxel flora is not that.
> - **Tiles are generated from code** off the placeholder palette so the render path could be judged before anything is painted. **They are not a look call.**
>
> ### ✅ MESHER SPIKE DONE 2026-08-06 (`d018c68`) — **section size = 16**
> Voxel core's first files, pure from the start: `voxel/section.ts` (flat `Uint16Array`, never object-per-voxel, + the single-value-section check), `voxel/greedy.ts` (3-axis slice sweep), `voxel/greedy.test.ts` (**100 asserts**), `voxel/purity.test.ts` (**walks the import graph, fails on any react/three/DOM dep — port rule 4, the only one of the four that can rot**). Browser reading at `/shimmer/dev?mode=meshbench` (owner-gated).
> - **The deciding number is the WORST case, not the average:** a block broken on a section *corner* dirties its own section + up to 7 neighbours. **16³ = 2.0ms · 32³ = 13.4ms · 64³ = 106ms** (8³ = 0.87ms but **57.8% of blocks land on a boundary** vs 33% at 16, and column cost nearly doubles). 32 already eats most of a 16.7ms frame on a desktop-class box.
> - **Column cost is FLAT above 16** (28.9 / 27.6 / 26.8ms) — kills the last argument for going bigger.
> - **★ The first run was measuring my own waste.** Sizing output buffers for the checkerboard worst case = **~626KB of typed arrays allocated and thrown away EVERY call** — precisely the GC pressure that kills browser voxel games. Reusable scratch → **2.5–5× faster**. All figures post-fix.
> - **Greedy earns its place on OUR world shape specifically:** 20–31× fewer quads on surface/underground, 5.3× in caves, 1.0× on checkerboard. Flat ground over solid rock is its best case and that's most of the world.
> - **We derived Minecraft's 16 rather than copying it.**
>
> ### ✅ PHONE DROPPED AS A HARD TARGET 2026-08-06 (Alex)
> Carried in from 2.5D cozy Shimmer (phase 3 sized the whole streaming budget around not killing a phone tab, ~23MB) and never re-checked against the voxel rework. **It never decided the section size anyway** — 32³ fails a frame on a desktop-class box with no phone in the argument.
> - **Unchanged:** section size 16, typed arrays / no object-per-voxel (that's GC + the Rust port path), all 4 port rules, greedy meshing, palette packing. The **Worker** moves from *required* to *headroom* — scheduling, not architecture.
> - **★ RELAXES — worth acting on: world height.** 128 was partly a phone-memory number, and § 8(b) already flagged the datum sketch left only ~32 blocks below surface, shallow for a mining loop. **256 = ~7.8MB packed vs ~3.9MB at 128** — nothing on desktop, doubles the depth for ore tiers / mineshafts / big caverns. **Recommend 128 → 256 now caverns are a headline feature.**
> - Also relaxes: the memory ceiling stops driving decisions (not unlimited — a 500MB tab is still bad), and `DEFAULT_RADIUS = 3` (182 units + fog, already flagged as maybe too close) has room to open.
>
> ### ✅ RULED 2026-08-06 (Alex) — regions become BIOMES, and it dissolved the layout blocker
> - **The composition was BLOCKED and is now MOOT.** *"Same layout as before"* turned out unfulfillable: derived from the stitcher, 3 of 7 regions disagree **with themselves** (twilight-thicket implies 3 origins **216 tiles apart**); derived from the region warp graph it solves but **27 of 28 pairs overlap at 70–100%**, because doors were authored between *separate maps* with no adjacency constraint. Root cause: **the canvases are 4–12× larger than the legacy zones they absorbed** (the-outfields = a 400×400 canvas holding a 34×24 zone). **The 7 canvases have never had positions relative to each other.** Alex's answer: stop placing them — generate biomes instead. No placement table to author.
> - **Voranyx Caverns is OFF the surface list** — generated like mineshafts, opening into large caverns. Un-skips **carvers**, which `WORLDGEN-RESEARCH.md` had skipped *only* for lack of a z-column; height 128 expired that reason the same day.
> - **Moonwell Glade = the tutorial biome** (birth rune → Greg → starter kit). Canon-clean: Greg's home is literally `moonwell-glade-gregory-s-home`. ⚠ Must be **guaranteed near origin with spawn inside it**, or the tutorial is missable.
> - **★ TWO CLASSES OF STRUCTURE, and canon forced it.** Alex wanted strongholds unbounded ("no limit of ten"). **The ten was already wrong** — `shimmer-storyline.md:131` ruled **8 strongholds, Acts 2–9, banded 3/4/1** on 2026-07-24 **as the campaign spine**, and `WORLDGEN-RESEARCH.md` contradicted it (now corrected). Resolution is Mojang's own: **class 1** = the 8 canon holds + Gloview Village + the tutorial glade — authored, *guaranteed*, story-bearing. **class 2** = unbounded procedural holds/ruins/camps/burrow-villages via grid+jitter+salt. Retires both consequences the ten-hold design had to accept (origin-centric world; "filler after the last one").
> - **★ This is also how the painted canvases survive.** The biome ruling would silently retire them and overwrite the (c) ruling from earlier the same day. They don't die — **they become authored PIECES the generator places** (Minecraft's village model), not the world itself. Alex's art ships, everything stays generated.
>
> ### Decisions
> - **✅ RULED 2026-08-06 (Alex) — all three § 8 calls, as recommended.** **1 voxel = 1 tile** (every sprite/sculpt/coordinate stays valid unchanged — this is *why* the canvases and the sculpt survive) · **world height 128** · **the seven painted canvases survive**, extruded per § 5. ⚠ **The datum split is NOT part of the ruling** — 128 is the format, where y=0 sits vs sea level is a tuning constant; the ~96/~32 sketch is shallow for mining and should be moved freely during the mesher spike.
> - **★ Chunk width is a RE-MESH decision, not a memory decision.** For a fixed footprint the totals are identical at 16/32/64 wide; what changes is how much rebuilds when one block breaks (524k voxels at 64×64×128 vs 4k at 16³ sections). Pick width from re-mesh cost, memory follows.
> - **★ Typed arrays are a 4× win before voxels enter the picture.** Today's 2.5D world spends **~8 bytes/cell** because it's JS `number[][]` (23MB for ~2.9M cells). At 2 bytes + palette packing a **128-deep voxel world is cheaper than the flat grid we ship now.**
> - **We are not starting from zero on z.** `heightmaps.ts` already says *"Minecraft-style BLOCKY terrain"*; Alex has sculpted **17 zones / 233,380 cells / heights 0–6**. That sculpt becomes the world's **surface layer**, not reference art.
> - **The block vocabulary barely exists — that's the finding, not "it's a lot."** Across all 11 canvases (1,485,000 cells) **six tiles carry 99.97%** (Cloud/void alone 76.1%) and **88 of 104 defined tiles have never been painted**. `tiles.ts` is a *look* library (art + `SOLID`), not a material system. `resources.ts`'s 12 nodes / 4 skills is the spine — they're props *on* terrain, and the move is making terrain *be* the resource.
> - **Port boundary = 4 rules, and rule 4 decides it:** data-not-code registry · pure `fn(seed,coords)` generation (⇒ same seed diffed across engines is a real *test*) · typed arrays everywhere · **voxel core in a folder with ZERO react/three/DOM imports, enforced by a grep test.** "We'll port it later" dies the day the model grows a `useState`.
> - **Engine choice was never the question — voxels were.** Supra's `terrain.rs` is a **heightmap** (FBM, 32×32 @1m, Whittaker biomes) = the same 2.5D model in Rust. Switching engines never bought mining. **Take** its `crafting.rs` (990 loc, `build_canon_recipes()`) + `inventory.rs`; **leave** `terrain.rs` and `biome_resources()` (it derives material from biome id — the pre-1.18 mistake our own research just warned off).
> - **Supra's parking reason has expired** — `SPRINT.md` is a *"Server-Side Sprint, what we can build without GPU"* because the 2GB laptop couldn't compile wgpu. The elitedesk does it in 70s. Still 5mo cold (last commit 2026-03-14); reviving it as the main engine remains a real detour, Alex's call.
> - **Retracted same session:** *"the entire Ather is the home plot."* Would have broken the 07-31 per-keeper-fold ruling and the wild-zones-stay-shared multiplayer ruling. Alex pulled it himself — **no canon gap was filed.**
> - **Canon boundary:** material *names and what they are* = Magii's. Recipes/yields/hardness/tool tiers = Jin's. Build only with ruled names (goldwood, shimmeroak, starwillow, dawnwood, ather crystal, the 4 skills); mark new ones `TBD-CANON` and send **one batched question**. Inventing forty rocks in a design doc is the arcade-draughts failure mode.
>
> **Files:** `VOXEL-WORLD-MODEL.md` (design) · `WORLDGEN-RESEARCH.md` (generation rules, still binding) · `world/heightmaps.ts` (the sculpt that becomes the surface) · `world/resources.ts` (the 12-node spine) · `world/tiles.ts` (look library) · `world/chunk-stream.ts` (`CHUNK=64`, radius 3) · `/root/supra/supra-engine/src/{crafting,inventory,terrain}.rs`.

## 🌍 Shimmer — THE DEPENDENCY ORDER: Wilds → Strongholds · Folds → Raids (Alex, 2026-08-05) · *Last touched 2026-08-06*

> **Why this block exists:** the collar-raid sim shipped before the layer it belongs in. Alex named the real order, and canon backs every step — so this is the ordering of record, not a preference.
>
> ### ✅ PHASE 1 SHIPPED 2026-08-05 — the seeded generator (`world/wilds-gen.ts`, 27 asserts)
> **Measured first, then built.** A RuneScape-ish surface (~4.79M cells) is **~30 regions** of the existing 400×400 unit: **~34MB** as `number[][]`, **~9MB** as typed arrays, **~35KB each on disk** after RLE. Storage was never the blocker — **authoring** was, and generation is the answer to authoring.
> - **Generation: 86ms per 400×400 → a 30-region world in ~2.6s.**
> - **Deterministic, no `Math.random`, no clock.** Canon calls the Wilds *persistent*, so a generator that drifts between runs would change the world under saved positions. That makes determinism a correctness property, not tidiness.
> - **Authored by subtraction** — starts as solid cloud and carves, same idiom as every region before it, which also keeps the RLE codec's compression assumption true.
> - **★ SEAMS AGREE WITH NO GLOBAL PASS.** An edge gate is hashed from the **shared border** (the unordered region pair), not from either region — so neighbours independently compute the same opening. Verified at full size: all **12 shared borders in a 3×3 matched**, from regions generated separately in any order. This is what lets the world be built one file at a time, forever, without ever holding it all in memory.
> - **The walkability contract:** every edge gate reaches every other gate (corridors carve to the heart first), and a flood fill **prunes anything unreachable** — a pocket you can see and never stand in is a bug, not content.
> - **`scripts/gen-wilds.mts`** writes region JSON. `--dry` for stats, and it **refuses to overwrite a file not marked `generated`** — the workflow is generate-the-bulk-then-hand-author, and a generator that silently eats hand-authored work would eat exactly the work worth keeping.
>
> **★ THE LESSON WORTH KEEPING: the tests passed and the map was wrong.** The first carver only ever stepped *toward* its target, so every path it could draw was a monotone staircase — the region came out with ruler-straight 5-wide highways and smooth blobby coastlines. All 27 asserts were green, because "connected" and "crossable" were true. **Looking at the output is what caught it.** Fixed with a parametric meander (noise-offset perpendicular to the line, tapered at both ends so it still meets its gate) plus domain-warped noise for bays and peninsulas. Generated output gets *rendered and eyeballed*, never trusted to green.
>
> **Not committed: the generated regions themselves.** Nothing streams them yet, so 30 files of unused world is dead weight. Run the script when phase 2 lands.
>
> ### ✅ PHASE 2 SHIPPED 2026-08-05 — radius streaming (`world/chunk-stream.ts`, 33 asserts)
> The engine's own chunk comment had promised this since the streaming core landed: *"preload mounts every chunk… a streaming realm later just mounts a radius instead."* The Wilds is the realm that forced it.
>
> | Map | chunks mounted before | after |
> |---|---|---|
> | Rune Hold 100×100 | 4 | **4** |
> | a 400×400 region | 49 | **49** |
> | a 30-region Wilds | 1,216 | **49** |
>
> **The property that matters: mounted chunks are bounded by the RADIUS, not the world.** A 7×7 window is 49 chunks whether the world is one region or a hundred thousand tiles across — asserted against a 100,000×100,000 map so a regression can't hide behind a small test fixture. **Today's maps are completely unaffected** (a 400×400 *is* 7×7 chunks), so this is future headroom bought at zero cost to current content.
> - **Keyed on the player's CHUNK, not position.** `ZoneGeometry` is memoized so a walking player doesn't rebuild the scene tree; the centre setter returns the previous object when the chunk is unchanged, so this re-renders **once per 64 tiles walked**, not 60×/sec. Keying on position would have cost more than streaming saved.
> - **Far chunks are skipped BEFORE bucketing**, so the per-cell sweep is saved too, not just draw calls.
> - **`editing` mounts everything** — the map editor must see and click what it draws, and an editor isn't walking anywhere.
> - **Square window, not circular** — a round one unmounts the diagonal corners you can plainly see across a screen corner.
>
> ### ★ Streaming and view distance are the same setting — and the fog never existed
> Unmounting a chunk the player can still see just shows them the world ending in mid-air. The chunk comment had claimed *"the fog hides the far edge"* since the streaming core landed — **there was no `scene.fog` anywhere in the file**, and the camera drew to 500. So sight is now *derived* from the radius rather than chosen: `viewFar()` = 182 (inside the last mounted chunk), `fogNear()` = 82, fog colour matched to the page background so geometry fades into sky instead of popping.
>
> ⚠ **This is a visible change and wants Alex's eye.** On a 400×400 region the far corners (283 tiles out) used to draw and now sit beyond the fog. That's the intended trade — you cannot see 283 tiles in a cozy third-person game — but it is a *feel* call, and `DEFAULT_RADIUS` is a one-line tune that moves both the window and the sight together.
>
> ### ✅ THE FIRST SEAM SHIPPED 2026-08-05 — The Outfields fray into the Wilds
> **Canon picked the doorway, not me.** `game/shimmer-storyline.md:76` calls The Outfields *"the earth-affinity **wild-edge** south of Gloview, where the village's tended ground **frays into untamed country**… where the cultivated middle layer starts giving way… **a soft foreshadow of the Wilds proper**."* It was already the threshold; it just had no wild to open onto.
> - **`r-wilds-0-0` is live** — the first generated region, registered in `region-maps.ts`, `realm: 'ather'`, 400×400, 46% walkable, 39.7KB.
> - **The gate sits on the canonical frontier.** Found by search, not by eye: (184,196) is the **southernmost walkable 2×2** in the Outfields' tended patch, and the ground directly below it is cloud. You walk to the far edge of the tended ground and step off it.
> - **Region files can carry `gates` now** — same concept as `Zone.gates`, expanded into warps by `REGION_ZONES`. A region door is the same object a town door is, so nothing downstream learns a second thing.
> - **★ `wilds-0-0.json` had its `generated` marker REMOVED when the seam was hand-wired.** That is the intended lifecycle — generate → author → protected — and it means `gen-wilds.mts` now refuses to regenerate over the seam. The guard is doing its job on the very first file that earned it.
>
> **The bug worth recording:** the return landing was first set to (184,197), which sits **inside the outbound gate's own 2×2 footprint** — an instant re-warp loop, the exact failure the Rune Hold oracle exists to catch. Caught pre-deploy by checking `checkWarp` on both landings rather than assuming. Moved to (184,195). **Any hand-wired seam gets both landings checked against `checkWarp`, both directions.**
>
> Verified: a player walks **r-home-plot → … → r-the-outfields → r-wilds-0-0** with no owner rights.
>
> ### ✅ PHASE 3 SHIPPED 2026-08-06 — the Wilds become ONE place (`7030ab1`)
> The Outfields seam is a **door**, and it should be: leaving the tended world is an event. A border between two patches of open grassland is not, and that is what every Wilds region border was. Canon calls the Wilds *"the persistent, walkable, open-world overland"* — **an overland you warp across is not one.**
> - **The move: a region file is an AUTHORING unit, not a runtime unit.** 400×400 is the size Alex can hold in the MapEditor. The files are untouched — own nodes, own burrows, own gates, all in local coordinates — and `world/wilds-world.ts` composes them into a single **`r-wilds`** zone in world coordinates. Collision, warps, chunking and the camera keep working on one flat grid and never learn regions exist. `wilds-1-0` / `0-1` / `1-1` generated, so there is a real 2×2 to walk. The Outfields gate now lands in `r-wilds` at the **same tile numbers** (region 0,0 is the world origin).
> - **The grid is world-sized to READ and holds nothing until you walk into it.** Regions blit in as the load window reaches them and are handed back when it doesn't; one **shared frozen** cloud row stands in for the rest. Phase 2 bounded mounted chunks by radius — this repeats that one layer down. Unloaded country reading as solid cloud is the honest answer, not a placeholder: you can never walk into country that hasn't arrived, and the load window is deliberately wider than sight so that wall is always past the fog.
> - **Frozen on purpose.** One row object is shared by thousands of rows; a stray write would paint one tile world-wide, invisibly. Frozen, it throws on the line that did it. Write paths (`paint`, `clearZone`) call `materializeRows` first.
> - **★ MEASURED FIRST, AND THE CEILING IS STATED RATHER THAN LEFT TO BE FOUND.** Naive full materialization at the 36-region target = 5.76M cells ≈ **132MB** holding the grid plus the engine's working copy: survives a desktop, kills a phone tab, and the phone is a primary device. Sparsity here is per-**ROW**, and a row costs the world's **WIDTH** — so at most 3 row bands are live, which at the 30-region target (2400 wide) is **~2.9M cells ≈ 23MB, flat however far you walk**. It stops paying past **~10 regions wide**, where rows would need column banding or a typed-array backing. **The oracle asserts the 30-region number, so a future widening trips a test instead of a phone.**
>
> **Three bugs, all caught by the tests, all mine:**
> 1. **Releasing a region blanked its row-band NEIGHBOUR.** Regions sharing a `ry` share row objects, so collapsing one back to the shared row wiped the one beside it — which would have read in-game as *the world falling away behind you as you walk*. Release now only collapses a band nobody is left standing in.
> 2. **The load window caps at 3×3, not 2×2.** I asserted 2×2 from "512 < 2×400". An unaligned span S over stride R touches `floor(S/R)+2`, so a 512-tile window straddles **two** 400-tile borders. And the margin can't be shaved to fix it: **sync only runs on a CHUNK crossing, so the buffer beyond sight must be ≥64 tiles** or you outwalk the loader between syncs.
> 3. **A null streaming centre means "mount EVERY chunk"** — correct for a small zone, ruinous for a world-sized one (it would bucket the whole overland, as solid cloud, before the player moved). The centre is seeded on first render and the first mount happens with it.
>
> **★ The seam proof is a FLOOD FILL from region A's heart to region B's heart on real generated terrain — not gate-number equality.** The gates agree by construction (hashed from the shared border), and *that is exactly what the phase-1 staircase bug also had*: 27 green asserts over a map full of ruler-straight highways. Numbers agreeing is not country connecting.
>
> ⚠ **Still wants Alex's eye** (unchanged from phase 2, now with more to look at): walk Home Plot → Outfields → the Wilds → **across the wilds-0-0/1-0 border**. Does the generated country read right at ground level, and is `DEFAULT_RADIUS` 3 (182 units + fog) too close? Both are one-line tunes.
>
> ### 🐛 THE GATE THAT RENDERED AND DID NOTHING (found+fixed 2026-08-06, `d23a7ab`)
> Alex walked into the Outfields' WILDS door and nothing happened. **Not the seam, not phase 3 — and not new.** `applyLiveRegionData` rebuilt `zone.warps` from **`live.warps` alone** and never re-expanded `live.gates`. Live region data is fetched on **every boot** and overlays the compiled data, so in the browser it always won: the compiled world was right, every headless assertion was right, and the door was dead in the running game.
> - **★ IT FAILED IN THE WORST SHAPE AVAILABLE.** Gate nametags render from `zone.gates`, which that path never touched — so a stripped door is pixel-identical to a working one. There is nothing to see. The only way to catch it is to check the warp, through the overlay.
> - **★ THE REAL LESSON: THE GAME NEVER RUNS ON THE COMPILED DATA.** Every check written for the seam tested `REGION_ZONES` as built at module load. The browser boots, fetches `/shimmer/region-data`, overlays it, and runs on *that*. A whole test suite can be green against a world the player never enters. **Any assertion about doors, warps or region tiles must run AFTER `applyLiveRegionData`** — the oracle does now.
> - Fixed to build warps exactly as `REGION_ZONES` does (authored warps + expanded gates); the live path meaning something different from the compiled path *was* the bug. The Wilds composite re-collects its doors after the overlay, grid stays sparse so sculpt-fresh tiles still arrive through the normal mount.
> - **Blast radius: both region gates on the board** — `THE WILDS` (Outfields→Wilds) and `THE OUTFIELDS` (the way back). Every region gate authored from here on was going to land dead the same way.
>
> **⚠ Debugging note, so the next person doesn't lose the time I did:** a **backgrounded tab reports `document.visibilityState === 'hidden'`, never sizes the R3F canvas (it stays at the HTML default 300×150), and therefore never renders `Scene` at all.** That looks exactly like a catastrophic render bug — blank sky, no console errors, no geometry — and it is purely an artifact of the tab not being foregrounded. **Check `visibilityState` before believing an empty world.**
>
> ### 🐛 THE VAST EMPTY MAP (found+fixed 2026-08-06, `2707c41`) — walked the gate, arrived nowhere
> The door fired and the Wilds were empty country. **The mount logic was correct; it was never called.**
> - **★ ROOT CAUSE: `Scene` renders without a key, so it never remounts on a warp and every streaming ref outlives the zone.** `performWarp` sets `posRef` **synchronously** but *queues* `setZoneId`. So for one frame the callback sees the **new position under the old zone id**: it correctly skips the mount (not the Wilds yet) and writes the destination chunk into `centerRef` anyway. Next frame the zone is right, the chunk guard says "nothing changed", and the arrival mount is suppressed **permanently** — the overland stays empty until you happen to walk a full 64-tile chunk.
> - **Same root, second bug:** a stale `loaded` set claimed regions were present in a grid that had just been rebuilt empty, so leaving the Wilds and coming back landed in the same nothing. **Streaming state is per-ZONE; it is now keyed on the zone.**
> - **Third, and it would have hidden the fix:** the geometry memo keys on the CENTRE, and an arrival mount happens at a centre it has already rendered. Tiles landed in the grid and nothing redrew them. `syncWilds` reports whether it moved anything; that bumps a `mountTick` the memo watches.
> - **The oracle now models the warp FRAME BY FRAME** rather than testing `syncWilds` in the abstract. None of this is visible in a pure test because none of it is about what `syncWilds` does — it is about *when it is called*. Verified the new test goes **red on the old chunk-only guard**, so it reproduces the bug rather than describing the fix.
>
> **★ The pattern across all three of today's failures:** every one lived in the wiring, not the logic — the live-data overlay, the warp frame ordering, the memo's dependency list. The pure layer was correct and fully tested the whole time. **A component with no key is a component whose refs belong to the previous zone.**
>
> ### 🐛 THE BOOT CARD ALWAYS SAID "HOME PLOT" (found by Alex, fixed 2026-08-06, `5e2656e`)
> The arrival title card named **Home Plot on every boot**, wherever you actually loaded in. It ran on mount with `[]` deps reading `zoneIdRef.current` — which at that moment is still `START_ZONE`, because the save is read *afterwards* and then calls `setZoneId`. **It was naming the placeholder.** Now it fires on the **resolved** boot zone: the save loader reports where the player actually landed on every branch it can take, defaulting to `START_ZONE` for a fresh save (where the boot really is the Home Plot).
> - **★ Same round, the same mistake wearing a different hat: `regionIdOf` answers "which region FILE backs this zone", and the Wilds have none.** Every check written as `regionIdOf(id)` therefore said *"not a region"* for the entire overland — so walking into the Wilds was the one arrival that got **no title card at all**, and `newWorldRef` stayed false there. Split into **`isRegionZone`** (behaviour: am I in the new world?) and **`regionDisplayName`** (the card); `regionIdOf` now only answers the question it is actually about.
> - **Neither is from phase 3** — the card has named the wrong place since regions shipped. Worth stating because three separate reports in one morning all *looked* like the new work and none of them were.
>
> ### 🧭 DIRECTION PROPOSAL 2026-08-06 (Alex) — the missing Lucernyx, and a sandbox that goes dark
> Alex's thread, in order: *Minecraft's sandbox fun → "bedrock" as the Ather clouds → gates as portals → biomes → **the Lucernyx is missing and the goal is finding out what happened to him**, the grey manifesting in dark places → **opens cozy and loses it**: "greg keeps the garden cozy but the wilds are where it gets dark" → mining, where **mana-crystal blocks feed Prospecting and wood blocks feed Forestry**.*
> - **⏸ BLOCKED ON CANON, logged:** `CANON_GAPS.md` `[OPEN] The Lucernyx is missing — does the Ather's own overworld go dark?` (athernyx `2b57fe7`, pushed). It edits `two-lines-two-games.md`, which puts the **whole** Ather — Wilds included — on the cozy side under the aegis. Four decisions listed there. **Do not build lore-bearing content against this until it is `[RULED]`.**
> - **★ The premise is its own licence.** Canon: the Ather is cozy *because of whose watch it is*. Remove the watchman and the cozy side stops being cozy with nothing invented. Two-tier protection is separately canon: the **garden holds because a keeper TENDS it** ("carves and folds a pocket of stillness… and tends it green"); the **Wilds have no tender** and were held by the aegis alone.
> - **⚠ Guard the cause of grey.** Canon grey = **mana drained until a frequency can't hold**, caused by *hoarding*. Not darkness-spawn. Precedent: the first Lucernyx profile was shaped by the arcade draughts piece and "quietly defanged The Dying" — reframed a week later. **A game mechanic reaching up and rewriting the cosmology is the known failure mode here.**
> - **The threshold is already built.** The Outfields is canon's own *"tended ground frays into untamed country."* Live and walkable since 2026-08-06.
>
> ### ⛔ "CLEAN HOUSE AND KEEP ONLY THE MOVEMENT SYSTEM" — recommended AGAINST (jin, 2026-08-06)
> Alex floated deleting the game and restarting from the movement system. **Measured, the case does not hold:**
> - **Every new idea is ADDITIVE.** Mining → the `paint` primitive (`lower`/`void`) + the already-designed tool model. Skills → Forestry/Prospecting already exist. Biomes → a noise layer in `wilds-gen`. Light/dark → new, conflicts with nothing. Depth → gates (canon says *layers*, not voxels). Premise → narrative. **Only ONE genuinely new subsystem exists: per-player terrain diffs** — and `syncWilds` is its single insertion point.
> - **★ "Keep just the movement system" is the HARDEST possible extraction, not the easiest.** `Player` reads **nine** refs — grid, heights, zoneId, warps, battle, harvest nodes, stations, flags, defeated, joystick. It is not a module; it is the component that *reads every world system*. Keeping it means recreating the tile grid, height grid, warp system and chunk streaming it moves through — rebuilding exactly what was deleted, minus the tests.
> - **★★ Today is the argument.** Four bugs found in one morning — live-data overlay stripping gates, warp frame ordering killing the arrival mount, the geometry memo never redrawing, the boot card naming a placeholder. **Every one lived in the wiring, none in the logic**, and each is now a comment and a regression test. A rewrite re-earns all four, in a fresh chat with none of the context.
> - **✅ The instinct IS right, aimed at the wrong target.** Real cruft exists: **27 legacy zones vs 8 new-world regions**, plus the `garden-world` stitcher. `region-maps.ts` already documents the cutover — prefix drops, saves migrate via each file's `sources` table, legacy zones + stitcher deleted. **That is the clean house, it is already designed, and it removes dead weight without touching one working system.**
> - **The one honest keep-or-cut question is BATTLES** — `engine/` is 15.4k lines and its four largest files are battle (`pixi-battle` 871, `battle` 757, `arena` 722, `party-battle` 646). The new direction de-emphasises battling. But spirit battling **is canon** (spars for sport; frees collared spirits) and Shimmer's framing was always world-first with battles *discovered*, not headlined. **Keep; don't headline.**
> - **Fresh CHAT yes, fresh CODEBASE no.** Session hygiene is a separate question from a rewrite.
>
> ### 📖 WORLDGEN RESEARCH LANDED 2026-08-06 → **`WORLDGEN-RESEARCH.md`** (read it before touching `wilds-gen`)
> 6-agent tiered workflow (4× Sonnet research → Sonnet accuracy gate → Opus synthesis), run `wf_28ce5271-5e1`. **19 claims confirmed against primary sources, 1 corrected, 0 refuted, 10 left explicitly unknown.** Full brief in the file; the decisions are here.
> - **★ NEVER DERIVE HEIGHT FROM BIOME ID.** That was pre-1.18 Minecraft's mistake — every biome carried its own base-height constants, which is *why* "Hills" variant biomes had to exist and why elevation stepped at biome edges. Since 1.18 height comes from splines over the noise fields and biome is a **separate lookup over the same fields**, which is why nothing steps and there is no per-edge blend pass. **Two reads, one noise field.** Lands in `wilds-gen.ts` independently of the infinite migration — do it first.
> - **★ THE CROSS-BORDER ANSWER (our highest-value gap).** `edgeGate()` makes terrain *openings* agree; it says nothing about an **object** straddling a border. Mojang's fix is one-chunk-authors-the-whole-feature plus pointers. Ours is smaller: a pure `poiStartsAt(seed, cx, cy)`, each chunk scanning a ±footprint box of that pure function and clipping the overlap. **No storage, no pointer table, no status enum in v1** — one-author-per-feature falls out of purity alone.
> - **★ NEVER let a generation stage synchronously generate a missing neighbour.** That is precisely the pre-1.13 cascading-worldgen bug (populate ran on a 4-chunk intersection and recursively demanded neighbours). In a browser it is a frame-time cliff, not a lag spike. Size the margin by the largest POI footprint; `wildsLoadRadius()` already does this in miniature.
> - **★ TEN STRONGHOLDS → RINGS, BAKED OFFLINE.** Not Minecraft's lazy per-chunk ring algorithm — that machinery exists only because Mojang cannot know how many a player will need. **We know it is ten, forever.** Use the ring *math* as an authoring heuristic and bake a static table: 3 rings split **3/3/4**, wedge-centre + deterministic per-hold jitter (Mojang's own trick, proven by the outer ring sitting at 36° not 40°). **The property that matters: whichever heading you commit to at spawn, a hold is ahead of you** — a jittered grid gives that only in expectation. ⚠ Two consequences to accept up front: the world becomes **origin-centric** (spawn must stay near 0,0 or the pacing curve inverts), and **after the tenth, outward is pure procedural filler** — so the grid+jitter machine is needed the same week, not later.
> - **★ WE DELIBERATELY DIVERGE FROM MOJANG ON PERSISTENCE.** Vanilla writes 100% of every generated chunk to disk forever; there is no diff-against-the-generator. **We want the opposite: a chunk file exists only if it holds a player edit, and file-absence means "regenerate."** Right for us because our generator is cheap and deterministic and our storage is a browser. Note the consequence: version the generator alongside each edit, or a generator change silently strands saved edits on terrain that moved.
> - **Cheap unlock for #294:** split render radius from **simulation** radius (Minecraft added exactly this split in 1.18). Draw the `(2r+1)²` window, tick enemies/spawns in an inner `r=1`. ~2 hours, and it is what makes real-time world enemies affordable on a phone.
> - **⛔ Skipped, with reasons in the file so nobody re-proposes them:** carvers (nothing to tunnel without a z-column — a cave mouth is a POI with a layer tag), light as a generation stage, the `depth` biome axis (needs a real vertical column; feed layer-index instead), Anvil's NBT container, 1.18 "biome blending" (it is a *migration* seam fix for old saves, NOT a per-edge smoother — never cite it as one), and **every tuning constant**.
> - **⚠ Genuinely unresearched and it blocks `syncWilds`:** what happens to the already-saved 400×400 region JSONs when the manifest goes away. That is closer to Minecraft's 1.18 old-chunk blending problem than to anything else in the brief and **deserves its own pass before the infinite migration starts.**
>
> ### 1️⃣ THE WILDS — the missing layer, and the blocker for everything below
> Canon (`spirit-tales-bible.md`, ruled 2026-06-22): the Wilds are *"the persistent, walkable, open-world **overland** — the wide common country where the populace and **wild spirits** live… **the layer the GAME explores**."* Keeper-gardens are **tended sections OF the Wilds** (2026-06-23) — a fence-line is the border to untamed wild beyond, not a separate map.
>
> **★ The Wilds also dissolves the open quarry question.** #294 stalled on "what does a raider steal, when spirits are battle-only with no overworld?" Canon's answer is that wild spirits *live in the Wilds*. Build the layer and quarries stop being a design decision — they are simply what is standing in the field. **Do not answer the quarry question separately; it is a symptom of the missing layer.**
>
> ### 2️⃣ STRONGHOLDS — need the Wilds first (canon says so literally)
> Canon (`glossary.md` + bible, ruled 2026-06-03): a stronghold is *"an Outland Moglin hold that **runs on collars** — the macro version of what three weeds did to three garden plots. The Series 2 threat: **the gardens were practice; the strongholds are real**."* Hemlock **runs one**. Jimbo closes Bk5 by *"forewarning her of the nearest stronghold, and that there are others."*
> **And the dependency is canon, not just practical:** *"Strongholds sit in the Wilds and are reachable overland — a collar-sweep walks its captives along the trails — as well as by fold back-door."* A stronghold with no Wilds around it has no trails to walk captives along.
>
> **Alex's structure (2026-08-05):** each stronghold = a **group + a leader**, and each **favours one of the ten base lines**, each having *"gone in a different direction with how they train theirs."* Ten holds, ten philosophies. ⚠ Filed for Magii — a themed hold is world-structure that Series 2 books will use, so it is not a pure build call.
> *Build note:* the three existing holds (`thistle` / `sorrel` / `brack`) are already zone ids and defeat-flags — they are the first three of the ten, not throwaways.
>
> ### 3️⃣ THE FOLDS — where the RAIDS live
> Canon (ruled, `game/shimmer-geography.md`): the Folds are *"the churning wild between fixed gardens, never the same twice"* → **procedurally-generated dungeons**, entered at Moonwell Glade, and *"deep fold-runs carry to the Ather Wilds."* The Wilds are walked; the folds are **back-doors that open and close**.
>
> **★ Raids ARE fold content, and that is not a reframe — it is what a fold already is.** A raid is a transient generated encounter; a fold is a run that is never the same twice. The collar-raid sim already spawns its quarries with the encounter and retires when settled, so it drops into a generated fold run with no changes. **A stronghold is the opposite shape:** fixed place, fixed leader, persistent — the same mechanic, deployed as a siege rather than an ambush.
>
> ### ⏸ PARKED (Alex 2026-08-05) — "pin the idea for later"
> `collar-raid.ts` is **built, tiered, 44-assert tested, deployed, unwired** — and correctly so: it has nowhere to live until the Wilds or the Folds exist. It is not debt; it is the mechanic waiting for its layer. **Nothing further on raids until the folds front opens.**
>
> ### The order
> **Wilds → (quarries free, strongholds possible) → Strongholds** · and in parallel **Folds → Raids.** The Wilds unblock two of the three, which makes them the highest-leverage thing on this board.

## ⚔️ Shimmer play3d — #294 REAL-TIME ENEMIES: THE COLLAR RAID (sim shipped 2026-08-05, jin-cc) · *Last touched 2026-08-05*

> **Left off:** the sim is built, tested (35 asserts) and deployed but **NOT WIRED** — one decision blocks the wiring, and it is Alex's (see *Next*).
>
> ### The design, and why it dissolves the rune-vs-gun problem
> The rune kit has read as a worse gun for as long as the only PvE was turn-based. The fix was **not** to put enemies on the gun side — that re-creates the redundancy. It is to put them **where guns cannot go**: `realm: 'ather'` holsters weapons by construction, so in a region the rune kit isn't *an* answer, it's the only one.
>
> ### ★ Canon had the whole design written — `design-briefs/moglins.md`
> *"The species is not the sin, the collar is."* · *"the swagger drains the moment the spirit is freed"* · the collared spirit looms beside them **as the borrowed power** · a collar binds **spirits only** · moglins take spirits as **stock**.
>
> **The mechanical consequence: a raider has NO `hp` FIELD AND CANNOT BE KILLED.** The collar is the only resource in the module. That single omission is the cozy line's moral engine expressed as a data structure — you cannot shoot a teddy bear, and the game should not let you try. **The stake is theft, not death:** a raider comes for a spirit, and losing means it walks away with one. You cannot shoot an abduction.
>
> ### Decisions (don't relitigate)
> - **Disarm is a WINDOW, not a win.** Shackle jams the collar-hand: no borrowed power, no fitting a new collar — but the raider keeps its collar and its nerve. Making disarm a kill would collapse the whole fight into one button.
> - **Interrupt by PRESENCE.** Looming outranks collaring, so walking at a raider pulls it off a spirit before a single cast — a rescue you can perform by existing. Also makes the poser read as a poser.
> - **The collar is never half-on** — any interrupt resets the work.
> - **Rooted still lets it work** (canon's clamp is on the feet, its hands are free); **disarmed does not** (you cannot fit a collar you cannot hold).
> - **★ Blinding is NOT a safe answer, and that is emergent, not designed.** A blinded raider forgets the player and *resumes collaring* — Enlighten buys a disengage but accelerates the theft. Exactly the "removes an option, not HP" texture; keeps Enlighten situational instead of universal. **Keep this.**
> - **No wounded state, no second phase** — canon doesn't describe one. Break the collar and he is simply the sweet creature again, permanently.
>
> ### 🎚 DIFFICULTY TIERS (Alex 2026-08-05) — tier the SPIRIT at stake, and the moglin follows
> Nearly free, because every point of pressure already comes from the bound spirit: raise the tier of what's collared and the fight scales with no new combat code.
>
> | Tier | At stake | Feel |
> |---|---|---|
> | **base** | a **group** of 3 | triage — you cannot stand over all of them |
> | **second** | 1 | a straight duel over one spirit |
> | **awakened** | 1 | the prize. Longest collar work, hardest collar, hardest hitter. |
>
> Canon tiers the *moglins* to match, so difficulty reads twice — **Thornlords** are *"the small end of the collar-culture, one collared spirit each"*, **Hemlock** is *"bigger, colder, better-kept… multiple collars."* The middle class has **no canon name**, so the enum tiers by the SPIRIT (canon-neutral) and leaves naming the moglin class to Magii.
>
> ### ★ The awakened tier CANNOT be lost into a capture — and that is enforced in code
> Only **one** awakened form is named in all of canon: **Hibernyx**, the awakened Dewbear. The other 159 stay just-in-time (named the moment one evolves *on the page*), so a hard tier full of awakened forms would mean the BUILD naming them = accidental canon.
>
> Canon hands us the tier anyway: *"This is what Hemlock's great empty cage was built for… the cage is empty because he has hunted one for years and **never caught it**."* So an awakened raid that ends in a capture would contradict a fact already printed in Benji's books. `TIER_DIALS.awakened.canTake = false` — the collar bar fills and **resets**. You can still lose the *chance*; you can never lose the *fact*. The oracle runs a 60-second undisturbed raid to prove it, and separately proves the lower tiers DO capture so the rule isn't a global no-op.
>
> ### ✅ The quarry question is CLOSED by the dependency order (2026-08-05) — see the Wilds block above
> It was never a design decision: canon puts **wild spirits in the Wilds**, so building that layer supplies quarries for free. The options below are kept only as the reasoning that led there.
>
> ### ~~Next — one decision blocks wiring~~ (superseded)
> **What is a "quarry"?** The sim takes an opaque `{id,x,y}` list and deliberately never learns what a spirit is — so the caller decides. But Shimmer's convention says **spirits are battle-only, no overworld**, so there is nothing in a region for a raider to steal yet. Options:
> - **(a) The Home Plot spirit bank** (shipped 07-30) — real overworld spirits already exist there, and moglin burrows raiding a garden is exactly canon. But the stake becomes *losing your own*, which is harsh for the cozy line.
> - **(b) A wild spirit that only exists during a raid** — spawns with the raid, is the thing you're rescuing, leaves when freed. Keeps the stake at "did you save it", never "did you lose yours". Costs a new transient entity.
> - **(c) Abstract** — the raider is heading somewhere offscreen; interrupting is the whole fight. Cheapest, least legible.
>
> Then: renderer bodies (deflate pose is the payoff and must be legible at a glance, per the brief), routing a cast's damage into `strikeCollar`, and the freed-spirit payoff — **grey draining back to colour**, which is the same cosmic fact ruled on the Pyramid today, at cozy scale.
>
> **The turn-based patrol battle is untouched and still shipping** — this is additive, not a replacement, so nothing regresses while it's unwired.
>
> ### Files
> `play3d/collar-raid.ts` (the sim — pure, no THREE, no React, same mould as `puppet-guards.ts`) · `play3d/collar-raid.test.ts` (35 asserts) · consumes `play3d/statuses.ts` via opaque `raid:<id>` targets.

## 🚪 Shimmer — THE MORTAL SIDE: gates, the town, the station chain (SHIPPED 2026-08-05, jin-cc) · *Last touched 2026-08-05*

> **Left off:** the whole chain is walkable by a player — **Home Plot → Rune Hold → {The Passage · Travelers Station → Firing Range}** — with the Crucible stub owner-held off the station. Three stub interiors are authored-shell-only and waiting on Alex's eye.
>
> ### What shipped
> - **The Spirit Corner folded into Rune Hold** (`e1c6c11`). Alex's 100x100 town map saved under `SPIRIT_CORNER`; canon (`rune-hold.md` § The Hub) rules the Spirit Corner a **storefront on the square**, so the separate zone was the build approximating. Coordinates survived the fold (he painted outward from the old room), so `LEGACY_ZONE_ALIASES` migrates an old save by swapping the id alone.
> - **Gates** (`f01feca`) — a `Warp` is one tile, so a door was always "warps sitting next to each other". `Gate` = one anchor, one footprint, one name; `expandGate` makes size² warps at load. **Label is data** so a canon rename is a one-field edit. 2x2 default, big nametag, editor Gate brush.
> - **Tile 103 Building Block** (brown, SOLID). Clouds + mist are **Ather-only**; a town of cloud reads as sky. 1.8 tall vs cloud 1.3 → towns get a skyline.
> - **The split** (`0767f9b`) — one zone was doing two jobs (name said Firing Range, id said `crucible`, BR clock ran against it). Now `travelers-station` (peaceful concourse) and `firing-range` (weapons live). **No new machinery**: `outside && !peaceful` already mounted the range.
> - **Crucible stub** (`8555452`) off the station, owner-held while there's no match.
>
> ### Decisions (don't relitigate)
> - **Gates render from DATA, not painted tiles** — so erasing tiles does NOT delete a door. The 2D editor's eraser takes the WHOLE gate; the play3d editor **cannot** delete wiring (its save posts grid/heights/nodes/spawners and deliberately not warps — an unconditional `warps: []` there would wipe every door in the zone) and now says so instead of failing silently.
> - **An alias cannot survive a reissue.** `crucible` briefly meant the range; the tournament map reclaimed it, so the alias was **deleted**. `getZone` prefers a live id over an alias — that is what made the reclaim safe.
> - **Practice is the ungated door.** The Crucible is owner-held for a build reason (no match yet), never a canon one.
> - **Unwired warp tiles are not painted.** A door to nowhere fails the oracle's orphan check on purpose.
>
> ### Next
> - **Alex:** `TODO(station-layout)` · `TODO(passage-layout)` · `TODO(crucible-layout)` · paint Rune Hold's buildings with tile 103.
> - **Blocked on Magii:** canon-drift is **RED** — `[zones] The Travelers Station, The Firing Range` are not in the ruled geography. Deliberately **not** allowlisted; the gate's job is catching places that became canon by being built.
> - **Jin:** the multi-level engine work (see the Crucible block), then #294 enemies.
>
> ### Files
> `world/zones.ts` (Gate + expandGate + LEGACY_ZONE_ALIASES + all five zones) · `world/tilemap.ts` (RUNE_HOLD, THE_PASSAGE, TRAVELERS_STATION, CRUCIBLE, FIRING_RANGE, tile 103) · `world/tiles.ts` · `play3d/Shimmer3D.tsx` (GateMarkers, building walls, instance clamps) · `dev/editors/MapEditor.tsx` (Gate brush, whole-gate eraser) · `save-map/route.ts` (gates + `ownerOnly`) · `world/rune-hold-fold.test.ts` (475) · `play3d/phantom-instance.test.mjs`

## 🔺 Shimmer — THE CRUCIBLE: multi-level, and why the engine can't do it yet (2026-08-05, jin-cc) · *Last touched 2026-08-05*

> **Left off:** stub zone exists and is walkable (owner-held). The real build is blocked on an engine limit, and canon is what forces the hard version.
>
> - ★ **Canon requires the whole pyramid loaded at once.** `pyramid-zero.md` › Level 3: *"No load screens — seamless ascent."* So the Crucible **cannot** be four zones with a warp between floors like every other interior.
> - ★ **The cheap fake is also out.** Floors are stacked interiors sealed behind **airlocks under falling pressure** — an open-air stepped ziggurat can't hold pressure, so the terraced-heightmap version contradicts the hazard.
> - **The wall:** `heights[y][x]` is a **heightmap — one surface per column, `MAX_TIER` 8.** You can never stand *under* another floor. Not a tuning problem; a data-model one.
> - **The path (recommended, not yet built):** `garden-world.ts` already composes several zone grids into one scene via `Placement { zone, ox, oy }`. **Add a vertical offset to that same struct.** Floors stack with almost no new machinery, each floor stays an authorable MapEditor map, collision picks a floor by player Y, and the airlocks are the gate between them.
> - **Do NOT re-derive timing in a map.** `crucible-phases.ts` already derives floors, windows and the seal from elapsed seconds alone, and is tested. Wire maps TO it.
> - **Art brief ✅ RULED 2026-08-05** (`athernyx design-briefs/pyramid-zero.md` + `game/pyramid-zero.md` › ★ The Look). Material = seamless/jointless/mana-veined; the relic is **greying, not decaying**; crest is Lazerin's, applied later; light is gold and doesn't reach everywhere.
>
> ### 🎨 THE TWO ART LANES — split 2026-08-05 (the canon ruling did most of the sorting)
> **The governing principle: spend the PERISHABLE resource on what only it can do.** Meshy credits expire with the subscription (**950 left, ~1 month**); bpy authoring time does not, and `coin.py` / `voidspawn.py` / `flora_tree.py` / `blightthorns.py` are a proven free lane. So Meshy gets *only* the assets that are hard-to-impossible in code, and everything else waits and costs nothing.
>
> **Two canon facts do most of the sorting, and they both point AWAY from Meshy:**
> 1. **Seamless, jointless, never bricked or riveted.** Meshy is trained on human-made-looking objects — ask it for an ancient door and it returns panel lines, bolts and plank seams. For the Pyramid's OWN architecture it fights the brief on every generation.
> 2. **The greying is a MATERIAL SYSTEM, not a per-asset paint job.** Every surface wants one shared gold-in-veins / grey-between treatment with a "how far gone" dial. A baked Meshy asset freezes its own wear; a bpy asset inherits the shader. One material, N props.
>
> **💸 MESHY (paid) — only what code can't do:**
> | Prop | Why it earns credits |
> |---|---|
> | **The Vault's wooden door** | ★ **The single best credit spend in the list.** It is the ONE object in the Pyramid that is *not* the Pyramid's material — canon says wood, and wood grain / plank irregularity / age / hardware is exactly Meshy's strength and exactly what bpy is slow at. It is also the door players remember. |
> | **The throne** | A *made* object: ornate, irregular, character-carrying, and Lazerin-inflected rather than relic-material. Meshy's home ground. |
> | *(maybe)* **hero rubble chunks** | Irregular fracture is genuinely hard to author. But a broken piece exposes the material's interior, which the brief doesn't rule — settle that before spending. |
>
> **🆓 BPY (free) — everything else, and it's most of the list:**
> | Prop | Why code wins |
> |---|---|
> | **The airlock door** | Pyramid architecture (seamless — Meshy would rivet it) **and it must ANIMATE**: it closes, that IS the hazard. An animating door needs known geometry and a known pivot; a generated blob gives neither. A smooth veined aperture is also more alien than a sci-fi blast door. |
> | **The glyph** | It is *light*. Geometry is trivial, the emissive material is the whole asset, and it must be the only light source before the bell. |
> | **Wonder pedestal + 3 orbs** | Orbs are spheres; the pedestal is symmetrical. Straight **coin-family precedent** — ONE model, three finishes for the three Wonder categories (Mana Seeds / Gems / Knowledge Scrolls). That pattern already shipped once. |
> | **Ruined-city set pieces** | They must be **modular and repeat**. Meshy gives 6 bespoke unrelated chunks with forbidden seams baked in; bpy gives a kit off one material with the greying dial per piece. |
> | **The mana bell** | A surface of revolution — parametric in minutes — and it wants the relic's seamless material. |
> | **Guard plinths** | Repeated, symmetrical, three of them. |
>
> **Net: ~2 paid assets (~30 credits), not 60.** That is the honest read, and it is a *course-correct on the 08-05 morning list* which had the airlock door as the top Meshy buy — the material ruling landed after that list was written and moved it to the free lane. Remaining credits should go to props for OTHER lanes (arcade, Shimmer dead-grey props), not spent on the Crucible for the sake of spending.
>
> ### ⏸ ART LANE PARKED 2026-08-05 (Alex: "not worth holding us up") — resumable, nothing lost
> Concept refs are **locked in canon** (`athernyx CANON/design-briefs/refs/pyramid-*.png`, approved) and the door is **built and on disk**: `public/models/props/vault_door.glb`, 10k tris / 180KB, **unwired** (no Crucible props are placed yet, so nothing references it).
>
> **★ THE PIPELINE DEBT — `glb_optimize.py` HAS NO NORMAL-MAP BAKE, and that is why Meshy props read generic.** Measured on the door, not guessed:
> - The raw Meshy mesh (336k tris) has heavy iron straps with studs and real plank definition.
> - **The detail is GEOMETRIC, not textural** — proven by isolating the variable: 2048 texture at 10k tris is *identical* to 1024 at 10k, so texture resolution was never the problem. At **40k** tris the studs come straight back.
> - So the shippable build (10k/180KB) reads like a stock door, and the good build (40k/3.1MB) is unshippable — 40k alone is roughly the whole world's ~46k budget.
> - **The fix is the standard workflow the optimizer skips:** bake the high-poly's detail into a **normal map**, *then* decimate to ~6-10k. Free (Blender only), and it improves **every** asset through this pipeline, not just this door.
> - **Do this BEFORE spending more credits.** Every Meshy asset made without it throws away most of what was paid for.
>
> **💸 Credit correction (measured, supersedes the 08-05 morning claim):** image-to-3d cost **30 credits** (950 → 920). The earlier "image-to-3d is cheaper than text" was inferred from the code's one-task-vs-two structure and **never measured** — it does not survive the meter. The *accuracy* argument for image-to-3d still stands and is the better reason anyway: it locks the silhouette instead of paying Meshy to guess one from words.
>
> **Replicate:** ~$0.32 spent across 8 concept images; balance is **under $5** (that is what throttles it to 6/min, burst 1).
>
> **⚠ Still open before any Meshy spend:** do the Puppet Guards get physical constructs? They are "dead grey" and non-living, so the art-medium law puts them in the pre-render lane — but they are also *characters*, and character art is Alex's call, not a pipeline default.
>
> ### Files
> `world/tilemap.ts` › `CRUCIBLE` (TODO(crucible-floors), TODO(crucible-layout)) · `world/zones.ts` › `crucible` · `play3d/crucible-phases.ts` · `play3d/puppet-guards.ts` · `play3d/crucible-bots.ts`

## 🎯 Shimmer play3d — THE GOAL IS APEX (art-direction north star, Alex, 2026-07-22)
> **"Apex Legends — that's the goal in a nutshell."** Ruled during the meshy.ai/character-pipeline talk. The blockout
> world is SCAFFOLDING, not the aesthetic — the destination is Apex-tier presentation: real meshes, materials,
> lighting, rigged animated characters. Aligns with canon (`two-lines-two-games.md`: the web game = the movement lab
> toward the dark-half game; movement + map models are already Apex-lineage).
> - **What this changes:** stop benchmarking art against the blockout (the Gregory-blockout lesson — "on-style with
>   placeholder" is a non-goal). Character pipeline = **meshy.ai from Alex's art** (API into the picaso back half:
>   decimate/LOD/GLB/render-QA — that half is proven). Blockout-native art investments (per-zone charm passes) are
>   placeholder-era only.
> - **The ladder:** blockout (now, mechanics+layouts era) → dressed stylized (meshy meshes + textures + auto-rig
>   animate) → high-fidelity. Each rung gated on Alex's reference art + the runway; don't boil the ocean mid-pivot.
> - **What survives every rung:** the realm/chunk architecture, movement tech, map layouts, canon briefs. The ART
>   pipeline scales up; the bones don't change. (And Supra is the same destination on native metal when it wakes.)
> - **Open:** meshy paid tier ($10 first mo, commercial-private exports) + API key when the art era opens · target
>   reference set = Alex draws it · Gregory-blockout = interim NPC only.
> - **⏸️ ART ERA GATE HARDENED (Alex, 2026-07-22, same day):** *"game art is on hold until we get the hardware to
>   actually run Supra."* Picaso Gregory run STOPPED mid-final (6 iters + renders on disk at public/picaso-review/
>   gregory/, no GLB — salvageable if ever wanted). Don't start character/art workstreams — the north star above is
>   for STEERING (what not to over-invest in), not a build queue. Current lane stays mechanics + map layouts.

## 🎛️ Shimmer play3d — GRAPHICS QUALITY / GPU BUDGET (SHIPPED 2026-07-23, jin-cc) · *Last touched 2026-07-24*
> **✅ FIRING-RANGE LAG THREAD CLOSED (2026-07-24, Alex).** The localized range lag was a **transient GPU spike**,
> not a leak and not a code bug — it appeared only when the two heaviest draw loads stacked (moving TARGET DRIFT +
> HOSTILE HUNTER enemies + full-auto tracers all at once) and briefly pushed the UHD 630 over; it recovers on its own
> because it's overdraw, not growth. Alex re-tested 07-24, no lag reproduced. FiringRange code stays clean (pooled
> projectiles, instanced meshes, zero per-frame alloc). **Known lever if it ever bites again (do NOT do blind now):**
> tracer overdraw is the one thing that scales with fire rate — shorten `TRAIL_N` / cheapen the additive muzzle flash /
> faster tracer fade is a ~2-line cut with no look cost. Draw distance / fog / chunk streaming stay untouched (Alex).
> **Left off:** quality panel live on `:3200` (`0998a65`). Alex reported lag spikes in-game **and** in his terminal;
> root cause measured, not guessed — the client box's **Intel UHD 630 pegged at 96-98%** on its 3D engine. Everything
> else was clean: server load 0.17/5GB free, WSL idle (0.00, 11GB of 12), Windows host 8.3GB of 15.8GB free, Chrome
> ~0.76 of 12 cores, tailnet 15ms/0.665ms on resample. **Windows composites the desktop on that same GPU — that is
> why one bug wore two faces (game stutter + laggy terminal).**
> - **Why the scene is over budget:** MSAA + a **2048² shadow map re-rendered every frame across 14 castShadow
>   sites**. On an integrated GPU those are the expensive pair, because it shares system RAM bandwidth instead of
>   having its own. Multiplayer didn't break it — per-peer shadow-casting capsules + a drei `<Html>` nametag per peer
>   pushed an already-marginal frame budget over the line, which is why Alex read it as "started after multiplayer".
> - **Next:** Alex A/Bs on the elitedesk and rules on **MSAA off + shadows Soft**. Watch **worst-frame, not fps.**
>   If hitching survives that, next levers in order: per-peer `<Html>` nametags → peer `castShadow` → shadow-camera
>   range (currently ±40).
> - **✅ FIXED same day (`595f091`) — the autosave half.** `persist()` was **fully synchronous despite the `async`**
>   (localStorage is a blocking API), so `getItem` → `JSON.parse` → rebuild the whole save → `JSON.stringify` →
>   `setItem` all ran **on the render thread**, every 30s *and after every harvest*. Three changes: **mirror** the
>   last save in memory (no read-parse before each write), **dirty-check** the serialized payload (standing still
>   costs a compare, not a write), **defer to `requestIdleCallback`** with a 2s timeout (same work, no longer
>   mid-frame; calls coalesce so a harvest burst is one save). All 28 call sites unchanged.
>   - **Save-correctness rules baked in, because a save bug costs more than a hitch:** `newGame`'s
>     `persist({replaceFlags:true})` flushes **immediately** (destructive wipe; deferring risks old flags surviving
>     a tab close, and it is the only caller passing options so coalescing never merges intents) · `beforeunload` /
>     **`pagehide`** / unmount flush **synchronously** (a deferred save on unload never runs; `pagehide` covers
>     mobile background-kill, the phone-in-pocket case) · `saveRaw` now **reports success** and the last-written
>     cache only updates on a real write — **marking a failed write as written would make every later identical
>     save skip as a no-op, so one quota error would stop saving forever, silently** · a `storage` event drops the
>     mirror so a second tab's write is re-read, not clobbered by a stale `...prev`.
>   - Panel gained an **AUTOSAVE readout** (last save ms / size / writes-skips) so it is verifiable in play.
>   - **Not runtime-tested in a browser on purpose:** the automation tab shares localStorage *and* mp identity with
>     Alex's live tab, so driving it would risk his real save. Build + typecheck clean, new code confirmed present
>     in the served chunks.
> - **Decisions:** ▸ **A panel, not a tune.** Cutting MSAA/shadows is a LOOK trade and look calls are Alex's, so the
>   toggles ship beside a live readout and he rules from what he sees — not from my description of jaggies.
>   **Defaults reproduce the shipped look exactly**, making it a comparison instrument, never a silent downgrade.
>   ▸ **Worst-frame + hitches/sec get equal billing with fps** — a scene can average a healthy 55fps and still
>   stutter; one 180ms frame is the complaint and a 1s average smears it away. ▸ **Draw distance / chunk streaming /
>   fog deliberately untouched** — Alex asked directly whether range would change; it does not. That lever changes
>   what the world generates and is a different conversation. ▸ **dprCeiling() caps R3F's `[1,2]` default at 1.5 but
>   is NOT the desktop fix** — that display runs 100% scaling so `devicePixelRatio` is already 1.0; it protects the
>   phone. ▸ Settings load through an **allowlist**, so an unknown stored value falls back to the shipped look
>   instead of reading as `off`.
> - **Gotchas worth keeping:** `antialias` is a **WebGL context flag** and `shadowMap.enabled` needs every shader
>   recompiled → a quality change **remounts the Canvas** (`key={gfxKey(gfx)}`). Safe only because `posRef`/`camYaw`
>   live in the page component behind an `if (!posRef.current)` guard, so the player keeps their spot; pointer lock
>   does drop with the old canvas element. A `shadow-mapSize` prop **does not resize a map three.js already
>   allocated** — the light is keyed on the size to force reallocation. `PerformanceMonitor` uses `flipflops={3}`
>   settling at the floor, because a borderline GPU that **ping-pongs resolution reads worse than one running soft**.
> - **Files:** `play3d/gfx.ts` (new — settings, localStorage, `gfxKey`, dpr ceiling/floor) · `play3d/GfxPanel.tsx`
>   (new — in-Canvas `FrameProbe` + DOM panel) · `play3d/Shimmer3D.tsx` (Canvas key/dpr/shadows, keyed
>   directionalLight, HUD ⚙ button).

## 🗺️ Shimmer play3d — THE CONTINENT / REALM MODEL (SHIPPED 2026-07-22, jin-cc)
> **The Shimmer Garden is ONE open map now** — RS-style feel, Apex-style tech (Alex ruled it after the RS/Apex
> comparison talk). Live on :3200: 14 surface zones composed into a **456×304 continent** (`world/garden-world.ts`),
> cloud-mortar bands between districts, old zone-warps carved into walkable corridors, interiors (Voranyx Caverns /
> Gregory's / holds) stay doors. Chunked instanced rendering (64×64 + bounding spheres = real frustum culling).
> - **Left off:** composer `f1bdb01` + integration `d861e3b` deployed. Saves store LOGICAL zone+tile (layout-proof);
>   encounters/atmosphere/battles key by district under the player; world editor Save blocked (zones stay authoring truth).
> - **Next:** Alex walk-the-continent eye-pass → `LAYOUT_TWEAKS` nudges (spirit-meadow's two south doors disagree by
>   (80,22) → long corridor) · cloud-border dressing (mortar = flat clouds, wants banks) · corridor look · world-map UI.
> - **Realm model (the whole game's shape):** `{preload|stream}` per world — Garden preload (bounded IS canon: Gregory's
>   Bubble) · **Ather Wilds stream** (ever-growing by region files — the chunk layer is already the streaming core's
>   render half) · **Runehold stream** (Spirit Corner gate, canon; era + Lucernyx-at-the-seam rulings queued) · **Laz's
>   pyramid preload** (canon Crucible, `pyramid-zero.md`; lean = practice-Crucible in-frame first, no tonal-wall cost).
> - **Decisions:** zones stay authored-per-zone + composed at load (editors untouched, layout re-tweakable) · warp graph
>   = layout solver (placement derived, not guessed) · structures carry src* identity so chests/crops survive coordinate
>   translation · orphan zones route-mycelial-spirit / route-spirit-moonwell excluded (exits, no entrances — salvage or
>   retire).
> - **Files:** `world/garden-world.ts` (+`.test.ts`, 18/18) · `play3d/world-adapter.ts` · Shimmer3D chunked ZoneGeometry.

## 🏃 Shimmer play3d — MOVEMENT TECH (Apex model, researched + gameplan 2026-07-22, jin-cc)
> **The 3D walker's traversal system.** Grew organically as a room-wall side-track (never had a roadmap block — that IS
> why it tangled: fix layered on fix with no north star). Alex flagged it 07-22: *"the movement is getting worse the more
> we work on it… if I don't HOLD jump/space it still jumps to the right side."* Researched Apex Legends movement tech to
> get a real model instead of another patch.
>
> **★ ROOT CAUSE of the "jumps right" bug (found 07-22).** Jump, climb, and mantle are all wired to **Space-down state**.
> A normal jump tap holds Space ~5-7 frames — long enough that the loop reads every jump as a *climb/mantle-hold*. Near a
> wall the mantle grabs the wall's grid-cardinal and the pull-up settle (`hvel.set(card.x,0,card.z)`) shoves you ALONG it
> — wall to your east = a lunge to your **right**. The mechanics seat kept patching *which cell the mantle grabs*
> (`abd8ef0`, `731d01a`) but the real bug is upstream: **every jump is also a mantle attempt**, so no grab-direction patch
> can fix a mantle that should never have fired.
>
> **★ THE APEX LESSON (the fix is the input model, not the grab math).** Apex separates three inputs we conflated:
> **JUMP** = edge/tap, purely ballistic, grabs nothing · **CLIMB** = *hold forward INTO a wall* (deliberate) · **MANTLE**
> = contextual, auto over the ledge you're FACING, pulls straight up-and-over, never sideways. The whole distinction in
> Apex's wall tech is *"release forward = bounce, HOLD forward = climb"* — holding too long is what triggers a climb. Our
> threshold is missing, so a tap = a hold.
>
> **✅ SHIPPED 2026-07-22 (`148bd6c`, `5a19a71`) — Alex-approved feel:** (1) **input-decouple** — jump/climb/mantle
> no longer share raw Space-down; `spaceHeldT` + `CLIMB_HOLD_MIN=0.18s` gate: **tap Space = pure ballistic jump**
> (kills the sideways lunge), **hold Space = climb/mantle**. Auto-mantle rolled back. (2) **ledge-grab HANG** — reaching
> a lip no longer teleports you on top; you GRAB + hang (a real pause, `HANG_MIN=0.22s`), then press INTO the ledge to
> pull up+over via an eased `MANTLE_TIME=0.30s` climb-over (up-biased, never a snap), press AWAY to drop, neutral to
> keep hanging. Commit axis = wall cardinal (always straight over, never sideways). FEEL knobs atop `Shimmer3D.tsx`:
> `CLIMB_HOLD_MIN`/`HANG_DROP`/`MANTLE_TIME`/`HANG_COMMIT`/`HANG_MIN`. **So Tier 1 (clean jump) + Tier 3 (mantle/climb)
> foundations are DONE; remaining ladder below is the deliberate next work.**
>
> **The tech ladder (build in this order, each shipped + Alex-eyeballed on moonwell-glade before the next):**
> - **Tier 1 — Foundation (✅ clean ballistic jump done):** **slide**
>   (crouch at speed — have it) · **slide-hop** (jump near the END of a slide preserves+boosts horizontal speed, Apex
>   299→450) · momentum preserved through air (`airSpeed`, have it).
> - **Tier 2 — Air control:** **air-strafe / lurch** (redirect momentum by input+camera, magnitude-preserving; Source
>   air-accel) · optional **bunny-hop** (chain jumps to keep momentum, cap with fatigue if it gets abusable).
> - **Tier 3 — Wall tech (the tangled part — rebuild on the decoupled inputs):** **mantle** (contextual, faced-ledge only,
>   up-and-over along FACING cardinal) · **wall-bounce/wall-jump** (tap + release-forward off a wall = redirect+height) ·
>   **wall-climb** (HOLD forward into a wall to scramble up, capped — the `CLIMB_MAX_RISE` grip).
> - **Tier 4 — Skill ceiling (NOTE ONLY, do not build yet):** **superglide** (mantle→jump+crouch, ~1 frame @60fps) ·
>   **tap-strafe** (MnK scroll-wheel lurch stacking, PC-only). Leave headroom in the model; don't chase these now.
>
> **★ GAMEPLAN — decouple the three inputs (this is the actual fix, replaces all prior grab-cardinal patches):**
> 1. **JUMP = down-edge, ballistic only.** Climb/mantle NEVER read raw `k[' ']` / "Space is down."
> 2. **CLIMB = deliberate hold:** Space held past a threshold (~0.15-0.2s, a `spaceHeldT` accumulator) AND pushing forward
>    INTO a wall. A tap can't reach the threshold → can't climb. (This IS Apex's release-vs-hold line.)
> 3. **MANTLE = contextual + faced-ledge only:** fire only when airborne with a ledge you're FACING in reach; pull
>    straight up-and-over along the FACING cardinal, never a perpendicular wall cardinal. Open-air jump with no ledge
>    ahead stays pure ballistic.
> 4. **Then layer the ladder deliberately, one tier at a time,** feel-tested on moonwell-glade (`CLIMB_TEST` zone).
>
> **Decisions (don't relitigate):**
> - Movement FEEL is Alex's call — ship to moonwell-glade, he plays it, then iterate.
> - Target = **Apex/Titanfall momentum feel** (already the stated aim: the slide is commented "Apex-style"). Not a
>   floaty platformer, not a rigid grid-hop.
> - **Stop patching grab-direction.** Any "it dashed sideways" symptom traces to the shared-input root cause above; fix
>   the input model, not the cardinal selection.
> - Atmosphere/flora (`GardenAtmosphere`, `FloraDressing`) are a SEPARATE system — not the movement issue. Motes are a
>   possible lag source; check after movement lands.
> **Files:** `play3d/Shimmer3D.tsx` — FEEL consts ~L73-92 (`JUMP_V0`/`CLIMB_SPEED`/`CLIMB_STRAFE`/`CLIMB_MAX_RISE`/
> `MANTLE_REACH`/`WALLJUMP_*`/`WALL_COYOTE`), `Player()` physics loop ~L599-816 (wall-contact, climb, mantle, wall-jump,
> vertical). Test zone: `moonwell-glade` (`CLIMB_TEST` flag ~L88).
> **Research sources:** Apex movement tech (slide-hop, tap-strafe, wall-bounce, superglide, mantle input model) —
> BoostRoom + ProGuides + Alegends movement guides, 07-22.

## ✳️ Shimmer play3d — THE BIRTH RUNE → THE MOVE BOOK → THE CAST LAYER (v3 SHIPPED 2026-08-04, jin-cc) · *Last touched 2026-08-04*

> ### ✅ THE THREE SYSTEMS SHIPPED 2026-08-04 (`54eed46`+`83142ee`, live :3200) — **9 → 17 of 24 moves.**
> The 15 unbuilt moves did not want 15 one-off implementations; they wanted **three engines**. Each is
> a pure module (no THREE, no game refs) in the `puppet-guards.ts` / `crucible-phases.ts` mould, so the
> rules are provable headless — `cast.test.ts` is now **63 assertions**.
> - **SYSTEM 1 · `field-effects.ts` — a volume that keeps being true.** Firewall, Healing Grove.
>   Effects fire on a **1s clock, not per frame**, and a backgrounded tab **resyncs instead of
>   burst-applying** the ticks it missed (a stack of retroactive damage on unpause is a bug wearing a
>   feature's clothes). At the pool cap it drops the **oldest** — a cast you just paid mana for must
>   always appear.
> - **SYSTEM 2 · `conjured-terrain.ts` — terrain as CELLS, not meshes.** Stonewall, Living
>   Architecture, Cordon. ★ **The design call that made it cheap:** Shimmer's collision is already
>   grid-tile based, so conjured terrain is a set of tile cells + one predicate (`blockedAt`) dropped
>   next to every existing `WALL_ID` check. One rule ⇒ a slab blocks **the walker, the hunter, the
>   guards and every projectile**, with no second collision path to drift, and the zone's **authored
>   tilemap is never mutated**. A wall lays **perpendicular** to your aim (along it would be a corridor
>   you shot down); Cordon's ring is **asserted sealed on every bearing** and traps you too if you
>   stand in it — which is what makes casting it a decision.
> - **SYSTEM 3 · `statuses.ts` — removes an OPTION, never HP.** Shackle (root + disarm — canon names
>   both), Enlighten (blind). Re-applying **extends rather than stacks** (stacking is how CC becomes a
>   stun-lock) and a **shorter** re-apply can't truncate a longer one; a death **clears its target** so
>   a root can't survive a respawn. Blinded enemies still fire, just not at you — a flash-bang buys you
>   the fight, it doesn't end it.
> - **+ Flame Infusion** (`infusion`): the one cast that makes the **gun better** instead of doing what
>   a gun cannot. Resolved once per frame so every damage site reads the same number.
> - **Cordon is BOTH systems in one cast** — canon writes *"stone rises on every side AND all metal
>   locks to the caster"* in one sentence, so a `terrain` cast also applies its `statuses`. That's why
>   the dispatcher doesn't `else if` there.
> - **Every placed cast shares ONE aim resolution**: camera-forward **flattened to the ground plane**,
>   walked `castRange` from your feet. Flattening is deliberate — looking at the sky must not put your
>   Stonewall in orbit. A bolt, a firewall, a wall and a shackle all land by the same rule.
> - **★ THE BUG WORTH REMEMBERING (caught before Alex ever saw it):** fields/terrain/statuses are keyed
>   by **world coordinates with no zone on them**, and FiringRange only renders in an armed zone. So a
>   Stonewall raised in the range still occupied those tiles after a warp — an **invisible wall in
>   town**. All three now clear on `zoneId` change. *Anything keyed by world position needs a zone
>   lifetime, or it haunts the next map.*
> - **Canon reads pinned by the oracle** so a tuning pass can't quietly break them: Firewall **is**
>   cover / a grove is **not** · Enlighten takes aim and **never** HP · Shackle roots **and** disarms ·
>   **Grey Arena stays unbuilt for a CANON reason (manatech), not a build one.**
> - **Still unbuilt (7):** flame-barrage (homing volley) · gate (two-point bind + warp) · grey-arena
>   (canon-gated) · counterpoint + vaporscreen (need a 2nd mage) · bind-mastery + herbal-knowledge (no
>   combat behaviour). **None of them is blocked on a missing system any more** — they're each their
>   own feature, and two are canon-gated rather than ours.
> - **Files:** `play3d/field-effects.ts`, `play3d/conjured-terrain.ts`, `play3d/statuses.ts` (all new),
>   `play3d/cast.ts` (+4 archetypes), `play3d/cast.test.ts` (63), `play3d/Shimmer3D.tsx`.

> ### ✅ v3 SHIPPED 2026-08-04 (`7fd0ba3`, live :3200) — the correction is now IN THE CODE.
> The 08-03 course correction below described the model; `cast.ts` still shipped `birthRune → bolt`. This
> repoints the whole chain: **rune inventory → the book → a LOADOUT SLOT → an archetype.**
> - **`rune-inventory.ts`** — runes are an inventory. Birth rune is **#1 and unrevokable** ("you cannot
>   un-be born"); a returning keeper migrates off the legacy `ather:shimmer:birthRune` key with no rewrite.
>   Ships **no acquisition rules** — how you get a 2nd rune is still an [OPEN] canon gap.
> - **The loadout is TYPED BY CANON TIER** — `1 passive · 2 tacticals · 1 ultimate`, which is exactly the
>   authoring target the Magii pass is aimed at. Not four interchangeable holes: a held stance behaves
>   nothing like a signature, so the input says so. Bound **G / Z / X / C**.
>   ▸ **Digits are unusable here** — `HotBar` owns 1-6 for item quick-slots on a global listener.
>   ▸ `combo` is not a slot kind: canon needs a second mage in sync, so it can never be a solo bind.
> - **Archetypes built (4):** `projectile` (chains — Chain Lightning arcs to the 3 nearest in range at half
>   damage), `restore` (Mend), `surge` (Static Burst — a 2.5s speed window), `stance` (a held passive
>   **pauses mana recovery**, which is canon's mana economy and the whole reason a passive is a stance).
>   **Moisture Gathering is the written exception** — canon has it drawing water from the air, so it
>   produces its own slower trickle instead of the normal regen. Both lines true at once, still a downgrade.
> - **★ THE COLOUR LAW — v2 was drifting and nobody caught it.** `moves.md:5`: *"Colour is never part of a
>   move. Colour is the mage's own — their soul-frequency — applied when they cast it."* v2's CastSpec
>   carried the RUNE's glow, so two Storm-mages would run the same Chain Lightning in two colours because
>   of their rune rather than their soul. **CastSpec now has no colour field at all** (the oracle asserts
>   its absence) and bolts render `SOUL_COLOR`, same as the tracers.
> - **★ 9 of 24 — and the build SAYS SO.** Canon has 24 registered keeper moves; the sim can run 9. The
>   other 15 are `archetype: 'unbuilt'` **with a reason**, surfaced three ways: the cast bar dims + strikes
>   them, the key press toasts *"Firewall — not built yet (needs a persistent area entity)"*, and MoveBook
>   now separates **NOT YET LEARNED** (canon acquisition unruled — theirs) from **NOT BUILT YET** (ours).
>   A silent no-op is what makes a player think the game is broken.
> - **The playability consequence, deliberate:** roughly half the birth carousel now opens a book with
>   **nothing castable**. That is not a regression to paper over — it is the `moves.md` coverage gap made
>   visible at the exact moment a player meets it, and it is the argument for the P1 Water row pass.
> - **One `hurtPlayer()`** so a stance can't absorb one damage source and not another. Side effect: Wren's
>   returned hit now triggers the down/reset like every other hit (it used to leave HP at 0, run still live).
> - **Owner dev tool grants a SECOND rune** (menu ☰ → ✦ Rune (dev)) so the cross-hatch — Healing Grove,
>   Cordon, Flame Barrage — is playable before acquisition is ruled. Nothing in the game grants one.
> - **Gates:** `cast.test.ts` oracle **27/27** (written as a `tsx` oracle — this repo has no vitest, the
>   convention is `npx tsx <file>.test.ts`), keeper-moves **166/166**, canon-drift **6 CLEAN**, build clean.
>   The coverage assertion is the load-bearing one: **a newly authored canon move must be classified here
>   or the oracle fails**, so it can never fall through to a silent no-op.
> - **Files:** `play3d/cast.ts` (rewritten), `play3d/rune-inventory.ts` (new), `play3d/cast.test.ts` (new),
>   `play3d/Shimmer3D.tsx` (dispatch + binds + CastBar + stance plumbing), `play3d/MoveBook.tsx`.
> - **Next:** ▸ **Alex playtest** — do typed slots feel right, or should tacticals be interchangeable?
>   ▸ the 15 unbuilt moves want 3 systems, not 15 one-offs: a **persistent area entity** (Firewall,
>   Healing Grove, Grey Arena), **runtime terrain** (Stonewall, Cordon), and **AI status effects** (Shackle,
>   Enlighten, Flame Infusion). Building those three unlocks 8 of the 15. ▸ #294 real-time world enemies —
>   now unblocked, and the design warning stands: relocating PvE to the gun-legal side re-creates the
>   rune-vs-gun redundancy, so enemies need to be things a gun can't answer.


> ### ★ COURSE CORRECTION 2026-08-03 (Alex) — the birth rune does NOT decide your moveset.
> **"The birth rune sets the tone — the innate passive. It doesn't decide the tactical or the special."**
> v2 shipped `cast.ts` mapping `birthRune → bolt archetype`, which collapses identity into an attack: every
> keeper of the same rune fights identically and the rest of the rune system has nothing to do. It also
> explains the redundancy Alex felt next to the guns (a coloured bolt is a worse gun; Stonewall/Shackle/
> Cordon are things a gun *cannot* do). **v1 affinity was right and is untouched.**
>
> **The corrected model — a move list under each RUNE (Alex, 08-02/03):**
> - Birth rune = identity + passive lean, and it decides **which runes you can reach**, not which moves you get.
> - **Two lanes per rune** (a rune is Element × State): across your **element row** (5 runes, breadth ⇒ tacticals)
>   and down your **state column** (2-3 runes, scarcity ⇒ your signature). A 2nd rune opens a cross-hatch.
> - Moves come from `CANON/game/moves.md` — **already written**, ~24 of them, each with a rune requirement.
>   The book is **derived** by inverting that requirement; a two-rune move sits under both and unlocks only
>   when you own both = canon's runeword compatibility rule, free.
> - **Why it beat the flat registry:** indexing by rune exposed that 8 of 20 runes have ZERO registered moves.
>   The lane model absorbs it — no birth rune opens an empty book (worst case 3 reachable moves).
>
> **Shipped 08-03 (`f53084c`, build clean, gate 6 CLEAN, oracle 166 asserts):**
> - `play3d/keeper-moves.ts` — the 24-move registry transcribed from canon (name + runes + tier + effect,
>   **no numbers** — catalogue, not sim), `MOVES_BY_RUNE` derived index, `lanesFor`/`reachableRunes`/
>   `knownMoves`/`learnableMoves`, and `RUNES_WITHOUT_MOVES` surfacing the coverage hole instead of hiding it.
> - `canon-drift.mjs` **check 6**: an unregistered move = COLLISION, a rune-requirement mismatch = CONFLICT.
>   Negative-tested both (injected a fake move + a wrong rune, gate caught both, reverted).
> - `keeper-moves.test.ts` pins the canon mages against the lane model and **pins the two known breaks**.
>
> **⚠ The lanes are PROVISIONAL and gate nothing yet — [OPEN] canon gap (athernyx `f9afe2d`).** Canon rules
> *that* compatibility matters (`runes.md` §Developed Runes) but never *which* runes are compatible. Tested
> against the canon mages: holds for **5 of 7** developed runes — Eyuun (all three **Bind** runes, canon calls
> it his defining trick), Samantha (Fluid→Life = Flow state, →Freeze = Water element — both lanes in one mage),
> Kael (Static→Lightning, Storm). **Breaks on Veyra** (Star→Breeze) and **Lazerin** (Life→Illuminate), both
> *purpose-driven* acquisitions rather than natural growth. Do NOT wire progression to the lanes until ruled.
>
> **① THE BOOK UI — SHIPPED 2026-08-03 (`a5ac480`, live :3200 via coord).** `play3d/MoveBook.tsx`, ✦ in the
> HUD column. Opens on **your rune's page**, not a moveset. Two honesty rules held deliberately, both tied to
> open gaps: **(a) nothing is claimed as KNOWN** — acquisition is unruled, so the book is a *catalogue* and
> every entry reads `NOT YET LEARNED`; claiming otherwise would invent the scroll system in the UI.
> **(b) the lane grid is OWNER-ONLY** — showing element-row/state-column to a player asserts unruled canon
> on screen. The 4×5 grid draws the canon matrix with your row+column lit and **every move-less rune hollow**,
> so the coverage gap is visible in-game instead of buried in a table; empty pages say so plainly.
> *When Magii rules: drop the `isOwner` guard on the lane block, and swap `NOT YET LEARNED` for real state.*
>
> **Next:** ② repoint `cast.ts` from `birthRune → archetype` to **`loadout slot → move →
> archetype`** + a rune inventory where the birth rune is simply rune #1; the v2 cast *framework* (projectile
> pool, camera-forward aim, `tryCast` mana spend, cooldowns) is the correct delivery layer and stays.
> ③ still blocked on the same thing as last session: **the world has no real-time enemies** (moglin patrols are
> turn-based), so there is nothing in the regions to cast at — that layer is the real unlock (`#294`, P1).
>
> **Gap filed for Magii (athernyx `f9afe2d`, 2 `[OPEN]` blocks):** (a) is element-row + state-column the
> compatibility law, and is off-lane possible-but-costly? (b) keeper move coverage — **Water is starving**
> (Freeze 1, Fluid 2, Hydro/Mist/Vapor 0) and **Freeze/Fluid/Vapor reach no ultimate on any lane**; Lightning's
> only move is an ultimate; two of three **Scatter** runes are empty (Kael's lineage — deliberate or unwritten?).
> Proposed target shape per rune: ≥1 passive, 2 tacticals, 1 ultimate. **Jin does not write these** — a move
> registers in `moves.md` first (`engine/moves.ts` header law).

### v2 as originally scoped (superseded above — kept for the record)
> **Canon:** `CANON/game/shimmer-birth-rune.md` — "your birth rune is you" (ruled /magii + Alex 08-02). The birth
> ritual choice = the keeper's innate rune; first rung of birth→developed→mastery. Grant follows each rune's canon
> essence (`runes.md`). Boundary: rune identity + essence + lean-category = canon (Magii); numbers + cast = build (Jin).
>
> **Left off (v1 SHIPPED — `0a97d01`, live :3200):** passive affinity per rune via `birth-affinity.ts` (all 20 runes →
> {hp,shield,speed,gather,mana} from the essence→lean table). Defense (Barrier/Stone)→+shield cap (`hpMaxRef` mirrors
> `shieldMaxRef`); vitality (Life)→+HP cap; mobility (Breeze/Fluid)→+move speed; utility (7)→+harvest find/yield;
> offense (8)→+mana pool (v1 proxy — raw charge). Resolves on mount from `localStorage ather:shimmer:birthRune` +
> on choose; banner names the lean. Also this arc: the fresh-player crash fix (`ddd03bd` — instanced-mesh guards +
> Canvas error boundary) and the birth-owed-until-rune-chosen latch (`63233ff`).
>
> **Next — v2: THE CASTABLE WORD (scoped 08-02, Alex ruled the input model).** The birth rune becomes a real cast.
> Build ON the firing-range engine (instanced projectile pool + hit detection + mana spend + recoil already exist).
> - **Input (RULED): aim-and-fire on a cast key (e.g. F)** — hurl the rune where the reticle points, reusing the
>   range's camera-forward aim + projectile pool. No lock-on. Aim is the skill.
> - **Archetypes (build few, not 20):** projectile = all 8 offense runes (Star/Magma/Freeze/Hydro/Lightning/Tempest/
>   Dust/Static, per-rune color from `runes.data.ts`); ward = Barrier/Stone; restore = Life; surge = Breeze/Fluid;
>   utility (7) stay passive for now.
> - **Phases:** ① ✅ SHIPPED 2026-08-02 (`60436e7`, live :3200) — cast framework + projectile archetype (8 offense
>   runes) hitting the real-time layer (range targets + hunter), mana-costed via `tryCast`, cooldown-gated, bolt
>   coloured to the rune's glow. **G** casts; reuses the FiringRange engine (new `castPool` + collide + `cast.ts`
>   rune→archetype routing). · ② ward + restore · ③ surge + utility casts · ④ real-time casting vs overworld moglin
>   patrols (today turn-based battle triggers — separate combat-model call).
> - **Decisions:** ▸ real-time keeper combat lives only in `'outside'` zones today (the range), so MVP casting is
>   meaningful there first. ▸ offense runes' v1 +mana is the placeholder their v2 damage identity replaces. ▸ reuse,
>   don't rebuild — the range's `pool`/`shotRef`/hit loop is the template.
> - **Files (v2 target):** `play3d/Shimmer3D.tsx` (cast dispatch + input + FiringRange-shared projectile), a new
>   `play3d/cast.ts` (rune→archetype routing), `play3d/birth-affinity.ts` (already maps the leans).

## 🔺 Shimmer — THE CRUCIBLE AS A BATTLE ROYALE (match clock + bots + the Puppet Guards, jin-cc) · *Last touched 2026-08-03*
> **Alex sketched the mode; canon already had it.** `pyramid-zero.md` § Tournament Flow + `characters/elite-guards.md`
> specify the format, the floors, the hazard and the boss encounter. Almost nothing here was designed — it was transcribed.
>
> **The format is RULED, not chosen:** four sides × five entry points = **20 entrances**, **3 challengers each = 60**,
> teams of three, and the pyramid does not open until every slot is filled (*"Not enough"* is all it says when short).
> Floors: **L1 The City** (four chambers, ruined city, a glyph is the only light until the mana bell) → **L2 The Dawn**
> (one open area, permanent almost-daybreak) → **L3 The Throne** (the Puppet Guards; second bell = final five) →
> **The Vault** (Lazerin, the prizes — *not* a combat floor). Hazard = **airlocks close, pressure drops**. 5 min a floor.
>
> **Shipped 2026-08-03 (`614a587` + `bc6833a`, live :3200, pushed):**
> - **`crucible-phases.ts`** — the match clock as a **pure function of elapsed seconds**. No ticking state: renderer,
>   HUD countdown and pressure damage each derive independently, so they cannot disagree and a reconnecting client is
>   instantly right (same discipline as the burrow patrols). Every timing in one `TUNING` block, starting at canon's 5 min.
>   **Sealing is a warning carved OUT of the window, not extra time** — the floor still lasts exactly 300s; ascent stays
>   legal while cycling shut and dies the instant pressure starts, ramped so being caught is a scramble not a death.
> - **`crucible-bots.ts`** — fills to 60. Pure + deterministic (xorshift seed, **zero `Math.random`**: a lobby that
>   shuffles per-client is a desync waiting to happen, and a seeded roster is rebuildable instead of syncable).
>   **Parties are never split** (tested hardest — it'd be the mode's most infuriating bug); solo humans backfill squads
>   that already hold a human. Bot names are **built from syllables, never a canon list** — a bot wearing a real
>   character's name is accidental canon that detonates when that character ships.
> - **`puppet-guards.ts`** — **Seren** (holds the line, barriers that CLAIM ground) · **Cade** (flanks + traps, options
>   stripped) · **Wren** (counters, turns attacks back). Loop **squeeze → trap → counter**, box tightens each cycle.
>   Personality encoded as numbers: Seren's `guardThreshold` is lowest because canon says she won't raise a barrier
>   until the last possible moment. The **puppet tells ship as DATA** (empty pouches, pride with nothing behind it,
>   *"they don't bleed right"*) because canon makes that the payoff of a thousand-year foreshadow — it has to be
>   playable, not a comment. Pure step fn, provable headless.
> - **Wired into the FiringRange** behind the **T console → THE PUPPET GUARDS** toggle — the range is the combat lab and
>   the pyramid's floors don't exist yet. Bodies placed by ROLE, not by a chase heuristic; player rounds route through
>   `damageGuard()` so barriers blunt and Wren's counter returns **real** damage to the shooter.
> - 84 asserts across the two oracles. Build clean, canon gate 6 CLEAN.
>
> **⚠ MATCH SHAPE IS GAP-BLOCKED** (athernyx, `[OPEN]` 2026-08-03). L1's voice says *"only the last team standing may
> proceed"* — literally, ONE squad of 20 leaves the ground floor and there is no PvP above it, contradicting L2 and L3
> which both say *players* plural. Built the **timed-ascent** reading and the file says so; if the literal one is ruled,
> **`canAscendFrom` is the single function that changes.** Same gap also queues: level count (canon has 3 + the Vault,
> Alex sketched 4+a 5th phase), the finale (canon's three Puppet Guards vs Alex's swarm), and whether **anti-gravity**
> is real (canon only ever says *pressure drops* — and it's far cheaper than reworking physics).
>
> **Next:** ① **Alex playtests the guards** and calls the feel — phase length 7s, box shrink, Wren's 1.1s counter window
> are all first guesses in `GUARD_TUNING`. ② **`TODO(puppet-guard-art)`** — blockout capsules in dead grey ship today;
> the real look is Alex's (canon gives stances: armor that fits like it grew there for Seren, quality leather + hidden
> pockets for Cade, forgettable-by-design for Wren). ③ the guards need the **L3 floor** to actually live in — range-only
> today. ④ bots currently fill the roster but do not yet *play*; squad AI on the floors is its own build.

## 🔫 Shimmer play3d — CRUCIBLE COMBAT (weapon + damage + economy, 2026-07-22→24, jin-cc) · *Last touched 2026-07-24*
> **The Crucible = BATTLE ROYALE lane (Alex ruled 07-22; Apex is the north star).** The firing range in Alex's
> 50×50 is the combat lab. Three sessions in, the full loop + a two-weapon loadout + a movement ladder are live on :3200.
>
> **Left off (2026-07-24, jin-cc) — GUN BENCHES shipped: armory loadout editor + a 3-gun arsenal, live+deploy clean.**
> - **The loadout model (was fixed 2-slot Q-swap):** `loadoutRef[2]` holds a weapon idx per slot, `slotRef` = active slot, `weaponIdxRef` is now the DERIVED active index (`loadout[slot]`) so the sim/HUD still read one source. Q swaps the active slot; ammo is per-SLOT (`ammoStashRef[2]`). The bench-built loadout PERSISTS across Crucible visits (loadoutRef survives the leave-realm reset; only combat state resets).
> - **Arsenal grew to 3 (`WEAPONS`):** SPITTER (shortbarrel, auto) · LANCE (reacher, semi) · **REPEATER** (sidearm, semi — fast tight low-heat 12-clip, LEAST move penalty, the run-and-gun backup). Three distinct feels to test.
> - **Gun benches (the armory):** `GUN_BENCHES [x,y,z][]` (3 at the near/firing-line side, TUNABLE like RANGE_TARGETS — nudge y to sit on the floor) render as a **real GLB prop** — `gun_bench.glb` (Meshy image-to-3d off the /magii-ruled armory-bench concept `design-briefs/refs/armory-bench-1.png` → glb_optimize 489k→6000 tris, 17MB→0.21MB), through the shared `StationProp` pipeline (Suspense+error-boundary→blockout fallback, height auto-fit, Draco). Registered `gun_bench` in `PROP_MODELS`. Dead grey per the colour law; `yaw` tunable. (`<GunBenches/>`, mounts only in `realm==='outside'`.) Walk within `BENCH_NEAR_R` → "E — ARMORY" prompt (200ms posRef proximity poll) → E opens the loadout panel. Panel: two slot buttons (pick target slot) + the arsenal list (name/slate/mode/dmg/clip) → click a weapon to equip into the selected slot (fresh mag; live if it's the active slot). E/Esc closes via the shared cursor handoff. Q/F/T gated while the bench is open.
> - **NEXT{Shimmer Crucible bench PLACEMENT: GUN_BENCHES y=0 is a guess — Alex verify the 3 benches sit on the arena floor at the firing line (not floating/sunk); nudge [x,y,z] in the const. Also they may want to flank the actual spawn/firing spot better once seen in-world.}**
> - **NEXT{Shimmer Crucible arsenal — the two remaining fire modes (needs sim work, own sub-task): BACKBONE (longbarrel, 3-round BURST) + ROAR (breacher, SHOTGUN multi-pellet spread). Add to WEAPONS + implement burst (intra-burst cadence) and shotgun (K pellets/shot) in FiringRange; the bench already lists whatever's in WEAPONS. Then the full baseline rack (Spitter·Backbone·Roar·Lance·Repeater) is testable.}**
> - **NEXT{Shimmer Crucible bench on MOBILE: opening is E-key only (desktop). Add a touch opener (an A-button context action when nearBench, like the interact button) so the armory is reachable on phone.}**
>
> **Prior (2026-07-24, jin-cc) — MANABOX CANON BOUND (Magii RULED) — Spitter+Lance rename + colour law applied, live+deploy clean.**
> - **The weapon naming was a CANON GAP — settled by /magii (`game/pyramid-zero.md` › Manaboxes, athernyx `f21b58f`).** Key ruling: the Crucible does NOT cross the cozy-line wall — it IS the far/dark side (Year 1672, the Pyramid-Zero gunplay); the build's `realm 'ather'|'outside'` flag IS that wall, so manaboxes apply in full outside. Applied to the build:
>   - **Renamed to canon SLATE+MODEL:** `AM RISER`→**SPITTER** (shortbarrel/SMG, full-auto), `AM LANCE`→**LANCE** (reacher/sniper, single-shot). Both are the code-less baseline anchors from `game/weapons.md`. ("AM Riser" was a real canon model but a semi-auto *sidearm* — Samantha's holdout — so wrong for a full-auto gun; freed it.)
>   - **★ COLOUR LAW applied** (`game/weapons.md` opening line: *colour is never part of a weapon*): dropped the per-weapon tracer colours (cyan/amber). New module `SOUL_COLOR` (placeholder player-cyan until birth-rune picks the frequency) tints BOTH guns' tracers — one soul-colour across the loadout. Guns now read distinct by **round shape** (`headR`/`trailR` — fat Lance vs thin Spitter) + silhouette + fire behaviour, never colour. Viewmodels recoloured to **dead grey/bronze CAST metal**; only the emitter core glows `SOUL_COLOR` (canon: a manabox lights only in a hand). HUD badge name de-tinted (neutral steel).
>   - **Mana-clip = Manalic tier** — already canon-correct (runs off the wielder's own pool), no change.
> - **NEXT{Shimmer Crucible sigils/sockets = ITS OWN session (Alex + canon deferred). game/weapons.md has the full system — 14 sigils (SUR/VEX/JAH…), resonances (SIPHON/GHOST/ANCHOR…), socket cap ≤3 (sidearm ≤2), wielder-slot gating. Gun benches ship as slate/model swap FIRST; the socket UI comes in the sigil session.}**
> - **NEXT{Shimmer Crucible gun benches: build the practice-range armory — swap slate/model to test-fire. Starter rack = code-less baseline anchors: Spitter(shortbarrel)·Backbone(longbarrel)·Roar(breacher)·Lance(reacher)·Repeater(sidearm) per game/weapons.md. Named models (Drummer 47/M1 Anvil/XL9 Longshot) as later unlocks. NO sigil UI yet.}**
>
> **Prior (2026-07-24, jin-cc) — SECOND WEAPON + STOW-TO-RUN MOVEMENT LADDER shipped (build+deploy clean).**
> - **A `WEAPONS` table now drives the FiringRange** (slot 0 REUSES the old Riser consts so there's one source of
>   truth; slot 1 is new). Each weapon carries its own fire cadence, projectile, damage, spread/bloom, kick, clip,
>   reload, tracer look (color/head/trail), AND movement penalties. The sim reads `WEAPONS[weaponIdxRef.current]`.
> - **AM LANCE — the PRIMARY (Alex's "slow heavy mid-range piece").** SEMI-AUTO (one deliberate bolt per click, no
>   spray — a `firedThisPress` gate re-arms on release), fast fat GOLD round (`#ffce7a`, projSpeed 54), punchy 22
>   body / 34 crit, 8-round clip, 2.0s reload, heavy kick, laser when aimed (ADS 0.14°) but loose from the hip
>   (3.4°, so it REWARDS ADS). Reads instantly different from the thin cyan full-auto Riser. Placeholder viewmodel
>   (heavier amber SVG). **Canon weapon NAMES stay a Magii call** (per the Crucible note) — 'AM RISER'/'AM LANCE' are
>   working labels, not authored canon.
> - **★ THE MOVEMENT LADDER (Alex's "stow weapon to run faster") — holster > hip > ADS, per-weapon.** A weapon is no
>   longer force-drawn by realm alone; a `holsteredRef` + `weaponMoveRef` (ground-speed mult the Player folds into
>   `targetSpeed`, alongside the potion `speedMultRef`) give three speeds off RUN_SPEED 6.5: **holstered 1.0 (6.5,
>   full sprint) · Riser hip 0.85 (5.5) / ADS 0.55 (3.6) · Lance hip 0.70 (4.55) / ADS 0.42 (2.7).** Stowing is how
>   you reposition fast → the movement tech (slide-hop/bhop) finally has a job in a fight, and ADS is a real commit.
>   Slide/air bursts stay UN-penalized on purpose (holster-to-slide is the reward). `syncWeaponMove()` is the one
>   rule; recomputed on draw/holster/swap/ADS-down/ADS-up/Esc-unlock.
> - **Keys: `Q` swap weapon (also un-holsters) · `F` holster toggle.** Both inert unless drawn + no menu owns input.
>   Chosen because number-row 1-9 + wheel are the hotbar (potions in a fight), so weapon controls got dedicated keys.
> - **Per-weapon magazines:** `ammoStashRef[2]` parks the current clip and loads the other on swap (each weapon keeps
>   its own ammo). HUD badge shows the live weapon name in its tracer color + slot, or "HOLSTERED · running".
> - **★ TDZ trap avoided (the wrap's known trap):** the `weaponDrawn` reset effect is defined ABOVE `syncWeaponMove`,
>   so naming the helper in its dep array would crash at render — inlined the sync there instead. `as const` on
>   WEAPONS also poisoned `useRef(WEAPONS[0].clip)` into `MutableRefObject<24>` → annotated `ammoRef`/`ammoStashRef`.
> - **NEXT{Shimmer Crucible: Alex FEEL-PASS the two weapons + the movement ladder — Lance punch/clip/semi-cadence, the
>   holster/hip/ADS speeds (all dials are `WEAPONS[]` fields + `hipMove`/`adsMove` atop Shimmer3D). Then: does the
>   Lance want a distinct hunter-kill role, and is a 3rd weapon slot worth it or do 2 suffice for the BR feel?}**
>
> **Prior (2026-07-22 late, `2406732`):** the whole single-player combat loop shipped + Alex-approved:
> - **AM Riser = the SIDEARM** (Alex ruled: no two-shot deletes). Full-auto ~9/s, Apex muzzle model (spawns
>   low-right, converges on the crosshair ray @38 tiles; ADS near-center), thin comet tracers, spread+bloom
>   (hip 2.2° +0.45°/shot cap +2.6, ADS 0.25°), REAL camera recoil (no auto-return, fight the climb),
>   truth reticle (arms track the live cone), gold-tick hitmarker on crit.
> - **Damage (Alex's numbers):** 7 body / 11 crit. Player = 100 HP + 100 SH (200 effective); Barrier birth
>   rune wired as `shieldMaxRef` hook (+25 → 125, one-line hookup when rune selection lands). NO auto-regen —
>   mend potions only: Shimmer Salve +50 HP / Crystal Elixir +75 SH (both were already brewable in Alchemy;
>   granted via starter kit + one-time `mendKitV1` migration; new-game stays empty until Gregory).
> - **Ammo = MANA:** 24-round clip; recharge (R / dry-trigger auto) = 1.4s channel drawing mana (10/full clip,
>   partial proportional). Gather → brew → fight: one economy, nothing free.
> - **Bullseye boards:** targets are 3-layer instanced discs (white 0.6 / red ring / gold core 0.2),
>   yaw-billboard to the player, shrink w/ damage; crit = radial miss-distance inside the gold core (geometric
>   dead-center, teaches the zone visually). Hunter keeps height-based head zone.
> - **Range console (T, weapon out):** danger is OPT-IN (Alex vetoed the surprise firing squad) — TARGET DRIFT
>   (strafe anchors) · HOSTILE HUNTER (magenta octahedron: chase→orbit-strafe, amber orbs @2.2s, 35 HP, 4s
>   respawn) · RESET STATS. Holster = console closed + peaceful defaults.
> - **HUD:** SH/HP vertical percent bars right-center · ammo counter bottom-right · damage vignette · hitmarker.
>   All rAF-off-refs, zero React churn in combat.
> **Next:** ✅ weapon #2 DONE (07-24, above) · crucible arena layout pass (cover, lanes, verticality for the movement
> tech — now that stow-to-run makes the movement tech matter in a fight) · reload/holster polish riffs.
> **Parked:** birth-rune selection UI (hook is live) · player-vs-player (needs shimmer-server netcode lane) ·
> potion quick-use keybind if hotbar double-tap feels slow in a fight.
> **Decisions:** sidearm TTK intended (~29 body/18 crit vs full 200) · crit must be GEOMETRIC not RNG ·
> danger always opt-in on the range · boards = in-engine primitives NOT Blender (live billboard/instance/scale;
> picaso enters for baked hero props) · `T` console / `R` recharge / `c`+shift crouch untouched · **weapon slots on
> `Q`/`F` not the number row (that's the hotbar) · holster is the ONLY full-speed state, so stowing is a real
> tactical choice · slide/air unpenalized so movement tech rewards holstering.**
> **Files:** `play3d/Shimmer3D.tsx` — the `WEAPONS` table + old `AM_*`/`CLIP_*`/`RELOAD_*`/`HIP_SPREAD`/`KICK_*`
> consts (weapon-0 source) ~L1330-1400, `HUNTER_*`/`MAX_HP`/`MAX_SHIELD`/`BARRIER_SHIELD_BONUS`, `FiringRange()` sim
> (reads `weaponIdxRef`, semi-auto `firedThisPress`), `WeaponReticle`/`AmmoCounter` (read `weaponIdxRef`), `Player`
> `targetSpeed` × `weaponMoveRef`, page comp: `weaponIdxRef`/`holsteredRef`/`ammoStashRef`/`weaponMoveRef` +
> `syncWeaponMove`/`swapWeapon`/`toggleHolster` + Q/F keydown + the per-weapon viewmodel SVG.

## 👥 Shimmer play3d — MULTIPLAYER PRESENCE (LIVE 2026-07-23, jin-cc) · *Last touched 2026-07-23*
> **Shipped + verified end-to-end (`a7ef867` client, `33caddb` remount, deployed :3200):** see other
> players in the same world. Position + facing only; game stays client-authoritative, nothing else
> synced. Server = `shimmer-server` (FastAPI+WS :8400, running since March: instances, 15-cap, friend
> gravity); route = `wss://ather.games/shimmer-ws/ws` via the tunnel's REMOTE config (Cloudflare API —
> local config.yml is fetched-over, editing it does nothing). Zone key prefixed `play3d:` so 2D/3D
> never share an instance. 12Hz sends gated on actual movement; remote avatars lerp + hide after 12s
> silence; fails soft to single-player on any socket failure.
> **Verified:** MultiplayerLayer renders in-scene · WS joins `play3d:garden-world` through the public
> tunnel · bot-to-bot relay 24/24 moves with z/yaw intact (`scratchpad mp_relay_test.py` pattern).
> **The 07-23 "two unexplained bugs" postmortem (don't re-live it):** blockout-box props AND
> never-rendering MultiplayerLayer were ONE phantom — corrupted/mixed `.next` after stacked debug
> deploys; the browser ran chunks the server no longer had. `rm -rf .next` + one clean build fixed
> both with zero code changes. If a loaded chunk contains code that provably never executes, diff the
> served chunk hashes against `.next` on disk before debugging the code.
> **Testing gotcha:** a backgrounded Chrome tab freezes rAF = the whole R3F loop (movement, net send)
> is dead while hidden. Presence tests need a FOCUSED tab, or go headless bot-to-bot.
> **PLAY TOGETHER shipped same day (`561e9c6` client, shimmer-server `5a98ffb`):** party codes +
> invite links + names + live roster. 👥 HUD button → panel: editable name, start/join/leave party,
> copy invite (`?party=CODE` — stored, joined, stripped from URL). A party is a shared CODE not an
> account — DELIBERATE: player_id is client-claimed, a friends list is security theater until
> identity is server-trusted. Server keys `party_<code>__<zone>` (type 'party', invisible to zone
> matchmaking) so parties survive warps and strangers never bleed in. Socket hook lives in the PAGE
> comp now (panel + avatars share one connection); Scene takes `mpPeers`. Verified live: UI-created
> party BF63W, roster switched instances correctly, headless FriendBot joined the code and appeared.
> **Known wrinkle (deliberate):** two tabs in one browser share player_id → second connection
> shadows the first server-side. Fix belongs to server-trusted identity, later.
> **Two-device test PASSED 2026-07-23** (desktop + phone, party code, mutual visibility) after the
> keepalive fix: clients only spoke when MOVING and peers hid after 12s silence, so two players who
> stood still making the party were invisible to each other. Keepalive 4s + STALE_MS 90s (survives
> background-tab timer throttling).
> **RIGGED AVATARS: BUILT, SHIPPED, ROLLED BACK SAME DAY (713b83b → f3393e8, Alex on sight).** The
> Meshy auto-rig PIPELINE is proven and kept (meshy.py --rig: decimate-first → rig via data-URI →
> 22 joints + in-place walk/run clips, 5 credits, 12s) — the text-to-3d generated LOOK is what
> failed. **RULING: player/NPC/SPIRIT models wait for Alex's character art (image-to-3d + rig);
> Meshy text-to-3d = ITEMS/props only. Don't re-attempt characters from a text prompt.** Kept from
> the experiment: yaw+π facing fix (avatars had faced backwards since the capsule was born — nub
> too small to show it) and the verified no-root-motion check pattern (bounded hip ranges = in-place
> clip = no network-position drift).
> **Next:** items lane via the proven pipeline (first-person TOOL VIEWMODELS — axe/pickaxe/rod in
> hand — are the highest-visibility 'items' and answer the no-hands feel) · join/leave toasts ·
> friends-list question only IF codes prove insufficient — needs server-side identity + storage
> first (trade/party-sync/chat same gate, per multiplayer.ts SCOPE note).
> **Files:** `play3d/multiplayer.ts` (hook + protocol + party/name helpers) · `play3d/RemotePlayers.tsx`
> (avatars + useRoster) · `Shimmer3D.tsx` (PlayTogetherPanel + hook in page comp) · server
> `/root/shimmer-server/main.py` (party routing).

## ⚖️ Shimmer — PARTY BALANCE (measuring instrument built 2026-07-23, jin-cc)
> ### ⚠️ READ FIRST — THIS BLOCK MEASURES A BATTLE SYSTEM NOBODY PLAYS (correction, 2026-07-23 later)
> Everything below profiles **`engine/party-battle.ts`**, which is imported only by the old 2D
> `/play` page and the dev `BattleTester`. **`play3d` — the actual game — mounts `ArenaBattle`
> → `engine/arena.ts`** (`play3d/Shimmer3D.tsx:4017`). So the headline finding here (the "level
> cliff", ~5-6 hits per KO, the species league) describes a code path Alex never touches, and its
> prescription was aimed at the wrong file.
>
> **How it was caught:** Alex playtested and said the opposite of the sim — no difficulty problem,
> and fights of **15-20 hits**, not 5-6. Both halves of that were right, and the mismatch was the
> tell. The arena's real numbers, and the fix, are in the **ARENA PACING** block below.
>
> **The oracle itself is still sound** and worth keeping — but it guards `party-battle.ts`, so treat
> its output as informing the 2D path (and the shared `party-stats.ts` growth curve) only. Anything
> below about TTK, level sensitivity or species win-rates does **not** transfer to the arena.
> **Lesson: when a sim and the player's hands disagree, the player is the ground truth — go find
> out which code the hands were touching before trusting a single number.**
>
> **Started from Alex's question: "my Dewbear hit level 6 and I don't see much difference —
> how does the game decide what to increase?"** Answer: it doesn't decide anything. `addXP()`
> only increments `level`; stats are recomputed every read as
> `base × (1 + level/60) + seed × level/120` (`engine/party-stats.ts:57`). No growth-rate table,
> no per-level roll, no level-up moment. A stat rises by a flat fraction of its species base,
> so a Dewbear's Guard grows fastest only because 70 is its biggest number.
>
> **Left off (2026-07-23, `7c17653`, committed + pushed — nothing deployed, this is headless):**
> - **`engine/party-balance.test.ts`** — the oracle. Drives the REAL `party-battle.ts` turn loop
>   + AI under a seeded mulberry32 stream, so before/after tuning is the same dice with different
>   formulas. Run: `npx tsx src/app/shimmer/engine/party-balance.test.ts [--report]`.
>   Deliberately a `.test.ts`, not a `.sim.ts`: its ancestors `party-battle.sim.ts` +
>   `species-balance.sim.ts` were deleted 2026-07-09 for being print-only reports nobody checked.
>   This one asserts its own tables — invariants/resolution, mirror fairness, level-meaning in
>   BOTH directions, TTK band, species league.
> - **`KNOWN_GAPS`** records today's real failures so the gate is green-for-regressions instead of
>   always-red-and-ignored. A known gap that starts PASSING also fails the run, so the list can't
>   rot silently (it caught `species-floor:axolotl` on the first run).
>
> **Baseline it found (the numbers to beat):**
> - **The level CLIFF (the real bug).** ally lv20 vs enemy +0/+2/+5 = **45.0% / 1.5% / 0.0%** win.
>   Reproduces at 1v1, so it is NOT the focus-fire snowball — it is **short TTK**. Traced a fight:
>   ~5-6 hits per KO, so a ~13% per-hit edge (damage's own `(2L/5+2)` term, +8%, plus stat drift)
>   turns a 6-hit kill into a 5-hit kill = deterministic, not probabilistic. The higher level also
>   wins the AGI initiative sort every round. Mirror TTK shrinks 26 rounds (lv5) → 11 (lv50).
> - **Growth is invisible where the cliff is steepest.** Dewbear lv1→lv6 = +3 pwr, +2 foc, +2 agi,
>   +5 HP; its agi gains 1 point per 2.3 levels. Seeds (IVs 0-31) are worth ≤1.5 pts before ~lv30.
> - **The species league is not a league.** frog 89.1% · water-bear 77.4% · fox 73.7% · rabbit 72.8%
>   · turtle 55.0% · hummingbird 50.9% · bat 40.0% · axolotl 25.4% · owl 11.5% · firefly 4.1%.
>
> **Decision (why the tuning pass did NOT start):** one root cause — level scaling lives in the
> DAMAGE formula instead of in the stats, so the game is simultaneously invisible in the menu and
> hyper-sensitive in combat to the same 3 points. But fixing the cliff means giving small edges room
> to be edges, which means **longer fights** — and `HP_SCALE` was cut 1.6 → 0.85 precisely because
> 26-round mirrors were a slog (Alex). That is a feel call, not a math call.
>
> **NEXT — needs Alex's answer first:** buy TTK headroom back with HP, *or* hold TTK and flatten the
> damage level-term so the gap shrinks without fights getting longer? Then the pass: pull the level
> term out of `calcPartyDamage`, steepen growth to `1 + level/30` so levels read in the menu, add a
> level-up delta panel, retune the species floors (firefly/owl) and frog's ceiling — gating every
> step on the oracle's before/after.

## 🏡 Shimmer play3d — SPIRITS REST AT THE HOME PLOT (the "spirit bank", SHIPPED 2026-07-30, jin-cc) · *Last touched 2026-07-30*
> **Alex:** *"so the spirit bank next."* Shipped — but see the naming note, which is the important part.
>
> **★ THE REAL WORK WAS UNPICKING A CONFLATION, NOT BUILDING STORAGE.** `partyRef.current` was *"every
> spirit you own"* **and** *"your party"* at the same time. `Spirit.inParty` has been on the type since the
> archived 2D game and play3d **never once wrote it or read it** — the party cap existed *only* at fight time
> (`slice(0, MAX_PARTY)`). Everything that means "who fights" / "how strong are you" now reads
> `activeSpirits()`; everything that means "what do I have" reads the whole ref.
>
> **Three real bugs fell out of that:**
> - **A 5th spirit was silently permanent dead weight.** Bloom rewards appended unconditionally, so a spirit
>   past the cap was owned, fed, levelled and **never fielded**, with nothing anywhere saying why. Overflow
>   now rests at the Home Plot and the reward dialogue says which happened.
> - **The anti-softlock valve was about to hand out free revives constantly.** It keyed on the *active party*
>   being wiped — but with a healthy spirit on the bench there is no dead end to rescue anyone from, the
>   player just swaps. A party wipe with reserves is the ordinary outcome of a hard fight, not an emergency.
>   Keyed on **every spirit you own** now.
> - **I re-introduced the `every(isDowned)` gate bug** while rewriting that valve — it goes false the instant
>   the lead ticks off zero, stranding it a hair above nothing forever (the trickle skips the downed, and the
>   valve would have switched itself off). **The oracle caught it a second time.** The assert now names the
>   trap explicitly so the third person doesn't rediscover it.
>
> **Resting spirits mend `REST_REGEN_MULT`× faster** — that is what makes leaving a hurt spirit home a
> *decision* rather than a shelf: you trade a body in the lineup for a quicker mend.
>
> **★ THE NAME IS NOT JIN'S TO MAKE, AND WASN'T MADE.** Canon has **no word** for where uncarried spirits
> live — searched `glossary.md`, `game/shimmers.md`, `game/design.md`, `shimmer-storyline.md`,
> `shimmer-mechanics.md`, `shimmer-battles.md`, `spirit-tales-bible.md`: zero hits for bank / box / PC /
> stable / roost / storage. What canon **does** say points one way: spirits *"live in your garden"*
> (`shimmers.md:8`), *"Your garden where Spirits live"* (`design.md:169`), *"think Sonic Adventure Chao
> Gardens"* (`:19`), and the **Home Plot** grows as you free the holds with reformed Moglins joining it **as a
> facility** (`shimmer-storyline.md:65,117`). The **Grimoire** is for *knowing* spirits, pointedly against the
> collar's *owning* (`glossary.md:246`) — explicitly not a container. **A container word like "bank" reads as
> storage of property and cuts against the bond-not-own thesis the whole storyline is built on.** So the UI is
> **descriptive only** — `WITH YOU` / `AT THE HOME PLOT`, `Leave at home` / `Take along` — and **no proper noun
> was coined.** Logged `[OPEN]` in `CANON_GAPS.md` (athernyx `0d25c96`) for Magii to rule, **including whether
> 4 is the canon party size — that has never been ruled either.**
>
> **Legacy saves normalise on load** (`normalizeRoster`): everyone was flagged active however many there were,
> so the first `MAX_PARTY` stay and the overflow rests. Idempotent.
>
> **Verified:** oracle **+26 asserts** (roster moves, cap, never-empty-the-lineup, rest recovery, the valve
> correction) — all green. Canon gate 5/5. Browser-verified live on the real save: both columns render
> (`WITH YOU 1/4` · `AT THE HOME PLOT —`) and the never-empty guard correctly **refuses** on a one-spirit save
> without touching it.
>
> **Next:** **the two-spirit swap has never been exercised in a browser** — Alex has exactly one spirit, and I
> would not mutate his save to fake a second. First bloom reward proves it for real. Also unproven: the
> resting column with several spirits, and **mobile** (both columns become horizontal strips).
> **Files:** `engine/spirit-health.ts` (`activeSpirits`/`restingSpirits`/`setSpiritActive`/`normalizeRoster`/
> `REST_REGEN_MULT`, valve rewrite) · `engine/spirit-health.test.ts` · `play3d/PartyPanel.tsx` (two columns,
> rest/recall actions) · `play3d/Shimmer3D.tsx` (the conflation fix across 6 readers, bloom overflow,
> load normalise, `setSpiritActiveIn`, `setPartyLead` now takes a Spirit not an index).

## 🌗 Shimmer play3d — THE 64-MINUTE DAY (SHIPPED 2026-07-30, jin-cc) · *Last touched 2026-07-30*
> **Alex:** *"we should have a day/night cycle last 64 real minutes."* Shipped. Step 1 of the living-spawners
> arc (block below) — the clock lands first so the pacing can be judged before anything depends on it.
>
> **★ THE STARTING POINT WAS "THERE IS NO CYCLE".** play3d ran a **fixed sun** at `[18,26,12]` and flat
> ambient — permanently noon. `engine/day-cycle.ts` existed but **nothing imported it**: a 30-minute-day
> engine written for the archived 2D game (it returned *canvas overlay colours*), reachable only by the map
> editor rewriting one of its constants. So this was a build, not a retune.
>
> **Left off (2026-07-30, `b83c4a1`, committed + pushed + live :3200):**
> - **64 real minutes, and 2^6 is the point** — every subdivision a reset schedule might want (32/16/8/4) stays
>   a whole number of minutes. **Progress 0 = midnight**, so midnight and noon land exactly on 0.0 and 0.5:
>   the two moments the spawner layer will re-deal on. Verified — reset boundaries hit `00:00` / `12:00`.
> - **Derived from the WALL CLOCK, not ticked into state.** The world advances while the tab is closed, two
>   people in a party are in the same hour with nothing synced, there is nothing to persist or migrate, and
>   `resetIndex()` falls straight out for the spawner work. Trade: time is global, not per-save — right for a
>   shared garden (night should be night for everybody).
> - **`?hour=19` pins the clock.** Wall-clock derivation otherwise makes an art pass a 64-minute round trip;
>   this judges a whole day in a minute. HUD shows `PIN` so a pinned tab is never mistaken for a bug.
> - **HUD clock chip** (glyph + HH:MM + phase), self-ticking on its own 4s interval so the clock moving never
>   re-renders the walker.
>
> **★ CANON HAD ALREADY RULED THE LOOK, AND INSTINCT WOULD HAVE BROKEN IT.**
> `design-briefs/shimmer-garden-atmosphere.md` §"Day / night arc" (**RULED 2026-07-21, Magii + Alex**):
> **"night is NOT grey. It is a hue shift, not a drop toward grey."** Two axes that must stay **orthogonal** —
> time-of-day rides **gold ⇄ SILVER** (both poles fully mana-alive and saturated); tended-ness rides
> **colour ⇄ GREY** (alive vs drained). *If night desaturated, every evening would read as the greying and
> destroy the one signal the whole system carries.* So night = **the Moonwell hour**: canon silver rises
> garden-wide, gold banks to embers, **motes glow BRIGHTER against the dark** ("the world lighting its own
> lamps"), register is rest and quiet wonder — never menace. **The greying is time-invariant** (grey at noon,
> grey at midnight) which is exactly what keeps a *night* zone legible from a *drained* one.
>   - Implemented as **authored day/night palettes lerped per zone** — never an HSL darken. A generic
>     desaturate is the precise failure canon names, so this makes it **structurally impossible** rather than
>     a thing to remember not to do. Colours are the ruling; intensities are build tuning (the brief
>     explicitly leaves the **mechanism** to Jin).
>   - One directional light is **both sun and moon** (mirrored at the horizon) — one shadow map, and no seam
>     where a crossfade between two rigs would show.
>
> **Two things the browser caught that the maths could not:**
> - **First night pass was unplayably dark** — benches and chests read as near-black silhouettes. Legible as
>   "night", useless as a *place*, and against canon's cozy-safe register. The **hemisphere fill** is the real
>   workhorse at night (it lights the faces a raking moon misses); moon + hemi + ambient floor all lifted.
> - **★ THE PHASE LABEL DISAGREED WITH THE LIGHT.** Boundaries were declared as their own constants beside the
>   curve and drifted immediately: the HUD said **DUSK at 19:00** while `daylight()` had already reached zero
>   at **18:51**. Nothing crashed; the label was just a lie for an hour of every day. **Two constants
>   describing one thing always come apart — the one that survives is the one the renderer uses.** `getPhase`
>   now reads off the curve, and the oracle asserts agreement at **all 1440 game-minutes** (a few sampled
>   hours would have missed it — the drift sat entirely between round hours).
>
> **Seams:** dawn 05:00→07:11, day →16:49, dusk →19:00, night →05:00. Twilight ≈5.8 real min each side —
> the first band was ~1 game-hour, which is a light switch, not a seam.
> **Verified:** oracle **41 asserts** green (`npx tsx src/app/shimmer/engine/day-cycle.test.ts`) · canon gate
> 5/5 · browser-verified at noon / midnight / dusk on the live save.
>
> **Next:** **Alex feel-pass the pacing — is 64 minutes right?** (`CYCLE_MS`, and `TWILIGHT_LOW/HIGH` for seam
> length). Then the art pass via `?hour=` on the night palettes in `world/atmosphere.tsx`. Unproven: the
> **GREYING zone at night** (the Outfields — the time-invariance rule is implemented but never eyeballed) and
> **Moonwell Glade at night**, which should be the brightest silver in the game. After that, the spawner layer.
> **Files:** `engine/day-cycle.ts` (rewritten — clock only, no colour) + `.test.ts` · `world/atmosphere.tsx`
> (night palettes + per-frame blend) · `play3d/Shimmer3D.tsx` (`SkyLight` rig, `DayClock` chip).

## ☁️ Shimmer play3d — THE SPACE BETWEEN DISTRICTS IS TERRAIN (SHIPPED 2026-07-30, jin-cc) · *Last touched 2026-07-31*
> **Alex:** *"i edited the tunnel from spirit meadows to route 1 and it reverted back… the map toggle
> has a lot of black empty space."* Both true, same root cause.
>
> **★ THE MEASUREMENT THAT SETTLED IT — AGAINST ME.** I argued the gaps were "the look, not waste" and
> that zones were 73% painted so nothing needed changing. I was measuring zone INTERIORS; Alex was
> looking at the map toggle. Composed world = 456x304 = 138,624 tiles: **VOID 100,498 (72.5%), of
> which 94,607 outside every zone** · cloud WALL only 11,901 (8.6%) · real content 26,225 (18.9%).
> The black was not the cloud maze (a 3-tile rind) — it was bounding-box remainder nobody designed
> and nobody could edit. **Corridors are GENERATED** (an L-path re-carved from warp tile to landing
> tile on every load), and the per-zone save slices each district's rect, so an edit between them had
> nowhere to go. The old code detected exactly this and printed *"mortar/corridor edits are derived —
> not saved"*: the honest face of the bug, not a fix.
>
> **Shipped (`675be61`, `216ec23`, `61959f5` — pushed, live :3200):**
> - **Cloud SUBSTRATE** — every out-of-zone empty tile becomes cloud. The map reads as one cloudscape
>   with routes cut through it, and authoring becomes **subtraction**: carving through solid is work
>   you can finish; painting a maze into 94k tiles of nothing is not. A district's own authored sky
>   is left alone — that is a deliberate shape.
> - **World OVERLAY** (`world/world-overlay.ts` + `.json`) — sparse out-of-zone terrain, painted LAST
>   so a hand-carved route beats the generated one. World coords are the exposure (everything else
>   here is logically keyed and this cannot be, since it describes the space between the things
>   logical keys are relative to), so it carries a **layout fingerprint and FAILS CLOSED**: composer
>   paints nothing + logs, save route 409s, rather than mixing two coordinate systems. Saves **MERGE**
>   — one tunnel must not wipe every path carved before it.
> - **✅ PROVEN BY ALEX** — 1,003 overlay tiles written from his own editing session.
>
> **★ AND THEN I TANKED THE FRAME RATE WITH IT.** In play mode `voids` render NOTHING (the void layer
> is `editing &&`), so the substrate took wall geometry **11,901 → 106,508 shadow-casting boxes**, a
> straight 9x on what the frame loop draws. I flagged the risk when making the change and talked
> myself out of it with *"instanced meshes + frustum culling"* — true and irrelevant: **culling is per
> chunk-OBJECT**, so a saturated 64x64 chunk draws all 4,096 boxes into the main pass AND the shadow
> map. Alex hit it as lag within minutes. **Fix:** walls render at a FIXED height (they ignore the
> height map), so a wall boxed in on all 8 sides has no visible side face from anywhere a player can
> stand — a rounding error before, **94% of all wall geometry** after. Buried interior now draws as a
> flat top quad, out of the shadow pass: **6,765 boxes + 99,743 quads**, fewer shadow casters than
> before the substrate existed. Editor also got lighter (the clickable void grid went 100,498 → 5,891).
> **Then the fix itself crashed** — `WallTops` early-returned `null` on a chunk with no buried tiles
> (most small zones), and hooks run regardless of what render returns, so the effect dereferenced a
> null ref and took the canvas down. `Tiles` allocates `max(len,1)` and renders unconditionally for
> exactly this reason. **Lesson: an early return is not free in a component whose effect writes to
> its own ref.**
>
> **Verified:** 29 overlay asserts green (`npx tsx src/app/shimmer/world/world-overlay.test.ts`) incl.
> a **shell-size guard aimed at THIN cloud** (a stringy maze is nearly all surface and would tank the
> frame rate while passing every other check) · save handler tested directly (merge OK, 409 on moved
> layout, 400 on bad key, disk intact after rejects) · browser-confirmed map-toggle cloudscape + a
> clean load after the crash fix.
> **★ NOT verified:** the perf fix in Alex's hands — he crashed before testing it and stopped there.
> **Found (pre-existing):** loop mismatch `mycelial-path→spirit-meadow` off by **(80,22)** — which is
> why the corridor he picked is a long generated dog-leg and felt like fighting the map.
>
> **CLOSED OUT 2026-07-31 (jin-cc):** ✅ lag re-tested by Alex on the fixed build — gone (and serb ruled
> the server out independently; the WallTops crash log is clean since midnight). ✅ Alex's map work
> committed (`3b293d3`). ✅ **The `-1`→`34` suspicion was a REAL CORRUPTION BUG, root-caused + fixed +
> repaired:** world-mode save split the composed grid back to zone sources, but the corridor carver
> mutates zone interiors (L-path floor into authored voids, cloud flanking over edge-sky) and only warp
> cells were being restored — so ONE world-mode save baked composer artifacts into every zone with an
> edge corridor, zero edits needed. This was also the real story under the old "map save isn't
> sticking" report. Fix `57a8417`: untouched cells revert to authored truth (diffed vs composed
> baseline, same convention as the overlay diff). Repair `3409b78`: `scripts/repair-bakeback.mts`
> re-ran the composer on the pre-split-save baseline (ced2e7d) to enumerate exact artifact cells —
> 77 tiles reverted across 3 zones, 0 height contamination, all 358 human edits kept, connectivity
> proof green. **Tripwire: any future `tilemap.ts` diff Alex didn't author = reopen this.**
> **Next:** loop mismatch `mycelial-path→spirit-meadow` off by (80,22) (the generated dog-leg corridor)
> · resource nodes still cannot live outside a district (no slot key without a zone).
> **Files:** `world/world-overlay.ts` + `.test.ts` + `.json` (new) · `world/garden-world.ts`
> (substrate + overlay paint + fingerprint) · `save-map/route.ts` (overlay branch, merge + 409) ·
> `world-data/route.ts` (serves it) · `play3d/Shimmer3D.tsx` (overlay save, shell/buried split, WallTops).

## 🍃 Shimmer play3d — THE SPAWN BOARD: resources re-deal (SHIPPED 2026-07-30, jin-cc) · *Last touched 2026-07-31*
> Step 2 of the living-spawners arc — the **resource half**. The moglin half is next and is now canon-unblocked
> (see the burrow ruling below). Alex: *"each area gets authored spawn LOCATIONS, each location has a chance to
> spawn, the world resets and places a new set, resources fade out over their last ~3 minutes."*
>
> **Left off (2026-07-30, `bbdc6dc` + `60dfd1c`, committed + built + live :3200):**
> - **The board is DERIVED, never stored** — a pure function of `(worldSeed, windowIndex, authored locations)`.
>   Nothing is rolled at spawn time and nothing is persisted, which buys four things at once: the world
>   re-deals with the tab closed, two people in a field see the same clearing with nothing synced, there is no
>   save to migrate, and `?window=` can look at any board instantly. `Math.random()` at spawn time would have
>   forked the world per client and killed the multiplayer layer before it was written.
> - **Locations are the AUTHORED placements, not a new layer.** `world/node-placements.ts` is already Alex's
>   hand-tuned set (reachable tiles, harvest-stand positions), so every authored placement simply becomes a
>   *possibility*. The map editor keeps working unchanged and the board breathes over the top.
> - **Cadence = 2 per day, i.e. every 32 real minutes, on midnight/noon** — the two boundaries `day-cycle`
>   was built to land on exactly. Alex's phrasing was "every hour of live game time"; a game hour is 2.7 real
>   minutes, which re-deals the world mid-harvest. **THE pacing dial** (`RESETS_PER_DAY`).
> - **Keys are LOGICAL (zone-local), and the deal runs BEFORE the world remap.** Dealing after it would have
>   re-rolled the whole continent every time a district moved a tile. Same reasoning as the moglin cooldowns.
> - **Fade:** doomed nodes dim across their last 3 minutes (glow first, form only in the last third — a single
>   linear opacity ramp read as a rendering fault, not as the world breathing). Survivors of a boundary do not
>   move a pixel: `leaving`/`arriving` are read off the neighbouring deals rather than remembered, so there is
>   no flicker at the turn. A mid-harvest link is re-pointed across the boundary, or cut with a toast.
> - **The Home Plot and planting soil never re-deal.** Your own plot is what you tend (canon seeds it with a
>   specific pond + crystal pair), and a soil plot vanishing under a growing crop would destroy player state.
>
> **★ TWO BUGS FOUND, AND EACH ONE NEEDED A DIFFERENT INSTRUMENT.**
> - **The oracle caught the guarantee being one level too shallow — 193 times in 300 windows.** First cut
>   guaranteed a skill was *present*: if a zone authored fishing and the roll dropped every pond, one pond came
>   back. But Mycelial Path deals a level-4 shimmeroak and no level-1 goldwood, so forestry counted as present
>   and the guarantee never fired, while a level-1 player stood in a visible grove they could not touch.
>   **Being able to SEE the resource you are locked out of is worse than the zone being empty** — it reads as a
>   bug. The floor is now the zone's **entry tier per skill**, asserted over 300 windows against real placements.
> - **The BROWSER caught the pin moving the clock.** `?window=` set the window's start/end to that index's own
>   epoch, decades in the past, so everything measuring position *inside* a window read off a boundary long
>   gone: the HUD sat on RENEWING permanently and every leaving node computed a negative remainder and rendered
>   at **alpha 0 — invisible, in the one mode built for looking at them.** Outside a browser there is no pin to
>   take, so no amount of oracle would have found it. Split `windowAt()` out as the seam and asserted it.
>
> **Dev tools:** `?window=N` pins which board is dealt (clock stays live) · `?fadetest=1` runs every node
> through the dissolve on a 12s loop, so the look is judgeable in seconds instead of at the right minute of a
> 32-minute window. Same reasoning as `?hour=`.
> **Verified:** oracle **54 asserts** green (`npx tsx src/app/shimmer/engine/spawn-board.test.ts`) · `tsc` clean ·
> build clean · live on :3200 (HUD chips confirmed rendering in-browser).
> **NOT verified:** the fade and a re-dealt wild board **have not been seen in-world** — the camera could not be
> driven from the automation harness (three approaches, pointer-lock and drag-look both refused). This is
> Alex's eye-pass regardless, but nobody has looked at it yet.
>
> **Next:** ✅ Alex playtested 07-31 — "looks great." Moglin half SHIPPED (burrows block below). Remaining:
> **feel dials** only, when play surfaces them: `SPAWN_CHANCE` per type, `RESETS_PER_DAY` (is 32 min right?),
> `FADE_OUT_MS`.
> **Files:** `engine/spawn-board.ts` + `.test.ts` (new) · `play3d/world-adapter.ts` (`dealtNodesFor`) ·
> `play3d/Shimmer3D.tsx` (board state, `NodeFade`, re-deal tick, channel re-point, HUD chips) ·
> `world/resources.ts` (`leaving`/`arriving` runtime tags).

## 🕳️ Shimmer play3d — BURROWS: the moglin half of living-spawners (SHIPPED 2026-07-31, jin-cc) · *Last touched 2026-07-31*
> Step 3, closes the living-spawners arc. Canon (`game/shimmer-geography.md`, ruled 07-30): *"a burrow is a
> mouth, a hold is the hand behind it"* — collared moglins press in through burrows while the hold stands;
> free the hold and the tunnelling stops. Warrens/Gloview inviolate (they are simply never authored as
> spawners). Rates/placement/cadence were left to Jin and this block records those calls.
>
> **Left off (2026-07-31, `96c572b`, committed + pushed + built + live :3200):**
> - **The spawner placements ARE the burrows** — one authoring surface, same rule as the resource locations.
>   The mouth (warm earth mound + dark opening) always renders; while the hold stands it flies the hold's
>   gate-colored pennant.
> - **The patrol is a BODY on a walk now, not an invisible radius.** A lesser moglin walks a derived loop
>   around its mouth (`engine/burrows.ts`): waypoints ring the burrow at seeded angles, kept only if walkable
>   AND straight-line reachable (a body gliding through a rock reads as a bug — the oracle asserts it), with
>   look-around pauses and per-burrow phase offsets so neighbours never march in step. Boxed-in burrow →
>   the patrol idles at the mouth, slowly turning. **The fight triggers on the patrol's position**, so you
>   see it coming and choose the engagement; a half-emerged patrol is not fair game.
> - **Position is a PURE FUNCTION of wall-clock time** — renderer and fight-trigger derive it independently
>   and cannot disagree; two keepers watch the same moglin round the same corner with nothing synced. Same
>   trade as the board and the hour, for the same multiplayer reason.
> - **One clock: beaten = down for the rest of the current spawn-board window** (back at the next deal, avg
>   ~16 min, max 32) — replaces the stored 10-min real-time cooldown. The save shrinks from a timestamp per
>   spawner to `patrolBeaten: {key: windowIndex}`, self-expiring, pruned on write. Legacy `spawnerCds`
>   dropped on load (worst case: one patrol back one window early, once, at deploy). `?window=` pins
>   cooperate — beaten-under-a-pin holds within the pinned index, asserted.
> - **Hold freed → pennant comes down, the mouth quiets but stays** (a stopped burrow is not a corpse).
>   **After Brack falls, a reformed UNCOLLARED moglin sits by each quieted mouth** — "came to raid, stayed
>   to be neighbours." Canon permits it; the collar was the sin, so the reformed body has no collar.
> - **Render-caution violation FIXED:** the old armed-spawner blockout was a near-grey hunched lurker —
>   exactly the vermin read canon bans. New bodies are warm earth tones (`#8a6a48`), child-scale, rounded
>   ears; the hostile part is the gate-colored collar, nothing else.
> **Verified:** oracle **30 asserts** green (`npx tsx src/app/shimmer/engine/burrows.test.ts` — determinism,
> wall-clipping legs, teleport seams over a full lap, leash, beaten-record windows, pin) · spawn-board oracle
> still green · `tsc` clean · build clean · live :3200.
> **NOT verified:** nobody has SEEN a patrol walk in-world (same camera-harness limit as the spawn board).
> **Next:** **Alex eye-pass** — the-outfields has all 3 burrows (thistle/sorrel/brack gates); watch a lap,
> fight one, confirm it stays down and re-emerges next window (`?window=` to jump). Feel dials atop
> `engine/burrows.ts`: `PATROL_RADIUS` 3.5 · `PATROL_SPEED` 1.1 · `PATROL_PAUSE_S` 1.6 · `EMERGE_MS` 2.5s.
> Sprite rigs over the blockout when battle sprites land (Alex art). More burrows = map editor sp_* tools.
> **Files:** `engine/burrows.ts` + `.test.ts` (new) · `world/spawn-placements.ts` (cooldown const gone) ·
> `play3d/Shimmer3D.tsx` (`BurrowMarkers`/`BurrowWalker`, arming on the body, `patrolBeaten` save field).

## ⛅ Shimmer — THE WORLD PIVOT: regions as standalone maps (phase 1 SHIPPED 2026-07-31, jin-cc) · *Last touched 2026-08-03*
> **Alex's call, and it retires the stitched continent:** *"we kill the bunch of plots… each map can have
> its own spawn rate and available resource list… i can take my time and edit them."* Every stitching bug
> of the last two days (bake-back, corridor reverts, the (80,22) dog-leg, fingerprint machinery, the 72%
> void reveal) was a cost of the architecture this deletes.
>
> **Decisions (locked 2026-07-31, don't relitigate):**
> - Seven regions, each ONE map on a cloud canvas: **Home Plot + Moonwell Glade at 150×150; Spirit
>   Meadows, Twilight Thicket, Mana Springs, Voranyx Caverns, The Outfields at 400×400.** Authoring =
>   subtraction (canvas is solid cloud tile 34, carve land into it).
> - **Routes DIE**, folded into regions — minimap labels mark them later. **Gloview → Mana Springs.**
>   Threshold → Outfields. Mycelial + Wooded Trail → Twilight Thicket. Spore-hollow + Voranyx Deep =
>   Voranyx Caverns. **Travel = region transitions with a loading screen** (phase B).
> - Regions are **JSON, not TS literals** (400×400 literal ≈ 600KB source): RLE rows → 8-17KB/region,
>   plus the region's OWN nodes/burrows/warps/**spawn-dial slot** ("each map owns its resource list",
>   literally) and a `sources` transplant table (= cutover save-migration table + label anchors).
> - **WIP ids `r-<id>`** so regions live alongside the live world until cutover (5 of 7 canonical ids
>   collide with legacy zones). zones.ts untouched — createZone's surgery targets the file's LAST `]`.
>
> **Shipped (`c1e77e6`):** transplant script (re-runnable; refuses `sculpted` regions) · loader +
> all-zones aggregate · editors list regions FIRST ("sculpt these") · **regions never read the
> IndexedDB cache** (the stale-clobber landmine — server truth only) · save-map intercepts region
> grid/nodes/spawners/warps into the JSON (stamps `sculpted`) · play3d walks any region via
> `?zone=r-<id>` with spawn board + burrows live. Canon 5 CLEAN, all oracles green, legacy world
> untouched and still primary.
> **Next:** ① Alex opens `r-mana-springs` in the 2D editor — first sculpt session, ALSO the 400×400
> editor-canvas perf check (12,800px² canvas; dirty-rect optimization if it crawls). ② ✅ Phase B SHIPPED (`887c3e8`): arrival-at-region
> cinematic (fade → title → land under cover → fade in); interior doors stay instant; warp brush already
> targets regions, so exits = carve + drop a warp. ③ ✅ Per-map spawn dials SHIPPED (`bbd19a6`): abundance (literal fill %) ·
> richness (tier tilt) · re-deals/day {1,2,4,8} — SPAWN DIALS panel under the editor band readout, live
> via region-data, +15 oracle asserts (empty config proven byte-identical to legacy). ④ ✅ THE WALKABILITY PASS SHIPPED (`6e81a85`, 08-01): story layer
> transplanted (NPC/pickup/chest/structure region copies via sources, one world truth - ids shared), 42
> provisional exits derived from the legacy warp graph (Alex moves them when carving), save migration on
> load (absorbed zone -> same spot in region; routes self-heal via legacy), START_ZONE = r-home-plot, and
> the newWorldRef side-flag so interior exits land back in regions. Remaining cutover = deletions only:
> drop r- prefixes, delete stitcher + legacy zones + world mode when sculpts are ready.
> ⑤ ✅ **THE MORTAL SIDE IS PLAYER-REACHABLE (`d7050de` + `85203c8`, 08-03).** The 5 open canon gaps
> ruled at the /magii seat (athernyx `4a37038`) unsealed the Spirit Corner's street door — and opening it
> exposed that it led out of a room no player could enter. **NOT a region port, and that was the finding:**
> `spirit-corner`/`rune-hold` are INTERIORS and `build-region-canvases.mts` already holds them in
> `KEPT_INTERIORS` by design (regions warp *into* interiors, never absorb them). The real cause was a
> missing edge the code named itself at `zones.ts:74` — the Home Plot's north gate had been RELOCATED into
> Greg's owner-only test hub by `0e1e31b` while the crossing beyond it was an unruled gap. Right call then;
> the gap ruled, so the player half came back. Restored to its **original** tiles recovered from `e59a20c`
> (garden 14-15,1 → spirit-corner 7-8,10), `TODO(gate-placement)` kept — not a new placement call.
> **★ The interior-exit contract, don't "fix" it:** `spirit-corner`'s return warp names the **LEGACY**
> `garden` id ON PURPOSE. `newWorldRef`/`performWarp` migrate a region-world player to `r-home-plot`, while
> a `?zone=` player still lands in the legacy garden. Naming the region id directly strands legacy walkers.
> The region copy of the gate sits at the **derived** offset (ox/oy 59), computed exactly as the build
> script does for a kept interior, so a rebuild reproduces it instead of clobbering it.
> Verified by walking the warp graph from START_ZONE as a non-owner: **spirit-corner + rune-hold
> REACHABLE**; crucible stays owner-only (the firing-range gate — a build call, not canon).
> **⚠ Open for Alex:** the gate tile is **not painted** as a warp tile, so the door works (`checkWarp`
> matches coordinates) but shows **no gold marker** — unlike the old composed continent, the region path
> does not force-paint doors. Paint it with the MapEditor warp brush at region **(73-74,60)**, or move the
> gate; the tiles are the original *provisional* spot, not a considered one.
> **Files:** `world/region-codec.ts` + `world/region-maps.ts` + `world/region-maps/*.json` +
> `world/all-zones.ts` (new) · `scripts/build-region-canvases.mts` (new) · `dev/editors/MapEditor.tsx` ·
> `play3d/world-adapter.ts` · `save-map/route.ts` · `world/zones.ts` (the crossing + the restored gate).

## 🏡 Shimmer — PER-KEEPER HOME PLOT (stage 1 SHIPPED 2026-07-31, jin-cc) · *Last touched 2026-07-31*
> **Alex: "each player gets their own plot" — the plot is inherently different from the world zones.**
> **The load-bearing realization: it already mostly IS per-keeper.** Saves are per-browser, so strips/crops/
> placements diverge per keeper today — the seam is **template (authored source) + delta (the save)** and it
> existed before we named it. Stage 1 closed the two leaks (`0107619`):
> - **Presence: the plot is personal space** (canon: Greg's gate = *"a personal shimmer"*). No peer ever
>   renders inside the plot rect / garden zone-room — a keeper standing there is in their OWN plot. Symmetric
>   renderer-only rule (`RemotePlayers.hideAt`), no protocol change. Nameplate gates on React state because
>   drei `<Html>` is a DOM portal and ignores three visibility.
> - **Editor: garden = "Home Template (per-keeper)" optgroup** — authoring it is authoring the starting plot
>   every new keeper receives. Burrow brush REFUSED on the template (canon: burrows are dug OUTSIDE a plot).
>   Same commit-family: band readout ported to the 2D editor (`3ce1dcb`), burrow layer added (`e486ce0`).
> **Canon gap [OPEN] filed** (CANON_GAPS.md): how the world *narrates* overlapping personal plots (what a
> keeper sees at another's boundary) + whether visiting-by-invitation exists. Mechanics not blocked on it.
> **✅ STAGE 2 SHIPPED same day (`6d32d54`): the garden follows the account.** `saves` table in accounts.db
> (upsert per account+game, deleted with the account) · session-authed `/api/saves` (512KB guard) · debounced
> client push after every local save (session-gated; pagehide flush via sendBeacon) · **pull only ever fills a
> BLANK device — local wins when present**, so a stale cloud copy can never clobber live play; a blank device
> that turns out to be a returning keeper also closes the birth modal. Anonymous play untouched (localStorage
> only, as ever). Two traps: `/api/saves` was pre-gated owner-only in proxy.ts from the old deferred plan
> (would have 403'd every player — same lesson as /api/shimmerfile), and `_openAt` carried a trimmed schema
> copy that lacked the new table (schema factored to ONE const, two doors). Accounts oracle extended, green.
> **Same day: zone cleanup** (`a562e73`, Alex-approved): 10 fp/flat scale-test maps deleted via deleteZone
> surgery; KEPT test-sandbox (Beast/Player editor preview arena) + the 2 orphan hand-authored corridors (raw
> material for the (80,22) dog-leg fix — delete only once that's settled). Dropdown grouped: Home Template /
> World Surface / Interiors & Holds / Dev & Legacy (`49188b3`).
> **Next (stage 3, when Alex calls it):** visiting a friend's plot (needs the canon ruling for the register) ·
> ✅ roster "⛅ in their garden" SHIPPED (`e03fda8`, + r-home-plot personal-space gap closed) · wallet/magii
> could ride the same sync. **✅ THE PLOT SPIRIT RING SHIPPED (`d735e4e`):** resting spirits wander the plot
> as element-glow orbs (canon 07-30 ruling made real — "the ring the player FEELS"), greet (E) opens the
> party panel ON that spirit → the existing swap surface = the no-bank answer. Closes the old "bank play3d
> UI" open item the canon way. Burrow wander machinery generalized (WanderDials), burrows proven unchanged.
> **Files:** `play3d/RemotePlayers.tsx` (hideAt) · `play3d/Shimmer3D.tsx` (plotHide, cloud pull/push) ·
> `lib/cloud-sync.ts` + `app/api/saves/route.ts` (new) · `lib/accounts/db.ts` · `dev/editors/MapEditor.tsx`.

## ⏳ Shimmer play3d — LIVING SPAWNERS: hourly world reset (IDEA 2026-07-30 → ✅ FULLY BUILT 2026-07-31, both halves shipped — see the two blocks above)
> **UPDATE 2026-07-30 — the resource half is BUILT (block above) and the questions below are settled.** The
> clock question is answered by the day-cycle's design, not by a ruling: the reset keys on `resetIndex()`, so
> it is the in-game clock, global, derived from wall time, and the board is `f(seed, hourIndex)` — which
> answers determinism and offline advance in the same stroke. Reset-while-standing-there is covered by the
> 3-minute fade; mid-channel is re-pointed or cut cleanly. **Moglin burrows are RULED** (2026-07-30, /magii +
> Alex, `CANON_GAPS.md` → `game/shimmer-geography.md`): burrow-folk anatomy and the collar-incursion were
> already canon, a burrow is a mouth and the hold is the hand behind it, a free WARREN may never emit anything
> hostile, and rates/placement/counts are Jin's. **UPDATE 2026-07-31: the moglin half is BUILT too**
> (burrows block above) — nothing remains here; kept as the idea's record.
> **Parked deliberately, in Alex's own words, so it survives until we pick it up.** Raised right after the party
> panel; he asked to finish the bank first and come back to this. **Nothing here is built or ruled.**
>
> **The idea:** resources and moglins both work more like **spawners** than like fixed placements.
> - Each area gets authored **spawn LOCATIONS**, and each location has a **chance to spawn** — so a location is
>   a possibility, not a guarantee. Two visits to the same clearing aren't the same clearing.
> - **Every hour of live game time the world resets** — cleans the map and places a new set. The map breathes on
>   a clock instead of being a static board you strip once and never return to.
> - **Resources FADE OUT over their last ~3 minutes** before disappearing, so the despawn is telegraphed rather
>   than a node vanishing out from under you.
> - **Moglins get BURROWS they return to** — a home to patrol out from and retreat into, instead of existing
>   only as an armed-spawner blockout.
>
> **Why it's a good fit (Jin's read, not a ruling):** the current node layer is authored placements
> (`world/node-placements.ts`) that respawn on their own per-node timers, and the moglin layer is armed spawners
> with a 10min persisted cooldown (see the 07-22/23 wrap). This idea unifies both under one clock and makes the
> world feel *alive on its own schedule* rather than *reactive to the player's*. It also naturally solves
> route-farming: you can't memorise one loop if the board is re-dealt hourly.
>
> **The questions it raises, to settle BEFORE building (do not guess these):**
> - **What is "an hour of live game time"?** Wall-clock while the tab is open, accumulated playtime across
>   sessions, or the in-game `day-cycle.ts` clock? These give three very different games. A wall-clock reset
>   punishes a long session; an accumulated-playtime clock is the fairest and the hardest to persist.
> - **Does the reset run while you're standing there?** Nodes vanishing/appearing in view needs the fade to
>   cover it — and a moglin popping into existence 5m away is a jump-scare, not a spawn.
> - **Does it wipe a node you're mid-channel on?** The harvest link would have to survive or cancel cleanly.
> - **Offline/away:** does the world advance while the tab is closed (compute on load from a stored timestamp),
>   or only tick live? The first is much better and needs the reset to be a pure function of (seed, hour).
> - **Determinism:** if the layout is `f(seed, hourIndex)`, two players in a party see the SAME board — which
>   the multiplayer layer needs. `Math.random()` at spawn time would fork the world per client.
> - **Canon (Magii, not Jin):** do moglin **burrows** exist in the world's truth? A burrow is a place moglins
>   live, which is a lore fact about a ruled faction, not a placement detail. Likely a `CANON_GAPS.md` entry.
>
> **Next:** pick this up after the spirit bank. Start by ruling the clock question with Alex — everything else
> hangs off it.

## 🌱 Shimmer play3d — THE PARTY PANEL (P) (SHIPPED 2026-07-30, jin-cc) · *Last touched 2026-07-30*
> **Alex:** *"a seed icon/button next to the bag that we can bind to P, here we can have the spirit line up..
> so that the player can click each one to check out stats, moves, description."* Shipped, browser-verified live.
>
> **The gap it closed:** play3d had **NO spirit roster at all** — `hasStarter` is dead state (set, never read),
> and everything the game knew about your party was visible only for the ~30s it stood on a battlefield. You
> could raise a spirit for hours and never see a stat, a move, or a word about what it is.
>
> **Left off (2026-07-30, `85b3642`, committed + pushed + live :3200):**
> - **Seed button (🌱) beside the bag** in the bottom bar — green against the bag's amber, same 52/46px shape.
>   Carries a **wound-count badge**, so a hurt party nags from the bar without opening anything. `P` toggles;
>   state lives in `Shimmer3D` like `bagOpen` so the key, the pointer-lock handoff (`openCursorUI`) and the
>   button can never disagree about whether it's open.
> - **LINEUP borrows the arena team-card language** — element accent border, element dot, banded HP, Lv, DOWN —
>   so a spirit reads the *same* in the menu as it does mid-fight. Selected card takes the element glow.
> - **DOSSIER:** portrait + stats (7, absolute-is-the-hero per the level-up card's rule) + the **4-move kit with
>   descriptions** + XP toward next level + bond (with the *signature move at 50* note) + infusion lean + form
>   stage + **Raven's field note** from `public/grimoire/spirits.json`. **No lore authored here** — the panel
>   looks entries up, it never writes them.
> - **"next move at Lv N" / "next form at Lv N"** — the kit is level-gated, so a spirit sitting one level under a
>   new move is worth knowing about. Same function, asked about a later level.
> - **MEND / REVIVE per spirit** — the deliberate target picker, against the hotbar's auto-pick (worst-off).
>   **This answers the open question from the wounds session.** Reviving also mends with the same salve, or the
>   item is spent putting something on its feet at a sliver. Disabled at 0 salves with a brew-one hint.
> - **Make lead** — a wiped party recovers its **LEAD** (the anti-softlock valve in `spirit-health.ts`), so
>   lineup order is mechanically real now, not cosmetic.
>
> **★ ONE HYPHEN BLANKED THE DEWBEAR AND NOTHING ELSE.** The grimoire manifest's `analog` is *almost* the
> `Species` code — the game says `water-bear`, the manifest says `waterbear`. Portrait AND field note came back
> empty for the Dewbear while all nine other species rendered perfectly: the worst possible shape for a bug, and
> the Dewbear is the starter Alex actually plays. Both sides now normalise (`toLowerCase().replace(/[^a-z]/g,'')`)
> rather than trusting two files to agree about punctuation forever. Verified 10/10 species resolve.
> **Second polish catch, browser-only:** a starter named after its own species rendered *"Dewbear / Dewbear"*.
> The species line now shows only when it says something the name doesn't.
>
> **Verified live** at `ather.games/shimmer/play3d` on the real save: opens by button and by `P`, closes by
> `P`/`Esc`/scrim, portrait + field note render, MEND correctly disabled at 0 salves. Caught the wound feature
> working end-to-end in passing — XP 523→600 and HP 65/71→37/71 **survived a page reload**, and the out-of-combat
> trickle visibly ticked 52%→53%.
>
> **Next:** Alex eye-pass the layout (esp. **mobile** — the roster becomes a horizontal strip above the dossier
> on touch, untested on a real phone) · a party of >1 has never been seen, so card stacking + the lineup column
> at 4-5 spirits is unproven · **the bank has no UI here either** (spirits with `inParty:false` are invisible in
> play3d — swapping party members is the natural next panel) · `Spirit.heldItem` exists in the type but
> **`arena.ts` never reads it** (only the legacy 2D battle does) — a dead field the dossier deliberately does
> not show; wire it or drop it.
> **Files:** `play3d/PartyPanel.tsx` (new) · `play3d/HotBar.tsx` (`PartyBtn` + badge) · `play3d/Shimmer3D.tsx`
> (`toggleParty`, the `P` handler, `mendSpirit`, `setPartyLead`, `partyTick`).

## 🩸 Shimmer play3d — WOUNDS PERSIST (the healing loop, SHIPPED 2026-07-30, jin-cc) · *Last touched 2026-07-30*
> **Alex, 2026-07-30:** *"the level up looks good i can see the stats raise, but one thing we need is for the hp
> to carry over so the player needs to heal the spirit .. kinda forcing the player to grind resources and craft
> potions etc."* Before this, every fight built its fighters at full HP and threw the result away — a battle cost
> nothing but time. Now damage sticks, which is what turns gathering + alchemy from a side loop into the thing
> that funds the next fight.
>
> **Left off (2026-07-30, `9782119`, committed + pushed + live on :3200):**
> - **`spirit.hpFrac` — a FRACTION, not an absolute, and that is the load-bearing decision.** maxHp is derived
>   and grows with level, and the arena scales it AGAIN by `HP_MULT` — a live pacing knob that has already moved
>   once (1.8 -> 2.4 when base spirits gained real kits). Storing "47 HP" would mean the next pacing retune
>   silently wounds or heals every spirit in every existing save, and a level-up would quietly deepen the wound.
>   Same reasoning as storing logical zone+tile instead of world px. Optional in `SpiritSave`: a pre-wound save
>   loads at FULL, so the update that shipped this wounded nobody.
> - **`engine/spirit-health.ts`** — one home for the whole concept: read/heal/revive/field, the write-back, the
>   trickle. `engine/arena.ts` seeds `Fighter.hp` from the wound and returns a `BattleResult`; `Shimmer3D`'s
>   settle writes it before `persist()` **on the win AND lose paths** — the loss path used to short-circuit the
>   entire function, which would have made losing the cheapest way to fight.
> - **Downed = hpFrac 0.** Can't be fielded; ONE gate (`fieldParty()`) in front of all five fight-start paths.
>   A downed spirit also stops sharing the victory XP (rewards now iterate who actually fought, not the roster).
> - **★ THE BAG WAS A FREE 40% HEAL AND WOULD HAVE CANCELLED THE WHOLE FEATURE.** 80s lockout, but fights
>   resolve in ~20-35s — that is one free top-up per battle, forever. It now spends real Shimmer Salves out of
>   the satchel. The engine stays pure and oracle-safe: `bagCharges` in, `bagUsed` out, caller does the
>   inventory maths. **Unspecified = Infinity**, so the feel harness and every oracle are untouched by it.
> - **Shimmer Salve mends a spirit inside the Ather** (it already mended the Keeper out in the Crucible, where
>   that behaviour is unchanged). **Deliberately NOT a new revive item** — a bespoke revive potion means
>   inventing a NAME and, worse, a death-vs-downed rule the world has never stated. Downed is knocked out, and a
>   salve is what you give something knocked out. `CANON/game/alchemy.md` names only generic categories
>   ("Health Pot"), so the 13 potion names are build-side — but a new one is close enough to the line to refuse.
> - **Wounded-party HUD chips** — play3d had NO spirit roster at all (`hasStarter` is dead state), so wounds
>   would have been invisible until you were blocked from fighting. Chips are absent while the party is whole.
>
> **★ THE ORACLE CAUGHT TWO REAL BUGS IN THE ANTI-SOFTLOCK VALVE, AND BOTH WERE DESIGN, NOT ARITHMETIC.**
> The grind is only fun while a broke player can climb out, so wounded spirits trickle at 2%/min and a wiped
> party's lead crawls back to a 15% sliver. (a) The naive gate was "if the whole party is down" — which stops
> being true the instant the lead ticks off zero, so the sliver cap never actually held and the lead healed to
> full for free. Now gated on *every OTHER member is down and the lead is under the sliver*. (b) The valve was
> scaled off the general trickle, so `REGEN_FRAC_PER_MIN = 0` — a perfectly reasonable "wounds heal ONLY with
> potions" setting — would have made a total wipe **unrecoverable**. The valve now runs on its own constant and
> the oracle asserts it is independent and non-zero. **Exactly one spirit ever comes back free, and only far
> enough to walk.**
>
> **★ ARENA.TEST.TS IS FAILING ON MASTER AND WAS BEFORE THIS WORK — verified by stashing.** Skill delta
> **+5.0 pts** (block below claims +72.5), party passive baseline **13.5%** (claims 37%), skilled 47.5%.
> Output is byte-identical with and without this branch, so the wound work is balance-neutral — but something
> moved arena balance since 07-23 and nobody re-ran the oracle. Same family as every other "believe the
> measurement, not the note" find. **Someone needs to bisect that; it is not this feature's bug.**
>
> **Next:** Alex feel-pass the dials — `REGEN_FRAC_PER_MIN` / `WIPE_REVIVE_FRAC_PER_MIN` / `REVIVE_FRAC` atop
> `spirit-health.ts`, salve strength in `SPIRIT_MEND_POTIONS`. Open questions his call: should a wipe cost
> something beyond time (marks? a walk back?) · does the salve want a target picker instead of auto-picking
> most-wounded-then-downed · a rest/healer NPC as the sink for a full party restore (`restoreParty()` is built
> and unused, waiting on that call).
> **Files:** `engine/spirit-health.ts` (+ `.test.ts`, 61 asserts) · `engine/arena.ts` (`hpFracOf` seed,
> `BattleResult`, `bagCharges`/`bagUsed`) · `engine/potion-effects.ts` (`SPIRIT_MEND_POTIONS`, `MEND_POTION_ID`)
> · `spirits/spirit.ts` + `spirits/spirit-save.ts` (the field + round-trip) · `components/ArenaBattle.tsx`
> (`onEnd` widened, BAG button reads charges) · `play3d/Shimmer3D.tsx` (`fieldParty`, the settle, the trickle
> tick, the salve branch, HUD chips).

## 🎭 Shimmer play3d — ARENA ACTING + THE KEEPER LOOP REVIVED (SHIPPED 2026-07-31, jin-cc) · *Last touched 2026-07-31*
> **Two passes in one night, both live on :3200 and Alex-approved ("the acting feels good… looks and
> feels good").**
> - **Pass 3 — THE BODIES ACT (`1c2961c`).** The mirroring complaint was never the AI; capsules
>   couldn't act. Per-state execute body language wrapped around the sim's instant-execute (approach
>   beat rides the windup's tail so contact syncs with the damage event; follow-through rides
>   recover): solid=lunge-to-contact+snap-back · ignite=gather-up+slam-squash · compact=crouch ·
>   expanding=wind+spin-release · scatter=ragged-rattle · flow=current-rise · bind=thrust-held-pinned.
>   Hits SHOVE the body away from the blow, dodges ROLL into the sidestep, idle life on a seeded
>   per-fighter clock (breath, step bob, wounded sag) — no two spirits share a metronome, same law as
>   the personality fix. All on sim time (hit-stop freezes mid-lunge free). Renderer-only. Dials atop
>   `ArenaBattle.tsx` (`APPROACH_S`/`RELEASE_S`/`LUNGE_MAX`/`KNOCK_DIST`). **Sprite rigs later swap in
>   over the same state verbs.**
> - **BALANCE — oracle green after EIGHT DAYS RED (`6e08611`).** The keeper-skill band had been failing
>   since real kits (`86b2753`, 07-23) and nobody re-ran it. Three measured fixes:
>   (1) **Signature heavies** — heavy was `power>=60` and no L20-24 move reaches 60, so the whole
>   telegraph→react→interrupt loop *did not exist* at low-mid levels (flash never fired, no danger
>   rings, no brace). Every kit now promotes its top damaging move to heavy (stretched windup). Duel
>   skill delta **+5 → +75pts** (passive 2% / skilled 77%).
>   (2) **Contact moves track** — rooted windups made slow melee whiff into vacated space (water-bear
>   landed 1.6 of 9.2 casts, **0% vs the ENTIRE league** in a 1v1 round-robin); contact moves now
>   close at 0.85× effSpeed through the windup (anchor/fortify still gate). Wall league avg 9%→38% —
>   and the acting pass already renders the charge as the lunge.
>   (3) **Stat trims inside identity** (`party-stats.ts`) — frog was apex on BOTH axes (85% league):
>   60pwr/58agi → 56/52. Water-bear teeth for the short-fight regime: 34pwr/16agi → 46/22 (the
>   axolotl precedent). Bands now: party passive 39.5% (30-68) · party skilled 100% · pacing green ·
>   arena-moves 19/19.
> - **Method notes:** side-swap run proved species imbalance (B-team won from EITHER side), not a side
>   bug — and mirrors ≠ 50% there because the deterministic IV stream gives allies/enemies different
>   fixed rolls, so don't read mirror deviation as asymmetry. Hit-economy probe (casts vs hits landed)
>   found the whiff mechanism in one look.
> **Next:** league spread round 2 when it bothers Alex in play — owl 26% / frog 79% avg (no band
> asserts it) · sprite rigs over the acting verbs (Alex art, when battle sprites land).
>
## ⏱️ Shimmer play3d — ARENA PACING (the battle slog, fixed 2026-07-23, jin-cc)
> **Started from Alex playtesting: "TTK is more like 15-20 hits, I've been skipping since it's so
> dragged out."** That contradicted the party-balance oracle (5-6 hits) and the contradiction was
> the finding — that oracle measures `party-battle.ts`; play3d runs `engine/arena.ts`. Three real
> bugs sat under the complaint, all shipped fixed + deployed (`2d94e43`).
>
> **Left off (2026-07-23, `2d94e43` + `087535d`, live on :3200 — Alex FEEL-PASS pending):**
> - **Guard outscaled offence.** `GRD_K` was a flat `80` while `grd` grows with level, so mitigation
>   strengthened every level (L5 water-bear kept 71% of a hit, L50 kept 57%). Fights got **longer**
>   as you levelled, and a L50 tank mirror **stalemated outright** — zero KOs inside the oracle's
>   60s cap. `grdK(f)` now tracks the same `1 + level/60` growth factor the stats use.
> - **Level did nothing.** `Fighter.level` was literally commented *"display only"*; a +10-level
>   attacker killed 4% faster. Alex's "my L6 Dewbear feels the same" was true. Added `levelEdge` —
>   a **differential** damage term, so mirrors keep the tuned pacing and out-levelling reads as
>   reward. Slope is capped by the oracle, not taste: `0.05`/level made a 4-level gap a 1.5×
>   swing that skilled play could no longer flip, so it sits at **`0.025`**.
> - **The slog itself → `HP_MULT` 2.6 → 1.8.** Flat: a hit lands the same at 5s as at 45s.
>   **Took three attempts, and the two rejected ones are the lesson:** (a) nerfing guard
>   (`GRD_K_BASE` 80→120/200) + cutting HP hit the TTK but quietly dropped the party baseline
>   **38%→27%** — the ally team runs a tank, so nerfing guard nerfs the player. (b) `TIRE`
>   14s/+16%/s hit the TTK, went **fully green on every oracle band**, and **Alex rejected it on
>   sight**: *"it's almost like it forced it, with a super crit — it's ramping up the damage as the
>   battle progresses."* At that slope a hit at 40s is **5.2× an opening hit**. TIRE is a stalemate
>   backstop, not a pacing knob; it is back at 25s/+5%, where a duel ends before the ramp starts.
> - **Numbers now:** duel ~5.3 hits/19s · party 3v3 ~6.3/33s · worst case in the game (high-guard
>   mirror) ~13/48s · L50 mirror 0.96× the L5 mirror (was a **stalemate** — zero KOs in 60s) ·
>   +10 levels ≈ 17% fewer hits. Oracle: skill delta **+72.5 pts**, party baseline **37%** (vs 38%
>   on the original engine — the balance attempt (a) disturbed is intact), 100% resolved.
>
> **★ THE ORACLE WAS NOT REPRODUCIBLE, which is how all of this hid.** `createSpirit()` rolls IVs and
> temperament off `Math.random()`, so mulberry32 seeded the **fight** but not the **fighters**:
> identical constants scored a 33% party baseline on one run and 26.5% on the next. Every band is
> ~6 points wide in pure noise — wide enough to pass a tuning pass by luck, **and it did** (a config
> was accepted on a lucky run, then failed on re-measure). Combatants now roll off a deterministic
> stream reset per measurement; two consecutive runs are byte-identical. `party-balance.test.ts`
> already pinned seeds for exactly this reason — the arena oracle just never got the treatment.
> **Any oracle that builds its subjects with `Math.random()` is a coin flip wearing a lab coat.**
>
> **Also added: the `PACING` assertion block** in `arena.test.ts`. Fight *length* was never asserted,
> which is why a stalemating tank mirror sat green under passing win-rate bands. Now guarded both
> ways — no slog, and no fight so short the telegraph/dodge choreography never reads — plus
> level-drift and does-levelling-land asserts, so all three bugs fail loudly if they return.
>
> **★ AND: "was this fight decided by the FIGHTERS?" is asserted too** — the lesson from the
> rejected TIRE build. Every band passed while the feel was destroyed, because *a fight ending fast*
> and *a fight escalated to an ending* look identical in a win-rate or a hit count: the oracle
> measured **when** a fight ends, never **why**. It now checks the tire multiplier at the moment a
> normal fight resolves (must stay <1.5×), and that assert was **verified to fire on the rejected
> config** (duel 1.56×, party 3.03×) before being trusted. **An oracle only defends the properties
> it names — when a build passes every check and still feels wrong, the missing assertion IS the
> finding.** Write it before moving on, and prove it fails on the bad build.
>
> **NEXT:** Alex feel-pass the new pacing (dials: `TIRE_AT`/`TIRE_RAMP` in `arena-moves.ts`,
> `LEVEL_EDGE_PER` in `arena.ts`). Then the **level-up card** Alex asked for — banner + stat deltas
> ticking + new moves named, since growth is still invisible in the menu even now that it lands in
> the fight. **Known, NOT fixed:** `arena-moves.test.ts`'s "fast evader dodges ≥2× the wall"
> assertion fails on the *original* engine too (3.9% vs 2.9%) — the agi slope can't produce a 2×
> differential; separate issue. **No EVs exist** — IVs (`seeds`, 8-31, rolled once at generation)
> and temperaments (natures) are in, but nothing tracks what you battled; PokéAPI is the reference
> if we build them.
> **Files:** `engine/arena.ts` (`grdK`/`levelEdge`), `engine/arena-moves.ts` (`TIRE_*`),
> `engine/arena.test.ts` (determinism + PACING).

## ⚔️ Shimmer — BASE SPIRITS LEARN A REAL KIT (2026-07-23, jin-cc) · *Last touched 2026-07-23*
> **Alex:** *"give base spirits a real kit — the spirits base level should start at 3 when they first
> bloom, from there to 34 they should have a variety of moves to learn"* + *"carry the kit over, but
> lets remember evolution is like a prestige event."* Shipped + deployed (`86b2753`).
>
> **THE FIND:** element moves were gated behind `element !== 'base'`, and a spirit only gains an
> element by evolving at **level 34** — while the shipped continent bands at **levels 2-22**. So every
> spirit in the playable game held exactly two moves (Mana Pulse + Spirit Ward) and **73 of the 75
> moves in `engine/moves.ts` were unreachable**. Not a likely cause of samey fights, THE cause.
>
> **THE RULE — raw vs runed.** A base spirit cannot hold a rune, so it channels registered moves
> **RAW**: full power, forced `neutral`, no STAB and no matchup multiplier. On evolution the same
> moves express their true runes. Evolution does not hand you a new list, it **ignites the list you
> built** — which is how carry-over and prestige coexist, and it makes a base-kit pick you made 20
> levels earlier pay off differently depending on what you evolve into. Canon backs all of it:
> `CANON/game/moves.md` is caster-agnostic ("the caster supplies medium, colour, and potency") and
> hands progression to the build in as many words. **Zero new move names invented; none may be.**
>
> **Left off:** learnset live, 69 of 74 moves reachable, bloom level 1 -> 3, curve at 5/10/15/22/29.
> **Next:** the arena re-tune below (Alex feel call) · player-chosen kit slots (the 4-move kit is
> auto-selected as Mana Pulse + 3 most recent, so there is variety across species but no player
> choice — needs a `knownMoves` field on Spirit + save migration) · a home for the 100%-proc anchors.
>
> **⚠ THE ONE RED, NOT FIXED — `arena.test.ts` win-rate bands.** Every fight-LENGTH assertion passes
> now (the L50 tank mirror resolves, level drift is gone), but **a fox cannot beat a 4-level-higher
> frog at any Keeper skill (0% both policies), and the 3v3 party baseline is 2% against a 40-60%
> band.** Those bands were calibrated when both sides fought identical two-move kits, so level and
> stat gaps expressed weakly; real kits make them decisive. **`HP_MULT` does not move it — 0% at
> 1.8, 2.0 and 2.4 alike — so this is NOT a pacing knob, it is the level cliff** that
> `party-balance.test.ts` has carried as a known gap since 07-22. Needs a real arena re-tune.
>
> **★ FOUR BUGS THE ORACLES CAUGHT IN MY OWN TABLES, each now an assertion so it cannot return:**
> - **Two stacked utility picks** left water-bear's lv19-24 kit with one real strike. The ally party
>   *tanks with that species*, so that alone dropped the arena party baseline **38% -> 9.5%**. Rule:
>   one utility pick per species, never before lv15. **A damage-move COUNT is not a damage floor** —
>   the first version counted the pinned 40-power Mana Pulse and read green on a kit that could not
>   kill anything.
> - **A pwr-debuff capstone on the tank** meets its own mirror, where both sides floor each other's
>   power behind stacked guard and **the L50 fight never resolves** (0.0 hits in 60s).
> - **The 100%-proc anchors** (Mana Seal, Static Cage, Root Grip) are evolution-tier control, not
>   something a lv19 spirit holds. Pulled from the base pool — and now unreachable, no tier grants them.
> - **Still-Breath was diluting every low-level kit.** A power-0 move sitting in the combat kit from
>   lv5-18 left a spirit ONE useful move in three. It now leaves the learnset and is granted by
>   `createReachBattle`, which *also* makes the Reach mechanic kit-independent — it can no longer
>   rotate out and strand a collared spirit. Strictly better than where it started.
>
> **★ THE CURVE STARTS AT 5, NOT 9 — kit size now varies with level, and flat HP cannot serve both
> ends.** With the first strike at 9, a lv5 spirit fought with Mana Pulse + Spirit Ward and the lv5
> tank mirror burned 58s of a 60s cap. Tuning `HP_MULT` up for 4-move fights drags the 2-move ones
> badly; getting a real strike in early is what closed the level-drift assertion, not the HP dial.
>
> **★ UNEXPECTED WIN — the species league flattened.** `party-balance.test.ts`'s `species-ceiling:frog`
> and `species-floor:owl` / `:firefly` known-gaps now **PASS** and were retired. That league (frog
> 89.1% · firefly 4.1%) was measured when NO spirit had a moveset, so it was reading pure stat-blocks
> with nothing to express or offset them. **A balance number measured on a stub measures the stub.**
>
> **Files:** `engine/base-learnset.ts` (the tables + the rule, tunable), `engine/base-learnset.test.ts`
> (new oracle: id resolution, damage floor, utility budget, raw/runed contract, evolution payout,
> variety), `engine/moves.ts` (`getMovesForSpirit` rewrite, `ELEMENT_MID_LEVEL` 34 / `ELEMENT_HIGH_LEVEL`
> 45), `engine/battle.ts` (reach grant), `engine/arena.ts` (`HP_MULT` 2.4), `spirits/evolution-config.ts`
> (`bloomLevel`), `spirits/spirit.ts`.
> **Note:** `BASE_LEARNSET` names moves by **id**, not const reference — `moves.ts` imports this file,
> so a const read at module scope is a TDZ crash on import order. The oracle asserts every id resolves.

## 🗺️ Shimmer play3d — AREA LEVEL BANDS + SPECIES ECOLOGY (2026-07-23, jin-cc) · *Last touched 2026-07-23*
> **Alex:** *"level cap on spirits per area — moonwell pass 3-5, spirit meadows 7-8 — as well as only
> certain species spawn in certain areas, kinda like where you'd expect to find a Manalotl and
> Croakling would be the mana springs."* Shipped + deployed (`9444685`).
>
> **The bug under the ask: levels were OFFSETS FROM THE PLAYER** (`levelRange: [-2, 1]`), so every area
> re-levelled itself to whoever walked in. Out-levelling never paid — the starter route scaled up to
> meet you, deleting the reward for progress (**the same complaint as "my L6 Dewbear feels the same",
> one layer up**) — and the map had no shape, so *"go north when you're ready"* could not mean
> anything. **Bands are ABSOLUTE now**; `rollEncounter` no longer takes a player level at all, and
> that is asserted so it cannot quietly come back.
>
> **The world, by level** (`levels: [lo, hi]` per zone — one edit to retune):
> ```
> moonwell-glade  2-4 · route-garden-mycelial 3-5 · route-moonwell-garden 3-5 ←ALEX
> mycelial-path   4-6 · spirit-meadow 7-8 ←ALEX  · sorrel-hold 7-9 · wooded-trail 8-10
> twilight-thicket 9-11 · mana-springs 11-13 · spore-hollow 13-15 · voranyx-deep 15-18
> brack-hold 17-19 · the-threshold (Ather Winds) 19-22
> holds: Thistle Lv 7 · Sorrel 6/7/6 · Brack 19/18 + 3× Lv 17
> ```
> **Alex's shape for bosses: at or just UNDER the local band** — the gatekeeper of a region, not a
> spike. Hold 1 stays ONE collared captive (his call, keeps the canon liberation beat) rather than
> becoming a squad. **The holds were player-relative too** (`Math.max(6, partyLevel) + 2`) which made
> the arc literally un-outrunnable; pinned in `HOLD_LEVELS` beside the bands they must agree with.
>
> **Species by CANON affinity.** `SPECIES_AFFINITY` transcribes the Element Affinity column of
> `CANON/world/spirits-species.md`; `ZONE_ECOLOGY` declares what each landscape supports; a species
> may only appear where its affinity fits. Mana Springs = Manalotl + Croakling; the Voranyx caverns
> honour canon's one habitat line (*"Cavern | Earth | Noctyx | Cave dwelling"*); Ather Winds is
> Storm's. **Canon rules affinity but NOT habitat**, so distribution is a build call derived from
> canon rather than invented against it — gate stayed 5 CLEAN.
>
> **★ THE ENCOUNTER EDITOR WOULD HAVE SILENTLY WIPED ALL OF IT.** `save-map/route.ts` regenerates the
> whole `ENCOUNTER_TABLES` block from the editor payload and still emitted the old per-entry
> `levelRange` with no zone band — **the first editor save would have flattened every band back to the
> old shape.** Same family as the `node-placements` duplication that broke master the same morning: a
> regex writer nobody re-checked after the data model moved. **When you change a data model, grep for
> who WRITES it, not just who reads it** — readers fail loudly at build time, writers corrupt silently
> at runtime. Editor + writer + field-types all moved over; the writer now documents that it DESTROYS
> every comment in the block, which is why the ecology contract lives in consts *outside* it.
>
> **Files:** `engine/encounters.ts` (bands, `SPECIES_AFFINITY`, `ZONE_ECOLOGY`, `HOLD_LEVELS`) ·
> `engine/encounters.test.ts` (new) · `play3d/Shimmer3D.tsx` (hold levels, roll callers) ·
> `dev/editors/EncounterEditor.tsx` · `dev/templates/field-types.ts` · `save-map/route.ts`.
> **NEXT:** Alex feel-pass the bands while walking the continent; retune any zone via its `levels`.
> Then decide whether the extrapolated middle (thicket→Ather Winds) matches the intended pace.

## ⬆️ Shimmer play3d — THE LEVEL-UP CARD (2026-07-23, jin-cc) · *Last touched 2026-07-23*
> Second half of *"my L6 Dewbear feels the same"* — the first half was the arena ignoring level
> (`9c88ef4`), this is that **nothing ever SHOWED the growth**. Shipped + deployed (`bb1fe85`).
> - The reward loop snapshots `derivePartyStats()` + the move kit **BEFORE** `addXP` lands (after it,
>   the old values are unrecoverable — they were never stored) and again after, including the +4 bond
>   bump since kits key off bond as well as level. The spoils row expands on a level-up: 7 stats tick
>   old→new on a staggered ease, gained ones lit in the element colour, newly learned moves on chips.
> - **★ THE CURRENT VALUE IS THE HERO, THE DELTA IS AN ACCENT — deliberately.** A real level-up is
>   *small*: water-bear L6→7 is +1 to six stats and +1 HP, and several stats move **+0** at low levels.
>   A delta-first card renders `+0 +0 +1 +0` and **reads worse than showing nothing**. Unchanged stats
>   stay dim rather than shouting a zero. If deltas ever deserve top billing that is a **growth-curve**
>   change (`party-stats.ts`'s `1 + level/60`), not a card change — Alex's feel call, not made.
> - **FOUND, NOT FIXED — a base-element spirit has exactly TWO moves and learns nothing, ever.**
>   `getMovesForSpirit` gates every element move behind `element !== 'base'`, so an unevolved spirit is
>   frozen at Mana Pulse + Spirit Ward from L1 to L30. Moves only start at evolution (L15 mid, L25
>   high, signature at bond 50). **Very likely a real contributor to fights reading samey — two moves
>   cannot make a varied fight no matter how good the pacing is.** Design gate, not a bug; Alex's call.
> - **Files:** `play3d/Shimmer3D.tsx` (`StatTick`, `STAT_LABELS`, `BattleRewards`, reward loop).
> **NEXT:** Alex eye-pass the card (tick is 620ms ease, 55ms per-stat stagger in `StatTick`).

## 🏦 Shimmer play3d — THE GARDEN BANK (pooled crafting store, SHIPPED 2026-07-23, jin-cc) · *Last touched 2026-07-23*
> **Left off:** live on `:3200` (`2dfff8a` engine + `be35acf` wiring). Chests WERE ten independent slot grids and
> `craftItem` only read the satchel, so crafting meant remembering which box held the planks, ferrying stacks out,
> then walking to a station. Capacity was never the problem — the shuffling was. Now every placed chest contributes
> capacity to ONE pooled material store; gathered mats deposit into it; every station on your land crafts straight
> from it. The chest panel became the bank view (capacity meter, one-tap **Deposit all materials**, withdraw list,
> tap-to-deposit satchel).
> - **Scope = the garden, and that line already existed (Alex's call, better than the global bank I first proposed):**
>   zones carry `realm?: 'ather' | 'outside'` defaulting to `'ather'`, and exactly ONE of 34 zones is `'outside'` —
>   the Crucible. So the bank covers all 33 Ather zones and stops at the Crucible gate. **The same flag that gates
>   weapons-vs-spirits now gates bank-vs-satchel**, so the realms differ along one axis, not two. It also finally
>   gives the satchel a job: your Crucible loadout.
> - **Craft rule (Alex):** consume **inventory first, then bank**; crafted output lands in inventory. `spendMaterials`
>   is satchel-first + all-or-nothing (a failed craft never half-eats mats). Threaded through all four consuming
>   paths (craft/brew/tool-craft/repair) as an **optional trailing `bank` param** — omitted = satchel only = the
>   Crucible case = every pre-bank caller/test unchanged. Only Shimmer3D passes a real bank via `bankForZone()`.
> - **Numbers (feel, tune freely):** base 250, wooden +500, iron +750, ornate +1000, 10-chest cap unchanged. Tiered
>   so upgrading a chest isn't decoration.
> - **Decisions:** ▸ **count cap, not a slot grid** — a grid is Tetris with extra steps; "3,240 / 5,250" reads at a
>   glance. ▸ **only PLACED chests count** (a chest in your pocket isn't storage — the rule the old model implied by
>   making carried contents unreachable). ▸ **only resources bank** — tools/potions/seeds/furniture stay in hand.
> - **★ MIGRATION — the part that touches a LIVE save. Runs once, flag-gated (`bankMigratedV1`), placed AFTER flags
>   restore in the load path so the guard reads the real saved value not the fresh-mount default** (this ordering was
>   a real bug in the first draft, caught before shipping). Drains placed chests AND chests carried in the satchel
>   (chestData was unreachable until re-placed, so banking it hands items back). Force-deposit, **over-cap tolerant,
>   strictly non-lossy**: a maxed old save (~7,500 items) migrates intact above the 5,250 cap and just blocks new
>   deposits until it drains — nothing trimmed. Old stores emptied after so nothing double-counts; banner reports
>   what moved. New Game clears the bank + (via replaceFlags) the flag.
> - **Not runtime-tested in a browser (same reason as always):** the automation tab shares localStorage + mp identity
>   with Alex's live tab. bank oracle PASS (conservation + over-cap + spend-order), StationMenus 27/0, canon 5 CLEAN,
>   build clean, markers in served chunks. **NEXT{Shimmer bank: Alex plays it — gather, open a chest, Deposit all, craft
>   at a station and confirm it pulls from the pool; watch the migration banner on first load report the right count.
>   Feel-tune the 250/500/750/1000 numbers if the cap bites too early or too late}**
> - **Files:** `engine/bank.ts` + `engine/bank.test.ts` (new) · `engine/{crafting,alchemy,tools}.ts` (optional bank
>   param) · `play3d/Shimmer3D.tsx` (bankRef, capacity, 3 deposit/withdraw callbacks, save+migration) ·
>   `play3d/StationMenus.tsx` (bank panel replaces chest grid).

## ⚗️ Shimmer play3d — THE COZY LOOP (potions + stations + gather economy, 2026-07-22 eve, jin-cc)
> **The pivot back to the soul side (Alex): home plot, crafting + alchemy tables.** The finding: the loop
> existed but didn't PAY OFF — 9 of 13 potions were brew-for-XP dead ends, and placed stations were ghosts.
>
> **Left off (2026-07-22 eve, `9807ae1`→`d999d51`, all live :3200):**
> - **Potion effects layer** — `engine/potion-effects.ts` owns every drink effect (one source of truth,
>   59/59 tests incl. "no potion may be inert"). 8 timed buffs: fleetfoot speed / angler's-eye rin bites /
>   kindred companion-assist ×2 / starlight gather-XP / deepsight finds / dreamwalk calm-mist / ather-flow
>   mana regen / dawn broad-lift; harvest_brew = instant crop advance. HUD chips (top-right) w/ countdown;
>   Alchemy menu prints each bottle's effect line; buffs persist in save. Dials at file top.
> - **Stations-were-ghosts FIX** (`14d1f7f`): structuresView remapped placements for rendering only —
>   collision/interact/ghost compared logical zoneIds vs garden-world. `structuresViewRef` mirrors into
>   player space; persist stays logical. Alex-verified on the home plot.
> - **Lake nodes placed** (`d999d51`): reagent audit (scratchpad script, rerunnable) found `lake` defined but
>   placed NOWHERE → rinning T3 (moonkoi/pearlshell/crystal_rinn), T3 rinstick, deep_essence, dawn_cordial
>   all Exchange-buy-only. Lakes: moonwell (19,14)+(16,13), mana-springs (10,4), twilight-thicket (11,9).
>   Audit after: zero unplaced types, zero unreachable reagents.
> **Next:** Alex feel-pass buff magnitudes/durations · rin a lake (lv7) to confirm the T3 fish flow ·
> harvest_brew ergonomics (needs crops planted to feel it).
>
> **⚔️ SPIRIT BATTLE — CINEMATIC OVERHAUL (Alex ruled 07-22 eve; SIM PASS 1 SHIPPED 07-22 late, `76ff1c5`):**
> Keep initiation; the FIGHT becomes a pre-scripted cinematic — sim runs to completion at mount,
> renderer performs the timeline. **Shipped: the moveset sim** — spirits fight with their real canon
> 4-move kits (`engine/arena-moves.ts` adapts moves.ts → timed windup/execute/recover actions;
> cooldowns replace PP; live element wheel + STAB; accuracy-vs-agi = visible dodge sidesteps; canon
> statuses ignition/regen/crystallize/fortify/surge/erosion/anchor; stat stages ±3; generic wind
> system retired — heavies power≥60 ARE the telegraphs; orbit dance between moves). Guard switched to
> ratio mitigation `K/(K+grd)` (linear subtraction let a warded water-bear stall 96% of party fights);
> tire ramp (25s, +5%/s) guarantees resolution. `simulate()` pre-scripts a fight at mount (determinism
> proven — same seed + same spirit objects ⇒ identical timeline). Oracles green: arena.test 4/4 (Keeper
> skill delta +95pts), arena-moves.test 16/16 (median 17s, p90 24s — the cinematic band).
> **CANON RULED same session (one-registry):** `game/moves.md` is caster-agnostic master; 5 renames
> shipped (Ice Dart/Mend/Barrier/Enlighten/Shackle, ids stable); all kit moves + 40 signatures registered.
> **PASS 2 SHIPPED same night (`b3915fb`, verified live):** renderer performs the event stream —
> canon move callouts (announcer stack, heavy glow), per-state execute FX, dmg/dodge/FUMBLE floaters,
> hit-stop, KO slow-mo + fall, windup body-lean, hold-to-skip. Mana'mal picker REMOVED from harness
> (a companion is a bond, not a loadout — Alex).
> **BOSS LAYER SHIPPED same night:** AI tiers wired end-to-end (wild/trained/champion = decision
> quality ONLY — focus-fire weakest, near-perfect scoring, earlier sustain, reliable shields; mirror
> oracle: 47% vs wild → 15% vs champion, same spirits). Collared captives render muted + ember collar
> band, collars shatter + FREED beat on win. Holds mount w/ amber title banner + intro splash
> (HOLD 1 — THISTLE / HOLD 2 — SORREL'S STRONGHOLD / HOLD 3 — BRACK'S GAUNTLET). Boss test slice:
> `/shimmer/arena?mode=hold`. Oracles 17/17 + 4/4.
> **SAME NIGHT (07-22→23): team cards + editor/spawner block.** Pokemon-style team cards
> (Alex whiteboard: staggered stacks, VS center; banded HP, stance/COLLARED/DOWN/winding reads;
> over-head bars retired). Battle-end event-spam fixed; XP re-curved (fraction-of-bar, XP_FRAC
> 0.08 — flat chunks were invisible past L15). Mirror-fight fix (per-fighter seeded personality).
> **EDITOR:** full node palette (12 types, was shimmeroak-only) + SPAWNER layer (Sp:Thistle/
> Sorrel/Brack) → spawn-placements.ts via save-map, served by world-data, live-overlay at boot.
> **MOGLIN PATROLS (Alex direction):** armed spawner = lurking lesser moglin; proximity → patrol
> fight (2 collared spirits @ party+1, trained tier); handler pays MARKS + relation XP; win →
> 10min spawner sleep (persisted); freeing the hold retires its patrols. 3 seed spawners in
> the-outfields — Alex repositions in-editor.
> **OPEN BUG:** Alex reports map saves not sticking — every server path verified working
> (grid/stub-conversion/nodes/spawners all round-trip); need his repro (zone + corner message).
> **NEXT:** Alex map pass w/ new palette · per-move animation pass (readability milestone) ·
> moglin canon Q (lesser-moglin look/name for the lurker + patrol framing) · boss placement
> tweaks now Alex-doable via editor.
> **Parked:** sunfruit + moonberry are Exchange-BUY-only reagents (salve lv3, bond_philter lv8) — works, but
> a forageable berry-bush node type would be cozier; new content scope, needs its own pass (+ canon look Q).
> **Decisions:** effects = build-side mechanics (canon names untouched, per SHIMMER-CANON-BOUNDARY) ·
> re-drinking refreshes (never stacks) · dreamwalk never eats the guaranteed first-mist draw · seeds stay
> shop-bought (the booth IS the seed shop) · buff potions deliberately skip outside-Ather combat stats.
> **Files:** `engine/potion-effects.ts`(+test) · `Shimmer3D.tsx` (useItem branches, grantHarvest/harvestAt/
> brew hooks, structuresViewRef, buff HUD chips, coarse-tick regen/mirrors) · `StationMenus.tsx` effect
> lines · `world/node-placements.ts` lakes · `engine/farming.ts` harvestCrop xpMult param.

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
| Nolmir | 📦 shelved (back-room) | 2026-08-06 | idle Athernyx defense/arena — parked pending a proper home; UNLISTED + owner-only since 2026-08-06 (Alex), see its block |
| Magii | 🟢 live | 2026-07-29 | the tavern card game — sets-and-calls rummy, the Marks FAUCET, now playable WITH your party |
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

> **Public lineup changed 2026-08-06 (Alex).** Testers are the only visitors, so owner-gating the game defeats the point.
> - **Shimmer → `live`.** It was `coming-soon`, which put `/shimmer` in the proxy's gated set. `/shimmer` is only a redirect to `/shimmer/play3d` and the walker was already public — so the gate bounced testers to `/room` **one hop before the redirect could run**. Reachable only if you knew the deeper URL. (Shimmer is a `ROOM_WALL_ID`, so this was its Room-hub threshold, not an arcade card.)
> - **Nolmir → `back-room`.** Unlisted + owner-only. `back-room` not `coming-soon`: it is a parked game, not a teaser for a release that is coming.
> - **Dev tooling untouched and still hard-403** — the `tool` check in `proxy.ts` runs BEFORE the game-tier check and does not depend on any tier, which is why changing a game's tier can never leak an editor. Verified with no owner cookie both ways.
> - Left gated on purpose: **THE CRUCIBLE** door (gated for a BUILD reason — shell with no match to walk into), the two **dev-shortcut warps in Greg's home** (both destinations already have public doors), and **Lucernyx/Gravitar** (deliberately cut/shelved).

---

### Magii — 🟢 live · the tavern card game → `/magii`
*Last touched: 2026-07-29 — NETPLAY: the party sits down together (`67368df` + shimmer-server `55ff47a`)*
**What it is:** a four-seat sets-and-calls rummy in the tavern. Eight cards, build three sets of three
  (Triad 40 / Spectrum 25), then **call Magii** to end the round — or call on an incomplete hand and eat
  −50. It is also the **Marks FAUCET** for the whole site (win → `10 + 0.3×score`, everyone else → 10;
  see the MARKS ECONOMY block). Collections are unlockable decks.

**Left off (2026-07-29, jin-cc) — NETPLAY IS LIVE. Sit Down reads the site-level party and seats them;
  the three regulars hold whatever chairs your friends have not taken.** No lobby, no waiting-room wall,
  and a disconnect hands that hand back to a regular instead of ending the game for everyone else. This
  was the payoff the whole accounts/party/presence chain was built for.
- **The wire carries MOVES, not state**, because the engine was already a pure reducer over a seeded deal.
  New socket `shimmer-server/table.py` + `/table` (public `wss://ather.games/shimmer-ws/table`, covered by
  the existing `^/shimmer-ws/` ingress rule — no tunnel change needed).
- **★ A move is NEVER applied locally.** You send it, the server stamps a sequence number, and every
  client *including the sender* applies it on the echo. Costs one round trip on your own discard, which
  nobody can perceive at a card table; buys the absence of prediction, rollback, and local-vs-remote
  ordering. **Do not "optimise" this into an optimistic local apply** — that runs your discard twice on
  your machine and once on everyone else's.
- **★ Seating cannot reach the deal.** Names are labels applied at RENDER time (`applySeats`), so four
  clients that each call their own chair "You" still hold identical cards. Guarded as a test with a ★ —
  it is the invariant that silently breaks everything if it slips.
- **The server owns only what cannot be decided twice:** seat, seed, move order, and the collection. It
  does **not** know the rules of Magii and must not learn them — the reducer already no-ops an illegal
  move, so a bad move relayed to four clients no-ops identically on all four. Convergence by
  construction, not by two validators agreeing.
- **`gen` (generation counter) is load-bearing twice:** Play Again is a compare-and-swap on it, so
  simultaneous clicks yield ONE new deck; and every move carries its generation, so a discard in flight
  when someone re-dealt is dropped rather than landed on the fresh table.
- **The dealer (lowest occupied seat) is the only client that runs the NPC brains** — they read
  `Math.random`, so two clients running them would pick two different discards for one chair and the
  tables would fork. `for_seat` on the wire lets the dealer play an EMPTY chair only.
- **★ The NPC loop is one move per step**, reacting to (whose turn, which phase). Playing a whole turn
  straight through decided the discard against a hand the table had not dealt yet, AND the draw's echo
  re-triggered the step and drew a tenth card. One move, then wait to see it land, is also self-healing.
- **The deck belongs to the TABLE, not the player** — the same seed dealt from two collections is two
  different decks, so a guest plays the host's cards even if they have not unlocked them.
- `getNPCDifficulty` is clamped: seat 0 can be a regular now, and unclamped it asked for −1, which no
  branch handles — the abandoned chair would have played as the **sharpest** opponent at the table.
- Verified: engine oracle (seating / seat-map agreement / replay) + `test_table.py` (seating, relay order,
  own echo, replay-on-join, generation CAS, stale drops, dealer succession, isolation, guest deck) +
  three clients through the **public tunnel**.

**Next:**
1. **A real two-device playthrough with Alex.** The relay is proven headlessly end to end; what is
   unproven is the React wiring under two live browsers. Deliberately not automated — the automation tab
   shares localStorage and mp identity with Alex's live tab.
2. **Ephemeral party chat** at the table, on the presence socket (relay only, never stored).
3. A visible roster / "who is at this table" affordance beyond the `n/4 seated` pill.
4. Mobile pass on the netplay affordances.

**Parked:** trade/spectate; a persistent match history (would need storage + retention and makes
  `/privacy` false — same gate as DMs).

**Decisions (don't relitigate):**
- **Four chairs, NPC fallback, no waiting room** (Alex, 07-25). An invite takes over a regular's seat;
  nobody accepting, or someone dropping, hands it back. `Player.isHuman` already existed.
- **One party across Shimmer AND Magii** (Alex, 07-25) — which is exactly why there is no per-game
  invite UI: Sit Down just reads the party.
- **Invites are live-only**, no inbox. **Chat ephemeral only.**
- **Membership is possession of the party code** — friends-grade trust, documented in `lib/party.ts`.
  Fine for sitting down with people you know; nothing here is authoritative enough to hang the
  leaderboard on (that reads the signed-in session, not this socket).

**Canon:** a **fourth tavern regular** is an `[OPEN]` gap in `CANON_GAPS.md` (flagged 07-29). Netplay made
  seat 0 emptiable and only three regulars are named (Renna/Dorik/Sable). The build does NOT invent one —
  an emptied seat 0 borrows the name freed by the lowest occupied seat (provably collision-free, and every
  client computes the same map). Cost is cosmetic: a regular appears to change chairs after the host
  leaves. With a ruled fourth name, `regularFor()` collapses to a flat per-seat map.

**Files:** `magii/page.tsx`, `magii/game-board.tsx`, `magii/lib/{engine,table,npc,rng,data,audio,seed-history}.ts`,
  `magii/lib/magii.test.ts`, `src/lib/party.ts`; server `shimmer-server/{table,main,protocol}.py` + `test_table.py`.

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
*Last touched: 2026-07-25 — top-right chrome cluster gained the ACCOUNT WIDGET beside the mute toggle (sign in / claim name / friends / party), plus a quiet PRIVACY link bottom-right. Meshy note: /room is a CSS-3D scene (walls are flat .webp on rotated divs, ZERO webgl) so GLBs cannot drop in — the path is the picaso pre-render lane, and the glb_optimize crack bug does NOT block it (that is decimate-without-smoothing; pre-render wants the full-res mesh). Real weakness = the bottom third is an empty black floor, nothing stands in the room. Next: one Blender render with rug/inlay + baked contact shadows swapped for floor.webp, then standing props as billboards (camera only yaws around a fixed centre, so billboards are correct here). Alex owns what stands in the room.*
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

### Vault (#14) — 🟢 live · auto-runner, a mote crosses the greying → `/vault` *(BIG feature arc 07-07; MAP EDITOR 07-08; HIGH ROAD 07-21)*
*Last touched: 2026-07-21 — AUTHORED HIGH ROAD: multi-surface branching data spine + `▤ High road` editor tool (`546a0b3`+`b45cc2b`, live via coord lock). Prior: MAP EDITOR phase 3 07-08; 07-07 arc.*
**★ 2026-07-21 — AUTHORED HIGH ROAD / multi-surface branching (jin-cc, world lane in the swarm, `546a0b3`+`b45cc2b`, live).** Turns the endless-only high road into something authorable per level, so a hand-built level can branch high/low (two walkable surfaces at the same x → hidden areas / shortcuts). **The key realization: the resolver already existed** — `w.ledges` is a real 2nd surface layer (grounded follow-off-ledge `vault.ts:417-421` + airborne highest-ledge-else-ground landing `:431-444`), and render already draws it unconditionally (`page.tsx:602`). The gap was only that (a) authored levels never populated `w.ledges` (they skip `generate()`), and (b) the editor drew high platforms into `level.segs`, where `segAt()` (first-match) can never treat two overlapping segs as separate surfaces. Fix, all inside `vault/` (hub shared surface untouched): `AuthoredLevel.ledges[]` high-road layer; `bakeLevel` captures it; `makeAuthoredWorld` loads it into `w.ledges` — **zero resolver change**. Save route persists+normalizes `ledges`. New `▤ High road` editor tool draws into `level.ledges` (distinct violet slab; full pick/move/erase/dirty parity); `▭ Platform`→`▭ Ground` relabel + low/high hints so the two layers read. **Back-compat:** pre-07-21 saves have no `ledges` → empty high road, no crash. 26/26 authored tests incl. a **direct branch proof** (flat ground + one ledge: never-jump stays low & wins; hop lands on the authored ledge at its top). Pre-existing (NOT mine, on HEAD): `vault.test.ts` "different seed → different course" runtime-fails + a tsc state-narrowing error at `:131`.
  - **▶ NEXT (Alex's hands, the FEEL pass):** open `/vault/dev`, drag a few `▤ High road` ledges over a gap, Test-play, tune placement. Open Qs for taste: should **Reroll** seed a *procedural* high road to tweak (fast on-ramp) vs. hand-place only? does the high road want its own mote/foe rewards to make the branch *worth* taking?
  - **⏸ CANON (deferred, correctly):** skinning the high-road ledges as specific lore structures — *what they hang from* — is an OPEN Magii question (per `CANON/game/vault.md` structures-in-Vault). Blockout stays abstract; flag `CANON_GAPS.md` only when that art goes lore-bearing.
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
