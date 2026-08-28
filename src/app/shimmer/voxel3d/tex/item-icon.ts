// Item icons — drawn from the block's OWN texture, never from a second set of art.
//
// ── ★ WHY THIS IS NOT AN ART PIPELINE (2026-08-11, Alex asked whether we needed Meshy) ──────────
// An item icon in a voxel game is a cube wearing the faces the block already has. Generating art
// for it — by hand, by Meshy, by anything — creates a SECOND source of truth for what topsoil looks
// like, and the two drift the first time someone retunes the grit: the world changes and the icon
// keeps showing last month's dirt. Deriving the icon from `paintFor` means an item can never look
// like something the block is not, and a new block gets an icon the moment it gets a texture, with
// nobody remembering to draw one.
//
// It is also free and instant, which matters less than the correctness argument but is not nothing.
//
// Non-block items (a seed, a shard) have no faces to wear and DO need real art.
//
// ── ★ AND MOST OF THAT ART ALREADY EXISTED (2026-08-12) ─────────────────────────────────────────
// The line above used to end "they fall back to a flat chip, deliberately plain so it reads as *not
// drawn yet*". The chip was honest about this file and wrong about the game: `sprites/items.ts`
// holds 76 hand-painted 32×32 icons from the 2D game, and **34 of them are items voxel3d can
// actually hold** — every crystal, every plank, every blade and spike and rinstick. The bag was
// showing "no art yet" for art Alex drew months ago, because nothing here ever looked.
//
// So the fallback order is now: the block's own faces → the hand-painted flat sprite → the plain
// chip. The chip survives as the third tier and keeps its old meaning, which is now TRUE when it
// appears: nobody has drawn this one.
//
// ⚠ THIS IS WHY voxel3d NOW PULLS IN THE 2D SPRITE TREE. It is ~3k lines of palette strings and the
// only alternative was a second copy of the same art keyed for this game — the exact second source
// of truth the header above refuses for blocks. One art table, two games.

import { ALL_BLOCKS, materialForItem } from '../../voxel/registry'
import { meshIcon, hasMeshIcon } from './mesh-icon'
import { ITEM_ICONS, paletteForItem } from '../../sprites/items'
import { leafPixels, bladePixels, headPixels, HEAD_TINTS, TUFT_SEED, TUFT_BLADES, TALL_SEED, TALL_BLADES } from './flora-tex'
import { paintFor, TILE_MATERIALS, TOP, SIDE } from './tiles'
import { isPlant, isSapling } from '../../voxel/depth'
import { MATERIAL_COLOR } from '../attrs'

/** Icon edge in CSS pixels. Small enough to stay crisp, large enough for the cube to read. */
const ICON = 48
/** Texture resolution sampled for the faces. */
const TILE = 16


/**
 * ── ★ THE PROJECTION IS PURE, SO IT CAN BE LOOKED AT (2026-08-11) ───────────────────────────────
 * Rasterises the cube into a plain RGBA buffer with no canvas, no DOM and no GPU. That is what lets
 * `scripts/icon-sheet.mts` write the real icons to a PNG on a headless server — the projection I
 * ship and the projection anyone inspects are the SAME CODE, which a screenshot harness that
 * re-implemented the maths would not give you. Re-implementing it "just to preview" is how the
 * preview ends up correct and the game does not.
 *
 * Per-pixel INVERSE mapping rather than forward splatting: solving each output pixel back into the
 * tile leaves no seams or gaps, which forward-drawing 16 texels into a 48px parallelogram would.
 */
