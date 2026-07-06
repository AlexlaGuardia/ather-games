'use client'

// MANA'NANA — Story roadmap. A winding board-game trail through Gregory's garden.
// Each pitstop is a quest level (names already canon-settled in lib/quests). The
// waypoint bands cite the garden's real canon geography in canon order
// (CANON/game/shimmer-geography.md) — Moonwell Glade → ... → Ather Winds, the
// garden's home-outward loop. The level→zone mapping is a soft design layering
// (easy to re-tune / ratify via Magii); no place-name here is invented.

import { useEffect, useMemo, useRef, useState } from 'react'
import { LEVELS, isLastLevel } from './lib/quests'

// canon zones (EXACT names, canon order home→edge) → which level indexes sit there.
const BANDS: { zone: string; note: string; levels: number[] }[] = [
  { zone: 'Moonwell Glade', note: 'the tended heart', levels: [0, 1] },
  { zone: 'Mycelial Path', note: 'the corridor west', levels: [2, 3] },
  { zone: 'Mana Springs', note: 'the ascent begins', levels: [4, 5] },
  { zone: 'Spirit Meadows', note: 'the first hold', levels: [6] },
  { zone: 'Gloview Village', note: 'the free village', levels: [7, 8] },
  { zone: 'The Outfields', note: "the garden's frayed edge", levels: [9, 10] },
  { zone: 'Voranyx Caverns', note: 'the eastern deep', levels: [11, 12] },
  { zone: 'Ather Winds', note: 'the sealed gate', levels: [13] },
]
const zoneOf = (i: number) => BANDS.find((b) => b.levels.includes(i))?.zone ?? ''

const LANES = [0.2, 0.5, 0.8] // x fractions — serpentine across 3 lanes
const ROW_GAP = 116
const TOP_PAD = 40

interface RoadmapProps {
  current: number // current level index; i < current = cleared
  onPlay: (i: number) => void
  onHome: () => void
  advancedFrom?: number | null // previous level, for the win token-hop
}

