// Per-texel surface relief for the block tiles — the "3D" half of the HD look.
//
// ★ WHAT THIS BUYS, AND WHY A BIGGER TILE DOES NOT BUY IT. `tiles.ts` gives every block a colour
// image, and Lambert shades it by the FACE normal — one normal for a whole merged quad. So a stone
// wall is a flat panel wearing a photograph of stone: it does not change as the sun moves, it has no
// self-shadow, and doubling the tile resolution only makes it a sharper photograph of a flat panel.
// A normal map replaces the single face normal with a per-fragment one, so the mortar course between
// two blocks catches the morning sun on one side and shades on the other, and the surface reads as
// having depth because it is lit as though it does.
//
// ★ PURE, AND FOR THE SAME REASON `tiles.ts` IS. Bytes in, bytes out — no three, no DOM. Wrapping
// the result in a GPU texture is `atlas.ts`'s job. It also means the relief can be tested by reading
// pixels instead of photographing a page, which is the only kind of test that can say what a normal
// at a specific texel is.
//
// ⚠ THIS DERIVES RELIEF FROM THE ART; IT DOES NOT AUTHOR IT. Luminance is a stand-in for height —
// true for the procedural tiles in `tiles.ts`, where lighter texels ARE the raised ones, and an
// assumption that a hand-painted tile could break (a pale stain on dark stone is not a bump). When
// painted art lands, the honest upgrade is a painted height channel; the shape of this file does not
// change, only `heightField`'s first line.

/**
 * Blur radius in texels AT THE 64px REFERENCE, scaled with tile size below.
 *
 * ★★ THE BLUR IS THE ENTIRE DIFFERENCE BETWEEN STONE AND CRUMPLED FOIL, and skipping it is the
 * obvious way to write this file. Pixel art is hard-edged by construction: differentiate it raw and
 * every texel boundary becomes a cliff, so the surface lights as a grid of tiny facets — high
 * frequency, uniform, and reading as noise rather than as form. Blurring first makes the gradient
 * follow the SHAPE a texel cluster describes (a mortar line, a plank groove, a crystal facet)
 * instead of the lattice the shape is drawn on.
 *
 * ⚠ It deliberately does NOT blur the albedo. Crisp colour with smooth lighting is the whole look:
 * NearestFilter keeps the pixels sharp, the relief supplies the light. Blurring both gives mush.
 */
export const RELIEF_BLUR = 1

/**
 * Height range in blocks that a full black→white luminance ramp stands for.
 *
 * This is the only number in the file with a physical meaning, and it is small on purpose: 0.045 of
 * a block is about a mortar course. Bigger reads as melted wax, because the silhouette never agrees
 * — a normal map can only lie about light, never about the edge of the quad, and the eye catches the
 * disagreement long before the number gets interesting.
 */
export const RELIEF_DEPTH = 0.045

/** Bytes per texel in both the tile array and the relief array. */
const STRIDE = 4

/** Rec. 709 luma. Applied to the stored (sRGB-ish) bytes directly rather than to linear values —
 *  this is a height GUESS, and linearising first would change which texels read as raised only in
 *  the third decimal while implying a precision the guess does not have. */
const luma = (r: number, g: number, b: number): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/** Wrap an index into [0, n). Tiles repeat across a merged quad, so every read in this file wraps —
 *  see `heightField`. `%` alone is wrong for negatives, which is exactly the case a blur hits. */
const wrap = (i: number, n: number): number => ((i % n) + n) % n

/**
 * Luminance → a blurred height field for one layer, in [0, 1].
 *
 * ⚠⚠ EVERY SAMPLE WRAPS, AND A NON-WRAPPING BLUR WOULD SHIP A BUG THAT LOOKS LIKE A MESHER BUG.
 * These tiles are drawn with `RepeatWrapping` and a single tile spans one block, so texel 0 is the
 * neighbour of texel `size-1` in the world. Clamping at the border instead would flatten the
 * gradient along all four edges — putting a visible seam on EVERY BLOCK BOUNDARY IN THE WORLD, in a
 * regular grid, which reads as the greedy mesher having gone wrong rather than as a texture defect.
 * That is a day of looking in the wrong file.
 */
