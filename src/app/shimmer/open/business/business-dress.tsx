'use client'
// A KEEPER'S BUSINESS on the waking continent: the dressing a bought lot gains over the town kit's house (Alex 11-15:
// up to 5 buildings, chains like mine → smithy → manalic shop). The house stays the kit's (walls, roof, collision via
// foot-solids); this adds what makes it read as that trade, its name board, and THE GATE.
//
// ★ THE GATE (Alex 11-15, CANON_GAPS tycoon entry Q1, athernyx 0b935aa): "the mogling dont work in the business, if the
//   player buys a business it gets a gate that the moglin can drop off or recieve goods". Canon has the shape already:
//   the Spirit Corner's link to the garden IS its shopfront door (gates.md, 08-24), a door tuned to a place. So the gate
//   here is a goods door in the side wall with a lit gate-rune over it and crates waiting by it.
//   ⚠ PLACEHOLDER LOOK: its look and name are Magii's to rule (dbr'd 11-15). Swap `Gate` when it lands.
//
// Mount: <BusinessDress b={building} kind="mine" name="Kettle Hill Mine" owned /> (kind: economy/tycoon.ts BizKind), where b is a towns/plan.ts Building.
// An unowned lot for sale: <BusinessDress b kind forSale price={1200} /> (board, no gate, no trade dressing).
// Trade dressing is build (Jin's): generic filler from the world's own lines (rune-hold.md: soot, forge glow, steam).

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FLOOR_H, type Building } from '../towns/plan'
import { dayProgress, daylight } from '../../engine/day-cycle'

import type { BizKind } from '../economy/tycoon'

const TIMBER = '#5a3d26', TIMBER_OLD = '#6b5038', STONE = '#7d7366', IRON_FREE = '#4a4038'
/** the gate-rune's light: the map's waymark teal, the colour the game already uses for a bound point */
const RUNE = '#6fd3c4'

function boardTexture(text: string, sub?: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#3b2617'; g.fillRect(0, 0, 512, 160)
  g.strokeStyle = '#c99a4b'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 144)
  g.fillStyle = '#f1d08a'; g.textAlign = 'center'; g.textBaseline = 'middle'
  let px = 54
  do { g.font = `700 ${px}px Georgia, 'Times New Roman', serif`; px -= 2 } while (g.measureText(text.toUpperCase()).width > 460 && px > 18)
  g.fillText(text.toUpperCase(), 256, sub ? 62 : 80)
  if (sub) { g.font = `600 30px Georgia, serif`; g.fillStyle = '#e0b870'; g.fillText(sub, 256, 116) }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

