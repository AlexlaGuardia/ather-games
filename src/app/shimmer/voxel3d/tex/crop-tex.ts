// Crop pixels — what a planted bed shows above the soil, per growth phase.
//
// ★ CODE, NOT HAND-PAINTED ART, AND THAT IS THE STANDING RULE HERE (`flora-tex.ts`'s header, and
// Alex's own line about generic filler). The world draws a crop from a generator, so an item icon
// that ever needs one can derive from the SAME generator rather than becoming a second source of
// truth for what shimmerwheat looks like. Hero art is Alex's; procedural filler is code.
//
// ⚠ ROW 0 IS THE BOTTOM (v = 0). No canvas-style flipY. `flora-tex.ts` records what happens when
// this is forgotten: every blade grows DOWN from the quad's top edge and the whole crop hovers a
// gap above its own bed. Anything drawing these into a top-down surface must flip them back.
//
// ★★ PAINTED IN NEUTRAL GREYS SO A TINT CARRIES THE WHOLE HUE — the same call `headPixels` and
// `leafPixels` already make, for the same reason. Three crops (and every crop canon adds later)
// share ONE stalk tile and ONE head tile; the species colour rides on `instanceColor`. Baking
// shimmerwheat's gold in here would fight the tint and flatten every crop into one plant.

/** 0 seed · 1 sprout · 2 growth · 3 ready — the phases `getCropGrowthPhase` reports. */
export type CropPhase = 0 | 1 | 2 | 3

/**
 * How tall the stalk stands, as a fraction of a block, per phase.
 *
 * ★ PHASE 0 IS NOT ZERO, AND THAT IS THE WHOLE POINT OF THIS FILE. A seed is genuinely underground
 * and drawing nothing would be the horticulturally honest choice — it is also EXACTLY the bug being
 * fixed: a bed with a crop in it looked identical to an empty one, so a keeper could not tell what
 * they had planted, whether it had taken, or that anything was happening at all. The player's
 * question is "is this bed working", and the answer has to be visible from standing height.
 */
export const PHASE_HEIGHT: Record<CropPhase, number> = { 0: 0.20, 1: 0.42, 2: 0.66, 3: 0.88 }

/** Blades per phase — a sprout is two shoots, a ripe plant is a clump. */
const PHASE_BLADES: Record<CropPhase, number> = { 0: 2, 1: 3, 2: 5, 3: 6 }

/**
 * A stalk tile: tapered vertical strokes with cutout alpha, thickening with phase.
 *
 * ⚠ THE SILHOUETTE CARRIES THE PHASE, NOT THE COLOUR. Height alone (an instance scale) makes a
 * young plant read as a distant old one; the blade COUNT is what separates "two shoots just up" from
 * "a full clump". Both change together here on purpose.
 */
export function cropStalkPixels(phase: CropPhase, size = 16, seed = 0xc40b): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  let s = seed ^ (phase * 0x9e37)
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 }
  const blades = PHASE_BLADES[phase]
  for (let b = 0; b < blades; b++) {
    const bx = Math.floor(rnd() * size)
    const h = Math.floor(size * (0.62 + rnd() * 0.38))
    const lean = rnd() < 0.5 ? -1 : 1
    for (let y = 0; y < h; y++) {
      // Leans only in the upper third, so the stems read as planted rather than blown flat.
      const x = Math.min(size - 1, Math.max(0, bx + (y > h * 0.66 ? lean : 0)))
      const o = (y * size + x) * 4
      // Neutral grey with a light gradient: the tint multiplies this, so any hue stays clean.
      const v = 150 + (y / h) * 70 + (rnd() * 24 - 12)
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255
    }
  }
  return data
}

/**
 * The ripe head — a heavy cluster at the top of the stalk, drawn only at phase 3.
 *
 * ★ SPLIT FROM THE STALK FOR `flora-mesh`'s REASON, VERBATIM: heads are split out from stems so an
 * `instanceColor` can tint the grain gold without turning the stalk gold too. One extra draw buys
 * every crop its own ripe colour.
 */
export function cropHeadPixels(size = 8): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // A drooping ovoid rather than a disc — a grain head hangs, a flower faces you, and the
    // silhouette is what says "food" at ten blocks. Wider than tall, biased low.
    const dx = (x - c) / (size * 0.46), dy = (y - c * 0.82) / (size * 0.60)
    if (dx * dx + dy * dy > 1) continue
    const o = (y * size + x) * 4
    // White, so the tint is the entire hue; a slight top-light keeps it from reading as a sticker.
    const lift = (y / size) * 26
    data[o] = 236 + lift * 0.6; data[o + 1] = 236 + lift * 0.6; data[o + 2] = 236; data[o + 3] = 255
  }
  return data
}
