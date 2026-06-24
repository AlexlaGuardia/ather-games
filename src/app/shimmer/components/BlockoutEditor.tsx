'use client'

// Blockout Editor — lightweight in-game map LAYOUT tool (owner-only popup).
// Philosophy: blockout != art. You greybox terrain shape fast with a handful of
// semantic brushes; the "make it pretty" pass happens later at the TILE-ART level
// (Edit Tile), which propagates everywhere without redoing the layout.
//
// Renders flat colored cells (NOT real tile art) so it's cheap on a weak machine.
// Reads the live zone grid from game memory; saves the grid ONLY back to source
// via /shimmer/save-map (no tiles/nodes/furniture/warps in the body => those are
// left untouched). A rebuild is needed to walk the new layout in-game.

import { useRef, useEffect, useState, useCallback } from 'react'

type Brush = { id: string; label: string; tile: number; color: string }

// Semantic brush -> real tile id (see world/tiles.ts):
//   0 Grass · 3 Dirt · 8 Deep Water (solid) · 17 Border (solid) · 14 Warp marker
const BRUSHES: Brush[] = [
  { id: 'ground', label: 'Ground', tile: 0, color: '#5b8f4a' },
  { id: 'path', label: 'Path', tile: 3, color: '#b58a52' },
  { id: 'water', label: 'Water', tile: 8, color: '#3a6ea5' },
  { id: 'wall', label: 'Wall', tile: 17, color: '#6a6a74' },
  { id: 'warp', label: 'Warp', tile: 14, color: '#c061d4' },
  { id: 'erase', label: 'Erase', tile: 0, color: '#23232a' },
]

// Display color per base tile id. Unknown (existing detailed) tiles -> neutral,
// so a loaded zone still shows its structure as "occupied".
const TILE_COLOR: Record<number, string> = {
  0: '#5b8f4a', 1: '#5b8f4a', 3: '#b58a52', 8: '#3a6ea5', 17: '#6a6a74', 14: '#c061d4',
}
const OTHER_COLOR = '#454550'

const baseTile = (v: number) => v & 0xff // strip rotation bits (tileIdx | rot<<8)
const colorFor = (v: number) => TILE_COLOR[baseTile(v)] ?? OTHER_COLOR

const clone = (g: number[][]) => g.map(r => r.slice())

function resizeGrid(g: number[][], cols: number, rows: number): number[][] {
  const out: number[][] = []
  for (let y = 0; y < rows; y++) {
    const row: number[] = []
    for (let x = 0; x < cols; x++) row.push(g[y]?.[x] ?? 0)
    out.push(row)
  }
  return out
}

