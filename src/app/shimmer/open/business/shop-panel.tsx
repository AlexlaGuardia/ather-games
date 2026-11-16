'use client'
// THE SHOP DOORS' PANELS (play lane, 2026-11-16). Alex 11-16: no interiors for now; "interact with a door and it opens a
// panel for that shop". One panel per canon storefront on the continent (the town kit's `b.front` ids).
//
// ★ WHAT IS BEHIND EACH DOOR (Alex 11-16):
//   · Eyuun's Bookstore → the house of tales (the live /bookstore audiobook player, opened beside the game).
//   · The Travelers Station → a hero card for THE STARFORGE (a ticket in Marks, then /nolmir/starforge) with a
//     "coming soon" card either side.
//   · The Spirit Corner → a panel only, for now ("panel only", not a door to the plot: city-only travel stands).
//   · The Kindled Mug is a TAVERN (never a potion shop). It, the Forgelight Inn, the Smithy and the Grand Exchange show
//     their name and "closed for now" until each gets stock. Keepers, their names and every line are Magii's / @lark's.
// ★ Copy stays plain and neutral: no keeper speaks here until lark writes them.
import { useEffect, useState } from 'react'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../../ui/hearth'
import { hudSay } from '../shared/game-hud'
import type { Ledger } from '../trade'

export type ShopKind = 'tavern' | 'inn' | 'smithy' | 'cafe' | 'books' | 'station' | 'exchange' | 'temple'
export const FRONT_SHOPS: Record<string, { name: string; kind: ShopKind; line?: string }> = {
  'kindled-mug': { name: 'The Kindled Mug', kind: 'tavern', line: 'A tavern on the square.' },
  'forgelight-inn': { name: 'The Forgelight Inn', kind: 'inn', line: 'Iron fixtures and forge-warmed walls.' },
  smithy: { name: 'The Smithy', kind: 'smithy', line: 'Steam and the smell of hot metal.' },
  'spirit-corner': { name: 'The Spirit Corner', kind: 'cafe' },
  bookstore: { name: "Eyuun's Bookstore", kind: 'books', line: "The house of tales. The world's stories, read and heard." },
  station: { name: 'Travelers Station', kind: 'station' },
  'enchant-temple': { name: 'Enchant Temple', kind: 'temple', line: 'Permanent imbuing, by twin hands.' },
  'grand-exchange': { name: 'The Grand Exchange', kind: 'exchange', line: 'The trade at the centre of the capital.' },
}
/** a ticket to the Starforge (an emergency-fund sized price, Alex 11-16). TODO(world): move onto economy/prices.ts LADDER */
export const STARFORGE_TICKET = 250

export function ShopPanel({ id, ledger, setLedger, onClose, isTouch }: {
  id: string; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; isTouch: boolean
}) {
  const shop = FRONT_SHOPS[id]
  if (!shop) return null
  if (shop.kind === 'station') return <StationPanel ledger={ledger} setLedger={setLedger} onClose={onClose} isTouch={isTouch} />
  if (shop.kind === 'temple') return (
    // ★ THE TWINS (Magii + Alex 11-16, world/schools.md): Idony inscribes vessels, her twin (unnamed) works weapons and
    // sigils. Idony's counter opens once letters exist (runesmiths, one per school, 3932d39); lines are @lark's.
    <HearthFrame title={shop.name} maxWidth={520} onClose={onClose} fixed dataPanel="shop-panel">
      <div className="px-4 pt-4 pb-4 text-[14px] leading-snug" style={{ color: H.ink }} data-shop={id} data-closed>
        <p style={{ ...hearthDisplay, color: H.inkSoft }}>{shop.line}</p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          {[['Idony', 'Vessels inscribed'], ['Her twin', 'Weapons and sigils']].map(([who, what]) => (
            <div key={who} className="rounded-[12px] px-3 py-3" data-counter={who} style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
              <div className="text-[16px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{who}</div>
              <div className="text-[12px]" style={{ color: H.inkSoft }}>{what}</div>
              <div className="text-[12px] mt-2 font-semibold" style={hearthDisplay}>Closed for now.</div>
            </div>
          ))}
        </div>
      </div>
    </HearthFrame>
  )
  if (shop.kind === 'books') return (
    <HearthFrame title={shop.name} maxWidth={420} onClose={onClose} fixed dataPanel="shop-panel">
      <div className="px-4 pt-4 pb-4 text-[14px] leading-snug" style={{ color: H.ink }} data-shop={id}>
        <p style={{ ...hearthDisplay, color: H.inkSoft }}>{shop.line}</p>
        <div className="flex justify-end mt-4">
          <HearthButton small primary onClick={() => { window.open('/bookstore?from=continent', '_blank', 'noopener'); onClose() }}>Go in</HearthButton>
        </div>
      </div>
    </HearthFrame>
  )
  return (
    <HearthFrame title={shop.name} maxWidth={380} onClose={onClose} fixed dataPanel="shop-panel">
      <div className="px-4 pt-4 pb-5 text-[14px] leading-snug" style={{ color: H.ink }} data-shop={id} data-closed>
        {shop.line && <p style={{ ...hearthDisplay, color: H.inkSoft }}>{shop.line}</p>}
        <p className="mt-2 font-semibold" style={hearthDisplay}>Closed for now.</p>
      </div>
    </HearthFrame>
  )
}

