'use client'
// ── PLOT VISITS over the relay (BETA M61 slice 1; the rules are in plot-visit.ts) ─────────────────────────────────────────────
// HOST (on their own plot, in a party, socket zone open:plot:<self>): a PV_WANT from a peer is answered with the plot's snapshot,
// chunked, sent to that peer only, paced under the server's 20 relays/s.
// GUEST (visiting, socket zone open:plot:<host>): asks the host every ASK_MS until the plot has arrived, assembles the parts and
// hands the snapshot to the visit store (which the works store reads).
import { useEffect, useRef, useState, useCallback } from 'react'
import { PV_WANT, PV_SNAP, packSnap, unpackSnap, chunk, Reassembly, isSnapPart, setVisitSnap, refusalCount, visitLog, SendQueue, PV_HOME, isHomeMsg, homeLine, HostWatch, endVisit, guestLifts, GIVE_UP_ASKS, type Visit, type PlotSnap } from './plot-visit'

type Relay = (kind: string, data: unknown, to?: string) => boolean
type OnRelay = (f: (m: { from: string; kind: string; data: unknown }) => void) => () => void
const ASK_MS = 1500
/** one part every PACE_MS: ~16/s, under the server's 20/s refill with its burst of 30 left for everything else */
const PACE_MS = 60

const probe = { sent: 0, asked: 0, answered: 0, got: 0, v: 0, pushed: 0, sentHome: 0 }
/** a change on the host's plot goes out this long after the last write */
const RESEND_MS = 900

/** slice 3: how often the guest looks for the host among the live peers, and the host refreshes its guest list */
const WATCH_MS = 1000
/** leftovers: how often the host checks the parts of its plot that live outside the works store */
const POLL_MS = 4000

