'use client'
// Dev preview: the shop door kit (towns/shop-door.tsx) on stand-in houses of 2, 3 and 4 shader columns, so the
// off-centre door (even cols) is on show. The dark patch behind each door is where the facade shader paints its door:
// the kit's frame should sit round it. Back row lit, front row unlit. /shimmer/open/preview/shop-door (?hour=22 night,
// ?close=1 for one door up close)
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ShopDoor, doorU, DOOR_W, DOOR_H, STEP } from '../../towns/shop-door'
import { FLOOR_H } from '../../towns/plan'

const House = ({ b }: { b: { x: number; z: number; w: number; d: number; floors: number; y1: number } }) => {
  const H = b.floors * FLOOR_H, floor = b.y1 + 0.25
  return (
    <group position={[b.x, floor, b.z]}>
      <mesh position={[0, H / 2, 0]}><boxGeometry args={[b.w, H, b.d]} /><meshLambertMaterial color="#d8bf94" /></mesh>
      <mesh position={[doorU(b.w), DOOR_H / 2, b.d / 2 + 0.005]}><planeGeometry args={[DOOR_W, DOOR_H]} /><meshLambertMaterial color="#4d3020" /></mesh>
      <mesh position={[0, H + 1.2, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[Math.max(b.w, b.d) * 0.75, 2.2, 4]} /><meshLambertMaterial color="#9c4f34" flatShading /></mesh>
    </group>
  )
}

export default function Page() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const close = !!q.get('close'), night = Number(q.get('hour') ?? 12) >= 20 || Number(q.get('hour') ?? 12) < 5
  const widths = [5.4, 8.1, 10.8]
  const houses = [true, false].flatMap((lit, r) => widths.map((w, i) => ({ lit, b: { x: (i - 1) * 16, z: r ? -16 : 0, yaw: Math.PI / 2, w, d: 7, floors: 2, y1: 0 } })))
  const cam: [number, number, number] = close ? [1.2, 2.2, 8] : [0, 12, 26]
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas camera={{ position: cam, fov: 50 }}>
        <color attach="background" args={[night ? '#141a26' : '#a9c6dc']} />
        <hemisphereLight args={[night ? '#3a4560' : '#dfe9f5', '#8a7a5c', night ? 0.35 : 0.9]} />
        <directionalLight position={[30, 40, 20]} intensity={night ? 0.25 : 1.6} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25 - STEP, 0]}><planeGeometry args={[200, 120]} /><meshLambertMaterial color="#b9a173" /></mesh>
        {houses.map(({ lit, b }, i) => <group key={i}><House b={b} /><ShopDoor b={b} lit={lit} /></group>)}
        <OrbitControls target={close ? [doorU(8.1), 1.4, 3.5] : [0, 2, -4]} />
      </Canvas>
    </div>
  )
}
