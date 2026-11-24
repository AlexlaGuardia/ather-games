'use client'
// THE GATHER BAR (BETA M136, Alex 11-24: "the visible progress bar should keep track of it"). Up while a node is being worked
// and while the keeper aims at one that is part done this cycle. Numbers and units only.
import { useEffect, useRef, useState } from 'react'

export interface GatherView { id: string; p: number; left: number; need: number; resetMs: number; working: boolean }
export const clock = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

export function GatherBar({ view }: { view: () => GatherView | null }) {
  const [v, setV] = useState<GatherView | null>(null)
  const get = useRef(view); get.current = view
  useEffect(() => { const id = setInterval(() => setV(get.current()), 100); return () => clearInterval(id) }, [])
  if (!v) return null
  return (
    <div data-gather-bar={v.id} data-p={v.p.toFixed(4)} data-working={v.working ? '1' : '0'} style={{ position: 'fixed', left: '50%', bottom: 150, transform: 'translateX(-50%)', width: 'min(300px, 62vw)', zIndex: 60, pointerEvents: 'none', font: '600 12px system-ui, sans-serif', color: '#f4ecd2', textShadow: '0 1px 2px #000' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
        <span>{Math.floor(v.p * 100)}% · {v.left} mana left</span><span>resets {clock(v.resetMs)}</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: 'rgba(12,16,20,0.72)', border: '1px solid rgba(244,236,210,0.35)', overflow: 'hidden' }}>
        <div style={{ width: `${(v.p * 100).toFixed(2)}%`, height: '100%', background: v.working ? 'linear-gradient(90deg,#7fc7e8,#e9f6ff)' : 'rgba(127,199,232,0.6)' }} />
      </div>
    </div>
  )
}
