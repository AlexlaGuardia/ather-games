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

export const DECK_RESERVE = 200 // header + control deck + footer + padding, in px

export function screenMaxW(vw: number, vh: number, reserve: number = DECK_RESERVE): string {
  return `min(${vw}px, calc((100dvh - ${reserve}px) * ${vw} / ${vh}))`
}
