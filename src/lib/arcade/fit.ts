// ARCADE TOOLKIT — one shared rule for sizing a game SCREEN so it always fits a phone.
//
// Every cabinet stacks header → screen → control deck, and useNoScroll pins the page
// (you can't scroll to reach anything that overflows). So the screen must never grow so
// tall that the deck falls off the bottom. This returns the screen's max width, clamped
// by BOTH the game's native width and the height left over after the chrome:
//
//   width = min(nativeWidthPx, (100dvh - reserve) * nativeAspect)
//
// - dvh (not vh) so the phone's URL bar is subtracted — the classic "controls cut off on
//   mobile" bug is vh counting space that isn't actually visible.
// - reserve = vertical budget for everything that is NOT the screen: header, score row,
//   the control deck, footer hint, and cabinet padding. Tune per game only if its header
//   is unusually tall/short; the default fits the standard header + a compact deck.
//
// Use the SAME value for the header/score/deck maxWidth so the whole cabinet stays aligned.
//
//   <ArcadeCabinet maxWidth={screenMaxW(VW, VH)}> ... maxWidth={screenMaxW(VW, VH)} ...
//
// Landscape games (VW > VH) are rarely height-bound; the min() just falls through to VW.

export const DECK_RESERVE = 222 // header + control deck + footer + padding, in px. Deck heights
                                // are normalized (stick gate sized to the button deck), so one
                                // reserve fits all games without clipping. 1.5x thumb deck.

export const DPAD_RESERVE = 342 // a 4-way D-pad is 3 rows tall (~2x a stick/button deck), so
                                // D-pad games (dewdrop) pass this instead — the screen shrinks
                                // to make room for the taller deck. screenMaxW(VW, VH, DPAD_RESERVE).

// DESKTOP MODE (added 2026-07-12): the cabinet is mobile-native — on a monitor the same
// portrait cabinet just floated small in the middle with big dead margins, and the touch
// deck stayed the only input. `ArcadeCabinet` sets three CSS vars on `:root`, overridden
// under `@media (hover:hover) and (pointer:fine)`:
//   --ac-reserve : deck-height budget. Desktop drops the touch deck for a slim keybind
//                  plate, so far less vertical chrome to subtract → the screen grows.
//   --ac-wscale  : native-width multiplier. 1 on mobile (never upscale a phone); >1 on
//                  desktop so a small-native game fills more of the monitor.
//   --ac-vwcap   : hard viewport-width clamp so a wide/landscape game can't overflow.
// Mobile leaves every var UNSET, so the `var(…, fallback)` fallbacks reproduce the old
// expression byte-for-byte — zero behaviour change on phones, and no hydration flash
// (pure CSS, the media query resolves at paint).

export function screenMaxW(vw: number, vh: number, reserve: number = DECK_RESERVE): string {
  return (
    `min(` +
    `calc(${vw}px * var(--ac-wscale, 1)), ` +
    `calc((100dvh - var(--ac-reserve, ${reserve}px)) * ${vw} / ${vh}), ` +
    `var(--ac-vwcap, 100vw)` +
    `)`
  )
}

// The control deck is thumb-sized and must stay comfortable regardless of the game's
// aspect — a tall portrait screen is gutter-clamped narrow, but the deck should still use
// the full phone width (up to a cap) so the big buttons never overflow. Decoupled from
// screenMaxW on purpose.
export const deckMaxW = 'min(460px, 94vw)'

// The cabinet housing wraps BOTH the screen and the deck, so it must be as wide as the
// wider of the two: deck-width for tall portrait games (the screen sits centered inside
// with a dark bezel), screen-width for wide landscape games (the deck fits within).
export function cabinetMaxW(vw: number, vh: number, reserve: number = DECK_RESERVE): string {
  return `max(${screenMaxW(vw, vh, reserve)}, ${deckMaxW})`
}

// Desktop tuning — the values the `@media (hover:hover) and (pointer:fine)` block writes
// onto `:root`. Kept here (next to the fallbacks they override) so the two stay in sync.
export const DESKTOP_RESERVE = 116 // header + slim keybind plate + padding (deck is gone)
export const DESKTOP_WSCALE = 2.2  // let a small-native game grow ~2.2x toward the monitor
export const DESKTOP_VWCAP = '94vw' // never let a wide game touch the window edges
