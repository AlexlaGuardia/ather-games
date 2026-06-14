'use client'

// WARD — Missile Command over the spires. The void rains blight down on the last
// spires of Aeterna; tap the sky to bloom Ather bursts and unmake it before it
// lands. Hold the line wave on wave; the run ends when the last spire falls.
// Atari vector-glow on canvas, real-time. Core sim lives in lib/ward.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { mulberry32 } from '@/lib/arcade/rng'
import {
  makeWorld,
  tick,
  fireBloom,
  loadHiScore,
  saveHiScore,
  aliveSpires,
  bloomRadius,
  VW,
  VH,
  GROUND_Y,
  BATTERY,
  BLOOM_MAX,
  NUM_SPIRES,
  type World,
} from './lib/ward'
import { sfx } from './lib/sfx'

const BG = '#04040a'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const SPIRE = '#6cf0ff'
const VOID = '#c86bff'
const VOID_DIM = '#4a2078'
const FALL = '#ff7a3c'

// a fixed, deterministic void-field behind the action (twinkle, no gameplay)
const STARS = (() => {
  const r = mulberry32(0xa7e)
  return Array.from({ length: 46 }, () => ({ x: r() * VW, y: r() * (GROUND_Y - 10), p: r() * 6.28, s: 0.6 + r() * 1.1 }))
})()

interface Hud {
  score: number
  wave: number
  ammo: number
  maxAmmo: number
  spires: number
  hi: number
}

