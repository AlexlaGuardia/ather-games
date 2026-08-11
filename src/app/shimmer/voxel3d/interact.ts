// What a right-click MEANS at the block you are aiming at.
//
// ★ PURE. No react/three/DOM: the host owns the voxels, the bag and the world; this file owns the
// one question "use, or place?" — and answers it for every block in one place.
//
// ── ★ WHY THIS IS A FUNCTION AND NOT AN `if` IN THE RENDER LOOP (2026-08-11) ────────────────────
// It was an `if` in the render loop, and the whole chain sat behind `selItem &&` — something in
// hand. Placing needs that. USING does not, and nothing said so out loud, so the first thing any
// player does with a chest failed: you place your only chest, the slot empties, `selItem` goes
// null, and the right-click that should open it fell through the entire block. Nothing threw,
// nothing logged, the chest was simply inert — and it would have read as "chests are broken"
// rather than "one gate is too wide".
//
// A dead click is the least visible bug a game can have: no error, no state change, no way for a
// player to tell a missing feature from a broken one. So the decision is pulled out here where an
// oracle can hold it, and `emptyHanded` is asserted BY NAME — it is the normal way to open a
// container, not an edge case.

import { MAT } from '../voxel/depth'

/**
 * What the click does. `place` is the fallback precisely because it is the only one that consumes
 * something: an unrecognised block does not silently swallow the click, it drops a block, which is
 * visible and undoable.
 */
export type Intent =
  /** A container: hand it upward and open the panel. */
  | 'open'
  /** Bury the Mana Seed in your hand. */
  | 'plant'
  /** Ask a seeded pot how far along it is. */
  | 'peek'
  /** Meet whoever chose you. */
  | 'harvest'
  /** Put the block in your hand into the world. */
  | 'place'
  /** Empty hand, ordinary block — the click means nothing, and that is correct. */
  | 'none'

/**
 * @param aimed     material of the cell the reticle is ON (not the empty cell beside it)
 * @param selItem   item id in hand, or null for an empty hand
 * @param holdsSeed does the bag actually contain the seed the hand claims — the count check, kept
 *                  out of here so this stays pure, but passed in so `plant` cannot be promised by a
 *                  hotbar slot the bag can't back.
 */
export function rightClickIntent(aimed: number, selItem: string | null, holdsSeed: boolean): Intent {
  // USE is answered FIRST, always. A block you use must not have the block in your hand dropped
  // onto it by the same click that uses it.
  if (aimed === MAT.CHEST) return 'open'
  if (aimed === MAT.POT && selItem === 'mana_seed' && holdsSeed) return 'plant'
  if (aimed === MAT.POT_SEEDED) return 'peek'
  if (aimed === MAT.POT_BLOOM) return 'harvest'
  return selItem ? 'place' : 'none'
}
