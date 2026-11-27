'use client'
// M229 s1: the hook every NPC rig mounts (rules in npc-face.ts). `turn` goes on a group wrapping the whole figure (the body's turn,
// under the placing code's own rotation); after the rig poses its head each frame, call `head(obj)`: it adds the head's turn on top
// of the pose (poseFolk sets the head's yaw each frame; the Moglin and keeper rigs never touch it, so it is set, not added, there).
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FACE_REST, TALK_WALKED_OFF, atRest, claimTalk, faceStep, releaseTalk, talkAt, wantToward, wrapAngle, type FaceState } from './npc-face'

const P = new THREE.Vector3(), Z = new THREE.Vector3()

/** read-only probe (scripts/m229-npc-face-check.mts): the figure the talk is on, where it faces and where the keeper is */
type Probe = { x: number; z: number; rest: number; body: number; head: number; face: number; toKeeper: number; err: number; kind: string }
const probe = (p: Probe | null, kind: string) => {
  if (typeof window === 'undefined') return
  const w = window as unknown as { __npcFace?: Record<string, Probe | null> }
  w.__npcFace = { ...(w.__npcFace ?? {}), [kind]: p }
}

export function useNpcFace(kind: string, seated = false) {
  const turn = useRef<THREE.Group>(null)
  const s = useRef<FaceState>(FACE_REST), me = useRef({}), headSet = useRef(0), was = useRef(false)
  useEffect(() => () => { releaseTalk(me.current) }, [])
  useFrame(({ camera }, dt) => {
    const g = turn.current; if (!g?.parent) return
    if (!talkAt() && atRest(s.current)) { if (g.rotation.y !== 0) g.rotation.y = 0; headSet.current = 0; return }
    g.parent.getWorldPosition(P)
    Z.set(0, 0, 1).transformDirection(g.parent.matrixWorld)
    const rest = Math.atan2(Z.x, Z.z), keeper = { x: camera.position.x, z: camera.position.z }
    const mine = claimTalk(me.current, P.x, P.z) && Math.hypot(keeper.x - P.x, keeper.z - P.z) < TALK_WALKED_OFF
    const want = mine ? wantToward(P, rest, keeper) : null
    s.current = faceStep(s.current, want, dt, seated)
    g.rotation.y = s.current.body
    headSet.current = s.current.head
    if (mine || was.current) {
      const face = rest + s.current.body + s.current.head, to = Math.atan2(keeper.x - P.x, keeper.z - P.z)
      probe({ x: P.x, z: P.z, rest, body: s.current.body, head: s.current.head, face: wrapAngle(face), toKeeper: to, err: Math.abs(wrapAngle(face - to)) * 180 / Math.PI, kind }, kind)
      was.current = mine || !atRest(s.current)
    }
  })
  /** after the pose: `add` = the rig set the head's yaw this frame (poseFolk), else the yaw is ours alone */
  const head = (o: THREE.Object3D | null | undefined, add = false) => { if (!o) return; if (add) o.rotation.y += headSet.current; else o.rotation.y = headSet.current }
  return { turn, head }
}
