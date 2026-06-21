# GBOARD — Akatskii Games Board

The games catalog board — sibling to PBOARD / TBOARD / BBOARD / SBOARD. Concepts,
queue, shipped. Playable games live at `/arcade`.

**The filter** — every idea must clear all three:
real **gimmick** (not watch-and-wait) · **canon-parallel** (serves Athernyx, not
"doing it to do it") · **light on art**.

**House look** — retro **Atari vector-glow** for the arcadey ones (phosphor lines on
black, CRT bloom). Mana'nana went glossy-modern; each game gets its own skin under
the Arcade frame.

## 🧩 Cross-cutting initiative — THE GAME-UI LAYER (active, jin leads, 2026-06-18)
> **Killing the "browser feel"** — games play like games but the menus/chrome read like a website.
> Full research + recipe: **`/GAME_UI_LAYER.md`**. Reusable opt-in kit: **`src/app/gameui.css`**
> (`.gx-card` plate · `.gx-scan` CRT texture · `.gx-title`/`.gx-label` squared type via `--font-game`
> Chakra Petch · `.gx-btn` · `.gx-chrome` kill-list resets). Alex blessed the direction + handed jin
> the rollout (taste dial — corner sharpness / glow level — stays his to tune).
> **Rollout checklist:**
> - [x] **Arcade catalog** (`/arcade/all`) — soft cards → framed CRT plates (`d3ada82`). PROOF.
> - [x] **Nolmir deck** — tiles → sharp CRT plates (gx-scan + 3px), gx-chrome kill-list, digest sharpened. Verified live, 0 errors.
> - [ ] **Per-game start/over overlays** (title plates + framed CTAs)
> - [ ] **In-game HUDs** (lightest touch — already vector-glow; align type + plates)
> - [ ] Arcade landing (`/arcade`) + hub widgets
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
| Nolmir | 🟢 live | 2026-06-18 | idle Athernyx defense/arena |
| Mana'nana | 🟢 live | 2026-06-14 | match-3, blooming specials |
| Rekindle #3 | 🟢 live | 2026-06-12 | conduit puzzle + Aeterna node-map |
| Ward #4 | 🟢 live | 2026-06-14 | Missile Command / touch aim-trainer |
| Updraft #5 | 🟢 live | 2026-06-14 | one-tap flight (Flappy) |
| Seedfall #6 | 🟢 live | 2026-06-14 | Mana-Seed lander + persistent garden |
| Voranyx #7 | 🟢 live | 2026-06-15 | glowing slither in the Silt |
| Lucernyx #8 | 🟢 live | 2026-06-15 | turn-based board of rekindling |
| Gravitar #9 | ⚪ parked | 2026-06-15 | physics-orbit — concept didn't land (cut) |
| Atherdash #10 | 🟢 live | 2026-06-17 | lane-runner — element-lanes ahead of the Dying (slice) |

---

### Nolmir — 🟢 live · idle Athernyx defense/arena → `/nolmir`
*Last touched: 2026-06-18*
**Economy map (2026-06-17, grounded in code):** currencies = **corelight** (Orrery spine: core-tap
  `rigs×1.5^conduit×2.2^depth×research` + node beam-back + transmute) · **ore** (6 tiers, mined) ·
  **refined** (steelglass/voidplate/embershard — the ONLY research currency) · **mana** (Crucible
  matches → planet UPKEEP) · **marks** (Expeditions → workshop + champions) · **exp** (Crucible →
  host level, warp-proof) · **guard-xp** (use-not-coin). **Coupling:** Orrery research buffs all 3
  pillars; **claim planets w/ corelight, KEEP w/ mana** (the spiral — heat↑→upkeep↑→must run Crucible);
  marks→champions→appear as Crucible guards; warp = prestige (exp/marks/research persist).
**✅ 2026-06-17 — Expeditions garrison idle (`5892d89`): the third pillar now idles.** The Orrery +
  Crucible already accrued offline (settleForge; away-matches bank mana/exp); Expeditions was active-
  only. Now every cleared breach passively salvages **marks** while away — `garrisonRatePerHour` scales
  with tiers/waves, 48h cap, a NUDGE not a grind (48h ≈ one solid run, ~316 marks @ tier1 wv12). Proper
  idle accounting (sub-mark remainder carries, past-cap overflow discarded, idempotent by tick). 13 tests.
  Deck digest shows a real **marks haul** row + a **✶/hr** tile stat; expeditions header shows "+N held"
  on return. **All three pillars now idle.**
