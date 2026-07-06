'use client'

// SEEDFALL — the long drop. A Mana Seed falls down the canopy; hold the left/right half of
// the screen to drift that way (both = slow the fall), weave through the branches, out-drift
// the curious Havari, and set down soft on the garden soil at the bottom. Depth is the score;
// the soft-landing is the payoff. Atari vector-glow on a scrolling canvas. Sim in lib/seedfall.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import ArcadeControls from '../_components/ArcadeControls'
import DailyLeaderboard from '../_components/DailyLeaderboard'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import { screenMaxW } from '@/lib/arcade/fit'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'
import {
  makeWorld,
  setInput,
  tick,
  loadGarden,
  VW,
  VH,
  SEED_R,
  SEED_SCREEN_Y,
  DEPTH_GOAL,
  THICK,
  HAVARI_SWOOP_H,
  HAVARI_KILL_W,
  FUEL_MAX,
  SOFT_VY,
  type World,
  type Garden,
  type Rating,
} from './lib/seedfall'
import { sfx } from './lib/sfx'

const BG = '#04040a'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const LEAF = '#54ffc8' // soil + branches + safe-descent
const WARM = '#ff8a5c' // coming-in-too-hot
const VOID = '#c86bff' // the Havari + a shatter

// camera: keep the soil ~64px off the bottom once we reach it
const MAX_CAM_Y = DEPTH_GOAL - (VH - 64)

const STARS = (() => {
  const r = mulberry32(0x5eed)
  return Array.from({ length: 36 }, () => ({ x: r() * VW, y: r() * 1600, s: 0.5 + r() * 1.1, p: r() * 6.28, par: 0.3 + r() * 0.5 }))
})()

type Phase = 'ready' | 'playing' | 'landed' | 'crashed' | 'caught'
type Mode = 'endless' | 'daily'

