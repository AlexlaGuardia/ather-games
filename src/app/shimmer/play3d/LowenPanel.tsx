'use client'

/**
 * Lowen's caravan — the adoption step (canon `world/manamals.md` › ★ Adoption, RULED 2026-09-27).
 *
 * The keeper does not pick. They STAND AND WAIT while the animals look at them, and one comes (`adoption.ts` ›
 * whoStays: fixed for a keeper and a month, so waiting again does not reroll it). Then: take them home (the Marks are
 * the animal's CARE, never its price) or not today. One home per keeper per visit.
 *
 * ⚠ Words: this panel carries interface labels only. Lowen's lines and every narration box are @lark's DRAFT
 * (`lowen-lines.draft.md`), waiting on Alex's sign-off; they are wired when signed. TODO(lark-signoff).
 * Canon's register is silence first, so a panel with no speech in it is not wrong in the meantime.
 */
import { useEffect, useState } from 'react'
import { HearthFrame } from '../ui/hearth'
import { getMarks, spendMarks } from '@/lib/wallet'
import { BEAST_DEFS } from '../beasts/beast'
import { CARE_MARKS, type Stray } from './adoption'

export function LowenPanel({ roster, stays, canAdopt, adoptedThisMonth, leaves, onAdopt, onClose }: {
  roster: Stray[]
  /** the seat of the one that comes to this keeper */
  stays: number
  canAdopt: boolean
  adoptedThisMonth: boolean
  /** "leaves in 3 days" */
  leaves: string
  onAdopt: (s: Stray) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<'look' | 'waiting' | 'stayed' | 'home' | 'declined'>('look')
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    if (phase !== 'waiting') return
    const id = setTimeout(() => setPhase('stayed'), 2400)
    return () => clearTimeout(id)
  }, [phase])
  const marks = getMarks()
  const take = () => {
    if (!spendMarks(CARE_MARKS)) { setNote(`${CARE_MARKS} Marks for their care.`); return }
    onAdopt(roster[stays]); setPhase('home')
  }
  return (
    <HearthFrame title="Lowen's caravan" maxWidth={480} onClose={onClose} fixed backdropClass="z-40" bodyClass="p-4 pt-6 text-[12px]">
      <div className="mb-3 flex items-baseline gap-2 pr-6">
        <span className="hk-label text-[12px] hk-faint">{leaves}</span>
        <span className="tabular-nums ml-auto text-[12px] hk-ember">{marks} Marks</span>
      </div>
      <div className="mb-3 flex flex-col gap-1.5">
        {roster.map(s => {
          const chosen = (phase === 'stayed' || phase === 'home') && s.seat === stays
          return (
            <div key={s.seat} className="flex items-baseline gap-2" style={{ opacity: (phase === 'stayed' || phase === 'home') && !chosen ? 0.45 : 1 }}>
              <span className="hk-ink">{BEAST_DEFS[s.species].name}</span>
              {chosen && <span className="hk-label text-[12px] hk-ember ml-auto">{phase === 'home' ? 'going home with you' : 'stayed'}</span>}
            </div>
          )
        })}
      </div>
      {adoptedThisMonth && phase === 'look'
        ? <div className="hk-faint">One home a visit. Lowen comes back next month.</div>
        : !canAdopt
          ? <div className="hk-faint">The step is empty until Lowen is back.</div>
          : (
            <div className="flex flex-wrap gap-2">
              {phase === 'look' && <button type="button" className="hk-btn" onClick={() => setPhase('waiting')}>Stand and wait</button>}
              {phase === 'waiting' && <span className="hk-faint italic">…</span>}
              {phase === 'stayed' && <>
                <button type="button" className="hk-btn" onClick={take}>Take them home · {CARE_MARKS} Marks for their care</button>
                <button type="button" className="hk-btn" onClick={() => setPhase('declined')}>Not today</button>
              </>}
              {phase === 'declined' && <span className="hk-faint">not today</span>}
            </div>
          )}
      {note && <div className="mt-2 hk-rust">{note}</div>}
    </HearthFrame>
  )
}