**✅ 2026-06-17 — Phase B: unified return beat (`d895da5`).** Extracted the Crucible homecoming settle
  into `lib/away.ts` (`settleHomecoming`): forge tap + supply-line upkeep + away-match resolution
  (deterministic seeds, vault-falls cut lines), banked to the host, idempotent via `lastSeenAt`. The
  Crucible page now calls it (−64 lines of inline dup) AND the **deck** calls it — so the front door
  collects the WHOLE ship in ONE beat: corelight + mana/exp + garrison marks, itemized in the digest
  (matches answered, mana/exp banked, vaults fallen). Single source → deck & crucible can't drift.
  Build clean, both render. **The deck is now the one place you collect; entering a mode after sees an
  empty window (by design).** ⚠ feel-test needs >20min away to show a real haul (one match interval).
**✅ 2026-06-18 — collect juice on the digest (`4f0683f`).** The *while you held no watch* digest is
  now a real collect moment: rows **stagger in** one beat at a time (DIGEST_LEAD 220 / STEP 200), each
  haul value **counts up from 0** with an ease-out (`useCountUp`, ~620ms) + a glow flare as it lands,
  a tick/chord sfx per row (`click`/`unlock`, soft `break` on a vault-loss row), payoff chord on *take
  the watch*; card gets a spring entrance. **Robustness fix:** count-up has a `setTimeout` fallback so
  the haul resolves to its final value in a **backgrounded tab** (rAF is paused when hidden — without
  it the numbers froze at +0). Verified on ather.games (owner-gated): digest fires staggered, values
  land correct in both foreground AND hidden tab, 0 console errors.
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
     Still open: **planet-cap / first-claim** milestone beats (only host level-up is in so far).
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
*Last touched: 2026-06-14*
**Left off:** Cloud-puff obstacle live (CSS stub, Shimmer-canon palette), detonation FX
  (row/col beams, star flash, prism ring, capped motes), and iOS sound+scroll fixes
  **confirmed on a real iPhone**. Orbs are canon elements (SVG rune-marks: Mana/Storm/
  Earth/Water + Ather + Love).
**Next:**
  1. Paint a **cloud-puff sprite** in Aseprite → swap the CSS `PuffCell` stub (drop-and-convert).
  2. Optional puff balance tune (`PUFF_SEED`, spread cadence) if it overruns 20-move games.
  3. Optional: puff-chain as a *power* (Ather Star / prism chains them), not the default.
  4. Confirm `robots` index intent in `layout.tsx` (currently `index:true`).
