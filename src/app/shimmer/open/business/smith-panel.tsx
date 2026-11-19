'use client'
// THE RUNESMITH'S COUNTER and IDONY'S COUNTER (play lane, 2026-11-16). The rules live in business/letters.ts (pure);
// these are the counters. Canon in that file's header. No keeper speaks here: names and lines are Magii's / @lark's.
import { useState } from 'react'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../../ui/hearth'
import { hudSay } from '../shared/game-hud'
import { useInv, setInv, getInv } from '../shared/bag'
import { useLoadout, setLoadout, getLoadout } from '../shared/loadout'
import { countOf, itemDef } from '../shared/inventory'
import { useBirth } from '../birth-gate'
import { RUNES } from '../../play3d/birth/runes.data'
import type { Ledger } from '../trade'
import { stageOf, gemsGiven } from './errand'
import { RUNESMITH_CUT, idonyBeat, IDONY_AFTER, type Beat } from './errand-lines'
import { SEATS, smithRows, recipeOf, canCut, cut, hasBlueprint, letterItem, CUT_FEE, IMBUE_FEE, imbuable, wordsFor, missingLetters, lightsFor, imbue, type Seat } from './letters'

const runeName = (id: string) => RUNES.find(r => r.id === id)?.name ?? id
const runeGlow = (id: string) => RUNES.find(r => r.id === id)?.glow ?? '#c9a35a'

