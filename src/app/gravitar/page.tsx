'use client'

// GRAVITAR — slingshot a spark of Ather through the Orrery's gravity. Rotate + thrust, but the
// wells pull you the whole time; round them to reach the dim cores (each relights you: score +
// fuel). Crash into a world and the run ends; the void-wall just turns you back. Vector-glow,
// the whole arena in view so you can read the field. Core sim in lib/gravitar.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeWorld, tick, loadBest, saveBest, gravityAt,
  ARENA_R, SHIP_R, FUEL_MAX, CORE_R,
  type World,
} from './lib/gravitar'
import { sfx } from './lib/sfx'

const ATHER = '#37e6ff'
const HOT = '#e8feff'
const CORE_COL = '#ffd24a'
const WELL = '#8a6bff'
const VOID_EDGE = '#c86bff'

export default function GravitarPage() {
  useNoScroll()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const inputRef = useRef({ left: false, right: false, thrust: false })
  const startedRef = useRef(false)
  const trailRef = useRef<number[]>([])
  const lastT = useRef(0)

  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(false)
  const [score, setScore] = useState(0)
  const [fuel, setFuel] = useState(100)
  const [best, setBest] = useState(0)
  const [muted, setMuted] = useState(false)

  const boot = useCallback(() => {
    const b = loadBest()
    worldRef.current = makeWorld((Date.now() & 0xffffff) || 1, b)
    trailRef.current = []
    startedRef.current = false
    setStarted(false); setOver(false); setScore(0); setFuel(100); setBest(b)
  }, [])

  useEffect(() => { boot() }, [boot])

  // rAF: integrate the sim with held input, then render
  useEffect(() => {
    let raf = 0
    const loop = (ts: number) => {
      const w = worldRef.current
      const dt = lastT.current ? Math.min(0.033, (ts - lastT.current) / 1000) : 0.016
      lastT.current = ts
      if (w) {
        if (startedRef.current && !w.over) {
          const inp = inputRef.current
          const ev = tick(w, dt, { rotate: (inp.right ? 1 : 0) - (inp.left ? 1 : 0), thrust: inp.thrust })
          if (w.ship.thrusting) sfx.play('thrust')
          if (ev.collected) { sfx.play('collect'); setScore(w.score) }
          if (ev.lost && !w.over) sfx.play('bounce')
          if (ev.crashed) { sfx.play('crash'); setOver(true); if (w.score >= w.best) { saveBest(w.score); setBest(w.score) } }
          setFuel(w.ship.fuel)
          // trail
          trailRef.current.push(w.ship.x, w.ship.y)
          if (trailRef.current.length > 80) trailRef.current.splice(0, trailRef.current.length - 80)
        }
        render(canvasRef.current, w, trailRef.current, ts)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const begin = useCallback(() => {
    sfx.ensure()
    if (!startedRef.current) { startedRef.current = true; setStarted(true) }
  }, [])
  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); setMuted(m) }

  // keyboard
  useEffect(() => {
    const set = (e: KeyboardEvent, v: boolean) => {
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { inputRef.current.left = v; if (v) begin() }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { inputRef.current.right = v; if (v) begin() }
      else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { inputRef.current.thrust = v; if (v) begin(); e.preventDefault() }
      else return
    }
    const kd = (e: KeyboardEvent) => set(e, true)
    const ku = (e: KeyboardEvent) => set(e, false)
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [begin])

  const hold = (key: 'left' | 'right' | 'thrust') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); begin(); inputRef.current[key] = true },
    onPointerUp: (e: React.PointerEvent) => { e.preventDefault(); inputRef.current[key] = false },
    onPointerLeave: () => { inputRef.current[key] = false },
    onPointerCancel: () => { inputRef.current[key] = false },
  })

  const lowFuel = fuel <= 22

  return (
    <div className="min-h-screen bg-[#04040a] text-[#9fd6e0] flex flex-col items-center px-4 py-6 select-none">
      <div className="w-full max-w-[440px] flex items-center justify-between mb-3">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">&#8592; arcade</Link>
        <div className="text-center">
          <div className="font-mono text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Gravitar</div>
          <div className="text-[9px] text-[#7fd8e6]/40 font-mono tracking-[0.2em] uppercase mt-0.5">round the wells</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      <div className="w-full max-w-[440px] mb-2 flex items-center gap-3 font-mono">
        <span className="text-[9px] tracking-[0.2em] uppercase text-[#7fd8e6]/40">cores</span>
        <span className="text-[#e8feff] text-lg tabular-nums leading-none" style={{ textShadow: '0 0 8px #37e6ff70' }}>{score}</span>
        <span className="text-[9px] tracking-[0.2em] uppercase text-[#7fd8e6]/30 ml-1">best {best}</span>
        <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden ml-auto max-w-[150px]">
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${fuel}%`, background: lowFuel ? '#ff5d9e' : '#ffd24a', boxShadow: `0 0 10px ${lowFuel ? '#ff5d9e' : '#ffd24a'}` }} />
        </div>
        <span className="text-[9px] tracking-[0.2em] uppercase text-[#7fd8e6]/40">fuel</span>
      </div>

      <div className="relative w-full max-w-[440px]" style={{ aspectRatio: '1 / 1' }}>
        <canvas ref={canvasRef} className="w-full h-full block touch-none rounded-md" />
        <div className="pointer-events-none absolute inset-0 rounded-md gv-crt" />

        {!started && !over && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#04040a]/45 rounded-md text-center px-6">
            <div className="font-mono text-[#37e6ff] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #37e6ff' }}>Gravitar</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[290px]">
              gravity never lets go. turn and burn to round the wells and gather the cores — each relights your fuel. crash a world and you&apos;re done; the void just turns you back.
            </p>
            <div className="font-mono text-[11px] text-[#7fd8e6]/60 tracking-[0.15em]">◄ ► turn · ▲ thrust &nbsp;·&nbsp; arrows / WASD</div>
            <div className="font-mono text-[12px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] px-6 py-2.5 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>thrust to fly</div>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#04040a]/78 rounded-md text-center px-6">
            <div className="font-mono text-[#c86bff] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #c86bff' }}>Dashed on the rocks</div>
            <div className="font-mono text-[#e8feff] text-3xl tabular-nums leading-none" style={{ textShadow: '0 0 12px #37e6ff80' }}>{score}</div>
            <div className="text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider">best {best}{score >= best && score > 0 ? ' ✦ new best' : ''}</div>
            <button onClick={restart} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-6 py-2 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>fly again →</button>
          </div>
        )}
      </div>

      {/* touch controls */}
      <div className="w-full max-w-[440px] mt-3 flex items-stretch gap-2 font-mono select-none">
        <button {...hold('left')} className="flex-1 py-4 rounded-md border border-[#37e6ff]/30 bg-[#37e6ff]/[0.06] active:bg-[#37e6ff]/20 text-[#37e6ff]/80 text-lg">◄</button>
        <button {...hold('thrust')} className="flex-[1.4] py-4 rounded-md border border-[#ffd24a]/40 bg-[#ffd24a]/[0.07] active:bg-[#ffd24a]/25 text-[#ffd24a]/90 text-sm tracking-[0.25em] uppercase">▲ thrust</button>
        <button {...hold('right')} className="flex-1 py-4 rounded-md border border-[#37e6ff]/30 bg-[#37e6ff]/[0.06] active:bg-[#37e6ff]/20 text-[#37e6ff]/80 text-lg">►</button>
      </div>

      <div className="w-full max-w-[440px] flex items-center justify-between mt-4">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/45 hover:text-[#37e6ff] font-mono">arcade</Link>
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">round the wells · gather the light</p>
      </div>

      <style jsx>{`
        .gv-crt {
          background:
            radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%),
            repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0) 4px);
          animation: gv-flicker 5s infinite steps(60); mix-blend-mode: multiply;
        }
        @keyframes gv-flicker { 0%,97%,100% { opacity: 1; } 98% { opacity: 0.95; } 99% { opacity: 0.98; } }
      `}</style>
    </div>
  )
}

function render(canvas: HTMLCanvasElement | null, w: World, trail: number[], ts: number) {
  if (!canvas) return
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const cw = canvas.clientWidth || 440, ch = canvas.clientHeight || 440
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) { canvas.width = cw * dpr; canvas.height = ch * dpr }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const t = ts / 1000
  const pulse = 0.5 + 0.5 * Math.sin(t * 3)

  ctx.fillStyle = '#04040a'
  ctx.fillRect(0, 0, cw, ch)

  // whole arena fits with a small margin; ship + cores get a min screen size for visibility
  const scale = cw / (ARENA_R * 2 * 1.06)
  const X = (wx: number) => cw / 2 + wx * scale
  const Y = (wy: number) => ch / 2 + wy * scale

  // void ring
  ctx.strokeStyle = VOID_EDGE; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(cw / 2, ch / 2, ARENA_R * scale, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1

  // gravity wells
  for (const b of w.bodies) {
    const x = X(b.x), y = Y(b.y), r = b.r * scale
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4)
    g.addColorStop(0, '#1a1430'); g.addColorStop(0.5, WELL + '40'); g.addColorStop(1, 'transparent')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#0a0814'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = WELL; ctx.lineWidth = 1.5; ctx.shadowColor = WELL; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0
  }

  // cores
  for (const c of w.cores) {
    const x = X(c.x), y = Y(c.y), r = Math.max(5, CORE_R * scale)
    ctx.fillStyle = CORE_COL; ctx.globalAlpha = 0.6 + 0.4 * pulse
    ctx.shadowColor = CORE_COL; ctx.shadowBlur = 12
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
  }

  // ship trail
  if (trail.length >= 4) {
    ctx.strokeStyle = ATHER; ctx.lineWidth = 1.5; ctx.lineCap = 'round'
    for (let i = 2; i < trail.length; i += 2) {
      ctx.globalAlpha = 0.04 + 0.16 * (i / trail.length)
      ctx.beginPath(); ctx.moveTo(X(trail[i - 2]), Y(trail[i - 1])); ctx.lineTo(X(trail[i]), Y(trail[i + 1])); ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  // the ship — fixed screen size for visibility, oriented to angle; thrust flame
  const s = w.ship
  if (s.alive) {
    const sx = X(s.x), sy = Y(s.y), a = s.angle, R = 9
    if (s.thrusting) {
      const fl = R * (1.4 + 0.5 * Math.random())
      ctx.strokeStyle = '#ffb86b'; ctx.lineWidth = 2; ctx.globalAlpha = 0.85
      ctx.shadowColor = '#ffb86b'; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.moveTo(sx - Math.cos(a) * R, sy - Math.sin(a) * R)
      ctx.lineTo(sx - Math.cos(a) * (R + fl), sy - Math.sin(a) * (R + fl)); ctx.stroke()
      ctx.shadowBlur = 0; ctx.globalAlpha = 1
    }
    ctx.fillStyle = HOT; ctx.strokeStyle = ATHER; ctx.lineWidth = 1.5
    ctx.shadowColor = ATHER; ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(sx + Math.cos(a) * R, sy + Math.sin(a) * R)
    ctx.lineTo(sx + Math.cos(a + 2.5) * R * 0.8, sy + Math.sin(a + 2.5) * R * 0.8)
    ctx.lineTo(sx + Math.cos(a - 2.5) * R * 0.8, sy + Math.sin(a - 2.5) * R * 0.8)
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0
  }
  void gravityAt // (reserved for a future aim-line predictor)
}
