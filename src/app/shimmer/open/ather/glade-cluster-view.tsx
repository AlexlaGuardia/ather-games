'use client'
// THE CLOSED GLADE, DRAWN (BETA M67 s1a; ground + islands are page.tsx's PlotScene + ClusterScene on GLADE_FRAME). This file
// draws who lives there: the three friends (Otto, Tess, Bonn in their locked looks, friend-figure.ts), the five Glade
// Moglins (Fennel at her lot in Greg's garden, the rest on the friends' gardens; folk-spots.ts) and the marker over Greg
// (a newborn's first heading). Greg himself is glade-greg.tsx on his bench (s1b-2). `gladeFolkDrawn` is who page.tsx lets
// E talk to. Mount in the 'glade' zone only.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { FOLK_HEIGHT } from '../shared/folk-model'
import { FriendModel } from '../shared/friend-model'
import { isFriend } from '../shared/friend-figure'
import { NamedMoglin } from '../shared/moglin-look-model'
import { gladeKeepers, gregInGlade } from './glade-cluster'
import { GLADE, gladeFolk } from './moonwell-glade'
import { folkSpots, type Spot } from './folk-spots'
import { gladeBlueprintVersion } from './glade-lots'
import { keeperNow } from './network-scene'
import { gladePeopleVersion } from './glade-people'
import { MomoModel } from '../shared/momo-model'
import { GladeGate } from './glade-gate'   // M165
import { MOMO_SEES, momoSpot } from './glade-momo'   // M155 s2

/** the five as drawn right now (Fennel is away while the first-rinstick quest has her at the keeper's Rinnshop) */
export let gladeFolkDrawn: Spot[] = []

/** a slow-turning gold diamond over Greg's head, bobbing: the "go talk to him" marker */
function GregMarker({ ground }: { ground: (x: number, z: number) => number }) {
  const ref = useRef<THREE.Group>(null)
  const GREG = gregInGlade(), y0 = ground(GREG.x, GREG.z) + FOLK_HEIGHT * 0.9 + 0.75
  useFrame(({ clock }) => { const g = ref.current; if (!g) return; const t = clock.elapsedTime; g.rotation.y = t * 1.6; g.position.y = y0 + Math.sin(t * 2.2) * 0.08 })
  return (
    <group ref={ref} position={[GREG.x, y0, GREG.z]} userData={{ gladeMarker: 'greg' }}>
      <mesh scale={[0.22, 0.34, 0.22]}><octahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#f2cf63" toneMapped={false} /></mesh>
    </group>
  )
}

/** M155 s2: Momo by Bonn's boots; he turns to look a keeper over when they come near, else faces the way she does */
function Momo({ ground, blocked, ver }: { ground: (x: number, z: number) => number; blocked?: (x: number, z: number) => boolean; ver: number }) {
  const ref = useRef<THREE.Group>(null)
  const at = useMemo(() => momoSpot(ground, blocked), [ground, blocked, ver])   // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const g = ref.current; if (!g || !at) return
    const dx = keeperNow.x - at.x, dz = keeperNow.z - at.z, d = Math.hypot(dx, dz)
    const want = d < MOMO_SEES && d > 0.4 ? Math.atan2(dx, dz) : at.yaw, off = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y))
    g.rotation.y += off * Math.min(1, dt * 3)
  })
  useEffect(() => { const w = window as unknown as { __glade?: Record<string, unknown> }; w.__glade = { ...(w.__glade ?? {}), momo: at }; return () => { if (w.__glade) delete w.__glade.momo } }, [at])   // READ only (m155 check)
  return at && <group ref={ref} position={[at.x, at.y, at.z]} rotation-y={at.yaw}><MomoModel /></group>
}

export function GladeCluster({ ground, blocked, marker = true }: { ground: (x: number, z: number) => number; blocked?: (x: number, z: number) => boolean; marker?: boolean }) {
  // re-read when a lot's blueprint lands (glade-lots: a blueprint moves its Moglin to the door, setLotSpot): read only at mount,
  // Fennel stood 5.6 m from where the tour + the talk put her (tour-check 11-22). Who is home is read at mount (next visit).
  const [bpVer, setBpVer] = useState(gladeBlueprintVersion())
  useFrame(({ camera }) => {
    // the talk opens on the Moglin NEAREST the keeper (use-folk-talk reads keeperNow); only the Wilds' SettlementFolk wrote it,
    // so in the Glade it was stale and E on Yarrow/Sax/Mallow/Hazel opened Fennel (glade-check, yarrow-teach-check 11-22)
    keeperNow.x = camera.position.x; keeperNow.z = camera.position.z
    const v = gladeBlueprintVersion(); if (v !== bpVer) setBpVer(v)
  })
  // M153 s1c-1: never read at module load: a published move (or a roll back) is followed as soon as the layer lands
  const [ppVer, setPpVer] = useState(gladePeopleVersion())
  useFrame(() => { const v = gladePeopleVersion(); if (v !== ppVer) setPpVer(v) })
  const KEEPERS = useMemo(() => gladeKeepers(), [ppVer]), GREG = useMemo(() => gregInGlade(), [ppVer])   // eslint-disable-line react-hooks/exhaustive-deps
  const FOLK = useMemo(() => folkSpots(GLADE, gladeFolk().map(f => f.id)), [bpVer, ppVer])   // eslint-disable-line react-hooks/exhaustive-deps
  gladeFolkDrawn = FOLK
  // read-only probe (scripts/glade-cluster-check.mts): who the Glade draws and where
  useEffect(() => {
    const w = window as unknown as { __glade?: Record<string, unknown> }   // shared with glade-lots-view's blueprint hook: merge
    w.__glade = { ...(w.__glade ?? {}), keepers: KEEPERS, folk: FOLK, greg: GREG, marker }
    return () => { if (w.__glade) { const { keepers: _k, folk: _f, greg: _g, marker: _m, ...rest } = w.__glade; void _k; void _f; void _g; void _m; if (Object.keys(rest).length) w.__glade = rest; else delete w.__glade }; gladeFolkDrawn = [] }
  }, [marker, FOLK, KEEPERS, GREG])
  return (
    <>
      {KEEPERS.map(k => (
        <group key={k.id} position={[k.x, ground(k.x, k.z), k.z]} rotation-y={k.yaw} userData={{ gladeKeeper: k.id }}>
          {isFriend(k.id) && <FriendModel who={k.id} action="idle" seed={Math.abs(k.x * 0.01)} />}
        </group>
      ))}
      {FOLK.map((f, i) => (
        <group key={f.id} position={[f.x, ground(f.x, f.z), f.z]} rotation-y={f.yaw} userData={{ gladeFolk: f.id }}>
          <NamedMoglin id={f.id} seed={i * 1.7} />
        </group>
      ))}
      <GladeGate />
      <Momo ground={ground} blocked={blocked} ver={ppVer} />
      {marker && <GregMarker ground={ground} />}
    </>
  )
}
