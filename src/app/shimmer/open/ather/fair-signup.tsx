'use client'
// ── THE FAIR'S SIGN-UP PANEL (BETA M233 s1, Alex 11-27): every contest is entered through a sign-up panel at its tent (E opens
// it), never an instant start. s1: the keeper picks ONE of their party spirits and presses Enter. Built to GROW: later slices
// make it a LOBBY open to every keeper in that Wilds (friends ready up together), so the entrants are a list (`entrants`)
// and the contest's own view is the panel's child; s1 lists only the keeper. Labels: plain words for @lark.
import { HearthFrame, HearthButton, H } from '../../ui/hearth'
import { LOBBY_UI, type Present } from './fair-lobby'   // M233 s4

export interface Entrant { who: string; spirit: string | null; you?: boolean; ready?: boolean }
export interface SignupSpirit { id: string; name: string }
export const SIGNUP_UI = {
  entrants: 'Entrants',
  you: 'You',
  pick: 'Pick a spirit to enter.',
  noParty: 'Ask a spirit along first. Only your own spirits can enter.',
  enter: 'Enter',
} as const

/** M233 s4 EVENT LOBBY: the chord at this tent (2+ keepers) replaces the solo Enter with READY UP; the host may Start early */
export interface SignupLobby { list: Present[]; ready: boolean; onReady: () => void; isHost: boolean; hostName: string; canStart: boolean; onStart: () => void; busy?: boolean }

export function FairSignup({ title, dataPanel, onClose, entrants, spirits, pick, onPick, canEnter, onEnter, note, children, lobby }: {
  title: string; dataPanel: string; onClose: () => void; lobby?: SignupLobby | null
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
        {lobby ? (
          <div data-signup-lobby={lobby.list.length} data-lobby-host={lobby.isHost ? '1' : '0'} style={{ fontSize: 13, display: 'grid', gap: 2 }}>
            <span style={{ fontWeight: 700, color: H.ink }}>{LOBBY_UI.chord}</span>
            {lobby.list.map(p => (
              <div key={p.id} data-entrant={p.you ? 'you' : p.who} data-ready={p.ready ? '1' : '0'} style={{ display: 'flex', gap: 8, color: H.inkSoft }}>
                <span style={{ flex: 1, minWidth: 0 }}>{p.you ? `${SIGNUP_UI.you} (${p.who})` : p.who}{p.spirit ? ` · ${p.spirit.name}` : ''}</span>
                <span style={{ fontWeight: 800, color: p.ready ? H.moss : H.inkFaint }}>{p.ready ? LOBBY_UI.ready : LOBBY_UI.notReady}</span>
              </div>
            ))}
          </div>
        ) : <div data-signup-entrants={entrants.length} style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: H.ink }}>{SIGNUP_UI.entrants}</span>
          {entrants.map((e, i) => (
            <div key={`${e.who}:${i}`} data-entrant={e.who} style={{ color: H.inkSoft }}>{e.you ? SIGNUP_UI.you : e.who}{e.spirit ? ` · ${e.spirit}` : ''}</div>
          ))}
        </div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {lobby ? <>
            <span data-lobby-ready={lobby.ready ? '1' : '0'}><HearthButton primary={!lobby.ready} disabled={lobby.busy || (!lobby.ready && !canEnter)} onClick={lobby.onReady}>{lobby.ready ? LOBBY_UI.unready : LOBBY_UI.readyUp}</HearthButton></span>
            {lobby.isHost ? <span data-lobby-start><HearthButton disabled={!lobby.canStart} onClick={lobby.onStart}>{LOBBY_UI.start}</HearthButton></span>
              : <span style={{ fontSize: 12, color: H.inkFaint }}>{LOBBY_UI.hostStarts(lobby.hostName)}</span>}
          </> : <span data-signup-enter><HearthButton primary disabled={!canEnter} onClick={onEnter}>{SIGNUP_UI.enter}</HearthButton></span>}
          {note}
        </div>
      </div>
      {children}
    </HearthFrame>
  )
}
