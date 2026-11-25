// BETA M132 s2: one rigged spirit's BODY: her own bones, ONE skeleton shared by every part (the loader makes one per mesh),
// her own mixer, the glb's geometry shared by all her kind. No trot here: step() is told what to play.
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { flapCycles } from './spirit-fly'   // M173
import { RIG_CLIPS, STAND, fadeWeights, gaitCycles, strideLen, type RigClip, type RigLook } from './spirit-rig'

export type RigMats = { skin: THREE.Material; glow: THREE.Material | null; halo: THREE.Material; eye: THREE.Material }
export type RigGltf = { scene: THREE.Object3D; animations: THREE.AnimationClip[] }
/** everything the game must be able to count to 0 again */
export const rigCount = { live: 0, made: 0, disposed: 0 }

// the geometry once per glb: colours read as sRGB (as the unrigged model's `lin`), and a welded normal for the hull, so the
// hull does not crack where the sculpt splits a vertex
type Geos = Record<string, THREE.BufferGeometry>
const cache = new WeakMap<THREE.Object3D, { geos: Geos; ext: { part: string; i: number }[]; low: number[] }>()
function prepare(scene: THREE.Object3D, glowPart?: string) {
  const had = cache.get(scene); if (had) return had
  const geos: Geos = {}, ext: { part: string; i: number; p: number[] }[] = []
  for (const part of ['body', 'eyes', ...(glowPart ? [glowPart] : [])]) {
    const m = scene.getObjectByName(part) as THREE.SkinnedMesh | undefined; if (!m) continue
    const g = m.geometry.clone(), a = g.getAttribute('color'), n = g.getAttribute('normal'), pos = g.getAttribute('position')
    if (a && part !== 'eyes') {
      const out = new Float32Array(a.count * 3), c = new THREE.Color()
      for (let i = 0; i < a.count; i++) { c.setRGB(a.getX(i), a.getY(i), a.getZ(i), THREE.SRGBColorSpace); out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b }
      g.setAttribute('color', new THREE.BufferAttribute(out, 3))
    }
    if (n) {
      const sum = new Map<string, THREE.Vector3>(), key = (i: number) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`
      for (let i = 0; i < n.count; i++) { const k = key(i), s = sum.get(k) ?? new THREE.Vector3(); s.x += n.getX(i); s.y += n.getY(i); s.z += n.getZ(i); sum.set(k, s) }
      for (const s of sum.values()) s.normalize()
      const out = new Float32Array(n.count * 3)
      for (let i = 0; i < n.count; i++) sum.get(key(i))!.toArray(out, i * 3)
      g.setAttribute('hullN', new THREE.BufferAttribute(out, 3))
    }
    for (let i = 0; i < pos.count; i++) ext.push({ part, i, p: [pos.getX(i), pos.getY(i), pos.getZ(i)] })
    geos[part] = g
  }
  // the few dozen vertices her measured box hangs on (nose, frill tops, tail tip, soles), so the probe need not skin 4k points
  const pick = new Map<string, { part: string; i: number }>()
  for (const k of [0, 1, 2]) for (const s of [1, -1]) [...ext].sort((a, b) => s * (b.p[k] - a.p[k])).slice(0, 30).forEach(e => pick.set(`${e.part}${e.i}`, { part: e.part, i: e.i }))
  // what can reach the ground while two clips are blended: each bone's own outermost body vertices (not the head or the ears)
  const bm = scene.getObjectByName('body') as THREE.SkinnedMesh, bg = geos.body, si = bg.getAttribute('skinIndex'), sw = bg.getAttribute('skinWeight'), bp = bg.getAttribute('position')
  const own: number[][] = bm.skeleton.bones.map(() => [])
  for (let i = 0; i < bp.count; i++) { let k = 0; for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, k)) k = j; own[si.getComponent(i, k)].push(i) }
  const low = new Set<number>()
  own.forEach((vs, b) => { if (!vs.length || /head|ear/.test(bm.skeleton.bones[b].name)) return
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) { let best = vs[0], bd = -Infinity
      for (const i of vs) { const d = x * bp.getX(i) + y * bp.getY(i) + z * bp.getZ(i); if (d > bd) { bd = d; best = i } } low.add(best) } })
  const out = { geos, ext: [...pick.values()], low: [...low] }
  cache.set(scene, out); return out
}

/** the hull's shader line: out along the welded normal, before skinning (a mesh scale is cancelled on a skinned mesh) */
export function hullPush(m: THREE.Material, width: number) {
  m.onBeforeCompile = sh => { sh.vertexShader = 'attribute vec3 hullN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += hullN * ${width.toFixed(4)};`) }
  m.customProgramCacheKey = () => `rigHull${width.toFixed(4)}`
}

