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
import { HELD_KIND, heldDue, newHeldSend, decodeHeld } from './held-gun'   // BETA M27 slice 4
import { gunProp } from './held-gun-prop'

export const OPEN_WILDS = 'open:wilds', OPEN_CONTINENT = 'open:continent'
/** Peers drawn on the full rig; the rest are a capsule. */
export const NEAR_RIGS = 6
/** M29 slice 3 (docs/M29-look-sync.md, option A): send this keeper's packed look as the socket's `sprite` and draw peers who
 *  sent one as their own figure. With it off nothing is sent and every peer draws the folk rig as before. */
export const LOOK_SYNC = true   // ★ ON 11-19 (hub: option A approved, client-only, reversible: set false to roll back)
export const LOOK_SPRITE = 'lk1:'
/** ids of the peers currently drawn as their own figure (a probe for look-sync-check, reading only) */
const FIGURES = new Set<string>()
/** Not heard from in this long = hidden (a killed tab sends no 'left'); play3d uses 90 s for a background tab's timers,
 *  but our hidden tabs CLOSE the socket (a clean 'left'), so a silent peer here is a dead one. */
const STALE_MS = 8_000   // ★ M27 slice 3 (11-19, was 20 s; hub: 2x the 4 s keepalive so one phone hiccup never blinks a friend away). The fast path is the clean close on pagehide
const LERP = 10

/** The live peer map, for DOM readers outside the page (the Play together panel's roster). A stable box: it points at the
 *  mounted page's map (useMultiplayer keeps one Map and clears it, never replaces it). */
const peersBox: { current: Map<string, RemotePlayer> } = { current: new Map() }
export const openPeers = () => peersBox as React.RefObject<Map<string, RemotePlayer>>
// ── the socket's party handles for systems that live elsewhere (BETA M28 shared fights: combat-layer reads this, so the page
// passes nothing). `null` when no socket hook is mounted. `live()` = the peers heard from inside STALE_MS (a ghost never hosts).
export interface OpenNet { zone: string | null; self: string; party: string | null; live: () => string[]
  relay: (kind: string, data: unknown, to?: string) => boolean; onRelay: (f: (m: { from: string; kind: string; data: unknown }) => void) => () => void }
let netBox: OpenNet | null = null
export const openNet = () => netBox
// BETA M27 slice 4: what each peer says is in their hand (gun id, or null), and which guns are actually drawn on a rig (checks)
const peerGuns = new Map<string, string | null>()
const GUN_SHOWN = new Map<string, string>()

