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

## OPEN topology question (needs Alex / map-draw)
Doodle east arm = Mana Springs → [Hold] → [Hold] → Ather Winds, i.e. **Holds 2 & 3 sit between Mana Springs and Ather Winds.** Live map has only `spore-hollow`(→Voranyx Caverns) on the east side. So **Sorrel (Hold 2) + Brack (Hold 3) need homes:**
- Option A: Sorrel holds **Mana Springs** itself; Brack gets **one new zone** before Ather Winds.
- Option B: **two new zones** between Mana Springs and Ather Winds (truest to the doodle).
- Per the "Alex draws maps" workflow, the per-zone tile layout is Alex's (Blockout); I wire the zones.ts/warps once the count is set.

## Build sequence
1. **Zone retheme** ✅ (names/roles above; topology unchanged so far).
2. **Topology + hold zones** — set Hold 2/3 homes (option A/B), redo warps to the hub-and-line, gate them.
3. **Gating spine** — `requiredFlag` on the forward warps keyed to `defeated_thistle` (opens east), `defeated_sorrel`, `defeated_brack` (opens Ather Winds). Engine already honors `requiredFlag` + stamps `defeated_<trainer>` on battle win.
4. **Greg's RNG starter grant** — replace the gregory-intro stub (currently only `setFlag tutorialComplete`). Add a grant action: roll a Mana Seed from a **data-driven ready-species pool** (starts {fox, axolotl, water-bear}; widen to all 10 as sprites land) + the starter bag (table/pot/grimoire/tools). Bloom = species-neutral.
5. **Dialogue swap** — convert the 8-beat Magii/Raven script (`shimmer-quests-mainmap.md`) into the node-graph JSON format (`data/dialogues/*.json`). New: greg welcome/tending/sendoff, thistle/sorrel/brack pre+post, the deflation, ather-winds hook. **Delete the cut dead-NPC dialogues** (luna/rootweaver/glint/moss/dusk/echo/wisp/bramble/ember intros) + the portal-laced gregory set (gregory-moglin-warning, the portal lines in gregory-intro/tablet). NPCs: keep gregory; add thistle/sorrel/brack; cut the rest.
6. **Three reformed-Moglin home stations** — on `defeated_brack` (all three down), dock Thistle=reserved slot, Sorrel=rename, Brack=trader at Home Plot. Placeholder Moglin-base+collar art until Thistle/Sorrel/Brack renders exist (Alex's pipeline).

## Art gates (Alex's pixel domain, parallel — not blocking the wire)
- **Thistle / Sorrel / Brack** Moglin renders (Kontext off `moglin-canon.png`). Until then: plain Moglin-base + collar placeholder.
- **Base-10 spirit sprites** — Alex making them now; each one landing widens the RNG starter pool.

## Done this session
- `spirit.ts` SECOND_FORM_NAMES → canon morpheme grid (matches grimoire manifest). Type-safe data swap.
- Zone retheme (Home Plot / Voranyx Caverns / Ather Winds).
