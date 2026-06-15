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
| Voranyx #7 | 🟢 live | 2026-06-14 | glowing slither in the Silt |

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
*Last touched: 2026-06-14*
**Left off:** SP-vs-AI build shipped and **canon-grounded first** (the /magii Wyrm session,
  `athernyx/CANON/world/voranyx.md`, DRAFT). Steer-to-pointer worm, first seed paints your
  element/colour, motes = boost (decoupled from length), head-into-body = death, void ring
  closes in; **metabolism** (stop eating → sublimate to the blank thread) is the gimmick.
  **Alex playtest: cursor-follow felt great, but cramped past ~mass 50** — arena too small,
  zoom-out too gentle.
**Next:**
  1. **Bigger arena** — raise `ARENA_R0`/`ARENA_RMIN` (now 1000/380); the ring closing to
     380 is the main pinch on a mass-50 worm.
  2. **Zoom out harder with mass** — steepen `zoom = 0.95 - mass*0.0019` (only 0.86 @ mass 50)
     or raise the floor, so you see more as you grow.
  3. **Re-tune the growth curve** for the mid-game (mass 40-100) so it keeps feeling rewarding,
     not cramped; consider a slower / optional ring shrink.
**Parked:** the **MP seam** (multiplayer serpents — built toward, deferred) · a Sable canon
  pass on the cloud-ocean placement note in `voranyx.md`.
**Decisions:** **canon before code** (first game grounded in canon before building); boost is
  **decoupled from length** (bolder than real slither — motes, not tail-burn); world-space
  **procedural deep, no fixed bg** (a fixed image is wrong for a panning camera — learned from
  the FLUX-bg experiments). Headless said mass 48-85 was fine; **hands-on says the mid-game
  tightens too fast** — trust the hands-on read.
**Files:** `voranyx/lib/voranyx.ts` (20 tests) · `page.tsx`

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
- **Lucernyx** *(purification draughts — SPEC'D + CANON-COMPLETE 2026-06-15, fills the strategy gap)* —
  the lineup's only turn-based / beat-the-AI game. **Named after the Ancient you play** (same
  precedent as Voranyx#7). You are a **Lucernyx** — the lantern Ancient who *keeps* the light:
  rekindle the grey-corrupted back to your colour rather than slay it. **Canon DONE & GATE LIFTED:**
  the Lucernyx is now Tier-2 canon (`athernyx/CANON/world/mother.md` + glossary, the keeper station
  of the Mother cosmology). *(Old name "Rin-kin" retired — collided with the canon **Rinn-kin**
  Legendary mana'mals.)* **Ready to build.** Vector-glow diagonal board, your light vs The Dying's grey.
  - **Move:** diagonal slide (checkers).
  - **Convert (core gimmick):** jump an adjacent enemy into the empty square beyond → it flips
    to your light and *stays on its square* (material never leaves the board). Multi-jump flips
    an arc. A converted piece **reverses its advance** (now marches toward the enemy home).
  - **Win — torches:** a piece reaching the enemy's home rank **lights a torch + ascends off
    the board. First to 3 torches wins.** Spending pieces for torches thins your army and dangles
    convertible targets midfield → conversion is the natural counter to a torch-rush. Systems
    tension each other (the reason the win con is best-of-3, not sudden-death).
  - **Elements = terrain only:** a piece on its own element-tile is **rooted**, can't be flipped.
    No rock-paper-scissors.
  - **Cut:** flank-cascade (reads as unfair). Jump-to-convert stays the single clean verb.
  - **Tiebreak** on board-lock: most torches, then most pieces.
  - **Why buildable:** conversion swings the board so hard a *greedy* AI (max own flips + torch
    progress, block their imminent torch) looks smart — no real minimax engine needed.
  - *Open:* board size (tuning knob, start 8x8) · optional back-rank fork (torch vs "kindle"/king
    — parked, keep the goal clean for v1).
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
