'use client'

// NOLMIR — THE WARP CEREMONY. The spiral's peak, made a moment. Four beats over ~4.7s:
// the gate keys (a hexagon igniting), the node falls behind (its light beaming home), the
// echoes crystallize (amber motes drawn into the ship), arrival (the new system wheels in).
// Canvas drives the visuals on elapsed time; a few timed beats drive the staged text.

import { useEffect, useRef, useState } from 'react'
import { Chakra_Petch } from 'next/font/google'
import { mulberry32 } from '../lib/rng'

const display = Chakra_Petch({ weight: ['500', '600'], subsets: ['latin'] })

export interface WarpData {
  fromNode: number
  toNode: number
  echoesGained: number
  networkGain: number
  totalEchoes: number
  rateMult: number
  planets: { name: string }[]
}

const GATE = 0, DEPART = 1000, ECHOES = 2300, ARRIVE = 3500, READY = 4700
const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

const STARS = (() => {
  const r = mulberry32(424242)
  return Array.from({ length: 150 }, () => ({ a: r() * Math.PI * 2, rad: 0.04 + r() * 0.96, s: 0.5 + r() * 1.4 }))
})()
const MOTES = (() => {
  const r = mulberry32(909090)
  return Array.from({ length: 26 }, () => ({ a: r() * Math.PI * 2, d: r(), sp: 0.7 + r() * 0.6 }))
})()

