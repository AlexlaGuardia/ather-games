'use client'
// ── CLASH at the Thistledown Fair (BETA M233 s3). E at a Clash tent opens its SIGN-UP panel (fair-signup.tsx): pick ONE of your
// party spirits and Enter. M233 v2a (Alex 11-27 rejected the turn-based battle for Clash): Enter opens THE CLASH RING
// (clash-ring.tsx): a load card, then a 3D ring seen from above and the tournament panel's line-up tree (her spirit + the tent's
// PREGENERATED line-up, fair-clash.ts); bouts run one by one until hers. Every spirit EVENED to the tent's level (power = choice).
// Beat them all = the tent is won; the first win of the season pays its Marks prize (api/fair/clash, once per tent). No board.
// The difficult tent (awakened) is HELD: it stays pitched and says it opens later. Labels: fair-clash-rules.ts CLASH_UI (@lark).
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { H } from '../../ui/hearth'
import { FairSignup, type Entrant } from './fair-signup'
import { spiritFormName, type Element } from '../../spirits/spirit'
import { speciesOf } from './spirit-seeds'
import { useBook } from './spirit-panels'
import { partyIds, subscribeParty } from './spirit-party'
import { ClashRing, type RingEntrant } from './clash-ring'   // M233 v2a
import { bondedOf, knownOf } from './spirit-bond-move'   // M238
import { gameDay } from './spirit-seeds'
import { getPots, setPots } from './spirit-panels'
import { learnFrom, LESSON_UI, type BoutRecord } from './clash-lessons'   // M233 v2c
import { hudSay } from '../shared/hud-say'
import { clashLineup, evenSpirit, foeName } from './fair-clash'
import { CLASH_UI as L, CLASH_OPEN, CLASH_PRIZE, CLASH_SEASON, TENT_LEVEL, type ClashTier, type ClashState, type ClashClaim } from './fair-clash-rules'
import { CLASH_LEVEL_LABEL } from './network'
import { useFairLobby, useAutoStart } from './fair-lobby-net'   // M233 s4 EVENT LOBBY
import { isLobby, takers, clashField, type LobbySpirit, type LobbyStart } from './fair-lobby'
import type { Ledger } from '../trade'

const NONE: readonly string[] = []

