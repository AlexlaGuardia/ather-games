'use client'
// THE ATHER'S EDGES ARE CLOUD (BETA M24, Alex 11-18: "the world border is a huge cloud pillow but also in the distance the
// horizon gets this cloud border as well"). This is the pass day-night.tsx says clouds were HELD for.
//
// CANON (read-only here): the Ather is a CLOUD-OCEAN (glossary › The cloud-ocean); the Wilds rest on THE SETTLE, its cooled
// crust; a home plot is a cloud-walled FLOATING ISLAND whose edge is a FALL and the fold returns its keeper (geography ›
// THE HOME PLOT IS A FLOATING ISLAND, RULED 08-15; Alex 11-18 kept the fall); the cloud-walls round the rim KINDLE as the
// Core banks (world/ather.md › The sky, looked at). So nothing here is new canon: it draws the cloud that was always there.
// BUILD (Jin): pillow shapes, sizes, the ring's height, the breathing, the colours (off the live fog, so dusk and the night
// kindle tint them for free), and that the Wilds' outer border stays a wall you look OUT over (Alex: walk to the edge).
//
// Three pieces, all cheap on a phone (one draw each):
//   <CloudPillows puffs={...} />  instanced low-poly puffs, breathing in the vertex shader (no per-frame JS loop)
//   <CloudSea y r />              the cloud-ocean's surface: a flat disc that follows the camera, fogged into the horizon
//   <HorizonRing y />             a ring of cloud banks round the camera at ~470 m (inside the 520 m sky dome), never fogged,
//                                 so the far horizon is cloud on every side, the Wilds' and the plot's alike

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SKY } from './sky-palette'

import type { Puff } from './cloud-layout'
export type { Puff } from './cloud-layout'

const CLOUD = new THREE.Color('#fbf8f1'), KINDLE = new THREE.Color(SKY.kindle)
const time = { value: 0 }
/** the cloud's own colour for the hour: cream by day, the canon KINDLE (silver-blue) as the Core banks (world/ather.md:
 *  the cloud-walls at the rim kindle). Read off the live fog's brightness, so it follows the hour with no clock of its own. */
const cloudFor = (glow: THREE.Color, out: THREE.Color) => {
  const L = glow.r * 0.2126 + glow.g * 0.7152 + glow.b * 0.0722
  const night = 1 - Math.min(1, Math.max(0, (L - 0.12) / 0.4))
  return out.copy(CLOUD).lerp(KINDLE, night * 0.85)
}
/** the live fog colour: every cloud is lit by it (a glow), so the clouds sit IN the hour, not on top of it */
const glowOf = (scene: THREE.Scene, out: THREE.Color) => {
  const f = scene.fog as THREE.Fog | null
  return f ? out.copy(f.color) : out.set('#c9dff0')
}

