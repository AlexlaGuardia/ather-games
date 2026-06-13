'use client'

// The Aeterna network — a constellation of dark machines. Cleared nodes glow and
// connect; the next available node pulses; locked ones wait in the dark. Tap an
// available node to play it; tap a lit one to reread its lore.

import { useState } from 'react'
import {
  NODES,
  EDGES,
  FINALE,
  type Progress,
  type WorldNode,
  isCleared,
  isUnlocked,
  allCleared,
} from '../lib/world'

export function WorldMap({ progress, onPlay }: { progress: Progress; onPlay: (level: number) => void }) {
  const [sel, setSel] = useState<WorldNode | null>(null)
  const done = allCleared(progress)

  const tap = (n: WorldNode) => {
    if (!isUnlocked(progress, n)) return
    if (isCleared(progress, n.id)) setSel(n)
    else onPlay(n.level)
  }

  const nodeColor = (n: WorldNode) =>
    isCleared(progress, n.id) ? '#54ff9e' : isUnlocked(progress, n) ? '#ffb24a' : '#1f3640'

  const cleared = NODES.filter((n) => isCleared(progress, n.id)).length

  return (
    <div className="w-full max-w-[560px] flex flex-col items-center">
      <svg viewBox="0 0 100 62" className="w-full block" style={{ overflow: 'visible' }}>
        {EDGES.map(([a, b], i) => {
          const A = NODES[a], B = NODES[b]
          const lit = isCleared(progress, a) && isCleared(progress, b)
          return (
            <line
              key={i}
              x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke={lit ? '#37e6ff' : '#16313a'}
              strokeWidth={lit ? 0.7 : 0.4}
              style={lit ? { filter: 'drop-shadow(0 0 2px #37e6ff)' } : undefined}
            />
          )
        })}
        {NODES.map((n) => {
          const unlocked = isUnlocked(progress, n)
          const clr = isCleared(progress, n.id)
          const col = nodeColor(n)
          return (
            <g
              key={n.id}
              onClick={() => tap(n)}
              className={unlocked ? 'cursor-pointer' : 'cursor-default'}
              style={{ filter: unlocked ? `drop-shadow(0 0 2.5px ${col})` : undefined }}
            >
              {!clr && unlocked && (
                <circle cx={n.x} cy={n.y} r={3.4} fill="none" stroke={col} strokeWidth={0.4} className="rk-pulse" />
              )}
              <circle cx={n.x} cy={n.y} r={clr ? 2.6 : 2.1} fill={col} opacity={unlocked ? 1 : 0.5} />
              {clr && <circle cx={n.x} cy={n.y} r={1} fill="#04040a" />}
              <text
                x={n.x} y={n.y + 6.6} textAnchor="middle"
                fontSize={3} fill={unlocked ? '#7fd8e6' : '#2e4a52'}
                className="font-mono"
                style={{ letterSpacing: '0.04em' }}
              >
                {unlocked ? n.name : '— — —'}
              </text>
              {clr && (
                <text x={n.x} y={n.y - 4.2} textAnchor="middle" fontSize={2.8} fill="#ffd54a">
                  {'★'.repeat(progress[n.id] || 0)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="text-[10px] font-mono text-[#7fd8e6]/40 tracking-wider mt-1">
        {cleared}/{NODES.length} machines lit
      </div>

      {/* lore card — the unlock payoff */}
      {sel && (
        <div className="mt-4 w-full max-w-[440px] rounded-md border border-[#37e6ff]/15 bg-[#0a0a14]/80 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[#54ff9e] text-xs tracking-[0.2em] uppercase">{sel.name}</span>
            <span className="text-[10px]" style={{ color: '#ffd54a' }}>{'★'.repeat(progress[sel.id] || 0)}</span>
          </div>
          <p className="text-[12px] leading-relaxed text-[#9fd6e0]/80 italic">{sel.lore}</p>
          <button
            onClick={() => onPlay(sel.level)}
            className="mt-3 font-mono text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/70 hover:text-[#37e6ff]"
          >
            revisit →
          </button>
        </div>
      )}

      {done && !sel && (
        <div className="mt-4 w-full max-w-[440px] rounded-md border border-[#54ff9e]/20 bg-[#0a0a14]/80 p-4 text-center">
          <p className="text-[12px] leading-relaxed text-[#9fd6e0]/85 italic">{FINALE}</p>
          <p className="mt-2 text-[9px] font-mono tracking-[0.25em] uppercase text-[#54ff9e]/60">the network dreams · more machines to come</p>
        </div>
      )}

      <style jsx>{`
        .rk-pulse { animation: rk-ring 2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        @keyframes rk-ring {
          0%, 100% { opacity: 0.25; transform: scale(0.82); }
          50% { opacity: 0.7; transform: scale(1.18); }
        }
      `}</style>
    </div>
  )
}
