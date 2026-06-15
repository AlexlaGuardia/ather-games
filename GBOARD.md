# GBOARD — Akatskii Games Board

The games catalog board — sibling to PBOARD / TBOARD / BBOARD / SBOARD. Concepts,
queue, shipped. Playable games live at `/arcade`.

**The filter** — every idea must clear all three:
real **gimmick** (not watch-and-wait) · **canon-parallel** (serves Athernyx, not
"doing it to do it") · **light on art**.

**House look** — retro **Atari vector-glow** for the arcadey ones (phosphor lines on
black, CRT bloom). Mana'nana went glossy-modern; each game gets its own skin under
the Arcade frame.

## 🎮 Shipped — per-game roadmaps
> Each block is the durable state of one game: where we left off, what's next, why.
> SHIMMER_SESSION.md is the dated session *log*; these blocks are the source of truth
> for "I haven't touched this in a week — where was I?"
> **Status:** 🟢 live (public) · 🔵 back-room (built, held) · 🟡 building · ⚪ parked
> **Template:** Left off / Next (ranked, with the knobs) / Parked / Decisions (the why) / Files

| Game | Status | Last touched | What it is |
|------|--------|--------------|------------|
| Nolmir | 🔵 back-room | 2026-06-11 | idle Athernyx defense/arena |
| Mana'nana | 🟢 live | 2026-06-14 | match-3, blooming specials |
| Rekindle #3 | 🟢 live | 2026-06-12 | conduit puzzle + Aeterna node-map |
| Ward #4 | 🟢 live | 2026-06-14 | Missile Command / touch aim-trainer |
| Updraft #5 | 🟢 live | 2026-06-14 | one-tap flight (Flappy) |
| Seedfall #6 | 🟢 live | 2026-06-14 | Mana-Seed lander + persistent garden |
| Voranyx #7 | 🟢 live | 2026-06-15 | glowing slither in the Silt |
| Lucernyx #8 | 🟢 live | 2026-06-15 | turn-based board of rekindling |

---

### Nolmir — 🔵 back-room · idle Athernyx defense/arena → `/nolmir`
*Last touched: 2026-06-11*
**Left off:** All 3 modes (Starforge / Orrery / Crucible-Expeditions) + THE LOOP + warp
  live. Game-UI typography pass applied in Starforge (Chakra Petch labels, tabular nums,
  HUD-over-canvas pointer trick). Held in the back-room tier — off the public catalog.
**Next:**
  1. Decide the **mobile-idle direction** Alex reserved it for (the reason it's back-room).
  2. Art pipeline still open.
**Parked:** public launch (intentionally held).
**Decisions:** back-room, not public — Alex's call, reserved for a future **mobile** idle
  game. Anti-cash-grab thesis stands (no IAP / energy / lives).
**Files:** `src/app/nolmir/` (Starforge / Orrery / Crucible / Expeditions + warp)

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
*Last touched: 2026-06-15*
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
**Next:**
  1. **Alex playtest** — the full thing now (juice + sanctuaries): do sanctuaries add good
     positional tension, or stall the game? Torch-race pacing right? AI still good-but-winnable?
  2. Optional depth if the race feels off: a daily seed, or an AI difficulty notch.
  3. Optional: a one-line "root on a glyph" hint / brief first-time tip (discoverability).
**Parked:** optional back-rank fork (torch vs a "kindle"/king piece — kept off to keep v1's
  win-con clean) · forced-capture rule (jumps are optional in v1).
**Decisions:** **single clean verb** — jump-to-convert only; cut flank-cascade (read as unfair).
  **Jumps optional** in v1 (friendlier than forced-capture; they're already strictly good so
  the AI takes them anyway). **Greedy AI, no minimax** — conversion swings the board hard
  enough that max-flips+torch-progress+block-their-torch looks smart. **Sim-first** (logic fully
  headless-tested before any pixels), same as the rest of the lineup. **Direction = f(owner)**,
  so converting a piece flips its march for free. Element-rooting **deferred** — ship the verb first.
**Files:** `lucernyx/lib/lucernyx.ts` (27 tests) · `lib/lucernyx.test.ts` · `page.tsx`

## 🧭 Catalog direction — narrative meta (2026-06-12, Alex)
Gardenscapes insight: the puzzle is the currency, the **story you unlock is the draw.**
Our edge = a deep canon already built. Each game = a system/region of one "wake Aeterna"
restoration arc (Rekindle=conduits, Mana'nana=gardens, Ward=spires…), puzzles unlock
canon. **Take the story-unlock, NOT the lives/energy/IAP** (against Nolmir's anti-cash-grab
thesis). Must stay expressible in vector-glow (a dark network lighting up, not painted
scenes). Lore routes through /magii for canon safety.

## 🌱 Queue — what's actually next *(cleaned 2026-06-14: kept only what adds a mechanic the 7 don't)*
- **Gravitar** *(lead)* — slingshot Ather between the Orrery's bodies by gravity. The one
  genuinely new mechanic left: nothing in the lineup does physics-orbit. Canon-rich
  (the Orrery), vector-clean, famously brutal — the tuning is the work.
- **Tempest** — hold a rune-well as the void climbs the lanes. Distinct *input* (positional
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
- **Ather Dash** *(lane-runner)* — Subway-Surfers loop: run through the Ather, dodge obstacles,
  reach the next gate. **The twist that saves it from being Updraft-with-lanes:** the lanes are
  **elements** (Storm/Earth/Water/Mana) and each gate is tuned — you must be in the *matching*
  lane to pass it. So it's **read-ahead** (spot the gate's element, swap in time) under dodge
  pressure, not pure reflex. Ours + canon (the 4 elements); Updraft is pure timing, this is
  positional anticipation. *(replaced Shardfall, which was Asteroids with no twist of its own.)*
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