export type RigBody = ReturnType<typeof makeRigBody>
export function makeRigBody(gltf: RigGltf, rig: RigLook, mats: RigMats, glowPart?: string) {
  const { geos, ext, low } = prepare(gltf.scene, glowPart)
  const src = clone(gltf.scene), b0 = src.getObjectByName('body') as THREE.SkinnedMesh
  const bones = b0.skeleton.bones, skeleton = new THREE.Skeleton(bones, b0.skeleton.boneInverses.map(m => m.clone()))
  const root = new THREE.Group(), boneRoot = bones.find(b => !bones.includes(b.parent as THREE.Bone))!
  root.add(boneRoot)
  const id = new THREE.Matrix4(), ball = new THREE.Sphere(new THREE.Vector3(0, 0.45, -0.4), 1.5), meshes: Record<string, THREE.SkinnedMesh> = {}
  const add = (name: string, part: string, mat: THREE.Material | null) => {
    if (!geos[part] || !mat) return
    const m = new THREE.SkinnedMesh(geos[part], mat); m.name = name; m.bind(skeleton, id)
    m.boundingSphere = ball; m.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -0.05, -1.6), new THREE.Vector3(1, 1.15, 0.8))   // any clip's reach: never culled by the rest pose
    root.add(m); meshes[name] = m
  }
  add('body', 'body', mats.skin); add('bodyHull', 'body', mats.halo)
  if (glowPart) { add(glowPart, glowPart, mats.glow); add(`${glowPart}Hull`, glowPart, mats.halo) }
  add('eyes', 'eyes', mats.eye)
  const mixer = new THREE.AnimationMixer(root), act = {} as Record<RigClip, THREE.AnimationAction>
  const has = RIG_CLIPS.filter(c => gltf.animations.some(x => x.name === c))
  for (const c of has) { const a = mixer.clipAction(gltf.animations.find(x => x.name === c)!); a.play(); a.setEffectiveWeight(c === 'idle' ? 1 : 0); act[c] = a }
  act.walk.timeScale = act.run.timeScale = 0   // their time is set by the ground she covers
  const neck = bones.find(b => b.name === rig.neck)!, head = bones.find(b => b.name === rig.head)!, nq = neck.quaternion.clone(), hq = head.quaternion.clone()
  const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3()
  let w: Record<RigClip, number> = { ...STAND }, phase = 0, want: RigClip = 'idle', rate = 0, capped = false, dead = false, lift = 0
  const inv = new THREE.Matrix4()
  rigCount.live++; rigCount.made++
  return {
    root, skeleton, mixer, meshes, bones,
    /** moved = signed metres her feet cover this frame; look / sniff / tilt turn the neck and head on top of the clip */
    step(dt: number, clip: RigClip, moved: number, h: number, o: { look: number; sniff: number; tilt: number }) {
      want = clip; w = fadeWeights(w, clip, dt)
      const gait = clip === 'run' || clip === 'walk' ? clip : w.run > w.walk ? 'run' : 'walk'
      const air = clip === 'run' && Math.abs(moved) < 1e-6 ? dt / act.run.getClip().duration : null
      const g = rig.fly && gait === 'run' ? { cycles: flapCycles(rig.fly, Math.abs(moved) / Math.max(dt, 1e-3), rig.clipV.run * h, act.run.getClip().duration, dt), capped: false }   // M173: wings, not feet
        : air !== null ? { cycles: air, capped: false } : gaitCycles(moved, dt, strideLen(rig.clipV[gait], act[gait].getClip().duration, h), rig.cadence)
      phase = ((phase + g.cycles) % 1 + 1) % 1; capped = g.capped; rate = dt > 0 ? g.cycles * act[gait].getClip().duration / dt : 0
      for (const c of has) { const on = w[c] > 0; act[c].enabled = on; act[c].setEffectiveWeight(w[c]) }
      act.walk.time = phase * act.walk.getClip().duration; act.run.time = phase * act.run.getClip().duration
      neck.quaternion.copy(nq); head.quaternion.copy(hq)   // the mixer writes a bone only when its track changed: take last frame's turn off first
      mixer.update(dt)
      nq.copy(neck.quaternion); hq.copy(head.quaternion)
      if (Math.abs(o.look) + Math.abs(o.sniff) + Math.abs(o.tilt) > 1e-3) {
        neck.quaternion.multiply(q.setFromEuler(e.set(0.3 * o.sniff, 0.45 * o.look, 0)))
        head.quaternion.multiply(q.setFromEuler(e.set(0.3 * o.sniff, 0.4 * o.look, 0.38 * o.tilt)))
      }
      // GROUND KEEP: every clip stands on the ground, the in-betweens of two do not (bones turned half way sink a paw up to 5 cm):
      // while two are mixed her lowest point is put back on it. Not measured (0) while one clip plays alone.
      lift = 0
      if (has.filter(c => w[c] > 0).length > 1) {
        root.position.y = 0; root.updateWorldMatrix(true, false); root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert(); let y = 0
        for (const i of low) y = Math.min(y, this.at('body', i, v).applyMatrix4(inv).y)
        lift = -y
      }
      root.position.y = lift
    },
    state: () => ({ clip: want, w: { ...w }, phase, rate, capped, lift }),
    /** her drawn box in root space x h (hull included), squared to her own axes: what the checks measure */
    size(h: number) {
      root.updateMatrixWorld(true); const inv = root.matrixWorld.clone().invert(), lo = new THREE.Vector3(9, 9, 9), hi = new THREE.Vector3(-9, -9, -9)
      for (const { part, i } of ext) { this.at(part, i, v).applyMatrix4(inv); lo.min(v); hi.max(v) }
      return { len: (hi.z - lo.z + 2 * rig.hull) * h, height: (hi.y + rig.hull) * h, low: lo.y * h, z0: lo.z, z1: hi.z }
    },
    /** vertex i of a part in world space, skinned */
    at(part: string, i: number, out: THREE.Vector3) { const m = meshes[part]; out.fromBufferAttribute(m.geometry.getAttribute('position') as THREE.BufferAttribute, i); m.applyBoneTransform(i, out); return out.applyMatrix4(m.matrixWorld) },
    dispose() {
      if (dead) return; dead = true
      mixer.stopAllAction(); mixer.uncacheRoot(root); skeleton.dispose(); root.removeFromParent()
      rigCount.live--; rigCount.disposed++
    },
  }
}
