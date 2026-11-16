'use client'
// THE REEL BAR: what the give-and-take reads like (rinning.ts). Only while a rinn is on the line: how far in it is, how
// tight the line is, and what it is doing right now (PULLING: let go · RESTING: hold to draw it in). Nothing here can be
// lost; a line pulled too tight only lets the rinn take some back.

import { useEffect, useState, type MutableRefObject } from 'react'
import type { RinningApi } from './rinning-fx'

export function ReelBar({ api }: { api: MutableRefObject<RinningApi | null> }) {
  const [v, setV] = useState<ReturnType<RinningApi['view']> | null>(null)
  useEffect(() => {
    let id = 0, last = 0
    const loop = (t: number) => { if (t - last > 60) { last = t; setV(api.current?.view() ?? null) } id = requestAnimationFrame(loop) }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [api])
  const r = v?.phase === 'reeling' ? v.reel : null
  if (!r) return null
  const pull = r.mood === 'pull'
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 150, transform: 'translateX(-50%)', width: 'min(360px, 80vw)', zIndex: 60, pointerEvents: 'none', font: '600 13px system-ui, sans-serif', color: '#f4ecd2', textShadow: '0 1px 2px #000' }}>
      <div style={{ textAlign: 'center', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', color: pull ? '#ffd27a' : '#bdf0c8' }}>
        {pull ? 'It pulls · let go' : 'It rests · hold to reel'}
      </div>
      {/* how far in */}
      <div style={{ height: 10, borderRadius: 6, background: 'rgba(12,16,20,0.7)', overflow: 'hidden', border: '1px solid rgba(244,236,210,0.35)' }}>
        <div style={{ width: `${Math.round(r.progress * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#7fc7e8,#e9f6ff)' }} />
      </div>
      {/* how tight */}
      <div style={{ height: 6, marginTop: 5, borderRadius: 4, background: 'rgba(12,16,20,0.7)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(r.tension * 100)}%`, height: '100%', background: r.tension > 0.75 ? '#e8735a' : '#e8c95a', transition: 'width 60ms linear' }} />
      </div>
    </div>
  )
}