export default function SeedfallPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const seedRef = useRef(1)
  // the cabinet deck's two buttons (and L/R keys) drive these holds; the screen is a neutral display.
  const held = useRef({ L: false, R: false })
  const syncT = useRef(0)

  const [phase, setPhase] = useState<Phase>('ready')
  const [mode, setMode] = useState<Mode>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [fuel, setFuel] = useState(FUEL_MAX)
  const [score, setScore] = useState(0)
  const [garden, setGarden] = useState<Garden>({ planted: 0, perfect: 0 })
  const [dailyBest, setDailyBest] = useState(0)
  const [rating, setRating] = useState<Rating | null>(null)
  const [muted, setMuted] = useState(false)
  const [shared, setShared] = useState(false)

  useNoScroll()

  const boot = useCallback(() => {
    seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0
    worldRef.current = makeWorld(modeRef.current === 'daily' ? dailySeed() : (seedRef.current ^ (Date.now() >>> 0)))
    held.current = { L: false, R: false }
    setFuel(FUEL_MAX)
    setScore(0)
    setRating(null)
    setShared(false)
    setPhase('ready')
  }, [])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setGarden(loadGarden())
    setDailyBest(loadDailyBest('seedfall'))
  }, [boot])

  const pickMode = (m: Mode) => {
    if (m === modeRef.current) return
    modeRef.current = m
    setMode(m)
    boot()
  }
  const onShare = async () => {
    if (await copyShare(dailyShare('Seedfall', score))) {
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

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
        if (ev.thread) sfx.play('thread')
        if (ev.havariEnter) sfx.play('thread')
        if (ev.landed) {
          sfx.play('plant')
          if (ev.rating === 'perfect') window.setTimeout(() => sfx.play('perfect'), 120)
          setGarden(loadGarden())
          setRating(ev.rating)
          setScore(w.score)
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('seedfall', w.score))
          setPhase('landed')
        }
        if (ev.caught) {
          sfx.play('caught')
          setScore(w.score)
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('seedfall', w.score))
          setPhase('caught')
        }
        if (ev.crashed) {
          sfx.play('crash')
          setScore(w.score)
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('seedfall', w.score))
          setPhase('crashed')
        }
        syncT.current += dt
        if (syncT.current >= 0.06) { syncT.current = 0; setFuel(w.fuel); setScore(w.score) }
      }
      render(canvas, w, ts, garden.planted)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [garden.planted])

  // ── two-button hold input (cabinet deck + L/R keys; screen is a neutral display) ──
  const applyInput = () => {
    const w = worldRef.current
    if (!w) return
    setInput(w, held.current.L, held.current.R)
    if (w.state === 'playing' && phase === 'ready') setPhase('playing')
  }
  const setHalf = (which: 'L' | 'R', on: boolean) => {
    const st = worldRef.current?.state
    if (on && (st === 'landed' || st === 'crashed' || st === 'caught')) return
    held.current[which] = on
    applyInput()
  }
  const deckPress = useCallback((id: string) => { sfx.ensure(); setHalf(id as 'L' | 'R', true) }, [phase])
  const deckRelease = useCallback((id: string) => { setHalf(id as 'L' | 'R', false) }, [phase])

  // desktop keyboard — the deck mirrors these (←/a = left thread, →/d = right)
  useEffect(() => {
    const k = (e: KeyboardEvent, on: boolean) => {
      const key = e.key.toLowerCase()
      if (key === 'arrowleft' || key === 'a') { sfx.ensure(); setHalf('L', on) }
      else if (key === 'arrowright' || key === 'd') { sfx.ensure(); setHalf('R', on) }
    }
    const down = (e: KeyboardEvent) => k(e, true)
    const up = (e: KeyboardEvent) => k(e, false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); setMuted(m) }

  const lowFuel = fuel <= FUEL_MAX * 0.25
  const depthPct = Math.min(100, Math.round((worldRef.current?.y ?? 0) / DEPTH_GOAL * 100))

  return (
    <ArcadeCabinet accent="#54ffc8" wall={1} maxWidth={screenMaxW(VW, VH)}>
      <div className="w-full max-w-[400px] flex items-center justify-between mb-3">
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-[#54ffc8] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #54ffc880' }}>Seedfall</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">weave the long drop</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      {/* score + depth + fuel */}
      <div className="w-full max-w-[400px] mb-2 flex items-center gap-3 font-mono">
        <span className="gx-label text-[10px] text-[#54ffc8]">depth <span className="gx-value text-[#e8feff] tabular-nums">{score}</span></span>
        <span className="gx-label text-[9px] text-[#7fd8e6]/40">{depthPct}%</span>
        <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden ml-auto max-w-[140px]">
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${(fuel / FUEL_MAX) * 100}%`, background: lowFuel ? '#ff5d9e' : '#37e6ff', boxShadow: `0 0 10px ${lowFuel ? '#ff5d9e' : '#37e6ff'}` }} />
        </div>
        <span className="gx-label text-[9px] text-[#7fd8e6]/40">ather</span>
      </div>

      <div className="gx-chrome relative w-full" style={{ maxWidth: screenMaxW(VW, VH), aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: '#54ffc8' } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block touch-none rounded-md"
        />
        <div className="pointer-events-none absolute inset-0 rounded-md sf-crt" />

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/seedfall/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.55]" />
            <div className="absolute inset-0 -z-10 bg-[#04040a]/66" />
            <div className="gx-title text-[#54ffc8] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #54ffc8' }}>Seedfall</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[280px]">
              hold a side to drift that way, both to slow the fall. weave the branches, slip the Havari, and set the seed down soft on the soil far below.
            </p>
            <div className="gx-label pointer-events-auto flex items-center gap-1.5 text-[10px]">
              {(['endless', 'daily'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => pickMode(m)}
                  className={`px-3 py-1.5 rounded-sm border transition-colors ${mode === m ? 'text-[#04040a] bg-[#54ffc8] border-[#54ffc8]' : 'text-[#54ffc8]/55 border-[#54ffc8]/25 hover:text-[#54ffc8]'}`}
                >
                  {m === 'daily' ? `daily #${dailyNumber()}` : m}
                </button>
              ))}
            </div>
            {mode === 'daily' && <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider -mt-1">same canopy for everyone today</div>}
            <div className="gx-label text-[12px] text-[#04040a] bg-[#54ffc8] px-6 py-2.5 rounded-[2px] mt-1" style={{ boxShadow: '0 0 18px #54ffc880' }}>hold to drop</div>
          </div>
        )}

        {phase === 'landed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#04040a]/72 rounded-md text-center px-6">
            <div className="gx-title text-2xl tracking-[0.3em] uppercase" style={{ color: rating === 'perfect' ? '#e8feff' : '#54ffc8', textShadow: `0 0 16px ${rating === 'perfect' ? '#e8feff' : '#54ffc8'}` }}>
              {rating === 'perfect' ? 'Perfect' : 'Rooted'}
            </div>
            <div className="gx-value font-mono text-[#e8feff] text-3xl leading-none tabular-nums" style={{ textShadow: '0 0 12px #54ffc880' }}>{score}</div>
            <p className="text-[10px] leading-relaxed text-[#9fd6e0]/75 max-w-[260px] italic">
              {rating === 'perfect' ? 'butter-soft, dead centre. the seed takes hold and glows.' : 'it reaches the soil and roots. the garden grows.'}
            </p>
            <OverFooter mode={mode} score={score} dailyBest={dailyBest} shared={shared} onShare={onShare} onRestart={restart} garden={garden} />
          </div>
        )}

        {(phase === 'crashed' || phase === 'caught') && (
          <div className="absolute inset-0 overflow-y-auto bg-[#04040a]/72 rounded-md">
           <div className="min-h-full flex flex-col items-center justify-center gap-2 text-center px-6 py-4">
            <div className="gx-title text-[#c86bff] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #c86bff' }}>{phase === 'caught' ? 'Snatched' : 'Shattered'}</div>
            <div className="gx-value font-mono text-[#e8feff] text-3xl leading-none tabular-nums" style={{ textShadow: '0 0 12px #54ffc880' }}>{score}</div>
            <p className="text-[10px] leading-relaxed text-[#9fd6e0]/70 max-w-[250px] italic">
              {phase === 'caught' ? 'the Havari plucks the seed from the air, curious, and carries it off.' : 'it clips a branch and scatters to the wind. drift cleaner next time.'}
            </p>
            <OverFooter mode={mode} score={score} dailyBest={dailyBest} shared={shared} onShare={onShare} onRestart={restart} garden={garden} />
           </div>
          </div>
        )}
      </div>

      {/* the cabinet control deck — hold a side to drift, both to slow (screen stays a clean display) */}
      <ArcadeControls
        accent="#54ffc8"
        maxWidth={screenMaxW(VW, VH)}
        buttons={[
          { id: 'L', label: 'Left', glyph: '◀', hint: '←', size: 'lg' },
          { id: 'R', label: 'Right', glyph: '▶', hint: '→', size: 'lg' },
        ]}
        onPress={deckPress}
        onRelease={deckRelease}
        hint="hold a side to drift · both to slow · go deep"
      />

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

