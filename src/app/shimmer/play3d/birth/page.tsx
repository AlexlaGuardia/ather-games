'use client'
// Birth Rune ritual — standalone prototype route. Spin the carousel, pick a rune.
// The chosen id is logged (and stashed in localStorage under ather:shimmer:birthRune);
// wiring what the rune GRANTS in-world is the mechanics seat's job. See BirthScreen.tsx.
//   ather.games/shimmer/play3d/birth
import BirthScreen from './BirthScreen'

export default function BirthPage() {
  return <BirthScreen onChoose={(id) => console.log('[birth] chosen rune:', id)} />
}
