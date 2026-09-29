'use client'
// ── THE DEPARTURES LOBBY (2026-09-29, Alex) ─────────────────────────────────────────────────────────────────
//
// Alex: *"it should feel like the apex legends lobby where you see your character and friends that join are visible
// here too and in the bottom right the mission selector icon/button to select the survival, boss, or an expedition..
// from here the party leader can navigate the team or run solo."* It replaces the 09-28 board (a parchment list),
// opened the same way: talk to the Station clerk at the berths. Back out of it and you are standing in the Station
// with your party, free to go to the Ather together instead.
//
//   · THE STAGE — your chord on a pad: you in the middle, mates either side, each in the body the world draws them
//     in (`keeperColor`, the same hash the world uses). A crown marks the leader, a green ring marks ready, and a mate
//     who is not standing in the Station is drawn faint with where they are.
//   · THE ROSTER (top left) — the party code, everyone and where they are, Invite friends.
//   · THE MISSION (bottom right) — Survival · Boss · Expedition. The leader picks; everyone sees the pick.
//   · THE GO (bottom right, under it) — the leader's LAUNCH takes every mate standing in the Station (once they are
//     ready); a mate's button is READY. Alone, it is LAUNCH, plus Find others where the mission takes company.
//
// Renders and calls back. The lobby socket (`lib/party-lobby.ts`) owns the shared state; the host owns every warp.
import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { H, HearthButton, hearthBody, hearthDisplay } from '../ui/hearth'
import { keeperColor } from './RemotePlayers'
import type { LobbyState, Mission } from '@/lib/party-lobby'
import type { Finding } from './departures'
import { lobby as L, radius, textShadow } from './tokens'

export interface MissionCard {
  id: Mission
  /** Alex's three: Survival · Boss · Expedition */
  kind: string
  /** the place, e.g. The Breach */
  name: string
  world: string
  blurb: string
  /** null = open; otherwise why it is shut */
  locked: string | null
  /** can a party go together? */
  coop: boolean
}

import { lobbySeats, launchBlock, type Seat } from './lobby-seats'
export { lobbySeats, launchBlock, whereLabel, STATION_ZONE } from './lobby-seats'

