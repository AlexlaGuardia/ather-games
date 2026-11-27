'use client'
// ── THE EXCHANGE PANEL at Lingston's counter (BETA M228 s1). An attendant opens it: CURRENT OFFERS (the one shared book), SEARCH
// an item, YOUR ORDERS, and a form to place a buy or a sell order. Goods only (exchange-rules.ts). The book is the server's
// (/api/exchange); the goods / Marks an order holds come out of the keeper's own save when it is posted and go back when it is
// cancelled (s1 does not match orders: the fill rules are a design call reported to the hub). Labels: plain functional words,
// for @lark to rewrite.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { HearthFrame, H } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import { OPEN_ITEMS, ITEM_GROUP, itemDef, countOf, take, give } from '../shared/inventory'
import type { Ledger } from '../trade'
import { buyDecor } from '../business/decor-shop'
import { stockOf, FURNITURE } from './furniture'
import { checkOrder, feeOf, searchBook, sortBook, EXCHANGE_FEE, NOT_GOODS, type BookRow, type Side } from './exchange-rules'

/** every good a keeper can name at the counter (bag items of a skill group, never tools / guns / keepsakes) */
const GOODS_IDS = Object.keys(OPEN_ITEMS).filter(id => ITEM_GROUP[id] && !NOT_GOODS.test(id))
const nameOf = (id: string) => itemDef(id).name
type Tab = 'offers' | 'search' | 'mine'
/** the shop key the Co.'s standing decor stock is sold under (furniture.ts › sold.at) */
export const CO_STOCK_AT = 'lingston'

