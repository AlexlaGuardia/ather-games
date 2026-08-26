// Aseprite PNG → palette-indexed sprite literal, headless.
//
// Run: npx tsx scripts/png2sprite.mts <in.png> --item <itemId> [--size 16] [--double]
//      npx tsx scripts/png2sprite.mts art.png --item goldwood_spade --size 16 --double --name GOLDWOOD_SPADE
//
// ── ★ WHY THIS EXISTS: THE IMPORT WAS ALREADY BUILT AND HALF OF IT COULD NOT LEAVE THE BROWSER ──
// `components/PngImportUtils.ts` has done Aseprite-PNG → palette indices since the March change that
// turned the editor into a game-integration hub. It is good, and it is browser-only for exactly ONE
// reason: `pngToImageData` reaches for `Image` and `canvas`. Its own header says *"pure functions, no
// React dependencies"*, and it meant it — `extractColors`, `buildColorMap`, `applyColorMap` and
// `sliceFrames` are all plain arithmetic over an RGBA buffer.
//
// So this is not a second importer. It is `sharp` standing in for the canvas, and then THE SAME FOUR
// FUNCTIONS the editor calls. That is the whole design constraint: a headless importer that
// re-implemented the mapping could drift from the one Alex uses, and then a sprite imported at the
// terminal and the same sprite imported in the editor would disagree about its own colours. This
// repo has lost days to a preview that re-derived what the game derives. One mapping, two front ends.
//
// ⚠ EMIT-ONLY, ON PURPOSE. `/shimmer/save-sprite` already owns mutating `sprites/items.ts` by regex.
// A second writer for the same literals is a second source of truth about the file's shape, and the
// regex upsert has real rules (one line per key, trailing commas) that only it should have to know.
// This prints; a human or the editor lands it.

import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { extractColors, buildColorMap, applyColorMap, sliceFrames } from '../src/app/shimmer/components/PngImportUtils'
import { paletteForItem, ITEM_PALETTE } from '../src/app/shimmer/sprites/items'

const argv = process.argv.slice(2)
// ⚠ Accepts both spellings of a flag because the usage line below offers `-o` and the first version
// of this helper only understood `--o`, so `-o out.txt` was parsed as no destination and the file
// silently went to stdout instead. A writer that reports success and writes nowhere is the shape
// this repo keeps paying for; caught by diffing a round trip that then had no file to read.
const flag = (name: string, fallback?: string) => {
  const i = argv.findIndex(a => a === '--' + name || a === '-' + name)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[i + 1] : fallback
}
const has = (name: string) => argv.includes('--' + name)

const input = argv.find(a => !a.startsWith('--') && (a.endsWith('.png') || a.endsWith('.PNG')))
const itemId = flag('item')
const size = parseInt(flag('size', '16')!, 10)
const double = has('double')
const maxDist = parseFloat(flag('max-dist', '40')!)

if (!input || !itemId) {
  console.log('usage: png2sprite.mts <in.png> --item <itemId> [--size 16] [--double] [--name CONST]')
  console.log('       [--max-dist 40] [--force] [-o out.txt]')
  process.exit(2)
}

// ── The palette comes from the SHIPPED resolver, never a hand-passed list ───────────────────────
// `paletteForItem` is "the one place that decides what colours an item wears". Importing against
// anything else reproduces the exact bug that file was written to end: art that previews correctly
// and ships in the default palette.
const palette = paletteForItem(itemId)
const usingDefault = palette.every((c, i) => c === ITEM_PALETTE[i])

// ⚠ SLOT 0 IS THE SENTINEL IN THE DEFAULT PALETTE, and `nearestPaletteColor` can return index 1 for
// any colour that lands closest to it — so importing an item with no ITEM_PALETTES entry can map
// real art INTO the magenta that means "nobody chose colours". Say so before the import, not after.
if (usingDefault) {
  console.log(`⚠ '${itemId}' has no ITEM_PALETTES entry — importing against the DEFAULT palette,`)
  console.log(`  whose slot 0 is ${ITEM_PALETTE[0]}, the sentinel meaning nobody chose colours.`)
  console.log(`  Any source colour nearest to it becomes index 1 and ships magenta. Give the item a`)
  console.log(`  palette first (see scripts/item-art.mts for the ${'20'} already in this state).`)
}

