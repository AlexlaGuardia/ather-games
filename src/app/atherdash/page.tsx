'use client'

// ATHERDASH — THE SLICE. A spark of Ather dashes forward down receding lanes.
// This build validates ONE thing: does the fake-3D perspective read as fast forward
// motion, and do lane-swaps feel crisp? No gates / elements / score / juice yet
// (DESIGN.md — Gravitar lesson: prove the feel before building on top).
// Sim + projection live in lib/atherdash.ts; this is canvas render + input only.

import { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeWorld,
  swap,
  tick,
  persp,
  screenX,
  screenY,
  laneNearX,
  HORIZON_Y,
  VANISH_X,
  LANES,
  SPARK_Y,
  VW,
  VH,
  type World,
} from './lib/atherdash'

const BG = '#04040a'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const VOID = '#c86bff'

export default function AtherdashPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const swipeRef = useRef<{ x: number; id: number } | null>(null)

  useNoScroll() // pin to viewport on mobile

  useEffect(() => {
    worldRef.current = makeWorld(Date.now() >>> 0)
  }, [])

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
      tick(w, dt)
      render(canvas, w, ts)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ── keyboard: ←/→ or A/D swap lane ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const w = worldRef.current
      if (!w) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { swap(w, -1); e.preventDefault() }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { swap(w, +1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── touch/pointer: swipe L/R swaps lane (NOT tap) ───────────────────────────────
  // NOTE (Ward gotcha): MCP/automated browser can't dispatch real swipe pointer
  // events — swipe feel MUST be confirmed on a real device.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    swipeRef.current = { x: e.clientX, id: e.pointerId }
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const s = swipeRef.current
    const w = worldRef.current
    if (!s || !w || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    if (Math.abs(dx) > 24) swap(w, dx > 0 ? +1 : -1) // swipe threshold
    swipeRef.current = null
  }, [])

  return (
    <div className="min-h-screen bg-[#04040a] text-[#7fd8e6] flex flex-col items-center px-4 py-6 select-none">
      <div className="w-full max-w-[400px] flex items-center justify-between mb-4">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">
          &#8592; arcade
        </Link>
        <div className="text-center">
          <div className="font-mono text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Atherdash</div>
          <div className="text-[9px] text-[#7fd8e6]/40 font-mono tracking-[0.2em] uppercase mt-0.5">slice · feel test</div>
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
  // sky above the horizon stays pure black so the plane reads as a floor
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, VW, HORIZON_Y)

  // horizon glow line
  ctx.strokeStyle = ATHER
  ctx.globalAlpha = 0.32
  ctx.lineWidth = 1.5
  ctx.shadowBlur = 14
  ctx.shadowColor = ATHER
  seg(ctx, 0, HORIZON_Y, VW, HORIZON_Y)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // lane dividers: boundaries at lane −0.5 … LANES−0.5, converging to the vanish point
  ctx.shadowColor = ATHER
  for (let b = 0; b <= LANES; b++) {
    const laneF = b - 0.5
    ctx.strokeStyle = ATHER
    ctx.globalAlpha = 0.22
    ctx.lineWidth = 1.2
    ctx.shadowBlur = 8
    seg(ctx, screenX(laneF, 1), screenY(1), screenX(laneF, 0), screenY(0))
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // ground dashes streaming z→0 down each lane center — this is what sells speed
  for (let lane = 0; lane < LANES; lane++) {
    for (const z of w.dashes) {
      const z2 = Math.max(0, z - 0.05) // a short segment ahead-of toward the camera
      const p = persp(z)
      ctx.strokeStyle = HOT
      ctx.globalAlpha = 0.15 + 0.55 * p // brighter as it rushes past
      ctx.lineWidth = 1 + 4 * p
      ctx.shadowBlur = 8 * p
      ctx.shadowColor = ATHER
      seg(ctx, screenX(lane, z), screenY(z), screenX(lane, z2), screenY(z2))
    }
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // inert depth markers — glowing diamonds riding their lane forward (read parallax)
  for (const m of w.markers) {
    const p = persp(m.z)
    const x = screenX(m.lane, m.z)
    const y = screenY(m.z)
    const r = 2 + 9 * p
    ctx.globalAlpha = 0.25 + 0.6 * p
    ctx.fillStyle = VOID
    ctx.shadowBlur = 12 * p
    ctx.shadowColor = VOID
    diamond(ctx, x, y, r)
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // the spark — fixed near-bottom Y, x follows the (lerping) lane. Trailing glow.
  const sx = laneNearX(w.x)
  for (let i = 1; i <= 5; i++) {
    ctx.globalAlpha = 0.1 * (1 - i / 6)
    ctx.fillStyle = ATHER
    ctx.shadowBlur = 8
    ctx.shadowColor = ATHER
    dot(ctx, sx, SPARK_Y + i * 9, 10 * (1 - i / 7))
  }
  ctx.globalAlpha = 1
  // core
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
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y)
  ctx.closePath(); ctx.fill()
}