// shared game-over footer (garden tally · best/share · play again · daily leaderboard)
function OverFooter({ mode, score, dailyBest, shared, onShare, onRestart, garden }: {
  mode: Mode; score: number; dailyBest: number; shared: boolean; onShare: () => void; onRestart: () => void; garden: Garden
}) {
  return (
    <>
      <div className="text-[10px] font-mono text-[#54ffc8]/60 tracking-wider">
        {mode === 'daily'
          ? <>daily #{dailyNumber()} · best {dailyBest}{score >= dailyBest && score > 0 ? ' ✦ today’s best' : ''}</>
          : <>garden {garden.planted}{garden.perfect > 0 ? ` · ${garden.perfect} perfect` : ''}</>}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <button onClick={onRestart} className="gx-label text-[11px] text-[#04040a] bg-[#54ffc8] hover:bg-[#8affdd] px-5 py-2 rounded-[2px]" style={{ boxShadow: '0 0 18px #54ffc880' }}>drop again →</button>
        {mode === 'daily' && (
          <button onClick={onShare} className="gx-label text-[11px] text-[#54ffc8] border border-[#54ffc8]/40 hover:border-[#54ffc8] px-5 py-2 rounded-[2px] transition-colors">{shared ? 'copied ✓' : 'share'}</button>
        )}
      </div>
      {mode === 'daily' && <DailyLeaderboard gameId="seedfall" accent="#54ffc8" score={score} className="mt-1.5" />}
    </>
  )
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, planted: number) {
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

  // camera: track the seed, but clamp at the top (intro fall-in) and the soil (landing approach)
  const camY = Math.max(-40, Math.min(w.y - SEED_SCREEN_Y, MAX_CAM_Y))
  const sy = (worldY: number) => worldY - camY

  // parallax stars (wrap over a 1600 band, scaled by per-star parallax)
  for (const s of STARS) {
    const yy = ((s.y - camY * s.par) % 1600 + 1600) % 1600 - 200
    if (yy < -10 || yy > VH + 10) continue
    ctx.globalAlpha = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.p))
    ctx.fillStyle = '#9fb0c8'
    dot(ctx, s.x, yy, s.s)
  }
  ctx.globalAlpha = 1

  // wind streaks — telegraph the breeze
  const wind = w.wind
  for (let i = 0; i < 6; i++) {
    const wy = 90 + i * 80 + Math.sin(t + i) * 6
    const phase = (t * (0.4 + i * 0.05) + i * 0.37) % 1
    const wx = phase * (VW + 60) - 30
    const dir = Math.sign(wind) || 1
    const len = 9 + Math.abs(wind) * 0.22
    ctx.strokeStyle = LEAF
    ctx.globalAlpha = 0.05 + Math.min(0.07, Math.abs(wind) / 700)
    ctx.lineWidth = 1
    seg(ctx, wx, wy, wx + dir * len, wy)
  }
  ctx.globalAlpha = 1

  // depth ticks on the walls — convey the scroll/descent speed
  ctx.strokeStyle = '#2a3340'
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.5
  const tick0 = Math.floor(camY / 120) * 120
  for (let yy = tick0; yy < camY + VH + 120; yy += 120) {
    const py = sy(yy)
    seg(ctx, 0, py, 10, py)
    seg(ctx, VW - 10, py, VW, py)
  }
  ctx.globalAlpha = 1

  // ── branches: leafy limbs with one opening ──────────────────────────────────
  for (const b of w.branches) {
    const py = sy(b.y)
    if (py < -THICK || py > VH + THICK) continue
    const gl = b.gapX - b.gap / 2
    const gr = b.gapX + b.gap / 2
    const col = b.passed ? '#2f6f5a' : LEAF
    ctx.strokeStyle = col
    ctx.globalAlpha = b.passed ? 0.4 : 0.92
    ctx.lineWidth = THICK
    ctx.shadowBlur = b.passed ? 0 : 9
    ctx.shadowColor = LEAF
    if (gl > 2) seg(ctx, 0, py, gl, py)
    if (gr < VW - 2) seg(ctx, gr, py, VW, py)
    // little leaf nubs along the limb (cheap texture)
    if (!b.passed) {
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.55
      for (let x = 12; x < gl - 4; x += 22) seg(ctx, x, py, x - 5, py - 7)
      for (let x = gr + 8; x < VW - 6; x += 22) seg(ctx, x, py, x + 5, py - 7)
    }
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1

  // ── soil floor + pad + garden (only when in view) ───────────────────────────
  const soilY = sy(DEPTH_GOAL)
  if (soilY < VH + 40) {
    ctx.strokeStyle = LEAF
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1.5
    ctx.shadowBlur = 8
    ctx.shadowColor = LEAF
    seg(ctx, 0, soilY, VW, soilY)
    // the landing pad — a bright strip you must set down on
    const padL = w.padX - w.padW / 2
    ctx.strokeStyle = HOT
    ctx.lineWidth = 3
    ctx.shadowBlur = 14
    ctx.globalAlpha = 0.9
    seg(ctx, padL, soilY, padL + w.padW, soilY)
    ctx.fillStyle = LEAF
    dot(ctx, padL, soilY, 2.5)
    dot(ctx, padL + w.padW, soilY, 2.5)
    // persistent garden sprouts
    const sprouts = Math.min(28, planted)
    for (let i = 0; i < sprouts; i++) {
      const gx = 14 + ((i * 53) % (VW - 28))
      const h = 6 + ((i * 17) % 9)
      const sway = Math.sin(t * 1.5 + i) * 1.5
      ctx.strokeStyle = LEAF
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1.5
      ctx.shadowBlur = 6
      seg(ctx, gx, soilY, gx + sway, soilY - h)
      ctx.fillStyle = HOT
      dot(ctx, gx + sway, soilY - h, 1.6)
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  // ── the Havari (bird spirit) — a committed swoop, not a hover ────────────────
  const hv = w.havari
  const seedScreenY = sy(w.y)
  if (hv) {
    // DANGER BAND at the intercept point — shown from the warn. Drift out of this column to live.
    const bandPulse = 0.5 + 0.5 * Math.sin(t * 9)
    const bandTop = seedScreenY - HAVARI_SWOOP_H
    const bandH = HAVARI_SWOOP_H + 18
    const grad = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH)
    grad.addColorStop(0, 'rgba(200,107,255,0)')
    grad.addColorStop(1, `rgba(200,107,255,${0.1 + 0.12 * bandPulse})`)
    ctx.fillStyle = grad
    ctx.fillRect(hv.targetX - HAVARI_KILL_W, bandTop, HAVARI_KILL_W * 2, bandH)
    ctx.globalAlpha = 0.5 + 0.3 * bandPulse
    ctx.strokeStyle = VOID
    ctx.lineWidth = 1
    ctx.setLineDash([4, 5])
    seg(ctx, hv.targetX - HAVARI_KILL_W, bandTop, hv.targetX - HAVARI_KILL_W, bandTop + bandH)
    seg(ctx, hv.targetX + HAVARI_KILL_W, bandTop, hv.targetX + HAVARI_KILL_W, bandTop + bandH)
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    if (hv.state === 'warn') {
      // pulsing glint at the edge it will dive in from
      const ex = hv.side < 0 ? 12 : VW - 12
      const ey = seedScreenY - 60
      ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * 14)
      ctx.fillStyle = VOID
      ctx.shadowBlur = 12
      ctx.shadowColor = VOID
      dot(ctx, ex, ey, 4)
      ctx.lineWidth = 2
      ctx.strokeStyle = VOID
      const dir = hv.side < 0 ? 1 : -1
      seg(ctx, ex, ey, ex + dir * 14, ey)
      ctx.shadowBlur = 0
    } else {
      // the bird: two flapping wings + a bright body, banking into its dive
      const px = hv.x
      const py = seedScreenY + hv.dy
      const flap = Math.sin(t * 18) * 7
      const bank = Math.max(0, 1 + hv.dy / HAVARI_SWOOP_H) // 0 high → 1 at the bottom of the dive
      ctx.globalAlpha = 0.96
      ctx.strokeStyle = VOID
      ctx.lineWidth = 2.5
      ctx.shadowBlur = 12
      ctx.shadowColor = VOID
      seg(ctx, px, py, px - 11, py - 6 - flap + bank * 4)
      seg(ctx, px, py, px + 11, py - 6 - flap + bank * 4)
      ctx.fillStyle = HOT
      dot(ctx, px, py, 3)
      ctx.shadowBlur = 0
    }
  }
  ctx.globalAlpha = 1

  // ── the Mana Seed ────────────────────────────────────────────────────────────
  const seedY = sy(w.y) // == SEED_SCREEN_Y except during intro fall-in / soil approach
  const safe = w.vy <= SOFT_VY
  const col = (w.state === 'crashed' || w.state === 'caught') ? VOID : safe ? LEAF : WARM
  if (w.thrusting && w.state === 'playing') {
    // a PUFF OF WIND nudges the seed (not a rocket): soft curling Ather-gusts that
    // bloom on the upwind side and sweep across in the drift direction. cozy, airy, quick.
    const both = w.input.left && w.input.right
    ctx.strokeStyle = ATHER
    ctx.lineCap = 'round'
    ctx.lineWidth = 3
    ctx.shadowBlur = 14
    ctx.shadowColor = ATHER
    if (both) {
      // updraft: air cups UP under the seed, pillowing the fall — bold upcurls
      for (let i = 0; i < 4; i++) {
        const ph = t * 9 + i * 1.3
        const sx = w.x + (i - 1.5) * 13
        const by = seedY + SEED_R + 14
        const sway = Math.sin(ph) * 5
        ctx.globalAlpha = 0.30 + 0.40 * (0.5 + 0.5 * Math.sin(ph))
        ctx.beginPath()
        ctx.moveTo(sx, by)
        ctx.quadraticCurveTo(sx + sway, by - 10, sx + sway + (i - 1.5) * 6, by - 22)
        ctx.stroke()
      }
    } else {
      // lateral gust: wind shoves the seed sideways. mdir = the way it drifts.
      const mdir = w.input.left ? -1 : 1
      const ox = w.x - mdir * (SEED_R + 4) // origin on the UPWIND side
      for (let i = 0; i < 4; i++) {
        const ph = t * 12 + i * 1.0
        const yoff = (i - 1.5) * 7 + Math.sin(ph) * 2.5
        const len = 28 + i * 7
        const y0 = seedY + yoff
        ctx.globalAlpha = 0.32 + 0.38 * (0.5 + 0.5 * Math.sin(ph))
        ctx.beginPath()
        ctx.moveTo(ox, y0)
        ctx.quadraticCurveTo(ox + mdir * len * 0.5, y0 - 9, ox + mdir * len, y0 + 2)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }
  ctx.fillStyle = col
  ctx.shadowBlur = 16
  ctx.shadowColor = col
  dot(ctx, w.x, seedY, SEED_R)
  ctx.fillStyle = HOT
  ctx.globalAlpha = 0.85
  dot(ctx, w.x, seedY - 1, SEED_R * 0.4)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