export default function BlockoutEditor({
  open,
  zoneId,
  zoneName,
  initialGrid,
  onClose,
}: {
  open: boolean
  zoneId: string
  zoneName: string
  initialGrid: number[][]
  onClose: () => void
}) {
  const gridRef = useRef<number[][]>([[0]])
  const cpRef = useRef(10) // cell pixels, fit-to-container
  const [dims, setDims] = useState({ cols: 1, rows: 1 })
  const [brush, setBrush] = useState('ground')
  const brushRef = useRef('ground')
  const [version, setVersion] = useState(0) // bump to force a full redraw
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const undoRef = useRef<number[][][]>([])
  const [canUndo, setCanUndo] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const painting = useRef(false)

  useEffect(() => { brushRef.current = brush }, [brush])

  // (Re)load from the live zone grid each time the popup opens.
  useEffect(() => {
    if (!open) return
    const g = initialGrid && initialGrid.length ? clone(initialGrid) : [[0]]
    gridRef.current = g
    undoRef.current = []
    setCanUndo(false)
    setStatus('idle')
    setDims({ cols: g[0]?.length ?? 1, rows: g.length })
    setVersion(v => v + 1)
  }, [open, initialGrid])

  // Fit the whole map into the available box (blockout = bird's-eye, no panning).
  const recomputeCellPx = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const g = gridRef.current
    const cols = g[0]?.length ?? 1
    const rows = g.length
    const maxW = wrap.clientWidth - 4
    const maxH = Math.min(window.innerHeight * 0.52, 560)
    const cp = Math.max(3, Math.min(30, Math.floor(Math.min(maxW / cols, maxH / rows))))
    cpRef.current = cp
  }, [])

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = gridRef.current
    const cols = g[0]?.length ?? 1
    const rows = g.length
    const cp = cpRef.current
    canvas.width = cols * cp
    canvas.height = rows * cp
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = colorFor(g[y][x])
        ctx.fillRect(x * cp, y * cp, cp, cp)
      }
    }
    if (cp >= 6) {
      ctx.strokeStyle = 'rgba(0,0,0,0.16)'
      ctx.lineWidth = 1
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
          ctx.strokeRect(x * cp + 0.5, y * cp + 0.5, cp - 1, cp - 1)
    }
  }, [])

  // Full redraw on open / resize / dims change.
  useEffect(() => {
    if (!open) return
    recomputeCellPx()
    drawAll()
    const onResize = () => { recomputeCellPx(); drawAll() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, version, recomputeCellPx, drawAll])

  const drawCell = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cp = cpRef.current
    ctx.fillStyle = colorFor(gridRef.current[y][x])
    ctx.fillRect(x * cp, y * cp, cp, cp)
    if (cp >= 6) {
      ctx.strokeStyle = 'rgba(0,0,0,0.16)'
      ctx.lineWidth = 1
      ctx.strokeRect(x * cp + 0.5, y * cp + 0.5, cp - 1, cp - 1)
    }
  }

  const cellFromEvent = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const cp = cpRef.current
    const x = Math.floor((e.clientX - rect.left) / cp)
    const y = Math.floor((e.clientY - rect.top) / cp)
    const g = gridRef.current
    if (x < 0 || y < 0 || y >= g.length || x >= g[0].length) return null
    return { x, y }
  }

  const paintAt = (x: number, y: number) => {
    const b = BRUSHES.find(br => br.id === brushRef.current)!
    if (gridRef.current[y][x] === b.tile) return
    gridRef.current[y][x] = b.tile
    drawCell(x, y)
    if (status !== 'idle') setStatus('idle')
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    // snapshot for undo (one entry per stroke)
    undoRef.current.push(clone(gridRef.current))
    if (undoRef.current.length > 30) undoRef.current.shift()
    setCanUndo(true)
    painting.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const c = cellFromEvent(e)
    if (c) paintAt(c.x, c.y)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!painting.current) return
    const c = cellFromEvent(e)
    if (c) paintAt(c.x, c.y)
  }
  const onPointerUp = () => { painting.current = false }

  const undo = () => {
    const prev = undoRef.current.pop()
    if (!prev) return
    gridRef.current = prev
    setCanUndo(undoRef.current.length > 0)
    setDims({ cols: prev[0]?.length ?? 1, rows: prev.length })
    recomputeCellPx()
    drawAll()
  }

  const applyResize = (cols: number, rows: number) => {
    cols = Math.max(4, Math.min(160, Math.round(cols)))
    rows = Math.max(4, Math.min(160, Math.round(rows)))
    undoRef.current.push(clone(gridRef.current))
    setCanUndo(true)
    gridRef.current = resizeGrid(gridRef.current, cols, rows)
    setDims({ cols, rows })
    setVersion(v => v + 1)
    setStatus('idle')
  }

  const save = async () => {
    setStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid: gridRef.current, mapId: zoneId }),
      })
      setStatus(res.ok ? 'saved' : 'error')
    } catch {
      setStatus('error')
    }
  }

  // keyboard: 1-6 brushes, Esc close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      const idx = parseInt(e.key, 10) - 1
      if (idx >= 0 && idx < BRUSHES.length) setBrush(BRUSHES[idx].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-3xl max-h-[94vh] flex flex-col rounded-2xl border border-[#d4a843]/25 bg-[#13131a] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="min-w-0">
            <div className="text-sm font-display text-text truncate">Blockout · {zoneName}</div>
            <div className="text-[11px] text-text-faint/40">{dims.cols} × {dims.rows} tiles · layout only, art comes later</div>
          </div>
          <button onClick={onClose} className="px-2.5 py-1 rounded-lg text-text-faint/60 hover:text-text hover:bg-white/5 text-lg leading-none">×</button>
        </div>

        {/* Brushes */}
        <div className="flex flex-wrap gap-1.5 px-3 py-2.5 border-b border-white/5">
          {BRUSHES.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setBrush(b.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-display border transition-all ${
                brush === b.id ? 'border-[#d4a843]/70 bg-[#d4a843]/15 text-text' : 'border-white/10 bg-white/[0.03] text-text-faint/60 hover:bg-white/5'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-sm border border-black/30" style={{ background: b.color }} />
              {b.label}
              <span className="text-text-faint/30 text-[10px] hidden sm:inline">{i + 1}</span>
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div ref={wrapRef} className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-3 bg-[#0c0c11]">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="touch-none rounded-md ring-1 ring-white/10"
            style={{ imageRendering: 'pixelated', cursor: 'crosshair' }}
          />
        </div>

        {/* Size + actions */}
        <div className="border-t border-white/5 px-3 py-2.5 space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-faint/40 font-display uppercase tracking-wider">Size</span>
            <Stepper label="W" value={dims.cols} onChange={c => applyResize(c, dims.rows)} />
            <Stepper label="H" value={dims.rows} onChange={r => applyResize(dims.cols, r)} />
            <div className="flex gap-1">
              {([['S', 24, 16], ['M', 48, 32], ['L', 80, 64]] as const).map(([lbl, c, r]) => (
                <button key={lbl} onClick={() => applyResize(c, r)}
                  className="px-2 py-1 rounded-md text-[11px] font-display border border-white/10 bg-white/[0.03] text-text-faint/60 hover:bg-white/5">
                  {lbl}
                </button>
              ))}
            </div>
            <button onClick={undo} disabled={!canUndo}
              className="ml-auto px-2.5 py-1 rounded-md text-[12px] font-display border border-white/10 bg-white/[0.03] text-text-faint/70 hover:bg-white/5 disabled:opacity-30">
              ↶ Undo
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={status === 'saving'}
              className="px-4 py-2 rounded-lg text-sm font-display bg-[#d4a843]/20 border border-[#d4a843]/50 text-[#f0d28a] hover:bg-[#d4a843]/30 disabled:opacity-50">
              {status === 'saving' ? 'Saving…' : 'Save layout'}
            </button>
            <span className="text-[12px] text-text-faint/45">
              {status === 'saved' ? 'Saved to source — ping Jin to build it live.'
                : status === 'error' ? 'Save failed — check the console.'
                : 'Saves the grid only. Walking it live needs a rebuild.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-text-faint/50 w-3">{label}</span>
      <button onClick={() => onChange(value - 4)} className="w-6 h-6 rounded-md border border-white/10 bg-white/[0.03] text-text-faint/70 hover:bg-white/5 leading-none">−</button>
      <span className="w-7 text-center text-[12px] font-display tabular-nums text-text">{value}</span>
      <button onClick={() => onChange(value + 4)} className="w-6 h-6 rounded-md border border-white/10 bg-white/[0.03] text-text-faint/70 hover:bg-white/5 leading-none">+</button>
    </div>
  )
}
