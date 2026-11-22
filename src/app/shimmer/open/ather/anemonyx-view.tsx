'use client'
// M76 s2: THE ANEMONYX AT THE GREEN'S EDGE (Alex chose (b), Magii b10842a; glossary The Anemonyx, amended for 1672).
// Every 5-10 game days (spirit-seeds.ts › visitDay, counted from the day this keeper's book began) she surfaces in the
// cloud-wall at the edge of the Green, by its gate, and drops one Mana Seed for a keeper who reaches her THAT day. The
// spot is the Green's west edge, the cloud gap between two gardens' islands (cluster.ts: gardens sit on the Green's
// diagonals, so its edge midpoints face open cloud in every frame). She is colossal and a windflower (glossary): drawn as
// a blockout here, a tall stem of light and a ring of slow petals rising out of the cloud. Final look = Alex.
import React, { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getInv, setInv } from '../shared/bag'
import { give } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { GATE } from './plot'
import { MIDDLE_HALF, MIDDLE_Y } from './cluster'
import { GAME_DAY_MS } from './nodes'
import { meetAnemonyx, visitOn, type SeedId } from './spirit-seeds'
import { seenSet } from './grimoire-book'
import { getBook, setBook, useBook } from './spirit-panels'
import { gardenKey } from '@/lib/keeper-local'

/** Where she rises: 8 m out past the Green's west edge, level with the gate. */
export const ANEMONYX = { x: GATE.x - MIDDLE_HALF - 8, z: GATE.z, r: 6 }
/** Per keeper (their garden's save key + the day their book began), so two keepers' visit days differ. */
const salt = () => `${gardenKey('anemonyx')}:${getBook().since ?? 0}`

/** The keeper's day on her calendar (0 = the day their book began); stamps the book's start on first call. */
export function anemonyxDay(now: number): number {
  const abs = Math.floor(now / GAME_DAY_MS), b = getBook()
  if (b.since === undefined) { setBook({ ...b, since: abs }); return 0 }
  return abs - b.since
}
/** Is she at the green today, and not yet met? */
export function anemonyxHere(now: number): boolean {
  const d = anemonyxDay(now), k = visitOn(salt(), d)
  return k !== null && !getBook().met.includes(k)
}
/** E at her: the day's seed into the bag, the visit marked met. */
export function meetToday(now: number): SeedId | null {
  const b = getBook(), m = meetAnemonyx(salt(), anemonyxDay(now), b.met, seenSet(b))
  if (!m) return null
  const g = give(getInv(), m.seed, 1)
  if (g.left) { hudSay('Your bag is full. Make room, she will wait the day.', 'info', 4); return null }
  setInv(g.inv); setBook({ ...getBook(), met: [...b.met, m.k] })
  hudSay('The Anemonyx bows, and a Mana Seed drifts down into your hands.', 'item', 5)   // TODO @lark: her moment's line
  return m.seed
}

export function Anemonyx() {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = clock.elapsedTime
    g.current.rotation.y = t * 0.08
    g.current.position.y = MIDDLE_Y - 6 + Math.sin(t * 0.5) * 0.4
  })
  return (
    <group position={[ANEMONYX.x, MIDDLE_Y - 6, ANEMONYX.z]} ref={g}>
      <mesh position-y={7}><cylinderGeometry args={[0.5, 0.9, 14, 10]} /><meshBasicMaterial color="#f3ecc8" transparent opacity={0.8} /></mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return <mesh key={i} position={[Math.cos(a) * 2.6, 14.2, Math.sin(a) * 2.6]} rotation={[0, -a, 0.6]}><sphereGeometry args={[2.2, 12, 8]} /><meshBasicMaterial color={i % 2 ? '#ffe9f2' : '#fff6dc'} transparent opacity={0.85} /></mesh>
      })}
      <mesh position-y={14.6}><sphereGeometry args={[1.3, 14, 10]} /><meshBasicMaterial color="#ffd27a" /></mesh>
      <pointLight position-y={14} color="#ffe7a0" intensity={1.4} distance={40} />
    </group>
  )
}

/** Her aim capsule for page.tsx's pick list (she is big: a wide capsule whose near side reaches the Green's edge). */
export const anemonyxPick = <T,>(item: T) => ({ x: ANEMONYX.x, z: ANEMONYX.z, y0: MIDDLE_Y - 4, y1: MIDDLE_Y + 14, r: ANEMONYX.r, item })
/** Drawn only on her day and until met: polls the clock every 5 s (a day is 64 min, so that is plenty) and on any book change. */
export function AnemonyxIfHere({ clock }: { clock: () => number }) {
  useBook()
  const [, tick] = React.useState(0)
  React.useEffect(() => { const t = setInterval(() => tick(x => x + 1), 5000); return () => clearInterval(t) }, [])
  return anemonyxHere(clock()) ? <Anemonyx /> : null
}