export function rasterIcon(top: Uint8Array, side: Uint8Array, size = ICON, tile = TILE): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  // Half-width w, top-rhombus half-height w/2, body depth w — so the cube is exactly 2w square and
  // centring needs no measuring.
  const w = size * 0.34, h = w / 2, d = w
  const cx = size / 2, cy = size / 2
  const lx = cx - w, ly = cy - w + h              // left vertex: origin of the lid and the near-left
  const mx = cx, my = cy                          // bottom vertex of the lid: origin of the near-right

  // Each face: origin, edge U (tile +x), edge V (tile +y), source, and a light multiplier.
  const faces: [number, number, number, number, number, number, Uint8Array, number][] = [
    [lx, ly, w, -h, w, h, top, 1],       // lid, full light
    [lx, ly, w, h, 0, d, side, 0.78],    // near-left
    [mx, my, w, -h, 0, d, side, 0.56],   // near-right, deepest shade
  ]

  for (const [px, py, ux, uy, vx, vy, src, lit] of faces) {
    const det = ux * vy - vx * uy
    if (det === 0) continue
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Sample the pixel CENTRE — sampling the corner puts a half-pixel bias on every face and
        // shows up as a one-pixel sliver of background along the cube's silhouette.
        const qx = x + 0.5 - px, qy = y + 0.5 - py
        const s = (qx * vy - vx * qy) / det
        const t = (ux * qy - qx * uy) / det
        if (s < 0 || s >= 1 || t < 0 || t >= 1) continue
        const tx = Math.min(tile - 1, (s * tile) | 0)
        const ty = Math.min(tile - 1, (t * tile) | 0)
        const si = (ty * tile + tx) * 4
        const di = (y * size + x) * 4
        out[di + 0] = Math.min(255, src[si + 0] * lit)
        out[di + 1] = Math.min(255, src[si + 1] * lit)
        out[di + 2] = Math.min(255, src[si + 2] * lit)
        // ★ OPACITY COMES FROM THE FACE TEST, NEVER FROM THE SOURCE ALPHA. `tiles.put` defaults
        // alpha to 0 and the atlas uses that channel as a GLOW mask, not transparency — the world
        // shader reads RGB and ignores it. Copying it here drew only the parts of a block that
        // emit light: ore seams rendered as floating crystal specks and every ordinary block came
        // out invisible. A block face is opaque; being inside the cube is what makes a pixel real.
        out[di + 3] = 255
      }
    }
  }
  return out
}

/**
 * ── ★★★ THE CUBE PROJECTION IS A CLAIM ABOUT GEOMETRY, AND FOR SOME MATERIALS IT IS FALSE ───────
 * Alex, 2026-08-23, holding two goldwood saplings: *"i dont have any saplings in my inventory."*
 * He did. They were the first slot. The icon was an isometric CUBE of leaf texture, sitting beside
 * `grass_tuft` and `tall_grass` and `wild_flower`, and nothing about it said seedling.
 *
 * ★ THE HEADER ABOVE IS RIGHT AND IT IS NOT ENOUGH. "An item wears the faces the block already has"
 * assumes the block HAS faces. A sapling does not: `greedy.ts` draws it as a rooted, narrow cross
 * (`b50f3ac`, *"sapling: renders as a rooted cross, not a cube"*), the same pass that crosses leaves.
 * So the icon and the world were derived from the same texture and still disagreed about the SHAPE,
 * which is the one thing the derivation was never checking. Deriving the paint is not deriving the
 * picture.
 *
 * ⚠⚠ AND THE 08-22 TEXTURE FIX IS WHAT ARMED IT. Before that day saplings had no tile art, so
 * `hasTileArt` was false, the block branch was skipped, and they fell to the honest chip — plain, and
 * plainly unfinished. Giving them a texture to stop the magenta checkerboard IN THE WORLD silently
 * promoted their icon from *"nobody drew this"* to a confident cube. **A fix in one renderer turned a
 * blank into a lie in another**, with nothing in either place looking wrong. Same family as the
 * craft-panel filter that stopped honouring its own docstring.
 *
 * ★ DERIVED FROM THE MESHER'S OWN PREDICATES, never a list of ids. A hand-kept "these are crosses"
 * table is the exemption that outlives its reason — it would have said `grass_tuft` in 08-12 and
 * still not said `sapling` in 08-23. `icon-source.test.ts` asserts the stronger version this cannot
 * express alone: NO tile-arted material the world crosses may reach the block branch, leaves
 * included, so the day a leaf becomes a holdable item the guard fires instead of shipping a cube.
 */
const drawnAsCross = (material: number): boolean => {
  const base = material & 0xFF
  return isPlant(base) || isSapling(base)
}

/** Does a real painter own this material, or would it fall to the ore artist's default? */
export const hasTileArt = (material: number): boolean => TILE_MATERIALS.includes(material & 0xFF)

