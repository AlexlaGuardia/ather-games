'use client'
// ── BETA M188 s4: BREWINGS ON THE CHORDSTONE (its right card) + THE MAP DOOR to friends' gardens ────────────────────────────
// Alex 11-26: the HOST tab schedules a brewing ahead (a time, public or private, the potion, and which of its steps keepers
// may sign up for: the host has first pick, so a step left closed stays the host's); the FIND tab lists brewings (time, host,
// potion, seats free); opening one shows them, and taking a seat gives the keeper an RSVP, which disappears at the time.
// The map door (FriendDoor, under Moonwell Glade on the fold map): online friends to visit; holding an RSVP, the host's garden
// shows there with the potion's icon from 20 min before the start (brewing-rules.ts › doorOpen).
// Record: /api/brewing (lib/accounts/brewings.ts). Canon 62a71de: the word is 'a brewing' (never 'potion party' / 'swaray' /
// 'podium'); a brewing gives MORE, never ONLY. ⚠ Card words are neutral placeholders for @lark.
import { useState } from 'react'
import { H } from '../../ui/hearth'
import { ALC_POTIONS, ALC_STATIONS, INTERMEDIATES } from './alchemy-set'
import { BREW_LEADS, doorOpen, whenLabel } from '@/lib/accounts/brewing-rules'
import { useBrewings, type BrewingView } from '../shared/brewing-net'
import { requestVisit, useChordInvite, useSocialSignedIn } from '../shared/play-together'
import { useChordBox } from '../shared/chord'
import { useFriends } from '../../play3d/play-together'
import { useParty } from '@/lib/party'
import { hostOfZone } from './plot-visit'

const POTIONS = Object.keys(ALC_POTIONS)
const potionName = (id: string) => ALC_POTIONS[id]?.name ?? id
export const potionIcon = (id: string) => `/open/icons/potion-${id}.svg`
/** a step's label: the station and what it makes ("Crusher Table · Rinnscale Dust"; the last step makes the potion) */
export function stepLabel(potion: string, k: number): string {
  const s = ALC_POTIONS[potion]?.steps[k]
  if (!s) return `Step ${k + 1}`
  return `${ALC_STATIONS[s.at].name} · ${INTERMEDIATES[s.out] ?? potionName(potion)}`
}
const leadLabel = (ms: number) => { const m = ms / 60_000; return m < 60 ? `In ${m} minutes` : m < 24 * 60 ? `In ${m / 60} hour${m === 60 ? '' : 's'}` : 'This time tomorrow' }
const clock = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

const cardTitle = 'hk-title text-[16px] hk-ember'
const line = 'text-[12px] leading-snug hk-soft mt-1.5'
const row = 'flex items-center justify-between gap-2 text-[12px] font-bold mt-1.5 min-h-[26px]'
const smallBtn = 'hk-btn px-2 py-[3px] text-[11px]'
const boxed: React.CSSProperties = { boxShadow: `inset 0 0 0 1.5px ${H.rule}`, borderRadius: 10, padding: '8px 10px' }
const Icon = ({ id, size = 18 }: { id: string; size?: number }) => <img src={potionIcon(id)} alt="" width={size} height={size} style={{ imageRendering: 'pixelated', flex: 'none' }} data-potion-icon={id} />

