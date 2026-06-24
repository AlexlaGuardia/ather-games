'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { TILES, SOLID, ABOVE } from '../../world/tiles'
import { GARDEN } from '../../world/tilemap'
import { TileDef, Renderer } from '../../engine/renderer'
import { ITEMS, ITEM_ICONS, ITEM_PALETTE, SEED_PALETTES, NODE_SPRITES, NODE_TYPE_LABELS, NODE_PALETTES } from '../../sprites/items'
import { ZONE_NODES } from '../../world/node-placements'
import { ZONE_PICKUPS } from '../../world/static-pickups'
import { ZONES } from '../../world/zones'
import type { TileGroup } from '../../world/structures'
import { FURNITURE } from '../../sprites/furniture'
import { ZONE_CHESTS } from '../../world/zone-chests'
import { STRUCTURE_PLACEMENTS } from '../../world/structure-placements'
import EditorShell from '../templates/EditorShell'
import { MAP_EDITOR_SHORTCUTS } from '../templates/shortcut-data'
import { saveState, loadState, deleteState, listKeys } from '../hooks/useShimmerDB'
import { useSessionState } from '../hooks/useSessionState'
import StampManager, { type Stamp } from './StampManager'
import AutoLayerRules from './AutoLayerRules'
import { evaluateAffected, type AutoLayerRule, BUILTIN_RULE_TEMPLATES } from './autolayer-engine'
import { DEFAULT_AUTOLAYER_RULES } from '../../world/autolayer-rules'
import { ZONE_INTGRIDS } from '../../world/intgrids'

const TS = 32

// ── Curated tile palette ─────────────────────────────────────────────────────
// Adjust this allowlist to control which old-pixel tiles appear in the palette.
// FLAT tiles (97-109) are always shown in the "Terrain" group.
// Cloud tiles are hand-placed by Alex for borders — keep them in the "Clouds" group.
// Everything else is hidden from the default palette (still fully functional in saves).
const CLOUD_TILE_INDICES: readonly number[] = [
  11, 12, 15, 16, 17, 18, 19,           // Border L/R, Full Top 1, Border Empty, Wall Bottom/Top
  25, 26, 27, 28, 29,                    // Pillar L, Arch, Window, Wall Mid, Pillar R
  34,                                    // Cloud 1
  37, 38, 39, 40, 41, 42,               // Cloud Top L/R corners, Border Top 2, Cloud L 2
  74, 77, 78, 79, 80, 81,               // Cloud Border B R Out, L Exit, B Exits, Bottom 1, Top 3
  82, 83, 84, 85, 86, 87, 88, 89,       // Cloud Top corners, Border exits, Top 4/5, in L Corner 2, Bottom
  95, 96,                               // Cloud B L in Corner, Cloud Border B Exit
]
// Flat tile indices (new design system)
const FLAT_TILE_INDICES: readonly number[] = [97, 98, 99, 100, 101, 102] // placeholder/gray-box tiles (103-109 removed in the pixel-art switch)
// Combined allowlist for the curated palette — union of flat + cloud
const CURATED_TILE_ALLOWLIST = new Set<number>([...FLAT_TILE_INDICES, ...CLOUD_TILE_INDICES])

const CATEGORIES = [
  { id: 'terrain', label: 'Terrain', color: '#4ade80' },
  { id: 'path', label: 'Path', color: '#fbbf24' },
  { id: 'water', label: 'Water', color: '#60a5fa' },
  { id: 'nature', label: 'Nature', color: '#f472b6' },
  { id: 'structure', label: 'Structure', color: '#94a3b8' },
  { id: 'warp', label: 'Warp', color: '#d4a843' },
  { id: 'veil', label: 'Veil', color: '#c4b5fd' },
] as const

// Derive zone list from ZONES import — stays in sync automatically
const INITIAL_ZONE_MAPS = ZONES.map(z => ({ id: z.id, label: z.name }))

const ZONE_DEFAULTS: Record<string, number[][]> = Object.fromEntries(
  ZONES.map(z => [z.id, z.grid])
)

interface EditorTile {
  name: string
  tile: TileDef
  solid: boolean
  above: boolean
  category: string
}

const BUILT_IN_NAMES = [
  'Grass', 'Grass Alt', 'Dirt Path', 'Dirt Path 2', 'Flowers', 'Flowers 2',
  'Spirit Console', 'Water Edge', 'Water', 'Water Corner In', 'Water Corner Out',
  'Cloud Border', 'Cloud Corner', 'Dirt Path 3', 'Warp', 'Cloud Border L', 'Cloud Border R',
  'Border Empty', 'Cloud Wall Bottom', 'Cloud Wall Top', 'Golden Tree', 'Lantern Tree',
  'Dark Tree', 'Shimmer Tree', 'Deep Water', 'Cloud Pillar L', 'Cloud Arch',
  'Cloud Window', 'Cloud Wall Mid', 'Cloud Pillar R', 'Dirt Path Edge',
  'Light Veil', 'Dense Veil',
]
const BUILT_IN_CATS = [
  'nature','nature','path','path','nature','nature',
  'structure','water','water','water','water',
  'terrain','terrain','path','warp','terrain','terrain',
  'terrain','structure','structure','nature','nature',
  'nature','nature','water','structure','structure',
  'structure','structure','structure','path',
  'veil','veil',
]
function builtInTiles(): EditorTile[] {
  return TILES.map((t, i) => ({
    name: BUILT_IN_NAMES[i] ?? `Tile${i}`,
    tile: { pixels: new Uint8Array(t.pixels), palette: [...t.palette] },
    solid: SOLID[i] ?? false,
    above: ABOVE[i] ?? false,
    category: BUILT_IN_CATS[i] ?? '',
  }))
}

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

function renderItemTo(ctx: CanvasRenderingContext2D, itemId: string, x: number, y: number) {
  const icon = ITEM_ICONS[itemId]
  if (!icon) return
  const pal = SEED_PALETTES[itemId] ?? ITEM_PALETTE
  const frame = icon.frames[0]
  for (let i = 0; i < frame.length; i++) {
    const v = frame[i]
    if (v === 0) continue
    ctx.fillStyle = (pal as readonly string[])[v - 1] ?? (pal as readonly string[])[0]
    ctx.fillRect(x + (i % TS), y + Math.floor(i / TS), 1, 1)
  }
}

interface BrushEntry {
  type: 'tile' | 'item' | 'node' | 'eraser' | 'structure' | 'stamp' | 'furniture' | 'zonechest'
  tileIdx?: number
  itemId?: string
  nodeType?: string
  structureId?: string
  stampId?: string
  furnitureId?: string
  chestType?: string
}

interface WarpPlacement {
  fromX: number
  fromY: number
  toZone: string
  toX: number
  toY: number
  direction: string
  requiredFlag?: string
}

function hydrateWarps(mapId: string): WarpPlacement[] {
  const zone = ZONES.find(z => z.id === mapId)
  return zone?.warps.map(w => ({
    fromX: w.fromX, fromY: w.fromY,
    toZone: w.toZone, toX: w.toX, toY: w.toY,
    direction: w.direction ?? 'down',
    requiredFlag: w.requiredFlag,
  })) ?? []
}

function brushKey(e: BrushEntry): string {
  if (e.type === 'eraser') return 'eraser'
  if (e.type === 'tile') return `tile:${e.tileIdx}`
  if (e.type === 'node') return `node:${e.nodeType}`
  if (e.type === 'structure') return `struct:${e.structureId}`
  if (e.type === 'stamp') return `stamp:${e.stampId}`
  if (e.type === 'furniture') return `furn:${e.furnitureId}`
  if (e.type === 'zonechest') return `zc:${e.chestType}`
  return `item:${e.itemId}`
}

function BrushPreview({ entry, tiles, structures, size = 32, selected, onClick }: {
  entry: BrushEntry
  tiles: EditorTile[]
  structures?: TileGroup[]
  size?: number
  selected?: boolean
  onClick?: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    if (entry.type === 'structure' && entry.structureId && structures) {
      const s = structures.find(x => x.id === entry.structureId)
      if (s) {
        c.width = s.cols * TS; c.height = s.rows * TS
        ctx.fillStyle = '#0d0d2a'
        ctx.fillRect(0, 0, c.width, c.height)
        for (let r = 0; r < s.rows; r++)
          for (let co = 0; co < s.cols; co++) {
            const cell = s.cells[r]?.[co]
            if (!cell) continue
            const tile = TILES[cell.tileIdx]
            if (tile) renderTileTo(ctx, tile, co * TS, r * TS, cell.rotation)
          }
      } else {
        c.width = TS; c.height = TS; ctx.clearRect(0, 0, TS, TS)
      }
    } else {
      c.width = TS; c.height = TS
      ctx.clearRect(0, 0, TS, TS)

      if (entry.type === 'tile' && entry.tileIdx !== undefined) {
        const et = tiles[entry.tileIdx]
        if (et) renderTileTo(ctx, et.tile, 0, 0)
      } else if (entry.type === 'item' && entry.itemId) {
        renderItemTo(ctx, entry.itemId, 0, 0)
      } else if (entry.type === 'node' && entry.nodeType) {
        const nodeSprite = NODE_SPRITES[entry.nodeType]?.harvestable
        if (nodeSprite) {
          const frame = nodeSprite.frames[0]
          const pal = (NODE_PALETTES[entry.nodeType] ?? ITEM_PALETTE) as unknown as readonly string[]
          for (let i = 0; i < frame.length; i++) {
            const v = frame[i]
            if (v === 0) continue
            ctx.fillStyle = pal[v - 1] ?? pal[0]
            ctx.fillRect(i % TS, Math.floor(i / TS), 1, 1)
          }
        }
      } else if (entry.type === 'eraser') {
        ctx.strokeStyle = '#ff4444'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(4, 4); ctx.lineTo(TS - 4, TS - 4)
        ctx.moveTo(TS - 4, 4); ctx.lineTo(4, TS - 4)
        ctx.stroke()
      }
    }
  }, [entry, tiles, structures])

  const label = entry.type === 'eraser' ? 'Eraser'
    : entry.type === 'tile' ? (tiles[entry.tileIdx!]?.name ?? `Tile ${entry.tileIdx}`)
    : entry.type === 'node' ? (NODE_TYPE_LABELS[entry.nodeType!]?.name ?? entry.nodeType)
    : entry.type === 'structure' ? (structures?.find(s => s.id === entry.structureId)?.name ?? entry.structureId)
    : ITEMS.find(i => i.id === entry.itemId)?.name ?? entry.itemId

  // For structures, scale to fit within size box maintaining aspect ratio
  const structDef = entry.type === 'structure' && structures ? structures.find(s => s.id === entry.structureId) : null
  const canvasStyle = structDef
    ? (() => {
        const sw = structDef.cols * TS, sh = structDef.rows * TS
        const scale = Math.min(size / sw, size / sh)
        return { imageRendering: 'pixelated' as const, width: sw * scale, height: sh * scale }
      })()
    : { imageRendering: 'pixelated' as const, width: size, height: size }

  return (
    <button
      onClick={onClick}
      className={`p-1 rounded transition-all ${selected ? 'bg-gold/20 ring-2 ring-gold/40' : 'hover:bg-white/5'}`}
      title={label}
    >
      <canvas ref={ref} style={canvasStyle} className="border border-white/10 rounded" />
    </button>
  )
}

