'use client'

// SEEDFALL — set a Mana Seed down softly. Hold the left/right half of the screen to
// thrust that way (both = straight up), feather the Ather, land gentle on the soil.
// A clean set-down roots into your garden, which grows run over run. Atari vector-glow
// on canvas, the cozy slow lane. Core sim lives in lib/seedfall.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeWorld,
  setInput,
  tick,
  loadGarden,
  VW,
  VH,
  GROUND_Y,
  SEED_R,
  SOFT_VY,
  FUEL_MAX,
  type World,
  type Garden,
  type Rating,
} from './lib/seedfall'
import { sfx } from './lib/sfx'

const BG = '#04040a'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const LEAF = '#54ffc8' // soil + garden + safe-descent
const WARM = '#ff8a5c' // coming-in-too-hot
const VOID = '#c86bff'

const STARS = (() => {
  const r = mulberry32(0x5eed)
  return Array.from({ length: 30 }, () => ({ x: r() * VW, y: r() * (GROUND_Y - 30), s: 0.5 + r() * 1.1, p: r() * 6.28 }))
})()

type Phase = 'ready' | 'playing' | 'landed' | 'crashed'

export default function SeedfallPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const skyRef = useRef<HTMLImageElement | null>(null)
  const seedRef = useRef(1)
  const pointers = useRef<Map<number, 'L' | 'R'>>(new Map())
  const syncT = useRef(0)

  const [phase, setPhase] = useState<Phase>('ready')
  const [fuel, setFuel] = useState(FUEL_MAX)
  const [garden, setGarden] = useState<Garden>({ planted: 0, perfect: 0 })
  const [rating, setRating] = useState<Rating | null>(null)
  const [muted, setMuted] = useState(false)

  useNoScroll()

  const boot = useCallback(() => {
    seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0
    worldRef.current = makeWorld(seedRef.current ^ (Date.now() >>> 0))
    pointers.current.clear()
    setFuel(FUEL_MAX)
    setRating(null)
    setPhase('ready')
  }, [])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setGarden(loadGarden())
    const img = new Image()
    img.src = '/seedfall/sky.webp'
    img.onload = () => { skyRef.current = img }
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
        if (ev.thrust) sfx.play('thrust')
        if (ev.landed) {
          sfx.play('plant')
          if (ev.rating === 'perfect') window.setTimeout(() => sfx.play('perfect'), 120)
          setGarden(loadGarden())
          setRating(ev.rating)
          setPhase('landed')
        }
        if (ev.crashed) {
          sfx.play('crash')
          setPhase('crashed')
        }
        syncT.current += dt
        if (syncT.current >= 0.08) { syncT.current = 0; setFuel(w.fuel) }
      }
      render(canvas, w, ts, skyRef.current, garden.planted)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [garden.planted])

  // ── two-zone hold input ───────────────────────────────────────────────────────
  const applyInput = () => {
    const w = worldRef.current
    if (!w) return
    const halves = new Set(pointers.current.values())
    setInput(w, halves.has('L'), halves.has('R'))
    if (w.state === 'playing' && phase === 'ready') setPhase('playing')
  }
  const halfOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientX - rect.left < rect.width / 2 ? 'L' : 'R'
  }
  const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    sfx.ensure()
    if (worldRef.current?.state === 'landed' || worldRef.current?.state === 'crashed') return
    pointers.current.set(e.pointerId, halfOf(e))
    applyInput()
  }, [phase])
  const onMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, halfOf(e))
    applyInput()
  }, [])
  const onUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    applyInput()
  }, [])

  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); setMuted(m) }

  const lowFuel = fuel <= FUEL_MAX * 0.25

  return (
    <ArcadeCabinet accent="#54ffc8" wall={1} maxWidth={400}>
      <div className="w-full max-w-[400px] flex items-center justify-between mb-4">
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-[#54ffc8] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #54ffc880' }}>Seedfall</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">set it down soft</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      {/* garden tally + fuel */}
      <div className="w-full max-w-[400px] mb-2 flex items-center gap-3 font-mono">
        <span className="gx-label text-[9px] text-[#54ffc8]/60">garden {garden.planted}</span>
        {garden.perfect > 0 && <span className="gx-label text-[9px] text-[#e8feff]/50">· {garden.perfect} perfect</span>}
        <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden ml-auto max-w-[150px]">
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${(fuel / FUEL_MAX) * 100}%`, background: lowFuel ? '#ff5d9e' : '#37e6ff', boxShadow: `0 0 10px ${lowFuel ? '#ff5d9e' : '#37e6ff'}` }} />
        </div>
        <span className="gx-label text-[9px] text-[#7fd8e6]/40">ather</span>
      </div>

      <div className="gx-chrome relative w-full max-w-[400px]" style={{ aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: '#54ffc8' } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          className="w-full h-full block touch-none rounded-md cursor-pointer"
        />
        <div className="pointer-events-none absolute inset-0 rounded-md sf-crt" />

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/seedfall/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.6]" />
            <div className="absolute inset-0 -z-10 bg-[#04040a]/62" />
            <div className="gx-title text-[#54ffc8] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #54ffc8' }}>Seedfall</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[270px]">
              hold the left or right side to thrust that way, both to rise. feather the Ather and set the seed down soft on the soil.
            </p>
            <div className="gx-label text-[12px] text-[#04040a] bg-[#54ffc8] px-6 py-2.5 rounded-[2px] mt-1" style={{ boxShadow: '0 0 18px #54ffc880' }}>hold to begin</div>
          </div>
        )}

        {phase === 'landed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#04040a]/70 rounded-md text-center px-6">
            <div className="gx-title text-2xl tracking-[0.3em] uppercase" style={{ color: rating === 'perfect' ? '#e8feff' : '#54ffc8', textShadow: `0 0 16px ${rating === 'perfect' ? '#e8feff' : '#54ffc8'}` }}>
              {rating === 'perfect' ? 'Perfect' : 'Rooted'}
            </div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[260px] italic">
              {rating === 'perfect' ? 'butter-soft. the seed takes hold and glows.' : 'it settles into the soil and roots.'}
            </p>
            <div className="text-[10px] font-mono text-[#54ffc8]/60 tracking-wider">garden {garden.planted}{garden.perfect > 0 ? ` · ${garden.perfect} perfect` : ''}</div>
            <button onClick={restart} className="gx-label text-[11px] text-[#04040a] bg-[#54ffc8] hover:bg-[#8affdd] px-6 py-2 rounded-[2px] mt-1" style={{ boxShadow: '0 0 18px #54ffc880' }}>drop another →</button>
          </div>
        )}

        {phase === 'crashed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#04040a]/70 rounded-md text-center px-6">
            <div className="gx-title text-[#c86bff] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #c86bff' }}>Shattered</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/70 max-w-[250px] italic">too fast, or short of the soil. the seed scatters to the wind.</p>
            <button onClick={restart} className="gx-label text-[11px] text-[#04040a] bg-[#54ffc8] hover:bg-[#8affdd] px-6 py-2 rounded-[2px] mt-1" style={{ boxShadow: '0 0 18px #54ffc880' }}>try again →</button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[400px] flex items-center justify-center mt-4">
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">hold a side · land it gentle</p>
      </div>

      <style jsx>{`
        .sf-crt {
          background:
            radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%),
            repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.14) 3px, rgba(0,0,0,0) 4px);
          animation: sf-flicker 5s infinite steps(60);
          mix-blend-mode: multiply;
        }
        @keyframes sf-flicker { 0%,97%,100% { opacity: 1; } 98% { opacity: 0.94; } 99% { opacity: 0.98; } }
      `}</style>
    </ArcadeCabinet>
  )
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, sky: HTMLImageElement | null, planted: number) {
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

  // backmost: the horizon sky, faint + gently breathing
  if (sky && sky.complete && sky.naturalWidth) {
    const over = 20
    ctx.globalAlpha = 0.6
    ctx.drawImage(sky, Math.sin(t * 0.05) * over - over / 2, 0, VW + over, VH)
    ctx.globalAlpha = 1
  }

  // faint stars
  for (const s of STARS) {
    ctx.globalAlpha = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.p))
    ctx.fillStyle = '#9fb0c8'
    dot(ctx, s.x, s.y, s.s)
  }
  ctx.globalAlpha = 1

  // wind streaks — telegraph the breeze (drift in its direction)
  const wind = w.wind
  for (let i = 0; i < 6; i++) {
    const sy = 90 + i * 70 + Math.sin(t + i) * 6
    const phase = (t * (0.4 + i * 0.05) + i * 0.37) % 1
    const sx = phase * (VW + 60) - 30
    const dir = Math.sign(wind) || 1
    const len = 10 + Math.abs(wind) * 0.25
    ctx.strokeStyle = LEAF
    ctx.globalAlpha = 0.06 + Math.min(0.08, Math.abs(wind) / 600)
    ctx.lineWidth = 1
    seg(ctx, sx, sy, sx + dir * len, sy)
  }
  ctx.globalAlpha = 1

  // ground line
  ctx.strokeStyle = LEAF
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1.5
  ctx.shadowBlur = 8
  ctx.shadowColor = LEAF
  seg(ctx, 0, GROUND_Y, VW, GROUND_Y)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // the soil pad — a bright glowing strip you must land on
  const padL = w.padX - w.padW / 2
  ctx.strokeStyle = HOT
  ctx.lineWidth = 3
  ctx.shadowBlur = 14
  ctx.shadowColor = LEAF
  ctx.globalAlpha = 0.9
  seg(ctx, padL, GROUND_Y, padL + w.padW, GROUND_Y)
  // soft markers at the pad edges
  ctx.fillStyle = LEAF
  dot(ctx, padL, GROUND_Y, 2.5)
  dot(ctx, padL + w.padW, GROUND_Y, 2.5)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // the persistent garden — sprouts accumulated from past plantings
  const sprouts = Math.min(28, planted)
  for (let i = 0; i < sprouts; i++) {
    const gx = 14 + ((i * 53) % (VW - 28))
    const h = 6 + ((i * 17) % 9)
    const sway = Math.sin(t * 1.5 + i) * 1.5
    ctx.strokeStyle = LEAF
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 1.5
    ctx.shadowBlur = 6
    ctx.shadowColor = LEAF
    seg(ctx, gx, GROUND_Y, gx + sway, GROUND_Y - h)
    ctx.fillStyle = HOT
    dot(ctx, gx + sway, GROUND_Y - h, 1.6)
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // the Mana Seed — colour signals descent safety (green = soft enough, warm = hot)
  const safe = w.vy <= SOFT_VY
  const col = w.state === 'crashed' ? VOID : safe ? LEAF : WARM
  // thrust flame
  if (w.thrusting && w.state === 'playing') {
    const dir = w.input.left && w.input.right ? 0 : w.input.left ? 1 : -1
    ctx.strokeStyle = ATHER
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 2
    ctx.shadowBlur = 10
    ctx.shadowColor = ATHER
    for (let i = 0; i < 3; i++) {
      const j = (Math.sin(t * 40 + i) * 2)
      seg(ctx, w.x, w.y + SEED_R, w.x + dir * (4 + i * 3) + j, w.y + SEED_R + 10 + i * 4)
    }
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = col
  ctx.shadowBlur = 16
  ctx.shadowColor = col
  // a little seed: round body + a tail
  dot(ctx, w.x, w.y, SEED_R)
  ctx.fillStyle = HOT
  ctx.globalAlpha = 0.8
  dot(ctx, w.x, w.y - 1, SEED_R * 0.4)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
