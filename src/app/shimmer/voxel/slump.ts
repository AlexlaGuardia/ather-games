// TERRAIN SLUMP — tended ground wears its steps down into halves. (2026-08-11, Alex's ruling:
// "garden strolls, wilds clamber".)
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ── ★ THE WALL IS QUANTIZATION, NOT TERRAIN ─────────────────────────────────────────────────────
// `columnHeight` rounds a continuous field to whole voxels. Two neighbouring columns whose real
// altitudes are 10.49 and 10.51 — a fifth of a block apart in the field — become 10 and 11 on the
// ground: a full block of wall, invented entirely by the rounding. Locomotion's ruling is that a
// 1-block rise BLOCKS and must be vaulted (locomotion.ts, "going up it is the vault"), so every one
// of those artefacts is a vault the terrain never actually asked for. The plains pass measured mean
// |dh| 0.44 per step: most of this world's country is gentle, and most of its walls are rounding.
//
// ── ★★★ AND THAT SENTENCE IS A CONSTRAINT ON EVERY FUTURE FEATURE, NOT A NOTE ABOUT THIS ONE ────
// Added 2026-08-20 by the dens slice, which paid the discovery cost a second time. The line above
// was already true and already written down, and I sized a feature against the terrain I imagined
// anyway. **This is the paragraph I needed and it did not exist: the numbers, and what they cost.**
//
// Measured over a 1400×1400 grid, the chance a column falls N blocks across a 4-block probe:
//   `>=2` **23.3%** · `>=3` **9.4%** · `>=4` **4.0%** · `>=5` **1.7%** · `>=6` 0.8% · `>=8` 0.2%
// Across a 3-block probe a fall of 5 qualifies **0.5%** of the world, and `dell` and `tableland`
// contain **literally none**. A feature gated on "find a bank" at what reads like a modest slope
// realises at a **hundredth** of its intended rate — dens first shipped at one per ~450 chunks,
// which is rarer than the story road and unfindable — and it fails SILENTLY, because a placement
// rule that never fires looks exactly like a placement rule that is merely rare.
//
// ★★ THE SECOND HALF IS WORSE AND IS ABOUT LEGIBILITY, NOT COUNT. A feature whose readability
// depends on a continuous face works on a highland bank and dissolves on a dell one: the same den
// geometry renders as an unmistakable passage into a hillside in the first, and as a gap between
// steps in the second. **Same code, same asserts, two different features.** No count assert can
// see this; only a render can.
//
// ⚠⚠ CORRECTED SAME DAY, AND THE CORRECTION IS THE USEFUL PART. This paragraph first blamed the
// DELL GROUND — "a staircase of 1-block risers", "the terraced case is the common one". Measured,
// that is wrong twice over, and it would have sent the fix at the wrong dial:
//   • **Dell is gentle.** Along x at the site I photographed it climbs **0.19 blocks per column**,
//     treads averaging **4.8 columns**. It is not staircase country.
//   • **The 1:1 face I photographed is there because the PLACEMENT RULE went looking for it.**
//     Steepest-descent answers at the steepest thing within reach, so a den always sits on the
//     harshest face its neighbourhood owns — in dell, a rare 12-column 1:1 climb where slump
//     correctly declines to fire. Reporting that site as typical of dell is the same error as a
//     nearest-search against a hard exclusion reporting its boundary as a location (`findLands`,
//     08-19). **An extremum search's answer is never evidence about the region's median.**
//   • **What actually makes the whole landscape read as a ploughed field is FLANK CONTRAST, not
//     step height.** Quantization puts a 1-block riser every 3-5 columns across all gentle green
//     country — unavoidable and mostly slumped (93% of dell lips are). Each riser's vertical face
//     is painted `mix(SUBSOIL, ground, FLANK_TINT)`, and at the shipped 0.35 that is **65% subsoil**,
//     so every one of those steps draws a grey stripe on green turf. From any raised angle you see
//     mostly faces. Rendered side by side at the same spot, 0.35 is a striped field and **0.70 is a
//     continuous green hillside** — same geometry, same asserts, one constant.
// So: the geometry was never the problem, and the paragraph above nearly recommended reshaping
// terrain to fix a colour. `FLANK_TINT` is Alex's eye and lives in `voxel3d/tex/tiles.ts`.
//
// ⚠ SO: BEFORE GATING ANYTHING ON SLOPE, MEASURE THE DISTRIBUTION, THEN LOOK AT ONE ON A TERRACE.
// `scripts/den-tour.mts` is the shape of the tool that makes the second half cheap — find the
// feature's own instances and hand back a coordinate, because a thing at one per 17 chunks cannot
// be reviewed by wandering.
//
// Slump halves the error where it matters. A column that is the LIP of such a step — one voxel
// above a neighbour, with nothing higher beside it — gives up the top half of its top voxel. The
// single 1.0 rise becomes 0.5 + 0.5, and locomotion's existing half-step (STEP_CAPTURE, shipped
// with the half slabs) walks it without a vault. Nothing is flattened: the terrace is still there,
// its edge is just worn. Ground that genuinely climbs a block per column keeps every whole step it
// has, because there is no horizontal run to spend two half-steps on — a steep hillside is a
// clamber in the garden too, and that is honest.
//
// ── ★ WHY THE LIP, AND WHY NOTHING HIGHER BESIDE IT ─────────────────────────────────────────────
// Shaving a column helps every neighbour BELOW it and hurts every neighbour ABOVE it. Slumping a
// lip that also touches higher ground would turn that column's own 2-block wall into 2.5 — pushing
// it out of mantle range, trading a walkable step for an unclimbable one. So the rule is stated in
// the direction that can only ever help: slump a column iff it stands exactly one above some
// neighbour AND nothing beside it stands higher. Every rise in the world either shrinks or is
// untouched; `slump.test.ts` asserts that as a property over real country, not as an intention.
//
// ── ★ THE ONE RISE SLUMP GROWS, AND WHY IT IS FREE (measured, not assumed) ──────────────────────
// The lip drops half a voxel below the flat ground BEHIND it, so a pair that was dead level becomes
// a 0.5 step. The oracle's first cut demanded no rise ever grow and failed on 11797 pairs in the
// garden — every single one that same 0 → 0.5, and zero walkable rises turned into vaults, zero
// walls deepened. It costs the player nothing (locomotion auto-steps ≤ 0.5) and it is what the
// feature LOOKS like: a terrace whose edge has worn. Measured on seed 1337 over the garden:
// 19% of columns slump, and 68% of the vaults the rounding invented are gone.
//
// ── ★ STRENGTH RIDES `tended`, DITHERED — the seam lesson, again ────────────────────────────────
// Softness is a property of tended ground (`ZoneAnchor.tended`, blended by membership `t`), exactly
// as the greying rim is. A hard threshold on `t * tended` would put the change on an iso-contour of
// a wobbled ellipse: a visible RING around each zone where the ground abruptly stops being kind —
// the same per-biome seam this stack refuses everywhere else (height.ts's opening rule). So the
// threshold is dithered against a small blobby field: the tended heart softens everything, the
// Outfields (tended 0.45) soften in patches, and the wilds soften nothing. The edge frays instead
// of stepping.

