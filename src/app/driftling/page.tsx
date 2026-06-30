'use client'

// DRIFTLING — a newborn spirit-fish adrift. Steer toward your finger/cursor to drift; eat
// anything smaller, flee anything bigger, cross discrete evolution tiers up the food chain.
// The wedge: the FIRST thing you eat locks your element branch. Vector-glow on a dark ocean.
// Sim in lib/driftling.ts. ART IS PLACEHOLDER (glowing circles) — render polish is a later pass.

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import ArcadeControls from '../_components/ArcadeControls'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeWorld,
  setHeading,
  tick,
  apexName,
  loadBest,
  saveBest,
  LADDER,
  START_TIER,
  EQUAL_BAND,
  ELEMENTS,
  type World,
  type ElementId,
} from './lib/driftling'
import { sfx } from './lib/sfx'

// virtual viewport (portrait, mobile-fit). The camera centres the player; the renderer scales.
const VW = 420
const VH = 620
const BG_TOP = '#03060f'
const BG_BOT = '#06121f'
const NEUTRAL = '#cfeaf2' // pre-fork player + UI light
const DANGER = '#ff5d6c' // threat ring (bigger than you)
const JOY_R = 62 // virtual-px deflection radius of the touch joystick (full tilt at the rim)

const elColor: Record<ElementId, string> = Object.fromEntries(ELEMENTS.map((e) => [e.id, e.color])) as Record<ElementId, string>

// drifting plankton motes for depth (purely cosmetic parallax)
const MOTES = (() => {
  const r = mulberry32(0xd71f)
  return Array.from({ length: 60 }, () => ({ x: r() * 3000 - 800, y: r() * 3000 - 800, s: 0.4 + r() * 1.0, par: 0.4 + r() * 0.5, p: r() * 6.28 }))
})()

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// progress 0..1 through the current tier toward the next evolution
function evolveProgress(w: World): number {
  const prev = w.tier > 0 ? LADDER[w.tier - 1].evolveAt : 0
  const next = LADDER[w.tier].evolveAt
  if (!isFinite(next)) return 1
  return Math.max(0, Math.min(1, (w.mass - prev) / (next - prev)))
}

type Phase = 'ready' | 'playing' | 'dead'

