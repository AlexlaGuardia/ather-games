// M116 face sets. Run: npx tsx src/app/shimmer/open/shared/keeper-faces.test.ts
import * as THREE from 'three'
import { FACE_SETS, UNIVERSAL_HEAD, BOOST_MAX, BOOST_NEAR, BOOST_FAR, boostAt, faceSet } from './keeper-faces'
import { buildKeeper } from './keeper-figure'
import { OPT, DEFAULT_LOOK, PACK_KEYS, ROWS, packLook, unpackLook, parseLook, type Look } from './keeper-look'
import { proportionsFor } from './keeper-proportions'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const meshes = (g: THREE.Object3D) => { let n = 0; g.traverse(o => { if ((o as THREE.Mesh).isMesh) n++ }); return n }

// the option row
ok(OPT.face.length === 5 && OPT.face[0] === 'Classic' && FACE_SETS.length === 4, 'face: Classic + the sheet\'s four sets (A-D)')
ok(DEFAULT_LOOK.face === 0 && faceSet(0) === null && faceSet(1) === FACE_SETS[0] && faceSet(9) === null, 'face: default / index mapping wrong')
// an OLD keeper (saved before the face row) keeps its face: parses to Classic, and its build is today's build exactly
const { face: _drop, ...oldSave } = { ...DEFAULT_LOOK, eyes: 3, brows: 1 }
const old = parseLook(oldSave)!
ok(old.face === 0, 'old save: did not read as Classic')
const a = buildKeeper(old), b = buildKeeper({ ...old, face: 0 })
ok(meshes(a.group) === meshes(b.group) && a.headY === b.headY && a.height === b.height, 'Classic: build differs')
const pc = proportionsFor(old), headA = a.group.getObjectByName('head')!
ok(headA.scale.x === (pc.headW !== 1 || pc.headH !== 1 ? pc.headW : 1), 'Classic: head size is not the model\'s own dial')
ok(!a.group.getObjectByName('eye-l'), 'Classic: drew a face-set eye')
// a face set: the universal head on all 6 models, two eye groups, Brows None hides only the brows
for (const frame of [0, 1, 2]) for (const torso of [0, 1]) for (let face = 1; face <= 4; face++) {
  const k = buildKeeper({ ...DEFAULT_LOOK, frame, torso, face } as Look), h = k.group.getObjectByName('head')!
  ok(Math.abs(h.scale.x - UNIVERSAL_HEAD.headW) < 1e-9 && Math.abs(h.scale.y - UNIVERSAL_HEAD.headH) < 1e-9, `universal head: model ${frame}/${torso} face ${face}`)
  ok(!!k.group.getObjectByName('eye-l') && !!k.group.getObjectByName('eye-r'), `face ${face}: eyes missing`)
}
const withB = buildKeeper({ ...DEFAULT_LOOK, face: 2 }), noB = buildKeeper({ ...DEFAULT_LOOK, face: 2, brows: 2 })
ok(meshes(withB.group.getObjectByName('eye-l')!) - meshes(noB.group.getObjectByName('eye-l')!) === 2, 'brows None: did not drop exactly the brow + its ink')
// the game-distance boost: 1x close, BOOST_MAX far, monotone between
ok(boostAt(0.5) === 1 && boostAt(BOOST_NEAR) === 1 && boostAt(BOOST_FAR) === BOOST_MAX && boostAt(40) === BOOST_MAX, 'boost: ends wrong')
let mono = true; for (let d = BOOST_NEAR; d < BOOST_FAR; d += 0.25) if (boostAt(d + 0.25) < boostAt(d)) mono = false
ok(mono && boostAt(5) > 1.2, 'boost: not rising, or too weak at 5 m (the vanishing distance)')
// ... and the eye white's hook applies it: a far camera scales the eye group, a near one puts it back
const k = buildKeeper({ ...DEFAULT_LOOK, face: 1 }); k.group.updateMatrixWorld(true)
const eye = k.group.getObjectByName('eye-l')!, white = eye.children[0] as THREE.Mesh
const cam = new THREE.PerspectiveCamera(); cam.position.set(0, 1.4, 6); cam.updateMatrixWorld(true)
white.onBeforeRender(null as never, null as never, cam, null as never, null as never, null as never)
const far = eye.scale.x
cam.position.set(0, 1.4, 1.2); cam.updateMatrixWorld(true)
white.onBeforeRender(null as never, null as never, cam, null as never, null as never, null as never)
ok(far > 1.3 && eye.scale.x === 1, `boost hook: far ${far.toFixed(2)}, near ${eye.scale.x}`)
// presence pack: frozen order, the face rides at the end, a pack one row short (an older client) still reads
ok(PACK_KEYS.length === ROWS.length && new Set(PACK_KEYS).size === ROWS.length && ROWS.every(r => PACK_KEYS.includes(r.key)), 'pack: keys and rows disagree')
ok(PACK_KEYS[PACK_KEYS.length - 1] === 'face', 'pack: face must be appended last')
const lk = { ...DEFAULT_LOOK, face: 3, eyes: 4 }
ok(JSON.stringify(unpackLook(packLook(lk))) === JSON.stringify(lk), 'pack: face lost in the round trip')
const short = unpackLook(packLook(lk).slice(0, -1))
ok(!!short && short.face === 0 && short.eyes === 4, 'pack: an older client\'s pack (no face) did not read')
ok(unpackLook(packLook(lk) + '0') === null, 'pack: an over-long pack read')

console.log(`keeper-faces: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
