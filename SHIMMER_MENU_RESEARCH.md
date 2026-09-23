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
