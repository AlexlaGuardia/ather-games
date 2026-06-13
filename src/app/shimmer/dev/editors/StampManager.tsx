'use client'

import { useState, useRef, useEffect } from 'react'

export interface Stamp {
  id: string
  name: string
  cells: (number | null)[][]  // packed tile values (tileIdx | rotation << 8), null = transparent
  rows: number
  cols: number
  variantGroup?: string
}

interface StampManagerProps {
  stamps: Stamp[]
  activeStampId: string | null
  randomVariant: boolean
  hotkeys: (string | null)[]   // 6 slots
  onSelectStamp: (id: string) => void
  onDeleteStamp: (id: string) => void
  onToggleRandomVariant: () => void
  onAssignHotkey: (slot: number, stampId: string | null) => void
  tiles: Array<{ tile: { pixels: Uint8Array; palette: string[] }; name: string }>
}

const TS = 16

function renderStampPreview(
  canvas: HTMLCanvasElement,
  stamp: Stamp,
  tiles: StampManagerProps['tiles'],
  maxSize: number,
) {
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const pw = stamp.cols * TS, ph = stamp.rows * TS
  canvas.width = pw
  canvas.height = ph
  ctx.fillStyle = '#0d0d2a'
  ctx.fillRect(0, 0, pw, ph)
  for (let r = 0; r < stamp.rows; r++) {
    for (let c = 0; c < stamp.cols; c++) {
      const val = stamp.cells[r]?.[c]
      if (val == null) continue
      const idx = val & 0xFF
      const tile = tiles[idx]
      if (!tile) continue
      const rot = (val >> 8) & 3
      const pixels = rot > 0 ? rotateTilePixels(tile.tile.pixels, rot) : tile.tile.pixels
      for (let py = 0; py < TS; py++) {
        for (let px = 0; px < TS; px++) {
          const v = pixels[py * TS + px]
          if (v === 0) continue
          ctx.fillStyle = tile.tile.palette[v - 1]
          ctx.fillRect(c * TS + px, r * TS + py, 1, 1)
        }
      }
    }
  }
}

function rotateTilePixels(pixels: Uint8Array, rot: number): Uint8Array {
  const out = new Uint8Array(TS * TS)
  for (let y = 0; y < TS; y++) {
    for (let x = 0; x < TS; x++) {
      const v = pixels[y * TS + x]
      let nx: number, ny: number
      switch (rot % 4) {
        case 1: nx = TS - 1 - y; ny = x; break
        case 2: nx = TS - 1 - x; ny = TS - 1 - y; break
        case 3: nx = y; ny = TS - 1 - x; break
        default: nx = x; ny = y
      }
      out[ny * TS + nx] = v
    }
  }
  return out
}

function StampPreview({ stamp, tiles, size = 48, selected, onClick }: {
  stamp: Stamp
  tiles: StampManagerProps['tiles']
  size?: number
  selected?: boolean
  onClick?: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) renderStampPreview(ref.current, stamp, tiles, size)
  }, [stamp, tiles, size])

  const sw = stamp.cols * TS, sh = stamp.rows * TS
  const scale = Math.min(size / sw, size / sh, 2)

  return (
    <button
      onClick={onClick}
      className={`p-1 rounded transition-all ${selected ? 'bg-gold/20 ring-2 ring-gold/40' : 'hover:bg-white/5'}`}
      title={`${stamp.name} (${stamp.cols}x${stamp.rows})${stamp.variantGroup ? ` [${stamp.variantGroup}]` : ''}`}
    >
      <canvas
        ref={ref}
        style={{ imageRendering: 'pixelated', width: sw * scale, height: sh * scale }}
        className="border border-white/10 rounded"
      />
    </button>
  )
}

export default function StampManager({
  stamps,
  activeStampId,
  randomVariant,
  hotkeys,
  onSelectStamp,
  onDeleteStamp,
  onToggleRandomVariant,
  onAssignHotkey,
  tiles,
}: StampManagerProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Group by variant
  const groups = new Map<string, Stamp[]>()
  const ungrouped: Stamp[] = []
  for (const s of stamps) {
    if (s.variantGroup) {
      const list = groups.get(s.variantGroup) ?? []
      list.push(s)
      groups.set(s.variantGroup, list)
    } else {
      ungrouped.push(s)
    }
  }

  if (stamps.length === 0) return null

  return (
    <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-white/50 uppercase tracking-wider hover:bg-white/5 transition-colors"
      >
        <span className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}>&#9662;</span>
        Stamps ({stamps.length})
        {randomVariant && <span className="text-amber-400/60 normal-case tracking-normal ml-auto">random</span>}
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Controls */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={randomVariant}
                onChange={onToggleRandomVariant}
                className="accent-amber-400"
              />
              <span className="text-[10px] text-text-faint">Random variant</span>
            </label>
          </div>

          {/* Hotkey slots */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-text-faint mr-1">Hotkeys:</span>
            {hotkeys.map((hkId, slot) => {
              const stamp = stamps.find(s => s.id === hkId)
              return (
                <div
                  key={slot}
                  className={`w-8 h-8 rounded border flex items-center justify-center text-[10px] cursor-pointer transition-colors ${
                    hkId ? 'border-gold/30 bg-gold/10 text-gold' : 'border-white/10 bg-white/[0.02] text-white/20'
                  }`}
                  onClick={() => {
                    if (activeStampId && !hkId) onAssignHotkey(slot, activeStampId)
                    else if (hkId) onSelectStamp(hkId)
                  }}
                  title={stamp ? `${slot + 1}: ${stamp.name}` : `Slot ${slot + 1}: empty (select a stamp then click)`}
                >
                  {slot + 1}
                </div>
              )
            })}
          </div>

          {/* Ungrouped stamps */}
          {ungrouped.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ungrouped.map(s => (
                <div key={s.id} className="relative group">
                  <StampPreview
                    stamp={s}
                    tiles={tiles}
                    size={48}
                    selected={activeStampId === s.id}
                    onClick={() => onSelectStamp(s.id)}
                  />
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteStamp(s.id) }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white text-[8px] hidden group-hover:flex items-center justify-center"
                  >x</button>
                </div>
              ))}
            </div>
          )}

          {/* Variant groups */}
          {Array.from(groups.entries()).map(([group, list]) => (
            <div key={group}>
              <span className="text-[9px] text-violet-400/60 uppercase tracking-wider">{group}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {list.map(s => (
                  <div key={s.id} className="relative group">
                    <StampPreview
                      stamp={s}
                      tiles={tiles}
                      size={48}
                      selected={activeStampId === s.id}
                      onClick={() => onSelectStamp(s.id)}
                    />
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteStamp(s.id) }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white text-[8px] hidden group-hover:flex items-center justify-center"
                    >x</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
