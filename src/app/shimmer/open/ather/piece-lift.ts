// M106 fix (2026-11-23): THE ONE WAY A PLACED PIECE COMES BACK TO THE BAG. Every pickup path (the piece card's 'Pick up' in
// workshop.tsx, the third melee hit in melee.ts) goes through liftPiece, so a Spirit Planter's pot is never skipped: a planter a
// spirit lives in stays; a growing seed rides along with the planter (spirit-seeds › carryPot) and the next planter set down
// takes it back (settlePot), seed, planting time and tends intact.
// PURE: no React, no storage.
import { pickUpPiece, type Works } from './rooms'
import { FURNITURE } from './furniture'
import { stowPiece } from './plot-store'
import { carryPot, type Pots } from './spirit-seeds'
import { carryBox, isPlanterBox, type Boxes } from './planter-box'
import type { Inv } from '../shared/inventory'

// M113 s1: a Planter Box's sapling (planter-box.ts) rides along the same way: `boxes` in, `boxes` out (unchanged = same object).
export type Lift = { works: Works; inv: Inv; pots: Pots; boxes: Boxes }
/** Lift piece `id` into the bag with its pot. 'spirit' = a spirit lives in this planter (it stays); 'full' = no room in the
 *  bag; 'gone' = no such piece. Nothing changes unless it returns a Lift. */
export function liftPiece(works: Works, id: string, inv: Inv, pots: Pots, boxes: Boxes = {}): Lift | 'spirit' | 'full' | 'gone' {
  const p = works.pieces.find(x => x.id === id)
  if (!p) return 'gone'
  let next = pots
  if (FURNITURE[p.item]?.spirit === 'planter') {
    const c = carryPot(pots, id)
    if (!c) return 'spirit'
    next = c
  }
  // M144: a building piece (a slab, a panel: furniture.ts `build`) goes into the garden's store, never the bag, so a full bag
  // never refuses it; Break down on the catalog gives the piece itself back
  if (FURNITURE[p.item]?.build) return { works: { ...works, pieces: works.pieces.filter(x => x.id !== id), stored: stowPiece(works.stored, p.item) as Works['stored'] }, inv, pots: next, boxes }
  // M242: every Planter Box style; the style rides along with its plant (planter-box.ts carryBox)
  const r = pickUpPiece(works, id, inv)
  return r ? { works: r.works, inv: r.inv, pots: next, boxes: isPlanterBox(p.item) ? carryBox(boxes, id, p.item) : boxes } : 'full'
}
