// M106 fix (2026-11-23): THE ONE WAY A PLACED PIECE COMES BACK TO THE BAG. Every pickup path (the piece card's 'Pick up' in
// workshop.tsx, the third melee hit in melee.ts) goes through liftPiece, so a Spirit Planter's pot is never skipped: a planter a
// spirit lives in stays; a growing seed rides along with the planter (spirit-seeds › carryPot) and the next planter set down
// takes it back (settlePot), seed, planting time and tends intact.
// PURE: no React, no storage.
import { pickUpPiece, type Works } from './rooms'
import { FURNITURE } from './furniture'
import { carryPot, type Pots } from './spirit-seeds'
import type { Inv } from '../shared/inventory'

export type Lift = { works: Works; inv: Inv; pots: Pots }
/** Lift piece `id` into the bag with its pot. 'spirit' = a spirit lives in this planter (it stays); 'full' = no room in the
 *  bag; 'gone' = no such piece. Nothing changes unless it returns a Lift. */
export function liftPiece(works: Works, id: string, inv: Inv, pots: Pots): Lift | 'spirit' | 'full' | 'gone' {
  const p = works.pieces.find(x => x.id === id)
  if (!p) return 'gone'
  let next = pots
  if (FURNITURE[p.item]?.spirit === 'planter') {
    const c = carryPot(pots, id)
    if (!c) return 'spirit'
    next = c
  }
  const r = pickUpPiece(works, id, inv)
  return r ? { works: r.works, inv: r.inv, pots: next } : 'full'
}