function Board({ text, sub, at, w = 3.4 }: { text: string; sub?: string; at: [number, number, number]; w?: number }) {
  const tex = useMemo(() => boardTexture(text, sub), [text, sub])
  useEffect(() => () => tex.dispose(), [tex])
  return <mesh position={at}><planeGeometry args={[w, w * 0.3125]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
}

const Crate = ({ p, s = 0.8, c = '#9a7a4e' }: { p: [number, number, number]; s?: number; c?: string }) => (
  <group position={p}>
    <mesh position={[0, s / 2, 0]}><boxGeometry args={[s, s, s]} /><meshLambertMaterial color={c} flatShading /></mesh>
    <mesh position={[0, s / 2, s / 2 + 0.01]}><planeGeometry args={[s * 0.9, 0.08]} /><meshBasicMaterial color={TIMBER} /></mesh>
  </group>
)

/** the goods gate (PLACEHOLDER look): a door in the side wall, a gate-rune plate over it that breathes, crates by it */
function Gate({ at, rotY }: { at: [number, number, number]; rotY: number }) {
  const rune = useRef<THREE.MeshBasicMaterial>(null)
  const halo = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const k = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 1.6)
    if (rune.current) rune.current.opacity = 0.65 + 0.35 * k
    if (halo.current) halo.current.opacity = 0.12 + 0.12 * k
  })
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      <mesh position={[0, 1.25, 0]}><planeGeometry args={[1.8, 2.5]} /><meshLambertMaterial color="#2e2118" /></mesh>
      {[-1.0, 1.0].map(x => <mesh key={x} position={[x, 1.35, 0.06]}><boxGeometry args={[0.22, 2.7, 0.18]} /><meshLambertMaterial color={TIMBER} /></mesh>)}
      <mesh position={[0, 2.72, 0.06]}><boxGeometry args={[2.3, 0.24, 0.2]} /><meshLambertMaterial color={TIMBER} /></mesh>
      {/* the gate-rune: a lit plate over the door (a door tuned to the garden) */}
      <mesh position={[0, 3.2, 0.08]}><circleGeometry args={[0.36, 20]} /><meshBasicMaterial ref={halo} color={RUNE} transparent opacity={0.2} toneMapped={false} /></mesh>
      <mesh position={[0, 3.2, 0.1]}><ringGeometry args={[0.2, 0.27, 20]} /><meshBasicMaterial ref={rune} color={RUNE} transparent toneMapped={false} /></mesh>
      <mesh position={[0, 3.2, 0.11]}><planeGeometry args={[0.06, 0.34]} /><meshBasicMaterial color={RUNE} toneMapped={false} /></mesh>
      {/* the drop: a pallet with crates waiting either way through the door */}
      <mesh position={[1.9, 0.07, 0.9]}><boxGeometry args={[1.8, 0.14, 1.3]} /><meshLambertMaterial color={TIMBER_OLD} /></mesh>
      <Crate p={[1.5, 0.14, 0.9]} /><Crate p={[2.35, 0.14, 0.9]} s={0.7} c="#a88858" /><Crate p={[1.9, 0.94, 0.85]} s={0.65} c="#8f6f45" />
    </group>
  )
}

