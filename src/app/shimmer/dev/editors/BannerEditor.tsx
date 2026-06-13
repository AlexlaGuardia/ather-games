'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import EditorShell from '../templates/EditorShell'

/* ── Terminal color palette ─────────────────────────────────── */
const PALETTE = [
  { hex: '', rich: '', label: 'Erase' },
  { hex: '#ffffff', rich: 'white', label: 'White' },
  { hex: '#ffff00', rich: 'yellow', label: 'Yellow' },
  { hex: '#d7af00', rich: 'gold3', label: 'Gold' },
  { hex: '#ff00ff', rich: 'magenta', label: 'Magenta' },
  { hex: '#af00ff', rich: 'purple', label: 'Purple' },
  { hex: '#00ffff', rich: 'cyan', label: 'Cyan' },
  { hex: '#ff0000', rich: 'red', label: 'Red' },
  { hex: '#00ff00', rich: 'green', label: 'Green' },
  { hex: '#5f87ff', rich: 'cornflower_blue', label: 'Blue' },
  { hex: '#af8700', rich: 'dark_goldenrod', label: 'DkGold' },
  { hex: '#808080', rich: 'grey50', label: 'Gray' },
]

const CELL = 18
const DEFAULT_W = 40
const DEFAULT_H = 16

/* ── Nearest Rich color name lookup ─────────────────────────── */
const RICH_COLORS: Record<string, string> = {
  '#ffffff': 'white', '#ffff00': 'yellow', '#d7af00': 'gold3',
  '#ff00ff': 'magenta', '#af00ff': 'purple', '#00ffff': 'cyan',
  '#ff0000': 'red', '#00ff00': 'green', '#5f87ff': 'cornflower_blue',
  '#af8700': 'dark_goldenrod', '#808080': 'grey50', '#ff5f00': 'orange_red1',
  '#d75f00': 'dark_orange3', '#ffd700': 'gold1', '#ff87af': 'hot_pink',
  '#87d7ff': 'sky_blue1', '#d700ff': 'dark_violet', '#afffff': 'pale_turquoise1',
  '#d7ff87': 'dark_olive_green1', '#ff8787': 'light_coral',
}

function hexToRich(hex: string): string {
  const lower = hex.toLowerCase()
  if (RICH_COLORS[lower]) return RICH_COLORS[lower]
  // Fallback: use Rich's hex format
  return lower
}

/* ── Half-block export ──────────────────────────────────────── */
function gridToRich(grid: number[], w: number, h: number, pal: typeof PALETTE): string {
  const lines: string[] = []
  for (let y = 0; y < h; y += 2) {
    const segs: { style: string; ch: string }[] = []
    for (let x = 0; x < w; x++) {
      const top = grid[y * w + x]
      const bot = y + 1 < h ? grid[(y + 1) * w + x] : 0
      let style: string, ch: string
      const tr = top > 0 ? hexToRich(pal[top].hex) : ''
      const br = bot > 0 ? hexToRich(pal[bot].hex) : ''
      if (top === 0 && bot === 0) { style = ''; ch = ' ' }
      else if (top > 0 && bot === 0) { style = tr; ch = '\u2580' }
      else if (top === 0 && bot > 0) { style = br; ch = '\u2584' }
      else if (top === bot) { style = tr; ch = '\u2588' }
      else { style = `${tr} on ${br}`; ch = '\u2580' }
      const last = segs[segs.length - 1]
      if (last && last.style === style) last.ch += ch
      else segs.push({ style, ch })
    }
    while (segs.length && segs[segs.length - 1].style === '') segs.pop()
    let line = ''
    for (const s of segs) {
      line += s.style === '' ? s.ch : `[${s.style}]${s.ch}[/]`
    }
    lines.push(line)
  }
  return lines.join('\n')
}

function gridToDigits(grid: number[], w: number, h: number): string {
  const lines: string[] = []
  for (let y = 0; y < h; y++) {
    let line = ''
    for (let x = 0; x < w; x++) line += grid[y * w + x].toString(16)
    lines.push('  ' + line)
  }
  return lines.join('\n')
}

function digitsToGrid(text: string): { grid: number[]; w: number; h: number } | null {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return null
  const h = lines.length
  const w = lines[0].length
  if (w < 4 || h < 2) return null
  const grid = new Array(w * h).fill(0)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w && x < lines[y].length; x++) {
      grid[y * w + x] = parseInt(lines[y][x], 16) || 0
    }
  }
  return { grid, w, h }
}

