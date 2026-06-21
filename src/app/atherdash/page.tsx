'use client'

// ATHERDASH — Phase 1, the core game. A spark of Ather dashes down four elemental
// lanes; gates rush in tuned to one element — its lane is the open door, the rest
// are wall. Be in the matching lane when the gate reaches you. Read-ahead under
// swap pressure. Sim + projection live in lib/atherdash.ts; this is render + input.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  makeWorld,
  start,
  swap,
  jump,
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
  JUMP_DUR,
  JUMP_H,
  PIT_DEPTH_Z,
  ELEMENTS,
  VW,
  VH,
  type World,
} from './lib/atherdash'
import { sfx } from './lib/sfx'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'

const BG = '#04040a'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const WALL_FILL = 'rgba(16,10,26,0.86)'
const WALL_EDGE = '#7a4aa0' // the Dying — dim void
const WALL_H = 74 // wall height in near-pixels (scaled by perspective)

type Phase = 'ready' | 'playing' | 'over'

// transient visual juice — lives in a ref, aged by timestamp (no React re-render)
interface Ring { x: number; y: number; t0: number; color: string }
interface Mote { x: number; y: number; vx: number; vy: number; t0: number; color: string }
interface Fx { rings: Ring[]; motes: Mote[]; shakeT0: number }

