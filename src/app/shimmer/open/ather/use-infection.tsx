'use client'
// BETA M128 s1: the infections' clock on the Ather page (infection.ts is the engine). Off = nothing is read or written.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsOwner } from '@/app/_components/useIsOwner'
import { infectedPlace } from './infect-id'
import { begin, blank, fell, guestClue, loadInfection, pickable, saveInfection, step, type InfectEvent, type Infection } from './infection'
import { isRevealed, type Fog } from './explored'
import type { Network, Settlement } from './network'
import { due, dueGiven, heardSay, loadTell, note, refugees, refugeeSpots, saveTell, settlerSay, told, type Refugee, type Say } from './infect-tell'
import { championSpot } from './infection'
import { folkOf, stillHome } from './settlement-folk'
import { builtFolkSpots } from './settlement-lots'
import { loadVillage } from './moglins'
import { refugeeDrawn } from './network-scene'
import { hudSay } from '../shared/hud-say'
import type { Spot } from './folk-spots'

/** THE ONE SWITCH (M128): `return true` here ships the infections to every keeper. */
export function useInfectionsOn(): boolean { return useIsOwner() }

const TICK_MS = 10_000
/** the keeper stands in or by a settlement: no infection starts under their feet */
const NEAR_R = 130
/** M128 s2: how often a due line is looked for (one line a look, so two never share the screen's first seconds) */
const TELL_MS = 5000, TELL_TTL = 9
/** the ping TRIGGER (checks + anything else that reacts). The WORDS come from the save, never from this event (infect-tell.ts). */
export const INFECT_EVENT = 'ather-infection'
function tell(events: readonly InfectEvent[], net: Network) {
  for (const e of events) window.dispatchEvent(new CustomEvent(INFECT_EVENT, { detail: { ...e, name: net.settlements.find(p => p.id === e.id)?.name ?? '' } }))
}

export interface InfectionView { state: Infection | null; held: string | null; lost: readonly string[]; down: (nodeId: string) => boolean; talk: InfectTalk | null }
/** what the infections have a settlement's folk say (use-folk-talk.tsx) */
export interface InfectTalk { spots: (s: Settlement) => readonly Spot[]; nameOf: (id: string) => string; say: (s: Settlement, fid: string, last: boolean) => Say | null; heard: (say: Say, upTo: number) => void }
const NONE: readonly string[] = []

export function useInfections(o: { net: Network | null; fog: Fog | null; tileOff: { x: number; z: number }; clock: () => number; pos: React.MutableRefObject<{ x: number; z: number }>; inWilds: boolean; /** M156 s2: in another keeper's Wilds (or not known yet): this keeper's own infection stands still, nothing read out or written */ away: () => boolean; guest: boolean; fighting: () => string | null; walkable: (x: number, z: number) => boolean; /** the keeper can read a line now (no panel, no arrival veil) */ canRead: () => boolean }): InfectionView {
  const on = useInfectionsOn()
  const [state, setState] = useState<Infection | null>(null)
  const live = useRef(o); live.current = o
  const guest = o.guest
  const log = useRef<InfectEvent[]>([])
  const ready = on && !!o.net && !!o.fog
  const jot = (s: Infection) => { const t = loadTell(s.season), n = note(t, s); if (n !== t) saveTell(n) }   // which clue a place holds, before the engine forgets it
  const commit = useCallback((s: Infection, events: InfectEvent[]) => {
    const net = live.current.net; if (!net) return
    if (!blank(s)) saveInfection(s)
    jot(s)
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
      if (live.current.away()) { setState(cur => cur && JSON.stringify(cur) === JSON.stringify(s) ? cur : s); return }
      if (s.active) jot(s)
      const near = inWilds && net.settlements.some(p => Math.hypot(p.x - pos.current.x, p.z - pos.current.z) < NEAR_R)
      const r = step(s, { season: net.season, now: clock(), played, known: known(), rng: Math.random, mayStart: !near, mayLose: !s.active || fighting() !== `infect:${s.active.id}` })
      if (r.s === s) setState(cur => (cur && JSON.stringify(cur) === JSON.stringify(s) ? cur : s))   // nothing moved: nothing written
      else commit(r.s, r.events)
    }
    tick(); const id = setInterval(tick, TICK_MS); return () => clearInterval(id)
  }, [ready, commit, known])
  const down = useCallback((nodeId: string) => {
    const id = infectedPlace(nodeId), net = live.current.net; if (!id) return false
    if (net && ready) { const s = loadInfection(net.season), r = fell(s, id, live.current.clock()); if (r.events.length) commit(r.s, r.events); else if (live.current.guest) { const g = guestClue(s); if (g !== s) commit(g, []) } }   // M156 s3: the host's place, this keeper's next clue
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
  // ── told (M128 s2) ──
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => {
      const { net, canRead } = live.current; if (!net || document.visibilityState !== 'visible' || !canRead()) return
      const st = loadInfection(net.season), t = loadTell(net.season)   // re-read: another tab may have told it
      const d = live.current.away() ? dueGiven(t, st) : due(t, st, p => net.settlements.find(x => x.id === p)?.name ?? ''); if (!d) return
      saveTell(told(t, d)); hudSay(d.text, d.morel ? 'morel' : 'info', TELL_TTL)
    }, TELL_MS)
    return () => clearInterval(id)
  }, [ready])
  const talk = useMemo<InfectTalk | null>(() => {
    if (!ready || !state) return null
    if (guest) return null   // M156 s2: the folk of another keeper's Wilds carry no line of this one's story
    const at = () => ({ st: loadInfection(live.current.net!.season), t: loadTell(live.current.net!.season) })
    const here = (s: Settlement): Refugee[] => { const { st, t } = at(); if (st.active?.id !== s.id) return []
      const places = live.current.net!.settlements, v = loadVillage()
      return refugees(t, st, id => { const p = places.find(x => x.id === id); return p ? stillHome(folkOf(p, st.season), v) : [] }) }
    let memo = { key: '', spots: [] as readonly Spot[] }
    return {
      spots: s => {
        const r = here(s), key = `${s.id}|${r.map(x => x.id).join()}`
        if (key !== memo.key) { const folk = r.length ? builtFolkSpots(s, folkOf(s, live.current.net!.season), live.current.net!.season) : []; memo = { key, spots: r.length ? refugeeSpots(s, r, folk, championSpot(s, folk, live.current.walkable)) : [] } }
        return memo.spots
      },
      nameOf: id => { const held = live.current.net!.settlements.find(p => p.id === at().st.active?.id); return (held && here(held).find(r => r.id === id)?.name) || '' },
      say: (s, fid, last) => { const { st, t } = at(), h = here(s), r = h.find(x => x.id === fid)
        return r ? { lines: r.lines, clues: [r.clue], met: r.from } : settlerSay(t, st, s.id, last, h) },
      heard: (say, upTo) => { const { t } = at(), n = heardSay(t, say, upTo); if (n !== t) saveTell(n) },
    }
  }, [ready, state, guest])
  useEffect(() => { refugeeDrawn.at = talk?.spots ?? (() => []); return () => { refugeeDrawn.at = () => [] } }, [talk])
  const s = ready ? state : null
  return useMemo(() => ({ state: s, held: s?.active?.id ?? null, lost: s?.lost ?? NONE, down, talk }), [s, down, talk])
}
