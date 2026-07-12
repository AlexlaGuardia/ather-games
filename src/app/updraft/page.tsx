'use client'

// UPDRAFT — a spark of Ather rides the rising light. One tap to beat upward and climb,
// fall when you don't, thread the void gates. Pure pick-up-die-retry, Atari vector-glow
// on canvas. The rider is a mote of Ather, not Lazerin (canon ruling, world/arcade.md).
// Core sim lives in lib/updraft.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import ArcadeControls from '../_components/ArcadeControls'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import { screenMaxW, deckMaxW, cabinetMaxW } from '@/lib/arcade/fit'
import {
  makeWorld,
  flap,
  launch,
  tick,
  loadHiScore,
  saveHiScore,
  airAt,
  VW,
  VH,
  GROUND_Y,
  BIRD_X,
  BIRD_R,
  GATE_W,
  SCROLL,
  type World,
  type Air,
} from './lib/updraft'
import { sfx } from './lib/sfx'
import { music } from './music'
import { vo } from './vo'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'
import DailyLeaderboard from '../_components/DailyLeaderboard'
import { StartButton, useStartKey } from '../_components/ArcadeStart'

const BG = '#04040a'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const VOID = '#c86bff'
const VOID_DIM = '#4a2078'

// per-air palette (canon four airs — game/updraft.md). tint = a low-alpha wash so each air reads
// as a different sky; gate = the void-gate colour for that air; name = the wayfinding label.
const AIR_TINT: Record<Air, string> = {
  open: '#0e3552',    // the open current — clear airy blue
  gates: '#2a1846',   // the gate-reach — the void crowds, violet
  thermal: '#4a3210', // the rising thermal — warm updraft glow
  churn: '#123a37',   // the churn — turbulent teal near the void's tears
}
const AIR_GATE: Record<Air, string> = {
  open: '#7fb8ff', gates: '#c86bff', thermal: '#ffb066', churn: '#4ce0c8',
}
const AIR_NAME: Record<Air, string> = {
  open: 'the open current', gates: 'the gate-reach', thermal: 'the rising thermal', churn: 'the churn',
}

// a fixed parallax star-field (drifts left for a sense of speed)
const STARS = (() => {
  const r = mulberry32(0x1a2)
  return Array.from({ length: 40 }, () => ({ x: r() * VW, y: r() * (GROUND_Y - 8), s: 0.6 + r() * 1.2, sp: 0.3 + r() * 0.9 }))
})()

// distant spire silhouettes (procedural parallax — echoes Ward's spires for cohesion)
const FAR_SPIRES = (() => {
  const r = mulberry32(0x5e)
  return Array.from({ length: 7 }, (_, i) => ({ x: i * 90 + r() * 30, h: 60 + r() * 90, w: 22 + r() * 16 }))
})()
const FAR_SPAN = 7 * 90 // wrap width for the spire row

type Phase = 'ready' | 'playing' | 'over'

