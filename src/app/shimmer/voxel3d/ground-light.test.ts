// The living light — canon's acceptance test, as far as arithmetic can carry it.
// Run: npx tsx src/app/shimmer/voxel3d/ground-light.test.ts
//
// ⚠ WHAT THIS CANNOT PROVE: that the light ARRIVES. The arrival test is Alex's eye — a Hollow that
// looks different on tended ground than in a greyfield (design-briefs/hollows.md). These asserts
// guard the premises that picture rests on; they are not the picture.
import * as THREE from 'three'
import {
  splatGround, bedGlow, sourcesKey, patchHollowForGround, GROUND_W, GROUND_REACH, GROUND_DECL_GLSL,
  GROUND_UNIFORMS, PHASE_WEIGHT, type GroundSource,
} from './ground-light'
import { LIGHT_DECL_GLSL, createLightUniforms } from './light-glsl'
import { adoptHollowMat } from './hollow-look'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const at = (f: Uint8Array, x: number, z: number) => {
  const m = (a: number) => ((a % GROUND_W) + GROUND_W) % GROUND_W
  const i = m(z) * GROUND_W + m(x)
  return { r: f[i * 2], g: f[i * 2 + 1] }
}
const sum = (f: Uint8Array) => { let s = 0; for (let i = 0; i < f.length; i += 2) s += f[i]; return s }

// §1 a greyfield gives nothing — no sources, a field of zeros.
ok(sum(splatGround([], 0, 0)) === 0, '§1 ★ a greyfield (no living sources) is zero everywhere')

// §2 one bed lights its own cell and fades to nothing past the radius.
{
  const f = splatGround([{ x: 10, y: 70, z: -5, w: 1 }], 0, 0)
  ok(at(f, 10, -5).r > 150, `§2 the bed's own cell is bright (${at(f, 10, -5).r})`)
  ok(at(f, 12, -5).r > 0 && at(f, 12, -5).r < at(f, 10, -5).r, '§2 falls off with distance')
  ok(at(f, 15, -5).r === 0, '§2 gone past the radius — soft and LOW, not a lamp')
  ok(at(f, 10, -5).g === 70, '§2 G carries the plant cell height, so the shader can gate by y')
}

// §3 ★ a bare swept plot reads DARKER than an overgrown one (canon's test 1).
{
  const bare: GroundSource[] = [{ x: 0, y: 64, z: 0, w: bedGlow(3, 1) }]
  const grown: GroundSource[] = []
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) grown.push({ x, y: 64, z, w: bedGlow(3, 1) })
  ok(sum(splatGround(grown, 0, 0)) > 4 * sum(splatGround(bare, 0, 0)), '§3 ★ an overgrown plot out-lights a bare one')
  ok(at(splatGround(grown, 0, 0), 0, 0).r <= 255, '§3 a dense garden saturates, never overflows')
}

// §4 tending maps to intensity: growth and care both raise it; nothing reaches zero while alive.
ok(bedGlow(0, 0) > 0, '§4 a fresh seed in a dry bed is still alive — faint, not dark')
ok(bedGlow(3, 1) > bedGlow(3, 0), '§4 ★ a watered bed out-glows one nobody minds (Greg)')
ok(bedGlow(3, 0) > bedGlow(1, 1), '§4 a ripe dry bed out-glows a watered sprout — growth sets the ceiling')
ok(bedGlow(3, 1) === PHASE_WEIGHT[3], '§4 full care reaches the phase ceiling exactly')

// §5 the torus cannot alias a far garden onto a near field.
{
  const far = splatGround([{ x: GROUND_REACH + 5, y: 64, z: 0, w: 1 }], 0, 0)
  ok(sum(far) === 0, '§5 a source past GROUND_REACH is dropped, not wrapped')
  ok(2 * GROUND_REACH + 4 < GROUND_W, '§5 reach + reach + radius fits inside one torus period')
}

// §6 the key moves when the tending does.
{
  const a = [{ x: 1, y: 2, z: 3, w: 0.5 }]
  ok(sourcesKey(a, 0, 0) === sourcesKey([{ ...a[0] }], 0, 0), '§6 same sources, same key')
  ok(sourcesKey(a, 0, 0) !== sourcesKey([{ ...a[0], w: 0.9 }], 0, 0), '§6 watering a bed changes the key')
  ok(sourcesKey(a, 0, 0) !== sourcesKey(a, 1, 0), '§6 a moved ring changes the key')
}

// §7 GLSL hygiene — the same two silent failures light-glsl.test guards.
ok(!GROUND_DECL_GLSL.includes('`'), '§7 no backtick in the ground GLSL')
ok(LIGHT_DECL_GLSL.includes('float shimmerGroundAt('), '§7 the block programs carry the ground function')
ok(LIGHT_DECL_GLSL.indexOf('float shimmerGroundAt(') < LIGHT_DECL_GLSL.indexOf('vec3 shimmerLightCell('),
  '§7 declared BEFORE the light model that calls it')
for (const u of Object.keys(GROUND_UNIFORMS)) ok(GROUND_DECL_GLSL.includes(`uniform `) && GROUND_DECL_GLSL.includes(u), `§7 ${u} declared`)

// §8 ★ SHARED OBJECTS: the world's light uniforms and the Hollows hold the SAME ground objects.
{
  const lu = createLightUniforms()
  ok(lu.uGroundNight === GROUND_UNIFORMS.uGroundNight && lu.uGroundTex === GROUND_UNIFORMS.uGroundTex,
    '§8 ★ one write lands in blocks AND Hollows — spread objects, not copied values')
  ok(GROUND_UNIFORMS.uGroundOn.value === 0, '§8 off by default — a dev page with no host renders as before')
}

// §9 ★ THE HOLLOW ANSWERS, IT DOES NOT EMIT (hollows.md): the patch touches radiance only.
{
  const m = new THREE.MeshStandardMaterial()
  patchHollowForGround(m)
  const shader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: '#include <common>\n#include <project_vertex>',
    fragmentShader: '#include <common>\n#include <lights_fragment_maps>\n#include <emissivemap_fragment>',
  }
  m.onBeforeCompile(shader as never, null as never)
  ok(shader.fragmentShader.includes('radiance += uGroundTint'), '§9 living light enters as reflected radiance')
  ok(!/totalEmissiveRadiance|diffuseColor|irradiance \+=/.test(shader.fragmentShader.replace(GROUND_DECL_GLSL, '')),
    '§9 ★ and nowhere else — no emissive, no diffuse, selfLit stays 0')
  ok(shader.uniforms.uGroundTex === GROUND_UNIFORMS.uGroundTex, '§9 the Hollow reads the shared objects')
  // ⚠ Material.clone() drops the patch — hollow-body clones, so adoptHollowMat must restore it.
  const bare = m.clone()
  ok(bare.customProgramCacheKey() !== 'hollow-ground-v1', '§9 premise: a raw clone LOSES the patch')
  ok(adoptHollowMat(m.clone()).customProgramCacheKey() === 'hollow-ground-v1', '§9 ★ adoptHollowMat puts it back')
}

if (fails.length) { console.error(`ground-light: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`ground-light: ${pass}/${pass} pass`)