const img = sharp(input).ensureAlpha()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
// The shim is the entire browser dependency. Everything past this line is the editor's own code.
const imageData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height } as ImageData

if (imageData.height !== size) {
  console.log(`✗ height must be ${size}px, got ${imageData.height}px`); process.exit(1)
}
if (imageData.width % size !== 0) {
  console.log(`✗ width must be a multiple of ${size}px, got ${imageData.width}px`); process.exit(1)
}

const unique = extractColors(imageData)
const colorMap = buildColorMap(unique, palette)
const frames = sliceFrames(applyColorMap(imageData, colorMap), imageData.width, imageData.height, size)

// ── ★ THE SNAP IS SILENT IN THE LIBRARY, SO IT IS LOUD HERE ─────────────────────────────────────
// `nearestPaletteColor` opens at `bestIdx = 1` and always returns SOME index — there is no "no
// match" answer — and `applyColorMap` then maps every source colour to its nearest slot. That is
// right for the editor, which shows the mapping table and lets a human accept it. At a terminal
// nobody is looking, so a colour 90 units from anything in the palette would import as a confident
// wrong colour. Reported per-colour, and refused past --max-dist unless --force.
const far = colorMap.filter(c => c.distance > maxDist)
const inexact = colorMap.filter(c => c.distance > 0)
console.log(`\n${imageData.width}x${imageData.height} → ${frames.length} frame(s) of ${size}x${size}`)
console.log(`${unique.length} source colour(s), ${inexact.length} not an exact palette match:`)
for (const c of colorMap.filter(c => c.distance > 0).sort((a, b) => b.distance - a.distance).slice(0, 12)) {
  const mark = c.distance > maxDist ? '✗' : '·'
  console.log(`  ${mark} ${c.hex} → index ${c.paletteIndex} (${palette[c.paletteIndex - 1]}), distance ${c.distance}`)
}
if (far.length && !has('force')) {
  console.log(`\n✗ ${far.length} colour(s) further than ${maxDist} from any palette slot. Nothing emitted.`)
  console.log(`  Fix the palette or the art — or pass --force to accept the snap.`)
  process.exit(1)
}

// ── emit the house literal ─────────────────────────────────────────────────────────────────────
// ⚠ `px(w, h, ...)` strips every non-hex character, so indices above 15 cannot be expressed and
// would silently truncate. Refuse rather than emit a literal that does not mean what it says.
const over = frames.flat().filter(v => v > 15)
if (over.length) { console.log(`✗ ${over.length} pixel(s) map above index 15; px() is hex-digit based`); process.exit(1) }

const name = flag('name', itemId.toUpperCase())!
const out = frames.map(f => {
  const rows: string[] = []
  for (let y = 0; y < size; y++) {
    const row = Array.from({ length: size }, (_, x) => f[y * size + x].toString(16)).join('')
    // --double is the house convention for 16x16 art living in a 32x32 literal: each authored pixel
    // becomes 2x2. Derived here rather than by hand, because hand-doubling is how a row loses a char.
    const line = double ? [...row].map(c => c + c).join('') : row
    rows.push('  ' + line)
    if (double) rows.push('  ' + line)
  }
  return rows.join('\n')
})

const dim = double ? size * 2 : size
const literal = frames.length === 1
  ? `const ${name} = px(${dim}, ${dim}, \`\n${out[0]}\n\`)`
  : out.map((o, i) => `const ${name}_${i} = px(${dim}, ${dim}, \`\n${o}\n\`)`).join('\n\n')

const dest = flag('o') ?? flag('out')
if (dest) { writeFileSync(dest, literal + '\n'); console.log(`\nwrote ${dest}`) }
else console.log('\n' + literal)
console.log(`\n✓ ${frames.length} frame(s), ${dim}x${dim}${double ? ' (16→32 doubled)' : ''}, palette from paletteForItem('${itemId}')`)