export default function UpdraftPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const nebulaRef = useRef<HTMLImageElement | null>(null)
  const voMileRef = useRef(0) // gate-pass milestone crossings spoken (reset each run)
  const seedRef = useRef(1)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [muted, setMuted] = useState(false)
  const [mode, setMode] = useState<'endless' | 'daily'>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)

  useNoScroll() // pin to viewport on mobile — no page scroll / iOS bounce

  const boot = useCallback(() => {
    let seed: number
    if (modeRef.current === 'daily') seed = dailySeed()
    else { seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0; seed = seedRef.current ^ (Date.now() >>> 0) }
    worldRef.current = makeWorld(seed)
    voMileRef.current = 0; vo.reset() // fresh run: re-arm the commentator
    setScore(0)
    setShared(false)
    setPhase('ready')
  }, [])

  const pickMode = (m: 'endless' | 'daily') => {
    if (m === modeRef.current) return
    modeRef.current = m
    setMode(m)
    boot()
  }
  const onShare = async () => {
    if (await copyShare(dailyShare('Updraft', score))) {
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    music.setMuted(sfx.isMuted()); void music.ensure() // decode the bed ahead of the first flap
    vo.setMuted(sfx.isMuted()); void vo.ensure(); vo.setOnSpeak(() => music.duck()) // a spoken line dips the bed
    setBest(loadHiScore())
    setDailyBest(loadDailyBest('updraft'))
    const img = new Image()
    img.src = '/updraft/nebula.webp'
    img.onload = () => { nebulaRef.current = img }
    return () => { music.stop(); vo.stop() } // tear audio down on leave — never follows you out
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
          // climbing milestone — a warm beat every 10 gates cleared
          if (w.score >= (voMileRef.current + 1) * 10) { voMileRef.current++; vo.play('climbing') }
        }
        if (ev.crash) {
          sfx.play('crash')
          window.setTimeout(() => sfx.play('over'), 180)
          let isBest = false
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('updraft', w.score))
          else { const prev = loadHiScore(); isBest = w.score > 0 && w.score > prev; setBest(saveHiScore(w.score)) }
          setPhase('over')
          vo.play(isBest ? 'best' : 'over')
        }
      }

      render(canvas, w, ts, nebulaRef.current)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  // START owns launching the run (flip ready → playing WITHOUT beating the wings — the rider waits on
  // the updraft so you can read the first gate; your first tap then only flaps). Decoupled from input.
  const start = useCallback(() => {
    const w = worldRef.current
    if (!w || w.state !== 'ready') return
    sfx.ensure() // the START gesture unlocks audio + starts the bed
    launch(w) // ready → playing + spawns the first gate with breathing room (restored)
    setPhase('playing')
    music.start()
    vo.play('start')
  }, [])
  useStartKey(start, phase === 'ready') // Enter / Space also start

  const onDown = useCallback(() => {
    const w = worldRef.current
    if (!w || w.state !== 'playing') return // START launches the run; a tap only flaps while playing
    flap(w)
    sfx.play('flap')
  }, [])

  // Desktop keyboard: Space / ↑ / W flap while playing (useStartKey owns them pre-play, so
  // this only binds once the run is live — no double-fire at the ready→playing hand-off).
  useEffect(() => {
    if (phase !== 'playing') return
    const h = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        onDown()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [phase, onDown])

  const restart = useCallback(() => {
    sfx.ensure()
    boot()
  }, [boot])

  const toggleMute = () => {
    sfx.ensure()
    const m = !sfx.isMuted()
    sfx.setMuted(m)
    music.setMuted(m)
    vo.setMuted(m)
    setMuted(m)
  }

  return (
    <ArcadeCabinet gameId="updraft" accent="#37e6ff" wall={1} maxWidth={cabinetMaxW(VW, VH)}>
      <div className="w-full flex items-center justify-between mb-2" style={{ maxWidth: cabinetMaxW(VW, VH) }}>
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Updraft</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">ride the ather</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">
          {muted ? 'son' : 'snd'}
        </button>
      </div>

      <div
        className="gx-chrome relative w-full"
        onPointerDown={onDown} // click/tap the screen itself flaps (desktop mouse; overlays sit above and self-guard)
        style={{ maxWidth: screenMaxW(VW, VH), aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: '#37e6ff' } as React.CSSProperties}
      >
        <canvas ref={canvasRef} className="w-full h-full block rounded-md pointer-events-none" />
        <div className="pointer-events-none absolute inset-0 rounded-md updraft-crt" />

        {/* live score, big and centered like a real flappy */}
        {phase === 'playing' && (
          <div className="pointer-events-none absolute top-6 inset-x-0 text-center gx-value font-mono text-[#e8feff] text-4xl" style={{ textShadow: '0 0 14px #37e6ff90' }}>
            {score}
          </div>
        )}

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/updraft/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.6]" />
            <div className="absolute inset-0 -z-10 bg-[#04040a]/62" />
            <div className="gx-title text-[#37e6ff] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #37e6ff' }}>Updraft</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[260px]">
              tap to beat your wings and rise. fall when you don't. thread the void gates.
            </p>
            <div className="gx-label pointer-events-auto flex items-center gap-1.5 mt-0.5 text-[10px]">
              {(['endless', 'daily'] as const).map((m) => (
                <button key={m} onClick={() => pickMode(m)}
                  className={`px-3 py-1.5 rounded-sm border transition-colors ${mode === m ? 'text-[#04040a] bg-[#37e6ff] border-[#37e6ff]' : 'text-[#37e6ff]/55 border-[#37e6ff]/25 hover:text-[#37e6ff]'}`}>
                  {m === 'daily' ? `daily #${dailyNumber()}` : m}
                </button>
              ))}
            </div>
            {mode === 'daily' && <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider -mt-1">same currents for everyone today</div>}
            <div className="mt-1"><StartButton accent={ATHER} onStart={start} hint="then tap to fly" /></div>
          </div>
        )}

        {phase === 'over' && (
          <div className="absolute inset-0 overflow-y-auto bg-[#04040a]/75 rounded-md">
           <div className="min-h-full flex flex-col items-center justify-center gap-2.5 text-center px-6 py-4">
            <div className="gx-title text-[#ff5d9e] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #ff5d9e' }}>Down he goes</div>
            <div className="gx-value font-mono text-[#e8feff] text-4xl leading-none" style={{ textShadow: '0 0 12px #37e6ff80' }}>{score}</div>
            <div className="text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider">
              {mode === 'daily'
                ? <>daily #{dailyNumber()} · best {dailyBest}{score >= dailyBest && score > 0 ? ' ✦ today’s best' : ''}</>
                : <>best {best}{score >= best && score > 0 ? ' ✦ new best' : ''}</>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={restart} className="gx-label text-[11px] text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-5 py-2 rounded-[2px]" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
                fly again →
              </button>
              {mode === 'daily' && (
                <button onClick={onShare} className="gx-label text-[11px] text-[#37e6ff] border border-[#37e6ff]/40 hover:border-[#37e6ff] px-5 py-2 rounded-[2px] transition-colors">
                  {shared ? 'copied ✓' : 'share'}
                </button>
              )}
            </div>
            {mode === 'daily' && <DailyLeaderboard gameId="updraft" accent="#37e6ff" score={score} className="mt-1.5" />}
           </div>
          </div>
        )}
      </div>

      {/* the cabinet control deck — one big FLY button (screen stays a clean display) */}
      <ArcadeControls
        accent="#37e6ff"
        maxWidth={deckMaxW}
        buttons={[{ id: 'flap', label: 'Fly', glyph: '➶', hint: 'tap', size: 'lg' }]}
        onPress={onDown}
        hint="tap to beat your wings · rise"
        keyLegend={[{ keys: 'Space', label: 'fly' }, { keys: 'click', label: 'fly' }]}
      />


      <style jsx>{`
        .updraft-crt {
          background:
            radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, 0.5) 100%),
            repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.16) 3px, rgba(0, 0, 0, 0) 4px);
          animation: updraft-flicker 4.5s infinite steps(60);
          mix-blend-mode: multiply;
        }
        @keyframes updraft-flicker {
          0%, 97%, 100% { opacity: 1; }
          98% { opacity: 0.93; }
          99% { opacity: 0.97; }
        }
      `}</style>
    </ArcadeCabinet>
  )
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, nebula: HTMLImageElement | null) {
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
  const moving = w.state === 'playing'

  // backmost layer: the nebula, faint + gently floating (no tiling seam — drawn
  // over-scanned and nudged by sin, edges are pure black so it just breathes)
  if (nebula && nebula.complete && nebula.naturalWidth) {
    const over = 28
    const dx = Math.sin(t * 0.06) * over - over / 2 - (moving ? (t * 5) % over : 0)
    const dy = Math.cos(t * 0.05) * (over * 0.4)
    ctx.globalAlpha = 0.5
    ctx.drawImage(nebula, dx, dy, VW + over * 2, VH + over)
    ctx.globalAlpha = 1
  }

  // far parallax: distant spire silhouettes drifting slowly along the floor
  const drift = (t * SCROLL * 0.18) % FAR_SPAN
  for (let rep = 0; rep < 2; rep++) {
    for (const s of FAR_SPIRES) {
      const x = ((s.x - drift + rep * FAR_SPAN) % (FAR_SPAN * 2) + FAR_SPAN * 2) % (FAR_SPAN * 2)
      if (x > VW + 30) continue
      ctx.fillStyle = 'rgba(74,32,120,0.22)'
      ctx.beginPath()
      ctx.moveTo(x - s.w / 2, GROUND_Y)
      ctx.lineTo(x, GROUND_Y - s.h)
      ctx.lineTo(x + s.w / 2, GROUND_Y)
      ctx.closePath()
      ctx.fill()
    }
  }

  // drifting starfield
  for (const s of STARS) {
    const x = moving ? ((s.x - t * 40 * s.sp) % VW + VW) % VW : s.x
    ctx.globalAlpha = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.4 + s.x))
    ctx.fillStyle = '#8a7bb0'
    dot(ctx, x, s.y, s.s)
  }
  ctx.globalAlpha = 1

  // ── air wash: tint the whole sky by the current air (the four canon airs) ──────
  const air = airAt(w.dist)
  ctx.globalAlpha = 0.2
  ctx.fillStyle = AIR_TINT[air]
  ctx.fillRect(0, 0, VW, VH)
  ctx.globalAlpha = 1
  // the Rising Thermal: motes stream UPWARD to telegraph the lift you feel
  if (air === 'thermal' && moving) {
    ctx.fillStyle = AIR_GATE.thermal
    for (let i = 0; i < 7; i++) {
      const mx = ((i * 61) % VW)
      const my = (GROUND_Y - ((t * 90 + i * 83) % GROUND_Y))
      ctx.globalAlpha = 0.16 + 0.14 * Math.sin(t * 3 + i)
      dot(ctx, mx, my, 1.6)
    }
    ctx.globalAlpha = 1
  }

  // void gates — coloured by their air; openings are FIXED (a gate never moves)
  for (const g of w.gates) {
    const cy = g.gapY
    const top = cy - g.gapH / 2
    const bot = cy + g.gapH / 2
    const gc = AIR_GATE[g.air]
    drawGate(ctx, g.x, 0, top, gc) // upper column
    drawGate(ctx, g.x, bot, GROUND_Y - bot, gc) // lower column
    // gap-edge glints
    ctx.fillStyle = HOT
    ctx.shadowBlur = 10
    ctx.shadowColor = gc
    dot(ctx, g.x + GATE_W / 2, top, 2)
    dot(ctx, g.x + GATE_W / 2, bot, 2)
    ctx.shadowBlur = 0
  }

  // current-air wayfinding label — a faint name so each air announces itself
  if (moving) {
    ctx.font = '600 10px ui-monospace, SFMono-Regular, monospace'
    ctx.textAlign = 'center'
    ctx.globalAlpha = 0.36
    ctx.fillStyle = AIR_GATE[air]
    ctx.fillText(AIR_NAME[air].toUpperCase(), VW / 2, 26)
    ctx.globalAlpha = 1
    ctx.textAlign = 'start'
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

function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, col: string) {
  if (h <= 0) return
  ctx.fillStyle = 'rgba(74,32,120,0.18)'
  ctx.fillRect(x, y, GATE_W, h)
  ctx.strokeStyle = col
  ctx.lineWidth = 2
  ctx.shadowBlur = 10
  ctx.shadowColor = col
  ctx.strokeRect(x + 1, y, GATE_W - 2, h)
  ctx.shadowBlur = 0
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