/* ── Preview HTML ───────────────────────────────────────────── */
function gridToPreviewHtml(grid: number[], w: number, h: number, pal: typeof PALETTE): string {
  const lines: string[] = []
  for (let y = 0; y < h; y += 2) {
    let line = ''
    for (let x = 0; x < w; x++) {
      const top = grid[y * w + x]
      const bot = y + 1 < h ? grid[(y + 1) * w + x] : 0
      const tc = top > 0 ? pal[top].hex : ''
      const bc = bot > 0 ? pal[bot].hex : ''
      if (top === 0 && bot === 0) line += ' '
      else if (top > 0 && bot === 0) line += `<span style="color:${tc}">\u2580</span>`
      else if (top === 0 && bot > 0) line += `<span style="color:${bc}">\u2584</span>`
      else if (top === bot) line += `<span style="color:${tc}">\u2588</span>`
      else line += `<span style="color:${tc};background:${bc}">\u2580</span>`
    }
    lines.push(line)
  }
  return lines.join('\n')
}

/* ── Component ──────────────────────────────────────────────── */
export default function BannerEditor() {
  const [w, setW] = useState(DEFAULT_W)
  const [h, setH] = useState(DEFAULT_H)
  const [grid, setGrid] = useState(() => new Array(DEFAULT_W * DEFAULT_H).fill(0))
  const [pal, setPal] = useState(() => PALETTE.map(p => ({ ...p })))
  const [color, setColor] = useState(4) // magenta default
  const [painting, setPainting] = useState(false)
  const [msg, setMsg] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [undoStack, setUndoStack] = useState<number[][]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const editingColorIdx = useRef<number>(-1)
  const lastCell = useRef<string>('')

  // ── Resize grid (preserve existing pixels) ──
  const resize = useCallback((nw: number, nh: number) => {
    setGrid(prev => {
      const ng = new Array(nw * nh).fill(0)
      const cw = Math.min(w, nw), ch = Math.min(h, nh)
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++)
          ng[y * nw + x] = prev[y * w + x]
      return ng
    })
    setW(nw)
    setH(nh)
  }, [w, h])

  // ── Draw canvas ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = w * CELL
    canvas.height = h * CELL

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ci = grid[y * w + x]
        if (ci === 0) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#1a1a2e' : '#16213e'
        } else {
          ctx.fillStyle = pal[ci]?.hex || '#000'
        }
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= w; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, h * CELL); ctx.stroke()
    }
    for (let y = 0; y <= h; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(w * CELL, y * CELL); ctx.stroke()
    }
  }, [grid, w, h, pal])

  // ── Paint ──
  const paintAt = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / CELL)
    const y = Math.floor((e.clientY - rect.top) / CELL)
    if (x < 0 || x >= w || y < 0 || y >= h) return
    const key = `${x},${y}`
    if (key === lastCell.current) return
    lastCell.current = key
    const val = e.buttons === 2 ? 0 : color
    setGrid(prev => {
      if (prev[y * w + x] === val) return prev
      const next = [...prev]
      next[y * w + x] = val
      return next
    })
  }, [w, h, color])

  const startPaint = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setUndoStack(prev => [...prev.slice(-19), [...grid]])
    lastCell.current = ''
    setPainting(true)
    paintAt(e)
  }, [grid, paintAt])

  // ── Undo ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        setUndoStack(prev => {
          if (!prev.length) return prev
          const last = prev[prev.length - 1]
          setGrid(last)
          setW(Math.round(Math.sqrt(last.length * (DEFAULT_W / DEFAULT_H))) || DEFAULT_W)
          return prev.slice(0, -1)
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Import ──
  const doImport = () => {
    const parsed = digitsToGrid(importText)
    if (!parsed) { setMsg('Invalid format'); setTimeout(() => setMsg(''), 2000); return }
    setW(parsed.w)
    setH(parsed.h)
    setGrid(parsed.grid)
    setShowImport(false)
    setImportText('')
    setMsg('Imported!')
    setTimeout(() => setMsg(''), 2000)
  }

  // ── Copy ──
  const copy = (type: 'rich' | 'digits') => {
    const text = type === 'rich' ? gridToRich(grid, w, h, pal) : gridToDigits(grid, w, h)
    navigator.clipboard.writeText(text)
    setMsg(type === 'rich' ? 'Rich markup copied!' : 'Digits copied!')
    setTimeout(() => setMsg(''), 2000)
  }

  const btn = 'px-3 py-1.5 rounded text-xs font-medium transition-all'
  const btnDim = `${btn} bg-white/5 text-white/60 hover:bg-white/10 hover:text-white`
  const btnGold = `${btn} bg-amber-500/20 text-amber-300 hover:bg-amber-500/30`

  return (
    <EditorShell
      title="Banner Editor"
      subtitle="Paint a terminal banner. Two pixel rows = one terminal line."
    >
      <div className="flex flex-col gap-5">

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-white/40 text-xs">Width:</span>
        <button className={btnDim} onClick={() => resize(Math.max(8, w - 4), h)}>−</button>
        <span className="text-white/70 text-sm w-8 text-center">{w}</span>
        <button className={btnDim} onClick={() => resize(Math.min(64, w + 4), h)}>+</button>
        <span className="text-white/20 mx-1">×</span>
        <span className="text-white/40 text-xs">Height:</span>
        <button className={btnDim} onClick={() => resize(w, Math.max(4, h - 2))}>−</button>
        <span className="text-white/70 text-sm w-8 text-center">{h}</span>
        <button className={btnDim} onClick={() => resize(w, Math.min(32, h + 2))}>+</button>
        <div className="flex-1" />
        <button className={`${btn} bg-red-500/10 text-red-400 hover:bg-red-500/20`}
          onClick={() => { setUndoStack(prev => [...prev.slice(-19), [...grid]]); setGrid(new Array(w * h).fill(0)) }}>
          Clear
        </button>
        <button className={btnDim} onClick={() => setShowImport(!showImport)}>
          Import Digits
        </button>
        {msg && <span className="text-emerald-400 text-xs ml-2">{msg}</span>}
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="bg-white/5 rounded-lg p-4 flex flex-col gap-2">
          <textarea
            className="bg-black/40 text-white/80 text-xs font-mono p-3 rounded border border-white/10 resize-y"
            rows={6}
            placeholder="Paste digit string (hex values, one row per line)..."
            value={importText}
            onChange={e => setImportText(e.target.value)}
          />
          <div className="flex gap-2">
            <button className={btnGold} onClick={doImport}>Apply</button>
            <button className={btnDim} onClick={() => setShowImport(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Palette */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-white/40 text-xs mr-1">Palette:</span>
        {pal.map((p, i) => (
          <button
            key={i}
            onClick={() => setColor(i)}
            onDoubleClick={() => {
              if (i === 0) return // can't change eraser
              editingColorIdx.current = i
              if (colorInputRef.current) {
                colorInputRef.current.value = p.hex
                colorInputRef.current.click()
              }
            }}
            title={i === 0 ? p.label : `${p.label} — double-click to change`}
            className="rounded transition-all"
            style={{
              width: 28, height: 28,
              background: i === 0
                ? 'repeating-conic-gradient(#1a1a2e 0% 25%, #16213e 0% 50%) 0 0/12px 12px'
                : p.hex,
              outline: color === i ? '2px solid #fff' : '2px solid transparent',
              outlineOffset: 1,
            }}
          />
        ))}
        <input
          ref={colorInputRef}
          type="color"
          className="sr-only"
          onChange={e => {
            const idx = editingColorIdx.current
            if (idx < 1) return
            const hex = e.target.value
            setPal(prev => {
              const next = [...prev]
              next[idx] = { hex, rich: hexToRich(hex), label: hex }
              return next
            })
          }}
        />
      </div>

      {/* Canvas */}
      <div className="overflow-auto rounded-lg border border-white/10 bg-black/20 p-2"
        style={{ maxWidth: '100%' }}>
        <canvas
          ref={canvasRef}
          width={w * CELL}
          height={h * CELL}
          style={{ cursor: 'crosshair', imageRendering: 'pixelated' }}
          onMouseDown={startPaint}
          onMouseMove={e => { if (painting) paintAt(e) }}
          onMouseUp={() => setPainting(false)}
          onMouseLeave={() => setPainting(false)}
          onContextMenu={e => e.preventDefault()}
        />
      </div>

      {/* Preview + Export */}
      <div className="flex gap-6 flex-wrap items-start">
        <div className="flex-1 min-w-[300px]">
          <div className="text-white/40 text-xs mb-2">Terminal Preview ({Math.ceil(h / 2)} lines)</div>
          <div
            className="bg-[#0d1117] rounded-lg px-4 py-3 border border-white/10"
            style={{ fontFamily: 'monospace', fontSize: 16, lineHeight: 1.15, whiteSpace: 'pre' }}
            dangerouslySetInnerHTML={{ __html: gridToPreviewHtml(grid, w, h, pal) }}
          />
        </div>
        <div className="flex flex-col gap-2 pt-6">
          <button className={btnGold} onClick={() => copy('rich')}>Copy Rich Markup</button>
          <button className={btnDim} onClick={() => copy('digits')}>Copy Digits</button>
        </div>
      </div>
      </div>
    </EditorShell>
  )
}
