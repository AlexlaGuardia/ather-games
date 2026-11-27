'use client'
// ── CLASH at the Thistledown Fair (BETA M233 s3). E at a Clash tent opens its SIGN-UP panel (fair-signup.tsx): pick ONE of your
// party spirits and Enter. She fights the tent's PREGENERATED line-up (fair-clash.ts) one bout at a time in the turn-based
// battle we already have (components/PartyBattleScene.tsx, 1v1), every spirit EVENED to the tent's level (power = choice).
// Beat them all = the tent is won; the first win of the season pays its Marks prize (api/fair/clash, once per tent). No board.
// The difficult tent (awakened) is HELD: it stays pitched and says it opens later. Labels: fair-clash-rules.ts CLASH_UI (@lark).
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { H } from '../../ui/hearth'
import { FairSignup, type Entrant } from './fair-signup'
import { spiritFormName, type Element } from '../../spirits/spirit'
import { speciesOf } from './spirit-seeds'
import { useBook } from './spirit-panels'
import { partyIds, subscribeParty } from './spirit-party'
import PartyBattleScene from '../../components/PartyBattleScene'
import { clashLineup, evenSpirit, foeName } from './fair-clash'
import { CLASH_UI as L, CLASH_OPEN, CLASH_PRIZE, CLASH_AI, CLASH_TROUPE_MANA, CLASH_SEASON, TENT_LEVEL, type ClashTier, type ClashState, type ClashClaim } from './fair-clash-rules'
import { CLASH_LEVEL_LABEL } from './network'
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
  const [bout, setBout] = useState<number | null>(null)          // the bout being fought (index into the line-up), null = none
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

  // the battle Spirits, evened to the tent's level: hers (species + her form) and the line-up's
  const mine = useMemo(() => chosen ? evenSpirit(chosen.sp, chosen.element, tier, chosen.name) : null, [chosen, tier])
  const foes = useMemo(() => lineup.map(f => evenSpirit(f.species, f.element, tier)), [lineup, tier])

  const enter = () => { if (!canEnter) return; setResult(null); setMsg(null); setBout(0) }
  const won = async () => {
    setBout(null)
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
  const onEnd = (outcome: 'win' | 'lose') => {
    if (bout === null) return
    if (outcome === 'lose') { setBout(null); setResult({ won: false }); return }
    if (bout + 1 < foes.length) setBout(bout + 1); else void won()
  }

  return (
    <>
      <FairSignup title={L.title(CLASH_LEVEL_LABEL[tier])} dataPanel="clash" onClose={onClose} spirits={open ? spirits : []} pick={pick} onPick={setPick}
        entrants={entrants} canEnter={canEnter} onEnter={enter}
        note={open ? <span data-clash-prize={CLASH_PRIZE[tier]} data-clash-already={alreadyNote ? '1' : '0'} style={{ fontSize: 12, color: H.inkFaint }}>{alreadyNote ? L.already : L.prize(CLASH_PRIZE[tier])}</span> : null}>
        <div data-clash-tier={tier} data-clash-tent={tent} data-clash-open={open ? '1' : '0'} data-clash-won={wonHere ? '1' : '0'} style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {!open && <div data-clash-held style={{ fontSize: 14, fontWeight: 700, color: H.ink }}>{L.held}</div>}
          {open && <>
            <div style={{ fontSize: 13, color: H.inkSoft }}>{L.rules} {L.evened(TENT_LEVEL[tier])}</div>
            <div style={{ fontWeight: 700, color: H.ink }}>{L.lineup}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lineup.map((f, i) => (
                <div key={i} data-clash-foe={`${f.species}:${f.element}`} data-form={f.element === 'base' ? 'base' : 'second'} data-beaten={result?.won || (bout !== null && i < bout) ? '1' : '0'}
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
            {msg && <div data-clash-msg style={{ fontSize: 12, color: H.rust }}>{msg}</div>}
          </>}
        </div>
      </FairSignup>
      {bout !== null && mine && foes[bout] && (
        <div data-clash-bout={bout} style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000' }}>
          <PartyBattleScene key={bout} allySpirits={[mine]} enemySpirits={[foes[bout]]} zoneId="garden"
            ai={CLASH_AI[tier]} mana={{ enemy: CLASH_TROUPE_MANA[tier] }}
            introText={`${L.bout(bout + 1, foes.length)} · ${foes[bout].name}`}
            endText={{ win: bout + 1 < foes.length ? `${foes[bout].name} is out. Next bout.` : L.won, lose: L.lost }}
            onEnd={onEnd} />
        </div>
      )}
    </>
  )
}
