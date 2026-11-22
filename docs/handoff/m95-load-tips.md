# M95 · Load-screen tips (lark draft, for Alex's sign-off)

Dispatched by Jin hub, BETA row M95, 2026-11-22. One tip per load plate. Tags: register `[plain]` `[dry]` `[sarcastic]`,
side `[ather]` (cozy loads: no em dashes, no semicolons) `[nyx]` (continent loads: em dashes allowed) `[both]`.
Every tip was checked against the build on 2026-11-22; the source is in the trailing comment so a later change can be re-checked.
All under 110 characters. Keys are the defaults (shared/keymap.ts); a player who rebinds sees the old letter, which is fine on a load plate.

## Plain (12)

- [plain][both] Hold F to charge your Mana Skin. It costs a little mana and soaks blows until it pops. <!-- vitals-economy.ts skin*, use-skin-charge.ts -->
- [plain][both] R draws your gun. Tap again to swap or reload. Hold R to put it away. <!-- stance.ts -->
- [plain][both] Hands free, you move a little faster, and a node gets the right tool on its own. <!-- stance.ts stowed -->
- [plain][ather] Stand at one of your waymarks and press E to travel. <!-- ather/page.tsx header l.11 -->
- [plain][ather] Press L at your own waymark to lift it back into your bag. <!-- ather/page.tsx KeyL -->
- [plain][ather] Out in the Wilds, press H to walk home. <!-- ather/page.tsx KeyH goHome -->
- [plain][ather] Walk over grey matter to pick it up. Gregory, at Moonwell Glade, trades it for new ground. <!-- page.tsx guide copy, plot.ts -->
- [plain][both] Every potion shares one cooldown. Drink, then give it fifteen seconds. <!-- ECON.potionCd 15 -->
- [plain][both] Mana refills after a short rest from spending it. Casting, gathering and reloading all count. <!-- ECON.manaPause 3 -->
- [plain][both] Keys can be moved. Open Options, then Controls, and press the key you want. <!-- keymap.ts, options.tsx setBinding -->
- [plain][ather] Right-click with empty hands to swing. Three hits pop a placed piece back into your bag. <!-- ather/melee.ts -->
- [plain][nyx] Every city keeps a pitstop — visit it once, and the door stays open to you. <!-- continent/pitstops.ts -->

## Dry (10)

- [dry][both] Press Space again in the air. You get one more jump than seems fair. <!-- locomotion.ts airJumps; guide "again in the air" -->
- [dry][ather] Stand still a while and your companion finds somewhere to nap. The camera gets curious too. <!-- shared/idle-mode.ts IDLE_AFTER 25 -->
- [dry][ather] A rinn that gets away takes the bait with it. The line never breaks, so there is that. <!-- shared/reel.ts -->
- [dry][ather] When a rinn fights, give a little. When it tires, take. Hold to take, let go to give. <!-- shared/reel.ts -->
- [dry][both] Morel only speaks when it matters. Running low on rounds matters. <!-- shared/morel.ts quiet by default, RED_AT -->
- [dry][ather] Your Moglins keep the stations busy while you are away. You will hear all about it. <!-- ather/away-report.ts -->
- [dry][both] Only one companion walks with you at a time. Choose on the Character tab, and choose kindly. <!-- shared/companion.ts -->
- [dry][nyx] The Corkhouse buys your bottles. Nobody else will — ask around if you like. <!-- business/corkhouse.ts "the ONLY place" -->
- [dry][nyx] A farm on its own sells its produce raw — and cheap. <!-- economy/tycoon.ts farm blurb -->
- [dry][nyx] Your businesses keep working while you are gone — eight hours of it. After that, they wait. <!-- tycoon.ts MAX_CATCHUP_MIN -->

## Sarcastic (8)

- [sarcastic][nyx] You start with 1,500 Marks. The cheapest deed is 35,000. Pace yourself. <!-- economy/prices.ts, tycoon.ts farm -->
- [sarcastic][ather] Fell to the Hollows? Your pack is where you fell. Go back soon. How soon is a secret. <!-- ather/backpack.ts hidden clock -->
- [sarcastic][both] Reloading costs mana. Yes, every time. Shoot like you meant it. <!-- ECON.reloadMana -->
- [sarcastic][nyx] Your hands are busy at the wheel. E gets you out of the Darter. The shop will wait. <!-- continent/page.tsx l.1382, keymap KeyE -->
- [sarcastic][both] A blank glove casts nothing. It will tell you so, every single time you try. <!-- shared/casting.ts -->
- [sarcastic][both] Mana Skin takes a second to start filling. Mid-fight is a bold time to begin. <!-- ECON.skinStall 1 -->
- [sarcastic][ather] You can plant twelve waymarks. One on every hill was a lovely plan. <!-- ather/waymarks.ts MAX_WAYMARKS 12 -->
- [sarcastic][ather] Gregory sells the ground under the mist. He does not take compliments. Bring grey matter. <!-- page.tsx guide copy -->

## Gaps

- **"Fold map"** is build UI vocabulary, not in `glossary.md`; the waymark tip says "travel" instead. Ruling needed before any tip names it.
- **"Ather Infusion"** (the mana-refill drink) is flagged in `CANON_GAPS.md:4783` as colliding with canon's *Infusion*; left unnamed. **Health Draught** heals the keeper in the build but canon's row says it restores *spirit* HP (`shimmer-skilling.md:639`); left unnamed too.
- **Hollows at night only / only on drained ground** (canon) not verified as a build rule, so no tip claims when or where they walk.
- **Finding for Jin, not a tip:** the Ather first-play overlay (`ather/page.tsx` ~l.1450) still says *"F plants a waymark"*. F is the Mana Skin since M80; a held waymark plants with click / E.
