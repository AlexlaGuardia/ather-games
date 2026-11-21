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
import { FRONT_SHOPS, BOUGHT_SHIPYARD_NAME } from './doors'
export { FRONT_SHOPS } from './doors'
import { KAEL_SHIPYARD, ownsShipyard } from './shipyards'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../../ui/hearth'
import { hudSay } from '../shared/game-hud'
import type { Ledger } from '../trade'
import { FURNITURE, stockOf } from '../ather/furniture'
import { itemDef } from '../shared/inventory'
import { getInv, setInv, useInv } from '../shared/bag'
import { buyDecor } from './decor-shop'
import { buyBundle } from './smokehouse'
import { SMOKEHOUSE_STOCK } from '../ather/cooking'
import { useLoadout, setLoadout, getLoadout, claimKaelsArms, slotOfGun } from '../shared/loadout'
import { buyGun, GUN_PRICES, SHOP_GUNS } from './gun-shop'
import { yardRows, buyPart, slotName, YARD_SLOTS } from './courser-yard'
import { makeOfTown, modelsOfMake, buyCourser, DARTER_MODEL } from './courser-lot'
import { useFleet, getFleet, setFleet } from '../shared/fleet'

/** a ticket to the Starforge (an emergency-fund sized price, Alex 11-16). TODO(world): move onto economy/prices.ts LADDER */
export const STARFORGE_TICKET = 250

