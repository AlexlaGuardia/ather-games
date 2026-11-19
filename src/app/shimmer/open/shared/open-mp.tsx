'use client'
// ── PLAY TOGETHER IN THE OPEN WORLD, slice 1: OTHERS APPEAR (BETA M27, Alex 11-18: "the main thing I'm worried about is
// playing with friends") ─────────────────────────────────────────────────────────────────────────────────────────────
// The socket is play3d's (play3d/multiplayer.ts useMultiplayer: shimmer-server /shimmer-ws/ws, 12 Hz, keepalive, backoff);
// this file only says WHICH zone and draws WHO is in it:
//   · the Wilds = ONE zone 'open:wilds' (world coordinates, so every tile shares an instance; you see who is near),
//     the continent = 'open:continent', the home plot = no socket (personal space).
//   · a party code (lib/party) puts you in the party's own instance, which strangers never join (server-side).
//   · offline is SOLO, silently: a dead socket retries on its own backoff and never throws into the page; the socket is
//     CLOSED while the tab is hidden (hub 11-18), so a background tab holds no connection and sends nothing.
// Others are drawn on the cartoon rig (shared/folk-model.tsx) with a look from their id, eased toward each 12 Hz update;
// only the nearest NEAR_RIGS get the rig (≈32 draws each), the rest a single capsule. A name plate over each (game-UI
// rule: text never sits raw on the scene).
import { KeeperFigure } from './keeper-figure-view'
import { packLook, unpackLook } from './keeper-look'
import { useLook } from './look-store'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useMultiplayer, type RemotePlayer } from '../../play3d/multiplayer'
import { useRoster } from '../../play3d/RemotePlayers'
import { useParty } from '@/lib/party'
import { useAccount } from '@/lib/accounts/use-account'
import { FolkModel, folkLook, FOLK_HEIGHT } from './folk-model'

export const OPEN_WILDS = 'open:wilds', OPEN_CONTINENT = 'open:continent'
/** Peers drawn on the full rig; the rest are a capsule. */
export const NEAR_RIGS = 6
/** M29 slice 3 (docs/M29-look-sync.md, option A): send this keeper's packed look as the socket's `sprite` and draw peers who
 *  sent one as their own figure. ★ OFF until hub/Alex pick A: with it off nothing is sent and every peer draws as before. */
export const LOOK_SYNC = false
export const LOOK_SPRITE = 'lk1:'
/** ids of the peers currently drawn as their own figure (a probe for look-sync-check, reading only) */
const FIGURES = new Set<string>()
/** Not heard from in this long = hidden (a killed tab sends no 'left'); play3d uses 90 s for a background tab's timers,
 *  but our hidden tabs CLOSE the socket (a clean 'left'), so a silent peer here is a dead one. */
const STALE_MS = 20_000
const LERP = 10

/** The live peer map, for DOM readers outside the page (the Play together panel's roster). A stable box: it points at the
 *  mounted page's map (useMultiplayer keeps one Map and clears it, never replaces it). */
const peersBox: { current: Map<string, RemotePlayer> } = { current: new Map() }
export const openPeers = () => peersBox as React.RefObject<Map<string, RemotePlayer>>

/** true while the tab is visible (the socket only lives then). */
function useVisible(): boolean {
  const [v, setV] = useState(true)
  useEffect(() => {
    const f = () => setV(document.visibilityState !== 'hidden')
    f(); document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])
  return v
}

/** The page's socket. `zone` null = no socket (the plot, a loading screen). `where()` is read at send time (12 Hz). */
export function useOpenMultiplayer(zone: string | null, where: () => { x: number; y: number; z: number; yaw: number } | null) {
  const visible = useVisible()
  const { party } = useParty()
  const { session } = useAccount()
  const whereRef = useRef(where); whereRef.current = where
  // stable ref objects whose `current` reads the page's live pose each time the hook sends
  const posRef = useMemo(() => ({ get current() { const w = whereRef.current(); return w ? { x: w.x, y: w.y, z: w.z } : null } }) as React.RefObject<{ x: number; y: number; z: number } | null>, [])
  const yawRef = useMemo(() => ({ get current() { return whereRef.current()?.yaw ?? 0 } }) as React.RefObject<number>, [])
  const myLook = useLook()
  const mp = useMultiplayer({ enabled: !!zone && visible, zoneId: zone ?? '', posRef, yawRef, party, playerName: session?.username ?? '', sprite: LOOK_SYNC ? LOOK_SPRITE + packLook(myLook) : undefined })
  peersBox.current = mp.peers.current
  if (typeof window !== 'undefined') (window as unknown as { __mp?: unknown }).__mp = {
    zone: () => zone, status: () => mp.status.current, party: () => party, me: () => whereRef.current(),
    peers: () => [...mp.peers.current.values()].map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, tx: p.tx, tz: p.tz, sprite: p.sprite ?? null })),
    figures: () => [...FIGURES],   // M29: peers drawn as their own keeper (look-sync-check)
  }
  return mp
}

