'use client'
// Greg's home at Moonwell Glade, drawn (BETA M30): a stone drum with a timber band, a round door facing the pool, one
// window, a domed turf-and-thatch roof. Code blockout in the Glade's toon look (shared toon ramp via MeshToonMaterial would
// need the rig's ramp, so plain Lambert + an ink hull). No names, no signage. Collision: glade-home.ts via dynamic-solids.
import * as THREE from 'three'
import { gladeHome, HOME_R, HOME_H } from './glade-home'
import { PAD_FALL } from './glade-pads'
import { gladePlace } from './glade-people'

const CYL = new THREE.CylinderGeometry(1, 1, 1, 20), DOME = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), DISC = new THREE.CircleGeometry(1, 20)
const ink = new THREE.MeshBasicMaterial({ color: '#1b140e', side: THREE.BackSide })
export function GladeHome({ y }: { y: number }) {
  const h = gladeHome(), R = HOME_R, wall = HOME_H - 0.9
  return (
    <group position={[h.x, y, h.z]} rotation-y={h.yaw}>
      <mesh geometry={CYL} position={[0, wall / 2, 0]} scale={[R * 1.03, wall, R * 1.03]}><meshLambertMaterial color="#a9a294" /></mesh>
      <mesh geometry={CYL} position={[0, wall / 2, 0]} scale={[R * 1.1, wall, R * 1.1]} material={ink} />
      {/* moved onto a slope: the drum's foot reaches down to the low side */}
      {gladePlace('home') && <mesh geometry={CYL} position={[0, -PAD_FALL / 2, 0]} scale={[R * 1.02, PAD_FALL, R * 1.02]}><meshLambertMaterial color="#a9a294" /></mesh>}
      <mesh geometry={CYL} position={[0, 0.55, 0]} scale={[R * 1.07, 0.18, R * 1.07]}><meshLambertMaterial color="#8a6a44" /></mesh>
      <mesh geometry={CYL} position={[0, wall - 0.1, 0]} scale={[R * 1.07, 0.18, R * 1.07]}><meshLambertMaterial color="#8a6a44" /></mesh>
      <mesh geometry={DOME} position={[0, wall, 0]} scale={[R * 1.3, 1.0, R * 1.3]}><meshLambertMaterial color="#7b8a52" /></mesh>
      <mesh geometry={DOME} position={[0, wall, 0]} scale={[R * 1.38, 1.07, R * 1.38]} material={ink} />
      {/* the front faces +z (toward the pool): a round door and one window */}
      <mesh geometry={DISC} position={[0, 0.8, R * 1.04]} scale={[0.62, 0.8, 1]}><meshLambertMaterial color="#5a3d22" /></mesh>
      <mesh geometry={DISC} position={[-1.0, 1.7, R * 0.87]} rotation-y={-0.5} scale={0.28}><meshBasicMaterial color="#ffd98a" /></mesh>
      {/* a flat doorstep stone */}
      <mesh geometry={CYL} position={[0, 0.03, R * 1.4]} scale={[0.7, 0.06, 0.5]}><meshLambertMaterial color="#8d887c" /></mesh>
    </group>
  )
}
