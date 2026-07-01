'use client'

// WARD — Missile Command over the spires. The void rains blight down on the last
// spires of Aeterna; tap the sky to bloom Ather bursts and unmake it before it
// lands. Hold the line wave on wave; the run ends when the last spire falls.
// Atari vector-glow on canvas, real-time. Core sim lives in lib/ward.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeWorld,
  tick,
  fireBloom,
  loadHiScore,
  saveHiScore,
  tauntFor,
  runStats,
  type RunStats,
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
import ArcadeCabinet from '../_components/ArcadeCabinet'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'
import DailyLeaderboard from '../_components/DailyLeaderboard'

const BG = '#04040a'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const SPIRE = '#6cf0ff'
const VOID = '#c86bff'
const VOID_DIM = '#4a2078'
const HOT_VOID = '#ff5db0' // splitters — hotter, "deal with me first"
const DRIFT = '#54ffa8' // drifters — green serpentine weavers, "lead me"
const DART = '#ff5a5a' // darters — hot red, "I'm about to snap"
const HUSKC = '#9a86c0' // husks — armored steel-void, "hit me twice"
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
  const [stats, setStats] = useState<RunStats | null>(null)
  const [hud, setHud] = useState<Hud>({ score: 0, wave: 1, ammo: 0, maxAmmo: 0, spires: NUM_SPIRES, hi: 0 })
  const [mode, setMode] = useState<'endless' | 'daily'>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)

  useNoScroll() // pin to viewport on mobile — no page scroll / iOS bounce

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
    // daily = the same seeded onslaught for everyone today; endless = random.
    let seed: number
    if (modeRef.current === 'daily') seed = dailySeed()
    else { seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0; seed = seedRef.current ^ (Date.now() >>> 0) }
    const w = makeWorld(seed)
    worldRef.current = w
    overRef.current = false
    setOver(false)
    setShared(false)
    setHud(readHud(w))
  }, [readHud])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setDailyBest(loadDailyBest('ward'))
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
        if (ev.cleanKills) sfx.play('clean')
        if (ev.bestMulti >= 2) sfx.play('multi')
        if (ev.spireHits) sfx.play('spire')
        if (ev.waveCleared) sfx.play('wave')
        if (ev.gameOver) {
          sfx.play('over')
          overRef.current = true
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('ward', w.score))
          const hi = modeRef.current === 'daily' ? loadHiScore() : saveHiScore(w.score)
          setStats(runStats(w))
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

  const pickMode = (m: 'endless' | 'daily') => {
    if (m === modeRef.current) return
    modeRef.current = m // sync so boot's re-seed reads the new mode immediately
    setMode(m)
    boot()
  }
  const onShare = async () => {
    if (await copyShare(dailyShare('Ward', hud.score))) {
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

  const toggleMute = () => {
    sfx.ensure()
    const m = !sfx.isMuted()
    sfx.setMuted(m)
    setMuted(m)
  }

  const lowAmmo = hud.maxAmmo > 0 && hud.ammo <= 3

  return (
    <ArcadeCabinet accent="#37e6ff" wall={1} maxWidth={520}>
      {/* header */}
      <div className="w-full max-w-[520px] flex items-center justify-between mb-4">
        <span aria-hidden className="w-10" />
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
          <div className="gx-label text-[9px] text-[#7fd8e6]/40">score</div>
          <div className="gx-value text-[#e8feff] text-lg leading-none" style={{ textShadow: '0 0 8px #37e6ff70' }}>{hud.score.toLocaleString()}</div>
        </div>
        <div className="text-center">
          <div className="gx-label text-[9px] text-[#ffb24a]/60">wave</div>
          <div className="gx-value text-[#ffb24a] text-lg leading-none" style={{ textShadow: '0 0 8px #ffb24a70' }}>{hud.wave}</div>
        </div>
        <div className="text-right">
          <div className="gx-label text-[9px] text-[#7fd8e6]/40">best</div>
          <div className="gx-value text-[#7fd8e6]/70 text-lg leading-none">{hud.hi.toLocaleString()}</div>
        </div>
      </div>

      {/* ammo + spires */}
      <div className="w-full max-w-[480px] mb-2 flex items-center gap-3">
        <span className="gx-label text-[9px] text-[#7fd8e6]/40">ather</span>
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
      <div className="gx-chrome relative w-full max-w-[480px]" style={{ aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: '#37e6ff' } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          className="w-full h-full block touch-none rounded-md cursor-crosshair"
        />
        <div className="pointer-events-none absolute inset-0 rounded-md wd-crt" />

        {!started && (
          <div onPointerDown={startGame} className="cursor-pointer absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ward/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.65]" />
            <div className="absolute inset-0 -z-10 bg-[#04040a]/65" />
            <div className="gx-title text-[#37e6ff] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #37e6ff' }}>Ward</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[300px]">
              the void is falling on the spires. tap the sky to bloom Ather and unmake it before it lands.
            </p>
            <div className="gx-label flex items-center gap-1.5 mt-0.5 text-[10px]">
              {(['endless', 'daily'] as const).map((m) => (
                <button
                  key={m}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); pickMode(m) }}
                  className={`px-3 py-1.5 rounded-sm border transition-colors ${mode === m ? 'text-[#04040a] bg-[#37e6ff] border-[#37e6ff]' : 'text-[#37e6ff]/55 border-[#37e6ff]/25 hover:text-[#37e6ff]'}`}
                >
                  {m === 'daily' ? `daily #${dailyNumber()}` : m}
                </button>
              ))}
            </div>
            {mode === 'daily' && <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider -mt-1">same onslaught for everyone today</div>}
            <button className="gx-label text-[12px] text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-6 py-2.5 rounded-[2px] mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
              tap to defend
            </button>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 overflow-y-auto bg-[#04040a]/75 rounded-md">
           <div className="min-h-full flex flex-col items-center justify-center gap-2.5 text-center px-6 py-4">
            <div className="gx-title text-[#ff5d9e] text-xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 16px #ff5d9e' }}>The line breaks</div>
            <div className="gx-value font-mono text-[#e8feff] text-3xl leading-none" style={{ textShadow: '0 0 12px #37e6ff80' }}>{hud.score.toLocaleString()}</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/85 italic max-w-[300px]">
              {tauntFor(hud.wave, hud.score, hud.score >= hud.hi && hud.score > 0)}
            </p>
            <div className="text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider">
              {mode === 'daily'
                ? <>daily #{dailyNumber()} · reached wave {hud.wave} · best {dailyBest.toLocaleString()}{hud.score >= dailyBest && hud.score > 0 ? ' ✦ today’s best' : ''}</>
                : <>reached wave {hud.wave} · best {hud.hi.toLocaleString()}{hud.score >= hud.hi && hud.score > 0 ? ' ✦ new best' : ''}</>}
            </div>

            {stats && (
              <div className="mt-1 grid grid-cols-4 gap-2 font-mono">
                {[
                  { label: 'accuracy', value: `${stats.accuracy}%` },
                  { label: 'downed', value: stats.downed },
                  { label: 'best chain', value: stats.maxMulti >= 2 ? `×${stats.maxMulti}` : '—' },
                  { label: 'clean', value: stats.cleanTotal },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center rounded-sm bg-white/[0.04] px-2 py-1.5">
                    <span className="gx-value text-[#e8feff] text-sm leading-none" style={{ textShadow: '0 0 6px #37e6ff60' }}>{s.value}</span>
                    <span className="gx-label text-[8px] text-[#7fd8e6]/45 mt-1">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <button onClick={restart} className="gx-label text-[11px] text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-5 py-2 rounded-[2px]" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
                defend again →
              </button>
              {mode === 'daily' && (
                <button onClick={onShare} className="gx-label text-[11px] text-[#37e6ff] border border-[#37e6ff]/40 hover:border-[#37e6ff] px-5 py-2 rounded-[2px] transition-colors">
                  {shared ? 'copied ✓' : 'share'}
                </button>
              )}
            </div>
            {mode === 'daily' && <DailyLeaderboard gameId="ward" accent="#37e6ff" score={hud.score} className="mt-1.5" />}
           </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-[480px] flex items-center justify-center mt-4">
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
    </ArcadeCabinet>
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

  // blight — trail from origin to head, glowing diamond head. splitters (MIRVs)
  // read hotter + bigger with a telegraph ring + split-line at their fork altitude.
  for (const b of w.blight) {
    if (b.kind === 'drifter') {
      // DRIFTER (tracking) — a green serpentine weaver. Its WAVY WAKE is the tell:
      // it moves sideways, so you have to lead it. The wake is reconstructed from the
      // exact weave path it took, so the wiggle reads honestly.
      const amp = b.driftAmp ?? 165, freq = b.driftFreq ?? 2.5, ph = b.driftPhase ?? 0, age = b.age ?? 0
      ctx.strokeStyle = DRIFT
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 2
      ctx.shadowBlur = 7
      ctx.shadowColor = DRIFT
      ctx.beginPath()
      for (let s = 0; s <= 10; s++) {
        const tau = (s / 10) * 0.95 // ~1s of wake
        const px = b.x + (amp / freq) * (Math.cos(age * freq + ph) - Math.cos((age - tau) * freq + ph))
        const py = b.y - b.vy * tau
        if (s === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = DRIFT
      ctx.shadowBlur = 13
      ctx.shadowColor = DRIFT
      diamond(ctx, b.x, b.y, 5 + 0.7 * Math.sin(t * 7 + b.x))
      continue
    }
    const grad = ctx.createLinearGradient(b.ox, b.oy, b.x, b.y)
    grad.addColorStop(0, 'rgba(74,32,120,0)')
    grad.addColorStop(1, VOID_DIM)
    ctx.strokeStyle = grad
    ctx.lineWidth = 2
    ctx.shadowBlur = 0
    seg(ctx, b.ox, b.oy, b.x, b.y)
    if (b.splitter) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 9 + b.x)
      // faint fork-altitude line — "kill it above here"
      if (b.splitY !== undefined) {
        ctx.strokeStyle = HOT_VOID
        ctx.globalAlpha = 0.12
        ctx.lineWidth = 1
        ctx.shadowBlur = 0
        seg(ctx, b.x - 16, b.splitY, b.x + 16, b.splitY)
        ctx.globalAlpha = 1
      }
      ctx.strokeStyle = HOT_VOID
      ctx.globalAlpha = 0.5 * pulse
      ctx.lineWidth = 1.5
      ctx.shadowBlur = 14
      ctx.shadowColor = HOT_VOID
      ring(ctx, b.x, b.y, 9 + pulse * 2)
      ctx.globalAlpha = 1
      ctx.fillStyle = HOT_VOID
      ctx.shadowBlur = 16
      ctx.shadowColor = HOT_VOID
      diamond(ctx, b.x, b.y, 6.5 + pulse)
    } else if (b.kind === 'darter') {
      if (!b.darted) {
        // winding up — a red reticle that TIGHTENS + brightens toward the snap, so
        // you can read the threat and ready your reaction.
        const charge = Math.min(1, (b.age ?? 0) / (b.hangT ?? 1.25))
        const pulse = 0.5 + 0.5 * Math.sin(t * (8 + charge * 16))
        ctx.strokeStyle = DART
        ctx.globalAlpha = 0.35 + 0.5 * charge
        ctx.lineWidth = 1.5
        ctx.shadowBlur = 8 + 14 * charge
        ctx.shadowColor = DART
        ring(ctx, b.x, b.y, 15 - charge * 7 + pulse * 2)
        // crosshair ticks
        seg(ctx, b.x - 11, b.y, b.x - 5, b.y); seg(ctx, b.x + 5, b.y, b.x + 11, b.y)
        seg(ctx, b.x, b.y - 11, b.x, b.y - 5); seg(ctx, b.x, b.y + 5, b.x, b.y + 11)
        ctx.globalAlpha = 1
        ctx.fillStyle = DART
        ctx.shadowBlur = 10
        diamond(ctx, b.x, b.y, 4)
      } else {
        // darting — a bright hot head streaking down
        ctx.fillStyle = HOT
        ctx.shadowBlur = 18
        ctx.shadowColor = DART
        diamond(ctx, b.x, b.y, 5.5)
      }
    } else if (b.kind === 'husk') {
      // armored — a heavy core inside a thick shell ring; the shell BREAKS when cracked
      const cracked = (b.hp ?? 2) <= 1
      ctx.fillStyle = HUSKC
      ctx.shadowBlur = 9
      ctx.shadowColor = HUSKC
      diamond(ctx, b.x, b.y, 7)
      ctx.strokeStyle = cracked ? '#6e5a8c' : HUSKC
      ctx.globalAlpha = cracked ? 0.4 : 0.9
      ctx.lineWidth = cracked ? 1.2 : 2.6
      ctx.shadowBlur = cracked ? 3 : 10
      ctx.shadowColor = HUSKC
      ring(ctx, b.x, b.y, 11.5)
      if (cracked) { ctx.globalAlpha = 0.7; seg(ctx, b.x - 8, b.y - 4, b.x + 6, b.y + 7) } // crack line
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = VOID
      ctx.shadowBlur = 12
      ctx.shadowColor = VOID
      diamond(ctx, b.x, b.y, 4.5 + 0.8 * Math.sin(t * 8 + b.x))
    }
  }
  ctx.globalAlpha = 1
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
    } else if (f.kind === 'split') {
      // a MIRV forked — a hot void burst that reads as "too late, now there's more"
      ctx.strokeStyle = HOT_VOID
      ctx.globalAlpha = 1 - k
      ctx.lineWidth = 2.5 * (1 - k)
      ctx.shadowBlur = 16
      ctx.shadowColor = HOT_VOID
      ring(ctx, f.x, f.y, 4 + k * 30)
    } else if (f.kind === 'multi') {
      // multi-kill — a bright burst ring + a ×N floater rising and fading
      const n = f.n ?? 2
      ctx.strokeStyle = HOT
      ctx.globalAlpha = (1 - k) * 0.9
      ctx.lineWidth = 3 * (1 - k)
      ctx.shadowBlur = 20
      ctx.shadowColor = ATHER
      ring(ctx, f.x, f.y, 6 + k * (26 + n * 8))
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.4)
      ctx.fillStyle = HOT
      ctx.shadowBlur = 14
      ctx.shadowColor = ATHER
      ctx.textAlign = 'center'
      ctx.font = `600 ${16 + n * 3}px ui-monospace, monospace`
      ctx.fillText(`×${n}`, f.x, f.y - 14 - k * 26)
    } else if (f.kind === 'crack') {
      // husk shell cracked — a hard steel flash, "again!"
      ctx.strokeStyle = HUSKC
      ctx.globalAlpha = 1 - k
      ctx.lineWidth = 2.5 * (1 - k)
      ctx.shadowBlur = 10
      ctx.shadowColor = HUSKC
      ring(ctx, f.x, f.y, 8 + k * 12)
    } else if (f.kind === 'dart') {
      // darter snapped — a hot red burst the instant it commits to the dive
      ctx.strokeStyle = DART
      ctx.globalAlpha = (1 - k) * 0.9
      ctx.lineWidth = 3 * (1 - k)
      ctx.shadowBlur = 16
      ctx.shadowColor = DART
      ring(ctx, f.x, f.y, 5 + k * 26)
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
