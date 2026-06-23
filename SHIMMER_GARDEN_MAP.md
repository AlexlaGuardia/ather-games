# Shimmer — Gregory's Garden (F2P Area) Design Map

> The backbone roadmap for Shimmer's free-to-play area. Captured from Alex's whiteboard
> + interview 2026-06-23 (`cortex/whiteboard/latest.png`). This is the SCOPE we design
> fully. Everything past "the Ather" is parked (see bottom) — and that parked stuff is also
> what would need real hardware, so keeping it parked keeps the near-term build achievable
> on the current web stack.

## The map — 8 plots around the home plot
From the whiteboard (hub-and-spoke around the player's plot; ≡ = boss gate):
- **Home plot** (central small blob) — the player's editable plot. Build mode, crafting,
  plant/bloom mana seeds. The heart of the loop.
- **Moonwell Glade** (right) — Gregory's home. The **tutorial gate** + **fishing ("rinning")**.
- **Forestry** (NW) — prune the forest → **wood**.
- **Mining** (center) — mine → **stone / ore**.
- **Thornlord plots ×3** (top / left / bottom) — each held by a boss moglin; gated (≡).
- **"→ to the Ather"** (bottom-right exit) — boundary out of the garden to the wider world.

## Onboarding / story gate
1. Player starts → goes to **Moonwell** → **Gregory teaches the basics** (tutorial only),
   then grants access to roam.
2. After that it's open. Mine / prune / fish at will. The game punishes the unready but
   does not hard-rail.

## Progression — the Thornlords (the spine)
Three Thornlord moglins gate progress toward the Ather.
- Beat one → **random Mana Seed** → carry home → **bloom** it on your plot.
  (Combat pillar feeds the garden pillar — the loop closes.)
- Beat **all three** → they **join your home plot as helpers** (boss → ally arc):
  - **Bramble** — the **trader** (sells crafting tables etc. = the chicken-egg backstop).
  - **Nettle** — **renames spirits**.
  - **Burr** — **builds for you** (a build queue).

## The core loop
explore → gather (wood / ore / fish) → craft → beat a Thornlord → mana seed + helper →
home plot grows → repeat → exit to the Ather.

## Gathering → materials
| Plot | Verb | Yields |
|------|------|--------|
| Forestry | prune | wood |
| Mining | mine | stone / ore |
| Moonwell | rinning (fish) | fish |
| Thornlord (boss) | defeat | random mana seed (bloom at home) |

## How this plugs into what we've built / planned
- **Chunked bake (done)** → each plot can be as big as feels right; size is now just a dial.
- **Home-plot build mode, inventory-driven (Brick #1 done)** → the central plot.
- **Party combat (built)** → the three Thornlord fights.
- **Crafting roadmap (next bricks)** → gather→craft→place; Bramble = the trader backstop.
- **Spirits / Keepers** → discovered while roaming; Nettle renames them.

## OPEN QUESTIONS
1. **What each Thornlord gate opens** — do the gather zones (Forestry/Mining/Moonwell) open
   from the start with bosses only gating the chain to the Ather? OR does beating a boss
   unlock the next gather zone (boss → new material → better craft → next boss)? Linear
   chain vs. open order. (Asked 2026-06-23.)
2. Plot sizes — how big should each *feel*? (dial, post-chunking.)
3. Where does **mana** as a craft material come from (Moonwell? blooming?) vs. mana seeds.

## PARKED — beyond the F2P garden (future; likely needs hardware)
- **The Ather:** the **Wilds**, the **Sea of Folds**, **Underneath the Silt** (Voranyx tunnels).
- **Monetization:** battle-pass-gated vs. one-time purchase — TBD.
- Explicitly OUT of current scope. Captured here so it's not lost; do not design deeper yet.
