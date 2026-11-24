'use client'
// BETA M127 s1 (play, 2026-11-24): the spirits WALKING WITH the keeper, drawn in the WILDS (canon 8b45c92: they may walk with
// the keeper anywhere in the Ather; until now they were drawn on the plot only). Same model, same trot, same M126 formation:
// only her ground is the Wilds'. What she does in a fight = shared/spirit-fight.ts.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { GROWN } from '../../sprites/creature-size'
import type { Species } from '../../spirits/spirit'
import { bodyRadius } from './obstacles'
import { structFree, type Terrain } from './combat'
import { followIds, spiritLive, subscribeFollow } from './spirit-follow'
import { speciesOf } from './spirit-seeds'
import { spiritModelFor, type SpiritLook } from './spirit-models'
import { SpiritOnPlanter } from './spirit-model'
import { useBook } from './spirit-panels'
import { formationSlot } from '../shared/follow-formation'
import type { SpiritNav } from './spirit-trot'

/** THE ONE SWITCH (M127): spirits come along into the Wilds and may help in a fight. EVERY keeper's since 11-24 (Alex: "flip it
 *  for everyone"; it was the owner check). */
export function useSpiritFight(): boolean { return true }

const EMPTY: readonly string[] = []
const LOST = 30   // m: left this far behind (a waymark, a fall) she is set down beside the keeper again
type Pose = { x: number; z: number; yaw: number }

export function WildsSpirits({ T, keeper }: { T: Terrain; keeper: React.MutableRefObject<Pose> }) {
  const ids = useSyncExternalStore(subscribeFollow, followIds, () => EMPTY), b = useBook()
  return <>{ids.map(id => { const p = b.pots[id]; if (!p?.bloomed) return null
    const sp = speciesOf(p.seed), look = spiritModelFor(sp)
    return look && sp ? <Walker key={id} id={id} sp={sp} look={look} T={T} keeper={keeper} /> : null   // no 3D model yet (the gold orb): she stays home, as on the plot
  })}</>
}

function Walker({ id, sp, look, T, keeper }: { id: string; sp: Species; look: SpiritLook; T: Terrain; keeper: React.MutableRefObject<Pose> }) {
  const g = useRef<THREE.Group>(null), [born, setBorn] = useState(0)
  const ground = useRef(T); ground.current = T
  const nav = useMemo<SpiritNav>(() => {
    const k = keeper.current, s = formationSlot(id), r = bodyRadius(GROWN[sp] ?? { height: 0.5 }), tall = GROWN[sp]?.height ?? 0.5
    // a set-down: behind the keeper, on ground she may stand on, else where they stand
    const back = s && Math.hypot(s.x - k.x, s.z - k.z) < 6 ? { x: s.x, z: s.z } : { x: k.x + Math.sin(k.yaw) * 2.3, z: k.z + Math.cos(k.yaw) * 2.3 }
    const blocked = (x: number, z: number) => { const G = ground.current; return !G.walkable(x, z) || !(structFree(G, keeper.current, r, tall)?.(x, z) ?? true) }
    return { home: blocked(back.x, back.z) ? { x: k.x, z: k.z } : back, rMin: 0, rMax: 0.4, blocked }
  }, [id, sp, born])   // eslint-disable-line react-hooks/exhaustive-deps
  const at = useRef(0)
  useEffect(() => { at.current = 0 }, [born])
  useFrame((_, dt) => {
    const s = spiritLive.get(id), k = keeper.current, p = s && Date.now() - s.at < 500 ? s : nav.home
    const y = ground.current.heightAt(p.x, p.z); if (g.current && Number.isFinite(y)) g.current.position.y = y
    at.current += dt
    if (s && at.current > 1 && Math.hypot(s.x - k.x, s.z - k.z) > LOST) { at.current = 0; setBorn(n => n + 1) }
  })
  return <group ref={g} key={born}><SpiritOnPlanter sp={sp} look={look} y={0} fallback={null} nav={nav} id={id} dev /></group>
}
