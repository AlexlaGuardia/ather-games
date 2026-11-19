'use client'
// GREGORY AT MOONWELL GLADE (BETA M30 part 2; canon 44bc0c1 + his look dd2f922). He left the keeper's plot: he sits just
// outside his home at the Wilds' front door, in his LOCKED look (shared/folk-model.tsx NAMED_LOOKS.gregory: round, short,
// spectacles, crinkly eyes, waistcoat over shirtsleeves, a pencil behind one ear), on a bench by the pool. E at him is the
// conversation (greg-talk.ts) and, from it, the plot-ground screen. NOT drawn: Blue (spirits are not drawn in the overworld
// in this build). Mount in the Wilds only; `loaded(x, z)` is the ground height or null while his tile is not streamed in.
import { useEffect } from 'react'
import { FolkModel, folkLook } from '../shared/folk-model'
import { gregSpot } from './moonwell-glade'

export const BENCH_H = 0.48
export function GladeGreg({ loaded }: { loaded: (x: number, z: number) => number | null }) {
  const s = gregSpot(), y = loaded(s.x, s.z)
  useEffect(() => {   // checks' hook (like __folk): READ where he stands (only set while he is drawn)
    if (y === null) return
    ;(window as unknown as { __greg?: unknown }).__greg = { x: s.x, z: s.z, y, pose: 'sit', look: 'gregory' }
    return () => { delete (window as unknown as { __greg?: unknown }).__greg }
  }, [y === null])   // eslint-disable-line react-hooks/exhaustive-deps
  if (y === null) return null
  return (
    <group position={[s.x, y, s.z]} rotation-y={s.yaw}>
      {/* a plain bench: seat 0.48 m, two ends */}
      <mesh position={[0, BENCH_H - 0.03, 0.05]}><boxGeometry args={[1.5, 0.06, 0.6]} /><meshLambertMaterial color="#8a6a44" /></mesh>
      {[-0.65, 0.65].map(x => <mesh key={x} position={[x, (BENCH_H - 0.06) / 2, 0.05]}><boxGeometry args={[0.08, BENCH_H - 0.06, 0.5]} /><meshLambertMaterial color="#6f5436" /></mesh>)}
      <FolkModel look={folkLook('gregory')} pose="sit" />
    </group>
  )
}
