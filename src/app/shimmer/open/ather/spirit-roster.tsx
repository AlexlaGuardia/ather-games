'use client'
// M109 s3 (sprites, 2026-11-23, owner + ?spirits=3d only): THE GRIMOIRE'S ROSTER FACE. Sees every bloomed spirit (every
// bloomed planter in the book), and per spirit: ask along / let roam (the PARTY, up to 8, spirit-party.ts) and call (she
// comes to the keeper on her own legs). Manages, never stores (glossary > Grimoire; Magii RULED 9b4dfe8): no verb here holds
// a spirit anywhere. Words on this face are functional UI labels, SIGNED in lark batch 11-23b §A (athernyx 2ac7da7).
import { useSyncExternalStore } from 'react'
import { HearthButton, H } from '../../ui/hearth'
import { SPECIES_NAMES } from '../../spirits/spirit'
import { hudSay } from '../shared/hud-say'
import { speciesOf } from './spirit-seeds'
import { useBook } from './spirit-panels'
import { useSpirits3d } from './spirit-model'
import { PARTY_MAX, askAlong, letRoam, partyIds, spiritCall, subscribeParty } from './spirit-party'
import { followIds, liveSpirits, subscribeFollow } from './spirit-follow'
import { PARTY_UI, PARTY_FULL_LINE, calledLine } from './party-spirit-lines'

/** the signed words (batch 11-23b §A) live in party-spirit-lines.ts; re-exported for spirit-talk's E-on-her ask */
export { PARTY_FULL_LINE }
const L = PARTY_UI

const EMPTY: readonly string[] = []
export function SpiritRoster({ onClose }: { onClose: () => void }) {
  const on = useSpirits3d()
  const book = useBook()
  const party = useSyncExternalStore(subscribeParty, partyIds, () => EMPTY)
  const follow = useSyncExternalStore(subscribeFollow, followIds, () => EMPTY)
  if (!on) return null
  const all = Object.entries(book.pots).filter(([, p]) => p.bloomed).sort((a, b) => a[1].at - b[1].at || (a[0] < b[0] ? -1 : 1))
  const live = new Set(liveSpirits().map(s => s.id))
  return (
    <div data-roster style={{ display: 'grid', gap: 6, borderTop: `1px solid ${H.inkSoft}33`, paddingTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 700 }}>{L.party}</span>
        <span data-party-count={party.length} style={{ fontSize: 13, color: H.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{party.length} / {PARTY_MAX}</span>
      </div>
      {!all.length && <div style={{ fontSize: 13, fontStyle: 'italic', color: H.inkFaint }}>{L.none}</div>}
      <div style={{ display: 'grid', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
        {all.map(([id, pot]) => {
          const sp = speciesOf(pot.seed), name = sp ? SPECIES_NAMES[sp] : '?', inP = party.includes(id), withYou = follow.includes(id)
          return (
            <div key={id} data-roster-spirit={id} data-species={sp ?? ''} data-in-party={inP ? '1' : '0'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 8, background: 'rgba(255,250,240,.6)', boxShadow: 'inset 0 0 0 1px rgba(58,39,22,.14)', fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: H.ink }}>{name}</span>
              <span style={{ fontSize: 11, color: H.inkFaint }}>{withYou ? L.withYou : inP ? L.inParty : L.roaming}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <span data-act={inP ? 'roam' : 'ask'}><HearthButton small onClick={() => { if (inP) letRoam(id); else if (!askAlong(id)) hudSay(PARTY_FULL_LINE, 'info', 4) }}>{inP ? L.roam : L.ask}</HearthButton></span>
                <span data-act="call"><HearthButton small disabled={!live.has(id)} onClick={() => { if (!live.has(id)) return; spiritCall.add(id); hudSay(calledLine(name), 'info', 3); onClose() }}>{L.call}</HearthButton></span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
