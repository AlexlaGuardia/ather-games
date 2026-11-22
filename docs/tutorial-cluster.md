# Tutorial cluster (Moonwell Glade start) — living spec

> Planning doc, Alex + Jin hub, started 2026-11-22. Nothing is built from this until Alex says the plan is solid.
> Alex's words are the outline; every in-game line is drafted by **@lark** from it; new people/places go to **Magii**.

## Premise
A newborn keeper spawns into a CLOSED cluster of four gardens (the existing cluster shape: ne/nw/sw/se), not the open Wilds.
**Moonwell Glade** and its gate move OUT of the Wilds and become this cluster. Name stays Moonwell Glade (Alex 11-22).
The tutorial is **opt-in by dialogue**: talking it through IS the tutorial; the skip path is skipping the talk (see Open).

## The four gardens (Alex 11-22; order does not matter much)
| garden | who | Moglins on the plot (examples only, NOT invitable) | gives |
|---|---|---|---|
| Greg's (spawn) | Gregory | ONE: **Fennel** (rinning; canon moonwell-folk: the cook who keeps the first-rinstick quest) | the grimoire; Fennel gives the first rinstick + bait, then ~25 free bait per in-game day (early free source) |
| Otto's | Otto | masonry + metalworking | the default mining **spike**; its tool socket lights up |
| Tess's | Tess | farming + cooking | a strong variety of starter seeds incl. 1 random grade-A seed |
| Bonn's | Bonn | forestry + woodworking | the **pruner** (forestry tool; vs today's blades: naming to Magii) |

The tutorial Moglins show how Moglins work in a player's garden; the player cannot invite them.
New keeper starts with the tool sockets **empty**; each friend lights one up. The hand gun introduces guns; the upgrade comes later.
**Shovel:** Alex 11-22 "I think the shovel is going to fall off, I don't see a use for it anymore" (check what still uses it before cutting).
**Garden backdrops** are swappable per garden: a new garden starts with the green, Greg's has the Glade; more backdrops later for customizing.

## Beat 2: the gate (Alex 11-22)
After the keeper has spoken to Otto, Tess, Bonn and Fennel, Greg asks for help with a task "that may be a little dangerous": a settlement in the nearby Wilds needs assistance, and he is too old and frail to help in any way that matters. He points to **the gate at the centre of the Glade**.
Through the gate -> the **"The Wilds" waypoint** = the FIRST SETTLEMENT on the path.

## The first settlement (alchemy)
- Focused on alchemy; a SIDE QUEST to learn more about potions, reward = a **basic alchemy furniture set**.
- Terrorized by Hollows: they ask the keeper to defeat the **champion** to clear the infection in the area (champion exists: ather/champion.ts).
- **Infection map:** the map stays NULL until uncovered, then starts CLEAR; infection grows over time if neglected (not fully infected on arrival).
- **Settlement editor:** per settlement, a 200x200 m flat area Alex edits, the map forms around it (extend the existing settlement/blueprint tool, M39).

## Beat 3: after the champion -> your own garden (Alex 11-22)
- Champion down, the Moglins are happy: they give a few **potions** + a **pack of collected stuff** (a variety of resource items the keeper will need soon, to get going; contents = Jin's call, pick from the next hour's needs).
- Back at the Glade, Greg is waiting for the news: "they could use more keepers like you"; if you're up for the challenge he can **fold you your own garden**, paid in the grey matter "these Hollows are so conveniently dropping".
- **100 grey matter** -> the garden's first gate + a small area to tend (the green + the initial square, as now). **More grey matter** -> bigger.
- **Waymarks:** Greg offers them at ~**500 grey matter**, and gives **3 free**. They link to your garden and make exploring the Wilds easier.
- **Player-placed waymarks** (Alex aside): let keepers place them ANYWHERE in the Wilds (new mechanic, its own row).

## Beat 4: the hand gun, the skip path, the gifts (Alex 11-22)
- **Hand gun:** the keeper already carries it from the start; Greg remarks on it ("lucky you're armed", lark writes it). No hand-over beat.
- **Skip path = the gate is open from the start.** A keeper can walk through and beat the champion right away. That CLEARS the earlier beats (the intro talk is no longer required); they talk to Greg to continue unlocking the garden, and **two side quests appear**, one per keeper, to unlock the tools they need: Otto's **spike** and Bonn's **pruner**.
- **Fennel's quest** pops up when the keeper builds the Rinnshop, if not already done.
- **Tess's gift:** a strong variety of starter seeds, including **1 random grade-A seed**.