const MAX_COLORS = 15
function TileWorkshop({ initial, onSave, onCancel, isNew }: {
  initial?: { pixels: number[]; palette: string[]; name: string; solid: boolean; above: boolean; category: string; frames?: number[][]; animRate?: number }
  onSave: (name: string, frames: number[][], palette: string[], solid: boolean, above: boolean, category: string, animRate: number) => void
  onCancel: () => void
  isNew: boolean
}) {
  const [frames, setFrames] = useState<number[][]>(() => {
    if (initial?.frames && initial.frames.length > 0) return initial.frames.map(f => [...f])
    return [initial?.pixels ?? new Array(1024).fill(0)]
  })
  const [currentFrame, setCurrentFrame] = useState(0)
  const [animRate, setAnimRate] = useState(initial?.animRate ?? 12)
  const [palette, setPalette] = useState<string[]>(() =>
    initial?.palette ? [...initial.palette] : ['#5a8a4a', '#8aba6a', '#3a5a2a']
  )
  const [name, setName] = useState(initial?.name ?? '')
  const [solid, setSolid] = useState(initial?.solid ?? false)
  const [above, setAbove] = useState(initial?.above ?? false)
  const [category, setCategory] = useState(initial?.category ?? 'terrain')
  const [brush, setBrush] = useState(1)
  const [painting, setPainting] = useState(false)
  const [tool, setTool] = useState<'pencil' | 'fill' | 'line' | 'rect'>('pencil')
  const [tUndoStack, setTUndoStack] = useState<number[][][]>([])
  const [tRedoStack, setTRedoStack] = useState<number[][][]>([])
  const [erasing, setErasing] = useState(false)
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null)
  const [shapeEnd, setShapeEnd] = useState<{ x: number; y: number } | null>(null)
  const [rectFilled, setRectFilled] = useState(false)
  const framesRef = useRef(frames)
  useEffect(() => { framesRef.current = frames }, [frames])

  const pixels = frames[currentFrame] ?? new Array(1024).fill(0)

  const previewRef = useRef<HTMLCanvasElement>(null)
  const preview3xRef = useRef<HTMLCanvasElement>(null)
  const preview6xRef = useRef<HTMLCanvasElement>(null)
  const animPreviewRef = useRef<HTMLCanvasElement>(null)

  // Static preview — shows current frame
  useEffect(() => {
    const tile = { pixels: new Uint8Array(pixels), palette }
    for (const c of [previewRef.current, preview3xRef.current, preview6xRef.current]) {
      if (!c) continue
      c.width = TS; c.height = TS
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, TS, TS)
      renderTileTo(ctx, tile, 0, 0)
    }
  }, [pixels, palette])

  // Animated preview — cycles through frames
  useEffect(() => {
    if (frames.length <= 1) return
    const c = animPreviewRef.current
    if (!c) return
    let frame = 0
    const intervalMs = Math.max(100, (animRate / 15) * 1000)
    const id = setInterval(() => {
      frame = (frame + 1) % frames.length
      c.width = TS; c.height = TS
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, TS, TS)
      renderTileTo(ctx, { pixels: new Uint8Array(frames[frame]), palette }, 0, 0)
    }, intervalMs)
    // Draw first frame immediately
    c.width = TS; c.height = TS
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    renderTileTo(ctx, { pixels: new Uint8Array(frames[0]), palette }, 0, 0)
    return () => clearInterval(id)
  }, [frames, palette, animRate])

  const paint = useCallback((i: number) => {
    setFrames(prev => {
      const next = prev.map(f => [...f])
      next[currentFrame][i] = brush
      return next
    })
  }, [brush, currentFrame])

  const updatePalette = (idx: number, hex: string) => {
    setPalette(prev => {
      const next = [...prev]
      next[idx] = hex
      return next
    })
  }

  const addColor = () => {
    if (palette.length >= MAX_COLORS) return
    setPalette(prev => [...prev, '#888888'])
  }

  const removeColor = (idx: number) => {
    if (palette.length <= 1) return
    const colorIdx = idx + 1
    setFrames(prev => prev.map(f => f.map(v =>
      v === colorIdx ? 0 : v > colorIdx ? v - 1 : v
    )))
    setPalette(prev => prev.filter((_, i) => i !== idx))
    if (brush >= colorIdx) setBrush(Math.max(1, brush - 1))
  }

  // --- Undo / Redo ---
  const pushUndo = useCallback(() => {
    setTUndoStack(prev => [...prev.slice(-29), framesRef.current.map(f => [...f])])
    setTRedoStack([])
  }, [])
  const tUndo = useCallback(() => {
    setTUndoStack(prev => {
      if (prev.length === 0) return prev
      const snap = prev[prev.length - 1]
      setTRedoStack(r => [...r, framesRef.current.map(f => [...f])])
      setFrames(snap.map(f => [...f]))
      return prev.slice(0, -1)
    })
  }, [])
  const tRedo = useCallback(() => {
    setTRedoStack(prev => {
      if (prev.length === 0) return prev
      const snap = prev[prev.length - 1]
      setTUndoStack(u => [...u, framesRef.current.map(f => [...f])])
      setFrames(snap.map(f => [...f]))
      return prev.slice(0, -1)
    })
  }, [])

  // --- Flood Fill ---
  const floodFill = useCallback((startIdx: number) => {
    const px = [...pixels]
    const target = px[startIdx]
    if (target === brush) return
    pushUndo()
    const stack = [startIdx]
    const visited = new Set<number>()
    while (stack.length > 0) {
      const idx = stack.pop()!
      if (visited.has(idx)) continue
      if (px[idx] !== target) continue
      visited.add(idx)
      px[idx] = brush
      const x = idx % TS, y = Math.floor(idx / TS)
      if (x > 0) stack.push(idx - 1)
      if (x < TS - 1) stack.push(idx + 1)
      if (y > 0) stack.push(idx - TS)
      if (y < TS - 1) stack.push(idx + TS)
    }
    setFrames(prev => {
      const next = prev.map(f => [...f])
      next[currentFrame] = px
      return next
    })
  }, [pixels, brush, currentFrame, pushUndo])

  // --- Line (Bresenham) ---
  const bresenhamLine = (x0: number, y0: number, x1: number, y1: number): number[] => {
    const points: number[] = []
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    let cx = x0, cy = y0
    while (true) {
      if (cx >= 0 && cx < TS && cy >= 0 && cy < TS) points.push(cy * TS + cx)
      if (cx === x1 && cy === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; cx += sx }
      if (e2 <= dx) { err += dx; cy += sy }
    }
    return points
  }
  const commitLine = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    pushUndo()
    const points = bresenhamLine(x0, y0, x1, y1)
    setFrames(prev => {
      const next = prev.map(f => [...f])
      for (const idx of points) next[currentFrame][idx] = brush
      return next
    })
  }, [brush, currentFrame, pushUndo])

  // --- Rectangle ---
  const rectPoints = (x0: number, y0: number, x1: number, y1: number, filled: boolean): number[] => {
    const points: number[] = []
    const minX = Math.max(0, Math.min(x0, x1)), maxX = Math.min(TS - 1, Math.max(x0, x1))
    const minY = Math.max(0, Math.min(y0, y1)), maxY = Math.min(TS - 1, Math.max(y0, y1))
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++)
        if (filled || y === minY || y === maxY || x === minX || x === maxX)
          points.push(y * TS + x)
    return points
  }
  const commitRect = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    pushUndo()
    const points = rectPoints(x0, y0, x1, y1, rectFilled)
    setFrames(prev => {
      const next = prev.map(f => [...f])
      for (const idx of points) next[currentFrame][idx] = brush
      return next
    })
  }, [brush, currentFrame, rectFilled, pushUndo])

  // --- Mirror ---
  const mirrorH = useCallback(() => {
    pushUndo()
    setFrames(prev => {
      const next = prev.map(f => [...f])
      const px = next[currentFrame]
      for (let y = 0; y < TS; y++)
        for (let x = 0; x < TS / 2; x++) {
          const a = y * TS + x, b = y * TS + (TS - 1 - x)
          ;[px[a], px[b]] = [px[b], px[a]]
        }
      return next
    })
  }, [currentFrame, pushUndo])
  const mirrorV = useCallback(() => {
    pushUndo()
    setFrames(prev => {
      const next = prev.map(f => [...f])
      const px = next[currentFrame]
      for (let y = 0; y < TS / 2; y++)
        for (let x = 0; x < TS; x++) {
          const a = y * TS + x, b = (TS - 1 - y) * TS + x
          ;[px[a], px[b]] = [px[b], px[a]]
        }
      return next
    })
  }, [currentFrame, pushUndo])

  // --- Rotate 90° CW ---
  const rotateCW = useCallback(() => {
    pushUndo()
    setFrames(prev => {
      const next = prev.map(f => [...f])
      const old = [...next[currentFrame]]
      const px = new Array(1024).fill(0)
      for (let y = 0; y < TS; y++)
        for (let x = 0; x < TS; x++)
          px[x * TS + (TS - 1 - y)] = old[y * TS + x]
      next[currentFrame] = px
      return next
    })
  }, [currentFrame, pushUndo])

  // --- Shift / Nudge ---
  const shiftPixels = useCallback((dx: number, dy: number) => {
    pushUndo()
    setFrames(prev => {
      const next = prev.map(f => [...f])
      const old = [...next[currentFrame]]
      const px = new Array(1024).fill(0)
      for (let y = 0; y < TS; y++)
        for (let x = 0; x < TS; x++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < TS && ny >= 0 && ny < TS)
            px[ny * TS + nx] = old[y * TS + x]
        }
      next[currentFrame] = px
      return next
    })
  }, [currentFrame, pushUndo])

  // --- Shape preview (line/rect drag) ---
  const shapePreview = useMemo(() => {
    if (!shapeStart || !shapeEnd) return new Set<number>()
    if (tool === 'line') return new Set(bresenhamLine(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y))
    if (tool === 'rect') return new Set(rectPoints(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y, rectFilled))
    return new Set<number>()
  }, [shapeStart, shapeEnd, tool, rectFilled])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); e.stopImmediatePropagation(); tRedo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.stopImmediatePropagation(); tUndo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); e.stopImmediatePropagation(); tRedo(); return }
    }
    window.addEventListener('keydown', handler, true) // capture phase to beat map editor
    return () => window.removeEventListener('keydown', handler, true)
  }, [tUndo, tRedo])

  const addFrame = () => {
    setFrames(prev => {
      const next = [...prev, [...prev[currentFrame]]]
      setCurrentFrame(next.length - 1)
      return next
    })
  }

  const deleteFrame = () => {
    if (frames.length <= 1) return
    setFrames(prev => {
      const next = prev.filter((_, i) => i !== currentFrame)
      setCurrentFrame(Math.min(currentFrame, next.length - 1))
      return next
    })
  }

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-faint text-[10px] uppercase tracking-widest">
          {isNew ? 'New Tile' : `Edit: ${initial?.name}`}
        </p>
        <button onClick={onCancel} className="text-[10px] text-text-faint hover:text-white">Close</button>
      </div>

      <div className="flex gap-6">
        <div>
          <div className="flex gap-2 mb-3 items-center flex-wrap">
            <span className="text-[10px] text-text-faint">Brush:</span>
            <button
              onClick={() => setBrush(0)}
              className={`w-6 h-6 rounded border-2 ${brush === 0 ? 'border-gold' : 'border-white/20'}`}
              style={{
                backgroundColor: '#0a0a1a',
                backgroundImage: 'linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%), linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%)',
                backgroundSize: '6px 6px',
                backgroundPosition: '0 0, 3px 3px',
              }}
              title="Transparent (0)"
            />
            {palette.map((c, i) => (
              <div key={i} className="relative group">
                <button
                  onClick={() => setBrush(i + 1)}
                  onDoubleClick={() => document.getElementById(`tile-pal-${i}`)?.click()}
                  className={`w-6 h-6 rounded border-2 ${brush === i + 1 ? 'border-gold' : 'border-white/20'}`}
                  style={{ backgroundColor: c }}
                  title={`Click: select · Double-click: change color · Right-click: remove · ${c}`}
                  onContextMenu={e => { e.preventDefault(); removeColor(i) }}
                />
                <input
                  id={`tile-pal-${i}`}
                  type="color"
                  value={c}
                  onChange={e => updatePalette(i, e.target.value)}
                  className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                  tabIndex={-1}
                />
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] text-text-faint opacity-0 group-hover:opacity-100">
                  {i + 1}
                </span>
              </div>
            ))}
            {palette.length < MAX_COLORS && (
              <button
                onClick={addColor}
                className="w-6 h-6 rounded border-2 border-dashed border-white/20 text-white/30 hover:border-gold/40 hover:text-gold/60 text-sm flex items-center justify-center"
                title={`Add color (${palette.length}/${MAX_COLORS})`}
              >+</button>
            )}
            <span className="text-[9px] text-text-faint ml-1">{palette.length}/{MAX_COLORS}</span>
          </div>

          {/* Tools + Transforms */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="text-[9px] text-text-faint mr-0.5">Tool:</span>
            {(['pencil', 'fill', 'line', 'rect'] as const).map(t => (
              <button key={t} onClick={() => setTool(t)}
                className={`px-2 py-0.5 rounded text-[10px] capitalize ${tool === t ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-white/5 text-text-faint hover:text-text-dim border border-transparent'}`}
              >{t}</button>
            ))}
            {tool === 'rect' && (
              <label className="flex items-center gap-1 ml-1 cursor-pointer">
                <input type="checkbox" checked={rectFilled} onChange={e => setRectFilled(e.target.checked)} className="accent-gold w-3 h-3" />
                <span className="text-[9px] text-text-faint">Filled</span>
              </label>
            )}
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button onClick={tUndo} disabled={tUndoStack.length === 0}
              className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim disabled:opacity-20"
              title="Undo (Ctrl+Z)">Undo</button>
            <button onClick={tRedo} disabled={tRedoStack.length === 0}
              className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim disabled:opacity-20"
              title="Redo (Ctrl+Shift+Z)">Redo</button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <span className="text-[9px] text-text-faint mr-0.5">Transform:</span>
            <button onClick={mirrorH} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim" title="Mirror horizontal">Flip H</button>
            <button onClick={mirrorV} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim" title="Mirror vertical">Flip V</button>
            <button onClick={rotateCW} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim" title="Rotate 90° clockwise">Rot CW</button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <span className="text-[9px] text-text-faint mr-0.5">Nudge:</span>
            <button onClick={() => shiftPixels(-1, 0)} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim" title="Shift left">&#8592;</button>
            <button onClick={() => shiftPixels(0, -1)} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim" title="Shift up">&#8593;</button>
            <button onClick={() => shiftPixels(0, 1)} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim" title="Shift down">&#8595;</button>
            <button onClick={() => shiftPixels(1, 0)} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim" title="Shift right">&#8594;</button>
            <span className="text-[8px] text-text-faint/30 ml-2">Alt+click = eyedropper · Right-click = erase</span>
          </div>

          {/* Frame Navigation */}
          <div className={`flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg border ${
            frames.length > 1 ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-white/[0.02] border-white/5'
          }`}>
            <button
              onClick={() => setCurrentFrame(prev => Math.max(0, prev - 1))}
              disabled={currentFrame === 0}
              className="text-[11px] text-text-faint hover:text-white disabled:opacity-20 px-1"
            >&lt;</button>
            <span className={`text-[11px] font-display min-w-[60px] text-center ${frames.length > 1 ? 'text-cyan-300' : 'text-text-faint'}`}>
              Frame {currentFrame + 1}/{frames.length}
            </span>
            <button
              onClick={() => setCurrentFrame(prev => Math.min(frames.length - 1, prev + 1))}
              disabled={currentFrame >= frames.length - 1}
              className="text-[11px] text-text-faint hover:text-white disabled:opacity-20 px-1"
            >&gt;</button>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={addFrame}
              className="text-[10px] text-cyan-400/80 hover:text-cyan-300 px-1.5"
              title="Add frame (clones current)"
            >+ Frame</button>
            {frames.length > 1 && (
              <button
                onClick={deleteFrame}
                className="text-[10px] text-red-400/60 hover:text-red-300 px-1"
                title="Delete current frame"
              >Del</button>
            )}
            {frames.length > 1 && (
              <>
                <div className="w-px h-4 bg-white/10" />
                <span className="text-[9px] text-text-faint">Speed:</span>
                <input
                  type="number"
                  value={animRate}
                  onChange={e => setAnimRate(Math.max(2, Math.min(60, parseInt(e.target.value) || 12)))}
                  className="bg-[#1a1a2e] border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white w-12 focus:outline-none focus:border-cyan-500/40"
                  title="Ticks per frame (lower = faster, 15 ticks = 1 second)"
                />
              </>
            )}
          </div>

          <div
            className="inline-grid select-none"
            style={{ gridTemplateColumns: `repeat(${TS}, 12px)`, gap: '1px' }}
            onMouseLeave={() => { setPainting(false); setErasing(false); setShapeStart(null); setShapeEnd(null) }}
          >
            {pixels.map((v, i) => {
              const inPreview = shapePreview.has(i)
              const displayValue = inPreview ? brush : v
              return (
                <div
                  key={i}
                  className={`border border-white/5 hover:border-white/30 ${tool === 'fill' ? 'cursor-cell' : tool === 'line' || tool === 'rect' ? 'cursor-crosshair' : 'cursor-crosshair'}`}
                  style={{
                    width: 12, height: 12,
                    backgroundColor: displayValue === 0 ? '#111' : (palette[displayValue - 1] ?? '#111'),
                    backgroundImage: displayValue === 0 ? 'linear-gradient(45deg, #1a1a1a 25%, transparent 25%, transparent 75%, #1a1a1a 75%), linear-gradient(45deg, #1a1a1a 25%, transparent 25%, transparent 75%, #1a1a1a 75%)' : undefined,
                    backgroundSize: displayValue === 0 ? '6px 6px' : undefined,
                    backgroundPosition: displayValue === 0 ? '0 0, 3px 3px' : undefined,
                    opacity: inPreview ? 0.7 : 1,
                  }}
                  onMouseDown={e => {
                    // Alt+click = eyedropper (pick color from canvas)
                    if (e.altKey) {
                      if (v > 0 && v <= palette.length) setBrush(v)
                      return
                    }
                    // Right-click = erase (drag to erase multiple)
                    if (e.button === 2) {
                      e.preventDefault()
                      pushUndo()
                      setErasing(true)
                      setFrames(prev => { const next = prev.map(f => [...f]); next[currentFrame][i] = 0; return next })
                      return
                    }
                    if (tool === 'fill') {
                      floodFill(i)
                    } else if (tool === 'line' || tool === 'rect') {
                      const x = i % TS, y = Math.floor(i / TS)
                      setShapeStart({ x, y })
                      setShapeEnd({ x, y })
                    } else {
                      // Pencil
                      pushUndo()
                      setPainting(true)
                      paint(i)
                    }
                  }}
                  onMouseEnter={() => {
                    if (erasing) {
                      setFrames(prev => { const next = prev.map(f => [...f]); next[currentFrame][i] = 0; return next })
                    } else if (painting && tool === 'pencil') {
                      paint(i)
                    }
                    if (shapeStart) {
                      const x = i % TS, y = Math.floor(i / TS)
                      setShapeEnd({ x, y })
                    }
                  }}
                  onMouseUp={e => {
                    if (e.button === 2) {
                      setErasing(false)
                      return
                    }
                    if (shapeStart && shapeEnd) {
                      if (tool === 'line') commitLine(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y)
                      if (tool === 'rect') commitRect(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y)
                      setShapeStart(null)
                      setShapeEnd(null)
                    }
                    setPainting(false)
                  }}
                  onContextMenu={e => e.preventDefault()}
                />
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-4 items-end">
            <div className="text-center">
              <canvas
                ref={previewRef}
                style={{ imageRendering: 'pixelated', width: TS, height: TS }}
                className="border border-white/10 rounded"
              />
              <span className="text-[9px] text-text-faint block mt-1">1x</span>
            </div>
            <div className="text-center">
              <canvas
                ref={preview3xRef}
                style={{ imageRendering: 'pixelated', width: TS * 3, height: TS * 3 }}
                className="border border-white/10 rounded"
              />
              <span className="text-[9px] text-text-faint block mt-1">3x</span>
            </div>
            <div className="text-center">
              <canvas
                ref={preview6xRef}
                style={{ imageRendering: 'pixelated', width: TS * 6, height: TS * 6 }}
                className="border border-white/10 rounded"
              />
              <span className="text-[9px] text-text-faint block mt-1">6x</span>
            </div>
            {frames.length > 1 && (
              <div className="text-center">
                <canvas
                  ref={animPreviewRef}
                  style={{ imageRendering: 'pixelated', width: TS * 6, height: TS * 6 }}
                  className="border border-cyan-500/30 rounded ring-1 ring-cyan-500/20"
                />
                <span className="text-[9px] text-cyan-400/60 block mt-1">anim</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] text-text-faint block mb-1">Tile Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Fence, Tree Top..."
              className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-[12px] text-white w-48 focus:outline-none focus:border-gold/40"
            />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="text-[10px] text-text-faint block mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="bg-[#1a1a2e] border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-gold/40"
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#1a1a2e] text-white">{c.label}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={solid}
                onChange={e => setSolid(e.target.checked)}
                className="accent-red-400"
              />
              <span className="text-[11px] text-text-dim">Solid</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={above}
                onChange={e => setAbove(e.target.checked)}
                className="accent-violet-400"
              />
              <span className="text-[11px] text-text-dim">Above</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFrames(prev => {
                const next = prev.map(f => [...f])
                next[currentFrame] = new Array(1024).fill(0)
                return next
              })}
              className="px-3 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10"
            >Clear</button>
            <button
              onClick={() => setFrames(prev => {
                const next = prev.map(f => [...f])
                next[currentFrame] = new Array(1024).fill(brush)
                return next
              })}
              className="px-3 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10"
            >Fill brush</button>
          </div>

          <button
            onClick={() => {
              if (!name.trim()) return
              onSave(name.trim(), frames, palette, solid, above, category, animRate)
            }}
            disabled={!name.trim()}
            className="px-5 py-2 rounded text-[12px] bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 font-display disabled:opacity-30 self-start"
          >
            {isNew ? 'Add Tile' : 'Update Tile'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MapPreview({ grid, tiles, scale, highlightTile }: {
  grid: number[][]
  tiles: EditorTile[]
  scale: number
  highlightTile?: { x: number; y: number } | null
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = cols * TS; c.height = rows * TS
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, c.width, c.height)

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const val = grid[ty]?.[tx] ?? 0
        const idx = val & 0xFF
        const rot = (val >> 8) & 3
        const et = tiles[idx]
        if (et) renderTileTo(ctx, et.tile, tx * TS, ty * TS, rot)
      }
    }

    if (highlightTile) {
      ctx.strokeStyle = '#d4a843'
      ctx.lineWidth = 1
      ctx.strokeRect(highlightTile.x * TS + 0.5, highlightTile.y * TS + 0.5, TS - 1, TS - 1)
    }
  }, [grid, tiles, cols, rows, highlightTile])

  return (
    <canvas
      ref={ref}
      className="border border-white/10 rounded-lg"
      style={{ imageRendering: 'pixelated', width: cols * TS * scale, height: rows * TS * scale }}
    />
  )
}

export default function MapEditor() {
  const [tiles, setTiles] = useState<EditorTile[]>(builtInTiles)
  const [grid, setGrid] = useState<number[][]>(() => GARDEN.map(row => [...row]))
  const [gridDirty, setGridDirty] = useState(false)
  // Layout mode default: start in IntGrid/region-paint mode with Grass selected
  const [brush, setBrush] = useSessionState('map:brush', 1)
  const [painting, setPainting] = useState(false)
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null)
  const [showGrid, setShowGrid] = useSessionState('map:showGrid', true)
  const [previewScale, setPreviewScale] = useSessionState('map:previewScale', 3)
  const [copied, setCopied] = useState('')
  const [workshopOpen, setWorkshopOpen] = useState(false)
  const [editingTileIdx, setEditingTileIdx] = useState<number | null>(null)
  const [cloneSourceIdx, setCloneSourceIdx] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'building' | 'saved' | 'error'>('idle')
  const [loadStatus, setLoadStatus] = useState<string>('')
  const [rotation, setRotation] = useSessionState('map:rotation', 0)
  const [activeMap, setActiveMap] = useSessionState('map:activeMap', 'garden')
  // Deep-link from the in-game "Edit Map" pill: ?zone=<id> overrides the persisted active map
  // so Alex lands on the zone he was standing in. Runs once on mount.
  useEffect(() => {
    const z = new URLSearchParams(window.location.search).get('zone')
    if (z && ZONES.some(zo => zo.id === z)) setActiveMap(z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [showPreview, setShowPreview] = useState(false)
  // Advanced drawer: furniture/item/node/structure/stamp/zonechest — hidden by default.
  // Auto-open if session restores an advanced brush type.
  const [brushType, setBrushType] = useSessionState<'tile' | 'item' | 'node' | 'eraser' | 'structure' | 'stamp' | 'furniture' | 'zonechest'>('map:brushType', 'tile')
  const [showAdvancedBrushes, setShowAdvancedBrushes] = useState(
    () => (['item', 'node', 'structure', 'stamp', 'furniture', 'zonechest'] as const).includes(
      (typeof window !== 'undefined' ? sessionStorage.getItem('map:brushType') : null) as never
    )
  )
  const [brushItemId, setBrushItemId] = useSessionState<string | null>('map:brushItemId', null)
  const [brushNodeType, setBrushNodeType] = useSessionState<string | null>('map:brushNodeType', null)
  const [brushStructureId, setBrushStructureId] = useSessionState<string | null>('map:brushStructureId', null)
  const [brushFurnitureId, setBrushFurnitureId] = useSessionState<string | null>('map:brushFurnitureId', null)
  const [brushChestType, setBrushChestType] = useSessionState<string>('map:brushChestType', 'chest')
  const [brushChestClaimable, setBrushChestClaimable] = useSessionState<boolean>('map:brushChestClaimable', true)
  const [structures, setStructures] = useState<TileGroup[]>([])
  const [placedStructures, setPlacedStructures] = useState<Array<{ structureId: string, x: number, y: number }>>([])
  const [placedFurniture, setPlacedFurniture] = useState<Array<{ furnitureId: string, x: number, y: number }>>([])
  const [placedZoneChests, setPlacedZoneChests] = useState<Array<{ chestType: string, x: number, y: number, claimable?: boolean }>>([])
  const [recentBrushes, setRecentBrushes] = useState<BrushEntry[]>([])

  // Stamp system
  const [stamps, setStamps] = useState<Stamp[]>([])
  const [activeStampId, setActiveStampId] = useState<string | null>(null)
  const [randomVariant, setRandomVariant] = useState(false)
  const [stampHotkeys, setStampHotkeys] = useState<(string | null)[]>([null, null, null, null, null, null])

  // Auto-layer system
  const [intGrid, setIntGrid] = useState<number[][]>(() => {
    const persisted = ZONE_INTGRIDS['garden']
    if (persisted && persisted.length > 0) return persisted.map(r => [...r])
    return GARDEN.map(row => row.map(() => 0))
  })
  // Default to IntGrid/region-paint mode so the editor opens in layout workflow
  const [showIntGrid, setShowIntGrid] = useState(true)
  const [autoLayerRules, setAutoLayerRules] = useState<AutoLayerRule[]>(() => DEFAULT_AUTOLAYER_RULES)
  const INT_VALUES = [
    { value: 1, label: 'Grass', color: '#5bbd6e' },
    { value: 2, label: 'Path', color: '#c8a96e' },
    { value: 3, label: 'Water', color: '#4a9fc8' },
  ]
  const [itemPlacements, setItemPlacements] = useState<Array<{ itemId: string, x: number, y: number }>>([])

  const [nodePlacements, setNodePlacements] = useState<Array<{ nodeType: string, x: number, y: number }>>(
    () => (ZONE_NODES['garden'] ?? []).map(n => ({ nodeType: n.type, x: n.tileX, y: n.tileY }))
  )

  const [warpPlacements, setWarpPlacements] = useState<WarpPlacement[]>(() => hydrateWarps('garden'))

  // Dynamic zone list — starts from build-time imports, grows with create
  const [zoneMaps, setZoneMaps] = useState(INITIAL_ZONE_MAPS)
  const [showCreateZone, setShowCreateZone] = useState(false)
  const [newZoneName, setNewZoneName] = useState('')
  const [newZoneCols, setNewZoneCols] = useState(25)
  const [newZoneRows, setNewZoneRows] = useState(20)
  const [zoneActionStatus, setZoneActionStatus] = useState<string>('')

  // Undo/redo state
  const [undoStack, setUndoStack] = useState<Array<{ grid: number[][]; items: typeof itemPlacements; nodes: typeof nodePlacements; warps: WarpPlacement[] }>>([])
  const [redoStack, setRedoStack] = useState<Array<{ grid: number[][]; items: typeof itemPlacements; nodes: typeof nodePlacements; warps: WarpPlacement[] }>>([])
  const MAX_UNDO = 30

  // Selection tool state
  const [editorTool, setEditorTool] = useSessionState<'paint' | 'select'>('map:editorTool', 'paint')
  const [selection, setSelection] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null)
  const [moveDrag, setMoveDrag] = useState<{ startX: number; startY: number; ox: number; oy: number; clipboard: number[][]; items: Array<{ itemId: string; x: number; y: number }>; nodes: Array<{ nodeType: string; x: number; y: number }> } | null>(null)

  const [warpEnabled, setWarpEnabled] = useSessionState('map:warpEnabled', false)
  const [warpConfig, setWarpConfig] = useState({
    toZone: 'mycelial-path',
    toX: 1,
    toY: 1,
    direction: 'down',
    requiredFlag: '',
  })

  // Keep warpConfig.toZone in sync with the dropdown's available options.
  // The dropdown filters out activeMap; if state still holds activeMap (or any zone
  // not in zoneMaps), the <select> renders the first visible option but state stays
  // stale — every painted warp would save with the wrong destination.
  useEffect(() => {
    setWarpConfig(prev => {
      const valid = zoneMaps.some(z => z.id === prev.toZone) && prev.toZone !== activeMap
      if (valid) return prev
      const fallback = zoneMaps.find(z => z.id !== activeMap)?.id
      if (!fallback || fallback === prev.toZone) return prev
      return { ...prev, toZone: fallback }
    })
  }, [activeMap, zoneMaps])

  // Gate: don't persist to IndexedDB until initial load completes,
  // otherwise the default state overwrites cached work.
  const loadedRef = useRef(false)

  // Persist to IndexedDB (only after initial load)
  useEffect(() => {
    if (!loadedRef.current) return
    saveState('map-state', `items-${activeMap}`, itemPlacements).catch(() => {})
  }, [itemPlacements, activeMap])

  useEffect(() => {
    if (!loadedRef.current) return
    saveState('map-state', `nodes-${activeMap}`, nodePlacements).catch(() => {})
  }, [nodePlacements, activeMap])

  useEffect(() => {
    if (!loadedRef.current) return
    saveState('map-state', `structures-${activeMap}`, placedStructures).catch(() => {})
  }, [placedStructures, activeMap])

  useEffect(() => {
    if (!loadedRef.current) return
    saveState('map-state', `furniture-${activeMap}`, placedFurniture).catch(() => {})
  }, [placedFurniture, activeMap])

  useEffect(() => {
    if (!loadedRef.current) return
    saveState('map-state', `zonechests-${activeMap}`, placedZoneChests).catch(() => {})
  }, [placedZoneChests, activeMap])

  useEffect(() => {
    if (!loadedRef.current) return
    saveState('map-state', `warps-${activeMap}`, warpPlacements).catch(() => {})
  }, [warpPlacements, activeMap])

  // Persist grid to IndexedDB (debounced — grids can be large)
  useEffect(() => {
    if (!loadedRef.current) return
    const t = setTimeout(() => {
      saveState('map-state', `grid-${activeMap}`, grid).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [grid, activeMap])

  // Keep refs for snapshot capture (avoids stale closures)
  const activeMapRef = useRef(activeMap)
  useEffect(() => { activeMapRef.current = activeMap }, [activeMap])
  const gridRef = useRef(grid)
  const itemsRef = useRef(itemPlacements)
  const nodesRef = useRef(nodePlacements)
  const warpsRef = useRef(warpPlacements)
  useEffect(() => { gridRef.current = grid }, [grid])
  useEffect(() => { itemsRef.current = itemPlacements }, [itemPlacements])
  useEffect(() => { nodesRef.current = nodePlacements }, [nodePlacements])
  useEffect(() => { warpsRef.current = warpPlacements }, [warpPlacements])

  const pushMapSnapshot = useCallback(() => {
    const snap = {
      grid: gridRef.current.map(r => [...r]),
      items: [...itemsRef.current],
      nodes: [...nodesRef.current],
      warps: [...warpsRef.current],
    }
    setUndoStack(prev => {
      const next = [...prev, snap]
      if (next.length > MAX_UNDO) next.shift()
      return next
    })
    setRedoStack([])
  }, [])

  const undoMap = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      const snap = prev[prev.length - 1]
      setRedoStack(r => [...r, {
        grid: gridRef.current.map(row => [...row]),
        items: [...itemsRef.current],
        nodes: [...nodesRef.current],
        warps: [...warpsRef.current],
      }])
      setGrid(snap.grid.map(r => [...r]))
      setItemPlacements([...snap.items])
      setNodePlacements([...snap.nodes])
      setWarpPlacements([...snap.warps])
      return prev.slice(0, -1)
    })
  }, [])

  const redoMap = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev
      const snap = prev[prev.length - 1]
      setUndoStack(u => [...u, {
        grid: gridRef.current.map(row => [...row]),
        items: [...itemsRef.current],
        nodes: [...nodesRef.current],
        warps: [...warpsRef.current],
      }])
      setGrid(snap.grid.map(r => [...r]))
      setItemPlacements([...snap.items])
      setNodePlacements([...snap.nodes])
      setWarpPlacements([...snap.warps])
      return prev.slice(0, -1)
    })
  }, [])

  // Mark dirty when grid changes (reset on save/load)
  useEffect(() => {
    setGridDirty(true)
  }, [grid])

  // Warn on page unload if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (gridDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [gridDirty])

  // Load stamps from IndexedDB
  useEffect(() => {
    listKeys('stamps').then(async keys => {
      const loaded: Stamp[] = []
      for (const key of keys) {
        const entry = await loadState('stamps', key).catch(() => null)
        if (entry?.data) loaded.push(entry.data)
      }
      setStamps(loaded)
    }).catch(() => {})
  }, [])

  // Load structures from API
  useEffect(() => {
    fetch('/shimmer/save-structure')
      .then(r => r.json())
      .then(d => setStructures(d.structures || []))
      .catch(() => {})
  }, [])

  const saveAsStamp = useCallback((name: string, variantGroup?: string) => {
    if (!selection) return
    const w = selection.x2 - selection.x1 + 1
    const h = selection.y2 - selection.y1 + 1
    const cells: (number | null)[][] = []
    for (let r = 0; r < h; r++) {
      cells[r] = []
      for (let c = 0; c < w; c++) {
        const val = grid[selection.y1 + r]?.[selection.x1 + c] ?? 0
        cells[r][c] = val === 0 ? null : val
      }
    }
    const stamp: Stamp = {
      id: `stamp_${Date.now().toString(36)}`,
      name,
      cells,
      rows: h,
      cols: w,
      variantGroup: variantGroup || undefined,
    }
    setStamps(prev => [...prev, stamp])
    saveState('stamps', stamp.id, stamp).catch(() => {})
    setActiveStampId(stamp.id)
    setBrushType('stamp')
  }, [selection, grid])

  const deleteStamp = useCallback((id: string) => {
    setStamps(prev => prev.filter(s => s.id !== id))
    deleteState('stamps', id).catch(() => {})
    if (activeStampId === id) setActiveStampId(null)
    setStampHotkeys(prev => prev.map(hk => hk === id ? null : hk))
  }, [activeStampId])

  const selectStampBrush = useCallback((id: string) => {
    setActiveStampId(id)
    setBrushType('stamp')
  }, [])

  const selectBrush = useCallback((entry: BrushEntry) => {
    setBrushType(entry.type)
    if (entry.type === 'tile' && entry.tileIdx !== undefined) setBrush(entry.tileIdx)
    if (entry.type === 'item' && entry.itemId) setBrushItemId(entry.itemId)
    if (entry.type === 'node' && entry.nodeType) setBrushNodeType(entry.nodeType)
    if (entry.type === 'structure' && entry.structureId) setBrushStructureId(entry.structureId)
    if (entry.type === 'furniture' && entry.furnitureId) setBrushFurnitureId(entry.furnitureId)
    if (entry.type === 'zonechest' && entry.chestType) setBrushChestType(entry.chestType)
    if (entry.type === 'stamp' && entry.stampId) setActiveStampId(entry.stampId)
    setRecentBrushes(prev => {
      const key = brushKey(entry)
      const filtered = prev.filter(e => brushKey(e) !== key)
      return [entry, ...filtered].slice(0, 15)
    })
  }, [])

  const dropdownValue = brushType === 'eraser' ? 'eraser'
    : brushType === 'item' ? `item:${brushItemId}`
    : brushType === 'node' ? `node:${brushNodeType}`
    : brushType === 'structure' ? `struct:${brushStructureId}`
    : brushType === 'furniture' ? `furn:${brushFurnitureId}`
    : brushType === 'zonechest' ? `zc:${brushChestType}`
    : `tile:${brush}`

  const handleDropdownChange = useCallback((val: string) => {
    if (val === 'eraser') selectBrush({ type: 'eraser' })
    else if (val.startsWith('item:')) selectBrush({ type: 'item', itemId: val.slice(5) })
    else if (val.startsWith('node:')) selectBrush({ type: 'node', nodeType: val.slice(5) })
    else if (val.startsWith('struct:')) selectBrush({ type: 'structure', structureId: val.slice(7) })
    else if (val.startsWith('furn:')) selectBrush({ type: 'furniture', furnitureId: val.slice(5) })
    else if (val.startsWith('zc:')) selectBrush({ type: 'zonechest', chestType: val.slice(3) })
    else if (val.startsWith('tile:')) selectBrush({ type: 'tile', tileIdx: parseInt(val.slice(5)) })
  }, [selectBrush])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); redoMap(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoMap(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redoMap(); return }
      if (e.key === 'r' || e.key === 'R') {
        setRotation(prev => (prev + 1) % 4)
      } else if (e.key === 'v' || e.key === 'V') {
        setEditorTool('select')
      } else if (e.key === 'b' || e.key === 'B') {
        setEditorTool('paint')
        setSelection(null); setSelStart(null); setMoveDrag(null)
      } else if (e.key === 'Escape') {
        if (selection) { setSelection(null); setSelStart(null); setMoveDrag(null) }
        else setEditorTool('paint')
      } else if (e.key === 'Delete' && selection) {
        pushMapSnapshot()
        setGrid(prev => {
          const next = prev.map(r => [...r])
          for (let ty = selection.y1; ty <= selection.y2; ty++)
            for (let tx = selection.x1; tx <= selection.x2; tx++)
              if (ty >= 0 && ty < next.length && tx >= 0 && tx < (next[0]?.length ?? 0))
                next[ty][tx] = 0
          return next
        })
      } else if (e.key >= '1' && e.key <= '6') {
        const slot = parseInt(e.key) - 1
        const hkId = stampHotkeys[slot]
        if (hkId && stamps.some(s => s.id === hkId)) {
          selectStampBrush(hkId)
          setEditorTool('paint')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selection, undoMap, redoMap, pushMapSnapshot, stampHotkeys, stamps, selectStampBrush])

  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  const paintIntGrid = useCallback((tx: number, ty: number, value: number) => {
    setIntGrid(prev => {
      const next = prev.map(r => [...r])
      if (ty >= 0 && ty < next.length && tx >= 0 && tx < (next[0]?.length ?? 0)) {
        next[ty][tx] = value
      }
      // Run auto-layer rules on affected cells
      const updates = evaluateAffected(next, tx, ty, autoLayerRules)
      if (updates.length > 0) {
        setGrid(gPrev => {
          const gNext = gPrev.map(r => [...r])
          for (const u of updates) {
            if (u.y >= 0 && u.y < gNext.length && u.x >= 0 && u.x < (gNext[0]?.length ?? 0)) {
              gNext[u.y][u.x] = u.tileIdx | (u.rotation << 8)
            }
          }
          return gNext
        })
      }
      return next
    })
  }, [autoLayerRules])

  const paintTile = useCallback((tx: number, ty: number) => {
    // IntGrid mode: paint semantic values instead of tiles
    if (showIntGrid) {
      paintIntGrid(tx, ty, brush)
      return
    }
    if (brushType === 'eraser') {
      setGrid(prev => {
        const next = prev.map(r => [...r])
        if (ty >= 0 && ty < next.length && tx >= 0 && tx < (next[0]?.length ?? 0)) {
          next[ty][tx] = 0
        }
        return next
      })
      setItemPlacements(prev => prev.filter(p => !(p.x === tx && p.y === ty)))
      setNodePlacements(prev => prev.filter(p => !(p.x === tx && p.y === ty)))
      setWarpPlacements(prev => prev.filter(p => !(p.fromX === tx && p.fromY === ty)))
      // Remove placed structures whose footprint covers this tile
      setPlacedStructures(prev => prev.filter(ps => {
        const s = structures.find(st => st.id === ps.structureId)
        if (!s) return true
        return !(tx >= ps.x && tx < ps.x + s.cols && ty >= ps.y && ty < ps.y + s.rows)
      }))
      setPlacedFurniture(prev => prev.filter(p => !(p.x === tx && p.y === ty)))
      setPlacedZoneChests(prev => prev.filter(p => !(p.x === tx && p.y === ty)))
    } else if (brushType === 'item' && brushItemId) {
      setItemPlacements(prev => {
        const existing = prev.findIndex(p => p.x === tx && p.y === ty)
        if (existing >= 0) {
          if (prev[existing].itemId === brushItemId) {
            return prev.filter((_, i) => i !== existing)
          }
          return prev.map((p, i) => i === existing ? { ...p, itemId: brushItemId } : p)
        }
        return [...prev, { itemId: brushItemId, x: tx, y: ty }]
      })
    } else if (brushType === 'node' && brushNodeType) {
      setNodePlacements(prev => {
        const existing = prev.findIndex(p => p.x === tx && p.y === ty)
        if (existing >= 0) {
          if (prev[existing].nodeType === brushNodeType) {
            return prev.filter((_, i) => i !== existing)
          }
          return prev.map((p, i) => i === existing ? { ...p, nodeType: brushNodeType } : p)
        }
        return [...prev, { nodeType: brushNodeType, x: tx, y: ty }]
      })
    } else if (brushType === 'stamp') {
      let stamp: Stamp | undefined
      if (randomVariant && activeStampId) {
        const active = stamps.find(s => s.id === activeStampId)
        if (active?.variantGroup) {
          const variants = stamps.filter(s => s.variantGroup === active.variantGroup)
          stamp = variants[Math.floor(Math.random() * variants.length)]
        } else {
          stamp = active
        }
      } else {
        stamp = stamps.find(s => s.id === activeStampId)
      }
      if (stamp) {
        setGrid(prev => {
          const next = prev.map(r => [...r])
          const maxR = next.length, maxC = next[0]?.length ?? 0
          for (let r = 0; r < stamp.rows; r++) {
            for (let c = 0; c < stamp.cols; c++) {
              const val = stamp.cells[r]?.[c]
              if (val == null) continue
              const ny = ty + r, nx = tx + c
              if (ny >= 0 && ny < maxR && nx >= 0 && nx < maxC) {
                next[ny][nx] = val
              }
            }
          }
          return next
        })
      }
    } else if (brushType === 'structure' && brushStructureId) {
      const s = structures.find(x => x.id === brushStructureId)
      if (s) {
        setPlacedStructures(prev => [...prev, { structureId: brushStructureId, x: tx, y: ty }])
        setGridDirty(true)
      }
    } else if (brushType === 'furniture' && brushFurnitureId) {
      setPlacedFurniture(prev => {
        const filtered = prev.filter(p => !(p.x === tx && p.y === ty))
        return [...filtered, { furnitureId: brushFurnitureId, x: tx, y: ty }]
      })
      setGridDirty(true)
    } else if (brushType === 'zonechest' && brushChestType) {
      setPlacedZoneChests(prev => {
        const existing = prev.findIndex(p => p.x === tx && p.y === ty)
        if (existing !== -1) {
          // Toggle off if same spot and same type
          if (prev[existing].chestType === brushChestType && prev[existing].claimable === brushChestClaimable) {
            return prev.filter((_, i) => i !== existing)
          }
          return prev.map((p, i) => i === existing ? { ...p, chestType: brushChestType, claimable: brushChestClaimable || undefined } : p)
        }
        return [...prev, { chestType: brushChestType, x: tx, y: ty, claimable: brushChestClaimable || undefined }]
      })
      setGridDirty(true)
    } else {
      setGrid(prev => {
        const next = prev.map(r => [...r])
        if (ty >= 0 && ty < next.length && tx >= 0 && tx < (next[0]?.length ?? 0)) {
          next[ty][tx] = brush | (rotation << 8)
        }
        return next
      })
      if (warpEnabled) {
        setWarpPlacements(prev => {
          const filtered = prev.filter(p => !(p.fromX === tx && p.fromY === ty))
          return [...filtered, {
            fromX: tx, fromY: ty,
            toZone: warpConfig.toZone,
            toX: warpConfig.toX,
            toY: warpConfig.toY,
            direction: warpConfig.direction,
            requiredFlag: warpConfig.requiredFlag || undefined,
          }]
        })
      }
    }
  }, [brush, rotation, brushType, brushItemId, brushNodeType, brushStructureId, brushChestType, brushChestClaimable, structures, warpEnabled, warpConfig, activeStampId, randomVariant, stamps, showIntGrid, paintIntGrid])

  const resize = useCallback((newCols: number, newRows: number) => {
    pushMapSnapshot()
    setGrid(prev => {
      const result: number[][] = []
      for (let y = 0; y < newRows; y++) {
        const row: number[] = []
        for (let x = 0; x < newCols; x++) row.push(prev[y]?.[x] ?? 0)
        result.push(row)
      }
      return result
    })
    setIntGrid(prev => {
      const result: number[][] = []
      for (let y = 0; y < newRows; y++) {
        const row: number[] = []
        for (let x = 0; x < newCols; x++) row.push(prev[y]?.[x] ?? 0)
        result.push(row)
      }
      return result
    })
  }, [pushMapSnapshot])

  const fillAll = useCallback(() => {
    pushMapSnapshot()
    setGrid(prev => prev.map(row => row.map(() => brush | (rotation << 8))))
  }, [brush, rotation, pushMapSnapshot])

  // Selection operations
  const fillSelection = useCallback(() => {
    if (!selection) return
    pushMapSnapshot()
    setGrid(prev => {
      const next = prev.map(r => [...r])
      for (let ty = selection.y1; ty <= selection.y2; ty++)
        for (let tx = selection.x1; tx <= selection.x2; tx++)
          if (ty >= 0 && ty < next.length && tx >= 0 && tx < (next[0]?.length ?? 0))
            next[ty][tx] = brush | (rotation << 8)
      return next
    })
  }, [selection, brush, rotation, pushMapSnapshot])

  const rotateSelection = useCallback((dir: 1 | -1) => {
    if (!selection) return
    pushMapSnapshot()
    const { x1, y1, x2, y2 } = selection
    const w = x2 - x1 + 1
    const h = y2 - y1 + 1
    setGrid(prev => {
      const next = prev.map(r => [...r])
      // Extract sub-grid
      const sub: number[][] = []
      for (let y = 0; y < h; y++) {
        sub[y] = []
        for (let x = 0; x < w; x++)
          sub[y][x] = prev[y1 + y]?.[x1 + x] ?? 0
      }
      // Rotate: CW = new[x][h-1-y] = old[y][x], CCW = new[w-1-x][y] = old[y][x]
      const nw = h, nh = w  // dimensions swap
      const rotated: number[][] = Array.from({ length: nh }, () => new Array(nw).fill(0))
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const val = sub[y][x]
          const tileRot = (val >> 8) & 3
          const tileIdx = val & 0xFF
          const newRot = dir === 1 ? (tileRot + 1) % 4 : (tileRot + 3) % 4
          const packed = tileIdx | (newRot << 8)
          if (dir === 1) rotated[x][h - 1 - y] = packed  // CW
          else rotated[w - 1 - x][y] = packed              // CCW
        }
      }
      // Write back — clear old area first, then write rotated
      for (let y = y1; y <= y1 + Math.max(h, nh) - 1; y++)
        for (let x = x1; x <= x1 + Math.max(w, nw) - 1; x++)
          if (y >= 0 && y < next.length && x >= 0 && x < (next[0]?.length ?? 0))
            next[y][x] = 0
      for (let y = 0; y < nh; y++)
        for (let x = 0; x < nw; x++)
          if (y1 + y >= 0 && y1 + y < next.length && x1 + x >= 0 && x1 + x < (next[0]?.length ?? 0))
            next[y1 + y][x1 + x] = rotated[y][x]
      return next
    })
    // Update selection bounds to match new dimensions
    setSelection({ x1, y1, x2: x1 + h - 1, y2: y1 + w - 1 })
  }, [selection, pushMapSnapshot])

  const clearSelection = useCallback(() => {
    if (!selection) return
    pushMapSnapshot()
    setGrid(prev => {
      const next = prev.map(r => [...r])
      for (let ty = selection.y1; ty <= selection.y2; ty++)
        for (let tx = selection.x1; tx <= selection.x2; tx++)
          if (ty >= 0 && ty < next.length && tx >= 0 && tx < (next[0]?.length ?? 0))
            next[ty][tx] = 0
      return next
    })
    setItemPlacements(prev => prev.filter(p => !(p.x >= selection.x1 && p.x <= selection.x2 && p.y >= selection.y1 && p.y <= selection.y2)))
    setNodePlacements(prev => prev.filter(p => !(p.x >= selection.x1 && p.x <= selection.x2 && p.y >= selection.y1 && p.y <= selection.y2)))
  }, [selection, pushMapSnapshot])

  const resetToDefault = useCallback(() => {
    pushMapSnapshot()
    const defaultGrid = ZONE_DEFAULTS[activeMap] ?? GARDEN
    setGrid(defaultGrid.map(row => [...row]))
    setTiles(builtInTiles())
  }, [activeMap, pushMapSnapshot])

  const loadLiveData = useCallback(async () => {
    try {
      setLoadStatus('loading...')
      const res = await fetch('/shimmer/save-map?type=all')
      const data = await res.json()
      if (data.error) { setLoadStatus('failed'); return }

      if (data.tiles?.length) {
        setTiles(data.tiles.map((t: { name: string; palette: string[]; digits: string; solid: boolean; above?: boolean; category?: string; frames?: string[]; animRate?: number }) => {
          const parseDigits = (d: string) => {
            const clean = d.replace(/[^0-9a-fA-F]/g, '')
            const px = new Uint8Array(1024)
            if (clean.length <= 256) {
              // 16x16 source — upscale 2x to 32x32 for editor
              for (let y = 0; y < 16; y++)
                for (let x = 0; x < 16; x++) {
                  const v = parseInt(clean[y * 16 + x] || '0', 16)
                  px[(y * 2) * 32 + (x * 2)] = v
                  px[(y * 2) * 32 + (x * 2 + 1)] = v
                  px[(y * 2 + 1) * 32 + (x * 2)] = v
                  px[(y * 2 + 1) * 32 + (x * 2 + 1)] = v
                }
            } else {
              // Native 32x32
              for (let i = 0; i < 1024 && i < clean.length; i++) px[i] = parseInt(clean[i], 16)
            }
            return px
          }
          const pixels = parseDigits(t.digits)
          const frames = t.frames && t.frames.length > 1 ? t.frames.map(parseDigits) : undefined
          return {
            name: t.name,
            tile: { pixels, palette: t.palette, frames, animRate: t.animRate },
            solid: t.solid,
            above: t.above ?? false,
            category: t.category ?? '',
          } as EditorTile
        }))
      }

      // Bail out if user switched away from garden while we were fetching
      if (activeMapRef.current !== 'garden') {
        setLoadStatus('live')
        return
      }

      // Only load server grid if no cached local edits exist
      // loadLiveData is only called for garden zone
      if (data.grid?.length) {
        const cached = await loadState('map-state', 'grid-garden').catch(() => null)
        if (!cached) {
          setGrid(data.grid)
        }
      }

      // Restore cached placements from IndexedDB
      const [cachedItems, cachedNodes, cachedWarps, cachedGrid, cachedStructures, cachedFurniture, cachedZoneChests] = await Promise.all([
        loadState('map-state', 'items-garden').catch(() => null),
        loadState('map-state', 'nodes-garden').catch(() => null),
        loadState('map-state', 'warps-garden').catch(() => null),
        loadState('map-state', 'grid-garden').catch(() => null),
        loadState('map-state', 'structures-garden').catch(() => null),
        loadState('map-state', 'furniture-garden').catch(() => null),
        loadState('map-state', 'zonechests-garden').catch(() => null),
      ])
      // Double-check we're still on garden after second async batch
      if (activeMapRef.current !== 'garden') {
        setLoadStatus('live')
        return
      }
      if (cachedItems?.data) setItemPlacements(cachedItems.data)
      if (cachedNodes?.data) setNodePlacements(cachedNodes.data)
      if (cachedWarps?.data) setWarpPlacements(cachedWarps.data)
      if (cachedGrid?.data) setGrid(cachedGrid.data)
      if (cachedStructures?.data) setPlacedStructures(cachedStructures.data)
      if (cachedFurniture?.data) setPlacedFurniture(cachedFurniture.data)
      if (cachedZoneChests?.data) setPlacedZoneChests(cachedZoneChests.data)

      setLoadStatus('live')
      setGridDirty(!!cachedGrid)
    } catch {
      setLoadStatus('failed')
    }
  }, [])

  useEffect(() => {
    loadLiveData().then(async () => {
      // If session restored a non-garden zone, load that zone's data
      if (activeMapRef.current !== 'garden') {
        await switchMap(activeMapRef.current)
      }
      // Enable persistence now that real data is loaded
      loadedRef.current = true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchMap = useCallback(async (mapId: string) => {
    // Pause persistence while loading to prevent defaults overwriting cached work
    loadedRef.current = false

    setActiveMap(mapId)
    setGridDirty(false)
    setUndoStack([])
    setRedoStack([])
    setShowIntGrid(false)
    // Restore persisted IntGrid for this zone if available, else zero-fill to grid size
    {
      const zoneRef = ZONES.find(z => z.id === mapId)
      const persisted = ZONE_INTGRIDS[mapId]
      if (persisted && persisted.length > 0) {
        setIntGrid(persisted.map(r => [...r]))
      } else if (zoneRef) {
        const rows = zoneRef.grid.length
        const cols = zoneRef.grid[0]?.length ?? 0
        setIntGrid(Array.from({ length: rows }, () => new Array(cols).fill(0)))
      } else {
        setIntGrid([])
      }
    }
    // Immediately show the default grid to prevent stale blending
    const defaultGrid = ZONE_DEFAULTS[mapId]?.map(r => [...r]) ?? GARDEN.map(r => [...r])
    setGrid(defaultGrid)
    setItemPlacements((ZONE_PICKUPS[mapId] ?? []).map(p => ({ itemId: p.itemId, x: p.tileX, y: p.tileY })))
    setNodePlacements((ZONE_NODES[mapId] ?? []).map(n => ({ nodeType: n.type, x: n.tileX, y: n.tileY })))
    setWarpPlacements(hydrateWarps(mapId))
    setPlacedStructures((STRUCTURE_PLACEMENTS[mapId] ?? []).map(s => ({ structureId: s.structureId, x: s.tileX, y: s.tileY })))
    setPlacedFurniture([])
    setPlacedZoneChests((ZONE_CHESTS[mapId] ?? []).map(c => ({ chestType: c.chestType, x: c.tileX, y: c.tileY, claimable: c.claimable })))

    // Load cached placements from IndexedDB (overrides defaults if present)
    const [cachedItems, cachedNodes, cachedWarps, cachedStructures, cachedFurniture, cachedZoneChests] = await Promise.all([
      loadState('map-state', `items-${mapId}`).catch(() => null),
      loadState('map-state', `nodes-${mapId}`).catch(() => null),
      loadState('map-state', `warps-${mapId}`).catch(() => null),
      loadState('map-state', `structures-${mapId}`).catch(() => null),
      loadState('map-state', `furniture-${mapId}`).catch(() => null),
      loadState('map-state', `zonechests-${mapId}`).catch(() => null),
    ])
    if (cachedItems?.data) setItemPlacements(cachedItems.data)
    if (cachedNodes?.data) setNodePlacements(cachedNodes.data)
    if (cachedWarps?.data) setWarpPlacements(cachedWarps.data)
    if (cachedStructures?.data) setPlacedStructures(cachedStructures.data)
    if (cachedFurniture?.data) setPlacedFurniture(cachedFurniture.data)
    if (cachedZoneChests?.data) setPlacedZoneChests(cachedZoneChests.data)

    // Garden always goes through loadLiveData (which loads tiles + respects grid cache)
    if (mapId === 'garden') {
      await loadLiveData()
      loadedRef.current = true
      return
    }

    // Non-garden: try IndexedDB grid first (preserves unsaved work)
    const cachedGrid = await loadState('map-state', `grid-${mapId}`).catch(() => null)
    if (cachedGrid?.data) {
      setGrid(cachedGrid.data)
      setGridDirty(true)
      loadedRef.current = true
      return
    }

    try {
      const res = await fetch(`/shimmer/save-map?type=map&map=${mapId}`)
      const data = await res.json()
      if (data.grid?.length) setGrid(data.grid)
    } catch {
      // default grid already set above
    }
    loadedRef.current = true
  }, [loadLiveData])

  const createZone = useCallback(async () => {
    if (!newZoneName.trim()) return
    setZoneActionStatus('Creating...')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createZone', name: newZoneName.trim(), cols: newZoneCols, rows: newZoneRows }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setZoneActionStatus(data.error ?? 'Failed')
        return
      }
      // Add to local zone list and switch to it
      const newZone = { id: data.id, label: data.name }
      setZoneMaps(prev => [...prev, newZone])
      ZONE_DEFAULTS[data.id] = data.grid
      setShowCreateZone(false)
      setNewZoneName('')
      setZoneActionStatus('')
      // Switch to the new zone
      setActiveMap(data.id)
      setGrid(data.grid.map((r: number[]) => [...r]))
      setItemPlacements([])
      setNodePlacements([])
      setWarpPlacements([])
      setPlacedStructures([])
      setPlacedFurniture([])
    } catch (e) {
      setZoneActionStatus('Error')
    }
  }, [newZoneName, newZoneCols, newZoneRows])

  const deleteZone = useCallback(async () => {
    if (activeMap === 'garden') return
    if (!confirm(`Delete zone "${zoneMaps.find(z => z.id === activeMap)?.label ?? activeMap}"? This removes the map, nodes, and encounter table.`)) return
    setZoneActionStatus('Deleting...')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteZone', zoneId: activeMap }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setZoneActionStatus(data.error ?? 'Failed')
        return
      }
      // Remove from local zone list and switch to garden
      setZoneMaps(prev => prev.filter(z => z.id !== activeMap))
      delete ZONE_DEFAULTS[activeMap]
      setZoneActionStatus('')
      switchMap('garden')
    } catch {
      setZoneActionStatus('Error')
    }
  }, [activeMap, zoneMaps, switchMap])

  const saveToSource = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const tileSaveData = tiles.map(et => {
        const frameArrays = et.tile.frames && et.tile.frames.length > 1 ? et.tile.frames : [et.tile.pixels]
        const allDigits = frameArrays.map(frame => {
          let digits = ''
          for (let y = 0; y < TS; y++) {
            for (let x = 0; x < TS; x++) {
              digits += frame[y * TS + x].toString(16)
            }
            digits += '\n'
          }
          return digits.trimEnd()
        })
        return {
          name: et.name,
          palette: et.tile.palette,
          digits: allDigits[0],
          solid: et.solid,
          above: et.above,
          category: et.category,
          frames: allDigits.length > 1 ? allDigits : undefined,
          animRate: et.tile.animRate,
        }
      })

      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiles: tileSaveData,
          grid,
          playerStart: { tileX: 14, tileY: 8 },
          mapId: activeMap,
          nodes: nodePlacements,
          pickups: itemPlacements,
          warps: warpPlacements,
          structurePlacements: placedStructures,
          furniture: placedFurniture,
          zoneChests: placedZoneChests,
          intGrid,
        }),
      })
      const data = await res.json()
      if (!data.success) { setSaveStatus('error'); return }

      // Saved to source (your "branch"). NO auto-build: Serberus/Jin builds + verifies
      // before it goes live, so a save can never break the game blind.
      setSaveStatus('saved')
      setGridDirty(false)
      // Drop the local cache so the editor reflects saved source after the next build.
      Promise.all([
        deleteState('map-state', `grid-${activeMap}`),
        deleteState('map-state', `items-${activeMap}`),
        deleteState('map-state', `nodes-${activeMap}`),
        deleteState('map-state', `warps-${activeMap}`),
      ]).catch(() => {})
    } catch {
      setSaveStatus('error')
    }
    setTimeout(() => setSaveStatus('idle'), 4000)
  }, [tiles, grid, activeMap, nodePlacements, warpPlacements, intGrid])

  const exportTiles = useCallback(() => {
    const lines: string[] = []
    const formatFrame = (frame: Uint8Array) => {
      const digits: string[] = []
      for (let y = 0; y < TS; y++) {
        let row = '  '
        for (let x = 0; x < TS; x++) row += frame[y * TS + x].toString(16)
        digits.push(row)
      }
      return digits
    }
    tiles.forEach((et, i) => {
      const catTag = et.category ? ` [${et.category}]` : ''
      const flags = [et.solid && 'SOLID', et.above && 'ABOVE'].filter(Boolean).join(', ')
      const palStr = et.tile.palette.map(c => `'${c}'`).join(', ')

      if (et.tile.frames && et.tile.frames.length > 1) {
        const animNote = ` (animated:${et.tile.animRate ?? 12})`
        lines.push(`// ${i}: ${et.name}${catTag}${flags ? ` (${flags})` : ''}${animNote}`)
        const frameStrs = et.tile.frames.map(f => '`\n' + formatFrame(f).join('\n') + '\n`')
        lines.push(`const T${i} = ta([${palStr}], ${et.tile.animRate ?? 12}, ${frameStrs.join(', ')})`)
      } else {
        lines.push(`// ${i}: ${et.name}${catTag}${flags ? ` (${flags})` : ''}`)
        lines.push(`const T${i} = t([${palStr}], \``)
        lines.push(...formatFrame(et.tile.pixels))
        lines.push('`)')
      }
      lines.push('')
    })
    lines.push(`export const TILES: TileDef[] = [${tiles.map((_, i) => `T${i}`).join(', ')}]`)
    lines.push(`export const SOLID: boolean[] = [${tiles.map(et => et.solid.toString()).join(', ')}]`)
    lines.push(`export const ABOVE: boolean[] = [${tiles.map(et => et.above.toString()).join(', ')}]`)
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied('tiles')
    setTimeout(() => setCopied(''), 2000)
  }, [tiles])

  const exportMap = useCallback(() => {
    const lines = grid.map((row, y) => `  [${row.join(', ')}],  // ${y}`)
    const out = `export const GARDEN: number[][] = [\n${lines.join('\n')}\n]`
    navigator.clipboard.writeText(out)
    setCopied('map')
    setTimeout(() => setCopied(''), 2000)
  }, [grid])

  const exportNodes = useCallback(() => {
    if (nodePlacements.length === 0) { setCopied('nodes-empty'); setTimeout(() => setCopied(''), 2000); return }
    const lines = nodePlacements.map(n =>
      `  createResourceNode('${n.nodeType}', ${n.x}, ${n.y}, '${activeMap}'),`
    )
    const out = `// Resource nodes for ${activeMap} (${nodePlacements.length} nodes)\nimport { createResourceNode } from './resources'\n\nexport const ${activeMap.replace(/-/g, '_').toUpperCase()}_NODES = [\n${lines.join('\n')}\n]`
    navigator.clipboard.writeText(out)
    setCopied('nodes')
    setTimeout(() => setCopied(''), 2000)
  }, [nodePlacements, activeMap])

  const openNewTile = () => {
    setEditingTileIdx(null)
    setCloneSourceIdx(null)
    setWorkshopOpen(true)
  }
  const openEditTile = (idx: number) => {
    setEditingTileIdx(idx)
    setWorkshopOpen(true)
  }
  const saveTile = (name: string, frames: number[][], palette: string[], solid: boolean, above: boolean, category: string, animRate: number) => {
    const td: TileDef = {
      pixels: new Uint8Array(frames[0]),
      palette,
      frames: frames.length > 1 ? frames.map(f => new Uint8Array(f)) : undefined,
      animRate: frames.length > 1 ? animRate : undefined,
    }
    if (editingTileIdx !== null) {
      setTiles(prev => prev.map((et, i) => i === editingTileIdx ? { name, tile: td, solid, above, category } : et))
    } else {
      setTiles(prev => [...prev, { name, tile: td, solid, above, category }])
    }
    setWorkshopOpen(false)
    setEditingTileIdx(null)
  }
  const deleteTile = (idx: number) => {
    if (idx < 8) return
    pushMapSnapshot()
    setGrid(prev => prev.map(row => row.map(v => {
      const tileIdx = v & 0xFF
      const rot = v & ~0xFF
      if (tileIdx === idx) return 0
      if (tileIdx > idx) return (tileIdx - 1) | rot
      return v
    })))
    setTiles(prev => prev.filter((_, i) => i !== idx))
    if (brush === idx) setBrush(0)
    else if (brush > idx) setBrush(brush - 1)
    setWorkshopOpen(false)
    setEditingTileIdx(null)
  }

  const editorRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = editorRef.current
    if (!c) return
    c.width = cols * TS; c.height = rows * TS
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, c.width, c.height)

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const val = grid[ty]?.[tx] ?? 0
        const idx = val & 0xFF
        const rot = (val >> 8) & 3
        const et = tiles[idx]
        if (et) renderTileTo(ctx, et.tile, tx * TS, ty * TS, rot)
      }
    }

    // Draw item placements
    itemPlacements.forEach(({ itemId, x, y }) => {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        renderItemTo(ctx, itemId, x * TS, y * TS)
      }
    })

    // Draw node placements
    nodePlacements.forEach(({ nodeType, x, y }) => {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        const nodeSprite = NODE_SPRITES[nodeType]?.harvestable
        if (nodeSprite) {
          const frame = nodeSprite.frames[0]
          const nPal = (NODE_PALETTES[nodeType] ?? ITEM_PALETTE) as unknown as readonly string[]
          for (let i = 0; i < frame.length; i++) {
            const v = frame[i]
            if (v === 0) continue
            ctx.fillStyle = nPal[v - 1] ?? nPal[0]
            ctx.fillRect(x * TS + (i % TS), y * TS + Math.floor(i / TS), 1, 1)
          }
        }
      }
    })

    // Draw placed structure overlays
    placedStructures.forEach(({ structureId, x, y }) => {
      const s = structures.find(st => st.id === structureId)
      if (!s) return
      for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c < s.cols; c++) {
          const cell = s.cells[r]?.[c]
          if (!cell) continue
          const nx = x + c, ny = y + r
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
            const tile = tiles[cell.tileIdx]
            if (tile) renderTileTo(ctx, tile.tile, nx * TS, ny * TS, cell.rotation)
          }
        }
      }
      // Subtle outline to distinguish from base tiles
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)'
      ctx.lineWidth = 0.5
      ctx.setLineDash([2, 2])
      ctx.strokeRect(x * TS + 0.5, y * TS + 0.5, s.cols * TS - 1, s.rows * TS - 1)
      ctx.setLineDash([])
    })

    // Draw placed furniture overlays
    placedFurniture.forEach(({ furnitureId, x, y }) => {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        // Draw a colored marker for furniture (actual sprites are in the game renderer)
        ctx.fillStyle = 'rgba(212, 168, 67, 0.2)'
        ctx.fillRect(x * TS, y * TS, TS, TS)
        ctx.strokeStyle = 'rgba(212, 168, 67, 0.5)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(x * TS + 0.5, y * TS + 0.5, TS - 1, TS - 1)
        // Label
        ctx.fillStyle = '#d4a843'
        ctx.font = '6px monospace'
        const fDef = FURNITURE.find(f => f.id === furnitureId)
        ctx.fillText(fDef?.name?.slice(0, 5) ?? furnitureId.slice(0, 5), x * TS + 1, y * TS + 8)
      }
    })

    // Draw placed zone chest overlays
    placedZoneChests.forEach(({ chestType, x, y, claimable }) => {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        ctx.fillStyle = claimable ? 'rgba(147, 51, 234, 0.3)' : 'rgba(147, 51, 234, 0.15)'
        ctx.fillRect(x * TS, y * TS, TS, TS)
        ctx.strokeStyle = claimable ? 'rgba(147, 51, 234, 0.7)' : 'rgba(147, 51, 234, 0.4)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(x * TS + 0.5, y * TS + 0.5, TS - 1, TS - 1)
        ctx.fillStyle = '#9333ea'
        ctx.font = '6px monospace'
        const fDef = FURNITURE.find(f => f.id === chestType)
        const label = (fDef?.name?.slice(0, 4) ?? chestType.slice(0, 4)) + (claimable ? '*' : '')
        ctx.fillText(label, x * TS + 1, y * TS + 8)
      }
    })

    // Draw IntGrid overlay
    if (showIntGrid) {
      const INT_COLORS: Record<number, string> = { 1: '#fbbf2460', 2: '#60a5fa60', 3: '#94a3b860' }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const val = intGrid[y]?.[x] ?? 0
          if (val > 0) {
            ctx.fillStyle = INT_COLORS[val] ?? '#ffffff40'
            ctx.fillRect(x * TS, y * TS, TS, TS)
            ctx.fillStyle = '#fff'
            ctx.font = '8px monospace'
            ctx.fillText(String(val), x * TS + 4, y * TS + 11)
          }
        }
      }
    }

    // Draw warp indicators
    const ZONE_COLORS: Record<string, string> = {
      'garden': '#4ade80',
      'mycelial-path': '#a78bfa',
      'moonwell-glade': '#60a5fa',
      'spore-hollow': '#f87171',
    }
    warpPlacements.forEach(({ fromX, fromY, toZone, requiredFlag }) => {
      if (fromX >= 0 && fromX < cols && fromY >= 0 && fromY < rows) {
        const color = ZONE_COLORS[toZone] ?? '#d4a843'
        ctx.fillStyle = color + '40' // 25% opacity fill
        ctx.fillRect(fromX * TS, fromY * TS, TS, TS)
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.strokeRect(fromX * TS + 0.5, fromY * TS + 0.5, TS - 1, TS - 1)
        // Locked indicator
        if (requiredFlag) {
          ctx.fillStyle = '#f59e0b'
          ctx.fillRect(fromX * TS + TS - 4, fromY * TS, 4, 4)
        }
      }
    })

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= cols; x++) {
        ctx.beginPath(); ctx.moveTo(x * TS, 0); ctx.lineTo(x * TS, rows * TS); ctx.stroke()
      }
      for (let y = 0; y <= rows; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * TS); ctx.lineTo(cols * TS, y * TS); ctx.stroke()
      }
    }

    if (hoverTile && editorTool === 'paint') {
      if (brushType === 'stamp' && activeStampId) {
        const stamp = stamps.find(s => s.id === activeStampId)
        if (stamp) {
          ctx.globalAlpha = 0.5
          for (let r = 0; r < stamp.rows; r++) {
            for (let c = 0; c < stamp.cols; c++) {
              const val = stamp.cells[r]?.[c]
              if (val == null) continue
              const idx = val & 0xFF
              const rot = (val >> 8) & 3
              const tile = TILES[idx]
              if (tile) renderTileTo(ctx, tile, (hoverTile.x + c) * TS, (hoverTile.y + r) * TS, rot)
            }
          }
          ctx.globalAlpha = 1
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 2])
          ctx.strokeRect(hoverTile.x * TS + 0.5, hoverTile.y * TS + 0.5, stamp.cols * TS - 1, stamp.rows * TS - 1)
          ctx.setLineDash([])
        }
      } else if (brushType === 'structure' && brushStructureId) {
        // Multi-tile ghost preview for structure stamp
        const s = structures.find(x => x.id === brushStructureId)
        if (s) {
          ctx.globalAlpha = 0.5
          for (let r = 0; r < s.rows; r++) {
            for (let c = 0; c < s.cols; c++) {
              const cell = s.cells[r]?.[c]
              if (!cell) continue
              const tile = TILES[cell.tileIdx]
              if (tile) renderTileTo(ctx, tile, (hoverTile.x + c) * TS, (hoverTile.y + r) * TS, cell.rotation)
            }
          }
          ctx.globalAlpha = 1
          // Outline the structure footprint
          ctx.strokeStyle = 'rgba(212, 168, 67, 0.6)'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 2])
          ctx.strokeRect(hoverTile.x * TS + 0.5, hoverTile.y * TS + 0.5, s.cols * TS - 1, s.rows * TS - 1)
          ctx.setLineDash([])
        }
      } else {
        ctx.strokeStyle = '#d4a843'
        ctx.lineWidth = 1
        ctx.strokeRect(hoverTile.x * TS + 0.5, hoverTile.y * TS + 0.5, TS - 1, TS - 1)
      }
    }

    // Selection overlay
    if (selection) {
      const sx = selection.x1 * TS, sy = selection.y1 * TS
      const sw = (selection.x2 - selection.x1 + 1) * TS, sh = (selection.y2 - selection.y1 + 1) * TS
      ctx.fillStyle = 'rgba(212, 168, 67, 0.12)'
      ctx.fillRect(sx, sy, sw, sh)
      ctx.strokeStyle = '#d4a843'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1)
      ctx.setLineDash([])
    }

    // Move drag preview
    if (moveDrag && selection) {
      const dx = (hoverTile?.x ?? 0) - moveDrag.startX + moveDrag.ox
      const dy = (hoverTile?.y ?? 0) - moveDrag.startY + moveDrag.oy
      ctx.globalAlpha = 0.5
      for (let y = 0; y < moveDrag.clipboard.length; y++) {
        for (let x = 0; x < moveDrag.clipboard[y].length; x++) {
          const val = moveDrag.clipboard[y][x]
          const idx = val & 0xFF
          const rot = (val >> 8) & 3
          const et = tiles[idx]
          if (et) renderTileTo(ctx, et.tile, (selection.x1 + dx + x) * TS, (selection.y1 + dy + y) * TS, rot)
        }
      }
      ctx.globalAlpha = 1.0
      // Dashed preview rect
      const px = (selection.x1 + dx) * TS, py = (selection.y1 + dy) * TS
      const pw = (selection.x2 - selection.x1 + 1) * TS, ph = (selection.y2 - selection.y1 + 1) * TS
      ctx.strokeStyle = '#60a5fa'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1)
      ctx.setLineDash([])
    }
  }, [grid, tiles, cols, rows, showGrid, hoverTile, itemPlacements, nodePlacements, placedStructures, placedFurniture, placedZoneChests, warpPlacements, selection, editorTool, moveDrag, brushType, brushStructureId, structures, activeStampId, stamps, intGrid, showIntGrid])

  const getTileFromEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = e.currentTarget.width / rect.width
    const sy = e.currentTarget.height / rect.height
    return {
      x: Math.floor((e.clientX - rect.left) * sx / TS),
      y: Math.floor((e.clientY - rect.top) * sy / TS),
    }
  }, [])

  const cellSize = cols > 40 ? TS / 2 : TS

  const mapHeaderActions = (
    <>
      <select
        value={activeMap}
        onChange={e => switchMap(e.target.value)}
        className="bg-[#1a1a2e] border border-white/10 rounded px-3 py-1 text-[12px] text-white font-display focus:outline-none focus:border-gold/40"
      >
        {zoneMaps.map(z => (
          <option key={z.id} value={z.id} className="bg-[#1a1a2e] text-white">{z.label}</option>
        ))}
      </select>
      <button
        onClick={() => setShowCreateZone(true)}
        className="px-2 py-0.5 rounded text-[10px] bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20"
      >+ New Zone</button>
      {activeMap !== 'garden' && (
        <button
          onClick={deleteZone}
          className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400/70 hover:bg-red-500/20 border border-red-500/15"
        >Delete</button>
      )}
      <p className="text-text-faint text-xs">{cols}x{rows} · {tiles.length} tiles{nodePlacements.length > 0 ? ` · ${nodePlacements.length} nodes` : ''}{warpPlacements.length > 0 ? ` · ${warpPlacements.length} warps` : ''}</p>
      {gridDirty && (
        <button
          onClick={async () => {
            await Promise.all([
              deleteState('map-state', `grid-${activeMap}`),
              deleteState('map-state', `items-${activeMap}`),
              deleteState('map-state', `nodes-${activeMap}`),
              deleteState('map-state', `warps-${activeMap}`),
            ]).catch(() => {})
            await switchMap(activeMap)
            setGridDirty(false)
          }}
          className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/20 border border-amber-500/15"
        >Reload from source</button>
      )}
      {zoneActionStatus && (
        <span className="text-[10px] text-amber-400">{zoneActionStatus}</span>
      )}
    </>
  )

  return (
    <EditorShell
      title="Map Editor"
      subtitle="Zone tile maps — click/drag to paint"
      loadStatus={loadStatus}
      shortcuts={MAP_EDITOR_SHORTCUTS}
      headerActions={mapHeaderActions}
    >

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-faint">Size:</span>
          <button onClick={() => resize(cols - 5, rows)} disabled={cols <= 10}
            className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10 disabled:opacity-30">W-</button>
          <span className="text-[11px] text-text-dim w-16 text-center">{cols} x {rows}</span>
          <button onClick={() => resize(cols + 5, rows)}
            className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10">W+</button>
          <button onClick={() => resize(cols, rows - 5)} disabled={rows <= 10}
            className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10 disabled:opacity-30">H-</button>
          <button onClick={() => resize(cols, rows + 5)}
            className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10">H+</button>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <button onClick={undoMap} disabled={undoStack.length === 0}
          className="px-2 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >Undo{undoStack.length > 0 ? ` (${undoStack.length})` : ''}</button>
        <button onClick={redoMap} disabled={redoStack.length === 0}
          className="px-2 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)"
        >Redo{redoStack.length > 0 ? ` (${redoStack.length})` : ''}</button>
        <div className="w-px h-6 bg-white/10" />
        <button onClick={fillAll} className="px-3 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10">Fill all</button>
        <button onClick={resetToDefault} className="px-3 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10">Reset</button>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-gold" />
          <span className="text-[10px] text-text-faint">Grid</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showIntGrid} onChange={e => {
            setShowIntGrid(e.target.checked)
            if (e.target.checked) {
              setIntGrid(prev => {
                if (prev.length === grid.length && (prev[0]?.length ?? 0) === (grid[0]?.length ?? 0)) return prev
                return grid.map(row => row.map(() => 0))
              })
            }
          }} className="accent-blue-400" />
          <span className={`text-[10px] ${showIntGrid ? 'text-blue-400' : 'text-text-faint'}`}>IntGrid</span>
        </label>
        {showIntGrid && (
          <div className="flex items-center gap-1">
            {INT_VALUES.map(iv => (
              <button
                key={iv.value}
                onClick={() => { setBrush(iv.value); setBrushType('tile') }}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  brush === iv.value && showIntGrid ? 'border-white/30 bg-white/10' : 'border-white/5 bg-white/[0.02]'
                }`}
                style={{ color: iv.color }}
              >
                {iv.value}: {iv.label}
              </button>
            ))}
            <button
              onClick={() => { setBrush(0); setBrushType('tile') }}
              className={`px-2 py-0.5 rounded text-[10px] border border-white/5 text-text-faint bg-white/[0.02] ${brush === 0 && showIntGrid ? 'border-white/30 bg-white/10' : ''}`}
            >
              0: Erase
            </button>
          </div>
        )}
        <div className="w-px h-6 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-faint">Rotate:</span>
          <button
            onClick={() => setRotation(prev => (prev + 1) % 4)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
              rotation > 0 ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/5 text-text-faint hover:text-text-dim'
            }`}
            title="Press R to cycle rotation"
          >
            {rotation === 0 ? '0°' : `${rotation * 90}°`}
          </button>
          <span className="text-[9px] text-text-faint">(R)</span>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div className="flex items-center gap-1">
          <button onClick={() => { setEditorTool('paint'); setSelection(null); setSelStart(null); setMoveDrag(null) }}
            className={`px-2 py-0.5 rounded text-[10px] ${editorTool === 'paint' ? 'bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/30' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}
            title="Paint tool (B)">Paint</button>
          <button onClick={() => setEditorTool('select')}
            className={`px-2 py-0.5 rounded text-[10px] ${editorTool === 'select' ? 'bg-[#60a5fa]/20 text-[#60a5fa] border border-[#60a5fa]/30' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}
            title="Select tool (V)">Select</button>
        </div>
        {selection && editorTool === 'select' && (
          <>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[#60a5fa]/60">{selection.x2 - selection.x1 + 1}x{selection.y2 - selection.y1 + 1}</span>
              <button onClick={fillSelection} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10" title="Fill selection with current brush">Fill</button>
              <button onClick={() => rotateSelection(1)} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10" title="Rotate selection 90° clockwise">CW</button>
              <button onClick={() => rotateSelection(-1)} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10" title="Rotate selection 90° counter-clockwise">CCW</button>
              <button onClick={clearSelection} className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400/60 hover:bg-red-500/20" title="Clear selection (Delete)">Clear</button>
              <button onClick={() => { setSelection(null); setMoveDrag(null) }} className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10" title="Deselect (Esc)">Deselect</button>
              <button
                onClick={() => {
                  const name = prompt('Stamp name:', `Stamp ${stamps.length + 1}`)
                  if (name) {
                    const group = prompt('Variant group (optional):', '') || undefined
                    saveAsStamp(name, group)
                  }
                }}
                className="px-2 py-0.5 rounded text-[10px] bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border border-violet-500/20"
                title="Save selection as a reusable stamp"
              >Save as Stamp</button>
              <span className="text-[8px] text-text-faint/30 ml-1">drag to move</span>
            </div>
          </>
        )}
        <div className="w-px h-6 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showPreview} onChange={e => setShowPreview(e.target.checked)} className="accent-gold" />
            <span className="text-[10px] text-text-faint">Preview</span>
          </label>
          {showPreview && [2, 3, 4].map(s => (
            <button key={s} onClick={() => setPreviewScale(s)}
              className={`px-2 py-0.5 rounded text-[10px] ${previewScale === s ? 'bg-white/15 text-white' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}>
              {s}x
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-white/10" />
        <button
          onClick={saveToSource}
          disabled={saveStatus === 'saving' || saveStatus === 'building'}
          className={`px-5 py-1.5 rounded text-[11px] font-display border transition-all ${
            saveStatus === 'saving' || saveStatus === 'building'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
              : saveStatus === 'saved'
              ? 'bg-green-500/20 text-green-300 border-green-500/30'
              : saveStatus === 'error'
              ? 'bg-red-500/20 text-red-300 border-red-500/30'
              : 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30'
          }`}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓ (ping Serb to build)' : saveStatus === 'error' ? 'Failed' : gridDirty ? 'Save to branch *' : 'Save to branch'}
        </button>
        <button onClick={exportTiles}
          className="px-3 py-1.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10">
          {copied === 'tiles' ? 'Copied!' : 'Copy Tiles'}
        </button>
        <button onClick={exportMap}
          className="px-3 py-1.5 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10">
          {copied === 'map' ? 'Copied!' : 'Copy Map'}
        </button>
        {nodePlacements.length > 0 && (
          <button onClick={exportNodes}
            className="px-3 py-1.5 rounded text-[10px] bg-green-500/10 text-green-400/80 hover:bg-green-500/20 border border-green-500/20">
            {copied === 'nodes' ? 'Copied!' : copied === 'nodes-empty' ? 'No nodes' : `Copy Nodes (${nodePlacements.length})`}
          </button>
        )}
      </div>

      {/* Brush Selector */}
      <div className="mb-4">
        {/* Current brush preview + status */}
        <div className="flex items-center gap-3 mb-3">
          <BrushPreview
            entry={brushType === 'eraser' ? { type: 'eraser' } : brushType === 'item' ? { type: 'item', itemId: brushItemId! } : brushType === 'node' ? { type: 'node', nodeType: brushNodeType! } : brushType === 'structure' ? { type: 'structure', structureId: brushStructureId! } : brushType === 'furniture' ? { type: 'furniture', furnitureId: brushFurnitureId! } : brushType === 'zonechest' ? { type: 'zonechest', chestType: brushChestType } : { type: 'tile', tileIdx: brush }}
            tiles={tiles}
            structures={structures}
            size={48}
          />
          <div>
            <p className="text-[10px] text-text-faint mb-0.5">
              {brushType === 'tile' ? (tiles[brush]?.name ?? `Tile ${brush}`) : brushType === 'eraser' ? 'Eraser' : brushType === 'item' ? (ITEMS.find(i => i.id === brushItemId)?.name ?? brushItemId ?? '—') : brushType === 'node' ? (NODE_TYPE_LABELS[brushNodeType!]?.name ?? brushNodeType ?? '—') : brushType === 'structure' ? (structures.find(s => s.id === brushStructureId)?.name ?? brushStructureId ?? '—') : brushType === 'furniture' ? brushFurnitureId ?? '—' : brushType === 'stamp' ? 'Stamp' : brushChestType}
            </p>
            <span className="text-[9px] text-text-faint">
              {brushType === 'tile' && tiles[brush]?.solid && <span className="text-red-400/60 mr-2">solid</span>}
              {brushType === 'tile' && tiles[brush]?.above && <span className="text-violet-400/60 mr-2">above</span>}
              {brushType === 'item' && <span className="text-amber-400/60">pickup — click to place/remove</span>}
              {brushType === 'node' && <span className="text-green-400/60">resource node — click to place/remove</span>}
              {brushType === 'eraser' && <span className="text-red-400/60">clears tiles, items, nodes, warps, structures, furniture + chests</span>}
              {brushType === 'furniture' && <span className="text-amber-400/60">furniture — click to place</span>}
              {brushType === 'zonechest' && <span className="text-purple-400/60">zone chest — <label className="cursor-pointer"><input type="checkbox" checked={brushChestClaimable} onChange={e => setBrushChestClaimable(e.target.checked)} className="mr-1 accent-purple-500" />claimable</label></span>}
              {brushType === 'stamp' && <span className="text-violet-400/60">stamp — click to place{randomVariant ? ' (random variant)' : ''}</span>}
              {editorTool === 'select' && <span className="text-[#60a5fa]/60 ml-2">select mode — drag to select, then fill/rotate/move</span>}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {brushType === 'tile' && (
              <button onClick={() => openEditTile(brush)} className="px-3 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10">Edit Tile</button>
            )}
            <button onClick={openNewTile} className="px-3 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10 border border-dashed border-white/15">+ New Tile</button>
            {brushType === 'tile' && (
              <button
                onClick={() => { if (!tiles[brush]) return; setEditingTileIdx(null); setCloneSourceIdx(brush); setWorkshopOpen(true) }}
                className="px-3 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10"
                title="Create a new tile using the current tile as a starting point"
              >Clone Tile</button>
            )}
          </div>
        </div>

        {/* Curated tile palette — Terrain (flat) + Clouds */}
        <div className="space-y-2 mb-3">
          {/* Flat terrain group */}
          <div>
            <p className="text-[9px] text-text-faint/60 uppercase tracking-wider mb-1">Terrain</p>
            <div className="flex flex-wrap gap-0.5">
              <button
                onClick={() => selectBrush({ type: 'eraser' })}
                className={`w-9 h-9 rounded flex items-center justify-center text-[9px] border transition-all ${brushType === 'eraser' ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/[0.03] border-white/10 text-text-faint hover:bg-white/10'}`}
                title="Eraser"
              >✕</button>
              {FLAT_TILE_INDICES.map(i => (
                <BrushPreview
                  key={i}
                  entry={{ type: 'tile', tileIdx: i }}
                  tiles={tiles}
                  size={36}
                  selected={brushType === 'tile' && brush === i}
                  onClick={() => selectBrush({ type: 'tile', tileIdx: i })}
                />
              ))}
            </div>
          </div>
          {/* Cloud border group */}
          <div>
            <p className="text-[9px] text-text-faint/60 uppercase tracking-wider mb-1">Clouds</p>
            <div className="flex flex-wrap gap-0.5">
              {CLOUD_TILE_INDICES.filter(i => i < tiles.length).map(i => (
                <BrushPreview
                  key={i}
                  entry={{ type: 'tile', tileIdx: i }}
                  tiles={tiles}
                  size={36}
                  selected={brushType === 'tile' && brush === i}
                  onClick={() => selectBrush({ type: 'tile', tileIdx: i })}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Advanced drawer — items, nodes, structures, stamps, furniture, zone chests */}
        <div className="border border-white/[0.06] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowAdvancedBrushes(v => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] transition-colors ${showAdvancedBrushes ? 'bg-white/[0.06] text-text-dim' : 'bg-white/[0.02] text-text-faint hover:bg-white/[0.05]'}`}
          >
            <span className="text-[8px]">{showAdvancedBrushes ? '▾' : '▸'}</span>
            <span className="uppercase tracking-wider">Advanced Brushes</span>
            {(['item', 'node', 'structure', 'stamp', 'furniture', 'zonechest'] as const).includes(brushType as 'item' | 'node' | 'structure' | 'stamp' | 'furniture' | 'zonechest') && (
              <span className="ml-1 text-[8px] text-amber-400/70">(active)</span>
            )}
          </button>
          {showAdvancedBrushes && (
            <div className="px-3 py-2 bg-white/[0.01]">
              <select
                value={dropdownValue}
                onChange={e => handleDropdownChange(e.target.value)}
                className="bg-[#1a1a2e] border border-white/10 rounded px-3 py-2 text-[12px] text-white font-display focus:outline-none focus:border-gold/40 w-full mb-2"
              >
                <option value="eraser" className="bg-[#1a1a2e] text-white">Eraser</option>
                {/* Full tile list — all categories including hidden-by-default old tiles */}
                {[...CATEGORIES].sort((a, b) => a.label.localeCompare(b.label)).map(cat => {
                  const catTiles = tiles.map((et, i) => ({ et, i })).filter(({ et }) => et.category === cat.id)
                    .sort((a, b) => a.et.name.localeCompare(b.et.name))
                  if (catTiles.length === 0) return null
                  return (
                    <optgroup key={cat.id} label={cat.label}>
                      {catTiles.map(({ et, i }) => (
                        <option key={i} value={`tile:${i}`} className="bg-[#1a1a2e] text-white">
                          {et.name}{et.solid ? ' [solid]' : ''}{et.above ? ' [above]' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
                {(() => {
                  const uncategorized = tiles.map((et, i) => ({ et, i })).filter(({ et }) => !CATEGORIES.some(c => c.id === et.category))
                    .sort((a, b) => a.et.name.localeCompare(b.et.name))
                  if (uncategorized.length === 0) return null
                  return (
                    <optgroup label="Unsorted">
                      {uncategorized.map(({ et, i }) => (
                        <option key={i} value={`tile:${i}`} className="bg-[#1a1a2e] text-white">
                          {et.name}{et.solid ? ' [solid]' : ''}{et.above ? ' [above]' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                })()}
                <optgroup label="Items">
                  {ITEMS.map(item => (
                    <option key={item.id} value={`item:${item.id}`} className="bg-[#1a1a2e] text-white">
                      {item.name}{item.species ? ` (${item.species})` : ''}
                    </option>
                  ))}
                </optgroup>
                {(() => {
                  const categories = ['Forestry', 'Prospecting', 'Rinning'] as const
                  return categories.map(cat => {
                    const nodes = Object.entries(NODE_TYPE_LABELS).filter(([, v]) => v.category === cat)
                    if (nodes.length === 0) return null
                    return (
                      <optgroup key={cat} label={`Nodes: ${cat}`}>
                        {nodes.map(([key, v]) => (
                          <option key={key} value={`node:${key}`} className="bg-[#1a1a2e] text-white">
                            {v.name}{v.above ? ' [above]' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })
                })()}
                {structures.length > 0 && (
                  <optgroup label="Structures">
                    {structures.map(s => (
                      <option key={s.id} value={`struct:${s.id}`} className="bg-[#1a1a2e] text-white">
                        {s.name} ({s.cols}x{s.rows})
                      </option>
                    ))}
                  </optgroup>
                )}
                {FURNITURE.length > 0 && (
                  <optgroup label="Furniture">
                    {FURNITURE.map(f => (
                      <option key={f.id} value={`furn:${f.id}`} className="bg-[#1a1a2e] text-white">
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Zone Chests">
                  {FURNITURE.filter(f => f.chestSlots).map(f => (
                    <option key={`zc-${f.id}`} value={`zc:${f.id}`} className="bg-[#1a1a2e] text-white">
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}
        </div>
        {/* Warp Tool */}
        <div className={`flex items-center gap-3 mt-2 px-3 py-2 rounded-lg border transition-all ${
          warpEnabled ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/[0.02] border-white/5'
        }`}>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={warpEnabled}
              onChange={e => setWarpEnabled(e.target.checked)}
              className="accent-amber-400"
            />
            <span className={`text-[11px] font-display ${warpEnabled ? 'text-amber-300' : 'text-text-faint'}`}>
              Warp
            </span>
          </label>
          {warpEnabled && (
            <>
              <div className="w-px h-5 bg-white/10" />
              <select
                value={warpConfig.toZone}
                onChange={e => setWarpConfig(prev => ({ ...prev, toZone: e.target.value }))}
                className="bg-[#1a1a2e] border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/40"
              >
                {zoneMaps.filter(z => z.id !== activeMap).map(z => (
                  <option key={z.id} value={z.id} className="bg-[#1a1a2e]">{z.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-text-faint">X:</span>
                <input
                  type="number"
                  value={warpConfig.toX}
                  onChange={e => setWarpConfig(prev => ({ ...prev, toX: parseInt(e.target.value) || 0 }))}
                  className="bg-[#1a1a2e] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white w-12 focus:outline-none focus:border-amber-500/40"
                />
                <span className="text-[9px] text-text-faint">Y:</span>
                <input
                  type="number"
                  value={warpConfig.toY}
                  onChange={e => setWarpConfig(prev => ({ ...prev, toY: parseInt(e.target.value) || 0 }))}
                  className="bg-[#1a1a2e] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white w-12 focus:outline-none focus:border-amber-500/40"
                />
              </div>
              <select
                value={warpConfig.direction}
                onChange={e => setWarpConfig(prev => ({ ...prev, direction: e.target.value }))}
                className="bg-[#1a1a2e] border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/40"
              >
                <option value="up">Face Up</option>
                <option value="down">Face Down</option>
                <option value="left">Face Left</option>
                <option value="right">Face Right</option>
              </select>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-text-faint">Flag:</span>
                <input
                  type="text"
                  value={warpConfig.requiredFlag}
                  onChange={e => setWarpConfig(prev => ({ ...prev, requiredFlag: e.target.value }))}
                  placeholder="none"
                  className="bg-[#1a1a2e] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white w-28 focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"
                />
              </div>
              <span className="text-[9px] text-amber-400/60 ml-auto">
                paint tiles to attach warps ({warpPlacements.length})
              </span>
            </>
          )}
        </div>

        {/* Hotbar — recent brushes */}
        {recentBrushes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-text-faint mr-1">Recent:</span>
            {recentBrushes.map((entry, i) => (
              <BrushPreview
                key={`${brushKey(entry)}-${i}`}
                entry={entry}
                tiles={tiles}
                structures={structures}
                size={32}
                selected={brushKey(entry) === dropdownValue}
                onClick={() => selectBrush(entry)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tile Workshop */}
      {workshopOpen && (
        <div className="mb-6">
          <TileWorkshop
            isNew={editingTileIdx === null}
            initial={(() => {
              const srcIdx = editingTileIdx ?? cloneSourceIdx
              if (srcIdx === null || !tiles[srcIdx]) return undefined
              const src = tiles[srcIdx]
              return {
                pixels: Array.from(src.tile.pixels),
                palette: [...src.tile.palette],
                name: editingTileIdx !== null ? src.name : `${src.name} Copy`,
                solid: src.solid,
                above: src.above,
                category: src.category,
                frames: src.tile.frames ? src.tile.frames.map(f => Array.from(f)) : undefined,
                animRate: src.tile.animRate,
              }
            })()}
            onSave={(name, frames, palette, solid, above, category, animRate) => {
              saveTile(name, frames, palette, solid, above, category, animRate)
              setCloneSourceIdx(null)
            }}
            onCancel={() => { setWorkshopOpen(false); setEditingTileIdx(null); setCloneSourceIdx(null) }}
          />
          {editingTileIdx !== null && editingTileIdx >= 8 && (
            <button
              onClick={() => deleteTile(editingTileIdx)}
              className="mt-2 px-3 py-1 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
            >Delete tile</button>
          )}
        </div>
      )}

      {/* Stamp Library + Auto-layer Rules */}
      <div className="mb-4 space-y-3">
        <StampManager
          stamps={stamps}
          activeStampId={activeStampId}
          randomVariant={randomVariant}
          hotkeys={stampHotkeys}
          onSelectStamp={selectStampBrush}
          onDeleteStamp={deleteStamp}
          onToggleRandomVariant={() => setRandomVariant(v => !v)}
          onAssignHotkey={(slot, id) => setStampHotkeys(prev => prev.map((hk, i) => i === slot ? id : hk))}
          tiles={tiles}
        />
        <AutoLayerRules
          rules={autoLayerRules}
          intValues={INT_VALUES}
          onUpdateRules={setAutoLayerRules}
        />
      </div>

      {/* Editor + Preview */}
      <div className="flex gap-8 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-text-faint text-[10px] uppercase tracking-widest mb-2">
            Editor — click/drag to paint
            {hoverTile && (() => {
              const val = grid[hoverTile.y]?.[hoverTile.x] ?? 0
              const idx = val & 0xFF
              const rot = (val >> 8) & 3
              const rotLabel = rot > 0 ? ` (${rot * 90}°)` : ''
              const itemHere = itemPlacements.find(p => p.x === hoverTile.x && p.y === hoverTile.y)
              const itemLabel = itemHere ? ` + pickup: ${ITEMS.find(i => i.id === itemHere.itemId)?.name ?? itemHere.itemId}` : ''
              const nodeHere = nodePlacements.find(p => p.x === hoverTile.x && p.y === hoverTile.y)
              const nodeLabel = nodeHere ? ` + ${NODE_TYPE_LABELS[nodeHere.nodeType]?.name ?? nodeHere.nodeType}` : ''
              const warpHere = warpPlacements.find(p => p.fromX === hoverTile.x && p.fromY === hoverTile.y)
              const zcHere = placedZoneChests.find(p => p.x === hoverTile.x && p.y === hoverTile.y)
              const zcLabel = zcHere ? ` + zone chest: ${FURNITURE.find(f => f.id === zcHere.chestType)?.name ?? zcHere.chestType}${zcHere.claimable ? ' (claimable)' : ''}` : ''
              return (
                <span className="text-text-dim ml-2">
                  ({hoverTile.x}, {hoverTile.y}) = {tiles[idx]?.name ?? '?'}{rotLabel}{itemLabel && <span className="text-amber-400/60">{itemLabel}</span>}{nodeLabel && <span className="text-green-400/60">{nodeLabel}</span>}{zcLabel && <span className="text-purple-400/60">{zcLabel}</span>}{warpHere && <span className="text-amber-300/80">{` → ${zoneMaps.find(z => z.id === warpHere.toZone)?.label ?? warpHere.toZone} (${warpHere.toX},${warpHere.toY})${warpHere.requiredFlag ? ` [${warpHere.requiredFlag}]` : ''}`}</span>}
                </span>
              )
            })()}
          </p>
          <div className="overflow-auto max-w-full" style={{ maxHeight: rows * cellSize + 20 }}>
          <canvas
            ref={editorRef}
            className={`border border-white/10 rounded-lg ${editorTool === 'select' ? (moveDrag ? 'cursor-grabbing' : selection && hoverTile && hoverTile.x >= selection.x1 && hoverTile.x <= selection.x2 && hoverTile.y >= selection.y1 && hoverTile.y <= selection.y2 ? 'cursor-grab' : 'cursor-crosshair') : 'cursor-crosshair'}`}
            style={{ imageRendering: 'pixelated', width: cols * cellSize, height: rows * cellSize }}
            onMouseDown={e => {
              const t = getTileFromEvent(e)
              if (editorTool === 'paint') {
                pushMapSnapshot()
                setPainting(true); paintTile(t.x, t.y)
              } else {
                // Select tool
                if (selection && !moveDrag && t.x >= selection.x1 && t.x <= selection.x2 && t.y >= selection.y1 && t.y <= selection.y2) {
                  // Click inside selection → start move drag
                  const w = selection.x2 - selection.x1 + 1, h = selection.y2 - selection.y1 + 1
                  const clip: number[][] = []
                  const movedItems: Array<{ itemId: string; x: number; y: number }> = []
                  const movedNodes: Array<{ nodeType: string; x: number; y: number }> = []
                  for (let y = 0; y < h; y++) {
                    clip[y] = []
                    for (let x = 0; x < w; x++)
                      clip[y][x] = grid[selection.y1 + y]?.[selection.x1 + x] ?? 0
                  }
                  itemPlacements.forEach(p => {
                    if (p.x >= selection.x1 && p.x <= selection.x2 && p.y >= selection.y1 && p.y <= selection.y2)
                      movedItems.push({ ...p, x: p.x - selection.x1, y: p.y - selection.y1 })
                  })
                  nodePlacements.forEach(p => {
                    if (p.x >= selection.x1 && p.x <= selection.x2 && p.y >= selection.y1 && p.y <= selection.y2)
                      movedNodes.push({ ...p, x: p.x - selection.x1, y: p.y - selection.y1 })
                  })
                  setMoveDrag({ startX: t.x, startY: t.y, ox: 0, oy: 0, clipboard: clip, items: movedItems, nodes: movedNodes })
                } else if (!moveDrag) {
                  // Start new selection
                  setSelStart({ x: t.x, y: t.y })
                  setSelection({ x1: t.x, y1: t.y, x2: t.x, y2: t.y })
                }
              }
            }}
            onMouseMove={e => {
              const t = getTileFromEvent(e)
              setHoverTile(t)
              if (editorTool === 'paint') {
                if (painting) paintTile(t.x, t.y)
              } else {
                if (selStart) {
                  // Drawing selection rect
                  setSelection({
                    x1: Math.min(selStart.x, t.x), y1: Math.min(selStart.y, t.y),
                    x2: Math.max(selStart.x, t.x), y2: Math.max(selStart.y, t.y),
                  })
                } else if (moveDrag) {
                  // Update move offset for preview
                  setMoveDrag(prev => prev ? { ...prev, ox: t.x - prev.startX, oy: t.y - prev.startY } : null)
                }
              }
            }}
            onMouseUp={() => {
              if (editorTool === 'paint') {
                setPainting(false)
              } else {
                if (selStart) {
                  setSelStart(null)  // finalize selection
                } else if (moveDrag && selection) {
                  // Commit the move
                  const dx = moveDrag.ox, dy = moveDrag.oy
                  if (dx !== 0 || dy !== 0) {
                    pushMapSnapshot()
                    const { x1, y1, x2, y2 } = selection
                    const w = x2 - x1 + 1, h = y2 - y1 + 1
                    setGrid(prev => {
                      const next = prev.map(r => [...r])
                      // Clear source
                      for (let y = y1; y <= y2; y++)
                        for (let x = x1; x <= x2; x++)
                          if (y >= 0 && y < next.length && x >= 0 && x < (next[0]?.length ?? 0))
                            next[y][x] = 0
                      // Write at destination
                      for (let y = 0; y < h; y++)
                        for (let x = 0; x < w; x++) {
                          const ny = y1 + dy + y, nx = x1 + dx + x
                          if (ny >= 0 && ny < next.length && nx >= 0 && nx < (next[0]?.length ?? 0))
                            next[ny][nx] = moveDrag.clipboard[y][x]
                        }
                      return next
                    })
                    // Move items + nodes
                    if (moveDrag.items.length > 0) {
                      setItemPlacements(prev => {
                        const filtered = prev.filter(p => !(p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2))
                        return [...filtered, ...moveDrag.items.map(p => ({ ...p, x: x1 + dx + p.x, y: y1 + dy + p.y }))]
                      })
                    }
                    if (moveDrag.nodes.length > 0) {
                      setNodePlacements(prev => {
                        const filtered = prev.filter(p => !(p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2))
                        return [...filtered, ...moveDrag.nodes.map(p => ({ ...p, x: x1 + dx + p.x, y: y1 + dy + p.y }))]
                      })
                    }
                    // Update selection to new position
                    setSelection({ x1: x1 + dx, y1: y1 + dy, x2: x2 + dx, y2: y2 + dy })
                  }
                  setMoveDrag(null)
                }
              }
            }}
            onMouseLeave={() => { setPainting(false); setHoverTile(null) }}
          />
          </div>
        </div>

        {showPreview && (
          <div>
            <p className="text-text-faint text-[10px] uppercase tracking-widest mb-2">Preview ({previewScale}x)</p>
            <div className="overflow-auto max-h-[700px] max-w-[600px] border border-white/5 rounded-lg">
              <MapPreview grid={grid} tiles={tiles} scale={previewScale} highlightTile={hoverTile} />
            </div>
          </div>
        )}
      </div>
      {/* Create Zone Modal */}
      {showCreateZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowCreateZone(false)}>
          <div className="bg-[#1a1a2e] border border-gold/30 rounded-xl p-6 w-[340px] shadow-lg" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-lg text-gold mb-4">New Zone</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-text-faint uppercase tracking-wider">Name</label>
                <input
                  value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                  placeholder="e.g. Ember Wastes"
                  className="w-full mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[12px] text-white focus:outline-none focus:border-gold/40"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') createZone() }}
                />
                {newZoneName && (
                  <p className="text-[9px] text-text-faint/50 mt-1">
                    ID: {newZoneName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-text-faint uppercase tracking-wider">Width</label>
                  <input
                    type="number"
                    value={newZoneCols}
                    onChange={e => setNewZoneCols(Math.max(10, Math.min(80, parseInt(e.target.value) || 25)))}
                    className="w-full mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[12px] text-white focus:outline-none focus:border-gold/40"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-text-faint uppercase tracking-wider">Height</label>
                  <input
                    type="number"
                    value={newZoneRows}
                    onChange={e => setNewZoneRows(Math.max(10, Math.min(80, parseInt(e.target.value) || 20)))}
                    className="w-full mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[12px] text-white focus:outline-none focus:border-gold/40"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={createZone}
                  disabled={!newZoneName.trim()}
                  className="flex-1 py-1.5 rounded text-[11px] font-display bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20 disabled:opacity-30"
                >Create</button>
                <button
                  onClick={() => setShowCreateZone(false)}
                  className="flex-1 py-1.5 rounded text-[11px] font-display bg-white/5 text-text-faint hover:bg-white/10 border border-white/10"
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </EditorShell>
  )
}
