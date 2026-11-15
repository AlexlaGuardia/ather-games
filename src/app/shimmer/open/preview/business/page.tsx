'use client'
// Dev preview: the six business dressings (economy/tycoon.ts BizKind) on stand-in houses, plus a lot for sale.
// /shimmer/open/preview/business  (?hour=22 for night, ?k=<kind> to look at one close, ?side=1 for the gate side)
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { BusinessDress } from '../../business/business-dress'
import { BIZ_KINDS, type BizKind } from '../../economy/tycoon'
import { FLOOR_H } from '../../towns/plan'

const NAMES: Record<BizKind, string> = { mine: 'Copperlee Mine', smithy: 'Redstair Smithy', manalic_shop: 'Manalic Arms', farm: 'Fernhollow Farm', kitchen: 'The Low Kitchen', cafe: 'Ambervale Café' }
const House = ({ x, w, d, floors }: { x: number; w: number; d: number; floors: number }) => (
  <group position={[x, 0, 0]}>
    <mesh position={[0, (floors * FLOOR_H) / 2 + 0.25, 0]}><boxGeometry args={[w, floors * FLOOR_H, d]} /><meshLambertMaterial color="#d8bf94" /></mesh>
    <mesh position={[0, floors * FLOOR_H + 1.2, 0]} rotation={[0, Math.PI / 2, 0]}><coneGeometry args={[Math.max(w, d) * 0.62, 2.2, 4, 1, false, Math.PI / 4]} /><meshLambertMaterial color="#9c4f34" flatShading /></mesh>
  </group>
)

export default function Page() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const one = q.get('k') as BizKind | null, side = !!q.get('side')
  const kinds = one ? [one] : BIZ_KINDS
  const step = 24, x0 = -((kinds.length) * step) / 2 + step / 2
  const cam: [number, number, number] = one ? (side ? [20, 7, 6] : [6, 7, 20]) : [0, 34, 70]
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas camera={{ position: cam, fov: 50 }}>
        <color attach="background" args={['#a9c6dc']} />
        <hemisphereLight args={['#dfe9f5', '#8a7a5c', 0.9]} />
        <directionalLight position={[30, 40, 20]} intensity={1.6} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[400, 200]} /><meshLambertMaterial color="#b9a173" /></mesh>
        {kinds.map((k, i) => {
          const b = { x: x0 + i * step, z: 0, yaw: Math.PI / 2, w: 10, d: 8, floors: 2, y1: 0 }
          return <group key={k}><House x={b.x} w={b.w} d={b.d} floors={b.floors} /><BusinessDress b={b} kind={k} name={NAMES[k]} owned /></group>
        })}
        {!one && <><House x={x0 + kinds.length * step} w={10} d={8} floors={2} /><BusinessDress b={{ x: x0 + kinds.length * step, z: 0, yaw: Math.PI / 2, w: 10, d: 8, floors: 2, y1: 0 }} kind="mine" forSale price={1200} /></>}
        <OrbitControls target={one ? [0, 3, 0] : [0, 2, 0]} />
      </Canvas>
    </div>
  )
}
