'use client'
// THE CLOSED GLADE, DRAWN (BETA M67 s1a; ground + islands are page.tsx's PlotScene + ClusterScene on GLADE_FRAME). This file
// draws who lives there: the three friends (Otto, Tess, Bonn as placeholder figures until their looks lock), the five Glade
// Moglins (Fennel at her lot in Greg's garden, the rest on the friends' gardens; folk-spots.ts) and the marker over Greg
// (a newborn's first heading). Greg himself is glade-greg.tsx on his bench (s1b-2). `gladeFolkDrawn` is who page.tsx lets
// E talk to. Mount in the 'glade' zone only.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { FolkModel, folkLook, FOLK_HEIGHT } from '../shared/folk-model'
import { MoglinModel, furOf } from '../shared/moglin-model'
import { gladeKeepers, gregInGlade } from './glade-cluster'
import { GLADE, gladeFolk } from './moonwell-glade'
import { folkSpots, type Spot } from './folk-spots'

const KEEPERS = gladeKeepers(), GREG = gregInGlade()
/** the five as drawn right now (Fennel is away while the first-rinstick quest has her at the keeper's Rinnshop) */
export let gladeFolkDrawn: Spot[] = []

/** a slow-turning gold diamond over Greg's head, bobbing: the "go talk to him" marker */
function GregMarker({ ground }: { ground: (x: number, z: number) => number }) {
  const ref = useRef<THREE.Group>(null)
  const y0 = ground(GREG.x, GREG.z) + FOLK_HEIGHT * 0.9 + 0.75
  useFrame(({ clock }) => { const g = ref.current; if (!g) return; const t = clock.elapsedTime; g.rotation.y = t * 1.6; g.position.y = y0 + Math.sin(t * 2.2) * 0.08 })
  return (
    <group ref={ref} position={[GREG.x, y0, GREG.z]} userData={{ gladeMarker: 'greg' }}>
      <mesh scale={[0.22, 0.34, 0.22]}><octahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#f2cf63" toneMapped={false} /></mesh>
    </group>
  )
}

export function GladeCluster({ ground, marker = true }: { ground: (x: number, z: number) => number; marker?: boolean }) {
  const FOLK = useMemo(() => folkSpots(GLADE, gladeFolk().map(f => f.id)), [])   // read at mount: a quest that starts shows on the next visit
  gladeFolkDrawn = FOLK
  // read-only probe (scripts/glade-cluster-check.mts): who the Glade draws and where
  useEffect(() => {
    const w = window as unknown as { __glade?: unknown }
    w.__glade = { keepers: KEEPERS, folk: FOLK, greg: GREG, marker }
    return () => { delete w.__glade; gladeFolkDrawn = [] }
  }, [marker, FOLK])
  return (
    <>
      {KEEPERS.map(k => (
        <group key={k.id} position={[k.x, ground(k.x, k.z), k.z]} rotation-y={k.yaw} userData={{ gladeKeeper: k.id }}>
          <FolkModel look={folkLook(`glade-${k.id}`)} action="idle" seed={k.x * 0.01} />
        </group>
      ))}
      {FOLK.map((f, i) => (
        <group key={f.id} position={[f.x, ground(f.x, f.z), f.z]} rotation-y={f.yaw} userData={{ gladeFolk: f.id }}>
          <MoglinModel build="chibi" action="idle" tone={furOf(f.id)} seed={i * 1.7} />
        </group>
      ))}
      {marker && <GregMarker ground={ground} />}
    </>
  )
}