/** the Station: the Starforge in the middle, a card either side for the lines still to come */
function StationPanel({ ledger, setLedger, onClose, isTouch }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; isTouch: boolean }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [going, setGoing] = useState(false)
  // ★ Nolmir is SHELVED (games.ts tier back-room, Alex 08-06): the proxy 307s the public to /room, so a ticket would take
  //   their Marks and land them nowhere. Ask the route first; only a line that answers sells tickets (the owner's does).
  const [running, setRunning] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    fetch('/nolmir/starforge', { redirect: 'manual', cache: 'no-store' }).then(r => { if (live) setRunning(r.type !== 'opaqueredirect' && r.ok) }).catch(() => { if (live) setRunning(false) })
    return () => { live = false }
  }, [])
  const dear = ledger.marks < STARFORGE_TICKET
  const board = () => {
    if (!running) return
    if (dear) { setMsg(`A ticket is ${STARFORGE_TICKET} Marks. You have ${Math.floor(ledger.marks)}.`); return }
    setLedger({ ...ledger, marks: ledger.marks - STARFORGE_TICKET })
    hudSay(`Ticket to the Starforge · −${STARFORGE_TICKET} Marks`, 'item')
    setGoing(true)
    setTimeout(() => { window.location.href = '/nolmir/starforge?from=continent' }, 700)
  }
  const Soon = () => (
    <div className="rounded-[14px] grid place-items-center text-center px-3" data-soon
      style={{ minHeight: isTouch ? 72 : 260, background: 'rgba(60,40,24,.10)', boxShadow: `inset 0 0 0 1.5px ${H.rule}` }}>
      <span className="text-[13px] uppercase tracking-[0.18em] font-semibold" style={{ ...hearthDisplay, color: H.inkSoft }}>Coming soon</span>
    </div>
  )
  return (
    <HearthFrame title="Travelers Station" maxWidth={780} onClose={onClose} fixed dataPanel="shop-panel"
      footer={<span className="text-[12px]" style={hearthDisplay}>{Math.floor(ledger.marks).toLocaleString()} Marks</span>}>
      <div className={`px-4 pt-4 pb-4 grid gap-3 ${isTouch ? 'grid-cols-1' : 'grid-cols-[1fr_2.2fr_1fr]'}`} data-shop="station">
        {!isTouch && <Soon />}
        <div className="relative rounded-[14px] overflow-hidden flex flex-col justify-end" data-hero="starforge"
          style={{ minHeight: 260, background: '#05060a url(/nolmir/card.webp) center / cover no-repeat', boxShadow: '0 6px 18px rgba(0,0,0,.35)', opacity: going ? 0.6 : 1, transition: 'opacity .5s' }}>
          <div className="p-4" style={{ background: 'linear-gradient(180deg, rgba(5,6,10,0) 0%, rgba(5,6,10,.85) 70%)' }}>
            <div className="text-[24px] font-semibold" style={{ ...hearthDisplay, color: '#f4e6c8' }}>The Starforge</div>
            {running === false && <div className="text-[13px] mt-1" style={{ color: '#d9c9a8' }} data-starforge-closed>The line isn't running yet.</div>}
            {msg && <div className="text-[13px] mt-1 font-semibold" style={{ color: '#ff9b84' }} data-shop-msg>{msg}</div>}
            <div className="flex justify-end mt-2">
              <HearthButton small primary disabled={going || !running} onClick={board}>{going ? 'Boarding…' : `Ticket · ${STARFORGE_TICKET} M`}</HearthButton>
            </div>
          </div>
        </div>
        {isTouch ? <div className="grid grid-cols-2 gap-3"><Soon /><Soon /></div> : <Soon />}
      </div>
    </HearthFrame>
  )
}
