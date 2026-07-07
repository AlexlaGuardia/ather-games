'use client'

// Vault — the crossing's TRAIL. A left→right descent of the told movements (canon: the myth told in
// movements, a descent from the edge of the greying toward its heart — game/vault.md). Cleared nodes glow
// gold-cyan; the current one pulses; deeper ones are locked-grey (the tale not yet told that far). This is
// "how deep the tale has been told," not distance to a goal — there is no goal; the crossing is eternal.

import type { MovementCfg } from './lib/vault'

const ATHER = '#37e6ff'
const GOLD = '#ffd36b'
const GREY = '#71717a'

export default function Trail({
  movements, done, onPlay, onEndless,
}: {
  movements: MovementCfg[]
  done: number            // how many movements cleared (0..N) — index `done` is the current playable one
  onPlay: (i: number) => void
  onEndless: () => void   // the light carries on past the last told movement → the crossing without end
}) {
  const allDone = done >= movements.length
  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col rounded-md">
      {/* card wash + darken, same as the ready screen */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/vault/card.webp" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 -z-10 bg-[#070a12]/80" />

      <div className="px-4 pt-3 text-center shrink-0">
        <div className="gx-title text-[13px] tracking-[0.3em] uppercase" style={{ color: ATHER, textShadow: `0 0 12px ${ATHER}` }}>The Crossing</div>
        <div className="gx-label text-[8px] text-[#9fd6e0]/50 tracking-wider mt-0.5">the tale told in movements · a descent into the grey</div>
      </div>

      {/* the trail — a scrollable row so all six fit on a phone-width cabinet screen */}
      <div className="flex-1 min-h-0 flex items-center overflow-x-auto overflow-y-hidden px-4">
        <div className="flex items-stretch gap-0 mx-auto">
          {movements.map((m, i) => {
            const state = i < done ? 'cleared' : i === done ? 'current' : 'locked'
            const playable = i <= done
            const color = state === 'cleared' ? GOLD : state === 'current' ? ATHER : GREY
            return (
              <div key={m.id} className="flex items-center">
                <button
                  type="button"
                  disabled={!playable}
                  onClick={() => playable && onPlay(i)}
                  className={`group flex w-[92px] shrink-0 flex-col items-center gap-1 px-1 py-1 text-center transition ${playable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[12px] tabular-nums transition ${state === 'current' ? 'animate-pulse' : ''}`}
                    style={{
                      borderColor: color, color: state === 'locked' ? `${GREY}` : '#070a12',
                      background: state === 'locked' ? 'transparent' : color,
                      boxShadow: state === 'locked' ? 'none' : `0 0 12px ${color}90`,
                    }}
                  >
                    {state === 'cleared' ? '✦' : state === 'locked' ? '🔒' : i + 1}
                  </span>
                  <span className="gx-label text-[8.5px] leading-tight tracking-wide" style={{ color: state === 'locked' ? `${GREY}` : '#dff6fb' }}>
                    {m.name}
                  </span>
                  {state !== 'locked' && (
                    <span className="text-[7.5px] leading-tight text-[#9fd6e0]/45 max-w-[86px]">{m.blurb}</span>
                  )}
                </button>
                {i < movements.length - 1 && (
                  <span aria-hidden className="h-px w-3 shrink-0" style={{ background: i < done ? `${GOLD}80` : `${GREY}55` }} />
                )}
              </div>
            )
          })}
          {/* the beyond — the crossing without end, past the last told movement */}
          <div className="flex items-center">
            <span aria-hidden className="h-px w-3 shrink-0" style={{ background: allDone ? `${ATHER}80` : `${GREY}40` }} />
            <button
              type="button"
              disabled={!allDone}
              onClick={onEndless}
              className={`flex w-[96px] shrink-0 flex-col items-center gap-1 px-1 py-1 text-center transition ${allDone ? 'cursor-pointer' : 'cursor-default opacity-45'}`}
              title={allDone ? 'the crossing without end' : 'told to the last movement to unlock'}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] ${allDone ? 'animate-pulse' : ''}`}
                style={{ borderColor: allDone ? ATHER : GREY, color: allDone ? ATHER : GREY, boxShadow: allDone ? `0 0 12px ${ATHER}90` : 'none' }}>
                ∞
              </span>
              <span className="gx-label text-[8.5px] leading-tight tracking-wide" style={{ color: allDone ? '#dff6fb' : GREY }}>Carry On</span>
              <span className="text-[7.5px] leading-tight text-[#9fd6e0]/45">the crossing without end</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-2 text-center shrink-0">
        <p className="text-[8px] text-[#7fd8e6]/35 font-mono tracking-wider">
          {allDone ? 'the light passes beyond the teller’s sight — carry it on' : 'cross each movement to tell the tale deeper'}
        </p>
      </div>
    </div>
  )
}
