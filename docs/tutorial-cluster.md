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
| Tess's | Tess | farming + cooking | (farming starter: TBD) |
| Bonn's | Bonn | forestry + woodworking | the **pruning tool** (= the forestry blade? naming TBD) |

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

## Beat 1: Greg (Alex 11-22, outline, lark writes the lines)
1. Spawn in Greg's garden, a marker on Greg.
2. Greg welcomes them to the Ather, "although they have not come in the best of times". The Wilds get worse every day; he fears for the Moglin settlements and the spirits who call it home.
3. Options split: **"Moglins?"** / **"Spirits?"**
   - Moglins: a quick description; the keeper can speak to some of the folk who live at the Glade.
   - Spirits: curious little creatures he has researched for a long time; he hands the keeper **the grimoire** ("I keep trying to grow what we know of them with this here, but there's always something getting in the way of my research"). Be careful in the Wilds; any help is appreciated.
4. Both heard -> new option **"The Wilds?"**: he points the keeper to his three friends (Otto, Tess, Bonn) and Fennel, the Moglin on his plot; "once you have heard them out, come see me again".
5. (next: Alex continues)

## Open questions
- Skip path: what does skipping give? (must hand over the same kit, or skippers start behind)
- Existing keepers (incl. Alex's save): can they visit the cluster?
- Dev tool: extend the M62 map editor to edit this cluster's four gardens (Alex wants to author all four).
- Garden / cluster naming by players (Alex aside, 11-22): later, separate row.
- Where the hand gun is handed over.
- Where the 100 grey matter -> own garden step sits relative to the champion.
- Tess's starter gift (seeds? watering can?).

## Canon asks (Magii) — batch, send when the loop is laid out
- **Otto, Tess, Bonn as the Glade's three garden-keepers.** Canon: they are the Spirit Tales leads (Bonn 11 at Bk1). Bonn fits: she is Gregory's keeper-ward, given "the old arrival plot", youngest keeper (characters/bonn.md:5,50). Otto lives at Forge Grove under Heslur; Tess at Goldleaf Acres under Maizie. When in the timeline is the game, and may Otto + Tess hold plots in the Glade (or their mentors)?
- Fennel as Greg's one plot Moglin, giving bait daily (moonwell-folk.md:58-78: Fennel = cook, keeps the first-rinstick quest).
- Moonwell Glade leaves the Wilds and becomes a closed four-garden cluster: allowed?
- (answered by Alex: the three are Otto, Tess, Bonn; see the first ask)
- Greg as a long-time spirit researcher who hands newborns a grimoire: true? (grimoire exists in code: ather/plot.ts)
