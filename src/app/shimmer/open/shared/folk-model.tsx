'use client'
// THE ALKIN NPC, MODELLED (2026-11-18, sprites / Jin 5 a591750b). Alex: "we should start working on the npcs models",
// then PICKED THE CARTOON LOOK from five (hub 11-18; the reference is docs/looks/alkin-looks.html › STYLES 'toon' +
// build()). This file is that build() on a joint hierarchy so it can move: head 1:3 of the height, long-ish limbs,
// big white eyes with dark pupils, MeshToonMaterial on a 3-step gradient (90/170/255, nearest), an inverted-hull ink
// outline at 1.07x (#1b140e, BackSide). Ears are SMALL + POINTED (canon, Magii RULED 11-19: Alkin ears small and pointed; the creator's EAR petal, shared).
//
// ⚠ PLACEHOLDER LOOKS. No canon look exists for Gregory or any NPC (asked of Magii 11-18). A NAMED NPC carries only
// the colours its old blockout already shipped with (Greg's purple robe + wide hat); an unnamed one (a clerk, a smith)
// gets colours drawn from its id: random across folk, fixed for life, the same on every device (the furOf rule).
//
// Phone cost: every part is two meshes (body + outline). Geometry is SHARED (one unit sphere, a few unit cylinders,
// scaled per part) and so are materials (cached per colour) plus ONE gradient texture, so many NPCs share a few dozen
// buffers/programs; draw calls are ~2 x parts per NPC (measured on the bench page).
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EAR } from './keeper-figure'

export type FolkPose = 'stand' | 'sit'
export type FolkAction = 'idle' | 'talk' | 'wave' | 'walk'   // walk: BETA M32 (Greg's tour), legs swing from the hip
export interface FolkLook {
  skin: string; hair: string; shirt: string; apron: string | null; trouser: string; boot: string
  /** a robe to the ankles instead of shirt + trousers (Greg) */
  robe?: boolean
  hat?: 'none' | 'wide' | 'cap'
  hatColor?: string
  beard?: boolean
  /** M30 (Gregory's locked look, additive): a waistcoat over the shirt, spectacles, a pencil behind the right ear, crinkled eye corners */
  vest?: string
  specs?: boolean
  pencil?: boolean
  crinkle?: boolean
  /** body build: girth widens x/z, height scales y (1 = the standard rig) */
  build?: { girth?: number; height?: number }
}

const SKINS = ['#e8b98f', '#f1d2b6', '#c99470', '#a8734f', '#7d5236', '#f4dcc8']
const HAIRS = ['#5a3a24', '#2b1d14', '#7a4a26', '#b9853f', '#d8c08a', '#8a8079', '#1a1a1a', '#9c3f22']
const SHIRTS = ['#4f7c8a', '#5b3f2e', '#6d6a3a', '#7a2f2f', '#2f4a3a', '#544a63', '#8a6a3f', '#3a4a6a']
const APRONS: readonly (string | null)[] = ['#c9a06a', '#d8d0bc', '#8a5a3a', '#6a5a4a', null, null]
const TROUSERS = ['#3f3a33', '#4a3b2a', '#2e3440', '#5a4a3a']
const BOOTS = ['#2a221b', '#3a2a1c', '#1f1a16']
const hash = (s: string, salt = 0) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 2166136261 ^ salt)
const pick = <T,>(xs: readonly T[], id: string, salt: number) => xs[hash(id, salt) % xs.length]