export default function AtherdashPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const swipeRef = useRef<{ x: number; id: number } | null>(null)
  const lastLaneRef = useRef<number>(-1)
  const fxRef = useRef<Fx>({ rings: [], motes: [], shakeT0: -1 })

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [muted, setMuted] = useState(false)
  const [cause, setCause] = useState<'wall' | 'pit'>('wall')
  const [mode, setMode] = useState<'endless' | 'daily'>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)

  const boot = useCallback(() => {
    // daily mode = one seeded course a day, the same for everyone; endless = random.
    worldRef.current = makeWorld(modeRef.current === 'daily' ? dailySeed() : (Date.now() >>> 0))
    lastLaneRef.current = worldRef.current.lane
    fxRef.current = { rings: [], motes: [], shakeT0: -1 }
    setScore(0)
    setShared(false)
    setPhase('ready')
  }, [])

  useEffect(() => {
    boot()
    setBest(loadHiScore())
    setDailyBest(loadDailyBest('atherdash'))
    setMuted(sfx.isMuted())
  }, [boot])

  const pickMode = (m: 'endless' | 'daily') => {
    if (m === modeRef.current) return
    modeRef.current = m // sync so boot's re-seed reads the new mode immediately
    setMode(m)
    boot()
  }
  const onShare = async () => {
    if (await copyShare(dailyShare('Atherdash', score))) {
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

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
      const t = ts / 1000
      const fx = fxRef.current
      if (w.state === 'playing') {
        const ev = tick(w, dt)
        // lane-swap whoosh — target lane changed since last frame
        if (w.lane !== lastLaneRef.current) {
          sfx.play('swap')
          lastLaneRef.current = w.lane
        }
        if (ev.pass) {
          setScore(w.score)
          sfx.play('pass')
          // threaded the gate: a ring + a little fountain of motes in its element colour
          const lane = Math.round(w.x)
          const col = ELEMENTS[Math.max(0, Math.min(LANES - 1, lane))].light
          const sx = laneNearX(w.x)
          fx.rings.push({ x: sx, y: SPARK_Y, t0: t, color: col })
          for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7
            const sp = 90 + Math.random() * 120
            fx.motes.push({ x: sx, y: SPARK_Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t0: t, color: col })
          }
        }
        if (ev.jumpClear) {
          setScore(w.score)
          sfx.play('pass')
          // cleared the gap: a cyan ring + an upward fan of Ather motes at the spark
          const sx = laneNearX(w.x)
          fx.rings.push({ x: sx, y: SPARK_Y, t0: t, color: '#7df0ff' })
          for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4
            const sp = 90 + Math.random() * 120
            fx.motes.push({ x: sx, y: SPARK_Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t0: t, color: '#aef6ff' })
          }
        }
        if (ev.crash || ev.fell) {
          sfx.play(ev.fell ? 'fall' : 'crash')
          window.setTimeout(() => sfx.play('over'), 220)
          fx.shakeT0 = t
          const sx = laneNearX(w.x)
          const col = ev.fell ? '#9b5ad2' : '#ff5d6c'
          const moteCol = ev.fell ? '#c79bf2' : '#ff8a96'
          fx.rings.push({ x: sx, y: SPARK_Y, t0: t, color: col })
          for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2
            const sp = 70 + Math.random() * 150
            fx.motes.push({ x: sx, y: SPARK_Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t0: t, color: moteCol })
          }
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('atherdash', w.score))
          else setBest(saveHiScore(w.score))
          setCause(ev.fell ? 'pit' : 'wall')
          setPhase('over')
        }
      } else {
        tick(w, dt) // keeps the road scrolling on the ready screen
      }
      render(canvas, w, ts, fx)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const launch = useCallback(() => {
    const w = worldRef.current
    if (!w || w.state !== 'ready') return
    sfx.ensure() // unlock audio inside the user gesture
    lastLaneRef.current = w.lane
    start(w)
    setPhase('playing')
  }, [])

  const doJump = useCallback(() => {
    const w = worldRef.current
    if (!w || w.state !== 'playing' || w.air > 0) return
    jump(w)
    sfx.play('jump')
  }, [])

  const toggleMute = () => {
    sfx.ensure()
    const m = !sfx.isMuted()
    sfx.setMuted(m)
    setMuted(m)
  }

  // keyboard: ←/→ or A/D swap · ↑/W/Space jump (and launch from ready)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const w = worldRef.current
      if (!w) return
      const left = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A'
      const right = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D'
      const up = e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' '
      if (!left && !right && !up) return
      e.preventDefault()
      if (w.state === 'ready') { launch(); if (up) return }
      if (up) doJump()
      else swap(w, left ? -1 : +1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [launch, doJump])

  // touch/pointer: tap launches from ready; in play, a horizontal SWIPE swaps lane
  // and a TAP (no real horizontal travel) jumps. (Ward gotcha: real swipe only
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
    else doJump() // a tap = hop
  }, [launch, doJump])

  return (
    <ArcadeCabinet accent="#37e6ff" wall={1} maxWidth={400}>
      {/* marquee — title plate across the top of the cabinet */}
        <div className="w-full flex items-center justify-between mb-3 pb-2.5 border-b border-[#d4a843]/15">
          <span aria-hidden className="w-10" />
          <div className="text-center">
            <div className="font-mono text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 10px #37e6ffaa' }}>Atherdash</div>
            <div className="text-[9px] text-[#d4a843]/45 font-mono tracking-[0.2em] uppercase mt-0.5">match the gate · hop the gap</div>
          </div>
          <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">
            {muted ? 'son' : 'snd'}
          </button>
        </div>

      <div className="relative w-full" style={{ aspectRatio: `${VW} / ${VH}` }}>
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
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/atherdash/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.5]" />
            <div className="absolute inset-0 -z-10 bg-[#04040a]/62 rounded-md" />
            <div className="font-mono text-[#37e6ff] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #37e6ff' }}>Atherdash</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/85 max-w-[270px]">
              gates rush in tuned to an element. slide to the matching lane before each reaches you — wrong lane is a wall. tap to hop the gaps.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap max-w-[280px] mt-0.5">
              {ELEMENTS.map((el) => (
                <span key={el.id} className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase" style={{ color: el.light }}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: el.base, boxShadow: `0 0 8px ${el.base}` }} />
                  {el.name}
                </span>
              ))}
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5 mt-0.5 font-mono text-[10px] tracking-[0.2em] uppercase">
              {(['endless', 'daily'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => pickMode(m)}
                  className={`px-3 py-1.5 rounded-sm border transition-colors ${mode === m ? 'text-[#04040a] bg-[#37e6ff] border-[#37e6ff]' : 'text-[#37e6ff]/55 border-[#37e6ff]/25 hover:text-[#37e6ff]'}`}
                >
                  {m === 'daily' ? `daily #${dailyNumber()}` : m}
                </button>
              ))}
            </div>
            {mode === 'daily' && (
              <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider -mt-1">same course for everyone today</div>
            )}
            <div className="font-mono text-[12px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] px-6 py-2.5 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
              swipe to slide · tap to hop
            </div>
          </div>
        )}

        {phase === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#04040a]/78 rounded-md text-center px-6">
            <div className="font-mono text-[#c86bff] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #c86bff' }}>{cause === 'pit' ? 'the gap takes you' : 'the wall takes you'}</div>
            <div className="font-mono text-[#e8feff] text-4xl tabular-nums leading-none" style={{ textShadow: '0 0 12px #37e6ff80' }}>{score}</div>
            <div className="text-[10px] font-mono text-[#7fd8e6]/55 tracking-wider">
              {mode === 'daily'
                ? <>daily #{dailyNumber()} · best {dailyBest}{score >= dailyBest && score > 0 ? ' ✦ today’s best' : ''}</>
                : <>gates threaded · best {best}{score >= best && score > 0 ? ' ✦ new best' : ''}</>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={boot} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-5 py-2 rounded-sm" style={{ boxShadow: '0 0 18px #37e6ff80' }}>
                dash again →
              </button>
              {mode === 'daily' && (
                <button onClick={onShare} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#37e6ff] border border-[#37e6ff]/40 hover:border-[#37e6ff] px-5 py-2 rounded-sm transition-colors">
                  {shared ? 'copied ✓' : 'share'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

        <div className="w-full flex items-center justify-center mt-3">
          <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">←/→ slide · ↑ hop · swipe + tap on phone</p>
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
    </ArcadeCabinet>
  )
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, fx: Fx) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  if (canvas.width !== VW * dpr || canvas.height !== VH * dpr) {
    canvas.width = VW * dpr
    canvas.height = VH * dpr
  }
  const ctx = canvas.getContext('2d')!
  const t = ts / 1000
  // crash shake — a quick decaying jitter of the whole scene
  let shx = 0, shy = 0
  if (fx.shakeT0 >= 0) {
    const age = t - fx.shakeT0
    if (age < 0.4) {
      const amp = 9 * (1 - age / 0.4)
      shx = Math.sin(age * 90) * amp
      shy = Math.cos(age * 78) * amp * 0.6
    } else {
      fx.shakeT0 = -1
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, shx * dpr, shy * dpr)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // backdrop: dark field with a soft depth gradient (deepest at the horizon)
  const grad = ctx.createLinearGradient(0, HORIZON_Y, 0, VH)
  grad.addColorStop(0, '#070417')
  grad.addColorStop(1, BG)
  ctx.fillStyle = grad
  ctx.fillRect(-14, -14, VW + 28, VH + 28) // oversized so crash-shake leaves no edge smear
  ctx.fillStyle = BG
  ctx.fillRect(-14, -14, VW + 28, HORIZON_Y + 14) // pure-black sky → the plane reads as a floor

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

  // pitfalls — full-width gaps the floor drops out of. Draw far first. The void band
  // sits on the plane (gates overlay it); danger lips glow so the hop reads early.
  const pits = [...w.pits].sort((a, b) => b.z - a.z)
  for (const p of pits) {
    const nz = Math.max(0, p.z)
    const fz = Math.min(1, p.z + PIT_DEPTH_Z)
    const nearP = persp(nz)
    const fade = p.z < 0 ? Math.max(0, 1 + p.z / 0.06) : 1
    const lN = screenX(-0.5, nz), rN = screenX(LANES - 0.5, nz)
    const lF = screenX(-0.5, fz), rF = screenX(LANES - 0.5, fz)
    const yN = screenY(nz), yF = screenY(fz)
    // the void
    ctx.globalAlpha = 0.96 * fade
    ctx.fillStyle = '#020108'
    ctx.beginPath()
    ctx.moveTo(lN, yN); ctx.lineTo(rN, yN); ctx.lineTo(rF, yF); ctx.lineTo(lF, yF)
    ctx.closePath(); ctx.fill()
    // glowing danger lips (near + far edge)
    ctx.globalAlpha = (0.5 + 0.45 * nearP) * fade
    ctx.strokeStyle = '#b06bff'
    ctx.lineWidth = 1 + 2.4 * nearP
    ctx.shadowBlur = 12 * nearP
    ctx.shadowColor = '#9b5ad2'
    seg(ctx, lF, yF, rF, yF)
    seg(ctx, lN, yN, rN, yN)
    ctx.shadowBlur = 0
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

  // gate-pass + crash bursts: expanding rings (age over ~0.45s)
  for (let i = fx.rings.length - 1; i >= 0; i--) {
    const r = fx.rings[i]
    const age = t - r.t0
    if (age > 0.45) { fx.rings.splice(i, 1); continue }
    const k = age / 0.45
    ctx.globalAlpha = (1 - k) * 0.8
    ctx.strokeStyle = r.color
    ctx.lineWidth = 2.5 * (1 - k) + 0.5
    ctx.shadowBlur = 14 * (1 - k)
    ctx.shadowColor = r.color
    ctx.beginPath()
    ctx.arc(r.x, r.y, 6 + k * 46, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  // motes (gravity-less drift, fade over ~0.55s)
  for (let i = fx.motes.length - 1; i >= 0; i--) {
    const m = fx.motes[i]
    const age = t - m.t0
    if (age > 0.55) { fx.motes.splice(i, 1); continue }
    ctx.globalAlpha = (1 - age / 0.55) * 0.85
    ctx.fillStyle = m.color
    ctx.shadowBlur = 6
    ctx.shadowColor = m.color
    dot(ctx, m.x + m.vx * age, m.y + m.vy * age, 2.2 * (1 - age / 0.55) + 0.5)
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // the spark — x follows the (lerping) lane; y lifts on a hop arc. Ather, neutral.
  const sx = laneNearX(w.x)
  const airK = w.air > 0 ? 1 - w.air / JUMP_DUR : -1 // hop progress 0→1, or -1 grounded
  const lift = airK >= 0 ? Math.sin(airK * Math.PI) * JUMP_H : 0
  const sy = SPARK_Y - lift

  // ground shadow — shrinks + fades as the spark rises (reads the hop height)
  const shadowK = 1 - lift / JUMP_H
  ctx.globalAlpha = 0.34 * shadowK
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(sx, SPARK_Y + 3, 11 * (0.5 + 0.5 * shadowK), 4 * (0.5 + 0.5 * shadowK), 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // swap smear — while mid-lerp, a horizontal streak trailing the motion
  const swapV = w.lane - w.x
  if (Math.abs(swapV) > 0.02) {
    const dir = Math.sign(swapV)
    for (let i = 1; i <= 4; i++) {
      ctx.globalAlpha = 0.14 * (1 - i / 5)
      ctx.fillStyle = ATHER
      ctx.shadowBlur = 7
      ctx.shadowColor = ATHER
      dot(ctx, sx - dir * i * 8, sy, 9 * (1 - i / 6))
    }
    ctx.globalAlpha = 1
  }
  for (let i = 1; i <= 5; i++) {
    ctx.globalAlpha = 0.1 * (1 - i / 6)
    ctx.fillStyle = ATHER
    ctx.shadowBlur = 8
    ctx.shadowColor = ATHER
    dot(ctx, sx, sy + i * 9, 10 * (1 - i / 7))
  }
  ctx.globalAlpha = 1
  const pulse = 1 + Math.sin(t * 9) * 0.08
  ctx.fillStyle = HOT
  ctx.shadowBlur = 22
  ctx.shadowColor = ATHER
  dot(ctx, sx, sy, 9 * pulse)
  ctx.fillStyle = ATHER
  ctx.globalAlpha = 0.5
  dot(ctx, sx, sy, 14 * pulse)
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
