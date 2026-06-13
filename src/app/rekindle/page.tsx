'use client'

// REKINDLE — route coloured Ather to matching cores, keep colours PURE (two hues
// meeting muddy the flow), spend charge per rotation. The Aeterna network is home:
// each node is a dead machine that unlocks lore when lit. Plus a date-seeded Daily
// Machine and Endless free play (generated boards). Atari vector-glow on canvas.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  TEMPLATES,
  type Level,
  type Cell,
  type Hue,
  type Solve,
  scramble,
  solveState,
  stars,
  openSides,
} from './lib/puzzle'
import { NODES, loadProgress, recordClear, type Progress } from './lib/world'
import { genTemplate, dailySeed, dailyKey, type Template } from './lib/generate'
import { WorldMap } from './components/WorldMap'
import { sfx } from './lib/sfx'

const CELL = 64
const SIDE_DX = [0, 1, 0, -1]
const SIDE_DY = [-1, 0, 1, 0]
const HUE: Record<Hue, string> = { cyan: '#37e6ff', amber: '#ffb24a', rose: '#ff5d9e' }
const MIX = '#8b8fa6'
const DARK = '#16454f'
const BG = '#04040a'
const BEAD = '#e8feff'

type Kind = 'node' | 'daily' | 'endless'

// per-node scramble seeds chosen so every machine is a real puzzle (par 8–14),
// never a near-solved freebie
const NODE_SEEDS = [21, 297, 21, 108, 21]

