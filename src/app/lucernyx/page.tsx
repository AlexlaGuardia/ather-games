'use client'

// LUCERNYX — the lantern Ancient who keeps the light. A turn-based board of rekindling:
// slide your light diagonally, JUMP an adjacent grey into the empty square beyond and it
// flips to your colour and stays put (you never take material, you convert it). Multi-jump
// flips an arc. Run a piece to the far home rank and it lights a torch + ascends — first to
// 3 torches wins. You are light (bottom); the Dying (grey) answers. Core sim in lib/lucernyx.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  makeBoard, legalMoves, apply, aiMove, countPieces,
  SIZE, TORCHES_TO_WIN, idx, rowOf, colOf, homeRank, isDark,
  type Board, type Move,
} from './lib/lucernyx'

const ATHER = '#37e6ff'
const HOT = '#e8feff'
const GREY = '#7c8696'
const GREY_CORE = '#b9c2cf'
const VIOLET = '#c86bff'

export default function LucernyxPage() {
  useNoScroll()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [board, setBoard] = useState<Board>(() => makeBoard())
  const [sel, setSel] = useState<number | null>(null)
  const [thinking, setThinking] = useState(false)
  const seedRef = useRef(1)
  const tRef = useRef(0)

  // moves available from the currently-selected square, keyed by destination (best per square)
  const selMoves = sel === null ? [] : legalMoves(board, 'light').filter((m) => m.from === sel)
  const targets = new Map<number, Move>()
  for (const m of selMoves) {
    const prev = targets.get(m.to)
    if (!prev || m.converts.length > prev.converts.length) targets.set(m.to, m)
  }
  const convertHints = new Set<number>()
  for (const m of selMoves) for (const s of m.converts) convertHints.add(s)

  const newGame = useCallback(() => { setBoard(makeBoard()); setSel(null); setThinking(false) }, [])

  // the Dying answers after a short beat
  const greyTurn = useCallback((b: Board) => {
    setThinking(true)
    window.setTimeout(() => {
      const m = aiMove(b, mulberry32((seedRef.current++ * 2654435761) >>> 0))
      const after = m ? apply(b, m) : b
      setBoard(after)
      setThinking(false)
    }, 480)
  }, [])

  const playLight = useCallback((m: Move) => {
    const after = apply(board, m)
    setBoard(after)
    setSel(null)
    if (!after.over) greyTurn(after)
  }, [board, greyTurn])

  // click → board square
  const onClick = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (board.over || thinking || board.turn !== 'light') return
    const rect = e.currentTarget.getBoundingClientRect()
    const cell = rect.width / SIZE
    const c = Math.floor((e.clientX - rect.left) / cell)
    const r = Math.floor((e.clientY - rect.top) / cell)
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return
    const sq = idx(r, c)
    // tapping a highlighted destination commits the move
    const mv = targets.get(sq)
    if (sel !== null && mv) { playLight(mv); return }
    // tapping one of your pieces selects it (toggles off if re-tapped)
    if (board.cells[sq] === 'light') { setSel(sel === sq ? null : sq); return }
    setSel(null)
  }, [board, thinking, sel, targets, playLight])

  // ── render ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0
    const draw = (ts: number) => {
      const canvas = canvasRef.current
      if (canvas) render(canvas, board, sel, targets, convertHints, ts)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  })

  const lt = board.torches.light, gt = board.torches.grey
  const lp = countPieces(board, 'light'), gp = countPieces(board, 'grey')
  const turnLabel = board.over ? 'over' : board.turn === 'light' ? 'your move' : 'the Dying stirs'

  return (
    <div className="min-h-screen bg-[#04040a] text-[#9fd6e0] flex flex-col items-center px-4 py-6 select-none">
      <div className="w-full max-w-[440px] flex items-center justify-between mb-3">
        <Link href="/arcade" className="text-[10px] tracking-[0.25em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono">&#8592; arcade</Link>
        <div className="text-center">
          <div className="font-mono text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Lucernyx</div>
          <div className="text-[9px] text-[#7fd8e6]/40 font-mono tracking-[0.2em] uppercase mt-0.5">keeper of the light</div>
        </div>
        <button onClick={newGame} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">new</button>
      </div>

      {/* torch tracks */}
      <div className="w-full max-w-[440px] mb-2 flex items-center justify-between font-mono text-[10px]">
        <Torches who="light" n={lt} pieces={lp} active={board.turn === 'light' && !board.over} />
        <span className="tracking-[0.25em] uppercase text-[#7fd8e6]/45">{turnLabel}</span>
        <Torches who="grey" n={gt} pieces={gp} active={board.turn === 'grey' && !board.over} />
      </div>

      <div className="relative w-full max-w-[440px]" style={{ aspectRatio: '1 / 1' }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onClick}
          className="w-full h-full block touch-none rounded-md cursor-pointer"
        />
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
    </div>
  )
}

