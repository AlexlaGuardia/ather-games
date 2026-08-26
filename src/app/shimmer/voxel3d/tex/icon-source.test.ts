// Icon-source audit. Run: npx tsx src/app/shimmer/voxel3d/tex/icon-source.test.ts
//
// ── ★★★ WHY THIS EXISTS: AN ICON AGREED WITH THE WORLD ABOUT PAINT AND LIED ABOUT SHAPE ─────────
// 2026-08-23. Alex, holding two goldwood saplings: *"i dont have any saplings in my inventory."*
// They were in the first slot. `iconSourceFor` sent them down the BLOCK branch, which projects an
// isometric cube of the material's faces — so a seedling wore a leaf-textured cube and sat in a
// hotbar beside grass, tall grass and wild flowers, all of them green. Nothing was missing and
// nothing looked broken; the item simply could not be recognised.
//
// ⚠⚠ THE TRIGGER WAS A FIX. Saplings had no tile art until 2026-08-22, so `hasTileArt` was false,
// the block branch was skipped, and they fell through to the honest colour chip — plain, and plainly
// unfinished. Texturing them (to stop a magenta checkerboard IN THE WORLD) flipped their icon from
// "nobody drew this yet" to a confident cube. **A repair in one renderer turned a blank into a lie
// in another**, and no test anywhere was asking whether an icon's SHAPE matched the world's.
//
// ★ SO THE ASSERT IS ABOUT THE CLASS, NOT ABOUT SAPLINGS. `item-icon.ts` derives its exemption from
// `isPlant || isSapling`; this file checks the wider truth that predicate is standing in for —
// LEAVES INCLUDED — so the day a leaf block becomes a holdable item, or a new plant family lands,
// this goes red instead of shipping another cube. A hand-kept list of "these are crosses" would
// have said `grass_tuft` in August and still not said `sapling`.
//
// ⚠ If this fails, do NOT add the item to an allowlist. Either the world draws it as a cube (then
// the block branch is right and the mesher's predicate is what is wrong), or it does not (then it
// needs a cross or a flat sprite). The icon and the mesher have to agree about geometry.

import { ALL_BLOCKS, materialForItem } from '../../voxel/registry'
import { isPlant, isSapling } from '../../voxel/depth'
import { isLeafMat } from '../../voxel/trees'
import { iconSourceFor, iconPixelsFor, iconPixels, hasTileArt, crossIcon, leafCutout, blockWornBy, flatIcon } from './item-icon'
import { ITEM_ICONS } from '../../sprites/items'

const fails: string[] = []
let pass = 0

/** What the WORLD does. `greedy.ts` crosses leaves and saplings in one pass; ground cover is
 *  instanced by `flora-mesh`. None of the three is a cube, and that is the only question here. */
const worldDrawsAsCross = (m: number): boolean => isPlant(m) || isSapling(m) || isLeafMat(m)

// Every item id the registry can hand a player, derived from the same `placeable && drops[0]` rule
// `materialForItem` is built from — so this walks the real item space, not a list kept beside it.
const itemIds = [...new Set(ALL_BLOCKS.flatMap(b => b.drops.map(d => d.itemId)))].sort()

// ── ① THE INVARIANT ────────────────────────────────────────────────────────────────────────────
let crossItems = 0
for (const id of itemIds) {
  const mat = materialForItem(id)
  if (mat === undefined || !worldDrawsAsCross(mat & 0xFF)) continue
  crossItems++
  const src = iconSourceFor(id)
  if (src === 'block') {
    fails.push(`${id} (mat ${mat & 0xFF}) takes the CUBE icon branch, but the world draws it as a `
      + `cross — this is the sapling bug of 2026-08-23, in a new material`)
  } else pass++
}

// ② And the exemption must actually exempt something, or ① passes by walking an empty set — the
// same trap `render-audit.test.ts` guards its flora exemption against.
if (crossItems === 0) {
  fails.push('no item maps to a cross-drawn material — this audit is checking nothing, so either '
    + 'the registry changed shape or worldDrawsAsCross has stopped matching the mesher')
} else pass++