/**
 * ── ★ "WHICH BLOCK'S FACES DOES THIS WEAR?" IS NOT "CAN THIS BE PLACED?" (2026-08-26) ───────────
 * `materialForItem` is the PLACEMENT map and the registry says so in its own comment: it is derived
 * from `placeable && drops[0]`, which is what makes a sapling item place a sapling block. The icon
 * is asking a different question — which block did this come off — and for most of the world the two
 * answers coincide, which is what kept the conflation invisible.
 *
 * It stopped being invisible on the four species logs. You cannot re-place a log (`placeable: false`
 * — a felled trunk is lumber, not a swatch for the build palette), so nothing mapped them, so the
 * chain fell past the block arm to the honest chip, while `tiles.ts` has carried a real painted bark
 * texture for each of them the whole time. `scripts/item-art.mts` duly filed all four as *needs
 * Alex*, and the art it was asking for already existed one derivation away.
 *
 * ★ A SECOND DERIVATION, NOT A WIDER PLACEMENT MAP. Widening `materialForItem` would make logs
 * placeable — a real behaviour change smuggled in to fix a picture, which is this file's own sapling
 * scar exactly (a fix in one renderer turning a blank into a lie in another). Placement keeps its
 * map; the icon gets its own, and neither can move the other.
 *
 * ⚠ AMBIGUITY FALLS THROUGH RATHER THAN GUESSING. Four blocks drop `rubble` and six drop
 * `block_topsoil`; picking one would invent a fact about which stone a pebble remembers. Those
 * already resolve through the placeable map and must keep resolving there, so this answers only when
 * EXACTLY ONE block drops the item. The guard discriminates rather than decorating: every
 * multi-dropper in the tree is excluded by it today.
 */
const DROPPED_BY: ReadonlyMap<string, number | null> = (() => {
  const seen = new Map<string, number | null>()   // null = more than one block drops it, so no answer
  for (const b of ALL_BLOCKS) {
    const id = b.drops?.[0]?.itemId
    if (!id) continue
    seen.set(id, seen.has(id) ? null : b.material)
  }
  return seen
})()

/**
 * The material whose faces this item wears — the block it places, else the one block it came off.
 *
 * ⚠ CALLERS MUST ASK `iconSourceFor` FIRST, never this alone. A drop is WEAKER evidence than a
 * placement: `raw_mana_shard` comes off a seam and is not a cube of seam, which is why the shard arm
 * sits BELOW hand-painted art in the chain and why this returns a material for it regardless. Read
 * on its own it would put crystal-in-host-rock where Alex drew a shard.
 */
export const blockWornBy = (itemId: string): number | undefined => {
  // ⚠ BOTH PATHS CHECK `hasTileArt`, and the placement path needs it just as much — caught by the
  // probe, one edit after this function was written. Deadfall and Mushroom ARE placeable, so the
  // placed branch answered for them, but the world draws both as instanced geometry with no tile
  // texture at all: the chain reported `cross` while `iconPixelsFor` came back empty. A source that
  // names an arm the pixels cannot fill is the same lie as a chip over art that exists, pointed the
  // other way — and `item-art.mts` would have counted them as *nothing to draw* rather than *needs
  // Alex*, quietly shrinking his queue by two items nobody had drawn.
  const placed = materialForItem(itemId)
  if (placed !== undefined) return hasTileArt(placed) ? placed : undefined
  const dropped = DROPPED_BY.get(itemId)
  return dropped != null && hasTileArt(dropped) ? dropped : undefined
}

