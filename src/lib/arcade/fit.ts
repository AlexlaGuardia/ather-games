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

export function screenMaxW(vw: number, vh: number, reserve: number = DECK_RESERVE): string {
  return `min(${vw}px, calc((100dvh - ${reserve}px) * ${vw} / ${vh}))`
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
