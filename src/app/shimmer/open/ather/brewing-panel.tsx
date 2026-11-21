'use client'
// ── THE BREWING PANEL (BETA M57 slice 3b): E at an alchemy station while a brewing is open on this plot (host or guest). Lists the
// recipe's road, who has each step and how far along it is; the step THIS station does can be taken when it is open. The pour
// happens on its own at the host when the Desk's last step is done (party-brew-net.ts). Rules: party-brew.ts.
import { useEffect, useState } from 'react'
import { HearthFrame, HearthButton, H } from '../../ui/hearth'
import { ALC_STATIONS, ALC_POTIONS, INTERMEDIATES, type AlcStation } from './alchemy-set'
import { stepViews, MAX_HANDS, totalBottles } from './party-brew'
import { useBrewing, brewNow, brewSelf, claimStep, closePartyBrew, isPending } from './party-brew-net'
import { isVisiting, currentVisit } from './plot-visit'
import { openPeers } from '../shared/open-mp'

const peerName = (id: string) => openPeers().current?.get(id)?.name || 'a friend'

const secs = (ms: number) => `${Math.ceil(ms / 1000)}s`

export function BrewingPanel({ station, onClose, nameOf = peerName }: { station: AlcStation; onClose: () => void; nameOf?: (id: string) => string }) {
  const b = useBrewing(), guest = isVisiting(), me = brewSelf()
  const [now, setNow] = useState(brewNow)
  useEffect(() => { const t = setInterval(() => setNow(brewNow()), 250); return () => clearInterval(t) }, [])
  const who = (id?: string) => (!id ? '' : id === me ? 'you' : nameOf(id))
  const title = b ? `A brewing · ${ALC_POTIONS[b.potion].name}` : 'A brewing'
  return (
    <HearthFrame title={title} maxWidth={460} onClose={onClose} fixed dataPanel="brewing">
      <div data-brew-station={station} style={{ padding: '26px 16px 14px', display: 'grid', gap: 10 }}>
        {!b && <div data-brew-none style={{ fontSize: 13, color: H.inkSoft }}>{guest ? `No brewing is open. ${currentVisit()?.name ?? 'Your host'} opens one at their Alchemy Desk.` : 'No brewing is open. Open one at your Alchemy Desk.'}</div>}
        {b && (
          <>
            <div style={{ fontSize: 12.5, color: H.inkSoft }}>
              {b.hands.length} of {MAX_HANDS} hands · pours {totalBottles(ALC_POTIONS[b.potion].makes, b.hands.length)}+ bottles, one for every hand at least. Take a step at its station: what it takes comes out of your own bag.
            </div>
            <div data-brew-hands style={{ fontSize: 12, color: H.ink }}>Hands: {b.hands.map(h => (h === b.host ? `${who(h)} (host)` : who(h))).join(', ')}</div>
            {stepViews(b, now).map(v => {
              const st = ALC_POTIONS[b.potion].steps[v.k], last = v.k === ALC_POTIONS[b.potion].steps.length - 1, here = st.at === station
              const label = last ? ALC_POTIONS[b.potion].name : INTERMEDIATES[st.out]
              return (
                <div key={v.k} data-brew-step={v.k} data-brew-state={v.state} style={{ display: 'grid', gap: 4, padding: '8px 10px', borderRadius: 12, background: here ? 'rgba(201,168,255,.14)' : 'rgba(58,39,22,.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: H.ink }}>{label}</div>
                      <div style={{ fontSize: 11, color: H.inkSoft }}>at the {ALC_STATIONS[st.at].name}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: H.inkSoft, textAlign: 'right', flexShrink: 0, maxWidth: '45%' }}>
                      {v.state === 'done' && `done by ${who(v.by)}`}
                      {v.state === 'running' && `${who(v.by)} · ${secs(v.left!)}`}
                      {v.state === 'waiting' && 'after an earlier step'}
                      {v.state === 'open' && !here && 'open'}
                      {v.state === 'open' && here && !b.poured && (
                        <span data-act="brew-take"><HearthButton small primary disabled={isPending(v.k)} onClick={() => claimStep(v.k)}>{isPending(v.k) ? 'Asking…' : ALC_STATIONS[st.at].verb}</HearthButton></span>
                      )}
                    </span>
                  </div>
                  {v.state === 'running' && (
                    <div style={{ height: 8, borderRadius: 8, background: 'rgba(58,39,22,.12)', overflow: 'hidden' }}>
                      <div style={{ width: `${(v.frac ?? 0) * 100}%`, height: '100%', background: 'linear-gradient(180deg, #8fb8ff, #4a6fc8)' }} />
                    </div>
                  )}
                </div>
              )
            })}
            {b.poured && <div data-brew-poured style={{ fontSize: 13, fontWeight: 700, color: H.ink }}>Poured. Every hand has its bottles.</div>}
            {!guest && !b.poured && !Object.keys(b.runs).length && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span data-act="brew-close"><HearthButton small onClick={() => { closePartyBrew(); onClose() }}>Close the brewing</HearthButton></span></div>
            )}
          </>
        )}
      </div>
    </HearthFrame>
  )
}
