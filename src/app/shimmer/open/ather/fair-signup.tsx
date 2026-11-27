'use client'
// ── THE FAIR'S SIGN-UP PANEL (BETA M233 s1, Alex 11-27): every contest is entered through a sign-up panel at its tent (E opens
// it), never an instant start. s1: the keeper picks ONE of their party spirits and presses Enter. Built to GROW: later slices
// make it a LOBBY open to every keeper in that Wilds (friends ready up together), so the entrants are a list (`entrants`)
// and the contest's own view is the panel's child; s1 lists only the keeper. Labels: plain words for @lark.
import { HearthFrame, HearthButton, H } from '../../ui/hearth'

export interface Entrant { who: string; spirit: string | null; you?: boolean; ready?: boolean }
export interface SignupSpirit { id: string; name: string }
export const SIGNUP_UI = {
  entrants: 'Entrants',
  you: 'You',
  pick: 'Pick a spirit to enter.',
  noParty: 'Ask a spirit along first. Only your own spirits can enter.',
  enter: 'Enter',
} as const

export function FairSignup({ title, dataPanel, onClose, entrants, spirits, pick, onPick, canEnter, onEnter, note, children }: {
  title: string; dataPanel: string; onClose: () => void
  entrants: Entrant[]; spirits: SignupSpirit[]; pick: string | null; onPick: (id: string) => void
  canEnter: boolean; onEnter: () => void; note?: React.ReactNode; children?: React.ReactNode
}) {
  return (
    <HearthFrame title={title} onClose={onClose} dataPanel={dataPanel} maxWidth={560}>
      <div data-signup style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, color: H.inkSoft }}>{spirits.length ? SIGNUP_UI.pick : SIGNUP_UI.noParty}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {spirits.map(s => (
            <button key={s.id} data-signup-spirit={s.id} data-picked={pick === s.id ? '1' : '0'} onClick={() => onPick(s.id)}
              style={{ padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: H.ink, background: pick === s.id ? H.paperLo : 'rgba(255,250,240,.6)', boxShadow: pick === s.id ? `inset 0 0 0 2px ${H.ember}` : 'inset 0 0 0 1px rgba(58,39,22,.14)' }}>{s.name}</button>
          ))}
        </div>
        <div data-signup-entrants={entrants.length} style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: H.ink }}>{SIGNUP_UI.entrants}</span>
          {entrants.map((e, i) => (
            <div key={`${e.who}:${i}`} data-entrant={e.who} style={{ color: H.inkSoft }}>{e.you ? SIGNUP_UI.you : e.who}{e.spirit ? ` · ${e.spirit}` : ''}</div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span data-signup-enter><HearthButton primary disabled={!canEnter} onClick={onEnter}>{SIGNUP_UI.enter}</HearthButton></span>
          {note}
        </div>
      </div>
      {children}
    </HearthFrame>
  )
}
