'use client'
// M44 FIRST-VISIT WARM-UP: the shader programs that compiled AFTER the fade lifted on a first Wilds/Glade visit (logged on devwin
// 11-20 with ProgramKeeper's __programOwners probe) belong to things that mount LATER than the zone: the Hollow layer (node mounds
// = flat Phong; a Hollow's goop = INSTANCED Standard, first without its envMap, then with the borrowed-ground env, whose PMREM
// conversion compiles two more programs) instanced Phong and instanced TEXTURED Lambert (settlement house parts, prod 11-20). These proxies stand in for them from the zone's first frame, so
// arrive()'s compile behind the veil builds those programs; ProgramKeeper pins them for the life of the page. One instance each,
// far under the ground; gone after a few seconds. A program's key depends only on the material TYPE + its flags (flatShading,
// instancing, envMap, map...) and the scene's lights/fog, never on colours, so plain look-alikes match the real ones.
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { makeWalker } from './walker-body'
import { goopMaterial, groundEnv, wetEnv, borrowedGround } from './hollow-goop'

const UNDER = -400
const one = (mat: THREE.Material, geo: THREE.BufferGeometry) => {
  const m = new THREE.InstancedMesh(geo, mat, 1); m.setMatrixAt(0, new THREE.Matrix4()); m.frustumCulled = false; return m
}

export function WarmProxies({ ms = 4000 }: { ms?: number }) {
  const [on, setOn] = useState(true)
  useEffect(() => { const t = setTimeout(() => setOn(false), ms); return () => clearTimeout(t) }, [ms])
  const objs = useMemo(() => {
    const geo = new THREE.OctahedronGeometry(0.1, 0)
    const goopSkin = goopMaterial(); goopSkin.envMap = wetEnv(borrowedGround('#9cc46a', 0))   // M163: a Walker is SKINNED, its env set before its first draw
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); tex.needsUpdate = true
    const goopEnv = goopMaterial(); goopEnv.envMap = groundEnv(borrowedGround('#9cc46a', 0))   // the env a Hollow borrows on grass
    return [
      new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ flatShading: true })),   // node mound / champion
      one(new THREE.MeshPhongMaterial({ flatShading: true }), geo),           // instanced Phong
      one(new THREE.MeshPhongMaterial(), geo),
      one(goopMaterial(), geo),                                               // a Hollow's goop before its env lands
      one(goopEnv, geo),                                                      // ... and with it (+ the PMREM programs)
      makeWalker(goopSkin).mesh,
      one(new THREE.MeshLambertMaterial({ map: tex }), geo),                  // instanced textured parts (settlement houses, 128 px maps) streaming in with tiles
    ]
  }, [])
  // material.dispose() never frees its textures, so the borrowed env stays in groundEnv's cache; the programs stay pinned (ProgramKeeper)
  useEffect(() => () => { for (const o of objs) { const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial; if (m.type === 'MeshLambertMaterial') m.map?.dispose(); m.dispose(); if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose() } (objs[0] as THREE.Mesh).geometry.dispose() }, [objs])
  // __noWarm: the A/B leg (scripts/arrival-programs-check.mts --nowarm) that leaves the proxies out, so the check proves they matter
  if (!on || (typeof window !== 'undefined' && (window as unknown as { __noWarm?: boolean }).__noWarm)) return null
  return <group position-y={UNDER}>{objs.map((o, k) => <primitive key={k} object={o} />)}</group>
}
