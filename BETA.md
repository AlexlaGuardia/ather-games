# BETA — the one finish line

> Started 2026-11-16 by Jin (play `a19fe9a2`) when Alex asked for an AFK hive with a main goal. **DRAFT: Alex edits this.**
> GBOARD records what was built. This file records what is still missing before a stranger can play. The hive works THIS
> list while Alex is away and nothing else. A row closes when its check passes ON PROD, never because a note says it does.

## What beta means

A stranger lands on **ather.games on their phone**, makes a keeper, and plays the **first hour of the open world**
(the first errand, rinning, prospecting, a fight in the Wilds, a business) with **no dead ends, no lost save, no errors**.

**In scope:** the open world (Ather plot, the Wilds, the continent, its towns). **Shelved, not beta:** Nolmir, the arcade
cabinets, the Starforge ticket. They stay live but are not worked on; repurpose later (Alex 11-16).

**A "coming soon" door is not a dead end** (the Thistledown Fair's "still pitching", the Station's "Not running yet").
A dead end is a step the game points you at that cannot be done. Do not build a feature to close a coming-soon door.

## Milestones

> **Order for 11-17 (Alex away, check-ins ~2 h):** ~~M2/M3~~ ✅ → ~~M7~~ ✅ → ~~M6a~~ ✅ → ~~M11~~ ✅ → ~~M12.1~~ ✅ → M6b (prospect-check FAILS on prod: no aim, empty bag) → M12.2 → M6d → M5 played → the
> check-suite chore between rows. M6c: the hub checks a strangers' Wilds fight EXISTS before dispatching; if it needs
> building, it is an ask, not a row. M1's remainder is 🔒 (birth wheel), so skip it.

Status: ⬜ open · 🟨 partly · ✅ check passes on prod · 🔒 needs Alex (look / feel / canon sign-off; the hive parks it and moves on)