## Beat 5: from the Ather to Nyx (Alex 11-22)
- **The game centres on the Ather.** Otto, Tess, Bonn are grown adults now (Alex answers Magii's open #2).
- The Glade spawn REPLACES the Rune Hold opening (Alex answers Magii's open: centre the game on the Ather).
- **Trigger:** after the keeper's first DEATH, the game waits until the backpack is recovered or despawns, then **Morel pings** about the **grandfather's note** they still haven't read (in the inventory the whole time; reading it any earlier starts the questline too).
- The note starts **"The Dig"** questline: points to the nearest gate; in the gate's panel the **flip-the-map button pulses** to get the keeper to swap to the Nyx side.
- Nyx map: like the Ather side, a clickable list on the right of every city visited; **Rune Hold** is there by default, pulsing; click it -> travel to Rune Hold.

## Nyx side rework (Alex 11-22: "not happy with the look and feel of nyx side") — its own plan
- A hybrid: **grid building areas** for neighbourhoods + big buildings, attached to a **clean road infrastructure**: mostly two-lane roads, back roads + shortcuts, the longer routes opening into **four-lane highways**; the landscape is sculpted AROUND the roads.
- Start with **empty plots**: no buildings yet, get the foundation right first.
- **The Passage becomes a DRIVE-THROUGH**: a highlighted area, drive in -> a store-front page: main hero = the gun shop, a side panel for vessels, another "coming soon" for apparel.

## Beat 1: Greg (Alex 11-22, outline, lark writes the lines)
1. Spawn in Greg's garden, a marker on Greg.
2. Greg welcomes them to the Ather, "although they have not come in the best of times". The Wilds get worse every day; he fears for the Moglin settlements and the spirits who call it home.
3. Options split: **"Moglins?"** / **"Spirits?"**
   - Moglins: a quick description; the keeper can speak to some of the folk who live at the Glade.
   - Spirits: curious little creatures he has researched for a long time; he hands the keeper **the grimoire** ("I keep trying to grow what we know of them with this here, but there's always something getting in the way of my research"). Be careful in the Wilds; any help is appreciated.
4. Both heard -> new option **"The Wilds?"**: he points the keeper to his three friends (Otto, Tess, Bonn) and Fennel, the Moglin on his plot; "once you have heard them out, come see me again".
5. (next: Alex continues)

## Open questions
- Existing keepers (incl. Alex's save): can they visit the cluster?
- Dev tool: extend the M62 map editor to edit this cluster's four gardens (Alex wants to author all four).
- Garden / cluster naming by players (Alex aside, 11-22): later, separate row.
- Garden growth: grey matter per size step (100 = first gate + small area; the next steps?).
- Where the existing grey matter fold/plot costs sit today (ather/plot.ts) vs this ladder.

## Magii rulings (RULED-AFK, athernyx 43fef80, 11-22)
1. Closed Glade cluster: YES, Greg's; nobody joins it.
3. Grimoire: YES, already canon (ather-story:62).
4. Fennel: YES. The other four Glade Moglins stay at the Glade: **Sax -> Otto's, Hazel -> Bonn's, Yarrow + Mallow -> Tess's** (placement ours to move).
5. **Pruner = the forestry tool.** Bonn gives the starter pruner; blade tiers become PRUNER tiers (a rename across the build).
6. Grey matter fold + waymarks: YES (waymarks canon: gates.md:17,106). AMENDS 11-18: **no garden until Greg folds the first for 100 GM**; the grimoire 10/15/25 tiers still gate the growth cells after.
7. Champion + spreading grey: YES; the player-facing word for the spread = @lark.
ANSWERED by Alex 11-22 (beat 5): grown adults; the Glade replaces the Rune Hold opening. Was OPEN: (2) Otto/Tess/Bonn are ~1070 years older by 1672: grown, ageless keepers with teaching gardens beside Greg's? And: does the Glade spawn REPLACE the Rune Hold opening (corner door, Kael's note, the fork) or start the Ather road AFTER the fork?

## Canon asks (Magii) — batch, send when the loop is laid out
- **Otto, Tess, Bonn as the Glade's three garden-keepers.** Canon: they are the Spirit Tales leads (Bonn 11 at Bk1). Bonn fits: she is Gregory's keeper-ward, given "the old arrival plot", youngest keeper (characters/bonn.md:5,50). Otto lives at Forge Grove under Heslur; Tess at Goldleaf Acres under Maizie. When in the timeline is the game, and may Otto + Tess hold plots in the Glade (or their mentors)?
- **The pruner**: Bonn's forestry tool. Today forestry uses blades (Worn Blade, shimmeroak_blade; blades bind at the Carpentry bench). Is 'pruner' a new canon tool, a rename of the blade, or the starter blade's name?
- Fennel as Greg's one plot Moglin, giving bait daily (moonwell-folk.md:58-78: Fennel = cook, keeps the first-rinstick quest).
- Moonwell Glade leaves the Wilds and becomes a closed four-garden cluster: allowed?
- (answered by Alex: the three are Otto, Tess, Bonn; see the first ask)
- Greg as a long-time spirit researcher who hands newborns a grimoire: true? (grimoire exists in code: ather/plot.ts)