// ── the puffs ────────────────────────────────────────────────────────────────────────────────────────────────
const PUFF_GEO = new THREE.IcosahedronGeometry(1, 1)   // 80 triangles: soft enough lit flat, cheap enough by the hundred
function puffMaterial() {
  const m = new THREE.MeshLambertMaterial({ color: CLOUD, emissive: new THREE.Color('#c9dff0'), emissiveIntensity: 0.6 })   // smooth-shaded: soft, not faceted ice
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = time
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', /* glsl */ `
      #include <begin_vertex>
      // breathe: each puff on its own slow phase (seeded by where it stands), swelling along its normals
      float seed = instanceMatrix[3].x * 0.071 + instanceMatrix[3].z * 0.053;
      transformed += normal * (0.045 * sin(uT * 0.35 + seed) + 0.02 * sin(uT * 0.9 + seed * 3.1 + position.y * 2.0));
    `)
  }
  return m
}

/** `cap` fixes the instance buffer (a layout that changes as you move must not reallocate the mesh each time). */
export function CloudPillows({ puffs, glow = 0.6, label = 'pillows', cap }: { puffs: readonly Puff[]; glow?: number; label?: string; cap?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const mat = useMemo(() => { const m = puffMaterial(); m.emissiveIntensity = glow; return m }, [glow])
  const scene = useThree(s => s.scene)
  const size = cap ?? puffs.length, n = Math.min(puffs.length, size)
  useEffect(() => {
    const im = ref.current; if (!im) return
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
    puffs.slice(0, n).forEach((u, i) => {
      q.setFromAxisAngle(up, (u.x * 0.37 + u.z * 0.11) % (Math.PI * 2))
      m4.compose(p.set(u.x, u.y, u.z), q, s.set(u.s, u.s * (u.sy ?? 0.62), u.s)); im.setMatrixAt(i, m4)
    })
    im.count = n; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere()
    const g = window as unknown as { __clouds?: Record<string, number> }   // probe for cloud-edge-check (reading only)
    g.__clouds = { ...(g.__clouds ?? {}), [label]: n }
  }, [puffs, n, label])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((st) => { time.value = st.clock.elapsedTime; glowOf(scene, mat.emissive) })
  if (!size) return null
  return <instancedMesh ref={ref} args={[PUFF_GEO, mat, size]} frustumCulled={false} />
}

// ── the cloud-ocean's surface ────────────────────────────────────────────────────────────────────────────────
export function CloudSea({ y, r = 900 }: { y: number; r?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const scene = useThree(s => s.scene)
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: CLOUD, emissive: new THREE.Color('#c9dff0'), emissiveIntensity: 0.5 }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ camera }) => {
    const m = ref.current; if (!m) return
    m.position.set(camera.position.x, y, camera.position.z)
    glowOf(scene, mat.emissive)
  })
  return <mesh ref={ref} rotation-x={-Math.PI / 2} material={mat} renderOrder={-0.5}><circleGeometry args={[r, 48]} /></mesh>
}

// ── the horizon ──────────────────────────────────────────────────────────────────────────────────────────────
const RING_R = 470, RING_H = 110
const RING_VERT = /* glsl */ `
  varying vec2 vUv; varying float vA;
  void main() { vUv = uv; vA = atan(position.z, position.x); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const RING_FRAG = /* glsl */ `
  uniform vec3 uGlow; uniform vec3 uCloud; uniform float uT;
  varying vec2 vUv; varying float vA;
  void main() {
    // a lumpy top edge: banks of cloud, never a ruler line (three slow octaves round the ring, drifting)
    float a = vA + uT * 0.004;
    // billows: each lump is the top of a circle (sqrt of a parabola), so the edge is rounded heads, never peaks
    float b1 = fract(a * 4.5 / 6.2832), b2 = fract(a * 11.0 / 6.2832 + 0.37), b3 = fract(a * 23.0 / 6.2832 + 0.71);
    float top = 0.28 + 0.16 * sqrt(max(0.0, 1.0 - pow(b1 * 2.0 - 1.0, 2.0)))
                     + 0.10 * sqrt(max(0.0, 1.0 - pow(b2 * 2.0 - 1.0, 2.0)))
                     + 0.06 * sqrt(max(0.0, 1.0 - pow(b3 * 2.0 - 1.0, 2.0)));
    float y = vUv.y;
    if (y > top) discard;
    // lit from above: the tops catch the hour's light, the base melts into the glow it rises from
    // bright like the puffs: the base is the glow it rises from, the heads near white with a soft lit rim
    float lit = smoothstep(0.0, top, y);
    vec3 col = mix(mix(uGlow, uCloud, 0.35), uCloud, lit);
    col = mix(col, vec3(1.0), smoothstep(top - 0.03, top, y) * 0.25);
    gl_FragColor = vec4(col, 1.0);
  }`

export function HorizonRing({ y }: { y: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const scene = useThree(s => s.scene)
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RING_VERT, fragmentShader: RING_FRAG, side: THREE.BackSide, fog: false, depthWrite: false,
    uniforms: { uGlow: { value: new THREE.Color('#c9dff0') }, uCloud: { value: CLOUD.clone() }, uT: time },
  }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => { const g = window as unknown as { __clouds?: Record<string, number> }; g.__clouds = { ...(g.__clouds ?? {}), ring: 1 }; return () => { g.__clouds = { ...(g.__clouds ?? {}), ring: 0 } } }, [])
  useFrame(({ camera }) => {
    const m = ref.current; if (!m) return
    m.position.set(camera.position.x, y + RING_H / 2 - 30, camera.position.z)
    cloudFor(glowOf(scene, mat.uniforms.uGlow.value as THREE.Color), mat.uniforms.uCloud.value as THREE.Color)
  })
  return <mesh ref={ref} material={mat} frustumCulled={false} renderOrder={-0.9}><cylinderGeometry args={[RING_R, RING_R, RING_H, 96, 1, true]} /></mesh>
}

// ── pillows laid out round the camera (the Wilds' reefs): rebuilt when the keeper has moved MOVE metres ──
const MOVE = 60, REEF_CAP = 700
export function CloudReefs({ layout, label = 'reefs' }: { layout: (cx: number, cz: number) => Puff[]; label?: string }) {
  const camera = useThree(s => s.camera)
  const [at, setAt] = useState<{ x: number; z: number } | null>(null)
  useFrame(() => {
    const p = camera.position
    if (!at || Math.hypot(p.x - at.x, p.z - at.z) > MOVE) setAt({ x: Math.round(p.x), z: Math.round(p.z) })
  })
  const puffs = useMemo(() => (at ? layout(at.x, at.z) : []), [at, layout])
  return <CloudPillows puffs={puffs} label={label} cap={REEF_CAP} />
}

// ── the cloud deck past the map: one merged mesh of squares, rebuilt when the keeper changes tile ──
export function CloudDeck({ squares, size, y }: { squares: (cx: number, cz: number) => { x: number; z: number }[]; size: number; y: number }) {
  const camera = useThree(s => s.camera), scene = useThree(s => s.scene)
  const [key, setKey] = useState<string | null>(null)
  useFrame(() => {
    const k = `${Math.floor((camera.position.x + size / 2) / size)},${Math.floor((camera.position.z + size / 2) / size)}`
    if (k !== key) setKey(k)
  })
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: CLOUD, emissive: new THREE.Color('#c9dff0'), emissiveIntensity: 0.55 }), [])
  const geo = useMemo(() => {
    if (!key) return null
    const [tx, ty] = key.split(',').map(Number), sq = squares(tx * size, ty * size)
    if (!sq.length) return null
    const parts = sq.map(q => new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(q.x, y, q.z))
    const pos: number[] = [], nor: number[] = [], idx: number[] = []
    for (const g of parts) {
      const base = pos.length / 3
      pos.push(...(g.attributes.position.array as Float32Array)); nor.push(...(g.attributes.normal.array as Float32Array))
      for (const i of g.index!.array as Uint16Array) idx.push(base + i)
      g.dispose()
    }
    const m = new THREE.BufferGeometry()
    m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); m.setIndex(idx)
    return m
  }, [key, squares, size, y])
  useEffect(() => () => { geo?.dispose() }, [geo])
  useEffect(() => { const g = window as unknown as { __clouds?: Record<string, number> }; g.__clouds = { ...(g.__clouds ?? {}), deck: geo ? geo.attributes.position.count / 4 : 0 } }, [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => { glowOf(scene, mat.emissive) })
  if (!geo) return null
  return <mesh geometry={geo} material={mat} />
}