import { value2 } from './noise'
import { zoneAt } from './zones'

/** The dither field's scale. Small enough that softened ground reads as patches of worn path
 *  rather than as one half of a zone, large enough not to salt-and-pepper a single terrace edge. */
export const SLUMP_DITHER_SCALE = 34

/**
 * How readily this ground gives up its steps, 0 (wild — every step whole) .. 1 (fully tended).
 * The same `t * tended` product `greyAllowance` reads, and for the same reason: difficulty and
 * kindness are both properties of how tended the ground is, so they must not drift apart.
 */
export function slumpStrength(x: number, z: number, seed: number): number {
  const { zone, t } = zoneAt(x, z, seed)
  return zone ? t * zone.tended : 0
}

/** Does this column's ground soften at all? Deterministic, blobby, pure. */
export function slumpAllowed(x: number, z: number, seed: number): boolean {
  const s = slumpStrength(x, z, seed)
  if (s <= 0) return false
  if (s >= 1) return true
  return s > value2(x / SLUMP_DITHER_SCALE, z / SLUMP_DITHER_SCALE, seed ^ 0x51a3b7)
}

/**
 * Is the column at (x, z) a slumping lip, given a height sampler?
 *
 * `h` is passed in rather than resampled — every caller already has it, and this function is hot
 * enough (once per column of the world) that five redundant spline evaluations would show.
 */
export function isLip(h: number, hNegX: number, hPosX: number, hNegZ: number, hPosZ: number): boolean {
  let stepsDown = false
  for (const n of [hNegX, hPosX, hNegZ, hPosZ]) {
    if (n > h) return false          // something beside us is higher — shaving would deepen ITS wall
    if (n === h - 1) stepsDown = true
  }
  return stepsDown
}

/**
 * The slump mask for one `size`×`size` column footprint, plus the heights it was derived from.
 *
 * ★ COMPUTED ONCE PER COLUMN, FROM A RING. The lip rule needs four neighbours, so a per-cell
 * implementation would pay 5 `columnHeight` calls per (x, z) — 1280 spline evaluations per column
 * against the 256 the terrain stage already does. Sampling one ring wider instead costs +68 calls
 * total (18² vs 16²) and hands back the interior heights the caller wanted anyway, so the terrain
 * stage reads them straight out instead of resampling. Returned together deliberately: a caller
 * that took only the mask would resample the heights and pay the 256 twice.
 */
export function slumpMask(
  wx: number, wz: number, size: number, seed: number, heightAt: (x: number, z: number) => number,
): { mask: Uint8Array; surface: Int32Array } {
  const ring = size + 2
  const h = new Int32Array(ring * ring)
  for (let z = -1; z <= size; z++)
    for (let x = -1; x <= size; x++)
      h[(z + 1) * ring + (x + 1)] = heightAt(wx + x, wz + z)

  const mask = new Uint8Array(size * size)
  const surface = new Int32Array(size * size)
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = (z + 1) * ring + (x + 1)
      const self = h[i]
      surface[z * size + x] = self
      if (!isLip(self, h[i - 1], h[i + 1], h[i - ring], h[i + ring])) continue
      if (!slumpAllowed(wx + x, wz + z, seed)) continue
      mask[z * size + x] = 1
    }
  }
  return { mask, surface }
}