/** `#rrggbb` → three bytes. Returns null on anything it does not understand, never a guessed colour. */
function hexRGB(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * A palette-indexed sprite as RGBA, nearest-neighbour scaled to `size`.
 *
 * Pure for the same reason `rasterIcon` is: `scripts/item-art.mts` renders the contact sheet through
 * this exact function, so the sheet cannot show art the game does not draw.
 *
 * ★ THE INDEXING IS `components/SpriteRenderers.drawSprite`'S, RESTATED ONCE AND ONLY HERE: value 0
 * is transparent, value v takes `palette[v - 1]`, and the sprite's edge is `sqrt(length)` rather
 * than a passed-in constant — several item sprites are 16×16 art sitting in a 32×32 buffer, and
 * anything that assumed 32 would render them at quarter scale in the corner. Deriving the edge is
 * what makes those come out right without touching the data.
 *
 * ⚠ AN UNKNOWN PALETTE ENTRY DRAWS NOTHING RATHER THAN BLACK. A missing colour is a wiring mistake,
 * and a hole in a sprite is visible where a black pixel silently becomes part of the outline.
 */
export function flatIconPixels(frame: Uint8Array, palette: readonly string[], size = ICON): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  const src = Math.round(Math.sqrt(frame.length)) || 16
  const rgb = palette.map(hexRGB)
  for (let y = 0; y < size; y++) {
    const sy = Math.min(src - 1, ((y * src) / size) | 0)
    for (let x = 0; x < size; x++) {
      const sx = Math.min(src - 1, ((x * src) / size) | 0)
      const v = frame[sy * src + sx]
      if (v === 0) continue
      const c = rgb[v - 1]
      if (!c) continue
      const di = (y * size + x) * 4
      out[di] = c[0]; out[di + 1] = c[1]; out[di + 2] = c[2]; out[di + 3] = 255
    }
  }
  return out
}

/**
 * The same two crossed quads the world stands a sapling on, projected into an icon.
 *
 * ★ THE SILHOUETTE IS THE WHOLE POINT, so it comes from GEOMETRY and the texture only fills it —
 * exactly the split `rasterIcon` already makes. A sapling's tile is `paintLeaves` in its species
 * colour, which is why the cube read as a leaf block: the paint was never the problem and repainting
 * it would not have helped. Two rooted planes crossing is what says *seedling* at 48px, and it says
 * it in a hotbar full of green squares.
 *
 * ⚠ ALPHA COMES FROM THE QUAD TEST, NOT THE TILE — `rasterIcon`'s hard-won lesson, and it applies
 * with more force here. `tiles.put` leaves alpha as a GLOW mask, so masking the cross by the tile's
 * own alpha would cut the sprite down to whatever happens to emit light: nothing, for a leaf.
 *
 * ⚠ ROOTED LOW AND NARROW ON PURPOSE. The base sits at 0.76 of the icon rather than at the cube's
 * ground diamond (0.33) — a plant drawn from the cube's footprint grows straight off the top of the
 * frame. Narrow because the world's sapling is deliberately `wide * 0.30`: *"narrow enough to read as
 * a shoot instead of a shrub"*. An icon that fattened it would describe a plant the world does not
 * grow, which is the drift this whole file exists to refuse.
 */
/**
 * The pixels the WORLD draws a cross with, tinted for this species.
 *
 * ── ★ THE BAG WAS READING A DIFFERENT TEXTURE THAN THE WORLD (2026-08-23) ───────────────────────
 * Alex, holding a goldwood sapling: *"the sapling is just a green 2d rectangle."* It was, and the
 * cube fix earlier the same day is not what caused it — this is a THIRD source disagreeing.
 *
 * `paintFor` is the tile atlas, and every painter in `tiles.ts` writes through `put()`, whose alpha
 * argument DEFAULTS TO 0. Alpha is not opacity in that module; the chunk material never reads it.
 * So `paintFor(SAPLING)` is a full 16x16 sheet of leaf-noise — nine good greens and no silhouette
 * anywhere — and `crossIcon` then forced every texel opaque. A solid sheet on two quads is a solid
 * parallelogram. The texture was never missing and the colours were never wrong; the SHAPE simply
 * was not in that texture, because in the world the shape comes from `leafPixels` + `alphaTest`.
 *
 * ⚠ MEASURED, BECAUSE THE FIRST READING LOOKED LIKE THE OPPOSITE BUG: `paintFor(42, SIDE, 16)` is
 * 256/256 alpha-0, which reads as "this material has no art". It has art. `leafPixels(16)` is
 * 100 opaque of 256 — a real cutout — and near-white (233,255,233), because it is a LUMINANCE MASK
 * the world multiplies by the species tint through `vertexColors`. This does the same multiply, so
 * a sapling in the bag is the same pixels as the sapling in the ground, by construction.
 */
