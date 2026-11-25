'use client'
// <Blue /> : Gregory's old Dewbear (BETA M166), drawn where Greg sits. The Dewbear body and rig unchanged (the glb, its own
// idle clip through makeRigBody); the COLOUR and the warm seam light are Blue's (blue-look.ts), applied to a copy of the
// geometry, so no other Dewbear changes. Three draw calls (body, its hull, the unlit lines). No talk, no walking: he keeps
// the bench while Greg tours.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { hullPush, makeRigBody, type RigBody } from './spirit-rig-body'
import type { RigLook } from './spirit-rig'
import { GROWN } from '../../sprites/creature-size'
import { BLUE_HULL, BLUE_SKIN, DEWBEAR_URL, SPIRIT_RAMP, blueTint } from './blue-look'

export const BLUE_H = GROWN['water-bear'].height
const RIG: RigLook = { glbLen: 1.58, pivot: { x: 0, z: 0 }, clipV: { walk: 1 / 0.5, run: 2.8 / 0.5 }, runAt: [1, 0.85], hull: 0.024, neck: 'b_neck', head: 'b_head', lie: true, avatar: { z: 0, far: 3 } }
let ramp: THREE.DataTexture | null = null
const rampTex = () => { if (!ramp) { ramp = new THREE.DataTexture(new Uint8Array(SPIRIT_RAMP.flatMap(v => [v, v, v, 255])), 3, 1, THREE.RGBAFormat); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true } return ramp }
const tinted = new WeakMap<THREE.Object3D, THREE.Object3D>()
/** the Dewbear's scene, copied, in Blue's tones (once a glb) */
function blueScene(src: THREE.Object3D) {
  let s = tinted.get(src); if (s) return s
  s = clone(src)
  for (const part of ['body', 'eyes'] as const) { const m = s.getObjectByName(part) as THREE.Mesh | undefined; if (!m) continue
    m.geometry = m.geometry.clone(); const a = m.geometry.getAttribute('color').clone(); blueTint(part, a as THREE.BufferAttribute); m.geometry.setAttribute('color', a) }
  tinted.set(src, s); return s
}
function BlueBody({ clip = 'idle' }: { clip?: 'idle' | 'lie' | 'sit' }) {
  const gltf = useGLTF(DEWBEAR_URL)
  const body = useRef<RigBody | null>(null), g = useRef<THREE.Group>(null)
  const scene = useMemo(() => blueScene(gltf.scene), [gltf])
  useEffect(() => {
    const skin = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: rampTex(), emissive: BLUE_SKIN.emissive, emissiveIntensity: BLUE_SKIN.emissiveI })
    const halo = new THREE.MeshBasicMaterial({ color: BLUE_HULL.color, transparent: true, opacity: BLUE_HULL.opacity, side: THREE.BackSide, depthWrite: false, toneMapped: false })
    const eye = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    hullPush(halo, RIG.hull)
    const b = makeRigBody({ scene, animations: gltf.animations }, RIG, { skin, glow: null, halo, eye })
    body.current = b; g.current?.add(b.root)
    return () => { body.current = null; b.dispose(); for (const m of [skin, halo, eye]) m.dispose() }
  }, [scene, gltf])
  useFrame((_, dt) => body.current?.step(Math.min(0.05, dt), clip, 0, BLUE_H, { look: 0, sniff: 0, tilt: 0 }))
  return <group ref={g} scale={BLUE_H} userData={{ blue: true }} />
}
/** Blue; nothing is drawn (and nothing else waits) while his glb loads */
export function Blue(p: { clip?: 'idle' | 'lie' | 'sit' }) { return <Suspense fallback={null}><BlueBody {...p} /></Suspense> }
