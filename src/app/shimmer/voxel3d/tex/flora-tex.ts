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
export const TUFT_SEED = 0x5eaf, TUFT_BLADES = 5
export const TALL_SEED = 0x77c1, TALL_BLADES = 4

/**
 * Blade texture: tapered vertical strokes with cutout alpha. Deterministic — same seed, same tile.
 *
 * ⚠ ROW 0 IS THE BOTTOM (v = 0), not the top. There is no canvas-style flipY here, and the first
 * version of this indexed `size - 1 - y` out of canvas habit: every blade grew DOWN from the quad's
 * top edge and the root row came out transparent, so the grass hovered a gap above its own ground.
 * Anything drawing this into a top-down surface — an icon, a preview — must flip it back.
 */
export function bladePixels(seed: number, blades: number, size = 16): Uint8Array {
  const data = new Uint8Array(size * size * 4)
  let s = seed
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 }
  for (let b = 0; b < blades; b++) {
    const bx = Math.floor(rnd() * size)
    const h = Math.floor(size * (0.55 + rnd() * 0.45))
    const lean = rnd() < 0.5 ? -1 : 1
    for (let y = 0; y < h; y++) {
      const x = Math.min(size - 1, Math.max(0, bx + (y > h * 0.6 ? lean : 0)))
      const o = (y * size + x) * 4
      const shade = -24 + rnd() * 40 + (y / h) * 26      // tips catch more light
      data[o] = BLADE_GREEN[0] + shade
      data[o + 1] = BLADE_GREEN[1] + shade
      data[o + 2] = BLADE_GREEN[2] + shade * 0.6
      data[o + 3] = 255
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
