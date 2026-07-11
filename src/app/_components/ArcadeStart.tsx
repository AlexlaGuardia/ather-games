'use client'

// ARCADE START — the cabinet's START control. A chunky, attract-pulsing "▶ START" button for a
// game's ready screen, plus a keyboard hook (Enter / Space) so desktop players don't have to reach
// for the mouse. Decouples "begin the run" from "first movement input": games used to launch on the
// first direction press, which on maze/coast games instantly locked in a heading with no beat to read
// the board. Drop <StartButton> into the ready overlay + call useStartKey, point both at the game's
// start() (flip ready -> playing WITHOUT committing a direction). Shared like <ArcadeCabinet>.

import { useEffect } from 'react'

function hexRgb(hex: string): string {
  const h = hex.replace('#', '')
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(f, 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/** Enter / Space launch the run. `enabled` should track the ready state so it only fires pre-play. */
export function useStartKey(onStart: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); onStart() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onStart, enabled])
}

export function StartButton({
  accent = '#37e6ff',
  onStart,
  label = 'START',
  hint = 'or press Enter',
}: {
  accent?: string
  onStart: () => void
  label?: string
  hint?: string
}) {
  const rgb = hexRgb(accent)
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1.5">
      <style>{`@keyframes asStartPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.28)}}`}</style>
      <button
        onClick={onStart}
        className="gx-label select-none px-8 py-2.5 rounded-[3px] text-[14px] tracking-[0.28em] uppercase font-bold active:translate-y-[2px] transition-transform"
        style={{
          color: '#05060f',
          background: `rgb(${rgb})`,
          boxShadow: `0 4px 0 rgba(${rgb},0.32), 0 7px 18px rgba(0,0,0,0.5), 0 0 22px rgba(${rgb},0.7)`,
          textShadow: '0 1px 1px rgba(255,255,255,0.35)',
          animation: 'asStartPulse 1.8s ease-in-out infinite',
        }}
      >
        ▶ {label}
      </button>
      <span className="text-[9px] font-mono tracking-[0.18em] uppercase" style={{ color: `rgba(${rgb},0.5)` }}>{hint}</span>
    </div>
  )
}
