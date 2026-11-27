'use client'
// <FriendModel who /> : Bonn, Otto or Tess, BUILT AS KEEPERS (BETA M154 hub call 11-27): buildKeeper on their look record
// (friend-looks.ts: a Look + their dials + a KeeperDress), posed by poseKeeper like every keeper. `figureMats` stays here for
// the folk / Greg / Momo figures that share the toon ramp (friend-figure.ts moulds).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { folkRamp, type FolkAction } from './folk-model'
import type { FriendId } from './friend-figure'
import { buildKeeper, poseKeeper } from './keeper-figure'
import { FRIEND_LOOKS, friendProportions, friendRecord } from './friend-looks'

let mats: { toon: THREE.MeshToonMaterial; flat: THREE.MeshBasicMaterial } | null = null
export const figureMats = () => (mats ??= { toon: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: folkRamp() }), flat: new THREE.MeshBasicMaterial({ vertexColors: true }) })

export function FriendModel({ who, action = 'idle', seed = 0, speed = 1 }: { who: FriendId; action?: FolkAction; seed?: number; speed?: number }) {
  const body = useMemo(() => buildKeeper(FRIEND_LOOKS[who].look, friendProportions(who), FRIEND_LOOKS[who].dress), [who])
  const t = useRef(seed * 1.3)
  useEffect(() => {
    // read-only probe (scripts/m154-friend-keeper-check.mts): the look record each friend on screen was built from
    const w = window as unknown as { __friendLooks?: Record<string, unknown> }
    w.__friendLooks = { ...(w.__friendLooks ?? {}), [who]: { ...friendRecord(who), keeper: true, height: Math.round(body.height * 1000) / 1000 } }
    return () => { body.group.clear() }   // geometry + materials are shared caches: only the meshes go
  }, [who, body])
  useFrame((_, dt) => { poseKeeper(body, t.current += Math.min(0.05, dt) * speed, action === 'walk' ? 0.6 : 0) })
  return <group userData={{ friend: who }}><primitive object={body.group} /></group>
}
