'use client'
// IDRIS'S COUNTER at the Enchant Temple (BETA M93 s3, sprites lane). Pick a gun, pick runesmith LETTERS from the bag in order,
// one cut sets them into the gun's sigil. Rules: business/idris.ts (pure). Every word Idris says is @lark's (idris-lines.ts);
// SIGNED (athernyx 7a25a8e). The counter's own copy stays plain; Idris is he/him (Idony's twin brother, canon 5b83a25).
import { useState } from 'react'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../../ui/hearth'
import { hudSay } from '../shared/game-hud'
import { useInv, setInv, getInv } from '../shared/bag'
import { useLoadout, setLoadout, getLoadout } from '../shared/loadout'
import { countOf, itemDef } from '../shared/inventory'
import { RANGE_GUNS } from '../shared/gunplay'
import { runeById, SIGIL_CAP } from '../shared/sigil'
import { RUNES } from '../../play3d/birth/runes.data'
import { useBirth } from '../birth-gate'
import { keeperKey } from '@/lib/keeper-local'
import type { Ledger } from '../trade'
import { SIGIL_ITEM } from './gun-shop'
import { letterItem } from './letters'
import { idrisCanCut, idrisCut, canPickNext, lettersHeld, sigilOf, sigilGuns, whyText, SIGIL_CUT_FEE } from './idris'
import { idrisLine, IDRIS_BARKS, IDRIS_SCENES, IDRIS_CHOICES, type IdrisLineId } from './idris-lines'

const MET_KEY = 'open.idris.met'
const runeName = (id: string) => RUNES.find(r => r.id === id)?.name ?? id
const runeGlow = (id: string) => RUNES.find(r => r.id === id)?.glow ?? '#c9a35a'
const gunName = (id: string) => { const n = RANGE_GUNS.find(g => g.id === id)?.name ?? id; return n[0] + n.slice(1).toLowerCase() }

/** first talk ever = the scene + greet.first.1-3 (once per keeper); afterwards greet.repeat */
function firstTalk(): boolean {
  try { const met = localStorage.getItem(keeperKey(MET_KEY)) === '1'; localStorage.setItem(keeperKey(MET_KEY), '1'); return !met } catch { return false }
}

function Say({ id }: { id: IdrisLineId }) {
  return <p className="text-[15px] mt-1" style={{ ...hearthDisplay, color: H.ink }} data-idris-line={id}><b>Idris:</b> {idrisLine(id)}</p>
}
function Scene({ text }: { text: string }) {
  return <p className="text-[13px] italic" style={{ ...hearthDisplay, color: H.inkSoft }} data-idris-scene>{text}</p>
}

