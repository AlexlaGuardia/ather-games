'use client'

// cast-gauges.tsx — is the tactical ready? is the signature ready?
//
// ★ WHY THIS DID NOT EXIST UNTIL 2026-08-26, WHICH IS THE INTERESTING PART. Cooldowns have been
// fully tracked since the cast port: `castCd` holds a `performance.now()` deadline per band and
// `resolveCast` refuses a cast that is still cooling with a spoken reason. But the only place a
// keeper could SEE a cooldown was the loadout tab inside the bag — a panel you open while nothing
// is happening. In the fight, the state was invisible: you pressed Z, something declined, and the
// only feedback was a line of text. Alex: "so the player can actively see when they are on cooldown
// or ready."
//
// ⚠ IT READS THE SAME `cooldownUntil` THE DISPATCHER WRITES, and derives the fraction from the
// move's own `cooldownMs`. Nothing here keeps its own clock or its own copy of the duration — a
// second timer would drift from the one that actually refuses the cast, and the gauge would say
// READY while the world said no. That is the mirror failure this codebase has now catalogued a
// dozen times.
//
// ⚠ AND IT POLLS A REF RATHER THAN RE-RENDERING. A cooldown sweep at 60fps through React state is
// ~120 renders of the whole HUD per cast. Same discipline as `ManaGauge` and `ResourceBars`: read
// the ref on an interval, write the style directly.

import React, { useEffect, useRef } from 'react'
import { castForMove, ALL_BANDS, BAND_KEYS } from '../play3d/cast'
import { moveById } from '../play3d/keeper-moves'

export interface CastHud {
  /** bound move id per band, or null — the same array shape `loadout` holds */
  ids: (string | null)[]
  /** `performance.now()` deadline per band; <= now means ready */
  until: number[]
}

/** What each band is called on screen. Canon calls the ultimate a SIGNATURE. */
const BAND_LABEL: Record<string, string> = { tactical: 'TACTICAL', ultimate: 'SIGNATURE' }

export function CastGauges({ cast }: { cast: React.RefObject<CastHud | null> }) {
  const fills = useRef<(HTMLDivElement | null)[]>([])
  const names = useRef<(HTMLDivElement | null)[]>([])
  const wraps = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const id = setInterval(() => {
      const c = cast.current
      if (!c) return
      const now = performance.now()
      ALL_BANDS.forEach((_, i) => {
        const moveId = c.ids[i] ?? null
        const spec = moveId ? castForMove(moveId) : null
        const total = spec?.cooldownMs ?? 0
        const left = Math.max(0, (c.until[i] ?? 0) - now)
        // ⚠ A move with NO cooldown is always ready and must read as FULL, not as empty. `left/total`
        // with total 0 is NaN, and NaN width silently renders as nothing — a permanently empty gauge
        // on the one move that is never unavailable.
        const pct = total > 0 ? Math.max(0, Math.min(1, 1 - left / total)) : 1
        const f = fills.current[i]
        if (f) f.style.width = `${pct * 100}%`
        const w = wraps.current[i]
        if (w) w.style.opacity = moveId ? (left > 0 ? '0.55' : '1') : '0.3'
        const n = names.current[i]
        if (n) {
          const label = moveId ? (moveById(moveId)?.name ?? moveId) : '— empty —'
          if (n.textContent !== label) n.textContent = label
        }
      })
    }, 60)
    return () => clearInterval(id)
  }, [cast])

  return (
    <div className="flex flex-col gap-1.5 font-mono pointer-events-none">
      {ALL_BANDS.map((kind, i) => (
        <div key={kind} ref={el => { wraps.current[i] = el }}
             className="w-52 rounded bg-black/45 ring-1 ring-white/10 px-2 py-1.5 transition-opacity duration-150">
          <div className="flex items-baseline gap-2">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border
                             border-white/25 text-[9px] font-bold text-white/70">
              {(BAND_KEYS[i] ?? '?').toUpperCase()}
            </span>
            <span className="gx-label text-[8px] tracking-[0.18em] text-white/35">{BAND_LABEL[kind] ?? kind.toUpperCase()}</span>
            <div ref={el => { names.current[i] = el }} className="gx-value ml-auto truncate text-[10px] text-amber-100/80" />
          </div>
          {/* The sweep. Fills as the cooldown runs down, so FULL means ready — a gauge that emptied
              toward ready would read as "running out" at the exact moment it becomes usable. */}
          <div className="mt-1 h-[7px] rounded-sm bg-black/60 overflow-hidden">
            <div ref={el => { fills.current[i] = el }}
                 className="h-full bg-amber-300/80" style={{ width: '100%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
