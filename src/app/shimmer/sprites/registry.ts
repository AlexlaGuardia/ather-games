// registry.ts — species id → the art that draws it. ONE map, so four stopped disagreeing.
//
// ── ★ WHY THIS EXISTS ────────────────────────────────────────────────────────────────────────────
// Four places built this map by hand: `dev/editors/SpriteEditor.tsx`, `PuppetEditor.tsx`,
// `BattleTester.tsx`, and (briefly) `voxel3d/creature-atlas.test.ts`. Four lists that must agree
// about which species exist and which palette key each one uses, with nothing checking that they do
// — the hand-kept-mirror shape, and it had already bitten: the palette key is `water-bear` while the
// export is `WATER_BEAR_SPRITES`, so a fifth copy would have got it wrong too.
//
// ── ★★ THE ID IS THE FILE NAME, AND THAT IS THE WHOLE ANTI-STALENESS DESIGN ──────────────────────
// A species is a `sprites/<id>.ts` that exports `<ID>_SPRITES` **and** has `PALETTES[<id>]`. Both
// halves already exist and neither was invented for this file, so "is this a creature?" is DERIVED
// from two independent sources rather than asserted by a list someone has to remember to update.
// `registry.test.ts` scans the directory and fails on any file meeting both conditions that is not
// registered here — so the eleventh species fails loudly on the day it is painted, which is the day
// somebody is looking. ⚠ That is the point: the map below is still a literal (a bundler cannot
// dynamic-import these), but it is a literal with a guard that notices when it goes stale.
//
// ⚠ NOT EVERY `_SPRITES` EXPORT IS A CREATURE. `player`, `kael`, `gregory` and friends export the
// same shape and are people; `beasts.ts` is the Mana'mals and carries its own map. They are excluded
// by the palette half of the test — none of them has a `PALETTES` entry — so no allowlist is needed
// and none should be added. An allowlist here would be the very thing this file replaces.

import type { SpriteAnim } from './sprite-data'
import { PALETTES } from './palette'
import { AXOLOTL_SPRITES } from './axolotl'
import { BAT_SPRITES } from './bat'
import { FIREFLY_SPRITES } from './firefly'
import { FOX_SPRITES } from './fox'
import { FROG_SPRITES } from './frog'
import { HUMMINGBIRD_SPRITES } from './hummingbird'
import { OWL_SPRITES } from './owl'
import { RABBIT_SPRITES } from './rabbit'
import { TURTLE_SPRITES } from './turtle'
import { WATER_BEAR_SPRITES } from './water-bear'

/** Everything needed to draw one species, in either world. */
export interface SpeciesArt {
  /** The raw animation record, exactly as `sprites/<id>.ts` exports it. Keys are `${dir}_${pose}`. */
  anims: Record<string, SpriteAnim>
  /** The base palette. Index v paints `palette[v - 1]`; 0 is transparent. */
  palette: readonly string[]
  /** Named colour variants (ajin / xian / owar / luvi), where the species has them. */
  variants: Readonly<Record<string, readonly string[]>>
}

const ANIMS: Record<string, Record<string, SpriteAnim>> = {
  axolotl: AXOLOTL_SPRITES,
  bat: BAT_SPRITES,
  firefly: FIREFLY_SPRITES,
  fox: FOX_SPRITES,
  frog: FROG_SPRITES,
  hummingbird: HUMMINGBIRD_SPRITES,
  owl: OWL_SPRITES,
  rabbit: RABBIT_SPRITES,
  turtle: TURTLE_SPRITES,
  'water-bear': WATER_BEAR_SPRITES,
}

/**
 * ★ THE PALETTE IS LOOKED UP, NEVER RESTATED. Pairing each id with `PALETTES[id]` here means the two
 * cannot drift: a recoloured species changes in one place and this follows. Restating the hex would
 * be the mirror bug wearing this file's own name.
 */
export const SPECIES_ART: Readonly<Record<string, SpeciesArt>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, SpeciesArt>,
    Object.fromEntries(Object.entries(ANIMS).map(([id, anims]) => {
      const pal = (PALETTES as Record<string, Record<string, readonly string[]>>)[id]
      return [id, { anims, palette: pal?.base ?? [], variants: pal ?? {} }]
    }))),
)

/** Every registered species id, sorted. */
export const SPECIES_IDS: readonly string[] = Object.freeze(Object.keys(SPECIES_ART).sort())

/**
 * Art for a species, or null.
 *
 * ⚠ RETURNS NULL RATHER THAN A PLACEHOLDER. A caller that gets a stand-in draws *something*, which
 * on screen is indistinguishable from correct art for a species nobody checked — and the mist has
 * already taught this build that an unrecognised id must be visible, not papered over. Callers
 * should refuse to spawn rather than invent a body.
 *
 * ⚠⚠ `SPECIES_ART` HAS A NULL PROTOTYPE, AND THAT IS LOAD-BEARING, NOT TIDINESS. Species ids reach
 * this function from SAVED DATA (the mist ledger and keeper saves are localStorage, which a player
 * can edit). On an ordinary object literal `SPECIES_ART['__proto__']` walks the prototype chain and
 * returns `Object.prototype` — truthy, so `?? null` never fires, and the caller receives an object
 * with no `anims` and no `palette` and dies somewhere else entirely. `constructor` and `toString`
 * do the same. Caught by the oracle's `__proto__` assert, which is why that assert is not decoration.
 */
export function speciesArt(id: string): SpeciesArt | null {
  return SPECIES_ART[id] ?? null
}
