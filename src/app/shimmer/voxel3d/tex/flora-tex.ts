// Ground-cover pixels — WITHOUT importing three.
//
// ── ★ WHY THIS IS SPLIT OUT OF flora-mesh.ts (2026-08-12) ───────────────────────────────────────
// Ground cover is the one family of collectables with no block face to wear: a tuft is two crossed
// quads, not a cube, so `item-icon.ts`'s isometric projection has nothing to project and grass fell
// through to the plain "no art yet" chip. It was on the list of things for Alex to hand-paint.
//
// But the world already draws grass, and it draws it from code — `makeBladeTexture` and
// `makeHeadTexture` are procedural fills, not painted art. So the icon does not need new art any
// more than a stone block does; it needs the SAME GENERATOR the world uses. That is the argument at
// the top of `item-icon.ts` word for word, one family along: deriving the icon from what the world
// draws means grass in the bag can never look like grass the world does not have, and a retune of
// the blade colour moves both at once.
//
// Hand-painting these instead would have created a second source of truth for what a tuft looks
// like — the exact thing that file refuses for blocks.
//
// So the pixel fills live here, three-free, and both callers wrap them their own way:
// `flora-mesh.ts` into a `DataTexture` for the GPU, `item-icon.ts` into an RGBA buffer for a canvas.

/** Blade green, the base every tuft and tall-grass stroke is shaded around. */
export const BLADE_GREEN: [number, number, number] = [86, 158, 66]

/** The five bloom hues the flower heads are tinted with. `wild_flower`'s icon takes the first. */
export const HEAD_TINTS = [0xf2f4ee, 0xe8c95a, 0xb08ae0, 0x8ec7e8, 0xe8a0b4]

/** The two blade tiles the world actually instances — seeds fixed so a tuft looks like THE tuft. */
export const TUFT_SEED = 0x5eaf, TUFT_BLADES = 9
export const TALL_SEED = 0x77c1, TALL_BLADES = 7
/** Tile edge. 32, not 16: a blade needs room to be 3 texels wide at the root and 1 at the tip, and
 *  at 16 the taper has one step in it and reads as a bar. Both consumers read this, not a literal. */
export const BLADE_TILE = 32

/**
 * Blade texture: a fan of TAPERED, CURVED blades from one root, cutout alpha. Deterministic —
 * same seed, same tile.
 *
 * ── ★ WHY THIS WAS REPAINTED (2026-09-14, Alex: *"rn its looking a bit like sea weed lol"*) ─────
 * The first tile was five one-texel VERTICAL columns, each with a single hard kink at 60% height,
 * in a green darker than the turf it stood on. That is the drawing of kelp: parallel strands,
 * uniform width root to tip, bent once, dark against a bright floor. What makes grass read as
 * grass is the opposite on every axis — blades FAN from a shared root, are WIDE at the base and
 * pointed at the tip, CURVE progressively (a quadratic, not a kink), and catch light at the tip
 * so the tuft is brightest where it is thinnest. None of that is geometry; it is this tile.
 *
 * Painted back-to-front: the outer, darker blades first, the front bright ones over them, so
 * where two blades cross the nearer one wins and the clump has depth instead of a hatch pattern.
 *
 * ⚠ ROW 0 IS THE BOTTOM (v = 0), not the top. There is no canvas-style flipY here, and the first
 * version of this indexed `size - 1 - y` out of canvas habit: every blade grew DOWN from the quad's
 * top edge and the root row came out transparent, so the grass hovered a gap above its own ground.
 * Anything drawing this into a top-down surface — an icon, a preview — must flip it back.
 *
 * ★ STILL PAINTED AROUND `BLADE_GREEN`. `flora-mesh.ts` tints a tuft to its ground by MULTIPLYING
 * `instanceColor = ground / BLADE_GREEN`, so the tile's mean must stay near that base or every
 * ground's grass drifts the same way. The tip lift is additive and warm (more R and G, less B):
 * a backlit blade goes yellow-green, never white.
 */