function Detail({ b, now, act, onBack }: { b: BrewingView; now: number; act: (a: string, x?: Record<string, unknown>) => Promise<unknown>; onBack: () => void }) {
  const free = b.seats.filter(s => !s.user_id).length
  return (
    <div className="mt-2" style={boxed} data-brew-detail={b.brewing_id}>
      <div className="flex items-center gap-2"><Icon id={b.potion} size={22} /><span className="text-[14px] font-extrabold">{potionName(b.potion)}</span></div>
      <div className={line} data-brew-when>{clock(b.at)} · {whenLabel(b.at, now)}</div>
      <div className={line} data-brew-host>Host: <b>{b.host ?? 'a keeper'}</b>{b.public ? '' : ' · friends only'}</div>
      <div className={line} data-brew-free={free}>{free} of {b.seats.length} seats free</div>
      {b.seats.map(s => (
        <div key={s.step} className={row} data-brew-seat={s.step} data-seat-taken={s.user_id ? '1' : '0'}>
          <span>{stepLabel(b.potion, s.step)}</span>
          {s.user_id ? <span className="hk-faint">{s.name}{b.my_step === s.step ? ' · you' : ''}</span>
            : !b.mine && b.my_step === null ? <button className={`${smallBtn} hk-fill-moss`} data-brew-take={s.step} onClick={() => act('seat', { brewing_id: b.brewing_id, step: s.step })}>Take this seat</button>
              : <span className="hk-faint italic">free</span>}
        </div>
      ))}
      <div className="mt-2 text-right"><button className={smallBtn} onClick={onBack} data-brew-back>Back</button></div>
    </div>
  )
}

