'use client'

/**
 * Rune Hold's people, drawn (`townsfolk.ts` decides who and where; this only draws them).
 *
 * ★ A BLOCKOUT FIGURE, coded by TRADE (canon `design-briefs/keepers.md` › Townsfolk: *"coded by trade, never by colour...
 * soot, leather aprons and forge-reddened hands; travelers read by their kit"*). A body, a head, legs that swing when
 * walking, and the one thing their trade carries: an apron, soot, a pack, a cap. Skin and hair vary per person; the
 * trade is what reads.
 *
 * Only the regulars carry a nametag (their names are canon); roles and passers-by are never named. The tag shows when
 * you are close, like the gates' (`Shimmer3D` › GateMarker). They say nothing yet: their lines are @lark's draft,
 * waiting on Alex.
 */
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { folk as K } from './scene-palette'
import { hash } from './rune-hold-look'
import type { Figure, Trade, Walker } from './townsfolk'
import { walkerAt } from './townsfolk'

/** bilinear ground height, so a walker glides up a quarter-tier step instead of hopping it */
export function groundY(h: number[][] | undefined, x: number, z: number): number {
  if (!h) return 0
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0
  const at = (xx: number, zz: number) => h[zz]?.[xx] ?? h[Math.round(z)]?.[Math.round(x)] ?? 0
  return (at(x0, z0) * (1 - fx) + at(x0 + 1, z0) * fx) * (1 - fz) + (at(x0, z0 + 1) * (1 - fx) + at(x0 + 1, z0 + 1) * fx) * fz
}

const pick = <V,>(a: readonly V[], seed: number, k: number) => a[Math.floor(hash(seed, k, 11) * a.length) % a.length]

/** One person. `legsRef` swings when their owner says they are walking. */
function Body({ trade, seed, legs }: { trade: Trade; seed: number; legs?: React.RefObject<THREE.Group | null>[] }) {
  const skin = pick(K.skin, seed, 1), hair = pick(K.hair, seed, 2), shirt = pick(K.shirt, seed, 3), trousers = pick(K.trousers, seed, 4)
  const tall = 0.92 + hash(seed, 5, 11) * 0.16
  const torso = trade === 'traveler' ? pick(K.cloak, seed, 6) : trade === 'clerk' ? K.coat : trade === 'bookkeeper' ? K.waistcoat : shirt
  const apron = trade === 'smith' || trade === 'apprentice' ? K.leather : trade === 'innkeeper' ? K.apronLinen : null
  return (
    <group scale={[1, tall, 1]}>
      {[-0.11, 0.11].map((x, i) => (
        <group key={i} ref={legs?.[i]} position={[x, 0.78, 0]}>
          <mesh position={[0, -0.39, 0]} castShadow><boxGeometry args={[0.15, 0.78, 0.17]} /><meshStandardMaterial color={trousers} /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.12, 0]} castShadow><boxGeometry args={[0.46, 0.66, 0.26]} /><meshStandardMaterial color={torso} roughness={0.9} /></mesh>
      {apron && <mesh position={[0, 0.92, 0.14]}><boxGeometry args={[0.4, 0.78, 0.03]} /><meshStandardMaterial color={apron} roughness={0.8} /></mesh>}
      {(trade === 'smith' || trade === 'apprentice') && <mesh position={[0, 0.62, 0.16]}><boxGeometry args={[0.36, 0.2, 0.02]} /><meshStandardMaterial color={K.soot} /></mesh>}
      {[-1, 1].map(e => <mesh key={e} position={[e * 0.3, 1.1, 0]} castShadow><boxGeometry args={[0.12, 0.6, 0.14]} /><meshStandardMaterial color={torso} /></mesh>)}
      {[-1, 1].map(e => <mesh key={e} position={[e * 0.3, 0.76, 0]}><boxGeometry args={[0.11, 0.1, 0.12]} /><meshStandardMaterial color={trade === 'smith' ? K.soot : skin} /></mesh>)}
      <mesh position={[0, 1.62, 0]} castShadow><boxGeometry args={[0.3, 0.32, 0.3]} /><meshStandardMaterial color={skin} /></mesh>
      <mesh position={[0, 1.8, -0.02]}><boxGeometry args={[0.32, 0.08, 0.32]} /><meshStandardMaterial color={trade === 'clerk' ? K.cap : hair} /></mesh>
      {trade === 'clerk' && <mesh position={[0, 1.77, 0.18]}><boxGeometry args={[0.28, 0.03, 0.12]} /><meshStandardMaterial color={K.cap} /></mesh>}
      {trade === 'traveler' && (
        <group position={[0, 1.08, -0.26]}>
          <mesh castShadow><boxGeometry args={[0.4, 0.5, 0.26]} /><meshStandardMaterial color={K.pack} /></mesh>
          <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.44, 0.06, 0.3]} /><meshStandardMaterial color={K.packStrap} /></mesh>
        </group>
      )}
    </group>
  )
}

/** A regular's name, shown when you are close. */
function NameTag({ name, x, y, z }: { name: string; x: number; y: number; z: number }) {
  const camera = useThree(s => s.camera)
  const [near, setNear] = useState(false)
  useFrame(() => {
    const n = camera.position.distanceTo(new THREE.Vector3(x, y, z)) < 9
    if (n !== near) setNear(n)
  })
  if (!near) return null
  return (
    <Html position={[x, y + 2.2, z]} center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ font: '600 15px Georgia, serif', color: K.tag.ink, background: K.tag.bg, border: `1px solid ${K.tag.edge}`, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>{name}</div>
    </Html>
  )
}

/** Someone standing still: a keeper at their door, a regular where the week puts them. They breathe, barely. */
export function Standing({ f, heights, seed }: { f: Figure; heights?: number[][]; seed: number }) {
  const y = groundY(heights, f.x, f.z)
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = y + Math.sin(clock.elapsedTime * 1.3 + seed) * 0.008 })
  return (
    <>
      <group ref={ref} position={[f.x, y, f.z]} rotation={[0, f.yaw, 0]}><Body trade={f.trade} seed={seed} /></group>
      {f.name && <NameTag name={f.name} x={f.x} y={y} z={f.z} />}
    </>
  )
}

/** Someone walking their route, legs swinging while they move. */
export function Walking({ w, heights, seed }: { w: Walker; heights?: number[][]; seed: number }) {
  const ref = useRef<THREE.Group>(null)
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime, p = walkerAt(w, t)
    g.position.set(p.x, groundY(heights, p.x, p.z), p.z)
    g.rotation.y = p.yaw
    const swing = p.moving ? Math.sin(t * w.speed * 5.5) * 0.45 : 0
    if (legs[0].current) legs[0].current.rotation.x = swing
    if (legs[1].current) legs[1].current.rotation.x = -swing
  })
  return <group ref={ref}><Body trade={w.trade} seed={seed} legs={legs} /></group>
}

/** Everyone in one zone. */
export function Folk({ standing, walking, heights }: { standing: Figure[]; walking: Walker[]; heights?: number[][] }) {
  const seeds = useMemo(() => new Map([...standing.map(f => f.id), ...walking.map(w => w.id)].map((id, i) => [id, i * 17 + id.length])), [standing, walking])
  return (
    <>
      {standing.map(f => <Standing key={f.id} f={f} heights={heights} seed={seeds.get(f.id)!} />)}
      {walking.map(w => <Walking key={w.id} w={w} heights={heights} seed={seeds.get(w.id)!} />)}
    </>
  )
}
