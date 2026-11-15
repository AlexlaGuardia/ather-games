'use client'

// The trade v1 UI (ECONOMY.md): the Ather Trading Co.'s board at a town, the objective line, the purse.
// ⚠ A TRIAL ledger, kept in this browser only: test runs must not leak coin into the account's real Marks purse.
// Joining the real purse is a deliberate later step (it touches the live save), not a side effect of driving.

import { useCallback, useEffect, useState } from 'react'
import { GOODS, NEW_LEDGER, crates, type Contract, type Ledger } from './trade'

const KEY = 'ather:trade:trial-ledger'
const GOLD = '#d4a843'

export function useLedger(): [Ledger, (l: Ledger) => void] {
  const [l, setL] = useState<Ledger>(NEW_LEDGER)
  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) setL({ ...NEW_LEDGER, ...JSON.parse(raw) }) } catch { /* fresh */ } }, [])
  const set = useCallback((n: Ledger) => { setL(n); try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* not remembered */ } }, [])
  return [l, set]
}

const panel: React.CSSProperties = {
  position: 'absolute', left: 16, top: 56, width: 360, maxWidth: 'calc(100vw - 32px)', padding: '16px 18px', borderRadius: 12,
  background: 'rgba(10,12,18,0.88)', border: `1px solid ${GOLD}44`, color: '#efeadc', font: '13px system-ui, sans-serif', backdropFilter: 'blur(6px)',
}

export function BoardPanel({ town, contracts, ledger, capacity, onAccept, onAbandon, onClose, msg }: {
  town: string; contracts: Contract[]; ledger: Ledger; capacity: number
  onAccept: (c: Contract) => void; onAbandon: () => void; onClose: () => void; msg: string | null
  }) {
  const name = (id: string) => id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ font: '600 11px var(--font-game), system-ui', letterSpacing: '0.3em', color: GOLD }}>ATHER TRADING CO.</div>
          <div style={{ font: '600 20px var(--font-display), Georgia, serif' }}>{town} board</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#efeadc', opacity: 0.6, cursor: 'pointer', fontSize: 12 }}>E · close</button>
      </div>
      {ledger.active && (
        <div style={{ margin: '10px 0', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 12 }}>
          Holding: {ledger.active.qty} {GOODS[ledger.active.good].name} → {name(ledger.active.to)} ({ledger.active.loaded ? 'loaded' : 'not loaded yet'})
          <button onClick={onAbandon} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#c96b4f', cursor: 'pointer', fontSize: 11 }}>drop it</button>
        </div>
      )}
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {contracts.length === 0 && <div style={{ opacity: 0.6, fontSize: 12 }}>No work posted here today.</div>}
        {contracts.map(c => {
          const g = GOODS[c.good], fits = crates(c) <= capacity
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.qty} {g.name} <span style={{ opacity: 0.55, fontWeight: 400 }}>→ {name(c.to)}</span></div>
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
                  {crates(c)}/{capacity} crates · {c.km.toFixed(1)} km{g.spoils ? ' · spoils, be quick' : ''}{g.side === 'ather' ? ' · from the Ather, through the landing' : ''}
                </div>
              </div>
              <button disabled={!!ledger.active || !fits} onClick={() => onAccept(c)}
                style={{ padding: '6px 10px', borderRadius: 6, cursor: ledger.active || !fits ? 'default' : 'pointer', font: '600 11px var(--font-game), system-ui', letterSpacing: '0.1em',
                  border: `1px solid ${GOLD}`, background: ledger.active || !fits ? 'transparent' : `${GOLD}26`, color: GOLD, opacity: ledger.active || !fits ? 0.4 : 1 }}>
                {c.pay} M
              </button>
            </div>
          )
        })}
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 11, color: '#e7b98a' }}>{msg}</div>}
      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.5 }}>Load at the pickup and deliver at the drop by stopping there. One contract at a time.</div>
    </div>
  )
}

/** The purse (top right) + the objective line with an arrow that points the way, relative to the car. */
export function TradeHud({ ledger, objective, toast }: { ledger: Ledger; objective: { text: string; km: number; turn: number } | null; toast: string | null }) {
  return (
    <>
      <div style={{ position: 'absolute', right: 16, top: 206, /* under the minimap + the hearth clock pill that hangs from it (open-hud) */ textAlign: 'right', color: '#f4efe2', font: '600 12px var(--font-game), system-ui', letterSpacing: '0.12em', textShadow: '0 2px 8px rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
        <span style={{ color: GOLD }}>{ledger.marks}</span> MARKS · {ledger.deeds} {ledger.deeds === 1 ? 'DEED' : 'DEEDS'}
        <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: '0.2em', marginTop: 2 }}>TRIAL LEDGER</div>
      </div>
      {objective && (
        <div style={{ position: 'absolute', left: '50%', bottom: 140, /* above the hearth hotbar (HUD_BAR_CLEAR) */ transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderRadius: 999,
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
