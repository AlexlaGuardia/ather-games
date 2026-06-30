'use client'

// DEWDROP — a wild Dewbear loose in the collar-Moglins' burrow-warren. Hoover the dewdrops,
// dodge the four Moglins (Burr/Bramble/Nettle/Hemlock), grab a wildbloom to snap their collars
// and send them deflating home. Clear the warren to win. Canon: CANON/game/dewbear-maze.md.
// Touch joystick / WASD / arrows. Phosphor-glow maze. Sim in lib/dewdrop.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import ArcadeControls from '../_components/ArcadeControls'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeWorld,
  setHeading,
  tick,
  loadBest,
  saveBest,
  COLS,
  ROWS,
  START_LIVES,
  MOGLIN_COLOR,
  DEWBEAR_COLOR,
  type World,
  type Ghost,
} from './lib/dewdrop'
import { sfx } from './lib/sfx'

const TILE = 26 // bigger cells (smaller 15×17 grid still fills ~390px wide on a phone)
const VW = COLS * TILE // 15 × 26 = 390
const VH = ROWS * TILE // 17 × 26 = 442
const BG = '#05060f'
const WALL = '#1b3a5e' // burrow wall (dim phosphor blue)
const WALL_GLOW = '#2f6fa8'
const DEW = '#cdeff7' // dewdrop
const BLOOM = '#7fffc0' // wildbloom (wild Ather = green-cyan)
const FRIGHT = '#5b6fd8' // a deflated Moglin (worried pale blue)
const ACCENT = '#37d4e6'
const JOY_R = 56

type Phase = 'ready' | 'playing' | 'dead' | 'won'

export default function DewdropPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const seedRef = useRef(1)
  // the cabinet deck stick gives a -1..1 vector; the screen stays a neutral display.
  const deck = useRef({ active: false, x: 0, y: 0 })
  // kept inert so the canvas render's floating-stick block stays hidden (steering is the deck now).
  const joy = useRef({ active: false, baseX: 0, baseY: 0, curX: 0, curY: 0, pid: -1 })
  const keys = useRef<Set<string>>(new Set())
  const syncT = useRef(0)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [muted, setMuted] = useState(false)

  useNoScroll()

  const boot = useCallback(() => {
    seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0
    worldRef.current = makeWorld(seedRef.current ^ (Date.now() >>> 0))
    deck.current = { active: false, x: 0, y: 0 }
    keys.current.clear()
    setScore(0); setLives(START_LIVES); setNewBest(false)
    setPhase('ready')
  }, [])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setBest(loadBest())
  }, [boot])

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase())
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // keys / joystick → a cardinal heading (the maze keeps your last dir when input is idle)
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
    // the cabinet stick steers; idle keeps the last heading (the maze coasts on dir).
    if (deck.current.active) setHeading(w, deck.current.x, deck.current.y)
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

      if (w.state === 'playing') {
        applyHeading()
        const ev = tick(w, dt)
        if (ev.bloom) sfx.play('bloom')
        else if (ev.mote) sfx.play('drop')
        if (ev.eatGhost) sfx.play('pop')
        if (ev.death) { sfx.play('caught'); setLives(w.lives) }
        if (ev.won || (w.state as string) === 'dead') {
          const b = saveBest(w.score); setBest(b); setNewBest(w.score > 0 && w.score >= b)
          setScore(w.score)
          setPhase((w.state as string) === 'won' ? 'won' : 'dead')
        }
        syncT.current += dt
        if (syncT.current >= 0.1) { syncT.current = 0; setScore(w.score) }
      }
      render(canvas, w, ts, joy.current)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // ── input ── the cabinet deck stick (screen is a neutral display) ───────────────
  const launchIfReady = () => { if (worldRef.current?.state === 'playing' && phase === 'ready') setPhase('playing') }
  const deckStick = useCallback((x: number, y: number) => {
    sfx.ensure()
    const st = worldRef.current?.state
    if (st === 'dead' || st === 'won') return
    const live = Math.hypot(x, y) > 0.2 // deadzone — a resting stick doesn't turn or launch
    deck.current = { active: live, x, y }
    if (live) { setHeading(worldRef.current!, x, y); launchIfReady() }
  }, [phase])
  const deckEnd = useCallback(() => { deck.current = { active: false, x: 0, y: 0 } }, [])

  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); setMuted(m) }

  return (
    <ArcadeCabinet accent={ACCENT} wall={1} maxWidth={VW}>
      <div className="w-full flex items-center justify-between mb-3" style={{ maxWidth: VW }}>
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-sm tracking-[0.35em] uppercase" style={{ color: ACCENT, textShadow: `0 0 8px ${ACCENT}80` }}>Dewdrop</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">gobble the dew · dodge the collar</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      {/* score + lives */}
      <div className="w-full mb-2 flex items-center gap-3 font-mono" style={{ maxWidth: VW }}>
        <span className="gx-label text-[10px]" style={{ color: ACCENT }}>dew</span>
        <span className="gx-label text-[10px] text-[#e8feff] tabular-nums">{score}</span>
        <span className="gx-label text-[10px] tracking-wider ml-auto flex items-center gap-1">
          {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
            <span key={i} className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: DEWBEAR_COLOR, boxShadow: `0 0 6px ${DEWBEAR_COLOR}` }} />
          ))}
        </span>
      </div>

      <div className="gx-chrome relative w-full" style={{ maxWidth: VW, aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: ACCENT } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block touch-none rounded-md"
        />

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md text-center px-6 bg-[#05060f]/60">
            <div className="gx-title text-2xl tracking-[0.3em] uppercase" style={{ color: ACCENT, textShadow: `0 0 18px ${ACCENT}` }}>Dewdrop</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[280px]">
              a wild Dewbear in the Moglins&apos; burrow. gobble the dewdrops, slip the four collar-Moglins. grab a wildbloom and their collars snap — they deflate and flee, so chase them down. clear the warren.
            </p>
            <div className="gx-label text-[12px] text-[#05060f] px-6 py-2.5 rounded-[2px] mt-1" style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}80` }}>swipe to roam</div>
            {best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider mt-1">best <span className="text-[#e8feff] tabular-nums">{best}</span></div>}
          </div>
        )}

        {(phase === 'dead' || phase === 'won') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#05060f]/78 rounded-md text-center px-6">
            <div className="gx-title text-lg tracking-[0.3em] uppercase" style={{ color: phase === 'won' ? BLOOM : '#e89a6b', textShadow: `0 0 14px ${phase === 'won' ? BLOOM : '#e89a6b'}` }}>
              {phase === 'won' ? 'Warren Cleared' : 'Collared'}
            </div>
            <div className="gx-value font-mono text-[#e8feff] text-3xl leading-none tabular-nums" style={{ textShadow: `0 0 12px ${ACCENT}80` }}>{score}</div>
            {newBest
              ? <div className="gx-label text-[10px] font-mono tracking-wider" style={{ color: ACCENT }}>✦ new best</div>
              : best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/45 tracking-wider">best {best}</div>}
            <p className="text-[10px] leading-relaxed text-[#9fd6e0]/70 max-w-[250px] italic mt-0.5">
              {phase === 'won' ? 'every dewdrop gathered, every collar snapped. the warren is quiet.' : 'a collar finds your neck. wriggle free and try the warren again.'}
            </p>
            <button onClick={restart} className="gx-label text-[11px] text-[#05060f] hover:brightness-110 px-5 py-2 rounded-[2px] mt-1" style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}80` }}>back to the burrow →</button>
          </div>
        )}
      </div>

      {/* the cabinet control deck — the roam stick (screen stays a clean display) */}
      <ArcadeControls
        accent={ACCENT}
        maxWidth={VW}
        stick
        onStick={deckStick}
        onStickEnd={deckEnd}
        hint="drag the stick to roam · grab a wildbloom · clear the dew"
      />
    </ArcadeCabinet>
  )
}

