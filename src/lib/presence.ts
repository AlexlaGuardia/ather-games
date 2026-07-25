'use client'

// ── The site-wide presence socket ─────────────────────────────────────────────
//
// One connection, open wherever you are on ather.games, for the messages that are addressed
// to YOU rather than to a room: today a party invite, next ephemeral chat.
//
// It is separate from the play3d game socket on purpose. That one joins an instance and
// streams position twelve times a second; this one carries almost nothing and exists so a
// friend reading the bookstore is still reachable. Before it, an invite could only find you
// if you happened to be standing in the 3D world.
//
// Identity is NOT sent as a claim the server believes: the `ather_session` cookie rides the
// upgrade automatically (same origin) and the server verifies it. The user_id in the query
// is only a hint for logging and for the anonymous case.

import { useCallback, useEffect, useRef, useState } from 'react'

export interface PartyInvite {
  from_user: string
  from_name: string
  party: string
  at: number
}

export type InviteOutcome = { ok: true } | { ok: false; reason: 'offline' | 'unverified' | 'disconnected' }

const PING_MS = 45_000    // Cloudflare closes an idle tunnel socket; the server ignores unknown types
const RETRY_MS = 4_000

export interface UsePresence {
  connected: boolean
  invite: (toUserId: string, party: string) => Promise<InviteOutcome>
  incoming: PartyInvite | null
  dismiss: () => void
}

export function usePresence(userId: string | null, name: string): UsePresence {
  const [connected, setConnected] = useState(false)
  const [incoming, setIncoming] = useState<PartyInvite | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  // Invites are request/response over a socket that has no correlation ids, and a person can
  // only really click one at a time — so one pending resolver is enough, and it is cleared
  // on any reply.
  const pending = useRef<((r: InviteOutcome) => void) | null>(null)

  useEffect(() => {
    if (!userId) { setConnected(false); return }

    let closed = false
    let retry: ReturnType<typeof setTimeout> | null = null
    let ping: ReturnType<typeof setInterval> | null = null

    const connect = () => {
      if (closed) return
      const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const q = new URLSearchParams({ user_id: userId, name: name || 'Traveler' })
      const ws = new WebSocket(`${scheme}//${window.location.host}/shimmer-ws/presence?${q}`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        ping = setInterval(() => { try { ws.send(JSON.stringify({ type: 'ping' })) } catch { /* closing */ } }, PING_MS)
      }
      ws.onmessage = (e) => {
        let msg: { type?: string; from_user?: string; from_name?: string; party?: string; reason?: string }
        try { msg = JSON.parse(e.data as string) } catch { return }
        if (msg.type === 'party_invited' && msg.party) {
          setIncoming({
            from_user: msg.from_user ?? '',
            from_name: msg.from_name || 'Someone',
            party: msg.party,
            at: Date.now(),
          })
        } else if (msg.type === 'invite_sent') {
          pending.current?.({ ok: true }); pending.current = null
        } else if (msg.type === 'invite_failed') {
          const reason = msg.reason === 'unverified' ? 'unverified' : 'offline'
          pending.current?.({ ok: false, reason }); pending.current = null
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (ping) { clearInterval(ping); ping = null }
        // A pending invite dies with the socket — never leave the caller's promise hanging.
        pending.current?.({ ok: false, reason: 'disconnected' }); pending.current = null
        if (!closed) retry = setTimeout(connect, RETRY_MS)
      }
      ws.onerror = () => { try { ws.close() } catch { /* already gone */ } }
    }

    connect()
    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      if (ping) clearInterval(ping)
      try { wsRef.current?.close() } catch { /* already gone */ }
      wsRef.current = null
    }
  }, [userId, name])

  const invite = useCallback((toUserId: string, party: string): Promise<InviteOutcome> => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.resolve({ ok: false, reason: 'disconnected' } as const)
    return new Promise<InviteOutcome>(resolve => {
      pending.current = resolve
      ws.send(JSON.stringify({ type: 'party_invite', to_user: toUserId, party }))
      // The server always answers, but a socket that dies mid-flight would not — so the
      // promise gets its own ceiling rather than trusting the wire.
      setTimeout(() => { if (pending.current === resolve) { pending.current = null; resolve({ ok: false, reason: 'disconnected' }) } }, 6000)
    })
  }, [])

  const dismiss = useCallback(() => setIncoming(null), [])

  return { connected, invite, incoming, dismiss }
}
