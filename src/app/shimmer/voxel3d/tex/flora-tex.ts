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

/** A shared LCG so every tile is deterministic — same seed, same pixels, forever. */
const lcg = (seed: number) => {
  let s = seed
  return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 }
}

/** The two blade tiles the world actually instances — seeds fixed so a tuft looks like THE tuft. */
export const TUFT_SEED = 0x5eaf, TUFT_BLADES = 9
export const TALL_SEED = 0x77c1, TALL_BLADES = 13
/**
 * ── ★ VARIETY IS AN ATLAS, NOT A SECOND MESH (2026-09-15, Alex: "so it doesnt look like copy
 * paste") ─────────────────────────────────────────────────────────────────────────────────────
 * One tile per kind meant every tuft in the world was the same fan turned a little. Each kind
 * now paints `GRASS_VARIANTS` tiles side by side in ONE texture (`bladeAtlasPixels`); the star
 * geometry gives each of its three cards a DIFFERENT column, and each instance rotates which —
 * so a plant is three of four silhouettes, and the plant next to it is another three. Still one
 * draw per kind: the variety costs one float per instance, not a mesh.
 */
export const GRASS_VARIANTS = 4

/** `n` tiles of `w`×`h`, painted by `paint(seed)` per column, laid left to right in one buffer. */
export function bladeAtlasPixels(
  seed: number, n: number, w: number, h: number, paint: (seed: number, column: number) => Uint8Array,
): Uint8Array {
  const out = new Uint8Array(n * w * h * 4)
  for (let i = 0; i < n; i++) {
    const tile = paint((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0, i)
    for (let y = 0; y < h; y++) out.set(tile.subarray(y * w * 4, (y + 1) * w * 4), (y * n * w + i * w) * 4)
  }
  return out
}
/** The tall tile is twice as high as it is wide — a knee-high stand drawn on a square tile was
 *  stretched 1.5× and every blade came out a thick dark spike. Width `BLADE_TILE`, height this. */
export const TALL_TILE_H = 64
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

/**
 * Tall grass: a knee-high stand of THIN blades that arch over at the top, on a 32×64 tile.
 *
 * ── ★ WHY IT IS NOT `bladePixels` AT A BIGGER SIZE (2026-09-15, Alex: "next up the tall grass") ──
 * The tuft painter on a square tile, drawn 1.05 blocks tall, came out as a fan of thick dark
 * spikes — a yucca, not grass. Three things separate a stand of tall grass from a tuft, and each
 * is a line below: the blades are THIN for their height (2 texels at the root on a 64-tall tile,
 * where the tuft is 3–4 on 32); they ARCH — the curve is cubic, so a blade rises nearly straight
 * and then bends over in its top third, the way a long blade gives under its own weight; and the
 * stand is LIGHTER and goes to straw at the tips, because tall grass is what the sun reaches first
 * and what dries first. Painted around `BLADE_GREEN` so the ground multiplier still applies.
 *
 * ⚠ ROW 0 IS THE BOTTOM, same as every tile here.
 */
export function tallBladePixels(seed: number, blades: number, w = BLADE_TILE, h = TALL_TILE_H): Uint8Array {
  const data = new Uint8Array(w * h * 4)
  const rnd = lcg(seed)
  const put = (x: number, y: number, shade: number, warm: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return
    const o = (y * w + x) * 4
    data[o] = Math.max(0, Math.min(255, BLADE_GREEN[0] + shade + warm))
    data[o + 1] = Math.max(0, Math.min(255, BLADE_GREEN[1] + shade + warm * 0.75))
    data[o + 2] = Math.max(0, Math.min(255, BLADE_GREEN[2] + shade * 0.6 - warm * 0.6))
    data[o + 3] = 255
  }
  const rootSpan = w * 0.7
  for (let b = 0; b < blades; b++) {
    const depth = b / Math.max(1, blades - 1)
    const rx = w / 2 + (rnd() - 0.5) * rootSpan
    const bh = h * (0.5 + rnd() * 0.45 + (1 - depth) * 0.05)
    const off = (rx - w / 2) / (rootSpan / 2)
    const side = Math.abs(off) < 0.25 ? (rnd() < 0.5 ? -0.5 : 0.5) : Math.sign(off)
    // Cubic: almost no lean for the first half, then the top arches over — up to a third of the
    // tile's width, which is what makes a stand read as heavy-headed rather than bristling.
    const arch = side * w * (0.22 + rnd() * 0.3) + (rnd() - 0.5) * w * 0.05
    const baseW = 1.6 + rnd() * 1.0
    const depthShade = -26 + depth * 34 + 8                    // a shade lighter than the tuft
    for (let y = 0; y < bh; y++) {
      const t = y / bh
      const cx = Math.max(1, Math.min(w - 2, rx + arch * t * t * t))
      const wd = Math.max(1, Math.round(baseW * (1 - t * 0.6)))
      const shade = depthShade + t * 28 + (rnd() - 0.5) * 8
      const warm = t * t * t * 34                                // straw at the very tip
      const x0 = Math.round(cx - wd / 2)
      for (let dx = 0; dx < wd; dx++) put(x0 + dx, y, shade, warm)
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

// ── ★ THE THREE FLOWER FORMS' TILES (2026-09-14) ────────────────────────────────────────────────
// One wildflower material, three looks: a MAT (ground cover), a BUSH (a clump), a SINGLE (the old
// stem + head, drawn bigger). Same contract as the blade and head tiles above — green parts are
// painted around `BLADE_GREEN` so the ground multiplier tints them, bloom parts are painted WHITE
// so a `HEAD_TINTS` colour is the whole hue — and the same reason for living here: both the world
// and the icon derive from these, so the flower in the bag is the flower the world grows.

/**
 * Bush body: a rounded leafy mass with a ragged rim and cutout corners, painted green. Darker at
 * the bottom (the clump's own shade), lit on top. Reads as a shrub-let, not a card, because of the
 * chewed silhouette — the leaf tile's lesson, one plant along.
 */
export function bushPixels(size = 32, seed = 0xb054): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const rnd = lcg(seed)
  const cx = size / 2, cy = size * 0.42, rx = size * 0.46, ry = size * 0.44
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry
    const d = Math.hypot(dx, dy)
    // Rim noise: the edge wanders ±10% so no two sides of the mass are the same curve.
    if (d > 0.9 + (rnd() - 0.5) * 0.2) continue
    if (y < 2 && Math.abs(dx) > 0.35) continue     // the base narrows to a stem cluster
    const o = (y * size + x) * 4
    const t = y / size
    const shade = -30 + t * 44 + (rnd() - 0.5) * 22
    const warm = t * t * 10
    data[o] = Math.max(0, Math.min(255, BLADE_GREEN[0] + shade + warm))
    data[o + 1] = Math.max(0, Math.min(255, BLADE_GREEN[1] + shade + warm * 0.7))
    data[o + 2] = Math.max(0, Math.min(255, BLADE_GREEN[2] + shade * 0.6 - warm * 0.5))
    data[o + 3] = 255
  }
  // Leaf gaps: punch a few holes so the inside has texture and light shows through.
  for (let i = 0; i < 9; i++) {
    const hx = Math.floor(rnd() * size), hy = Math.floor(size * 0.15 + rnd() * size * 0.7)
    for (let y = hy; y < hy + 2; y++) for (let x = hx; x < hx + 2; x++)
      if (x < size && y < size) data[(y * size + x) * 4 + 3] = 0
  }
  return data
}

/**
 * A cluster of small blooms, painted white, cutout elsewhere: rides on top of a bush body.
 * Each bloom is the head tile's shape at a third of the size, scattered across the upper half.
 */
export function bloomClusterPixels(size = 32, seed = 0xc1a5, blooms = 5): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const rnd = lcg(seed)
  for (let b = 0; b < blooms; b++) {
    const bx = size * (0.15 + rnd() * 0.7), by = size * (0.35 + rnd() * 0.55)
    const r = size * (0.09 + rnd() * 0.05)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by) / r
      if (d > 1) continue
      const o = (y * size + x) * 4
      const core = d < 0.35
      data[o] = core ? 232 : 255; data[o + 1] = core ? 206 : 255; data[o + 2] = core ? 120 : 255
      data[o + 3] = 255
    }
  }
  return data
}