/** Looks for NPCs with a name. Only colours an old blockout already showed; see the header. */
export const NAMED_LOOKS: Readonly<Record<string, FolkLook>> = {
  // the plot-scene blockout since 11-13: a purple robe, a pale face, a wide hat with a pointed crown
  // LOCKED 11-18 (design-briefs/gregory-look.md, "shopkeeper-uncle"): round, short, spectacles, crinkly eyes, waistcoat over
  // shirtsleeves, a pencil behind one ear. No staff, no robe, no beard, no hat, no weapon. Colours are Jin's within that.
  gregory: { skin: '#eccdab', hair: '#dcd7cb', shirt: '#e9dfc6', vest: '#5f6b4a', apron: null, trouser: '#5a4632', boot: '#3a2a1c', hat: 'none', beard: false, specs: true, pencil: true, crinkle: true, build: { girth: 1.28, height: 0.9 } },
}
/** An NPC's look: its named look, else colours drawn from its id (fixed for life, the same everywhere). */
export function folkLook(id: string): FolkLook {
  if (NAMED_LOOKS[id]) return NAMED_LOOKS[id]
  const h = hash(id, 7)
  return {
    skin: pick(SKINS, id, 1), hair: pick(HAIRS, id, 2), shirt: pick(SHIRTS, id, 3), apron: pick(APRONS, id, 4),
    trouser: pick(TROUSERS, id, 5), boot: pick(BOOTS, id, 6), hat: (['none', 'none', 'none', 'cap'] as const)[h % 4],
    hatColor: pick(SHIRTS, id, 8), beard: (h >> 3) % 5 === 0,
  }
}

// The reference's proportions (metres): leg 0.55, body 0.62, head 0.5, arm 0.6.
const L = 0.55, B = 0.62, H = 0.5, A = 0.6, TOP = L + B, HY = TOP + H * 0.55
/** Crown height, for a name tag / talk camera. */
export const FOLK_HEIGHT = HY + H * 0.55
export const FOLK_EYE_Y = HY + H * 0.02

// ── shared GPU resources (module-level: one per page, every NPC reuses them) ────────────────────────────────────────
type Shared = { torus: THREE.TorusGeometry; sphere: THREE.SphereGeometry; cyl: Map<string, THREE.CylinderGeometry>; box: THREE.BoxGeometry; cone: THREE.ConeGeometry; grad: THREE.DataTexture; mats: Map<string, THREE.Material>; ink: THREE.MeshBasicMaterial }
let shared: Shared | null = null
function res(): Shared {
  if (shared) return shared
  const grad = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true
  shared = { torus: new THREE.TorusGeometry(1, 0.1, 6, 20), sphere: new THREE.SphereGeometry(1, 18, 14), cyl: new Map(), box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 14), grad, mats: new Map(), ink: new THREE.MeshBasicMaterial({ color: '#1b140e', side: THREE.BackSide }) }
  return shared
}
const cylOf = (rt: number, rb: number) => { const r = res(), k = `${rt}:${rb}`; if (!r.cyl.has(k)) r.cyl.set(k, new THREE.CylinderGeometry(rt, rb, 1, 16)); return r.cyl.get(k)! }
const toon = (c: string) => { const r = res(); if (!r.mats.has(c)) r.mats.set(c, new THREE.MeshToonMaterial({ color: c, gradientMap: r.grad })); return r.mats.get(c)! }
const flat = (c: string) => { const r = res(), k = `b${c}`; if (!r.mats.has(k)) r.mats.set(k, new THREE.MeshBasicMaterial({ color: c })); return r.mats.get(k)! }

type V3 = [number, number, number]
/** One part: the toon mesh and its ink hull (the reference's part()). */
function Part({ geo, color, pos, scale, ink = true, rot }: { geo: THREE.BufferGeometry; color: string; pos: V3; scale: V3; ink?: boolean; rot?: V3 }) {
  return (
    <group position={pos} rotation={rot}>
      <mesh geometry={geo} material={toon(color)} scale={scale} />
      {ink && <mesh geometry={geo} material={res().ink} scale={[scale[0] * 1.07, scale[1] * 1.07, scale[2] * 1.07]} />}
    </group>
  )
}

