/**
 * THE MOGLIN'S PALETTE, IN ONE PLACE.
 *
 * ★ WHY IT MOVED OUT OF `Shimmer3D.tsx` (2026-09-04, sprites lane). The clay bench needs the real
 * fur colours, and the alternative to importing them was retyping the hex into the bench — a
 * hand-kept copy, which PATTERNS 2026-08-22 names as the worst of the drift shapes because a copy
 * agreeing with its source reads as corroboration rather than as a coincidence.
 *
 * ⚠ BUT IMPORTING THEM FROM `Shimmer3D.tsx` WAS ALSO WRONG, AND LESS OBVIOUSLY SO: that module is
 * a 7.6k-line `'use client'` scene, so pulling three string constants out of it drags the entire
 * game scene into the importing page's chunk. A constant should not carry a renderer on its back.
 * Hence a leaf module with no imports but a type: both sides can have it for nothing.
 */
import type { SpawnerPlacement } from '../world/spawn-placements'

export const MOGLIN_FUR = '#8a6a48'      // drab-but-warm earth — never grey
export const MOGLIN_FUR_LIGHT = '#a3855e'

/** The collar's gate colour. The collar is the hostile part (canon); the fur never is. */
export const GATE_COLORS: Record<SpawnerPlacement['gate'], string> =
  { thistle: '#8fd14f', vetch: '#f0a526', brack: '#e05a4d' }
