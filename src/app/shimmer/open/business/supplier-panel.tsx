'use client'
// ── BETA M205 s1 (+ M115): A SUPPLIER ZONE'S BUY PANEL (Nyx continent) ──
// E at a zone tagged Supplier with a kind (business/suppliers.ts; today the Ather Trading Co.) opens this: the kind's bulk lots, a
// ONE-TIME buy each (the season contract is a later slice). Title = the zone's OWN tag name (the builder's pick: the
// Trading Co.'s own name, ruled athernyx 35c83eb): no keeper speaks. Lines are plain placeholders for @lark, like the
// Smokehouse panel (shop-panel.tsx SmokehousePanel), whose layout this copies.
import { useState } from 'react'
import { HearthFrame, H, hearthDisplay, HearthButton } from '../../ui/hearth'
import { hudSay } from '../shared/game-hud'
import type { Ledger } from '../trade'
import { itemDef } from '../shared/inventory'
import { getInv, setInv, useInv } from '../shared/bag'
import { supplierKind, buyLot } from './suppliers'

export function SupplierPanel({ kind, name, ledger, setLedger, onClose }: {
  kind: string; name: string; ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void
}) {
  const k = supplierKind(kind), inv = useInv()
  const [msg, setMsg] = useState<string | null>(null)
  if (!k) return null
  return (
    <HearthFrame title={name} maxWidth={500} onClose={onClose} fixed dataPanel="supplier-panel">
      <div className="px-4 pt-5 pb-4 text-[14px] leading-snug" style={{ color: H.ink }} data-supplier={kind}>
        <p className="text-[12.5px]" style={{ color: H.inkSoft }}>Bought in bulk. It goes in your bag.</p>
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
                <span data-buy={l.id}>
                  <HearthButton small primary disabled={ledger.marks < l.price} onClick={() => {
                    const r = buyLot(ledger, getInv(), kind, l.id)
                    if (r.ok) { setLedger(r.ledger); setInv(r.inv); setMsg(`${d.name} × ${l.n} · in your bag.`); hudSay(`${d.name} × ${l.n} · in your bag.`, 'item') } else setMsg(r.why)
                  }}>{l.price.toLocaleString()} Marks</HearthButton>
                </span>
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
