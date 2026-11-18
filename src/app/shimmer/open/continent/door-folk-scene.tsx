'use client'
// The talkers outside their doors, drawn (BETA M26; placement + why in door-folk.ts, this file draws it). Only the ones near the keeper are
// mounted (a town's worth at most), re-picked as you walk, so a phone draws a handful of rigs, never the continent's.
import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { FolkModel, folkLook } from '../shared/folk-model'
import { talkersOf, type Talker } from './door-folk'
import type { Region } from '../region'

/** Mount radius (m): past it a talker is not drawn. */
export const DRAW_R = 80

export function DoorFolk({ R, focus, talking }: { R: Region | null; focus: React.MutableRefObject<{ x: number; y?: number; z: number }>; talking?: string | null }) {
  const all = useMemo(() => (R ? talkersOf(R) : []), [R])
  const [near, setNear] = useState<Talker[]>([])
  const acc = useRef(1), sig = useRef('')
  useFrame((_, dt) => {
    if ((acc.current += dt) < 0.75) return
    acc.current = 0
    const f = focus.current, n = all.filter(t => Math.hypot(t.x - f.x, t.z - f.z) < DRAW_R), s = n.map(t => t.key).join('|')
    if (s !== sig.current) { sig.current = s; setNear(n) }
  })
  if (typeof window !== 'undefined') (window as unknown as { __doorFolk?: unknown }).__doorFolk = { all: () => all.map(t => ({ key: t.key, x: t.x, z: t.z })), drawn: () => near.map(t => t.key) }
  return (
    <>
      {near.map((t, i) => (
        <group key={t.key} position={[t.x, t.y, t.z]} rotation-y={t.yaw}>
          <FolkModel look={folkLook(t.look)} action={t.key === talking ? 'talk' : 'idle'} seed={i} />
        </group>
      ))}
    </>
  )
}
