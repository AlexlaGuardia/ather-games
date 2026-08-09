// Meadow flora — what SMALL GREEN grows at a column, as a pure selection field.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ★ SELECTION ONLY, NEVER SURFACE TRUTH. This file answers "would flora grow HERE?" from the same
// fields everything else reads (richness, zone membership, forest mask). It deliberately does NOT
// check what the ground is made of — the renderer verifies the LIVE voxel (actual topsoil, air
// above) at instance time, which is what keeps tufts off roads, crust, grey dither and player-dug
// holes without this file re-deriving materials. Split matters: selection is testable and cheap
// (one field read most columns); surface truth belongs to whoever holds the real voxels.
//
// ★ FLOWERS GROW IN DRIFTS, and that is the one design idea here. Uniform scatter reads as noise;
// real meadows carry flowers in wandering patches with grass between. So flowers ride their own
// low-frequency field (drifts are PLACES), and inside a drift the individual flowers are dense —
// while tufts stay uniform filler everywhere green. Same shape lesson as the greyfield/river/pool
// fields: what a feature IS at its scale is a design input.
//
// ⚠ TBD-CANON: kinds are generic build vocabulary (tuft/tall/flower), colours are placeholder
// palette. If the Ather's meadow flowers carry canon names or looks, that is Magii's — do not
// invent named species here.

import { value2 } from './noise'
import { greyness } from './biome'
import { zoneAt } from './zones'
import { mistAt } from './mist'

export const FLORA = {
  NONE: 0,
  TUFT: 1,     // a short grass tuft — the universal filler
  TALL: 2,     // knee-high grass — occasional, breaks the tuft rhythm
  FLOWER: 3,   // a wildflower — only inside drifts; variant colours the head
} as const

export interface FloraSpot {
  kind: number
  /** 0..1 — per-spot deterministic roll. The renderer maps it to height jitter and flower colour. */
  variant: number
}

/** Drift field scale — a flower drift is a place tens of blocks across, not a speckle. */
export const DRIFT_SCALE = 90
export const DRIFT_EDGE = 0.60   // drift field above this = flowers allowed
/** Base per-cell densities on healthy open ground (multiplied by zone character below). */
export const TUFT_DENSITY = 0.16
export const TALL_DENSITY = 0.035
export const FLOWER_DENSITY = 0.30   // inside a drift — dense on purpose, drifts are the rarity
/** Fraction of a mist patch's tufts that give way to bloom at full mist. */
export const MIST_TUFT_YIELD = 0.75
/** Flower share mist raises on OPEN ground (outside a drift) — a patch blooms with or without one. */
export const MIST_OPEN_BLOOM = 0.35

const hash01 = (x: number, z: number, seed: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 2246822519)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * The flora at (x, z), or null. Deterministic; costs one hash for most columns (the early outs are
 * ordered by how much of the world they cover). Grey ground grows nothing — the greying is drained
 * LIFE, and flora is the most literal life there is; the renderer's topsoil check would catch the
 * dithered grey cells anyway, but a drained fringe should thin BEFORE the dither line, which only
 * the field can do.
 */
export function floraAt(x: number, z: number, seed: number): FloraSpot | null {
  const roll = hash01(x, z, seed ^ 0xf10a)
  // Zone character: the Meadows are THE flower country (their whole ruling is "rolling hills,
  // sparse lone trees" — the ground cover carries the zone), the Thicket floor is dim and sparse,
  // everywhere else is ordinary. Springs terraces stay lightly dressed so the crust reads.
  const zn = zoneAt(x, z, seed)
  const zid = zn.zone?.id
  const boost = zid === 'spirit-meadow' ? 1 + 0.9 * zn.t
    : zid === 'twilight-thicket' ? 1 - 0.72 * zn.t
    : zid === 'mana-springs' ? 1 - 0.45 * zn.t
    : 1
  const tuftP = TUFT_DENSITY * boost
  const tallP = TALL_DENSITY * boost
  // Cheap gate first: most cells fail the roll before any field is read. Hoisted into a const
  // because the mist bloom below must fit INSIDE it — see there.
  const gate = (tuftP + tallP) * 1.6 + FLOWER_DENSITY
  if (roll > gate) return null
  // Drained ground thins to nothing across the grey fringe — and dies BEFORE the core (0.85, not
  // 1.0): grass giving out while the soil still holds a little colour is the right order for the
  // guttering to read; ground that greys first and loses its grass after would read backwards.
  const life = 1 - greyness(x, z, seed)
  if (life <= 0.15) return null
  const drift = value2(x / DRIFT_SCALE, z / DRIFT_SCALE, seed ^ 0xd21f7)
  const inDrift = drift > DRIFT_EDGE
  const flowerBase = inDrift ? FLOWER_DENSITY * (zid === 'spirit-meadow' ? 1 + 0.6 * zn.t : 1) : 0

  // ★ MIST BLOOMS WHAT IS ALREADY THERE — it does not add. Inside a patch (mist.ts) the flower
  // share climbs and the tufts give way to it, so charged ground reads as charged without the
  // flora budget moving an inch. Adding density instead would have been the obvious move and the
  // wrong one: it puts MORE geometry exactly where the mist pass, the fog pull and the resident
  // are already spending frame budget, so the one place guaranteed to be busy would also be the
  // one place the renderer is asked to draw the most grass.
  //
  // Read AFTER both early-outs, so the cost lands only on cells that already survived the roll and
  // the grey test — and `mistAt` is a memoised single-cell lookup, which is what makes it safe to
  // call from a per-column field at all.
  const m = mistAt(x, z, seed)
  const tuftAdj = tuftP * (1 - MIST_TUFT_YIELD * m)
  // Clamped against the same `gate` the early-out used: the gate rejects rolls before this line
  // runs, so a bloom that reached past it would be silently truncated by a threshold upstream —
  // flowers that thin out at exactly the wrong moment, for a reason invisible from here.
  const flowerP = Math.min(
    flowerBase + m * (tuftP * MIST_TUFT_YIELD + (inDrift ? 0 : FLOWER_DENSITY * MIST_OPEN_BLOOM)),
    gate - tuftAdj - tallP,
  )

  const r = roll / life   // thinning: on half-drained ground a roll must be twice as lucky
  if (r < flowerP) return { kind: FLORA.FLOWER, variant: hash01(x, z, seed ^ 0x77e) }
  if (r < flowerP + tuftAdj) return { kind: FLORA.TUFT, variant: hash01(x, z, seed ^ 0x3b1) }
  if (r < flowerP + tuftAdj + tallP) return { kind: FLORA.TALL, variant: hash01(x, z, seed ^ 0x9c5) }
  return null
}
