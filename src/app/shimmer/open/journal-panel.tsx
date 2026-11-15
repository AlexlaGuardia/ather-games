'use client'

// THE JOURNAL tab: Kael's ledger, kept by hand (Alex 11-15: "a scribbled interactable list that has the quest name but
// if the player clicks it a dropdown to toggle set active [] and a description of the situation"). Ruled paper, lines in
// ink; tap a line and it opens under itself with the situation and three ticks: set active, waymark, trail. Struck
// lines are done. Kael's page sits above the keeper's entries and holds no lines until lark writes them (§7½).

import { useState } from 'react'
import { H, hearthDisplay } from '../ui/hearth'
import { useJournal, setActive, toggleMarker, toggleTrail, markerOn, trailOn, type JournalEntry } from './shared/journal'

const INK = '#2f2418', RULE = 'rgba(79,118,144,.28)', MARGIN = 'rgba(168,72,47,.45)'
// a hand never writes level: each line leans a hair, by its id, the same way every time it is drawn
const lean = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h % 7) - 3) * 0.18 }

function Tick({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={e => { e.stopPropagation(); onClick() }}
      className="flex items-center gap-2 py-1 pr-3 text-left disabled:opacity-40" style={{ ...hearthDisplay, color: INK, fontSize: 15 }}>
      {/* a box drawn by hand, ticked in ink */}
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path d="M3.2 3.6 L16.6 3.1 L16.9 16.4 L3.4 16.8 Z" fill="none" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        {on && <path d="M5.2 10.4 L8.6 14.1 L15.8 4.2" fill="none" stroke={H.ember} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <span>{label}</span>
    </button>
  )
}

function Line({ e, open, onOpen }: { e: JournalEntry; open: boolean; onOpen: () => void }) {
  const { prefs } = useJournal()
  const active = prefs.active === e.id
  return (
    <div data-entry={e.id} style={{ transform: `rotate(${lean(e.id)}deg)` }}>
      <button type="button" onClick={onOpen} className="w-full flex items-baseline gap-2 text-left py-[7px]"
        style={{ ...hearthDisplay, color: INK, fontSize: 18, lineHeight: '26px' }}>
        <span style={{ width: 14, color: active ? H.ember : 'transparent' }} aria-hidden>{active ? '✦' : ''}</span>
        <span style={{ textDecoration: e.struck ? 'line-through' : undefined, textDecorationThickness: 2, opacity: e.struck ? 0.55 : 1 }}>{e.title}</span>
        <span className="ml-auto text-[13px]" style={{ color: H.inkFaint }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="pl-6 pb-2.5 -mt-0.5">
          <p className="text-[14.5px] leading-[26px] italic" style={{ ...hearthDisplay, color: H.inkSoft }}>{e.note}</p>
          <div className="flex flex-wrap gap-x-2 mt-0.5">
            <Tick on={active} label="Set active" disabled={e.struck} onClick={() => setActive(active ? null : e.id)} />
            <Tick on={markerOn(prefs, e.id)} label="Waymark" disabled={!e.where || e.struck} onClick={() => toggleMarker(e.id)} />
            <Tick on={trailOn(prefs, e.id)} label="Trail" disabled={!e.where || e.struck} onClick={() => toggleTrail(e.id)} />
          </div>
          {!e.where && <div className="text-[12.5px] italic" style={{ ...hearthDisplay, color: H.inkFaint }}>Nowhere to point yet.</div>}
        </div>
      )}
    </div>
  )
}

export function JournalBody() {
  const { entries, prefs } = useJournal()
  const [open, setOpen] = useState<string | null>(prefs.active)
  const kael = entries.filter(e => e.hand === 'kael'), mine = entries.filter(e => e.hand === 'keeper')
  // open lines first, struck at the foot; the active one leads
  const order = (a: JournalEntry, b: JournalEntry) => (+!!a.struck - +!!b.struck) || (+(b.id === prefs.active) - +(a.id === prefs.active))
  const page = (list: JournalEntry[]) => [...list].sort(order).map(e => <Line key={e.id} e={e} open={open === e.id} onOpen={() => setOpen(o => (o === e.id ? null : e.id))} />)
  return (
    <div className="relative px-5 pt-7 pb-5 min-h-[340px]"
      style={{ backgroundImage: `linear-gradient(90deg, transparent 34px, ${MARGIN} 34px, ${MARGIN} 35.5px, transparent 35.5px), repeating-linear-gradient(180deg, transparent 0 39px, ${RULE} 39px 40px)`, backgroundPosition: '0 0, 0 22px' }}>
      <div className="pl-6 mb-1 text-[13px] italic" style={{ ...hearthDisplay, color: H.inkSoft }}>Kael&apos;s ledger</div>
      {kael.length > 0 && <div className="pl-1">{page(kael)}</div>}
      <div className="pl-1">{mine.length ? page(mine) : <div className="pl-6 py-2 italic" style={{ ...hearthDisplay, color: H.inkFaint, fontSize: 16 }}>Nothing written yet.</div>}</div>
    </div>
  )
}
