'use client'

// MANA'NANA — Story roadmap. A winding board-game trail through Gregory's garden.
// Layout: ONE canon region per row (a "leg" of the journey), legs alternating
// left/right so the path meanders. Each region owns its row, so its header never
// collides with a neighbour's. Pitstops are quest levels (names already canon-
// settled in lib/quests). Region names cite the garden's real canon geography in
// canon order (CANON/game/shimmer-geography.md), home→edge. The level→zone map is
// a soft design layering (easy to re-tune / ratify via Magii); nothing invented.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LEVELS } from './lib/quests'

const BANDS: { zone: string; note: string; levels: number[]; accent: string }[] = [
  { zone: 'Moonwell Glade', note: 'the tended heart', levels: [0, 1], accent: '#8fb7ff' },
  { zone: 'Mycelial Path', note: 'the corridor west', levels: [2, 3], accent: '#7fd6a0' },
  { zone: 'Mana Springs', note: 'the ascent begins', levels: [4, 5], accent: '#5fe0d0' },
  { zone: 'Spirit Meadows', note: 'the first hold', levels: [6], accent: '#c79bff' },
  { zone: 'Gloview Village', note: 'the free village', levels: [7, 8], accent: '#ffcf7a' },
  { zone: 'The Outfields', note: "the garden's frayed edge", levels: [9, 10], accent: '#ff9f6a' },
  { zone: 'Voranyx Caverns', note: 'the eastern deep', levels: [11, 12], accent: '#9a8cff' },
  { zone: 'Ather Winds', note: 'the sealed gate', levels: [13], accent: '#ffe9a8' },
]

const ROW_GAP = 142
const TOP_PAD = 62

interface RoadmapProps {
  current: number
  onPlay: (i: number) => void
  onHome: () => void
  advancedFrom?: number | null
}