export function leafCutout(material: number, tile = TILE): Uint8Array | null {
  const tint = MATERIAL_COLOR[material & 0xFF]
  // No guessed colour, ever — the rule this whole file is built on. A material the world tints and
  // this table does not know is a real gap, and a blank icon says so where a green smear would not.
  if (tint === undefined) return null
  const src = leafPixels(tile)
  const out = new Uint8Array(src.length)
  const tr = (tint >> 16) & 255, tg = (tint >> 8) & 255, tb = tint & 255
  for (let i = 0; i < src.length; i += 4) {
    out[i] = (src[i] * tr) / 255 | 0
    out[i + 1] = (src[i + 1] * tg) / 255 | 0
    out[i + 2] = (src[i + 2] * tb) / 255 | 0
    out[i + 3] = src[i + 3]          // the cutout — the only thing that makes this a plant shape
  }
  return out
}

export function crossIcon(side: Uint8Array, size = ICON, tile = TILE): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  // Same cell footprint as the cube so a sapling sits at the scale its block neighbours do, then
  // taken in to `SPREAD` — the icon's echo of the mesher's 0.30 width multiplier.
  const w = size * 0.34, h = w / 2
  const SPREAD = 0.32
  const ax = w * SPREAD, az = h * SPREAD
  const cx = size / 2, baseY = size * 0.76, H = size * 0.56

  // Origin, edge U (tile +x, along one ground axis), edge V (tile +y, straight up), light.
  // Drawn far-plane first so the near plane lands in front — and now that the source is a CUTOUT,
  // the far plane shows through the near one's gaps, which is exactly what the world does with
  // `alphaTest` on a DoubleSide cross.
  const quads: [number, number, number, number, number, number, number][] = [
    [cx - ax, baseY - az, 2 * ax, 2 * az, 0, -H, 0.72],   // the receding plane, shaded back
    [cx - ax, baseY + az, 2 * ax, -2 * az, 0, -H, 1],     // the facing plane, full light
  ]

  for (const [px, py, ux, uy, vx, vy, lit] of quads) {
    const det = ux * vy - vx * uy
    if (det === 0) continue
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const qx = x + 0.5 - px, qy = y + 0.5 - py
        const s = (qx * vy - vx * qy) / det
        const t = (ux * qy - qx * uy) / det
        if (s < 0 || s >= 1 || t < 0 || t >= 1) continue
        const tx = Math.min(tile - 1, (s * tile) | 0)
        // t runs 0 at the ROOT and 1 at the tip, so the tile is sampled bottom-up — the same flip
        // `floraIcon` documents. Reading it top-down hangs the leaves under the stem.
        const ty = Math.min(tile - 1, ((1 - t) * tile) | 0)
        const si = (ty * tile + tx) * 4
        // ⚠ THE CUTOUT IS THE SHAPE, and this line is only correct because the SOURCE CHANGED.
        // `rasterIcon` above is right that atlas alpha is a GLOW mask and must never be read as
        // transparency — and while this function sampled `paintFor`, forcing every texel opaque was
        // the correct reading of a glow-masked sheet. It was not an oversight; it was right about
        // the wrong texture. `leafPixels` is a different channel convention (alpha IS the cutout,
        // as `floraIcon` and the world's `alphaTest: 0.5` both read it), so the holes now mean the
        // stem and the gaps between leaves. ★ Swapping the source without swapping this line would
        // reproduce the green rectangle exactly.
        if (side[si + 3] === 0) continue
        const di = (y * size + x) * 4
        out[di + 0] = Math.min(255, side[si + 0] * lit)
        out[di + 1] = Math.min(255, side[si + 1] * lit)
        out[di + 2] = Math.min(255, side[si + 2] * lit)
        out[di + 3] = 255
      }
    }
  }
  return out
}

/**
 * ── ★ GROUND COVER DERIVES TOO, IT JUST DERIVES FROM A DIFFERENT GENERATOR (2026-08-12) ─────────
 * A tuft has no block face to wear — it is two crossed quads — so the isometric projection above
 * has nothing to project, and grass sat on the hand-paint list. It did not belong there: the world
 * draws grass procedurally, so its icon can come from the SAME fill, exactly as a stone icon comes
 * from the same painter that textures stone. Redrawing it by hand would have made a second source
 * of truth for what a tuft looks like — the thing this file's header refuses for blocks.
 *
 * ⚠ THE FLIP IS LOAD-BEARING. `bladePixels` puts row 0 at the BOTTOM (v = 0, no canvas flipY),
 * which is what makes blades grow up out of the ground in the world. Copied straight into a
 * top-down icon it draws grass hanging from the ceiling — the same mistake, in the same texture,
 * that Alex caught on sight in the world mesh. `flip` undoes it for surfaces that draw downward.
 */
