'use client'

// VAULT — a mote of Ather-light crosses the greying (canon: CANON/game/vault.md). The land is going
// grey, eaten into the void's tears; the mote runs the failing ground and leaps the gaps — forward
// motion is the defiance. One input: the VAULT (jump), variable (tap = short hop, hold = float higher).
// Unmake grey void-spawn from above (stomp + bounce-combo), hop the rooted corruption, gather loose
// light. Sibling to Updraft (the climb). Sim in lib/vault.ts (mechanics canon-agnostic; this is the skin).

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeWorld,
  pressJump,
  releaseJump,
  tick,
  diffAt,
  loadBest,
  saveBest,
  VW,
  VH,
  RUNNER_SX,
  RUNNER_W,
  RUNNER_H,
  FOE_W,
  FOE_H,
  SPIKE_W,
  SPIKE_H,
  MOTE_R,
  type World,
} from './lib/vault'
import { sfx } from './lib/sfx'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'
import DailyLeaderboard from '../_components/DailyLeaderboard'
import ArcadeControls from '../_components/ArcadeControls'

// ── the greying palette ───────────────────────────────────────────────────────────
const BG_TOP = '#070a12' // night over the failing land
const BG_BOT = '#0c0f18'
const ATHER = '#7fe9ff' // the mote (you) — Ather-light, cyan core
const GOLD = '#ffd479' // the light's warm glow + loose motes
const HOT = '#eafcff'
const LAND = '#2f7d74' // surviving coloured ground (still alive)
const LAND_LIP = '#5fe0c8' // the lit edge of living ground
const GREY = '#71717a' // the grey — void-spawn + rooted corruption
const GREY_HOT = '#a7a7b0'
const ACCENT = ATHER

type Phase = 'ready' | 'playing' | 'dead'

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string }

