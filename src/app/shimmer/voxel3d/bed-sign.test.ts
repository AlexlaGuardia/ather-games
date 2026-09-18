// bed-sign oracle — every bed crop has a sign with a picture on it (2026-09-18).
// Run: npx tsx src/app/shimmer/voxel3d/bed-sign.test.ts
import { signItemOf } from './bed-sign'
import { BED_CROP_IDS } from './planted-feed'
import { iconPixelsFor, iconSourceFor } from './tex/item-icon'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { c ? pass++ : fails.push(m) }

for (const id of BED_CROP_IDS) {
  const item = signItemOf(id)
  ok(item !== null, `${id}: pays an item, so its sign has something to show`)
  if (!item) continue
  const src = iconSourceFor(item)
  ok(src !== null && src !== 'block', `${id}: the sign wears real art for ${item} (${src}) — a cube on a stake is not a crop`)
  const px = iconPixelsFor(item, 32)
  ok(!!px && px.length === 32 * 32 * 4, `${id}: ${item} rasters at 32 (${px?.length})`)
  // a sign that is all transparent is a bare stake with extra steps
  ok(!!px && Array.from(px).some((v, i) => i % 4 === 3 && v > 0), `${id}: ${item}'s icon has ink on it`)
}
ok(signItemOf('manabloom') === null, 'the pot\'s bloom pays a spirit, not an item — no sign, and it is not a bed crop anyway')

if (fails.length) { console.log(fails.map(f => `  ✗ ${f}`).join('\n')); console.log(`❌ bed-sign ${fails.length} failed, ${pass} passed`); process.exit(1) }
console.log(`✅ bed-sign ${pass}/0`)
