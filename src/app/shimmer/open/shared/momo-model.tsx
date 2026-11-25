'use client'
// <MomoModel /> (momo-figure.ts): MOMO_CALLS draw calls. He breathes, slow and small, and nothing else. No light: at rest, just the eyes.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { figureMats } from './friend-model'
import { MOMO_COLOR, momoFigure } from './momo-figure'

let mats: { ink: THREE.MeshBasicMaterial; paint: THREE.MeshBasicMaterial } | null = null
const momoMats = () => (mats ??= { ink: new THREE.MeshBasicMaterial({ color: MOMO_COLOR.ink, side: THREE.BackSide }), paint: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }) })

export function MomoModel({ still = false }: { still?: boolean }) {
  const f = momoFigure(), m = momoMats(), root = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { const g = root.current; if (g && !still) { const b = Math.sin(clock.elapsedTime * 1.5) * 0.012; g.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5) } })
  return (
    <group ref={root} userData={{ momo: true }}>
      <mesh geometry={f.toon} material={figureMats().toon} /><mesh geometry={f.ink} material={m.ink} /><mesh geometry={f.paint} material={m.paint} />
    </group>
  )
}