export function ExchangeHallPanel({ ledger, setLedger, onClose, startTab = 'offers' }: { ledger: Ledger; setLedger: (l: Ledger) => void; onClose: () => void; startTab?: Tab }) {
  const inv = useInv()
  const [tab, setTab] = useState<Tab>(startTab)
  const [book, setBook] = useState<BookRow[] | null>(null), [signedIn, setSignedIn] = useState(false)
  const [q, setQ] = useState(''), [item, setItem] = useState<string | null>(null)
  const [side, setSide] = useState<Side>('buy'), [n, setN] = useState('1'), [price, setPrice] = useState('10')
  const [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { const r = await fetch('/api/exchange', { cache: 'no-store' }); const j = await r.json(); setBook(sortBook(j.book ?? [])); setSignedIn(!!j.signedIn) } catch { setMsg('The book could not be read. Try again.') }
  }, [])
  useEffect(() => { load() }, [load])
  const post = async (body: object) => {
    const r = await fetch('/api/exchange', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (j.book) setBook(sortBook(j.book))
    return r.ok ? { ok: true as const, order: j.order as BookRow } : { ok: false as const, error: String(j.error ?? 'No.') }
  }
  const place = async () => {
    if (!item || busy) return
    const c = checkOrder({ side, item, n: Number(n), price: Number(price) }, (book ?? []).filter(r => r.mine).length)
    if (!c.ok) { setMsg(c.error); return }
    const o = c.order, total = o.n * o.price
    // the order's goods / Marks leave the save first (a refusal hands them straight back)
    if (o.side === 'sell') { const next = take(getInv(), o.item, o.n); if (!next) { setMsg(`You have ${countOf(getInv(), o.item)} ${nameOf(o.item)}.`); return } setInv(next) }
    else { if (ledger.marks < total) { setMsg(`That holds ${total.toLocaleString('en-US')} Marks. You have ${ledger.marks.toLocaleString('en-US')}.`); return } setLedger({ ...ledger, marks: ledger.marks - total }) }
    setBusy(true)
    const r = await post({ action: 'place', ...o }).catch(() => ({ ok: false as const, error: 'The counter did not answer.' }))
    setBusy(false)
    if (!r.ok) {
      if (o.side === 'sell') setInv(give(getInv(), o.item, o.n).inv); else setLedger({ ...ledger })
      setMsg(r.error); return
    }
    setMsg(o.side === 'sell' ? `Sell order placed: ${o.n} ${nameOf(o.item)} at ${o.price} each.` : `Buy order placed: ${o.n} ${nameOf(o.item)} at ${o.price} each. ${total.toLocaleString('en-US')} Marks held.`)
    setTab('mine')
  }
  const cancel = async (row: BookRow) => {
    if (busy) return
    if (row.side === 'sell' && give(getInv(), row.item, row.n).left > 0) { setMsg('Clear room in your bag first.'); return }
    setBusy(true)
    const r = await post({ action: 'cancel', order_id: row.order_id }).catch(() => ({ ok: false as const, error: 'The counter did not answer.' }))
    setBusy(false)
    if (!r.ok) { setMsg(r.error); return }
    if (r.order.side === 'sell') setInv(give(getInv(), r.order.item, r.order.n).inv); else setLedger({ ...ledger, marks: ledger.marks + r.order.n * r.order.price })
    setMsg(`Order cancelled: ${r.order.n} ${nameOf(r.order.item)} back to you.`)
  }
  // the Co.'s own standing stock (the decor the Citadel's old Exchange door sold, moved here M228): bought at once, for Marks
  const coStock = useMemo(() => stockOf(CO_STOCK_AT), [])
  const buyCo = (id: string) => {
    const r = buyDecor(ledger, getInv(), id, CO_STOCK_AT)
    if (!r.ok) { setMsg(r.why); return }
    setLedger(r.ledger); setInv(r.inv); setMsg(`Bought: ${FURNITURE[id].name}.`)
  }
  const shown = useMemo(() => {
    const all = book ?? []
    return tab === 'mine' ? all.filter(r => r.mine) : tab === 'search' ? (item ? all.filter(r => r.item === item) : searchBook(all, q, nameOf)) : all
  }, [book, tab, q, item])
  const matches = useMemo(() => { const w = q.toLowerCase().split(/\s+/).filter(Boolean); return w.length ? GOODS_IDS.filter(id => w.every(x => `${id.replace(/_/g, ' ')} ${nameOf(id)}`.toLowerCase().includes(x))).slice(0, 12) : [] }, [q])
  const pick = (id: string) => { setItem(id); setTab('search'); setQ(nameOf(id)); setMsg(null) }
  const tabBtn = (t: Tab, label: string) => (
    <button key={t} data-x-tab={t} onClick={() => { setTab(t); if (t !== 'search') setItem(null) }} style={{ flex: 1, padding: '7px 0', border: 0, borderRadius: 6, cursor: 'pointer', font: '700 12px system-ui', background: tab === t ? H.ember : H.tabIdle, color: tab === t ? '#fff' : H.ink }}>{label}</button>
  )
  const total = Number(n) * Number(price) || 0
  return (
    <HearthFrame title="The Grand Exchange" maxWidth={460} onClose={onClose} fixed dataPanel="exchange"
      head={<div style={{ display: 'flex', gap: 6, padding: '22px 14px 6px' }}>{tabBtn('offers', 'Current offers')}{tabBtn('search', 'Search')}{tabBtn('mine', 'Your orders')}</div>}>
      <div style={{ padding: '6px 14px 14px', fontSize: 13, color: H.ink }}>
        {tab === 'search' && (
          <div style={{ marginBottom: 8 }}>
            <input data-x-search value={q} placeholder="Item name" onChange={e => { setQ(e.target.value); setItem(null) }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: `1px solid ${H.rule}`, font: '14px system-ui', background: H.paperHi }} />
            {!item && matches.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {matches.map(id => <button key={id} data-x-pick={id} onClick={() => pick(id)} style={{ padding: '4px 8px', borderRadius: 12, border: `1px solid ${H.rule}`, background: H.paper, cursor: 'pointer', font: '12px system-ui' }}>{nameOf(id)}</button>)}
              </div>
            )}
          </div>
        )}
        <div data-x-book style={{ maxHeight: 210, overflowY: 'auto', border: `1px solid ${H.rule}`, borderRadius: 6, background: H.paperHi }}>
          {book === null ? <div style={{ padding: 10, color: H.inkSoft }}>Reading the book…</div>
            : shown.length === 0 ? <div data-x-empty style={{ padding: 10, color: H.inkSoft }}>{tab === 'mine' ? 'You have no open orders.' : 'No offers.'}</div>
            : shown.map(r => (
              <div key={r.order_id} data-x-row={r.order_id} data-side={r.side} data-item={r.item} data-mine={r.mine ? '1' : '0'}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: `1px solid ${H.rule}` }}>
                <span style={{ width: 38, font: '700 11px system-ui', color: r.side === 'sell' ? H.moss : H.sky }}>{r.side === 'sell' ? 'SELL' : 'BUY'}</span>
                <button onClick={() => pick(r.item)} style={{ flex: 1, textAlign: 'left', border: 0, background: 'none', padding: 0, cursor: 'pointer', font: '13px system-ui', color: H.ink }}>{r.n} × {nameOf(r.item)}</button>
                <span style={{ font: '600 12px system-ui' }}>{r.price.toLocaleString('en-US')} each</span>
                {r.mine ? <button data-x-cancel={r.order_id} onClick={() => cancel(r)} style={{ border: 0, borderRadius: 5, padding: '3px 7px', background: H.rust, color: '#fff', cursor: 'pointer', font: '700 11px system-ui' }}>Cancel</button>
                  : <span style={{ font: '11px system-ui', color: H.inkFaint }}>{r.who}</span>}
              </div>
            ))}
        </div>
        {tab === 'offers' && coStock.length > 0 && (
          <div data-x-co style={{ marginTop: 8, border: `1px solid ${H.rule}`, borderRadius: 6, background: H.paperHi }}>
            <div style={{ padding: '5px 10px', font: '700 11px system-ui', letterSpacing: '0.12em', color: H.ember }}>ATHER TRADING CO. STOCK</div>
            {coStock.map(id => (
              <div key={id} data-x-co-row={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderTop: `1px solid ${H.rule}` }}>
                <span style={{ flex: 1 }}>{FURNITURE[id].name}</span>
                <span style={{ font: '600 12px system-ui' }}>{FURNITURE[id].sold!.price.toLocaleString('en-US')}</span>
                <button data-x-co-buy={id} onClick={() => buyCo(id)} style={{ border: 0, borderRadius: 5, padding: '3px 8px', background: H.moss, color: '#fff', cursor: 'pointer', font: '700 11px system-ui' }}>Buy</button>
              </div>
            ))}
          </div>
        )}
        <div data-x-form style={{ marginTop: 10, padding: 10, borderRadius: 6, background: H.paper, border: `1px solid ${H.rule}` }}>
          <div style={{ font: '700 11px system-ui', letterSpacing: '0.14em', color: H.ember, marginBottom: 6 }}>PLACE AN ORDER</div>
          {!signedIn ? <div style={{ color: H.inkSoft }}>Sign in to place orders.</div>
            : !item ? <div style={{ color: H.inkSoft }}>Search for an item, or tap one in the book.</div>
            : (
              <>
                <div style={{ marginBottom: 6 }}><b data-x-item={item}>{nameOf(item)}</b> <span style={{ color: H.inkSoft }}>· you have {countOf(inv, item)} · {ledger.marks.toLocaleString('en-US')} Marks</span></div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {(['buy', 'sell'] as const).map(s => <button key={s} data-x-side={s} onClick={() => setSide(s)} style={{ padding: '6px 12px', borderRadius: 6, border: 0, cursor: 'pointer', font: '700 12px system-ui', background: side === s ? (s === 'buy' ? H.sky : H.moss) : H.tabIdle, color: side === s ? '#fff' : H.ink }}>{s === 'buy' ? 'Buy' : 'Sell'}</button>)}
                  <label style={{ font: '12px system-ui' }}>How many <input data-x-n value={n} inputMode="numeric" onChange={e => setN(e.target.value.replace(/\D/g, ''))} style={{ width: 52, padding: 4 }} /></label>
                  <label style={{ font: '12px system-ui' }}>Price each <input data-x-price value={price} inputMode="numeric" onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} style={{ width: 70, padding: 4 }} /></label>
                </div>
                <div style={{ marginTop: 6, color: H.inkSoft, font: '12px system-ui' }}>
                  Total {total.toLocaleString('en-US')} Marks{side === 'sell' && total > 0 ? ` · fee ${feeOf(Number(n), Number(price))} (${EXCHANGE_FEE * 100}%) when it sells` : ''}
                </div>
                <button data-x-place disabled={busy} onClick={place} style={{ marginTop: 8, width: '100%', padding: '9px 0', border: 0, borderRadius: 6, cursor: 'pointer', font: '700 13px system-ui', background: H.ember, color: '#fff', opacity: busy ? 0.6 : 1 }}>
                  {side === 'buy' ? 'Place buy order' : 'Place sell order'}
                </button>
              </>
            )}
          {msg && <div data-x-msg style={{ marginTop: 8, font: '12px system-ui', color: H.ink }}>{msg}</div>}
          <div style={{ marginTop: 6, font: '11px system-ui', color: H.inkFaint }}>An order holds its goods or Marks until you cancel it.</div>
        </div>
      </div>
    </HearthFrame>
  )
}
