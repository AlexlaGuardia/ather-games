'use client'
// ── DEPARTURES: the Station clerk's board (2026-09-28, Alex) ─────────────────────────────────────────────────
//
// Alex: *"a ship attendant you talk to; and the ship que should have the three players standing together with
// options to select the destination."* Canon already keeps the Station's front by a ROLE, **the Station clerk**
// (`world/rune-hold.md` › the fronts are kept by roles; a name is earned by a relationship), so the attendant is
// the clerk working the berths, not a new person. No clerk dialogue is authored here (lines are @lark's).
//
// The board, top to bottom:
//   · YOUR THREE — you and your party, standing together; an empty place is an open seat (three to a door, the chord)
//   · WHERE — the berths. A seated berth lists what its world offers (the Breach; the colossus raid once its road is
//     read); an empty berth is an empty pad, which is canon's visible cap. Every lock says why.
//   · HOW — go alone · go together (your party, one shared Breach: `server/breach-server.mts`) · find others (the
//     matchmaking line; the board turns into a finding view until matched). A destination whose fight is solo
//     (the Slack) says so and offers only going alone.
// Renders and calls back. Launching is the host's `onWarp`, so the owner gate and the road gate are the SAME ones
// the gangway and the roof door use.
import { useState } from 'react'
import { H, HearthButton, hearthBody, hearthDisplay } from '../ui/hearth'

export interface Destination {
  id: string
  /** the berth it sails from (1-based) */
  berth: number
  world: string
  name: string
  /** null = open; otherwise the one-line reason it is shut */
  locked: string | null
  /** can a party go here together? (the Breach: yes, since 09-28; the Slack: its fight is solo for now) */
  coop: boolean
}

export const PARTY_SEATS = 3
export type GoMode = 'alone' | 'together' | 'others'
/** the finding view's state, owned by the host (it holds the queue socket) */
export interface Finding { n: number; need: number; waited: number; names?: string[] }

function Keeper({ name, you, empty, index }: { name?: string; you?: boolean; empty?: boolean; index: number }) {
  const tone = empty ? 'rgba(58,39,22,.18)' : you ? H.ember : H.sky
  return (
    <div className="flex flex-col items-center" style={{ width: 84, transform: `translateY(${index === 1 ? -4 : 0}px)` }} data-seat={empty ? 'open' : name}>
      <svg width="54" height="78" viewBox="0 0 54 78" aria-hidden>
        <ellipse cx="27" cy="74" rx="18" ry="3.5" fill="rgba(58,39,22,.22)" />
        {empty ? (
          <g fill="none" stroke={tone} strokeWidth="2" strokeDasharray="4 4">
            <circle cx="27" cy="15" r="9" />
            <path d="M12 70 Q12 34 27 30 Q42 34 42 70 Z" />
          </g>
        ) : (
          <g fill={tone}>
            <circle cx="27" cy="15" r="9" />
            <path d="M12 70 Q12 34 27 30 Q42 34 42 70 Z" />
            <path d="M17 46 L9 58 M37 46 L45 58" stroke={tone} strokeWidth="5" strokeLinecap="round" />
          </g>
        )}
      </svg>
      <div className={`text-[12px] font-extrabold truncate max-w-full ${empty ? 'hk-faint italic font-semibold' : ''}`}>
        {empty ? 'open seat' : name}
      </div>
      {you && <div className="text-[10px] hk-soft font-semibold">you</div>}
    </div>
  )
}

