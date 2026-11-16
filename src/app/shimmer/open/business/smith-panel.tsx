'use client'
// THE RUNESMITH'S COUNTER and IDONY'S COUNTER (play lane, 2026-11-16). The rules live in business/letters.ts (pure);
// these are the counters. Canon in that file's header. No keeper speaks here: names and lines are Magii's / @lark's.
import { useState } from 'react'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../../ui/hearth'
import { hudSay } from '../shared/game-hud'
import { useInv, setInv } from '../shared/bag'
import { useLoadout, setLoadout } from '../shared/loadout'
import { countOf, itemDef } from '../shared/inventory'
import { useBirth } from '../birth-gate'
import { RUNES } from '../../play3d/birth/runes.data'
import type { Ledger } from '../trade'
import { SEATS, lettersAt, recipeOf, canCut, cut, hasBlueprint, letterItem, CUT_FEE, IMBUE_FEE, imbuable, wordsFor, missingLetters, lightsFor, imbue, type Seat } from './letters'

const runeName = (id: string) => RUNES.find(r => r.id === id)?.name ?? id
const runeGlow = (id: string) => RUNES.find(r => r.id === id)?.glow ?? '#c9a35a'

export function RunesmithPanel({ seat, ledger, setLedger, onClose, onBack }: {
  seat: Seat; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; onBack?: () => void
}) {
  const inv = useInv()
  const [msg, setMsg] = useState<string | null>(null)
  const s = SEATS[seat]
  const doCut = (rune: string) => {
    const r = cut(inv, ledger.marks, seat, rune)
    if (!r.ok) { setMsg(r.why); return }
    setInv(r.inv); setLedger({ ...ledger, marks: r.marks }); setMsg(null)
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
        {lettersAt(seat).map(rune => {
          const bp = hasBlueprint(rune), v = canCut(inv, ledger.marks, seat, rune, bp)
          return (
            <div key={rune} className="flex items-center gap-3 rounded-[12px] px-3 py-2" data-letter={rune}
              style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}`, opacity: bp ? 1 : 0.55 }}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: runeGlow(rune), boxShadow: `0 0 8px ${runeGlow(rune)}` }} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{runeName(rune)} <span className="text-[12px] font-normal" style={{ color: H.inkSoft }}>· you hold {countOf(inv, letterItem(rune))}</span></div>
                <div className="text-[12px]" style={{ color: H.inkSoft }}>
                  {bp ? recipeOf(rune).map(x => `${x.n} ${itemDef(x.id).name} (${countOf(inv, x.id)})`).join(' · ') : 'A lost letter. It needs a blueprint.'}
                </div>
              </div>
              <HearthButton small primary disabled={!v.ok} onClick={() => doCut(rune)}>Cut</HearthButton>
            </div>
          )
        })}
        {msg && <div className="text-[13px] font-semibold mt-1" style={{ color: '#a8321f' }} data-smith-msg>{msg}</div>}
      </div>
    </HearthFrame>
  )
}

export function IdonyPanel({ ledger, setLedger, onClose, onBack }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; onBack?: () => void }) {
  const inv = useInv(), loadout = useLoadout(), birth = useBirth()
  const vessels = imbuable(loadout)
  const [pick, setPick] = useState<string | null>(vessels[0]?.id ?? null)
  const [msg, setMsg] = useState<string | null>(null)
  const v = vessels.find(x => x.id === pick) ?? vessels[0]
  // the words this keeper could have now first (letters in the bag), then the rest; lit words first within each
  const words = v ? wordsFor(v.kind).map(w => ({ ...w, miss: missingLetters(inv, w.letters), lit: lightsFor(w.letters, birth) }))
    .sort((a, b) => (a.miss.length - b.miss.length) || (Number(b.lit) - Number(a.lit)) || a.name.localeCompare(b.name)) : []
  const doImbue = (wordId: string) => {
    if (!v) return
    const r = imbue(loadout, inv, ledger.marks, v.id, wordId)
    if (!r.ok) { setMsg(r.why); return }
    setLoadout(r.loadout); setInv(r.inv); setLedger({ ...ledger, marks: r.marks }); setMsg(null)
    hudSay(`${r.name} imbued · −${IMBUE_FEE} Marks · wear it from the Character tab (P)`, 'item')
  }
  return (
    <HearthFrame title="Idony · vessels inscribed" maxWidth={540} onClose={onClose} fixed dataPanel="idony-panel"
      head={
        <div className="flex items-center justify-between pb-2 text-[13px]">
          <span style={{ ...hearthDisplay, color: H.inkSoft }}>{onBack ? <button type="button" className="underline mr-2" onClick={onBack}>‹ back</button> : null}Letters into a vessel · {IMBUE_FEE} Marks</span>
          <span className="tabular-nums font-bold" data-marks style={{ color: H.ink }}>{Math.floor(ledger.marks).toLocaleString()} Marks</span>
        </div>
      }
      footer={<span className="text-[12px]" style={hearthDisplay}>A glove&apos;s word is earned, not cut. A word off your lane stays dark for you.</span>}>
      <div className="px-4 pt-3 pb-4">
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