/** a mine's yard: a timber headframe with its wheel behind the house, a spoil heap, an ore cart on a stub of track */
function MineDress({ w, d, H }: { w: number; d: number; H: number }) {
  const hx = -w * 0.15, hz = -d / 2 - 3.2, th = H + 4.5
  return (
    <group>
      <group position={[hx, 0, hz]}>
        {[[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].map(([x, z], i) => (
          <mesh key={i} position={[x * 0.6, th / 2, z * 0.6]} rotation={[-z * 0.07, 0, x * 0.07]}><boxGeometry args={[0.3, th, 0.3]} /><meshLambertMaterial color={TIMBER} /></mesh>
        ))}
        {[0.3, 0.6].map(f => <mesh key={f} position={[0, th * f, 0]}><boxGeometry args={[2.0, 0.18, 2.0]} /><meshLambertMaterial color={TIMBER_OLD} /></mesh>)}
        <mesh position={[0, th + 0.2, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[1.0, 0.12, 6, 20]} /><meshLambertMaterial color={IRON_FREE} /></mesh>
        <mesh position={[0, th + 0.2, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 0.5, 8]} /><meshLambertMaterial color={TIMBER} /></mesh>
        <mesh position={[0, 0.15, 0]}><boxGeometry args={[2.4, 0.3, 2.4]} /><meshLambertMaterial color="#1e1a16" /></mesh>
      </group>
      <mesh position={[-w / 2 - 3.2, 1.0, -d * 0.25]}><coneGeometry args={[2.8, 2.0, 9]} /><meshLambertMaterial color="#6e6458" flatShading /></mesh>
      <group position={[w * 0.3, 0, d / 2 + 2.2]}>
        {[-0.45, 0.45].map(x => <mesh key={x} position={[x, 0.04, 0]}><boxGeometry args={[0.08, 0.08, 4.5]} /><meshLambertMaterial color="#5c4a3a" /></mesh>)}
        <mesh position={[0, 0.55, 0.4]}><boxGeometry args={[1.1, 0.7, 1.5]} /><meshLambertMaterial color={TIMBER_OLD} flatShading /></mesh>
        <mesh position={[0, 0.95, 0.4]}><boxGeometry args={[0.95, 0.25, 1.3]} /><meshLambertMaterial color="#8b8478" flatShading /></mesh>
      </group>
    </group>
  )
}

/** a smithy: a stone forge chimney with steam, a glowing hearth in the front, an anvil block and a quench barrel */
function SmithyDress({ w, d, H }: { w: number; d: number; H: number }) {
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const steam = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (glow.current) glow.current.color.setRGB(1, 0.42 + 0.12 * Math.sin(t * 5.1) * Math.sin(t * 1.7), 0.15)
    steam.current?.children.forEach((m, i) => { const f = (t * 0.25 + i / 3) % 1; m.position.y = f * 3.2; m.scale.setScalar(0.6 + f * 1.2); ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - f) })
  })
  return (
    <group>
      <group position={[w * 0.3, 0, -d * 0.2]}>
        <mesh position={[0, (H + 3.2) / 2, 0]}><boxGeometry args={[1.5, H + 3.2, 1.5]} /><meshLambertMaterial color={STONE} flatShading /></mesh>
        <group ref={steam} position={[0, H + 3.4, 0]}>
          {[0, 1, 2].map(i => <mesh key={i}><sphereGeometry args={[0.55, 8, 6]} /><meshBasicMaterial color="#e6e2da" transparent opacity={0.3} depthWrite={false} /></mesh>)}
        </group>
      </group>
      <mesh position={[-w * 0.22, 0.75, d / 2 + 0.03]}><planeGeometry args={[1.6, 1.2]} /><meshBasicMaterial ref={glow} color="#ff6a26" toneMapped={false} /></mesh>
      <mesh position={[-w * 0.22, 1.5, d / 2 + 0.06]}><boxGeometry args={[2.0, 0.22, 0.2]} /><meshLambertMaterial color={STONE} /></mesh>
      <group position={[w * 0.12, 0, d / 2 + 1.6]}>
        <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.35, 0.42, 0.7, 10]} /><meshLambertMaterial color={TIMBER_OLD} /></mesh>
        <mesh position={[0, 0.82, 0]}><boxGeometry args={[0.9, 0.24, 0.36]} /><meshLambertMaterial color="#3e3a36" /></mesh>
      </group>
      <group position={[w * 0.32, 0, d / 2 + 1.4]}>
        <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.45, 0.4, 0.9, 12]} /><meshLambertMaterial color={TIMBER} /></mesh>
        <mesh position={[0, 0.88, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.4, 12]} /><meshLambertMaterial color="#3d4f55" /></mesh>
      </group>
    </group>
  )
}

/** a manalic shop: a wide display window with racked long-arms in silhouette, an awning, a mana-lamp by the door */
function ManalicDress({ w, d }: { w: number; d: number }) {
  const lamp = useRef<THREE.MeshBasicMaterial>(null)
  const win = useMemo(() => new THREE.MeshBasicMaterial({ color: '#5b4a35', toneMapped: false }), [])
  useEffect(() => () => win.dispose(), [win])
  const DAY = useMemo(() => new THREE.Color('#5b4a35'), []), NIGHT = useMemo(() => new THREE.Color('#ffd08a'), [])
  useFrame(({ clock }) => {
    win.color.copy(DAY).lerp(NIGHT, 1 - daylight(dayProgress()))
    if (lamp.current) lamp.current.color.setRGB(0.6, 0.85 + 0.1 * Math.sin(clock.elapsedTime * 2.3), 1)
  })
  const ww = Math.min(w * 0.55, 6), racks = Math.max(3, Math.round(ww / 0.9))
  return (
    <group position={[0, 0, d / 2]}>
      <mesh position={[-w * 0.12, 1.5, 0.03]} material={win}><planeGeometry args={[ww, 1.7]} /></mesh>
      {Array.from({ length: racks }, (_, i) => (
        <group key={i} position={[-w * 0.12 - ww / 2 + (i + 0.5) * (ww / racks), 1.45, 0.05]} rotation={[0, 0, i % 2 ? -0.42 : 0.42]}>
          <mesh><planeGeometry args={[0.08, 1.15]} /><meshBasicMaterial color="#2a2018" /></mesh>
          <mesh position={[0, -0.5, 0]}><planeGeometry args={[0.22, 0.3]} /><meshBasicMaterial color="#3a2a1e" /></mesh>
        </group>
      ))}
      <mesh position={[-w * 0.12, 2.55, 0.06]}><boxGeometry args={[ww + 0.4, 0.18, 0.18]} /><meshLambertMaterial color={TIMBER} /></mesh>
      <mesh position={[-w * 0.12, 0.62, 0.06]}><boxGeometry args={[ww + 0.4, 0.18, 0.22]} /><meshLambertMaterial color={TIMBER} /></mesh>
      <mesh position={[-w * 0.12, 2.95, 0.75]} rotation={[0.38, 0, 0]}><boxGeometry args={[ww + 0.8, 0.08, 1.7]} /><meshLambertMaterial color="#3f5a6a" /></mesh>
      <mesh position={[w * 0.32, 2.1, 0.25]}><boxGeometry args={[0.26, 0.38, 0.26]} /><meshBasicMaterial ref={lamp} color="#bfe0ff" toneMapped={false} /></mesh>
    </group>
  )
}

