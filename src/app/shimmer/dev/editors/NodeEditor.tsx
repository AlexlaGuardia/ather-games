'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { ITEM_PALETTE, NODE_PALETTES, NODE_SPRITES, NODE_TYPE_LABELS, NODE_FRAME_MAP } from '../../sprites/items'
import { SpriteAnim } from '../../sprites/sprite-data'
import { ViewMode, parseDigits, pixelsToDigits, flipH, flipV, shiftAllPixels } from '../../components/PixelUtils'
import { FramePreview, drawSprite } from '../../components/SpriteRenderers'
import PixelEditor from '../../components/PixelEditor'
import EditorShell from '../templates/EditorShell'
import { PIXEL_EDITOR_SHORTCUTS } from '../templates/shortcut-data'
import ViewModeToggle from '../templates/ViewModeToggle'

type NodeSpriteState = 'harvestable' | 'depleted'

const NODE_KEYS = Object.keys(NODE_TYPE_LABELS)

// Group node keys by category for the selector
const CATEGORIES = ['Forestry', 'Prospecting', 'Rinning'] as const

export default function NodeEditor({ onDeploy, deployState }: {
  onDeploy: () => void
  deployState: 'idle' | 'building' | 'done' | 'error'
}) {
  const [selected, setSelected] = useState(NODE_KEYS[0])
  const [spriteState, setSpriteState] = useState<NodeSpriteState>('harvestable')
  const [mode, setMode] = useState<ViewMode>('normal')
  const [liveSprites, setLiveSprites] = useState<Record<string, Record<NodeSpriteState, SpriteAnim>> | null>(null)
  const [loadStatus, setLoadStatus] = useState<string>('')
  const [livePalettes, setLivePalettes] = useState<Record<string, string[]> | null>(null)
  const [editingFrame, setEditingFrame] = useState(0)
  const [addingFrame, setAddingFrame] = useState(false)
  const [deletingFrame, setDeletingFrame] = useState<number | null>(null)
  const gridRef = useRef<HTMLCanvasElement>(null)

  // Reset frame when switching node or state
  useEffect(() => { setEditingFrame(0) }, [selected, spriteState])

  // Load live sprite data from API
  const loadLiveData = useCallback(async () => {
    try {
      setLoadStatus('loading...')
      const res = await fetch('/shimmer/save-sprite?species=nodes')
      const data = await res.json()
      // Load per-node palettes from API
      if (data.palettes) {
        setLivePalettes(data.palettes)
      }
      if (data.frames) {
        const overrides: Record<string, Record<NodeSpriteState, SpriteAnim>> = {}
        // Use the authoritative frameMap from the API (matches NODE_FRAME_MAP in source)
        const fmap: Record<string, string[]> = data.frameMap ?? {}
        for (const [frameKey, constNames] of Object.entries(fmap)) {
          const spriteBase = frameKey.replace(/_[hd]$/, '')
          const state: NodeSpriteState = frameKey.endsWith('_d') ? 'depleted' : 'harvestable'

          const frames: Uint8Array[] = []
          for (const name of constNames) {
            if (data.frames[name]) {
              frames.push(parseDigits(data.frames[name], 1024))
            }
          }

          if (frames.length > 0) {
            if (!overrides[spriteBase]) {
              overrides[spriteBase] = {
                harvestable: NODE_SPRITES[spriteBase]?.harvestable ?? { frames: [new Uint8Array(1024)], rate: 1 },
                depleted: NODE_SPRITES[spriteBase]?.depleted ?? { frames: [new Uint8Array(1024)], rate: 1 },
              }
            }
            overrides[spriteBase][state] = { frames, rate: frames.length > 1 ? 8 : 1 }
          }
        }
        setLiveSprites(overrides)
        setLoadStatus('live')
      } else {
        setLoadStatus('live')
      }
    } catch {
      setLoadStatus('failed')
    }
  }, [])

  useEffect(() => { loadLiveData() }, [loadLiveData])

  // Merged sprites: live overrides on top of static
  const sprites = useMemo(() => {
    // Start from a deep-ish copy of static NODE_SPRITES
    const base: Record<string, Record<NodeSpriteState, SpriteAnim>> = {}
    for (const [k, v] of Object.entries(NODE_SPRITES)) {
      base[k] = { ...v }
    }
    if (liveSprites) {
      for (const [k, v] of Object.entries(liveSprites)) {
        if (!base[k]) base[k] = { harvestable: { frames: [new Uint8Array(1024)], rate: 1 }, depleted: { frames: [new Uint8Array(1024)], rate: 1 } }
        base[k] = { ...base[k], ...v }
      }
    }
    return base
  }, [liveSprites])

  // Build a flat sprite record for PixelEditor (it expects Record<string, SpriteAnim>)
  const flatSprites = useMemo(() => {
    const flat: Record<string, SpriteAnim> = {}
    for (const [nodeKey, states] of Object.entries(sprites)) {
      flat[`${nodeKey}_h`] = states.harvestable
      flat[`${nodeKey}_d`] = states.depleted
    }
    return flat
  }, [sprites])

  const currentSprite = sprites[selected]?.[spriteState]
  const frameCount = currentSprite?.frames.length ?? 1
  const currentFrame = currentSprite?.frames[Math.min(editingFrame, frameCount - 1)]
  const currentLabel = NODE_TYPE_LABELS[selected]
  const palette = (livePalettes?.[selected] ?? NODE_PALETTES[selected] ?? [...ITEM_PALETTE]) as readonly string[]

  // The animName for PixelEditor = nodeType + state suffix
  const animName = `${selected}_${spriteState === 'harvestable' ? 'h' : 'd'}`

  const addFrame = useCallback(async () => {
    setAddingFrame(true)
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'nodes', node: animName }),
      })
      const data = await res.json()
      if (data.success) {
        await loadLiveData()
        setEditingFrame(data.frameCount - 1)
      }
    } catch {}
    setAddingFrame(false)
  }, [animName, loadLiveData])

  const duplicateFrame = useCallback(async (currentPixels: number[]) => {
    setAddingFrame(true)
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'nodes', node: animName }),
      })
      const data = await res.json()
      if (data.success) {
        const insertIdx = editingFrame + 1
        await fetch('/shimmer/save-sprite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ species: 'nodes', anim: animName, frameIndex: insertIdx, digits: pixelsToDigits(currentPixels, 32) }),
        })
        await loadLiveData()
        setEditingFrame(insertIdx)
      }
    } catch {}
    setAddingFrame(false)
  }, [editingFrame, animName, loadLiveData])

  const handleBatchOp = useCallback(async (op: 'flipH' | 'flipV' | 'shiftUp' | 'shiftDown' | 'shiftLeft' | 'shiftRight') => {
    if (!currentSprite) return
    for (let i = 0; i < currentSprite.frames.length; i++) {
      let px = Array.from(currentSprite.frames[i])
      switch (op) {
        case 'flipH': px = flipH(px, 32, 32); break
        case 'flipV': px = flipV(px, 32, 32); break
        case 'shiftUp': px = shiftAllPixels(px, 0, -1); break
        case 'shiftDown': px = shiftAllPixels(px, 0, 1); break
        case 'shiftLeft': px = shiftAllPixels(px, -1, 0); break
        case 'shiftRight': px = shiftAllPixels(px, 1, 0); break
      }
      await fetch('/shimmer/save-sprite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'nodes', anim: animName, frameIndex: i, digits: pixelsToDigits(px, 32) }),
      })
    }
    await loadLiveData()
  }, [currentSprite, animName, loadLiveData])

  const deleteFrame = useCallback(async (frameIdx: number) => {
    setDeletingFrame(frameIdx)
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'nodes', node: animName, frameIndex: frameIdx }),
      })
      const data = await res.json()
      if (data.success) {
        await loadLiveData()
        setEditingFrame(Math.max(0, frameIdx - 1))
      }
    } catch {}
    setDeletingFrame(null)
  }, [animName, loadLiveData])

  // Render node grid preview
  useEffect(() => {
    const ctx = gridRef.current?.getContext('2d')
    if (!ctx) return
    const cols = 4
    const rows = Math.ceil(NODE_KEYS.length / cols)
    const cell = 22
    const pad = 3
    const w = cols * cell + pad * 2
    const h = rows * cell + pad * 2
    ctx.canvas.width = w
    ctx.canvas.height = h
    ctx.imageSmoothingEnabled = false

    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)'
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)

    NODE_KEYS.forEach((key, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = pad + col * cell
      const y = pad + row * cell

      if (key === selected) {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.15)'
        ctx.fillRect(x, y, cell, cell)
      }

      const anim = sprites[key]?.harvestable
      const nodePal = (livePalettes?.[key] ?? NODE_PALETTES[key] ?? [...ITEM_PALETTE]) as readonly string[]
      if (anim) drawSprite(ctx, anim.frames[0], nodePal, x + 3, y + 3, mode)
    })
  }, [sprites, selected, livePalettes, mode])

  return (
    <EditorShell
      title="Node Dev"
      subtitle="Resource nodes — 32x32 world sprites"
      loadStatus={loadStatus}
      shortcuts={PIXEL_EDITOR_SHORTCUTS}
      onDeploy={onDeploy}
      deployState={deployState}
    >

      {/* Node selector — grouped by category */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        {CATEGORIES.map(cat => {
          const nodes = NODE_KEYS.filter(k => NODE_TYPE_LABELS[k]?.category === cat)
          if (nodes.length === 0) return null
          return (
            <div key={cat} className="flex gap-1 items-center">
              <span className="text-[9px] text-text-faint uppercase tracking-wider mr-1">{cat}</span>
              {nodes.map(key => (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`px-3 py-1.5 rounded text-xs font-display ${
                    selected === key
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-white/5 text-text-dim border border-white/5 hover:bg-white/10'
                  }`}
                >
                  {NODE_TYPE_LABELS[key]?.name ?? key}
                </button>
              ))}
              <div className="w-px h-6 bg-white/10 ml-1" />
            </div>
          )
        })}
      </div>

      {/* State toggle + view mode + above indicator */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1">
          {(['harvestable', 'depleted'] as NodeSpriteState[]).map(s => (
            <button
              key={s}
              onClick={() => setSpriteState(s)}
              className={`px-3 py-1.5 rounded text-[11px] font-display ${
                spriteState === s
                  ? s === 'harvestable' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-white/5 text-text-faint border border-white/5 hover:bg-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-white/10" />
        <ViewModeToggle mode={mode} onChange={setMode} />
        <div className="w-px h-6 bg-white/10" />
        {currentLabel && (
          <span className="text-[11px]">
            <span className="text-text-faint">{currentLabel.category}</span>
            {currentLabel.above && (
              <span className="ml-2 text-violet-400/80 text-[10px]">renders above player</span>
            )}
          </span>
        )}
      </div>

      {/* Frame strip + Add Frame */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-2 items-end flex-wrap">
          {currentSprite?.frames.map((frame, i) => (
            <div key={i} className="relative group/frame">
              <button
                onClick={() => setEditingFrame(i)}
                className={`text-center rounded-lg p-1.5 transition-all ${
                  editingFrame === i
                    ? 'bg-green-500/15 ring-2 ring-green-500/40'
                    : 'hover:bg-white/5'
                }`}
              >
                <FramePreview pixels={frame} palette={palette} scale={4} mode={mode} />
                <span className={`text-[9px] mt-1 block ${
                  editingFrame === i ? 'text-green-400' : 'text-text-faint'
                }`}>
                  F{i}
                </span>
              </button>
              {frameCount > 1 && (
                <button
                  onClick={() => deleteFrame(i)}
                  disabled={deletingFrame !== null}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white text-[8px] flex items-center justify-center opacity-0 group-hover/frame:opacity-100 transition-opacity hover:bg-red-400 disabled:opacity-30"
                  title={`Delete frame F${i}`}
                >
                  {deletingFrame === i ? '...' : 'x'}
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addFrame}
            disabled={addingFrame}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-white/20 hover:border-green-500/40 hover:bg-green-500/5 text-white/40 hover:text-green-400 text-lg flex items-center justify-center transition-all disabled:opacity-30"
            title="Add animation frame"
          >
            {addingFrame ? '...' : '+'}
          </button>
        </div>
        <span className="text-[10px] text-text-faint ml-2">{frameCount}f @ {currentSprite?.rate ?? 1}t</span>
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
              species="nodes"
              animName={animName}
              frameIndex={editingFrame}
              totalFrames={frameCount}
              onFrameChange={setEditingFrame}
              onSaved={() => loadLiveData()}
              allSprites={flatSprites}
              paletteKey={selected}
              maxColors={14}
              frameConstMap={NODE_FRAME_MAP}
              onDuplicateFrame={duplicateFrame}
              onBatchOperation={handleBatchOp}
            />
          )}
        </div>

        {/* Info + Preview Panel */}
        <div className="flex flex-col gap-5 w-56">
          {/* Node catalog grid */}
          <div>
            <span className="text-[9px] text-text-faint block mb-2">All Nodes (4x)</span>
            <canvas
              ref={gridRef}
              className="border border-white/10 rounded"
              style={{ imageRendering: 'pixelated', transform: 'scale(4)', transformOrigin: 'top left' }}
            />
          </div>

          {/* Spacer for scaled canvas */}
          <div style={{ marginTop: NODE_KEYS.length > 4 ? 200 : 100 }} />

          {/* Node details card */}
          {currentLabel && (
            <div className="bg-white/5 rounded-lg border border-white/10 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {currentFrame && (
                  <FramePreview pixels={currentFrame} palette={palette} scale={3} mode={mode} />
                )}
                <div>
                  <span className="text-sm font-display text-white">{currentLabel.name}</span>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-text-faint">{currentLabel.category}</span>
                    <span className={`text-[10px] ${spriteState === 'harvestable' ? 'text-green-400' : 'text-amber-400'}`}>
                      {spriteState}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 text-[10px]">
                <div>
                  <span className="text-text-faint block">Above</span>
                  <span className={currentLabel.above ? 'text-violet-400' : 'text-text-dim'}>
                    {currentLabel.above ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* State comparison — harvestable vs depleted side by side */}
          <div>
            <span className="text-[9px] text-text-faint block mb-2">Harvestable vs Depleted</span>
            <div className="flex gap-3 items-end">
              {(['harvestable', 'depleted'] as NodeSpriteState[]).map(s => {
                const frame = sprites[selected]?.[s]?.frames[0]
                if (!frame) return null
                return (
                  <div key={s} className="text-center">
                    <FramePreview pixels={frame} palette={palette} scale={4} mode={mode} />
                    <span className={`text-[8px] mt-1 block ${s === 'harvestable' ? 'text-green-400/60' : 'text-amber-400/60'}`}>
                      {s}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scale previews */}
          <div>
            <span className="text-[9px] text-text-faint block mb-2">Scale Preview</span>
            <div className="flex gap-3 items-end">
              {[2, 4, 6].map(scale => {
                if (!currentFrame) return null
                return (
                  <div key={scale} className="text-center">
                    <FramePreview pixels={currentFrame} palette={palette} scale={scale} mode={mode} />
                    <span className="text-[8px] text-text-faint mt-1 block">{scale}x</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Palette reference — per-node */}
          <div>
            <span className="text-[9px] text-text-faint block mb-2">Palette ({palette.length}/15)</span>
            <div className="grid grid-cols-4 gap-1">
              {palette.map((color, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded border border-white/10" style={{ backgroundColor: color }} />
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
