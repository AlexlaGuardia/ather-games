'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { TILES } from '../../world/tiles'
import { TileDef, Renderer } from '../../engine/renderer'
import type { TileGroupCell, TileGroup } from '../../world/structures'
import EditorShell from '../templates/EditorShell'

const TS = 16
const SCALE = 3

const CATEGORIES = [
  { id: 'terrain', label: 'Terrain', color: '#4ade80' },
  { id: 'path', label: 'Path', color: '#fbbf24' },
  { id: 'water', label: 'Water', color: '#60a5fa' },
  { id: 'nature', label: 'Nature', color: '#f472b6' },
  { id: 'structure', label: 'Structure', color: '#94a3b8' },
  { id: 'warp', label: 'Warp', color: '#d4a843' },
  { id: 'veil', label: 'Veil', color: '#c4b5fd' },
] as const

// Category per tile index (matches MapEditor's BUILT_IN_CATS + extras for T33-T37)
const TILE_CATS: string[] = [
  'nature','nature','path','path','nature','nature',
  'structure','water','water','water','water',
  'terrain','terrain','path','warp','terrain','terrain',
  'terrain','structure','structure','nature','nature',
  'nature','nature','water','structure','structure',
  'structure','structure','structure','path',
  'veil','veil',
  'structure','structure','structure','structure','path',
]

const TILE_NAMES: string[] = [
  'Grass', 'Grass Alt', 'Dirt Path', 'Dirt Path 2', 'Flowers', 'Flowers 2',
  'Spirit Console', 'Water Edge', 'Water', 'Water Corner In', 'Water Corner Out',
  'Cloud Border', 'Cloud Corner', 'Dirt Path 3', 'Warp', 'Cloud Border L', 'Cloud Border R',
  'Border Empty', 'Cloud Wall Bottom', 'Cloud Wall Top', 'Golden Tree', 'Lantern Tree',
  'Dark Tree', 'Shimmer Tree', 'Deep Water', 'Cloud Pillar L', 'Cloud Arch',
  'Cloud Window', 'Cloud Wall Mid', 'Cloud Pillar R', 'Dirt Path Edge',
  'Light Veil', 'Dense Veil',
  'Room Wall', 'Room Corner', 'Room Wall 2', 'Room Doorway', 'Oak Floor',
]

const STRUCTURE_CATEGORIES = ['building', 'decoration', 'bridge', 'custom'] as const

function renderTileTo(ctx: CanvasRenderingContext2D, tile: TileDef, x: number, y: number, rot: number = 0) {
  const pixels = rot > 0 ? Renderer.rotateTilePixels(tile.pixels, rot) : tile.pixels
  for (let py = 0; py < TS; py++) {
    for (let px = 0; px < TS; px++) {
      const v = pixels[py * TS + px]
      if (v === 0) continue
      ctx.fillStyle = tile.palette[v - 1]
      ctx.fillRect(x + px, y + py, 1, 1)
    }
  }
}

function emptyGrid(cols: number, rows: number): (TileGroupCell | null)[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null))
}

function generateId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `struct-${Date.now()}`
}