const FLORA: Record<string, { pixels: () => Uint8Array; src: number; tint?: number }> = {
  grass_tuft: { pixels: () => bladePixels(TUFT_SEED, TUFT_BLADES, 16), src: 16 },
  tall_grass: { pixels: () => bladePixels(TALL_SEED, TALL_BLADES, 16), src: 16 },
  // The heads are painted white so a tint carries the whole hue; the icon takes the first bloom
  // colour rather than inventing one, so it is a flower the world actually grows.
  wild_flower: { pixels: () => headPixels(8), src: 8, tint: HEAD_TINTS[3] },
}

/** Nearest-neighbour scale an RGBA tile to `size`, flipping it upright, with an optional tint. */
function floraIcon(itemId: string, size = ICON): Uint8Array | null {
  const f = FLORA[itemId]
  if (!f) return null
  const src = f.pixels(), n = f.src
  const tr = f.tint === undefined ? 1 : ((f.tint >> 16) & 255) / 255
  const tg = f.tint === undefined ? 1 : ((f.tint >> 8) & 255) / 255
  const tb = f.tint === undefined ? 1 : (f.tint & 255) / 255
  const out = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    // ★ THE FLIP: destination row 0 is the TOP, source row 0 is the BOTTOM.
    const sy = Math.min(n - 1, n - 1 - (((y * n) / size) | 0))
    for (let x = 0; x < size; x++) {
      const sx = Math.min(n - 1, ((x * n) / size) | 0)
      const si = (sy * n + sx) * 4
      if (src[si + 3] === 0) continue
      const di = (y * size + x) * 4
      out[di] = Math.min(255, src[si] * tr)
      out[di + 1] = Math.min(255, src[si + 1] * tg)
      out[di + 2] = Math.min(255, src[si + 2] * tb)
      out[di + 3] = 255
    }
  }
  return out
}

/** The hand-painted flat icon for an item as RGBA, or null when nobody has drawn it. */
export function flatIcon(itemId: string, size = ICON): Uint8Array | null {
  const frame = ITEM_ICONS[itemId]?.frames[0]
  // A wired-but-blank frame is not art. Returning it would retire the "not drawn yet" chip for an
  // item that renders as nothing at all — the worst of both, and invisible.
  if (!frame || !frame.some(v => v !== 0)) return null
  return flatIconPixels(frame, paletteForItem(itemId), size)
}

/**
 * The icon for a material as a raw RGBA buffer.
 *
 * ⚠ CALLERS MUST CHECK `hasTileArt` FIRST. `paintFor`'s switch defaults to the SEAM painter, so a
 * material with no case of its own comes back as crystal in host rock — which is how the ground
 * cover icons rendered as magenta gemstones (caught by looking at `scripts/icon-sheet.mts`, not by
 * any test). It is the same hole this file's own header warns about between TILE_MATERIALS and the
 * painter switch, appearing one layer up.
 */
export function iconPixels(material: number, size = ICON, tile = TILE): Uint8Array {
  // ★ A SLAB WEARS ITS BASE MATERIAL'S FACES — `paintFor` is keyed on the full material and a
  // half-block id has no painter of its own, so without this mask every slab icon is the fallback.
  const base = material & 0xFF
  return rasterIcon(paintFor(base, TOP, tile), paintFor(base, SIDE, tile), size, tile)
}

/**
 * ── ★ ONE CHAIN, NAMED ONCE (2026-08-12) ────────────────────────────────────────────────────────
 * Block faces → the world's own flora generator → a hand-painted flat sprite → nothing.
 *
 * Exported because `scripts/item-art.mts` must classify items by CALLING this, not by restating the
 * order. It briefly did restate it, and immediately drifted: flora icons started rendering in game
 * while the checklist still listed grass as unpainted, which is precisely the "the doc says one
 * thing, the code does another" failure the checklist exists to prevent. A second copy of a
 * fallback chain is a second source of truth about what the player sees.
 *
 * ★ BLOCK FACES ALWAYS WIN. An item with a real block behind it must wear that block's texture even
 * if other art exists, or the two drift and the icon starts describing last month's stone.
 */
