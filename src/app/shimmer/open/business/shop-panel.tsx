'use client'
// THE SHOP DOORS' PANELS (play lane, 2026-11-16). Alex 11-16: no interiors for now; "interact with a door and it opens a
// panel for that shop". One panel per canon storefront on the continent (the town kit's `b.front` ids).
//
// ★ WHAT IS BEHIND EACH DOOR (Alex 11-16):
//   · Eyuun's Bookstore → the house of tales (the live /bookstore audiobook player, opened beside the game).
//   · The Travelers Station → Alex's ship menu (11-17 sketch): THE STARFORGE (a ticket in Marks, then
//     /nolmir/starforge), the Season Crucible, and the Season Expedition over the Expedition.
//   · The Spirit Corner → a panel only, for now ("panel only", not a door to the plot: city-only travel stands).
//   · The Kindled Mug is a TAVERN (never a potion shop). It, the Forgelight Inn, the Smithy and the Grand Exchange show
//     their name and "closed for now" until each gets stock. Keepers, their names and every line are Magii's / @lark's.
// ★ Copy stays plain and neutral: no keeper speaks here until lark writes them.
import { useEffect, useState } from 'react'
import { IdonyPanel, RunesmithPanel } from './smith-panel'
import { FRONT_SHOPS } from './doors'
export { FRONT_SHOPS } from './doors'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../../ui/hearth'
import { hudSay } from '../shared/game-hud'
import type { Ledger } from '../trade'

/** a ticket to the Starforge (an emergency-fund sized price, Alex 11-16). TODO(world): move onto economy/prices.ts LADDER */
export const STARFORGE_TICKET = 250

export function ShopPanel({ id, ledger, setLedger, onClose, isTouch }: {
  id: string; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; isTouch: boolean
}) {
  const shop = FRONT_SHOPS[id]
  if (!shop) return null
  if (shop.kind === 'station') return <StationPanel ledger={ledger} setLedger={setLedger} onClose={onClose} isTouch={isTouch} />
  if (shop.kind === 'temple') return <TemplePanel ledger={ledger} setLedger={setLedger} onClose={onClose} />
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

/** the Station: Alex's ship menu, the Starforge first, then the lines still to come */
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
  // ★ ALEX'S SHIP MENU (sketch, 11-17): the Starforge on the left, the Season Crucible tall in the middle, and a
  // stacked pair on the right: the Season Expedition over the Expedition. Only the Starforge runs today.
  const Card = ({ title, soon, tall, id }: { title: string; soon?: boolean; tall?: boolean; id: string }) => (
    <div className="rounded-[14px] flex flex-col justify-between px-4 py-3" data-card={id} data-soon={soon ? '' : undefined}
      style={{ minHeight: isTouch ? 72 : tall ? 300 : 144, background: 'rgba(60,40,24,.10)', boxShadow: `inset 0 0 0 1.5px ${H.rule}` }}>
      <div className="text-[18px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{title}</div>
      <span className="text-[12px] uppercase tracking-[0.18em] font-semibold self-end" style={{ ...hearthDisplay, color: H.inkSoft }}>{soon ? 'Coming soon' : 'Not running yet'}</span>
    </div>
  )
  return (
    <HearthFrame title="Travelers Station" maxWidth={820} onClose={onClose} fixed dataPanel="shop-panel"
      footer={<span className="text-[12px]" style={hearthDisplay}>{Math.floor(ledger.marks).toLocaleString()} Marks</span>}>
      <div className={`px-4 pt-4 pb-4 grid gap-3 ${isTouch ? 'grid-cols-1' : 'grid-cols-[1.1fr_1.4fr_1fr] items-stretch'}`} data-shop="station">
        <div className="relative rounded-[14px] overflow-hidden flex flex-col justify-end" data-hero="starforge"
          style={{ minHeight: isTouch ? 220 : 300, background: '#05060a url(/nolmir/card.webp) center / cover no-repeat', boxShadow: '0 6px 18px rgba(0,0,0,.35)', opacity: going ? 0.6 : 1, transition: 'opacity .5s' }}>
          <div className="p-4" style={{ background: 'linear-gradient(180deg, rgba(5,6,10,0) 0%, rgba(5,6,10,.85) 70%)' }}>
            <div className="text-[24px] font-semibold" style={{ ...hearthDisplay, color: '#f4e6c8' }}>The Starforge</div>
            {running === false && <div className="text-[13px] mt-1" style={{ color: '#d9c9a8' }} data-starforge-closed>The line isn't running yet.</div>}
            {msg && <div className="text-[13px] mt-1 font-semibold" style={{ color: '#ff9b84' }} data-shop-msg>{msg}</div>}
            <div className="flex justify-end mt-2">
              <HearthButton small primary disabled={going || !running} onClick={board}>{going ? 'Boarding…' : `Ticket · ${STARFORGE_TICKET} M`}</HearthButton>
            </div>
          </div>
        </div>
        <Card id="season-crucible" title="Season Crucible" soon tall />
        <div className={`grid gap-3 ${isTouch ? 'grid-cols-2' : 'grid-rows-2'}`}>
          <Card id="season-expedition" title="Season Expedition" soon />
          <Card id="expedition" title="Expedition" />
        </div>
      </div>
    </HearthFrame>
  )
}

/** THE ENCHANT TEMPLE (the Citadel, Magii + Alex 11-16): Idony inscribes vessels, her twin works weapons and sigils,
 *  and the Enchant seat's runesmith cuts the Enchant and Manalic letters (world/schools.md › THE EIGHT RUNESMITH SEATS). */
function TemplePanel({ ledger, setLedger, onClose }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void }) {
  const [at, setAt] = useState<'hall' | 'idony' | 'smith'>('hall')
  if (at === 'idony') return <IdonyPanel ledger={ledger} setLedger={setLedger} onClose={onClose} onBack={() => setAt('hall')} />
  if (at === 'smith') return <RunesmithPanel seat="enchant" ledger={ledger} setLedger={setLedger} onClose={onClose} onBack={() => setAt('hall')} />
  const counters: { who: string; what: string; go?: () => void }[] = [
    { who: 'Idony', what: 'Vessels inscribed', go: () => setAt('idony') },
    { who: 'The runesmith', what: 'Enchant and Manalic letters', go: () => setAt('smith') },
    { who: 'Her twin', what: 'Weapons and sigils' },
  ]
  return (
    <HearthFrame title="Enchant Temple" maxWidth={600} onClose={onClose} fixed dataPanel="shop-panel">
      <div className="px-4 pt-4 pb-4 text-[14px] leading-snug" style={{ color: H.ink }} data-shop="enchant-temple">
        <p style={{ ...hearthDisplay, color: H.inkSoft }}>{FRONT_SHOPS['enchant-temple'].line}</p>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {counters.map(c => (
            <button key={c.who} type="button" disabled={!c.go} onClick={c.go} data-counter={c.who} className="rounded-[12px] px-3 py-3 text-left transition-all enabled:hover:-translate-y-px"
              style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${c.go ? H.ember : H.rule}`, opacity: c.go ? 1 : 0.6 }}>
              <div className="text-[16px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{c.who}</div>
              <div className="text-[12px]" style={{ color: H.inkSoft }}>{c.what}</div>
              {!c.go && <div className="text-[12px] mt-2 font-semibold" style={hearthDisplay} data-closed>Closed for now.</div>}
            </button>
          ))}
        </div>
      </div>
    </HearthFrame>
  )
}