export function RunesmithPanel({ seat, ledger, setLedger, onClose, onBack }: {
  seat: Seat; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; onBack?: () => void
}) {
  const inv = useInv(), loadout = useLoadout(), birth = useBirth()
  const [msg, setMsg] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const s = SEATS[seat]
  // BETA M32: the birth letter leads; in the first errand it is the only row until the keeper asks for more
  const stage = stageOf(birth, inv, loadout, gemsGiven())
  const errand = stage === 'greg' || stage === 'smith' || stage === 'temple'
  const rows = smithRows(seat, birth, errand)
  const doCut = (rune: string) => {
    const r = cut(inv, ledger.marks, seat, rune)
    if (!r.ok) { setMsg(r.why); return }
    setInv(r.inv); setLedger({ ...ledger, marks: r.marks }); setMsg(null)
    hudSay(`Runesmith: ${RUNESMITH_CUT}`, 'chat')
    hudSay(`${runeName(rune)} letter cut · −${CUT_FEE} Marks`, 'item')
  }
  return (
    <HearthFrame title={`${s.name} runesmith`} maxWidth={500} onClose={onClose} fixed dataPanel="smith-panel"
      head={
        <div className="flex items-center justify-between pb-2 text-[13px]">
          <span style={{ ...hearthDisplay, color: H.inkSoft }}>{onBack ? <button type="button" className="underline mr-2" onClick={onBack}>‹ back</button> : null}Letters cut to order · {CUT_FEE} Marks a cut</span>
          <span className="tabular-nums font-bold" data-marks style={{ color: H.ink }}>{Math.floor(ledger.marks).toLocaleString()} Marks</span>
        </div>
      }
      footer={<span className="text-[12px]" style={hearthDisplay}>Bring the stone and the ink; the letter is cut here. A word&apos;s letters may come from different schools.</span>}>
      <div className="px-4 pt-3 pb-4 grid gap-1.5" data-seat={seat}>
        {[...rows.shown, ...(more ? rows.folded : [])].map(rune => {
          const bp = hasBlueprint(rune), v = canCut(inv, ledger.marks, seat, rune, bp)
          const mine = rune === birth, gems = mine && (stage === 'smith' || stage === 'temple')
          return (
            <div key={rune} className="flex items-center gap-3 rounded-[12px] px-3 py-2" data-letter={rune} data-birth-letter={mine || undefined}
              style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}`, opacity: bp ? 1 : 0.55 }}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: runeGlow(rune), boxShadow: `0 0 8px ${runeGlow(rune)}` }} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{runeName(rune)}{mine && <span className="text-[11px] font-normal ml-1.5 px-1.5 py-0.5 rounded-full" data-greg-gems={gems || undefined} style={{ background: 'rgba(201,163,90,.22)', color: H.ink }}>{gems ? "your letter · Greg's gems" : 'your letter'}</span>} <span className="text-[12px] font-normal" style={{ color: H.inkSoft }}>· you hold {countOf(inv, letterItem(rune))}</span></div>
                <div className="text-[12px]" style={{ color: H.inkSoft }}>
                  {bp ? recipeOf(rune).map(x => `${x.n} ${itemDef(x.id).name} (${countOf(inv, x.id)})`).join(' · ') : 'A lost letter. It needs a blueprint.'}
                </div>
              </div>
              <HearthButton small primary disabled={!v.ok} onClick={() => doCut(rune)}>Cut</HearthButton>
            </div>
          )
        })}
        {rows.folded.length > 0 && (
          <button type="button" className="text-[12px] underline justify-self-start mt-0.5" style={{ ...hearthDisplay, color: H.inkSoft }} data-smith-more onClick={() => setMore(m => !m)}>
            {more ? 'fewer letters' : `more letters (${rows.folded.length})`}
          </button>
        )}
        {msg && <div className="text-[13px] font-semibold mt-1" style={{ color: '#a8321f' }} data-smith-msg>{msg}</div>}
      </div>
    </HearthFrame>
  )
}

/** Write the word into the vessel (the keeper has just SAID it): fee, letters and the vessel, read fresh at the moment it
 *  happens, so the beat can play outside this panel (the continent's talk, M13 part 3). */
export function commitImbue(vesselId: string, wordId: string, ledger: Ledger, setLedger: (l: Ledger) => void): { ok: boolean; why?: string } {
  const r = imbue(getLoadout(), getInv(), ledger.marks, vesselId, wordId)
  if (!r.ok) return { ok: false, why: r.why }
  setLoadout(r.loadout); setInv(r.inv); setLedger({ ...ledger, marks: r.marks })
  hudSay(`${r.name} imbued · −${IMBUE_FEE} Marks · wear it from the Character tab (P)`, 'item')
  return { ok: true }
}

export function IdonyPanel({ ledger, setLedger, onClose, onBack, onBeat }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; onBack?: () => void
  /** given: the imbue beat plays in the caller's talk bubble (the continent, M13), not in this panel's overlay */
  onBeat?: (b: { steps: Beat[]; vesselId: string; wordId: string }) => void }) {
  const inv = useInv(), loadout = useLoadout(), birth = useBirth()
  const vessels = imbuable(loadout)
  const [pick, setPick] = useState<string | null>(vessels[0]?.id ?? null)
  const [msg, setMsg] = useState<string | null>(null)
  const v = vessels.find(x => x.id === pick) ?? vessels[0]
  // the words this keeper could have now first (letters in the bag), then the rest; lit words first within each
  const words = v ? wordsFor(v.kind).map(w => ({ ...w, miss: missingLetters(inv, w.letters), lit: lightsFor(w.letters, birth) }))
    .sort((a, b) => (a.miss.length - b.miss.length) || (Number(b.lit) - Number(a.lit)) || a.name.localeCompare(b.name)) : []
  // the imbue is a scene (lark, signed 11-16): she works in silence, stops at the last seat, and the keeper SAYS the word
  // before the cord closes. The vessel lights on the word, so the imbue lands on the keeper's line, not on the button.
  const [beat, setBeat] = useState<{ wordId: string; steps: Beat[]; at: number } | null>(null)
  const commit = (wordId: string) => {
    if (!v) return
    const r = commitImbue(v.id, wordId, ledger, setLedger)
    if (!r.ok) { setMsg(r.why ?? null); setBeat(null); return }
    setMsg(null)
  }
  const doImbue = (wordId: string) => {
    if (!v) return
    const w = words.find(x => x.id === wordId); if (!w || w.miss.length) return
    const steps = idonyBeat(w.name, v.id === 'starter-bracelet')
    if (onBeat) { onBeat({ steps, vesselId: v.id, wordId }); return }
    setBeat({ wordId, steps, at: 0 })
  }
  const step = () => {
    if (!beat) return
    const cur = beat.steps[beat.at]
    if (cur.keeper) commit(beat.wordId)                       // the keeper says it: the last stone closes
    if (beat.at + 1 >= beat.steps.length) { setBeat(null); return }
    setBeat({ ...beat, at: beat.at + 1 })
  }
  const done = !loadout.vessels.some(x => x.id === 'starter-bracelet' && x.word === null)
  return (
    <HearthFrame title="Idony · vessels inscribed" maxWidth={540} onClose={onClose} fixed dataPanel="idony-panel"
      head={
        <div className="flex items-center justify-between pb-2 text-[13px]">
          <span style={{ ...hearthDisplay, color: H.inkSoft }}>{onBack ? <button type="button" className="underline mr-2" onClick={onBack}>‹ back</button> : null}Letters into a vessel · {IMBUE_FEE} Marks</span>
          <span className="tabular-nums font-bold" data-marks style={{ color: H.ink }}>{Math.floor(ledger.marks).toLocaleString()} Marks</span>
        </div>
      }
      footer={<span className="text-[12px]" style={hearthDisplay}>A glove&apos;s word is earned, not cut. A word off your lane stays dark for you.</span>}>
      <div className="px-4 pt-3 pb-4 relative">
        {beat && (() => {
          const cur = beat.steps[beat.at]
          return (
            <div className="absolute inset-0 z-20 grid place-items-center px-4" style={{ background: 'rgba(40,24,12,.30)' }} data-beat={beat.at}>
              <div className="rounded-[14px] px-4 py-4 max-w-[420px] w-full" style={{ background: H.paperHi, boxShadow: '0 10px 24px rgba(0,0,0,.4)' }}>
                {cur.scene && <p className="text-[13px] italic" style={{ ...hearthDisplay, color: H.inkSoft }}>{cur.scene}</p>}
                {cur.idony && <p className="text-[16px] mt-2" style={{ ...hearthDisplay, color: H.ink }}><b>Idony:</b> {cur.idony}</p>}
                <div className="flex justify-end mt-3">
                  <HearthButton small primary onClick={step}>{cur.keeper ? `Say it: “${cur.keeper}”` : beat.at + 1 >= beat.steps.length ? 'Take the bracelet' : '…'}</HearthButton>
                </div>
              </div>
            </div>
          )
        })()}
        {done && !beat && <p className="text-[13px] italic mb-2" style={{ ...hearthDisplay, color: H.inkSoft }} data-idony-after><b>Idony:</b> {IDONY_AFTER}</p>}
        {!vessels.length ? <p className="text-[14px]" style={{ ...hearthDisplay, color: H.inkSoft }} data-idony-empty>No blank bracelet to inscribe.</p> : (
          <>
            <div className="flex gap-2 flex-wrap mb-3">
              {vessels.map(x => (
                <button key={x.id} type="button" data-vessel={x.id} onClick={() => setPick(x.id)} className="rounded-full px-3 py-1 text-[13px] font-semibold"
                  style={{ ...hearthDisplay, background: x.id === v?.id ? H.ember : 'rgba(255,250,235,.5)', color: x.id === v?.id ? '#fff' : H.ink, boxShadow: `inset 0 0 0 1px ${H.rule}` }}>{x.label}</button>
              ))}
            </div>
            <div className="grid gap-1.5 overflow-y-auto hearth-scroll" style={{ maxHeight: 'min(46vh, 420px)' }}>
              {words.map(w => (
                <div key={w.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2" data-word={w.id} data-ready={w.miss.length === 0 || undefined}
                  style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${w.lit ? H.moss : H.rule}`, opacity: w.miss.length ? 0.6 : 1 }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{w.name}{w.lit && <b className="ml-1.5 text-[12px]" style={{ color: H.moss }}>lights for you</b>}</div>
                    <div className="text-[12px]" style={{ color: H.inkSoft }}>
                      {w.letters.map((r, i) => <span key={i} style={{ color: w.miss.includes(r) ? '#a8321f' : undefined }}>{i ? ' + ' : ''}{runeName(r)}</span>)}
                    </div>
                  </div>
                  <HearthButton small primary disabled={w.miss.length > 0 || ledger.marks < IMBUE_FEE} onClick={() => doImbue(w.id)}>Imbue</HearthButton>
                </div>
              ))}
            </div>
          </>
        )}
        {msg && <div className="text-[13px] font-semibold mt-2" style={{ color: '#a8321f' }} data-idony-msg>{msg}</div>}
      </div>
    </HearthFrame>
  )
}
