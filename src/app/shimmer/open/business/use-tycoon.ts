'use client'
// THE TYCOON, kept: the keeper's businesses saved in this browser and run on the clock (play lane, 2026-11-16).
//
// economy/tycoon.ts (world lane) is the pure loop; this is the page's hold on it. Saved at TYCOON_KEY next to the trade's
// trial ledger (same browser-only footing: the Marks the businesses earn land in that ledger's purse).
//
// ★ CATCH-UP: on load the businesses run every whole minute since the last visit (tycoon.ts caps it at 8 hours) and the
//   message line says what came in. Then a tick every 15 s settles whole minutes as they pass.
// ★ SETTLE BEFORE YOU CHANGE THE SET. A purchase must not be paid for the minutes before it was bought, and a sale must
//   be paid for the minutes before it went, so buy/sell tick to now first, then change `owned`.
// ★ THE LEDGER LOADS IN AN EFFECT: on the first commit the page's ledger is still NEW_LEDGER. The catch-up reads the saved
//   ledger itself (readSavedLedger) so it never writes the starting purse over a real one.
import { useCallback, useEffect, useRef, useState } from 'react'
import { buy as buyBiz, newTycoon, sell as sellBiz, tick, type BizKind, type Tycoon } from '../economy/tycoon'
import { readSavedLedger } from '../trade-ui'
import type { Ledger } from '../trade'
import { hudSay } from '../shared/game-hud'

export const TYCOON_KEY = 'open.tycoon.v1'

function load(): Tycoon | null {
  try { const raw = localStorage.getItem(TYCOON_KEY); if (raw) { const t = JSON.parse(raw) as Tycoon; if (t && t.v === 1 && Array.isArray(t.owned)) return t } } catch { /* fresh */ }
  return null
}
function persist(t: Tycoon) { try { localStorage.setItem(TYCOON_KEY, JSON.stringify(t)) } catch { /* not remembered */ } }

const fmt = (n: number) => Math.round(n).toLocaleString()

export interface TycoonApi {
  t: Tycoon | null
  buy: (lotId: string, kind: BizKind, tier: 0 | 1 | 2) => { ok: boolean; why?: string }
  sell: (lotId: string) => { ok: boolean; why?: string; refund?: number }
}

export function useTycoon(ledger: Ledger, setLedger: (l: Ledger) => void): TycoonApi {
  const [t, setT] = useState<Tycoon | null>(null)
  const tRef = useRef<Tycoon | null>(null)
  const lRef = useRef(ledger); lRef.current = ledger
  const loaded = useRef(false)
  const keep = useCallback((n: Tycoon) => { tRef.current = n; setT(n); persist(n) }, [])

  // settle whole minutes up to now; returns the ledger the result was paid into
  const settle = useCallback((l: Ledger): Ledger => {
    const cur = tRef.current; if (!cur) return l
    const r = tick(cur, Date.now(), l.marks)
    if (r.minutes === 0) return l
    keep(r.t)
    if (r.marks === l.marks) return l
    const next = { ...l, marks: Math.floor(r.marks) }
    setLedger(next); lRef.current = next
    return next
  }, [keep, setLedger])

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true
      const saved = load() ?? newTycoon(Date.now())
      const l = readSavedLedger()
      const r = tick(saved, Date.now(), l.marks)
      keep(r.t)
      if (saved.owned.length && r.minutes > 0) {
        if (Math.floor(r.marks) !== l.marks) { const next = { ...l, marks: Math.floor(r.marks) }; setLedger(next); lRef.current = next }
        const h = r.minutes >= 60 ? `${Math.floor(r.minutes / 60)} h ${r.minutes % 60} min` : `${r.minutes} min`
        hudSay(r.net >= 0 ? `Your businesses made ${fmt(r.net)} Marks while you were away (${h})` : `Your businesses cost ${fmt(-r.net)} Marks in upkeep while you were away (${h})`, 'info')
      }
    }
    const iv = setInterval(() => settle(lRef.current), 15_000)
    return () => clearInterval(iv)
  }, [keep, settle, setLedger])

  const buy = useCallback((lotId: string, kind: BizKind, tier: 0 | 1 | 2) => {
    if (!tRef.current) return { ok: false, why: 'Still loading.' }
    const l = settle(lRef.current)
    const r = buyBiz(tRef.current, lotId, kind, tier, l.marks)
    if (!r.ok) return { ok: false, why: r.why }
    keep(r.t); const next = { ...l, marks: r.marks }; setLedger(next); lRef.current = next
    return { ok: true }
  }, [keep, settle, setLedger])

  const sell = useCallback((lotId: string) => {
    if (!tRef.current) return { ok: false, why: 'Still loading.' }
    const l = settle(lRef.current)
    const r = sellBiz(tRef.current, lotId, l.marks)
    if (!r.ok) return { ok: false, why: r.why }
    keep(r.t); const next = { ...l, marks: r.marks }; setLedger(next); lRef.current = next
    return { ok: true, refund: r.refund }
  }, [keep, settle, setLedger])

  // probe for scripted checks
  useEffect(() => { (window as unknown as { __tycoon?: unknown }).__tycoon = { t, buy, sell } }, [t, buy, sell])
  return { t, buy, sell }
}