/**
 * Ground-cover leaf pad, drawn FLAT on the ground: overlapping round leaves filling the tile with
 * a ragged outer edge and the corners chewed off, so a run of mats reads as one creeping carpet
 * with soft edges rather than a grid of green squares. Green, ground-multiplied.
 */
export function matLeafPixels(size = 32, seed = 0x1ea5): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const rnd = lcg(seed)
  const leaves = 44
  for (let l = 0; l < leaves; l++) {
    const lx = rnd() * size, ly = rnd() * size, r = size * (0.11 + rnd() * 0.09)
    const tone = -26 + rnd() * 40
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (Math.hypot(x + 0.5 - lx, y + 0.5 - ly) > r) continue
      const o = (y * size + x) * 4
      const shade = tone + (rnd() - 0.5) * 8
      data[o] = Math.max(0, Math.min(255, BLADE_GREEN[0] + shade))
      data[o + 1] = Math.max(0, Math.min(255, BLADE_GREEN[1] + shade))
      data[o + 2] = Math.max(0, Math.min(255, BLADE_GREEN[2] + shade * 0.6))
      data[o + 3] = 255
    }
  }
  // Chew the corners hard and the edges lightly: a mat is round-ish, never a tile. And the outer
  // band sits in its own shade — the leaves at the rim curl down toward the ground, so they are
  // the ones the light does not reach. Without this the pad is one flat value edge to edge.
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c) / (size / 2)
    const o = (y * size + x) * 4
    if (d > 1.02 || (d > 0.92 && rnd() < 0.5)) { data[o + 3] = 0; continue }
    if (d > 0.7 && data[o + 3]) {
      const k = 1 - (d - 0.7) / 0.32 * 0.45          // 1.0 at the band's start → 0.55 at the rim
      data[o] = data[o] * k; data[o + 1] = data[o + 1] * k; data[o + 2] = data[o + 2] * k
    }
  }
  return data
}