export function DeparturesPanel({ you, party, members, destinations, berths, onLaunch, onInviteFriends, finding, onFindOthers, onGoNow, onCancelFind }: {
  you: string
  party: string | null
  /** the other keepers in your party instance, by name */
  members: string[]
  destinations: Destination[]
  berths: number
  onLaunch: (d: Destination, together: boolean) => void
  onInviteFriends: () => void
  /** set while this keeper waits in the Find others line */
  finding: Finding | null
  onFindOthers: (d: Destination) => void
  onGoNow: () => void
  onCancelFind: () => void
}) {
  const open = destinations.filter(d => !d.locked)
  const [pick, setPick] = useState<string | null>(open[0]?.id ?? null)
  const [mode, setMode] = useState<GoMode>(party ? 'together' : 'alone')   // in a party, the default is together
  const chosen = destinations.find(d => d.id === pick && !d.locked) ?? null
  const seats = [you, ...members].slice(0, PARTY_SEATS)
  const together = !!party && members.length > 0
  if (finding) {
    const mins = Math.floor(finding.waited / 60), secs = String(finding.waited % 60).padStart(2, '0')
    return (
      <div className="px-4 pt-4 pb-4 hk-ink text-center" style={{ ...hearthBody }} data-panel="finding">
        <div className="flex justify-center items-end gap-1 pt-1 pb-2">
          {Array.from({ length: PARTY_SEATS }, (_, i) => (
            <Keeper key={i} index={i} name={i === 0 ? you : i < finding.n ? 'found' : undefined} you={i === 0} empty={i >= Math.max(1, finding.n)} />
          ))}
        </div>
        <div className="text-[16px] font-extrabold" style={hearthDisplay}>Finding others…</div>
        <div className="text-[12px] hk-soft mt-1 tabular-nums">{finding.n} of {finding.need} · {mins}:{secs}</div>
        <div className="text-[11px] hk-faint mt-1">Two who have waited a little go together. Go now to start with whoever is here.</div>
        <div className="flex justify-center gap-2 mt-4">
          <HearthButton onClick={onCancelFind}>Cancel</HearthButton>
          <HearthButton primary onClick={onGoNow}>Go now</HearthButton>
        </div>
      </div>
    )
  }
  return (
    <div className="px-4 pt-4 pb-4 hk-ink" style={{ ...hearthBody }} data-panel="departures">
      {/* YOUR THREE */}
      <div className="flex justify-center items-end gap-1 pt-1 pb-2">
        {Array.from({ length: PARTY_SEATS }, (_, i) => (
          <Keeper key={i} index={i} name={seats[i]} you={i === 0} empty={!seats[i]} />
        ))}
      </div>
      <div className="text-center text-[11px] hk-faint -mt-1 mb-3">
        {together ? `Your party (${party})` : party ? `Party ${party} · nobody else here yet` : 'Three to a door. Bring friends, or go alone.'}
      </div>

      {/* WHERE */}
      <div className="hk-label text-[13px] hk-soft mb-1">Where</div>
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: berths }, (_, i) => {
          const here = destinations.filter(d => d.berth === i + 1)
          if (!here.length) return null
          return here.map(d => {
            const on = d.id === pick && !d.locked
            return (
              <button key={d.id} disabled={!!d.locked} onClick={() => setPick(d.id)} data-dest={d.id}
                      className="text-left rounded-[9px] px-3 py-2 transition-transform"
                      style={{
                        background: on ? H.paperHi : 'rgba(255,250,240,.55)',
                        boxShadow: on ? `inset 0 0 0 2px ${H.ember}, 0 3px 8px rgba(58,39,22,.2)` : 'inset 0 0 0 1px rgba(58,39,22,.18)',
                        opacity: d.locked ? 0.55 : 1, cursor: d.locked ? 'not-allowed' : 'pointer',
                      }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] hk-faint tabular-nums">Berth {d.berth}</span>
                  <span className="text-[14px] font-extrabold" style={hearthDisplay}>{d.name}</span>
                  <span className="text-[11px] hk-soft ml-auto">{d.world}</span>
                </div>
                {d.locked && <div className="text-[11px] hk-faint mt-0.5">{d.locked}</div>}
              </button>
            )
          })
        })}
        {(() => {
          const empty = Array.from({ length: berths }, (_, i) => i + 1).filter(n => !destinations.some(d => d.berth === n))
          if (!empty.length) return null
          const span = empty.length === 1 ? `Berth ${empty[0]}` : `Berths ${empty[0]}–${empty[empty.length - 1]}`
          return (
            <div className="rounded-[9px] px-3 py-1.5 text-[12px] italic hk-faint" style={{ border: '1.5px dashed rgba(58,39,22,.2)' }}>
              {span} · no world seated
            </div>
          )
        })()}
      </div>

      {/* HOW */}
      <div className="hk-label text-[13px] hk-soft mt-3 mb-1">How</div>
      {(() => {
        const canTogether = !!party && !!chosen?.coop
        const canOthers = !!chosen?.coop
        const rows: { id: GoMode; label: string; ok: boolean; note: string }[] = [
          { id: 'alone', label: 'Go alone', ok: true, note: '' },
          { id: 'together', label: 'Go together', ok: canTogether, note: !party ? 'start a party first (Invite friends)' : chosen && !chosen.coop ? `${chosen.name} is a solo fight for now` : `your party, into one Breach (${party})` },
          { id: 'others', label: 'Find others', ok: canOthers, note: canOthers ? 'queue with other keepers, up to three' : chosen ? `${chosen.name} is a solo fight for now` : '' },
        ]
        return (
          <div className="flex flex-col gap-1 text-[12px]" role="radiogroup">
            {rows.map(rw => (
              <label key={rw.id} className="flex items-center gap-2 select-none" style={{ opacity: rw.ok ? 1 : 0.55, cursor: rw.ok ? 'pointer' : 'not-allowed' }} data-mode={rw.id}>
                <input type="radio" name="go-mode" disabled={!rw.ok} checked={mode === rw.id} onChange={() => rw.ok && setMode(rw.id)} style={{ accentColor: H.ember, width: 15, height: 15 }} />
                <span className="font-bold text-[13px]">{rw.label}</span>
                {rw.note && <span className="hk-faint">{rw.note}</span>}
              </label>
            ))}
            <button className="hk-btn self-start px-3 py-1 text-[12px] mt-1" onClick={onInviteFriends}>👥 Invite friends</button>
          </div>
        )
      })()}

      {(() => {
        const ok = !!chosen && (mode === 'alone' || (mode === 'together' && !!party && !!chosen.coop) || (mode === 'others' && !!chosen.coop))
        const label = !chosen ? 'Nothing open to launch' : mode === 'together' ? `Launch together · ${chosen.name}` : mode === 'others' ? `Find others · ${chosen.name}` : `Launch · ${chosen.name}`
        return (
          <div className="flex justify-end mt-4">
            <HearthButton primary disabled={!ok} onClick={() => {
              if (!chosen || !ok) return
              if (mode === 'others') onFindOthers(chosen)
              else onLaunch(chosen, mode === 'together')
            }}>{label}</HearthButton>
          </div>
        )
      })()}
    </div>
  )
}