// ── ③ THE FOUR THAT STARTED IT, BY NAME ────────────────────────────────────────────────────────
// ① would still pass if saplings resolved to `null` (the honest chip). That is not a regression but
// it is not the fix either, and it is exactly what a careless edit to the branch order would cause.
for (const id of ['goldwood_sapling', 'shimmeroak_sapling', 'starwillow_sapling', 'dawnwood_sapling']) {
  const src = iconSourceFor(id)
  if (src !== 'cross') fails.push(`${id} resolves to '${src}', expected 'cross' — a sapling with no `
    + `picture is findable-by-nobody again, which is the complaint this fixed`)
  else pass++
}

// ── ④ CUBES MUST STILL BE CUBES ────────────────────────────────────────────────────────────────
// The cheap way to make ① green forever is to widen `drawnAsCross` until nothing takes the block
// branch. Then every stone icon is a flat cross and the whole file is pointless.
for (const id of ['block_topsoil', 'cut_stone', 'stone_brick', 'sandstone']) {
  const mat = materialForItem(id)
  if (mat === undefined || !hasTileArt(mat)) continue
  if (iconSourceFor(id) !== 'block') {
    fails.push(`${id} no longer takes the block branch — drawnAsCross has been widened past the `
      + `materials the world actually crosses`)
  } else pass++
}

// ── ⑤ AND THE PICTURE HAS TO DIFFER, NOT JUST THE LABEL ────────────────────────────────────────
// ★ THE ASSERT THAT SURVIVES THE BUG'S OWN SHAPE. Every check above reads the SOURCE STRING. If
// `crossIcon` were ever pointed back at the cube rasteriser, or returned it unchanged, all of them
// stay green while the player sees precisely the cube we set out to kill. So compare the pixels: a
// cross is two thin planes and a cube is a filled hexagon, so the cross must cover strictly less of
// the icon. Coverage rather than equality, because "not identical" is satisfied by a one-pixel tint.
for (const id of ['goldwood_sapling', 'dawnwood_sapling']) {
  const mat = materialForItem(id)!
  const cross = iconPixelsFor(id)
  const cube = iconPixels(mat)
  if (!cross) { fails.push(`${id} produced no icon pixels at all`); continue }
  const covered = (px: Uint8Array): number => {
    let n = 0
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++
    return n
  }
  const c = covered(cross), b = covered(cube)
  if (c === 0) fails.push(`${id}'s cross icon is empty — it draws nothing`)
  else if (c >= b) {
    fails.push(`${id}'s cross covers ${c}px against the cube's ${b}px — a cross cannot cover as `
      + `much as a cube, so this is the cube wearing a different label`)
  } else pass++
}

// ── ⑥ THE CUTOUT MUST ACTUALLY CHANGE THE PICTURE ─────────────────────────────────────────────
// ★ ⑤ ABOVE PASSED THROUGHOUT THE BUG THIS CATCHES. Alex, 2026-08-23, holding the "fixed" sapling:
// *"the sapling is just a green 2d rectangle."* It was — two solid parallelograms — and every check
// above was green, because a solid cross genuinely does cover less than a cube. "Smaller than a
// cube" and "shaped like a plant" are different claims and only the first was asserted.
//
// ⚠⚠ AND THE FIRST VERSION OF THIS CHECK WAS DECORATION. It asked whether the icon leaves holes
// inside its bounding box — but the two quads are OFFSET, so the box corners are empty however
// solid the quads are. It could not have failed for any input, and it passed with the bug put back.
// A mutation sweep is the only reason that was found rather than shipped.
//
// So it asks the question that has an answer instead: does the source's alpha CHANGE the render?
// Force the same source opaque and the picture must get bigger. If it does not, the cutout is being
// discarded — which is precisely what forcing every texel opaque did. No threshold to nudge, and it
// compares two derivations of one source rather than a number someone chose.
for (const id of ['goldwood_sapling', 'shimmeroak_sapling', 'starwillow_sapling', 'dawnwood_sapling']) {
  const mat = materialForItem(id)
  const cut = mat === undefined ? null : leafCutout(mat)
  if (!cut) { fails.push(`${id} has no cutout source — leafCutout returned null`); continue }
  const solid = new Uint8Array(cut)
  for (let i = 3; i < solid.length; i += 4) solid[i] = 255
  const cover = (px: Uint8Array) => { let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++; return n }
  const real = cover(crossIcon(cut)), filled = cover(crossIcon(solid))
  if (filled <= real) {
    fails.push(`${id}: forcing the source opaque covers ${filled}px against the shipped ${real}px — `
      + `the cutout is not reaching the picture, so the icon is a solid block of colour. This is the `
      + `green-rectangle bug of 2026-08-23.`)
  } else pass++
}