// ── the stage ───────────────────────────────────────────────────────────────────────────────────────────────
// ★ A CHORD OF THREE FITS ANY SCREEN (Alex 09-29: "a bit close up… scale it down so a team of three fits comfortably…
// it converts better on the phone"). The slots sit closer, and the camera (below) pulls back until the whole pad fits
// the WIDTH, so a portrait phone sees all three instead of the middle one.
const SLOT_X = [0, -1.15, 1.15]
/** what must be in frame: the three keepers and their names, with a margin (world units, half-extents) */
const FIT_HALF_W = 2.0, FIT_HALF_H = 2.5   // H was 1.45: on a wide screen HEIGHT sets the fit, and 1.45 stood them head-to-foot
function CameraFit() {
  const { camera, size } = useThree()
  const last = useRef('')
  useFrame(() => {
    const aspect = size.width / Math.max(1, size.height), key = `${size.width}x${size.height}`
    if (key === last.current) return
    last.current = key
    const cam = camera as THREE.PerspectiveCamera
    const vHalf = Math.tan((cam.fov * Math.PI) / 360), hHalf = vHalf * aspect
    const d = Math.max(FIT_HALF_W / hHalf, FIT_HALF_H / vHalf, 4.4)
    // on a narrow screen the plates cover the top and the bottom, so the chord sits a little high in the free middle
    const lookY = aspect < 1 ? -0.05 : 0.15
    cam.position.set(0, lookY + d * 0.22, d)
    cam.lookAt(0, lookY, 0)
    cam.updateProjectionMatrix()
  })
  return null
}
const nameplate: React.CSSProperties = { ...hearthBody, width: 96, textAlign: 'center', pointerEvents: 'none', textShadow }
function Keeper({ seat, slot, partied }: { seat: Seat; slot: number; partied: boolean }) {
  const g = useRef<THREE.Group>(null)
  const color = useMemo(() => keeperColor(seat.look), [seat.look])
  useFrame((st) => {
    if (!g.current) return
    const t = st.clock.elapsedTime + slot * 1.7
    g.current.position.y = Math.sin(t * 1.6) * 0.03
    g.current.rotation.y = Math.sin(t * 0.4) * 0.18
  })
  return (
    <group position={[SLOT_X[slot] ?? 0, 0, slot === 0 ? 0.35 : 0]}>
      <group ref={g}>
        <mesh position={[0, 0.85, 0]}>
          <capsuleGeometry args={[0.32, 0.7, 4, 12]} />
          <meshStandardMaterial color={color} roughness={0.6} transparent opacity={seat.here ? 1 : 0.35} />
        </mesh>
        <mesh position={[0, 0.95, 0.34]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial color={L.nub} transparent opacity={seat.here ? 1 : 0.35} />
        </mesh>
        {seat.leader && (
          <mesh position={[0, 1.78, 0]} rotation={[0, 0, Math.PI / 4]}>
            <octahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color={L.crown} emissive={L.crownGlow} emissiveIntensity={0.6} />
          </mesh>
        )}
      </group>
      {/* the ring under their feet: green when ready */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.42, 0.52, 40]} />
        <meshBasicMaterial color={seat.ready ? L.ready : H.inkSoft} transparent opacity={seat.ready ? 0.95 : 0.5} />
      </mesh>
      {/* the name rides UNDER the keeper, in the scene, so it stays with them at any size */}
      <Html position={[0, -0.12, 0.5]} center zIndexRange={[5, 0]}>
        <div style={nameplate} data-seat={seat.name}>
          <div className="text-[13px] font-extrabold truncate" style={{ color: H.paperHi }}>{seat.leader && partied ? '♛ ' : ''}{seat.name}</div>
          <div className="text-[10px]" style={{ color: L.sub }}>{seat.you ? 'you' : !seat.here ? seat.where : seat.ready ? 'ready' : 'not ready'}</div>
        </div>
      </Html>
    </group>
  )
}
/** an empty place in the chord: a faint ring and the words, so three reads as three even alone */
function OpenSeat({ slot }: { slot: number }) {
  return (
    <group position={[SLOT_X[slot] ?? 0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.42, 0.5, 40]} />
        <meshBasicMaterial color={H.inkSoft} transparent opacity={0.35} />
      </mesh>
      <Html position={[0, -0.12, 0.5]} center zIndexRange={[5, 0]}>
        <div style={nameplate} data-seat="open" className="text-[11px] italic"><span style={{ color: L.faint }}>open seat</span></div>
      </Html>
    </group>
  )
}
function Stage({ seats, partied }: { seats: Seat[]; partied: boolean }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.35, 4.8], fov: 38 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
      <CameraFit />
      <ambientLight intensity={0.55} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.1} />
      <pointLight position={[0, 2.2, 1.6]} intensity={0.8} color={L.lamp} />
      <group position={[0, -0.75, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.1, 48]} />
          <meshStandardMaterial color={L.pad} roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry args={[2.02, 2.1, 64]} />
          <meshBasicMaterial color={H.ember} />
        </mesh>
        {[0, 1, 2].map((i) => seats[i] ? <Keeper key={seats[i].id} seat={seats[i]} slot={i} partied={partied} /> : <OpenSeat key={`open-${i}`} slot={i} />)}
      </group>
    </Canvas>
  )
}

// ── the screen ──────────────────────────────────────────────────────────────────────────────────────────────
const label: React.CSSProperties = { ...hearthDisplay, letterSpacing: '0.14em', textTransform: 'uppercase' }
const plate: React.CSSProperties = { background: L.plate, boxShadow: L.plateLit, borderRadius: radius.lg }

