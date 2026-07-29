'use client'

// ── The networked card table ──────────────────────────────────────────────────
//
// The party (lib/party.ts) says WHO you are playing with. This says how the cards get there.
//
// The rule that makes the whole thing work, and the one thing to keep in mind before editing
// anything here: A MOVE IS NEVER APPLIED LOCALLY. You send it, the server stamps it with a
// sequence number, and you apply it when it comes back — exactly like everyone else at the
// table. That is one round trip of latency on your own discard, which on a card game nobody
// can perceive, and in exchange there is no local-versus-remote ordering, no prediction, and
// no rollback. Every client runs the identical list of moves in the identical order over the
// identical seeded deal, so the tables cannot drift apart.
//
// What this hook does NOT do is decide anything about Magii. It hands the page a seat, a
// seed, a roster and an ordered stream of moves; the reducers in engine.ts are the only code
// that knows what a move means.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Collection } from './data'
import {
  type GameState, type SeatSpec,
  NPC_NAMES, initGame, startPlaying, drawFromDeck, drawFromDiscard, discardCard, callMagii,
} from './engine'

const PING_MS = 45_000  // Cloudflare reaps an idle tunnel socket; the server ignores unknown types
const RETRY_MS = 3_000

export interface SeatInfo {
  seat: number
  name: string
  occupied: boolean
  trusted: boolean
}

/** A relayed move. `kind` is the reducer to run; the rest is that reducer's arguments. */
export type TableMove =
  | { kind: 'draw-deck' }
  | { kind: 'draw-discard'; targetId: number }
  | { kind: 'discard'; cardIdx: number }
  | { kind: 'call' }

export interface StampedMove {
  seq: number
  seat: number
  move: TableMove
}

export interface TableSession {
  /** Which chair is yours. null until the server says. */
  seat: number | null
  /** The deal everyone at this table builds from. */
  seed: string | null
  /**
   * The deck the table is playing with — the HOST's, not yours. A seed means nothing without
   * it: the same seed dealt from two collections is two different tables, so this overrules
   * whatever you had selected on the start screen.
   */
  collection: string | null
  /** Bumped on every fresh deal; carried on each move so a stale one is dropped. */
  gen: number
  roster: SeatInfo[]
  /** The seat that drives the empty chairs. Exactly one client runs the NPC brains. */
  dealer: number | null
  /** Moves in server order. Append-only within a generation; reset on a new deal. */
  moves: StampedMove[]
  connected: boolean
  full: boolean
  /** Submit your own move. It applies when the server echoes it, never before. */
  send: (move: TableMove) => void
  /** Submit a move on behalf of an empty chair. Only the dealer's is accepted. */
  sendFor: (seat: number, move: TableMove) => void
  dealAgain: () => void
}

const EMPTY: SeatInfo[] = []

export function useTable(
  code: string | null,
  name: string,
  userId: string | null,
  /** The deck you bring if you are the first to sit. Ignored once a table exists. */
  preferredCollection = 'tavern',
): TableSession {
  const [seat, setSeat] = useState<number | null>(null)
  const [seed, setSeed] = useState<string | null>(null)
  const [collection, setCollection] = useState<string | null>(null)
  const [gen, setGen] = useState(0)
  const [roster, setRoster] = useState<SeatInfo[]>(EMPTY)
  const [dealer, setDealer] = useState<number | null>(null)
  const [moves, setMoves] = useState<StampedMove[]>([])
  const [connected, setConnected] = useState(false)
  const [full, setFull] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  // The generation is read inside send(), which must not be re-created on every deal or the
  // page's callbacks all change identity mid-game.
  const genRef = useRef(0)

  useEffect(() => {
    if (!code) {
      setSeat(null); setSeed(null); setCollection(null); setRoster(EMPTY); setDealer(null)
      setMoves([]); setConnected(false); setFull(false)
      return
    }

    let closed = false
    let retry: ReturnType<typeof setTimeout> | null = null
    let ping: ReturnType<typeof setInterval> | null = null

    const connect = () => {
      if (closed) return
      const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const q = new URLSearchParams({ code, name: name || 'Traveler', collection: preferredCollection })
      if (userId) q.set('user_id', userId)
      const ws = new WebSocket(`${scheme}//${window.location.host}/shimmer-ws/table?${q}`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        ping = setInterval(() => { try { ws.send(JSON.stringify({ type: 'ping' })) } catch { /* closing */ } }, PING_MS)
      }

      ws.onmessage = (e) => {
        let msg: {
          type?: string; seat?: number; seed?: string; collection?: string; gen?: number
          dealer?: number | null; roster?: SeatInfo[]; log?: StampedMove[]
          seq?: number; move?: TableMove
        }
        try { msg = JSON.parse(e.data as string) } catch { return }

        if (msg.type === 'table_welcome') {
          // The log is the replay. A table already in progress arrives as (seed, moves) and
          // the page rebuilds the present from it — which is the reason moves are relayed
          // rather than state, and why joining mid-hand needs no special case anywhere.
          setSeat(msg.seat ?? null)
          setSeed(msg.seed ?? null)
          setCollection(msg.collection ?? null)
          genRef.current = msg.gen ?? 0
          setGen(msg.gen ?? 0)
          setRoster(msg.roster ?? EMPTY)
          setDealer(msg.dealer ?? null)
          setMoves(msg.log ?? [])
          setFull(false)
        } else if (msg.type === 'table_roster') {
          setRoster(msg.roster ?? EMPTY)
          setDealer(msg.dealer ?? null)
        } else if (msg.type === 'table_moved') {
          if ((msg.gen ?? 0) !== genRef.current) return  // belongs to a deal that is over
          const stamped = { seq: msg.seq!, seat: msg.seat!, move: msg.move! }
          setMoves(prev => {
            // Ignore a move already applied and refuse to append past a gap: the reducers
            // must run in an unbroken sequence or two clients apply the same moves to
            // different states. A gap means this socket missed something, which the
            // reconnect path resolves by re-reading the whole log.
            const last = prev.length ? prev[prev.length - 1].seq : 0
            if (stamped.seq <= last) return prev
            if (stamped.seq !== last + 1) {
              console.error(`[table] move gap: expected ${last + 1}, got ${stamped.seq} — reconnecting`)
              try { ws.close() } catch { /* already gone */ }
              return prev
            }
            return [...prev, stamped]
          })
        } else if (msg.type === 'table_dealt') {
          genRef.current = msg.gen ?? 0
          setGen(msg.gen ?? 0)
          setSeed(msg.seed ?? null)
          if (msg.collection) setCollection(msg.collection)
          setMoves([])
        } else if (msg.type === 'table_full') {
          // Four chairs is the design, not a limit to route around. Say so and stay off.
          setFull(true)
          closed = true
          try { ws.close() } catch { /* already gone */ }
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (ping) { clearInterval(ping); ping = null }
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
  }, [code, name, userId, preferredCollection])

  const send = useCallback((move: TableMove) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'table_move', gen: genRef.current, move }))
  }, [])

  const sendFor = useCallback((forSeat: number, move: TableMove) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'table_move', gen: genRef.current, for_seat: forSeat, move }))
  }, [])

  const dealAgain = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    // Compare-and-swap on the generation: anyone may ask, and simultaneous asks collapse
    // into one deal instead of two decks.
    ws.send(JSON.stringify({ type: 'table_reset', gen: genRef.current }))
  }, [])

  return { seat, seed, collection, gen, roster, dealer, moves, connected, full, send, sendFor, dealAgain }
}