// The item set these last three sweep. Every id a block drops, plus every id with hand art —
// between them that is every item the chain can be asked about without importing the recipe and
// tool tables. Derived, so a new block or a new sprite joins the sweep on its own.
const reachable: string[] = [...new Set([
  ...ALL_BLOCKS.flatMap(b => (b.drops ?? []).map(d => d.itemId)),
  ...Object.keys(ITEM_ICONS),
])]

// ── ⑦ A NAMED SOURCE MUST BE ABLE TO FILL ITSELF ──────────────────────────────────────────────
// ★ THIS CAUGHT ITS OWN AUTHOR, ONE EDIT AFTER THE ARM IT GUARDS WAS WRITTEN (2026-08-26).
// The drop arm below was added so the four species logs stop drawing a chip over a bark texture that
// already exists. The first version asked only "is there a block behind this item", and Deadfall and
// Mushroom answered yes — they are placeable — while the world draws both as INSTANCED GEOMETRY with
// no tile texture at all. `iconSourceFor` said `cross`; `iconPixelsFor` came back empty. Nothing
// threw, nothing rendered, and `item-art.mts` would have re-filed both from *needs Alex* to *nothing
// to draw*, shrinking his art queue by two items nobody has drawn. A checklist that reports a
// shorter queue is the direction of this failure that gets believed.
//
// So the assert is the general form rather than a case for those two: whatever arm the chain names,
// the pixels for that arm must exist. There is no item for which "I know what this is" and "I can
// draw it" are allowed to disagree.
for (const id of reachable) {
  const src = iconSourceFor(id)
  if (src === null) continue
  const px = iconPixelsFor(id)
  if (!px || px.every((v, i) => i % 4 !== 3 || v === 0)) {
    fails.push(`${id} names source '${src}' and renders nothing — the chain claims an arm it cannot fill`)
  } else pass++
}

// ── ⑧ NO CHIP OVER ART THAT ALREADY SHIPS ─────────────────────────────────────────────────────
// The defect the drop arm was written for, asserted so a refactor cannot quietly undo it. An item
// dropped by exactly one block, where that block has a real painted texture, must not fall to the
// plain chip — the world drew that surface, and the chip means *nobody drew this yet*.
// ⚠ Derived from `blockWornBy`, never a list of the four logs: the day a fifth species lands, or a
// new non-placeable block starts dropping something, this covers it without anyone remembering to.
for (const id of reachable) {
  const worn = blockWornBy(id)
  if (worn === undefined || !hasTileArt(worn)) continue
  if (iconSourceFor(id) === null) {
    fails.push(`${id} draws the plain chip while its block (${worn}) has a painted texture — `
      + `the chip asserts nobody drew this, and somebody did`)
  } else pass++
}

// ── ⑨ A DROP MAY NEVER DISPLACE A HAND-PAINTED SPRITE ─────────────────────────────────────────
// ★ THE RANK OF THE DROP ARM IS THE SAFETY ARGUMENT, SO THE RANK IS WHAT GETS ASSERTED.
// Block-faces-always-win is a claim about an item that IS its block. A drop only says the item came
// OFF one, which is weaker and sometimes plain false: `raw_mana_shard` is a fragment of a seam, not
// a cube of crystal in host rock. Seven crystals sit in exactly the position the drop arm answers
// for — no placement mapping, a tile-arted seam behind them, and a hand-painted sprite Alex drew for
// the 2D game. Rank the arm above `painted` and all seven silently trade his art for host rock.
for (const id of reachable) {
  if (!(ITEM_ICONS[id] && flatIcon(id))) continue          // no hand art to protect
  if (materialForItem(id) !== undefined) continue          // a real placement outranks art, by design
  const src = iconSourceFor(id)
  if (src !== 'painted') {
    fails.push(`${id} has a hand-painted sprite but resolves as '${src}' — a DROP outranked Alex's `
      + `art. The drop arm belongs below 'painted' in the chain.`)
  } else pass++
}

console.log(`\nicon-source audit: ${pass} checks passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) {
  console.log('\n★ Do NOT allowlist the item. The icon branch and the mesher must agree about')
  console.log('  whether a material has faces — that disagreement is the entire bug.')
  process.exit(1)
}
console.log(`✅ ${crossItems} cross-drawn items, none wearing a cube`)