export default function Roadmap({ current, onPlay, onHome, advancedFrom }: RoadmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([])

  // node positions — vertical serpentine (row snakes L→R→L)
  const nodes = useMemo(() => LEVELS.map((lv, i) => {
    const row = Math.floor(i / LANES.length)
    let col = i % LANES.length
    if (row % 2 === 1) col = LANES.length - 1 - col
    return { i, lv, xPct: LANES[col] * 100, y: TOP_PAD + row * ROW_GAP }
  }), [])
  const height = TOP_PAD * 2 + (Math.ceil(LEVELS.length / LANES.length)) * ROW_GAP

  // token hops from the just-cleared node to the current one on entry
  const [tokenAt, setTokenAt] = useState(advancedFrom ?? current)
  useEffect(() => {
    if (advancedFrom != null && advancedFrom !== current) {
      const t = setTimeout(() => setTokenAt(current), 380)
      return () => clearTimeout(t)
    }
    setTokenAt(current)
  }, [current, advancedFrom])

  // park the current pitstop in view on entry
  useEffect(() => {
    nodeRefs.current[current]?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [current])

  const cleared = isLastLevel(current) && current >= LEVELS.length - 1 && tokenAt === current && current === LEVELS.length - 1

  return (
    <div className="flex h-full w-full flex-col" style={{ background: 'radial-gradient(130% 100% at 50% 0%,#2a1c3a 0%,#1a1226 55%,#120c1c 100%)', color: '#f4ecdf' }}>
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0">
        <button onClick={onHome} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm active:scale-95" aria-label="Home">‹ Home</button>
        <div className="flex-1">
          <div className="text-lg font-black tracking-wide">The Long Meander</div>
          <div className="text-[11px] uppercase tracking-widest text-amber-200/50">Story · Gregory&apos;s Garden</div>
        </div>
        <div className="text-right text-xs text-slate-300/70">Lv {Math.min(current + 1, LEVELS.length)}<span className="text-slate-500"> / {LEVELS.length}</span></div>
      </div>

      {/* the trail */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
        <div className="relative mx-auto" style={{ height, maxWidth: 460 }}>
          {/* connectors */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
            {nodes.slice(1).map((n, k) => {
              const p = nodes[k]
              const done = n.i <= current
              return (
                <line key={n.i} x1={`${p.xPct}%`} y1={p.y} x2={`${n.xPct}%`} y2={n.y}
                  stroke={done ? '#ffd884' : '#4a3f60'} strokeWidth={done ? 5 : 4}
                  strokeLinecap="round" strokeDasharray={done ? '0' : '2 12'} opacity={done ? 0.8 : 0.6} />
              )
            })}
          </svg>

          {/* band labels — canon zone names */}
          {BANDS.map((b) => {
            const first = nodes[b.levels[0]]
            const leftLane = first.xPct < 50
            return (
              <div key={b.zone} className="pointer-events-none absolute text-[10px] leading-tight"
                style={{ top: first.y - 30, [leftLane ? 'right' : 'left']: leftLane ? '54%' : '54%', textAlign: leftLane ? 'right' : 'left', maxWidth: '44%' } as React.CSSProperties}>
                <div className="font-bold uppercase tracking-wider text-amber-200/70">{b.zone}</div>
                <div className="italic text-slate-400/60">{b.note}</div>
              </div>
            )
          })}

          {/* pitstops */}
          {nodes.map((n) => {
            const state = n.i < current ? 'cleared' : n.i === current ? 'here' : 'locked'
            const playable = state !== 'locked'
            return (
              <button key={n.i} ref={(el) => { nodeRefs.current[n.i] = el }}
                onClick={() => playable && onPlay(n.i)} disabled={!playable}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-90"
                style={{ left: `${n.xPct}%`, top: n.y, cursor: playable ? 'pointer' : 'default' }}
                aria-label={`${n.lv.name}${playable ? '' : ' (locked)'}`}>
                <div className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full text-sm font-black"
                  style={
                    state === 'cleared' ? { background: 'radial-gradient(circle at 35% 30%,#ffe6a8,#e0a94b)', color: '#5a3d10', boxShadow: '0 2px 10px rgba(224,169,75,.4)' }
                    : state === 'here' ? { background: 'radial-gradient(circle at 35% 30%,#fff2cf,#ffb020)', color: '#5a3d10', boxShadow: '0 0 0 4px rgba(255,216,132,.35), 0 0 22px rgba(255,176,32,.7)', animation: 'manana-pit-pulse 1.6s ease-in-out infinite' }
                    : { background: 'rgba(255,255,255,.06)', color: '#6b6480', border: '1px dashed rgba(255,255,255,.14)' }
                  }>
                  {state === 'cleared' ? '✓' : n.lv.id}
                </div>
                <div className={`mt-1 w-[76px] -translate-x-[12px] text-center text-[9px] leading-tight ${state === 'locked' ? 'text-slate-500' : 'text-slate-200/80'}`}>
                  {state === 'locked' ? '🔒' : n.lv.name}
                </div>
              </button>
            )
          })}

          {/* the game-piece token — hops to the current pitstop */}
          {(() => {
            const t = nodes[Math.min(tokenAt, nodes.length - 1)]
            return (
              <div className="pointer-events-none absolute z-10 text-2xl"
                style={{ left: `${t.xPct}%`, top: t.y - 34, transform: 'translate(-50%,-50%)', transition: 'left .45s cubic-bezier(.34,1.4,.5,1), top .45s cubic-bezier(.34,1.4,.5,1)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))' }}>
                🐾
              </div>
            )
          })()}
        </div>
      </div>

      <div className="shrink-0 px-4 py-2 text-center text-[11px] text-slate-400/70">
        {cleared ? 'The whole garden, walked ✦' : 'tap your glowing pitstop to play'}
      </div>

      <style>{`@keyframes manana-pit-pulse{0%,100%{box-shadow:0 0 0 4px rgba(255,216,132,.3),0 0 18px rgba(255,176,32,.6)}50%{box-shadow:0 0 0 6px rgba(255,216,132,.5),0 0 28px rgba(255,176,32,.9)}}`}</style>
    </div>
  )
}
