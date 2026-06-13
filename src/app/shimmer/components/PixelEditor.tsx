'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { SpriteAnim } from '../sprites/sprite-data'
import { GARDEN } from '../world/tilemap'
import { ViewMode, EditorTool, FloatingSelection, flipH, flipV, shiftAllPixels, floodFill } from './PixelUtils'
import { drawSprite, drawTilemap } from './SpriteRenderers'
import { drawBattleBg, BG_W, BG_H } from './BattleBackground'
import PngImport from './PngImport'
import { pixelsToDigits } from './PixelUtils'

const DEFAULT_SS = 16

// Module-level clipboard — persists across re-renders and editor switches
let frameClipboard: number[] | null = null

/** Tint a hex color warm (prev frame) or cool (next frame) and return rgba */
function onionRgba(hex: string, alpha: number, tint: 'prev' | 'next'): string {
  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)
  if (tint === 'prev') {
    r = Math.min(255, Math.round(r * 0.7 + 76))
    g = Math.round(g * 0.5)
    b = Math.round(b * 0.5)
  } else {
    r = Math.round(r * 0.5)
    g = Math.round(g * 0.5)
    b = Math.min(255, Math.round(b * 0.7 + 76))
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = []
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  while (true) {
    points.push([x0, y0])
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx) { err += dx; y0 += sy }
  }
  return points
}

interface PixelEditorProps {
  palette: readonly string[]
  initialPixels?: Uint8Array
  mode: ViewMode
  species: string
  animName: string
  frameIndex: number
  onSaved?: () => void
  allSprites: Record<string, SpriteAnim>
  paletteKey?: string         // palette variant key for save endpoint (default 'base')
  gridSize?: number           // grid dimensions: 16 for 16x16, 32 for 32x32 (default 16)
  gridCellSize?: number       // pixel grid cell size in px (auto-sized if not set)
  showMirror?: boolean        // show mirror paint toggle (default false)
  isShared?: boolean          // frame is shared/locked (default false)
  frameConstMap: Record<string, string[]>  // animation const name mapping
  onFrameChange?: (index: number) => void  // navigate to different frame
  totalFrames?: number                      // total frames in current animation
  onDuplicateFrame?: (currentPixels: number[]) => void  // duplicate current frame (Alt+D)
  onBatchOperation?: (op: 'flipH' | 'flipV' | 'shiftUp' | 'shiftDown' | 'shiftLeft' | 'shiftRight') => void
  maxColors?: number            // max palette colors (default 15, hex 1-f)
}

