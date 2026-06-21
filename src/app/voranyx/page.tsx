'use client'

// VORANYX — the Silt arena. You're a worm of Ather-light: steer toward your pointer,
// graze dross + seeds to grow (first seed paints you), gather motes to BOOST, and
// keep your head off everyone's body while the void ring closes in. Stop eating and
// you sublimate back to the blank thread. Vector-glow, camera-followed, world-space
// deep (no fixed backdrop — it pans). Core sim lives in lib/voranyx.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeWorld,
  player,
  steer,
  setBoost,
  tick,
  score,
  loadBest,
  saveBest,
  bodyRadius,
  segCount,
  BOOST_MAX,
  type World,
  type Wyrm,
  type Element,
} from './lib/voranyx'
import { sfx } from './lib/sfx'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'

const ATHER = '#37e6ff'
const HOT = '#e8feff'
const VOID_EDGE = '#c86bff'
const ELEM_COLOR: Record<Element, string> = {
  mana: '#37e6ff',
  storm: '#ffd54a',
  earth: '#54ffae',
  water: '#5d9eff',
}
const BLANK = '#dfe8f0'

// world-space ambient drift specks (parallax with the camera)
const SPECKS = (() => {
  const r = mulberry32(0x511)
  return Array.from({ length: 160 }, () => ({ x: (r() - 0.5) * 2400, y: (r() - 0.5) * 2400, s: 0.5 + r() * 1.3, p: r() * 6.28 }))
})()

function taunt(mass: number): string {
  if (mass < 26) return 'Back to the blank thread. The Silt barely felt you pass.'
  if (mass < 60) return 'A fair length. The dross will remember the shape of you.'
  if (mass < 120) return 'You grew bold down there in the dark.'
  return 'A leviathan of the Silt. Something old finally looked up.'
}