/**
 * The pad's CONTACT SHADOW: a soft dark disc drawn under the mat, a hair wider than it, fading to
 * nothing at the edge. Alex, 2026-09-15: *"the mat pads read like stickers, add a rim shadow."*
 * A sticker is a shape with no contact — the ground reads the same one texel outside the pad as
 * one texel inside it. This is the one flora tile with SOFT alpha, which is why its material is
 * transparent rather than cutout (see `matShadowMat`): an alphaTest would turn the fade into a
 * second hard rim, which is the sticker again with a black border.
 */
export function matShadowPixels(size = 32): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c) / (size / 2)
    if (d > 1) continue
    const o = (y * size + x) * 4
    // Solid under the pad, fading over the last 30% — the visible rim outside the leaves.
    const a = d < 0.7 ? 1 : 1 - (d - 0.7) / 0.3
    data[o] = 0; data[o + 1] = 0; data[o + 2] = 0
    data[o + 3] = Math.round(255 * a)
  }
  return data
}

/** Small blooms scattered over the mat, white on cutout — the layer the tint colours. */
export function matBloomPixels(size = 32, seed = 0x5b10, blooms = 7): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const rnd = lcg(seed)
  for (let b = 0; b < blooms; b++) {
    const bx = size * (0.12 + rnd() * 0.76), by = size * (0.12 + rnd() * 0.76)
    const r = size * (0.055 + rnd() * 0.03)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by) / r
      if (d > 1) continue
      const o = (y * size + x) * 4
      const core = d < 0.4
      data[o] = core ? 232 : 255; data[o + 1] = core ? 206 : 255; data[o + 2] = core ? 120 : 255
      data[o + 3] = 255
    }
  }
  return data
}

/**
 * A cluster of FRUIT, painted white on cutout — the fruit bushes' second card (2026-09-15). Fewer
 * and bigger than the bloom cluster, each with a highlight dot high-left so a berry reads as a
 * round thing catching light rather than a flat disc; a tint (`FRUIT_TINT` in flora-mesh) makes it
 * a sunfruit or a moonberry. Sits across the bush's shoulders, like the bloom cluster does.
 */
export function fruitClusterPixels(size = 32, seed = 0xf7a1, fruit = 5, radius = 0.11): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const rnd = lcg(seed)
  for (let b = 0; b < fruit; b++) {
    const bx = size * (0.18 + rnd() * 0.64), by = size * (0.3 + rnd() * 0.55)
    const r = size * (radius + rnd() * radius * 0.35)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - bx, dy = y + 0.5 - by
      const d = Math.hypot(dx, dy) / r
      if (d > 1) continue
      const o = (y * size + x) * 4
      // Shaded toward the lower-right so the ball has a dark side; a highlight near the top-left.
      const hi = Math.hypot(dx + r * 0.35, dy - r * 0.35) / r < 0.3
      const v = hi ? 255 : Math.round(255 * (0.72 + 0.28 * (1 - d)) * (dx - dy > 0 ? 1 : 0.86))
      data[o] = v; data[o + 1] = v; data[o + 2] = v
      data[o + 3] = 255
    }
  }
  return data
}

/**
 * Glow-moss pad, drawn FLAT on the ground (2026-09-16): a cushion of tiny overlapping tufts with a
 * ragged round rim, painted WHITE-ish so the material's tint carries the whole hue — the same deal
 * the bloom heads make. The moss is mostly mid-tone with a scatter of brighter beads, which is the
 * half of "bioluminescent" the texture can do; the material's emissive does the other half.
 * Cutout alpha, like the leaf pad.
 */
