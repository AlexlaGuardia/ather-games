'use client'
// M102 (sprites, 2026-11-23): THE VULNYX, IN GAME, OWNER-ONLY PREVIEW. Alex 11-23 07:4x picked the NO-MOUTH Hunyuan
// game-ready mesh (docs/looks/proto-2026-11-23/vulnyx-gameready.glb) as a TEMP, game-only spirit style and asked "how
// will it look in game?". This file answers that: the mesh UNCHANGED in shape (no face edits), stood on a bloomed Spirit
// Planter, behind `?spirits=3d` AND the owner cookie (/api/owner, the gate the Options Dev tab uses). Players see the
// gold orb exactly as before. M102 Manalotl wire-in: PER SPECIES now (spirit-models.ts): a bloomed planter shows its own
// species' model when one is listed (Vulnyx, Manalotl) and the gold orb otherwise.
//
// Look (art-medium law: living things stay LIVE GLOW): toon 3-step on the mesh's own vertex colours + a warm emissive
// floor so she never goes dark at night, a gold fresnel rim, a pale-gold translucent hull where other figures carry an ink
// hull, and the glb's own eye mesh (iris, pupil, outline, catchlight are in it as vertex colours) drawn unlit. Idle: a gentle bob + breath + slow head-turn yaw of the whole body, and a soft tail sway done in the
// vertex shader (weight = how far along the tail axis a vertex sits). No rig: the glb has no skin or vertex groups.
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { makeTrot, type SpiritNav, type Trot } from './spirit-trot'

import { SPIRIT_MODELS, type SpiritLook } from './spirit-models'
import type { Species } from '../../spirits/spirit'

export const VULNYX_URL = SPIRIT_MODELS.fox!.url
/** World height of the model (the glb is 1 unit tall). Small and lithe: ~0.55 m, about a third of a keeper. */
export const VULNYX_H = SPIRIT_MODELS.fox!.h

// ── the gate: ?spirits=3d AND the owner (cached once per page) ─────────────────────────────────────────────────────
let ownerP: Promise<boolean> | null = null
const ownerCheck = () => (ownerP ??= fetch('/api/owner', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { owner: false })).then(d => !!d.owner).catch(() => false))
const flagOn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('spirits') === '3d'
export function useSpirits3d(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => { if (!flagOn()) return; let alive = true; ownerCheck().then(v => { if (alive) setOn(v) }); return () => { alive = false } }, [])
  return on
}

// read-only probe for the check: how many spirit models are mounted right now (all, and by species). `trot` = the Vulnyx's
// pose (the M107 asserts read it), `trots[species]` = each species' latest pose.
type TrotProbe = { x: number; y: number; z: number; mode: string; home: { x: number; z: number }; rMin: number; rMax: number; beats: number; homes: number; tilt: number; h: number; hWorld?: number }
type Probe = { mounted: number; url: string; h: number; species: Record<string, number>; trot?: TrotProbe; trots: Record<string, TrotProbe> }
const probe = (): Probe => { const w = window as unknown as { __spiritModel?: Probe }; return (w.__spiritModel ??= { mounted: 0, url: VULNYX_URL, h: VULNYX_H, species: {}, trots: {} }) }

let grad: THREE.DataTexture | null = null
const gradTex = () => { if (grad) return grad; grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true; return grad }

