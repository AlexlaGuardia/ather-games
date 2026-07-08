'use client'

// Rinning cast-and-catch overlay — the fishing minigame the walker opens at a water node
// (instead of the hold-to-channel of the other skills). The line arcs out, the bobber
// settles, false nibbles tease you, then the real bite YANKS it under — tap in the closing
// window to hook it. A clean, fast hook lands a bonus catch. Drives the pure state machine
// in engine/rinning.ts and reports (caught, quality) back so the game grants the catch.

import { useEffect, useRef, useState } from 'react'
import { newCast, phaseAt, hook, hookQuality, qualityTier, type RinCast, type RinPhase } from '../engine/rinning'

// ── tiny self-contained juice (no shared sfx module in the walker) ────────────────────
let _ac: AudioContext | null = null
function tone(freq: number, durMs: number, opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {}) {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    _ac = _ac || new AC()
    const t0 = _ac.currentTime, dur = durMs / 1000
    const o = _ac.createOscillator(), g = _ac.createGain()
    o.type = opts.type ?? 'sine'; o.frequency.setValueAtTime(freq, t0)
    if (opts.slideTo) o.frequency.linearRampToValueAtTime(opts.slideTo, t0 + dur)
    g.gain.setValueAtTime(opts.gain ?? 0.06, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(_ac.destination); o.start(t0); o.stop(t0 + dur)
  } catch { /* audio blocked — no-op */ }
}
function buzz(pat: number | number[]) { try { navigator.vibrate?.(pat) } catch { /* unsupported */ } }

type Shown = Exclude<RinPhase, 'caught'> | 'caught'