interface Joy { active: boolean; baseX: number; baseY: number; curX: number; curY: number; pid: number }
const sx = (tx: number) => (tx + 0.5) * TILE
const sy = (tyy: number) => (tyy + 0.5) * TILE

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, joy: Joy) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  if (canvas.width !== VW * dpr || canvas.height !== VH * dpr) {
    canvas.width = VW * dpr
    canvas.height = VH * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const t = ts / 1000
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, VW, VH)

  // ── burrow walls (phosphor-glow rounded blocks) ───────────────────────────────
  ctx.fillStyle = WALL
  ctx.shadowBlur = 6
  ctx.shadowColor = WALL_GLOW
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (w.grid[y][x] !== '#') continue
      roundRect(ctx, x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4, 5)
      ctx.fill()
    }
  }
  ctx.shadowBlur = 0

  // ── dewdrops + wildblooms ─────────────────────────────────────────────────────
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = w.grid[y][x]
      if (c === '.') {
        ctx.fillStyle = DEW
        dot(ctx, sx(x), sy(y), 2)
      } else if (c === 'o') {
        const p = 0.6 + 0.4 * Math.sin(t * 5 + x + y)
        ctx.fillStyle = BLOOM
        ctx.shadowBlur = 12; ctx.shadowColor = BLOOM
        dot(ctx, sx(x), sy(y), 4 + p * 2)
        ctx.shadowBlur = 0
      }
    }
  }

  // ── the four Moglins ──────────────────────────────────────────────────────────
  for (const g of w.ghosts) drawMoglin(ctx, g, w, t)

  // ── the Dewbear (round, chomping toward its heading) ──────────────────────────
  drawDewbear(ctx, w, t)

  // ── fright timer pip + touch joystick ─────────────────────────────────────────
  if (w.frightT > 0) {
    ctx.fillStyle = BLOOM
    ctx.globalAlpha = 0.7
    ctx.fillRect(4, VH - 6, (VW - 8) * Math.min(1, w.frightT / 6.5), 3)
    ctx.globalAlpha = 1
  }
  if (joy.active) {
    let dx = joy.curX - joy.baseX, dy = joy.curY - joy.baseY
    const d = Math.hypot(dx, dy)
    if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R }
    ctx.globalAlpha = 0.12; ctx.fillStyle = DEWBEAR_COLOR; dot(ctx, joy.baseX, joy.baseY, JOY_R)
    ctx.globalAlpha = 0.4; ctx.strokeStyle = DEWBEAR_COLOR; ctx.lineWidth = 2; ring(ctx, joy.baseX, joy.baseY, JOY_R)
    ctx.globalAlpha = 0.8; ctx.fillStyle = DEWBEAR_COLOR; dot(ctx, joy.baseX + dx, joy.baseY + dy, 15)
    ctx.globalAlpha = 1
  }
}