| # | Milestone | Check (passes on prod = done) | Status |
|---|---|---|---|
| M1 | **Front door.** Home → Play → rune → born, on a phone, live in under 20 s, zero page errors | `scripts/beta-audit.mts`: PASS on prod 11-17 (live 19.2 s, tight; 0 page errors, one three.js Clock deprecation warn). Birth wheel ghost names: Alex 11-17 "good as is for now", he'll playtest | ✅ |
| M2 | **Phone HUD legible.** No two HUD elements overlap at 390×844 or at 360×780 | `beta-audit-2 [--w 360 --h 780]` (Ather plot) + `beta-audit-continent [--w --h --phase drive|foot]`: both pages PASS on prod 11-17 (`90e4226d`). Covers `data-hud`/`data-touch` boxes only; the hotbar clips ~2px each side at 360 (🔒 look) | ✅ |
| M3 | **Touch controls.** The first touch moves you; the thumb zone does not sit on the hotbar; every HUD button opens its panel; every panel closes by tap | `beta-audit-2` (Ather plot) + `beta-audit-continent` (drive + foot): PASS on prod at 390 and 360, 11-17 (`90e4226d`) | ✅ |
| M4 | **The next step is told.** Right after birth, the keeper sees what to do (Greg's errand in the journal, the trail lit) | `shared/journal.test.ts` + `scripts/beta-m4-look.mts` (beacon + trail on Greg, prod 11-16, `92537123`) | ✅ |
| M5 | **First errand, PLAYED.** Greg → runesmith → Enchant Temple → bracelet, reached on foot / courser, not by teleport hooks | `scripts/beta-m5-errand.mts` (`c9820f61`): PASS on prod 11-17 (walked to Greg + the gate, real fold-map Rune Hold tap, every errand step a real input; continent crossings tp'd, logged in its header). Friction → queue: no beacon between Greg and the continent (stranger must find the gate, Tab-flip the map, pick Rune Hold) | ✅ |
| M6a | **Rinning, found and played.** A keeper finds bait + the rinstick and lands a rinn without a guide | `scripts/beta-m6a-rinning.mts [--phone]`: PASS on prod desktop + phone 11-17 (`424f86f1`: phone hotbar above the touch layer, FIRE casts/answers/reels). Gaps → queue: nothing points a stranger at rinning; 10 starting bait, no refill | ✅ |
| M6b | **Prospecting, found and played.** A keeper finds a node and cuts a gem without a guide | `prospect-check` + `scripts/beta-m6b-prospect.mts` (real BE BORN, gate fold-map tap, real click cut): both PASS on prod 11-17 (`b140ba7d`, `33c3c32c`). Gap → queue: nothing points a stranger at prospecting until they stand at a node | ✅ |
| M6c | **A fight in the Wilds.** A keeper reaches the Wilds and wins (or survives) a fight without a guide | `scripts/beta-m6c-wilds.mts` (24ba1b36 + 7f2f7367): the arming leg PASSES (born → Kael's chest → Wilds armed, 0 errors); the FIGHT leg never completed in 6 headless runs (2 workers + hub on prod 11-18: swiftshader OOM / detached frames / a 22-min stall before the Wilds). Hollow count 7→0 after arrival: no game bug found in code (130 m cull + slow headless repopulate, untested) | ⛔ blocked: needs a human playtest (Alex, 5 min: go to the Wilds with the new gun, do Hollows come to you and die?) or a lighter harness |
| M6d | **Deeds are told** (Alex 11-17: prices stay; the first deed is a 2nd/3rd-session goal, not first-hour). A stranger who reaches a continent town learns deeds exist (journal line → For Sale boards + the Co. contract board as the way to save) and a deed card shows price vs purse; buying stays a later goal. Design note (Alex): the ATHER provides the exotic materials the continent's businesses need | `beta-m6d-business.mts` (reframed `9369d3ac`): PASS on prod 11-17 (`05618ceb`, live in `3aa7ae4a`): fresh keeper, journal (real J) carries lark's 'A place of your own' after reaching town; Kettlemoor Farm deed card (real E) reads 'It costs 35000 Marks. You have 1500.'; 0 page errors. Buying stays in `market-check` | ✅ |
| M7 | **Saves survive.** Reload, close tab, come back next day; anonymous → signed-in keeps everything | `scripts/beta-m7-saves.mts`: PASS on prod 11-17 after `d8b72da4` (open world stamps the epoch; keeper adoption site-wide). Account with a keeper already + an anonymous one = the roster (Alex's direction, queue) | ✅ |
| M8 | **Clean console.** Zero page errors / console errors / 4xx-5xx across every beta check | rolled into each check. 11-18 full prod sweep of scripts/*-check.mts by play (A-M + weapon checks) and sprites (N-Z): every check PASS on prod with 0 page errors after stale fixes (stance, wheel-equip, pack, bag, vessel, continent-stance, rinstick, veradyn, touch, node, rinning, nyx-rinning); void-check skipped (old voxel world, not beta); water-* are offline measurements | ✅ |
| M9 | **Phone performance.** Holds frame rate on a mid phone; heap stays bounded over 30 min | new + 🔒 Alex's phone | ⬜ |
| M10 | **Alex's sign-off pass.** He plays the first hour on his phone and calls it | 🔒 | ⬜ |
| M11 | **One menu button on the phone HUD** (Alex 11-17: too much clutter). On a phone the tap row folds into ONE MENU chip; tap to open, tap again or pick one to fold. Desktop unchanged | `beta-audit-2` + `beta-audit-continent` (menu rest/open/fold asserted): PASS on prod at 390 + 360, drive + foot, 11-17 (`46ed03f3`) | ✅ |
| M6e | **Bait refills.** A keeper who runs out of bait can make more without a guide (Magii 65d4c21: bait = craftable food offering) | `scripts/beta-m6e-bait.mts`: PASS on prod 11-17 (Jin 2 `5fb891d4`, live in `5b3edbad`: out of bait → prune → forage → Make bait). 'Forage' = placeholder name (CANON_GAPS 2c6e25b) | ✅ |
| M12 | **The keeper roster** (Alex 11-17, spec below). One garden file per account; several keepers in it, swapped like loadouts | per-step checks in the spec; `beta-m7-saves` stays green. All 5 steps live 11-17; cloud save proven on Alex's desktop + phone. Remaining 🔒 Alex: the LOOK of the roster prompt + Keepers list; no restore-from-backup button yet | ✅ |
| M13 | **NPC talk = a conversation, not a menu** (Alex 11-18 pin). E at an NPC: the camera focuses on them; their line shows as a CHAT BUBBLE above their name; the keeper's answers are a short option list, ARROWS to pick (tap on a phone), INTERACT to choose. Each option opens ONE thing: e.g. Greg › "Can my garden grow?" → the plot-expansion screen; "Let's trade" → the shop; story talk → the next bubble. Never errand + shop + upgrades in one panel (today Greg's panel shows all at once). Every NPC line stays @lark's | `scripts/errand-check.mts` (talk flow: bubble, one screen at a time, arrows move the pick, ground screen alone, gems once): PASS on prod 11-18 (`c40b753f`, Greg live). Remaining: 🔒 Alex judges the look (bubble, camera turn, answer list) on his phone; GREG_HELLO + answer labels are placeholders for @lark; the touch-tap path is untested on a real phone; SETTLEMENT MOGLINS LIVE 11-18 (`ecb8cb65`): E in a settlement = talk to ONE Moglin (its dream in a bubble, camera on the settlement anchor since no Moglin models stand there yet), answers: what do you need / keep a room / who else lives here / goodbye; folk-check PASS on prod (real bring, untrusted ask refused, free Moglin recruited). Lark's lines for Greg's talk live (46c963a5, awaiting Alex sign-off); Moglin talk labels with lark next; continent shopkeepers / Idony / the runesmith still panels | 🟨 |
| M14 | **Nyx window-shopping** (Alex 11-18). Shops a keeper browses while exploring, with NO deeds: GUN SHOPS (the Passage gun shop, RULED 11-15, plus gun shops in other Nyx towns) where base guns are BOUGHT for Marks; COURSER DEALERSHIPS; CLOTHING STORES. Each is marked on the map. Starting arms stay the Repeater (born with it) + the Charred Rifle (Kael's chest, shipyard). Which towns get which shop + prices + stock = build; any new proper name or a clothing line = ask Magii | new: a check that buys a gun at a gun shop for Marks (owned → in the Character dropdown), opens a dealership + clothing store, and finds each on the map | ⬜ |
| M15 | **Casts work the same in every mode** (Alex 11-18: "the tactical and signature should have a universal effect for all game modes"). Q (tactical) and X (signature) fire everywhere the keeper stands: the Ather plot, the Wilds, the continent on foot. One spec (play3d cast.ts castForMove) + one verdict (shared/casting.ts press) + ONE effect layer shared by every host, so a cast does the same thing wherever it is pressed. Today: only the Wilds resolves fight casts (the plot refuses "Nothing here to touch"), the continent has no Q/X at all, and field / terrain / channel / veil / gate are unbuilt everywhere. Steps: (a) no refusal by place: a cast fires, spends, shows its effect; it hits whatever that mode holds (Hollows in the Wilds, nothing yet on the plot/continent); (b) the continent gets Q/X + mana + the cast chips via a shared hook lifted out of ather/page.tsx; (c) the unbuilt archetypes, once, in the shared layer | (a)+(b) LIVE 11-18 (`4dc95113`, hub worker): no refusal by place; shared/use-casts.ts drives Q/X + mana + chips on the Ather AND the continent on foot (driving: hands busy). `cast-everywhere-check` PASS on prod (plot + continent on foot: mana spent, chip cooling, 0 errors), `cast-keys-check` PASS on prod (Firewall slows a Hollow in the Wilds), casting 20/0. (c) FIELD LIVE 11-18 (`c3e4676a`, live in `f4eb4545`): placed at the aim, drawn, ticks on Hollows in the Wilds; `cast-field-check` PASS on prod (1 of 2 runs: headless timing lets the Hollow wander off before the tick), combat-fields 8/0. Partial-effect field moves listed for Alex (combat-casts.ts header). TERRAIN LIVE 11-18 (`52f858d2`, live in `bc61ccf1`): all 7 moves raise their shape at the aim for its time, Hollows cannot step through and spit stops on it, Cordon/Pillar Tomb lay their statuses; `cast-terrain-check` PASS on prod, combat-terrain 16/0. The keeper COLLIDES with it since `09b6cae2` (ather/dynamic-solids.ts wraps the Wilds shape; dynamic-solids 5/0; prod check walks at it, headless too slow to reach it, the unit test carries it); like any rock it can be mantled/climbed; a piece rising under the keeper is untested; Monolith's topple + climbing Living Architecture's ledge not built. CHANNEL (Meltbore: press/hold/release, billed per second) + VEIL (Heat Mirage: a decoy Hollows close on and spit at) LIVE 11-18 (`2a56a9a8`): cast-channel + cast-veil checks PASS on prod, combat-channel 32 pass. Meltbore has no world effect here (canon: it bores blocks; the Wilds have none) = Alex's call. GATE LIVE 11-18 (`c4bc7140` + continent `b02455b5`): two spiral ends (keeper + 14 m along the facing), step in one out the other, billed per second, keeper-only; cast-gate-check PASS on prod (tp into the far end: headless cannot walk 14 m in 12 s). ★ EVERY ARCHETYPE NOW RUNS. Remaining: field/terrain/channel/veil are Wilds-only effects (off the Wilds: flash + line, no host keeps them); X untested off the Wilds; the 🔒 asks above (partial field moves, Meltbore); a field off the Wilds is a flash only (no host keeps it); X untested off the Wilds (needs a glove word seeded) | 🟨 |

## M12 spec: the keeper roster (Alex 11-17, from the M7 save-loss finding)

**Belongs to the KEEPER** (swaps with the character): birth rune, learned runes + skills, worn gear, the hotbar AND the whole
inventory/pack. **Belongs to the GARDEN** (the cluster; one per account, shared by every keeper on it): the plot, Moglins,
storage, Marks, deeds/businesses, journal progress, explored map, forestry/prospecting world state.
Canon RULED 11-17 (athernyx 8d3ada7): a player-side convenience; unplayed keepers have no in-world state; one tends at a time; cap ~8.

Steps (one worker each, in order; each keeps `beta-m7-saves` green):
1. ✅ **11-17 `88dcf26a`, live, beta-m7-saves PASS on prod.** **Scope the keys.** Today the open world's pack / hotbar / loadout live in UNSCOPED `open.*` keys (keeper-local.test's
   "unclassified key" red lists them all). Move keeper things to keeper-scoped keys and garden things to account-scoped keys,
   with a one-time migration that MOVES (copy then delete, never delete first) today's data into keeper #1. keeper-local.test green.
2. ✅ **11-17 `512cbad5` (module + 23 tests; inert until step 4 calls it, ships with it).** **Roster storage.** An account holds keepers `[k1, k2, …]` + `active`. Today's keeper = k1. Swapping = change `active`
   and re-read; garden untouched.
3. ✅ **11-17 `411d8cc2`, live in `5b3edbad` (keeper-prompt 32/0, beta-m7-saves PASS on prod; panel served on prod). Look not yet judged (🔒 Alex); real Google sign-in path untested.** **The sign-in prompt.** Anonymous keeper + an account that already has keepers → a panel: "Add this keeper to your
   roster?" Yes = it becomes a new roster entry; No = it stays on this browser, untouched (never deleted). Account with no
   keeper → adopt silently (live since d8b72da4).
4. ✅ **11-17 `578abec9`, live: beta-m12-swap PASS on prod (new keeper → birth → swap back, rune + pack byte-identical, garden unchanged, 0 errors). Look 🔒 Alex.** **Swap UI.** A keeper list (character panel or options) to switch, and "new keeper" opens the birth ritual. Character
   creator rework = later (Alex).
5. ✅ **11-17 REAL TWO-DEVICE RUN PASSED (Alex): desktop pushed rev 1 → phone took the lease and reloaded once with his keeper → back on desktop via 'Playing on another device. Continue here?' (Alex: likes the message), lease home, rev 10.** LIVE in `3e270e49` (client `fc45f29d` + `be3455ba`, hub a9c92710): `beta-m12-cloud` PASS on prod (anon = off, no call; faked session = lease 401, nothing adopted), `beta-m7-saves` PASS, open-cloud-core.test 29/0 (two fake devices + CAS). Remains: the REAL two-device run (Google sign-in can't be scripted): Alex opens his main device first, then a second; hub reads the `saves` row (game 'open'). No restore-from-backup button yet (hub restores by hand).** **Cloud save.** Design `docs/M12-cloud-save.md` (serb, 74c8c713), **APPROVED by Alex 11-17 with all four defaults**
   (server wins + local backup, cap 8, Marks in wallet, settings per device). Server side = serb (db + /api/saves/open),
   client side (cloud-sync open path) = Jin. Builds after steps 1-4.

## Audit 2026-11-16 (pass 1 + 2, fresh profile, 390×844 touch, prod)

**Works:** the home page loads in 1.2 s · PLAY FREE → the world goes live in about 15 s (swiftshader) · the birth gate shows, the tap
on BE BORN works · the welcome card explains controls + the gate + Gregory · zero page errors, one three.js deprecation warning
· heap 44 MB.

**Broken / rough (each one feeds a milestone):**
- **M2: the top-right HUD collides on a phone.** The minimap covers OPTIONS; the clock pill covers PACK (a tap on PACK lands on
  the pill); the "your plot · Grey matter" pill covers FRIENDS.
- **M3: the move zone sits ON the hotbar.** "THUMB HERE TO MOVE" is drawn over slots 1–4, and JUMP covers slot 8. A thumb that
  means to move can pick a slot, and the other way round.
- **M3: the first drag only dismisses "TAP TO START"** and does not move. Small, but it is the first thing a stranger does.
- **M3: MAP tapped, nothing seen opening** after 2.5 s (unverified: could be the probe). Hand-check it on a real phone.
- **M1: the birth gate on a phone** shows the neighbour runes' names ghosting through the centre (Manalic / Life / Enchant
  readable behind Star) and a keyboard hint ("↑↓ RUNE · ←→ ELEMENT · ENTER") a phone cannot use.
- **M4: unmeasured yet.** The welcome card names Gregory, but nothing yet checks that a stranger is pointed at him.

**Fixed 11-16 (`a4d738de`, live, verified on prod by `beta-audit-2`):** the tap row now starts under the status chip and
the stick hint, jump/slide/fire and near pills stand above the bar: 6/6 touch buttons topmost under their centre, the thumb
walks, PACK opens the bag. The birth screen hides its keyboard hint on phones. Then (`9024f774`) MAP and FRIENDS opened and shut in one tap (pointerdown opened, the same tap's click hit the panel
backdrop): taps fire on click now. 360×780 passes. Still open in M2/M3: the continent page. And
"TAP TO START" eating the first touch was judged FINE (it says tap, and a tap is what it takes). Birth-wheel ghost names = 🔒 Alex.

## How the hive works this list (AFK mode, agreed with Alex 11-16)

**Start of day: Alex types `/loop /hive` in ONE fresh window.** The playbook is `~/.claude/skills/hive/SKILL.md`.
- **Hub (Opus, self-paced loop):** owns this file. Each tick: checkpoint due? → messages → review a returned worker
  (diff, its check, then `coord build` and the row's check ON PROD, flip the row) → else dispatch the next row.
- **Workers (Sonnet subagents, one at a time):** a FRESH one per row, so nothing ever needs clearing. Builds on devwin
  `world` (:3201), proves the row's check, commits by pathspec, reports, ends. Never deploys.
- **Checkpoints 11:00 / 13:30 ET:** the hub wraps (rows true, SHIMMER_SESSION, cortex), pushes "ready to clear", stops.
  Alex: `/clear`, then `/loop /hive`. It boots from files and loses nothing. **18:00:** final wrap + the day's summary.
- **Magii:** her own window if Alex opens one. Canon gaps go to CANON_GAPS.md + dbr + the queue below; the row parks.
- **A row closes on the hub's prod check, never on a worker's report.** The worker proves it on its devwin; the hub
  builds, re-runs the row's check against ather.games, and only then flips the row.
- **Never waits on Alex:** a 🔒 row goes to the queue and the next row is taken. A row that fails twice is ⛔ blocked.
- **Rules:** only rows on this list. No new systems, no lore, nothing public. Canon gate + tests before every build.

## Alex's queue (🔒: look / feel / canon; clear it when you have a minute)

- **M15 Meltbore (11-18):** the channel cast now holds, bills mana per second and draws its beam, but does nothing to the world: canon has it boring through blocks and the Wilds have no borable blocks (and conjured walls can't be bored). Should a held Meltbore burn Hollows in its beam, or stay a pure utility until there is something to bore?

- **M15 field casts (11-18):** these field moves have only PART of their effect in the open world (nothing invented): Healing Grove, Monsoon Veil, Exhale only heal; Overpressure's ward/shell do nothing; Monsoon Veil's hide does nothing; Threshold's shell HP does nothing (it eats Hollow spit); Cyclone Cage roots Hollows but doesn't block your shots. Fine for now, or do any of these need their full effect before beta?

- **M6c (11-18, ⛔ for the hive):** the Wilds fight never ran headless (memory / swiftshader). While you try the new gun: go to the Wilds, does a Hollow come at you within a minute, and does it die? If none ever come, that is a real bug (the count drops 7→0 after arrival in headless runs).
- **M13 look (11-18):** talk to Greg on your phone: bubble, camera turn, answer list. Placeholder lines ("Keeper.", "Go on", "About my ground") wait for lark.
- **Lark copy pass (11-18), sign-off:** lark's drafts replace today's placeholders: Greg ("Now then, Keeper. Blue says hello." / And then? / Take the gems / My ground / See you, Greg.), the Shipyard + Kael's chest ("Open the chest", "Empty now. You have what Kael left."), the Co.'s contract board ("Contract board", hand it back, "That one's yours: …"). Yes / reword any. Held for Magii: a Citadel board saying goods come "from the Ather".
- **Lark Moglin talk (11-18), sign-off:** in a settlement talk: Anything else? (was Go on) / See you soon. / Bring 2 Reed (was Give), garden full = "Your garden is full just now. Ask me again when there is a free room.", emptied settlement = "The houses are quiet now. Everyone here has found a garden." The Moglin's dream stays its hello (lark's call). Yes / reword.

- **M5 friction (11-17, not a dead end):** after Greg's gems the journal says 'Go to the Redstair runesmith' but 'Nowhere to point yet' on the Ather side: no beacon to the gate, and Rune Hold sits on the map's Athernyx face (Tab flips). Proposal: on the Ather the errand's waymark points at the gate. Hub can do it (small).

- **✅ ANSWERED 11-17 → M6d reframed (prices stay, first deed = mid-game, deeds get told). Was:** **M6d pacing (11-17):** a fresh keeper has 1,500 Marks; the cheapest of 47 deeds is 35,000 (a lone farm nets +20/min, ~29 h payback). Only first-hour earning = Co. courser contracts (~4-12k per 15 km run). So 'buy a business in the first hour' fails as priced (you raised prices 11-15). Pick: (a) a starter lot ~3-5k, (b) richer first contracts, or (c) the first deed is a mid-game goal and M6d leaves beta. Plus a journal line pointing at deeds either way.

- **✅ LIVE 11-17 (`5b3edbad`, Alex approved lark's lines): 'Rin at the water' + 'Prospect a mana crystal' in the journal, struck once used. Was:** **Discovery pointers (11-17, M6a + M6b):** neither rinning nor prospecting is told anywhere (welcome card, journal, bag) before you stumble on it; prospecting's only pointer is the HUD prompt AT a node. Proposal: @lark drafts one journal line each (the game register), you sign off, hub wires them. Yes / or your own wording?

- **Alex 11-17: a RINNING ROOM** (craft rinsticks, make bait, prepare catches for the cooking room). Canon mostly settled
  (rinsticks built from rinn; roast rinn at the hearth; workshop rooms + Moglin trade). Magii asked (CANON_GAPS 4a9a621): 6th room
  + its name, what bait is made of, which Moglin. Magii 11-17 (65d4c21): bait = craftable food offering (recipes ours) → row M6e; a Moglin never rins; RULED 8d3ada7: the **RINNSHOP** is the 6th workshop room (rinsticks, bait, catches readied for the hearth); a Moglin trade pairs with it; which Moglin/recipes/rod tiers = ours. Jin 2 (play lane) owns plot stations.

- **M6a rinning (11-17):** works end to end, but (1) nothing tells a stranger rinning exists: they must open the bag and
  read the bait pouch (a journal line or welcome-card line would fix it: wording = @lark); (2) 10 bait at birth and NO
  refill anywhere: where does more bait come from (Greg / Moglin / forage / Nyx shops)? Your call from 11-16, still open.
  Also likely: the continent's rinning (`nyx-rinning.tsx`) has the same mouse-only wiring on a phone (unchecked).

- **✅ FIXED + LIVE 11-17 (`d8b72da4`, Alex approved via serb): M7 save loss.** History: (1) Born in the open world, then visit `/shimmer` → the
  birth rune is DELETED and the gate reopens. The open world never writes `ather:epoch`, so `resetIfStale`
  (`lib/ather-epoch.ts:97`, run by /shimmer, play3d, voxel3d) reads it as a pre-epoch character. Reachable: sign-in returns to
  `/shimmer` by default (`lib/accounts/oauth.ts:32`), the games list and /room link there. (2) Anonymous → signed in on the
  open world → birth gate again: `adoptAnonKeeperState` only runs on those three old pages, never site-wide.
  Garden / pack / journal / deeds survive (unscoped keys); open-world progress never reaches the server.
  **Jin's fix (needs your yes, it is a save migration):** the open world stamps the current epoch when a keeper is born there
  (and on boot if a keeper exists and no epoch does), so those keepers count as current; and `SaveOwnerBoot` runs
  `adoptAnonKeeperState` site-wide on sign-in, before the gate reads. Never call `resetIfStale` in the open world: that
  would wipe every live keeper. Then `beta-m7-saves.mts` must PASS on prod.
  **Alex 11-17 (phone), the direction:** a keeper made before sign-in is a new game; on sign-in, if the account already has a
  save, a menu asks whether to ADD this keeper to the account's ROSTER. One garden file per account (email), several keepers in
  it, swapped like loadouts, so a birth rune stops being a one-way door. Character creator revisited later. Canon asked
  (CANON_GAPS f79b4da, multiple keepers per garden). Plan: (a) the epoch-stamp bug fix ships first (no design under which
  /shimmer should delete a keeper); (b) the roster replaces the plain site-wide adoption; it is a new system, so it gets its
  own GBOARD block + rows once Alex confirms what belongs to a keeper vs the garden.

- **✅ ANSWERED 11-17 → M11.** Alex, on his phone: too much on-screen clutter from the MAP / PACK / OPTIONS / etc. buttons. Noted, not yet acted on
  (he said continue). Proposal when he's back: one menu chip that opens the row, the rest hidden until tapped. Needs his yes on the shape.

- **M2/M3 continent (11-17, `90e4226d`, live):** the phone tap row (MAP/OPTIONS/PACK/CAMERA/GARAGE/ROAD) moved down to
  y=180, under the status chip, so it sits lower over the road. The "thumb here to drive/move" hint now wraps to two lines (the
  Ather plot too). At 360 wide the hotbar (364 px) clips ~2 px each side. OK, or move something? (shot: `scripts/beta-audit-continent.mts --w 390 --h 844 --phase drive`)

- **M1 birth wheel:** on a phone the neighbour runes' names ghost through the centre (Manalic / Life / Enchant behind
  Star). The wheel's design, so untouched. Keep, or fade the neighbours further on phones? (`scripts/beta-audit.mts` shot 13)
