// ONE-SHOT (2026-08-12): 16×16 item art was declared as 32×32 and shipped as confetti.
//
// Run: node scripts/migrate-item-sprites.mjs [--dry]
//
// ── WHAT WAS WRONG ─────────────────────────────────────────────────────────────────────────────
// `sprites/items.ts` opens with the comment "16x16 pixel art icons" and then sets `const S = 32`.
// 65 of its 96 sprite literals are 16 rows of 16 digits handed to `px(S, S, …)`, which allocates
// 1024 slots and fills the first 256 SEQUENTIALLY — so the art lands as 8 rows of 32-wide garbage.
// Every consumer derives the sprite's edge as `sqrt(length)` (`drawSprite`, and the voxel3d flat
// rasteriser that copies its rule), reads 32, and draws the scramble. Editor and game agreed
// perfectly, which is exactly why it survived: there was no second opinion to disagree with.
//
// It shipped this way. `violet_crystal`, every blade, spike and rinstick, every potion and every
// mana seed rendered as scattered dots in the 2D game.
//
// ── WHY UPSCALE AND NOT CENTRE (Alex ruled, 2026-08-12) ────────────────────────────────────────
// Both options recover the art exactly; they differ in scale. Centring keeps native pixel density
// and leaves a 16×16 island in a 32×32 frame, which reads visibly undersized beside the 12 icons
// that really were authored at 32. Upscaling makes each art pixel a 2×2 block, matching their
// visual weight — and it hands Alex a full 32×32 canvas already carrying his art when he opens one
// in the item editor, so refining at true resolution is a paint pass rather than a redraw.
//
// ── SAFETY ─────────────────────────────────────────────────────────────────────────────────────
// Only literals with EXACTLY 256 digits AND declared `px(S, S, …)` are touched. A literal that
// genuinely declared `px(16, 16, …)` would already render correctly and upscaling it would break
// it — verified before running that no such literal exists. Idempotent: a migrated literal has
// 1024 digits and is skipped on any re-run.

import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../src/app/shimmer/sprites/items.ts', import.meta.url)
const dry = process.argv.includes('--dry')
const src = readFileSync(FILE, 'utf8')

const RE = /(const\s+([A-Z0-9_]+)\s*=\s*px\(\s*S\s*,\s*S\s*,\s*`)([^`]*)(`\s*\))/g

const migrated = []
const skipped = []
const out = src.replace(RE, (whole, head, name, body, tail) => {
  const digits = body.replace(/[^0-9a-fA-F]/g, '')
  if (digits.length !== 256) {
    if (digits.length !== 1024) skipped.push(`${name} (${digits.length} digits — neither 16×16 nor 32×32)`)
    return whole
  }
  // 2× nearest neighbour: source (x>>1, y>>1) for every destination pixel.
  const rows = []
  for (let y = 0; y < 32; y++) {
    let row = ''
    for (let x = 0; x < 32; x++) row += digits[(y >> 1) * 16 + (x >> 1)]
    rows.push('  ' + row)
  }
  migrated.push(name)
  return `${head}\n${rows.join('\n')}\n${tail}`
})

console.log(`migrated ${migrated.length} sprite literals 16×16 → 32×32 (2× upscale)`)
if (skipped.length) {
  console.log(`\n⚠ ${skipped.length} literal(s) are neither size and were left alone:`)
  for (const s of skipped) console.log(`    ${s}`)
}
if (dry) { console.log('\n--dry: nothing written'); process.exit(0) }
writeFileSync(FILE, out)
console.log('\nwrote src/app/shimmer/sprites/items.ts')
