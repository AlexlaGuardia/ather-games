'use client'

// THE PACK: one menu, three tabs (Alex 11-15: "inventory tabs as three panels to choose from; journal, bag, character.
// each opens a dif menu with icons on the left and right of the header to alternate between the three"). The plaque
// names the tab you are on; the icon at the left of the header is the tab before it, the icon at the right the tab after
// (they wrap), and ← / → or Tab do the same from the keyboard. I opens the Bag, J the Journal, P the Character.
// Carved Hearth frame (the red close), per the open world's menu rule (game-hud.test › MENUS).

import { useEffect, useState } from 'react'
import { HearthFrame, H, hearthDisplay } from '../ui/hearth'
import { BagBody, bagHint } from './shared/bag'
import { JournalBody } from './journal-panel'
import { CharacterBody } from './character-panel'
import { useSettings, setSettings } from './shared/settings'

export type PackTab = 'journal' | 'bag' | 'character'
export const PACK_TABS: PackTab[] = ['journal', 'bag', 'character']
const NAME: Record<PackTab, string> = { journal: 'Journal', bag: 'Bag', character: 'Character' }
/** The keys that open the pack straight to a tab. */
export const PACK_KEYS: Record<string, PackTab> = { KeyI: 'bag', KeyJ: 'journal', KeyP: 'character' }

/** The tab icons: code-drawn, ink on the parchment. */
export function TabIcon({ tab, size = 26 }: { tab: PackTab; size?: number }) {
  const s = { fill: 'none', stroke: H.ink, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (tab === 'journal') return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <path d="M6 4.5h13.5a2.5 2.5 0 0 1 2.5 2.5v16.5H8.5A2.5 2.5 0 0 1 6 21z" {...s} fill="#e8d8b8" />
      <path d="M6 21a2.5 2.5 0 0 1 2.5-2.5H22" {...s} /><path d="M10.5 9h7M10.5 12.5h5" {...s} strokeWidth={1.4} />
    </svg>
  )
  if (tab === 'bag') return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <path d="M8 10.5h12l1.6 12.2a1.6 1.6 0 0 1-1.6 1.8H8a1.6 1.6 0 0 1-1.6-1.8z" {...s} fill="#c9a86b" />
      <path d="M10.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...s} /><path d="M11 15.5h6" {...s} strokeWidth={1.4} />
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <circle cx="14" cy="8.5" r="3.6" {...s} fill="#e8d8b8" />
      <path d="M7 24c.4-5.6 3.2-8.6 7-8.6s6.6 3 7 8.6" {...s} fill="#a8743f" />
    </svg>
  )
}

/** The open world's options, for now a sheet inside the pack (the gear by the tab icons). The voxel world's full Options
 *  panel (hud/options-panel.tsx: game / video / sound / controls) is the port this grows into. */