function SpiritModel({ sp, look, nav }: { sp: Species; look: SpiritLook; nav?: SpiritNav }) {
  const { scene } = useGLTF(look.url)
  const g = useRef<THREE.Group>(null)
  const time = useMemo(() => ({ value: 0 }), []), sw = useMemo(() => ({ value: 0 }), []), lift = useMemo(() => ({ value: 0 }), []), tiltU = useMemo(() => ({ value: 0 }), [])
  // M107: the procedural trot (spirit-trot.ts) when a nav is given, with this species' dials; seeded by home so two
  // planters never move in step
  const trot = useMemo<Trot | null>(() => nav ? makeTrot(nav, Math.round(nav.home.x * 31 + nav.home.z * 17), look.trot) : null, [nav, look])
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), bb: new THREE.Box3(), hAt: -1, hWorld: 0 }), [])
  const parts = useMemo(() => {
    const body = scene.getObjectByName('body') as THREE.Mesh | undefined, eyes = scene.getObjectByName('eyes') as THREE.Mesh | undefined
    const glowM = look.glow ? scene.getObjectByName(look.glow.part) as THREE.Mesh | undefined : undefined
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
    const skin = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex(), emissive: look.skin.emissive, emissiveIntensity: look.skin.emissiveI })
    const glow = look.glow ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex(), emissive: look.glow.emissive, emissiveIntensity: look.glow.lo }) : null
    // the outline of the picked render: a pale translucent hull at ~1/3 alpha (gold for the Vulnyx, rose for the Manalotl)
    const halo = new THREE.MeshBasicMaterial({ color: look.hull.color, transparent: true, opacity: look.hull.opacity, side: THREE.BackSide, depthWrite: false, toneMapped: false })
    const eye = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    // the species' vertex bends, weights by vertex position (no rig): tail sway (running = faster + wider, the tail lags the
    // hop), the Vulnyx's ear flick, the Manalotl's head tilt (a roll of everything forward of the neck: head, frills, eyes)
    const { sway: S, tilt: T } = look, f = (n: number) => n.toFixed(4)
    const tail = `float tp = ${f(S.sign)} * position.${S.along}; float tw = smoothstep(${f(S.from)}, ${f(S.to)}, tp);
        transformed.${S.dir} += sin(uT * (${f(S.hz)} + uSw * ${f(S.hzRun)}) - tp * 3.0) * (${f(S.amp)} + ${f(S.ampRun)} * uSw) * tw * tw;
        transformed.y -= uLift * ${f(S.lag)} * tw * tw;`
    const ears = look.ears ? `float ew = smoothstep(0.84, 0.99, position.y) * (1.0 - smoothstep(0.15, 0.3, position.x));
        transformed.x += sin(uT * (2.3 + uSw * 7.0) + position.x * 9.0) * (0.012 + 0.014 * uSw) * ew;` : ''
    const head = T ? `float ha = smoothstep(${f(T.from)}, ${f(T.to)}, position.z) * uTilt * ${f(T.max)}; vec2 hd = transformed.xy - vec2(${f(T.px)}, ${f(T.py)});
        transformed.xy = vec2(${f(T.px)}, ${f(T.py)}) + vec2(cos(ha) * hd.x - sin(ha) * hd.y, sin(ha) * hd.x + cos(ha) * hd.y);` : ''
    for (const m of [skin, halo, eye, ...(glow ? [glow] : [])]) m.onBeforeCompile = sh => {
      sh.uniforms.uT = time; sh.uniforms.uSw = sw; sh.uniforms.uLift = lift; sh.uniforms.uTilt = tiltU
      sh.vertexShader = 'uniform float uT; uniform float uSw; uniform float uLift; uniform float uTilt;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        ${tail}
        ${ears}
        ${head}`)
      // the warm rim light of the picked render: a bright gold fresnel line on the toon parts (not on the hull or eyes)
      if (m === skin || m === glow) sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
        gl_FragColor.rgb += vec3(1.0, 0.86, 0.32) * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0) * 0.45;`)
    }
    return { body: lin(body.geometry), eyes: eyes.geometry,   // eyes stay raw: their colours read brighter, as in the picked renders
      glowGeo: glowM ? lin(glowM.geometry) : null, skin, glow, halo, eye, cx, cz }
  }, [scene, time, look])
  useEffect(() => { const p = probe(); p.mounted++; p.species[sp] = (p.species[sp] ?? 0) + 1
    return () => { p.mounted--; p.species[sp]--; if (!p.species[sp]) delete p.trots[sp]; if (!p.species.fox) p.trot = undefined } }, [sp])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime; time.value = t
    if (parts?.glow && look.glow) { const G = look.glow; parts.glow.emissiveIntensity = G.lo + (G.hi - G.lo) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * G.hz)) }
    if (!g.current) return
    if (trot && g.current.parent) {
      // the pose is in WORLD xz + yaw; the planter piece may be turned, so read through the parent's transform
      const ps = trot.step(dt), par = g.current.parent, { v, q, e } = tmp
      par.updateWorldMatrix(true, false); par.getWorldPosition(v); const baseY = v.y
      v.set(ps.x, baseY + ps.y, ps.z); par.worldToLocal(v); g.current.position.copy(v)
      par.getWorldQuaternion(q); e.setFromQuaternion(q)
      // a species with no head bend (none yet; the Vulnyx carries no tilt beat) would tip the whole body instead
      g.current.rotation.set(ps.pitch, ps.yaw - e.y, ps.roll + (look.tilt ? 0 : ps.tilt * 0.12), 'YXZ')
      tiltU.value = ps.tilt
      const breath = ps.swing > 0 ? 0 : Math.sin(t * 2.2) * 0.015
      g.current.scale.set(ps.sx, ps.sy + breath, ps.sx)
      sw.value += (ps.swing - sw.value) * Math.min(1, dt * 6); lift.value = ps.lift
      // the measured world height (the drawn meshes' box, hull included) for the check, twice a second
      if (t - tmp.hAt > 0.5) { tmp.hAt = t; const s = tmp.bb.setFromObject(g.current); tmp.hWorld = s.max.y - s.min.y }
      const pr = probe(), tp: TrotProbe = { x: ps.x, y: baseY + ps.y, z: ps.z, mode: ps.mode, home: nav!.home, rMin: nav!.rMin, rMax: nav!.rMax, beats: trot.beats(), homes: trot.homes(), tilt: ps.tilt, h: look.h, hWorld: tmp.hWorld }
      pr.trots[sp] = tp; if (sp === 'fox') pr.trot = tp
      return
    }
    g.current.position.y = Math.sin(t * 1.4) * 0.02 * look.h / 0.55
    g.current.scale.set(1, 1 + Math.sin(t * 2.2) * 0.015, 1)   // breath
    g.current.rotation.y = Math.sin(t * 0.35) * 0.45            // a slow look round
  })
  if (!parts) return null
  const H = look.h
  return (
    <group ref={g} name={`spirit-model-${look.name}`} userData={{ spiritModel: look.name }}>
      <group scale={H} position={[-parts.cx * H, 0, -parts.cz * H]}>
        <mesh geometry={parts.body} material={parts.skin} />
        <mesh geometry={parts.body} material={parts.halo} scale={1.06} position={[-parts.cx * 0.06, -0.03, -parts.cz * 0.06]} />
        {parts.glowGeo && parts.glow && <>
          <mesh geometry={parts.glowGeo} material={parts.glow} />
          <mesh geometry={parts.glowGeo} material={parts.halo} scale={1.06} position={[-parts.cx * 0.06, -0.03, -parts.cz * 0.06]} />
        </>}
        <mesh geometry={parts.eyes} material={parts.eye} />
      </group>
    </group>
  )
}

/** The species' model stood on a bloomed planter (null look = the caller shows the orb); `fallback` (the gold orb) shows
 *  while the glb loads. With `nav` (M107) it trots its own manner round home: the group sits at the ground and the perch
 *  height comes from `nav.perch`. */
export function SpiritOnPlanter({ sp, look, y, fallback, nav }: { sp: Species; look: SpiritLook; y: number; fallback: ReactNode; nav?: SpiritNav }) {
  return <Suspense fallback={fallback}><group position-y={nav ? 0 : y}><SpiritModel sp={sp} look={look} nav={nav} /></group></Suspense>
}
