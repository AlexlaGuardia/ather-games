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
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { makeTrot, type SpiritNav, type Trot } from './spirit-trot'
import { isFollowing, keeperAt, spiritHeld, spiritLive, subscribeFollow } from './spirit-follow'   // M109 s1
import { spiritCheer } from './spirit-feed'   // M109 s2: fed = her happy beat
import { inParty, spiritCall, subscribeParty } from './spirit-party'   // M109 s3: called home from the grimoire; s4: the party keeps near
import { isTrainStat, trainPlay } from './spirit-stats'   // M110 s1: a finished play at a training piece = a small gain

import { SPIRIT_MODELS, groundLift, lowPoints, type SpiritLook } from './spirit-models'
import type { Species } from '../../spirits/spirit'

export const VULNYX_URL = SPIRIT_MODELS.fox!.url
/** World height of the model (the glb is 1 unit tall). Small and lithe: ~0.55 m, about a third of a keeper. */
export const VULNYX_H = SPIRIT_MODELS.fox!.h

// ── the gate. M107 ship (Alex 11-23): the MODELS and their roam/trot are for EVERY keeper now (no gate). What stays
// owner + ?spirits=3d is the rest that grew on top: E-talk (Feed / Follow / Open panel), the party + the grimoire roster
// face, the training pieces and their plays. useSpiritsDev() is that gate (cached once per page). ───────────────────────
let ownerP: Promise<boolean> | null = null
const ownerCheck = () => (ownerP ??= fetch('/api/owner', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { owner: false })).then(d => !!d.owner).catch(() => false))
const flagOn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('spirits') === '3d'
export function useSpiritsDev(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => { if (!flagOn()) return; let alive = true; ownerCheck().then(v => { if (alive) setOn(v) }); return () => { alive = false } }, [])
  return on
}

// read-only probe for the check: how many spirit models are mounted right now (all, and by species). `trot` = the Vulnyx's
// pose (the M107 asserts read it), `trots[species]` = each species' latest pose.
type TrotProbe = { x: number; y: number; z: number; mode: string; home: { x: number; z: number }; rMin: number; rMax: number; beats: number; homes: number; tilt: number; h: number; hWorld?: number; len?: number; keepMax?: number; cheers: number; yMax: number; calling: boolean; near: boolean; plays: number; playing: string | null; playYMax: number; braceMax: number }
type Probe = { mounted: number; url: string; h: number; species: Record<string, number>; trot?: TrotProbe; trots: Record<string, TrotProbe> }
const probe = (): Probe => { const w = window as unknown as { __spiritModel?: Probe }; return (w.__spiritModel ??= { mounted: 0, url: VULNYX_URL, h: VULNYX_H, species: {}, trots: {} }) }

let grad: THREE.DataTexture | null = null
const gradTex = () => { if (grad) return grad; grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true; return grad }

