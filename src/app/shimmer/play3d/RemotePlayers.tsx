'use client'
// Remote players — the visible half of the presence slice.
//
// Reads the peer map from useMultiplayer each frame and draws one avatar per player. Blockout
// bodies on purpose: this proves presence works. Real character models are a separate job and
// need a rig, which is the expensive part (see the Meshy notes — static props are cheap,
// animated characters are not).
import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { type RemotePlayer } from './multiplayer'

// Positions arrive ~12x/sec; at 60fps that's a fresh target every 5th frame. Chasing the target
// with an exponential ease hides the gap without adding visible latency at walking speed.
const LERP = 9
// A player we stop hearing from is stale — the server sends player_left on a clean disconnect,
// but a killed tab or a dropped tunnel just goes quiet. Hide rather than leave a statue.
const STALE_MS = 12_000

function Avatar({ peer }: { peer: RemotePlayer }) {
  const grp = useRef<THREE.Group>(null)
  // one hue per player, stable across sessions — derived from the id so both clients agree
  const color = useMemo(() => {
    let h = 0
    for (let i = 0; i < peer.id.length; i++) h = (h * 31 + peer.id.charCodeAt(i)) >>> 0
    return new THREE.Color().setHSL((h % 360) / 360, 0.55, 0.6)
  }, [peer.id])

  useFrame((state, dt) => {
    const g = grp.current
    if (!g) return
    const stale = performance.now() - peer.lastSeen > STALE_MS
    g.visible = !stale
    if (stale) return
    const k = 1 - Math.exp(-LERP * dt)   // frame-rate independent ease
    peer.x += (peer.tx - peer.x) * k
    peer.y += (peer.ty - peer.y) * k
    peer.z += (peer.tz - peer.z) * k
    // shortest way round the circle, so crossing +/-PI doesn't spin the avatar
    let d = peer.tyaw - peer.yaw
    d = Math.atan2(Math.sin(d), Math.cos(d))
    peer.yaw += d * k
    g.position.set(peer.x, peer.y, peer.z)
    g.rotation.y = peer.yaw
    // a gentle bob only while they're actually moving — reads as alive, costs nothing
    const bob = peer.moving ? Math.sin(state.clock.elapsedTime * 6) * 0.04 : 0
    g.position.y = peer.y + bob
  })

  return (
    <group ref={grp}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.7, 4, 10]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      {/* facing nub, so you can tell which way another player is looking */}
      <mesh position={[0, 0.95, 0.34]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#0d1a17" />
      </mesh>
      <Html position={[0, 1.75, 0]} center distanceFactor={12} zIndexRange={[10, 0]}>
        <div style={{
          font: '700 12px ui-monospace, monospace', color: '#eafff6',
          background: 'rgba(12,16,26,0.78)', border: '1px solid #ffffff22',
          padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap',
          pointerEvents: 'none', transform: 'translateY(-4px)',
        }}>{peer.name}</div>
      </Html>
    </group>
  )
}

/**
 * Mount inside the Canvas:  <RemotePlayers peers={mp.peers} />
 *
 * Re-renders only when the SET of players changes (join/leave), never on movement — movement is
 * applied straight to the object transforms in useFrame.
 */
export function RemotePlayers({ peers }: { peers: React.RefObject<Map<string, RemotePlayer>> }) {
  const roster = useRoster(peers)
  return <>{roster.map((p) => <Avatar key={p.id} peer={p} />)}</>
}

// The socket hook (useMultiplayer) lives in the PAGE component, not here — the Play Together
// panel (DOM, outside the Canvas) needs the same peers/party/name state, and one socket serving
// both beats two components fighting over who owns the connection. The scene mounts
// <RemotePlayers peers={...}/> directly; it fails soft to an empty roster.

// Watches the peer map for membership changes at a low rate. Polling beats threading a
// subscription through the socket layer, and joins/leaves are rare enough that 2Hz is invisible.
// Exported for the Play Together panel's roster — same polling, DOM side.
export function useRoster(peers: React.RefObject<Map<string, RemotePlayer>>): RemotePlayer[] {
  const [list, setList] = useState<RemotePlayer[]>([])
  useEffect(() => {
    const t = setInterval(() => {
      const m = peers.current
      if (!m) return
      const next = Array.from(m.values())
      setList((prev) => {
        if (prev.length === next.length && prev.every((p, i) => p.id === next[i].id)) return prev
        return next
      })
    }, 500)
    return () => clearInterval(t)
  }, [peers])
  return list
}
