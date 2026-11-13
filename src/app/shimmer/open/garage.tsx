'use client'

// The GARAGE panel (press G while driving): the three slots, the balance dial, and stat bars that move as you
// change things, against the stock car. Everything is unlocked here for TESTING; how a player earns, buys or finds
// parts comes with the economy (Alex 11-13: "a mix"). The build is remembered per browser (a convenience; the
// real save joins the account save later), and the car re-tunes the instant you change it.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DARTER_STOCK, tuneFromSpec, type CourserTune } from './courser'
import { buildSpec, statBars, PART_LABEL, tierLabel, STOCK_BUILD, type CourserBuild, type Slot, type Tier } from './courser-build'

const KEY = 'ather:courser:darter:build'
const GOLD = '#d4a843'

export function useCourserBuild(): { build: CourserBuild; setBuild: (b: CourserBuild) => void; tune: CourserTune } {
  const [build, setB] = useState<CourserBuild>(STOCK_BUILD)
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setB({ ...STOCK_BUILD, ...JSON.parse(raw) }) } catch { /* private mode etc: stock */ }
  }, [])
  const setBuild = useCallback((b: CourserBuild) => {
    setB(b)
    try { localStorage.setItem(KEY, JSON.stringify(b)) } catch { /* not remembered, still applied */ }
  }, [])
  const tune = useMemo(() => tuneFromSpec(buildSpec(DARTER_STOCK, build)), [build])
  return { build, setBuild, tune }
}

function Bar({ label, v, base }: { label: string; v: number; base: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 30px', alignItems: 'center', gap: 8, fontSize: 11 }}>
      <span style={{ letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7 }}>{label}</span>
      <div style={{ position: 'relative', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${base * 10}%`, borderRadius: 4, background: 'rgba(255,255,255,0.22)' }} />
        <div style={{ position: 'absolute', inset: 0, width: `${v * 10}%`, borderRadius: 4, background: v >= base ? GOLD : '#c96b4f', opacity: 0.9, transition: 'width 0.2s' }} />
      </div>
      <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{v.toFixed(1)}</span>
    </div>
  )
}

export function GaragePanel({ open, onClose, build, setBuild }: { open: boolean; onClose: () => void; build: CourserBuild; setBuild: (b: CourserBuild) => void }) {
  if (!open) return null
  const spec = buildSpec(DARTER_STOCK, build), stock = DARTER_STOCK
  const bars = statBars(spec), base = statBars(stock)
  const slots: Slot[] = ['core', 'trim', 'rune']
  return (
    <div style={{ position: 'absolute', right: 16, top: 56, width: 340, maxWidth: 'calc(100vw - 32px)', padding: '16px 18px', borderRadius: 12,
      background: 'rgba(10,12,18,0.86)', border: `1px solid ${GOLD}44`, color: '#efeadc', font: '13px system-ui, sans-serif', backdropFilter: 'blur(6px)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ font: '600 11px var(--font-game), system-ui', letterSpacing: '0.3em', color: GOLD }}>GARAGE</div>
          <div style={{ font: '600 20px var(--font-display), Georgia, serif' }}>The Darter</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#efeadc', opacity: 0.6, cursor: 'pointer', fontSize: 12 }}>G · close</button>
      </div>

      {slots.map(slot => (
        <div key={slot} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{PART_LABEL[slot].name}</span>
            <span style={{ opacity: 0.55 }}>{PART_LABEL[slot].does}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
            {([0, 1, 2, 3] as Tier[]).map(t => {
              const on = build[slot] === t
              return (
                <button key={t} onClick={() => setBuild({ ...build, [slot]: t })}
                  style={{ padding: '5px 0', borderRadius: 6, cursor: 'pointer', font: '600 11px var(--font-game), system-ui', letterSpacing: '0.12em',
                    border: `1px solid ${on ? GOLD : 'rgba(255,255,255,0.14)'}`, background: on ? `${GOLD}26` : 'transparent', color: on ? GOLD : '#efeadc' }}>
                  {tierLabel(t)}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ margin: '14px 0 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 4 }}>
          <span style={{ opacity: build.balance < -0.05 ? 1 : 0.5 }}>Handling</span>
          <span style={{ opacity: 0.5, letterSpacing: '0.1em' }}>balance</span>
          <span style={{ opacity: build.balance > 0.05 ? 1 : 0.5 }}>Speed</span>
        </div>
        <input type="range" min={-1} max={1} step={0.05} value={build.balance} aria-label="Balance between handling and speed"
          onChange={e => setBuild({ ...build, balance: Number(e.target.value) })} style={{ width: '100%', accentColor: GOLD }} />
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <Bar label="Speed" v={bars.speed} base={base.speed} />
        <Bar label="Accel" v={bars.accel} base={base.accel} />
        <Bar label="Handling" v={bars.handling} base={base.handling} />
        <Bar label="Braking" v={bars.braking} base={base.braking} />
      </div>
      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
        0-60 {spec.zeroTo60.toFixed(1)} s · top {Math.round(spec.topMph)} mph · 60-0 {Math.round(spec.brake60ft)} ft
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11 }}>
        <span style={{ opacity: 0.45 }}>Test garage: every part unlocked</span>
        <button onClick={() => setBuild(STOCK_BUILD)} style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', fontSize: 11 }}>Reset to stock</button>
      </div>
    </div>
  )
}
