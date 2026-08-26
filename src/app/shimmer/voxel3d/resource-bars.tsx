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
      if (hpEl.current) hpEl.current.style.width = `${Math.max(0, (v.hp / (v.hpMax || 1)) * 100)}%`
      if (shEl.current) shEl.current.style.width = `${Math.max(0, (v.shield / (v.shieldMax || 1)) * 100)}%`
      // ⚠ Rounded for display only, and written to textContent rather than through state — the pool
      // is fractional because regen ticks per frame, and a readout that flickers between 41 and 42
      // twice a second is noise wearing the costume of data. Same call `ManaGauge` documents.
      if (hpTxt.current) { const t = `${Math.round(v.hp)}`; if (hpTxt.current.textContent !== t) hpTxt.current.textContent = t }
      if (shTxt.current) { const t = `${Math.round(v.shield)}`; if (shTxt.current.textContent !== t) shTxt.current.textContent = t }
    }, 100)
    return () => clearInterval(id)
  }, [vitals])
  return (
    // ★ A PLATE, NOT BARE BARS. The first cut drew these straight onto the canvas and the health bar
    // was EMERALD — a green bar on a green world, which vanished into the grass in the very first
    // screenshot. The style guide's rule is not decoration: text and readouts never sit raw on a
    // scene, because the scene is the one thing whose colour you do not control. Dark plate, and
    // health goes warm so the two bars can never be confused with each other or with the ground.
    // ⚠ NO LONGER SELF-POSITIONED. It used to carry `absolute bottom-4 left-4`; the cast gauges now
    // stack above it in one bottom-left column, and a component that pins itself cannot be stacked.
    // The corner belongs to whoever owns the corner.
    <div className="w-52 rounded bg-black/45 p-2 ring-1 ring-white/10
                    flex flex-col gap-1.5 pointer-events-none font-mono">
      {/* ★ SHIELD ABOVE HEALTH, IN THE ORDER A FIGHT SPENDS THEM — and now they are drawn as the
          different things they are rather than two identical strips in two hues. The shield SOAKS
          and the spill reaches health (`engine/vitals.ts` › `damage`), which is the entire reason
          there are two; a keeper reading them should be able to tell which one is the buffer.
          ⚠ Thicker on Alex's call (6px was "small and thin" beside a 152px vessel), and the labels
          are what let a number exist at all: "some health" is not a readout. */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="gx-label text-[8px] tracking-[0.18em] text-sky-200/50">SHIELD</span>
          <span ref={shTxt} className="gx-value ml-auto text-[10px] tabular-nums text-sky-100/80">0</span>
        </div>
        <div className="mt-0.5 h-[10px] rounded-sm bg-black/60 overflow-hidden">
          <div ref={shEl} className="h-full bg-sky-300 transition-[width] duration-100" style={{ width: '100%' }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="gx-label text-[8px] tracking-[0.18em] text-rose-200/50">HEALTH</span>
          <span ref={hpTxt} className="gx-value ml-auto text-[10px] tabular-nums text-rose-100/85">0</span>
        </div>
        {/* Health reads heavier than shield on purpose: it is the one you cannot get back by waiting. */}
        <div className="mt-0.5 h-[14px] rounded-sm bg-black/60 overflow-hidden">
          <div ref={hpEl} className="h-full bg-rose-400 transition-[width] duration-100" style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  )
}
