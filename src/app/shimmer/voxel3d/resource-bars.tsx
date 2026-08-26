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
  useEffect(() => {
    const id = setInterval(() => {
      const v = vitals.current
      if (!v) return
      if (hpEl.current) hpEl.current.style.width = `${Math.max(0, (v.hp / (v.hpMax || 1)) * 100)}%`
      if (shEl.current) shEl.current.style.width = `${Math.max(0, (v.shield / (v.shieldMax || 1)) * 100)}%`
    }, 100)
    return () => clearInterval(id)
  }, [vitals])
  return (
    // ★ A PLATE, NOT BARE BARS. The first cut drew these straight onto the canvas and the health bar
    // was EMERALD — a green bar on a green world, which vanished into the grass in the very first
    // screenshot. The style guide's rule is not decoration: text and readouts never sit raw on a
    // scene, because the scene is the one thing whose colour you do not control. Dark plate, and
    // health goes warm so the two bars can never be confused with each other or with the ground.
    <div className="absolute bottom-4 left-4 w-44 rounded bg-black/45 p-1.5 ring-1 ring-white/10
                    flex flex-col gap-1 pointer-events-none font-mono">
      {/* Shield above health, in the order a fight actually spends them. */}
      <div className="h-[6px] rounded-sm bg-black/60 overflow-hidden">
        <div ref={shEl} className="h-full bg-sky-300 transition-[width] duration-100" style={{ width: '100%' }} />
      </div>
      <div className="h-[6px] rounded-sm bg-black/60 overflow-hidden">
        <div ref={hpEl} className="h-full bg-rose-400 transition-[width] duration-100" style={{ width: '100%' }} />
      </div>
    </div>
  )
}
