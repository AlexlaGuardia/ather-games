// ★ THE CARTOON STACK EXISTS TWICE AND THIS HOLDS THE COPIES TOGETHER. Run: npx tsx src/app/shimmer/voxel3d/cartoon-stack.test.ts
//
// `mesh-bridge.ts` (`createVoxelMaterial`, the untextured fallback) and `tex/atlas.ts`
// (`createTexturedVoxelMaterial`, what the world renders with) each carry the four-lever cartoon
// stack as a GLSL string. On 2026-09-11 the shadow-lift fix went into the fallback first, measured
// as "no change" on a live wall, and only then was the second copy found — the hand-kept-mirror
// shape PATTERNS warns about, in a shader. Until the stack is extracted into one module, this
// guard reads both files and refuses the commit if the load-bearing lines differ (after renaming
// the two files' local variables to one vocabulary), and refuses the OLD flat additive lift in
// either copy.
import { readFileSync } from 'fs'
import { join } from 'path'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
const bridge = read('src/app/shimmer/voxel3d/mesh-bridge.ts')
const atlas = read('src/app/shimmer/voxel3d/tex/atlas.ts')

/** One vocabulary: atlas says cnrm/clum, bridge says nrm/lum. Comments and whitespace dropped. */
const norm = (src: string) => src
  .replace(/\/\/[^\n]*/g, '')
  .replace(/\bcnrm\b/g, 'nrm').replace(/\bclum\b/g, 'lum')
  .split('\n').map(l => l.trim()).filter(Boolean)

const KEY_LINES = [
  'float albLum = max(dot(diffuseColor.rgb, W), 0.03);',
  'float lum = clamp(dot(outgoingLight, W) / albLum, 0.0, 1.0);',
  'vec3 shade = mix(vec3(0.0), vec3(0.22, 0.26, 0.38), uShadowLift);',
  'vec3 cool = mix(vec3(1.0), vec3(0.80, 0.86, 1.0), uShadowLift);',
  'vec3 lift = shade * (1.0 - shaped) * clamp(albLum * 2.0, 0.15, 1.0);',
  'vec3 toonCol = diffuseColor.rgb * face * (0.35 + 0.95 * shaped) * mix(cool, vec3(1.0), shaped) + lift;',
]
const b = norm(bridge), a = norm(atlas)
for (const line of KEY_LINES) {
  ok(b.includes(line), `mesh-bridge carries: ${line}`)
  ok(a.includes(line), `atlas carries: ${line}`)
}
const OLD = 'shade * (1.0 - shaped);'
ok(!b.some(l => l.endsWith(OLD)), '★ the flat additive lift is gone from mesh-bridge (it swamped every dark material with blue-grey)')
ok(!a.some(l => l.endsWith(OLD)), '★ the flat additive lift is gone from atlas (this is the copy the world renders with)')
ok(/createTexturedVoxelMaterial/.test(atlas) && /createVoxelMaterial\(/.test(bridge), 'both materials still exist (if one is removed, retire this guard with it)')

console.log(`\ncartoon stack: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