export default function PixelEditor({
  palette: externalPalette,
  initialPixels,
  mode,
  species,
  animName,
  frameIndex,
  onSaved,
  allSprites,
  paletteKey = 'base',
  gridSize: gridSizeProp,
  gridCellSize: gridCellSizeProp,
  showMirror = false,
  isShared = false,
  frameConstMap,
  onFrameChange,
  totalFrames,
  onDuplicateFrame,
  onBatchOperation,
  maxColors = 15,
}: PixelEditorProps) {
  const SS = gridSizeProp ?? DEFAULT_SS
  const cellPx = gridCellSizeProp ?? (SS <= 16 ? 24 : SS <= 32 ? 14 : 10)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [pixels, setPixels] = useState<number[]>(() => {
    if (initialPixels) return Array.from(initialPixels)
    return new Array(SS * SS).fill(0)
  })
  const [colors, setColors] = useState<string[]>(() => [...externalPalette])
  const [brush, setBrush] = useState(1)
  const [painting, setPainting] = useState(false)
  const [mirror, setMirror] = useState(false)
  const [tool, setTool] = useState<EditorTool>('paint')
  const [floating, setFloating] = useState<FloatingSelection | null>(null)
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null)
  const [selEnd, setSelEnd] = useState<{ x: number; y: number } | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [history, setHistory] = useState<number[][]>([])
  const [future, setFuture] = useState<number[][]>([])
  const [onionSkin, setOnionSkin] = useState(false)
  const [clipMsg, setClipMsg] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [linePreview, setLinePreview] = useState<[number, number][] | null>(null)
  const [showImport, setShowImport] = useState(false)
  const strokeStarted = useRef(false)
  const lastPaintPos = useRef<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const preview1xRef = useRef<HTMLCanvasElement>(null)
  const preview4xRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<HTMLCanvasElement>(null)

  // Refs for stable access in mouse handlers without stale closures
  const paintingRef = useRef(false)
  const toolRef = useRef<EditorTool>('paint')
  const brushRef = useRef(1)
  const mirrorRef = useRef(false)
  const floatingRef = useRef<FloatingSelection | null>(null)
  const selStartRef = useRef<{ x: number; y: number } | null>(null)
  const selEndRef = useRef<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const pixelsRef = useRef<number[]>([])
  const compositePixelsRef = useRef<number[]>([])

  const MAX_UNDO = 30

  // Dirty tracking — warn before closing tab with unsaved edits
  const isDirty = useMemo(() => {
    if (!initialPixels) return false
    return pixels.some((v, i) => v !== (initialPixels[i] ?? 0))
  }, [pixels, initialPixels])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const pushUndo = useCallback(() => {
    setHistory(prev => {
      const next = [...prev, [...pixels]]
      if (next.length > MAX_UNDO) next.shift()
      return next
    })
    setFuture([])
  }, [pixels])

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev
      setFuture(f => [...f, [...pixels]])
      setPixels(prev[prev.length - 1])
      setFloating(null)
      setSelStart(null)
      setSelEnd(null)
      return prev.slice(0, -1)
    })
  }, [pixels])

  const redo = useCallback(() => {
    setFuture(prev => {
      if (prev.length === 0) return prev
      setHistory(h => [...h, [...pixels]])
      setPixels(prev[prev.length - 1])
      setFloating(null)
      setSelStart(null)
      setSelEnd(null)
      return prev.slice(0, -1)
    })
  }, [pixels])

  const commitFloat = useCallback(() => {
    if (!floating) return
    setPixels(prev => {
      const next = [...prev]
      for (let ly = 0; ly < floating.h; ly++)
        for (let lx = 0; lx < floating.w; lx++) {
          const gx = floating.x + lx, gy = floating.y + ly
          if (gx < 0 || gx >= SS || gy < 0 || gy >= SS) continue
          const val = floating.data[ly * floating.w + lx]
          if (val > 0) next[gy * SS + gx] = val
        }
      return next
    })
    setFloating(null)
  }, [floating])

  const cancelFloat = useCallback(() => {
    if (!floating) return
    setHistory(prev => {
      if (prev.length === 0) return prev
      setPixels(prev[prev.length - 1])
      return prev.slice(0, -1)
    })
    setFloating(null)
    setSelStart(null)
    setSelEnd(null)
  }, [floating])

  const liftSelection = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
    const w = maxX - minX + 1, h = maxY - minY + 1
    if (w <= 0 || h <= 0) return
    pushUndo()
    const data: number[] = []
    const newPixels = [...pixels]
    for (let ly = 0; ly < h; ly++)
      for (let lx = 0; lx < w; lx++) {
        const idx = (minY + ly) * SS + (minX + lx)
        data.push(newPixels[idx])
        newPixels[idx] = 0
      }
    setPixels(newPixels)
    setFloating({ data, w, h, x: minX, y: minY, srcX: minX, srcY: minY })
    setSelStart(null)
    setSelEnd(null)
  }, [pixels, pushUndo])

  const compositePixels = useMemo(() => {
    if (!floating) return pixels
    const out = [...pixels]
    for (let ly = 0; ly < floating.h; ly++)
      for (let lx = 0; lx < floating.w; lx++) {
        const gx = floating.x + lx, gy = floating.y + ly
        if (gx < 0 || gx >= SS || gy < 0 || gy >= SS) continue
        const val = floating.data[ly * floating.w + lx]
        if (val > 0) out[gy * SS + gx] = val
      }
    return out
  }, [pixels, floating])

  // Onion skin: adjacent frame pixels (wraps around animation loop)
  const currentAnim = allSprites[animName]
  const prevFramePixels = useMemo(() => {
    if (!onionSkin || !currentAnim || currentAnim.frames.length < 2) return null
    const idx = frameIndex - 1
    return idx >= 0 ? currentAnim.frames[idx] : currentAnim.frames[currentAnim.frames.length - 1]
  }, [onionSkin, currentAnim, frameIndex])

  const nextFramePixels = useMemo(() => {
    if (!onionSkin || !currentAnim || currentAnim.frames.length < 2) return null
    const idx = frameIndex + 1
    return idx < currentAnim.frames.length ? currentAnim.frames[idx] : currentAnim.frames[0]
  }, [onionSkin, currentAnim, frameIndex])

  const handleFlipH = useCallback(() => {
    if (batchMode && onBatchOperation && !floating) { onBatchOperation('flipH'); return }
    if (floating) {
      setFloating(f => f ? { ...f, data: flipH(f.data, f.w, f.h) } : null)
    } else {
      pushUndo()
      setPixels(prev => flipH(prev, SS, SS))
    }
  }, [floating, pushUndo, batchMode, onBatchOperation])

  const handleFlipV = useCallback(() => {
    if (batchMode && onBatchOperation && !floating) { onBatchOperation('flipV'); return }
    if (floating) {
      setFloating(f => f ? { ...f, data: flipV(f.data, f.w, f.h) } : null)
    } else {
      pushUndo()
      setPixels(prev => flipV(prev, SS, SS))
    }
  }, [floating, pushUndo, batchMode, onBatchOperation])

  const handleShift = useCallback((dx: number, dy: number) => {
    if (floating) {
      setFloating(f => f ? { ...f, x: f.x + dx, y: f.y + dy } : null)
    } else if (batchMode && onBatchOperation) {
      onBatchOperation(dx < 0 ? 'shiftLeft' : dx > 0 ? 'shiftRight' : dy < 0 ? 'shiftUp' : 'shiftDown')
    } else {
      pushUndo()
      setPixels(prev => shiftAllPixels(prev, dx, dy))
    }
  }, [floating, pushUndo, batchMode, onBatchOperation])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); redo(); return }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault(); frameClipboard = [...pixels]
        setClipMsg('Frame copied'); setTimeout(() => setClipMsg(''), 1500); return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault()
        if (frameClipboard) { pushUndo(); setPixels([...frameClipboard]); setFloating(null) }
        setClipMsg(frameClipboard ? 'Frame pasted' : 'Nothing to paste'); setTimeout(() => setClipMsg(''), 1500); return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); return }
      if (floating) {
        if (e.key === 'Escape') { cancelFloat(); return }
        if (e.key === 'Enter') { commitFloat(); return }
        const nudge: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
        if (nudge[e.key]) { e.preventDefault(); handleShift(nudge[e.key][0], nudge[e.key][1]); return }
      }
      if (e.key === 'b' || e.key === 'B') { if (floating) commitFloat(); setTool('paint'); return }
      if (e.key === 'e' || e.key === 'E') { setTool('eraser'); lastPaintPos.current = null; return }
      if (e.key === 'g' || e.key === 'G') { setTool('fill'); return }
      if (e.key === 'l' || e.key === 'L') { setTool('line'); lastPaintPos.current = null; setLinePreview(null); return }
      if (e.key === 'v' || e.key === 'V') { setTool('select'); return }
      if (e.key === '#') { setShowGrid(g => !g); return }
      if (showMirror && (e.key === 'm' || e.key === 'M')) { setMirror(m => !m); return }
      if (e.key === 'o' || e.key === 'O') { setOnionSkin(o => !o); return }
      if (e.altKey && (e.key === 'd' || e.key === 'D') && onDuplicateFrame) {
        e.preventDefault(); if (floating) commitFloat(); onDuplicateFrame([...pixels]); return
      }
      if (e.key === 'Home' && onFrameChange && totalFrames) {
        e.preventDefault(); if (floating) commitFloat(); onFrameChange(0); return
      }
      if (e.key === 'End' && onFrameChange && totalFrames) {
        e.preventDefault(); if (floating) commitFloat(); onFrameChange(totalFrames - 1); return
      }
      if (e.key === '[' && onFrameChange && totalFrames) {
        e.preventDefault()
        if (floating) commitFloat()
        onFrameChange(frameIndex > 0 ? frameIndex - 1 : totalFrames - 1)
        return
      }
      if (e.key === ']' && onFrameChange && totalFrames) {
        e.preventDefault()
        if (floating) commitFloat()
        onFrameChange(frameIndex < totalFrames - 1 ? frameIndex + 1 : 0)
        return
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [floating, undo, redo, cancelFloat, commitFloat, handleShift, showMirror, pixels, pushUndo, onDuplicateFrame, onFrameChange, totalFrames, frameIndex])

  // Sync external palette when spirit/palette changes
  useEffect(() => {
    setColors([...externalPalette])
  }, [externalPalette])

  // Sync when initialPixels or grid size changes
  useEffect(() => {
    const totalPx = SS * SS
    if (initialPixels) {
      const arr = Array.from(initialPixels)
      // Pad if smaller than grid (e.g. loading old 16x16 into 32x32 editor)
      while (arr.length < totalPx) arr.push(0)
      setPixels(arr.slice(0, totalPx))
    } else {
      setPixels(new Array(totalPx).fill(0))
    }
    setFloating(null)
    setHistory([])
  }, [initialPixels, SS])

  const savePaletteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateColor = useCallback((idx: number, hex: string) => {
    setColors(prev => {
      const next = [...prev]
      next[idx] = hex
      if (savePaletteTimer.current) clearTimeout(savePaletteTimer.current)
      savePaletteTimer.current = setTimeout(() => {
        fetch('/shimmer/save-sprite', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ species, paletteKey, colors: next }),
        }).then(r => r.json()).then(d => {
          if (d.success) setSaveMsg('Palette saved')
          else setSaveMsg(`Error: ${d.error}`)
          setTimeout(() => setSaveMsg(''), 2000)
        }).catch(() => {})
      }, 500)
      return next
    })
  }, [species, paletteKey])

  const addColor = useCallback(() => {
    if (colors.length >= maxColors) return
    const next = [...colors, '#888888']
    setColors(next)
    fetch('/shimmer/save-sprite', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species, paletteKey, colors: next }),
    }).then(r => r.json()).then(d => {
      if (d.success) setSaveMsg('Palette saved')
      else setSaveMsg(`Error: ${d.error}`)
      setTimeout(() => setSaveMsg(''), 2000)
    }).catch(() => {})
  }, [colors, species, paletteKey])

  const removeColor = useCallback(() => {
    if (colors.length <= 1) return
    const removed = colors.length
    const next = colors.slice(0, -1)
    setColors(next)
    setPixels(prev => prev.map(v => v >= removed ? 0 : v))
    if (brush >= removed) setBrush(1)
    fetch('/shimmer/save-sprite', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species, paletteKey, colors: next }),
    }).then(r => r.json()).then(d => {
      if (d.success) setSaveMsg('Palette saved')
      else setSaveMsg(`Error: ${d.error}`)
      setTimeout(() => setSaveMsg(''), 2000)
    }).catch(() => {})
  }, [colors, brush, species, paletteKey])

  // Render live preview
  useEffect(() => {
    const arr = new Uint8Array(compositePixels)
    for (const ref of [preview1xRef, preview4xRef]) {
      const ctx = ref.current?.getContext('2d')
      if (ctx) {
        ctx.canvas.width = SS
        ctx.canvas.height = SS
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, SS, SS)
        drawSprite(ctx, arr, colors, 0, 0, mode)
      }
    }
    const sctx = sceneRef.current?.getContext('2d')
    if (sctx) {
      const isBattle = animName === 'battle_front' || animName === 'battle_back'
      if (isBattle) {
        // Battle scene preview — bg is natively 320x192, sprite is 96x96
        sctx.canvas.width = BG_W
        sctx.canvas.height = BG_H
        sctx.imageSmoothingEnabled = false
        sctx.clearRect(0, 0, BG_W, BG_H)
        drawBattleBg(sctx, BG_W, BG_H, 'garden')
        // Position sprite: front = enemy (top-right area), back = player (bottom-left)
        if (animName === 'battle_front') {
          const sx = BG_W - SS - 40
          const sy = 16
          drawSprite(sctx, arr, colors, sx, sy, mode)
        } else {
          const sx = 24
          const sy = BG_H - SS - 8
          drawSprite(sctx, arr, colors, sx, sy, mode)
        }
      } else {
        // Overworld scene preview
        const sceneW = 240
        const sceneH = 160
        sctx.canvas.width = sceneW
        sctx.canvas.height = sceneH
        sctx.imageSmoothingEnabled = false
        sctx.clearRect(0, 0, sceneW, sceneH)
        drawTilemap(sctx, GARDEN.slice(4, 14).map(r => r.slice(4, 19)), mode)
        drawSprite(sctx, arr, colors, 112, 72, mode)
        drawSprite(sctx, arr, colors, 80, 72, mode, true)
      }
    }
  }, [compositePixels, colors, mode, SS, animName])

  const paint = useCallback((i: number) => {
    setPixels(prev => {
      const next = [...prev]
      next[i] = brush
      if (mirror) {
        const x = i % SS
        const y = Math.floor(i / SS)
        const mx = SS - 1 - x
        next[y * SS + mx] = brush
      }
      return next
    })
  }, [brush, mirror])

  // Keep refs in sync for stable canvas mouse handler access
  useEffect(() => { paintingRef.current = painting }, [painting])
  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { brushRef.current = brush }, [brush])
  useEffect(() => { mirrorRef.current = mirror }, [mirror])
  useEffect(() => { floatingRef.current = floating }, [floating])
  useEffect(() => { selStartRef.current = selStart }, [selStart])
  useEffect(() => { selEndRef.current = selEnd }, [selEnd])
  useEffect(() => { dragStartRef.current = dragStart }, [dragStart])
  useEffect(() => { pixelsRef.current = pixels }, [pixels])
  useEffect(() => { compositePixelsRef.current = compositePixels }, [compositePixels])

  // Canvas grid draw function
  const redrawGrid = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = SS * cellPx
    const h = SS * cellPx
    canvas.width = w
    canvas.height = h

    for (let cy = 0; cy < SS; cy++) {
      for (let cx = 0; cx < SS; cx++) {
        const i = cy * SS + cx
        const v = compositePixels[i]
        const px = cx * cellPx
        const py = cy * cellPx

        // Onion skin values
        const onPrev = (v === 0 && prevFramePixels) ? (prevFramePixels[i] ?? 0) : 0
        const onNext = (v === 0 && nextFramePixels) ? (nextFramePixels[i] ?? 0) : 0
        const hasOnion = onPrev !== 0 || onNext !== 0

        if (v !== 0) {
          // Solid color pixel
          ctx.fillStyle = colors[v - 1] ?? '#111'
          ctx.fillRect(px, py, cellPx, cellPx)
        } else if (hasOnion) {
          // Onion skin ghost
          ctx.fillStyle = '#111'
          ctx.fillRect(px, py, cellPx, cellPx)
          const ghostColorIdx = (onPrev || onNext) - 1
          const ghostHex = colors[ghostColorIdx] ?? '#888'
          ctx.fillStyle = onionRgba(ghostHex, onPrev ? 0.5 : 0.35, onPrev ? 'prev' : 'next')
          ctx.fillRect(px, py, cellPx, cellPx)
        } else {
          // Transparent pixel — dark checkerboard
          const half = Math.max(1, Math.floor(cellPx / 2))
          ctx.fillStyle = '#0e0e1a'
          ctx.fillRect(px, py, cellPx, cellPx)
          ctx.fillStyle = '#1a1a2a'
          ctx.fillRect(px, py, half, half)
          ctx.fillRect(px + half, py + half, cellPx - half, cellPx - half)
        }
      }
    }

    // Grid lines
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let cx = 1; cx < SS; cx++) {
        ctx.moveTo(cx * cellPx + 0.5, 0)
        ctx.lineTo(cx * cellPx + 0.5, h)
      }
      for (let cy = 1; cy < SS; cy++) {
        ctx.moveTo(0, cy * cellPx + 0.5)
        ctx.lineTo(w, cy * cellPx + 0.5)
      }
      ctx.stroke()
    }

    // Selection rectangle (marching ants style — dashed cyan)
    if (selStart && selEnd) {
      const x1 = Math.min(selStart.x, selEnd.x) * cellPx
      const y1 = Math.min(selStart.y, selEnd.y) * cellPx
      const x2 = (Math.max(selStart.x, selEnd.x) + 1) * cellPx
      const y2 = (Math.max(selStart.y, selEnd.y) + 1) * cellPx
      ctx.strokeStyle = 'rgba(100,200,255,0.8)'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
      ctx.setLineDash([])
    }

    // Floating selection border (dashed cyan outline around the floating region)
    if (floating) {
      const fx = floating.x * cellPx
      const fy = floating.y * cellPx
      const fw = floating.w * cellPx
      const fh = floating.h * cellPx
      ctx.strokeStyle = 'rgba(100,220,255,0.9)'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.strokeRect(fx, fy, fw, fh)
      ctx.setLineDash([])
    }

    // Line preview (semi-transparent brush color along the line path)
    if (linePreview && linePreview.length > 0) {
      const previewColor = brush > 0 ? (colors[brush - 1] ?? '#fff') : '#333'
      ctx.fillStyle = previewColor
      ctx.globalAlpha = 0.4
      for (const [lx, ly] of linePreview) {
        ctx.fillRect(lx * cellPx, ly * cellPx, cellPx, cellPx)
      }
      ctx.globalAlpha = 1
    }

    // Hover highlight (last so it's always visible)
    if (hoveredCell) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(hoveredCell.x * cellPx, hoveredCell.y * cellPx, cellPx, cellPx)
    }
  }, [compositePixels, colors, SS, cellPx, selStart, selEnd, floating, prevFramePixels, nextFramePixels, hoveredCell, showGrid, linePreview, brush])

  // Redraw canvas whenever visual state changes — debounced via RAF
  const rafRef = useRef<number>(0)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(redrawGrid)
    return () => cancelAnimationFrame(rafRef.current)
  }, [redrawGrid])

  const getDigitString = () => {
    const cp = floating ? compositePixels : pixels
    let out = ''
    for (let y = 0; y < SS; y++) {
      for (let x = 0; x < SS; x++) {
        out += cp[y * SS + x].toString(16)
      }
      out += '\n'
    }
    return out.trimEnd()
  }

  const exportString = () => {
    const out = getDigitString().split('\n').map(l => `  ${l}`).join('\n')
    navigator.clipboard.writeText(out)
    setSaveMsg('Copied!')
    setTimeout(() => setSaveMsg(''), 1500)
  }

  const saveToFile = async () => {
    if (floating) commitFloat()
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species,
          anim: animName,
          frameIndex,
          digits: getDigitString(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSaveMsg(`Saved ${data.saved}`)
        onSaved?.()
      } else {
        setSaveMsg(`Error: ${data.error}`)
      }
    } catch {
      setSaveMsg('Save failed')
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  // PNG import handlers
  const handleImportSingle = useCallback((importedPixels: number[]) => {
    pushUndo()
    setPixels(importedPixels)
    setFloating(null)
    setSaveMsg('Imported — remember to Save')
    setTimeout(() => setSaveMsg(''), 3000)
  }, [pushUndo])

  const handleImportMulti = useCallback(async (frames: number[][]) => {
    // Import first frame into current editor
    pushUndo()
    setPixels(frames[0])
    setFloating(null)
    // Save all frames via save-sprite API
    setSaving(true)
    setSaveMsg('Importing frames...')
    let saved = 0
    for (let i = 0; i < frames.length; i++) {
      try {
        const digits = pixelsToDigits(frames[i], SS)
        const res = await fetch('/shimmer/save-sprite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ species, anim: animName, frameIndex: i, digits }),
        })
        const data = await res.json()
        if (data.success) saved++
      } catch { /* continue with remaining frames */ }
    }
    setSaving(false)
    setSaveMsg(`Imported ${saved}/${frames.length} frames`)
    onSaved?.()
    setTimeout(() => setSaveMsg(''), 3000)
  }, [pushUndo, SS, species, animName, onSaved])

  // Canvas mouse helpers
  const getCellFromEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const x = Math.max(0, Math.min(SS - 1, Math.floor(e.nativeEvent.offsetX / cellPx)))
    const y = Math.max(0, Math.min(SS - 1, Math.floor(e.nativeEvent.offsetY / cellPx)))
    return { x, y }
  }, [SS, cellPx])

  // Stable paint ref so canvas handlers don't go stale
  const paintRef = useRef(paint)
  useEffect(() => { paintRef.current = paint }, [paint])

  const pushUndoRef = useRef(pushUndo)
  useEffect(() => { pushUndoRef.current = pushUndo }, [pushUndo])

  const liftSelectionRef = useRef(liftSelection)
  useEffect(() => { liftSelectionRef.current = liftSelection }, [liftSelection])

  const commitFloatRef = useRef(commitFloat)
  useEffect(() => { commitFloatRef.current = commitFloat }, [commitFloat])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: cx, y: cy } = getCellFromEvent(e)
    const i = cy * SS + cx
    const currentTool = toolRef.current
    const currentFloating = floatingRef.current

    // Alt+Click: eyedropper (works in any tool)
    if (e.altKey) {
      const pixelValue = compositePixelsRef.current[i]
      setBrush(pixelValue)
      return
    }

    if (currentTool === 'fill') {
      pushUndoRef.current()
      const currentBrush = brushRef.current
      const currentMirror = mirrorRef.current
      setPixels(prev => floodFill(prev, SS, cx, cy, currentBrush, currentMirror))
      return
    }

    if (currentTool === 'eraser') {
      if (!strokeStarted.current) { pushUndoRef.current(); strokeStarted.current = true }
      setPainting(true)
      const currentMirror = mirrorRef.current
      setPixels(prev => {
        const next = [...prev]
        next[i] = 0
        if (currentMirror) { next[cy * SS + (SS - 1 - cx)] = 0 }
        return next
      })
      lastPaintPos.current = { x: cx, y: cy }
      return
    }

    if (currentTool === 'line') {
      if (!lastPaintPos.current) {
        lastPaintPos.current = { x: cx, y: cy }
        return
      }
      // Second click — commit the line
      pushUndoRef.current()
      const { x: x0, y: y0 } = lastPaintPos.current
      const linePoints = bresenhamLine(x0, y0, cx, cy)
      const currentMirror = mirrorRef.current
      const currentBrush = brushRef.current
      setPixels(prev => {
        const next = [...prev]
        for (const [px, py] of linePoints) {
          const idx = py * SS + px
          next[idx] = currentBrush
          if (currentMirror) { next[py * SS + (SS - 1 - px)] = currentBrush }
        }
        return next
      })
      lastPaintPos.current = null
      setLinePreview(null)
      return
    }

    if (currentTool === 'paint') {
      // Shift+Click: Bresenham line from last paint position
      if (e.shiftKey && lastPaintPos.current) {
        pushUndoRef.current()
        strokeStarted.current = true
        const { x: x0, y: y0 } = lastPaintPos.current
        const linePoints = bresenhamLine(x0, y0, cx, cy)
        const currentMirror = mirrorRef.current
        const currentBrush = brushRef.current
        setPixels(prev => {
          const next = [...prev]
          for (const [px, py] of linePoints) {
            const idx = py * SS + px
            next[idx] = currentBrush
            if (currentMirror) {
              const mx = SS - 1 - px
              next[py * SS + mx] = currentBrush
            }
          }
          return next
        })
        lastPaintPos.current = { x: cx, y: cy }
        return
      }
      // Normal paint
      if (!strokeStarted.current) { pushUndoRef.current(); strokeStarted.current = true }
      setPainting(true)
      paintRef.current(i)
      lastPaintPos.current = { x: cx, y: cy }
    } else {
      // Select tool
      if (currentFloating) {
        const inFloat = cx >= currentFloating.x && cx < currentFloating.x + currentFloating.w
          && cy >= currentFloating.y && cy < currentFloating.y + currentFloating.h
        if (inFloat) {
          setDragStart({ x: cx, y: cy })
        } else {
          commitFloatRef.current()
          setSelStart({ x: cx, y: cy })
          setSelEnd({ x: cx, y: cy })
        }
      } else {
        setSelStart({ x: cx, y: cy })
        setSelEnd({ x: cx, y: cy })
      }
    }
  }, [getCellFromEvent, SS])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: cx, y: cy } = getCellFromEvent(e)
    setHoveredCell({ x: cx, y: cy })
    const i = cy * SS + cx
    const currentTool = toolRef.current
    const currentFloating = floatingRef.current
    const currentDragStart = dragStartRef.current

    if (currentTool === 'eraser') {
      if (paintingRef.current) {
        const currentMirror = mirrorRef.current
        setPixels(prev => {
          const next = [...prev]
          next[i] = 0
          if (currentMirror) { next[cy * SS + (SS - 1 - cx)] = 0 }
          return next
        })
        lastPaintPos.current = { x: cx, y: cy }
      }
    } else if (currentTool === 'line') {
      // Update line preview as mouse moves
      if (lastPaintPos.current) {
        setLinePreview(bresenhamLine(lastPaintPos.current.x, lastPaintPos.current.y, cx, cy))
      }
    } else if (currentTool === 'paint') {
      if (paintingRef.current) {
        paintRef.current(i)
        lastPaintPos.current = { x: cx, y: cy }
      }
    } else {
      if (currentDragStart && currentFloating) {
        const dx = cx - currentDragStart.x
        const dy = cy - currentDragStart.y
        if (dx !== 0 || dy !== 0) {
          setFloating(f => f ? { ...f, x: f.x + dx, y: f.y + dy } : null)
          setDragStart({ x: cx, y: cy })
        }
      } else if (selStartRef.current && !currentFloating) {
        setSelEnd({ x: cx, y: cy })
      }
    }
  }, [getCellFromEvent, SS])

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: cx, y: cy } = getCellFromEvent(e)
    const currentTool = toolRef.current
    const currentDragStart = dragStartRef.current
    const currentSelStart = selStartRef.current
    const currentSelEnd = selEndRef.current

    if (currentTool === 'paint' || currentTool === 'eraser') {
      setPainting(false)
      strokeStarted.current = false
    } else if (currentTool === 'select') {
      if (currentDragStart) {
        setDragStart(null)
      } else if (currentSelStart && currentSelEnd) {
        const x1 = Math.min(currentSelStart.x, currentSelEnd.x)
        const y1 = Math.min(currentSelStart.y, currentSelEnd.y)
        const x2 = Math.max(currentSelStart.x, currentSelEnd.x)
        const y2 = Math.max(currentSelStart.y, currentSelEnd.y)
        if (x1 === x2 && y1 === y2) {
          setSelStart(null); setSelEnd(null)
        } else {
          liftSelectionRef.current(x1, y1, x2, y2)
        }
      }
    }
  }, [getCellFromEvent])

  const handleCanvasMouseLeave = useCallback(() => {
    setPainting(false)
    strokeStarted.current = false
    setHoveredCell(null)
    // If mid-selection without floating, keep the selection but don't update end
  }, [])

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-text-faint text-[10px] uppercase tracking-widest">
          Pixel Editor{isDirty && <span className="text-red-400 ml-1" title="Unsaved changes">*</span>}
        </p>
        {onFrameChange && totalFrames && totalFrames > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (floating) commitFloat(); onFrameChange!(frameIndex > 0 ? frameIndex - 1 : totalFrames! - 1) }}
              className="w-6 h-6 rounded text-[11px] bg-white/5 text-text-faint hover:text-white hover:bg-white/10 flex items-center justify-center"
              title="Previous frame ([)"
            >&larr;</button>
            <span className="text-[11px] text-text-dim font-mono min-w-[50px] text-center">
              F{frameIndex} / {totalFrames}
            </span>
            <button
              onClick={() => { if (floating) commitFloat(); onFrameChange!(frameIndex < totalFrames! - 1 ? frameIndex + 1 : 0) }}
              className="w-6 h-6 rounded text-[11px] bg-white/5 text-text-faint hover:text-white hover:bg-white/10 flex items-center justify-center"
              title="Next frame (])"
            >&rarr;</button>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        <div>
          {/* Palette & brush selector */}
          <div className="flex gap-2 mb-3 items-center flex-wrap">
            <span className="text-[10px] text-text-faint mr-1">Brush:</span>
            {/* Transparent brush */}
            <button
              onClick={() => setBrush(0)}
              className={`w-7 h-7 rounded border-2 transition-all ${
                brush === 0 ? 'border-gold scale-110' : 'border-white/20'
              }`}
              style={{
                backgroundColor: '#0a0a1a',
                backgroundImage: 'linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%), linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%)',
                backgroundSize: '6px 6px',
                backgroundPosition: '0 0, 3px 3px',
              }}
              title="Transparent (0)"
            />
            {/* Color brushes */}
            {colors.map((c, i) => {
              const pickerId = `color-picker-${i}`
              return (
                <div key={i} className="relative">
                  <button
                    onClick={() => setBrush(i + 1)}
                    onDoubleClick={() => document.getElementById(pickerId)?.click()}
                    className={`w-7 h-7 rounded border-2 transition-all ${
                      brush === i + 1 ? 'border-gold scale-110' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: c }}
                    title={`Click: select · Double-click: change color · ${c}`}
                  />
                  <input
                    id={pickerId}
                    type="color"
                    value={c}
                    onChange={e => updateColor(i, e.target.value)}
                    className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                    tabIndex={-1}
                  />
                </div>
              )
            })}
            {colors.length < maxColors && (
              <button
                onClick={addColor}
                className="w-7 h-7 rounded border border-dashed border-white/20 text-white/40 hover:border-white/40 hover:text-white/60 text-sm flex items-center justify-center"
                title="Add color"
              >+</button>
            )}
            {colors.length > 1 && (
              <button
                onClick={removeColor}
                className="w-5 h-7 rounded text-white/30 hover:text-red-400 text-sm flex items-center justify-center"
                title="Remove last color"
              >-</button>
            )}
            <span className="text-[9px] text-text-faint ml-1">{colors.length}/{maxColors}</span>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button
              onClick={() => { if (floating) commitFloat(); setTool('paint') }}
              className={`px-2 py-1 rounded text-[10px] ${tool === 'paint' ? 'bg-white/15 text-white' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}
              title="Paint (B)"
            >Paint</button>
            <button
              onClick={() => { setTool('eraser'); lastPaintPos.current = null }}
              className={`px-2 py-1 rounded text-[10px] ${tool === 'eraser' ? 'bg-white/15 text-white' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}
              title="Eraser (E)"
            >Eraser</button>
            <button
              onClick={() => { setTool('fill') }}
              className={`px-2 py-1 rounded text-[10px] ${tool === 'fill' ? 'bg-white/15 text-white' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}
              title="Fill (G)"
            >Fill</button>
            <button
              onClick={() => { setTool('line'); lastPaintPos.current = null; setLinePreview(null) }}
              className={`px-2 py-1 rounded text-[10px] ${tool === 'line' ? 'bg-white/15 text-white' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}
              title="Line (L)"
            >Line</button>
            <button
              onClick={() => setTool('select')}
              className={`px-2 py-1 rounded text-[10px] ${tool === 'select' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}
              title="Select (V)"
            >Select</button>
            <button
              onClick={() => setShowGrid(g => !g)}
              className={`px-2 py-1 rounded text-[10px] ${showGrid ? 'bg-white/10 text-text-dim' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}
              title="Toggle grid (#)"
            >Grid</button>
            {showMirror && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button
                  onClick={() => setMirror(m => !m)}
                  className={`px-2 py-1 rounded text-[10px] border transition-all ${
                    mirror
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'bg-white/5 text-text-faint border-white/10 hover:bg-white/10'
                  }`}
                  title="Mirror paint (M)"
                >Mirror {mirror ? 'ON' : 'off'}</button>
              </>
            )}
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button onClick={handleFlipH} className="px-1.5 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim" title="Flip Horizontal">FlipH</button>
            <button onClick={handleFlipV} className="px-1.5 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim" title="Flip Vertical">FlipV</button>
            <div className="flex gap-0.5 ml-1">
              {[['<', -1, 0], ['>', 1, 0], ['^', 0, -1], ['v', 0, 1]].map(([label, dx, dy]) => (
                <button key={label as string} onClick={() => handleShift(dx as number, dy as number)}
                  className="w-5 h-5 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim flex items-center justify-center"
                  title={`Shift ${label}`}
                >{label as string}</button>
              ))}
            </div>
            {onBatchOperation && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button
                  onClick={() => setBatchMode(b => !b)}
                  className={`px-2 py-1 rounded text-[10px] border transition-all ${
                    batchMode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-white/5 text-text-faint border-white/10 hover:bg-white/10'
                  }`}
                  title="Apply flip/shift to ALL frames in current animation"
                >ALL {batchMode ? 'ON' : 'off'}</button>
              </>
            )}
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button
              onClick={() => setOnionSkin(o => !o)}
              className={`px-2 py-1 rounded text-[10px] border transition-all ${
                onionSkin
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                  : 'bg-white/5 text-text-faint border-white/10 hover:bg-white/10'
              }`}
              title="Onion skin — ghost adjacent frames (O)"
            >Onion {onionSkin ? 'ON' : 'off'}</button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button onClick={undo} disabled={history.length === 0}
              className="px-2 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >Undo{history.length > 0 ? ` (${history.length})` : ''}</button>
            <button onClick={redo} disabled={future.length === 0}
              className="px-2 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim disabled:opacity-30"
              title="Redo (Ctrl+Shift+Z)"
            >Redo{future.length > 0 ? ` (${future.length})` : ''}</button>
            <button
              onClick={() => { frameClipboard = [...pixels]; setClipMsg('Frame copied'); setTimeout(() => setClipMsg(''), 1500) }}
              className="px-2 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim"
              title="Copy frame pixels (Ctrl+Shift+C)"
            >Copy F</button>
            <button
              onClick={() => {
                if (frameClipboard) { pushUndo(); setPixels([...frameClipboard]); setFloating(null) }
                setClipMsg(frameClipboard ? 'Frame pasted' : 'Nothing to paste'); setTimeout(() => setClipMsg(''), 1500)
              }}
              disabled={!frameClipboard}
              className="px-2 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:text-text-dim disabled:opacity-30"
              title="Paste frame pixels (Ctrl+Shift+V)"
            >Paste F</button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            {isShared ? (
              <span className="px-3 py-1 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Shared with idle — edit in idle view
              </span>
            ) : (
              <button
                onClick={saveToFile}
                disabled={saving}
                className="px-3 py-1 rounded text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            <button
              onClick={exportString}
              className="px-3 py-1 rounded text-[10px] bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30"
            >
              Copy digits
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-1 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30"
            >
              Import PNG
            </button>
            <button
              onClick={() => { pushUndo(); setPixels(new Array(SS * SS).fill(0)); setFloating(null) }}
              className="px-3 py-1 rounded text-[10px] bg-white/5 text-text-faint hover:bg-white/10"
            >
              Clear
            </button>
            {saveMsg && (
              <span className={`text-[10px] ml-1 ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {saveMsg}
              </span>
            )}
            {clipMsg && <span className="text-[10px] ml-1 text-cyan-400">{clipMsg}</span>}
          </div>

          {/* Selection info bar */}
          {floating && (
            <div className="flex gap-2 mb-2 items-center text-[10px] text-cyan-300">
              <span>Selection {floating.w}x{floating.h} at ({floating.x},{floating.y})</span>
              <span className="text-text-faint">Enter=place Esc=cancel Arrows=nudge</span>
            </div>
          )}

          {/* Pixel grid — canvas */}
          <canvas
            ref={canvasRef}
            width={SS * cellPx}
            height={SS * cellPx}
            style={{ cursor: 'crosshair', display: 'block' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
          />
        </div>

        {/* Live previews */}
        <div className="flex flex-col gap-4">
          <div>
            <span className="text-[9px] text-text-faint block mb-1">
              {animName === 'battle_front' || animName === 'battle_back' ? 'Battle scene' : 'On tilemap (2x)'}
            </span>
            <canvas
              ref={sceneRef}
              className="border border-white/10 rounded"
              style={{
                imageRendering: 'pixelated',
                width: animName === 'battle_front' || animName === 'battle_back' ? 480 : 480,
                height: animName === 'battle_front' || animName === 'battle_back' ? 288 : 320,
              }}
            />
          </div>
          <div className="flex gap-4 items-end">
            <div className="text-center">
              <canvas
                ref={preview1xRef}
                className="border border-white/10 rounded"
                style={{ imageRendering: 'pixelated', width: SS, height: SS }}
              />
              <span className="text-[9px] text-text-faint block mt-1">1x</span>
            </div>
            <div className="text-center">
              <canvas
                ref={preview4xRef}
                className="border border-white/10 rounded"
                style={{ imageRendering: 'pixelated', width: SS * 4, height: SS * 4 }}
              />
              <span className="text-[9px] text-text-faint block mt-1">4x</span>
            </div>
          </div>
        </div>
      </div>
      <PngImport
        open={showImport}
        onClose={() => setShowImport(false)}
        palette={colors}
        gridSize={SS}
        onImportSingle={handleImportSingle}
        onImportMulti={handleImportMulti}
        species={species}
        animName={animName}
        frameIndex={frameIndex}
      />
    </div>
  )
}
