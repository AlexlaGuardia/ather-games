'use client'
// THE CLOSED GLADE, DRAWN (BETA M67 s1a; ground + islands are page.tsx's PlotScene + ClusterScene on GLADE_FRAME). This file
// draws who lives there: the three friends (Otto, Tess, Bonn as placeholder figures until their looks lock), the five Glade
// Moglins (Fennel at her lot in Greg's garden, the rest on the friends' gardens; folk-spots.ts) and the marker over Greg
// (a newborn's first heading). Greg himself is glade-greg.tsx on his bench (s1b-2). `gladeFolkDrawn` is who page.tsx lets
// E talk to. Mount in the 'glade' zone only.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { FolkModel, folkLook, FOLK_HEIGHT } from '../shared/folk-model'
import { MoglinModel, furOf } from '../shared/moglin-model'
import { gladeKeepers, gregInGlade } from './glade-cluster'
import { GLADE, gladeFolk } from './moonwell-glade'
import { folkSpots, type Spot } from './folk-spots'
import { gladeBlueprintVersion } from './glade-lots'
import { keeperNow } from './network-scene'

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
  // re-read when a lot's blueprint lands (glade-lots: a blueprint moves its Moglin to the door, setLotSpot): read only at mount,
  // Fennel stood 5.6 m from where the tour + the talk put her (tour-check 11-22). Who is home is read at mount (next visit).
  const [bpVer, setBpVer] = useState(gladeBlueprintVersion())
  useFrame(({ camera }) => {
    // the talk opens on the Moglin NEAREST the keeper (use-folk-talk reads keeperNow); only the Wilds' SettlementFolk wrote it,
    // so in the Glade it was stale and E on Yarrow/Sax/Mallow/Hazel opened Fennel (glade-check, yarrow-teach-check 11-22)
    keeperNow.x = camera.position.x; keeperNow.z = camera.position.z
    const v = gladeBlueprintVersion(); if (v !== bpVer) setBpVer(v)
  })
  const FOLK = useMemo(() => folkSpots(GLADE, gladeFolk().map(f => f.id)), [bpVer])   // eslint-disable-line react-hooks/exhaustive-deps
  gladeFolkDrawn = FOLK
  // read-only probe (scripts/glade-cluster-check.mts): who the Glade draws and where
  useEffect(() => {
    const w = window as unknown as { __glade?: Record<string, unknown> }   // shared with glade-lots-view's blueprint hook: merge
    w.__glade = { ...(w.__glade ?? {}), keepers: KEEPERS, folk: FOLK, greg: GREG, marker }
    return () => { if (w.__glade) { const { keepers: _k, folk: _f, greg: _g, marker: _m, ...rest } = w.__glade; void _k; void _f; void _g; void _m; if (Object.keys(rest).length) w.__glade = rest; else delete w.__glade }; gladeFolkDrawn = [] }
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
