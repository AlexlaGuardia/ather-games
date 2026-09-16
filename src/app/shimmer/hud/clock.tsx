// hud/clock.tsx — the keeper's day dial, top-right. ONE clock for both dimensions.
//
// ★ THE HUD IS A KEEPER LAYER, NOT AN ENGINE LAYER (Alex, 2026-09-15: "update the UI to the voxel
// version"). The Ather (voxel3d) and the mortal side (play3d) are two engines under one keeper, and
// the chrome the keeper reads must be the same object in both — the `hud-corner.tsx` rule, applied
// to the whole HUD: one dialect, both worlds import it, nothing to drift. Both engines already read
// `engine/day-cycle`, so the dial was always showing the same hour; it just showed it twice.
//
// Moved verbatim out of `VoxelWorld.tsx` (2026-09-16). `note` is the one addition: the mortal side's
// zones re-deal on a clock and its old chip warned about it; that warning is content, this is chrome.

'use client'

import React, { useEffect, useState } from 'react'
import { dayProgress, getPhase, getDisplayTime, isTimePinned } from '../engine/day-cycle'

/**
 * `placed` (default) pins the dial to the top-right corner itself; `placed={false}` renders it
 * in flow so a host can stack it in its own column (play3d hangs it left of the minimap).
 */
export function Clock({ note, placed = true }: { note?: React.ReactNode; placed?: boolean } = {}) {
  const [now, setNow] = useState(() => dayProgress())
  useEffect(() => {
    const t = setInterval(() => setNow(dayProgress()), 1000)
    return () => clearInterval(t)
  }, [])
  const phase = getPhase(now)
  // ✦ not ☾ at night: the Ather has NO MOON (Alex ruling 2026-08-08, CANON_GAPS has the open
  // "what silvers the night" question). A crescent on the HUD would assert a body the sky refuses.
  const glyph = phase === 'night' ? '✦' : phase === 'day' ? '☀' : phase === 'dawn' ? '🌅' : '🌇'
  const DIAL = 60             // dial diameter, px
  const R = DIAL / 2 - 9      // marker orbit radius — kept inside the rim
  const theta = now * 2 * Math.PI
  const markerTop = DIAL / 2 + R * Math.cos(theta) - 7   // -7 centers the ~14px glyph
  const markerLeft = DIAL / 2 + R * Math.sin(theta) - 7
  return (
    <div className={`${placed ? 'absolute top-3 right-3' : 'relative'} flex flex-col items-center pointer-events-none`}>
      <div className="relative rounded-full border border-white/20 bg-black/45" style={{ width: DIAL, height: DIAL }}>
        <span className="absolute text-[13px] leading-none" style={{ top: markerTop, left: markerLeft }}>{glyph}</span>
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono tabular-nums text-white/85">
          {getDisplayTime(now)}
        </div>
      </div>
      <div className="mt-1 px-1.5 py-0.5 rounded border border-white/15 bg-black/45 text-[9px] font-mono text-white/60 whitespace-nowrap">
        {phase}
        {isTimePinned() && <span className="ml-1.5 text-amber-300/90">PINNED</span>}
      </div>
      {note}
    </div>
  )
}
