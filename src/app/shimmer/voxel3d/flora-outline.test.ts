// Run: npx tsx src/app/shimmer/voxel3d/flora-outline.test.ts
//
// ── THE SELECTION BORDER, AND EVERY WAY IT CAN GO DARK WITHOUT SAYING SO ──────────────────────
//
// Alex, 2026-09-09: *"is there no way to just darken the border of the item when looking at it?"*
// The answer draws the plant's own geometry again with a fragment program that keeps only the
// silhouette texels. ⚠⚠ EVERY FAILURE MODE OF THAT IS SILENT:
//
//   · `String.replace` with a pattern that matches nothing returns the string UNCHANGED and throws
//     nothing. If three renames a shader chunk, the injection quietly does not happen and the
//     border renders as a solid black card over the plant — or not at all.
//   · A shader that fails to LINK renders NOTHING, with no console error. A typo in the GLSL is
//     invisible until somebody looks at a plant, which is the one thing automation here cannot do.
//   · The sway is gated on USE_INSTANCING. An outline drawn as a plain Mesh compiles fine, stands
//     still, and sheds its border the moment the wind moves — correct code, wrong world.
//   · A kind with no outline mesh marks nothing at all.
//
// So this file asserts the wiring, not the pixels: that the anchors three actually ships still
// exist, that the injection CHANGED the source, that both programs bend by the same number, and
// that the border's matrix is the plant's matrix. The pixels are Alex's call and always were.
import * as THREE from 'three'
import { createFloraRenderer, floraMatrix, FLORA_SWAY, FLORA_PARTS } from './flora-mesh'
import { FLORA } from '../voxel/flora'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }

const CARDS = [FLORA.TUFT, FLORA.TALL, FLORA.FLOWER, FLORA.HERB, FLORA.CROP]
const SOLIDS = [FLORA.ROCK, FLORA.DEADFALL, FLORA.MUSHROOM]
const ALL = [...CARDS, ...SOLIDS]

/** Compile-time surface of a material: run its onBeforeCompile against THREE's REAL shader source
 *  and hand back what the GPU would have been given. */
function compiled(mat: THREE.Material) {
  const lib = (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial ? THREE.ShaderLib.basic : THREE.ShaderLib.lambert
  const shader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
  }
  const before = { v: shader.vertexShader, f: shader.fragmentShader }
  ;(mat as unknown as { onBeforeCompile?: (s: typeof shader) => void }).onBeforeCompile?.(shader)
  return { shader, before }
}

