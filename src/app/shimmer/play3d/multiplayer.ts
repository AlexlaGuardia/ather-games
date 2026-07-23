'use client'
// Presence netcode for play3d — see other players moving in the same world.
//
// Server: /root/shimmer-server (FastAPI + WS, PM2 `shimmer-server`, :8400), reached at
// wss://<host>/shimmer-ws/ws via a cloudflared ingress rule on ather.games. That rule lives in
// the tunnel's REMOTE config (Cloudflare API), not ~/.cloudflared/config.yml — the local file is
// fetched-over and ignored, so editing it does nothing.
//
// SCOPE: presence only. Position and facing, nothing else. The game stays fully
// client-authoritative — saves are localStorage — so nothing here can be trusted for combat,
// economy or building, and none of that is synced. Adding those means server-side state first.
//
// The 2D game (archived) uses the same server with `direction` 0-7 + a sprite key. play3d sends
// x/y/z + a continuous yaw, and prefixes its zone with `play3d:` so the two never share an
// instance — they don't share a coordinate space and would render as garbage in each other.
import { useEffect, useRef } from 'react'

export interface RemotePlayer {
  id: string
  name: string
  // where the server last said they are
  tx: number; ty: number; tz: number; tyaw: number
  // where we're drawing them — lerped toward the target so 12Hz doesn't look like 12Hz
  x: number; y: number; z: number; yaw: number
  moving: boolean
  lastSeen: number
}

const SEND_HZ = 12          // position updates/sec. 2D shipped 5Hz on a grid; a first-person
                            // player who slides and bhops needs more or remote motion strobes.
const SEND_MIN_DELTA = 0.02 // don't spend a packet on standing still
const ZONE_PREFIX = 'play3d:'

/** Stable per-browser identity. Incognito gets its own — which is exactly how you test this. */
function identity(): { id: string; name: string } {
  let id = ''
  let name = ''
  try {
    id = localStorage.getItem('ather:mp:id') || ''
    name = localStorage.getItem('ather:mp:name') || ''
    if (!id) {
      id = 'p_' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem('ather:mp:id', id)
    }
    if (!name) {
      name = 'Traveler-' + id.slice(2, 6)
      localStorage.setItem('ather:mp:name', name)
    }
  } catch {
    // private-mode storage refusal — still playable, just a new identity each load
    id = 'p_' + Math.random().toString(36).slice(2, 10)
    name = 'Traveler'
  }
  return { id, name }
}

// ── Play-Together identity + party (the UI reads/writes through these) ─────────
//
// A party is a shared CODE, not an account: everyone connecting with the same code
// lands in the same instance per zone (server keys `party_<code>__<zone>`), and the
// code persists in localStorage so warps and reloads keep the party together.
// Possession of the code IS membership — there's no server-side friend state yet,
// deliberately: player_id is client-claimed, so a "real" friends list would be
// security theater until identity is server-trusted.

const PARTY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no I/L/O/0/1 — read-aloud safe

export function sanitizePartyCode(raw: string): string | null {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return clean.length >= 4 ? clean : null
}

export function newPartyCode(): string {
  let code = ''
  for (let i = 0; i < 5; i++) code += PARTY_ALPHABET[Math.floor(Math.random() * PARTY_ALPHABET.length)]
  return code
}

export function storedParty(): string | null {
  try { return sanitizePartyCode(localStorage.getItem('ather:mp:party') ?? '') } catch { return null }
}

export function storeParty(code: string | null) {
  try {
    if (code) localStorage.setItem('ather:mp:party', code)
    else localStorage.removeItem('ather:mp:party')
  } catch { /* private mode — party just won't survive a reload */ }
}

export function storedName(): string {
  return identity().name
}

export function storeName(name: string): string {
  const clean = name.trim().slice(0, 24)
  if (!clean) return identity().name
  try { localStorage.setItem('ather:mp:name', clean) } catch { /* session-only then */ }
  return clean
}

export function selfPlayerId(): string {
  return identity().id
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/shimmer/play3d?party=${code}`
}

export function wsUrl(zoneId: string, party: string | null, playerName: string): string | null {
  if (typeof window === 'undefined') return null
  const { protocol, host } = window.location
  const scheme = protocol === 'https:' ? 'wss:' : 'ws:'
  const { id, name } = identity()
  const q = new URLSearchParams({
    player_id: id, name: playerName || name,
    zone: ZONE_PREFIX + zoneId,
    instance_type: 'zone',
  })
  if (party) q.set('party', party)
  return `${scheme}//${host}/shimmer-ws/ws?${q}`
}

