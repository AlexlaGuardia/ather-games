'use client'
// <YoungDewbears /> : Greg's seven young Dewbears (BETA M182; the pure half is glade-dewbears.ts). One copy of the Dewbear glb
// re-toned to a neutral ramp ONCE, its geometry shared by all seven (spirit-rig-body's per-scene cache), one skeleton + mixer
// each (SkeletonUtils clone inside makeRigBody), the tint = each one's own material colour (7 skin materials, one shader
// program), one shared hull and one shared eye material. FRAME COST: 3 draw calls a bear near (body, hull, lines), 2 past
// HULL_FAR, 0 past DRAW_FAR; the mixer does not run off screen or past ANIM_FAR, and runs at half rate past ANIM_HALF.
// `?dewbears=0` leaves them out (the with / without frame measure).
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { hullPush, makeRigBody, type RigBody } from './spirit-rig-body'
import type { RigLook } from './spirit-rig'
import { DEWBEAR_URL, SPIRIT_RAMP, BLUE_AT, BLUE_COLOR } from './blue-look'
import { BLUE_H } from './glade-blue'
import { fromShore } from './moonwell'
import { gladeHome, HOME_R } from './glade-home'
import { YOUNG_N, YOUNG_SCALE, YOUNG_TINTS, clipOf, lod, seeded, stepYoung, toWorld, youngStart, youngTone, type Frame, type Young } from './glade-dewbears'

export const YOUNG_H = BLUE_H * YOUNG_SCALE
const RIG: RigLook = { glbLen: 1.58, pivot: { x: 0, z: 0 }, clipV: { walk: 1 / 0.5, run: 2.8 / 0.5 }, runAt: [1, 0.85], hull: 0.024, neck: 'b_neck', head: 'b_head', lie: true, avatar: { z: 0, far: 3 } }
export const dewbearsOn = () => typeof window === 'undefined' || new URLSearchParams(window.location.search).get('dewbears') !== '0'

let ramp: THREE.DataTexture | null = null
const rampTex = () => { if (!ramp) { ramp = new THREE.DataTexture(new Uint8Array(SPIRIT_RAMP.flatMap(v => [v, v, v, 255])), 3, 1, THREE.RGBAFormat); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true } return ramp }
const neutral = new WeakMap<THREE.Object3D, THREE.Object3D>()
/** the Dewbear's scene, copied once, its plates a neutral ramp (so the material colour is the bear's colour) */
function youngScene(src: THREE.Object3D) {
  let s = neutral.get(src); if (s) return s
  s = clone(src)
  const m = s.getObjectByName('body') as THREE.Mesh | undefined
  if (m) { m.geometry = m.geometry.clone(); const a = m.geometry.getAttribute('color').clone() as THREE.BufferAttribute
    for (let i = 0; i < a.count; i++) { const [r, g, b] = youngTone(a.getX(i), a.getY(i), a.getZ(i)); a.setXYZ(i, r, g, b) }
    m.geometry.setAttribute('color', a) }
  neutral.set(src, s); return s
}