export function BrewingsCard({ signedIn }: { signedIn: boolean }) {
  const [tab, setTab] = useState<'find' | 'host'>('find')
  const br = useBrewings(signedIn)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [potion, setPotion] = useState(POTIONS[0])
  const [lead, setLead] = useState(BREW_LEADS[1])
  const [pub, setPub] = useState(true)
  const [steps, setSteps] = useState<number[]>([])
  const run = async (a: string, x?: Record<string, unknown>) => { const e = await br.act(a, x); setErr(e); return !e }
  const now = br.now
  const others = br.brewings.filter(b => !b.mine), mine = br.brewings.filter(b => b.mine)
  const sel = br.brewings.find(b => b.brewing_id === open) ?? null
  const nSteps = ALC_POTIONS[potion]?.steps.length ?? 0
  return (
    <div data-card="brewings" data-brew-mode={signedIn ? 'on' : 'signed-out'}>
      <div className={cardTitle}>Brewings</div>
      {!signedIn ? <div className={line} data-brew-signin>Sign in on the front page to host or join a brewing.</div> : (<>
        {br.rsvps.map(r => (
          <div key={r.brewing.brewing_id} className="mt-2 rounded-[10px] px-2.5 py-2" data-brew-rsvp={r.brewing.brewing_id} style={{ background: 'rgba(95,125,69,.14)', boxShadow: `inset 0 0 0 1.5px ${H.moss}` }}>
            <div className="text-[11px] font-extrabold uppercase tracking-[.1em]" style={{ color: H.moss }}>Your RSVP</div>
            <div className="flex items-center gap-1.5 text-[12px] font-bold mt-0.5"><Icon id={r.brewing.potion} />{potionName(r.brewing.potion)} with {r.brewing.host ?? 'a keeper'} · {clock(r.brewing.at)} ({whenLabel(r.brewing.at, now)})</div>
            <div className="text-[11px] hk-faint">Seat: {stepLabel(r.brewing.potion, r.step)}{doorOpen(r.brewing.at, now) ? ' · their garden is on your map' : ''}</div>
            <div className="mt-1 text-right"><button className={smallBtn} data-brew-unseat onClick={() => run('unseat', { brewing_id: r.brewing.brewing_id })}>Give up seat</button></div>
          </div>
        ))}
        <div className="flex gap-1.5 mt-2">
          {(['find', 'host'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setErr(null) }} data-brew-tab={t} className={`hk-btn px-3 py-1 text-[12px] ${tab === t ? 'hk-fill-moss' : ''}`}>{t === 'find' ? 'Find' : 'Host'}</button>
          ))}
        </div>
        {tab === 'find' ? (sel ? <Detail b={sel} now={now} act={run} onBack={() => setOpen(null)} /> : (
          <div className="mt-2" data-brew-list={others.length}>
            {others.length ? others.map(b => {
              const free = b.seats.filter(s => !s.user_id).length
              return (
                <button key={b.brewing_id} onClick={() => setOpen(b.brewing_id)} data-brew-row={b.brewing_id} className="w-full text-left mt-1.5 flex items-center gap-2 text-[12px] font-bold" style={{ ...boxed, padding: '6px 8px', background: 'rgba(255,250,235,.55)' }}>
                  <Icon id={b.potion} />
                  <span className="flex-1 min-w-0">{potionName(b.potion)} · {b.host ?? 'a keeper'}<br /><span className="hk-faint font-semibold">{clock(b.at)} ({whenLabel(b.at, now)}) · {free} seat{free === 1 ? '' : 's'} free{b.public ? '' : ' · friends only'}</span></span>
                </button>
              )
            }) : <div className="text-[12px] hk-faint italic font-semibold">{br.loaded ? 'No brewings posted yet.' : '…'}</div>}
          </div>
        )) : (
          <div className="mt-2" data-brew-host-form>
            <div style={boxed}>
              <label className="block text-[11px] font-extrabold uppercase tracking-[.1em] hk-faint">Potion</label>
              <select data-brew-potion value={potion} onChange={e => { setPotion(e.target.value); setSteps([]) }} className="w-full mt-0.5 rounded-[8px] px-2 py-1 text-[12px] font-bold" style={{ background: '#fffaf0', boxShadow: `inset 0 0 0 1.5px ${H.rule}`, color: H.ink }}>
                {POTIONS.map(p => <option key={p} value={p}>{potionName(p)}</option>)}
              </select>
              <label className="block mt-2 text-[11px] font-extrabold uppercase tracking-[.1em] hk-faint">When</label>
              <select data-brew-when-pick value={lead} onChange={e => setLead(Number(e.target.value))} className="w-full mt-0.5 rounded-[8px] px-2 py-1 text-[12px] font-bold" style={{ background: '#fffaf0', boxShadow: `inset 0 0 0 1.5px ${H.rule}`, color: H.ink }}>
                {BREW_LEADS.map(l => <option key={l} value={l}>{leadLabel(l)}</option>)}
              </select>
              <div className="flex gap-1.5 mt-2">
                <button data-brew-vis="public" className={`${smallBtn} ${pub ? 'hk-fill-moss' : ''}`} onClick={() => setPub(true)}>Public</button>
                <button data-brew-vis="private" className={`${smallBtn} ${!pub ? 'hk-fill-moss' : ''}`} onClick={() => setPub(false)}>Friends only</button>
              </div>
              <div className="mt-2 text-[11px] font-extrabold uppercase tracking-[.1em] hk-faint">Open seats</div>
              <div className="text-[11px] hk-faint">Pick the steps keepers may sign up for. The rest are yours.</div>
              {Array.from({ length: nSteps }, (_, k) => (
                <label key={k} className={row} style={{ cursor: 'pointer', justifyContent: 'flex-start' }}>
                  <input type="checkbox" data-brew-step={k} checked={steps.includes(k)} onChange={e => setSteps(s => e.target.checked ? [...s, k] : s.filter(x => x !== k))} />
                  <span>{stepLabel(potion, k)}</span>
                </label>
              ))}
              <div className="mt-2 text-right">
                <button data-brew-post className={`${smallBtn} hk-fill-moss`} disabled={!steps.length || br.busy === 'host'}
                  onClick={async () => { if (await run('host', { potion, at: Date.now() + lead, public: pub, seats: steps })) setSteps([]) }}>Post to the Chordstone</button>
              </div>
            </div>
            <div className="mt-2 text-[11px] font-extrabold uppercase tracking-[.1em] hk-faint">Your brewings</div>
            {mine.length ? mine.map(b => (
              <div key={b.brewing_id} className="mt-1.5" style={boxed} data-brew-mine={b.brewing_id}>
                <div className="flex items-center gap-1.5 text-[12px] font-bold"><Icon id={b.potion} />{potionName(b.potion)} · {clock(b.at)} ({whenLabel(b.at, now)}){b.public ? '' : ' · friends only'}</div>
                {b.seats.map(s => <div key={s.step} className="text-[11px] hk-faint" data-brew-mine-seat={s.step}>{stepLabel(b.potion, s.step)}: {s.name ?? 'free'}</div>)}
                <div className="mt-1 text-right"><button className={smallBtn} data-brew-cancel onClick={() => run('cancel', { brewing_id: b.brewing_id })}>Call it off</button></div>
              </div>
            )) : <div className="text-[12px] hk-faint italic font-semibold">None set.</div>}
          </div>
        )}
        {err && <div className="mt-1.5 text-[12px] font-bold" data-brew-err style={{ color: H.rust }}>{err}</div>}
      </>)}
    </div>
  )
}

