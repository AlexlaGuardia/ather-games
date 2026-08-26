// resource-bars.tsx — health and shield, bottom-left.
//
// ★ EXTRACTED 2026-08-26 so `dev/hud` can mount the REAL bars rather than a replica, for the same
// reason `hud-corner.tsx` was: a preview that re-derives can be perfectly correct while the game is
// wrong, which is the exact failure a preview exists to catch (`dev/icons`' own header).
//
// ⚠ THE PLATE IS A SCAR, NOT A STYLE CHOICE — see the note on the markup. Read it before restyling.

'use client'

import React, { useEffect, useRef } from 'react'
import type { Vitals } from '../engine/vitals'

export function ResourceBars({ vitals }: { vitals: React.RefObject<Vitals> }) {
  const hpEl = useRef<HTMLDivElement>(null)
  const shEl = useRef<HTMLDivElement>(null)
  const hpTxt = useRef<HTMLSpanElement>(null)
  const shTxt = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const id = setInterval(() => {
      const v = vitals.current
      if (!v) return
      // ── ★ ONE BAR, TWO QUANTITIES, AND THE SCALE IS HEALTH (Alex, 2026-08-26) ──────────────
      // Both fills are measured against `hpMax`, NOT against their own maxima. That is the whole
      // reason a single bar can carry both honestly: the shield is drawn as the buffer it is,
      // sitting over the health it protects, and a full shield that is half your health looks like
      // half your health. Scaling each to its own max would put two 100%s side by side and imply a
      // parity the sim does not have.
      const max = v.hpMax || 1
      if (hpEl.current) hpEl.current.style.width = `${Math.max(0, (v.hp / max) * 100)}%`
      if (shEl.current) shEl.current.style.width = `${Math.max(0, Math.min(1, v.shield / max)) * 100}%`
      // ⚠ Rounded for display only, and written to textContent rather than through state — the pool
      // is fractional because regen ticks per frame, and a readout that flickers between 41 and 42
      // twice a second is noise wearing the costume of data. Same call `ManaGauge` documents.
      if (hpTxt.current) { const t = `${Math.round(v.hp)}`; if (hpTxt.current.textContent !== t) hpTxt.current.textContent = t }
      // The shield reads as a bonus because that is what it is — "+40" spent before a wound, not a
      // second pool competing with the first. Hidden entirely at zero rather than shown as "+0",
      // which would be a permanent readout of a thing you do not have.
      if (shTxt.current) {
        const t = v.shield > 0.5 ? `+${Math.round(v.shield)}` : ''
        if (shTxt.current.textContent !== t) shTxt.current.textContent = t
      }
    }, 100)
    return () => clearInterval(id)
  }, [vitals])

  return (
    // ⚠ NO LONGER SELF-POSITIONED — the corner is one column and a component that pins itself
    // cannot be stacked. The corner belongs to whoever owns the corner.
    <div className="w-52 rounded bg-black/60 p-2 ring-1 ring-white/15
                    flex flex-col gap-1 pointer-events-none font-mono">
      <div className="flex items-baseline gap-2">
        <span className="gx-label text-[8px] tracking-[0.18em] text-rose-200/50">HEALTH</span>
        <span ref={shTxt} className="gx-value ml-auto text-[10px] tabular-nums text-sky-200/85" />
        <span ref={hpTxt} className="gx-value text-[12px] tabular-nums text-rose-100/90">0</span>
      </div>
      {/* ★ ONE BAR. Health is the fill; the shield is an overlay ON TOP OF IT, from the same left
          edge, because that is the order a hit is spent — the shield soaks and only the spill
          reaches health (`engine/vitals.ts` › `damage`). Stacking it this way means the blue you
          can see is exactly the part of your health a hit will not reach yet.
          ⚠ The shield layer is `absolute` over the health layer rather than beside it. Side by side
          would read as two pools that add up, which is the opposite of what the sim does. */}
      <div className="relative h-[16px] rounded-sm bg-black/60 overflow-hidden">
        <div ref={hpEl} className="absolute inset-y-0 left-0 bg-rose-400 transition-[width] duration-100" style={{ width: '100%' }} />
        <div ref={shEl} className="absolute inset-y-0 left-0 bg-sky-300/70 border-r border-sky-100/60
                                   transition-[width] duration-100" style={{ width: '100%' }} />
      </div>
    </div>
  )
}