export function ClashPanel({ tier, tent, ledger, setLedger, onClose }: { tier: ClashTier; tent: number; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void }) {
  const book = useBook()
  const party = useSyncExternalStore(subscribeParty, partyIds, () => NONE)
  const spirits = useMemo(() => party.flatMap(id => {
    const pot = book.pots[id], sp = pot?.bloomed ? speciesOf(pot.seed) : null
    return sp ? [{ id, sp, element: (pot.element ?? 'base') as Element, name: spiritFormName(sp, pot.element) }] : []
  }), [party, book])
  const open = CLASH_OPEN[tier]
  const lineup = useMemo(() => clashLineup(CLASH_SEASON, tent, tier), [tent, tier])
  const [pick, setPick] = useState<string | null>(null)
  const [state, setState] = useState<ClashState | null>(null)
  const [bout, setBout] = useState<number | null>(null)          // M233 v2a: 0 while the ring is open (a run in progress), null = none
  const [result, setResult] = useState<null | { won: boolean; prize?: number; first?: boolean }>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const r = await fetch('/api/fair/clash', { cache: 'no-store' }); if (r.ok) setState(await r.json()) } catch { /* offline */ }
  }, [])
  useEffect(() => { if (open) void load() }, [load, open])
  useEffect(() => { if (!pick && spirits.length) setPick(spirits[0].id) }, [pick, spirits])

  const chosen = spirits.find(s => s.id === pick) ?? null
  const wonHere = !!state?.won.includes(tent)
  // M233 s3b: the win that just paid the purse reads as a win; 'already won' only on a later visit / a second win
  const alreadyNote = wonHere && !(result?.won && result.first)
  const canEnter = open && !!chosen && bout === null && lineup.length > 0
  const entrants: Entrant[] = [{ who: 'you', you: true, spirit: chosen?.name ?? null }]

  // ── M233 s4: THE EVENT LOBBY. Chordmates at this tent are listed; each readies up; the host's start (or everyone ready) runs a
  // FIELD of the chord's spirits (empty seats = this tent's line-up), the same fights on every keeper's ring (one seed).
  const [ready, setReady] = useState(false)
  const [fieldRun, setFieldRun] = useState<LobbyStart | null>(null)
  const [champ, setChamp] = useState<string | null>(null)
  const mine = useMemo<LobbySpirit | null>(() => chosen ? { name: chosen.name, species: chosen.sp, element: chosen.element,
    bonded: bondedOf(book.pots[chosen.id], gameDay(Date.now())), known: knownOf(book.pots[chosen.id], chosen.sp), lessons: book.pots[chosen.id]?.lessons ? [...book.pots[chosen.id].lessons!] : undefined } : null, [chosen, book])
  const lineupSpirits = useMemo<LobbySpirit[]>(() => lineup.map(f => ({ name: foeName(f), species: f.species, element: f.element })), [lineup])
  const lobby = useFairLobby(`clash:${tent}`, open ? mine : null, ready, s => { setReady(false); setFieldRun(s); setChamp(null); setResult(null); setMsg(null); setBout(0) })
  const inLobby = open && isLobby(lobby.list)
  useAutoStart(lobby, list => clashField(list, lineupSpirits))
  const field = useMemo<RingEntrant[] | null>(() => fieldRun ? fieldRun.spirits.map((sp, i) => {
    const x = sp ?? lineupSpirits[0]
    return { name: fieldRun.names[i] ? `${x.name} · ${fieldRun.names[i]}` : x.name, keeper: fieldRun.names[i] ?? undefined, species: x.species, element: x.element, spirit: () => evenSpirit(x.species, x.element, tier, x.name),
      bonded: x.bonded ?? undefined, known: x.known, lessons: x.lessons }
  }) : null, [fieldRun, lineupSpirits, tier])
  const mySeat = fieldRun ? fieldRun.seats.indexOf(lobby.me) : -1

  // the ring's entrants, evened to the tent's level: hers (species + her form) first, then the line-up (a fresh Spirit per bout)
  const ring = useMemo<RingEntrant[] | null>(() => chosen ? [
    { name: chosen.name, species: chosen.sp, element: chosen.element, spirit: () => evenSpirit(chosen.sp, chosen.element, tier, chosen.name),
      // M238: she throws her favourite (with its twist) from her own known moves; none picked = a seeded random known move
      bonded: bondedOf(book.pots[chosen.id], gameDay(Date.now())), known: knownOf(book.pots[chosen.id], chosen.sp),
      lessons: book.pots[chosen.id]?.lessons },
    ...lineup.map(f => ({ name: foeName(f), species: f.species, element: f.element, spirit: () => evenSpirit(f.species, f.element, tier) })),
  ] : null, [chosen, lineup, tier, book])

  const enter = () => { if (!canEnter) return; setResult(null); setMsg(null); setBout(0) }
  const won = async () => {
    try {
      const x = await fetch('/api/fair/clash', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tent, level: tier, spirit: chosen?.name }) })
      const j = await x.json().catch(() => ({}))
      if (!x.ok) { setResult({ won: true }); setMsg(String((j as { error?: string }).error ?? 'Could not reach the troupe.')); return }
      const c = j as ClashClaim
      setState(c)
      if (c.first && c.prize > 0) setLedger({ ...ledger, marks: ledger.marks + c.prize })   // the tent's purse, once a season
      setResult({ won: true, prize: c.prize, first: c.first })
    } catch { setResult({ won: true }); setMsg('Could not reach the troupe.') }
  }
  // the ring's run is over: a win claims the purse (server: once per tent per season); the ring stays up until 'Back to the Fair'
  // M233 v2c: her bout is over: she may learn ONE lesson from it (saved on her pot; the next bout reads it)
  const onKeeperBout = useCallback((r: BoutRecord, seed: number) => {
    if (!chosen) return
    const cur = getPots()[chosen.id]; if (!cur) return
    const l = learnFrom(cur.lessons ?? [], r, seed)
    if (!l) return
    setPots({ ...getPots(), [chosen.id]: { ...cur, lessons: [...(cur.lessons ?? []), l] } })
    hudSay(LESSON_UI.learned(chosen.name, LESSON_UI.name[l]), 'item', 4)
  }, [chosen])
  const onDone = useCallback((w: boolean, c: number | null) => {
    if (fieldRun && field && c !== null) setChamp(field[c].name)   // M233 s4: every keeper in the chord sees the same champion
    if (w) void won(); else setResult({ won: false })
  }, [chosen, ledger, tent, tier, fieldRun, field])   // eslint-disable-line react-hooks/exhaustive-deps
  const exitRing = useCallback(() => { setBout(null); if (fieldRun) { setFieldRun(null); lobby.clearRun() } }, [fieldRun, lobby])

  return (
    <>
      <FairSignup title={L.title(CLASH_LEVEL_LABEL[tier])} dataPanel="clash" onClose={onClose} spirits={open ? spirits : []} pick={pick} onPick={setPick}
        entrants={entrants} canEnter={canEnter} onEnter={enter}
        lobby={inLobby ? { list: lobby.list, ready, onReady: () => setReady(r => !r), isHost: lobby.isHost, hostName: lobby.list.find(p => p.id === lobby.host)?.who ?? '',
          canStart: lobby.isHost && bout === null && takers(lobby.list).length >= 2, onStart: () => lobby.start(list => clashField(list, lineupSpirits)), busy: bout !== null } : null}
        note={open ? <span data-clash-prize={CLASH_PRIZE[tier]} data-clash-already={alreadyNote ? '1' : '0'} style={{ fontSize: 12, color: H.inkFaint }}>{alreadyNote ? L.already : L.prize(CLASH_PRIZE[tier])}</span> : null}>
        <div data-clash-tier={tier} data-clash-tent={tent} data-clash-open={open ? '1' : '0'} data-clash-won={wonHere ? '1' : '0'} style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {!open && <div data-clash-held style={{ fontSize: 14, fontWeight: 700, color: H.ink }}>{L.held}</div>}
          {open && <>
            <div style={{ fontSize: 13, color: H.inkSoft }}>{L.rules} {L.evened(TENT_LEVEL[tier])}</div>
            <div style={{ fontWeight: 700, color: H.ink }}>{L.lineup}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lineup.map((f, i) => (
                <div key={i} data-clash-foe={`${f.species}:${f.element}`} data-form={f.element === 'base' ? 'base' : 'second'} data-beaten={result?.won ? '1' : '0'}
                  style={{ padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, color: H.ink, background: 'rgba(255,250,240,.6)', boxShadow: 'inset 0 0 0 1px rgba(58,39,22,.14)' }}>
                  {i + 1}. {foeName(f)}
                </div>
              ))}
            </div>
            {state && !state.signedIn && <div style={{ fontSize: 12, color: H.inkFaint }}>{L.signIn}</div>}
            {result && (
              <div data-clash-result={result.won ? 'won' : 'lost'} data-clash-paid={result.prize ?? 0} style={{ fontSize: 15, fontWeight: 800, color: result.won ? H.ember : H.rust }}>
                {result.won ? L.won : L.lost}
                {result.won && !!result.prize && <span style={{ marginLeft: 8, color: H.ink }}>{L.prizeLanded(result.prize)}</span>}
                {result.won && result.first === false && <div style={{ fontSize: 12, fontWeight: 600, color: H.inkFaint }}>{L.already}</div>}
              </div>
            )}
            {champ && <div data-clash-champion={champ} style={{ fontSize: 13, fontWeight: 800, color: H.ink }}>{L.champion(champ)}</div>}
            {msg && <div data-clash-msg style={{ fontSize: 12, color: H.rust }}>{msg}</div>}
          </>}
        </div>
      </FairSignup>
      {bout !== null && fieldRun && field && (
        <ClashRing key={`field-${fieldRun.run}`} tier={tier} title={L.title(CLASH_LEVEL_LABEL[tier])} entrants={field} result={result} onDone={onDone} onExit={exitRing} onKeeperBout={onKeeperBout}
          field={{ me: mySeat >= 0 ? mySeat : null }} seed={fieldRun.seed} />
      )}
      {bout !== null && !fieldRun && ring && (
        <ClashRing key={`${tent}-${pick}`} tier={tier} title={L.title(CLASH_LEVEL_LABEL[tier])} entrants={ring} result={result} onDone={onDone} onExit={exitRing} onKeeperBout={onKeeperBout} />
      )}
    </>
  )
}
