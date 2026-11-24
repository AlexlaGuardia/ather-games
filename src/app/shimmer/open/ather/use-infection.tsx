'use client'
// BETA M128 s1: the infections' clock on the Ather page (infection.ts is the engine). Off = nothing is read or written.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsOwner } from '@/app/_components/useIsOwner'
import { infectedPlace } from './infect-id'
import { begin, blank, fell, loadInfection, pickable, saveInfection, step, type InfectEvent, type Infection } from './infection'
import { isRevealed, type Fog } from './explored'
import type { Network, Settlement } from './network'

/** THE ONE SWITCH (M128): `return true` here ships the infections to every keeper. */
export function useInfectionsOn(): boolean { return useIsOwner() }

const TICK_MS = 10_000
/** the keeper stands in or by a settlement: no infection starts under their feet */
const NEAR_R = 130
/** the ping TRIGGER: no words here (M128 s2 speaks the signed script) */
export const INFECT_EVENT = 'ather-infection'
function tell(events: readonly InfectEvent[], net: Network) {
  for (const e of events) window.dispatchEvent(new CustomEvent(INFECT_EVENT, { detail: { ...e, name: net.settlements.find(p => p.id === e.id)?.name ?? '' } }))
}

export interface InfectionView { state: Infection | null; held: string | null; lost: readonly string[]; down: (nodeId: string) => boolean }
const NONE: readonly string[] = []

export function useInfections(o: { net: Network | null; fog: Fog | null; tileOff: { x: number; z: number }; clock: () => number; pos: React.MutableRefObject<{ x: number; z: number }>; inWilds: boolean; fighting: () => string | null }): InfectionView {
  const on = useInfectionsOn()
  const [state, setState] = useState<Infection | null>(null)
  const live = useRef(o); live.current = o
  const log = useRef<InfectEvent[]>([])
  const ready = on && !!o.net && !!o.fog
  const commit = useCallback((s: Infection, events: InfectEvent[]) => {
    const net = live.current.net; if (!net) return
    if (!blank(s)) saveInfection(s)
    setState(cur => (cur && JSON.stringify(cur) === JSON.stringify(s) ? cur : s))
    if (events.length) { log.current.push(...events); tell(events, net) }
  }, [])
  const known = useCallback(() => {
    const { net, fog, tileOff } = live.current
    return net && fog ? net.settlements.filter((p: Settlement) => pickable(p) && isRevealed(fog, p.x + tileOff.x, p.z + tileOff.z)).map(p => p.id) : []
  }, [])
  useEffect(() => {
    if (!ready) return
    let last = performance.now()
    const tick = () => {
      const { net, pos, inWilds, clock, fighting } = live.current; if (!net) return
      const t = performance.now(), played = document.visibilityState === 'visible' ? t - last : 0; last = t
      const s = loadInfection(net.season)   // re-read: another tab (or a cloud pull) may have moved it
      const near = inWilds && net.settlements.some(p => Math.hypot(p.x - pos.current.x, p.z - pos.current.z) < NEAR_R)
      const r = step(s, { season: net.season, now: clock(), played, known: known(), rng: Math.random, mayStart: !near, mayLose: !s.active || fighting() !== `infect:${s.active.id}` })
      if (r.s === s) setState(cur => (cur && JSON.stringify(cur) === JSON.stringify(s) ? cur : s))   // nothing moved: nothing written
      else commit(r.s, r.events)
    }
    tick(); const id = setInterval(tick, TICK_MS); return () => clearInterval(id)
  }, [ready, commit, known])
  const down = useCallback((nodeId: string) => {
    const id = infectedPlace(nodeId), net = live.current.net; if (!id) return false
    if (net && ready) { const r = fell(loadInfection(net.season), id, live.current.clock()); if (r.events.length) commit(r.s, r.events) }
    return true
  }, [commit, ready])
  useEffect(() => {   // checks only (m128-infection-check): the owner with ?infect=1. Moves the save's own clocks; starts a KNOWN settlement.
    if (!ready || new URLSearchParams(location.search).get('infect') !== '1') return
    const g = window as unknown as { __infect?: unknown }
    const at = () => loadInfection(live.current.net!.season)
    g.__infect = {
      state: () => at(), known, events: () => [...log.current],
      start: (id: string) => { if (!known().includes(id)) return false; const s = begin(at(), id, live.current.clock()); if (s.active?.id !== id) return false; commit(s, [{ kind: 'start', id, clue: s.active.clue }]); return true },
      /** days pass in the open world (the keeper away): every stamp moves back */
      pass: (ms: number) => { const s = at(); commit({ ...s, next: s.next === null ? null : s.next - ms, active: s.active && { ...s.active, at: s.active.at - ms } }, []) },
      play: (ms: number) => { const s = at(); if (s.active) commit({ ...s, active: { ...s.active, online: s.active.online + ms } }, []) },
    }
    return () => { delete g.__infect }
  }, [ready, commit, known])
  const s = ready ? state : null
  return useMemo(() => ({ state: s, held: s?.active?.id ?? null, lost: s?.lost ?? NONE, down }), [s, down])
}
