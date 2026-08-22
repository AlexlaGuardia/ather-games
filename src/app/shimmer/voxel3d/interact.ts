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
import { stationOf } from '../voxel/workshop'
// ⚠ THE SET, NOT A MATERIAL. There are three bed woods and each of these three lines is a place a
// two-of-three fix would read as a whole fix — sow works on goldwood and a dawnwood bed is scenery.
import { isGardenBed } from './garden'

/**
 * What the click does. `place` is the fallback precisely because it is the only one that consumes
 * something: an unrecognised block does not silently swallow the click, it drops a block, which is
 * visible and undoable.
 */
export type Intent =
  /** A container: hand it upward and open the panel. */
  | 'open'
  /**
   * A station: open its standing job (`voxel/workshop.ts`).
   *
   * ★ SEPARATE FROM `'open'` ON PURPOSE, though both raise a panel. A container answers "what is
   * inside"; a station answers "what are you working on" — different panels, different verbs, and
   * folding them into one intent would mean the host has to re-derive which it meant from the
   * material it just handed in. The one thing they share is that neither may be built on by the
   * same click that uses it, which is what this whole function is for.
   */
  | 'work'
  /**
   * A planted waymark — step through, or choose where to step (`voxel/waymark.ts`).
   *
   * ★ ITS OWN INTENT, not `'work'` or `'open'`, because the three panels answer different questions
   * and the reticle verb is what tells a player which one they are about to get. A container asks
   * "what is inside", a station asks "what shall I make", a waymark asks "where am I going" — and
   * that last one moves the keeper, which is the one outcome nobody should get by mistake.
   */
  | 'travel'
  /**
   * A garden bed with nothing in it, and a seed in hand: put the seed in (`voxel/planting.ts`).
   *
   * ★ NOT `'plant'` — that is the clay pot and a Mana Seed, which pays out a SPIRIT. Two verbs for
   * two objects, so a host branch never has to ask which one the player meant.
   */
  | 'sow'
  /** A garden bed whose crop is ready. Not `'harvest'`, which is the pot's bloom. */
  | 'reap'
  /**
   * A cauldron: open the brew list (`voxel3d/brew.ts`).
   *
   * ★ ITS OWN INTENT, NOT `'work'`, AND THE REASON IS THE STATION MODEL ITSELF. `voxel/workshop.ts`
   * is built on *work happening while you are not there* — a job derived from wall-clock, nothing
   * simulated, a closed tab costing nothing. Brewing cannot be that: it spends the KEEPER's mana and
   * pays the KEEPER's alchemy XP, and neither of those is available to a bench three hundred blocks
   * away. Folding it into `'work'` would put a brew list inside a panel whose whole vocabulary is
   * queued runs, and `stationOf` would have to start lying about which materials are workshops.
   */
  | 'brew'
  /** Bury the Mana Seed in your hand. */
  | 'plant'
  /** Ask a seeded pot how far along it is. */
  | 'peek'
  /** Meet whoever chose you. */
  | 'harvest'
  /**
   * Cast a line, or answer one that is already out. Water, with a rinstick in hand.
   *
   * ★ ONE INTENT FOR BOTH HALVES ON PURPOSE. Casting and answering are the same gesture at the same
   * block, and which one it is depends on the cast's phase — which this file cannot see and must
   * not learn. It answers *"this click is about rinning"*; the host, which owns the cast, decides
   * whether that means throw the line, take it, or reel in.
   */
  | 'rinn'
  /** Put the block in your hand into the world. */
  | 'place'
  /** Empty hand, ordinary block — the click means nothing, and that is correct. */
  /**
   * An empty bed, and an empty hand — say what the bed WANTS.
   *
   * ★ ALEX, 2026-08-22, having built the whole farming loop: *"i also crafted and placed the beds,
   * but i dont have any seeds to plant in it yet."* The seed supply was never broken — a grass tuft
   * rolls three common crop seeds at 1/12 each, so roughly one seed per four tufts. It was
   * UNFINDABLE, which is the fourth time in one day that a shipped feature was invisible rather
   * than absent. Nothing in the world says where a seed comes from, and a bed you aimed at with an
   * empty hand answered with silence, which reads as "this block does nothing".
   *
   * ⚠ ONLY WITH AN EMPTY HAND, and that is the whole reason this is not folded into the sow rule.
   * A keeper holding a BLOCK over a bed still means `place` — stealing that click to show a hint
   * would make the top of every bed unbuildable, which is a worse bug than the silence it fixes.
   */
  | 'needs-seed'
  | 'none'

/**
 * @param aimed     material of the cell the reticle is ON (not the empty cell beside it)
 * @param selItem   item id in hand, or null for an empty hand
 * @param holdsSeed does the bag actually contain the seed the hand claims — the count check, kept
 *                  out of here so this stays pure, but passed in so `plant` cannot be promised by a
 *                  hotbar slot the bag can't back.
 */