export function mossPixels(size = 32, seed = 0x90a5): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const rnd = lcg(seed)
  const c = (size - 1) / 2
  // A dense field of small tufts so the pad reads as a cushion, not as leaves.
  for (let t = 0; t < 120; t++) {
    const tx = rnd() * size, ty = rnd() * size, r = size * (0.05 + rnd() * 0.05)
    const tone = 150 + rnd() * 50
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (Math.hypot(x + 0.5 - tx, y + 0.5 - ty) > r) continue
      const o = (y * size + x) * 4
      const v = Math.max(0, Math.min(255, tone + (rnd() - 0.5) * 14))
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255
    }
  }
  // The beads: a few full-white points, the ones that catch first at dusk.
  for (let b = 0; b < 14; b++) {
    const bx = Math.floor(rnd() * size), by = Math.floor(rnd() * size)
    const o = (by * size + bx) * 4
    if (!data[o + 3]) continue
    data[o] = 255; data[o + 1] = 255; data[o + 2] = 255
  }
  // Round it and chew the rim, as the leaf pad does; the rim darkens toward the ground.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c) / (size / 2)
    const o = (y * size + x) * 4
    if (d > 1.0 || (d > 0.88 && rnd() < 0.5)) { data[o + 3] = 0; continue }
    if (d > 0.72 && data[o + 3]) {
      const k = 1 - (d - 0.72) / 0.28 * 0.4
      data[o] = data[o] * k; data[o + 1] = data[o + 1] * k; data[o + 2] = data[o + 2] * k
    }
  }
  return data
}

/**
 * ── ★ THE TUFT'S CAP: A CLUMP SEEN FROM ABOVE (2026-09-16) ─────────────────────────────────────
 * Alex: *"a lot of the flora is a flat line."* Then, after the cards were tilted: *"they seem
 * tilted now, and still flat."* Right both times, and the second read names the cause: the
 * three cards are a fan of THIN blades, so from above each one is a row of texels however it is
 * tilted. A tuft seen from above is not a tilted fan — it is a ROSETTE: blades radiating from
 * the root, foreshortened into a star. So the tuft gets a second card, lying FLAT at knee height
 * inside the fan, wearing this: blades radiating from the centre, tapered outward, curling a
 * little, lit at the tips. From above it is the clump; from the side it is edge-on and gone,
 * hidden in the fan. Painted around BLADE_GREEN so the ground multiplier still applies.
 */
export const ROSETTE_SEED = 0x70ca, ROSETTE_BLADES = 13
export function rosettePixels(seed = ROSETTE_SEED, blades = ROSETTE_BLADES, size = BLADE_TILE): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  const rnd = lcg(seed)
  const c = size / 2
  const put = (x: number, y: number, shade: number, warm: number) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const o = (y * size + x) * 4
    data[o] = Math.max(0, Math.min(255, BLADE_GREEN[0] + shade + warm))
    data[o + 1] = Math.max(0, Math.min(255, BLADE_GREEN[1] + shade + warm * 0.7))
    data[o + 2] = Math.max(0, Math.min(255, BLADE_GREEN[2] + shade * 0.6 - warm * 0.5))
    data[o + 3] = 255
  }
  // Evenly spread with jitter, so the star has no gap and no two blades lie on one line.
  for (let b = 0; b < blades; b++) {
    const a0 = (b / blades) * Math.PI * 2 + (rnd() - 0.5) * 0.5
    const len = size * (0.28 + rnd() * 0.18)
    const curl = (rnd() - 0.5) * 0.9              // radians of bend over the blade's length
    const baseW = 2.8 + rnd() * 1.6
    // ⚠ DARKER THAN THE TURF ON PURPOSE. The first cut sat around BLADE_GREEN like the fan, and
    // from above a ground-tinted rosette on ground-tinted turf was invisible (shot 09-16). A clump
    // seen from above is its own shadow: the blades shade each other and the ground under them.
    const under = b % 2 === 0 ? -26 : -8          // every other blade sits under its neighbours
    for (let r = size * 0.04; r < len; r += 0.5) {
      const t = r / len
      const a = a0 + curl * t * t
      const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r
      const w = Math.max(1, baseW * (1 - t) + 0.4)
      const shade = under - 30 + t * 40 + (rnd() - 0.5) * 8
      const warm = t * t * 16
      // A short stroke across the blade's direction, w texels wide.
      const px = -Math.sin(a), py = Math.cos(a)
      for (let d = -w / 2; d <= w / 2; d += 0.5) put(Math.round(x + px * d), Math.round(y + py * d), shade - (d < -w / 2 + 0.6 ? 8 : 0), warm)
    }
  }
  return data
}
