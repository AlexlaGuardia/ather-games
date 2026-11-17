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

> **Order for 11-17 (Alex away, check-ins ~2 h):** M2/M3 continent → M7 saves → M6a → M6b → M6d → M5 played → the
> check-suite chore between rows. M6c: the hub checks a strangers' Wilds fight EXISTS before dispatching; if it needs
> building, it is an ask, not a row. M1's remainder is 🔒 (birth wheel), so skip it.

Status: ⬜ open · 🟨 partly · ✅ check passes on prod · 🔒 needs Alex (look / feel / canon sign-off; the hive parks it and moves on)

| # | Milestone | Check (passes on prod = done) | Status |
|---|---|---|---|
| M1 | **Front door.** Home → Play → rune → born, on a phone, live in under 20 s, zero page errors | `scripts/beta-audit.mts` | 🟨 |
| M2 | **Phone HUD legible.** No two HUD elements overlap at 390×844 or at 360×780 | `beta-audit-2 [--w 360 --h 780]` (Ather plot) + `beta-audit-continent [--w --h --phase drive|foot]`: both pages PASS on prod 11-17 (`90e4226d`). Covers `data-hud`/`data-touch` boxes only; the hotbar clips ~2px each side at 360 (🔒 look) | ✅ |
| M3 | **Touch controls.** The first touch moves you; the thumb zone does not sit on the hotbar; every HUD button opens its panel; every panel closes by tap | `beta-audit-2` (Ather plot) + `beta-audit-continent` (drive + foot): PASS on prod at 390 and 360, 11-17 (`90e4226d`) | ✅ |
| M4 | **The next step is told.** Right after birth, the keeper sees what to do (Greg's errand in the journal, the trail lit) | `shared/journal.test.ts` + `scripts/beta-m4-look.mts` (beacon + trail on Greg, prod 11-16, `92537123`) | ✅ |
| M5 | **First errand, PLAYED.** Greg → runesmith → Enchant Temple → bracelet, reached on foot / courser, not by teleport hooks | `errand-check` + `runesmith-check` exist (hook-driven); new played version | 🟨 |
| M6a | **Rinning, found and played.** A keeper finds bait + the rinstick and lands a rinn without a guide | `rinning-check` (exists, hook-driven) + a played version | ⬜ |
| M6b | **Prospecting, found and played.** A keeper finds a node and cuts a gem without a guide | `prospect-check` (exists) + a played version | ⬜ |
| M6c | **A fight in the Wilds.** A keeper reaches the Wilds and wins (or survives) a fight without a guide | new | ⬜ |
| M6d | **Buying a business.** A keeper finds a deed on the continent and buys it without a guide; it survives a reload | `market-check` (exists: Rune Hold mine, buy, reload) + a played version | ⬜ |
| M7 | **Saves survive.** Reload, close tab, come back next day; anonymous → signed-in keeps everything | `scripts/beta-m7-saves.mts`: PASS on prod 11-17 after `d8b72da4` (open world stamps the epoch; keeper adoption site-wide). Account with a keeper already + an anonymous one = the roster (Alex's direction, queue) | ✅ |
| M8 | **Clean console.** Zero page errors / console errors / 4xx-5xx across every beta check | rolled into each check | 🟨 |
| M9 | **Phone performance.** Holds frame rate on a mid phone; heap stays bounded over 30 min | new + 🔒 Alex's phone | ⬜ |
| M10 | **Alex's sign-off pass.** He plays the first hour on his phone and calls it | 🔒 | ⬜ |

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

- **Alex 11-17, on his phone: too much on-screen clutter** from the MAP / PACK / OPTIONS / etc. buttons. Noted, not yet acted on
  (he said continue). Proposal when he's back: one menu chip that opens the row, the rest hidden until tapped. Needs his yes on the shape.

- **M2/M3 continent (11-17, `90e4226d`, live):** the phone tap row (MAP/OPTIONS/PACK/CAMERA/GARAGE/ROAD) moved down to
  y=180, under the status chip, so it sits lower over the road. The "thumb here to drive/move" hint now wraps to two lines (the
  Ather plot too). At 360 wide the hotbar (364 px) clips ~2 px each side. OK, or move something? (shot: `scripts/beta-audit-continent.mts --w 390 --h 844 --phase drive`)

- **M1 birth wheel:** on a phone the neighbour runes' names ghost through the centre (Manalic / Life / Enchant behind
  Star). The wheel's design, so untouched. Keep, or fade the neighbours further on phones? (`scripts/beta-audit.mts` shot 13)