export function DeployLobby({ you, lobby, isLeader, partyCode, missions, localPick, onLocalPick, onPick, onReady, onLaunch, onInvite, onClose,
  finding, onFindOthers, onGoNow, onCancelFind }: {
  you: { id: string; name: string; look: string }
  lobby: LobbyState | null
  isLeader: boolean
  partyCode: string | null
  missions: MissionCard[]
  /** the pick when there is no party lobby (alone): the host keeps it so it survives reopening */
  localPick: Mission
  onLocalPick: (m: Mission) => void
  onPick: (m: Mission) => void
  onReady: (on: boolean) => void
  onLaunch: (m: MissionCard, together: boolean) => void
  onInvite: () => void
  onClose: () => void
  finding: Finding | null
  onFindOthers: (m: MissionCard) => void
  onGoNow: () => void
  onCancelFind: () => void
}) {
  const [picking, setPicking] = useState(false)
  const seats = lobbySeats(you, lobby)
  const partied = !!lobby && lobby.members.length > 1
  const leads = !partied || isLeader
  const missionId = partied ? lobby!.mission : localPick
  const mission = missions.find((m) => m.id === missionId) ?? missions[0]
  const me = seats.find((s) => s.you)
  const block = partied && isLeader ? launchBlock(seats) : null
  const choose = (m: Mission) => { setPicking(false); if (partied) onPick(m); else onLocalPick(m) }

  let go: React.ReactNode
  if (finding) {
    go = (
      <div className="flex flex-col items-end gap-1.5">
        <div className="text-[13px] font-extrabold tabular-nums">Finding others… {finding.n} of {finding.need} · {Math.floor(finding.waited / 60)}:{String(finding.waited % 60).padStart(2, '0')}</div>
        <div className="flex gap-2"><HearthButton onClick={onCancelFind}>Cancel</HearthButton><HearthButton primary onClick={onGoNow}>Go now</HearthButton></div>
      </div>
    )
  } else if (!leads) {
    go = <HearthButton primary={!me?.ready} onClick={() => onReady(!me?.ready)}>{me?.ready ? 'Not ready' : 'Ready'}</HearthButton>
  } else {
    const shut = mission.locked
    const together = partied && mission.coop
    const soloOnly = partied && !mission.coop
    go = (
      <div className="flex flex-col items-end gap-1.5">
        {(shut || block || soloOnly) && <div className="text-[11px] text-right max-w-[260px]" style={{ color: H.paperLo }}>{shut ?? block ?? `${mission.name} is a solo fight for now: you go alone`}</div>}
        <div className="flex gap-2">
          {!partied && mission.coop && !shut && <HearthButton onClick={() => onFindOthers(mission)}>Find others</HearthButton>}
          <HearthButton primary disabled={!!shut || !!block} onClick={() => onLaunch(mission, together)}>
            {together ? `Launch together · ${mission.name}` : `Launch · ${mission.name}`}
          </HearthButton>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[90] select-none" style={{ ...hearthBody, background: L.backdrop, color: H.paper }} data-panel="departures">
      {/* the stage fills the screen; the plates sit over it */}
      <div className="absolute inset-0"><Stage seats={seats} partied={partied} /></div>

      {/* top left: the title and the party */}
      <div className="absolute top-4 left-4 right-4 sm:right-auto sm:w-[300px] px-4 py-3" style={plate}>
        <div className="text-[20px] font-extrabold" style={label}>Departures</div>
        <div className="text-[11px] mb-2" style={{ color: L.sub }}>{partied ? `Party ${partyCode} · ${isLeader ? 'you lead' : `${seats.find((s) => s.leader)?.name ?? '…'} leads`}` : partyCode ? `Party ${partyCode} · nobody else here yet` : 'Three to a door. Bring friends, or go alone.'}</div>
        {partied && (
          <div className="flex flex-col gap-0.5 mb-2" data-roster>
            {seats.map((s) => (
              <div key={s.id} className="flex items-baseline gap-2 text-[12px]">
                <span className="font-bold truncate">{s.leader ? '♛ ' : ''}{s.name}{s.you ? ' (you)' : ''}</span>
                <span className="ml-auto text-[11px]" style={{ color: L.dim }}>{s.where}</span>
              </div>
            ))}
          </div>
        )}
        <HearthButton small onClick={onInvite}>👥 Invite friends</HearthButton>
      </div>

      {/* top right: back out, and you are standing in the Station */}
      <div className="absolute top-4 right-4 hidden sm:block">
        <HearthButton small onClick={onClose}>Back · Esc</HearthButton>
      </div>

      {/* bottom right: the mission, then the go */}
      <div className="absolute right-4 bottom-4 left-4 sm:left-auto sm:w-[340px] flex flex-col items-end gap-3">
        {picking && (
          <div className="w-full flex flex-col gap-2" data-mission-picker>
            {missions.map((m) => (
              <button key={m.id} onClick={() => choose(m.id)} data-mission={m.id}
                      className="text-left px-3.5 py-2.5 transition-transform hover:-translate-y-px"
                      style={{ ...plate, boxShadow: m.id === missionId ? `inset 0 0 0 2px ${H.ember}, ${plate.boxShadow}` : plate.boxShadow, opacity: m.locked ? 0.6 : 1 }}>
                <div className="text-[10px]" style={{ ...label, color: H.emberHi }}>{m.kind}</div>
                <div className="flex items-baseline gap-2"><span className="text-[15px] font-extrabold" style={hearthDisplay}>{m.name}</span><span className="text-[11px] ml-auto" style={{ color: L.dim }}>{m.world}</span></div>
                <div className="text-[11px]" style={{ color: L.sub }}>{m.locked ?? m.blurb}</div>
              </button>
            ))}
          </div>
        )}
        <button onClick={() => leads && setPicking((p) => !p)} disabled={!leads} data-mission-current={mission.id}
                className="w-full text-left px-4 py-3" style={{ ...plate, cursor: leads ? 'pointer' : 'default' }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ ...label, color: H.emberHi }}>{mission.kind}</span>
            <span className="ml-auto text-[10px]" style={{ ...label, color: L.dim }}>{leads ? (picking ? 'close' : 'change') : 'the leader picks'}</span>
          </div>
          <div className="text-[18px] font-extrabold" style={hearthDisplay}>{mission.name}</div>
          <div className="text-[11px]" style={{ color: L.sub }}>{mission.world}{mission.locked ? ` · ${mission.locked}` : ''}</div>
        </button>
        {go}
        <div className="sm:hidden"><HearthButton small onClick={onClose}>Back</HearthButton></div>
      </div>
    </div>
  )
}
