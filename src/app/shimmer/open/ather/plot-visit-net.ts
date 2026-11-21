'use client'
// ── PLOT VISITS over the relay (BETA M61 slice 1; the rules are in plot-visit.ts) ─────────────────────────────────────────────
// HOST (on their own plot, in a party, socket zone open:plot:<self>): a PV_WANT from a peer is answered with the plot's snapshot,
// chunked, sent to that peer only, paced under the server's 20 relays/s.
// GUEST (visiting, socket zone open:plot:<host>): asks the host every ASK_MS until the plot has arrived, assembles the parts and
// hands the snapshot to the visit store (which the works store reads).
import { useEffect, useRef } from 'react'
import { PV_WANT, PV_SNAP, packSnap, unpackSnap, chunk, Reassembly, isSnapPart, setVisitSnap, refusalCount, type Visit, type PlotSnap } from './plot-visit'

type Relay = (kind: string, data: unknown, to?: string) => boolean
type OnRelay = (f: (m: { from: string; kind: string; data: unknown }) => void) => () => void
const ASK_MS = 1500
/** one part every PACE_MS: ~16/s, under the server's 20/s refill with its burst of 30 left for everything else */
const PACE_MS = 60

const probe = { sent: 0, asked: 0, answered: 0, got: 0, v: 0 }

export function usePlotVisitNet(o: { relay: Relay; onRelay: OnRelay; hosting: boolean; visit: Visit | null; snapOf: () => PlotSnap }) {
  const snapOf = useRef(o.snapOf); snapOf.current = o.snapOf
  const cache = useRef<{ key: string; packed: string; v: number } | null>(null)

  // ── host ──
  useEffect(() => {
    if (!o.hosting) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const busy = new Set<string>()
    const off = o.onRelay(async m => {
      if (m.kind !== PV_WANT || busy.has(m.from)) return
      busy.add(m.from); probe.answered++
      const s = snapOf.current(), key = JSON.stringify(s)
      if (!cache.current || cache.current.key !== key) cache.current = { key, packed: await packSnap(s), v: Date.now() }
      const parts = chunk(cache.current.packed, cache.current.v)
      parts.forEach((p, i) => timers.push(setTimeout(() => { if (o.relay(PV_SNAP, p, m.from)) probe.sent++; if (i === parts.length - 1) busy.delete(m.from) }, i * PACE_MS)))
    })
    return () => { off(); timers.forEach(clearTimeout) }
  }, [o.hosting, o.relay, o.onRelay])

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
    hosting: () => o.hosting, refusals: () => refusalCount(), net: () => ({ ...probe }),
    /** what arrived: wall / piece / level counts of the visited plot's snapshot */
    shown: () => { const w = o.visit?.snap?.works; return w ? { walls: Object.keys(w.walls ?? {}).length, pieces: w.pieces.map(x => x.item), upper: w.upper?.length ?? 0, upperWalls: (w.upper ?? []).map(l => Object.keys(l.walls ?? {}).length), owned: o.visit!.snap!.owned.length } : null },
  }
}