/** a farm: a fenced plot of crop rows beside the house, a hay stack, a water butt */
function FarmDress({ w, d }: { w: number; d: number }) {
  const px = -w / 2 - 4.5, pw = 7, pd = Math.max(d, 8)
  return (
    <group>
      <group position={[px, 0, 0]}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[pw, pd]} /><meshLambertMaterial color="#6b5236" /></mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[-pw / 2 + 0.9 + i * ((pw - 1.8) / 4), 0.28, 0]}><boxGeometry args={[0.5, 0.5, pd - 1.2]} /><meshLambertMaterial color={i % 2 ? '#7f9a46' : '#93a84f'} flatShading /></mesh>
        ))}
        {[[-pw / 2, 0, 0.08, pd], [pw / 2, 0, 0.08, pd], [0, -pd / 2, pw, 0.08], [0, pd / 2, pw, 0.08]].map(([x, z, sx, sz], i) => (
          <mesh key={i} position={[x, 0.55, z]}><boxGeometry args={[sx, 0.08, sz]} /><meshLambertMaterial color={TIMBER_OLD} /></mesh>
        ))}
      </group>
      <mesh position={[w / 2 + 1.6, 0.8, -d * 0.3]}><cylinderGeometry args={[1.1, 1.3, 1.6, 10]} /><meshLambertMaterial color="#c9a85a" flatShading /></mesh>
      <mesh position={[w / 2 + 1.6, 1.8, -d * 0.3]}><coneGeometry args={[1.15, 0.8, 10]} /><meshLambertMaterial color="#b8964c" flatShading /></mesh>
    </group>
  )
}

/** a kitchen: a stone flue with cook smoke, sacks and barrels of what comes in by the door */
function KitchenDress({ w, d, H }: { w: number; d: number; H: number }) {
  const smoke = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    smoke.current?.children.forEach((m, i) => { const f = (t * 0.18 + i / 3) % 1; m.position.set(f * 0.8, f * 3, 0); m.scale.setScalar(0.5 + f * 1.4); ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - f) })
  })
  return (
    <group>
      <mesh position={[-w * 0.3, (H + 2.6) / 2, -d * 0.25]}><boxGeometry args={[1.1, H + 2.6, 1.1]} /><meshLambertMaterial color={STONE} flatShading /></mesh>
      <group ref={smoke} position={[-w * 0.3, H + 2.8, -d * 0.25]}>
        {[0, 1, 2].map(i => <mesh key={i}><sphereGeometry args={[0.5, 8, 6]} /><meshBasicMaterial color="#9a948c" transparent opacity={0.3} depthWrite={false} /></mesh>)}
      </group>
      {[[0.25, 1.3], [0.38, 1.9], [0.3, 2.5]].map(([x, z], i) => (
        <mesh key={i} position={[w * x, 0.45, d / 2 + z * 0.6]}><cylinderGeometry args={[0.38, 0.38, 0.9, 10]} /><meshLambertMaterial color={TIMBER} /></mesh>
      ))}
      {[[-0.05, 1.2], [0.06, 1.5]].map(([x, z], i) => (
        <mesh key={`s${i}`} position={[w * x, 0.32, d / 2 + z]} scale={[1, 0.75, 0.8]}><sphereGeometry args={[0.45, 8, 6]} /><meshLambertMaterial color="#c8b48a" flatShading /></mesh>
      ))}
    </group>
  )
}