type Props = { bench: Frame; loaded: (x: number, z: number) => number | null; keeper?: MutableRefObject<{ x: number; z: number }> }
function Bears({ bench, loaded, keeper }: Props) {
  const gltf = useGLTF(DEWBEAR_URL)
  const scene = useMemo(() => youngScene(gltf.scene), [gltf])
  const { camera, gl, scene: world } = useThree()
  const root = useRef<THREE.Group>(null)
  const st = useRef<{ bodies: RigBody[]; holders: THREE.Group[]; tumblers: THREE.Group[]; skins: THREE.MeshToonMaterial[]; ys: number[]; tick: number; stats: { drawn: number; animated: number; hull: number; ms: number } } | null>(null)
  const ok = useMemo(() => {
    const h = gladeHome(), c = Math.cos(bench.yaw), s = Math.sin(bench.yaw), blue = toWorld(bench, BLUE_AT.x, BLUE_AT.z)
    return (x: number, z: number) => {
      if (fromShore(x, z) < 1.2) return false
      if (Math.hypot(x - h.x, z - h.z) < HOME_R + 0.5) return false
      if (Math.hypot(x - blue.x, z - blue.z) < 0.6) return false
      const dx = x - bench.x, dz = z - bench.z, lx = dx * c - dz * s, lz = dx * s + dz * c   // into the bench frame
      return !(Math.abs(lx) < 0.95 && lz > -0.4 && lz < 0.55)
    }
  }, [bench.x, bench.z, bench.yaw])
  const bears = useRef<Young[]>([])
  const rnd = useRef(seeded(1823))
  useEffect(() => { bears.current = youngStart(bench, ok) }, [bench.x, bench.z, bench.yaw, ok])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const halo = new THREE.MeshBasicMaterial({ color: '#f6fff8', transparent: true, opacity: 0.3, side: THREE.BackSide, depthWrite: false, toneMapped: false })
    const eye = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    hullPush(halo, RIG.hull)
    const skins = YOUNG_TINTS.slice(0, YOUNG_N).map(t => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: rampTex(), color: t, emissive: t, emissiveIntensity: 0.08 }))
    const bodies: RigBody[] = [], holders: THREE.Group[] = [], tumblers: THREE.Group[] = []
    skins.forEach((skin, i) => {
      const b = makeRigBody({ scene, animations: gltf.animations }, RIG, { skin, glow: null, halo, eye })
      const holder = new THREE.Group(), tum = new THREE.Group(), inner = new THREE.Group()
      holder.scale.setScalar(YOUNG_H); tum.position.y = 0.45; inner.position.y = -0.45   // the tumble turns about her middle
      inner.add(b.root); tum.add(inner); holder.add(tum); holder.userData = { youngDewbear: i }
      root.current?.add(holder); bodies.push(b); holders.push(holder); tumblers.push(tum)
    })
    st.current = { bodies, holders, tumblers, skins, ys: bodies.map(() => 0), tick: 0, stats: { drawn: 0, animated: 0, hull: 0, ms: 0 } }
    return () => { st.current = null; for (const b of bodies) b.dispose(); for (const h of holders) h.removeFromParent(); for (const m of [...skins, halo, eye]) m.dispose() }
  }, [scene, gltf])

  const frustum = useMemo(() => new THREE.Frustum(), []), pm = useMemo(() => new THREE.Matrix4(), []), sph = useMemo(() => new THREE.Sphere(new THREE.Vector3(), 0.6), [])
  useFrame((_, dtRaw) => {
    const s = st.current; if (!s || !bears.current.length) return
    const t0 = performance.now(), dt = Math.min(0.05, dtRaw), k = keeper?.current ?? null
    // their walking keeps real time on a slow frame (up to 0.5 s, in 0.05 s steps); the clips stay capped at 0.05
    const logic = Math.min(0.5, dtRaw), n = Math.max(1, Math.ceil(logic / 0.05))
    const moved = new Array<number>(bears.current.length).fill(0)
    for (let j = 0; j < n; j++) bears.current.forEach((b, i) => { stepYoung(b, logic / n, { keeper: k, rnd: rnd.current, ok, bench, others: bears.current }); moved[i] += b.moved })
    s.tick++
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm)
    let drawn = 0, animated = 0, hull = 0
    bears.current.forEach((b, i) => {
      const gy = loaded(b.x, b.z); if (gy !== null) s.ys[i] = gy
      const h = s.holders[i], body = s.bodies[i]
      h.position.set(b.x, s.ys[i], b.z); h.rotation.y = b.yaw; s.tumblers[i].rotation.x = b.mode === 'tumble' ? b.roll : 0
      sph.center.set(b.x, s.ys[i] + 0.15, b.z)
      const L = lod(camera.position.distanceTo(sph.center), frustum.intersectsSphere(sph))
      h.visible = L.draw; if (body.meshes.bodyHull) body.meshes.bodyHull.visible = L.hull
      if (L.draw) drawn++; if (L.hull) hull++
      if (L.anim === 1 || (L.anim === 2 && (s.tick + i) % 2 === 0)) { body.step(L.anim === 2 ? dt * 2 : dt, clipOf(b), Math.min(moved[i], (dt / logic) * moved[i] * (L.anim === 2 ? 2 : 1)), YOUNG_H, { look: 0, sniff: 0, tilt: 0 }); animated++ }
    })
    s.stats = { drawn, animated, hull, ms: s.stats.ms * 0.9 + (performance.now() - t0) * 0.1 }   // this loop's own cost per frame (EMA)
  })

  useEffect(() => {   // checks' hook: READ the seven (and Blue's numbers) as drawn
    const W = window as unknown as { __dewbears?: unknown }
    W.__dewbears = {
      young: () => bears.current.map((b, i) => { const s = st.current; return { x: b.x, z: b.z, mode: b.mode, clip: clipOf(b), h: s ? s.holders[i].scale.x : 0, tint: s ? '#' + s.skins[i].color.getHexString(THREE.SRGBColorSpace) : null } }),
      stats: () => ({ ...(st.current?.stats ?? { drawn: 0, animated: 0, hull: 0, ms: 0 }) }),
      blue: () => { let o: THREE.Object3D | null = null; world.traverse(x => { if (!o && x.userData?.blue) o = x }); const g = o as THREE.Object3D | null; return { drawn: !!g, h: g ? g.scale.x : 0, deep: BLUE_COLOR.deep } },
      calls: () => gl.info.render.calls,
    }
    return () => { delete W.__dewbears }
  }, [gl, world])
  return <group ref={root} />
}
/** the seven; nothing is drawn (and nothing else waits) while the glb loads */
export function YoungDewbears(p: Props) { return dewbearsOn() ? <Suspense fallback={null}><Bears {...p} /></Suspense> : null }