export function iconSourceFor(itemId: string): 'block' | 'cross' | 'flora' | 'painted' | 'mesh' | null {
  const mat = materialForItem(itemId)
  // ★ THE CROSS ARM SITS ABOVE THE BLOCK ARM, and the order is the fix. Block-faces-always-win is
  // still true for everything the world builds out of faces; a cross has none to win with. See
  // `drawnAsCross` for what this cost and why the predicate is derived rather than listed.
  if (mat !== undefined && hasTileArt(mat) && drawnAsCross(mat)) return 'cross'
  if (mat !== undefined && hasTileArt(mat)) return 'block'
  if (itemId in FLORA) return 'flora'
  if (ITEM_ICONS[itemId] && flatIcon(itemId)) return 'painted'
  // ★ THE DROP ARM IS LAST, AND ITS RANK IS THE WHOLE SAFETY ARGUMENT. Block-faces-always-win is a
  // claim about an item that IS its block; a drop only says the item came OFF one, which is weaker
  // and sometimes false — `raw_mana_shard` is a fragment of a seam, not a cube of crystal in host
  // rock, and Alex's hand-painted shard is the truer picture. Ranking this below `painted` means the
  // arm can only ever replace the honest chip, never displace existing art: seven crystals sit in
  // exactly this position and keep their sprites. See `blockWornBy` for why the map is separate.
  const worn = blockWornBy(itemId)
  if (worn !== undefined) return drawnAsCross(worn) ? 'cross' : 'block'
  // ★ LAST BEFORE THE CHIP: the things the world builds out of GEOMETRY rather than faces. A
  // deadfall log and a mushroom have no tile texture for any arm above to sample, so their icons are
  // rendered from the very geometry `flora-mesh.ts` instances into the world. Ranked here for the
  // same reason the drop arm is: it can only ever replace the honest chip, never displace art.
  if (hasMeshIcon(materialForItem(itemId))) return 'mesh'
  return null
}

/** The icon pixels for an item, from whichever source owns it. */
export function iconPixelsFor(itemId: string, size = ICON): Uint8Array | null {
  switch (iconSourceFor(itemId)) {
    case 'block': return iconPixels(blockWornBy(itemId)!, size)
    case 'cross': {
      const cut = leafCutout(blockWornBy(itemId)!)
      return cut && crossIcon(cut, size)
    }
    case 'flora': return floraIcon(itemId, size)
    case 'mesh': return meshIcon(materialForItem(itemId), size)
    case 'painted': return flatIcon(itemId, size)
    default: return null
  }
}

const cache = new Map<string, string | null>()
/**
 * A data URL for this item's icon, or null when it has no block behind it.
 *
 * Memoised for the lifetime of the page: an icon is a pure function of the item, the hotbar and the
 * satchel both ask for the same handful, and re-rasterising per render is how a UI starts costing
 * frames. Returns null rather than throwing outside the browser (SSR, tests).
 */
export function itemIcon(itemId: string): string | null {
  const hit = cache.get(itemId)
  if (hit !== undefined) return hit
  if (typeof document === 'undefined') return null

  // ★ THE ORDER IS THE BLOCK FIRST, ALWAYS. An item with a block behind it must wear that block's
  // real faces even if a flat sprite also exists, or the two drift and the icon starts describing
  // last month's texture — the whole argument at the top of this file. Flat art only ever answers
  // for items the derivation genuinely cannot: ground cover (a cross-quad, not a cube), and
  // everything with no block at all. Third tier is the honest chip.
  const px = iconPixelsFor(itemId)
  if (!px) { cache.set(itemId, null); return null }

  // The browser's only job is to carry the pure buffer onto a canvas — no projection lives here.
  const c = document.createElement('canvas')
  c.width = ICON; c.height = ICON
  const ctx = c.getContext('2d')
  if (!ctx) { cache.set(itemId, null); return null }
  const img = new ImageData(ICON, ICON)
  img.data.set(px)
  ctx.putImageData(img, 0, 0)

  const url = c.toDataURL()
  cache.set(itemId, url)
  return url
}