export default function WardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const startedRef = useRef(false)
  const overRef = useRef(false)
  const seedRef = useRef(1)
  const pointerRef = useRef({ x: VW / 2, y: VH / 2, active: false })
  const hudT = useRef(0)

  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(false)
  const [muted, setMuted] = useState(false)
  const [hud, setHud] = useState<Hud>({ score: 0, wave: 1, ammo: 0, maxAmmo: 0, spires: NUM_SPIRES, hi: 0 })

  const readHud = useCallback((w: World): Hud => ({
    score: w.score,
    wave: w.wave,
    ammo: w.ammo,
    maxAmmo: w.maxAmmo,
    spires: aliveSpires(w),
    hi: loadHiScore(),
  }), [])

  // boot a fresh world (also used by restart)
  const boot = useCallback(() => {
    seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0
    const w = makeWorld(seedRef.current ^ (Date.now() >>> 0))
    worldRef.current = w
    overRef.current = false
    setOver(false)
    setHud(readHud(w))
  }, [readHud])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setHud((h) => ({ ...h, hi: loadHiScore() }))
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

      if (startedRef.current && !overRef.current) {
        const ev = tick(w, dt)
        if (ev.intercepts) sfx.play('intercept')
        if (ev.spireHits) sfx.play('spire')
        if (ev.waveCleared) sfx.play('wave')
        if (ev.gameOver) {
          sfx.play('over')
          overRef.current = true
          const hi = saveHiScore(w.score)
          setOver(true)
          setHud({ ...readHud(w), hi })
        }
        // throttle HUD react-state sync to ~12/s
        hudT.current += dt
        if (hudT.current >= 0.08) {
          hudT.current = 0
          setHud(readHud(w))
        }
      }

      render(canvas, w, ts, pointerRef.current, startedRef.current && !overRef.current)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [readHud])

  const toVirtual = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * VW,
      y: ((e.clientY - rect.top) / rect.height) * VH,
    }
  }

  const startGame = useCallback(() => {
    sfx.ensure()
    startedRef.current = true
    setStarted(true)
  }, [])

  const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    sfx.ensure()
    const p = toVirtual(e)
    pointerRef.current = { ...p, active: true }
    if (!startedRef.current) {
      startedRef.current = true
      setStarted(true)
      return
    }
    if (overRef.current) return
    const w = worldRef.current
    if (w && fireBloom(w, p.x, p.y)) {
      sfx.play('launch')
      setHud(readHud(w))
    }
  }, [readHud])

  const onMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toVirtual(e)
    pointerRef.current = { ...p, active: true }
  }, [])
  const onLeave = useCallback(() => {
    pointerRef.current.active = false
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

  const lowAmmo = hud.maxAmmo > 0 && hud.ammo <= 3

  return (
    <div className="min-h-screen bg-[#04040a] text-[#7fd8e6] flex flex-col items-center px-4 py-6 select-none">
      {/* header */}
      <div className="w-full max-w-[520px] flex items-center justify-between mb-4">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">
          &#8592; arcade
        </Link>
        <div className="text-center">
          <div className="font-mono text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Ward</div>
          <div className="text-[9px] text-[#7fd8e6]/40 font-mono tracking-[0.2em] uppercase mt-0.5">hold the spires</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">
          {muted ? 'son' : 'snd'}
        </button>
      </div>

      {/* score / wave / hiscore row */}
      <div className="w-full max-w-[480px] flex items-end justify-between mb-2 font-mono">
        <div className="text-left">
          <div className="text-[9px] tracking-[0.2em] uppercase text-[#7fd8e6]/40">score</div>
          <div className="text-[#e8feff] text-lg tabular-nums leading-none" style={{ textShadow: '0 0 8px #37e6ff70' }}>{hud.score.toLocaleString()}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] tracking-[0.2em] uppercase text-[#ffb24a]/60">wave</div>
          <div className="text-[#ffb24a] text-lg tabular-nums leading-none" style={{ textShadow: '0 0 8px #ffb24a70' }}>{hud.wave}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] tracking-[0.2em] uppercase text-[#7fd8e6]/40">best</div>
          <div className="text-[#7fd8e6]/70 text-lg tabular-nums leading-none">{hud.hi.toLocaleString()}</div>
        </div>
      </div>

      {/* ammo + spires */}
      <div className="w-full max-w-[480px] mb-2 flex items-center gap-3">
        <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#7fd8e6]/40">ather</span>
        <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-150" style={{ width: `${hud.maxAmmo ? (hud.ammo / hud.maxAmmo) * 100 : 0}%`, background: lowAmmo ? '#ff5d9e' : '#37e6ff', boxShadow: `0 0 10px ${lowAmmo ? '#ff5d9e' : '#37e6ff'}` }} />
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: NUM_SPIRES }, (_, i) => (
            <span key={i} className="text-[10px]" style={{ color: i < hud.spires ? SPIRE : '#ffffff14', textShadow: i < hud.spires ? `0 0 6px ${SPIRE}` : 'none' }}>▲</span>
          ))}
        </div>
      </div>

      {/* the field */}
      <div className="relative w-full max-w-[480px]" style={{ aspectRatio: `${VW} / ${VH}` }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          className="w-full h-full block touch-none rounded-md cursor-crosshair"
        />
        <div className="pointer-events-none absolute inset-0 rounded-md wd-crt" />

        {!started && (
          <div onPointerDown={startGame} className="cursor-pointer absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#04040a]/55 rounded-md text-center px-6">
            <div className="font-mono text-[#37e6ff] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #37e6ff' }}>Ward</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[300px]">
              the void is falling on the spires. tap the sky to bloom Ather and unmake it before it lands.
            </p>
            <button className="font-mono text-[12px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-6 py-2.5 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
              tap to defend
            </button>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#04040a]/75 rounded-md text-center px-6">
            <div className="font-mono text-[#ff5d9e] text-xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 16px #ff5d9e' }}>The line breaks</div>
            <div className="font-mono text-[#e8feff] text-3xl tabular-nums leading-none" style={{ textShadow: '0 0 12px #37e6ff80' }}>{hud.score.toLocaleString()}</div>
            <div className="text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider">
              reached wave {hud.wave} · best {hud.hi.toLocaleString()}{hud.score >= hud.hi && hud.score > 0 ? ' ✦ new best' : ''}
            </div>
            <button onClick={restart} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-6 py-2 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
              defend again →
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[480px] flex items-center justify-between mt-4">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/45 hover:text-[#37e6ff] font-mono">arcade</Link>
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">tap the sky · bloom early, the ring takes a moment</p>
      </div>

      <style jsx>{`
        .wd-crt {
          background:
            radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.55) 100%),
            repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.18) 3px, rgba(0, 0, 0, 0) 4px);
          animation: wd-flicker 4.5s infinite steps(60);
          mix-blend-mode: multiply;
        }
        @keyframes wd-flicker {
          0%, 97%, 100% { opacity: 1; }
          98% { opacity: 0.92; }
          99% { opacity: 0.97; }
        }
      `}</style>
    </div>
  )
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(
  canvas: HTMLCanvasElement,
  w: World,
  ts: number,
  pointer: { x: number; y: number; active: boolean },
  live: boolean,
) {
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

  // void-field
  for (const s of STARS) {
    ctx.globalAlpha = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p))
    ctx.fillStyle = '#8a7bb0'
    dot(ctx, s.x, s.y, s.s)
  }
  ctx.globalAlpha = 1

  // ground line
  ctx.strokeStyle = ATHER
  ctx.globalAlpha = 0.5
  ctx.lineWidth = 1.5
  ctx.shadowBlur = 10
  ctx.shadowColor = ATHER
  seg(ctx, 0, GROUND_Y, VW, GROUND_Y)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // battery
  ctx.fillStyle = ATHER
  ctx.shadowBlur = 12
  ctx.shadowColor = ATHER
  ctx.beginPath()
  ctx.moveTo(BATTERY.x, BATTERY.y - 12)
  ctx.lineTo(BATTERY.x + 10, BATTERY.y)
  ctx.lineTo(BATTERY.x - 10, BATTERY.y)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  // spires
  for (const s of w.spires) drawSpire(ctx, s.x, s.alive, t)

  // blight — trail from origin to head, glowing diamond head
  for (const b of w.blight) {
    const grad = ctx.createLinearGradient(b.ox, b.oy, b.x, b.y)
    grad.addColorStop(0, 'rgba(74,32,120,0)')
    grad.addColorStop(1, VOID_DIM)
    ctx.strokeStyle = grad
    ctx.lineWidth = 2
    ctx.shadowBlur = 0
    seg(ctx, b.ox, b.oy, b.x, b.y)
    // head
    ctx.fillStyle = VOID
    ctx.shadowBlur = 12
    ctx.shadowColor = VOID
    diamond(ctx, b.x, b.y, 4.5 + 0.8 * Math.sin(t * 8 + b.x))
  }
  ctx.shadowBlur = 0

  // blooms — expanding Ather rings with a soft core
  for (const bl of w.blooms) {
    const k = bl.r / BLOOM_MAX
    const fade = 1 - Math.max(0, (bl.age - 0.28) / 0.5)
    // launch streak while young
    if (bl.age < 0.18) {
      ctx.strokeStyle = ATHER
      ctx.globalAlpha = 0.5 * (1 - bl.age / 0.18)
      ctx.lineWidth = 1.5
      ctx.shadowBlur = 8
      ctx.shadowColor = ATHER
      seg(ctx, BATTERY.x, BATTERY.y, bl.x, bl.y)
    }
    ctx.globalAlpha = Math.max(0, fade)
    ctx.strokeStyle = HOT
    ctx.lineWidth = 2.5
    ctx.shadowBlur = 18
    ctx.shadowColor = ATHER
    ring(ctx, bl.x, bl.y, bl.r)
    ctx.fillStyle = ATHER
    ctx.globalAlpha = 0.16 * Math.max(0, fade) * (1 - k)
    dot(ctx, bl.x, bl.y, bl.r * 0.85)
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // fx bursts
  for (const f of w.fx) {
    const k = f.age / f.life
    if (f.kind === 'intercept') {
      ctx.strokeStyle = HOT
      ctx.globalAlpha = 1 - k
      ctx.lineWidth = 2
      ctx.shadowBlur = 12
      ctx.shadowColor = ATHER
      ring(ctx, f.x, f.y, 4 + k * 22)
    } else if (f.kind === 'spire') {
      ctx.strokeStyle = FALL
      ctx.globalAlpha = 1 - k
      ctx.lineWidth = 3 * (1 - k)
      ctx.shadowBlur = 16
      ctx.shadowColor = FALL
      ring(ctx, f.x, f.y, 6 + k * 40)
    } else {
      ctx.strokeStyle = VOID_DIM
      ctx.globalAlpha = 0.7 * (1 - k)
      ctx.lineWidth = 1.5
      ctx.shadowBlur = 0
      ring(ctx, f.x, f.y, 3 + k * 14)
    }
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // crosshair
  if (live && pointer.active) {
    ctx.strokeStyle = ATHER
    ctx.globalAlpha = 0.6
    ctx.lineWidth = 1
    ctx.shadowBlur = 6
    ctx.shadowColor = ATHER
    ring(ctx, pointer.x, pointer.y, 9)
    seg(ctx, pointer.x - 14, pointer.y, pointer.x - 5, pointer.y)
    seg(ctx, pointer.x + 5, pointer.y, pointer.x + 14, pointer.y)
    seg(ctx, pointer.x, pointer.y - 14, pointer.x, pointer.y - 5)
    seg(ctx, pointer.x, pointer.y + 5, pointer.x, pointer.y + 14)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  // wave-break banner
  if (w.state === 'wavebreak') {
    ctx.globalAlpha = Math.min(1, w.breakT / 0.5) * Math.min(1, (2.2 - w.breakT) / 0.4 + 0.2)
    ctx.fillStyle = ATHER
    ctx.shadowBlur = 16
    ctx.shadowColor = ATHER
    ctx.textAlign = 'center'
    ctx.font = '600 26px ui-monospace, monospace'
    ctx.fillText(`WAVE ${w.wave + 1}`, VW / 2, VH / 2 - 8)
    ctx.font = '11px ui-monospace, monospace'
    ctx.globalAlpha *= 0.7
    ctx.fillText('THE LINE HELD', VW / 2, VH / 2 + 16)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }
}

function drawSpire(ctx: CanvasRenderingContext2D, x: number, alive: boolean, t: number) {
  if (alive) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.4 + x)
    const top = GROUND_Y - 42
    ctx.strokeStyle = SPIRE
    ctx.lineWidth = 3
    ctx.shadowBlur = 10 * pulse
    ctx.shadowColor = SPIRE
    // tapered pylon
    ctx.beginPath()
    ctx.moveTo(x - 7, GROUND_Y)
    ctx.lineTo(x, top)
    ctx.lineTo(x + 7, GROUND_Y)
    ctx.stroke()
    // glowing cap
    ctx.fillStyle = HOT
    ctx.shadowBlur = 14 * pulse
    diamond(ctx, x, top, 4)
  } else {
    // broken dark stub
    ctx.strokeStyle = '#3a1530'
    ctx.lineWidth = 2
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.moveTo(x - 6, GROUND_Y)
    ctx.lineTo(x - 2, GROUND_Y - 9)
    ctx.lineTo(x + 3, GROUND_Y - 4)
    ctx.lineTo(x + 6, GROUND_Y - 11)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.stroke()
}
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill()
}
