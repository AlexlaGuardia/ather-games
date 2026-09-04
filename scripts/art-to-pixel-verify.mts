// POSITIVE CONTROL for art-to-pixel.py's palette claim.
// png2sprite refuses these two ids today, correctly: neither has an ITEM_PALETTES entry, so
// paletteForItem returns the DEFAULT and every colour snaps 50-73 units away. The claim under test
// is the NEXT step: that once art-to-pixel's palette line lands in items.ts, the same import is
// EXACT. So this calls the same four editor functions png2sprite calls, with the derived palette
// standing in for the resolver's answer, and asserts distance 0 on every colour.
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { extractColors, buildColorMap, applyColorMap, sliceFrames } from '../src/app/shimmer/components/PngImportUtils'

const [png, palFile, name] = process.argv.slice(2)
const palette = (readFileSync(palFile, 'utf8').match(/'#[0-9a-f]{6}'/g) || []).map(s => s.slice(1, -1))
const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const imageData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height } as ImageData
const map = buildColorMap(extractColors(imageData), palette)
const worst = Math.max(...map.map(c => c.distance))
const frames = sliceFrames(applyColorMap(imageData, map), info.width, info.height, 32)
const rows = Array.from({ length: 32 }, (_, y) =>
  '  ' + Array.from({ length: 32 }, (_, x) => frames[0][y * 32 + x].toString(16)).join(''))
console.log(`palette ${palette.length} slots, ${map.length} source colours, worst distance ${worst}`)
console.log(worst === 0 ? '✓ EXACT — every source colour is a palette slot' : '✗ snapped')
console.log(`const ${name} = px(32, 32, \`\n${rows.join('\n')}\n\`)`)
