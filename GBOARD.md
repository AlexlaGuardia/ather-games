# GBOARD — Akatskii Games Board

The games catalog board — sibling to PBOARD / TBOARD / BBOARD / SBOARD. Concepts,
queue, shipped. Playable games live at `/arcade`.

**The filter** — every idea must clear all three:
real **gimmick** (not watch-and-wait) · **canon-parallel** (serves Athernyx, not
"doing it to do it") · **light on art**.

**House look** — retro **Atari vector-glow** for the arcadey ones (phosphor lines on
black, CRT bloom). Mana'nana went glossy-modern; each game gets its own skin under
the Arcade frame.

## 🎮 Shipped
- **Nolmir** — idle Athernyx defense/arena (3 modes + the loop). → `/nolmir`
- **Mana'nana** — match-3, blooming specials (Surge/Prism/Ather Star) + earned moves,
  glossy CSS gems. → `/manana`
- **Rekindle** (#3) — conduit puzzle, Atari vector-glow on canvas. **Now a narrative
  meta-game** (2026-06-12, Luna): rotate conduits to route Ather to matching cores.
  v2 gimmick = **colour purity** (two hues meeting at a junction muddy → a pure core
  won't catch, so keep flows separate) + **charge budget** (every rotation spends; run
  dry = "the dark wins", retry) + 3-star scoring. Slice 2 = **the Aeterna network**: a
  node-map where each puzzle is a dead machine; clearing it lights the node + unlocks a
  lore fragment (draft canon, magii-review pending). 5 nodes live + map finale. → `/rekindle`
- **Ward** (#4) — Missile Command over the spires, the first **real-time** vector-glow
  piece (2026-06-14, Jin). The void rains blight on 6 spires; tap the sky to bloom
  Ather rings that unmake it before it lands. Endless escalating waves, combo scoring,
  standing-spire bonus, localStorage hi-score. **It's basically a touch aim-trainer**
  (Alex's insight) — so we mined Aimlabs/Kovaak's/Missile-Command for design. Live
  features: score-tiered **game-over taunts** (the tease is the replay button), and
  **splitters/MIRVs** (wave 3+, fork into children at altitude → kill them high for a
  3x "clean kill" + chime, or chase the spawn). Pure testable sim (`/ward/lib/ward.ts`,
  41 unit tests), in `/root/ather-games`. → `/ward`
- **Updraft** (#5, was "Laz") — one-tap flight / Flappy (2026-06-14, Jin). Lazerin (the
  Crucible announcer) rides the Ather currents: tap to climb, fall when you don't, thread
  the void gates. Endless score-chase, canon-light (no lore weight). Vector-glow portrait,
  tilting-dart Lazerin + trail. **Hybrid background:** a faint FLUX-generated Ather nebula
  (`public/updraft/nebula.webp`) behind procedural parallax (distant spire silhouettes +
  starfield). Pure testable sim (`/updraft/lib/updraft.ts`, 17 tests) + shared
  `useNoScroll`. The ultra-short pick-up-die-retry palate cleanser. → `/updraft`
- **Seedfall** (#6) — cozy Mana-Seed lander / Lunar Lander (2026-06-14, Jin). Hold the
  left/right half to thrust (both = rise), feather abundant Ather, set the seed down
  soft on the soil; a clean landing roots into a **persistent garden that grows run
  over run** (localStorage), a hot/off-pad landing shatters. The slow/precision lane —
  adds the one mood the lineup lacked, and the growing garden is the closest thing to
  the "wake Aeterna" persistence without needing a canon pass. Hybrid bg (FLUX horizon
  sky + parallax). Pure sim (`/seedfall/lib/seedfall.ts`, 15 tests) tuned cozy-landable
  (headless pilot 12/12). → `/seedfall`
- **Voranyx** (#7) — glowing slither in the Silt / slither.io (2026-06-14, Jin). You're a
  **Voranyx** (NEW canon — `athernyx/CANON/world/voranyx.md`, DRAFT): a worm of Ather-light,
  born blank, that grows by eating and holds size only by eating still. Steer to pointer,
  graze dross + seeds (**first seed paints your element/colour**), gather **motes to boost**
  (decoupled from length — bolder than real slither), head-into-body = death → burst to
  bubbles, **void ring closes in**. **Metabolism** is the headline gimmick — stop eating and
  you sublimate back to the blank thread. SP-vs-AI serpents now, the **MP seam** later.
  Camera-followed, world-space procedural deep (no fixed bg — it pans). Pure sim
  (`/voranyx/lib/voranyx.ts`, 20 tests) tuned for a real growth curve. **First game grounded
  in canon BEFORE building** (the /magii Wyrm session). → `/voranyx`

## 🧭 Catalog direction — narrative meta (2026-06-12, Alex)
Gardenscapes insight: the puzzle is the currency, the **story you unlock is the draw.**
Our edge = a deep canon already built. Each game = a system/region of one "wake Aeterna"
restoration arc (Rekindle=conduits, Mana'nana=gardens, Ward=spires…), puzzles unlock
canon. **Take the story-unlock, NOT the lives/energy/IAP** (against Nolmir's anti-cash-grab
thesis). Must stay expressible in vector-glow (a dark network lighting up, not painted
scenes). Lore routes through /magii for canon safety.

## 🛠️ Building next
- **Rekindle**: more nodes/regions + a seeded generator (endless + daily seed) + real
  hazard levels (forced near-merges) + magii canon pass on the lore. Slice 3 = prisms
  (split a flow, ties to Mana'nana's Prism).
- **Ward — aim-trainer roadmap** *(2026-06-14 research: Aimlabs/Kovaak's/Missile Cmd)*:
  ✅ splitters/MIRVs, ✅ tiered taunts, ✅ **multi-kill scoring + juice** (one ring
  catching a cluster = escalating bonus + ×N floater + burst + rising arpeggio; stacks
  on splitter children), ✅ **post-run scorecard** (accuracy/downed/best-chain/clean
  on the game-over screen). Next, ranked: (1) **Daily** — seeded wave script, shareable
  (reuse Rekindle's date-seed pattern). (2) Variety: a **strafing** blight (tracking
  skill) + a **blink/pop-up** threat (reaction). (3) adaptive difficulty (scale to
  recent accuracy).
- **Voranyx — next pass** *(Alex playtest 2026-06-14: "cursor-follow felt great, but growth balance + map size — felt tiny as I got to ~50")*: (1) **bigger arena** — raise `ARENA_R0`/`ARENA_RMIN` (currently 1000/380) so a mass-50 worm has room; the ring closing to 380 is the main pinch. (2) **zoom out harder with mass** — render `zoom = 0.95 - mass*0.0019` barely backs off (0.86 at mass 50); steepen it / raise the floor so you see more as you grow. (3) **growth curve** — re-tune so the mid-game (mass 40-100) keeps feeling rewarding, not cramped; consider slower/optional ring shrink. Headless said 48-85; hands-on said mid-game tightens too fast.
- **Playtest gate:** Alex still needs a foreground-tab playthrough to tune base feel
  (bloom grow-time, ammo generosity, blight speed, splitter telegraph readability).

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
- **[working title TBD]** *(purification draughts — mechanics SPEC'D 2026-06-14, fills the strategy gap)* —
  the lineup's only turn-based / beat-the-AI game. **⚠ NAME + CANON ON HOLD:** "Rin-kin" was
  retired — it collides with established canon (**Rinn-kin** = the 4 Legendary mana'mals: Duskpuff/
  Frilldrift/Prismstrike/Coilguard, load-bearing in the Spirit Tales books). The keeper-spirit
  concept is fine but **paused pending the top-down spirit-cosmology canon** (Mother + the Ancient/
  spirit hierarchy — Alex's call 2026-06-14 to write that FIRST, then name this game into it).
  Mechanics below stand; the lore/name waits. Vector-glow diagonal board, your Ather-light vs
  The Dying's grey-corrupted.
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
