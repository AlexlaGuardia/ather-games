'use client'

// DRIFTLING — a newborn spirit-fish adrift. Steer toward your finger/cursor to drift; eat
// anything smaller, flee anything bigger, cross discrete evolution tiers up the food chain.
// The wedge: the FIRST thing you eat locks your element branch. Vector-glow on a dark ocean.
// Sim in lib/driftling.ts. ART IS PLACEHOLDER (glowing circles) — render polish is a later pass.

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import ArcadeControls from '../_components/ArcadeControls'
import { StartButton, useStartKey } from '../_components/ArcadeStart'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import { screenMaxW, deckMaxW, cabinetMaxW } from '@/lib/arcade/fit'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'
import DailyLeaderboard from '../_components/DailyLeaderboard'
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
  MATCH_TIME,
  DEPTH_PER_TIER,
  APEX_TIER,
  WORLD_H,
  current,
  type World,
  type ElementId,
} from './lib/driftling'
import { sfx } from './lib/sfx'
import { music } from './music'

// virtual viewport (portrait, mobile-fit). The camera centres the player; the renderer scales.
const VW = 420
const VH = 620
const SHALLOW_TOP = '#0c3446' // bright teal — the surface shallows (left / start)
const SHALLOW_BOT = '#114c60'
const DEEP_TOP = '#02040b' // the black abyss — deep right
const DEEP_BOT = '#04101c'
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
  const [endReason, setEndReason] = useState<'eaten' | 'time' | null>(null)
  const [tierName, setTierName] = useState(cap(LADDER[START_TIER].key))
  const [score, setScore] = useState(0)
  const [branch, setBranch] = useState<ElementId | null>(null)
  const [apex, setApex] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [muted, setMuted] = useState(false)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [eaten, setEaten] = useState(0) // creatures consumed, frozen at death for the summary
  const [mode, setMode] = useState<'endless' | 'daily'>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)

  useNoScroll()

  const boot = useCallback(() => {
    // daily = the same ocean for everyone today (deterministic seed); endless = fresh each run.
    let seed: number
    if (modeRef.current === 'daily') seed = dailySeed()
    else { seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0; seed = seedRef.current ^ (Date.now() >>> 0) }
    worldRef.current = makeWorld(seed)
    deck.current = { active: false, x: 0, y: 0 }
    keys.current.clear()
    setTierName(cap(LADDER[START_TIER].key))
    setScore(0)
    setBranch(null)
    setApex(null)
    setProgress(0)
    setNewBest(false)
    setEaten(0)
    setShared(false)
    setPhase('ready')
  }, [])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setBest(loadBest())
    setDailyBest(loadDailyBest('driftling'))
    music.setMuted(sfx.isMuted()); void music.ensure() // decode the ocean bed ahead of the first drift
    return () => { music.stop() } // tear the audio down on leave — never follows you out
  }, [boot])

  const pickMode = (m: 'endless' | 'daily') => {
    if (m === modeRef.current) return
    modeRef.current = m
    setMode(m)
    boot()
  }

  const doShare = async () => {
    if (await copyShare(dailyShare('Driftling', score))) {
      setShared(true)
      setTimeout(() => setShared(false), 1600)
    }
  }

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
        if (ev.eaten || ev.timeup) {
          sfx.play(ev.timeup ? 'grow' : 'death') // time-up is a proud finish; eaten is the sting
          setScore(w.score)
          setEaten(w.eaten)
          setEndReason(w.endReason)
          const b = saveBest(w.score)
          setBest(b)
          setNewBest(w.score > 0 && w.score >= b)
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('driftling', w.score))
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

  // START launches the run (the click/key IS the audio-unlock gesture); the first steer input
  // then ONLY steers — it never launches. Flip the sim + React together, without committing a heading.
  const start = useCallback(() => {
    const w = worldRef.current
    if (!w || w.state !== 'ready') return
    sfx.ensure()
    music.start() // the START gesture unlocks + starts the ocean bed
    w.state = 'playing'
    setPhase('playing')
  }, [])

  // ── steering input ── the cabinet deck stick (screen is a neutral display) ──────
  const deckStick = useCallback((x: number, y: number) => {
    const w = worldRef.current
    if (!w || w.state !== 'playing') return // steers only once START launched the run
    const live = Math.hypot(x, y) > 0.18 // deadzone — a resting stick coasts
    deck.current = { active: live, x, y }
    setHeading(w, live ? x : 0, live ? y : 0)
  }, [])
  const deckEnd = useCallback(() => {
    deck.current = { active: false, x: 0, y: 0 }
    if (worldRef.current) setHeading(worldRef.current, 0, 0)
  }, [])

  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); music.setMuted(m); setMuted(m) }

  // Enter / Space launch from the ready screen (desktop) — fires only while ready
  useStartKey(start, phase === 'ready')

  const accent = branch ? elColor[branch] : '#37d4e6'

  return (
    <ArcadeCabinet gameId="driftling" accent={accent} wall={1} maxWidth={cabinetMaxW(VW, VH)}>
      <div className="w-full flex items-center justify-between mb-3" style={{ maxWidth: cabinetMaxW(VW, VH) }}>
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-sm tracking-[0.35em] uppercase" style={{ color: accent, textShadow: `0 0 8px ${accent}80` }}>Driftling</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">eat small · flee big · evolve</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      {/* tier · score · evolve progress */}
      <div className="w-full mb-2 flex items-center gap-3 font-mono" style={{ maxWidth: cabinetMaxW(VW, VH) }}>
        <span className="gx-label text-[10px]" style={{ color: accent }}>{tierName}</span>
        {branch && <span className="gx-label text-[9px] text-[#7fd8e6]/45">{cap(branch)}{apex ? ` → ${apex}` : ''}</span>}
        <span className="gx-label text-[10px] text-[#e8feff] tabular-nums ml-auto">{score}</span>
        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden max-w-[120px] flex-1 min-w-[60px]">
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${progress * 100}%`, background: accent, boxShadow: `0 0 10px ${accent}` }} />
        </div>
      </div>

      <div className="gx-chrome relative w-full" style={{ maxWidth: screenMaxW(VW, VH), aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: accent } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block touch-none rounded-md"
        />

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/driftling/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.5]" />
            <div className="absolute inset-0 -z-10 bg-[#03060f]/62" />
            <div className="gx-title text-2xl tracking-[0.3em] uppercase" style={{ color: accent, textShadow: `0 0 18px ${accent}` }}>Driftling</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[280px]">
              touch and drag to swim that way. eat anything smaller than you, slip anything bigger. grow enough and you evolve. the first thing you eat decides what you become.
            </p>
            <div className="pointer-events-auto flex gap-1.5 text-[10px] font-mono tracking-wider">
              {(['endless', 'daily'] as const).map((m) => (
                <button key={m} onClick={() => pickMode(m)}
                  className="px-3 py-1.5 rounded-sm border transition-colors"
                  style={mode === m
                    ? { color: '#03060f', background: accent, borderColor: accent }
                    : { color: `${accent}8c`, borderColor: `${accent}40` }}>
                  {m === 'daily' ? `daily #${dailyNumber()}` : m}
                </button>
              ))}
            </div>
            {mode === 'daily' && <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider -mt-1">the same ocean for everyone today</div>}
            <div className="mt-1"><StartButton accent={accent} onStart={start} hint="drag the stick to swim" /></div>
            {mode === 'daily'
              ? dailyBest > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider mt-1">today&apos;s best <span className="text-[#e8feff] tabular-nums">{dailyBest}</span></div>
              : best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider mt-1">best <span className="text-[#e8feff] tabular-nums">{best}</span></div>}
          </div>
        )}

        {phase === 'dead' && (
          <div className="absolute inset-0 overflow-y-auto bg-[#03060f]/75 rounded-md">
           <div className="min-h-full flex flex-col items-center justify-center gap-2 text-center px-6 py-4">
            <div className="gx-title text-lg tracking-[0.3em] uppercase" style={{ color: endReason === 'time' ? accent : '#ff5d6c', textShadow: `0 0 14px ${endReason === 'time' ? accent : '#ff5d6c'}` }}>{endReason === 'time' ? 'The Deep Holds' : 'Swallowed'}</div>
            <div className="gx-value font-mono text-[#e8feff] text-3xl leading-none tabular-nums" style={{ textShadow: `0 0 12px ${accent}80` }}>{score}</div>
            {mode === 'daily'
              ? <div className="gx-label text-[10px] font-mono tracking-wider" style={{ color: accent }}>daily #{dailyNumber()} · today&apos;s best {dailyBest}{score >= dailyBest && score > 0 ? ' ✦' : ''}</div>
              : newBest
                ? <div className="gx-label text-[10px] font-mono tracking-wider" style={{ color: accent }}>✦ new best</div>
                : best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/45 tracking-wider">best {best}</div>}
            {/* run summary — how far you climbed, written as the run's little story */}
            <div className="gx-label text-[10px] font-mono text-[#9fd6e0]/55 tracking-wider mt-0.5">
              reached <span style={{ color: accent }}>{tierName}</span> · ate <span className="text-[#e8feff] tabular-nums">{eaten}</span>{branch ? <> · <span style={{ color: accent }}>{cap(branch)}</span>-line</> : ''}
            </div>
            <p className="text-[10px] leading-relaxed text-[#9fd6e0]/70 max-w-[250px] italic mt-0.5">
              {endReason === 'time'
                ? `three minutes in the current, and the deep let you go this far. push further next drift.`
                : branch ? `a bigger thing of the deep took you. the ${cap(branch)}-line ends here.` : 'something bigger took you before you ever fed. drift wary.'}
            </p>
            <button onClick={restart} className="gx-label text-[11px] text-[#03060f] hover:brightness-110 px-5 py-2 rounded-[2px] mt-1" style={{ background: accent, boxShadow: `0 0 18px ${accent}80` }}>drift again →</button>
            {mode === 'daily' && (
              <button onClick={doShare} className="gx-label text-[10px] tracking-wider px-4 py-1.5 rounded-[2px] border transition-colors" style={{ color: accent, borderColor: `${accent}55` }}>
                {shared ? 'copied ✓' : 'share result'}
              </button>
            )}
            {mode === 'daily' && <DailyLeaderboard gameId="driftling" accent={accent} score={score} className="mt-1.5" />}
           </div>
          </div>
        )}
      </div>

      {/* the cabinet control deck — the steer stick (screen stays a clean display) */}
      <ArcadeControls
        accent={accent}
        maxWidth={deckMaxW}
        stick
        onStick={deckStick}
        onStickEnd={deckEnd}
        hint="drag the stick to swim · eat up the ladder"
        keyLegend={[{ keys: 'W A S D', label: 'swim' }]}
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

  // the water DARKENS with depth: bright teal shallows → black abyss as you push right (sells the descent)
  const depthFrac = Math.min(1, w.x / (DEPTH_PER_TIER * APEX_TIER))
  const g = ctx.createLinearGradient(0, 0, 0, VH)
  g.addColorStop(0, mix(SHALLOW_TOP, DEEP_TOP, depthFrac))
  g.addColorStop(1, mix(SHALLOW_BOT, DEEP_BOT, depthFrac))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VW, VH)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // camera centres the player
  const sx = (wx: number) => VW / 2 + (wx - w.x)
  const sy = (wy: number) => VH / 2 + (wy - w.y)

  // world bounds made VISIBLE — they only slide into view as you near them, so "where the map ends"
  // reads before you reach it (no more slamming an invisible wall). Surface (top), floor (bottom),
  // shallow shelf (left). The ocean stays endless to the right.
  const surfY = sy(0)
  if (surfY > -30) {
    const sg = ctx.createLinearGradient(0, 0, 0, Math.max(2, surfY))
    sg.addColorStop(0, 'rgba(200,242,253,0.45)') // sunlit surface glare
    sg.addColorStop(1, 'rgba(170,224,242,0)')
    ctx.fillStyle = sg
    ctx.fillRect(0, 0, VW, Math.max(0, surfY))
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#e2f7ff'; ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= VW; x += 12) { const yy = surfY + Math.sin(x * 0.06 + t * 1.4) * 2.5; x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy) }
    ctx.stroke(); ctx.globalAlpha = 1
  }
  const floorY = sy(WORLD_H)
  if (floorY < VH + 30) {
    const top = Math.min(VH, floorY)
    const fg = ctx.createLinearGradient(0, top, 0, VH)
    fg.addColorStop(0, 'rgba(10,8,16,0)')
    fg.addColorStop(1, 'rgba(6,5,12,0.72)') // seabed
    ctx.fillStyle = fg
    ctx.fillRect(0, top, VW, VH - top)
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#2b2438'; ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= VW; x += 16) { const yy = floorY + Math.sin(x * 0.05 + 2) * 3; x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy) }
    ctx.stroke(); ctx.globalAlpha = 1
  }
  const shelfX = sx(0)
  if (shelfX > -30) {
    const xg = ctx.createLinearGradient(0, 0, Math.max(2, shelfX), 0)
    xg.addColorStop(0, 'rgba(150,212,226,0.3)') // the pale shallows you came from
    xg.addColorStop(1, 'rgba(150,212,226,0)')
    ctx.fillStyle = xg
    ctx.fillRect(0, 0, Math.max(0, shelfX), VH)
  }

  // drifting plankton — streaked ALONG the local current so the flow field is legible (an invisible
  // force that shoves you is disorienting; leaning every mote the way the water pushes makes it a read)
  ctx.strokeStyle = '#9fb8c8'
  for (const m of MOTES) {
    const px = ((m.x - w.x * m.par) % 3000 + 3000) % 3000 - 800
    const py = ((m.y - w.y * m.par) % 3000 + 3000) % 3000 - 800
    if (px < -10 || px > VW + 10 || py < -10 || py > VH + 10) continue
    // sample the current at this mote's world position (camera-mapped); w.t so streaks match the water
    const [cx, cy] = current(w.x + (px - VW / 2), w.y + (py - VH / 2), w.t)
    const cm = Math.hypot(cx, cy) || 1
    const ux = cx / cm, uy = cy / cm
    const len = 3 + m.s * 4.5
    ctx.globalAlpha = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.8 + m.p))
    ctx.lineWidth = Math.max(0.6, m.s * 0.85)
    ctx.beginPath()
    ctx.moveTo(px - ux * len * 0.5, py - uy * len * 0.5)
    ctx.lineTo(px + ux * len * 0.5, py + uy * len * 0.5)
    ctx.stroke()
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

  // ── the 3-minute match clock (top-right; turns urgent in the last 30s) ─────────
  if (w.state === 'playing') {
    const left = Math.max(0, MATCH_TIME - w.t)
    const mm = Math.floor(left / 60), ss = Math.floor(left % 60)
    const urgent = left <= 30
    ctx.font = '600 15px ui-monospace, SFMono-Regular, monospace'
    ctx.textAlign = 'right'
    ctx.fillStyle = urgent ? '#ff5d6c' : '#cfeaf2'
    ctx.globalAlpha = urgent ? 0.7 + 0.3 * Math.sin(t * 8) : 0.85
    ctx.shadowBlur = urgent ? 8 : 0; ctx.shadowColor = '#ff5d6c'
    ctx.fillText(`${mm}:${ss < 10 ? '0' : ''}${ss}`, VW - 12, 24)
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left'
  }
}

// hex → rgb() lerp for the depth-darkening water
function mix(a: string, b: string, tt: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const k = Math.max(0, Math.min(1, tt))
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * k)
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * k)
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * k)
  return `rgb(${r},${g},${bl})`
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
