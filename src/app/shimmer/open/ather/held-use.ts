// M45 (Alex 11-20 playtest: "i should be able to see the item in the right hand and E to place or use that item"):
// WHAT E DOES WITH WHAT IS IN HAND. One pure table so the page, the phone's Use button and the test agree.
//   furniture -> a placement ghost in front of you on the plot; E sets it, the stack drops by one
//   Keepstone -> the same, as a Keepstone (the garden bank grows a door)
//   dish / potion -> eat / drink one
//   waymark -> plant (the Wilds only)
//   bait -> cast / answer / reel (the Wilds' water)
//   anything else (a material, a tool) -> nothing: E falls through to whatever you are looking at
// ★ PURE. No React, no stores.
import { isPiece } from './furniture'
import { KEEPSTONES } from './furniture'
import { isDish } from './cooking'
import { isPotion } from './alchemy'
import { BAIT } from './rinning'

export type HeldUse = 'place-piece' | 'place-chest' | 'eat' | 'drink' | 'plant' | 'cast' | null
export type Zone = 'plot' | 'wilds'

export function heldUse(id: string | null | undefined, zone: Zone): HeldUse {
  if (!id) return null
  if (isPiece(id)) return zone === 'plot' ? 'place-piece' : null
  if (id in KEEPSTONES) return zone === 'plot' ? 'place-chest' : null
  if (isDish(id)) return 'eat'
  if (isPotion(id)) return 'drink'
  if (id === 'waymark') return zone === 'wilds' ? 'plant' : null
  if (id === BAIT) return zone === 'wilds' ? 'cast' : null
  return null
}
/** A held thing that stands a ghost in front of you. */
export const placesFromHand = (u: HeldUse) => u === 'place-piece' || u === 'place-chest'
/** The phone's Use button label for a held thing (null = no button). */
export function useLabel(u: HeldUse): string | null {
  return u === 'place-piece' || u === 'place-chest' ? null   // the placing bar carries Place / Turn
    : u === 'eat' ? 'eat' : u === 'drink' ? 'drink' : u === 'plant' ? 'plant' : null   // bait keeps the FIRE button (it is a hold)
}