export default function RekindlePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<Level | null>(null)
  const solveRef = useRef<Solve | null>(null)
  const doneRef = useRef(false)
  const flashRef = useRef(0)
  const seedRef = useRef(0)
  const resetRef = useRef(0)
  const endlessRef = useRef(1)

  const [view, setView] = useState<'map' | 'play'>('map')
  const [progress, setProgress] = useState<Progress>({})
  const [dailyDone, setDailyDone] = useState(0) // stars on today's daily, 0 = not done
  const [tmpl, setTmpl] = useState<Template | null>(null)
  const [kind, setKind] = useState<Kind>('node')
  const [nodeId, setNodeId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [used, setUsed] = useState(0)
  const [charge, setCharge] = useState(0)
  const [par, setPar] = useState(0)
  const [won, setWon] = useState(false)
  const [failed, setFailed] = useState(false)
  const [earned, setEarned] = useState(0)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setProgress(loadProgress())
    setMuted(sfx.isMuted())
    try {
      setDailyDone(+(localStorage.getItem(`rekindle.daily.${dailyKey(new Date())}`) || 0))
    } catch { /* storage unavailable */ }
  }, [])

  const node = nodeId !== null ? NODES.find((n) => n.id === nodeId) : undefined

  const load = useCallback((template: Template, seed: number) => {
    seedRef.current = seed
    const b = scramble(template, seed)
    boardRef.current = b
    solveRef.current = solveState(b)
    doneRef.current = false
    flashRef.current = 0
    setTmpl(template)
    setName(template.name)
    setCharge(b.charge)
    setPar(b.par)
    setUsed(0)
    setWon(false)
    setFailed(false)
    setEarned(0)
  }, [])

  const openNode = useCallback((level: number) => {
    resetRef.current = 0
    const id = NODES.find((n) => n.level === level)?.id ?? level
    setKind('node')
    setNodeId(id)
    load(TEMPLATES[level], NODE_SEEDS[level] ?? ((level + 1) * 2654435761) >>> 0)
    setView('play')
  }, [load])

  const openDaily = useCallback(() => {
    const s = dailySeed(new Date())
    setKind('daily')
    setNodeId(null)
    load(genTemplate(5, 5, s, 'Daily Machine'), s)
    setView('play')
  }, [load])

  const openEndless = useCallback(() => {
    const s = ((endlessRef.current++ * 2654435761) ^ (boardRef.current ? seedRef.current : 1)) >>> 0
    setKind('endless')
    setNodeId(null)
    load(genTemplate(5, 5, s, 'Endless Machine'), s)
    setView('play')
  }, [load])

  // ── render loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0
    let last = 0
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw)
      const canvas = canvasRef.current
      const b = boardRef.current
      const sv = solveRef.current
      if (!canvas || !b || !sv) return
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0
      last = ts
      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - dt / 1.2)
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
      const W = b.cols * CELL, H = b.rows * CELL
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr
        canvas.height = H * dpr
      }
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, W, H)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const t = ts / 1000
      for (let r = 0; r < b.rows; r++)
        for (let c = 0; c < b.cols; c++) {
          if (b.grid[r][c].role === 'empty') continue
          drawCell(ctx, b.grid[r][c], r, c, sv, t)
        }
      if (flashRef.current > 0) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = flashRef.current * 0.5
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, W, H)
        ctx.restore()
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ── interaction ────────────────────────────────────────────────────────────
  const onPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const b = boardRef.current
      const canvas = canvasRef.current
      if (!b || !canvas || doneRef.current) return
      sfx.ensure()
      const rect = canvas.getBoundingClientRect()
      const col = Math.floor(((e.clientX - rect.left) / rect.width) * b.cols)
      const row = Math.floor(((e.clientY - rect.top) / rect.height) * b.rows)
      const cell = b.grid[row]?.[col]
      if (!cell || cell.fixed || cell.role === 'empty') return

      cell.rot = (cell.rot + 1) & 3
      sfx.play('rotate')
      const before = solveRef.current
      const sv = solveState(b)
      solveRef.current = sv
      if (before && sv.coresLit.size > before.coresLit.size) sfx.play('connect')

      setUsed((u) => {
        const nextUsed = u + 1
        if (sv.done) {
          doneRef.current = true
          flashRef.current = 1
          const st = stars(nextUsed, b.par, b.charge)
          setEarned(st)
          if (kind === 'node' && nodeId !== null) setProgress(recordClear(nodeId, st))
          else if (kind === 'daily') {
            try { localStorage.setItem(`rekindle.daily.${dailyKey(new Date())}`, String(st)) } catch {}
            setDailyDone(st)
          }
          sfx.play('rekindle')
          window.setTimeout(() => sfx.play('complete'), 180)
          setWon(true)
        } else if (nextUsed >= b.charge) {
          doneRef.current = true
          setFailed(true)
        }
        return nextUsed
      })
    },
    [kind, nodeId],
  )

  const toMap = () => setView('map')
  const reset = () => load(tmpl!, (seedRef.current ^ (++resetRef.current * 40503)) >>> 0)
  const retry = () => load(tmpl!, seedRef.current)
  const toggleMute = () => {
    sfx.ensure()
    const m = !sfx.isMuted()
    sfx.setMuted(m)
    setMuted(m)
  }

  const remaining = charge - used
  const low = remaining <= Math.max(1, charge - par)
  const aspect = `${tmpl?.cols ?? 5} / ${tmpl?.rows ?? 5}`

  const reward =
    kind === 'node'
      ? node?.lore
      : kind === 'daily'
        ? "Today's machine wakes. The network remembers the date. Come back tomorrow for the next."
        : 'Another machine, pulled whole from the dark. There is no end to them.'

  // ── MAP VIEW ────────────────────────────────────────────────────────────────
  if (view === 'map') {
    return (
      <div className="min-h-screen bg-[#04040a] text-[#7fd8e6] flex flex-col items-center px-4 py-6 select-none">
        <div className="w-full max-w-[560px] flex items-center justify-between mb-6">
          <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">
            &#8592; arcade
          </Link>
          <div className="text-center">
            <div className="font-mono text-[#37e6ff] text-sm tracking-[0.3em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Rekindle</div>
            <div className="text-[9px] text-[#7fd8e6]/40 font-mono tracking-[0.2em] uppercase mt-0.5">the aeterna network</div>
          </div>
          <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">
            {muted ? 'son' : 'snd'}
          </button>
        </div>

        <WorldMap progress={progress} onPlay={openNode} />

        {/* generated machines */}
        <div className="w-full max-w-[440px] grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={openDaily}
            className="rounded-md border border-[#ffb24a]/25 bg-[#0a0a14]/70 hover:border-[#ffb24a]/60 p-3 text-left transition-colors"
          >
            <div className="font-mono text-[#ffb24a] text-[11px] tracking-[0.2em] uppercase">Daily Machine</div>
            <div className="text-[9px] text-[#7fd8e6]/45 font-mono mt-1">
              {dailyDone ? <span style={{ color: '#ffd54a' }}>{'★'.repeat(dailyDone)} cleared today</span> : 'a new one each day'}
            </div>
          </button>
          <button
            onClick={openEndless}
            className="rounded-md border border-[#37e6ff]/20 bg-[#0a0a14]/70 hover:border-[#37e6ff]/55 p-3 text-left transition-colors"
          >
            <div className="font-mono text-[#37e6ff] text-[11px] tracking-[0.2em] uppercase">Endless</div>
            <div className="text-[9px] text-[#7fd8e6]/45 font-mono mt-1">free play · fresh every time</div>
          </button>
        </div>

        <p className="mt-6 text-[10px] text-[#7fd8e6]/30 font-mono tracking-wider text-center max-w-[440px]">
          the machines of Aeterna were left running. relight each one to wake the network.
        </p>
      </div>
    )
  }

  // ── PLAY VIEW ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#04040a] text-[#7fd8e6] flex flex-col items-center px-4 py-6 select-none">
      <div className="w-full max-w-[520px] flex items-center justify-between mb-4">
        <button onClick={toMap} className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">
          &#8592; network
        </button>
        <div className="text-center">
          <div className="font-mono text-[#37e6ff] text-sm tracking-[0.3em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>{name}</div>
          <div className="text-[10px] text-[#7fd8e6]/40 font-mono tracking-wider mt-0.5">
            {kind === 'node' && nodeId !== null ? `node ${nodeId + 1}/${NODES.length}` : kind === 'daily' ? 'daily · ' + dailyKey(new Date()) : 'endless'}
          </div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">
          {muted ? 'son' : 'snd'}
        </button>
      </div>

      <div className="w-full max-w-[480px] mb-2 flex items-center gap-3">
        <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#7fd8e6]/40">charge</span>
        <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-150" style={{ width: `${Math.max(0, (remaining / charge) * 100)}%`, background: low ? '#ff5d9e' : '#37e6ff', boxShadow: `0 0 10px ${low ? '#ff5d9e' : '#37e6ff'}` }} />
        </div>
        <span className="text-[10px] font-mono tabular-nums text-[#7fd8e6]/60 w-20 text-right">{remaining} left · par {par}</span>
      </div>

      <div className="relative w-full max-w-[480px]" style={{ aspectRatio: aspect }}>
        <canvas ref={canvasRef} onPointerDown={onPoint} className="w-full h-full block touch-none rounded-md cursor-pointer" />
        <div className="pointer-events-none absolute inset-0 rounded-md rk-crt" />

        {won && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#04040a]/70 rounded-md px-5 text-center">
            <div className="font-mono text-[#54ff9e] text-xl tracking-[0.35em] uppercase" style={{ textShadow: '0 0 16px #54ff9e' }}>Rekindled</div>
            <div className="text-lg tracking-[0.3em]" style={{ color: '#ffd54a', textShadow: '0 0 12px #ffd54a90' }}>
              {'★'.repeat(earned)}<span className="text-white/15">{'★'.repeat(3 - earned)}</span>
            </div>
            {reward && <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 italic max-w-[300px]">{reward}</p>}
            <div className="flex gap-2 mt-1">
              {kind === 'endless' && (
                <button onClick={openEndless} className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-4 py-2 rounded-sm" style={{ boxShadow: '0 0 16px #37e6ff80' }}>
                  new machine →
                </button>
              )}
              <button onClick={toMap} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#04040a] bg-[#54ff9e] hover:bg-[#7dffb8] px-5 py-2 rounded-sm" style={{ boxShadow: '0 0 18px #54ff9e80' }}>
                ← the network
              </button>
            </div>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#04040a]/70 rounded-md">
            <div className="font-mono text-[#ff5d9e] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #ff5d9e' }}>The dark wins</div>
            <div className="text-[10px] font-mono text-[#7fd8e6]/50">out of charge</div>
            <button onClick={retry} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#04040a] bg-[#ff5d9e] hover:bg-[#ff86b4] px-5 py-2 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #ff5d9e80' }}>
              try again
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[480px] flex items-center justify-between mt-4">
        <button onClick={reset} className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/45 hover:text-[#37e6ff] font-mono">reset</button>
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">tap to turn · keep each colour pure</p>
      </div>

      <style jsx>{`
        .rk-crt {
          background:
            radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.55) 100%),
            repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.18) 3px, rgba(0, 0, 0, 0) 4px);
          animation: rk-flicker 4.5s infinite steps(60);
          mix-blend-mode: multiply;
        }
        @keyframes rk-flicker {
          0%, 97%, 100% { opacity: 1; }
          98% { opacity: 0.92; }
          99% { opacity: 0.97; }
        }
      `}</style>
    </div>
  )
}

// ── drawing ───────────────────────────────────────────────────────────────────
function drawCell(ctx: CanvasRenderingContext2D, cell: Cell, r: number, c: number, sv: Solve, t: number) {
  const cx = c * CELL + CELL / 2
  const cy = r * CELL + CELL / 2
  const open = openSides(cell)
  const key = `${r},${c}`
  const powered = sv.powered.has(key)
  const h = sv.hue.get(key)
  const pulse = 0.75 + 0.25 * Math.sin(t * 3 + (r + c) * 0.6)

  const wireColor =
    cell.role === 'source' ? HUE[cell.hue!] : powered ? (h === 'mixed' ? MIX : HUE[h as Hue]) : DARK
  const glow = powered || cell.role === 'source'

  for (let d = 0; d < 4; d++) {
    if (!(open & (1 << d))) continue
    const ex = cx + (SIDE_DX[d] * CELL) / 2
    const ey = cy + (SIDE_DY[d] * CELL) / 2
    if (glow) {
      ctx.strokeStyle = wireColor
      ctx.globalAlpha = 0.2 * pulse
      ctx.lineWidth = 11
      ctx.shadowBlur = 0
      seg(ctx, cx, cy, ex, ey)
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = wireColor
    ctx.lineWidth = glow ? 3.2 : 2.4
    ctx.shadowBlur = glow ? 12 : 0
    ctx.shadowColor = wireColor
    seg(ctx, cx, cy, ex, ey)
    if (powered && h !== 'mixed' && cell.role !== 'source') {
      const ph = (t * 0.6 + (r * 3 + c) * 0.17) % 1
      ctx.globalAlpha = 1 - ph
      ctx.fillStyle = BEAD
      ctx.shadowBlur = 8
      ctx.shadowColor = BEAD
      dot(ctx, cx + (ex - cx) * ph, cy + (ey - cy) * ph, 2.6)
    }
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  if (cell.role === 'wire') {
    ctx.fillStyle = wireColor
    ctx.shadowBlur = glow ? 8 : 0
    ctx.shadowColor = wireColor
    dot(ctx, cx, cy, powered ? 3.4 : 2.6)
  } else if (cell.role === 'source') {
    ctx.fillStyle = HUE[cell.hue!]
    ctx.shadowBlur = 16
    ctx.shadowColor = HUE[cell.hue!]
    diamond(ctx, cx, cy, 9 * (0.9 + 0.1 * pulse))
  } else if (cell.role === 'core') {
    const want = HUE[cell.hue!]
    const litCore = sv.coresLit.has(key)
    ctx.strokeStyle = want
    ctx.lineWidth = litCore ? 3 : 2
    ctx.globalAlpha = litCore ? 1 : 0.4
    ctx.shadowBlur = litCore ? 16 * pulse : 0
    ctx.shadowColor = want
    ring(ctx, cx, cy, litCore ? 11 + pulse * 1.6 : 10)
    if (litCore) {
      ctx.fillStyle = want
      ctx.globalAlpha = 0.18 * pulse
      dot(ctx, cx, cy, 9)
    }
    ctx.globalAlpha = 1
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
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
}
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill()
}
