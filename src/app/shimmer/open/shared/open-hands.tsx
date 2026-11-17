'use client'
// ── THE KEEPER'S HANDS IN THE OPEN WORLD (Alex 11-17: "werent we working on the hands?") ─────────────────────────────
// The first-person rig already exists and is canon-checked (voxel3d/hands.ts: the right hand IS the glove with one dim
// seat, the left wrist wears the bracelet, a grown tool in the fist while a node is worked, no metal, no skin, drawn over
// the world so a hand never sinks into a wall). The open world never mounted it. This is the mount: the host page owns
// what the keeper is doing and fills the signal each frame through `feed`; the rig copies the camera pose itself and
// reads speed off the camera's own travel, so nothing here couples to a walker.
//
// The third-person body (open/shared/keeper-doll.tsx, the Keeper Body Bench) is a separate piece: in first person only
// the glove and forearm are ever in frame, and they look the same whichever body Alex picks.
import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { createHands, GLOVE_MODEL_URL, type HandsSignal } from '../../voxel3d/hands'

export function OpenHands({ feed }: { feed: (sig: HandsSignal) => void }) {
  const hands = useMemo(() => createHands(), [])
  const { camera } = useThree()
  useEffect(() => {
    void hands.loadGlove(GLOVE_MODEL_URL)   // the modelled tier-0 glove; the stick stays if it does not land
    ;(window as unknown as { __openHands?: unknown }).__openHands = { sig: hands.sig }   // read-only probe for checks
    return () => hands.dispose()
  }, [hands])
  useFrame((st, dt) => { feed(hands.sig); hands.tick(camera, st.clock.elapsedTime, Math.min(dt, 0.1)) })
  return <primitive object={hands.group} />
}
