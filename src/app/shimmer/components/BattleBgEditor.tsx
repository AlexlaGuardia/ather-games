'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { drawBattleBg, BG_W, BG_H, bgStorageKey } from './BattleBackground'

// ============================================
// Constants
// ============================================

const TILE = 32       // 32x32 pixel tiles
const COLS = BG_W / TILE // 10
const ROWS = BG_H / TILE // 6

// ============================================
// Helpers
// ============================================

function rgbaToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function extractPalette(data: Uint8ClampedArray, total: number): string[] {
  const counts = new Map<string, number>()
  for (let i = 0; i < total * 4; i += 4) {
    const hex = rgbaToHex(data[i], data[i + 1], data[i + 2])
    counts.set(hex, (counts.get(hex) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h)
}

function encodePixels(data: Uint8ClampedArray, total: number, palette: string[]): string {
  const map = new Map<string, number>()
  palette.forEach((c, i) => map.set(c, i))
  let s = ''
  for (let i = 0; i < total * 4; i += 4) {
    s += (map.get(rgbaToHex(data[i], data[i + 1], data[i + 2])) ?? 0).toString(36)
  }
  return s
}

function decodePixels(pixels: string, palette: string[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels.length * 4)
  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = hexToRgb(palette[parseInt(pixels[i], 36)] ?? '#000000')
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  }
  return data
}

/** Load saved data — checks localStorage draft first, then disk file */
function loadFromDraft(zoneId: string): { palette: string[]; pixels: string } | null {
  try {
    const raw = localStorage.getItem(bgStorageKey(zoneId))
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function saveDraft(zoneId: string, palette: string[], pixels: Uint8ClampedArray) {
  const encoded = encodePixels(pixels, BG_W * BG_H, palette)
  localStorage.setItem(bgStorageKey(zoneId), JSON.stringify({ palette, pixels: encoded }))
}

function generateProcedural(zoneId: string): { pixels: Uint8ClampedArray; palette: string[] } {
  const offscreen = document.createElement('canvas')
  offscreen.width = BG_W
  offscreen.height = BG_H
  const ctx = offscreen.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  drawBattleBg(ctx, BG_W, BG_H, zoneId)
  const imgData = ctx.getImageData(0, 0, BG_W, BG_H)
  return { pixels: imgData.data, palette: extractPalette(imgData.data, BG_W * BG_H) }
}

// ============================================
// TileEditor — popup for editing one 16x16 tile
// ============================================

function TileEditor({ col, row, pixelData, palette, renderKey, onChange, onClose, onAddColor, onEditColor }: {
  col: number
  row: number
  pixelData: Uint8ClampedArray
  palette: string[]
  renderKey: number
  onChange: (x: number, y: number, colorHex: string) => void
  onClose: () => void
  onAddColor: (hex: string) => void
  onEditColor: (index: number, newHex: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [pickerColor, setPickerColor] = useState(palette[0] ?? '#000000')
  const paintingRef = useRef(false)
  const CELL = 14
  const startX = col * TILE
  const startY = row * TILE

  // Render tile grid
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    for (let py = 0; py < TILE; py++) {
      for (let px = 0; px < TILE; px++) {
        const idx = ((startY + py) * BG_W + (startX + px)) * 4
        ctx.fillStyle = `rgb(${pixelData[idx]},${pixelData[idx + 1]},${pixelData[idx + 2]})`
        ctx.fillRect(px * CELL, py * CELL, CELL, CELL)
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.beginPath()
    for (let x = 0; x <= TILE; x++) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, TILE * CELL) }
    for (let y = 0; y <= TILE; y++) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(TILE * CELL, y * CELL + 0.5) }
    ctx.stroke()
  }, [pixelData, startX, startY, renderKey, CELL])

  const paint = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const px = Math.floor((e.clientX - rect.left) / CELL)
    const py = Math.floor((e.clientY - rect.top) / CELL)
    if (px >= 0 && px < TILE && py >= 0 && py < TILE) {
      // Immediate visual update
      const ctx = canvasRef.current!.getContext('2d')!
      ctx.fillStyle = palette[selectedIdx]
      ctx.fillRect(px * CELL, py * CELL, CELL, CELL)
      onChange(startX + px, startY + py, palette[selectedIdx])
    }
  }, [CELL, palette, selectedIdx, startX, startY, onChange])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#0a0a14] border border-white/15 rounded-xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-[12px] text-white/70">
            Tile ({col}, {row})
          </h4>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-[14px] px-2">x</button>
        </div>

        <canvas
          ref={canvasRef}
          width={TILE * CELL}
          height={TILE * CELL}
          className="rounded border border-white/10 cursor-crosshair"
          onMouseDown={e => { paintingRef.current = true; paint(e) }}
          onMouseMove={e => { if (paintingRef.current) paint(e) }}
          onMouseUp={() => paintingRef.current = false}
          onMouseLeave={() => paintingRef.current = false}
          onContextMenu={e => {
            e.preventDefault()
            const rect = canvasRef.current!.getBoundingClientRect()
            const px = Math.floor((e.clientX - rect.left) / CELL)
            const py = Math.floor((e.clientY - rect.top) / CELL)
            if (px >= 0 && px < TILE && py >= 0 && py < TILE) {
              const idx = ((startY + py) * BG_W + (startX + px)) * 4
              const hex = rgbaToHex(pixelData[idx], pixelData[idx + 1], pixelData[idx + 2])
              const pIdx = palette.indexOf(hex)
              if (pIdx >= 0) { setSelectedIdx(pIdx); setPickerColor(hex) }
            }
          }}
        />

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-white/30">Palette ({palette.length}/36)</span>
            <span className="text-[8px] text-white/15">Right-click to eyedrop</span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto mb-2">
            {palette.map((color, i) => (
              <button
                key={i}
                className={`w-5 h-5 rounded-sm border transition-all ${
                  selectedIdx === i
                    ? 'border-[#d4a843] ring-1 ring-[#d4a843]/40 scale-125'
                    : 'border-white/10 hover:border-white/30'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => { setSelectedIdx(i); setPickerColor(color) }}
                title={`${color} (${i})`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={pickerColor}
              onChange={e => {
                const hex = e.target.value
                setPickerColor(hex)
                onEditColor(selectedIdx, hex)
              }}
              className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent"
              title="Edit selected color"
            />
            <span className="text-[9px] text-white/30 font-mono">{palette[selectedIdx] ?? ''}</span>
            <button
              onClick={() => {
                if (palette.length < 36 && !palette.includes(pickerColor)) {
                  onAddColor(pickerColor)
                  setSelectedIdx(palette.length)
                }
              }}
              disabled={palette.length >= 36}
              className="text-[9px] text-white/40 hover:text-white/60 px-2 py-0.5 border border-white/10 rounded transition-all disabled:opacity-25"
              title="Add as new color"
            >
              + New
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// BattleBgEditor — main component
// ============================================

export default function BattleBgEditor({ zoneId }: { zoneId: string }) {
  const previewRef = useRef<HTMLCanvasElement>(null)
  const pixelsRef = useRef<Uint8ClampedArray | null>(null)
  const [palette, setPalette] = useState<string[]>([])
  const [editingTile, setEditingTile] = useState<{ col: number; row: number } | null>(null)
  const [hoverTile, setHoverTile] = useState<{ col: number; row: number } | null>(null)
  const [renderKey, setRenderKey] = useState(0)
  const [dirty, setDirty] = useState(false)          // unsaved edits since last disk save
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [hasDiskSave, setHasDiskSave] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // Helper: apply decoded data to the editor state
  const applyData = useCallback((pixels: Uint8ClampedArray, pal: string[], isDirty: boolean) => {
    pixelsRef.current = pixels
    setPalette(pal)
    setDirty(isDirty)
    setSaveStatus('idle')
    setEditingTile(null)
    setRenderKey(k => k + 1)
  }, [])

  // Initialize: disk file → localStorage draft → procedural base
  useEffect(() => {
    let cancelled = false

    async function load() {
      // 1. Try disk file
      try {
        const res = await fetch(`/shimmer/save-battle-bg?zone=${encodeURIComponent(zoneId)}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && data.exists) {
            const pixels = decodePixels(data.pixels, data.palette)
            // Also sync to localStorage
            localStorage.setItem(bgStorageKey(zoneId), JSON.stringify({ palette: data.palette, pixels: data.pixels }))
            setHasDiskSave(true)
            applyData(pixels, data.palette, false)

            // Check if there's a newer localStorage draft
            const draft = loadFromDraft(zoneId)
            if (draft && draft.pixels !== data.pixels) {
              // Draft differs from disk — user has unsaved work
              const draftPixels = decodePixels(draft.pixels, draft.palette)
              applyData(draftPixels, draft.palette, true)
            }
            return
          }
        }
      } catch { /* disk load failed, continue */ }

      if (cancelled) return

      // 2. Try localStorage draft
      const draft = loadFromDraft(zoneId)
      if (draft) {
        const pixels = decodePixels(draft.pixels, draft.palette)
        setHasDiskSave(false)
        applyData(pixels, draft.palette, true)
        return
      }

      // 3. Fall back to procedural
      const { pixels, palette: pal } = generateProcedural(zoneId)
      setHasDiskSave(false)
      applyData(pixels, pal, false)
    }

    load()
    return () => { cancelled = true }
  }, [zoneId, applyData])

  // Render preview canvas
  useEffect(() => {
    const canvas = previewRef.current
    const pixels = pixelsRef.current
    if (!canvas || !pixels) return
    canvas.width = BG_W
    canvas.height = BG_H
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const imgData = ctx.createImageData(BG_W, BG_H)
    imgData.data.set(pixels)
    ctx.putImageData(imgData, 0, 0)
  }, [renderKey])

  // Update a pixel
  const updatePixel = useCallback((x: number, y: number, colorHex: string) => {
    if (!pixelsRef.current) return
    const [r, g, b] = hexToRgb(colorHex)
    const idx = (y * BG_W + x) * 4
    pixelsRef.current[idx] = r
    pixelsRef.current[idx + 1] = g
    pixelsRef.current[idx + 2] = b
    pixelsRef.current[idx + 3] = 255
    setRenderKey(k => k + 1)
    setDirty(true)
    setSaveStatus('idle')
  }, [])

  // Auto-draft to localStorage on edits (debounced via tile close)
  const saveDraftNow = useCallback(() => {
    if (pixelsRef.current && palette.length > 0) {
      saveDraft(zoneId, palette, pixelsRef.current)
    }
  }, [zoneId, palette])

  // Add a new color to the palette
  const addColor = useCallback((hex: string) => {
    setPalette(prev => {
      if (prev.includes(hex) || prev.length >= 36) return prev
      return [...prev, hex]
    })
    setDirty(true)
    setSaveStatus('idle')
  }, [])

  // Edit an existing palette color — recolors all matching pixels
  const editColor = useCallback((index: number, newHex: string) => {
    setPalette(prev => {
      if (index < 0 || index >= prev.length) return prev
      const oldHex = prev[index]
      if (oldHex === newHex) return prev
      if (pixelsRef.current) {
        const [oldR, oldG, oldB] = hexToRgb(oldHex)
        const [newR, newG, newB] = hexToRgb(newHex)
        const data = pixelsRef.current
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] === oldR && data[i + 1] === oldG && data[i + 2] === oldB) {
            data[i] = newR; data[i + 1] = newG; data[i + 2] = newB
          }
        }
      }
      const next = [...prev]
      next[index] = newHex
      return next
    })
    setRenderKey(k => k + 1)
    setDirty(true)
    setSaveStatus('idle')
  }, [])

  // Save to disk (POST to API) + localStorage
  const saveWork = useCallback(async () => {
    if (!pixelsRef.current || palette.length === 0) return
    setSaving(true)
    const encoded = encodePixels(pixelsRef.current, BG_W * BG_H, palette)

    try {
      const res = await fetch('/shimmer/save-battle-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId, palette, pixels: encoded }),
      })
      if (!res.ok) throw new Error('Save failed')

      // Also update localStorage to match
      localStorage.setItem(bgStorageKey(zoneId), JSON.stringify({ palette, pixels: encoded }))
      setHasDiskSave(true)
      setDirty(false)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [zoneId, palette])

  // Reset — go back to last disk save, or procedural if none
  const resetToLastSave = useCallback(async () => {
    // Try loading from disk first
    try {
      const res = await fetch(`/shimmer/save-battle-bg?zone=${encodeURIComponent(zoneId)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.exists) {
          const pixels = decodePixels(data.pixels, data.palette)
          localStorage.setItem(bgStorageKey(zoneId), JSON.stringify({ palette: data.palette, pixels: data.pixels }))
          applyData(pixels, data.palette, false)
          return
        }
      }
    } catch { /* fall through to procedural */ }

    // No disk save — reset to procedural
    const { pixels, palette: pal } = generateProcedural(zoneId)
    localStorage.removeItem(bgStorageKey(zoneId))
    setHasDiskSave(false)
    applyData(pixels, pal, false)
  }, [zoneId, applyData])

  // Preview click → open tile editor
  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * COLS)
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS)
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      setEditingTile({ col, row })
    }
  }, [])

  // Preview hover → highlight tile
  const handlePreviewMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * COLS)
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS)
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      setHoverTile({ col, row })
    } else {
      setHoverTile(null)
    }
  }, [])

  return (
    <div>
      {/* Tile editor popup */}
      {editingTile && pixelsRef.current && (
        <TileEditor
          col={editingTile.col}
          row={editingTile.row}
          pixelData={pixelsRef.current}
          palette={palette}
          renderKey={renderKey}
          onChange={updatePixel}
          onClose={() => { setEditingTile(null); saveDraftNow() }}
          onAddColor={addColor}
          onEditColor={editColor}
        />
      )}

      {/* Preview canvas with tile grid overlay */}
      <div
        className="relative rounded overflow-hidden border border-white/10"
        style={{ width: 480, height: 288 }}
        onMouseLeave={() => setHoverTile(null)}
      >
        <canvas
          ref={previewRef}
          className="absolute inset-0 w-full h-full cursor-pointer"
          style={{ imageRendering: 'pixelated' as const }}
          onClick={handlePreviewClick}
          onMouseMove={handlePreviewMove}
        />

        {/* Tile grid + hover highlight */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
          viewBox={`0 0 ${COLS} ${ROWS}`}
        >
          {Array.from({ length: COLS + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i} y1={0} x2={i} y2={ROWS}
              stroke="rgba(255,255,255,0.06)" strokeWidth={0.03} />
          ))}
          {Array.from({ length: ROWS + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i} x2={COLS} y2={i}
              stroke="rgba(255,255,255,0.06)" strokeWidth={0.03} />
          ))}
          {hoverTile && (
            <rect
              x={hoverTile.col} y={hoverTile.row} width={1} height={1}
              fill="rgba(212,168,67,0.12)" stroke="rgba(212,168,67,0.5)" strokeWidth={0.05}
            />
          )}
        </svg>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={saveWork}
          disabled={!dirty || saving}
          className={`px-4 py-1.5 rounded text-[10px] font-display transition-all ${
            dirty && !saving
              ? 'bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/40 hover:bg-[#d4a843]/30'
              : 'text-white/20 border border-white/5 cursor-default'
          }`}
        >
          {saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved to disk' : saveStatus === 'error' ? 'Save failed' : 'Save'}
        </button>

        {confirmReset ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-red-400/70">
              {hasDiskSave ? 'Revert to last save?' : 'Reset to procedural base?'}
            </span>
            <button
              onClick={() => { resetToLastSave(); setConfirmReset(false) }}
              className="px-2 py-1 rounded text-[10px] text-red-400 border border-red-400/40 hover:bg-red-400/10 transition-all"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-2 py-1 rounded text-[10px] text-white/40 border border-white/10 hover:text-white/60 transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="px-3 py-1.5 rounded text-[10px] text-white/25 hover:text-white/50 border border-white/10 transition-all"
          >
            Reset
          </button>
        )}

        <span className="text-[9px] text-white/20 ml-auto">
          {palette.length} colors · {BG_W}x{BG_H}
          {dirty && <span className="text-[#d4a843]/40 ml-1">· unsaved</span>}
          {hasDiskSave && !dirty && <span className="text-green-400/30 ml-1">· on disk</span>}
        </span>
      </div>
    </div>
  )
}