/** a café: a striped awning over the front, two small tables with stools out on the street */
function CafeDress({ w, d }: { w: number; d: number }) {
  return (
    <group position={[0, 0, d / 2]}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-w * 0.35 + (i + 0.5) * (w * 0.7 / 6), 2.75, 0.8]} rotation={[0.4, 0, 0]}><boxGeometry args={[w * 0.7 / 6, 0.06, 1.8]} /><meshLambertMaterial color={i % 2 ? '#e8dcc0' : '#a8553a'} /></mesh>
      ))}
      {[-w * 0.2, w * 0.2].map(x => (
        <group key={x} position={[x, 0, 2.6]}>
          <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.5, 0.5, 0.06, 12]} /><meshLambertMaterial color={TIMBER_OLD} /></mesh>
          <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.06, 0.08, 0.72, 6]} /><meshLambertMaterial color={TIMBER} /></mesh>
          {[-0.75, 0.75].map(sx => <mesh key={sx} position={[sx, 0.24, 0]}><cylinderGeometry args={[0.2, 0.2, 0.48, 8]} /><meshLambertMaterial color={TIMBER} /></mesh>)}
        </group>
      ))}
    </group>
  )
}

export function BusinessDress({ b, kind, name, owned = false, forSale = false, price }: {
  b: Pick<Building, 'x' | 'z' | 'yaw' | 'w' | 'd' | 'floors' | 'y1'>
  kind: BizKind; name?: string; owned?: boolean; forSale?: boolean; price?: number
}) {
  // the street face is local +z (plan.ts yaw → rotation.y = π/2 − yaw), the same frame Towns.tsx dresses fronts in
  const ry = Math.PI / 2 - b.yaw, floor = b.y1 + 0.25, H = b.floors * FLOOR_H
  return (
    <group position={[b.x, floor, b.z]} rotation={[0, ry, 0]}>
      {forSale && !owned && (
        <group position={[b.w / 2 - 0.6, 0, b.d / 2 + 1.6]}>
          <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.14, 1.8, 0.14]} /><meshLambertMaterial color={TIMBER} /></mesh>
          <Board text="For sale" sub={price !== undefined ? `${price.toLocaleString()} Marks` : undefined} at={[0, 1.75, 0.09]} w={1.9} />
        </group>
      )}
      {owned && (
        <>
          {name && <Board text={name} at={[0, Math.min(H - 0.5, 4.3), b.d / 2 + 0.08]} />}
          {kind === 'mine' && <MineDress w={b.w} d={b.d} H={H} />}
          {kind === 'smithy' && <SmithyDress w={b.w} d={b.d} H={H} />}
          {kind === 'manalic_shop' && <ManalicDress w={b.w} d={b.d} />}
          {kind === 'farm' && <FarmDress w={b.w} d={b.d} />}
          {kind === 'kitchen' && <KitchenDress w={b.w} d={b.d} H={H} />}
          {kind === 'cafe' && <CafeDress w={b.w} d={b.d} />}
          {/* the gate on the house's right-hand side wall, facing out along +x */}
          <Gate at={[b.w / 2 + 0.03, 0, b.d * 0.05]} rotY={Math.PI / 2} />
        </>
      )}
    </group>
  )
}