/** THE MAP DOOR: a stop under Moonwell Glade that opens a list of online friends to visit; a host whose brewing you hold an
 *  RSVP for shows on top with the potion's icon inside the door window. Visit = ring into their chord, then walk to their plot. */
export function FriendDoor({ onGo }: { onGo: () => void }) {
  const [open, setOpen] = useState(false)
  const signedIn = useSocialSignedIn()
  const br = useBrewings(open && signedIn, 15000)
  const fr = useFriends(open, signedIn)
  const { members } = useChordBox()
  const { join } = useParty()
  const invite = useChordInvite()
  const [said, setSaid] = useState<Record<string, string>>({})
  const doors = br.rsvps.filter(r => r.door && doorOpen(r.brewing.at, br.now))
  const online = fr.friends.filter(f => f.status === 'accepted' && f.online && f.username)
  const visit = (look: string, name: string, code?: string) => { if (code) join(code); onGo(); requestVisit(look, name) }
  return (
    <div data-friend-door={open ? 'open' : 'shut'}>
      <button onClick={() => setOpen(o => !o)} data-act="friend-door" style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6,
        border: `1px solid ${H.rule}`, background: 'rgba(255,250,235,0.55)', color: H.ink, font: 'inherit', fontWeight: 600, cursor: 'pointer',
      }}>
        <span style={{ width: 9, height: 9, borderRadius: 9, background: '#c8a2e8', flex: 'none' }} />
        <span style={{ flex: 1 }}>Visit a friend<br /><span style={{ opacity: 0.55, fontSize: 11 }}>friends online</span></span>
        <span style={{ opacity: 0.6 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{ margin: '4px 0 2px 10px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }} data-friend-door-list>
          {!signedIn ? <div style={{ opacity: 0.6 }}>Sign in to see friends online.</div> : (<>
            {doors.map(r => (
              <div key={r.brewing.brewing_id} data-door-brew={r.brewing.brewing_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <Icon id={r.brewing.potion} />
                <span style={{ flex: 1 }}>{r.brewing.host ?? 'a keeper'}&apos;s garden<br /><span style={{ opacity: 0.6, fontWeight: 600, fontSize: 11 }}>{potionName(r.brewing.potion)} · {whenLabel(r.brewing.at, br.now)}</span></span>
                <button className={smallBtn} data-door-visit={r.brewing.brewing_id} onClick={() => visit(r.door!.look, r.brewing.host ?? '', r.door!.code)}>Visit</button>
              </div>
            ))}
            {online.map(f => {
              const m = members.find(x => x.id === f.user_id), plot = m ? hostOfZone(m.zone) : null
              return (
                <div key={f.user_id} data-door-friend={f.username} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <span style={{ flex: 1 }}>{f.username}</span>
                  {plot ? <button className={smallBtn} data-door-friend-visit={f.username} onClick={() => visit(plot, f.username!)}>Visit</button>
                    : said[f.user_id] ? <span style={{ opacity: 0.6, fontSize: 11 }}>{said[f.user_id]}</span>
                      : invite ? <button className={smallBtn} data-door-friend-chord={f.username} onClick={async () => { const r = await invite(f.user_id); setSaid(x => ({ ...x, [f.user_id]: r })) }}>Chord</button> : null}
                </div>
              )
            })}
            {!doors.length && !online.length && <div style={{ opacity: 0.6 }} data-door-empty>{fr.loaded ? 'No friends online.' : '…'}</div>}
            {!!online.length && <div style={{ opacity: 0.55, fontSize: 11 }}>A friend in your chord can be visited on their plot. Chord asks one in.</div>}
          </>)}
        </div>
      )}
    </div>
  )
}