function drawDewbear(ctx: CanvasRenderingContext2D, w: World, t: number) {
  const x = sx(w.px), y = sy(w.py)
  const r = TILE * 0.42
  const ang = w.dir === 'up' ? -Math.PI / 2 : w.dir === 'down' ? Math.PI / 2 : w.dir === 'left' ? Math.PI : 0
  ctx.fillStyle = DEWBEAR_COLOR
  ctx.shadowBlur = 12; ctx.shadowColor = DEWBEAR_COLOR
  if (w.dir && w.state === 'playing') {
    // a chomping mouth wedge (pac-style), opening toward the heading
    const mouth = (0.18 + 0.18 * Math.abs(Math.sin(t * 12))) * Math.PI
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, r, ang + mouth, ang - mouth + Math.PI * 2)
    ctx.closePath()
    ctx.fill()
  } else {
    dot(ctx, x, y, r)
  }
  ctx.shadowBlur = 0
  // a tiny eye (dewbear's ugly-cute face), offset perpendicular to the heading
  const ex = x + Math.cos(ang - Math.PI / 2) * r * 0.4
  const ey = y + Math.sin(ang - Math.PI / 2) * r * 0.4 - 2
  ctx.fillStyle = '#0b1622'
  dot(ctx, ex, ey, 1.6)
}

function drawMoglin(ctx: CanvasRenderingContext2D, g: Ghost, w: World, t: number) {
  const x = sx(g.x), y = sy(g.y)
  const r = TILE * 0.42
  const deflated = g.mode === 'frightened'
  const eyesOnly = g.mode === 'eaten'
  if (eyesOnly) {
    // just the collar scurrying home for a fresh spirit
    ctx.fillStyle = '#cfe'
    dot(ctx, x - 3, y, 2); dot(ctx, x + 3, y, 2)
    return
  }
  const body = deflated ? FRIGHT : MOGLIN_COLOR[g.moglin]
  ctx.fillStyle = body
  ctx.shadowBlur = deflated ? 6 : 8
  ctx.shadowColor = body
  // a rounded teddy hump: dome top + a little skirt
  ctx.beginPath()
  ctx.arc(x, y - 1, r, Math.PI, 0)
  ctx.lineTo(x + r, y + r * 0.8)
  // wavy bottom (3 humps) — deflated wobbles more
  const hump = deflated ? 3 : 2
  for (let i = 0; i < 3; i++) ctx.arc(x + r - (i + 0.5) * (2 * r / 3), y + r * 0.8, r / 3, 0, Math.PI, true)
  ctx.lineTo(x - r, y - 1)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
  // round ears
  ctx.fillStyle = body
  dot(ctx, x - r * 0.7, y - r * 0.9, r * 0.28)
  dot(ctx, x + r * 0.7, y - r * 0.9, r * 0.28)
  // Hemlock wears a little top hat (the collector-baron tell)
  if (g.moglin === 'hemlock' && !deflated) {
    ctx.fillStyle = '#15110d'
    ctx.fillRect(x - r * 0.7, y - r * 1.05, r * 1.4, 2)
    ctx.fillRect(x - r * 0.4, y - r * 1.7, r * 0.8, r * 0.7)
  }
  // eyes — worried when deflated
  ctx.fillStyle = deflated ? '#dfe' : '#0b1622'
  const eo = deflated ? 0 : dirEyeOffset(g.dir)
  dot(ctx, x - r * 0.34 + eo, y - r * 0.2, deflated ? 1.4 : 2)
  dot(ctx, x + r * 0.34 + eo, y - r * 0.2, deflated ? 1.4 : 2)
  void w; void t
}

function dirEyeOffset(d: Ghost['dir']): number {
  return d === 'left' ? -1.5 : d === 'right' ? 1.5 : 0
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
