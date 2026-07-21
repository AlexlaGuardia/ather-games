# HANDOFF → mechanics window: birth-on-first-entry

**From:** art lane (Jin). **File to edit:** `src/app/shimmer/play3d/Shimmer3D.tsx` (your engine file — this is why it's yours, not mine). ~10 lines, all additive.

## Goal
A brand-new player (no save) should be **born before they spawn** — the birth carousel opens on first entry, not only via the ☰ New Game button. First-entry birth is **not cancelable** (you must choose); the New-Game birth stays escapable.

## What's already in the file (committed, ready to use)
- `birthOpen` / `setBirthOpen` state — the overlay toggle.
- `birthCancelable` / `setBirthCancelable` state — **already present** (a stray line of mine got swept into your `1773fed`; it's currently unused). Wire it up as below.
- `birthRuneRef` — the chosen rune id (for your later grant work).
- `<BirthScreen onChoose=… onCancel=… />` overlay, and both New-Game entry points call `setBirthOpen(true)`.

## Change 1 — first-entry detection (add near the `load()` effect, ~line 1331)
```tsx
// Birth on first entry — no save yet ⇒ born before spawn. Reads localStorage synchronously
// at mount, which is BEFORE load()'s async .then persist() runs, so a fresh player reads as
// fresh. Non-cancelable: a new player must choose a rune.
const bornCheckedRef = useRef(false)
useEffect(() => {
  if (bornCheckedRef.current) return
  bornCheckedRef.current = true
  try {
    if (!localStorage.getItem('ather:save:shimmer')) {
      setBirthCancelable(false)
      setBirthOpen(true)
    }
  } catch { /* private mode — skip, just spawn */ }
}, [])
```

## Change 2 — New-Game birth stays escapable
At **both** New-Game entry points (the ☰ menu "Yes" button and the mobile A-button `confirmNew` branch), add `setBirthCancelable(true)` right before the existing `setBirthOpen(true)`:
```tsx
setConfirmNew(false); setMenuOpen(false); setBirthCancelable(true); setBirthOpen(true)
```

## Change 3 — make onCancel conditional on the overlay
In the `<BirthScreen … />` mount, replace the unconditional cancel with:
```tsx
onCancel={birthCancelable ? () => setBirthOpen(false) : undefined}
```
`BirthScreen` already hides the "‹ back" control + Esc when `onCancel` is omitted, so first-entry birth has no escape automatically.

## Flow after this
fresh player enters → void carousel (no back) → pick rune → `onChoose` → `newGame()` fresh run + "Born of <Rune>" banner + rune saved to `ather:shimmer:birthRune`. Reload won't re-trigger (save now exists).

## Change 4 (optional now) — mount the HUD rune badge
Art built `RuneBadge` (in `birth/RuneBadge.tsx`) — it shows the player's chosen rune mark on the HUD so first-person-you carries your birth. It self-sources from localStorage, so it's a **zero-wiring one-liner** anywhere in your HUD DOM overlay (near the compass / objective toast). Pick a spot that doesn't collide with existing top-left/top-center HUD:
```tsx
import RuneBadge from './birth/RuneBadge'
// …in the HUD overlay JSX (not inside <Canvas>):
{!editMode && <RuneBadge style={{ position: 'fixed', top: 12, right: 12, zIndex: 36 }} />}
```
Pass `runeId={birthRuneRef.current}` instead if you want it to update instantly on New-Game birth without a reload. Renders nothing until a rune is chosen, so it's safe to always mount.

## Also in your lane (separate, when you're ready)
Fold `birthRuneRef.current` into `persist()`/`load()` and **grant a starting ability/glow** off the chosen rune — that's what turns birth from cosmetic into felt play. Art side (me) built the rune **marks** (`birth/RuneMark.tsx`, systematic element+state glyphs — NOT "sigils", that's the weapon system) + the badge; no overlap with `Shimmer3D.tsx`.
```
