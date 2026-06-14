'use client'

// LAZ — Lazerin rides the Ather. One tap to beat his wings and climb, fall when you
// don't, thread the void gates. Pure pick-up-die-retry, Atari vector-glow on canvas.
// Core sim lives in lib/laz.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeWorld,
  flap,
  tick,
  loadHiScore,
  saveHiScore,
  VW,
  VH,
  GROUND_Y,
  BIRD_X,
  BIRD_R,
  GATE_W,
  GAP_H,
  type World,
} from './lib/laz'
import { sfx } from './lib/sfx'

const BG = '#04040a'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const VOID = '#c86bff'
const VOID_DIM = '#4a2078'

// a fixed parallax star-field (drifts left for a sense of speed)
const STARS = (() => {
  const r = mulberry32(0x1a2)
  return Array.from({ length: 40 }, () => ({ x: r() * VW, y: r() * (GROUND_Y - 8), s: 0.6 + r() * 1.2, sp: 0.3 + r() * 0.9 }))
})()

type Phase = 'ready' | 'playing' | 'over'

export default function LazPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const seedRef = useRef(1)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [muted, setMuted] = useState(false)

  useNoScroll() // pin to viewport on mobile — no page scroll / iOS bounce

  const boot = useCallback(() => {
    seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0
    worldRef.current = makeWorld(seedRef.current ^ (Date.now() >>> 0))
    setScore(0)
    setPhase('ready')
  }, [])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setBest(loadHiScore())
  }, [boot])

  // ── render + sim loop ────────────────────────────────────────────────────────
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
        if (ev.pass) {
          sfx.play('pass')
          setScore(w.score)
        }
        if (ev.crash) {
          sfx.play('crash')
          window.setTimeout(() => sfx.play('over'), 180)
          const b = saveHiScore(w.score)
          setBest(b)
          setPhase('over')
        }
      }

      render(canvas, w, ts)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onDown = useCallback(() => {
    sfx.ensure()
    const w = worldRef.current
    if (!w || w.state === 'over') return // retry is the explicit button
    const wasReady = w.state === 'ready'
    flap(w)
    sfx.play('flap')
    if (wasReady) setPhase('playing')
  }, [])

  const restart = useCallback(() => {
    sfx.ensure()
    boot()
  }, [boot])

  const toggleMute = () => {
    sfx.ensure()
    const m = !sfx.isMuted()
    sfx.setMuted(m)
    setMuted(m)
  }

  return (
    <div className="min-h-screen bg-[#04040a] text-[#7fd8e6] flex flex-col items-center px-4 py-6 select-none">
      <div className="w-full max-w-[400px] flex items-center justify-between mb-4">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">
          &#8592; arcade
        </Link>
        <div className="text-center">
          <div className="font-mono text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Laz</div>
          <div className="text-[9px] text-[#7fd8e6]/40 font-mono tracking-[0.2em] uppercase mt-0.5">ride the ather</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">
          {muted ? 'son' : 'snd'}
        </button>
      </div>

      <div className="relative w-full max-w-[400px]" style={{ aspectRatio: `${VW} / ${VH}` }}>
        <canvas ref={canvasRef} onPointerDown={onDown} className="w-full h-full block touch-none rounded-md cursor-pointer" />
        <div className="pointer-events-none absolute inset-0 rounded-md laz-crt" />

        {/* live score, big and centered like a real flappy */}
        {phase === 'playing' && (
          <div className="pointer-events-none absolute top-6 inset-x-0 text-center font-mono text-[#e8feff] text-4xl tabular-nums" style={{ textShadow: '0 0 14px #37e6ff90' }}>
            {score}
          </div>
        )}

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#04040a]/45 rounded-md text-center px-6">
            <div className="font-mono text-[#37e6ff] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #37e6ff' }}>Laz</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[260px]">
              tap to beat your wings and rise. fall when you don't. thread the void gates.
            </p>
            <div className="font-mono text-[12px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] px-6 py-2.5 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
              tap to fly
            </div>
          </div>
        )}

        {phase === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#04040a]/75 rounded-md text-center px-6">
            <div className="font-mono text-[#ff5d9e] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #ff5d9e' }}>Down he goes</div>
            <div className="font-mono text-[#e8feff] text-4xl tabular-nums leading-none" style={{ textShadow: '0 0 12px #37e6ff80' }}>{score}</div>
            <div className="text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider">
              best {best}{score >= best && score > 0 ? ' ✦ new best' : ''}
            </div>
            <button onClick={restart} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-6 py-2 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
              fly again →
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[400px] flex items-center justify-between mt-4">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/45 hover:text-[#37e6ff] font-mono">arcade</Link>
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">one tap · keep him in the air</p>
      </div>

      <style jsx>{`
        .laz-crt {
          background:
            radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, 0.5) 100%),
            repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.16) 3px, rgba(0, 0, 0, 0) 4px);
          animation: laz-flicker 4.5s infinite steps(60);
          mix-blend-mode: multiply;
        }
        @keyframes laz-flicker {
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
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, VW, VH)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const t = ts / 1000

  // drifting starfield
  const moving = w.state === 'playing'
  for (const s of STARS) {
    const x = moving ? ((s.x - t * 40 * s.sp) % VW + VW) % VW : s.x
    ctx.globalAlpha = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.4 + s.x))
    ctx.fillStyle = '#8a7bb0'
    dot(ctx, x, s.y, s.s)
  }
  ctx.globalAlpha = 1

  // void gates
  for (const g of w.gates) {
    const top = g.gapY - GAP_H / 2
    const bot = g.gapY + GAP_H / 2
    drawGate(ctx, g.x, 0, top) // upper column
    drawGate(ctx, g.x, bot, GROUND_Y - bot) // lower column
    // gap-edge glints
    ctx.fillStyle = HOT
    ctx.shadowBlur = 10
    ctx.shadowColor = VOID
    dot(ctx, g.x + GATE_W / 2, top, 2)
    dot(ctx, g.x + GATE_W / 2, bot, 2)
    ctx.shadowBlur = 0
  }

  // ground line
  ctx.strokeStyle = ATHER
  ctx.globalAlpha = 0.5
  ctx.lineWidth = 1.5
  ctx.shadowBlur = 10
  ctx.shadowColor = ATHER
  seg(ctx, 0, GROUND_Y, VW, GROUND_Y)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // Lazerin — a glowing dart that tilts with his velocity, plus a short trail
  const bob = w.state === 'ready' ? Math.sin(t * 3) * 6 : 0
  const y = w.y + bob
  const tilt = Math.max(-0.5, Math.min(1.0, w.vy / 620))
  for (let i = 1; i <= 4; i++) {
    ctx.globalAlpha = 0.12 * (1 - i / 5)
    ctx.fillStyle = ATHER
    ctx.shadowBlur = 6
    ctx.shadowColor = ATHER
    dot(ctx, BIRD_X - i * 7, y + bob * 0.2, BIRD_R * (1 - i / 6))
  }
  ctx.globalAlpha = 1
  ctx.save()
  ctx.translate(BIRD_X, y)
  ctx.rotate(tilt * 0.6)
  ctx.fillStyle = HOT
  ctx.shadowBlur = 16
  ctx.shadowColor = ATHER
  // a forward-pointing dart
  ctx.beginPath()
  ctx.moveTo(BIRD_R + 3, 0)
  ctx.lineTo(-BIRD_R, -BIRD_R * 0.8)
  ctx.lineTo(-BIRD_R * 0.4, 0)
  ctx.lineTo(-BIRD_R, BIRD_R * 0.8)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  ctx.shadowBlur = 0
}

function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  if (h <= 0) return
  ctx.fillStyle = 'rgba(74,32,120,0.18)'
  ctx.fillRect(x, y, GATE_W, h)
  ctx.strokeStyle = VOID
  ctx.lineWidth = 2
  ctx.shadowBlur = 10
  ctx.shadowColor = VOID
  ctx.strokeRect(x + 1, y, GATE_W - 2, h)
  ctx.shadowBlur = 0
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
