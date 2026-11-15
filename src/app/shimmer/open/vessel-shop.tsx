'use client'

// THE VESSEL COUNTER in the Passage (Alex 11-15: "a shop in the passage that offers the baseline variety of vessels..
// highlighted if it matches the players birth rune and greyed out if not with a warning if they want to purchase anyway
// if they have tool tips turned on .. the price of the item were to glow red if you cant afford it").
//
// CANON, read-only: the Passage sells vessels (world/rune-hold.md › the shelves); a vessel is made for one word and its
// letters grow in; the Lane Law: a TACTICAL is written in runes of the keeper's ELEMENT lane, every rune of it
// (play3d/cast.ts › laneRunes, "every rune, not any rune"); no ultimate word is ever sold, so a glove on a shelf is blank
// paper waiting on a word (play3d/passage.ts). And the shelf refuses nothing for fit: "the information is the mercy; the
// choice stays yours". The words, runes and prices come from the voxel layer's own pure catalog, never a copy here.
//
// BUILD (Jin): the BASELINE shelf = one bracelet for every single-letter tactical word (it spans almost every rune, so
// every birth rune finds its own) plus blank gloves; tier 1, the rack's own price rule. Bought vessels go to the
// keeper's loadout (shared/loadout.ts) and are worn from the Character tab. Marks are the continent's ledger.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { HearthFrame, H, hearthDisplay, Well, HearthButton } from '../ui/hearth'
import { baselineShelf, fitOf, type ShelfItem, type Fit } from './shared/vessel-shelf'
import { RUNES } from '../play3d/birth/runes.data'
import { loadRuneInventory } from '../play3d/rune-inventory'
import type { Cavern } from './cavern'
import { caveRoomAt } from './cavern'
import { useLoadout, setLoadout, addVessel, MAX_PER_KIND } from './shared/loadout'
import { useSettings } from './shared/settings'
import { hudSay } from './shared/game-hud'
import type { Ledger } from './trade'

const runeName = (id: string) => RUNES.find(r => r.id === id)?.name ?? id
const runeGlow = (id: string) => RUNES.find(r => r.id === id)?.glow ?? H.inkSoft

function Glyph({ kind, glow, dim }: { kind: 'bracelet' | 'glove'; glow?: string; dim?: boolean }) {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden style={{ filter: dim ? 'grayscale(1)' : undefined }}>
      {kind === 'bracelet'
        ? <><ellipse cx="16" cy="17" rx="11" ry="6.5" fill="none" stroke="#7a5636" strokeWidth="4" /><circle cx="16" cy="10.6" r="2.8" fill={glow ?? '#c9b48a'} /></>
        : <path d="M9 27 V14 q0-2 2-2 t2 2 V8 q0-2 2-2 t2 2 V7 q0-2 2-2 t2 2 v2 q0-2 2-2 t2 2 V20 q0 7 -7 7 Z" fill="#a8743f" stroke="#5d4128" strokeWidth="1.3" />}
    </svg>
  )
}

