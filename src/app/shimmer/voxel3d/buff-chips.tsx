'use client'
// The live-buff strip (2026-09-15) — one chip per drink still running, soonest to end last.
//
// Reads the ref on a one-second beat rather than subscribing: a buff is a wall-clock timer, so the
// only thing that changes between beats is the countdown, and a re-render per frame would cost the
// HUD the frames the world needs. Bottom-left, above the vitals, so the corner that already says
// "how you are" also says "what you drank". Renders nothing at all when nothing is running.
import React, { useEffect, useState } from 'react'
import { activeBuffList, type ActiveBuffs } from '../engine/potion-effects'
import { WIRED_BUFFS } from './consume'

export function BuffChips({ buffs }: { buffs: React.RefObject<ActiveBuffs> }) {
  const [, setBeat] = useState(0)
  useEffect(() => {
    const h = setInterval(() => setBeat(b => b + 1), 1000)
    return () => clearInterval(h)
  }, [])
  const live = activeBuffList(buffs.current ?? {}, Date.now())
  if (!live.length) return null
  return (
    <div className="absolute bottom-28 left-4 flex flex-col gap-1 pointer-events-none font-mono text-[11px]">
      {live.map(b => {
        const m = Math.floor(b.remainMs / 60_000), sec = Math.floor((b.remainMs % 60_000) / 1000)
        const felt = WIRED_BUFFS.has(b.id)
        return (
          <div key={b.id} className="flex items-center gap-2 rounded border border-white/12 bg-black/45 px-2 py-1"
               style={{ color: b.color, opacity: felt ? 1 : 0.55 }} title={felt ? b.name : `${b.name} — not felt here yet`}>
            <span>{b.glyph}</span>
            <span className="tracking-[.12em] uppercase">{b.name}</span>
            <span className="text-white/45 tabular-nums">{m}:{String(sec).padStart(2, '0')}</span>
          </div>
        )
      })}
    </div>
  )
}
