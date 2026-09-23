# Shimmer in-game menus — modernization research (2026-09-22, play lane e179b147)

> Input for the crafter A/B mock. Alex judges the look. Sources below are from a web-research agent;
> Hytale 2026 patch-note URLs and the SDLC "cozy UI" article are UNVERIFIED / low-weight.

## Verdict
The arcade gx chrome (dark plates, CRT scanlines, neon glow, Chakra Petch + tracked caps everywhere)
is the arcade cabinets' register. Every cozy/crafting reference (Palia, Dinkum, ACNH, Sky, Tiny Glade,
Minecraft Ore UI) converges on warm, soft, low-chroma, rounded, gently animated menus. Keep gx for the
cabinets; give Shimmer its own register.

## Traits that read modern
1. One radius token (8–16px), no square plates.  2. Translucent/blurred panels, not opaque black.
3. One or two warm accents tied to the world, no RGB glow.  4. Icon-first slots, detail in tooltip/side pane.
5. 150–250ms ease-out/spring motion, no hard cuts.  6. Humanist/rounded display + clean sans body.
7. Caps only for section headers; sentence case for items/actions.  8. Hierarchy by size/weight/space, not boxes.
9. Semi-diegetic framing (a device/book) where it fits.  10. One component tree for hover/focus/tap, ≥44px targets.

## Gameplay lessons (not just paint)
- Enshrouded: don't hide recipe requirements behind a click (we already name missing inputs — keep it).
- Dinkum / Satisfactory: crafting pulls from nearby storage. We have the plot bank → crafter could draw from it.
- Palworld: dense survival-grid chrome reads dated even in 2024.
- Minecraft Ore UI: a voxel game's UI rebuilt in HTML/CSS — our exact stack; precedent for rounded cards + button role system.

## Candidate directions
**A — Frosted Glade:** 14px radius, cream @72% + backdrop blur 16px, 1px white/40 inner border, soft shadow.
Parchment #F4ECDD, moss #7A9B6E active, honey #E8A855 highlight. Rounded display (Fredoka/Quicksand) + Nunito Sans.
56–64px rounded slots, hover scale 1.05 + warm ring. 180ms ease-out. Cheap: pure CSS.
**B — Carved Hearth:** illustrated wood/stone frame around a 10–12px-radius parchment content window.
Walnut + parchment, single ember accent. Storybook serif/rounded slab + clean sans. Carved icon wells,
"lifted paper" tooltip, spring open, page-turn between tabs. Stronger identity, needs generated frame art.

## Sources
Hytale UI (2018) https://hytale.com/news/2018/12/a-sneak-peek-at-hytale-s-user-interface ·
Enshrouded https://steamcommunity.com/app/1203620/discussions/0/4206994473256266269/ ·
Palia https://www.tammydraws.com/palia · Tiny Glade https://sparklin.com/foresight/tiny-glade---arguments-for-a-forgiving-interface ·
TotK https://uxdesign.cc/tears-of-the-kingdom-how-nintendo-improved-and-ignored-ui-issues-843f094b14b2 ·
Ore UI https://minecraft.wiki/w/Ore_UI · Sky https://developer.apple.com/news/?id=zm47it7t ·
Satisfactory https://satisfactory.wiki.gg/wiki/Blueprint_Designer · Game UI DB https://gameuidatabase.com

---

# ROLLOUT PLAN — Carved Hearth (B blessed by Alex 2026-09-22: "thats looking sooo much better")

Mock: `/shimmer/dev/hearth`. Owner: `play` lane, by agreement with hub (the files below are hub's shared surface).

**Inventory (2026-09-22):** 7 panels on `PanelFrame` (crafter, gardens, waymark/threshold, station, alchemy,
brewing ×2) · own-skin panels: satchel (bag/gear/letters/vessels/chests/bank, 1222 lines), keeper, bindings, brew,
passage, gfx, options, settings, profile, chat console · dialogue box · always-on HUD: hotbar, corner, mana gauge,
objective chip, prompt, say line, clock, minimap. ~190 hardcoded dark-theme classes (`text-white/N`, `bg-black/N`).

| # | Phase | Surfaces | Gate |
|---|---|---|---|
| 1 | **Kit** `shimmer/ui/hearth.tsx` + `hearth.css`: tokens as CSS vars, frame, X, tabs, well/slot, buttons, card, chip, divider, search, toggle/slider; fonts move to the game route; reduced-motion; ≥44px touch | new files only | tsc |
| 2 | **Frame flip:** `PanelFrame` wears the hearth. A TRANSITIONAL ink bridge remaps `text-white/*`, `border-white/*`, `bg-black/*` inside the frame so all 7 panels land legible in one commit. A guard counts panels still leaning on it and must reach 0; the bridge is deleted at 0 | 7 panels | prod shot per panel |
| 3 | **CraftGrid for real** = the mock, wired | crafter + sawmill/stonecutter/kiln | ★ Alex plays it |
| 4 | Station family | alchemy, brewing, brew, gardens, waymark/threshold | |
| 5 | **Satchel** (phone-critical, biggest) | bag, gear, letters, vessels, chests, plot bank | ★ Alex, phone + desktop |
| 6 | People panels | keeper, bindings, passage, profile | |
| 7 | Settings family | options, settings, gfx, chat console | |
| 8 | Dialogue box (parchment speech card; copy stays lark's) | dialogue | |
| 9 | **HUD over the world**, lightest touch, always on screen | hotbar, corner, gauge, chip, prompt, clock, minimap | ★ Alex look-call BEFORE building |
| 10 | Guards: `npm run gx` reclassifies Shimmer (it leaves gx on purpose, or the floor reads the migration as a regression); hearth adoption counter; bridge count = 0 | | |

Optional after 3: hand the wood frame to the generated-art pipeline (the procedural grain reads faint).
Each phase = its own commit(s), reversible; `VoxelWorld.tsx` touched only by small coordinated edits (hub's hotspot).
