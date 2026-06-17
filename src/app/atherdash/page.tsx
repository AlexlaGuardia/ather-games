'use client'

// ATHERDASH — Phase 1, the core game. A spark of Ather dashes down four elemental
// lanes; gates rush in tuned to one element — its lane is the open door, the rest
// are wall. Be in the matching lane when the gate reaches you. Read-ahead under
// swap pressure. Sim + projection live in lib/atherdash.ts; this is render + input.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  makeWorld,
  start,
  swap,
  tick,
  persp,
  screenX,
  screenY,
  laneNearX,
  loadHiScore,
  saveHiScore,
  HORIZON_Y,
  LANES,
  SPARK_Y,
  ELEMENTS,
  VW,
  VH,
  type World,
} from './lib/atherdash'

const BG = '#04040a'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const WALL_FILL = 'rgba(16,10,26,0.86)'
const WALL_EDGE = '#7a4aa0' // the Dying — dim void
const WALL_H = 74 // wall height in near-pixels (scaled by perspective)

type Phase = 'ready' | 'playing' | 'over'

export default function AtherdashPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const swipeRef = useRef<{ x: number; id: number } | null>(null)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)

  const boot = useCallback(() => {
    worldRef.current = makeWorld(Date.now() >>> 0)
    setScore(0)
    setPhase('ready')
  }, [])

  useEffect(() => {
    boot()
    setBest(loadHiScore())
  }, [boot])

  // ── sim + render loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0
    let last = 0
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw)
      const canvas = canvasRef.current
      const w = worldRef.current
      if (!canvas || !w) return
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0
      last = ts
      if (w.state === 'playing') {
        const ev = tick(w, dt)
        if (ev.pass) setScore(w.score)
        if (ev.crash) {
          const b = saveHiScore(w.score)
          setBest(b)
          setPhase('over')
        }
      } else {
        tick(w, dt) // keeps the road scrolling on the ready screen
      }
      render(canvas, w, ts)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const launch = useCallback(() => {
    const w = worldRef.current
    if (!w || w.state !== 'ready') return
    start(w)
    setPhase('playing')
  }, [])

  // keyboard: ←/→ or A/D swap (and launch from ready)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const w = worldRef.current
      if (!w) return
      const left = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A'
      const right = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D'
      if (!left && !right) return
      e.preventDefault()
      if (w.state === 'ready') launch()
      swap(w, left ? -1 : +1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [launch])

  // touch/pointer: tap launches; swipe L/R swaps. (Ward gotcha: real swipe only
  // fires on a device — the automated browser can't dispatch it.)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    swipeRef.current = { x: e.clientX, id: e.pointerId }
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const s = swipeRef.current
    const w = worldRef.current
    swipeRef.current = null
    if (!w || !s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    if (w.state === 'ready') { launch(); return }
    if (Math.abs(dx) > 22) swap(w, dx > 0 ? +1 : -1)
  }, [launch])

  return (
    <div className="min-h-screen bg-[#04040a] text-[#7fd8e6] flex flex-col items-center px-4 py-6 select-none">
      <div className="w-full max-w-[400px] flex items-center justify-between mb-4">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">
          &#8592; arcade
        </Link>
        <div className="text-center">
          <div className="font-mono text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Atherdash</div>
          <div className="text-[9px] text-[#7fd8e6]/40 font-mono tracking-[0.2em] uppercase mt-0.5">match the lane to the gate</div>
        </div>
        <span className="w-10" />
      </div>

      <div className="relative w-full max-w-[400px]" style={{ aspectRatio: `${VW} / ${VH}` }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="w-full h-full block touch-none rounded-md cursor-pointer"
        />
        <div className="pointer-events-none absolute inset-0 rounded-md atherdash-crt" />

        {phase === 'playing' && (
          <div className="pointer-events-none absolute top-5 inset-x-0 text-center font-mono text-[#e8feff] text-4xl tabular-nums" style={{ textShadow: '0 0 14px #37e6ff90' }}>
            {score}
          </div>
        )}

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            <div className="absolute inset-0 -z-10 bg-[#04040a]/55 rounded-md" />
            <div className="font-mono text-[#37e6ff] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #37e6ff' }}>Atherdash</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/85 max-w-[270px]">
              gates rush in tuned to an element. slide to the matching lane before each one reaches you — wrong lane is a wall.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap max-w-[280px] mt-0.5">
              {ELEMENTS.map((el) => (
                <span key={el.id} className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase" style={{ color: el.light }}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: el.base, boxShadow: `0 0 8px ${el.base}` }} />
                  {el.name}
                </span>
              ))}
            </div>
            <div className="font-mono text-[12px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] px-6 py-2.5 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
              tap / ← → to dash
            </div>
          </div>
        )}

        {phase === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#04040a]/78 rounded-md text-center px-6">
            <div className="font-mono text-[#c86bff] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #c86bff' }}>the wall takes you</div>
            <div className="font-mono text-[#e8feff] text-4xl tabular-nums leading-none" style={{ textShadow: '0 0 12px #37e6ff80' }}>{score}</div>
            <div className="text-[10px] font-mono text-[#7fd8e6]/55 tracking-wider">
              gates threaded · best {best}{score >= best && score > 0 ? ' ✦ new best' : ''}
            </div>
            <button onClick={boot} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-6 py-2 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
              dash again →
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[400px] flex items-center justify-between mt-4">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/45 hover:text-[#37e6ff] font-mono">arcade</Link>
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">←/→ or A/D · swipe on phone</p>
      </div>

      <style jsx>{`
        .atherdash-crt {
          background:
            radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, 0.5) 100%),
            repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.16) 3px, rgba(0, 0, 0, 0) 4px);
          animation: atherdash-flicker 4.5s infinite steps(60);
          mix-blend-mode: multiply;
        }
        @keyframes atherdash-flicker {
          0%, 97%, 100% { opacity: 1; }
          98% { opacity: 0.93; }
          99% { opacity: 0.97; }
        }
      `}</style>
    </div>
  )
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  if (canvas.width !== VW * dpr || canvas.height !== VH * dpr) {
    canvas.width = VW * dpr
    canvas.height = VH * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const t = ts / 1000

  // backdrop: dark field with a soft depth gradient (deepest at the horizon)
  const grad = ctx.createLinearGradient(0, HORIZON_Y, 0, VH)
  grad.addColorStop(0, '#070417')
  grad.addColorStop(1, BG)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, VW, VH)
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, VW, HORIZON_Y) // pure-black sky → the plane reads as a floor

  // faint element wash down each lane corridor (teaches lane = element at rest)
  for (let i = 0; i < LANES; i++) {
    ctx.fillStyle = ELEMENTS[i].base
    ctx.globalAlpha = 0.06
    ctx.beginPath()
    ctx.moveTo(screenX(i - 0.5, 1), screenY(1))
    ctx.lineTo(screenX(i - 0.5, 0), screenY(0))
    ctx.lineTo(screenX(i + 0.5, 0), screenY(0))
    ctx.lineTo(screenX(i + 0.5, 1), screenY(1))
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // horizon glow line
  ctx.strokeStyle = ATHER
  ctx.globalAlpha = 0.32
  ctx.lineWidth = 1.5
  ctx.shadowBlur = 14
  ctx.shadowColor = ATHER
  seg(ctx, 0, HORIZON_Y, VW, HORIZON_Y)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // lane dividers converging to the vanish point
  for (let b = 0; b <= LANES; b++) {
    const laneF = b - 0.5
    ctx.strokeStyle = ATHER
    ctx.globalAlpha = 0.2
    ctx.lineWidth = 1.1
    ctx.shadowBlur = 7
    ctx.shadowColor = ATHER
    seg(ctx, screenX(laneF, 1), screenY(1), screenX(laneF, 0), screenY(0))
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // ground dashes streaming z→0 down each lane centre — element-coloured = identity + speed
  for (let lane = 0; lane < LANES; lane++) {
    const col = ELEMENTS[lane].light
    for (const z of w.dashes) {
      const z2 = Math.max(0, z - 0.05)
      const p = persp(z)
      ctx.strokeStyle = col
      ctx.globalAlpha = 0.12 + 0.5 * p
      ctx.lineWidth = 1 + 3.5 * p
      ctx.shadowBlur = 7 * p
      ctx.shadowColor = ELEMENTS[lane].base
      seg(ctx, screenX(lane, z), screenY(z), screenX(lane, z2), screenY(z2))
    }
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // gates — far first so nearer overlay. Open lane = glowing element portal; rest = wall.
  const gates = [...w.gates].sort((a, b) => b.z - a.z)
  for (const g of gates) {
    const p = persp(g.z)
    const cy = screenY(g.z)
    const barH = WALL_H * p
    const fade = g.z < 0 ? Math.max(0, 1 + g.z / 0.06) : 1 // soften as it exits past camera
    for (let i = 0; i < LANES; i++) {
      const lx = screenX(i - 0.5, g.z)
      const rx = screenX(i + 0.5, g.z)
      if (i === g.lane) {
        // open portal in the matching lane
        const el = ELEMENTS[i]
        ctx.globalAlpha = (0.12 + 0.18 * p) * fade
        ctx.fillStyle = el.base
        ctx.fillRect(lx, cy - barH, rx - lx, barH)
        ctx.globalAlpha = (0.55 + 0.45 * p) * fade
        ctx.strokeStyle = el.light
        ctx.lineWidth = 1 + 2.4 * p
        ctx.shadowBlur = 14 * p
        ctx.shadowColor = el.base
        // posts + lintel (a doorway)
        seg(ctx, lx + 1, cy, lx + 1, cy - barH)
        seg(ctx, rx - 1, cy, rx - 1, cy - barH)
        seg(ctx, lx + 1, cy - barH, rx - 1, cy - barH)
        ctx.shadowBlur = 0
      } else {
        // wall — the Dying. dark panel, dim void edge.
        ctx.globalAlpha = 0.86 * fade
        ctx.fillStyle = WALL_FILL
        ctx.fillRect(lx, cy - barH, rx - lx, barH)
        ctx.globalAlpha = (0.4 + 0.35 * p) * fade
        ctx.strokeStyle = WALL_EDGE
        ctx.lineWidth = 1 + 1.4 * p
        ctx.shadowBlur = 8 * p
        ctx.shadowColor = WALL_EDGE
        ctx.strokeRect(lx + 0.5, cy - barH, rx - lx - 1, barH)
        ctx.shadowBlur = 0
      }
    }
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // the spark — fixed near-bottom Y, x follows the (lerping) lane. Ather, neutral.
  const sx = laneNearX(w.x)
  for (let i = 1; i <= 5; i++) {
    ctx.globalAlpha = 0.1 * (1 - i / 6)
    ctx.fillStyle = ATHER
    ctx.shadowBlur = 8
    ctx.shadowColor = ATHER
    dot(ctx, sx, SPARK_Y + i * 9, 10 * (1 - i / 7))
  }
  ctx.globalAlpha = 1
  const pulse = 1 + Math.sin(t * 9) * 0.08
  ctx.fillStyle = HOT
  ctx.shadowBlur = 22
  ctx.shadowColor = ATHER
  dot(ctx, sx, SPARK_Y, 9 * pulse)
  ctx.fillStyle = ATHER
  ctx.globalAlpha = 0.5
  dot(ctx, sx, SPARK_Y, 14 * pulse)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