export function ShopPanel({ id, ledger, setLedger, onClose, isTouch }: {
  id: string; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; isTouch: boolean
}) {
  const town = id.split(':')[1] ?? ''
  id = id.split(':')[0]   // a door in every town carries its town after the id (front:smokehouse:<town>, doors.ts)
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
  if (shop.kind === 'smokehouse') return <SmokehousePanel ledger={ledger} setLedger={setLedger} onClose={onClose} />
  if (shop.kind === 'gunshop') return <GunShopPanel ledger={ledger} setLedger={setLedger} onClose={onClose} />
  if (shop.kind === 'courseryard') return <CourserYardPanel ledger={ledger} setLedger={setLedger} onClose={onClose} />
  if (shop.kind === 'courserlot') return <CourserLotPanel town={town} ledger={ledger} setLedger={setLedger} onClose={onClose} />
  if (shop.kind === 'shipyard' && town) return <BoughtShipyardPanel town={town} ledger={ledger} onClose={onClose} />   // M49 s3: front:shipyard:<town>
  if (shop.kind === 'shipyard') return <ShipyardPanel onClose={onClose} />
  if (stockOf(id).length) return <DecorShop id={id} ledger={ledger} setLedger={setLedger} onClose={onClose} />
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

/** A storefront that stocks DECOR (ather/furniture.ts › sold): unique pieces for the plot, bought for Marks into the bag.
 *  Rune Hold's Smithy (ironwork) and the Citadel's Grand Exchange (stone + mana-cell pieces). */
function DecorShop({ id, ledger, setLedger, onClose }: { id: string; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void }) {
  const shop = FRONT_SHOPS[id], inv = useInv()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <HearthFrame title={shop.name} maxWidth={500} onClose={onClose} fixed dataPanel="shop-panel">
      <div className="px-4 pt-5 pb-4 text-[14px] leading-snug" style={{ color: H.ink }} data-shop={id} data-decor>
        {shop.line && <p style={{ ...hearthDisplay, color: H.inkSoft }}>{shop.line}</p>}
        <p className="mt-1 text-[12.5px]" style={{ color: H.inkSoft }}>Pieces for your plot. Set them from the planning table at home.</p>
        <div className="mt-3 grid gap-2">
          {stockOf(id).map(pid => {
            const f = FURNITURE[pid], price = f.sold!.price, d = itemDef(pid), have = inv.slots.reduce((a, x) => a + (x?.id === pid ? x.n : 0), 0)
            return (
              <div key={pid} data-decor-item={pid} className="flex items-center gap-3 rounded-[12px] px-3 py-2" style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
                {d.icon ? <img src={d.icon} alt="" width={36} height={36} /> : null}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{f.name}{have ? <span style={{ color: H.inkSoft }}> · {have} in the bag</span> : null}</div>
                  <div className="text-[12.5px]" style={{ color: H.inkSoft }}>{f.blurb}</div>
                </div>
                <HearthButton small primary disabled={ledger.marks < price} onClick={() => {
                  const r = buyDecor(ledger, getInv(), pid, id)
                  if (r.ok) { setLedger(r.ledger); setInv(r.inv); setMsg(`${f.name} · in your bag.`); hudSay(`${f.name} · in your bag.`, 'item') } else setMsg(r.why)
                }}>{price.toLocaleString()} Marks</HearthButton>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center text-[12.5px]" style={{ color: H.inkSoft }}>
          <span className="flex-1" data-shop-msg>{msg ?? ''}</span>
          <span className="tabular-nums">Purse · {ledger.marks.toLocaleString()} Marks</span>
        </div>
      </div>
    </HearthFrame>
  )
}

/** THE SMOKEHOUSE (RULED 11-17, world/cuisine.md): farmed meat by the bundle, for roasting at the keeper's Ather hearth (the
 *  cooking room). Stock + prices: ather/cooking.ts › SMOKEHOUSE_STOCK. */
function SmokehousePanel({ ledger, setLedger, onClose }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void }) {
  const shop = FRONT_SHOPS.smokehouse, inv = useInv()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <HearthFrame title={shop.name} maxWidth={500} onClose={onClose} fixed dataPanel="shop-panel">
      <div className="px-4 pt-5 pb-4 text-[14px] leading-snug" style={{ color: H.ink }} data-shop="smokehouse">
        {shop.line && <p style={{ ...hearthDisplay, color: H.inkSoft }}>{shop.line}</p>}
        <p className="mt-1 text-[12.5px]" style={{ color: H.inkSoft }}>Take it home through the gate and roast it at the hearth in your cooking room.</p>
        <div className="mt-3 grid gap-2">
          {SMOKEHOUSE_STOCK.map(b => {
            const d = itemDef(b.id), have = inv.slots.reduce((a, x) => a + (x?.id === b.id ? x.n : 0), 0)
            return (
              <div key={b.id} data-bundle={b.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2" style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
                {d.icon ? <img src={d.icon} alt="" width={36} height={36} /> : null}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{d.name} × {b.n}{have ? <span style={{ color: H.inkSoft }}> · {have} in the bag</span> : null}</div>
                  <div className="text-[12.5px]" style={{ color: H.inkSoft }}>{d.blurb}</div>
                </div>
                <HearthButton small primary disabled={ledger.marks < b.price} onClick={() => {
                  const r = buyBundle(ledger, getInv(), b.id)
                  if (r.ok) { setLedger(r.ledger); setInv(r.inv); setMsg(`${d.name} × ${b.n} · in your bag.`); hudSay(`${d.name} × ${b.n} · in your bag.`, 'item') } else setMsg(r.why)
                }}>{b.price.toLocaleString()} Marks</HearthButton>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center text-[12.5px]" style={{ color: H.inkSoft }}>
          <span className="flex-1" data-shop-msg>{msg ?? ''}</span>
          <span className="tabular-nums">Purse · {ledger.marks.toLocaleString()} Marks</span>
        </div>
      </div>
    </HearthFrame>
  )
}

/** THE SHIPYARD (hub, Alex 11-18): Kael's chest hands over the keeper's first weapons, once: the Charred Rifle (primary) and
 *  the Repeater (secondary). Copy = @lark draft 11-18, awaiting Alex sign-off; the broken ship and the ledger are canon, not built. */
function ShipyardPanel({ onClose }: { onClose: () => void }) {
  const l = useLoadout()
  const open = () => {
    const r = claimKaelsArms(getLoadout()); if (!r.ok) return
    setLoadout(r.loadout)
    hudSay('The Charred Rifle and the Repeater are yours. R draws them. The Character tab sets which is which.', 'item', 6)
  }
  return (
    <HearthFrame title="The Shipyard" maxWidth={460} onClose={onClose} fixed dataPanel="shipyard">
      <div className="px-4 pt-3 pb-4 text-[14px] leading-snug" style={{ color: H.ink }}>
        <p style={{ ...hearthDisplay, color: H.inkSoft }}>Kael&apos;s yard. A broken ship sits in the slip.</p>
        {!l.kael ? (
          <>
            <p className="mt-3">A chest by the slip, your name on the lid. Kael&apos;s rifle and a handgun inside.</p>
            <div className="flex justify-end mt-4"><HearthButton primary onClick={open}>Open the chest</HearthButton></div>
          </>
        ) : (
          <p className="mt-3" data-chest="empty">Empty now. You have what Kael left.</p>
        )}
      </div>
    </HearthFrame>
  )
}

/** A SHIPYARD A KEEPER CAN BUY (M49 s3, business/shipyards.ts): not Kael's. Plain copy, no keeper, no line (lark/Magii later).
 *  Held: its yard beside it is the keeper's to furnish. Not held: not theirs (the buy lands in s3b). */
function BoughtShipyardPanel({ town, ledger, onClose }: { town: string; ledger: Ledger; onClose: () => void }) {
  const key = `${KAEL_SHIPYARD}:${town}`, own = ownsShipyard(ledger.shipyards, key)
  return (
    <HearthFrame title={BOUGHT_SHIPYARD_NAME} maxWidth={420} onClose={onClose} fixed dataPanel="bought-shipyard">
      <div className="px-4 pt-3 pb-4 text-[14px] leading-snug" style={{ color: H.ink }} data-owned={own ? 'yes' : 'no'}>
        {own ? <p>Yours. The yard beside it is yours to furnish: hold a piece and press E inside the fence.</p>
          : <p>Not yours. The yard beside it stays shut.</p>}
      </div>
    </HearthFrame>
  )
}

/** THE GUN SHOP (RULED 11-15, world/rune-hold.md): the five base guns at a counter, bought with Marks. No name, no keeper, no
 *  lore line: plain copy. Pure rule: business/gun-shop.ts. */
function GunShopPanel({ ledger, setLedger, onClose }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void }) {
  const l = useLoadout()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <HearthFrame title={FRONT_SHOPS.gunshop.name} maxWidth={500} onClose={onClose} fixed dataPanel="gun-shop">
      <div className="px-4 pt-5 pb-4 text-[14px] leading-snug" style={{ color: H.ink }}>
        <div className="grid gap-2">
          {SHOP_GUNS.map(g => {
            const price = GUN_PRICES[g.id], owned = l.guns.includes(g.id), short = !owned && ledger.marks < price
            return (
              <div key={g.id} data-gun={g.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2" style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
                <img src={`/open/icons/gun-${g.id}.svg`} alt="" width={36} height={36} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{g.name[0] + g.name.slice(1).toLowerCase()}</div>
                  <div className="text-[12.5px]" style={{ color: H.inkSoft }}>{slotOfGun(g) === 'secondary' ? 'Secondary' : 'Primary'} · {price.toLocaleString()} Marks</div>
                </div>
                <span data-buy={g.id} style={{ display: 'contents' }}><HearthButton small primary disabled={owned || short} onClick={() => {
                  const r = buyGun(getLoadout(), ledger, g.id)
                  if (r.ok) { setLedger(r.ledger); setLoadout(r.loadout); const t = `${g.name[0] + g.name.slice(1).toLowerCase()} bought · it is in your Character tab`; setMsg(t); hudSay(t, 'item') } else setMsg(r.why ?? null)
                }}>{owned ? 'Yours' : short ? 'Not enough Marks' : 'Buy'}</HearthButton></span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center text-[12.5px]" style={{ color: H.inkSoft }}>
          <span className="flex-1" data-shop-msg>{msg ?? ''}</span>
          <span className="tabular-nums">Purse · {ledger.marks.toLocaleString()} Marks</span>
        </div>
      </div>
    </HearthFrame>
  )
}

/** THE COURSER YARD (BETA M14, Magii RULED 11-18): the courser trade's town shop. The garage's three part ladders, at the garage's
 *  prices and deed gates (business/courser-yard.ts); a bought part fits from the garage (G while driving). No name, no keeper:
 *  plain copy. Whole coursers wait on Alex. */
function CourserYardPanel({ ledger, setLedger, onClose }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void }) {
  const [msg, setMsg] = useState<string | null>(null)
  const rows = yardRows(ledger)
  return (
    <HearthFrame title={FRONT_SHOPS.courseryard.name} maxWidth={560} onClose={onClose} fixed dataPanel="courser-yard">
      <div className="px-4 pt-5 pb-4 text-[14px] leading-snug" style={{ color: H.ink }}>
        <div className="grid gap-3">
          {YARD_SLOTS.map(slot => (
            <div key={slot} data-slot={slot}>
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: H.inkSoft }}>{slotName(slot)}</div>
              <div className="grid grid-cols-3 gap-2">
                {rows.filter(r => r.slot === slot).map(r => (
                  <div key={r.tier} data-part={`${slot}-${r.tier}`} data-state={r.state} className="rounded-[12px] px-2.5 py-2 flex flex-col gap-1"
                    style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}`, opacity: r.state === 'later' ? 0.6 : 1 }}>
                    <div className="text-[14px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{r.name}</div>
                    <div className="text-[12px] tabular-nums" style={{ color: H.inkSoft }}>{r.price.toLocaleString()} Marks{r.deeds ? ` · ${r.deeds} deeds` : ''}</div>
                    <HearthButton small primary disabled={r.state !== 'buy'} onClick={() => {
                      const b = buyPart(ledger, r.slot, r.tier)
                      if (b.ok) { setLedger(b.ledger); const t = `${r.name} bought · fit it in the garage (G while driving)`; setMsg(t); hudSay(t, 'item') } else setMsg(b.why ?? null)
                    }}>{r.state === 'owned' ? 'Yours' : r.state === 'buy' ? 'Buy' : 'Not yet'}</HearthButton>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center text-[12.5px]" style={{ color: H.inkSoft }}>
          <span className="flex-1" data-shop-msg>{msg ?? rows.find(r => r.state === 'later' && r.tier === 1)?.why ?? ''}</span>
          <span className="tabular-nums">Purse · {ledger.marks.toLocaleString()} Marks · {ledger.deeds} deeds</span>
        </div>
      </div>
    </HearthFrame>
  )
}

/** THE COURSER LOT (BETA M14; makes + models RULED 11-18): one make's coursers, whole, for Marks. Each line reads against the
 *  starting Darter (top speed, 0-60, crates) so the feel shows before the drive. Bought = owned; picked in the garage (G). */
function CourserLotPanel({ town, ledger, setLedger, onClose }: { town: string; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void }) {
  const fleet = useFleet()
  const [msg, setMsg] = useState<string | null>(null)
  const make = makeOfTown(town)
  if (!make) return null
  const D = DARTER_MODEL
  return (
    <HearthFrame title={FRONT_SHOPS.courserlot.name} maxWidth={540} onClose={onClose} fixed dataPanel="courser-lot">
      <div className="px-4 pt-5 pb-4 text-[14px] leading-snug" style={{ color: H.ink }} data-make={make.id}>
        <div className="text-[13px] mb-2" style={{ ...hearthDisplay, color: H.inkSoft }}><b style={{ color: H.ink }}>{make.name}</b> · {make.feel}</div>
        <div className="grid gap-2">
          {modelsOfMake(make.id).map(m => {
            const owned = fleet.owned.includes(m.id), short = !owned && ledger.marks < m.price
            return (
              <div key={m.id} data-model={m.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2" style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
                <span className="w-9 h-6 rounded-[6px] shrink-0" style={{ background: m.look.body, boxShadow: `inset 0 -6px 0 ${m.look.cabin}` }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{m.name} <span className="text-[12px] font-normal" style={{ color: H.inkSoft }}>· a {m.kind}</span></div>
                  <div className="text-[12px]" style={{ color: H.inkSoft }}>{m.feel}</div>
                  <div className="text-[12px] tabular-nums" style={{ color: H.inkSoft }}>{m.spec.topMph} mph ({m.spec.topMph - D.spec.topMph >= 0 ? '+' : ''}{m.spec.topMph - D.spec.topMph}) · 0-60 {m.spec.zeroTo60}s · {m.crates} crates · {m.price.toLocaleString()} Marks</div>
                </div>
                <span data-buy={m.id} style={{ display: 'contents' }}><HearthButton small primary disabled={owned || short} onClick={() => {
                  const r = buyCourser(getFleet(), ledger, m.id)
                  if (r.ok) { setLedger(r.ledger); setFleet(r.fleet); const t = `${m.name} is yours · pick it in the garage (G while driving)`; setMsg(t); hudSay(t, 'item') } else setMsg(r.why ?? null)
                }}>{owned ? 'Yours' : short ? 'Not enough Marks' : 'Buy'}</HearthButton></span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center text-[12.5px]" style={{ color: H.inkSoft }}>
          <span className="flex-1" data-shop-msg>{msg ?? ''}</span>
          <span className="tabular-nums">Purse · {Math.floor(ledger.marks).toLocaleString()} Marks</span>
        </div>
      </div>
    </HearthFrame>
  )
}