function SpiritModel({ sp, look, nav, id, avatar, dev }: { sp: Species; look: SpiritLook; nav?: SpiritNav
  /** M107 ship: owner + ?spirits=3d: she can be talked to, follow, keep with the party, play at training pieces */ dev?: boolean
  /** M109: the planter's id (her follow state + the E pick are keyed on it) */ id?: string
  /** M109: the spirit panel's turntable copy: not counted by the probe, not pickable */ avatar?: boolean }) {
  const { scene } = useGLTF(look.url)
  const g = useRef<THREE.Group>(null)
  const time = useMemo(() => ({ value: 0 }), []), sw = useMemo(() => ({ value: 0 }), []), lift = useMemo(() => ({ value: 0 }), []), tiltU = useMemo(() => ({ value: 0 }), [])
  // M107: the procedural trot (spirit-trot.ts) when a nav is given, with this species' dials; seeded by home so two
  // planters never move in step
  const trot = useMemo<Trot | null>(() => nav ? makeTrot(nav, Math.round(nav.home.x * 31 + nav.home.z * 17), look.trot) : null, [nav, look])
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), bb: new THREE.Box3(), hAt: -1, hWorld: 0, lWorld: 0, keepMax: 0 }), [])
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
    // grown-size slice: the low vertices (ground keep)
    const low = lowPoints([body, eyes, ...(glowM ? [glowM] : [])].flatMap(m => Array.from(m.geometry.getAttribute('position').array as ArrayLike<number>)), cx, cz)
    return { body: lin(body.geometry), eyes: eyes.geometry,   // eyes stay raw: their colours read brighter, as in the picked renders
      glowGeo: glowM ? lin(glowM.geometry) : null, skin, glow, halo, eye, cx, cz, low }
  }, [scene, time, look])
  // M109 s1 FOLLOW: she walks with the keeper while her planter id is in the follow list (kept across reloads)
  useEffect(() => {
    if (!trot || !id || !dev) return
    const sync = () => trot.follow(isFollowing(id) ? () => keeperAt : null)
    sync(); const off = subscribeFollow(sync)
    return () => { off(); spiritLive.delete(id) }
  }, [trot, id, dev])
  // M109 s4 THE PARTY KEEPS NEAR: while her planter id is in the party she picks her runs round the keeper (loose company)
  useEffect(() => {
    if (!trot || !id || !dev) return
    const sync = () => trot.near(inParty(id) ? () => keeperAt : null)
    sync(); return subscribeParty(sync)
  }, [trot, id, dev])
  // M110 s1 TRAINING: a play she chose and finished at a training piece adds its small gain to HER stat record (planter id)
  useEffect(() => {
    if (!trot || !id || !dev) return
    trot.onPlayed((toy, stat) => { if (isTrainStat(stat)) trainPlay(id, sp, stat, toy) })   // M118 s2: only where she is assigned
    return () => trot.onPlayed(null)
  }, [trot, id, sp, dev])
  useEffect(() => { if (avatar) return; const p = probe(); p.mounted++; p.species[sp] = (p.species[sp] ?? 0) + 1
    return () => { p.mounted--; p.species[sp]--; if (!p.species[sp]) delete p.trots[sp]; if (!p.species.fox) p.trot = undefined } }, [sp, avatar])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime; time.value = t
    if (parts?.glow && look.glow) { const G = look.glow; parts.glow.emissiveIntensity = G.lo + (G.hi - G.lo) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * G.hz)) }
    if (!g.current) return
    if (trot && g.current.parent) {
      // the pose is in WORLD xz + yaw; the planter piece may be turned, so read through the parent's transform
      if (dev && id && spiritCheer.delete(id)) trot.cheer(() => keeperAt)   // M109 s2: fed
      if (dev && id && spiritCall.delete(id)) trot.call(() => keeperAt)   // M109 s3: called home
      const ps = id && spiritHeld.id === id ? trot.pose() : trot.step(dt), par = g.current.parent, { v, q, e } = tmp   // M109: held while talked to
      par.updateWorldMatrix(true, false); par.getWorldPosition(v); const baseY = v.y
      const breath = ps.swing > 0 ? 0 : Math.sin(t * 2.2) * 0.015
      const roll = ps.roll + (look.tilt ? 0 : ps.tilt * 0.12)
      // grown-size slice: raise her by however far the tip would sink her lowest paw / tail / chin (0 standing level)
      const keep = parts ? groundLift(parts.low, look.h, ps.pitch, roll, ps.sx, ps.sy + breath) : 0
      v.set(ps.x, baseY + ps.y + keep, ps.z); par.worldToLocal(v); g.current.position.copy(v)
      par.getWorldQuaternion(q); e.setFromQuaternion(q)
      // a species with no head bend (none yet; the Vulnyx carries no tilt beat) would tip the whole body instead
      g.current.rotation.set(ps.pitch, ps.yaw - e.y, roll, 'YXZ')
      tiltU.value = ps.tilt
      g.current.scale.set(ps.sx, ps.sy + breath, ps.sx)
      sw.value += (ps.swing - sw.value) * Math.min(1, dt * 6); lift.value = ps.lift
      // the measured world height (the drawn meshes' box, hull included) for the check, twice a second
      if (t - tmp.hAt > 0.5) { tmp.hAt = t; const s = tmp.bb.setFromObject(g.current); tmp.hWorld = s.max.y - s.min.y; tmp.keepMax = Math.max(tmp.keepMax, keep)
        // grown-size slice: her nose-to-tail length off the scene box too, measured with her squared to the world axes (yaw
        // undone against the planter's turn, pitch / roll zeroed) and put straight back the same frame
        const r0 = g.current.rotation.clone(); g.current.rotation.set(0, -e.y, 0, 'YXZ'); g.current.updateMatrixWorld(true)
        const sq = tmp.bb.setFromObject(g.current); tmp.lWorld = look.sway.along === 'z' ? sq.max.z - sq.min.z : sq.max.x - sq.min.x
        g.current.rotation.copy(r0); g.current.updateMatrixWorld(true) }
      const pr = probe(), tp: TrotProbe = { x: ps.x, y: baseY + ps.y, z: ps.z, mode: ps.mode, home: nav!.home, rMin: nav!.rMin, rMax: nav!.rMax, beats: trot.beats(), homes: trot.homes(), tilt: ps.tilt, h: look.h, hWorld: tmp.hWorld, len: tmp.lWorld, keepMax: tmp.keepMax, cheers: trot.cheers(), calling: trot.calling(), near: trot.nearing(), plays: trot.plays(), playing: trot.playing(),
        playYMax: ps.mode === 'play' ? Math.max(pr.trots[sp]?.playYMax ?? 0, ps.y) : (pr.trots[sp]?.playYMax ?? 0),   // M110 s1: the bound's peak
        braceMax: Math.max(pr.trots[sp]?.braceMax ?? 0, trot.braced()),   // M110 s2: the shove's lean / the guard's crouch, at its deepest
        yMax: ps.mode === 'happy' ? Math.max(pr.trots[sp]?.mode === 'happy' ? pr.trots[sp].yMax : 0, ps.y) : (pr.trots[sp]?.yMax ?? 0) }   // M109 s2: the happy beat's peak hop
      pr.trots[sp] = tp; if (sp === 'fox') pr.trot = tp
      if (dev && id) spiritLive.set(id, { id, sp, x: ps.x, y: baseY + ps.y, z: ps.z, h: look.h, at: Date.now() })   // M109: the E pick reads it
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
export function SpiritOnPlanter({ sp, look, y, fallback, nav, id, dev }: { sp: Species; look: SpiritLook; y: number; fallback: ReactNode; nav?: SpiritNav; id?: string; dev?: boolean }) {
  return <Suspense fallback={fallback}><group position-y={nav ? 0 : y}><SpiritModel sp={sp} look={look} nav={nav} id={id} dev={dev} /></group></Suspense>
}

/** M109 s1: the spirit panel's AVATAR: her live model (the same SpiritModel, idle: bob + breath + look round) on a slow
 *  turntable in its own small canvas. Framed by the species' height, so a heel-high Manalotl fills it like the Vulnyx. */
function Turntable({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.5 })
  return <group ref={g}>{children}</group>
}
export function SpiritAvatar({ sp, look, size }: { sp: Species; look: SpiritLook; size: number }) {
  const h = look.h
  return (
    <div data-spirit-avatar={sp} style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', flex: 'none',
      background: 'radial-gradient(circle at 50% 42%, rgba(255,236,190,.55), rgba(58,39,22,.18) 72%)' }}>
      <Canvas dpr={[1, 1.5]} frameloop="always" gl={{ antialias: true, alpha: true }} camera={{ position: [0, h * 0.7, h * 2.4], fov: 32 }}
        onCreated={({ camera }) => camera.lookAt(0, h * 0.45, 0)}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[1.5, 3, 2.5]} intensity={1.3} />
        <Suspense fallback={null}><Turntable><SpiritModel sp={sp} look={look} avatar /></Turntable></Suspense>
      </Canvas>
    </div>
  )
}