**Parked:** pre-tinted orb bases per element · pixel-art widget icons (mug / cabinet).
**Decisions:** kept the **CSS gradient orbs** over a painted pixel-orb (Alex prefers them —
  the Void-orb experiment was reverted); cloud-puff chains stay **emergent**, not hardcoded
  (that's the difficulty); detonation kept **clean** over maximalist (his call).
**Files:** `manana/lib/match3.ts` · `page.tsx` · `tiles.ts` (T34 puff palette) · `runes.tsx`

### Rekindle (#3) — 🟢 live · conduit puzzle + Aeterna node-map → `/rekindle`
*Last touched: 2026-06-12*
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
*Last touched: 2026-06-14*
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
*Last touched: 2026-06-14*
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

### Seedfall (#6) — 🟢 live · Mana-Seed lander + persistent garden → `/seedfall`
*Last touched: 2026-06-14*
**Left off:** Shipped, tuned **cozy-landable** (headless pilot 12/12). Hold L/R half to
  thrust (both = rise), set the seed down soft → it **roots into a persistent garden that
  grows run over run** (localStorage); a hot/off-pad landing shatters. Hybrid bg (FLUX
  horizon + parallax). Uses `useNoScroll`.
**Next:**
  1. *(Optional)* garden depth — more plant variety / stages as the garden grows.
     Nothing else committed.
**Parked:** —
**Decisions:** this is the **slow/precision lane** — the one mood the lineup lacked; the
  growing garden is the closest thing to "**wake Aeterna**" persistence **without** needing a
  canon pass; shatter-on-bad-landing gives the cozy loop real **stakes**.
**Files:** `seedfall/lib/seedfall.ts` (15 tests) · `page.tsx`

### Voranyx (#7) — 🟢 live · glowing slither in the Silt → `/voranyx`
*Last touched: 2026-06-15*
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

### Lucernyx (#8) — 🟢 live · turn-based board of rekindling → `/lucernyx`
*Last touched: 2026-06-18*
**Left off:** Built the **playable slice** in one session (`5291194` sim, `bb7e09c` board).
  You're the lantern Ancient: slide diagonally (checkers), **jump an adjacent grey into the
  empty square beyond → it flips to your light and stays put** (material never leaves), multi-
  jump flips an arc, a converted piece reverses its march. Run a piece to the enemy home rank
  → **torch + ascend; first to 3 wins.** Greedy AI (max flips + torch progress, fear their
  imminent torch) plays the Dying. Pure sim `lib/lucernyx.ts` **27 tests green**; vector-glow
  canvas board (cyan light / guttered grey, violet convert-rings, torch pips). **Live + listed**
  in `/arcade/all` (`67c20b4` — flipped from coming-soon; no owner gate is wired so coming-soon
  just hid it). The lineup's only turn-based / strategy game.
  **✅ Alex played his first full game (2026-06-15): "good first draft." AI "good but still
  winnable" (target hit), torch race "okay."** Ranks = his call → kept at 3/12.
  **✅ Juice pass shipped (`072350f`):** moves animate (slide glide; multi-jump hops square-to-
  square, flipping each grey to light in sequence as the light punches through, bright trail;
  torch = float-up + ascend + pip flare). `lib/sfx.ts` (slide / rekindle bell per convert → a
  cascade / warm torch / win+lose). **The background warms as you win** — amber glow + drifting
  embers scale with your torches; cold violet creep with the Dying's. Render verified in-browser.
  **✅ Element-terrain rooting shipped (`dbf21d1`):** 4 sanctuary tiles (storm/mana/water/earth)
  in the contested midfield, point-symmetric. A piece on one is ROOTED — can't be flipped, and a
  rooted enemy can't be jumped (blocks, caps multi-jumps). No RPS (elements = canon flavour). AI
  values its own rooted pieces. Render = element tint + rune diamond + bright ring on a rooted
  piece (verified in-browser). Note: sanctuaries shortened AI-vs-AI games 38→25 plies.
  **❌ Element sanctuaries CUT (`398548b`, 2026-06-18):** Alex's playtest bug = "move a piece
  and it vanishes, usually into a special square." Root cause: a rooted enemy can't be jumped,
  so a move onto/through it is silently illegal → the click falls through, the selection clears,
  reads as the piece disappearing. AND they board-locked the torch-race: **self-play draws 10.3%
  with sanctuaries, 0.3% without** (400-game harness, conservation verified — 0 real piece loss).
  Mechanic removed from sim + render + tests; **28 sim tests green**, draws now 0.3%. The core
  verb is the whole game — don't re-add terrain without a draw-rate check.
**Next:**
  1. **Alex re-playtest** — clean now: torch-race pacing right? AI still good-but-winnable?
  2. Optional depth if the race feels off: a daily seed, or an AI difficulty notch.
**Parked:** optional back-rank fork (torch vs a "kindle"/king piece — kept off to keep v1's
  win-con clean) · forced-capture rule (jumps are optional in v1).
**Decisions:** **single clean verb** — jump-to-convert only; cut flank-cascade (read as unfair).
  **Jumps optional** in v1 (friendlier than forced-capture; they're already strictly good so
  the AI takes them anyway). **Greedy AI, no minimax** — conversion swings the board hard
  enough that max-flips+torch-progress+block-their-torch looks smart. **Sim-first** (logic fully
  headless-tested before any pixels), same as the rest of the lineup. **Direction = f(owner)**,
  so converting a piece flips its march for free. **Element terrain tried then CUT** — rooting
  caused stalemates + ghost-moves; the bare verb plays cleaner (see Left off, `398548b`).
**Files:** `lucernyx/lib/lucernyx.ts` (28 tests) · `lib/lucernyx.test.ts` · `page.tsx`

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
  direct visitors too; room-pill just hides. ⚠ **TODO:** confirm the hall cards propagate `?from=room`
  so the back-pill actually shows when arriving via the arch (else it only works on a hand-typed param).

  **✅ POLICY DECIDED (Alex green-lit 2026-06-21) — cabinets, not bespoke worlds.** Arcade games tie as
  cabinets in ONE shared hall; per-game identity = cabinet skin (trim/glow keyed to palette), NOT a
  bespoke gen'd environment per game (that's a never-ending art tax + dissolves the "one hall" fiction;
  room WALLS earned bespoke art because they're destinations, cabinets are items in a collection). Spend
  the gen budget ONCE on a great SHARED hall composed for the at-a-cabinet view (light in the MARGINS,
  not just a center corridor). Now BUILDING this route on Atherdash as the template. Full rationale:
  memory `project_arcade_cabinet_not_world`.
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

## ⚰️ Killed — covered by a shipped game *(don't re-pitch)*
- **The Dive** (fall through the cloud-ocean, dodge-and-collect) → vertical-flight mood
  taken by **Updraft**. Best canon hook of the three, but it's covered.
- **Spirit garden** (tend a plot, spirits bond over time) → **Seedfall**'s persistent garden.
- **One-screen last stand** (real-time blight defense) → that *is* **Ward**.

## 🅿️ Parked
- **The Cloud-Ocean Angler** — fishing the clouds. Said aloud it didn't hold: thin
  gimmick, heavy art, not truly canon-parallel. Plan kept at `src/app/angler/DESIGN.md`.
