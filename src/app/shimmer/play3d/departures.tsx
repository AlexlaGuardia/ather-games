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
//   · HOW — go alone (works today) · go together · find others. The last two stay LOCKED, said out loud, until the
//     co-op fight exists: a party sent into the Breach today would each fight a separate flood, and that is worse
//     than a closed option.
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
}

export const PARTY_SEATS = 3

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

export function DeparturesPanel({ you, party, members, destinations, berths, onLaunch, onInviteFriends }: {
  you: string
  party: string | null
  /** the other keepers in your party instance, by name */
  members: string[]
  destinations: Destination[]
  berths: number
  onLaunch: (d: Destination) => void
  onInviteFriends: () => void
}) {
  const open = destinations.filter(d => !d.locked)
  const [pick, setPick] = useState<string | null>(open[0]?.id ?? null)
  const [alone, setAlone] = useState(true)
  const chosen = destinations.find(d => d.id === pick && !d.locked) ?? null
  const seats = [you, ...members].slice(0, PARTY_SEATS)
  const together = !!party && members.length > 0
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
          if (!here.length) {
            return (
              <div key={i} className="rounded-[9px] px-3 py-2 text-[12px] italic hk-faint" style={{ border: '1.5px dashed rgba(58,39,22,.2)' }}>
                Berth {i + 1} · no world seated
              </div>
            )
          }
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
      </div>

      {/* HOW */}
      <div className="hk-label text-[13px] hk-soft mt-3 mb-1">How</div>
      <label className="flex items-center gap-2 text-[13px] font-bold cursor-pointer select-none">
        <input type="checkbox" checked={alone} onChange={(e) => setAlone(e.target.checked)} style={{ accentColor: H.ember, width: 16, height: 16 }} />
        Go alone
      </label>
      <div className="flex flex-col gap-1 mt-1.5 text-[12px]">
        <div className="flex items-center gap-2" style={{ opacity: 0.6 }}>
          <span aria-hidden>🔒</span><span className="font-bold">Go together</span>
          <span className="hk-faint">{together ? 'coming with the co-op update' : 'needs a party, and the co-op update'}</span>
        </div>
        <div className="flex items-center gap-2" style={{ opacity: 0.6 }}>
          <span aria-hidden>🔒</span><span className="font-bold">Find others</span>
          <span className="hk-faint">coming with the co-op update</span>
        </div>
        <button className="hk-btn self-start px-3 py-1 text-[12px] mt-0.5" onClick={onInviteFriends}>👥 Invite friends</button>
      </div>

      <div className="flex justify-end mt-4">
        <HearthButton primary disabled={!chosen || !alone} onClick={() => chosen && alone && onLaunch(chosen)}>
          {chosen ? `Launch · ${chosen.name}` : 'Nothing open to launch'}
        </HearthButton>
      </div>
      {!alone && <div className="text-[11px] hk-faint text-right mt-1">Going together opens with the co-op update. Tick “Go alone” to launch now.</div>}
    </div>
  )
}