export default function VaultPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const seedRef = useRef(1)
  const downKeys = useRef<Set<string>>(new Set()) // tracks held jump keys (ignore auto-repeat)
  const trail = useRef<number[]>([]) // recent runner screen-y for the light-trail / jump arc
  const fx = useRef<Particle[]>([])
  const shake = useRef(0)
  const comboFx = useRef(0)
  const syncT = useRef(0)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [dist, setDist] = useState(0)
  const [motes, setMotes] = useState(0)
  const [cause, setCause] = useState<'gap' | 'foe' | 'spike'>('gap')
  const [muted, setMuted] = useState(false)
  const [mode, setMode] = useState<'endless' | 'daily'>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)

  useNoScroll()

  const boot = useCallback(() => {
    let seed: number
    if (modeRef.current === 'daily') seed = dailySeed() // same crossing for everyone today
    else { seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0; seed = seedRef.current ^ (Date.now() >>> 0) }
    worldRef.current = makeWorld(seed)
    downKeys.current.clear()
    trail.current = []
    fx.current = []
    shake.current = 0
    comboFx.current = 0
    setScore(0); setDist(0); setMotes(0); setNewBest(false); setShared(false)
    setPhase('ready')
  }, [])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setBest(loadBest())
    setDailyBest(loadDailyBest('vault'))
  }, [boot])

  const pickMode = (m: 'endless' | 'daily') => {
    if (m === modeRef.current) return
    modeRef.current = m
    setMode(m)
    boot()
  }
  const onShare = async () => {
    if (await copyShare(dailyShare('Vault', score))) {
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

  // ── the one input: the vault (jump). Variable via hold (press → up-arc, release → cut). ──────────
  const doPress = useCallback(() => {
    sfx.ensure()
    const w = worldRef.current
    if (!w || w.state === 'dead') return
    if (w.state === 'ready') setPhase('playing')
    pressJump(w)
  }, [])
  const doRelease = useCallback(() => {
    const w = worldRef.current
    if (w) releaseJump(w)
  }, [])

  useEffect(() => {
    const JUMP_KEYS = new Set([' ', 'arrowup', 'w', 'k'])
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (!JUMP_KEYS.has(k)) return
      e.preventDefault()
      if (downKeys.current.has(k)) return // ignore auto-repeat — only the first press is a vault
      downKeys.current.add(k)
      doPress()
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (!JUMP_KEYS.has(k)) return
      downKeys.current.delete(k)
      if (downKeys.current.size === 0) doRelease()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [doPress, doRelease])

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

      if (comboFx.current > 0) comboFx.current = Math.max(0, comboFx.current - dt)
      if (shake.current > 0) shake.current = Math.max(0, shake.current - dt)
      stepParticles(dt)

      if (w.state === 'playing') {
        tick(w, dt)
        for (const ev of w.events) {
          if (ev.type === 'jump') { if (ev.air) { sfx.play('djump'); burstAirJump(w) } else sfx.play('jump') }
          else if (ev.type === 'land') sfx.play('land')
          else if (ev.type === 'collect') { sfx.play('collect'); burstCollect(w) }
          else if (ev.type === 'stomp') { sfx.play('stomp'); burstStomp(w); comboFx.current = 0.6 }
          else if (ev.type === 'death') {
            sfx.play('death'); shake.current = 0.4
            setScore(w.score); setDist(Math.floor(w.dist / 10)); setMotes(w.motesGot); setCause(ev.cause)
            const b = saveBest(w.score); setBest(b); setNewBest(w.score > 0 && w.score >= b)
            if (modeRef.current === 'daily') setDailyBest(saveDailyBest('vault', w.score))
            setPhase('dead')
          }
        }
        // light-trail: remember recent screen-y (the arc when jumping)
        trail.current.unshift(w.y)
        if (trail.current.length > 14) trail.current.pop()
        syncT.current += dt
        if (syncT.current >= 0.1) { syncT.current = 0; setScore(w.score); setMotes(w.motesGot) }
      }
      render(canvas, w, ts, trail.current, fx.current, shake.current, comboFx.current)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // ── particle helpers ──────────────────────────────────────────────────────────
  function stepParticles(dt: number) {
    const ps = fx.current
    for (const p of ps) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; p.life -= dt }
    fx.current = ps.filter(p => p.life > 0)
  }
  function burstStomp(w: World) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      fx.current.push({ x: RUNNER_SX, y: w.y - RUNNER_H * 0.4, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 40, life: 0.4, max: 0.4, c: GREY_HOT })
    }
  }
  function burstCollect(w: World) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2
      fx.current.push({ x: RUNNER_SX, y: w.y - RUNNER_H * 0.5, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 60, life: 0.35, max: 0.35, c: GOLD })
    }
  }
  // the double-jump kick — a downward ring of ather-light puffing off the leap (the momentum carry)
  function burstAirJump(w: World) {
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.15 + (i / 7) * 0.7) // a fan aimed downward (the push-off)
      fx.current.push({ x: RUNNER_SX, y: w.y - RUNNER_H * 0.3, vx: Math.cos(a) * 70 - 30, vy: Math.sin(a) * 80, life: 0.3, max: 0.3, c: ATHER })
    }
  }

  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); setMuted(m) }


  return (
    <ArcadeCabinet accent={ACCENT} wall={1} maxWidth={VW}>
      <div className="w-full flex items-center justify-between mb-3" style={{ maxWidth: VW }}>
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-sm tracking-[0.35em] uppercase" style={{ color: ACCENT, textShadow: `0 0 8px ${ACCENT}80` }}>Vault</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">carry the light · leap the tears</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      {/* score + motes */}
      <div className="w-full mb-2 flex items-center gap-3 font-mono" style={{ maxWidth: VW }}>
        <span className="gx-label text-[10px]" style={{ color: ACCENT }}>crossing</span>
        <span className="gx-label text-[10px] text-[#e8feff] tabular-nums">{score}</span>
        <span className="gx-label text-[9px] tracking-wider ml-auto" style={{ color: GOLD }}>light <span className="text-[#e8feff] tabular-nums">{motes}</span></span>
      </div>

      <div className="gx-chrome relative w-full" style={{ maxWidth: VW, aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: ACCENT } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block rounded-md select-none pointer-events-none"
        />

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/vault/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.55]" />
            <div className="absolute inset-0 -z-10 bg-[#070a12]/68" />
            <div className="gx-title text-2xl tracking-[0.3em] uppercase" style={{ color: ACCENT, textShadow: `0 0 18px ${ACCENT}` }}>Vault</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[290px]">
              the land is going grey. you are a mote of Ather-light running the failing ground. tap (or hold) to vault the void&apos;s tears, and unmake the grey by landing on it from above — each unmaking gives you a double-jump, so tap again to chain across them. you cannot hold the light still. carry it.
            </p>
            <div className="pointer-events-auto flex gap-1.5 text-[10px] font-mono tracking-wider uppercase">
              {(['endless', 'daily'] as const).map((m) => (
                <button key={m} onClick={() => pickMode(m)}
                  className={`px-3 py-1.5 rounded-sm border transition-colors ${mode === m ? 'text-[#070a12] bg-[#7fe9ff] border-[#7fe9ff]' : 'text-[#7fe9ff]/55 border-[#7fe9ff]/25 hover:text-[#7fe9ff]'}`}>
                  {m === 'daily' ? `daily #${dailyNumber()}` : m}
                </button>
              ))}
            </div>
            {mode === 'daily' && <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider -mt-1">same crossing for everyone today</div>}
            <div className="gx-label text-[11px] text-[#7fd8e6]/70 mt-1">press <span style={{ color: ACCENT }}>↟ Vault</span> below to begin</div>
            {best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider mt-1">best <span className="text-[#e8feff] tabular-nums">{best}</span></div>}
          </div>
        )}

        {phase === 'dead' && (
          <div className="absolute inset-0 overflow-y-auto bg-[#070a12]/75 rounded-md">
           <div className="min-h-full flex flex-col items-center justify-center gap-2 text-center px-6 py-4">
            <div className="gx-title text-[#a7a7b0] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #71717a' }}>The grey takes the light</div>
            <div className="gx-value font-mono text-[#e8feff] text-3xl leading-none tabular-nums" style={{ textShadow: `0 0 12px ${ACCENT}80` }}>{score}</div>
            {newBest
              ? <div className="gx-label text-[10px] font-mono tracking-wider" style={{ color: ACCENT }}>✦ new best</div>
              : best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/45 tracking-wider">best {best}</div>}
            <div className="gx-label text-[10px] font-mono text-[#9fd6e0]/55 tracking-wider mt-0.5">
              crossed <span style={{ color: ACCENT }} className="tabular-nums">{dist}</span> · gathered <span style={{ color: GOLD }} className="tabular-nums">{motes}</span>
            </div>
            {mode === 'daily' && (
              <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/55 tracking-wider">
                daily #{dailyNumber()} · best {dailyBest}{score >= dailyBest && score > 0 ? ' ✦ today’s best' : ''}
              </div>
            )}
            <p className="text-[10px] leading-relaxed text-[#9fd6e0]/70 max-w-[250px] italic mt-0.5">{DEATH_LINE[cause]}</p>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={restart} className="gx-label text-[11px] text-[#070a12] hover:brightness-110 px-5 py-2 rounded-[2px]" style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}80` }}>carry it again →</button>
              {mode === 'daily' && (
                <button onClick={onShare} className="gx-label text-[11px] text-[#7fe9ff] border border-[#7fe9ff]/40 hover:border-[#7fe9ff] px-5 py-2 rounded-[2px] transition-colors">
                  {shared ? 'copied ✓' : 'share'}
                </button>
              )}
            </div>
            {mode === 'daily' && <DailyLeaderboard gameId="vault" accent={ACCENT} score={score} className="mt-1.5" />}
           </div>
          </div>
        )}
      </div>

      {/* the cabinet control deck — one big VAULT button under the screen (keyboard still works) */}
      <ArcadeControls
        accent={ACCENT}
        maxWidth={VW}
        buttons={[{ id: 'jump', label: 'Vault', glyph: '↟', hint: 'space', size: 'lg' }]}
        onPress={doPress}
        onRelease={doRelease}
        hint="tap = short hop · hold = float higher"
      />

      <div className="w-full flex items-center justify-center mt-3" style={{ maxWidth: VW }}>
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">stomp grey from above → tap again to double-jump · hop the thorns</p>
      </div>
    </ArcadeCabinet>
  )
}

const DEATH_LINE: Record<'gap' | 'foe' | 'spike', string> = {
  gap: 'the light fell into the void’s tear. read the gap sooner.',
  foe: 'the grey caught the light from the side. come down on it next time.',
  spike: 'rooted corruption cannot be unmade. it must be leapt.',
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, trail: number[], fx: Particle[], shake: number, comboFx: number) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  if (canvas.width !== VW * dpr || canvas.height !== VH * dpr) {
    canvas.width = VW * dpr
    canvas.height = VH * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const t = ts / 1000
  const d = diffAt(w.dist) // the greying: grows with distance
  const camX = w.dist - RUNNER_SX
  const sx = (x: number) => x - camX

  // screen-shake on death
  ctx.save()
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 22, (Math.random() - 0.5) * shake * 22)

  // sky — darkens/greys as the Dying gains ground
  const g = ctx.createLinearGradient(0, 0, 0, VH)
  g.addColorStop(0, BG_TOP)
  g.addColorStop(1, BG_BOT)
  ctx.fillStyle = g
  ctx.fillRect(-30, -30, VW + 60, VH + 60)
  // a creeping grey wash from the top, thicker with difficulty (the greying)
  ctx.globalAlpha = 0.04 + d * 0.16
  ctx.fillStyle = GREY
  ctx.fillRect(-30, -30, VW + 60, VH + 60)
  ctx.globalAlpha = 1

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // faint parallax motes of dead light drifting back (cheap depth)
  ctx.globalAlpha = 0.06
  ctx.fillStyle = GREY_HOT
  for (let i = 0; i < 6; i++) {
    const px = ((i * 113 - w.dist * 0.18) % (VW + 80) + VW + 80) % (VW + 80) - 40
    dot(ctx, px, 40 + ((i * 53) % 120), 2.5)
  }
  ctx.globalAlpha = 1

  // ── surviving ground (coloured islands) — gaps between them are the void's tears ──
  for (const s of w.segs) {
    const x0 = sx(s.x0), x1 = sx(s.x1)
    if (x1 < -20 || x0 > VW + 20) continue
    const wdt = x1 - x0
    // body of living ground
    const gg = ctx.createLinearGradient(0, s.top, 0, VH)
    gg.addColorStop(0, LAND)
    gg.addColorStop(1, '#11201f')
    ctx.fillStyle = gg
    ctx.fillRect(x0, s.top, wdt, VH - s.top + 30)
    // the lit living edge (brighter = the light still holds here)
    ctx.strokeStyle = LAND_LIP
    ctx.globalAlpha = 0.9
    ctx.shadowBlur = 8
    ctx.shadowColor = LAND_LIP
    ctx.lineWidth = 2
    seg(ctx, x0, s.top, x1, s.top)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  // ── motes — loose Ather-light (gather them) ───────────────────────────────────
  for (const m of w.motes) {
    if (m.got) continue
    const mx = sx(m.x)
    if (mx < -10 || mx > VW + 10) continue
    const bob = Math.sin(t * 4 + m.x * 0.05) * 2
    ctx.fillStyle = GOLD
    ctx.shadowBlur = 10
    ctx.shadowColor = GOLD
    dot(ctx, mx, m.y + bob, MOTE_R)
    ctx.fillStyle = HOT
    ctx.globalAlpha = 0.6
    dot(ctx, mx, m.y + bob, MOTE_R * 0.4)
    ctx.globalAlpha = 1
  }
  ctx.shadowBlur = 0

  // ── rooted corruption (spikes) — grey thorns, never stompable ─────────────────
  for (const s of w.spikes) {
    const cx = sx(s.x)
    if (cx < -16 || cx > VW + 16) continue
    ctx.fillStyle = GREY
    ctx.strokeStyle = GREY_HOT
    ctx.lineWidth = 1
    const base = s.y, half = SPIKE_W * 0.5
    ctx.beginPath()
    ctx.moveTo(cx - half, base)
    ctx.lineTo(cx, base - SPIKE_H)
    ctx.lineTo(cx + half, base)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // ── grey void-spawn (foes) — soulless, colourless; unmake from above ──────────
  for (const f of w.foes) {
    if (f.dead) continue
    const fx2 = sx(f.x)
    if (fx2 < -18 || fx2 > VW + 18) continue
    const wob = Math.sin(t * 8 + f.x * 0.1) * 1.5
    ctx.fillStyle = GREY
    ctx.shadowBlur = 6
    ctx.shadowColor = GREY_HOT
    roundRect(ctx, fx2 - FOE_W / 2, f.y - FOE_H + wob, FOE_W, FOE_H, 4)
    ctx.fill()
    ctx.shadowBlur = 0
    // dead-eyes (the soullessness)
    ctx.fillStyle = '#0c0f18'
    dot(ctx, fx2 - 3.5, f.y - FOE_H * 0.6 + wob, 1.6)
    dot(ctx, fx2 + 3.5, f.y - FOE_H * 0.6 + wob, 1.6)
  }

  // ── transient FX (unmaking burst / collect spark) ─────────────────────────────
  for (const p of fx) {
    ctx.globalAlpha = Math.max(0, p.life / p.max)
    ctx.fillStyle = p.c
    dot(ctx, p.x, p.y, 2.2)
  }
  ctx.globalAlpha = 1

  // ── the mote (you) — light-trail arc + bright cyan/gold core ──────────────────
  if (w.state !== 'dead') {
    // light-trail: fading after-images along the recent arc (offset left = motion)
    for (let i = trail.length - 1; i > 0; i--) {
      ctx.globalAlpha = 0.04 + 0.12 * (1 - i / trail.length)
      ctx.fillStyle = ATHER
      dot(ctx, RUNNER_SX - i * 3.2, trail[i] - RUNNER_H * 0.5, RUNNER_W * 0.34)
    }
    ctx.globalAlpha = 1
    const cy = w.y - RUNNER_H * 0.5
    // ground-shadow under the mote (reads height/landing)
    const segUnder = w.segs.find(s => w.dist >= s.x0 && w.dist <= s.x1)
    if (segUnder) {
      ctx.globalAlpha = 0.25
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(RUNNER_SX, segUnder.top - 1, RUNNER_W * 0.5, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    // gold outer glow
    ctx.fillStyle = GOLD
    ctx.shadowBlur = 16
    ctx.shadowColor = GOLD
    dot(ctx, RUNNER_SX, cy, RUNNER_W * 0.55)
    // cyan core
    ctx.fillStyle = ATHER
    ctx.shadowBlur = 12
    ctx.shadowColor = ATHER
    dot(ctx, RUNNER_SX, cy, RUNNER_W * 0.42)
    // hot center
    ctx.shadowBlur = 6
    ctx.fillStyle = HOT
    dot(ctx, RUNNER_SX, cy, RUNNER_W * 0.2)
    ctx.shadowBlur = 0
  }

  // ── combo readout (the unmaking chain) ────────────────────────────────────────
  if (comboFx > 0 && w.combo > 1) {
    ctx.globalAlpha = Math.min(1, comboFx / 0.4)
    ctx.fillStyle = GREY_HOT
    ctx.font = 'bold 16px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`unmaking ×${w.combo}`, RUNNER_SX, w.y - RUNNER_H - 14)
    ctx.globalAlpha = 1
    ctx.textAlign = 'start'
  }

  ctx.restore()
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
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
