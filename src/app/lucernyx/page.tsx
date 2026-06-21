'use client'

// LUCERNYX — the lantern Ancient who keeps the light. A turn-based board of rekindling:
// slide your light diagonally, JUMP an adjacent grey into the empty square beyond and it
// flips to your colour and stays put (you convert material, you never take it). Multi-jump
// flips an arc — the light punches through a line and rekindles every grey it passes. Run a
// piece to the far home rank and it lights a torch + ascends; first to 3 torches wins. The
// Silt warms as you win. You are light (bottom); the Dying (grey) answers. Sim in lib/lucernyx.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeBoard, legalMoves, apply, aiMove, countPieces,
  SIZE, TORCHES_TO_WIN, idx, rowOf, colOf, homeRank, isDark,
  type Board, type Move, type Owner,
} from './lib/lucernyx'
import { sfx } from './lib/sfx'

const ATHER = '#37e6ff'
const HOT = '#e8feff'
const GREY = '#7c8696'
const GREY_CORE = '#b9c2cf'
const VIOLET = '#c86bff'
const WARM = '#ffb86b'

const HOP_MS = 150 // a single jump hop
const SLIDE_MS = 190 // a simple slide
const ASCEND_MS = 340 // the torch float-up

interface Anim {
  from: number
  steps: number[] // landing squares in order
  converts: number[] // converts[k] is the grey jumped on hop k (empty for a slide)
  torch: boolean
  owner: Owner
  t0: number
  hopMs: number
  hopsTime: number
  dur: number
}

// static drifting embers (seeded; positions in 0..1 of the board)
const EMBERS = (() => {
  const r = mulberry32(7)
  return Array.from({ length: 24 }, () => ({ x: r(), y: r(), s: 0.6 + r() * 1.6, sp: 0.01 + r() * 0.03, p: r() * 6.28 }))
})()