export default function VoranyxPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const seedRef = useRef(1)
  const startedRef = useRef(false)
  const overRef = useRef(false)
  const camRef = useRef({ x: 0, y: 0 })
  const syncT = useRef(0)

  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(false)
  const [len, setLen] = useState(0)
  const [best, setBest] = useState(0)
  const [boostPct, setBoostPct] = useState(100)
  const [muted, setMuted] = useState(false)
  const [mode, setMode] = useState<'endless' | 'daily'>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)

  useNoScroll()

  const boot = useCallback(() => {
    let seed: number
    if (modeRef.current === 'daily') seed = dailySeed()
    else { seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0; seed = seedRef.current ^ (Date.now() >>> 0) }
    const w = makeWorld(seed)
    worldRef.current = w
    const p = player(w)!
    camRef.current = { x: p.x, y: p.y }
    overRef.current = false
    setOver(false)
    setShared(false)
    setLen(score(w))
  }, [])

  const pickMode = (m: 'endless' | 'daily') => {
    if (m === modeRef.current) return
    modeRef.current = m
    setMode(m)
    boot()
  }
  const onShare = async () => {
    if (await copyShare(dailyShare('Voranyx', len))) {
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setBest(loadBest())
    setDailyBest(loadDailyBest('voranyx'))
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
        if (ev.ate) sfx.play('eat')
        if (ev.seed) sfx.play('seed')
        if (ev.killed) sfx.play('kill')
        if (ev.died) {
          sfx.play('death')
          overRef.current = true
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('voranyx', score(w)))
          else setBest(saveBest(score(w)))
          setLen(score(w))
          setOver(true)
        }
        const p = player(w)
        if (p && p.boosting && p.boost > 0) sfx.play('boost')
        syncT.current += dt
        if (syncT.current >= 0.1) { syncT.current = 0; setLen(score(w)); if (p) setBoostPct((p.boost / BOOST_MAX) * 100) }
      }

      render(canvas, w, ts, camRef.current, startedRef.current && !overRef.current)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  // DESKTOP steering: aim the worm from screen-centre toward the cursor (the head sits at centre)
  const aim = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ang = Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2))
    const w = worldRef.current
    if (w) steer(w, ang)
  }, [])

  // MOBILE steering: a floating relative joystick. Wherever the thumb presses becomes the
  // anchor; direction = drag delta from that anchor — so the thumb never covers the head
  // and you don't reach across the screen. Visual is mutated by ref (no per-move re-render).
  const STICK_MAX = 46 // px the thumb travels from base centre
  const STICK_DEAD = 6 // px deadzone before we steer
  const stickRef = useRef<{ id: number; ax: number; ay: number } | null>(null)
  const baseRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const moveThumb = (dx: number, dy: number) => {
    const t = thumbRef.current; if (!t) return
    const m = Math.hypot(dx, dy)
    const cl = m > STICK_MAX ? STICK_MAX / m : 1
    t.style.transform = `translate(calc(-50% + ${dx * cl}px), calc(-50% + ${dy * cl}px))`
  }
  const hideStick = () => { stickRef.current = null; if (baseRef.current) baseRef.current.style.opacity = '0' }

  const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    sfx.ensure()
    if (!startedRef.current) { startedRef.current = true; setStarted(true) }
    if (e.pointerType === 'mouse') {
      aim(e)
      if (worldRef.current) setBoost(worldRef.current, true) // hold mouse = boost
      return
    }
    if (stickRef.current) return // another finger already owns the stick — ignore
    const rect = e.currentTarget.getBoundingClientRect()
    stickRef.current = { id: e.pointerId, ax: e.clientX, ay: e.clientY }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const b = baseRef.current
    if (b) { b.style.left = `${e.clientX - rect.left}px`; b.style.top = `${e.clientY - rect.top}px`; b.style.opacity = '1' }
    moveThumb(0, 0)
  }, [aim])

  const onMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!startedRef.current) return
    if (e.pointerType === 'mouse') { aim(e); return }
    const s = stickRef.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.ax, dy = e.clientY - s.ay
    if (Math.hypot(dx, dy) > STICK_DEAD && worldRef.current) steer(worldRef.current, Math.atan2(dy, dx))
    moveThumb(dx, dy)
  }, [aim])

  const onUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') { if (worldRef.current) setBoost(worldRef.current, false); return }
    if (stickRef.current && stickRef.current.id === e.pointerId) hideStick()
  }, [])

  // dedicated boost (touch thumb + Space)
  const boostOn = useCallback(() => { sfx.ensure(); if (worldRef.current) setBoost(worldRef.current, true) }, [])
  const boostOff = useCallback(() => { if (worldRef.current) setBoost(worldRef.current, false) }, [])
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); boostOn() } }
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') boostOff() }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [boostOn, boostOff])

  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); setMuted(m) }

  const lowBoost = boostPct <= 18

  return (
    <ArcadeCabinet accent="#37e6ff" wall={1} maxWidth={440}>
      <div className="w-full max-w-[440px] flex items-center justify-between mb-3">
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="font-mono text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Voranyx</div>
          <div className="text-[9px] text-[#7fd8e6]/40 font-mono tracking-[0.2em] uppercase mt-0.5">worms of the silt</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      <div className="w-full max-w-[440px] mb-2 flex items-center gap-3 font-mono">
        <span className="text-[9px] tracking-[0.2em] uppercase text-[#7fd8e6]/40">length</span>
        <span className="text-[#e8feff] text-lg tabular-nums leading-none" style={{ textShadow: '0 0 8px #37e6ff70' }}>{len}</span>
        <span className="text-[9px] tracking-[0.2em] uppercase text-[#7fd8e6]/30 ml-1">best {best}</span>
        <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden ml-auto max-w-[130px]">
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${boostPct}%`, background: lowBoost ? '#ff5d9e' : '#37e6ff', boxShadow: `0 0 10px ${lowBoost ? '#ff5d9e' : '#37e6ff'}` }} />
        </div>
        <span className="text-[9px] tracking-[0.2em] uppercase text-[#7fd8e6]/40">boost</span>
      </div>

      <div className="relative w-full max-w-[440px]" style={{ aspectRatio: '3 / 4' }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          className="w-full h-full block touch-none rounded-md cursor-crosshair"
        />
        <div className="pointer-events-none absolute inset-0 rounded-md vx-crt" />

        {/* floating relative joystick (touch) — positioned + faded via ref, no re-render */}
        <div
          ref={baseRef}
          className="pointer-events-none absolute z-10 w-[100px] h-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#37e6ff]/25 bg-[#37e6ff]/[0.04] opacity-0 transition-opacity duration-100"
          style={{ left: 0, top: 0 }}
        >
          <div
            ref={thumbRef}
            className="absolute left-1/2 top-1/2 w-9 h-9 rounded-full bg-[#37e6ff]/25 border border-[#37e6ff]/60"
            style={{ boxShadow: '0 0 12px #37e6ff80' }}
          />
        </div>

        {/* touch boost pad */}
        {started && !over && (
          <button
            onPointerDown={(e) => { e.preventDefault(); boostOn() }}
            onPointerUp={boostOff}
            onPointerLeave={boostOff}
            className="absolute bottom-3 right-3 w-16 h-16 rounded-full border border-[#37e6ff]/40 bg-[#37e6ff]/10 active:bg-[#37e6ff]/25 font-mono text-[9px] tracking-[0.2em] uppercase text-[#37e6ff]/80 flex items-center justify-center"
            style={{ boxShadow: '0 0 14px #37e6ff30' }}
          >boost</button>
        )}

        {!started && (
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/voranyx/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.6]" />
            <div className="absolute inset-0 -z-10 bg-[#04040a]/62" />
            <div className="font-mono text-[#37e6ff] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #37e6ff' }}>Voranyx</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[290px]">
              drag to steer (cursor on desktop). graze the dross, swallow a seed to take its colour, gather motes to boost. keep eating or you fade — and never put your head into another worm.
            </p>
            <div className="pointer-events-auto flex items-center gap-1.5 mt-0.5 font-mono text-[10px] tracking-[0.2em] uppercase">
              {(['endless', 'daily'] as const).map((m) => (
                <button key={m} onClick={() => pickMode(m)}
                  className={`px-3 py-1.5 rounded-sm border transition-colors ${mode === m ? 'text-[#04040a] bg-[#37e6ff] border-[#37e6ff]' : 'text-[#37e6ff]/55 border-[#37e6ff]/25 hover:text-[#37e6ff]'}`}>
                  {m === 'daily' ? `daily #${dailyNumber()}` : m}
                </button>
              ))}
            </div>
            {mode === 'daily' && <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider -mt-1">same silt for everyone today</div>}
            <div className="font-mono text-[12px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] px-6 py-2.5 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>tap to dive in</div>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#04040a]/75 rounded-md text-center px-6">
            <div className="font-mono text-[#c86bff] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #c86bff' }}>Scattered</div>
            <div className="font-mono text-[#e8feff] text-3xl tabular-nums leading-none" style={{ textShadow: '0 0 12px #37e6ff80' }}>{len}</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 italic max-w-[280px]">{taunt(len)}</p>
            <div className="text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider">
              {mode === 'daily'
                ? <>daily #{dailyNumber()} · best {dailyBest}{len >= dailyBest && len > 0 ? ' ✦ today’s best' : ''}</>
                : <>best {best}{len >= best && len > 0 ? ' ✦ new best' : ''}</>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={restart} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-5 py-2 rounded-sm" style={{ boxShadow: '0 0 18px #37e6ff80' }}>dive again →</button>
              {mode === 'daily' && (
                <button onClick={onShare} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#37e6ff] border border-[#37e6ff]/40 hover:border-[#37e6ff] px-5 py-2 rounded-sm transition-colors">{shared ? 'copied ✓' : 'share'}</button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-[440px] flex items-center justify-center mt-4">
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">steer · hold to boost · keep eating</p>
      </div>

      <style jsx>{`
        .vx-crt {
          background:
            radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%),
            repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.13) 3px, rgba(0,0,0,0) 4px);
          animation: vx-flicker 5s infinite steps(60);
          mix-blend-mode: multiply;
        }
        @keyframes vx-flicker { 0%,97%,100% { opacity: 1; } 98% { opacity: 0.94; } 99% { opacity: 0.98; } }
      `}</style>
    </ArcadeCabinet>
  )
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, cam: { x: number; y: number }, live: boolean) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const cw = canvas.clientWidth || 440
  const ch = canvas.clientHeight || 587
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
    canvas.width = cw * dpr
    canvas.height = ch * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#04040a'
  ctx.fillRect(0, 0, cw, ch)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const t = ts / 1000

  const p = player(w)
  // camera eases toward the player head
  if (p) {
    cam.x += (p.x - cam.x) * (live ? 0.12 : 1)
    cam.y += (p.y - cam.y) * (live ? 0.12 : 1)
  }
  // zoom out harder as you grow so a mid-game worm sees room ahead of it (was 0.95 - mass*0.0019,
  // which barely backed off — 0.855 at mass 50). Steeper slope + lower floor: ~0.74 at mass 50,
  // floors at 0.5 (whole closing ring in view) from ~mass 96 up.
  const zoom = p ? Math.max(0.5, Math.min(0.95, 1.0 - p.mass * 0.0052)) : 0.9
  const toX = (wx: number) => (wx - cam.x) * zoom + cw / 2
  const toY = (wy: number) => (wy - cam.y) * zoom + ch / 2

  // ambient specks (world-space; only those near view)
  for (const s of SPECKS) {
    const sx = toX(s.x), sy = toY(s.y)
    if (sx < -10 || sx > cw + 10 || sy < -10 || sy > ch + 10) continue
    ctx.globalAlpha = 0.08 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.1 + s.p))
    ctx.fillStyle = '#7b6fa6'
    dot(ctx, sx, sy, s.s)
  }
  ctx.globalAlpha = 1

  // the void ring — the Silt's edge, closing in
  const cx = toX(0), cy = toY(0), rr = w.radius * zoom
  ctx.strokeStyle = VOID_EDGE
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 2.5
  ctx.shadowBlur = 18
  ctx.shadowColor = VOID_EDGE
  ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
  // darken beyond the ring
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.arc(cx, cy, rr, 0, Math.PI * 2, true)
  ctx.fillStyle = 'rgba(10,4,18,0.66)'
  ctx.fill('evenodd')
  ctx.restore()

  // food
  for (const f of w.food) {
    const fx = toX(f.x), fy = toY(f.y)
    if (fx < -8 || fx > cw + 8 || fy < -8 || fy > ch + 8) continue
    if (f.kind === 'seed') {
      const c = f.element ? ELEM_COLOR[f.element] : BLANK
      ctx.fillStyle = c; ctx.shadowBlur = 10; ctx.shadowColor = c
      diamond(ctx, fx, fy, 4 + 0.6 * Math.sin(t * 4 + f.x))
    } else if (f.kind === 'mote') {
      ctx.fillStyle = ATHER; ctx.shadowBlur = 9; ctx.shadowColor = ATHER
      dot(ctx, fx, fy, 2.4 + 0.5 * Math.sin(t * 6 + f.y))
    } else {
      ctx.fillStyle = '#9fb6c8'; ctx.shadowBlur = 5; ctx.shadowColor = '#9fb6c8'
      dot(ctx, fx, fy, 1.7)
    }
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0

  // wyrms — glowing serpents in their element colour
  for (const s of w.wyrms) {
    if (!s.alive || s.trail.length < 4) continue
    const col = s.element ? ELEM_COLOR[s.element] : BLANK
    const bw = bodyRadius(s.mass) * 2 * zoom
    // body
    ctx.strokeStyle = col
    ctx.globalAlpha = s.isPlayer ? 0.95 : 0.8
    ctx.lineWidth = Math.max(2, bw)
    ctx.shadowBlur = s.isPlayer ? 14 : 9
    ctx.shadowColor = col
    ctx.beginPath()
    ctx.moveTo(toX(s.trail[0]), toY(s.trail[1]))
    for (let i = 2; i < s.trail.length; i += 2) ctx.lineTo(toX(s.trail[i]), toY(s.trail[i + 1]))
    ctx.stroke()
    // boosting shimmer
    if (s.boosting && s.boost > 0) {
      ctx.strokeStyle = HOT; ctx.globalAlpha = 0.4; ctx.lineWidth = Math.max(1, bw * 0.4); ctx.stroke()
    }
    // head
    const hx = toX(s.trail[0]), hy = toY(s.trail[1])
    ctx.globalAlpha = 1
    ctx.fillStyle = HOT; ctx.shadowBlur = 14; ctx.shadowColor = col
    dot(ctx, hx, hy, Math.max(2.5, bw * 0.62))
    // eye-glint toward heading
    ctx.fillStyle = col
    dot(ctx, hx + Math.cos(s.angle) * bw * 0.3, hy + Math.sin(s.angle) * bw * 0.3, Math.max(1, bw * 0.22))
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill()
}
