// Shared species→sprite map. Extracted from page.tsx (2026-07-04) so the 3D walker
// (play3d) and the 2D game render party spirits from ONE source — the EvolutionOverlay
// needs it in both. Zero behavior change: page.tsx re-imports SPECIES_SPRITE_MAP.
import type { SpriteAnim } from '../sprites/sprite-data'
import { FOX_SPRITES } from '../sprites/fox'
import { AXOLOTL_SPRITES } from '../sprites/axolotl'
import { WATER_BEAR_SPRITES } from '../sprites/water-bear'
import { TURTLE_SPRITES } from '../sprites/turtle'
import { OWL_SPRITES } from '../sprites/owl'
import { FROG_SPRITES } from '../sprites/frog'
import { FIREFLY_SPRITES } from '../sprites/firefly'
import { RABBIT_SPRITES } from '../sprites/rabbit'
import { HUMMINGBIRD_SPRITES } from '../sprites/hummingbird'
import { BAT_SPRITES } from '../sprites/bat'

export const SPECIES_SPRITE_MAP: Record<string, Record<string, SpriteAnim>> = {
  fox: FOX_SPRITES,
  axolotl: AXOLOTL_SPRITES,
  'water-bear': WATER_BEAR_SPRITES,
  turtle: TURTLE_SPRITES,
  owl: OWL_SPRITES,
  frog: FROG_SPRITES,
  firefly: FIREFLY_SPRITES,
  rabbit: RABBIT_SPRITES,
  hummingbird: HUMMINGBIRD_SPRITES,
  bat: BAT_SPRITES,
}