export default function LucernyxPage() {
  useNoScroll()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [board, setBoard] = useState<Board>(() => makeBoard())
  const [sel, setSel] = useState<number | null>(null)
  const [animActive, setAnimActive] = useState(false)
  const [muted, setMuted] = useState(false)
  const [flash, setFlash] = useState<Owner | null>(null)

  const animRef = useRef<Anim | null>(null)
  const startMoveRef = useRef<(pre: Board, m: Move) => void>(() => {})
  const boardRef = useRef(board); boardRef.current = board
  const selRef = useRef(sel); selRef.current = sel
  const seedRef = useRef(1)
  const timers = useRef<number[]>([])
  const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  // moves from the selected square, best per destination + the greys they'd rekindle
  const { targets, hints } = useMemo(() => {
    const targets = new Map<number, Move>()
    const hints = new Set<number>()
    if (sel !== null && board.turn === 'light' && !board.over) {
      for (const m of legalMoves(board, 'light').filter((x) => x.from === sel)) {
        const prev = targets.get(m.to)
        if (!prev || m.converts.length > prev.converts.length) targets.set(m.to, m)
        for (const s of m.converts) hints.add(s)
      }
    }
    return { targets, hints }
  }, [board, sel])
  const targetsRef = useRef(targets); targetsRef.current = targets
  const hintsRef = useRef(hints); hintsRef.current = hints

  const newGame = useCallback(() => {
    clearTimers(); animRef.current = null
    setAnimActive(false); setFlash(null); setSel(null); setBoard(makeBoard())
  }, [])

  const finishMove = useCallback((pre: Board, m: Move) => {
    animRef.current = null
    setAnimActive(false)
    const next = apply(pre, m)
    if (m.torch) { setFlash(pre.turn); after(700, () => setFlash(null)) }
    setBoard(next)
    if (next.over) {
      after(140, () => sfx.play(next.winner === 'grey' ? 'lose' : 'win'))
    } else if (next.turn === 'grey') {
      after(340, () => {
        const mv = aiMove(next, mulberry32((seedRef.current++ * 2654435761) >>> 0))
        if (mv) startMoveRef.current(next, mv)
      })
    }
  }, [])

  const startMove = useCallback((pre: Board, m: Move) => {
    const isJump = m.converts.length > 0
    const hopMs = isJump ? HOP_MS : SLIDE_MS
    const hopsTime = m.path.length * hopMs
    const dur = hopsTime + (m.torch ? ASCEND_MS : 0)
    animRef.current = { from: m.from, steps: m.path, converts: m.converts, torch: m.torch, owner: pre.turn, t0: performance.now(), hopMs, hopsTime, dur }
    setAnimActive(true); setSel(null)
    sfx.ensure()
    if (!isJump) sfx.play('slide')
    else m.converts.forEach((_, k) => after((k + 0.5) * hopMs, () => sfx.play('convert')))
    if (m.torch) after(hopsTime, () => sfx.play('torch'))
    after(dur, () => finishMove(pre, m))
  }, [finishMove])
  startMoveRef.current = startMove

  const onClick = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (animActive || board.over || board.turn !== 'light') return
    const rect = e.currentTarget.getBoundingClientRect()
    const cell = rect.width / SIZE
    const c = Math.floor((e.clientX - rect.left) / cell)
    const r = Math.floor((e.clientY - rect.top) / cell)
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return
    const sq = idx(r, c)
    const mv = targets.get(sq)
    if (sel !== null && mv) { startMove(board, mv); return }
    if (board.cells[sq] === 'light') { setSel(sel === sq ? null : sq); return }
    setSel(null)
  }, [animActive, board, sel, targets, startMove])

  useEffect(() => () => clearTimers(), [])

  // single persistent render loop — reads refs so animation runs between React renders
  useEffect(() => {
    let raf = 0
    const draw = (ts: number) => {
      const cv = canvasRef.current
      if (cv) render(cv, boardRef.current, selRef.current, targetsRef.current, hintsRef.current, animRef.current, ts)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const lt = board.torches.light, gt = board.torches.grey
  const lp = countPieces(board, 'light'), gp = countPieces(board, 'grey')
  const turnLabel = board.over ? 'the board sleeps' : animActive ? '…' : board.turn === 'light' ? 'your move' : 'the Dying stirs'
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); setMuted(m) }

  return (
    <ArcadeCabinet accent="#37e6ff" wall={1} maxWidth={440}>
      <div className="w-full max-w-[440px] flex items-center justify-between mb-3">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">&#8592; arcade</Link>
        <div className="text-center">
          <div className="font-mono text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Lucernyx</div>
          <div className="text-[9px] text-[#7fd8e6]/40 font-mono tracking-[0.2em] uppercase mt-0.5">keeper of the light</div>
        </div>
        <div className="flex items-center gap-2 w-16 justify-end">
          <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">{muted ? 'son' : 'snd'}</button>
          <button onClick={newGame} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">new</button>
        </div>
      </div>

      <div className="w-full max-w-[440px] mb-2 flex items-center justify-between font-mono text-[10px]">
        <Torches who="light" n={lt} pieces={lp} active={board.turn === 'light' && !board.over} flash={flash === 'light'} />
        <span className="tracking-[0.25em] uppercase text-[#7fd8e6]/45">{turnLabel}</span>
        <Torches who="grey" n={gt} pieces={gp} active={board.turn === 'grey' && !board.over} flash={flash === 'grey'} />
      </div>

      <div className="relative w-full max-w-[440px]" style={{ aspectRatio: '1 / 1' }}>
        <canvas ref={canvasRef} onPointerDown={onClick} className="w-full h-full block touch-none rounded-md cursor-pointer" />
        <div className="pointer-events-none absolute inset-0 rounded-md lx-crt" />

        {board.over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#04040a]/78 rounded-md text-center px-6">
            <div className="font-mono text-lg tracking-[0.3em] uppercase" style={{ color: board.winner === 'grey' ? VIOLET : ATHER, textShadow: `0 0 14px ${board.winner === 'grey' ? VIOLET : ATHER}` }}>
              {board.winner === 'light' ? 'The light holds' : board.winner === 'grey' ? 'The grey takes the field' : 'A held breath'}
            </div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 italic max-w-[280px]">
              {board.winner === 'light' ? 'Three torches lit. The Silt remembers warmth.'
                : board.winner === 'grey' ? 'The dark drank the lanterns. Kindle again.'
                : 'Neither could light the third. The board sleeps.'}
            </p>
            <button onClick={newGame} className="font-mono text-[11px] tracking-[0.25em] uppercase text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-6 py-2 rounded-sm mt-1" style={{ boxShadow: '0 0 18px #37e6ff80' }}>kindle again →</button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[440px] flex items-center justify-between mt-4">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/45 hover:text-[#37e6ff] font-mono">arcade</Link>
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">slide · jump to rekindle · 3 torches wins</p>
      </div>

      <style jsx>{`
        .lx-crt {
          background:
            radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.45) 100%),
            repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.11) 3px, rgba(0,0,0,0) 4px);
          animation: lx-flicker 5s infinite steps(60);
          mix-blend-mode: multiply;
        }
        @keyframes lx-flicker { 0%,97%,100% { opacity: 1; } 98% { opacity: 0.95; } 99% { opacity: 0.98; } }
      `}</style>
    </ArcadeCabinet>
  )
}

function Torches({ who, n, pieces, active, flash }: { who: 'light' | 'grey'; n: number; pieces: number; active: boolean; flash: boolean }) {
  const lit = who === 'light' ? ATHER : VIOLET
  const pips = Array.from({ length: TORCHES_TO_WIN }).map((_, i) => {
    const on = i < n
    const newest = flash && i === n - 1
    return (
      <span key={i} className="w-2.5 h-2.5 rounded-full transition-all" style={{
        background: on ? lit : 'transparent',
        border: `1px solid ${lit}${on ? '' : '55'}`,
        boxShadow: on ? `0 0 ${newest ? 14 : 7}px ${lit}` : 'none',
        transform: newest ? 'scale(1.4)' : 'scale(1)',
      }} />
    )
  })
  return (
    <div className={`flex items-center gap-1.5 ${active ? '' : 'opacity-55'}`}>
      {who === 'grey' && <span className="text-[#7fd8e6]/35 tabular-nums">×{pieces}</span>}
      <div className="flex gap-1">{pips}</div>
      {who === 'light' && <span className="text-[#7fd8e6]/35 tabular-nums">×{pieces}</span>}
    </div>
  )
}

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

function render(
  canvas: HTMLCanvasElement, b: Board, sel: number | null,
  targets: Map<number, Move>, hints: Set<number>, anim: Anim | null, ts: number,
) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const cw = canvas.clientWidth || 440
  const ch = canvas.clientHeight || 440
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) { canvas.width = cw * dpr; canvas.height = ch * dpr }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cell = cw / SIZE
  const t = ts / 1000
  const pulse = 0.5 + 0.5 * Math.sin(t * 3)

  const warm = b.torches.light / TORCHES_TO_WIN // the Silt warms as the light wins
  const chill = b.torches.grey / TORCHES_TO_WIN

  // ── backdrop: the dark Silt, warming with the light's torches ──────────────
  ctx.fillStyle = '#04040a'
  ctx.fillRect(0, 0, cw, ch)
  const glow = ctx.createRadialGradient(cw / 2, ch / 2, cell, cw / 2, ch / 2, cw * 0.8)
  glow.addColorStop(0, WARM + hex2(0.06 + 0.36 * warm))
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, cw, ch)
  if (chill > 0) { // the dark gaining ground — a cold violet creep from the edges
    const v = ctx.createRadialGradient(cw / 2, ch / 2, cw * 0.35, cw / 2, ch / 2, cw * 0.72)
    v.addColorStop(0, 'transparent')
    v.addColorStop(1, VIOLET + hex2(0.22 * chill))
    ctx.fillStyle = v
    ctx.fillRect(0, 0, cw, ch)
  }
  // drifting embers (more, brighter, as warmth rises)
  for (const e of EMBERS) {
    const ey = (e.y - ((t * e.sp) % 1) + 1) % 1
    const x = e.x * cw, y = ey * ch
    ctx.globalAlpha = (0.04 + 0.3 * warm) * (0.5 + 0.5 * Math.sin(t * 1.4 + e.p))
    ctx.fillStyle = WARM
    ctx.beginPath(); ctx.arc(x, y, e.s, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1

  // ── squares (slightly translucent so the warmth + embers bleed through) ────
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const x = c * cell, y = r * cell
      ctx.fillStyle = isDark(r, c) ? 'rgba(12,16,24,0.80)' : 'rgba(7,7,16,0.86)'
      ctx.fillRect(x, y, cell, cell)
      if (isDark(r, c) && (r === homeRank('light') || r === homeRank('grey'))) {
        ctx.fillStyle = (r === homeRank('light') ? '#37e6ff' : '#c86bff') + '14'
        ctx.fillRect(x, y, cell, cell)
      }
    }
  }
  ctx.strokeStyle = 'rgba(55,230,255,0.06)'
  ctx.lineWidth = 1
  for (let i = 0; i <= SIZE; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, ch); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(cw, i * cell); ctx.stroke()
  }

  const cx = (i: number) => colOf(i) * cell + cell / 2
  const cy = (i: number) => rowOf(i) * cell + cell / 2
  const R = cell * 0.34

  // selection + move affordances (hidden while a move animates)
  if (!anim) {
    if (sel !== null) {
      ctx.strokeStyle = ATHER; ctx.lineWidth = 2
      ctx.shadowColor = ATHER; ctx.shadowBlur = 12
      ctx.strokeRect(colOf(sel) * cell + 3, rowOf(sel) * cell + 3, cell - 6, cell - 6)
      ctx.shadowBlur = 0
    }
    for (const s of hints) {
      ctx.strokeStyle = VIOLET; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.45 + 0.4 * pulse
      ctx.beginPath(); ctx.arc(cx(s), cy(s), R + 5, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  // ── flip progress + mover position during an animation ─────────────────────
  const flipped = new Set<number>()
  let moverPos: { x: number; y: number; alpha: number } | null = null
  if (anim) {
    const el = ts - anim.t0
    // a grey converts as the hop passes its midpoint
    for (let k = 0; k < anim.converts.length; k++) {
      if (el >= (k + 0.5) * anim.hopMs) flipped.add(anim.converts[k])
    }
    if (el < anim.hopsTime) {
      const hop = Math.min(anim.steps.length - 1, Math.floor(el / anim.hopMs))
      const segStart = hop === 0 ? anim.from : anim.steps[hop - 1]
      const segEnd = anim.steps[hop]
      const fr = easeInOut((el - hop * anim.hopMs) / anim.hopMs)
      const x = cx(segStart) + (cx(segEnd) - cx(segStart)) * fr
      let y = cy(segStart) + (cy(segEnd) - cy(segStart)) * fr
      if (anim.converts.length > 0) y -= Math.sin(fr * Math.PI) * cell * 0.3 // hop arc on jumps
      moverPos = { x, y, alpha: 1 }
    } else {
      // torch ascend: float up + fade from the final square
      const ap = Math.min(1, (el - anim.hopsTime) / ASCEND_MS)
      const last = anim.steps[anim.steps.length - 1]
      moverPos = { x: cx(last), y: cy(last) - ap * cell * 0.9, alpha: 1 - ap }
    }
  }

  // ── pieces ─────────────────────────────────────────────────────────────────
  for (let i = 0; i < b.cells.length; i++) {
    let o = b.cells[i]
    if (!o) continue
    if (anim && i === anim.from) continue // the mover is drawn separately
    if (flipped.has(i)) o = anim!.owner // rekindled mid-animation
    drawPiece(ctx, cx(i), cy(i), R, o, 1)
  }
  if (moverPos) {
    // a bright streak trailing the rekindling light
    if (anim && anim.converts.length > 0) {
      ctx.strokeStyle = HOT; ctx.globalAlpha = 0.25 * moverPos.alpha; ctx.lineWidth = R
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(cx(anim.from), cy(anim.from)); ctx.lineTo(moverPos.x, moverPos.y); ctx.stroke()
      ctx.globalAlpha = 1
    }
    drawPiece(ctx, moverPos.x, moverPos.y, R * (1 + 0.12 * (anim?.converts.length ? 1 : 0)), anim!.owner, moverPos.alpha)
  }

  // move-target dots (hidden during anim)
  if (!anim) {
    for (const [sq, m] of targets) {
      const conv = m.converts.length > 0
      ctx.fillStyle = conv ? VIOLET : ATHER
      ctx.globalAlpha = 0.55 + 0.45 * pulse
      ctx.shadowColor = conv ? VIOLET : ATHER; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.arc(cx(sq), cy(sq), conv ? 7 : 5.5, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0; ctx.globalAlpha = 1
    }
  }
}

function drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, o: Owner, alpha: number) {
  ctx.globalAlpha = alpha
  if (o === 'light') {
    ctx.shadowColor = ATHER; ctx.shadowBlur = 16
    const g = ctx.createRadialGradient(x, y, 1, x, y, R)
    g.addColorStop(0, HOT); g.addColorStop(0.55, ATHER); g.addColorStop(1, '#0e6c84')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
  } else {
    ctx.shadowColor = GREY; ctx.shadowBlur = 7
    ctx.fillStyle = '#12151c'
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = GREY; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = GREY_CORE
    ctx.beginPath(); ctx.arc(x, y, R * 0.3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}

// 0..1 alpha → 2-digit hex suffix for a #rrggbb color
function hex2(a: number): string {
  return Math.max(0, Math.min(255, Math.round(a * 255))).toString(16).padStart(2, '0')
}
