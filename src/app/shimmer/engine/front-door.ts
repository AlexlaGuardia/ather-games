// THE FRONT DOOR — which dimension a bare `/shimmer` opens on.
//
// ── ★★ TWO ENGINES, ONE KEEPER, AND THE ENGINE IS THE DIMENSION (Alex, 2026-09-15) ────────────
// The Ather is the voxel world (`voxel3d`): the keeper's to shape. Rune Hold, the Crucible and the
// expeditions are the MORTAL side (`play3d`): authored, tiled, visited but never reshaped. They are
// not "the new game" and "the legacy one" — they are the two sides of one game, and the page load
// at the gate is the crossing ("the doorway does not go where a doorway should"). The Crucible opens
// from Rune Hold only. Everything the keeper carries across lives in the keeper keys (`save-slot`,
// `keeper-local`), never in either engine's own state.
//
// ⚠ THE ARENA IS A SCENE, NOT A PLACE. `components/ArenaBattle` mounts over WHICHEVER world the
// keeper is standing in — a mist-patch spar in the Ather, a patrol or the Crucible on the mortal
// side. It never decides the dimension, and nothing here should read "the arena" as a third one.
// That overlay is where the confusion about which side Rune Hold belongs to came from.
//
// ── THE RULE, IN THREE LINES ──────────────────────────────────────────────────────────────────
//   · unborn (no birth rune)     → the town. Birth, Greg's warning, the shop, the doorway. Beat 0
//                                  lives in Rune Hold and a new keeper has to walk through it.
//   · born, last stood in town   → the town.
//   · born, otherwise            → the Ather. Every keeper alive before this file was written has
//                                  no side record and has been living in the voxel world; sending
//                                  them to a Rune Hold they may never have seen would read as a
//                                  reset, not a homecoming.
//
// ★ THE SIDE RECORD IS WRITTEN BY THE WORLD THAT MOUNTS, not by the crossing. A crossing writes
// exactly one one-shot (`crossing.ts` rule 2) and this must not become a second write on that
// path. "Where did I last stand" is a fact each route knows about itself the moment it is up, and
// recording it there means an owner-only menu hop or a typed URL keeps the record honest too.
//
// PURE: no react, no DOM. The store is `localStorage` in a browser and a Map in the test.
import { keeperKey } from '@/lib/keeper-local'
import type { Store } from './crossing'

export type Side = 'town' | 'ather'

/** Per keeper (registered in `KEEPER_KEY_SPECS`, world-tied: a reborn keeper starts in the town). */
export const SIDE_BASE = 'ather:shimmer:side'

export const TOWN_ROUTE = '/shimmer/play3d'
export const ATHER_ROUTE = '/shimmer/voxel3d'

const isSide = (v: unknown): v is Side => v === 'town' || v === 'ather'

/** Which side this keeper last stood on. A missing or malformed record is `null`, never a guess. */
export function readSide(store: Pick<Store, 'getItem'>): Side | null {
  try {
    const v = store.getItem(keeperKey(SIDE_BASE))
    return isSide(v) ? v : null
  } catch { return null }
}

/** Called by a world route once its owner is resolved and it is about to mount. */
export function recordSide(store: Pick<Store, 'setItem'>, side: Side): void {
  try { store.setItem(keeperKey(SIDE_BASE), side) } catch { /* private mode — the door still opens */ }
}

/** The whole decision. Unborn → town; born → where they last stood, defaulting to the Ather. */
export function frontDoorFor(born: boolean, side: Side | null): typeof TOWN_ROUTE | typeof ATHER_ROUTE {
  if (!born) return TOWN_ROUTE
  return side === 'town' ? TOWN_ROUTE : ATHER_ROUTE
}