function Torches({ who, n, pieces, active }: { who: 'light' | 'grey'; n: number; pieces: number; active: boolean }) {
  const lit = who === 'light' ? ATHER : VIOLET
  return (
    <div className={`flex items-center gap-1.5 ${active ? '' : 'opacity-55'}`}>
      {who === 'grey' && <span className="text-[#7fd8e6]/35 tabular-nums">×{pieces}</span>}
      <div className="flex gap-1">
        {Array.from({ length: TORCHES_TO_WIN }).map((_, i) => (
          <span key={i} className="w-2.5 h-2.5 rounded-full" style={{
            background: i < n ? lit : 'transparent',
            border: `1px solid ${lit}${i < n ? '' : '55'}`,
            boxShadow: i < n ? `0 0 7px ${lit}` : 'none',
          }} />
        ))}
      </div>
      {who === 'light' && <span className="text-[#7fd8e6]/35 tabular-nums">×{pieces}</span>}
    </div>
  )
}

function render(
  canvas: HTMLCanvasElement, b: Board, sel: number | null,
  targets: Map<number, Move>, convertHints: Set<number>, ts: number,
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

  ctx.fillStyle = '#04040a'
  ctx.fillRect(0, 0, cw, ch)

  // squares
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const x = c * cell, y = r * cell
      const dark = isDark(r, c)
      ctx.fillStyle = dark ? '#0c1018' : '#070710'
      ctx.fillRect(x, y, cell, cell)
      // faintly glow the two scoring ranks (the home rank each side runs toward)
      if (dark && (r === homeRank('light') || r === homeRank('grey'))) {
        ctx.fillStyle = (r === homeRank('light') ? '#37e6ff' : '#c86bff') + '14'
        ctx.fillRect(x, y, cell, cell)
      }
    }
  }
  // grid lines
  ctx.strokeStyle = 'rgba(55,230,255,0.06)'
  ctx.lineWidth = 1
  for (let i = 0; i <= SIZE; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, ch); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(cw, i * cell); ctx.stroke()
  }

  const cx = (i: number) => colOf(i) * cell + cell / 2
  const cy = (i: number) => rowOf(i) * cell + cell / 2
  const R = cell * 0.34

  // selected-square frame
  if (sel !== null) {
    ctx.strokeStyle = ATHER
    ctx.lineWidth = 2
    ctx.shadowColor = ATHER; ctx.shadowBlur = 12
    ctx.strokeRect(colOf(sel) * cell + 3, rowOf(sel) * cell + 3, cell - 6, cell - 6)
    ctx.shadowBlur = 0
  }

  // convert hints — greys that would be rekindled by the selected piece's moves
  for (const s of convertHints) {
    ctx.strokeStyle = VIOLET
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.45 + 0.4 * pulse
    ctx.beginPath(); ctx.arc(cx(s), cy(s), R + 5, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = 1
  }

  // pieces
  for (let i = 0; i < b.cells.length; i++) {
    const o = b.cells[i]
    if (!o) continue
    const x = cx(i), y = cy(i)
    if (o === 'light') {
      ctx.shadowColor = ATHER; ctx.shadowBlur = 16
      const g = ctx.createRadialGradient(x, y, 1, x, y, R)
      g.addColorStop(0, HOT); g.addColorStop(0.55, ATHER); g.addColorStop(1, '#0e6c84')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
    } else {
      // the Dying — a hollow, guttered light
      ctx.shadowColor = GREY; ctx.shadowBlur = 7
      ctx.fillStyle = '#12151c'
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = GREY; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = GREY_CORE
      ctx.beginPath(); ctx.arc(x, y, R * 0.3, 0, Math.PI * 2); ctx.fill()
    }
  }

  // move targets — glowing landing dots (brighter if the move converts)
  for (const [sq, m] of targets) {
    const x = cx(sq), y = cy(sq)
    const conv = m.converts.length > 0
    ctx.fillStyle = conv ? VIOLET : ATHER
    ctx.globalAlpha = 0.55 + 0.45 * pulse
    ctx.shadowColor = conv ? VIOLET : ATHER; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(x, y, conv ? 7 : 5.5, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
  }
}
