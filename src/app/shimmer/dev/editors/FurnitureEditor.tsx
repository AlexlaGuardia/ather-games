'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { FURNITURE, FURNITURE_ICONS, FURNITURE_FRAME_MAP } from '../../sprites/furniture'
import { ITEM_PALETTE } from '../../sprites/items'
import { SpriteAnim } from '../../sprites/sprite-data'
import { ViewMode, parseDigits, pixelsToDigits, flipH, flipV, shiftAllPixels } from '../../components/PixelUtils'
import { FramePreview, drawSprite } from '../../components/SpriteRenderers'
import PixelEditor from '../../components/PixelEditor'
import EditorShell from '../templates/EditorShell'
import { PIXEL_EDITOR_SHORTCUTS } from '../templates/shortcut-data'
import ViewModeToggle from '../templates/ViewModeToggle'

export default function FurnitureEditor({ onDeploy, deployState }: {
  onDeploy: () => void
  deployState: 'idle' | 'building' | 'done' | 'error'
}) {
  const [selected, setSelected] = useState(FURNITURE[0]?.id ?? '')
  const [frameIndex, setFrameIndex] = useState(0)
  const [mode, setMode] = useState<ViewMode>('normal')
  const [liveSprites, setLiveSprites] = useState<Record<string, SpriteAnim> | null>(null)
  const [loadStatus, setLoadStatus] = useState<string>('')
  const gridRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => { setFrameIndex(0) }, [selected])

  // Load live sprite data from API — use authoritative frameMap
  const [liveFrameMapData, setLiveFrameMapData] = useState<Record<string, string[]> | null>(null)
  const loadLiveData = useCallback(async () => {
    try {
      setLoadStatus('loading...')
      const res = await fetch('/shimmer/save-sprite?species=furniture')
      const data = await res.json()
      if (data.frames) {
        const fmap: Record<string, string[]> = data.frameMap ?? {}
        setLiveFrameMapData(fmap)
        const overrides: Record<string, SpriteAnim> = {}
        for (const [key, constNames] of Object.entries(fmap)) {
          const frames: Uint8Array[] = []
          for (const name of constNames) {
            if (data.frames[name]) {
              frames.push(parseDigits(data.frames[name], 32 * 32))
            } else {
              frames.push(FURNITURE_ICONS[key]?.frames[0] ?? new Uint8Array(1024))
            }
          }
          if (frames.length > 0) {
            overrides[key] = { frames, rate: frames.length > 1 ? 8 : 1 }
          }
        }
        setLiveSprites(overrides)
        setLoadStatus('live')
      }
    } catch {
      setLoadStatus('failed')
    }
  }, [])

  useEffect(() => { loadLiveData() }, [loadLiveData])

  const sprites = useMemo(() => {
    const base = { ...FURNITURE_ICONS }
    if (liveSprites) {
      for (const [k, v] of Object.entries(liveSprites)) base[k] = v
    }
    return base
  }, [liveSprites])

  // Use authoritative frame map from API (falls back to static FURNITURE_FRAME_MAP)
  const liveFrameMap = useMemo(() => {
    return liveFrameMapData ?? FURNITURE_FRAME_MAP
  }, [liveFrameMapData])

  const currentAnim = sprites[selected]
  const totalFrames = currentAnim?.frames.length ?? 1
  const safeFrameIndex = Math.min(frameIndex, totalFrames - 1)
  const currentFrame = currentAnim?.frames[safeFrameIndex]
  const currentFurn = FURNITURE.find(f => f.id === selected)
  const palette = ITEM_PALETTE as unknown as readonly string[]

  const [addingFrame, setAddingFrame] = useState(false)

  const addFrame = useCallback(async () => {
    setAddingFrame(true)
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'furniture', anim: selected }),
      })
      const data = await res.json()
      if (data.success) {
        await loadLiveData()
        setFrameIndex(data.frameCount - 1)
      }
    } catch {}
    setAddingFrame(false)
  }, [selected, loadLiveData])

  const duplicateFrame = useCallback(async (currentPixels: number[]) => {
    setAddingFrame(true)
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'furniture', anim: selected }),
      })
      const data = await res.json()
      if (data.success) {
        // Write the duplicated pixels to the new frame
        await fetch('/shimmer/save-sprite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ species: 'furniture', anim: selected, frameIndex: data.frameCount - 1, digits: pixelsToDigits(currentPixels, 32) }),
        })
        await loadLiveData()
        setFrameIndex(data.frameCount - 1)
      }
    } catch {}
    setAddingFrame(false)
  }, [selected, loadLiveData])

  const deleteFrame = useCallback(async (fi: number) => {
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'furniture', anim: selected, frameIndex: fi }),
      })
      const data = await res.json()
      if (data.success) {
        await loadLiveData()
        setFrameIndex(Math.max(0, fi - 1))
      }
    } catch {}
  }, [selected, loadLiveData])

  const handleBatchOp = useCallback(async (op: 'flipH' | 'flipV' | 'shiftUp' | 'shiftDown' | 'shiftLeft' | 'shiftRight') => {
    if (!currentAnim) return
    for (let i = 0; i < currentAnim.frames.length; i++) {
      let px = Array.from(currentAnim.frames[i])
      switch (op) {
        case 'flipH': px = flipH(px, 32, 32); break
        case 'flipV': px = flipV(px, 32, 32); break
        case 'shiftUp': px = shiftAllPixels(px, 0, -1, 32); break
        case 'shiftDown': px = shiftAllPixels(px, 0, 1, 32); break
        case 'shiftLeft': px = shiftAllPixels(px, -1, 0, 32); break
        case 'shiftRight': px = shiftAllPixels(px, 1, 0, 32); break
      }
      await fetch('/shimmer/save-sprite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'furniture', anim: selected, frameIndex: i, digits: pixelsToDigits(px, 32) }),
      })
    }
    await loadLiveData()
  }, [currentAnim, selected, loadLiveData])

  // Preview grid: all furniture pieces in a row
  useEffect(() => {
    const ctx = gridRef.current?.getContext('2d')
    if (!ctx) return

    const cell = 22
    const pad = 3
    const cols = FURNITURE.length
    const w = cols * cell + pad * 2
    const h = cell + pad * 2

    ctx.canvas.width = w
    ctx.canvas.height = h
    ctx.imageSmoothingEnabled = false

    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(212, 168, 67, 0.3)'
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)

    FURNITURE.forEach((furn, i) => {
      const x = pad + i * cell
      const y = pad

      if (furn.id === selected) {
        ctx.fillStyle = 'rgba(212, 168, 67, 0.15)'
        ctx.fillRect(x, y, cell, cell)
      }

      const anim = sprites[furn.id]
      if (anim?.frames[0]) {
        drawSprite(ctx, anim.frames[0], palette, x + 3, y + 3, mode)
      }
    })
  }, [sprites, selected, palette, mode])

  return (
    <EditorShell
      title="Furniture Dev"
      subtitle="Placeable world objects — 32x32 sprites"
      loadStatus={loadStatus}
      shortcuts={PIXEL_EDITOR_SHORTCUTS}
      onDeploy={onDeploy}
      deployState={deployState}
    >
      {/* Furniture selector */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <div className="flex gap-1 flex-wrap">
          {FURNITURE.map(furn => (
            <button
              key={furn.id}
              onClick={() => setSelected(furn.id)}
              className={`px-3 py-1.5 rounded text-xs font-display ${
                selected === furn.id
                  ? 'bg-gold/20 text-gold border border-gold/30'
                  : 'bg-white/5 text-text-dim border border-white/5 hover:bg-white/10'
              }`}
            >
              {furn.name}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-white/10" />
        {currentFurn && (
          <span className="text-[11px] text-text-faint italic">
            Interaction: <span className="text-violet-400">{currentFurn.interactionPanel}</span>
            {' '}&middot;{' '}
            {currentFurn.price} Marks
          </span>
        )}
        <div className="w-px h-6 bg-white/10" />
        <ViewModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* Frame controls */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] text-text-faint uppercase tracking-wider">Frames</span>
        <span className="text-[11px] text-text-dim font-mono">
          {safeFrameIndex + 1} / {totalFrames}
        </span>
        <button
          onClick={addFrame}
          disabled={addingFrame}
          className="px-2 py-0.5 text-[10px] rounded border border-gold/30 text-gold hover:bg-gold/10 transition-all disabled:opacity-30"
          title="Add blank frame"
        >
          {addingFrame ? '...' : '+ Frame'}
        </button>
        {totalFrames > 1 && (
          <button
            onClick={() => deleteFrame(safeFrameIndex)}
            className="px-2 py-0.5 text-[10px] rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
            title="Delete current frame"
          >
            Delete
          </button>
        )}
        {totalFrames > 1 && (
          <span className="text-[9px] text-text-faint">
            [ ] to navigate &middot; O for onion skin
          </span>
        )}
      </div>

      {/* Editor + Side Panel */}
      <div className="flex gap-8">
        {/* Pixel Editor */}
        <div className="flex-1">
          {currentFrame && (
            <PixelEditor
              palette={palette}
              initialPixels={currentFrame}
              gridSize={32}
              mode={mode}
              species="furniture"
              animName={selected}
              frameIndex={safeFrameIndex}
              totalFrames={totalFrames}
              onFrameChange={setFrameIndex}
              onSaved={() => loadLiveData()}
              allSprites={sprites}
              paletteKey="base"
              frameConstMap={liveFrameMap}
              onBatchOperation={handleBatchOp}
              onDuplicateFrame={duplicateFrame}
            />
          )}
        </div>

        {/* Info + Preview Panel */}
        <div className="flex flex-col gap-5 w-56">
          {/* Furniture catalog */}
          <div>
            <span className="text-[9px] text-text-faint block mb-2">All Furniture (4x)</span>
            <canvas
              ref={gridRef}
              className="border border-white/10 rounded"
              style={{ imageRendering: 'pixelated', transform: 'scale(4)', transformOrigin: 'top left' }}
            />
          </div>

          <div style={{ marginTop: 60 }} />

          {/* Furniture info card */}
          {currentFurn && (
            <div className="bg-white/5 rounded-lg border border-white/10 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {currentFrame && (
                  <FramePreview
                    pixels={currentFrame}
                    palette={palette}
                    scale={3}
                    mode={mode}
                  />
                )}
                <div>
                  <span className="text-sm font-display text-white">{currentFurn.name}</span>
                  <div className="mt-0.5">
                    <span className="text-[10px] text-violet-400">{currentFurn.interactionPanel}</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-text-dim leading-relaxed">{currentFurn.description}</p>
              <div className="flex gap-4 text-[10px]">
                <div>
                  <span className="text-text-faint block">Price</span>
                  <span className="text-amber-300 font-mono">{currentFurn.price} M</span>
                </div>
                <div>
                  <span className="text-text-faint block">Panel</span>
                  <span className="text-text-dim font-mono">{currentFurn.interactionPanel}</span>
                </div>
                <div>
                  <span className="text-text-faint block">Stackable</span>
                  <span className="text-text-dim">No</span>
                </div>
              </div>
            </div>
          )}

          {/* Scale previews */}
          <div>
            <span className="text-[9px] text-text-faint block mb-2">Scale Preview</span>
            <div className="flex gap-3 items-end">
              {[2, 4, 6].map(scale => {
                if (!currentFrame) return null
                return (
                  <div key={scale} className="text-center">
                    <FramePreview
                      pixels={currentFrame}
                      palette={palette}
                      scale={scale}
                      mode={mode}
                    />
                    <span className="text-[8px] text-text-faint mt-1 block">{scale}x</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Palette reference */}
          <div>
            <span className="text-[9px] text-text-faint block mb-2">Palette</span>
            <div className="grid grid-cols-4 gap-1">
              {ITEM_PALETTE.map((color, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded border border-white/10"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[9px] text-text-faint">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </EditorShell>
  )
}
