'use client'

// A dreamy Ather backdrop — drifting clouds of mana-light + rising motes, all
// CSS, no assets. Deterministic mote layout (seeded) so SSR + client agree.

import { useState } from 'react'
import { mulberry32 } from '@/lib/arcade/rng'

const MOTE_HUES = ['#d8b3f2', '#a6d8f7', '#ffe09a', '#a4e7bb', '#f9a8a2']

export default function AtherBackdrop() {
  // built once, seed-fixed → no hydration mismatch
  const [motes] = useState(() => {
    const r = mulberry32(7)
    return Array.from({ length: 18 }, () => ({
      left: r() * 100,
      size: 2 + r() * 5,
      delay: -r() * 20,
      dur: 12 + r() * 14,
      hue: MOTE_HUES[Math.floor(r() * MOTE_HUES.length)],
      mo: 0.35 + r() * 0.4,
    }))
  })

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
      <style>{`
        @keyframes ather-drift { 0%,100%{ transform:translate(0,0) scale(1) } 50%{ transform:translate(var(--dx),var(--dy)) scale(1.12) } }
        @keyframes ather-rise { 0%{ transform:translateY(0) scale(1); opacity:0 } 12%{ opacity:var(--mo) } 88%{ opacity:var(--mo) } 100%{ transform:translateY(-112vh) scale(1.25); opacity:0 } }
      `}</style>

      {/* deep base */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #1d1338 0%, #130d26 45%, #0a0712 100%)' }} />

      {/* drifting ather-clouds — big soft blobs of mana-light */}
      <div className="absolute rounded-full" style={{ width: '60vw', height: '60vw', top: '-12%', left: '-10%', background: 'radial-gradient(circle, rgba(155,90,210,0.30), transparent 65%)', filter: 'blur(40px)', ['--dx' as string]: '6%', ['--dy' as string]: '4%', animation: 'ather-drift 26s ease-in-out infinite' }} />
      <div className="absolute rounded-full" style={{ width: '55vw', height: '55vw', bottom: '-15%', right: '-12%', background: 'radial-gradient(circle, rgba(55,163,230,0.26), transparent 65%)', filter: 'blur(44px)', ['--dx' as string]: '-5%', ['--dy' as string]: '-4%', animation: 'ather-drift 32s ease-in-out infinite' }} />
      <div className="absolute rounded-full" style={{ width: '40vw', height: '40vw', top: '30%', left: '40%', background: 'radial-gradient(circle, rgba(240,165,38,0.14), transparent 65%)', filter: 'blur(50px)', ['--dx' as string]: '4%', ['--dy' as string]: '-6%', animation: 'ather-drift 38s ease-in-out infinite' }} />

      {/* rising motes */}
      {motes.map((m, i) => (
        <span
          key={i}
          className="absolute rounded-full bottom-0"
          style={{
            left: `${m.left}%`,
            width: m.size,
            height: m.size,
            background: m.hue,
            boxShadow: `0 0 ${m.size * 2.5}px ${m.hue}`,
            filter: 'blur(0.4px)',
            ['--mo' as string]: String(m.mo),
            animation: `ather-rise ${m.dur}s linear ${m.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