function OptionsBody() {
  const s = useSettings()
  const row = (label: string, sub: string, on: boolean, flip: () => void, id: string) => (
    <button type="button" data-option-row={id} onClick={flip} className="w-full flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left"
      style={{ background: 'rgba(255,250,238,.6)', boxShadow: '0 1px 3px rgba(58,39,22,.18)' }}>
      <span><span className="block text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{label}</span><span className="block text-[12px]" style={{ color: H.inkSoft }}>{sub}</span></span>
      <span className="relative w-11 h-6 rounded-full shrink-0 transition-colors" style={{ background: on ? H.ember : 'rgba(58,39,22,.25)' }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: on ? 22 : 2, background: H.paperHi, boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
      </span>
    </button>
  )
  return (
    <div className="px-4 pt-6 pb-4 grid gap-2">
      {row('Tooltips', 'Explanations on hover, and a warning before you buy something that is not written for you', s.tooltips, () => setSettings({ tooltips: !s.tooltips }), 'tooltips')}
    </div>
  )
}
function Gear({ on }: { on: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 3.5-2.1-.6-.5-1.3 1-1.9-1.6-1.6-1.9 1-1.3-.5L13 4h-2l-.6 2.1-1.3.5-1.9-1-1.6 1.6 1 1.9-.5 1.3L4 11v2l2.1.6.5 1.3-1 1.9 1.6 1.6 1.9-1 1.3.5L11 20h2l.6-2.1 1.3-.5 1.9 1 1.6-1.6-1-1.9.5-1.3L20 13z" fill={on ? H.ember : 'none'} stroke={H.ink} strokeWidth="1.4" strokeLinejoin="round" /></svg>
}

export function PackMenu({ tab, onTab, onClose, sel, isTouch }: {
  tab: PackTab; onTab: (t: PackTab) => void; onClose: () => void; sel: number; isTouch?: boolean
}) {
  const [opts, setOpts] = useState(false)
  const at = PACK_TABS.indexOf(tab)
  useEffect(() => { setOpts(false) }, [tab])
  const prev = PACK_TABS[(at + 2) % 3], next = PACK_TABS[(at + 1) % 3]
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') { e.preventDefault(); onTab(prev) }
      else if (e.code === 'ArrowRight' || e.code === 'Tab') { e.preventDefault(); onTab(e.shiftKey && e.code === 'Tab' ? prev : next) }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [prev, next, onTab])
  const side = (t: PackTab, dir: 'left' | 'right') => (
    <button type="button" data-pack-go={t} onClick={() => onTab(t)} aria-label={NAME[t]}
      className={`flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 ${dir === 'right' ? 'flex-row-reverse pl-2.5 pr-1.5' : ''}`}
      style={{ background: 'rgba(214,191,149,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
      <span className="text-[14px]" style={{ color: H.inkSoft }}>{dir === 'left' ? '‹' : '›'}</span>
      <TabIcon tab={t} size={22} />
      <span className="text-[12px] font-bold hidden sm:inline" style={{ color: H.inkSoft }}>{NAME[t]}</span>
    </button>
  )
  const head = (
    <div className="flex items-center justify-between pb-2">
      {side(prev, 'left')}
      <div className="flex items-center gap-2">
        {PACK_TABS.map(t => (
          <button key={t} type="button" onClick={() => onTab(t)} aria-label={NAME[t]} data-pack-tab={t}
            className="rounded-full grid place-items-center transition-all"
            style={{ width: t === tab ? 34 : 26, height: t === tab ? 34 : 26, opacity: t === tab ? 1 : 0.45, background: t === tab ? H.paperHi : 'transparent', boxShadow: t === tab ? `0 0 0 2px ${H.ember}` : undefined }}>
            <TabIcon tab={t} size={t === tab ? 24 : 18} />
          </button>
        ))}
        <button type="button" onClick={() => setOpts(o => !o)} aria-label="Options" data-pack-options className="ml-1 grid place-items-center rounded-full"
          style={{ width: 28, height: 28, opacity: opts ? 1 : 0.6, boxShadow: opts ? `0 0 0 2px ${H.ember}` : undefined, background: opts ? H.paperHi : 'transparent' }}><Gear on={opts} /></button>
      </div>
      {side(next, 'right')}
    </div>
  )
  const hint = tab === 'bag' ? bagHint(isTouch) : tab === 'journal' ? (isTouch ? 'Tap a line to open it.' : 'Click a line to open it') : (isTouch ? 'Tap a slot to change it.' : 'Click a slot to change what you carry')
  return (
    <HearthFrame title={opts ? 'Options' : NAME[tab]} maxWidth={tab === 'bag' && !opts ? 560 : 520} onClose={onClose} fixed dataPanel={opts ? 'pack-options' : `pack-${tab}`} head={head}
      footer={<span className="text-[12px]" style={hearthDisplay}>{hint}{isTouch ? '' : ' · ← → switch tabs · I J P'}</span>}>
      {opts ? <OptionsBody /> : tab === 'bag' ? <BagBody sel={sel} /> : tab === 'journal' ? <JournalBody /> : <CharacterBody />}
    </HearthFrame>
  )
}