/**
 * Who sits where, from the server's roster and your own seat.
 *
 * Two properties matter and they pull against each other slightly:
 *   • EVERY CLIENT MUST AGREE which chairs the regulars hold, or two players talking about
 *     "Renna" mean different tables. So the mapping is derived from the roster alone.
 *   • YOUR chair is labelled "You" locally, because every phrasing in the engine's log keys
 *     off that name. That is the one difference between clients, it is cosmetic, and names
 *     are deliberately not part of the deal (see initGame) so it cannot cause a divergence.
 */
export function tableSeats(roster: SeatInfo[], mySeat: number | null): SeatSpec[] {
  const out: SeatSpec[] = []
  for (let i = 0; i < 4; i++) {
    if (roster[i]?.occupied) {
      let name = i === mySeat ? 'You' : (roster[i].name || 'Traveler')
      // A stranger who named themselves "You" would make every log line ambiguous.
      if (i !== mySeat && name === 'You') name = `You (${i + 1})`
      out.push({ name, isHuman: true })
    } else {
      out.push({ name: regularFor(i, roster), isHuman: false })
    }
  }
  return out
}

/**
 * Which regular is holding an empty chair.
 *
 * Seats 1-3 keep the names they have always had in solo play, so the table a player knows
 * does not rearrange itself the moment it goes online.
 *
 * Seat 0 has no regular of its own — solo play always seats YOU there, so only three were
 * ever named — and it is only ever empty when the first player to sit has left. Naming a
 * fourth tavern regular is a CANON call and belongs to the Magii seat, not to this file, so
 * instead it borrows the name freed up by the lowest occupied seat. That is provably
 * available: a table with nobody at it stops existing, so at least one of seats 1-3 holds a
 * person and has given its regular's name back.
 */
function regularFor(seat: number, roster: SeatInfo[]): string {
  if (seat >= 1) return NPC_NAMES[seat - 1]
  for (let i = 1; i < 4; i++) if (roster[i]?.occupied) return NPC_NAMES[i - 1]
  return NPC_NAMES[0]
}

/**
 * Turn a relayed move into the reducer call it names.
 *
 * The one place the wire vocabulary meets the engine. Kept as a plain function rather than
 * inlined in the page so a replay and a live move go through identical code — if they ever
 * diverged, a latecomer's table would differ from everyone else's in a way that only shows
 * up several turns later.
 */
export function reduceMove(state: GameState, stamped: StampedMove): GameState {
  const { seat, move } = stamped
  switch (move.kind) {
    case 'draw-deck': return drawFromDeck(state, seat)
    case 'draw-discard': return drawFromDiscard(state, seat, move.targetId)
    case 'discard': return discardCard(state, seat, move.cardIdx)
    case 'call': return callMagii(state, seat)
    // An unknown kind is not a crash. The wire will carry a move from a newer client than
    // this one, and every reducer already treats an illegal move as a no-op — so the honest
    // response is to skip it and stay converged with everyone who also skipped it.
    default: return state
  }
}

/**
 * Rebuild the present from the deal and the moves so far — the replay a latecomer runs, and
 * the single path every client's state comes from. Because the reducers are pure, running
 * this over the same log twice lands on the same table (guarded in magii.test.ts).
 */
export function replay(
  collection: Collection,
  seed: string,
  seats: SeatSpec[],
  moves: StampedMove[],
): GameState {
  let s = startPlaying(initGame(collection, seed, seats))
  for (const m of moves) s = reduceMove(s, m)
  return s
}
