'use client'

// Vault — the crossing's TRAIL, now TWO-TIER (canon: the descent, areas = the looks — game/vault.md):
//   areas view  → a vertical descent of the 6 areas (each a stretch of the greying), with progress.
//   levels view → tap an area → a grid of its levels (10 now, ~100 later), beat them in order to advance.
// Linear unlock. This is a MENU, rendered full-height (not the landscape game letterbox).

import type { AreaCfg } from './lib/vault'

const ATHER = '#37e6ff'
const GOLD = '#ffd36b'
const GREY = '#71717a'

export default function Trail({
  areas, levelsPerArea, progress, view, selArea,
  onOpenArea, onBackToAreas, onPlayLevel, onEndless,
}: {
  areas: AreaCfg[]
  levelsPerArea: number
  progress: number[]
  view: 'areas' | 'levels'
  selArea: number
  onOpenArea: (a: number) => void
  onBackToAreas: () => void
  onPlayLevel: (a: number, i: number) => void
  onEndless: () => void
}) {
  const done = (a: number) => (progress[a] ?? 0) >= levelsPerArea
  const unlocked = (a: number) => a === 0 || done(a - 1)
  const allDone = areas.every((_, a) => done(a))

  // ── LEVELS VIEW ───────────────────────────────────────────────────────────────────
  if (view === 'levels') {
    const area = areas[selArea]
    const cleared = progress[selArea] ?? 0
    return (
      <div className="flex w-full flex-col overflow-hidden rounded-md border bg-[#080a12]/70" style={{ borderColor: `${area.accent}33` }}>
        <div className="relative shrink-0 border-b border-white/5 px-4 pt-3 pb-2 text-center">
          <button onClick={onBackToAreas} className="absolute left-3 top-3 gx-label text-[10px] tracking-wider text-[#7fe9ff]/60 hover:text-[#7fe9ff]">‹ areas</button>
          <div className="gx-title text-[13px] tracking-[0.25em] uppercase" style={{ color: area.accent, textShadow: `0 0 12px ${area.accent}` }}>{area.name}</div>
          <div className="gx-label text-[8px] tracking-wider text-[#9fd6e0]/50 mt-0.5">{area.blurb} · <span className="tabular-nums" style={{ color: GOLD }}>{Math.min(cleared, levelsPerArea)}</span>/{levelsPerArea}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" style={{ maxHeight: '46vh' }}>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: levelsPerArea }).map((_, i) => {
              const isDone = i < cleared
              const isCurrent = i === cleared
              const playable = i <= cleared
              const color = isDone ? GOLD : isCurrent ? area.accent : GREY
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!playable}
                  onClick={() => playable && onPlayLevel(selArea, i)}
                  className={`flex aspect-square items-center justify-center rounded-md border font-mono text-[13px] tabular-nums transition ${isCurrent ? 'animate-pulse' : ''} ${playable ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
                  style={{
                    borderColor: color,
                    color: isDone ? '#070a12' : playable ? '#e8feff' : GREY,
                    background: isDone ? color : 'transparent',
                    boxShadow: playable && !isDone ? `0 0 8px ${color}70` : 'none',
                  }}
                  aria-label={`level ${i + 1}${isDone ? ' cleared' : isCurrent ? ' — play' : ' locked'}`}
                >
                  {isDone ? '✦' : playable ? i + 1 : '🔒'}
                </button>
              )
            })}
          </div>
        </div>
        <div className="shrink-0 border-t border-white/5 px-4 py-1.5 text-center">
          <p className="text-[8px] font-mono tracking-wider text-[#7fd8e6]/35">beat each level to unlock the next · clear the area to descend</p>
        </div>
      </div>
    )
  }

  // ── AREAS VIEW (the descent) ──────────────────────────────────────────────────────
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-md border border-[#d4a843]/20 bg-[#080a12]/70">
      <div className="shrink-0 border-b border-white/5 px-4 pt-3 pb-2 text-center">
        <div className="gx-title text-[13px] tracking-[0.3em] uppercase" style={{ color: ATHER, textShadow: `0 0 12px ${ATHER}` }}>The Crossing</div>
        <div className="gx-label text-[8px] tracking-wider text-[#9fd6e0]/50 mt-0.5">a descent into the grey · choose a stretch</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" style={{ maxHeight: '48vh' }}>
        {areas.map((area, a) => {
          const state = done(a) ? 'cleared' : unlocked(a) ? 'current' : 'locked'
          const open = unlocked(a)
          const color = state === 'cleared' ? GOLD : state === 'current' ? area.accent : GREY
          const cleared = Math.min(progress[a] ?? 0, levelsPerArea)
          return (
            <button
              key={area.id}
              type="button"
              disabled={!open}
              onClick={() => open && onOpenArea(a)}
              className={`flex w-full items-stretch gap-3 rounded-md px-2 py-1.5 text-left transition ${open ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
            >
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums ${state === 'current' ? 'animate-pulse' : ''}`}
                  style={{ borderColor: color, color: state === 'locked' ? GREY : '#070a12', background: state === 'locked' ? 'transparent' : color, boxShadow: state === 'locked' ? 'none' : `0 0 10px ${color}90` }}
                >
                  {state === 'cleared' ? '✦' : state === 'locked' ? '🔒' : a + 1}
                </span>
                <span aria-hidden className="mt-1 w-px flex-1" style={{ minHeight: 10, background: done(a) ? `${GOLD}66` : `${GREY}40` }} />
              </div>
              <div className="flex-1 pb-1.5">
                <div className="gx-label text-[11px] tracking-wide" style={{ color: state === 'locked' ? GREY : '#dff6fb' }}>{area.name}</div>
                <div className="text-[9px] leading-snug mt-0.5" style={{ color: state === 'locked' ? GREY : 'rgba(159,214,224,0.55)' }}>
                  {state === 'locked' ? 'not yet reached' : area.blurb}
                </div>
              </div>
              {open && (
                <span className="self-center whitespace-nowrap font-mono text-[9px] tabular-nums" style={{ color }}>{cleared}/{levelsPerArea} ›</span>
              )}
            </button>
          )
        })}
        <button
          type="button"
          disabled={!allDone}
          onClick={onEndless}
          className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition ${allDone ? 'cursor-pointer hover:bg-white/5' : 'cursor-default opacity-45'}`}
        >
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] ${allDone ? 'animate-pulse' : ''}`}
            style={{ borderColor: allDone ? ATHER : GREY, color: allDone ? ATHER : GREY, boxShadow: allDone ? `0 0 10px ${ATHER}90` : 'none' }}>∞</span>
          <div className="flex-1">
            <div className="gx-label text-[11px] tracking-wide" style={{ color: allDone ? '#dff6fb' : GREY }}>Carry On</div>
            <div className="text-[9px] text-[#9fd6e0]/55 mt-0.5">the crossing without end</div>
          </div>
          {allDone && <span className="self-center whitespace-nowrap text-[9px] uppercase tracking-wider" style={{ color: ATHER }}>enter ›</span>}
        </button>
      </div>
      <div className="shrink-0 border-t border-white/5 px-4 py-1.5 text-center">
        <p className="text-[8px] font-mono tracking-wider text-[#7fd8e6]/35">{allDone ? 'the light passes beyond the teller’s sight' : 'clear each stretch to descend'}</p>
      </div>
    </div>
  )
}
