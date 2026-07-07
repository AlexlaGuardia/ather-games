'use client'

// SQUALL — a mote of Ather caught in the void's squall. No offense, no shield: pure evasion.
// Read the telegraphed patterns, weave the gaps, graze close for score, last as long as you can.
// Touch joystick / mouse-follow / WASD. Vector-glow on a dark storm. Sim in lib/squall.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import { screenMaxW, deckMaxW, cabinetMaxW } from '@/lib/arcade/fit'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'
import DailyLeaderboard from '../_components/DailyLeaderboard'
import {
  makeWorld,
  setHeading,
  tick,
  loadBest,
  saveBest,
  VW,
  VH,
  PLAYER_R,
  GRAZE_R,
  type World,
  type Warning,
} from './lib/squall'
import { sfx } from './lib/sfx'
import { music } from './music'
import { vo } from './vo'
import ArcadeControls from '../_components/ArcadeControls'

const BG_TOP = '#05030d'
const BG_BOT = '#0a0716'
const ATHER = '#7fe9ff' // the mote (you)
const HOT = '#eafcff'
const VOID = '#c86bff' // the void's bullets + telegraphs
const ACCENT = '#37d4e6'
const JOY_R = 62 // touch-joystick deflection radius

type Phase = 'ready' | 'playing' | 'dead'