export function rightClickIntent(
  aimed: number, selItem: string | null, holdsSeed: boolean, hasRinstick = false,
  bedPlanted = false, bedReady = false,
): Intent {
  // USE is answered FIRST, always. A block you use must not have the block in your hand dropped
  // onto it by the same click that uses it.
  if (aimed === MAT.CHEST) return 'open'
  // ⚠ A BENCH WITH A PLANK IN YOUR HAND MUST STILL OPEN, not stack a second bench onto it. This is
  // the same trap the chest fell into from the other side: the table is the block you are most
  // likely to be holding more of while standing at it.
  //
  // ★ ASKS `stationOf` RATHER THAN NAMING MATERIALS, so a station added to that map is usable the
  // same day. A hand-kept `=== CRAFT_TABLE || === SAWMILL` here is how a new station ships as a
  // block you can place, look at, and not open — a dead click, which this file exists to prevent.
  if (stationOf(aimed)) return 'work'
  // Above the place fallback for the same reason the bench is: a keeper standing at their cauldron
  // holding a second one must OPEN it. And it is deliberately NOT in `STATION_MAT` — see `'brew'`.
  if (aimed === MAT.CAULDRON) return 'brew'
  // Above the seed/pot branches for the same reason the station is: a keeper carrying a stack of
  // waymarks while standing at one must OPEN it, not stack a second onto its face.
  if (aimed === MAT.WAYMARK) return 'travel'
  // ── ★★ WATER + AN EMPTY HAND, AND THE EMPTY HAND IS THE CORRECTED HALF ─────────────────────
  // First version required the rinstick to be the SELECTED item, which reads sensible and is wrong
  // for this game: **mining already derives the tool from the BLOCK, not from the hand** (`toolSkill
  // = wantSkill`, set from what you swung at), and `ensureBasicTools` guarantees every keeper one of
  // Greg's never-breaking starters — `worn_rinstick` among them. Tools are not hotbar items here, so
  // a rinstick can never BE `selItem`, and gating on it would have shipped a feature that could not
  // be triggered at all. ★ A rule copied from another game's grammar rather than from this one's.
  //
  // So the hand only has to be EMPTY, which keeps the one case that genuinely matters: water with a
  // BLOCK in hand still places, because filling in a pond is a real thing to want and stealing that
  // click would read as placement being broken over water.
  //
  // ⚠ `hasRinstick` IS PASSED, NOT DERIVED, for the same reason `holdsSeed` is: the tool ladder
  // lives in `engine/tools.ts` and this file has no business importing it. It is effectively always
  // true today (Greg's starter), and it is a parameter anyway so that the day a rod can be lost,
  // this answers `'none'` rather than casting with nothing.
  if (aimed === MAT.WATER && !selItem && hasRinstick) return 'rinn'
  // ── ★★ A GARDEN BED (2026-08-22) — SOW and REAP, deliberately NOT `plant`/`harvest` ──────────
  // Those two already mean the POT: Gregory's clay pot taking a Mana Seed and blooming a spirit.
  // A bed and a pot are different objects with different payouts, and folding them into one intent
  // would make the host re-derive which it meant from the material it just handed in — the exact
  // thing `'work'` vs `'open'` is separated to avoid, ten lines up.
  //
  // ⚠ ABOVE THE PLACE FALLBACK, like the bench and the cauldron, and for the identical reason: a
  // keeper holding a stack of beds while standing over one must SOW it, not stack a second bed onto
  // its face. That is the trap this whole function exists for and beds walk straight into it — they
  // are the block you are most likely to be carrying more of while standing at one.
  //
  // ★ `bedReady` and `bedPlanted` are PASSED, not derived, exactly like `hasRinstick`: growth is
  // wall-clock state living in `voxel/planting.ts`, and this file reads no state and imports no
  // engine. It answers from what it is told.
  if (isGardenBed(aimed) && bedReady) return 'reap'
  if (isGardenBed(aimed) && !bedPlanted && holdsSeed) return 'sow'
  // ⚠⚠ A BED WITH SOMETHING GROWING IN IT IS NOT A FACE TO BUILD ON. Without this the click falls
  // through to `place` and a keeper buries their own crop under whatever they were carrying — the
  // block goes down, the crop record survives underneath it, and that voxel then refuses every
  // future seed with "something is already growing there" while showing a stone block. Caught by
  // the oracle, not by playing: it needs a seed in the ground AND a block in hand at the same time.
  if (isGardenBed(aimed) && bedPlanted) return 'none'
  if (aimed === MAT.POT && selItem === 'mana_seed' && holdsSeed) return 'plant'
  if (aimed === MAT.POT_SEEDED) return 'peek'
  if (aimed === MAT.POT_BLOOM) return 'harvest'
  // ⚠ AFTER the place fall-through's condition, not before it: an empty HAND is the only case that
  // was silent, and it is the only one this may claim.
  if (isGardenBed(aimed) && !bedPlanted && !selItem) return 'needs-seed'
  return selItem ? 'place' : 'none'
}
