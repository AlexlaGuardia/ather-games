# Shimmer — Gregory's Garden (F2P Area) Design Map

> Backbone roadmap for Shimmer's free-to-play area. Captured from Alex's whiteboard
> (`cortex/whiteboard/latest.png`) + interview 2026-06-23, refined to a LINEAR gated
> progression. Scope = the garden; everything past the Wilds Pass ("the Ather") is parked.

## Scale principle (Alex's call)
**Pokémon-style.** The playthrough should TAKE TIME, and the **connecting paths are themselves
explorable map zones** (Pokémon Routes), not instant doors. Perceived size comes from the
NETWORK of themed zones + meaningful routes between them — NOT from making each plot huge.
So per-plot size is a soft dial; the journey across many zones is what sells "big."
(Mycelial Path is literally already a route zone — that's the model.)

## Progression — linear, gated by the 3 Thornlords
1. **Start: only Greg's path is open.** Talk to **Gregory** (Moonwell Glade, his home) → he
   gives your **first spirit (choose 1 of 3)** + the basics, then opens the way out.
2. → **Spirit Meadow** opens. To the north: **Burr** (1st Thornlord), gating north.
3. **Beat Burr** → opens the loop: back down to the **home plot via Mycelial Path**, plus
   **Shimmeroak Thicket** (forestry / wood), **Mana Springs** (mining), and the path to
   **Nettle** (2nd Thornlord) at her plot **Gloview Village**.
4. **Beat Nettle** → the last path opens to **Bramble** (3rd Thornlord) waiting at **the Wilds Pass**.
5. **Beat Bramble** → the Wilds Pass becomes the exit **to the Ather** (parked).

- Each Thornlord beaten → **random mana seed** → carry home → **bloom** it on your plot.
- All three beaten → they **join the home plot as helpers** (boss → ally):
  **Burr = build queue** · **Nettle = rename spirits** · **Bramble = trader** (sells crafting tables etc.).

## Zone map → existing tilemaps (most are ALREADY BUILT)
| Design name | Role | Existing zone id | Status |
|---|---|---|---|
| Shimmer Garden | home plot (editable) | `garden` | built |
| Moonwell Glade (+ Greg's home) | tutorial · Greg · fishing ("rinning") | `moonwell-glade` / `moonwell-glade-gregory-s-home` | built |
| Spirit Meadow | first area; get starter spirit | `spirit-meadow` | built |
| Mycelial Path | route looping back to home | `mycelial-path` | built (route) |
| Shimmeroak Thicket | forestry / wood | `twilight-thicket` (retheme/rename) | built → retheme |
| Mana Springs | mining / ore (+ mana?) | `mana-springs` | built |
| Gloview Village | Nettle's plot (2nd boss) | `spore-hollow`? or new | tbd |
| The Wilds Pass | Bramble (3rd boss) · exit to the Ather | `the-threshold` (retheme/rename) | built → retheme |

→ **Most of the garden already exists as tilemaps.** The build is mostly **wiring**: progression
gates, the 3 boss fights, Greg's tutorial + spirit choice, the gather mechanics, and retheme/rename.

## Core loop
Greg → starter spirit → Spirit Meadow → beat Burr → unlock thicket/springs/home-route → gather
(wood/ore/fish) + craft → beat Nettle → beat Bramble → exit to the Ather. Boss mana seeds bloom
at home; defeated Thornlords join as helpers that cut friction.

## Gathering → materials
| Zone | Verb | Yields |
|---|---|---|
| Shimmeroak Thicket | prune | wood |
| Mana Springs | mine | stone / ore (+ mana?) |
| Moonwell | rinning (fish) | fish |
| Thornlord (boss) | defeat | random mana seed (bloom at home) |

## How it plugs into built systems
- **Chunked bake (done)** → size is a dial; routes can run Pokémon-length.
- **Home-plot build mode, inventory-driven (Brick #1 done)** → `garden`.
- **Party combat (built)** → the three Thornlord fights.
- **Crafting bricks (next)** → gather→craft→place; Bramble = the late trader (see flag).
- **Spirits / Keepers** → starter spirit from Greg; Nettle renames them.

## FLAGS / OPEN
- **Early crafting access (real gap):** Bramble (the trader who sells crafting tables) is the
  LAST boss — so the trader backstop arrives at the END. Decide where the FIRST crafting table
  comes from: Greg gifts one at the tutorial? start owning one? Otherwise early players can't craft.
- **Mana as a material:** Mana Springs (mined) vs. blooming mana seeds — which feeds crafting?
- **Gloview Village:** reuse `spore-hollow` or author a new zone?
- **Sizes:** soft dial; tune to playthrough length once the chain is wired.

## PARKED — beyond the garden (future; likely needs hardware)
The Ather: the **Wilds**, the **Sea of Folds**, **Underneath the Silt** (Voranyx tunnels).
Monetization (battle-pass vs one-time) TBD. Out of scope — captured only, do not design deeper.