export function RinningCatch({ label, onDone }: { label: string; onDone: (caught: boolean, quality: number) => void }) {
  const [shown, setShown] = useState<Shown>('cast')
  const castRef = useRef<RinCast | null>(null)
  const doneRef = useRef(false)
  const lastPhase = useRef<Shown>('cast')
  const [tier, setTier] = useState<'clean' | 'good' | 'caught'>('caught')

  const resolve = (caught: boolean, q: number) => {
    if (doneRef.current) return
    doneRef.current = true
    if (caught) {
      const tt = qualityTier(q); setTier(tt)
      setShown('caught')
      tone(420, 260, { type: 'triangle', slideTo: tt === 'clean' ? 980 : 760, gain: 0.07 }) // reel-up chirp
      buzz(tt === 'clean' ? [18, 30, 60] : [15, 40])
    } else {
      setShown('gotaway')
      tone(190, 260, { type: 'sawtooth', gain: 0.05, slideTo: 120 }) // it slips
    }
    window.setTimeout(() => onDone(caught, q), 820)
  }

  useEffect(() => {
    castRef.current = newCast(performance.now(), Math.random)
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (doneRef.current || !castRef.current) return
      const ph = phaseAt(castRef.current, performance.now())
      if (ph === 'gotaway') { resolve(false, 0); return } // window lapsed = slipped the line
      if (ph !== lastPhase.current) {
        if (ph === 'bite') { tone(560, 70, { type: 'triangle', gain: 0.07 }); tone(760, 90, { type: 'sine', gain: 0.05 }); buzz(38) }
        else if (ph === 'nibble') tone(300, 45, { type: 'sine', gain: 0.03 }) // faint tease tick
        lastPhase.current = ph
      }
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
  const nibble = shown === 'nibble'
  const caught = shown === 'caught'
  const gotaway = shown === 'gotaway'
  const settled = !caught && !gotaway
  const windowMs = castRef.current?.windowMs ?? 780
  const accent = bite ? '#7fe9ff' : nibble ? '#8fd0b0' : '#2f5a68'

  return (
    <div
      onPointerDown={strike}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 62%, rgba(24,58,74,0.55), rgba(6,14,20,0.85))',
        touchAction: 'none', userSelect: 'none', cursor: 'pointer',
        animation: bite ? 'rinShake .28s ease-in-out infinite' : 'none',
      }}
    >
      <style>{`
        @keyframes rinBob{0%,100%{transform:translateY(-3px)}50%{transform:translateY(4px)}}
        @keyframes rinNib{0%,100%{transform:translateY(0)}35%{transform:translateY(9px)}70%{transform:translateY(-2px)}}
        @keyframes rinYank{0%{transform:translateY(0)}100%{transform:translateY(22px)}}
        @keyframes rinCast{0%{transform:translateY(-74px) scale(.6);opacity:0}70%{opacity:1}100%{transform:translateY(0) scale(1)}}
        @keyframes rinPop{0%{transform:translateY(14px) scale(.5);opacity:0}45%{opacity:1}100%{transform:translateY(-30px) scale(1.15);opacity:1}}
        @keyframes rinRipple{0%{transform:translate(-50%,-50%) scale(.35);opacity:.6}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}
        @keyframes rinRing{0%{transform:translate(-50%,-50%) scale(2.4);opacity:.9}100%{transform:translate(-50%,-50%) scale(.55);opacity:.25}}
        @keyframes rinShake{0%,100%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}75%{transform:translate(2px,-1px)}}
        @keyframes rinSpark{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{opacity:0}}
      `}</style>

      <div style={{
        width: 268, maxWidth: '84vw', padding: '24px 20px', borderRadius: 18, textAlign: 'center',
        background: 'linear-gradient(180deg,#0e2732,#0a1a22)', border: `2px solid ${accent}`,
        boxShadow: bite ? '0 0 34px #37e6ff99' : nibble ? '0 0 18px #6fd0a055' : '0 12px 40px rgba(0,0,0,0.6)',
        transition: 'border-color .12s, box-shadow .12s',
      }}>
        <div style={{ font: '700 11px ui-monospace, monospace', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6fb8d9', marginBottom: 12 }}>
          Rinning · {label}
        </div>

        {/* the pool + bobber */}
        <div style={{ position: 'relative', height: 108, marginBottom: 12, overflow: 'hidden', borderRadius: 12, background: 'radial-gradient(ellipse at 50% 78%, #12333f, #0b1c25)' }}>
          {/* water surface line */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 62, height: 2, background: 'linear-gradient(90deg,transparent,#3f7f96,transparent)', opacity: 0.7 }} />
          {/* the line from the rod down to the bobber */}
          {settled && <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: 58, background: 'linear-gradient(#4a7f92,#5fa8d0)', opacity: 0.5, transform: 'translateX(-0.5px)' }} />}

          {/* idle ripple while the line's in the water */}
          {settled && <span aria-hidden style={{ position: 'absolute', left: '50%', top: 66, width: 54, height: 54, borderRadius: '50%', border: `2px solid ${nibble ? '#7fd0a0' : '#4f93b8'}`, animation: `rinRipple ${nibble ? 0.7 : 1.5}s ease-out infinite` }} />}

          {/* the closing reaction ring during the bite (reads the window shrinking) */}
          {bite && <span aria-hidden style={{ position: 'absolute', left: '50%', top: 62, width: 66, height: 66, borderRadius: '50%', border: '3px solid #7fe9ff', boxShadow: '0 0 12px #37e6ff', animation: `rinRing ${windowMs}ms linear forwards` }} />}

          {/* catch splash + sparkles */}
          {caught && <>
            <span aria-hidden style={{ position: 'absolute', left: '50%', top: 64, width: 60, height: 60, borderRadius: '50%', border: '2px solid #7fffd0', animation: 'rinRipple .7s ease-out' }} />
            {[0, 1, 2, 3, 4].map(i => (
              <span key={i} aria-hidden style={{ position: 'absolute', left: `${50 + (i - 2) * 12}%`, top: 40 + (i % 2) * 10, width: 4, height: 4, borderRadius: '50%', background: tier === 'clean' ? '#eafcff' : '#9fe6d0', animation: `rinSpark ${0.5 + i * 0.05}s ease-out forwards` }} />
            ))}
          </>}

          {/* the bobber / catch glyph */}
          <span style={{
            position: 'absolute', left: '50%', top: 44, transform: 'translateX(-50%)', fontSize: bite ? 44 : 36, lineHeight: 1,
            filter: bite ? 'drop-shadow(0 0 10px #37e6ff)' : caught ? 'drop-shadow(0 0 8px #7fffd0)' : 'none',
            animation: caught ? 'rinPop .8s cubic-bezier(.2,.8,.3,1) forwards'
              : gotaway ? 'none'
              : bite ? 'rinYank .18s ease-in forwards'
              : nibble ? 'rinNib .3s ease-in-out'
              : shown === 'cast' ? 'rinCast .45s ease-in forwards'
              : 'rinBob 1.7s ease-in-out infinite',
          }}>
            {caught ? '🐟' : gotaway ? '💨' : bite ? '‼️' : nibble ? '〰️' : '🎣'}
          </span>
        </div>

        <div style={{ font: '800 15px ui-sans-serif, system-ui', color: caught ? (tier === 'clean' ? '#eafcff' : '#7fffd0') : gotaway ? '#f2a58c' : bite ? '#eafcff' : nibble ? '#a7e6c8' : '#9fd6e0', minHeight: 20 }}>
          {caught ? (tier === 'clean' ? '✦ clean catch!' : tier === 'good' ? 'nice catch!' : 'caught!')
            : gotaway ? 'it slipped the line'
            : bite ? 'HOOK IT!'
            : nibble ? '…a nibble…'
            : shown === 'cast' ? 'casting…'
            : 'watch the water…'}
        </div>
        <div style={{ font: '600 10px ui-monospace, monospace', color: '#5a8898', marginTop: 8, letterSpacing: '0.08em' }}>
          {caught || gotaway ? '' : bite ? 'TAP NOW' : 'tap to strike — but only on the real bite'}
        </div>
      </div>
    </div>
  )
}
