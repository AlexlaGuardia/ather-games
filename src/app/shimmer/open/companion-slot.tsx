'use client'

// THE COMPANION SECTION on the Character tab (shared/companion.ts; BETA M66 s2): an AVATAR card for the companion walking
// with you, then an icon GRID of the whole roster (COMPANIONS, the canon two-tier list, nothing added). Met ones in colour,
// tap to call one out (tap the one already out to send it home); not-yet-met ones in GREY with the skill level that brings
// them (canon: 15 lesser, 100 true Mana'mal). The grid scrolls inside its own box if the roster outgrows it.

import { useSyncExternalStore } from 'react'
import { H, hearthDisplay, Well } from '../ui/hearth'
import { COMPANIONS, activeCompanion, metCompanions, setCompanion, perkLine, subscribeCompanion, companionRev, type CompanionDef } from './shared/companion'

const TINT: Record<string, string> = {
  glowmite: '#b8e04a', gemdigger: '#b98c58', dustwhisker: '#b9a8cc', tuskroot: '#c9862c', drifthorn: '#7fbf9c',
  rootback: '#6f8f45', embermole: '#e07a3c', prismstrike: '#5fb9dc', sporeling: '#a983dc', sporehound: '#a88b52',
}
/** code-drawn filler: a coloured paw, a firefly for Glowmite */
function Mark({ c, size = 30, grey = false }: { c: CompanionDef; size?: number; grey?: boolean }) {
  const t = TINT[c.id] ?? '#999'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={grey ? { filter: 'grayscale(1)', opacity: 0.45 } : undefined}>
      {c.id === 'glowmite'
        ? <><circle cx="16" cy="19" r="7" fill={t} opacity=".35" /><ellipse cx="16" cy="19" rx="4" ry="5" fill={t} /><circle cx="16" cy="11" r="3" fill="#3a2a26" /><ellipse cx="11" cy="12" rx="4" ry="2" fill="#dfe9ff" opacity=".8" /><ellipse cx="21" cy="12" rx="4" ry="2" fill="#dfe9ff" opacity=".8" /></>
        : <><ellipse cx="16" cy="20" rx="7" ry="6" fill={t} /><circle cx="9" cy="12" r="3" fill={t} /><circle cx="14" cy="8.5" r="3" fill={t} /><circle cx="19" cy="8.5" r="3" fill={t} /><circle cx="24" cy="12" r="3" fill={t} /></>}
    </svg>
  )
}
const SKILL = (s: string) => s[0].toUpperCase() + s.slice(1)

export function CompanionSlot() {
  useSyncExternalStore(subscribeCompanion, companionRev, () => 0)
  const out = activeCompanion(), met = metCompanions()
  const isMet = (c: CompanionDef) => met.some(m => m.id === c.id)
  const tap = (c: CompanionDef) => { if (isMet(c)) setCompanion(out?.id === c.id ? null : c.id) }
  return (
    <div data-slot-id="companion" className="flex flex-col gap-2.5">
      <div data-companion-avatar={out?.id ?? ''} className="flex items-center gap-3 rounded-[12px] px-3 py-3" style={{ background: 'rgba(255,250,235,.5)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
        <Well size={76}>{out ? <Mark c={out} size={60} /> : null}</Well>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: H.inkFaint }}>Mana&apos;mal</div>
          <div className="text-[19px] font-semibold truncate" style={{ ...hearthDisplay, color: H.ink }}>
            {out ? out.name : <span style={{ color: H.inkFaint }}>{met.length ? 'Home' : 'None yet'}</span>}
          </div>
          <div className="text-[12px]" style={{ color: H.inkSoft }}>{out ? out.kind : met.length ? 'Tap one below to call it out' : 'A skill at 15 brings its first companion'}</div>
          {out && <div className="text-[12px] font-semibold" style={{ color: H.ember }}>{perkLine(out)}</div>}
        </div>
      </div>
      <div className="flex items-baseline justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: H.inkFaint }}>Met</span>
        <span data-companion-count className="text-[12px] tabular-nums" style={{ color: H.inkSoft }}>{met.length} / {COMPANIONS.length}</span>
      </div>
      <div data-companion-grid className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 overflow-y-auto overscroll-contain" style={{ maxHeight: 260 }}>
        {COMPANIONS.map(c => {
          const unlocked = isMet(c), on = out?.id === c.id
          return (
            <button key={c.id} type="button" data-cell={c.id} data-unlocked={unlocked ? '1' : '0'} disabled={!unlocked} onClick={() => tap(c)}
              aria-label={unlocked ? `${c.name}${on ? ', out' : ''}` : `${c.name}, locked: ${SKILL(c.skill)} ${c.level}`}
              className="flex flex-col items-center gap-0.5 rounded-[10px] py-1.5 min-w-0"
              style={{ background: on ? 'rgba(200,100,42,.14)' : unlocked ? 'rgba(255,250,235,.55)' : 'rgba(0,0,0,.04)', boxShadow: on ? `inset 0 0 0 1.5px ${H.ember}` : `inset 0 0 0 1px ${H.rule}` }}>
              <Mark c={c} size={34} grey={!unlocked} />
              {unlocked
                ? <span className="text-[11px] leading-tight truncate max-w-full px-0.5 font-semibold" style={{ color: H.ink }}>{c.name}</span>
                : <span className="flex flex-col items-center text-[10px] leading-tight max-w-full px-0.5" style={{ color: H.inkFaint }}>
                    <span className="truncate max-w-full">{SKILL(c.skill)}</span><span className="tabular-nums">Lv {c.level}</span>
                  </span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
