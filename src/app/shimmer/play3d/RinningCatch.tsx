'use client'

// Rinning cast-and-catch overlay — the fishing minigame the walker opens at a water
// node (instead of the hold-to-channel of the other skills). Tap anywhere to strike:
// wait for the bite, then hook it in the window. Drives the pure state machine in
// engine/rinning.ts; reports the result back so the game grants the catch.

import { useEffect, useRef, useState } from 'react'
import { newCast, phaseAt, hook, hookQuality, type RinCast } from '../engine/rinning'

type Shown = 'waiting' | 'bite' | 'caught' | 'gotaway'

export function RinningCatch({ label, onDone }: { label: string; onDone: (caught: boolean, quality: number) => void }) {
  const [shown, setShown] = useState<Shown>('waiting')
  const castRef = useRef<RinCast | null>(null)
  const doneRef = useRef(false)

  const resolve = (caught: boolean, q: number) => {
    if (doneRef.current) return
    doneRef.current = true
    setShown(caught ? 'caught' : 'gotaway')
    window.setTimeout(() => onDone(caught, q), 780)
  }

  useEffect(() => {
    castRef.current = newCast(performance.now(), Math.random)
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (doneRef.current || !castRef.current) return
      const ph = phaseAt(castRef.current, performance.now())
      if (ph === 'gotaway') { resolve(false, 0); return } // let the window lapse = it slips the line
      setShown(ph)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const strike = () => {
    if (doneRef.current || !castRef.current) return
    const now = performance.now()
    const caught = hook(castRef.current, now) === 'caught'
    resolve(caught, caught ? hookQuality(castRef.current, now) : 0)
  }

  const bite = shown === 'bite'
  const caught = shown === 'caught'
  const gotaway = shown === 'gotaway'

  return (
    <div
      onPointerDown={strike}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 60%, rgba(24,58,74,0.55), rgba(6,14,20,0.82))',
        touchAction: 'none', userSelect: 'none', cursor: 'pointer',
      }}
    >
      <style>{`@keyframes rinBob{0%,100%{transform:translateY(-3px)}50%{transform:translateY(3px)}}
        @keyframes rinBite{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
        @keyframes rinRipple{0%{transform:scale(.4);opacity:.6}100%{transform:scale(1.8);opacity:0}}`}</style>

      <div style={{
        width: 260, maxWidth: '82vw', padding: '26px 20px', borderRadius: 18, textAlign: 'center',
        background: 'linear-gradient(180deg,#0e2732,#0a1a22)', border: `2px solid ${bite ? '#7fe9ff' : '#2f5a68'}`,
        boxShadow: bite ? '0 0 32px #37e6ff88' : '0 12px 40px rgba(0,0,0,0.6)', transition: 'border-color .1s, box-shadow .1s',
      }}>
        <div style={{ font: '700 11px ui-monospace, monospace', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6fb8d9', marginBottom: 14 }}>
          Rinning · {label}
        </div>

        {/* the pool + bobber */}
        <div style={{ position: 'relative', height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          {!caught && !gotaway && (
            <span aria-hidden style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', border: '2px solid #5fa8d0', animation: 'rinRipple 1.4s ease-out infinite' }} />
          )}
          <span style={{
            fontSize: bite ? 46 : 38, lineHeight: 1,
            animation: caught || gotaway ? 'none' : bite ? 'rinBite .28s ease-in-out infinite' : 'rinBob 1.6s ease-in-out infinite',
            filter: bite ? 'drop-shadow(0 0 10px #37e6ff)' : 'none',
          }}>
            {caught ? '🐟' : gotaway ? '💨' : bite ? '❗' : '🎣'}
          </span>
        </div>

        <div style={{ font: '800 15px ui-sans-serif, system-ui', color: caught ? '#7fffd0' : gotaway ? '#f2a58c' : bite ? '#eafcff' : '#9fd6e0', minHeight: 20 }}>
          {caught ? (hookQualityLabel()) : gotaway ? 'it slipped the line' : bite ? 'HOOK IT!' : 'wait for the bite…'}
        </div>
        <div style={{ font: '600 10px ui-monospace, monospace', color: '#5a8898', marginTop: 8, letterSpacing: '0.08em' }}>
          {caught || gotaway ? '' : 'tap anywhere to strike'}
        </div>
      </div>
    </div>
  )

  function hookQualityLabel() {
    const q = castRef.current ? hookQuality(castRef.current, performance.now()) : 0
    return q > 0.66 ? '✦ clean catch!' : 'caught!'
  }
}