export default function WarpCeremony({ data, onEnter }: { data: WarpData; onEnter: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [beat, setBeat] = useState(0) // 0 gate · 1 depart · 2 echoes · 3 arrive · 4 ready
  const t0 = useRef(0)

  useEffect(() => {
    const marks = [DEPART, ECHOES, ARRIVE, READY]
    const timers = marks.map((m, i) => window.setTimeout(() => setBeat(i + 1), m))
    let raf = 0
    t0.current = performance.now()
    const draw = (ts: number) => {
      const cv = canvasRef.current
      if (cv) render(cv, ts - t0.current, data)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf) }
  }, [data])

  return (
    <div className={`fixed inset-0 z-[60] bg-black ${display.className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <button onClick={onEnter} className="absolute top-4 right-4 z-10 text-[10px] tracking-[0.25em] uppercase text-slate-500 hover:text-slate-300">skip ▸</button>

      {/* staged text, centred */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
        <Beat show={beat === 0}>
          <div className="text-orange-300 text-xl tracking-[0.4em] uppercase" style={{ textShadow: '0 0 18px #fb923c' }}>the gate keys</div>
        </Beat>
        <Beat show={beat === 1}>
          <div className="text-cyan-200 text-lg tracking-[0.35em] uppercase" style={{ textShadow: '0 0 14px #22d3ee' }}>Node {data.fromNode} holds the light</div>
          <div className="text-sky-300/80 text-xs tracking-[0.2em] mt-2">+{data.networkGain.toFixed(1)}/s — beaming home, for good</div>
        </Beat>
        <Beat show={beat === 2}>
          <div className="text-amber-300 text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #fbbf24' }}>+{data.echoesGained} echoes</div>
          <div className="text-amber-200/70 text-xs tracking-[0.2em] mt-2">the core-songs crystallize — rates ×{data.rateMult.toFixed(2)}, forever</div>
        </Beat>
        <Beat show={beat >= 3}>
          <div className="text-[10px] tracking-[0.3em] uppercase text-slate-500">the way opens onto</div>
          <div className="text-cyan-200 text-3xl tracking-[0.35em] uppercase mt-1" style={{ textShadow: '0 0 22px #22d3ee' }}>Node {data.toNode}</div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 max-w-[320px]">
            {data.planets.slice(0, 8).map((p) => (
              <span key={p.name} className="text-[10px] tracking-[0.18em] uppercase text-slate-400">{p.name}</span>
            ))}
          </div>
        </Beat>
      </div>

      {beat >= 4 && (
        <button
          onClick={onEnter}
          className={`${display.className} absolute left-1/2 -translate-x-1/2 bottom-[18%] z-10 px-8 py-2.5 rounded border border-cyan-500 text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/50 text-sm tracking-[0.3em] uppercase pointer-events-auto`}
          style={{ boxShadow: '0 0 22px -4px #22d3ee', animation: 'warp-rise 0.6s ease-out' }}
        >
          enter the system
        </button>
      )}

      <style jsx>{`
        @keyframes warp-rise { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  )
}

function Beat({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div className="absolute transition-all duration-500" style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(8px)' }}>
      {children}
    </div>
  )
}

function render(canvas: HTMLCanvasElement, el: number, data: WarpData) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const cw = canvas.clientWidth || 400, ch = canvas.clientHeight || 700
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) { canvas.width = cw * dpr; canvas.height = ch * dpr }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cx = cw / 2, cy = ch / 2
  const R = Math.hypot(cw, ch) / 2
  const t = el / 1000

  ctx.fillStyle = '#04040a'
  ctx.fillRect(0, 0, cw, ch)

  // warp intensity: ramps up through DEPART/ECHOES, eases to calm at ARRIVE
  const warp = ss(DEPART, ECHOES, el) * (1 - 0.85 * ss(ARRIVE, READY, el))

  // ── starfield → hyperspace streaks ─────────────────────────────────────────
  for (const s of STARS) {
    const rad = s.rad * R
    const x0 = cx + Math.cos(s.a) * rad, y0 = cy + Math.sin(s.a) * rad
    const len = warp * (40 + s.rad * 180)
    const x1 = cx + Math.cos(s.a) * (rad + len), y1 = cy + Math.sin(s.a) * (rad + len)
    ctx.strokeStyle = `rgba(150,200,255,${0.25 + 0.5 * warp})`
    ctx.lineWidth = s.s * (1 + warp)
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  }

  // ── the core — orange ignition → white-hot → calm cyan ─────────────────────
  const ignite = ss(GATE, DEPART, el)
  const arrive = ss(ARRIVE, READY, el)
  const coreCol = arrive > 0.5 ? '#9fe8ff' : ignite < 1 ? '#ffb86b' : '#eaf6ff'
  const coreR = 8 + 26 * ignite + 10 * Math.sin(t * 4) * warp + 14 * arrive
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, coreR * 2.4)
  g.addColorStop(0, coreCol); g.addColorStop(0.4, coreCol + 'aa'); g.addColorStop(1, 'transparent')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(cx, cy, coreR * 2.4, 0, Math.PI * 2); ctx.fill()

  // ── the gate hexagon, igniting then consumed by the streaks ────────────────
  const hexA = ignite * (1 - ss(DEPART, ECHOES, el))
  if (hexA > 0.01) {
    ctx.strokeStyle = `rgba(251,146,60,${hexA})`
    ctx.lineWidth = 2.5
    ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 18 * hexA
    ctx.beginPath()
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + t * 0.4
      const r = 60 + 18 * ignite
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke(); ctx.shadowBlur = 0
  }

  // ── the node falls behind, a beam trailing home ────────────────────────────
  const dep = ss(DEPART, ECHOES, el) * (1 - ss(ECHOES, ARRIVE, el))
  if (dep > 0.01) {
    const dist = (0.1 + 0.5 * ss(DEPART, ARRIVE, el)) * R
    const nx = cx - Math.cos(0.7) * dist, ny = cy + Math.sin(0.7) * dist
    ctx.strokeStyle = `rgba(125,211,252,${0.5 * dep})`
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke()
    ctx.fillStyle = `rgba(190,235,255,${dep})`
    ctx.shadowColor = '#7dd3fc'; ctx.shadowBlur = 16 * dep
    ctx.beginPath(); ctx.arc(nx, ny, 5 * (1 - 0.4 * ss(DEPART, ARRIVE, el)), 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
  }

  // ── echo motes converge into the core ──────────────────────────────────────
  const ech = ss(ECHOES, ARRIVE, el)
  if (ech > 0.01 && ech < 1) {
    for (const m of MOTES) {
      const p = Math.max(0, Math.min(1, (ech - m.d * 0.4) * m.sp * 2))
      if (p <= 0) continue
      const rad = (1 - ss(0, 1, p)) * R * 0.8 + 6
      const x = cx + Math.cos(m.a) * rad, y = cy + Math.sin(m.a) * rad
      ctx.fillStyle = `rgba(251,191,36,${0.8 * (1 - p)})`
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  // ── arrival: the new system wheels in on calm rings ────────────────────────
  if (arrive > 0.01) {
    const n = Math.min(8, data.planets.length || 5)
    for (let i = 0; i < n; i++) {
      const ring = (60 + i * Math.min(46, (R - 70) / n))
      const a = (i / n) * Math.PI * 2 + t * 0.25
      const x = cx + Math.cos(a) * ring, y = cy + Math.sin(a) * ring
      ctx.globalAlpha = arrive
      ctx.strokeStyle = 'rgba(55,230,255,0.10)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, ring, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = '#7fe6ff'
      ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0; ctx.globalAlpha = 1
    }
  }
}
