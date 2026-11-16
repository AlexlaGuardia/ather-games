'use client'

// THE COMPANION SLOT on the Character tab (shared/companion.ts): who walks with you, and who you can meet next.
// Tap the slot and the companions you have met drop down under it; tap one to call it out, or send it home.
// The ones not yet met show faintly with the level that brings them (canon: 15 lesser, 100 true Mana'mal).

import { useState, useSyncExternalStore } from 'react'
import { H, hearthDisplay, Well } from '../ui/hearth'
import { COMPANIONS, activeCompanion, metCompanions, setCompanion, perkLine, subscribeCompanion, companionRev, type CompanionDef } from './shared/companion'

const TINT: Record<string, string> = {
  glowmite: '#b8e04a', gemdigger: '#b98c58', dustwhisker: '#b9a8cc', tuskroot: '#c9862c', drifthorn: '#7fbf9c',
  rootback: '#6f8f45', embermole: '#e07a3c', prismstrike: '#5fb9dc', sporeling: '#a983dc', sporehound: '#a88b52',
}
/** code-drawn filler: a coloured paw, a firefly for Glowmite */
function Mark({ c, size = 30, dim = false }: { c: CompanionDef; size?: number; dim?: boolean }) {
  const t = TINT[c.id] ?? '#999'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ opacity: dim ? 0.35 : 1 }}>
      {c.id === 'glowmite'
        ? <><circle cx="16" cy="19" r="7" fill={t} opacity=".35" /><ellipse cx="16" cy="19" rx="4" ry="5" fill={t} /><circle cx="16" cy="11" r="3" fill="#3a2a26" /><ellipse cx="11" cy="12" rx="4" ry="2" fill="#dfe9ff" opacity=".8" /><ellipse cx="21" cy="12" rx="4" ry="2" fill="#dfe9ff" opacity=".8" /></>
        : <><ellipse cx="16" cy="20" rx="7" ry="6" fill={t} /><circle cx="9" cy="12" r="3" fill={t} /><circle cx="14" cy="8.5" r="3" fill={t} /><circle cx="19" cy="8.5" r="3" fill={t} /><circle cx="24" cy="12" r="3" fill={t} /></>}
    </svg>
  )
}
const SKILL = (s: string) => s[0].toUpperCase() + s.slice(1)

export function CompanionSlot() {
  useSyncExternalStore(subscribeCompanion, companionRev, () => 0)
  const [open, setOpen] = useState(false)
  const out = activeCompanion(), met = metCompanions()
  const unmet = COMPANIONS.filter(c => !met.some(m => m.id === c.id))
  const pick = (id: CompanionDef['id'] | null) => { setCompanion(id); setOpen(false) }
  return (
    <div data-slot-id="companion" className="rounded-[12px]" style={{ background: 'rgba(255,250,235,.5)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
        <Well size={52}>{out ? <Mark c={out} size={40} /> : null}</Well>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: H.inkFaint }}>Mana&apos;mal</div>
          <div className="text-[17px] font-semibold truncate" style={{ ...hearthDisplay, color: H.ink }}>
            {out ? out.name : <span style={{ color: H.inkFaint }}>{met.length ? 'Home' : 'None yet'}</span>}
          </div>
          <div className="text-[12px]" style={{ color: H.inkSoft }}>
            {out ? perkLine(out) : met.length ? 'Tap to call one out' : 'A skill at 15 brings its first companion'}
          </div>
        </div>
        <span className="text-[13px]" style={{ color: H.inkFaint }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="px-2 pb-2 flex flex-col gap-1">
          {met.map(c => {
            const on = out?.id === c.id
            return (
              <button key={c.id} type="button" data-option={c.id} onClick={() => pick(c.id)}
                className="flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left"
                style={{ background: on ? 'rgba(200,100,42,.14)' : 'transparent', boxShadow: on ? `inset 0 0 0 1.5px ${H.ember}` : undefined }}>
                <span className="grid place-items-center w-9 h-9 shrink-0"><Mark c={c} size={28} /></span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{c.name}</span>
                  <span className="block text-[12px]" style={{ color: H.inkSoft }}>{c.kind} · {perkLine(c)}</span>
                </span>
                {on && <span className="ml-auto text-[12px] font-bold" style={{ color: H.ember }}>out</span>}
              </button>
            )
          })}
          {out && <button type="button" onClick={() => pick(null)} className="rounded-[9px] px-2 py-1.5 text-left text-[13px]" style={{ color: H.inkSoft }}>Send {out.name} home</button>}
          {unmet.map(c => (
            <div key={c.id} data-locked={c.id} className="flex items-center gap-2.5 rounded-[9px] px-2 py-1 text-left">
              <span className="grid place-items-center w-9 h-9 shrink-0"><Mark c={c} size={24} dim /></span>
              <span className="text-[13px]" style={{ color: H.inkFaint }}>{c.name} · {SKILL(c.skill)} {c.level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
