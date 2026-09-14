// ★ THE CARTOON STACK EXISTS ONCE, AND THIS HOLDS IT THERE. Run: npx tsx src/app/shimmer/voxel3d/cartoon-stack.test.ts
//
// History: `mesh-bridge.ts` and `tex/atlas.ts` each carried the four-lever stack as a GLSL string.
// On 2026-09-11 the shadow-lift fix went into the fallback first, measured as "no change" on a
// live wall, and only then was the second copy found — the hand-kept-mirror shape PATTERNS warns
// about, in a shader. This guard held the two copies identical until the stack was extracted into
// `cartoon-glsl.ts` (2026-09-13, when a THIRD consumer arrived: pieces). Now it asserts the
// opposite shape — ONE copy, and every consumer imports it. A copy that comes back inline is the
// bug returning; this goes red on the first `toonCol =` outside the module.
import { readFileSync } from 'fs'
import { join } from 'path'
import { cartoonStackGlsl, cartoonUniforms, CARTOON_DECL_GLSL, CARTOON_UNIFORMS_GLSL } from './cartoon-glsl'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')

// ── 1. the module carries the load-bearing lines ──────────────────────────────────────────────
const glsl = cartoonStackGlsl('vN', 'vP', 'vec3(0.0)')
const lines = glsl.split('\n').map(l => l.trim())
const KEY_LINES = [
  'float albLum = max(dot(diffuseColor.rgb, W), 0.03);',
  'float clum = clamp(dot(outgoingLight, W) / (albLum * hourLum), 0.0, 1.0);',
  'vec3 shade = mix(vec3(0.0), vec3(0.22, 0.26, 0.38), uShadowLift);',
  'vec3 cool = mix(vec3(1.0), vec3(0.80, 0.86, 1.0), uShadowLift);',
  'vec3 lift = shade * (1.0 - shaped) * clamp(albLum * 2.0, 0.15, 1.0);',
  'vec3 toonCol = diffuseColor.rgb * face * (0.35 + 0.95 * shaped) * mix(cool, vec3(1.0), shaped) + lift;',
]
for (const line of KEY_LINES) ok(lines.includes(line), `the module carries: ${line}`)
ok(!lines.some(l => l.endsWith('shade * (1.0 - shaped);')), '★ the flat additive lift is gone (it swamped every dark material with blue-grey)')
ok(/faceLum = cnrm\.y > 0\.5 \? 1\.0 : \(cnrm\.y < -0\.5 \? 0\.52/.test(glsl), 'the per-face law: top 1.0, bottom 0.52 — a face is never black')
ok(/shimmerLight\(finalCol, diffuseColor\.rgb, vP, cnrm\)/.test(glsl), 'the light field applies LAST, stepping along the world normal the caller named')
ok(/normalize\(vN\)/.test(glsl) && /fract\(vP - cnrm/.test(glsl), 'the caller names its own normal and position varyings')
ok(/gl_FragColor = vec4\(finalCol \+ vec3\(0\.0\), diffuseColor\.a\);/.test(glsl), 'the emissive term is the caller\'s')
ok(!glsl.includes('`'), 'no backtick in the GLSL (a stray one links nothing and logs nothing)')
ok(CARTOON_DECL_GLSL.startsWith(CARTOON_UNIFORMS_GLSL) && /uniform sampler3D uLightTex/.test(CARTOON_DECL_GLSL), 'the decl block carries the dials AND the field')
{
  const u = cartoonUniforms(), v = cartoonUniforms()
  ok(u.uFaceShading.value === 0.35 && u.uShadowLift.value === 0.15 && u.uCartoon.value === 0, 'shipped defaults')
  ok(u.uCartoon !== v.uCartoon, 'each call is its own set — two materials can be dialled apart')
}

// ── 2. every consumer imports it and NONE carries an inline copy ──────────────────────────────
const CONSUMERS = ['src/app/shimmer/voxel3d/mesh-bridge.ts', 'src/app/shimmer/voxel3d/tex/atlas.ts', 'src/app/shimmer/voxel3d/piece-mesh.ts']
for (const path of CONSUMERS) {
  const src = read(path)
  ok(/cartoonStackGlsl\(/.test(src), `${path} runs the stack from the module`)
  ok(/cartoonUniforms\(\)/.test(src), `${path} takes its dials from the module`)
  ok(!/toonCol\s*=/.test(src), `${path} carries NO inline copy of the stack`)
  ok(!/uniform float uShadowLift/.test(src), `${path} declares no cartoon uniform of its own`)
}
ok(/createTexturedVoxelMaterial/.test(read(CONSUMERS[1])) && /createVoxelMaterial\(/.test(read(CONSUMERS[0])) && /createPieceMaterial\(/.test(read(CONSUMERS[2])),
  'all three materials still exist (if one is removed, retire its row here with it)')
// ★ The world hands every consumer the same dials in one effect. Three setters, one value.
const world = read('src/app/shimmer/voxel3d/VoxelWorld.tsx')
const eff = world.slice(world.indexOf('applySettings(flatMaterial, settings)'), world.indexOf('applySettings(flatMaterial, settings)') + 900)
ok(/textured\?\.setCartoon\(cartoon\)/.test(eff) && /glassTextured\?\.setCartoon\(cartoon\)/.test(eff) && /pieces\.setCartoon\(cartoon\)/.test(eff),
  'the world dials the atlas, the glass AND the pieces from the one settings effect')
ok(/createPieceRenderer\(tiles, lightUniforms\)/.test(world), 'the pieces take the world\'s light uniform objects')

console.log(`\ncartoon stack: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