export default function SquallPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const seedRef = useRef(1)
  const voMileRef = useRef(0) // survival-milestone crossings spoken (reset each run)
  const pointer = useRef({ x: VW / 2, y: VH / 2, active: false })
  const joy = useRef({ active: false, baseX: 0, baseY: 0, curX: 0, curY: 0, pid: -1 })
  const deckVec = useRef({ x: 0, y: 0, active: false }) // the cabinet stick's -1..1 vector
  const keys = useRef<Set<string>>(new Set())
  const grazeFx = useRef(0) // seconds left on the graze sparkle
  const syncT = useRef(0)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [graze, setGraze] = useState(0)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [survived, setSurvived] = useState(0) // seconds, frozen at death
  const [muted, setMuted] = useState(false)
  const [mode, setMode] = useState<'endless' | 'daily'>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)

  useNoScroll()

  const boot = useCallback(() => {
    // daily = the SAME storm for everyone today (deterministic seed); endless = fresh each run.
    let seed: number
    if (modeRef.current === 'daily') seed = dailySeed()
    else { seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0; seed = seedRef.current ^ (Date.now() >>> 0) }
    worldRef.current = makeWorld(seed)
    pointer.current = { x: VW / 2, y: VH / 2, active: false }
    joy.current = { active: false, baseX: 0, baseY: 0, curX: 0, curY: 0, pid: -1 }
    keys.current.clear()
    voMileRef.current = 0; vo.reset() // fresh run: re-arm the commentator
    setScore(0); setGraze(0); setNewBest(false); setSurvived(0); setShared(false)
    setPhase('ready')
  }, [])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    music.setMuted(sfx.isMuted()); void music.ensure() // decode the bed ahead of the first steer
    vo.setMuted(sfx.isMuted()); void vo.ensure(); vo.setOnSpeak(() => music.duck()) // a spoken line dips the bed
    setBest(loadBest())
    setDailyBest(loadDailyBest('squall'))
    return () => { music.stop(); vo.stop() } // tear audio down on leave — never follows you out
  }, [boot])

  const pickMode = (m: 'endless' | 'daily') => {
    if (m === modeRef.current) return
    modeRef.current = m
    setMode(m)
    boot()
  }

  const doShare = async () => {
    if (await copyShare(dailyShare('Squall', score))) {
      setShared(true)
      setTimeout(() => setShared(false), 1600)
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase())
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const applyHeading = () => {
    const w = worldRef.current
    if (!w) return
    const k = keys.current
    let kx = 0, ky = 0
    if (k.has('a') || k.has('arrowleft')) kx -= 1
    if (k.has('d') || k.has('arrowright')) kx += 1
    if (k.has('w') || k.has('arrowup')) ky -= 1
    if (k.has('s') || k.has('arrowdown')) ky += 1
    if (kx || ky) { setHeading(w, kx, ky); return }
    if (deckVec.current.active) { setHeading(w, deckVec.current.x, deckVec.current.y); return }
    if (joy.current.active) {
      setHeading(w, (joy.current.curX - joy.current.baseX) / JOY_R, (joy.current.curY - joy.current.baseY) / JOY_R)
      return
    }
    if (pointer.current.active) {
      // mouse: the mote chases the cursor (snaps within ~55px = full speed)
      setHeading(w, (pointer.current.x - w.x) / 55, (pointer.current.y - w.y) / 55)
    } else {
      setHeading(w, 0, 0)
    }
  }

  // ── render + sim loop ─────────────────────────────────────────────────────────
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

      if (grazeFx.current > 0) grazeFx.current = Math.max(0, grazeFx.current - dt)
      if (w.state === 'playing') {
        applyHeading()
        const ev = tick(w, dt)
        if (ev.spawned) sfx.play('warn')
        if (ev.fired) sfx.play('fire')
        if (ev.grazed) { sfx.play('graze'); grazeFx.current = 0.18; vo.play('close') }
        // survival milestones — a warm "still standing" every 25s weathered
        if (w.time >= (voMileRef.current + 1) * 25) { voMileRef.current++; vo.play('weathering') }
        if (ev.dead) {
          sfx.play('death')
          setScore(w.score); setGraze(w.graze); setSurvived(w.time)
          const b = saveBest(w.score); const isBest = w.score > 0 && w.score >= b
          setBest(b); setNewBest(isBest)
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('squall', w.score))
          setPhase('dead')
          vo.play(isBest ? 'best' : 'over')
        }
        syncT.current += dt
        if (syncT.current >= 0.08) { syncT.current = 0; setScore(w.score); setGraze(w.graze) }
      }
      render(canvas, w, ts, joy.current, grazeFx.current)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // ── input ──────────────────────────────────────────────────────────────────────
  // DECK steering: the cabinet stick gives a -1..1 vector; the per-frame applyHeading reads it.
  // First steer kicks the sim from ready→playing (setHeading auto-starts it).
  const onStick = useCallback((x: number, y: number) => {
    sfx.ensure()
    deckVec.current = { x, y, active: true }
    const w = worldRef.current
    if (w && w.state === 'ready') { setHeading(w, x, y); setPhase('playing'); music.start(); vo.play('start') }
  }, [])
  const onStickEnd = useCallback(() => { deckVec.current = { x: 0, y: 0, active: false } }, [])

  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); music.setMuted(m); vo.setMuted(m); setMuted(m) }

  return (
    <ArcadeCabinet gameId="squall" accent={ACCENT} wall={1} maxWidth={cabinetMaxW(VW, VH)}>
      <div className="w-full flex items-center justify-between mb-3" style={{ maxWidth: cabinetMaxW(VW, VH) }}>
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-sm tracking-[0.35em] uppercase" style={{ color: ACCENT, textShadow: `0 0 8px ${ACCENT}80` }}>Squall</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">read the void · weave · survive</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      {/* score + graze */}
      <div className="w-full mb-2 flex items-center gap-3 font-mono" style={{ maxWidth: cabinetMaxW(VW, VH) }}>
        <span className="gx-label text-[10px]" style={{ color: ACCENT }}>survive</span>
        <span className="gx-label text-[10px] text-[#e8feff] tabular-nums">{score}</span>
        <span className="gx-label text-[9px] tracking-wider ml-auto" style={{ color: VOID }}>graze <span className="text-[#e8feff] tabular-nums">{graze}</span></span>
      </div>

      <div className="gx-chrome relative w-full" style={{ maxWidth: screenMaxW(VW, VH), aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: ACCENT } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block rounded-md pointer-events-none"
        />

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/squall/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.42]" />
            <div className="absolute inset-0 -z-10 bg-[#05030d]/72" />
            <div className="gx-title text-2xl tracking-[0.3em] uppercase" style={{ color: ACCENT, textShadow: `0 0 18px ${ACCENT}` }}>Squall</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[280px]">
              you are a mote of Ather in the void&apos;s storm. you cannot fight back. read the patterns as they telegraph, weave the gaps, and graze close for score. last as long as you can.
            </p>
            <div className="pointer-events-auto flex gap-1.5 text-[10px] font-mono tracking-wider">
              {(['endless', 'daily'] as const).map((m) => (
                <button key={m} onClick={() => pickMode(m)}
                  className={`px-3 py-1.5 rounded-sm border transition-colors ${mode === m ? 'text-[#04040a] bg-[#37d4e6] border-[#37d4e6]' : 'text-[#37d4e6]/55 border-[#37d4e6]/25 hover:text-[#37d4e6]'}`}>
                  {m === 'daily' ? `daily #${dailyNumber()}` : m}
                </button>
              ))}
            </div>
            {mode === 'daily' && <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider -mt-1">the same storm for everyone today</div>}
            <div className="gx-label text-[11px] text-[#7fd8e6]/70 mt-1">steer the stick below to begin</div>
            {mode === 'daily'
              ? dailyBest > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider mt-1">today&apos;s best <span className="text-[#e8feff] tabular-nums">{dailyBest}</span></div>
              : best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider mt-1">best <span className="text-[#e8feff] tabular-nums">{best}</span></div>}
          </div>
        )}

        {phase === 'dead' && (
          <div className="absolute inset-0 overflow-y-auto bg-[#05030d]/75 rounded-md">
           <div className="min-h-full flex flex-col items-center justify-center gap-2 text-center px-6 py-4">
            <div className="gx-title text-[#c86bff] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #c86bff' }}>Unmade</div>
            <div className="gx-value font-mono text-[#e8feff] text-3xl leading-none tabular-nums" style={{ textShadow: `0 0 12px ${ACCENT}80` }}>{score}</div>
            {mode === 'daily'
              ? <div className="gx-label text-[10px] font-mono tracking-wider" style={{ color: ACCENT }}>daily #{dailyNumber()} · today&apos;s best {dailyBest}{score >= dailyBest && score > 0 ? ' ✦' : ''}</div>
              : newBest
                ? <div className="gx-label text-[10px] font-mono tracking-wider" style={{ color: ACCENT }}>✦ new best</div>
                : best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/45 tracking-wider">best {best}</div>}
            <div className="gx-label text-[10px] font-mono text-[#9fd6e0]/55 tracking-wider mt-0.5">
              survived <span style={{ color: ACCENT }} className="tabular-nums">{survived.toFixed(1)}s</span> · <span style={{ color: VOID }} className="tabular-nums">{graze}</span> grazes
            </div>
            <p className="text-[10px] leading-relaxed text-[#9fd6e0]/70 max-w-[250px] italic mt-0.5">the void closes over the mote. read it sooner next time.</p>
            <button onClick={restart} className="gx-label text-[11px] text-[#05030d] hover:brightness-110 px-5 py-2 rounded-[2px] mt-1" style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}80` }}>weather it again →</button>
            {mode === 'daily' && (
              <button onClick={doShare} className="gx-label text-[10px] tracking-wider px-4 py-1.5 rounded-[2px] border transition-colors" style={{ color: ACCENT, borderColor: `${ACCENT}55` }}>
                {shared ? 'copied ✓' : 'share result'}
              </button>
            )}
            {mode === 'daily' && <DailyLeaderboard gameId="squall" accent={ACCENT} score={score} className="mt-1.5" />}
           </div>
          </div>
        )}
      </div>

      {/* the cabinet control deck — a steer stick (no buttons; Squall is pure evasion) */}
      <ArcadeControls
        accent={ACCENT}
        maxWidth={deckMaxW}
        stick
        onStick={onStick}
        onStickEnd={onStickEnd}
        hint="drag the stick to weave the storm"
      />

    </ArcadeCabinet>
  )
}

interface Joy { active: boolean; baseX: number; baseY: number; curX: number; curY: number; pid: number }

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, joy: Joy, grazeFx: number) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  if (canvas.width !== VW * dpr || canvas.height !== VH * dpr) {
    canvas.width = VW * dpr
    canvas.height = VH * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const t = ts / 1000

  // storm gradient
  const g = ctx.createLinearGradient(0, 0, 0, VH)
  g.addColorStop(0, BG_TOP)
  g.addColorStop(1, BG_BOT)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VW, VH)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // faint drifting void haze (cheap atmosphere)
  ctx.globalAlpha = 0.05
  ctx.fillStyle = VOID
  for (let i = 0; i < 5; i++) {
    const hx = (i * 97 + t * 14) % (VW + 80) - 40
    dot(ctx, hx, 80 + i * 110, 60)
  }
  ctx.globalAlpha = 1

  // ── telegraphs (read these — the whole game is reading these) ─────────────────
  for (const wn of w.warnings) drawWarning(ctx, wn, w, t)

  // ── bullets — void-purple glowing motes ───────────────────────────────────────
  for (const b of w.bullets) {
    if (b.x < -12 || b.x > VW + 12 || b.y < -12 || b.y > VH + 12) continue
    ctx.fillStyle = VOID
    ctx.shadowBlur = 9
    ctx.shadowColor = VOID
    dot(ctx, b.x, b.y, b.r)
    ctx.fillStyle = HOT
    ctx.globalAlpha = 0.5
    dot(ctx, b.x, b.y, b.r * 0.4)
    ctx.globalAlpha = 1
  }
  ctx.shadowBlur = 0

  // ── the mote (you) — soft graze aura + a BRIGHT tiny hitbox core ───────────────
  if (w.state !== 'dead') {
    // graze-radius aura (shows your danger ring faintly; flashes on a graze)
    ctx.globalAlpha = grazeFx > 0 ? 0.22 + 0.4 * (grazeFx / 0.18) : 0.12
    ctx.strokeStyle = grazeFx > 0 ? HOT : ATHER
    ctx.lineWidth = grazeFx > 0 ? 2 : 1
    ring(ctx, w.x, w.y, GRAZE_R)
    ctx.globalAlpha = 1
    // body glow
    ctx.fillStyle = ATHER
    ctx.shadowBlur = 14
    ctx.shadowColor = ATHER
    dot(ctx, w.x, w.y, PLAYER_R + 2.5)
    // the actual hitbox — a hot white pinpoint so you know EXACTLY what kills you
    ctx.shadowBlur = 6
    ctx.shadowColor = HOT
    ctx.fillStyle = HOT
    dot(ctx, w.x, w.y, PLAYER_R)
    ctx.shadowBlur = 0
  }

  // ── touch joystick ────────────────────────────────────────────────────────────
  if (joy.active) {
    let dx = joy.curX - joy.baseX, dy = joy.curY - joy.baseY
    const d = Math.hypot(dx, dy)
    if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R }
    ctx.globalAlpha = 0.14; ctx.fillStyle = ATHER; dot(ctx, joy.baseX, joy.baseY, JOY_R)
    ctx.globalAlpha = 0.5; ctx.strokeStyle = ATHER; ctx.lineWidth = 2; ring(ctx, joy.baseX, joy.baseY, JOY_R)
    ctx.globalAlpha = 0.85; ctx.fillStyle = ATHER; ctx.shadowBlur = 10; ctx.shadowColor = ATHER
    dot(ctx, joy.baseX + dx, joy.baseY + dy, 19)
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
  }
}

// a telegraph: intensity grows as it nears firing. aim shows a live line at the mote.
function drawWarning(ctx: CanvasRenderingContext2D, wn: Warning, w: World, t: number) {
  const p = Math.min(1, wn.t / wn.warn)
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 12))
  ctx.globalAlpha = (0.3 + 0.5 * p) * pulse
  ctx.strokeStyle = VOID
  ctx.fillStyle = VOID
  ctx.shadowBlur = 10
  ctx.shadowColor = VOID
  if (wn.kind === 'aim') {
    // a dashed line from the source toward where the mote is NOW (move late to dodge it)
    const a = Math.atan2(w.y - wn.y, w.x - wn.x)
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 6])
    seg(ctx, wn.x, wn.y, wn.x + Math.cos(a) * 520, wn.y + Math.sin(a) * 520)
    ctx.setLineDash([])
    dot(ctx, wn.x, wn.y, 5 + p * 4)
  } else if (wn.kind === 'burst') {
    // an expanding ring previewing the bloom
    ctx.lineWidth = 2
    ring(ctx, wn.x, wn.y, 6 + p * 26)
    dot(ctx, wn.x, wn.y, 4 + p * 3)
  } else {
    // spiral: a dot with a little rotating tick
    dot(ctx, wn.x, wn.y, 4 + p * 4)
    const a = wn.ang + t * 6
    ctx.lineWidth = 2
    seg(ctx, wn.x, wn.y, wn.x + Math.cos(a) * (10 + p * 10), wn.y + Math.sin(a) * (10 + p * 10))
  }
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