const r = createFloraRenderer()
const meshes = () => r.group.children.filter(c =>
  (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[]

// ── 1. the anchors THREE actually ships still exist ───────────────────────────────────────────
// ⚠ THE POSITIVE CONTROL FOR EVERY REPLACE BELOW. If three renames these, the injections become
// no-ops that throw nothing, and every other assert in this file would still pass while the border
// silently stopped working. This is the assert that notices a three upgrade.
{
  ok(THREE.ShaderLib.basic.fragmentShader.includes('#include <map_fragment>'),
    'THREE basic fragment no longer has <map_fragment> — the edge-detect injection is a silent no-op')
  ok(THREE.ShaderLib.basic.vertexShader.includes('#include <begin_vertex>'),
    'THREE basic vertex no longer has <begin_vertex> — the sway injection is a silent no-op')
  ok(THREE.ShaderLib.lambert.vertexShader.includes('#include <begin_vertex>'),
    'THREE lambert vertex no longer has <begin_vertex> — the PLANT sway is a silent no-op')
}

// ── 2. setHighlight marks exactly one kind, and clearHighlight retracts all of it ──────────────
{
  for (const kind of ALL) {
    const drew = r.setHighlight(kind, 5, 40, 7, 0.42, true)
    ok(drew, `setHighlight(${kind}) returned false — that kind falls back to the wireframe box`)
    const lit = meshes().filter(m => m.count > 0)
    ok(lit.length > 0, `kind ${kind}: nothing was marked`)
    // Two-part kinds (flower/herb/crop stems+heads, mushroom stem+cap) light both parts.
    const expected = kind === FLORA.MUSHROOM ? 2 : (FLORA_PARTS[kind]?.length ?? 1)
    ok(lit.length === expected,
      `kind ${kind}: ${lit.length} outline mesh(es) lit, expected ${expected}`)
  }
  r.clearHighlight()
  ok(meshes().every(m => m.count === 0), 'clearHighlight left an outline mesh still drawing')
}

// ── 3. ★ THE BORDER SITS EXACTLY ON THE PLANT ─────────────────────────────────────────────────
// The outline for a CARD is not grown at all — its border comes from darkening edge texels, so its
// matrix must equal the plant's to the bit. Compared against `floraMatrix`, which is what `sync`
// composes the plant with.
{
  const mtx = new THREE.Matrix4(), off = new THREE.Vector3()
  const quat = new THREE.Quaternion(), scl = new THREE.Vector3()
  for (const kind of CARDS) {
    for (const variant of [0, 0.3, 0.77, 0.999]) {
      r.clearHighlight()
      r.setHighlight(kind, 5, 40, 7, variant, true)
      floraMatrix(kind, 5, 40, 7, variant, true, mtx, off, quat, scl)
      const lit = meshes().filter(m => m.count > 0)
      ok(lit.length > 0, `kind ${kind} @ ${variant}: nothing lit to compare`)
      const got = new THREE.Matrix4()
      for (const m of lit) {
        m.getMatrixAt(0, got)
        let worst = 0
        for (let i = 0; i < 16; i++) worst = Math.max(worst, Math.abs(got.elements[i] - mtx.elements[i]))
        ok(worst < 1e-5,
          `kind ${kind} @ ${variant}: border matrix differs from the plant's by ${worst} — it will not sit on it`)
      }
    }
  }
  r.clearHighlight()
}

// ── 4. ★★ BOTH PROGRAMS BEND BY THE SAME NUMBER ───────────────────────────────────────────────
// If the outline's sway amplitude differs from its plant's, the dark border walks off the blade as
// the wind moves — and it is invisible in a still frame, which is the only kind automation can take.
{
  for (const kind of CARDS) {
    const amp = FLORA_SWAY[kind]
    ok(typeof amp === 'number' && amp > 0, `kind ${kind} has no sway amplitude in FLORA_SWAY`)
    const needle = 'uv.y * ' + amp.toFixed(3)
    r.clearHighlight()
    r.setHighlight(kind, 5, 40, 7, 0.42, true)
    for (const m of meshes().filter(x => x.count > 0)) {
      const { shader, before } = compiled(m.material as THREE.Material)
      ok(shader.vertexShader !== before.v,
        `kind ${kind}: the outline's vertex injection changed NOTHING — replace() matched no anchor`)
      ok(shader.vertexShader.includes(needle),
        `kind ${kind}: outline sways by something other than FLORA_SWAY ${amp}`)
      ok(shader.vertexShader.includes('#ifdef USE_INSTANCING'),
        `kind ${kind}: outline sway is not gated on USE_INSTANCING`)
    }
  }
  r.clearHighlight()
}

// ── 5. ★★ THE EDGE-DETECT ACTUALLY REACHED THE FRAGMENT PROGRAM ───────────────────────────────
// Without this the border is a solid black card over the plant, which is a worse bug than the box
// it replaced — and nothing else in this file would notice.
{
  for (const kind of CARDS) {
    r.clearHighlight()
    r.setHighlight(kind, 5, 40, 7, 0.42, true)
    for (const m of meshes().filter(x => x.count > 0)) {
      const { shader, before } = compiled(m.material as THREE.Material)
      ok(shader.fragmentShader !== before.f,
        `kind ${kind}: the edge-detect injection changed NOTHING — replace() matched no anchor`)
      ok(shader.fragmentShader.includes('texture2D(map, vMapUv + vec2('),
        `kind ${kind}: no neighbour sampling in the outline fragment — it will paint a solid card`)
      ok(shader.fragmentShader.includes('discard'),
        `kind ${kind}: the outline never discards interior texels — it will hide the plant`)
      // The one-texel step must be a real, non-zero offset read off the texture.
      const step = /float aT = ([0-9.]+);/.exec(shader.fragmentShader)
      ok(!!step && Number(step[1]) > 0 && Number(step[1]) <= 0.2,
        `kind ${kind}: texel step is ${step?.[1]} — expected one texel of a 8..64px sprite`)
    }
  }
  r.clearHighlight()
}

// ── 6. the border never writes depth, or it occludes the plant it is marking ──────────────────
{
  for (const kind of ALL) {
    r.clearHighlight()
    r.setHighlight(kind, 5, 40, 7, 0.42, true)
    for (const m of meshes().filter(x => x.count > 0)) {
      ok((m.material as THREE.Material).depthWrite === false,
        `kind ${kind}: outline writes depth — it will punch a hole in what it marks`)
    }
  }
  r.clearHighlight()
}

r.dispose()
console.log(`\nflora outline: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the border is wired to the plant it marks')
