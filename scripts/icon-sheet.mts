// Render every item icon to a PNG contact sheet, headless.
//
// Run: npx tsx scripts/icon-sheet.mts [out.png]
//
// ★ WHY THIS EXISTS: the icon projection used to live in browser canvas transforms, which meant the
// only way to SEE the art was to be a human at a screen. `rasterIcon` is now pure, so the same code
// that ships renders here into a PNG anyone — or any agent — can open. Crucially this is not a
// preview re-implementation: a preview that re-derives the maths can be correct while the game is
// wrong, which is the exact failure it was supposed to catch.
//
// Uses `sharp` (already a Next dependency) to write raw RGBA. No canvas, no browser, no GPU.

import sharp from 'sharp'
import { iconPixels, hasTileArt } from '../src/app/shimmer/voxel3d/tex/item-icon'
import { BLOCKS, blockDef } from '../src/app/shimmer/voxel/registry'

const S = 48           // icon edge, matching the shipped size
const PAD = 6
const COLS = 8
const BG = [24, 24, 27]

// Only blocks a painter actually owns — the rest would be the ore artist's default, which is
// a lie in a contact sheet meant to show what ships.
const mats = BLOCKS.filter(b => blockDef(b.material) && hasTileArt(b.material)).map(b => b.material)
const rows = Math.ceil(mats.length / COLS)
const W = COLS * (S + PAD) + PAD
const H = rows * (S + PAD) + PAD

const sheet = Buffer.alloc(W * H * 4)
for (let i = 0; i < W * H; i++) {
  sheet[i * 4 + 0] = BG[0]; sheet[i * 4 + 1] = BG[1]; sheet[i * 4 + 2] = BG[2]; sheet[i * 4 + 3] = 255
}

mats.forEach((m, i) => {
  const px = iconPixels(m, S)
  const ox = PAD + (i % COLS) * (S + PAD)
  const oy = PAD + Math.floor(i / COLS) * (S + PAD)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const si = (y * S + x) * 4
    if (px[si + 3] === 0) continue          // outside the cube silhouette: show the sheet
    const di = ((oy + y) * W + (ox + x)) * 4
    sheet[di + 0] = px[si + 0]; sheet[di + 1] = px[si + 1]
    sheet[di + 2] = px[si + 2]; sheet[di + 3] = 255
  }
})

const out = process.argv[2] ?? 'icon-sheet.png'
await sharp(sheet, { raw: { width: W, height: H, channels: 4 } }).png().toFile(out)
console.log(`${mats.length} icons → ${out} (${W}×${H})`)
console.log(mats.map(m => blockDef(m)!.name).join(' · '))
