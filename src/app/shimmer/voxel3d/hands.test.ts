// The hands' rig: it draws over the world by the transparent-list trick, it is metal-free, the focus
// in the fist is the one the signal names, and a teleport is not a sprint.
import * as THREE from 'three'
import { createHands, HANDS_ORDER } from './hands'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const h = createHands()
const meshes: THREE.Mesh[] = []
h.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o) })
const sentinel = meshes.find(m => m.renderOrder === HANDS_ORDER - 1)
ok(!!sentinel && typeof sentinel.onBeforeRender === 'function' && sentinel.onBeforeRender !== THREE.Mesh.prototype.onBeforeRender, '★ one depth sentinel, drawn just before the hand, with an onBeforeRender')
ok(!!sentinel && (sentinel.material as THREE.Material).transparent && (sentinel.material as THREE.Material).opacity === 0, '★★ the sentinel is in the TRANSPARENT list and invisible — an opaque one would wipe depth under the world\'s own transparents')
const parts = meshes.filter(m => m !== sentinel)
ok(parts.length >= 16, `a rig of ${parts.length} parts`)   // a stick glove, no fingers (Alex 09-16)
ok(parts.every(m => m.renderOrder === HANDS_ORDER), 'every part draws at HANDS_ORDER, after the sentinel')
ok(parts.every(m => (m.material as THREE.Material).transparent), 'every part is in the transparent list (so the clear lands before it and after the world)')
ok(parts.every(m => m.material instanceof THREE.MeshLambertMaterial), 'no metal: every material is Lambert (no metalness slider to reach for)')
ok(parts.every(m => m.frustumCulled === false), 'nothing culls — a camera-space rig has no world-space bounds worth trusting')

// the focus follows the signal
const cam = new THREE.PerspectiveCamera()
cam.position.set(10, 130, -5)
cam.rotation.set(0.1, 0.4, 0)
cam.updateMatrixWorld()
// a focus is a group of 2+ meshes under the arm; the left wrist is the only other such group and it is invisible at rest
const visibleTools = () => { let n = 0; h.group.traverseVisible(o => { if (o instanceof THREE.Group && o.children.length >= 2 && o !== h.group && o.children.every(c => c instanceof THREE.Mesh)) n++ }); return n }
h.tick(cam, 0, 1 / 60)
ok(h.group.position.equals(cam.position) && h.group.quaternion.equals(cam.quaternion), 'the rig copies the camera pose')
ok(visibleTools() === 0, 'family null: an empty glove')
h.sig.family = 'forestry'; h.tick(cam, 1 / 60, 1 / 60)
ok(visibleTools() === 1, 'family forestry: exactly one focus in the fist')
h.sig.family = 'prospecting'; h.tick(cam, 2 / 60, 1 / 60)
ok(visibleTools() === 1, 'family prospecting: still exactly one')
h.sig.family = null; h.tick(cam, 3 / 60, 1 / 60)
ok(visibleTools() === 0, 'family null again: bare')

// a teleport is not a sprint
const s = (h as unknown as { sig: { last?: { dy: number } } }).sig
cam.position.set(10, 130, -5); h.tick(cam, 4 / 60, 1 / 60)
cam.position.set(10.1, 130, -5); h.tick(cam, 5 / 60, 1 / 60)   // 6 blocks/s: a run
const running = s.last!.dy
cam.position.set(300, 130, 400); h.tick(cam, 6 / 60, 1 / 60)   // a /tp: 498 blocks in one frame
// Read THIS tick, not the next: the frame after stands still and reads clean whether or not the
// guard exists. Without the guard the stride jumps ~199 cycles and this frame is a full footfall.
ok(Math.abs(s.last!.dy) <= 0.005, `on the teleport frame the hand does not footfall as if at a sprint (dy ${s.last!.dy.toFixed(4)}; a run dips to ${running.toFixed(4)})`)

h.dispose()
ok(true, 'dispose runs')
console.log(`hands: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
