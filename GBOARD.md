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
>
> **THE TWO LANES NOW (no more new-game pipeline):**
> 1. **★ The POLISH LAP** — the whole backlog of taste-calls, run one game per session (cold-play → feel
>    tune → gx-* check → mobile → card art → bump block). The consolidated checklist ↓ is the spine;
>    **Seedfall first** (Alex's favourite, the proven winner). New cabinets (Driftling/Squall/Dewdrop/Vault)
>    are also pending Alex's device cold-play — they fold into this lap.
>    - **Solo-doable NOW (headless, no device):** card art via FLUX (`scripts/gen_cards.py`). ✅ **Vault +
>      Dewdrop DONE 2026-07-01** (`4499727`). Remaining: **Squall, Driftling** (card/creature art).
>    - **Everything else is pending Alex's hands** (feel-tune, mobile/overlay reads) — headless can't judge.
> 2. **Leaderboard + Room loose ends** — verify the daily-leaderboard renders inside each game-over overlay
>    (logic+API proven, only the visual is unseen); finish the Room's small lane (Folk volume on the Desk,
>    news automation, 390px wall-turn pass). See `### The Room` block.
>
> **▶ PENDING-ALEX LAP — the consolidated checklist (the polish-lap spine; new cabinets fold in below):**
> - [ ] **Atherdash** — hop timing window fair? slide→hop rhythm readable? base speed right? *(knobs: `SPEED`/`SPEED_MAX`/`SPEED_RAMP_DIST`, `JUMP_DUR`, `PIT_GAP_Z`/`PIT_LEAD`)*
> - [ ] **Ward** — enemy tune: Drifter weave gentleness, Darter warning time, Husk feel, intro wave *(knobs: `DRIFT`/`DART`/`HUSK` consts)*
> - [ ] **Seedfall ⭐ (Alex's FAVOURITE — polish FIRST, it's the proven winner)** — full descent feel (drift authority vs branch spacing, fall speed) + Havari catch/dodge readability (1.4s warn) + soil-approach landing + game-over overlays + **the new wind-puff thrust read** *(knobs atop `seedfall.ts` + `genBranches`)*. ✅ **Card art DONE 2026-06-30** (`e7a04d9`). ✅ **Thrust reworked to wind-puff gusts 2026-07-01** (`693a613` — updraft pillow on both-held, lateral gust from upwind side; render-only). **All solo work done — waiting on Alex's device pass.**
> - [ ] **Driftling** — device cold-play: drift authority, eat/threat readability, evolve-payoff moment, nursery-start curve *(knobs atop `lib/driftling.ts`)* + card/creature art (deferred, Alex taste)
> - [ ] **Squall** — device cold-play (never verified by me, extension was down): pattern density/cadence, bullet speeds, telegraph warn times *(knobs: `fireDirector` gap, per-pattern `spd`, `RAMP_T`, `GRAZE_R`)* + card art
> - [ ] **Dewdrop** — cold-play tune already started (`a8c54ac`): scatter/chase waves, wildbloom duration, ghost-vs-player speed gap *(consts atop `lib/dewdrop.ts`)* + maze art/layout (deferred, Alex taste)
> - [ ] **gx-* look on real mobile across all 11** — esp. the game-OVER overlays headless can't reach
> - [ ] **Arcade cabinet dial** — final warmth/dim/red-skew on `<ArcadeCabinet>` (one component → changes everywhere)
> - [ ] **Daily leaderboard** — does the board render right *inside* the game-over overlay (5 games + Seedfall)? logic+API already proven, only the visual is unseen
> - [ ] **Daily toggle + share** — does Endless/Daily read right; is the share line satisfying
> - [ ] **Mana'nana** — taste call: keep the candy match-3 look, or push it into the squared gx-* family
> - [ ] **Nolmir** — unified return beat (needs >20min away for a real haul) + rehearse the warp ceremony + mobile-idle direction call
> - [x] **Voranyx** — phone playtest PASSED 2026-06-15 (no action; here for completeness)
>
> **▶ NEW-CABINET PIPELINE — CLOSED after Vault.** The "two more then stop" strategy is fulfilled
> (Dewdrop + Vault). The remaining ONE build is **Vault's render** (sim done, canon ruled; see its block below). All
> other concepts (Tempest, Rune-weaving, Breakout) stay parked in the Queue — **don't pitch new games
> until the polish lap is done** (Alex's standing call, 2026-06-26).
>
> ---

## 🔁 Cross-cutting — THE DAILY CHALLENGE (shipped 2026-06-21, `b4c3ddb`→`7902b30`)
> Retention loop: one seeded run per UTC day, the SAME course for everyone, shareable score.
- **Shared lib `src/lib/arcade/daily.ts`** (reusable like ArcadeCabinet): `dailyKey`/`dailySeed`/
  `dailyNumber` (#1 = 2026-01-01) + per-game daily-best storage + Wordle-style `dailyShare` + clipboard.
  Opt in with ~6 lines: seed the world from `dailySeed()`, save with `saveDailyBest`, add the toggle + share.
- **Live on 7 score-chase games:** Atherdash · Ward · Updraft · Voranyx · Mana'nana · Seedfall · **Vault**
  (Vault joined 2026-06-29) — Endless/Daily toggle on the start screen (Mana'nana: under the score row),
  separate daily-best track, Share on game over.
- **Rekindle** has its own puzzle daily; its date helpers now re-export from the shared lib (one source).
- **Excluded by design:** Lucernyx (vs-AI win/lose, now SHELVED) · Rekindle (puzzle ★-rating, not higher-is-better). Seedfall JOINED 2026-06-22 (descent redesign gave it a depth score).
- **✅ Server-side leaderboard SHIPPED (2026-06-22):** `api/arcade/leaderboard/route.ts` (file-backed,
  per-day top-20, upsert-best-by-player) + `lib/arcade/leaderboard.ts` client + reusable
  `_components/DailyLeaderboard.tsx`, wired on the 5 score games + Seedfall + Vault. No auth (scores
  client-submitted, fine for a personal arcade). ⚠ **only unverified bit = the board RENDERING inside
  each game-over overlay** (logic+API proven via curl; visual unseen) → THIS WEEK lane 4.
- ⚠ PENDING Alex feel: does the daily toggle + share read right (this-week lap).

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
| The Room | 🟢 live | 2026-06-21 | the hub — arcade hall, Desk wall, Grimoire/AtherPages, nav spine |
| Nolmir | 🟢 live | 2026-06-18 | idle Athernyx defense/arena |
| Mana'nana | 🟢 live | 2026-06-22 | match-3, blooming specials |
| Rekindle #3 | 🟢 live | 2026-06-22 | conduit puzzle + Aeterna node-map |
| Ward #4 | 🟢 live | 2026-06-22 | Missile Command / touch aim-trainer |
| Updraft #5 | 🟢 live | 2026-06-22 | one-tap flight (Flappy) |
| Seedfall #6 | 🟢 live | 2026-07-01 | the long drop — scrolling descent, weave branches + dodge Havari (Daily) |
| Voranyx #7 | 🟢 live | 2026-06-22 | glowing slither in the Silt |
| Lucernyx #8 | ⚫ shelved | 2026-06-22 | turn-based board of rekindling — pulse overtuned, back-room |
| Gravitar #9 | ⚪ parked | 2026-06-15 | physics-orbit — concept didn't land (cut) |
| Atherdash #10 | 🟢 live | 2026-06-22 | lane-runner — element-lanes ahead of the Dying (slice) |
| Driftling #11 | 🟢 live | 2026-06-26 | food-chain evolution — eat small, flee big, first bite forks your branch |
| Squall #12 | 🟢 live | 2026-06-26 | defenseless bullet-hell — read the void's patterns, weave, survive |
| Dewdrop #13 | 🟢 live | 2026-06-26 | Pac-Man riff — Dewbear vs collar-Moglins, wildbloom snaps the collar |
| Vault #14 | 🟢 live | 2026-06-29 | auto-runner — mote of light crosses the greying, leaps the void's tears (render shipped, pending Alex feel-test) |
| Anima | 🔬 tech demo | 2026-06-21 | procedural character (IK rig + verlet cloak), ZERO art files — linked in Room |

---

### The Room — 🟢 live · the hub everything ties back to → `/room`
*Last touched: 2026-06-21*
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
  2. **Desk wall → surface the Folk volume** — the AtherPages Folk volume exists but the Desk only links
     `/grimoire` (Spirits). Add a Folk entry/tab on the Desk wall (or a `?v=folk` deep-link panel).
  3. **News feed automation** — `/room/news.json` is hand/auto-editable; wire the session-end or a small
     cron to drop a "what shipped" line so the Desk News stays live without manual edits.
  4. **Mobile pass on the wall-turn** — confirm the 4-wall turn + Desk in-place UI read well at 390px.
**Parked:** more walls (a 5th destination) · ambient room audio · attendant/NPC presence.
**Decisions:** **room-centric nav** — the room pill is the ONLY back (no duplicate header links);
  cabinets tie as items in the hall, the room WALLS are the bespoke-art destinations (see the
  cabinet-not-world policy in Atherdash). News is **data-driven** (`news.json`) so it updates without a build.
**Files:** `src/app/room/page.tsx` (walls + DeskWall + ArcadeArch) · `_components/RoomReturn.tsx`
  (sticky from-room) · `public/room/news.json` (live feed) · `/grimoire` (AtherPages, off the Desk)

### Nolmir — 🟢 live · idle Athernyx defense/arena → `/nolmir`
*Last touched: 2026-06-18*
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
*Last touched: 2026-06-22 — gx-* UI pass (squared chrome + HUD)*
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
*Last touched: 2026-06-26*
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
  2. Then art pass (card + creature art — deferred, Alex's taste).
**Parked:** **Rinn-kin element↔apex mapping** = a /magii canon gap (sim is element-agnostic so it doesn't
  block; canon re-skins via the LADDER/APEX tables only, zero logic). Jin's non-binding proposal in DESIGN.md.
**Decisions:** sim-first (oracle retuned for the **languid identity** — nursery start, threat exposure ramps
  with tier, median run reaches apex, deaths still live); element-AGNOSTIC core so canon is never the blocker.
  NOT Voranyx (that's slither-length + body-collision; this is discrete evolution tiers + size hierarchy).
**Files:** `driftling/lib/driftling.ts` (27 tests) · `driftling.test.ts` · `lib/sfx.ts` · `page.tsx` · `DESIGN.md`

### Squall (#12) — 🟢 live · defenseless bullet-hell → `/squall`
*Last touched: 2026-06-26*
**Left off:** Shipped live + public. Pure-evasion bullet-hell — **no shield, no shots**, brand-new
  "defenseless survival" mood. The void rains **5 telegraphed patterns** escalating with survival time
  (rain comb / side sweep / aimed fan / ring burst / rotating spiral), each fair (edge-entered or warned).
  **Tiny hitbox + graze** risk-reward (close passes bank score). Render = vector-glow storm, **telegraph
  readability** (aim = live dashed line, burst = expanding preview ring, spiral = rotating tick, all pulse
  toward fire), visible hot-white **hitbox pinpoint** + graze aura/flash, HUD, best-score + run-summary death,
  touch joystick / mouse-follow / WASD. 20 sim tests green.
**Next:**
  1. **⚑ Alex device cold-play (NEVER verified by me — extension was down on ship day)** — pattern
     density/cadence, bullet speeds, telegraph warn times. Knobs: `fireDirector` gap, per-pattern `spd`,
     `RAMP_T`, `GRAZE_R` in `lib/squall.ts`.
  2. Card art (deferred, Alex's taste).
**Parked:** —
**Decisions:** **#2-cabinet call: Squall over Pac-Man** at the time — Driftling is eat/flee/flip, Pac-Man is
  too (predator-flip), so Squall (no offense) gives the board real contrast. (Pac-Man later shipped anyway as
  Dewdrop.) Opening softened for a fair casual on-ramp (roomier gaps, slower early bullets, RAMP_T 115).
**Files:** `squall/lib/squall.ts` (20 tests) · `squall.test.ts` · `lib/sfx.ts` · `page.tsx`

### Dewdrop (#13) — 🟢 live · Pac-Man riff, Dewbear vs the Moglins → `/dewdrop`
*Last touched: 2026-07-01 — card art added (`4499727`); tuned 06-26*
**Left off:** Shipped live + public + tuned. A wild **Dewbear** hoovering **dewdrops** in the collar-Moglins'
  burrow-warren; the 4 hunters = the Moglins (**Burr**=chaser, **Bramble**=ambush, **Nettle**=flank,
  **Hemlock**=overseer + top hat); power-pellet = **wildbloom** → collars snap, Moglins **deflate** + flee
  (the books' deflate payoff = the predator-flip). Render = phosphor burrow, chomping dew-blue Dewbear, 4
  distinct Moglins (deflate + eyes-home states), joystick+WASD, lives, win/lose + best-score, sfx. 20 tests.
  **Alex cold-play → tuned:** maze 19×21→15×17 (bigger cells), speeds slowed (PLAYER 4.0 / GHOST 3.5), +
  fixed a real FP movement bug (exact-step skipped centre-decisions → added 1e-6 epsilon to `advance()`).
**Next:**
  1. **⚑ More tuning if Alex asks** — scatter/chase waves, wildbloom duration, ghost-vs-player speed gap
     (consts atop `lib/dewdrop.ts`).
  2. **Maze art/layout** = a later design pass (Alex's taste). Current maze is a guaranteed-connected
     placeholder (hand-authored maze was sealed/disconnected → generated by construction).
  ✅ **Card art DONE 2026-07-01** (`4499727`) — `/dewdrop/card.webp`: Dewbear chomping in a neon maze with wildbloom + dewdrops.
**Parked:** —
**Decisions:** **Magii ruled it onto canon** (`athernyx/CANON/game/dewbear-maze.md`, committed `0c15ae6`) —
  Alex named it **Dewdrop**. The Pac-Man riff was Jin's pick of the floated classics (predator-flip verb the
  lineup lacked; 4 hunters = 4 elements/Moglins; phosphor maze = cheap art). Was the **working title
  `pacmaze`** sim before the canon weld (`f9cdbe1` → Dewdrop `fdeb8bc`); `pacmaze/` dir is gone (renamed).
**Files:** `dewdrop/lib/dewdrop.ts` (20 tests) · `page.tsx` · canon `athernyx/CANON/game/dewbear-maze.md`

### Vault (#14) — 🟢 live · auto-runner, a mote crosses the greying → `/vault` *(render shipped, pending Alex feel-test)*
*Last touched: 2026-06-29 (render shell shipped + registered live). Sim: 2026-06-28 (`7503b55`); canon ruled 2026-06-28.*
**🆕 RENDER SHELL SHIPPED (2026-06-29):** `bound`→`vault` renamed (git-mv, history kept); `/vault` live +
  public + registered (`games.ts`, tier live, glyph ↟). Greying skin per canon: surviving **coloured ground
  islands** (lit living edge) over the **void's tears** (gaps), **grey void-spawn** foes (soulless dead-eyes),
  **rooted-corruption** spike-thorns, **loose Ather-light** motes. The mote = cyan core + gold glow + a
  **light-trail arc**; **unmaking burst** + `unmaking ×N` combo readout on stomps; collect spark; death
  screen-shake; greying wash thickens with distance. One-button input: **tap / hold / space** = the vault
  (variable jump via hold; keyboard auto-repeat guarded so a held key = one leap, not a buzz). gx-* chrome,
  best-score, cause-aware death lines. Build clean, `/vault` 200. **Render = my hands; feel = Alex's.**
  **🆕 STOMP → DOUBLE-JUMP (`3678e6c`, Alex's call):** unmaking a foe banks ONE air-jump — tap again
  mid-air for a full second leap to keep the momentum and chain across enemies (no free double-jump; granted
  only by a stomp, resets on landing). Distinct `djump` sfx + downward ather-kick FX. +2 sim tests (34 green);
  oracle curve unchanged (the look-ahead bot doesn't use it → it's a pure skill-ceiling raise, not a difficulty shift).
**Left off (sim, unchanged):** One-button auto-runner: mote moves
  right on its own (faster with distance), only input is **JUMP** — and jump is **variable** (tap = short
  hop, hold = float higher). The wedge vs Atherdash/Updraft (the board's two existing jump games): real
  **platformer geometry** — (1) variable jump arc you *shape*, (2) **elevation** (ledges/platforms at
  different heights, read-ahead + land), (3) **stomp + bounce-combo** (land on a foe from above → kill +
  bounce; chain aerial stomps for a rising multiplier; side-contact = death). Coyote-time + jump-buffer for
  fairness. Deterministic (mulberry32) → free Daily + oracle. **26 sim tests green; oracle clean** (300 seeds:
  0% early deaths = fair start, median dist 2392, deaths mostly foe/spike = the new platformer skills are what
  kill you, not cheap gaps).
**🔒 CANON — RULED, no gap (Magii, 2026-06-28, `athernyx/CANON/game/vault.md`):** name **Vault** LOCKED by
  Alex; registered in `CANON/world/arcade.md`. **It's Updraft's sibling** — Updraft = *the climb*, Vault =
  *the crossing*. The frame = **the greying** (`core.md`): the land itself is going grey, eaten into gaps;
  a **mote of Ather-light** runs the failing ground and **forward motion is the defiance** ("you cannot hold
  the light still, you can only carry it"). The re-skin is **label + art only, zero logic** (the sim's
  generic entities map 1:1):
  | sim entity | Vault skin (locked) |
  |---|---|
  | runner | **a mote of Ather-light** (cyan/gold glow + light-trail). ⚠ COHERENCE GUARD: light, NOT a creature — never name it / give it a species / a `-nyx`. |
  | ground / ledges | **surviving islands of coloured ground**; height = the broken remains of the land |
  | gap | **the void's tear** — fall = "the grey takes the light" (death) |
  | stomp-foe | **grey void-spawn** — soulless/colourless; stomp = **"unmaking"** (Ward register, defiance not cruelty; NOT a souled spirit) |
  | spike | **rooted grey corruption / blight-thorn** — can't be unmade, must be leapt |
  | mote | **loose Ather-light** gathered on the run (score) |
  Ramp = the Dying gaining ground; score = the **crossing** (distance) + motes + the **unmaking**-combo.
**Next (render shipped — now feel + polish):**
  1. **⚑ Alex device cold-play (his hands — headless can't dispatch the vault tap):** does the **jump arc**
     feel right (tap=short / hold=float)? Is the **stomp-from-above** window fair, and does the bounce-combo
     read? Coyote-time + jump-buffer fair? Run speed + gap spacing on the ramp? Knobs = consts atop
     `lib/vault.ts` (`JUMP_V0`, `GRAV_RISE_HOLD/FREE`, `GRAV_FALL`, `CUT_V`, `STOMP_BOUNCE`, `BASE_SPEED`,
     `SPEED_RANGE`, `RAMP_DIST`, gap/hazard density in `generate`/`populate`).
  2. ✅ **Card art DONE 2026-07-01** (`4499727`) — `/vault/card.webp`: formless spark-orb of light crossing a void-tear between broken islands, blight-thorns + greying (3 FLUX passes to clear the coherence guard — no creature/figure). Title-screen backdrop still optional.
  3. **Mobile pass** at 390px (tap/hold reads on a phone; HUD + overlays).
  4. ✅ **Daily + server leaderboard — SHIPPED 2026-06-29** (`6f51800`): endless/daily toggle, deterministic
     daily seed, daily-best + Wordle-share, DailyLeaderboard on game-over; added to the server allowlist.
     Vault is now at full lineup par (7th score-chase game on the Daily loop).
**Parked:** —
**Decisions:** **the final new cabinet** — closes the "two more then stop" strategy (Dewdrop + Vault). MUST
  earn its slot with platformer geometry, not be a third rhythm-tapper (the explicit pre-build gate; the 3
  verbs above are the answer). Sim-first discipline held (oracle gut-check before any render — the
  Seedfall/Driftling lesson). **Naming law** (per `arcade.md`): plain word names an *act/thing* (Vault = the
  leap/crossing), `-nyx` would star a spirit-kind — the runner is light, so a plain word is correct.
**Files:** `bound/lib/bound.ts`→rename `vault/` (322 ln) · `lib/bound.test.ts` (26 tests) · `lib/bound.oracle.ts` · `DESIGN.md` · canon `athernyx/CANON/game/vault.md`

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
