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
import { createFloraRenderer, floraMatrix, floraFruitLeavesGeo, floraFruitBerriesGeo, partGeometry, FLORA_SWAY, FLORA_PARTS } from './flora-mesh'
import { FLORA } from '../voxel/flora'
import { MAT } from '../voxel/depth'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }

const CARDS = [FLORA.TUFT, FLORA.TALL, FLORA.FLOWER, FLORA.HERB, FLORA.CROP, FLORA.REED]
// ⚠ FRUIT joined on 2026-09-22, when its pool stopped being two cards and became picasso's baked
// sculpt — it moved from a card border (edge texels darkened in place) to a grown back-face hull,
// and this file was green either way because it had never named the kind. PUFF, SHELF, BLOOM_BUSH,
// BLOOM_MAT and MOSS are still unnamed here; that is a gap, written down rather than left silent.
const SOLIDS = [FLORA.ROCK, FLORA.DEADFALL, FLORA.MUSHROOM, FLORA.FRUIT]
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
  // The moonberry's shimmer multiplies `totalEmissiveRadiance` after this anchor (2026-09-22).
  // Without the positive control a three rename turns canon's "shimmer in low light" into a
  // silent no-op: the berries would simply stop breathing and nothing would fail.
  ok(THREE.ShaderLib.lambert.fragmentShader.includes('#include <emissivemap_fragment>'),
    'THREE lambert fragment no longer has <emissivemap_fragment> — the berry shimmer is a silent no-op')
  ok(THREE.ShaderLib.lambert.fragmentShader.includes('totalEmissiveRadiance'),
    'THREE lambert fragment no longer declares totalEmissiveRadiance — the berry shimmer would not compile')
}

// ── 2. setHighlight marks exactly one kind, and clearHighlight retracts all of it ──────────────
{
  for (const kind of ALL) {
    const drew = r.setHighlight(kind, 5, 40, 7, 0.42, true)
    ok(drew, `setHighlight(${kind}) returned false — that kind falls back to the wireframe box`)
    const lit = meshes().filter(m => m.count > 0)
    ok(lit.length > 0, `kind ${kind}: nothing was marked`)
    // Two-part kinds (flower/herb/crop stems+heads, mushroom stem+cap) light both parts.
    // A shadow part has no border on purpose (see FloraPart.shadow); the reed's wake is water.
    // ⚠ `FLORA_PARTS` IS NOT THE AUTHORITY FOR A SCULPTED KIND. The fruit bush still HAS a
    // two-row `FLORA_PARTS` entry — `/bushtest`'s card control builds from it — but the pool and
    // its outline are the glb's two buffers, and the two counts agreeing at 2 today is a
    // coincidence, not a derivation. Named outright, next to the mushroom, for the same reason.
    const expected = kind === FLORA.MUSHROOM || kind === FLORA.FRUIT
      ? 2 : (FLORA_PARTS[kind]?.filter(p => !p.shadow && !p.wake).length ?? 1)
    ok(lit.length === expected,
      `kind ${kind}: ${lit.length} outline mesh(es) lit, expected ${expected}`)
  }
  r.clearHighlight()
  ok(meshes().every(m => m.count === 0), 'clearHighlight left an outline mesh still drawing')
}

// ── 2b. ★ THE FRUIT BUSH'S BORDER FOLLOWS THE SPECIES, NOT JUST THE KIND (2026-09-22) ─────────
// Two sculpts share FLORA.FRUIT, so `setHighlight` takes a material. The failure this catches is
// not "no border" — it is TWO borders (both species' hulls lit at once, a double outline) or the
// wrong one (a moonberry wearing the sunfruit's taller dome). Both look like a rendering glitch
// and neither trips a count-only assert that expects "at least one".
{
  for (const [name, fmat] of [['sunfruit', MAT.SUNFRUIT_BUSH], ['moonberry', MAT.MOONBERRY_BUSH]] as [string, number][]) {
    r.clearHighlight()
    ok(r.setHighlight(FLORA.FRUIT, 5, 40, 7, 0.42, true, fmat), `${name}: setHighlight returned false`)
    const lit = meshes().filter(m => m.count > 0)
    ok(lit.length === 2, `${name}: ${lit.length} outline meshes lit, expected exactly 2 (body + fruit of ONE species)`)
    // And they must be that species' own buffers — the only thing that tells the hulls apart.
    const want = new Set([floraFruitLeavesGeo(fmat).getAttribute('position').count, floraFruitBerriesGeo(fmat).getAttribute('position').count])
    for (const m of lit) {
      ok(want.has(m.geometry.getAttribute('position').count),
        `${name}: a lit hull has ${m.geometry.getAttribute('position').count} verts, which is not this species' geometry`)
    }
  }
  r.clearHighlight()
}