export default function Roadmap({ current, onPlay, onHome, advancedFrom }: RoadmapProps) {
  const colRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [w, setW] = useState(0)

  useLayoutEffect(() => {
    const el = colRef.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // one region per row; legs lean left/right by parity for the meander.
  const nodes = useMemo(() => {
    const out: { i: number; lv: typeof LEVELS[number]; x: number; y: number; region: number }[] = new Array(LEVELS.length)
    BANDS.forEach((b, r) => {
      const side = r % 2 // 0 = lean left, 1 = lean right
      const y = TOP_PAD + r * ROW_GAP
      const lanes = b.levels.length === 1 ? [side ? 0.66 : 0.34] : side ? [0.5, 0.74] : [0.26, 0.5]
      b.levels.forEach((li, j) => { out[li] = { i: li, lv: LEVELS[li], x: lanes[j] * w, y, region: r } })
    })
    return out
  }, [w])
  const height = TOP_PAD * 2 + BANDS.length * ROW_GAP

  const [tokenAt, setTokenAt] = useState(advancedFrom ?? current)
  const [landing, setLanding] = useState(false)
  useEffect(() => {
    if (advancedFrom != null && advancedFrom !== current) {
      const hop = setTimeout(() => { setTokenAt(current); setLanding(true) }, 420)
      const end = setTimeout(() => setLanding(false), 420 + 460)
      return () => { clearTimeout(hop); clearTimeout(end) }
    }
    setTokenAt(current)
  }, [current, advancedFrom])

  useEffect(() => { nodeRefs.current[Math.min(current, LEVELS.length - 1)]?.scrollIntoView({ block: 'center' }) }, [current, w])

  const done = current >= LEVELS.length

  return (
    <div className="flex h-full w-full flex-col" style={{ background: 'radial-gradient(130% 90% at 50% -5%,#33244c 0%,#1c1430 50%,#100b1a 100%)', color: '#f4ecdf' }}>
      <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b border-white/5">
        <button onClick={onHome} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm active:scale-95" aria-label="Home">‹ Home</button>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-black tracking-wide truncate">The Long Meander</div>
          <div className="text-[11px] uppercase tracking-widest text-amber-200/50 truncate">Story · Gregory&apos;s Garden</div>
        </div>
        <div className="text-right text-xs text-slate-300/70 tabular-nums shrink-0">Lv {Math.min(current + 1, LEVELS.length)}<span className="text-slate-500"> / {LEVELS.length}</span></div>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div ref={colRef} className="relative mx-auto" style={{ height, maxWidth: 460 }}>
          {/* per-region ambient glow — the atmosphere of each canon place */}
          {w > 0 && BANDS.map((b) => {
            const ns = b.levels.map((i) => nodes[i])
            const xs = ns.map((n) => n.x)
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2
            const cy = ns[0].y
            const rw = Math.max(...xs) - Math.min(...xs) + 210
            return (
              <div key={b.zone} className="pointer-events-none absolute z-[1]"
                style={{ left: cx, top: cy, width: rw, height: 150, transform: 'translate(-50%,-50%)', background: `radial-gradient(ellipse at center, ${b.accent}30, transparent 66%)`, filter: 'blur(28px)', mixBlendMode: 'screen', opacity: 0.5 }} />
            )
          })}

          {/* curved connectors — travelled path glows gold */}
          {w > 0 && (
            <svg className="pointer-events-none absolute inset-0 z-[2]" width={w} height={height} style={{ overflow: 'visible' }}>
              {nodes.slice(1).map((n, k) => {
                const p = nodes[k]
                const my = (p.y + n.y) / 2
                const travelled = n.i <= current
                return (
                  <path key={n.i} d={`M ${p.x} ${p.y} C ${p.x} ${my}, ${n.x} ${my}, ${n.x} ${n.y}`} fill="none"
                    stroke={travelled ? '#ffd884' : '#463c5e'} strokeWidth={travelled ? 6 : 4}
                    strokeLinecap="round" strokeDasharray={travelled ? undefined : '1 13'} opacity={travelled ? 0.85 : 0.55}
                    style={travelled ? { filter: 'drop-shadow(0 0 5px rgba(255,200,110,.55))' } : undefined} />
                )
              })}
            </svg>
          )}

          {/* region headers — one per row, centered over its pitstops; can't collide */}
          {w > 0 && BANDS.map((b) => {
            const ns = b.levels.map((i) => nodes[i])
            const cx = ns.reduce((s, n) => s + n.x, 0) / ns.length
            return (
              <div key={b.zone} className="pointer-events-none absolute z-[5] whitespace-nowrap text-center"
                style={{ left: cx, top: ns[0].y - 52, transform: 'translateX(-50%)' }}>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: b.accent }}>{b.zone}</div>
                <div className="text-[9px] italic text-slate-300/50 leading-tight">{b.note}</div>
              </div>
            )
          })}

          {/* pitstops */}
          {w > 0 && nodes.map((n) => {
            const b = BANDS[n.region]
            const state = n.i < current ? 'cleared' : n.i === current ? 'here' : 'locked'
            const playable = state !== 'locked'
            return (
              <button key={n.i} ref={(el) => { nodeRefs.current[n.i] = el }}
                onClick={() => playable && onPlay(n.i)} disabled={!playable}
                className="absolute z-[6] -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-90"
                style={{ left: n.x, top: n.y, cursor: playable ? 'pointer' : 'default' }}
                aria-label={`${n.lv.name}${playable ? '' : ' (locked)'}`}>
                <div className="relative flex h-[54px] w-[54px] items-center justify-center rounded-full text-sm font-black"
                  style={
                    state === 'cleared' ? { background: 'radial-gradient(circle at 35% 28%,#ffe6a8,#dfa646)', color: '#5a3d10', boxShadow: `0 2px 10px rgba(224,169,75,.4), 0 0 0 2px ${b.accent}44` }
                    : state === 'here' ? { background: 'radial-gradient(circle at 35% 28%,#fff2cf,#ffb020)', color: '#5a3d10', boxShadow: `0 0 0 4px ${b.accent}55, 0 0 22px rgba(255,176,32,.7)`, animation: 'manana-pit-pulse 1.6s ease-in-out infinite' }
                    : { background: 'rgba(255,255,255,.05)', color: '#6b6480', border: `1px dashed ${b.accent}3a` }
                  }>
                  {state === 'cleared' ? '✓' : n.lv.id}
                </div>
                <div className={`absolute left-1/2 top-[58px] w-[86px] -translate-x-1/2 text-center text-[9px] leading-tight ${state === 'locked' ? 'text-slate-500' : 'text-slate-100/85'}`}>
                  {state === 'locked' ? '🔒' : n.lv.name}
                </div>
              </button>
            )
          })}

          {/* game-piece token — hops to the current pitstop, pops on landing */}
          {w > 0 && (() => {
            const t = nodes[Math.min(tokenAt, nodes.length - 1)]
            return (
              <div className="pointer-events-none absolute z-10 text-2xl"
                style={{ left: t.x, top: t.y - 36, transform: 'translate(-50%,-50%)', transition: 'left .5s cubic-bezier(.5,0,.3,1), top .5s cubic-bezier(.34,1.5,.5,1)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))', animation: landing ? 'manana-token-land .46s ease-out' : undefined }}>
                🐾
              </div>
            )
          })()}
        </div>
      </div>

      <div className="shrink-0 px-4 py-2 text-center text-[11px] text-slate-400/70 border-t border-white/5">
        {done ? 'The whole garden, walked ✦' : 'tap your glowing pitstop to play'}
      </div>

      <style>{`
        @keyframes manana-pit-pulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.15)}}
        @keyframes manana-token-land{0%{transform:translate(-50%,-50%) scale(1)}35%{transform:translate(-50%,-66%) scale(1.28)}100%{transform:translate(-50%,-50%) scale(1)}}
      `}</style>
    </div>
  )
}