export function bladePixels(seed: number, blades: number, size = BLADE_TILE): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  let s = seed
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 }
  const put = (x: number, y: number, shade: number, warm: number) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const o = (y * size + x) * 4
    data[o] = Math.max(0, Math.min(255, BLADE_GREEN[0] + shade + warm))
    data[o + 1] = Math.max(0, Math.min(255, BLADE_GREEN[1] + shade + warm * 0.7))
    data[o + 2] = Math.max(0, Math.min(255, BLADE_GREEN[2] + shade * 0.6 - warm * 0.5))
    data[o + 3] = 255
  }
  // Roots spread across the middle of the bottom row so the fan fills the quad's width and reads
  // as ONE clump; the lower corners stay empty — a tuft is a fan, not a hedge.
  const rootSpan = size * 0.6
  // Draw order = depth: index 0 is the back of the clump (darkest), the last blade is the front.
  for (let b = 0; b < blades; b++) {
    const depth = b / Math.max(1, blades - 1)                  // 0 back … 1 front
    const rx = size / 2 + (rnd() - 0.5) * rootSpan
    // Back blades stand tallest, front blades shortest: the clump gets depth from height alone.
    const h = size * (0.4 + rnd() * 0.4 + (1 - depth) * 0.18)
    // A blade leans AWAY from the clump's centre, so the fan opens; a little jitter so no two
    // blades are parallel, and the curve grows with the square of height — a bend, not a kink.
    // Blades rooted near the middle stand nearly straight and lean either way — without them the
    // fan is a V with a hole in it.
    const off = (rx - size / 2) / (rootSpan / 2)              // -1 … 1 across the root span
    const side = Math.abs(off) < 0.3 ? (rnd() < 0.5 ? -0.35 : 0.35) : Math.sign(off)
    const curve = side * (size * (0.08 + rnd() * 0.2)) + (rnd() - 0.5) * size * 0.06
    const baseW = 2.2 + rnd() * 1.6 + size / 32                // root width in texels
    const depthShade = -34 + depth * 40                        // back blades sit in the clump's shade
    for (let y = 0; y < h; y++) {
      const t = y / h
      // Clamped so a tip can never leave the tile and read as a blade cut off by a wall.
      const cx = Math.max(1, Math.min(size - 2, rx + curve * t * t))
      const w = Math.max(1, Math.round(baseW * (1 - t) + 0.35))
      // Tips catch the light: brighter and warmer the higher up the blade you are.
      const shade = depthShade + t * 46 + (rnd() - 0.5) * 10
      const warm = t * t * 22
      const x0 = Math.round(cx - w / 2)
      for (let dx = 0; dx < w; dx++) put(x0 + dx, y, shade - (dx === 0 && w > 1 ? 8 : 0), warm)
    }
  }
  return data
}

/** Flower head: a white bloom (petal ring + warm core) that a tint colours. */
export function headPixels(size = 8): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c) / (size / 2)
    if (d > 0.9) continue
    const o = (y * size + x) * 4
    const core = d < 0.3
    // Painted WHITE so the tint is the whole hue; the core dips warm so a bloom has a centre.
    data[o] = core ? 232 : 255
    data[o + 1] = core ? 206 : 255
    data[o + 2] = core ? 120 : 255
    data[o + 3] = 255
  }
  return data
}

/**
 * Leaf-cluster tile: a ragged clump of leaf shapes with CUTOUT alpha.
 *
 * ── ★ THE CUTOUT IS THE ENTIRE FEATURE (2026-08-12) ─────────────────────────────────────────────
 * Leaves became crossed quads so the canopy stops reading as a green box. But crossed quads of
 * SOLID colour are just two intersecting cards — arguably worse than cubes, because at least a cube
 * looks deliberate. What actually makes foliage read as foliage is the ragged silhouette, and that
 * comes from alpha, not from geometry. Ship the cross without the cutout and the work is wasted.
 *
 * ★ PAINTED WHITE ON PURPOSE, exactly like the flower head above: the vertex colour already carries
 * the species tint (four woods, four greens, straight out of `MATERIAL_COLOR`) multiplied by the
 * canopy-depth shade the mesher computed. So ONE tile serves all four species and a retune of a
 * leaf colour needs no new texture. Baking green in here would fight the vertex colour and flatten
 * all four species into one.
 */
export function leafPixels(size = 16, seed = 0x1eaf): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  let s = seed
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 }
  // A handful of overlapping blobs rather than one disc: a single round mask reads as a bubble, and
  // the gaps BETWEEN blobs are what the eye reads as leaves rather than as a smear.
  const blobs = 7
  for (let b = 0; b < blobs; b++) {
    const bx = rnd() * size, by = rnd() * size
    const r = size * (0.16 + rnd() * 0.14)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (Math.hypot(x + 0.5 - bx, y + 0.5 - by) > r) continue
      const o = (y * size + x) * 4
      // Slight per-pixel value noise so a lit canopy has grain instead of flat panels.
      const v = 216 + Math.floor(rnd() * 40)
      data[o] = v; data[o + 1] = 255; data[o + 2] = v
      data[o + 3] = 255
    }
  }
  // Chew the border so no quad ends in a straight edge — a hard rectangular rim is the one thing
  // that would still say "this is a card" no matter how good the blobs are.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y)
    if (edge === 0 || (edge === 1 && rnd() < 0.6)) data[(y * size + x) * 4 + 3] = 0
  }
  return data
}