// ── checks never land beside a real player (Alex 11-19 saw a solo-fight-check keeper in HIS Wilds) ──
// An automated browser (navigator.webdriver: puppeteer, playwright) does NOT join PUBLIC matchmaking unless the page was
// opened with ?mp=on (open-mp-check, look-sync-check: the checks that test public instances). A party is a private instance,
// so party checks are unchanged. The flag is read ONCE per page and kept: the page drops query params as it goes.
let mpOptIn: boolean | null = null
export function publicMpAllowed(): boolean {
  if (typeof window === 'undefined') return true
  if (mpOptIn === null) { try { mpOptIn = new URLSearchParams(window.location.search).get('mp') === 'on' } catch { mpOptIn = false } }
  return mpOptIn || !navigator.webdriver
}

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
/** `held` (BETA M27 slice 4): the gun in this keeper's hand right now (id, or null): the party sees it on our rig. */
export function useOpenMultiplayer(zone: string | null, where: () => { x: number; y: number; z: number; yaw: number } | null, held?: () => string | null) {
  const visible = useVisible()
  const { party } = useParty()
  const { session } = useAccount()
  const whereRef = useRef(where); whereRef.current = where
  // stable ref objects whose `current` reads the page's live pose each time the hook sends
  const posRef = useMemo(() => ({ get current() { const w = whereRef.current(); return w ? { x: w.x, y: w.y, z: w.z } : null } }) as React.RefObject<{ x: number; y: number; z: number } | null>, [])
  const yawRef = useMemo(() => ({ get current() { return whereRef.current()?.yaw ?? 0 } }) as React.RefObject<number>, [])
  const myLook = useLook()
  const mp = useMultiplayer({ enabled: !!zone && visible && (!!party || publicMpAllowed()), zoneId: zone ?? '', posRef, yawRef, party, playerName: session?.username ?? '', sprite: LOOK_SYNC ? LOOK_SPRITE + packLook(myLook) : undefined })
  peersBox.current = mp.peers.current
  const heldRef = useRef(held); heldRef.current = held
  useEffect(() => {   // M27 slice 4: say what I hold (change / a newcomer / 10 s keepalive); hear what they hold
    const off = mp.onRelay(m => { if (m.kind !== HELD_KIND) return; const g = decodeHeld(m.data); if (g !== undefined) peerGuns.set(m.from, g) })
    const st = newHeldSend()
    const t = setInterval(() => {
      const now = performance.now(), live = [...mp.peers.current.values()].filter(p => now - p.lastSeen <= STALE_MS).map(p => p.id)
      const g = heldRef.current ? heldRef.current() : null
      if (heldDue(st, g, live, now / 1000)) mp.relay(HELD_KIND, { g })
    }, 500)
    return () => { off(); clearInterval(t) }
  }, [mp.onRelay, mp.relay, mp.peers])
  netBox = { zone, self: mp.selfId.current, party: party ?? null, relay: mp.relay, onRelay: mp.onRelay,
    live: () => { const now = performance.now(); return [...mp.peers.current.values()].filter(p => now - p.lastSeen <= STALE_MS).map(p => p.id) } }
  if (typeof window !== 'undefined') (window as unknown as { __mp?: unknown }).__mp = {
    zone: () => zone, status: () => mp.status.current, party: () => party, me: () => whereRef.current(),
    peers: () => [...mp.peers.current.values()].map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, tx: p.tx, tz: p.tz, sprite: p.sprite ?? null })),
    figures: () => [...FIGURES],   // M29: peers drawn as their own keeper (look-sync-check)
    guns: () => Object.fromEntries(peerGuns), gunsShown: () => Object.fromEntries(GUN_SHOWN),   // M27 slice 4 (held-gun-check)
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
  // M27 slice 4: the gun they say they hold (none while stale); rarely changes, so a state is fine
  const [gun, setGun] = useState<string | null>(null), gunNow = useRef<string | null>(null)
  useEffect(() => { if (gun) GUN_SHOWN.set(peer.id, gun); else GUN_SHOWN.delete(peer.id); return () => { GUN_SHOWN.delete(peer.id) } }, [gun, peer.id])
  const look = useMemo(() => folkLook(`keeper:${peer.id}`), [peer.id])
  // M29: a peer who sent a packed look draws as their own keeper (LOOK_SYNC; anything else keeps the folk rig)
  const theirs = useMemo(() => (LOOK_SYNC && peer.sprite?.startsWith(LOOK_SPRITE) ? unpackLook(peer.sprite.slice(LOOK_SPRITE.length)) : null), [peer.sprite])
  useEffect(() => { if (rig && theirs) { FIGURES.add(peer.id); return () => { FIGURES.delete(peer.id) } } }, [rig, theirs, peer.id])
  useFrame((_, dt) => {
    const o = g.current; if (!o) return
    const stale = performance.now() - peer.lastSeen > STALE_MS
    o.visible = !stale
    const want = stale ? null : (peerGuns.get(peer.id) ?? null)
    if (want !== gunNow.current) { gunNow.current = want; setGun(want) }
    if (stale) return
    const k = 1 - Math.exp(-LERP * dt)
    peer.x += (peer.tx - peer.x) * k; peer.y += (peer.ty - peer.y) * k; peer.z += (peer.tz - peer.z) * k
    let d = peer.tyaw - peer.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); peer.yaw += d * k
    o.position.set(peer.x, peer.y, peer.z)
    o.rotation.y = peer.yaw + Math.PI   // the sender's yaw 0 LOOKS down -Z; the body's front is +Z (play3d's flip)
  })
  return (
    <group ref={g}>
      {rig && theirs ? <KeeperFigure look={theirs} gun={gun} />
        : rig ? <FolkModel look={look} action={peer.moving ? 'talk' : 'idle'} seed={seed} speed={peer.moving ? 1.6 : 1} />
        : <mesh position={[0, 0.85, 0]}><capsuleGeometry args={[0.3, 0.9, 4, 8]} /><meshLambertMaterial color={look.shirt} /></mesh>}
      {gun && !(rig && theirs) && <GunAt id={gun} />}
      <Html position={[0, FOLK_HEIGHT + 0.25, 0]} center distanceFactor={12} zIndexRange={[10, 0]}><Plate name={peer.name} /></Html>
    </group>
  )
}

/** a held gun on a rig that names no hand (the folk rig, the far capsule): at the right side, about hand height */
function GunAt({ id }: { id: string }) {
  const g = useMemo(() => { const x = gunProp(id); x.rotation.y = Math.PI; x.position.set(-0.36, 0.9, 0.12); return x }, [id])
  return <primitive object={g} />
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