export function FolkModel({ look, action = 'idle', seed = 0, speed = 1, pose = 'stand' }: { look: FolkLook; action?: FolkAction; seed?: number; speed?: number; pose?: FolkPose }) {
  const head = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), eyes = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null), legR = useRef<THREE.Group>(null)
  const t0 = useRef(seed * 1.3)
  useFrame((_, dt) => {
    const t = (t0.current += Math.min(0.05, dt) * speed)
    let yaw = Math.sin(t * 0.37 + seed) * 0.16, pitch = 0, roll = 0
    let aL = 0, aR = 0, sL = 0, sR = 0   // pitch (forward -) and swing out, per arm
    if (action === 'talk') {   // one hand making the point, the head with it
      const ph = t * 2.6
      aR = -0.9 + Math.sin(ph) * 0.25; sR = 0.2 + Math.sin(ph * 0.5) * 0.15; yaw = Math.sin(ph * 0.5) * 0.12; pitch = Math.sin(ph) * 0.05
    } else if (action === 'wave') {
      sR = 2.5 + Math.sin(t * 6) * 0.3; roll = 0.08; yaw = 0
    } else if (action === 'walk') {   // M32: a stride at ~1.9 steps/s (speed scales it); arms counter-swing, a step's bob
      const ph = t * 6
      aL = Math.sin(ph) * 0.45; aR = -aL; yaw = 0
    } else {
      aL = Math.sin(t * 1.8) * 0.03; aR = -aL
    }
    const stride = action === 'walk' ? Math.sin(t * 6) * 0.5 : 0
    if (legL.current) legL.current.rotation.x = -stride
    if (legR.current) legR.current.rotation.x = stride
    if (body.current) body.current.position.y = action === 'walk' ? Math.abs(Math.cos(t * 6)) * 0.03 : Math.sin(t * 1.8) * 0.006
    if (head.current) head.current.rotation.set(pitch, yaw, roll)
    if (armL.current) armL.current.rotation.set(aL, 0, -sL)
    if (armR.current) armR.current.rotation.set(aR, 0, sR)
    if (eyes.current) eyes.current.scale.y = ((t + seed) % 4.1) < 0.12 ? 0.15 : 1
  })
  const r = res(), S = r.sphere
  const sit = pose === 'sit'   // seated on something ~0.48 m high: thighs forward, shins down (the bench is the scene's)
  return (
    <group scale={[look.build?.girth ?? 1, look.build?.height ?? 1, look.build?.girth ?? 1]}>
    <group ref={body}>
      {/* legs + boots, or a robe to the ankles */}
      {sit && !look.robe ? ([-1, 1] as const).map(s => (
        <group key={s}>
          <group position={[s * 0.1, 0.58, 0.2]} rotation={[Math.PI / 2, 0, 0]}><Part geo={cylOf(0.085, 0.08)} color={look.trouser} pos={[0, 0, 0]} scale={[1, 0.42, 1]} /></group>
          <Part geo={cylOf(0.075, 0.07)} color={look.trouser} pos={[s * 0.1, 0.3, 0.4]} scale={[1, 0.5, 1]} />
          <Part geo={S} color={look.boot} pos={[s * 0.1, 0.06, 0.44]} scale={[0.1, 0.07, 0.14]} />
        </group>
      )) : look.robe ? (
        <Part geo={cylOf(0.19, 0.3)} color={look.shirt} pos={[0, (L + 0.06) / 2, 0]} scale={[1, L + 0.06, 1]} />
      ) : ([-1, 1] as const).map(s => (   // each leg pivots at its hip (rotation 0 = the old standing pose exactly)
        <group key={s} ref={s < 0 ? legL : legR} position={[s * 0.1, L + 0.06, 0]}>
          <Part geo={cylOf(0.075, 0.085)} color={look.trouser} pos={[0, -L / 2, 0]} scale={[1, L, 1]} />
          <Part geo={S} color={look.boot} pos={[0, -L, 0.04]} scale={[0.1, 0.07, 0.14]} />
        </group>
      ))}
      {/* the body: shirt (+ apron) */}
      <Part geo={cylOf(0.17, 0.2)} color={look.shirt} pos={[0, L + B / 2, 0]} scale={[1, B, 1]} />
      {look.vest && <Part geo={cylOf(0.18, 0.212)} color={look.vest} pos={[0, L + B * 0.43, 0]} scale={[1, B * 0.86, 1]} />}
      {look.apron && <Part geo={r.box} color={look.apron} pos={[0, L + B * 0.4, 0.2]} scale={[0.3, B * 0.72, 0.02]} ink={false} />}
      {/* arms: pivots at the shoulders (slightly splayed, the reference's 0.12), hands at the ends */}
      {([-1, 1] as const).map(s => (
        <group key={s} ref={s < 0 ? armL : armR} position={[s * 0.23, TOP - 0.03, 0]}>
          <group rotation={[0, 0, s * 0.12]}>
            <Part geo={cylOf(0.055, 0.05)} color={look.shirt} pos={[0, -A / 2, 0]} scale={[1, A, 1]} />
            <Part geo={S} color={look.skin} pos={[0, -A, 0]} scale={[0.06, 0.06, 0.06]} />
          </group>
        </group>
      ))}
      {/* the head: a pivot at the neck */}
      <group ref={head} position={[0, TOP, 0]}>
        <group position={[0, HY - TOP, 0]}>
          <Part geo={S} color={look.skin} pos={[0, 0, 0]} scale={[H * 0.5, H * 0.55, H * 0.5]} />
          <Part geo={S} color={look.hair} pos={[0, H * 0.14, -H * 0.08]} scale={[H * 0.53, H * 0.42, H * 0.52]} />   {/* a touch back + up of the reference's -0.06: its cap bled through the face at 3/4 view; -0.1 read bald */}
          {([-1, 1] as const).map(s => <Part key={s} geo={EAR} color={look.skin} pos={[s * H * 0.49, H * 0.02, -H * 0.02]} scale={[H * 0.09, H * 0.2, H * 0.05]} rot={[-0.35, 0, s * -0.55]} />)}
          {/* eyes: big whites, dark pupils (blink scales the group) */}
          <group ref={eyes} position={[0, H * 0.02, 0]}>
            {([-1, 1] as const).map(s => (
              <group key={s} position={[s * H * 0.17, 0, H * 0.47]}>
                <mesh geometry={S} material={flat('#ffffff')} position={[0, 0, -0.01]} scale={[H * 0.11, H * 0.14, H * 0.05]} />
                <mesh geometry={S} material={flat('#1c1712')} position={[0, -H * 0.01, H * 0.03]} scale={[H * 0.065, H * 0.09, H * 0.03]} />
              </group>
            ))}
          </group>
          <mesh geometry={S} material={toon('#d9a47c')} position={[0, -H * 0.08, H * 0.5]} scale={H * 0.05} />
          {look.specs && <>
            {([-1, 1] as const).map(s => <mesh key={s} geometry={r.torus} material={flat('#2b2118')} position={[s * H * 0.17, H * 0.02, H * 0.5]} scale={H * 0.14} />)}
            <mesh geometry={r.box} material={flat('#2b2118')} position={[0, H * 0.04, H * 0.5]} scale={[H * 0.1, 0.012, 0.012]} />
          </>}
          {look.crinkle && ([-1, 1] as const).map(s => [0.35, -0.35].map(a => <mesh key={`${s}${a}`} geometry={r.box} material={flat('#7a5a44')} position={[s * H * 0.33, H * 0.02, H * 0.4]} rotation={[0, s * 0.6, s * a]} scale={[H * 0.1, 0.008, 0.008]} />))}
          {look.pencil && <group position={[H * 0.5, H * 0.2, -H * 0.04]} rotation={[0.5, 0, -0.35]}><Part geo={cylOf(1, 1)} color="#d9a031" pos={[0, 0, 0]} scale={[0.014, 0.15, 0.014]} ink={false} /><Part geo={r.cone} color="#2b2118" pos={[0, 0.09, 0]} scale={[0.014, 0.03, 0.014]} ink={false} /></group>}
          {look.beard && <Part geo={S} color={look.hair} pos={[0, -H * 0.32, H * 0.2]} scale={[H * 0.34, H * 0.28, H * 0.3]} />}
          {look.hat === 'wide' && (
            <group position={[0, H * 0.4, 0]}>
              <Part geo={cylOf(1, 1)} color={look.hatColor ?? look.shirt} pos={[0, 0, 0]} scale={[H * 0.95, 0.04, H * 0.95]} />
              <Part geo={r.cone} color={look.hatColor ?? look.shirt} pos={[0, H * 0.5, 0]} scale={[H * 0.42, H * 1.0, H * 0.42]} />
            </group>
          )}
          {look.hat === 'cap' && <Part geo={S} color={look.hatColor ?? look.shirt} pos={[0, H * 0.24, -H * 0.02]} scale={[H * 0.55, H * 0.3, H * 0.55]} />}
        </group>
      </group>
    </group>
    </group>
  )
}
