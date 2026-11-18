'use client'

// The trade v1 UI (ECONOMY.md): the Ather Trading Co.'s board at a town, the objective line, the purse.
// ⚠ A TRIAL ledger, kept in this browser only: test runs must not leak coin into the account's real Marks purse.
// Joining the real purse is a deliberate later step (it touches the live save), not a side effect of driving.

import { useCallback, useEffect, useState } from 'react'
import { GOODS, NEW_LEDGER, migrateLedger, crates, type Contract, type Ledger } from './trade'

const KEY = 'ather:trade:trial-ledger'
import { HearthFrame, H } from '../ui/hearth'
import { gardenKey } from '@/lib/keeper-local'
const GOLD = '#d4a843'

/** The ledger as saved right now (for a caller that runs before useLedger's load effect lands: the tycoon's catch-up). */
export function readSavedLedger(): Ledger {
  try { const raw = localStorage.getItem(gardenKey(KEY)); if (raw) return migrateLedger(JSON.parse(raw)) } catch { /* fresh */ }
  return NEW_LEDGER
}

export function useLedger(): [Ledger, (l: Ledger) => void] {
  const [l, setL] = useState<Ledger>(NEW_LEDGER)
  useEffect(() => { try { const raw = localStorage.getItem(gardenKey(KEY)); if (raw) setL(migrateLedger(JSON.parse(raw)))   /* scales a pre-ladder purse up once (trade.ts) */ } catch { /* fresh */ } }, [])
  const set = useCallback((n: Ledger) => { setL(n); try { localStorage.setItem(gardenKey(KEY), JSON.stringify(n)) } catch { /* not remembered */ } }, [])
  return [l, set]
}


export function BoardPanel({ town, contracts, ledger, capacity, onAccept, onAbandon, onClose, msg }: {
  town: string; contracts: Contract[]; ledger: Ledger; capacity: number
  onAccept: (c: Contract) => void; onAbandon: () => void; onClose: () => void; msg: string | null
  }) {
  const name = (id: string) => id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
  return (
    // ★ The Carved Hearth frame with the red close (Alex 11-15: every menu)
    <HearthFrame title="Contract board" maxWidth={420} onClose={onClose} fixed dataPanel="trade-board">
      <div style={{ padding: '26px 16px 14px', fontSize: 13 }}>
      <div style={{ font: '700 11px system-ui', letterSpacing: '0.24em', color: H.ember }}>ATHER TRADING CO.</div>
      {ledger.active && (
        <div style={{ margin: '10px 0', padding: '8px 10px', borderRadius: 8, background: 'rgba(58,39,22,0.07)', fontSize: 12 }}>
          Holding: {ledger.active.qty} {GOODS[ledger.active.good].name} → {name(ledger.active.to)} ({ledger.active.loaded ? 'loaded' : 'not loaded yet'})
          <button onClick={onAbandon} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#c96b4f', cursor: 'pointer', fontSize: 11 }}>hand it back</button>
        </div>
      )}
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {contracts.length === 0 && <div style={{ opacity: 0.6, fontSize: 12 }}>Nothing posted. Come back later.</div>}
        {contracts.map(c => {
          const g = GOODS[c.good], fits = crates(c) <= capacity
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 8, border: `1px solid ${H.rule}`, background: 'rgba(255,250,235,0.5)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.qty} {g.name} <span style={{ opacity: 0.55, fontWeight: 400 }}>{name(c.from)} → {name(c.to)}</span></div>
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
                  {crates(c)}/{capacity} crates · {c.km.toFixed(1)} km{g.spoils ? ' · spoils, be quick' : ''}{g.side === 'ather' ? ' · from the Ather, through the landing' : ''}
                </div>
              </div>
              <button disabled={!!ledger.active || !fits} onClick={() => onAccept(c)}
                style={{ padding: '6px 10px', borderRadius: 6, cursor: ledger.active || !fits ? 'default' : 'pointer', font: '600 11px var(--font-game), system-ui', letterSpacing: '0.1em',
                  border: `1px solid ${H.ember}`, background: ledger.active || !fits ? 'transparent' : 'rgba(200,100,42,0.14)', color: H.emberLo, opacity: ledger.active || !fits ? 0.4 : 1 }}>
                {c.pay} M
              </button>
            </div>
          )
        })}
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 11, color: H.rust, fontWeight: 600 }}>{msg}</div>}
      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.6 }}>Stop at the pickup to load, at the drop to deliver. One at a time.</div>
      </div>
    </HearthFrame>
  )
}

/** The purse (top right) + the objective line with an arrow that points the way, relative to the car. */
export function TradeHud({ ledger, objective, toast, purse = true }: { ledger: Ledger; objective: { text: string; km: number; turn: number } | null; toast: string | null
  /** false = the page's GameHud status chips carry Marks + deeds (game-hud.tsx) */
  purse?: boolean }) {
  return (
    <>
      {purse && <div style={{ position: 'absolute', right: 16, top: 206, /* under the minimap + the hearth clock pill that hangs from it (game-hud) */ textAlign: 'right', color: '#f4efe2', font: '600 12px var(--font-game), system-ui', letterSpacing: '0.12em', textShadow: '0 2px 8px rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
        <span style={{ color: GOLD }}>{ledger.marks}</span> MARKS · {ledger.deeds} {ledger.deeds === 1 ? 'DEED' : 'DEEDS'}
        <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: '0.2em', marginTop: 2 }}>TRIAL LEDGER</div>
      </div>}
      {objective && (
        <div style={{ position: 'absolute', left: '50%', bottom: 104, /* over the speedometer; the bar is top-left in the template */ transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderRadius: 999,
          background: 'rgba(10,12,18,0.7)', color: '#f4efe2', font: '600 12px system-ui', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-block', transform: `rotate(${objective.turn}rad)`, color: GOLD, fontSize: 16, lineHeight: 1 }}>▲</span>
          {objective.text} · {objective.km < 0.1 ? 'here' : `${objective.km.toFixed(1)} km`}
        </div>
      )}
      {toast && (
        <div style={{ position: 'absolute', left: '50%', top: '30%', transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: 10, background: 'rgba(10,12,18,0.8)',
          color: GOLD, font: '600 15px var(--font-game), system-ui', letterSpacing: '0.12em', pointerEvents: 'none', textAlign: 'center' }}>{toast}</div>
      )}
    </>
  )
}
