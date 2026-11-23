'use client'
// M102 (sprites, 2026-11-23): THE VULNYX, IN GAME, OWNER-ONLY PREVIEW. Alex 11-23 07:4x picked the NO-MOUTH Hunyuan
// game-ready mesh (docs/looks/proto-2026-11-23/vulnyx-gameready.glb) as a TEMP, game-only spirit style and asked "how
// will it look in game?". This file answers that: the mesh UNCHANGED in shape (no face edits), stood on a bloomed Spirit
// Planter, behind `?spirits=3d` AND the owner cookie (/api/owner, the gate the Options Dev tab uses). Players see the
// gold orb exactly as before. While only one model exists, EVERY bloomed planter shows the Vulnyx (a stand-in species).
//
// Look (art-medium law: living things stay LIVE GLOW): toon 3-step on the mesh's own vertex colours + a warm emissive
// floor so she never goes dark at night, a gold fresnel rim, a pale-gold translucent hull where other figures carry an ink
// hull, and the glb's own eye mesh (iris, pupil, outline, catchlight are in it as vertex colours) drawn unlit. Idle: a gentle bob + breath + slow head-turn yaw of the whole body, and a soft tail sway done in the
// vertex shader (weight = how far along the tail axis a vertex sits). No rig: the glb has no skin or vertex groups.
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

export const VULNYX_URL = '/open/spirits/vulnyx.glb'
/** World height of the model (the glb is 1 unit tall). Small and lithe: ~0.55 m, about a third of a keeper. */
export const VULNYX_H = 0.55
const GLOW = '#fff0b8'

// ── the gate: ?spirits=3d AND the owner (cached once per page) ─────────────────────────────────────────────────────
let ownerP: Promise<boolean> | null = null
const ownerCheck = () => (ownerP ??= fetch('/api/owner', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { owner: false })).then(d => !!d.owner).catch(() => false))
const flagOn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('spirits') === '3d'
export function useSpirits3d(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => { if (!flagOn()) return; let alive = true; ownerCheck().then(v => { if (alive) setOn(v) }); return () => { alive = false } }, [])
  return on
}

// read-only probe for the check: how many Vulnyx models are mounted right now
type Probe = { mounted: number; url: string; h: number }
const probe = (): Probe => { const w = window as unknown as { __spiritModel?: Probe }; return (w.__spiritModel ??= { mounted: 0, url: VULNYX_URL, h: VULNYX_H }) }

let grad: THREE.DataTexture | null = null
const gradTex = () => { if (grad) return grad; grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true; return grad }

function Vulnyx() {
  const { scene } = useGLTF(VULNYX_URL)
  const g = useRef<THREE.Group>(null)
  const time = useMemo(() => ({ value: 0 }), [])
  const parts = useMemo(() => {
    const body = scene.getObjectByName('body') as THREE.Mesh | undefined, eyes = scene.getObjectByName('eyes') as THREE.Mesh | undefined
    if (!body || !eyes) return null
    // the glb's COLOR_0 bytes are sRGB (how the picked render read them); three reads vertex colours as LINEAR, which
    // washes her out to cream. Convert once, into a float copy (the cached glb geometry is left as it came).
    const lin = (geo: THREE.BufferGeometry) => {
      const g = geo.clone(), a = g.getAttribute('color'); if (!a) return g
      const out = new Float32Array(a.count * 3), c = new THREE.Color()
      for (let i = 0; i < a.count; i++) { c.setRGB(a.getX(i), a.getY(i), a.getZ(i), THREE.SRGBColorSpace); out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b }
      g.setAttribute('color', new THREE.BufferAttribute(out, 3)); return g
    }
    const bb = new THREE.Box3().setFromObject(scene), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2
    const skin = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex(), emissive: '#ffd24a', emissiveIntensity: 0.18 })
    // the outline of the picked render (vulnyx-gameready-vs-ref.png): a pale-gold hull at ~1/3 alpha (olive on dark ground, white on cream)
    const halo = new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.38, side: THREE.BackSide, depthWrite: false, toneMapped: false })
    const eye = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    // tail sway: the tail runs out along +x (bbox max.x 0.62); weight rises from x 0.25 to the tip
    for (const m of [skin, halo]) m.onBeforeCompile = sh => {
      sh.uniforms.uT = time
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float tw = smoothstep(0.25, 0.62, position.x); transformed.z += sin(uT * 1.7 - position.x * 3.0) * 0.07 * tw * tw;`)
      // the warm rim light of the picked render: a bright gold fresnel line on the toon body (not on the hull)
      if (m === skin) sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
        gl_FragColor.rgb += vec3(1.0, 0.86, 0.32) * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0) * 0.45;`)
    }
    return { body: lin(body.geometry), eyes: eyes.geometry,   // eyes stay raw: their orange reads brighter, as in the picked render
      skin, halo, eye, cx, cz }
  }, [scene, time])
  useEffect(() => { const p = probe(); p.mounted++; return () => { p.mounted-- } }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; time.value = t
    if (!g.current) return
    g.current.position.y = Math.sin(t * 1.4) * 0.02
    g.current.scale.set(1, 1 + Math.sin(t * 2.2) * 0.015, 1)   // breath
    g.current.rotation.y = Math.sin(t * 0.35) * 0.45            // a slow look round
  })
  if (!parts) return null
  return (
    <group ref={g} name="spirit-model-vulnyx" userData={{ spiritModel: 'vulnyx' }}>
      <group scale={VULNYX_H} position={[-parts.cx * VULNYX_H, 0, -parts.cz * VULNYX_H]}>
        <mesh geometry={parts.body} material={parts.skin} />
        <mesh geometry={parts.body} material={parts.halo} scale={1.06} position={[-parts.cx * 0.06, -0.03, -parts.cz * 0.06]} />
        <mesh geometry={parts.eyes} material={parts.eye} />
      </group>
    </group>
  )
}

/** The model stood on a bloomed planter; `fallback` (the gold orb) shows while the glb loads. */
export function SpiritOnPlanter({ y, fallback }: { y: number; fallback: ReactNode }) {
  return <Suspense fallback={fallback}><group position-y={y}><Vulnyx /></group></Suspense>
}
