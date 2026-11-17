'use client'
// ── THE KEEPER'S HANDS IN THE OPEN WORLD: two gloves at the bottom of the frame (Alex 11-17) ──────────────────────────────
// v1 (1e132daa) mounted the voxel rig, which jittered on a run for two reasons: it moved in its OWN useFrame, mounted ahead
// of the walker, so every frame it copied the camera's pose from the frame before (a one-frame lag that reads as shake at
// 6.5 m/s); and it measured speed and airborne off the camera's travel. This mount fixes both:
//   · the page calls `api.current.step(...)` from the walker's onTick, AFTER the walker placed the camera, so the gloves
//     are posed against this frame's camera, never last frame's;
//   · the pose (fp-hands-pose.ts) reads the walker's own speed and airborne flag, and every output is eased.
// The look is Alex's ask: both hands just barely showing, alternating as you run; a jump throws both up, the right higher.
//
// Placeholder craft, the Keeper Body Bench's parts (keeper-doll.tsx): the right is the glove with one dim seat (it lights
// on a cast), the left wrist wears the bracelet, cord-whipped cuffs, no metal, no skin.
//
// ── DRAWN OVER THE WORLD (the voxel rig's trick, voxel3d/hands.ts) ──
// Every hand part is in the TRANSPARENT list (transparent, opacity 1) at renderOrder ORDER, and an invisible sentinel at
// ORDER - 1 clears the depth buffer in onBeforeRender: three draws the transparent list last, sorted by renderOrder, so the
// clear lands after the whole world and before the hands, which then depth-test only against each other.
import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { newFpState, stepFpHands, type FpInput, type HandPose } from './fp-hands-pose'

const ORDER = 1000
const C = { glove: '#6e4a2c', cuff: '#b9a582', cord: '#7a5a35', seat: '#7fb6d9', bracelet: '#8a6a3c' }

export interface OpenHandsApi { step: (i: FpInput, dt: number) => void; seat: (lit: number) => void }

function buildHand(side: 1 | -1, seatMat: THREE.MeshStandardMaterial | null): THREE.Group {
  const g = new THREE.Group()
  const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity: 1 })
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], r: [number, number, number] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(...p); mesh.rotation.set(...r); mesh.renderOrder = ORDER; mesh.frustumCulled = false; g.add(mesh)
  }
  // a fist seen from behind, knuckles up: the mitt, the thumb across, the cuff and its cord below
  part(new THREE.BoxGeometry(0.1, 0.115, 0.075), mat(C.glove), [0, 0, 0])
  part(new THREE.CapsuleGeometry(0.019, 0.045, 3, 8), mat(C.glove), [side * -0.045, -0.01, -0.03], [0, 0, side * 1.2])
  part(new THREE.CylinderGeometry(0.06, 0.056, 0.08, 12), mat(C.cuff), [0, -0.095, 0.005])
  part(new THREE.TorusGeometry(0.06, 0.008, 6, 16), mat(C.cord), [0, -0.075, 0.005], [Math.PI / 2, 0, 0])
  if (seatMat) part(new THREE.IcosahedronGeometry(0.02, 0), seatMat, [0, 0.012, 0.04])                     // the glove's seat, facing you
  else part(new THREE.TorusGeometry(0.063, 0.013, 6, 18), mat(C.bracelet), [0, -0.05, 0.005], [Math.PI / 2, 0, 0])   // the bracelet
  g.scale.setScalar(1.0)
  return g
}

export const OpenHands = forwardRef<OpenHandsApi>(function OpenHands(_, ref) {
  const { camera } = useThree()
  const seatMat = useMemo(() => new THREE.MeshStandardMaterial({ color: C.seat, emissive: new THREE.Color(C.seat), emissiveIntensity: 0.4, roughness: 0.3, transparent: true, opacity: 1 }), [])
  const rig = useMemo(() => {
    const root = new THREE.Group()
    const R = buildHand(1, seatMat), L = buildHand(-1, null)
    // the sentinel: clears depth after the world, before the hands
    const sentinel = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
    sentinel.renderOrder = ORDER - 1; sentinel.frustumCulled = false; sentinel.position.set(0, 0, -0.3)
    sentinel.onBeforeRender = (renderer) => renderer.clearDepth()
    root.add(sentinel, R, L)
    return { root, R, L }
  }, [seatMat])
  const st = useRef(newFpState())
  const place = (o: THREE.Group, p: HandPose) => { o.position.set(p.x, p.y, p.z); o.rotation.set(p.pitch, 0, p.roll) }
  useImperativeHandle(ref, () => ({
    step: (i, dt) => {
      const { R, L } = stepFpHands(st.current, i, Math.min(dt, 0.1))
      rig.root.position.copy(camera.position); rig.root.quaternion.copy(camera.quaternion)   // this frame's camera
      place(rig.R, R); place(rig.L, L)
    },
    seat: lit => { seatMat.emissiveIntensity = 0.3 + 1.6 * lit },
  }), [camera, rig, seatMat])
  useEffect(() => {
    ;(window as unknown as { __openHands?: unknown }).__openHands = { R: () => ({ ...st.current.R }), L: () => ({ ...st.current.L }), air: () => st.current.air }
    return () => { rig.root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() } }) }
  }, [rig])
  return <primitive object={rig.root} />
})