export default function DriftlingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const seedRef = useRef(1)
  // the cabinet deck stick gives a -1..1 vector; the screen stays a neutral display.
  const deck = useRef({ active: false, x: 0, y: 0 })
  // kept inert so the canvas render's floating-stick block stays hidden (steering is the deck now).
  const joy = useRef({ active: false, baseX: 0, baseY: 0, curX: 0, curY: 0, pid: -1 })
  const keys = useRef<Set<string>>(new Set())
  const syncT = useRef(0)
  const growFx = useRef(0) // seconds left on the evolve/fork payoff burst

  const [phase, setPhase] = useState<Phase>('ready')
  const [tierName, setTierName] = useState(cap(LADDER[START_TIER].key))
  const [score, setScore] = useState(0)
  const [branch, setBranch] = useState<ElementId | null>(null)
  const [apex, setApex] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [muted, setMuted] = useState(false)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [eaten, setEaten] = useState(0) // creatures consumed, frozen at death for the summary

  useNoScroll()

  const boot = useCallback(() => {
    seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0
    worldRef.current = makeWorld(seedRef.current ^ (Date.now() >>> 0))
    deck.current = { active: false, x: 0, y: 0 }
    keys.current.clear()
    setTierName(cap(LADDER[START_TIER].key))
    setScore(0)
    setBranch(null)
    setApex(null)
    setProgress(0)
    setNewBest(false)
    setEaten(0)
    setPhase('ready')
  }, [])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setBest(loadBest())
  }, [boot])

  // keyboard steering (WASD / arrows) — desktop alternative to the cursor
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current.add(e.key.toLowerCase()) }
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // resolve the steering heading from keys (priority) or the pointer
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
    // the cabinet stick steers; released = coast straight (drift physics carries it).
    if (deck.current.active) { setHeading(w, deck.current.x, deck.current.y); return }
    setHeading(w, 0, 0)
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

      if (growFx.current > 0) growFx.current = Math.max(0, growFx.current - dt)
      if (w.state === 'playing') {
        applyHeading()
        const ev = tick(w, dt)
        if (ev.forkLocked) sfx.play('fork')
        else if (ev.grew) sfx.play('grow')
        else if (ev.ate) sfx.play('eat')
        if (ev.grew || ev.forkLocked) growFx.current = 0.7 // fire the payoff burst
        if (ev.grew) setTierName(cap(LADDER[w.tier].key))
        if (ev.forkLocked) { setBranch(w.branch); setApex(apexName(w)) }
        if (ev.eaten) {
          sfx.play('death')
          setScore(w.score)
          setEaten(w.eaten)
          const b = saveBest(w.score)
          setBest(b)
          setNewBest(w.score > 0 && w.score >= b)
          setPhase('dead')
        }
        syncT.current += dt
        if (syncT.current >= 0.08) { syncT.current = 0; setScore(w.score); setProgress(evolveProgress(w)) }
      } else if (w.state === 'ready' && phase !== 'ready') {
        // keyboard/pointer can flip state before React catches up
      }
      render(canvas, w, ts, growFx.current, joy.current)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // ── steering input ── the cabinet deck stick (screen is a neutral display) ──────
  const launchIfReady = () => {
    if (worldRef.current?.state === 'playing' && phase === 'ready') setPhase('playing')
  }
  const deckStick = useCallback((x: number, y: number) => {
    sfx.ensure()
    const w = worldRef.current
    if (!w || w.state === 'dead') return
    const live = Math.hypot(x, y) > 0.18 // deadzone — a resting stick doesn't steer or launch
    deck.current = { active: live, x, y }
    setHeading(w, live ? x : 0, live ? y : 0)
    launchIfReady()
  }, [phase])
  const deckEnd = useCallback(() => {
    deck.current = { active: false, x: 0, y: 0 }
    if (worldRef.current) setHeading(worldRef.current, 0, 0)
  }, [])

  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); setMuted(m) }

  const accent = branch ? elColor[branch] : '#37d4e6'

  return (
    <ArcadeCabinet accent={accent} wall={1} maxWidth={VW}>
      <div className="w-full flex items-center justify-between mb-3" style={{ maxWidth: VW }}>
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-sm tracking-[0.35em] uppercase" style={{ color: accent, textShadow: `0 0 8px ${accent}80` }}>Driftling</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">eat small · flee big · evolve</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      {/* tier · score · evolve progress */}
      <div className="w-full mb-2 flex items-center gap-3 font-mono" style={{ maxWidth: VW }}>
        <span className="gx-label text-[10px]" style={{ color: accent }}>{tierName}</span>
        {branch && <span className="gx-label text-[9px] text-[#7fd8e6]/45">{cap(branch)}{apex ? ` → ${apex}` : ''}</span>}
        <span className="gx-label text-[10px] text-[#e8feff] tabular-nums ml-auto">{score}</span>
        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden max-w-[120px] flex-1 min-w-[60px]">
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${progress * 100}%`, background: accent, boxShadow: `0 0 10px ${accent}` }} />
        </div>
      </div>

      <div className="gx-chrome relative w-full" style={{ maxWidth: VW, aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: accent } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block touch-none rounded-md"
        />

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md text-center px-6 bg-[#03060f]/55">
            <div className="gx-title text-2xl tracking-[0.3em] uppercase" style={{ color: accent, textShadow: `0 0 18px ${accent}` }}>Driftling</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[280px]">
              touch and drag to swim that way. eat anything smaller than you, slip anything bigger. grow enough and you evolve. the first thing you eat decides what you become.
            </p>
            <div className="gx-label text-[12px] text-[#03060f] px-6 py-2.5 rounded-[2px] mt-1" style={{ background: accent, boxShadow: `0 0 18px ${accent}80` }}>drift to begin</div>
            {best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider mt-1">best <span className="text-[#e8feff] tabular-nums">{best}</span></div>}
          </div>
        )}

        {phase === 'dead' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#03060f]/75 rounded-md text-center px-6">
            <div className="gx-title text-[#ff5d6c] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #ff5d6c' }}>Swallowed</div>
            <div className="gx-value font-mono text-[#e8feff] text-3xl leading-none tabular-nums" style={{ textShadow: `0 0 12px ${accent}80` }}>{score}</div>
            {newBest
              ? <div className="gx-label text-[10px] font-mono tracking-wider" style={{ color: accent }}>✦ new best</div>
              : best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/45 tracking-wider">best {best}</div>}
            {/* run summary — how far you climbed, written as the run's little story */}
            <div className="gx-label text-[10px] font-mono text-[#9fd6e0]/55 tracking-wider mt-0.5">
              reached <span style={{ color: accent }}>{tierName}</span> · ate <span className="text-[#e8feff] tabular-nums">{eaten}</span>{branch ? <> · <span style={{ color: accent }}>{cap(branch)}</span>-line</> : ''}
            </div>
            <p className="text-[10px] leading-relaxed text-[#9fd6e0]/70 max-w-[250px] italic mt-0.5">
              {branch ? `a bigger thing of the deep took you. the ${cap(branch)}-line ends here.` : 'something bigger took you before you ever fed. drift wary.'}
            </p>
            <button onClick={restart} className="gx-label text-[11px] text-[#03060f] hover:brightness-110 px-5 py-2 rounded-[2px] mt-1" style={{ background: accent, boxShadow: `0 0 18px ${accent}80` }}>drift again →</button>
          </div>
        )}
      </div>

      {/* the cabinet control deck — the steer stick (screen stays a clean display) */}
      <ArcadeControls
        accent={accent}
        maxWidth={VW}
        stick
        onStick={deckStick}
        onStickEnd={deckEnd}
        hint="drag the stick to swim · eat up the ladder"
      />
    </ArcadeCabinet>
  )
}

interface Joy { active: boolean; baseX: number; baseY: number; curX: number; curY: number; pid: number }

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, growFx: number, joy: Joy) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  if (canvas.width !== VW * dpr || canvas.height !== VH * dpr) {
    canvas.width = VW * dpr
    canvas.height = VH * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const t = ts / 1000

  // ocean gradient
  const g = ctx.createLinearGradient(0, 0, 0, VH)
  g.addColorStop(0, BG_TOP)
  g.addColorStop(1, BG_BOT)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VW, VH)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // camera centres the player
  const sx = (wx: number) => VW / 2 + (wx - w.x)
  const sy = (wy: number) => VH / 2 + (wy - w.y)

  // drifting plankton motes (parallax)
  for (const m of MOTES) {
    const px = ((m.x - w.x * m.par) % 3000 + 3000) % 3000 - 800
    const py = ((m.y - w.y * m.par) % 3000 + 3000) % 3000 - 800
    if (px < -10 || px > VW + 10 || py < -10 || py > VH + 10) continue
    ctx.globalAlpha = 0.06 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.8 + m.p))
    ctx.fillStyle = '#9fb8c8'
    dot(ctx, px, py, m.s)
  }
  ctx.globalAlpha = 1

  // ── ocean life ────────────────────────────────────────────────────────────────
  for (const c of w.creatures) {
    const px = sx(c.x), py = sy(c.y)
    if (px < -60 || px > VW + 60 || py < -60 || py > VH + 60) continue
    const col = elColor[c.element]
    const isThreat = c.size > w.size * (1 + EQUAL_BAND)
    const isPrey = c.size < w.size * (1 - EQUAL_BAND)
    // body glow
    ctx.fillStyle = col
    ctx.shadowBlur = 12
    ctx.shadowColor = col
    ctx.globalAlpha = 0.92
    fish(ctx, px, py, c.size, Math.atan2(c.vy, c.vx), t + c.id)
    ctx.shadowBlur = 0
    // readability ring: a danger halo on things that can eat you; a soft tick on prey
    if (isThreat) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5 + c.id)
      ctx.strokeStyle = DANGER
      ctx.lineWidth = 2
      ring(ctx, px, py, c.size + 5)
    } else if (isPrey) {
      ctx.globalAlpha = 0.5
      ctx.fillStyle = '#e8feff'
      dot(ctx, px, py - c.size * 0.2, Math.max(1, c.size * 0.18))
    }
    ctx.globalAlpha = 1
  }

  // ── the player ────────────────────────────────────────────────────────────────
  const px = VW / 2, py = VH / 2
  const pcol = w.branch ? elColor[w.branch] : NEUTRAL
  const heading = Math.atan2(w.vy, w.vx)
  // wake bubbles when moving
  const sp = Math.hypot(w.vx, w.vy)
  if (sp > 20 && w.state === 'playing') {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = pcol
    for (let i = 0; i < 3; i++) {
      const back = heading + Math.PI
      const d = w.size + 4 + i * 5
      dot(ctx, px + Math.cos(back) * d, py + Math.sin(back) * d, Math.max(0.8, 2 - i * 0.5))
    }
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = pcol
  ctx.shadowBlur = 18
  ctx.shadowColor = pcol
  fish(ctx, px, py, w.size, heading, t)
  // a bright eye-spark + a faint own-ring so the player reads as "you"
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff'
  ctx.globalAlpha = 0.9
  dot(ctx, px + Math.cos(heading) * w.size * 0.45, py + Math.sin(heading) * w.size * 0.45 - w.size * 0.18, Math.max(1.2, w.size * 0.16))
  ctx.globalAlpha = 0.3
  ctx.strokeStyle = pcol
  ctx.lineWidth = 1
  ring(ctx, px, py, w.size + 3)
  ctx.globalAlpha = 1

  // ── evolve / fork payoff burst — an expanding fading ring + flash on the player ─
  if (growFx > 0) {
    const p = 1 - growFx / 0.7 // 0 → 1 over the burst
    const r = w.size + p * (w.size * 3 + 36)
    ctx.globalAlpha = (1 - p) * 0.8
    ctx.strokeStyle = pcol
    ctx.lineWidth = 3
    ctx.shadowBlur = 16
    ctx.shadowColor = pcol
    ring(ctx, px, py, r)
    ctx.globalAlpha = (1 - p) * 0.25
    ctx.fillStyle = pcol
    dot(ctx, px, py, r * 0.7)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  // ── off-screen threat warnings — a danger chevron at the edge points at a nearby
  //    bigger creature you can't see yet, so getting swallowed is never a blind hit ─
  const margin = 26
  for (const c of w.creatures) {
    if (c.size <= w.size * (1 + EQUAL_BAND)) continue // only things that can eat you
    const cxw = sx(c.x), cyw = sy(c.y)
    const onScreen = cxw >= -10 && cxw <= VW + 10 && cyw >= -10 && cyw <= VH + 10
    if (onScreen) continue
    const d = Math.hypot(c.x - w.x, c.y - w.y)
    if (d > 620) continue // only warn for ones drifting genuinely close
    const ang = Math.atan2(cyw - VH / 2, cxw - VW / 2)
    // clamp the marker to the viewport rectangle along the threat's bearing
    const hw = VW / 2 - margin, hh = VH / 2 - margin
    const sxr = Math.abs(Math.cos(ang)) < 1e-3 ? Infinity : hw / Math.abs(Math.cos(ang))
    const syr = Math.abs(Math.sin(ang)) < 1e-3 ? Infinity : hh / Math.abs(Math.sin(ang))
    const rad = Math.min(sxr, syr)
    const ex = VW / 2 + Math.cos(ang) * rad
    const ey = VH / 2 + Math.sin(ang) * rad
    const near = 1 - Math.min(1, d / 620) // closer = brighter + bigger
    ctx.save()
    ctx.translate(ex, ey)
    ctx.rotate(ang)
    ctx.globalAlpha = 0.3 + near * 0.5 + 0.15 * Math.sin(ts / 120)
    ctx.fillStyle = DANGER
    ctx.shadowBlur = 8
    ctx.shadowColor = DANGER
    const s = 7 + near * 5
    ctx.beginPath()
    ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, s * 0.7); ctx.lineTo(-s * 0.7, -s * 0.7)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // ── the floating touch joystick (only while a thumb is down) ──────────────────
  if (joy.active) {
    let dx = joy.curX - joy.baseX, dy = joy.curY - joy.baseY
    const d = Math.hypot(dx, dy)
    if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R }
    ctx.globalAlpha = 0.16
    ctx.fillStyle = NEUTRAL
    dot(ctx, joy.baseX, joy.baseY, JOY_R)
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = NEUTRAL
    ctx.lineWidth = 2
    ring(ctx, joy.baseX, joy.baseY, JOY_R)
    ctx.globalAlpha = 0.85
    ctx.fillStyle = NEUTRAL
    ctx.shadowBlur = 10
    ctx.shadowColor = NEUTRAL
    dot(ctx, joy.baseX + dx, joy.baseY + dy, 19)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
}

// a tiny teardrop "fish": a body circle + a tail nub pointing opposite the heading
function fish(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, t: number) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2)
  ctx.fill()
  // tail: a little triangle wagging behind
  const wag = Math.sin(t * 8) * 0.3
  const back = ang + Math.PI + wag
  const tx = x + Math.cos(back) * r * 1.5
  const ty = y + Math.sin(back) * r * 1.5
  const perp = back + Math.PI / 2
  ctx.beginPath()
  ctx.moveTo(x + Math.cos(back) * r * 0.7, y + Math.sin(back) * r * 0.7)
  ctx.lineTo(tx + Math.cos(perp) * r * 0.55, ty + Math.sin(perp) * r * 0.55)
  ctx.lineTo(tx - Math.cos(perp) * r * 0.55, ty - Math.sin(perp) * r * 0.55)
  ctx.closePath()
  ctx.fill()
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
