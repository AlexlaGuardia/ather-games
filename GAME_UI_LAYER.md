# The Game-UI Layer — killing the browser feel across the catalog

> Research + recipe, 2026-06-18 (jin-cc). Why our games *play* like games but *read* like a
> website, and the reusable layer that closes the gap. Applies to ALL surfaces — arcade catalog,
> Nolmir deck, in-game HUDs, overlays. Pairs with the existing `SHIMMER_STYLE_GUIDE.md` typography
> notes and the per-game vector-glow canvas style.

## The one idea

**Web UI is a document; game UI is a built object.** A website optimizes for *clarity on a flat
page* — generous uniform padding, soft rounded cards, system fonts, the browser's own focus/tap/
scroll behaviors. A game UI optimizes for *a framed thing you operate* — panels with weight, a
limited palette, text that sits ON something, brutal on/off contrast, and motion + sound on every
touch. (The industry frames this as diegetic vs non-diegetic UI — UI that belongs to the world vs
UI laid on top. Even our non-diegetic menus should feel like the *console of the cabinet*, not a web
page.) Our canvas already nails the vector-glow CRT identity; the chrome around it doesn't. That seam
is the whole "browser feel."

## The browser tells (the kill-list)

These are the specific defaults that scream "web page." Kill them globally:

1. **Tap highlight** — `-webkit-tap-highlight-color` (the grey/blue flash on mobile tap). → transparent.
2. **Text selection** — long-press selects menu text like an article. → `user-select: none` on chrome.
3. **The default focus ring** — the system blue outline. → kill `:focus`, design a `:focus-visible` glow.
4. **System fonts on labels** — the dead giveaway. → display face (Chakra Petch / Rajdhani) on every label/title/button; mono only for body/numbers.
5. **Soft web cards** — `rounded-lg` + uniform `p-5` + a faint 1px border = a Bootstrap card. → tighter, deliberate framing (sharp or *cut* corners, a real bezel, a plate).
6. **Underlined / colored-text links** — → links are framed controls or glyphs, never `<a>` blue.
7. **Instant state changes** — web toggles snap. → everything eases (120–280ms, game easing).
8. **Native scroll bounce / scrollbars** — → `overscroll-behavior: none`, hidden/styled scrollbars (we already have `useNoScroll` for one-screen games).
9. **Flat fills** — pure `#fff`/solid panels. → dark field + subtle gradient + glow + a texture pass (scanlines/vignette/grain — we already render a CRT overlay on canvas; extend it to chrome).
10. **System cursor everywhere** — → at least a pointer discipline; consider a custom cursor on desktop.

## The recipe (7 layers, cheapest-first)

Stack these. The first three do 80% of the work and cost almost nothing.

1. **Frame, don't float.** Text never sits raw on the background. Wrap it in a plate (a dark panel
   with a 1px glow border + inner shadow), give the panel *weight* (border + a faint outer glow in
   the accent), and prefer **sharp or cut corners** over `rounded-lg`. A clipped corner (`clip-path`)
   reads "HUD"; a soft 12px radius reads "web card."
2. **Type with role-split + tracking.** Display face, ALL-CAPS, wide tracking (0.1–0.25em) on SHORT
   strings (labels/tabs/buttons) only; body stays sentence-case mono. Hierarchy by **case/weight/
   color, not size** (near-uniform sizes; dim label + bright value is the game signature).
   `tabular-nums` on anything that ticks. (This is the SHIMMER_STYLE_GUIDE 6-trick list — already
   written, just not applied everywhere.)
3. **Brutal state contrast.** Inactive ≈ 40% opacity, no glow. Active = full opacity + an accent
   glow (text-shadow / box-shadow). Web uses subtle hover; games use on/off. Press states are
   **physical** — translate 1px + deepen the glow, never just a color swap.
4. **Depth + texture.** Dark base, a radial vignette, a faint scanline overlay (`repeating-linear-
   gradient`), a subtle accent bloom behind focal elements. Never a flat solid panel.
5. **Motion with game easing.** Entrances overshoot slightly (`cubic-bezier(0.16,1,0.3,1)`);
   stagger lists; numbers count up (we built `useCountUp` on the Nolmir deck — reuse). 120–280ms.
6. **Sound on touch.** Hover tick, press click, confirm chord, error buzz. We already have the
   `@/lib/arcade/sfx` engine + per-game patches — wire it into the shared button/tab components so
   it's automatic, not per-page.
7. **Diegetic framing (where cheap).** Treat the menu as the cabinet's console: a title plate, a
   bezel around the play area, "INSERT / PRESS START" energy. The arcade is literally "the Kindled
   Mug's cabinet" in canon — lean into it.

## Our anchor: the vector-glow CRT cabinet

We are NOT inventing a look — we have one (dark field, luminous cyan/amber line-glow, CRT scanlines,
Chakra Petch display). The job is to **extend that identity off the canvas and into the chrome** so the
frame matches the game inside it. Every shared component should default to: dark panel, accent-glow
border, caps+tracking labels, CRT texture option, sfx-on-interaction, game easing.

## The shared layer (what we build once, use everywhere)

`src/lib/gameui/` — opt-in, drop-in, no per-game reinvention:
- **`gameui.css`** (global, imported once): the kill-list resets (tap-highlight, selection, focus →
  `:focus-visible` glow), `.gx-plate` / `.gx-panel` / `.gx-bezel` framing utilities, `.gx-label` /
  `.gx-value` type roles, `.gx-scanlines` / `.gx-vignette` texture, `@keyframes` for entrance/press.
- **`<GxButton>` / `<GxTab>` / `<GxPanel>`** — components that bake in caps+tracking, the press
  physics, focus-visible glow, and an optional `sfx` hook (hover/press) so sound is automatic.
- Reuses what exists: `useCountUp`, `useGainFx`, `useNoScroll`, the sfx engine, Chakra Petch.

## Rollout (per surface, after Alex blesses the direction)

1. **Arcade catalog** (`/arcade/all`, `/arcade`) — the front door + most web-y (rounded cards). FIRST
   PROOF. Plate cards w/ cut corners + accent-glow border + CRT scrim, caps tracking, sfx on hover.
2. **Nolmir deck** — the tile hub; apply plate/label/value + press physics (it's the most menu-like game).
3. **Per-game start/over overlays** — title plates + framed CTAs (some already have card-art backdrops).
4. **In-game HUDs** — lightest touch (they're already vector-glow); just align type + plates.

Reversible at every step (each surface = one commit). Taste calls (how sharp the corners, how loud the
glow) are Alex's — this layer gives the vocabulary; he tunes the dial.

## Sources
- [Diegetic and Non-Diegetic UI in Games](https://nastyrodent.com/diegetic-and-non-diegetic-ui/)
- [The four horsemen of game UI design](https://corporationpop.co.uk/thoughts/game-ui-design) (the diegetic/non-diegetic/spatial/meta framework; origin: Fagerholt & Lorentzon 2009, "Beyond the HUD")
- [Game UI: principles, best practices, examples (Justinmind)](https://www.justinmind.com/ui-design/game)
- [Game menus as UX masterpieces (Medium)](https://krishnamohanyag.medium.com/game-menus-as-ux-masterpieces-lessons-for-designers-5c328050cfc7)
- [5 ways to make a mobile web app feel native (Medium)](https://malyshev-pro.medium.com/5-easy-ways-to-make-your-mobile-web-app-feel-more-native-368a8d982f9c)
- [Remove tap highlight (CSS-Tricks)](https://css-tricks.com/snippets/css/remove-gray-highlight-when-tapping-links-in-mobile-safari/)
