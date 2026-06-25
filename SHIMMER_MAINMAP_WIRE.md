# Shimmer Main-Map Wire (v1) — Jin build plan

> **2026-06-24 (Jin).** Supersedes `SHIMMER_GARDEN_MAP.md` (which used the retired **Burr/Nettle/Bramble** bosses + **1-of-3** starter). Canon source = `/root/athernyx/CANON/game/shimmer-quests-mainmap.md` + `shimmer-storyline.md` (Magii, 2026-06-24).
> **What changed in canon:** bosses are game-native **Thistle / Sorrel / Brack** (Thornlords stay book-only); starter is **RNG 1/10**; map matches Alex's doodle. Green-lit by Alex to rework maps as needed.

## Zone mapping (live id → doodle role)
IDs kept STABLE (referenced widely); only display names / themes change.

| Live id | New name | Element | Role in the chain |
|---|---|---|---|
| `garden` | **Home Plot** ✅ | mana | Player's own plot. Spawn + build mode. Reformed Moglins dock here. |
| `moonwell-glade` | Moonwell Glade | water | Greg + his home interior. Gate-to-folds (sealed). |
| `moonwell-glade-gregory-s-home` | (Gregory's Home) | water | Greg's interior. |
| `mycelial-path` | Mycelial Path | earth | Corridor W of home; forks to Spirit Meadows + Twilight Thicket. |
| `spirit-meadow` | Spirit Meadows | mana | **HOLD 1 — Thistle.** First collar sighting + first liberation. |
| `twilight-thicket` | Twilight Thicket | earth | Optional cozy pocket (off Wooded Pass). |
| `spore-hollow` | **Voranyx Caverns** ✅ | earth | E passage; "opens to the Silt" (sealed). Voranyx foreshadow. |
| `mana-springs` | Mana Springs | earth | E hub; the ascent begins. |
| `the-threshold` | **Ather Winds** ✅ | storm | Sealed gate to the Wilds. v1 closing hook. |

✅ = renamed this session.

## RESOLVED topology (2026-06-25, Alex's whiteboards — full blockout shipped, pushed @721fded)
The whole loop was drawn area-by-area and wired. Final chain (all blockout, flood-fill verified):
`Home Plot → Mycelial Path → {Wooded Trail → Twilight Thicket (dead-end pocket)}` and the east arm
`Mycelial → Voranyx Caverns 1F ⇄ 2F → Mana Springs → Route 2 → Gloview Village → Route 3 → The Outfields → Ather Wilds (LOCKED)`.
- **Boss model (Alex's ruling):** you FIGHT a boss at its spot, then it RETREATS (reformed) to **The Outfields**.
  Sorrel's fight = the **Gloview Village** pen → warps into existing `sorrel-hold`; **Brack** via sorrel-hold's
  gated east (`defeated_sorrel`). The Outfields holds the 3 retreat pens (Thistle/Sorrel/Brack `*-home` NPCs).
  This **reconnected the orphaned `sorrel-hold` + `brack-hold`**.
- **New zones authored** (consts in `world/tilemap.ts`, wired `world/zones.ts`): `VORANYX_DEEP` (Voranyx 2F),
  `ROUTE_2`, `GLOVIEW_VILLAGE`, `ROUTE_3`, `THE_OUTFIELDS`. Rebuilt: Wooded Trail, Twilight Thicket,
  Voranyx 1F (spore-hollow), Mana Springs, Moonwell Glade.
- **`the-threshold` (Ather Winds)** is no longer the v1 east terminus — The Outfields' right edge is the sealed
  Ather Wilds mouth (no warp v1). Reconcile the-threshold/Ather-Winds vs Ather-Wilds naming when it unlocks.
- **Blockout convention** (reuse): walls 34 (outdoor, grass 97) / 17 (cave, stone 100); pools 8; ALWAYS BFS
  flood-fill verify before writing. Walls are greybox → dressed at the LATER tile-art pass (blockout != art).

## Build sequence
1. **Zone retheme** ✅
2. **Topology + hold zones** ✅ (2026-06-25 — full blockout from Alex's whiteboards; see RESOLVED block above).
3. **Gating spine** — ⏳ NEXT. `requiredFlag` on the forward warps keyed to `defeated_thistle`, `defeated_sorrel`, `defeated_brack`. Engine already honors `requiredFlag` + stamps `defeated_<trainer>` on win. **Note:** the Gloview→Sorrel entrance is currently UNGATED, and **Thistle's FIGHT location is still unplaced** in the new map (only its retreat pen exists in The Outfields) — place Thistle + add its gate here.
4. **Greg's RNG starter grant** — replace the gregory-intro stub (currently only `setFlag tutorialComplete`). Add a grant action: roll a Mana Seed from a **data-driven ready-species pool** (starts {fox, axolotl, water-bear}; widen to all 10 as sprites land) + the starter bag (table/pot/grimoire/tools). Bloom = species-neutral.
5. **Dialogue swap** — convert the 8-beat Magii/Raven script (`shimmer-quests-mainmap.md`) into the node-graph JSON format (`data/dialogues/*.json`). New: greg welcome/tending/sendoff, thistle/sorrel/brack pre+post, the deflation, ather-winds hook. **Delete the cut dead-NPC dialogues** (luna/rootweaver/glint/moss/dusk/echo/wisp/bramble/ember intros) + the portal-laced gregory set (gregory-moglin-warning, the portal lines in gregory-intro/tablet). NPCs: keep gregory; add thistle/sorrel/brack; cut the rest.
6. **Three reformed-Moglin home stations** — on `defeated_brack` (all three down), dock Thistle=reserved slot, Sorrel=rename, Brack=trader at Home Plot. Placeholder Moglin-base+collar art until Thistle/Sorrel/Brack renders exist (Alex's pipeline).

## Art gates (Alex's pixel domain, parallel — not blocking the wire)
- **Thistle / Sorrel / Brack** Moglin renders (Kontext off `moglin-canon.png`). Until then: plain Moglin-base + collar placeholder.
- **Base-10 spirit sprites** — Alex making them now; each one landing widens the RNG starter pool.

## Done 2026-06-24
- `spirit.ts` SECOND_FORM_NAMES → canon morpheme grid (matches grimoire manifest). Type-safe data swap.
- Zone retheme (Home Plot / Voranyx Caverns / Ather Winds).

## Done 2026-06-25 (full map blockout — pushed @721fded)
- Authored/rebuilt all loop zones from Alex's whiteboards (see RESOLVED topology). Steps 1–2 of the build
  sequence complete; 3–6 (gating, Greg starter grant, dialogue swap, reformed stations) still pending.
- Fixed Greg's doorless home (interior exit warp was OOB) + moved Greg off a now-walled tile.
- (Engine, separate) sprite-shake-in-dialogue/skilling fix + New Game/save-wipe title button.
- Full handoff = `SHIMMER_SESSION.md` top block.
