'use client'
// ── PLOT VISITS over the relay (BETA M61 slice 1; the rules are in plot-visit.ts) ─────────────────────────────────────────────
// HOST (on their own plot, in a party, socket zone open:plot:<self>): a PV_WANT from a peer is answered with the plot's snapshot,
// chunked, sent to that peer only, paced under the server's 20 relays/s.
// GUEST (visiting, socket zone open:plot:<host>): asks the host every ASK_MS until the plot has arrived, assembles the parts and
// hands the snapshot to the visit store (which the works store reads).
import { useEffect, useRef } from 'react'
import { PV_WANT, PV_SNAP, packSnap, unpackSnap, chunk, Reassembly, isSnapPart, setVisitSnap, refusalCount, visitLog, SendQueue, type Visit, type PlotSnap } from './plot-visit'

type Relay = (kind: string, data: unknown, to?: string) => boolean
type OnRelay = (f: (m: { from: string; kind: string; data: unknown }) => void) => () => void
const ASK_MS = 1500
/** one part every PACE_MS: ~16/s, under the server's 20/s refill with its burst of 30 left for everything else */
const PACE_MS = 60

const probe = { sent: 0, asked: 0, answered: 0, got: 0, v: 0, pushed: 0 }
/** a change on the host's plot goes out this long after the last write */
const RESEND_MS = 900

export function usePlotVisitNet(o: { relay: Relay; onRelay: OnRelay; hosting: boolean; visit: Visit | null; snapOf: () => PlotSnap; live: () => string[]; rev: unknown }) {
  const snapOf = useRef(o.snapOf); snapOf.current = o.snapOf
  const live = useRef(o.live); live.current = o.live
  const cache = useRef<{ key: string; packed: string; v: number } | null>(null)
  const queue = useRef(new SendQueue())
  const guests = useRef(new Set<string>())
  /** the plot as it stands now, packed (re-packed only when it changed; a new pack = a new version) */
  const packed = async () => {
    const s = snapOf.current(), key = JSON.stringify(s)
    if (!cache.current || cache.current.key !== key) cache.current = { key, packed: await packSnap(s), v: Math.max(Date.now(), (cache.current?.v ?? 0) + 1) }
    return cache.current
  }

  // ── host: answer PV_WANT, drain the one queue at PACE_MS ──
  useEffect(() => {
    if (!o.hosting) return
    const q = queue.current
    const off = o.onRelay(async m => {
      if (m.kind !== PV_WANT) return
      guests.current.add(m.from); probe.answered++
      const c = await packed(); q.enqueue(m.from, chunk(c.packed, c.v))
    })
    const t = setInterval(() => { const n = q.next(); if (n && o.relay(PV_SNAP, n.part, n.to)) probe.sent++ }, PACE_MS)
    return () => { off(); clearInterval(t); guests.current.clear(); while (q.next()); }
  }, [o.hosting, o.relay, o.onRelay])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── host, slice 2: the plot changed -> every guest still here gets the new version (debounced: a wall drag is many writes) ──
  useEffect(() => {
    if (!o.hosting || !guests.current.size) return
    const t = setTimeout(async () => {
      const here = new Set(live.current())
      for (const g of [...guests.current]) if (!here.has(g)) { guests.current.delete(g); queue.current.drop(g) }
      if (!guests.current.size) return
      const c = await packed(); probe.pushed++
      for (const g of guests.current) queue.current.enqueue(g, chunk(c.packed, c.v))
    }, RESEND_MS)
    return () => clearTimeout(t)
  }, [o.hosting, o.rev])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── guest ──
  const host = o.visit?.host ?? null, have = !!o.visit?.snap
  useEffect(() => {
    if (!host) return
    const re = new Reassembly()
    const off = o.onRelay(async m => {
      if (m.kind !== PV_SNAP || m.from !== host || !isSnapPart(m.data)) return
      const packed = re.add(m.data); if (!packed) return
      const s = await unpackSnap(packed)
      if (s && setVisitSnap(host, m.data.v, s)) { probe.got++; probe.v = m.data.v }
    })
    return off
  }, [host, o.onRelay])
  useEffect(() => {
    if (!host || have) return
    const ask = () => { if (o.relay(PV_WANT, {}, host)) probe.asked++ }
    ask(); const t = setInterval(ask, ASK_MS)
    return () => clearInterval(t)
  }, [host, have, o.relay])

  if (typeof window !== 'undefined') (window as unknown as { __visit?: unknown }).__visit = {
    visiting: () => !!o.visit, host: () => o.visit?.host ?? null, name: () => o.visit?.name ?? null, hasSnap: () => !!o.visit?.snap,
    hosting: () => o.hosting, refusals: () => refusalCount(), net: () => ({ ...probe }), log: () => visitLog(),
    /** what arrived: wall / piece / level counts of the visited plot's snapshot */
    shown: () => { const w = o.visit?.snap?.works; return w ? { walls: Object.keys(w.walls ?? {}).length, pieces: w.pieces.map(x => x.item), upper: w.upper?.length ?? 0, upperWalls: (w.upper ?? []).map(l => Object.keys(l.walls ?? {}).length), owned: o.visit!.snap!.owned.length } : null },
  }
}