function Plate({ name }: { name: string }) {
  return (
    <div style={{
      font: '700 12px ui-sans-serif, system-ui, sans-serif', letterSpacing: '0.04em', color: '#3a2716',
      background: 'linear-gradient(#f3e6c8, #e6d3ab)', border: '2px solid #6b4a2e', boxShadow: '0 1px 4px rgba(0,0,0,.45)',
      padding: '1px 8px', borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none',
    }} data-mp-plate>{name}</div>
  )
}

function Peer({ peer, rig, seed }: { peer: RemotePlayer; rig: boolean; seed: number }) {
  const g = useRef<THREE.Group>(null)
  const look = useMemo(() => folkLook(`keeper:${peer.id}`), [peer.id])
  // M29: a peer who sent a packed look draws as their own keeper (LOOK_SYNC; anything else keeps the folk rig)
  const theirs = useMemo(() => (LOOK_SYNC && peer.sprite?.startsWith(LOOK_SPRITE) ? unpackLook(peer.sprite.slice(LOOK_SPRITE.length)) : null), [peer.sprite])
  useEffect(() => { if (rig && theirs) { FIGURES.add(peer.id); return () => { FIGURES.delete(peer.id) } } }, [rig, theirs, peer.id])
  useFrame((_, dt) => {
    const o = g.current; if (!o) return
    const stale = performance.now() - peer.lastSeen > STALE_MS
    o.visible = !stale
    if (stale) return
    const k = 1 - Math.exp(-LERP * dt)
    peer.x += (peer.tx - peer.x) * k; peer.y += (peer.ty - peer.y) * k; peer.z += (peer.tz - peer.z) * k
    let d = peer.tyaw - peer.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); peer.yaw += d * k
    o.position.set(peer.x, peer.y, peer.z)
    o.rotation.y = peer.yaw + Math.PI   // the sender's yaw 0 LOOKS down -Z; the body's front is +Z (play3d's flip)
  })
  return (
    <group ref={g}>
      {rig && theirs ? <KeeperFigure look={theirs} />
        : rig ? <FolkModel look={look} action={peer.moving ? 'talk' : 'idle'} seed={seed} speed={peer.moving ? 1.6 : 1} />
        : <mesh position={[0, 0.85, 0]}><capsuleGeometry args={[0.3, 0.9, 4, 8]} /><meshLambertMaterial color={look.shirt} /></mesh>}
      <Html position={[0, FOLK_HEIGHT + 0.25, 0]} center distanceFactor={12} zIndexRange={[10, 0]}><Plate name={peer.name} /></Html>
    </group>
  )
}

/** Mount inside the Canvas. `me()` = where this keeper stands (who counts as near). */
export function RemoteKeepers({ peers, me }: { peers: React.RefObject<Map<string, RemotePlayer>>; me: () => { x: number; z: number } | null }) {
  const roster = useRoster(peers)
  const [near, setNear] = useState<Set<string>>(new Set())
  const acc = useRef(1)
  useFrame((_, dt) => {
    if ((acc.current += dt) < 0.5) return
    acc.current = 0
    const m = me(); if (!m) return
    const ids = [...roster].sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z)).slice(0, NEAR_RIGS).map(p => p.id)
    if (ids.length !== near.size || ids.some(id => !near.has(id))) setNear(new Set(ids))
  })
  return <>{roster.map((p, i) => <Peer key={p.id} peer={p} rig={near.has(p.id)} seed={i} />)}</>
}
