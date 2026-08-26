'use client'
import React, { useEffect, useRef } from 'react'

/**
 * The mana gauge — a round vessel that fills like water in a bottle (Alex's call, 2026-08-26).
 *
 * ── ★ THIS IS THE FIRST TIME MANA IS VISIBLE AT ALL ─────────────────────────────────────────────
 * Not a restyle. `mana` has been a ref in `VoxelWorld` spending on brewing, casting and gathering —
 * `brewPotion` subtracts `def.manaCost`, `engine/mana.ts` derives pool and regen off the mana skill
 * — and NOTHING on the HUD ever drew it. The keeper has been spending a resource they could not
 * see. That is why this lands as a gauge rather than a third bar: a resource nobody could read at
 * all deserves the shape that says what it is.
 *
 * ★ A LEVEL, NOT AN ARC. A radial sweep is the reflex for a round meter and it is wrong here: an
 * arc reads as PROGRESS (the tool sockets already use one for XP, right next door, and two radial
 * sweeps side by side would say the same thing about different quantities). A liquid LEVEL reads as
 * a quantity held — how much is in the vessel — which is what mana is. It also cannot be confused
 * with the XP rings orbiting above it.
 *
 * ⚠ POLLED, NOT RE-RENDERED — the same rule `ResourceBars` and `Clock` already follow in this HUD.
 * `mana` is a ref the frame loop writes; routing it through React state would re-render the HUD on
 * every regen tick. This reads on a 10 Hz interval and writes the transform directly. 10 Hz is well
 * under a frame and well over the eye.
 *
 * ★ THE COLOURS ARE THE WORLD'S, READ OFF THE SHIPPED `raw_mana_shard` ICON — #604983 deep and
 * #8060b0 light, its two most-used violets. Mana is violet in the ground and it is violet here, and
 * neither can drift toward the other's idea of the colour because only one of them chose.
 */

const D = 76                    // gauge diameter, px
const INNER = 32                // liquid radius — inside the rim
const TOP = D / 2 - INNER       // y of a full vessel
const RUN = INNER * 2           // travel from full to empty

const DEEP = '#604983'
const LIGHT = '#8060b0'

/**
 * Fraction of the pool that is full, 0..1.
 *
 * ⚠⚠ `max` IS GENUINELY ZERO AT MOUNT AND THAT IS NOT A DEFENSIVE GUARD. `VoxelWorld` creates the
 * pool as `useRef({ cur: 0, max: 0, regen: 1 })` and only fills `max` in a later effect, once the
 * mana skill level and the birth-affinity bonus are both known. So the first frames of every
 * session divide by zero, and `0/0` is NaN — which does not throw, does not log, and renders as a
 * `translateY(NaNpx)` the browser silently discards. The vessel would sit full-looking and frozen
 * for anyone whose affinity effect ran a beat late, and nothing anywhere would say so.
 *
 * Exported so the level is a pure function with a test, rather than arithmetic buried in an
 * interval callback where only a human staring at the HUD could catch it being wrong.
 */
export const manaFraction = (cur: number, max: number): number =>
  max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0

/** Pixels the liquid body slides down for a given fill. 0 = brimming, RUN = empty. */
export const levelOffset = (pct: number): number => (1 - manaFraction(pct, 1)) * RUN

export function ManaGauge({ mana }: { mana: React.RefObject<{ cur: number; max: number; regen: number } | null> }) {
  const liquid = useRef<SVGGElement>(null)
  const value = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => {
      const m = mana.current
      if (!m) return
      const pct = manaFraction(m.cur, m.max)
      // The whole liquid body slides down as the vessel empties; the wave rides on top of it.
      if (liquid.current) liquid.current.style.transform = `translateY(${levelOffset(pct).toFixed(2)}px)`
      // ⚠ Rounded for display only. The pool is fractional because regen ticks per frame, and a
      // readout that jitters between 41 and 42 twice a second is noise wearing the costume of data.
      if (value.current) value.current.textContent = String(Math.floor(m.cur))
    }, 100)
    return () => clearInterval(id)
  }, [mana])

  return (
    <div className="relative pointer-events-none select-none" style={{ width: D, height: D }}>
      {/* ★ THE PLATE IS NOT DECORATION. The style guide's rule — text and readouts never sit raw on
          a scene — is the one this HUD has already been bitten by twice: an emerald health bar that
          vanished into grass, and four tool sockets that read as "translucent green shapes" once
          their backing was dimmed. A violet vessel over a lit meadow needs its own dark ground. */}
      <svg viewBox={`0 0 ${D} ${D}`} width={D} height={D} className="absolute inset-0">
        <defs>
          <clipPath id="mana-vessel">
            <circle cx={D / 2} cy={D / 2} r={INNER} />
          </clipPath>
          <linearGradient id="mana-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LIGHT} />
            <stop offset="100%" stopColor={DEEP} />
          </linearGradient>
        </defs>

        <circle cx={D / 2} cy={D / 2} r={INNER + 4} fill="rgba(0,0,0,0.55)" />
        <circle cx={D / 2} cy={D / 2} r={INNER} fill="rgba(0,0,0,0.5)" />

        <g clipPath="url(#mana-vessel)">
          {/* Outer g: the LEVEL, written from the poll. Inner g: the DRIFT, pure CSS.
              ⚠ They are nested rather than combined because they are two transforms on one element
              and the last writer would win — the level would stutter every time the wave animated,
              or the wave would freeze every poll. */}
          <g ref={liquid} style={{ transform: `translateY(${RUN}px)`, transition: 'transform 120ms linear' }}>
            <g className="mana-drift">
              {/* Two waves, different phase and opacity, so the surface has depth rather than
                  reading as one sliding line. Each path is TWICE the vessel wide and the animation
                  slides it exactly one vessel, so the loop has no seam. */}
              <path d={`M -${D} ${TOP} q ${D / 4} -5 ${D / 2} 0 t ${D / 2} 0 t ${D / 2} 0 t ${D / 2} 0 V ${D + RUN} H -${D} Z`}
                    fill="url(#mana-body)" />
              <path d={`M -${D} ${TOP + 2} q ${D / 4} 5 ${D / 2} 0 t ${D / 2} 0 t ${D / 2} 0 t ${D / 2} 0 V ${D + RUN} H -${D} Z`}
                    fill={LIGHT} opacity="0.45" />
            </g>
          </g>
        </g>

        <circle cx={D / 2} cy={D / 2} r={INNER} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      </svg>

      {/* The readout sits ON the vessel, centre, tabular so the digits do not dance as it drains. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <div ref={value} className="gx-value font-mono tabular-nums text-[15px] text-white/95"
             style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>0</div>
        <div className="gx-label font-mono text-[8px] mt-0.5 text-white/55" style={{ letterSpacing: '0.18em' }}>MANA</div>
      </div>

      {/* Scoped keyframes. NOT in `gameui.css`: that file is the shared house layer every other game
          loads, and a vessel-specific drift belongs to the vessel. */}
      <style>{`
        @keyframes mana-drift-x { from { transform: translateX(0) } to { transform: translateX(${D}px) } }
        .mana-drift { animation: mana-drift-x 4.5s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .mana-drift { animation: none } }
      `}</style>
    </div>
  )
}