export function heightField(tile: Uint8Array, size: number, blur: number): Float32Array {
  const n = size * size
  const raw = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    raw[i] = luma(tile[i * STRIDE], tile[i * STRIDE + 1], tile[i * STRIDE + 2])
  }
  if (blur <= 0) return raw
  // Separable box blur — two O(n·r) passes rather than one O(n·r²), and on a symmetric kernel the
  // result is identical. Horizontal into `tmp`, vertical back into `out`.
  const tmp = new Float32Array(n)
  const out = new Float32Array(n)
  const width = blur * 2 + 1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0
      for (let d = -blur; d <= blur; d++) sum += raw[y * size + wrap(x + d, size)]
      tmp[y * size + x] = sum / width
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0
      for (let d = -blur; d <= blur; d++) sum += tmp[wrap(y + d, size) * size + x]
      out[y * size + x] = sum / width
    }
  }
  return out
}

/**
 * One layer's tangent-space normal map, RGBA, `z` up.
 *
 * ★★ THE GAIN SCALES WITH TILE SIZE, AND THE CONSTANT THAT LOOKS RIGHT IS THE BUG. Slope is rise
 * over run in WORLD units, and the run between two adjacent texels is `1 / size` of a block. So the
 * same painted feature differentiates to half the per-texel difference at 64px that it does at 32px,
 * and a fixed gain would make the 64px world visibly flatter than the 32px one — a resolution switch
 * that silently changes the lighting, which is precisely the comparison `tileSize` exists to let
 * Alex make. Multiplying by `size` cancels it: the surface keeps its slope and the finer tile simply
 * resolves finer detail, which is what a resolution switch is supposed to mean.
 *
 * ★ FULL-STRENGTH UNIT NORMALS ARE BAKED HERE, never a pre-attenuated blend. The shader's `uRelief`
 * lerps toward flat and renormalises, so the strength dial is a uniform write — turning it costs
 * nothing and never rebuilds a 2MB texture. Baking a strength in would make the dial a rebuild, and
 * a dial that is expensive to move is a dial nobody moves.
 */
export function normalLayer(tile: Uint8Array, size: number, out: Uint8Array, at: number): void {
  const blur = Math.max(0, Math.round(RELIEF_BLUR * size / 64))
  const h = heightField(tile, size, blur)
  // Central difference spans two texels, hence the 0.5. `RELIEF_DEPTH` converts the [0,1] height
  // field into blocks; `size` converts per-texel into per-block. See the note above.
  const gain = 0.5 * RELIEF_DEPTH * size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + wrap(x - 1, size)], r = h[y * size + wrap(x + 1, size)]
      const d = h[wrap(y - 1, size) * size + x], u = h[wrap(y + 1, size) * size + x]
      // A surface rising toward +x leans its normal toward -x, hence the negation.
      let nx = -(r - l) * gain
      let ny = -(u - d) * gain
      let nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      nx *= inv; ny *= inv; nz *= inv
      const i = (at + y * size + x) * STRIDE
      out[i] = Math.round((nx * 0.5 + 0.5) * 255)
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      // Unused, and 255 rather than the height because a channel nobody samples is a channel that
      // goes stale. Give it a meaning on the day something reads it.
      out[i + 3] = 255
    }
  }
}

/**
 * The relief array for a whole tile set — same layer count, same order, same dimensions, so it
 * indexes with the identical `vLayer` the colour array uses and needs no second lookup table.
 *
 * ⚠ DERIVED FROM THE TILE BYTES, NOT REBUILT FROM `paintFor`. Handing it the same array the GPU
 * gets is what guarantees the two can never describe different art — a relief map built from its own
 * second call into the painter would drift the first time a painter took a parameter, and drift
 * silently, because both halves would still be internally consistent.
 */
export function buildReliefArray(tiles: Uint8Array, size: number): Uint8Array {
  const per = size * size
  const layers = tiles.length / (per * STRIDE)
  if (!Number.isInteger(layers)) {
    throw new Error(
      `relief: tile array of ${tiles.length} bytes is not a whole number of ${size}x${size} RGBA ` +
      `layers. Passing the wrong size here would silently derive relief from misaligned rows.`,
    )
  }
  const out = new Uint8Array(tiles.length)
  for (let layer = 0; layer < layers; layer++) {
    normalLayer(tiles.subarray(layer * per * STRIDE, (layer + 1) * per * STRIDE), size, out, layer * per)
  }
  return out
}
