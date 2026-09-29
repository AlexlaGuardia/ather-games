'use client'
// party-lobby.ts — the party's shared roster, leader, mission pick and launch (2026-09-29, the Departures lobby).
//
// Alex: *"it should feel like the apex legends lobby where you see your character and friends that join… the party
// leader can navigate the team or run solo… returning after the mission still partied up."* A party code alone
// (lib/party.ts) is membership and nothing else: no roster outside your zone, no leader, no shared choice, and
// "Go together" used to launch only the keeper who pressed it. The lobby socket (shimmer-server `lobby.py`) owns
// those four things, across zones, and this hook is its client.
//
// ⚠ It does not MOVE anyone. A launch is news ("the party went to the Breach"); the page that hears it decides whether
// its keeper is standing somewhere it can go from. That keeps every warp behind the page's own gates.
import { useCallback, useEffect, useRef, useState } from 'react'

export type Mission = 'survival' | 'boss' | 'expedition'
export interface LobbyMember { id: string; name: string; zone: string; ready: boolean; trusted: boolean; look: string }
export interface LobbyState { code: string; leader: string | null; mission: Mission; launch_gen: number; members: LobbyMember[] }
export interface LobbyLaunch { mission: Mission; gen: number; by: string }

export function lobbyUrl(code: string, userId: string, name: string, zone: string, look = ''): string | null {
  if (typeof window === 'undefined') return null
  const { protocol, host } = window.location
  const q = new URLSearchParams({ code, user_id: userId, name, zone, look })
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/shimmer-ws/lobby?${q}`
}

/**
 * Connected while `code` is set. `zone` is re-sent on change (never a reconnect), so a mate walking from the Station
 * down to the Rune Hold shows where they went without dropping out of the roster.
 */
export function usePartyLobby(opts: {
  code: string | null
  userId: string | null
  name: string
  zone: string
  /** the id the world draws this keeper by (RemotePlayers' hue), so the lobby shows the body mates see */
  look?: string
  onLaunched?: (l: LobbyLaunch) => void
}) {
  const { code, userId, name, zone, look = '' } = opts
  const [state, setState] = useState<LobbyState | null>(null)
  const [you, setYou] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const onLaunchedRef = useRef(opts.onLaunched); onLaunchedRef.current = opts.onLaunched
  const zoneRef = useRef(zone); zoneRef.current = zone
  // the newest launch this page has already heard, so a reconnect's replayed state never re-launches anyone
  const seenGen = useRef(-1)

  useEffect(() => {
    setState(null); setYou(null); setFull(false)
    if (!code || !userId) return
    let closed = false, attempt = 0
    let retry: ReturnType<typeof setTimeout> | null = null
    const connect = () => {
      const url = lobbyUrl(code, userId, name, zoneRef.current, look)
      if (!url) return
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onopen = () => { attempt = 0 }
      ws.onmessage = (ev) => {
        let m: Record<string, unknown>
        try { m = JSON.parse(ev.data) } catch { return }
        if (m.type === 'lobby_state') {
          if (typeof m.you === 'string') setYou(m.you)
          const st = m as unknown as LobbyState
          if (seenGen.current < 0) seenGen.current = st.launch_gen   // arriving late is not hearing the launch
          setState({ code: st.code, leader: st.leader, mission: st.mission, launch_gen: st.launch_gen, members: st.members })
        } else if (m.type === 'lobby_launched') {
          const l = m as unknown as LobbyLaunch
          if (l.gen <= seenGen.current) return
          seenGen.current = l.gen
          onLaunchedRef.current?.(l)
        } else if (m.type === 'lobby_full') {
          setFull(true); closed = true
        }
      }
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null
        if (closed) return
        retry = setTimeout(connect, Math.min(15000, 1000 * 2 ** attempt++))
      }
      ws.onerror = () => { try { ws.close() } catch { /* gone */ } }
    }
    connect()
    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      try { wsRef.current?.close() } catch { /* gone */ }
      wsRef.current = null
      seenGen.current = -1
    }
  }, [code, userId, name, look])

  useEffect(() => { send({ type: 'lobby_zone', zone }) }, [zone])   // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])
  const isLeader = !!state && !!you && state.leader === you
  return {
    state, you, full, isLeader,
    pick: (mission: Mission) => send({ type: 'lobby_pick', mission }),
    ready: (on: boolean) => send({ type: 'lobby_ready', ready: on }),
    launch: (mission: Mission) => send({ type: 'lobby_launch', mission }),
  }
}
