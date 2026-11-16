# BETA — the one finish line

> Started 2026-11-16 by Jin (play `a19fe9a2`) when Alex asked for an AFK hive with a main goal. **DRAFT: Alex edits this.**
> GBOARD records what was built. This file records what is still missing before a stranger can play. The hive works THIS
> list while Alex is away and nothing else. A row closes when its check passes ON PROD, never because a note says it does.

## What beta means

A stranger lands on **ather.games on their phone**, makes a keeper, and plays the **first hour of the open world**
(the first errand, rinning, prospecting, a fight in the Wilds, a business) with **no dead ends, no lost save, no errors**.

**In scope:** the open world (Ather plot, the Wilds, the continent, its towns). **Shelved, not beta:** Nolmir, the arcade
cabinets, the Starforge ticket. They stay live but are not worked on; repurpose later (Alex 11-16).

## Milestones

Status: ⬜ open · 🟨 partly · ✅ check passes on prod · 🔒 needs Alex (look / feel / canon sign-off; the hive parks it and moves on)

| # | Milestone | Check (passes on prod = done) | Status |
|---|---|---|---|
| M1 | **Front door.** Home → Play → rune → born, on a phone, live in under 20 s, zero page errors | `scripts/beta-audit.mts` | 🟨 |
| M2 | **Phone HUD legible.** No two HUD elements overlap at 390×844 or at 360×780 | `beta-audit-2` m3-reach (touch buttons); 360×780 + non-touch HUD pieces still unchecked | 🟨 |
| M3 | **Touch controls.** The first touch moves you; the thumb zone does not sit on the hotbar; every HUD button opens its panel; every panel closes by tap | `scripts/beta-audit-2.mts` + asserts | 🟨 |
| M4 | **The next step is told.** Right after birth, the keeper sees what to do (Greg's errand in the journal, the trail lit) | new | ⬜ |
| M5 | **First errand, PLAYED.** Greg → runesmith → Enchant Temple → bracelet, reached on foot / courser, not by teleport hooks | `errand-check` + `runesmith-check` exist (hook-driven); new played version | 🟨 |
| M6 | **Core loops reachable in the first hour**: rinning, prospecting, a Wilds fight, buying a business. Each one found without a guide | one check per loop | ⬜ |
| M7 | **Saves survive.** Reload, close tab, come back next day; anonymous → signed-in keeps everything | new | ⬜ |
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
walks, PACK opens the bag. The birth screen hides its keyboard hint on phones. Still open in M2/M3: 360×780, MAP by tap, and
"TAP TO START" eating the first touch was judged FINE (it says tap, and a tap is what it takes). Birth-wheel ghost names = 🔒 Alex.

## How the hive works this list (AFK mode)

- **Hub (Opus, `/loop` ~25 min):** owns this file. Takes the top ⬜ row, hands it to a satellite, reviews the diff, deploys via
  `coord build`, runs that row's check on prod, flips the status. Pings Alex's phone ONLY for: a row closed, a 🔒 row ready for
  him, prod broken.
- **Satellites (1, at most 2, Sonnet):** one row each. Build, prove the row's check passes on its devwin, hand back to the hub.
- **Magii (standby):** a watcher sleeps until a lane asks her a canon question. A gap she cannot rule goes to Alex's queue.
- **Alex's queue:** the 🔒 rows plus any look/feel call, with a screenshot each, on one phone page. He clears it at lunch.
  **The hive never waits on him:** a 🔒 row is parked and the next ⬜ row is taken.
- **Rules:** only rows on this list. No new systems, no new lore. Canon gate + tests green before every build. Nothing
  public or outbound. Opus hub + Sonnet satellites, never four Opus windows on a shift.