export function VesselShop({ ledger, setLedger, onClose, isTouch }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; isTouch?: boolean }) {
  const shelf = useMemo(baselineShelf, [])
  const loadout = useLoadout()
  const { tooltips } = useSettings()
  const [birth, setBirth] = useState<string | null>(null)
  useEffect(() => { setBirth(loadRuneInventory().birth ?? null) }, [])
  const [warn, setWarn] = useState<ShelfItem | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ key: string; t: number } | null>(null)
  const sorted = useMemo(() => {
    const rank: Record<Fit, number> = { birth: 0, lane: 1, any: 2, off: 3 }
    return [...shelf].sort((a, b) => rank[fitOf(a, birth)] - rank[fitOf(b, birth)])
  }, [shelf, birth])
  const count = (k: 'bracelet' | 'glove') => loadout.vessels.filter(v => v.kind === k).length

  const buy = (item: ShelfItem, confirmed = false) => {
    if (ledger.marks < item.price) { setFlash({ key: item.key, t: Date.now() }); return }
    if (count(item.kind) >= MAX_PER_KIND) { hudSay(`Three ${item.kind}s is what a keeper can carry.`, 'info'); return }
    if (!confirmed && tooltips && fitOf(item, birth) === 'off') { setWarn(item); return }
    const r = addVessel(loadout, { kind: item.kind, label: item.kind === 'bracelet' ? 'Bracelet' : 'Glove', word: item.wordName, tier: 1 })
    if (!r.ok) return
    setLoadout(r.loadout)
    setLedger({ ...ledger, marks: ledger.marks - item.price })
    setWarn(null)
    hudSay(`${item.wordName ? `${item.wordName} bracelet` : 'A blank glove'} · −${item.price} Marks · wear it from the Character tab (P)`, 'item')
  }

  return (
    <HearthFrame title="The vessels" maxWidth={560} onClose={onClose} fixed dataPanel="vessel-shop"
      head={
        <div className="flex items-center justify-between pb-2 text-[13px]">
          <span style={{ ...hearthDisplay, color: H.inkSoft }}>
            {birth ? <>Born <b style={{ color: H.ink }}>{runeName(birth)}</b> · your lane lights up</> : <>No birth rune yet: nothing here is written for you</>}
          </span>
          <span className="tabular-nums font-bold" data-marks style={{ color: H.ink }}>{ledger.marks} Marks</span>
        </div>
      }
      footer={<span className="text-[12px]" style={hearthDisplay}>{isTouch ? 'Tap a vessel to buy it.' : 'Click a vessel to buy it'} · bracelets {count('bracelet')}/{MAX_PER_KIND} · gloves {count('glove')}/{MAX_PER_KIND}</span>}>
      <style>{`@keyframes vs-red { 0%,100% { text-shadow: 0 0 0 rgba(200,40,30,0) } 50% { text-shadow: 0 0 9px rgba(220,50,35,.85) } }
        @keyframes vs-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-3px) } 75% { transform: translateX(3px) } }`}</style>
      {/* the shelf scrolls inside the frame: twenty items at full height pushed the plaque up under the top HUD */}
      <div className="px-4 pt-3 pb-4 grid gap-1.5 overflow-y-auto hearth-scroll" style={{ maxHeight: 'min(56vh, 520px)' }}>
        {sorted.map(item => {
          const fit = fitOf(item, birth), dear = ledger.marks < item.price, mine = fit === 'birth' || fit === 'lane'
          const shook = flash?.key === item.key
          return (
            <button key={`${item.key}-${shook ? flash!.t : 0}`} type="button" data-shelf={item.key} data-fit={fit} data-dear={dear || undefined}
              onClick={() => buy(item)}
              onMouseEnter={() => tooltips && setTip(item.key)} onMouseLeave={() => setTip(t => (t === item.key ? null : t))}
              className="relative flex items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition-all hover:-translate-y-px"
              style={{
                background: fit === 'birth' ? 'rgba(224,130,63,.16)' : fit === 'lane' ? 'rgba(95,125,69,.12)' : 'rgba(255,250,235,.45)',
                boxShadow: fit === 'birth' ? `inset 0 0 0 2px ${H.ember}, 0 0 14px rgba(224,130,63,.35)` : fit === 'lane' ? `inset 0 0 0 1.5px ${H.moss}` : `inset 0 0 0 1px ${H.rule}`,
                opacity: fit === 'off' ? 0.5 : 1, filter: fit === 'off' ? 'grayscale(.85)' : undefined,
                animation: shook ? 'vs-shake .25s 2' : undefined,
              }}>
              <Well size={46}><Glyph kind={item.kind} glow={item.runes[0] ? runeGlow(item.runes[0]) : undefined} dim={fit === 'off'} /></Well>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>
                  {item.wordName ? `${item.wordName}` : 'Blank glove'}
                  <span className="ml-1.5 text-[12px] font-normal" style={{ color: H.inkSoft }}>{item.kind === 'bracelet' ? 'bracelet · tactical' : 'glove · signature'}</span>
                </div>
                <div className="text-[12px]" style={{ color: H.inkSoft }}>
                  {item.runes.length ? item.runes.map(runeName).join(' + ') : 'no word written'}
                  {fit === 'birth' && <b className="ml-1.5" style={{ color: H.ember }}>your birth rune</b>}
                  {fit === 'lane' && <b className="ml-1.5" style={{ color: H.moss }}>on your lane</b>}
                  {fit === 'off' && birth && <span className="ml-1.5 italic">off your lane</span>}
                </div>
                {tooltips && tip === item.key && item.effect && <div className="mt-1 text-[12.5px] italic leading-snug" style={{ ...hearthDisplay, color: H.inkSoft }}>{item.effect}</div>}
              </div>
              {/* the price: glows red when you cannot cover it, and shakes if you try */}
              <span className="tabular-nums text-[15px] font-extrabold shrink-0" data-price
                style={{ color: dear ? '#c0392b' : H.ink, animation: dear ? 'vs-red 1.6s ease-in-out infinite' : undefined }}>
                {item.price}<span className="text-[11px] font-bold ml-0.5">M</span>
              </span>
            </button>
          )
        })}
      </div>
      {warn && (
        <div className="absolute inset-0 grid place-items-center z-30" style={{ background: 'rgba(40,24,12,.35)' }} onClick={e => { e.stopPropagation(); setWarn(null) }}>
          <div className="rounded-[14px] px-4 py-3 max-w-[340px]" style={{ background: H.paperHi, boxShadow: '0 10px 24px rgba(0,0,0,.4)' }} onClick={e => e.stopPropagation()} data-warn>
            <div className="text-[17px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>Off your lane</div>
            <p className="text-[13px] mt-1 leading-snug" style={{ color: H.inkSoft }}>
              {warn.wordName} is written in {warn.runes.map(runeName).join(' + ')}, which is not on your {birth ? runeName(birth) : ''} lane. Its letters will stay dark for you. Buy it anyway?
            </p>
            <div className="flex gap-2 justify-end mt-3">
              <HearthButton small onClick={() => setWarn(null)}>Leave it</HearthButton>
              <HearthButton small primary onClick={() => buy(warn, true)}>Buy for {warn.price} M</HearthButton>
            </div>
          </div>
        </div>
      )}
    </HearthFrame>
  )
}

/** In the world: stand at the vessels counter, the message line says so, E opens the shop. */
export function VesselCounter({ cave, onOpen, enabled }: { cave: Cavern; onOpen: () => void; enabled: boolean }) {
  const { camera } = useThree()
  const near = useRef(false)
  const counter = useMemo(() => cave.props.find(p => p.kind === 'vessels') ?? null, [cave])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'KeyE' && near.current && enabled && !e.repeat) onOpen() }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [onOpen, enabled])
  // probe for scripted checks: where the counter stands
  useEffect(() => { (window as unknown as { __vesselCounter?: () => unknown }).__vesselCounter = () => counter }, [counter])
  useFrame(() => {
    if (!counter) return
    const p = camera.position
    const at = Math.abs(p.y - 1.6 - cave.y) < 2.5 && Math.hypot(p.x - counter.x, p.z - counter.z) < 2.6 && caveRoomAt(cave, p.x, p.z)?.id === 'vessels'
    if (at !== near.current) { near.current = at; if (at) hudSay('The vessels · E to browse the counter', 'item') }
  })
  return null
}
