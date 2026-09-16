// Per-block tile orientation (2026-09-16). Run: npx tsx src/app/shimmer/voxel3d/tex/variation.test.ts
//
// ★ WHY: the orientation is free variation, and its one failure mode is a tile that must NOT turn
// turning — a grass strip on the bottom of a block, a cauldron lid drawn sideways. That is decided
// by a grade table nobody re-reads, so this pins the grades that carry the argument, and pins the
// three shader sites that must agree about the orientation (colour, relief sample, relief normal).
import fs from 'node:fs'
import { variationOf, buildVariationFlags, VAR_FIXED, VAR_MIRROR, VAR_FULL, TOP, SIDE, BOTTOM, LAYER_COUNT, TILE_MATERIALS, FALLBACK_LAYER, layerOf } from './tiles'
import { MAT } from '../../voxel/depth'
import { SEAM } from '../../voxel/seams'
import { WOOD } from '../../voxel/trees'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }

// ── 1. the grades that carry the argument ──────────────────────────────────────────────────────
ok(variationOf(MAT.TOPSOIL, TOP) === VAR_FULL, 'a meadow top is grainless — all eight')
ok(variationOf(MAT.TOPSOIL, SIDE) === VAR_MIRROR, 'a turf SIDE wears the strip — mirror only')
ok(variationOf(MAT.TOPSOIL, BOTTOM) === VAR_FULL, 'the underside is dirt — all eight')
for (const m of [MAT.STONE, MAT.DEEP_STONE, MAT.SUBSOIL, MAT.SAND, SEAM.RAW_MANA, WOOD.GOLDWOOD_LEAVES])
  ok(variationOf(m, SIDE) === VAR_FULL, `${m} is grainless on every face`)
for (const m of [WOOD.GOLDWOOD_LOG, MAT.PLANKS_GOLDWOOD, MAT.STONE_BRICK, MAT.CUT_STONE, MAT.SHINGLES])
  ok(variationOf(m, SIDE) === VAR_MIRROR, `${m} has a grain or a course — mirror only`)
for (const m of [MAT.CAULDRON, MAT.CAULDRON_LIT, MAT.CRAFT_TABLE, MAT.CHEST, MAT.MANA_LANTERN, MAT.GLASS, MAT.WATER, MAT.SAPLING_GOLDWOOD])
  for (const f of [TOP, SIDE, BOTTOM]) ok(variationOf(m, f) === VAR_FIXED, `${m} face ${f} is a picture — never turned`)
// A slab wears its base's grade (the shader is keyed on the LAYER, which is already base-masked).
ok(variationOf(MAT.STONE | 0x0100, TOP) === variationOf(MAT.STONE, TOP), 'a half block grades as its base')

// ── 2. the strip covers every layer in atlas order ─────────────────────────────────────────────
const flags = buildVariationFlags()
ok(flags.length === LAYER_COUNT, `one byte per layer (${flags.length} vs ${LAYER_COUNT})`)
ok(flags.every(v => v === 0 || v === 1 || v === 2), 'every grade is 0, 1 or 2')
ok(flags[FALLBACK_LAYER] === VAR_FIXED, 'the magenta fallback never turns (it is a diagnostic)')
ok(flags[layerOf(MAT.TOPSOIL, SIDE)] === VAR_MIRROR && flags[layerOf(MAT.TOPSOIL, TOP)] === VAR_FULL,
  'the strip is indexed by the same layerOf the mesher writes')
const counts = [0, 0, 0]; for (const v of flags) counts[v]++
ok(counts[0] > 0 && counts[1] > 0 && counts[2] > 0, `all three grades are in use (${counts.join('/')})`)
ok(TILE_MATERIALS.length * 3 + 1 === LAYER_COUNT, 'layer count is still slots×3 + fallback')

// ── 3. the three shader sites agree ────────────────────────────────────────────────────────────
const src = fs.readFileSync(new URL('./atlas.ts', import.meta.url), 'utf8')
ok(src.includes('uniform sampler2D uVarFlags;') && src.includes("shader.uniforms.uVarFlags = { value: tiles.variation }"),
  'the grade strip is declared and bound')
ok(/textureGrad\(uTiles, vec3\(tileUv, vLayer\), gDx, gDy\)/.test(src), 'the colour sample uses the mapped derivatives (no mip seam at block edges)')
ok((src.match(/textureGrad\(uRelief,/g) ?? []).length === 2, 'both relief samples use textureGrad')
ok((src.match(/transpose\(gOrient\) \* (rn|nmap)\.xy/g) ?? []).length === 2, 'both relief normals are mapped back through the orientation')
ok(/vec2 dTx = dFdx\(tileUv\), dTy = dFdy\(tileUv\);[\s\S]*fract\(tileUv\)/.test(src), 'derivatives are taken BEFORE the per-block fract breaks continuity')
ok(!/const mat2 Q/.test(src), 'no const-with-constructor inside a function (link-failure trap noted in the file)')
ok(!/`[^`]*\bmat2 tileOrient[^`]*`[^`]*`/.test(src.slice(src.indexOf('mat2 tileOrient') - 2000, src.indexOf('mat2 tileOrient') + 1500)), 'no stray backtick inside the orientation GLSL')

console.log(`\nvariation: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ tiles turn where they may, stay put where they are pictures, and the three shader sites agree')