export default function StructureBuilder() {
  // Structure list
  const [structures, setStructures] = useState<TileGroup[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadStatus, setLoadStatus] = useState('')

  // Current edit state
  const [name, setName] = useState('New Structure')
  const [category, setCategory] = useState<string>('building')
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(4)
  const [cells, setCells] = useState<(TileGroupCell | null)[][]>(emptyGrid(4, 4))
  const [dirty, setDirty] = useState(false)

  // Brush
  const [brushTile, setBrushTile] = useState(0)
  const [brushRotation, setBrushRotation] = useState(0)
  const [eraseMode, setEraseMode] = useState(false)
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null)
  const [painting, setPainting] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Load structures
  const loadStructures = useCallback(async () => {
    try {
      setLoadStatus('loading...')
      const res = await fetch('/shimmer/save-structure')
      const data = await res.json()
      setStructures(data.structures || [])
      setLoadStatus(data.structures?.length ? 'loaded' : 'empty')
    } catch {
      setLoadStatus('failed')
    }
  }, [])

  useEffect(() => { loadStructures() }, [loadStructures])

  // Select structure
  const selectStructure = useCallback((id: string) => {
    const s = structures.find(x => x.id === id)
    if (!s) return
    setSelectedId(id)
    setName(s.name)
    setCategory(s.category || 'building')
    setCols(s.cols)
    setRows(s.rows)
    setCells(s.cells.map(row => row.map(c => c ? { ...c } : null)))
    setDirty(false)
  }, [structures])

  // New
  const newStructure = useCallback(() => {
    setSelectedId(null)
    setName('New Structure')
    setCategory('building')
    setCols(4)
    setRows(4)
    setCells(emptyGrid(4, 4))
    setDirty(true)
  }, [])

  // Save
  const saveStructure = useCallback(async () => {
    const id = selectedId || generateId(name)
    const structure: TileGroup = { id, name, cols, rows, cells, category }
    try {
      const res = await fetch('/shimmer/save-structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(structure),
      })
      const data = await res.json()
      if (data.success) {
        setSelectedId(id)
        setDirty(false)
        await loadStructures()
      }
    } catch {}
  }, [selectedId, name, cols, rows, cells, category, loadStructures])

  // Delete
  const deleteStructure = useCallback(async () => {
    if (!selectedId) return
    try {
      await fetch('/shimmer/save-structure', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId }),
      })
      newStructure()
      await loadStructures()
    } catch {}
  }, [selectedId, newStructure, loadStructures])

  // Resize
  const resizeGrid = useCallback((newCols: number, newRows: number) => {
    const nc = Math.max(2, Math.min(8, newCols))
    const nr = Math.max(2, Math.min(8, newRows))
    setCols(nc)
    setRows(nr)
    setCells(prev => {
      const grid = emptyGrid(nc, nr)
      for (let r = 0; r < Math.min(prev.length, nr); r++) {
        for (let c = 0; c < Math.min(prev[r].length, nc); c++) {
          grid[r][c] = prev[r][c]
        }
      }
      return grid
    })
    setDirty(true)
  }, [])

  // Paint
  const paintAt = useCallback((col: number, row: number, erase: boolean) => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return
    setCells(prev => {
      const next = prev.map(r => [...r])
      next[row][col] = erase ? null : { tileIdx: brushTile, rotation: brushRotation }
      return next
    })
    setDirty(true)
  }, [cols, rows, brushTile, brushRotation])

  // Canvas coords
  const getCellFromEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / (TS * SCALE))
    const row = Math.floor((e.clientY - rect.top) / (TS * SCALE))
    return { col, row }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const { col, row } = getCellFromEvent(e)
    paintAt(col, row, e.button === 2 || eraseMode)
    setPainting(true)
  }, [getCellFromEvent, paintAt, eraseMode])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { col, row } = getCellFromEvent(e)
    const inBounds = col >= 0 && col < cols && row >= 0 && row < rows
    setHoverCell(inBounds ? { col, row } : null)
    if (painting && inBounds) {
      paintAt(col, row, e.buttons === 2 || eraseMode)
    }
  }, [getCellFromEvent, cols, rows, painting, paintAt, eraseMode])

  const handleMouseUp = useCallback(() => setPainting(false), [])
  const handleMouseLeave = useCallback(() => { setHoverCell(null); setPainting(false) }, [])

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'r' || e.key === 'R') setBrushRotation(prev => (prev + 1) % 4)
      else if (e.key === 'e' || e.key === 'E') setEraseMode(prev => !prev)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = cols * TS
    const h = rows * TS
    canvas.width = w
    canvas.height = h
    ctx.imageSmoothingEnabled = false

    // Checkerboard background
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#0d0d2a' : '#111133'
        ctx.fillRect(c * TS, r * TS, TS, TS)
      }
    }

    // Placed tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r]?.[c]
        if (!cell) continue
        const tile = TILES[cell.tileIdx]
        if (!tile) continue
        renderTileTo(ctx, tile, c * TS, r * TS, cell.rotation)
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * TS); ctx.lineTo(w, r * TS); ctx.stroke()
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath(); ctx.moveTo(c * TS, 0); ctx.lineTo(c * TS, h); ctx.stroke()
    }

    // Hover ghost
    if (hoverCell) {
      if (!eraseMode) {
        const tile = TILES[brushTile]
        if (tile) {
          ctx.globalAlpha = 0.5
          renderTileTo(ctx, tile, hoverCell.col * TS, hoverCell.row * TS, brushRotation)
          ctx.globalAlpha = 1
        }
      }
      ctx.strokeStyle = eraseMode ? 'rgba(255, 80, 80, 0.6)' : 'rgba(212, 168, 67, 0.6)'
      ctx.lineWidth = 1
      ctx.strokeRect(hoverCell.col * TS + 0.5, hoverCell.row * TS + 0.5, TS - 1, TS - 1)
    }
  }, [cols, rows, cells, hoverCell, brushTile, brushRotation, eraseMode])

  return (
    <EditorShell
      title="Structure Builder"
      subtitle="Compose multi-tile structures from existing tiles"
      loadStatus={loadStatus}
    >
      {/* Structure list */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <button
          onClick={newStructure}
          className="px-3 py-1.5 rounded text-xs font-display bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
        >
          + New
        </button>
        {structures.map(s => (
          <button
            key={s.id}
            onClick={() => selectStructure(s.id)}
            className={`px-3 py-1.5 rounded text-xs font-display ${
              selectedId === s.id
                ? 'bg-gold/20 text-gold border border-gold/30'
                : 'bg-white/5 text-text-dim border border-white/5 hover:bg-white/10'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Edit controls */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-faint uppercase tracking-wider">Name</span>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setDirty(true) }}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white w-40 focus:outline-none focus:border-gold/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-faint uppercase tracking-wider">Type</span>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setDirty(true) }}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none"
          >
            {STRUCTURE_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-faint uppercase tracking-wider">Grid</span>
          <button onClick={() => resizeGrid(cols - 1, rows)} className="text-xs text-text-dim hover:text-white w-5 h-5 rounded bg-white/5 hover:bg-white/10">-</button>
          <span className="text-sm text-white font-mono w-12 text-center">{cols} x {rows}</span>
          <button onClick={() => resizeGrid(cols + 1, rows)} className="text-xs text-text-dim hover:text-white w-5 h-5 rounded bg-white/5 hover:bg-white/10">+</button>
          <span className="text-[9px] text-text-faint">cols</span>
          <span className="text-white/20">|</span>
          <button onClick={() => resizeGrid(cols, rows - 1)} className="text-xs text-text-dim hover:text-white w-5 h-5 rounded bg-white/5 hover:bg-white/10">-</button>
          <button onClick={() => resizeGrid(cols, rows + 1)} className="text-xs text-text-dim hover:text-white w-5 h-5 rounded bg-white/5 hover:bg-white/10">+</button>
          <span className="text-[9px] text-text-faint">rows</span>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <button
          onClick={saveStructure}
          disabled={!dirty}
          className={`px-4 py-1.5 rounded text-xs font-display ${
            dirty
              ? 'bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30'
              : 'bg-white/5 text-text-faint border border-white/5'
          }`}
        >
          Save
        </button>
        {selectedId && (
          <button
            onClick={deleteStructure}
            className="px-3 py-1.5 rounded text-xs font-display bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
          >
            Delete
          </button>
        )}
        {dirty && <span className="text-[9px] text-amber-400 italic">unsaved</span>}
      </div>

      {/* Brush info */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] text-text-faint uppercase tracking-wider">Brush</span>
        {eraseMode ? (
          <span className="text-xs text-red-400 font-display">Eraser</span>
        ) : (
          <>
            <span className="text-xs text-text-dim">{TILE_NAMES[brushTile] || `Tile ${brushTile}`}</span>
            {brushRotation > 0 && (
              <span className="text-[10px] text-text-faint font-mono">{brushRotation * 90}&deg;</span>
            )}
          </>
        )}
        <span className="text-[9px] text-text-faint ml-2">
          R rotate &middot; E eraser &middot; Right-click erase
        </span>
      </div>

      {/* Canvas + Tile Palette */}
      <div className="flex gap-6">
        {/* Grid canvas */}
        <div className="flex-shrink-0">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onContextMenu={e => e.preventDefault()}
            className="border border-white/10 rounded cursor-crosshair"
            style={{
              imageRendering: 'pixelated',
              width: cols * TS * SCALE,
              height: rows * TS * SCALE,
            }}
          />
        </div>

        {/* Tile palette */}
        <div className="flex-1 max-w-xs">
          <span className="text-[9px] text-text-faint block mb-2 uppercase tracking-wider">Tile Palette</span>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {CATEGORIES.map(cat => {
              const catTiles = TILES.map((t, i) => ({ tile: t, idx: i }))
                .filter((_, i) => TILE_CATS[i] === cat.id)
              if (catTiles.length === 0) return null
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-[9px] text-text-faint uppercase">{cat.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {catTiles.map(({ tile, idx }) => (
                      <TileThumbnail
                        key={idx}
                        tile={tile}
                        idx={idx}
                        selected={brushTile === idx && !eraseMode}
                        onClick={() => { setBrushTile(idx); setEraseMode(false) }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </EditorShell>
  )
}

function TileThumbnail({ tile, idx, selected, onClick }: {
  tile: TileDef
  idx: number
  selected: boolean
  onClick: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.canvas.width = TS
    ctx.canvas.height = TS
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#0d0d2a'
    ctx.fillRect(0, 0, TS, TS)
    renderTileTo(ctx, tile, 0, 0)
  }, [tile])

  return (
    <button
      onClick={onClick}
      title={TILE_NAMES[idx] || `Tile ${idx}`}
      className={`rounded border transition-all ${
        selected
          ? 'border-gold/50 ring-1 ring-gold/30'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      <canvas
        ref={ref}
        style={{ imageRendering: 'pixelated', width: TS * 2, height: TS * 2 }}
      />
    </button>
  )
}