export function usePlotVisitNet(o: { relay: Relay; onRelay: OnRelay; hosting: boolean; visit: Visit | null; snapOf: () => PlotSnap; live: () => string[]; rev: unknown
  say: (msg: string) => void }) {
  const say = useRef(o.say); say.current = o.say
  /** slice 3: the guests on the host's plot right now (ids that asked for it and are still live), for the Send home pill */
  const [guestIds, setGuestIds] = useState<string[]>([])
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
    // slice 3: the guest list = the guests heard from lately. One missing from the live peers (home, offline, or a phone that
    // stalled past the keepalive) is only HIDDEN, never forgotten: a guest holding the plot never asks again, so dropping it
    // for good on a blip would end its live updates for the rest of the visit. Back in view = the plot as it stands now.
    const absent = new Set<string>()
    const w = setInterval(async () => {
      const here = new Set(live.current())
      for (const g of guests.current) {
        if (!here.has(g)) { if (!absent.has(g)) { absent.add(g); q.drop(g) } }
        else if (absent.delete(g)) { const c = await packed(); q.enqueue(g, chunk(c.packed, c.v)) }
      }
      setGuestIds(prev => { const now = [...guests.current].filter(g => here.has(g)).sort(); return prev.length === now.length && prev.every((x, i) => x === now[i]) ? prev : now })
    }, WATCH_MS)
    // leftovers: the Moglins, beds and tanks change outside the works store (village tick, farm panel), so the host also looks
    // every POLL_MS: a new pack = a new version for every guest in view (packed() re-packs only when the plot really changed)
    let lastV = 0
    const poll = setInterval(async () => {
      const here = new Set(live.current()), to = [...guests.current].filter(g => here.has(g)); if (!to.length) return
      const c = await packed(); if (!lastV) { lastV = c.v; return }
      if (c.v === lastV) return
      lastV = c.v; probe.pushed++
      for (const g of to) q.enqueue(g, chunk(c.packed, c.v))
    }, POLL_MS)
    return () => {
      off(); clearInterval(t); clearInterval(w); clearInterval(poll)
      for (const g of guests.current) o.relay(PV_HOME, { why: 'left' }, g)   // slice 3: the host left the plot: guests head home
      guests.current.clear(); while (q.next()); setGuestIds([])
    }
  }, [o.hosting, o.relay, o.onRelay])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── host, slice 2: the plot changed -> every guest still here gets the new version (debounced: a wall drag is many writes) ──
  useEffect(() => {
    if (!o.hosting || !guests.current.size) return
    const t = setTimeout(async () => {
      const here = new Set(live.current()), to = [...guests.current].filter(g => here.has(g))   // the absent catch up on return
      if (!to.length) return
      const c = await packed(); probe.pushed++
      for (const g of to) queue.current.enqueue(g, chunk(c.packed, c.v))
    }, RESEND_MS)
    return () => clearTimeout(t)
  }, [o.hosting, o.rev])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── guest ──
  const host = o.visit?.host ?? null, have = !!o.visit?.snap
  useEffect(() => {
    if (!host) return
    const re = new Reassembly()
    const off = o.onRelay(async m => {
      if (m.kind === PV_SNAP ? (m.from !== host || !isSnapPart(m.data)) : m.kind !== PV_HOME) return
      if (m.kind === PV_HOME && m.from === host && isHomeMsg(m.data)) { const v = o.visit; say.current(homeLine(m.data.why, v?.name ?? 'Your friend')); endVisit(m.data.why === 'sent' ? 'sent-home' : 'host-left'); return }
      if (!isSnapPart(m.data)) return
      const packed = re.add(m.data); if (!packed) return
      const s = await unpackSnap(packed)
      if (s && setVisitSnap(host, m.data.v, s)) { probe.got++; probe.v = m.data.v }
    })
    return off
  }, [host, o.onRelay])   // eslint-disable-line react-hooks/exhaustive-deps
  // slice 3: the host offline / gone from the plot without a word (tab shut, network) = home, once the plot had arrived
  useEffect(() => {
    if (!host || !have) return
    const hw = new HostWatch(), name = o.visit?.name ?? 'Your friend'
    const t = setInterval(() => { if (hw.tick(live.current().includes(host), performance.now())) { say.current(homeLine('host-left', name)); endVisit('host-left') } }, WATCH_MS)
    return () => clearInterval(t)
  }, [host, have])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!host || have) return
    let n = 0
    const ask = () => {
      if (!o.relay(PV_WANT, {}, host)) return
      probe.asked++
      if (++n > GIVE_UP_ASKS) { say.current(`Could not reach ${o.visit?.name ?? 'their'}'s plot. They may have left it.`); endVisit('timeout') }
    }
    ask(); const t = setInterval(ask, ASK_MS)
    return () => clearInterval(t)
  }, [host, have, o.relay])

  /** host: send one guest home (they leave on the message; the guest list drops them on the next watch) */
  const sendHome = useCallback((id: string) => {
    if (!guests.current.has(id) || !o.relay(PV_HOME, { why: 'sent' }, id)) return false
    probe.sentHome++; guests.current.delete(id); queue.current.drop(id); setGuestIds(prev => prev.filter(x => x !== id)); return true
  }, [o.relay])

  if (typeof window !== 'undefined') (window as unknown as { __visit?: unknown }).__visit = {
    guests: () => [...guests.current], lifts: () => guestLifts(), sendHome,
    visiting: () => !!o.visit, host: () => o.visit?.host ?? null, name: () => o.visit?.name ?? null, hasSnap: () => !!o.visit?.snap,
    hosting: () => o.hosting, refusals: () => refusalCount(), net: () => ({ ...probe }), log: () => visitLog(),
    /** what arrived: wall / piece / level counts of the visited plot's snapshot */
    shown: () => { const w = o.visit?.snap?.works; return w ? { walls: Object.keys(w.walls ?? {}).length, pieces: w.pieces.map(x => x.item), upper: w.upper?.length ?? 0, upperWalls: (w.upper ?? []).map(l => Object.keys(l.walls ?? {}).length), owned: o.visit!.snap!.owned.length } : null },
  }
  return { guests: guestIds, sendHome }
}