export function IdrisPanel({ ledger, setLedger, onClose, onBack }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; onBack?: () => void }) {
  const inv = useInv(), loadout = useLoadout(), birth = useBirth()
  const [first] = useState(firstTalk)
  const [bark] = useState(() => IDRIS_BARKS[Math.floor(Math.random() * IDRIS_BARKS.length)])
  const guns = sigilGuns(loadout)
  const [pick, setPick] = useState<string | null>(guns[0] ?? null)
  const gun = pick && guns.includes(pick) ? pick : guns[0] ?? null
  const [picks, setPicks] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  // M93 s4 RE-CUT (hub call): a new blank replaces the gun's sigil; the old runes are gone. Offered only on a gun that has one.
  const [recutOn, setRecut] = useState(false)
  const own = gun ? sigilOf(loadout, gun) : null
  const recut = recutOn && !!own && own.runes.length > 0
  const sigil = own ? (recut ? { gunId: own.gunId, runes: [] as string[] } : own) : null
  const held = lettersHeld(inv)
  const free = sigil ? SIGIL_CAP - sigil.runes.length : 0
  const needsBlank = !!sigil && sigil.runes.length === 0
  // lark's branch: no blank for a first cut, or a blank and no letters, or the offer
  const status: IdrisLineId | null = !gun || free === 0 || recut ? null : needsBlank && countOf(inv, SIGIL_ITEM) < 1 ? 'idris.noblank' : held.length === 0 ? 'idris.norunes' : needsBlank ? 'idris.offer' : null
  const check = gun && picks.length ? idrisCanCut(loadout, inv, ledger.marks, gun, picks, recut) : null
  const switchGun = (g: string) => { setPick(g); setPicks([]); setDone(false); setMsg(null); setRecut(false) }
  const toggleRecut = () => { setRecut(r => !r); setPicks([]); setDone(false); setMsg(null) }
  const toggle = (id: string) => { setDone(false); setMsg(null); setPicks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]) }

  const commit = () => {
    if (!gun) return
    const r = idrisCut(getLoadout(), getInv(), ledger.marks, gun, picks, recut)
    setConfirm(false)
    if (!r.ok) { setMsg(whyText(r.why)); return }
    setLoadout(r.loadout); setInv(r.inv); setLedger({ ...ledger, marks: r.marks }); setMsg(null); setDone(true); setRecut(false)
    hudSay(`${picks.map(runeName).join(' + ')} cut into ${recut ? 'a new sigil on the' : 'the'} ${gunName(gun)}${recut ? '' : "'s sigil"} · −${(SIGIL_CUT_FEE * picks.length).toLocaleString()} Marks`, 'item')
    setPicks([])
  }

  return (
    <HearthFrame title="Idris · weapons and sigils" maxWidth={560} onClose={onClose} fixed dataPanel="idris-panel"
      head={
        <div className="flex items-center justify-between pb-2 text-[13px]">
          <span style={{ ...hearthDisplay, color: H.inkSoft }}>{onBack ? <button type="button" className="underline mr-2" onClick={onBack}>‹ back</button> : null}Letters into a sigil · {SIGIL_CUT_FEE} Marks a rune</span>
          <span className="tabular-nums font-bold" data-marks style={{ color: H.ink }}>{Math.floor(ledger.marks).toLocaleString()} Marks</span>
        </div>
      }
      footer={<span className="text-[12px]" style={hearthDisplay}>The first cut sets an Unattuned sigil on the gun. One rune of each state, up to {SIGIL_CAP}. Your own rune first: half the reload&apos;s mana.</span>}>
      <div className="px-4 pt-3 pb-4 relative">
        {confirm && gun && (
          <div className="absolute inset-0 z-20 grid place-items-center px-4" style={{ background: 'rgba(40,24,12,.30)' }} data-idris-confirm={picks.join(',')}>
            <div className="rounded-[14px] px-4 py-4 max-w-[420px] w-full" style={{ background: H.paperHi, boxShadow: '0 10px 24px rgba(0,0,0,.4)' }}>
              <Say id="idris.confirm" />
              <p className="text-[12.5px] mt-2" style={{ color: H.inkSoft }}>{picks.map((r, i) => `${i + 1}. ${runeName(r)}`).join('  ')} · into the {gunName(gun)} · {(SIGIL_CUT_FEE * picks.length).toLocaleString()} Marks{needsBlank ? ' · uses one Unattuned sigil' : ''}{recut ? ` · replaces the old sigil (${own!.runes.map(runeName).join(', ')} are lost)` : ''}</p>
              <div className="flex justify-end gap-2 mt-3">
                <HearthButton small onClick={() => setConfirm(false)}>{IDRIS_CHOICES.wait}</HearthButton>
                <span data-idris-do style={{ display: 'contents' }}><HearthButton small primary onClick={commit}>{IDRIS_CHOICES.cut}</HearthButton></span>
              </div>
            </div>
          </div>
        )}
        <div className="mb-3" data-idris-talk>
          {done ? <><Scene text={IDRIS_SCENES.done} /><Say id="idris.done" /></>
            : first ? <><Scene text={IDRIS_SCENES.first} /><Say id="idris.greet.first.1" /><Say id="idris.greet.first.2" /><Say id="idris.greet.first.3" /></>
            : <Say id="idris.greet.repeat" />}
          {!done && status && <Say id={status} />}
          {!done && !first && !status && <p className="text-[12.5px] italic mt-1" style={{ ...hearthDisplay, color: H.inkSoft }} data-idris-bark={bark}>Idris: {idrisLine(bark)}</p>}
        </div>
        {!gun ? <p className="text-[14px]" style={{ ...hearthDisplay, color: H.inkSoft }} data-idris-empty>No gun that takes a sigil.</p> : (
          <>
            <div className="flex gap-2 flex-wrap mb-3">
              {guns.map(g => (
                <button key={g} type="button" data-idris-gun={g} onClick={() => switchGun(g)} className="rounded-full px-3 py-1 text-[13px] font-semibold"
                  style={{ ...hearthDisplay, background: g === gun ? H.ember : 'rgba(255,250,235,.5)', color: g === gun ? '#fff' : H.ink, boxShadow: `inset 0 0 0 1px ${H.rule}` }}>{gunName(g)}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-3 flex-wrap" data-idris-sigil={sigil?.runes.join(',') ?? ''}>
              <span className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: H.inkFaint }}>Sigil</span>
              {Array.from({ length: SIGIL_CAP }, (_, i) => {
                const cutR = sigil?.runes[i], picked = !cutR ? picks[i - (sigil?.runes.length ?? 0)] : undefined, r = cutR ?? picked
                return (
                  <span key={i} className="rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold" style={{ ...hearthDisplay, color: r ? H.ink : H.inkFaint, background: cutR ? 'rgba(255,250,235,.7)' : 'transparent', boxShadow: `inset 0 0 0 1px ${r ? runeGlow(r) : H.rule}`, borderStyle: picked ? 'dashed' : undefined }}>
                    {r ? runeName(r) : 'empty'}
                  </span>
                )
              })}
              {needsBlank && <span className="text-[12px]" style={{ color: H.inkSoft }}>· {itemDef(SIGIL_ITEM).name}: {countOf(inv, SIGIL_ITEM)} in the bag</span>}
              {own && own.runes.length > 0 && (
                <button type="button" data-idris-recut={recut ? 'on' : 'off'} onClick={toggleRecut} className="ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                  style={{ ...hearthDisplay, background: recut ? H.ember : 'rgba(255,250,235,.5)', color: recut ? '#fff' : H.ink, boxShadow: `inset 0 0 0 1px ${H.rule}` }}
                  title="A new Unattuned sigil replaces this one. Its runes are lost.">{recut ? 'Keep this sigil' : 'New sigil'}</button>
              )}
            </div>
            {recut && <p className="text-[12px] -mt-1 mb-2" style={{ color: H.rust }} data-idris-recut-note>A new Unattuned sigil replaces this one. Its runes are lost; the letters do not come back.</p>}
            {free > 0 && (
              <div className="grid gap-1.5 overflow-y-auto hearth-scroll" style={{ maxHeight: 'min(40vh, 360px)' }}>
                {held.map(id => {
                  const def = runeById(id), at = picks.indexOf(id), v = at >= 0 ? null : canPickNext(loadout, inv, gun, picks, id, recut)
                  const can = at >= 0 || (!!v?.ok && picks.length < free)
                  return (
                    <button key={id} type="button" disabled={!can} onClick={() => toggle(id)} data-idris-letter={id} data-picked={at >= 0 ? at + 1 : undefined}
                      className="flex items-center gap-3 rounded-[12px] px-3 py-2 text-left" style={{ background: at >= 0 ? 'rgba(201,163,90,.22)' : 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${at >= 0 ? H.ember : H.rule}`, opacity: can ? 1 : 0.55 }}>
                      <span className="w-5 h-5 rounded-full shrink-0 grid place-items-center text-[11px] font-bold" style={{ background: runeGlow(id), color: '#fff', boxShadow: `0 0 8px ${runeGlow(id)}` }}>{at >= 0 ? at + 1 : ''}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{runeName(id)}{id === birth && <span className="text-[11px] font-normal ml-1.5 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(201,163,90,.22)', color: H.ink }}>your rune</span>} <span className="text-[12px] font-normal" style={{ color: H.inkSoft }}>· {def?.state} · {countOf(inv, letterItem(id))} letter{countOf(inv, letterItem(id)) === 1 ? '' : 's'}</span></div>
                        <div className="text-[12px]" style={{ color: H.inkSoft }}>
                          {def?.effects.map((e, i) => <span key={i} style={{ color: e.polarity < 0 ? H.rust : H.moss }}>{i ? ' · ' : ''}{e.polarity > 0 ? '+' : '−'} {e.label}</span>)}
                        </div>
                        {v && !v.ok && <div className="text-[11.5px] mt-0.5" data-idris-why={v.why}>{whyText(v.why)}</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {free > 0 && held.length > 0 && (
              <div className="flex items-center justify-end gap-2 mt-3">
                {check && !check.ok && <span className="text-[12px] flex-1" style={{ color: H.rust }} data-idris-block={check.why}>{whyText(check.why)}</span>}
                <span data-idris-cut style={{ display: 'contents' }}><HearthButton small primary disabled={!check?.ok} onClick={() => setConfirm(true)}>
                  {picks.length ? `${IDRIS_CHOICES.cut} · ${(SIGIL_CUT_FEE * picks.length).toLocaleString()} Marks` : IDRIS_CHOICES.pick}
                </HearthButton></span>
              </div>
            )}
          </>
        )}
        {msg && <div className="text-[13px] font-semibold mt-2" style={{ color: H.rust }} data-idris-msg>{msg}</div>}
      </div>
    </HearthFrame>
  )
}
