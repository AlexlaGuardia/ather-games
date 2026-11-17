// third-person.tsx: the doll's pose from the walker's real state, and the camera pulled back but never under the ground.
import * as THREE from 'three'
import { dollAction, pullBack, THIRD } from './third-person'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const B = { speed: 0, airborne: false, working: false, castAgoMs: Infinity, gun: false }
ok(dollAction(B).action === 'idle', 'standing still: idle')
ok(dollAction({ ...B, speed: 4.2 }).action === 'walk' && Math.abs(dollAction({ ...B, speed: 4.2 }).rate - 1) < 1e-9, 'a walk at walking pace, rate 1')
ok(dollAction({ ...B, speed: 6.5 }).action === 'run', 'a run past RUN_AT')
ok(dollAction({ ...B, speed: 6.5, airborne: true, working: true, castAgoMs: 10 }).action === 'jump', 'the air outranks everything')
ok(dollAction({ ...B, speed: 6.5, working: true }).action === 'swing', 'a worked node outranks the feet')
ok(dollAction({ ...B, castAgoMs: 100 }).action === 'cast' && dollAction({ ...B, castAgoMs: THIRD.CAST_MS + 1 }).action === 'idle', 'a cast holds for its window, then lets go')
ok(dollAction({ ...B, gun: true }).action === 'aim' && dollAction({ ...B, gun: true, speed: 5 }).action === 'walk', 'the gun aims standing, the legs win moving')
// the lens: behind and above; on a hill behind the keeper it rides over the ground, never inside it
const cam = new THREE.PerspectiveCamera(); cam.position.set(0, 1.6, 0); cam.rotation.set(0, 0, 0)
pullBack(cam, () => 0, 0)
ok(Math.abs(cam.position.z - THIRD.BACK) < 1e-6 && Math.abs(cam.position.y - (1.6 + THIRD.UP)) < 1e-6, `behind (+z, the lens looks down -z) and above (${cam.position.toArray().map(v => v.toFixed(2))})`)
const cam2 = new THREE.PerspectiveCamera(); cam2.position.set(0, 1.6, 0)
pullBack(cam2, (x, z) => (z > 1 ? 5 : 0), 0)
ok(cam2.position.y >= 5 + THIRD.CLEAR - 1e-9, `a hill behind: the lens rides over it (y ${cam2.position.y.toFixed(2)})`)
console.log(`third-person: ${pass} passed, ${fail} failed`); if (fail) process.exit(1)