/**
 * Connects, streams this player's position, and keeps a live map of everyone else.
 *
 * Returns a REF, deliberately: remote positions change ~12x/sec and re-rendering the scene
 * graph at that rate would be worse than the feature. The renderer reads the ref each frame.
 */
export function useMultiplayer(opts: {
  enabled: boolean
  zoneId: string
  posRef: React.RefObject<{ x: number; y: number; z: number } | null>
  yawRef: React.RefObject<number>
  /** shared party code — a change reconnects into the party's instance */
  party?: string | null
  /** display name — a change reconnects so the roster shows the new name */
  playerName?: string
}) {
  const { enabled, zoneId, posRef, yawRef, party = null, playerName = '' } = opts
  const peers = useRef<Map<string, RemotePlayer>>(new Map())
  const selfId = useRef<string>('')
  const status = useRef<'off' | 'connecting' | 'live' | 'error'>('off')

  useEffect(() => {
    if (!enabled || !zoneId) return
    const url = wsUrl(zoneId, party, playerName)
    if (!url) return
    selfId.current = identity().id

    let ws: WebSocket | null = null
    let sendTimer: ReturnType<typeof setInterval> | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let closed = false
    let attempt = 0
    const last = { x: NaN, y: NaN, z: NaN, yaw: NaN }

    const upsert = (p: Record<string, unknown>) => {
      const id = String(p.player_id ?? '')
      if (!id || id === selfId.current) return
      const x = Number(p.x ?? 0), y = Number(p.y ?? 0), z = Number(p.z ?? 0), yaw = Number(p.yaw ?? 0)
      const cur = peers.current.get(id)
      if (cur) {
        cur.tx = x; cur.ty = y; cur.tz = z; cur.tyaw = yaw
        cur.moving = Boolean(p.moving)
        cur.lastSeen = performance.now()
      } else {
        // first sighting snaps rather than lerps in from wherever the last player stood
        peers.current.set(id, {
          id, name: String(p.name ?? 'Traveler'),
          tx: x, ty: y, tz: z, tyaw: yaw,
          x, y, z, yaw,
          moving: Boolean(p.moving), lastSeen: performance.now(),
        })
      }
    }

    const connect = () => {
      if (closed) return
      status.current = 'connecting'
      try { ws = new WebSocket(url) } catch { status.current = 'error'; return }

      ws.onopen = () => {
        attempt = 0
        status.current = 'live'
        sendTimer = setInterval(() => {
          const p = posRef.current
          if (!p || !ws || ws.readyState !== WebSocket.OPEN) return
          const yaw = yawRef.current ?? 0
          const moved = Math.abs(p.x - last.x) > SEND_MIN_DELTA
            || Math.abs(p.y - last.y) > SEND_MIN_DELTA
            || Math.abs(p.z - last.z) > SEND_MIN_DELTA
            || Math.abs(yaw - last.yaw) > 0.03
          if (!moved) return
          last.x = p.x; last.y = p.y; last.z = p.z; last.yaw = yaw
          ws.send(JSON.stringify({ type: 'move', x: p.x, y: p.y, z: p.z, yaw, moving: true }))
        }, 1000 / SEND_HZ)
      }

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>
        try { msg = JSON.parse(ev.data as string) } catch { return }
        switch (msg.type) {
          case 'instance_state': {
            peers.current.clear()
            for (const p of (msg.players as Record<string, unknown>[]) ?? []) upsert(p)
            break
          }
          case 'player_joined':
          case 'player_moved':
            upsert((msg.player as Record<string, unknown>) ?? msg)
            break
          case 'player_left': {
            const id = String((msg.player_id as string) ?? '')
            if (id) peers.current.delete(id)
            break
          }
        }
      }

      const reconnect = () => {
        if (sendTimer) { clearInterval(sendTimer); sendTimer = null }
        peers.current.clear()
        if (closed) return
        status.current = 'error'
        // backoff — a dropped tunnel shouldn't turn into a reconnect storm
        const delay = Math.min(15000, 1000 * 2 ** attempt++)
        retry = setTimeout(connect, delay)
      }
      ws.onclose = reconnect
      ws.onerror = () => { try { ws?.close() } catch { /* already gone */ } }
    }

    connect()
    return () => {
      closed = true
      if (sendTimer) clearInterval(sendTimer)
      if (retry) clearTimeout(retry)
      try { ws?.close() } catch { /* nothing to close */ }
      peers.current.clear()
      status.current = 'off'
    }
  }, [enabled, zoneId, posRef, yawRef, party, playerName])

  return { peers, status }
}
