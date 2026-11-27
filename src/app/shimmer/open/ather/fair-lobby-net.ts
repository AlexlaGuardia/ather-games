'use client'
// ── BETA M233 s4: the event lobby over the open-world socket's RELAY (rules + why: fair-lobby.ts). One hook per open sign-up
// panel: it says 'here' (on a change + every HERE_MS), hears the chordmates at the same tent, and hands the panel the list, who
// hosts, the run that started (the host's 'start') and Smash's hits. No socket / no chord = an empty lobby: the panel is solo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { openNet } from '../shared/open-mp'
import { useChordBox } from '../shared/chord'
import { partyOrder } from '../shared/party-host'
import { LOBBY_KIND, HERE_MS, decodeLobby, present, lobbyHost, allReady, takers, newRun, type LobbyHere, type LobbySpirit, type LobbyStart, type Present } from './fair-lobby'

export interface FairLobby {
  list: Present[]; me: string; host: string | null; isHost: boolean
  run: LobbyStart | null; hits: { id: string; hit: number; spirit: string; who: string }[]; startedAt: number
  /** HOST: start the run now (`build` = the run's seats + spirits from the ready list) */
  start: (build: (list: Present[]) => Pick<LobbyStart, 'seats' | 'spirits' | 'names'>) => void
  sendHit: (hit: number, spirit: string) => void
  clearRun: () => void
}

export function useFairLobby(tent: string, spirit: LobbySpirit | null, ready: boolean, onStart?: (s: LobbyStart) => void): FairLobby {
  const box = useChordBox()
  const heard = useRef(new Map<string, { m: LobbyHere; at: number }>())
  const [tick, setTick] = useState(0)
  const [run, setRun] = useState<LobbyStart | null>(null), [startedAt, setStartedAt] = useState(0)
  const [hits, setHits] = useState<FairLobby['hits']>([])
  const net = openNet(), self = net?.self ?? '', inChord = !!box.code && !!net
  const chord = useMemo(() => { const o = partyOrder(); const ids = box.members.map(m => m.look).filter(Boolean); return o.length ? [...o, ...ids.filter(i => !o.includes(i))] : ids }, [box])   // eslint-disable-line react-hooks/exhaustive-deps
  const myName = box.members.find(m => m.look === self)?.name ?? 'Keeper'
  const onStartRef = useRef(onStart); onStartRef.current = onStart
  const runRef = useRef(run); runRef.current = run

  const take = useCallback((s: LobbyStart) => {
    if (runRef.current?.run === s.run) return
    runRef.current = s; setRun(s); setStartedAt(Date.now()); setHits([])
    if (s.seats.includes(openNet()?.self ?? '')) onStartRef.current?.(s)
  }, [])

  // hear the chord at this tent
  useEffect(() => {
    if (!inChord || !net) return
    return net.onRelay(m => {
      if (m.kind !== LOBBY_KIND) return
      const d = decodeLobby(m.data); if (!d || d.tent !== tent) return
      if (d.t === 'here') { heard.current.set(m.from, { m: d, at: Date.now() }); setTick(t => t + 1) }
      else if (d.t === 'gone') { heard.current.delete(m.from); setTick(t => t + 1) }
      else if (d.t === 'start') take(d)
      else if (d.t === 'hit' && runRef.current?.run === d.run) setHits(h => (h.some(x => x.id === m.from) ? h : [...h, { id: m.from, hit: d.hit, spirit: d.spirit, who: d.who }]))
    })
  }, [inChord, net?.onRelay, tent, take])   // eslint-disable-line react-hooks/exhaustive-deps
  // say 'here' on a change and every HERE_MS (the keepalive also prunes the list), 'gone' on close
  const sayRef = useRef<() => void>(() => {})
  sayRef.current = () => { if (inChord) openNet()?.relay(LOBBY_KIND, { t: 'here', tent, who: myName, spirit, ready } satisfies LobbyHere) }
  useEffect(() => { sayRef.current() }, [tent, spirit?.name, spirit?.species, spirit?.element, ready, myName, inChord])
  useEffect(() => {
    if (!inChord) return
    const t = setInterval(() => { sayRef.current(); setTick(x => x + 1) }, HERE_MS)
    return () => { clearInterval(t); openNet()?.relay(LOBBY_KIND, { t: 'gone', tent }) }
  }, [inChord, tent])

  const list = useMemo(() => (inChord ? present(tent, { id: self, who: myName, spirit, ready }, heard.current, chord, Date.now()) : []),
    [inChord, tent, self, myName, spirit, ready, chord, tick])   // eslint-disable-line react-hooks/exhaustive-deps
  const host = list.length ? lobbyHost(list, chord) : null, isHost = !!host && host === self

  const start = useCallback((build: (l: Present[]) => Pick<LobbyStart, 'seats' | 'spirits' | 'names'>) => {
    const n = openNet(); if (!n || !isHost || takers(list).length < 2 || runRef.current) return
    const f = build(list), r = newRun(Date.now(), Math.random)
    const s: LobbyStart = { t: 'start', tent, ...r, ...f }
    n.relay(LOBBY_KIND, s); take(s)
  }, [isHost, list, tent, take])
  const sendHit = useCallback((hit: number, sp: string) => {
    const r = runRef.current; if (!r) return
    openNet()?.relay(LOBBY_KIND, { t: 'hit', tent, run: r.run, hit, spirit: sp, who: myName })
    setHits(h => (h.some(x => x.id === self) ? h : [...h, { id: self, hit, spirit: sp, who: myName }]))
  }, [tent, myName, self])
  const clearRun = useCallback(() => { runRef.current = null; setRun(null); setHits([]) }, [])
  return { list, me: self, host, isHost, run, hits, startedAt, start, sendHit, clearRun }
}

/** HOST side: start by itself when every listed keeper is ready (once per readiness: a finished run must be cleared first) */
export function useAutoStart(l: FairLobby, build: (list: Present[]) => Pick<LobbyStart, 'seats' | 'spirits' | 'names'>) {
  const ready = allReady(l.list)
  const buildRef = useRef(build); buildRef.current = build
  useEffect(() => { if (l.isHost && ready && !l.run) l.start(list => buildRef.current(list)) }, [l.isHost, ready, l.run, l.start])   // eslint-disable-line react-hooks/exhaustive-deps
}
