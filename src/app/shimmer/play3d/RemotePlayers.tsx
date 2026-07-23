'use client'
// Remote players — the visible half of the presence slice.
//
// Reads the peer map from useMultiplayer each frame and draws one avatar per player. Blockout
// bodies on purpose: this proves presence works. Real character models are a separate job and
// need a rig, which is the expensive part (see the Meshy notes — static props are cheap,
// animated characters are not).
import { useRef, useMemo, useState, useEffect, Suspense, Component, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { type RemotePlayer } from './multiplayer'

// Rigged avatar (Meshy auto-rig pipeline). One shared GLB; every remote player gets a
// SkeletonUtils.clone — a plain .clone() breaks skinned meshes (bones don't rebind).
// Contains the walk clip; idle = clip paused at rest. Draco decoder is vendored (see prop-models).
const AVATAR_URL = '/models/avatars/traveler.glb'
const AVATAR_HEIGHT = 1.55  // world units — a touch under the 1.6 camera eye

// Positions arrive ~12x/sec; at 60fps that's a fresh target every 5th frame. Chasing the target
// with an exponential ease hides the gap without adding visible latency at walking speed.
const LERP = 9
// A player we stop hearing from is stale — the server sends player_left on a clean disconnect,
// but a killed tab or a dropped tunnel just goes quiet. Hide rather than leave a statue.
// 90s, NOT 12s: the client keepalives every 4s in the foreground, but a BACKGROUNDED tab gets
// its timers throttled to ~1/min by Chrome — at 12s a friend who switched apps for a moment
// (or made the party and picked up their phone — the exact first-use flow) vanished. The cost
// of 90s is a killed tab lingering as a statue for a minute and a half; player_left still
// removes clean disconnects instantly.
const STALE_MS = 90_000

// The pre-rig blockout — also the Suspense/error fallback, so a missing/broken avatar GLB
// degrades to the proven capsule instead of an invisible player.
function CapsuleBody({ peer, bob }: { peer: RemotePlayer; bob: boolean }) {
  const inner = useRef<THREE.Group>(null)
  // one hue per player, stable across sessions — derived from the id so both clients agree
  const color = useMemo(() => {
    let h = 0
    for (let i = 0; i < peer.id.length; i++) h = (h * 31 + peer.id.charCodeAt(i)) >>> 0
    return new THREE.Color().setHSL((h % 360) / 360, 0.55, 0.6)
  }, [peer.id])
  useFrame((state) => {
    // gentle bob only while moving — the capsule has no walk cycle to sell motion
    if (inner.current) inner.current.position.y = bob && peer.moving ? Math.sin(state.clock.elapsedTime * 6) * 0.04 : 0
  })
  return (
    <group ref={inner}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.7, 4, 10]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      {/* facing nub, so you can tell which way another player is looking */}
      <mesh position={[0, 0.95, 0.34]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#0d1a17" />
      </mesh>
    </group>
  )
}

// Rigged body — the shared avatar GLB, cloned per player, walk clip driven by peer.moving.
function RiggedBody({ peer }: { peer: RemotePlayer }) {
  const { scene, animations } = useGLTF(AVATAR_URL, '/draco/')
  const holder = useRef<THREE.Group>(null)
  const { object, scale } = useMemo(() => {
    const obj = SkeletonUtils.clone(scene)
    obj.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.castShadow = true; m.frustumCulled = false } // skinned bounds lie; never cull a player
    })
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3(); box.getSize(size)
    return { object: obj, scale: AVATAR_HEIGHT / (size.y || 1) }
  }, [scene])
  const { actions } = useAnimations(animations, holder)
  const walkRef = useRef<THREE.AnimationAction | null>(null)
  const wasMoving = useRef(false)
  useEffect(() => {
    const key = Object.keys(actions).find(k => /walk/i.test(k)) ?? Object.keys(actions)[0]
    walkRef.current = key ? actions[key] : null
    const walk = walkRef.current
    if (walk) { walk.play(); walk.paused = true }
  }, [actions])
  useFrame(() => {
    const walk = walkRef.current
    if (!walk) return
    if (peer.moving !== wasMoving.current) {
      wasMoving.current = peer.moving
      walk.paused = !peer.moving
      if (!peer.moving) walk.time = 0  // rest at the neutral frame, not frozen mid-stride
    }
  })
  return (
    <group ref={holder} scale={[scale, scale, scale]}>
      <primitive object={object} />
    </group>
  )
}

// error boundary → capsule, and it SAYS why (a silent boundary cost us a session — see prop-models)
class AvatarBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { console.error('[avatar] falling back to capsule:', error) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function Avatar({ peer }: { peer: RemotePlayer }) {
  const grp = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
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
    // +π: the sender's yaw=0 means LOOKING down -Z (camera forward = (-sin yaw, -cos yaw)),
    // but the model's front is +Z (Meshy convention — same as the props). Without the flip
    // every avatar walks backwards, which the old capsule's tiny nub never made visible.
    g.rotation.y = peer.yaw + Math.PI
  })

  const fallback = <CapsuleBody peer={peer} bob />
  return (
    <group ref={grp}>
      <AvatarBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <RiggedBody peer={peer} />
        </Suspense>
      </AvatarBoundary>
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
