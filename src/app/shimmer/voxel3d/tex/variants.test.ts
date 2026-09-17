// Painted variants + the macro tint (2026-09-17). Run: npx tsx src/app/shimmer/voxel3d/tex/variants.test.ts
//
// ★ WHY: the variants live PAST the fallback in a layer table the shader reads by texel, and the
// three things that must agree — where a variant is painted, where the table says it is, and which
// layer every shader sample reads — have no compiler between them. A table off by one paints the
// meadow with deep stone's second variant and nothing throws. This pins the layout, proves a
// variant is a different picture (not the base copied), proves the dressed one differs from the
// re-seed, and pins the four shader sample sites on gLayer rather than vLayer.
import fs from 'node:fs'
import {
  TILE_MATERIALS, VARIANT_MATERIALS, VARIANTS_PER, VARIANT_BASE, FALLBACK_LAYER, LAYER_COUNT,
  variantLayerOf, layerOf, paintFor, buildTileArray, buildLayerTable, weatherOf, variationOf,
  TOP, SIDE, BOTTOM, VAR_FIXED,
} from './tiles'
import { MAT } from '../../voxel/depth'
import { SEAM } from '../../voxel/seams'
import { WOOD } from '../../voxel/trees'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }

// ── 1. layout ──────────────────────────────────────────────────────────────────────────────────
ok(VARIANT_BASE === FALLBACK_LAYER + 1, 'variants start right after the fallback')
ok(LAYER_COUNT === VARIANT_BASE + VARIANT_MATERIALS.length * 3 * VARIANTS_PER, 'layer count covers every variant')
ok(VARIANT_MATERIALS.every(m => TILE_MATERIALS.includes(m)), 'every variant material has a base slot')
const seen = new Set<number>()
for (const m of VARIANT_MATERIALS) for (const f of [TOP, SIDE, BOTTOM]) {
  const b = variantLayerOf(m, f)
  ok(b >= VARIANT_BASE && b + VARIANTS_PER <= LAYER_COUNT, `${m} face ${f}: variant layers in range`)
  for (let v = 0; v < VARIANTS_PER; v++) { ok(!seen.has(b + v), `${m} face ${f} v${v + 1}: layer ${b + v} not shared`); seen.add(b + v) }
}
ok(variantLayerOf(MAT.STONE_BRICK, SIDE) === -1, 'a brick wall has no painted variants')
ok(variantLayerOf(MAT.STONE | 0x0100, TOP) === variantLayerOf(MAT.STONE, TOP), 'a slab takes its base\'s variants')

// ── 2. the table says what the painter did ─────────────────────────────────────────────────────
const tbl = buildLayerTable()
ok(tbl.length === LAYER_COUNT * 4, 'one RGBA texel per layer')
for (const m of [MAT.STONE, MAT.TOPSOIL, WOOD.GOLDWOOD_LEAVES]) for (const f of [TOP, SIDE, BOTTOM]) {
  const L = layerOf(m, f)
  ok(tbl[L * 4 + 1] === VARIANTS_PER, `${m} face ${f}: table count = ${VARIANTS_PER}`)
  ok(tbl[L * 4 + 2] + tbl[L * 4 + 3] * 256 === variantLayerOf(m, f), `${m} face ${f}: table base = variantLayerOf`)
  const vb = variantLayerOf(m, f)
  ok(tbl[vb * 4 + 1] === 0 && tbl[(vb + 1) * 4 + 1] === 0, `${m} face ${f}: a variant layer never re-selects`)
  ok(tbl[vb * 4] === tbl[L * 4], `${m} face ${f}: a variant layer turns + weathers like its base`)
}
ok(tbl[layerOf(MAT.CAULDRON, TOP) * 4 + 1] === 0, 'a station has count 0')
ok(tbl[FALLBACK_LAYER * 4] === VAR_FIXED && tbl[FALLBACK_LAYER * 4 + 1] === 0, 'the fallback: fixed, no variants')
// weather is bit 4 of r; the grade is the low nibble
ok((tbl[layerOf(MAT.TOPSOIL, TOP) * 4] & 15) === variationOf(MAT.TOPSOIL, TOP) && tbl[layerOf(MAT.TOPSOIL, TOP) * 4] >= 16, 'turf top: grade in the low nibble, weather bit set')
ok(tbl[layerOf(MAT.STONE_BRICK, SIDE) * 4] < 16, 'a brick wall does not weather')
ok(tbl[layerOf(MAT.MANA_LANTERN, SIDE) * 4] === VAR_FIXED, 'a lantern: fixed, no weather')
for (const m of [MAT.STONE, MAT.SAND, MAT.LUSH_TURF, SEAM.RAW_MANA, WOOD.GOLDWOOD_LEAVES, WOOD.GOLDWOOD_LOG, MAT.PATH])
  ok(weatherOf(m), `${m} takes the macro tint`)
