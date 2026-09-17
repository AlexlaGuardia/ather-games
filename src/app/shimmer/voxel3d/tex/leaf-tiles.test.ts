// A leaf per wood (2026-09-17). Run: npx tsx src/app/shimmer/voxel3d/tex/leaf-tiles.test.ts
//
// ★ WHY: four painters feed one strip and a shader picks a tile by matching `aLayer` against four
// uniforms — three tables (strip order, LEAF_MATS, layerOf) that must agree with nothing enforcing
// it. And a painter can drift sparse without anyone noticing until the trunk shows through the
// canopy again (08-13). This pins: the strip is laid out in LEAF_SPECIES order, each tile is a real
// cutout inside the coverage band the canopy needs, the four tiles are four DIFFERENT pictures, the
// glow bit exists only on starwillow and only above alphaTest, and the shader's pick reads
// `aLayer` against `uLeafLayers` after `uv_vertex`.
import fs from 'node:fs'
import { leafPixelsFor, leafStripPixels, leafCoverage, leafSpeciesOf, LEAF_SPECIES, LEAF_MATS, LEAF_TILE, LEAF_GLOW_ALPHA } from './flora-tex'
import { layerOf, SIDE } from './tiles'
import { WOOD } from '../../voxel/trees'
import { MAT } from '../../voxel/depth'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }

// ── 1. the strip is the four tiles in order ────────────────────────────────────────────────────
const S = LEAF_TILE, W = S * LEAF_SPECIES.length
const strip = leafStripPixels(S)
ok(strip.length === W * S * 4, 'strip is 4 tiles wide')
LEAF_SPECIES.forEach((sp, t) => {
  const tile = leafPixelsFor(sp, S)
  let same = true
  for (let y = 0; y < S && same; y++) for (let x = 0; x < S; x++) {
    const a = (y * S + x) * 4, b = (y * W + t * S + x) * 4
    if (tile[a] !== strip[b] || tile[a + 3] !== strip[b + 3]) { same = false; break }
  }
  ok(same, `${sp} sits at strip tile ${t}`)
})
ok(LEAF_MATS.length === LEAF_SPECIES.length, 'one material per species')
ok(leafSpeciesOf(WOOD.STARWILLOW_LEAVES) === 'starwillow' && leafSpeciesOf(WOOD.GOLDWOOD_LEAVES) === 'goldwood', 'species lookup by material')
ok(leafSpeciesOf(MAT.STONE) === null, 'a non-leaf has no species')

// ── 2. every tile is a cutout in the canopy's coverage band ────────────────────────────────────
// The shared clump this replaces was 39% opaque, and 08-13 found a canopy thinner than that shows
// its trunk; a tile past ~70% is a card again. Deterministic, so the band is a fact not a hope.
for (const sp of LEAF_SPECIES) {
  const c = leafCoverage(leafPixelsFor(sp, S))
  ok(c >= 0.34 && c <= 0.70, `${sp} coverage ${(c * 100).toFixed(0)}% is in the canopy band [34, 70]`)
  const d = leafPixelsFor(sp, S)
  let border = 0; for (let x = 0; x < S; x++) border += d[x * 4 + 3] + d[((S - 1) * S + x) * 4 + 3]
  ok(border === 0, `${sp}: top and bottom rows are chewed clear (no straight card edge)`)
  ok(leafPixelsFor(sp, S).every((v, i) => v === d[i]), `${sp} is deterministic`)
}

// ── 3. four different pictures, painted near-white ─────────────────────────────────────────────
const alphaMask = (d: Uint8Array) => Array.from({ length: d.length / 4 }, (_, i) => d[i * 4 + 3] >= 128)
for (let i = 0; i < LEAF_SPECIES.length; i++) for (let j = i + 1; j < LEAF_SPECIES.length; j++) {
  const a = alphaMask(leafPixelsFor(LEAF_SPECIES[i], S)), b = alphaMask(leafPixelsFor(LEAF_SPECIES[j], S))
  let diff = 0; for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) diff++
  ok(diff / a.length > 0.25, `${LEAF_SPECIES[i]} vs ${LEAF_SPECIES[j]}: silhouettes differ on ${(diff / a.length * 100).toFixed(0)}% of texels`)
}
for (const sp of LEAF_SPECIES) {
  const d = leafPixelsFor(sp, S)
  let lum = 0, n = 0
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) { lum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++ }
  ok(lum / n > 150, `${sp} is a luminance mask (mean ${(lum / n).toFixed(0)} on opaque texels) — the tint is the hue`)
}

// ── 4. the glow bit ────────────────────────────────────────────────────────────────────────────
const glowCount = (d: Uint8Array) => { let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] === LEAF_GLOW_ALPHA) n++; return n }
ok(LEAF_GLOW_ALPHA > 127 && LEAF_GLOW_ALPHA < 230, 'the glow alpha survives alphaTest 0.5 and sits under the shader\'s 0.9')
ok(glowCount(leafPixelsFor('starwillow', S)) >= 4, 'starwillow carries lit tips')
for (const sp of ['goldwood', 'shimmeroak', 'dawnwood'] as const) ok(glowCount(leafPixelsFor(sp, S)) === 0, `${sp} has no glow texels`)
for (const sp of LEAF_SPECIES) {
  const d = leafPixelsFor(sp, S)
  ok(Array.from({ length: d.length / 4 }, (_, i) => d[i * 4 + 3]).every(a => a === 0 || a === 255 || a === LEAF_GLOW_ALPHA), `${sp}: alpha is 0, 255 or the glow bit — nothing in between to blur the cutout`)
}

// ── 5. the material picks by aLayer ────────────────────────────────────────────────────────────
const src = fs.readFileSync(new URL('./leaf-material.ts', import.meta.url), 'utf8')
ok(/const layers = LEAF_MATS\.map\(m => layerOf\(m, SIDE\)\)/.test(src), 'the four layer ids come from layerOf(…, SIDE), the value a horizontal cross-quad carries')
ok(/#include <uv_vertex>\n\{/.test(src) && /vMapUv = vec2\(\(vMapUv\.x \+ t\) \/ uLeafTiles, vMapUv\.y\)/.test(src), 'the tile pick slides vMapUv AFTER uv_vertex writes it')
ok(/attribute float aLayer;/.test(src) && /uniform vec4 uLeafLayers;/.test(src), 'aLayer and the layer table are declared in the vertex stage')
ok(/step\(diffuseColor\.a, 0\.9\)/.test(src) && /gl_FragColor = vec4\(leafCol, 1\.0\)/.test(src), 'the glow bit is read below 0.9 and the output alpha is 1')
ok(/lightApplyHere\('leafCol'/.test(src), 'the canopy still samples the light field')
const world = fs.readFileSync(new URL('../VoxelWorld.tsx', import.meta.url), 'utf8')
ok(/createLeafMaterial\(lightUniforms\)/.test(world) && !/leafPixels\(16\)/.test(world), 'VoxelWorld takes the material from leaf-material.ts')
// distinct layers, or two woods would share a tile
const ids = LEAF_MATS.map(m => layerOf(m, SIDE))
ok(new Set(ids).size === 4, `the four woods have four distinct side layers (${ids.join(',')})`)

console.log(`\nleaf-tiles: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ four woods, four leaves, one strip, and the shader picks by the layer the mesher already writes')
