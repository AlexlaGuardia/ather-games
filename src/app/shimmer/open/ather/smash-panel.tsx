'use client'
// ── SMASH at the Thistledown Fair (BETA M233 s1). E at the Smash tent opens its SIGN-UP panel (fair-signup.tsx): pick ONE of
// your party spirits and Enter; she swings
// at the special bell (one hit, the battle system's damage: fair-smash.ts), the striker climbs the pole and the bell rings
// at the top, the hit is read out and goes to the SEASON BOARD (/api/fair/smash, shared by every keeper). SMASH_TRIES a
// day. Labels: plain functional words (fair-smash-rules.ts SMASH_UI), for @lark to rewrite.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { H } from '../../ui/hearth'
import { FairSignup } from './fair-signup'
import { spiritFormName } from '../../spirits/spirit'
import { speciesOf } from './spirit-seeds'
import { useBook } from './spirit-panels'
import { partyIds, subscribeParty } from './spirit-party'
import { loadStats } from './spirit-stats'
import { smashHit } from './fair-smash'
import { SMASH_UI as L, strikerRise, rings, type SmashBoard } from './fair-smash-rules'

const NONE: readonly string[] = []
const SWING_MS = 450, RISE_MS = 900

export function SmashPanel({ onClose }: { onClose: () => void }) {
  const book = useBook()
  const party = useSyncExternalStore(subscribeParty, partyIds, () => NONE)
  const spirits = useMemo(() => party.flatMap(id => {
    const pot = book.pots[id], sp = pot?.bloomed ? speciesOf(pot.seed) : null
    return sp ? [{ id, sp, element: pot.element, name: spiritFormName(sp, pot.element) }] : []
  }), [party, book])
  const [pick, setPick] = useState<string | null>(null)
  const [board, setBoard] = useState<SmashBoard | null>(null)
  const [phase, setPhase] = useState<'idle' | 'swing' | 'rise' | 'done'>('idle')
  const [hit, setHit] = useState<{ hit: number; move: string; by: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const r = await fetch('/api/fair/smash', { cache: 'no-store' }); if (r.ok) setBoard(await r.json()) } catch { /* offline: the board stays blank */ }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (!pick && spirits.length) setPick(spirits[0].id) }, [pick, spirits])

  const chosen = spirits.find(s => s.id === pick) ?? null
  const canSwing = !!chosen && !!board?.signedIn && (board?.triesLeft ?? 0) > 0 && (phase === 'idle' || phase === 'done')
  const swing = async () => {
    if (!chosen || !canSwing) return
    const r = smashHit(chosen.sp, loadStats()[chosen.id], chosen.element)
    setMsg(null); setHit(null); setPhase('swing')
    await new Promise(res => setTimeout(res, SWING_MS))
    setHit({ ...r, by: chosen.name }); setPhase('rise')
    const post = fetch('/api/fair/smash', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hit: r.hit, spirit: chosen.name }) })
      .then(async x => { const j = await x.json().catch(() => ({})); if (x.ok) setBoard(j as SmashBoard); else setMsg(String((j as { error?: string }).error ?? 'Could not reach the board.')) })
      .catch(() => setMsg('Could not reach the board.'))
    await new Promise(res => setTimeout(res, RISE_MS)); await post
    setPhase('done')
  }

  const rise = phase === 'rise' || phase === 'done' ? strikerRise(hit?.hit ?? 0) : 0
  const rang = phase === 'done' && !!hit && rings(hit.hit)
  return (
    <FairSignup title={L.title} dataPanel="smash" onClose={onClose} spirits={spirits} pick={pick} onPick={setPick}
      entrants={[{ who: 'you', you: true, spirit: chosen?.name ?? null }]} canEnter={canSwing} onEnter={() => { void swing() }}
      note={board?.signedIn ? <span data-smash-tries={board.triesLeft} style={{ fontSize: 12, color: H.inkFaint }}>{board.triesLeft > 0 ? L.tries(board.triesLeft) : L.noTries}</span> : null}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* the strength tester: a pole, a striker that climbs it, the bell at the top, the spirit's swing at the base */}
        <div data-smash-pole data-rise={rise.toFixed(2)} data-rang={rang ? '1' : '0'} style={{ position: 'relative', width: 96, height: 230, flex: '0 0 auto', margin: '0 auto' }}>
          <div style={{ position: 'absolute', left: 44, top: 26, width: 8, bottom: 30, borderRadius: 4, background: 'linear-gradient(90deg,#8d4119,#c8642a,#8d4119)' }} />
          {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ position: 'absolute', left: 36, width: 24, height: 1, top: 26 + ((230 - 56) * i) / 5, background: H.rule }} />)}
          <div data-smash-bell style={{ position: 'absolute', left: 30, top: 0, width: 36, height: 30, borderRadius: '18px 18px 6px 6px', background: rang ? 'radial-gradient(circle at 50% 40%,#fff3b0,#e0b23f)' : 'linear-gradient(180deg,#d9b25a,#9a7426)', boxShadow: rang ? '0 0 22px 8px rgba(255,214,90,.75)' : 'inset 0 -3px 0 rgba(0,0,0,.2)', transform: rang ? 'rotate(-8deg)' : 'none', transition: 'transform 120ms, box-shadow 200ms' }} />
          <div data-smash-striker style={{ position: 'absolute', left: 36, width: 24, height: 14, borderRadius: 5, background: H.rust, boxShadow: '0 2px 0 rgba(0,0,0,.25)', bottom: 30 + rise * (230 - 30 - 30 - 14), transition: phase === 'rise' ? `bottom ${RISE_MS}ms cubic-bezier(.2,.9,.3,1)` : 'none' }} />
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, height: 12, borderRadius: 3, background: H.inkSoft }} />
          <div data-smash-mallet style={{ position: 'absolute', left: 4, bottom: 26, width: 40, height: 10, transformOrigin: '0% 50%', transform: phase === 'swing' ? 'rotate(-70deg)' : 'rotate(0deg)', transition: `transform ${SWING_MS}ms cubic-bezier(.5,-0.4,.6,1.4)` }}>
            <div style={{ position: 'absolute', left: 0, top: 3, width: 30, height: 4, background: H.inkSoft }} />
            <div style={{ position: 'absolute', left: 26, top: -4, width: 14, height: 18, borderRadius: 3, background: H.emberLo }} />
          </div>
        </div>

        <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gap: 8, alignContent: 'start' }}>
          {board && !board.signedIn && <div style={{ fontSize: 12, color: H.inkFaint }}>{L.signIn}</div>}
          {hit && phase !== 'swing' && (
            <div data-smash-hit={hit.hit} style={{ fontSize: 20, fontWeight: 800, color: H.ink, fontVariantNumeric: 'tabular-nums' }}>
              {L.hit(hit.hit)} <span style={{ fontSize: 12, fontWeight: 600, color: H.inkSoft }}>{hit.by} · {hit.move}</span>
              {rang && <div style={{ fontSize: 13, color: H.ember }}>{L.rang}</div>}
            </div>
          )}
          {msg && <div data-smash-msg style={{ fontSize: 12, color: H.rust }}>{msg}</div>}
          <div data-smash-best={board?.best ?? ''} style={{ fontSize: 13, fontWeight: 700, color: H.inkSoft }}>{L.best(board?.best ?? null)}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, borderTop: `1px solid ${H.rule}`, paddingTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{L.board}</div>
        {!board?.top.length && <div style={{ fontSize: 13, fontStyle: 'italic', color: H.inkFaint }}>{L.empty}</div>}
        <div style={{ display: 'grid', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
          {board?.top.map((r, i) => (
            <div key={`${r.who}:${i}`} data-smash-row={r.who} data-best={r.best} data-mine={r.mine ? '1' : '0'}
              style={{ display: 'flex', gap: 8, fontSize: 13, padding: '2px 6px', borderRadius: 6, background: r.mine ? 'rgba(200,100,42,.12)' : 'transparent', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ width: 22, color: H.inkFaint }}>{i + 1}.</span>
              <span style={{ fontWeight: 700, color: H.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.who} <span style={{ fontWeight: 400, color: H.inkFaint }}>· {r.spirit}</span></span>
              <span style={{ fontWeight: 800, color: H.ink }}>{r.best}</span>
            </div>
          ))}
        </div>
      </div>
    </FairSignup>
  )
}
