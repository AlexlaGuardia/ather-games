'use client'
// party-strip.tsx — your party, in the Ather (2026-09-29, Alex: "if they go through the runehold gate they go home then
// in the wilds they can find each other"). The voxel world had no multiplayer at all until today; this is the part of
// finding each other a keeper reads: each mate, an arrow toward them relative to where you are looking, and how far,
// or where they are when they are not in your part of the Ather. Positions come from the world presence socket
// (drawn by RemotePlayers in the scene); names and places come from the party lobby.
import { useEffect, useState } from 'react'
import type { RemotePlayer } from '../play3d/multiplayer'
import type { LobbyState } from '@/lib/party-lobby'
import { whereLabel } from '../play3d/lobby-seats'

export interface StripRow { name: string; arrowRad: number | null; dist: number | null; where: string; leader: boolean }

/**
 * Pure, so it is tested without a canvas. `heading` is the map heading (atan2(aimZ, aimX)); a mate's bearing is measured
 * the same way, so `arrowRad` is how far to turn, clockwise on screen, to face them.
 */
export function stripRows(lobby: LobbyState | null, you: string | null, peers: readonly RemotePlayer[], me: { x: number; z: number } | null, heading: number): StripRow[] {
  if (!lobby) return []
  return lobby.members.filter((m) => m.id !== you).map((m) => {
    const p = peers.find((q) => q.name === m.name)
    if (p && me) {
      const dx = p.x - me.x, dz = p.z - me.z
      return { name: m.name, arrowRad: Math.atan2(dz, dx) - heading, dist: Math.hypot(dx, dz), where: 'here', leader: m.id === lobby.leader }
    }
    return { name: m.name, arrowRad: null, dist: null, where: whereLabel(m.zone), leader: m.id === lobby.leader }
  })
}

export function PartyStrip({ lobby, you, peers, meRef, headingRef }: {
  lobby: LobbyState | null
  you: string | null
  peers: React.RefObject<Map<string, RemotePlayer>>
  meRef: React.RefObject<{ x: number; z: number } | null>
  headingRef: React.RefObject<number>
}) {
  const [rows, setRows] = useState<StripRow[]>([])
  // 4Hz: an arrow that lags a quarter second behind a turn reads fine; a React render per frame would not
  useEffect(() => {
    const tick = () => setRows(stripRows(lobby, you, [...(peers.current?.values() ?? [])], meRef.current, headingRef.current ?? 0))
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [lobby, you, peers, meRef, headingRef])
  if (!rows.length) return null
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 flex gap-2 pointer-events-none" data-party-strip>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
             style={{ background: 'rgba(10,8,6,.62)', color: '#f5ebd5', textShadow: '0 1px 2px #000' }}>
          {r.arrowRad !== null
            ? <span style={{ display: 'inline-block', transform: `rotate(${r.arrowRad}rad)` }} aria-hidden>↑</span>
            : <span aria-hidden style={{ opacity: 0.6 }}>·</span>}
          <span>{r.leader ? '♛ ' : ''}{r.name}</span>
          <span className="tabular-nums" style={{ color: '#d9c6a3', fontWeight: 600 }}>{r.dist !== null ? `${Math.round(r.dist)}m` : r.where}</span>
        </div>
      ))}
    </div>
  )
}