// ── 2c. ★★ EVERY SWAYING MESH CARRIES THE WEIGHT ITS SHADER READS (2026-09-22) ────────────────
// Alex: *"the flower patches are doing some weird motion... and they end up going underground."*
// The sway weighted itself by `uv.y²` — "how far from the root" — which `uv.y` only IS on a card
// that stands up. On a flat pad `uv.y` is the FAR EDGE, so two corners were driven and pushed down
// through a pad that clears the ground by 0.02. The weight is now an explicit `aSway` attribute.
//
// ⚠ AND THAT FIX INTRODUCED A SILENT FAILURE MODE, WHICH IS WHAT THIS GUARD IS FOR. An attribute
// a shader declares but a geometry does not supply reads as **0** in WebGL — no error, no warning.
// So a new swaying mesh whose builder forgets `aSway` does not break: it just stops moving, and a
// plant that has quietly stopped swaying is not something anyone reports. The check is exact
// rather than by-name: COMPILE each material against THREE's real source, ask whether the vertex
// program actually references `aSway`, and if it does, require the attribute on that geometry.
{
  const swayers: string[] = []
  for (const m of meshes()) {
    const mat = m.material as THREE.Material
    let usesSway = false
    try { usesSway = compiled(mat).shader.vertexShader.includes('aSway') } catch { usesSway = false }
    if (!usesSway) continue
    swayers.push(m.geometry.uuid)
    ok(!!m.geometry.getAttribute('aSway'),
      `a mesh whose shader reads aSway has no such attribute — it will silently stand still`)
  }
  // ⚠ A POSITIVE CONTROL. If `compiled()` ever stops finding the injection (a three rename, an
  // injection reordered), the loop above runs zero times and passes vacuously — the exact shape of
  // green-with-no-subject this file keeps catching elsewhere.
  ok(swayers.length > 0, 'no mesh compiled a sway program at all — this guard had no subject')
}

// ── 2b-ii. ★ A PICKED BUSH GETS NO BERRY HULL (2026-09-22, the picking pass) ─────────────────
// A bush whose fruit has been taken still draws its body and draws NO fruit (`picking.ts`), so a
// hull around berries that are not there is a border floating in mid-air. The failure this catches
// is the quiet one: the body hull still lights, so the reticle looks like it works.
{
  for (const [name, fmat] of [['sunfruit', MAT.SUNFRUIT_BUSH], ['moonberry', MAT.MOONBERRY_BUSH]] as [string, number][]) {
    r.clearHighlight()
    r.setHighlight(FLORA.FRUIT, 5, 40, 7, 0.42, true, fmat, false)
    const lit = meshes().filter(m => m.count > 0)
    ok(lit.length === 1, `${name} picked bare: ${lit.length} hulls lit, expected exactly 1 (the body, no fruit)`)
    const berryVerts = floraFruitBerriesGeo(fmat).getAttribute('position').count
    ok(lit.every(m => m.geometry.getAttribute('position').count !== berryVerts),
      `${name} picked bare: the BERRY hull is lit around fruit that is not drawn`)
    // And with fruit it is still two — or this assert would pass by lighting nothing at all.
    r.clearHighlight()
    r.setHighlight(FLORA.FRUIT, 5, 40, 7, 0.42, true, fmat, true)
    ok(meshes().filter(m => m.count > 0).length === 2, `${name} fruited: expected 2 hulls`)
  }
  r.clearHighlight()
}

// ── 2d. ★ A CARD BENDS FROM ITS ROOT; A PAD DOES NOT BEND AT ALL ──────────────────────────────
// The values, not just the presence. A cross must run 0 at the base to 1 at the tip (or the wind
// stops being weighted by height), and every flat part must be all-zero (or the pad shears and
// sinks again). Read off the SHIPPED builders through `FLORA_PARTS`, never restated.
{
  for (const [kind, parts] of Object.entries(FLORA_PARTS)) {
    parts.forEach((p, i) => {
      const g = partGeometry(p)
      const a = g.getAttribute('aSway')
      ok(!!a, `FLORA_PARTS[${kind}][${i}] builds a geometry with no aSway`)
      if (!a) { g.dispose(); return }
      const arr = Array.from(a.array as Float32Array)
      const lo = Math.min(...arr), hi = Math.max(...arr)
      if (p.flat || p.wake) {
        ok(lo === 0 && hi === 0,
          `FLORA_PARTS[${kind}][${i}] is flat but its aSway runs ${lo}..${hi} — a pad that bends is the sink bug`)
      } else {
        ok(lo === 0 && hi === 1,
          `FLORA_PARTS[${kind}][${i}] is a card but its aSway runs ${lo}..${hi} — expected 0 at the root, 1 at the tip`)
      }
      g.dispose()
    })
  }
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
    // ⚠ `aSway`, NOT `uv.y`, SINCE 2026-09-22 — the weight became an explicit attribute when the
    // pads turned out to be shearing and sinking (see §2c/§2d). This needle is the reason the
    // rename could not quietly half-land: it red-flagged every card the moment the shader changed.
    const needle = 'aSway * ' + amp.toFixed(3)
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