for (const m of [MAT.WATER, MAT.GLASS, MAT.PLASTER, MAT.CUT_STONE, MAT.CHEST, MAT.CONJURED, MAT.PLANKS_GOLDWOOD])
  ok(!weatherOf(m), `${m} does not`)

// ── 3. a variant is a different picture; the dressed one differs from the re-seed ──────────────
const diff = (a: Uint8Array, b: Uint8Array) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n / (a.length / 4) }
for (const m of [MAT.STONE, MAT.TOPSOIL, MAT.SAND, MAT.COBBLESTONE, WOOD.SHIMMEROAK_LEAVES]) {
  const base = paintFor(m, TOP, 32), v1 = paintFor(m, TOP, 32, 1), v2 = paintFor(m, TOP, 32, 2)
  const d1 = diff(base, v1), d2 = diff(v1, v2)
  ok(d1 > 0.3, `${m}: variant 1 is a re-seed (${(d1 * 100).toFixed(0)}% of texels differ from base)`)
  ok(d2 > 0.02, `${m}: the dressed variant carries a feature (${(d2 * 100).toFixed(1)}% of texels differ from a plain re-seed of its own seed)`)
}
ok(diff(paintFor(MAT.STONE, TOP, 32), paintFor(MAT.STONE, TOP, 32, 0)) === 0, 'variant 0 is byte-identical to what shipped')
// ── 4. the whole array has every variant painted, not zeros ────────────────────────────────────
{
  const size = 16, per = size * size * 4
  const all = buildTileArray(size)
  ok(all.length === per * LAYER_COUNT, 'the array holds every layer')
  for (const m of VARIANT_MATERIALS) for (const f of [TOP, SIDE, BOTTOM]) {
    const b = variantLayerOf(m, f)
    for (let v = 0; v < VARIANTS_PER; v++) {
      const L = all.subarray((b + v) * per, (b + v + 1) * per)
      const ref = paintFor(m, f, size, v + 1)
      ok(L.every((x, i) => x === ref[i]), `${m} face ${f} v${v + 1} sits at layer ${b + v}`)
    }
  }
}

// ── 5. the shader reads gLayer at every sample site ────────────────────────────────────────────
const src = fs.readFileSync(new URL('./atlas.ts', import.meta.url), 'utf8')
ok(/textureGrad\(uTiles, vec3\(tileUv, gLayer\)/.test(src), 'colour sample on gLayer')
ok((src.match(/textureGrad\(uRelief, vec3\((tileUv|gTileUv), gLayer\)/g) ?? []).length === 2, 'both relief samples on gLayer')
ok(!/vec3\((tileUv|gTileUv), vLayer\)/.test(src), 'no sample site left on vLayer')
ok(/gLayer = pickLayer\(tbl, cell\)/.test(src) && /gOrient = tileOrient\(grade, cell\)/.test(src), 'the pick and the turn share one block coordinate')
ok(/float grade = mod\(tbl\.r, 16\.0\)/.test(src) && /gWeather = floor\(tbl\.r \/ 16\.0\)/.test(src), 'the r byte is decoded as grade + weather')
ok(/uniform float uWeather;/.test(src) && /shader\.uniforms\.uWeather = \{ value: weather \}/.test(src), 'uWeather declared and bound')
ok(/gWeather > 0\.5 && tile\.a < 0\.5/.test(src), 'the tint skips emissive texels and non-weather layers')
ok(/import \{[^}]*buildLayerTable[^}]*\} from '\.\/tiles'/.test(src) && !/buildVariationFlags/.test(src), 'the atlas builds the table, not the old grade strip')

console.log(`\nvariants: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ variants sit where the table says, differ from their base, and the shader samples them')
