'use client'
// BETA M156 s2: the socket half of guest-wilds.ts. The host sends their ledger (on a change, and every SEND_MS for whoever arrives);
// a guest holds the latest word of the keeper who hosts NOW. Nothing here reads or writes a save.
import { useEffect, useMemo, useRef, useState } from 'react'
import { openNet, OPEN_WILDS } from '../shared/open-mp'
import { sharing } from '../shared/fight-share'
import { noteHost, partyHost, partyOrder } from '../shared/party-host'
import { decodeLedger, encodeLedger, LEDGER_KIND, RELAY_MAX, type HostLedger } from './guest-wilds'
import type { WildsNode } from './nodes'
import { storedParty } from '@/lib/party'

const LOOK_MS = 500, SEND_MS = 3000
/** a page that lands in a party's Wilds leaves its own map alone this many looks (15 s; counted, a slow first load eats wall-clock)
 *  while it does not know yet whose Wilds it is in */
const UNSURE_LOOKS = 30

export interface GuestWilds { ledger: HostLedger | null; host: string | null; /** a guest, or not known yet: no look may write a save */ still: () => boolean }
export function useGuestWilds(allNodes: readonly WildsNode[], mine: () => HostLedger | null, inWilds: boolean): GuestWilds {
  const ids = useMemo(() => allNodes.map(n => n.id).sort(), [allNodes])
  const [got, setGot] = useState<{ host: string; ledger: HostLedger } | null>(null)
  const inWildsRef = useRef(inWilds); inWildsRef.current = inWilds
  const mineRef = useRef(mine); mineRef.current = mine
  const unsure = useRef(true)
  useEffect(() => {
    unsure.current = true; setGot(null)
    if (!inWilds || !ids.length) return
    let looks = 0, off: (() => void) | null = null, sent = '', sentAt = 0
    const heardOf = new Map<string, { key: string; ledger: HostLedger }>()
    const look = () => {
      const n = openNet(); if (!n) return
      off ??= n.onRelay(m => {
        if (m.kind !== LEDGER_KIND) return
        const key = JSON.stringify(m.data), was = heardOf.get(m.from)
        const ledger = was?.key === key ? was.ledger : decodeLedger(ids, m.data)
        if (!ledger) return
        noteHost(m.from); heardOf.set(m.from, { key, ledger }); if (key !== was?.key) look()
      })
      const live = n.zone === OPEN_WILDS ? n.live() : []
      const host = sharing(n.party, live) ? partyHost(n.self, live) : n.self
      for (const k of heardOf.keys()) if (!live.includes(k)) heardOf.delete(k)   // gone = their word is gone (a reload sends it anew)
      const h = host !== n.self ? heardOf.get(host) : undefined
      unsure.current = !!storedParty() && !h && ++looks < UNSURE_LOOKS && !(live.length && host === n.self && partyOrder().includes(n.self))
      setGot(cur => (h ? (cur?.host === host && cur.ledger === h.ledger ? cur : { host, ledger: h.ledger }) : null))
      if (host !== n.self || !live.length || !n.party) { sent = ''; return }
      const l = mineRef.current(); if (!l) return
      const w = encodeLedger(ids, l), key = JSON.stringify(w), now = performance.now()
      if (key.length > RELAY_MAX || (key === sent && now - sentAt < SEND_MS)) return
      if (n.relay(LEDGER_KIND, w)) { sent = key; sentAt = now }
    }
    look(); const t = setInterval(look, LOOK_MS)
    return () => { clearInterval(t); off?.(); setGot(null) }
  }, [ids, inWilds])
  useEffect(() => {   // checks READ it (m156-host-wilds-check)
    const g = window as unknown as { __guest?: unknown }
    g.__guest = { host: () => got?.host ?? null, order: () => [...partyOrder()], ledger: () => got?.ledger ?? null }
    return () => { delete g.__guest }
  }, [got])
  const gotRef = useRef(got); gotRef.current = got
  return useMemo(() => ({ ledger: got?.ledger ?? null, host: got?.host ?? null, still: () => !!gotRef.current || (inWildsRef.current && unsure.current) }), [got]) // eslint-disable-line react-hooks/exhaustive-deps
}
