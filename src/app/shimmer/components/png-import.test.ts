// Round-trip audit for the Aseprite import. Run: npx tsx src/app/shimmer/components/png-import.test.ts
//
// ── ★ WHY A ROUND TRIP AND NOT A FIXTURE ────────────────────────────────────────────────────────
// The claim this file has to settle is "the import maps colours back to the indices they came from".
// A hand-written fixture of expected indices is a MIRROR of the mapping, and a mirror agrees with a
// stale original perfectly — the failure this repo has already paid for more than once. So the test
// takes a real shipped sprite, paints it through its own palette into an RGBA buffer exactly the way
// a PNG export would, imports that buffer back, and demands the indices it started with. Nothing is
// written down twice, and the assert has an input that makes it fire.
//
// ⚠ THIS ALSO COVERS `scripts/png2sprite.mts`, which is the same four functions behind a `sharp`
// shim instead of a canvas. If the mapping ever stops being lossless, both front ends go red here.

import { extractColors, buildColorMap, applyColorMap, sliceFrames, nearestPaletteColor } from './PngImportUtils'
import { ITEM_ICONS, paletteForItem, ITEM_PALETTE } from '../sprites/items'

const fails: string[] = []
const warnings: string[] = []
let pass = 0

const hex = (h: string): [number, number, number] =>
  [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** Paint palette indices into an RGBA buffer — what Aseprite would export. */
function toImageData(frame: Uint8Array, palette: readonly string[]) {
  const S = Math.round(Math.sqrt(frame.length))
  const d = new Uint8ClampedArray(S * S * 4)
  frame.forEach((v, i) => {
    if (v === 0) return                       // index 0 is transparent and must come back as 0
    const c = hex(palette[v - 1]); if (!c) return
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255
  })
  return { data: d, width: S, height: S } as ImageData
}

// ── ⓪ A PALETTE THAT REPEATS A COLOUR CANNOT ROUND-TRIP, AND THAT IS ITS BUG, NOT THE IMPORT'S ─
// Two slots holding the same hex means both indices paint one colour, so the import can only ever
// return one of them. Found on the first run: `seedPal(body, core)` hardcodes slot 0 as '#d4a843'
// and `mana_seed` passes that same value as its body, so indices 1 and 7 are identical and 36 pixels
// of index 7 come back as 1. That is the deliberately un-speciated placeholder seed the file already
// marks "⚠ Alex's to re-colour" — a real property, not a mapping fault.
//
// ★ SO ① SKIPS THESE, AND THE EXEMPTION IS DERIVED RATHER THAN LISTED. A hand-kept `['mana_seed']`
// allowlist is the exemption that outlives its reason: the day Alex gives it a body colour of its
// own, a listed id would keep the item excluded forever and quietly stop testing it. Computing the
// collision means the exemption EXPIRES the moment the collision does.
//
// ⚠ Distinct from `PALETTE_COLLISIONS` in items.ts — that names ids present in BOTH SEED_PALETTES
// and ITEM_PALETTES. This is a repeat WITHIN one palette. Same word, different failure.
const ids = Object.keys(ITEM_ICONS)
const repeats = (p: readonly string[]) => p.filter((c, i) => p.indexOf(c) !== i)
const collided = ids.filter(id => repeats(paletteForItem(id)).length > 0)

let checked = 0
for (const id of ids) {
  const frame = ITEM_ICONS[id]?.frames[0]
  if (!frame || !frame.some(v => v !== 0)) continue        // blank frames have nothing to prove
  if (collided.includes(id)) continue                      // ⓪ — ambiguous by construction, reported below
  const palette = paletteForItem(id)
  const img = toImageData(frame, palette)
  const back = sliceFrames(applyColorMap(img, buildColorMap(extractColors(img), palette)), img.width, img.height, img.width)[0]

  const wrong: number[] = []
  frame.forEach((v, i) => { if (v !== back[i]) wrong.push(i) })
  if (wrong.length) {
    // ⚠ Report WHAT it became, not just how many. A count invites the cheapest fix that makes it 0.
    const i = wrong[0]
    fails.push(`${id}: ${wrong.length}/${frame.length} px changed — first at ${i}, index ${frame[i]} came back as ${back[i]}`)
  } else { pass++; checked++ }
}
console.log(`round-tripped ${checked} shipped item sprites through the import`)

// ── ② THE COLLISIONS ARE REPORTED, NOT FAILED — AND THE REASON IS THE ITEM-ART PRECEDENT ──────
// These are colour calls and colour is Alex's. `scripts/item-art.mts` already argues this case in
// its own header: failing a build on art that only a human can supply puts the repo permanently red
// and the check permanently unread, which is the outcome the check exists to avoid. So this prints
// every run and exits 0; `--strict` is there for the day somebody wants it in CI.
if (collided.length) {
  warnings.push(`${collided.length} item palette(s) repeat a colour, so their sprites cannot round-trip one-to-one:`)
  for (const id of collided) {
    const p = paletteForItem(id)
    const dup = [...new Set(repeats(p))]
    const slots = dup.map(c => p.map((v, i) => v === c ? i + 1 : 0).filter(Boolean).join(' and '))
    warnings.push(`    ${id}: ${dup.join(', ')} at index ${slots.join('; ')} — those indices are indistinguishable`)
  }
}

// ── ③ THE SNAP MUST BE MEASURABLE, OR --max-dist IS DECORATION ────────────────────────────────
// `nearestPaletteColor` never says "no match" — it opens at index 1 and always returns something.
// The CLI leans entirely on `distance` to refuse a bad import, so distance has to actually vary.
// ⚠ Asserting only "an exact colour has distance 0" would pass even if distance were hard-coded to
// 0, so this checks BOTH directions against one palette.
{
  const p = ITEM_PALETTE
  const exact = nearestPaletteColor(...hex(p[2]), p)
  if (exact.distance !== 0) fails.push(`an exact palette colour reported distance ${exact.distance}, want 0`)
  else pass++
  const far = nearestPaletteColor(0, 255, 0, p)          // a green nothing in the default palette owns
  if (!(far.distance > 40)) fails.push(`a colour far from every slot reported distance ${far.distance} — the guard cannot fire`)
  else pass++
}

// ── ④ TRANSPARENCY IS A ROUND-TRIP PROPERTY TOO ───────────────────────────────────────────────
// Index 0 must survive as 0. `applyColorMap` decides on alpha < 128, so a half-transparent pixel is
// the interesting case, not a fully clear one.
//
// ⚠⚠ THE FIRST VERSION OF THIS CHECK COULD NOT FAIL, AND ONLY A MUTATION SWEEP SAID SO. It gave the
// half-transparent pixel a colour nothing else used, so when the threshold was broken on purpose the
// index still came back 0 — not because transparency held, but because `extractColors` (which has
// its OWN alpha test) never put that colour in the map, and `applyColorMap`'s `?? 0` caught the
// miss. The assert was passing on a second mechanism and would have shipped a broken threshold.
// So the two pixels now share one colour: the map is guaranteed to contain it, the lookup is
// guaranteed to succeed, and the ONLY thing that can still return 0 is the alpha test itself.
{
  const d = new Uint8ClampedArray(4 * 4 * 4)
  d[0] = 0xd5; d[1] = 0x44; d[2] = 0xc8; d[3] = 255       // opaque — puts the colour in the map
  d[4] = 0xd5; d[5] = 0x44; d[6] = 0xc8; d[7] = 100       // SAME colour at alpha 100, under threshold
  const img = { data: d, width: 4, height: 4 } as ImageData
  const back = applyColorMap(img, buildColorMap(extractColors(img), ITEM_PALETTE))
  if (back[1] !== 0) fails.push(`a pixel at alpha 100 imported as index ${back[1]}, want 0 (transparent)`)
  else pass++
  if (back[0] === 0) fails.push('an opaque pixel imported as transparent')
  else pass++
}

console.log(`\npng-import audit: ${pass} checks passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (warnings.length) { console.log(''); for (const w of warnings) console.log('  ⚠ ' + w) }
if (fails.length) process.exit(1)
if (warnings.length && process.argv.includes('--strict')) process.exit(1)
console.log('\n✅ the editor import and scripts/png2sprite.mts share one lossless mapping')
