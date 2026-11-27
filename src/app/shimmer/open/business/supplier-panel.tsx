'use client'
// ── BETA M205 s1 (+ M115): A SUPPLIER ZONE'S BUY PANEL (Nyx continent) ──
// E at a zone tagged Supplier with a kind (business/suppliers.ts; today the Ather Trading Co.) opens this: the kind's bulk lots, a
// ONE-TIME buy each, and (M115 s2) a SEASON CONTRACT per material (business/contracts.ts): paid once, a lot a week lands in the
// garden bank for 90 days, 20% off bulk here while it runs. Title = the zone's OWN tag name (the builder's pick: the
// Trading Co.'s own name, ruled athernyx 35c83eb): no keeper speaks. Lines are plain placeholders for @lark, like the
// Smokehouse panel (shop-panel.tsx SmokehousePanel), whose layout this copies.
import { useState } from 'react'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../../ui/hearth'
import { hudSay } from '../shared/game-hud'
import type { Ledger } from '../trade'
import { itemDef } from '../shared/inventory'
import { getInv, setInv, useInv } from '../shared/bag'
import { supplierKind, buyLot } from './suppliers'
import { DELIVERIES, contractPrice, contractView, openContract, bulkPrice, signContract, loadContracts, saveContracts, seasonOn, DAY_MS, type ContractBook } from './contracts'

/** "in 3 days" / "tomorrow" / "today" (plain UI label) */
const inDays = (ms: number, now: number) => { const d = Math.ceil((ms - now) / DAY_MS); return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days` }

export function SupplierPanel({ kind, name, ledger, setLedger, onClose }: {
  kind: string; name: string; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void
}) {
  const k = supplierKind(kind), inv = useInv()
  const [msg, setMsg] = useState<string | null>(null)
  const [book, setBook] = useState<ContractBook>(() => loadContracts())
  const [ask, setAsk] = useState<string | null>(null)   // the lot whose contract waits on a second tap
  const now = Date.now()
  if (!k) return null
  const perk = book.list.some(c => c.kind === kind && seasonOn(c, now))
  return (
    <HearthFrame title={name} maxWidth={500} onClose={onClose} fixed dataPanel="supplier-panel">
      <div className="px-4 pt-5 pb-4 text-[14px] leading-snug" style={{ color: H.ink }} data-supplier={kind}>
        <p className="text-[12.5px]" style={{ color: H.inkSoft }}>Bought in bulk. It goes in your bag.{perk ? <span data-contract-perk> Contract running: 20% off bulk here.</span> : null}</p>
        <div className="mt-3 grid gap-2">
          {k.lots.map(l => {
            const d = itemDef(l.id), have = inv.slots.reduce((a, x) => a + (x?.id === l.id ? x.n : 0), 0)
            return (
              <div key={l.id} data-lot={l.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2" style={{ background: 'rgba(255,250,235,.45)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
                {d.icon ? <img src={d.icon} alt="" width={36} height={36} /> : null}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{d.name} × {l.n}{have ? <span style={{ color: H.inkSoft }}> · {have} in the bag</span> : null}</div>
                  <div className="text-[12.5px]" style={{ color: H.inkSoft }}>{d.blurb}</div>
                </div>
                <span data-buy={l.id} data-price={bulkPrice(l, book, kind, now)}>
                  <HearthButton small primary disabled={ledger.marks < bulkPrice(l, book, kind, now)} onClick={() => {
                    const r = buyLot(ledger, getInv(), kind, l.id, bulkPrice(l, loadContracts(), kind, Date.now()))
                    if (r.ok) { setLedger(r.ledger); setInv(r.inv); setMsg(`${d.name} × ${l.n} · in your bag.`); hudSay(`${d.name} × ${l.n} · in your bag.`, 'item') } else setMsg(r.why)
                  }}>{bulkPrice(l, book, kind, now).toLocaleString()} Marks</HearthButton>
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 text-[13px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>Season contract</div>
        <p className="text-[12.5px]" style={{ color: H.inkSoft }}>Paid once. A lot every week for 90 days, to your garden bank. 20% off bulk here while it runs.</p>
        <div className="mt-2 grid gap-1.5" data-contracts>
          {k.lots.map(l => {
            const d = itemDef(l.id), c = openContract(book, kind, l.id, now), price = contractPrice(l)
            if (c) {
              const v = contractView(c, now)
              return (
                <div key={l.id} data-contract={l.id} data-contract-left={v.left} className="rounded-[10px] px-3 py-1.5 text-[12.5px]" style={{ background: 'rgba(255,250,235,.3)', boxShadow: `inset 0 0 0 1px ${H.rule}`, color: H.ink }}>
                  <b>{d.name} × {c.n}</b> weekly · {v.left} {v.left === 1 ? 'delivery' : 'deliveries'} left{v.next ? ` · next ${inDays(v.next, now)}` : ''}{v.waiting ? ` · ${v.waiting} waiting for bank room` : ''}
                </div>
              )
            }
            return (
              <div key={l.id} data-contract-offer={l.id} className="flex items-center gap-2 text-[12.5px]" style={{ color: H.ink }}>
                <span className="min-w-0 flex-1">{d.name} × {l.n} weekly · {DELIVERIES} deliveries</span>
                {ask === l.id
                  ? <><span data-contract-confirm={l.id}><HearthButton small primary disabled={ledger.marks < price} onClick={() => {
                      const r = signContract(ledger, loadContracts(), kind, l.id, Date.now())
                      setAsk(null)
                      if (!r.ok) { setMsg(r.why); return }
                      setLedger(r.ledger); saveContracts(r.book); setBook(r.book)
                      const line = `Contract signed: ${d.name} × ${l.n} to your garden bank each week.`
                      setMsg(line); hudSay(line, 'item')
                    }}>Sign · {price.toLocaleString()}</HearthButton></span><HearthButton small onClick={() => setAsk(null)}>Cancel</HearthButton></>
                  : <span data-contract-buy={l.id}><HearthButton small disabled={ledger.marks < price} onClick={() => setAsk(l.id)}>{price.toLocaleString()} Marks</HearthButton></span>}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center text-[12.5px]" style={{ color: H.inkSoft }}>
          <span className="flex-1" data-supplier-msg>{msg ?? ''}</span>
          <span className="tabular-nums" data-purse={ledger.marks}>Purse · {ledger.marks.toLocaleString()} Marks</span>
        </div>
      </div>
    </HearthFrame>
  )
}
