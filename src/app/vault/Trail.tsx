'use client'

// Vault — the crossing's TRAIL, a VERTICAL descent (canon: the myth told in movements, edge→heart of the
// greying — game/vault.md). Going DOWN the list = descending into the grey. Fits a portrait phone (all six
// stack + scroll) instead of the old horizontal row that overflowed the landscape letterbox. Cleared ✦ glow
// gold, the current one pulses cyan, deeper ones locked-grey (the tale not yet told that far). Not distance
// to a goal — there is no goal; the crossing is eternal.

import type { MovementCfg } from './lib/vault'

const ATHER = '#37e6ff'
const GOLD = '#ffd36b'
const GREY = '#71717a'

export default function Trail({
  movements, done, onPlay, onEndless,
}: {
  movements: MovementCfg[]
  done: number
  onPlay: (i: number) => void
  onEndless: () => void
}) {
  const allDone = done >= movements.length
  return (
    <div className="w-full flex flex-col overflow-hidden rounded-md border border-[#d4a843]/20 bg-[#080a12]/70">
      {/* header */}
      <div className="shrink-0 border-b border-white/5 px-4 pt-3 pb-2 text-center">
        <div className="gx-title text-[13px] tracking-[0.3em] uppercase" style={{ color: ATHER, textShadow: `0 0 12px ${ATHER}` }}>The Crossing</div>
        <div className="gx-label text-[8px] tracking-wider text-[#9fd6e0]/50 mt-0.5">
          told in movements · a descent into the grey · <span className="tabular-nums" style={{ color: GOLD }}>{Math.min(done, movements.length)}</span>/{movements.length}
        </div>
      </div>

      {/* the vertical descent — scrollable so all six + the beyond always fit */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" style={{ maxHeight: '48vh' }}>
        {movements.map((m, i) => {
          const state = i < done ? 'cleared' : i === done ? 'current' : 'locked'
          const playable = i <= done
          const color = state === 'cleared' ? GOLD : state === 'current' ? ATHER : GREY
          return (
            <button
              key={m.id}
              type="button"
              disabled={!playable}
              onClick={() => playable && onPlay(i)}
              className={`flex w-full items-stretch gap-3 rounded-md px-2 py-1.5 text-left transition ${playable ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
            >
              {/* left rail: node + the connector line down to the next (the descent) */}
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums ${state === 'current' ? 'animate-pulse' : ''}`}
                  style={{
                    borderColor: color, color: state === 'locked' ? GREY : '#070a12',
                    background: state === 'locked' ? 'transparent' : color,
                    boxShadow: state === 'locked' ? 'none' : `0 0 10px ${color}90`,
                  }}
                >
                  {state === 'cleared' ? '✦' : state === 'locked' ? '🔒' : i + 1}
                </span>
                <span aria-hidden className="mt-1 w-px flex-1" style={{ minHeight: 10, background: i < done ? `${GOLD}66` : `${GREY}40` }} />
              </div>
              {/* body */}
              <div className="flex-1 pb-1.5">
                <div className="gx-label text-[11px] tracking-wide" style={{ color: state === 'locked' ? GREY : '#dff6fb' }}>{m.name}</div>
                <div className="text-[9px] leading-snug mt-0.5" style={{ color: state === 'locked' ? `${GREY}` : 'rgba(159,214,224,0.55)' }}>
                  {state === 'locked' ? 'not yet told' : m.blurb}
                </div>
              </div>
              {playable && (
                <span className="self-center whitespace-nowrap text-[9px] uppercase tracking-wider" style={{ color }}>
                  {state === 'cleared' ? 'replay' : 'play'} ›
                </span>
              )}
            </button>
          )
        })}

        {/* the beyond — the crossing without end, unlocked once the last movement is told */}
        <button
          type="button"
          disabled={!allDone}
          onClick={onEndless}
          className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition ${allDone ? 'cursor-pointer hover:bg-white/5' : 'cursor-default opacity-45'}`}
        >
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] ${allDone ? 'animate-pulse' : ''}`}
            style={{ borderColor: allDone ? ATHER : GREY, color: allDone ? ATHER : GREY, boxShadow: allDone ? `0 0 10px ${ATHER}90` : 'none' }}>
            ∞
          </span>
          <div className="flex-1">
            <div className="gx-label text-[11px] tracking-wide" style={{ color: allDone ? '#dff6fb' : GREY }}>Carry On</div>
            <div className="text-[9px] text-[#9fd6e0]/55 mt-0.5">the crossing without end</div>
          </div>
          {allDone && <span className="self-center whitespace-nowrap text-[9px] uppercase tracking-wider" style={{ color: ATHER }}>enter ›</span>}
        </button>
      </div>

      <div className="shrink-0 border-t border-white/5 px-4 py-1.5 text-center">
        <p className="text-[8px] font-mono tracking-wider text-[#7fd8e6]/35">
          {allDone ? 'the light passes beyond the teller’s sight — carry it on' : 'cross each movement to tell the tale deeper'}
        </p>
      </div>
    </div>
  )
}
