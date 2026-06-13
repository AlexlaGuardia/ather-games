'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { ITEM_ICONS, ITEM_PALETTE, ITEM_PALETTES, ITEM_FRAME_MAP, ITEMS } from '../../sprites/items'
import { SpriteAnim } from '../../sprites/sprite-data'
import { ViewMode, parseDigits, pixelsToDigits, flipH, flipV, shiftAllPixels } from '../../components/PixelUtils'
import { FramePreview, drawSprite } from '../../components/SpriteRenderers'
import PixelEditor from '../../components/PixelEditor'
import EditorShell from '../templates/EditorShell'
import { PIXEL_EDITOR_SHORTCUTS } from '../templates/shortcut-data'
import ViewModeToggle from '../templates/ViewModeToggle'
import { useInspector } from '../templates/inspector-context'

const RARITY_COLORS: Record<string, string> = {
  common: 'text-text-dim',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  legendary: 'text-amber-400',
}

const TYPE_LABELS: Record<string, string> = {
  fruit: 'Fruit',
  seed: 'Seed',
  crop_seed: 'Crop Seed',
  consumable: 'Consumable',
  key: 'Key Item',
  resource: 'Resource',
  tool: 'Tool',
  furniture: 'Furniture',
}

const CATEGORY_ORDER: string[] = ['resource', 'consumable', 'fruit', 'seed', 'crop_seed', 'tool', 'key', 'furniture']

const CATEGORY_COLORS: Record<string, string> = {
  resource: '#4ade80',
  consumable: '#f87171',
  fruit: '#fbbf24',
  seed: '#c084fc',
  crop_seed: '#a78bfa',
  tool: '#60a5fa',
  key: '#e879f9',
  furniture: '#d4a843',
}

export default function ItemEditor({ onDeploy, deployState }: {
  onDeploy: () => void
  deployState: 'idle' | 'building' | 'done' | 'error'
}) {
  const [selected, setSelected] = useState(ITEMS[0]?.id ?? '')
  const [frameIndex, setFrameIndex] = useState(0)
  const [mode, setMode] = useState<ViewMode>('normal')
  const [liveSprites, setLiveSprites] = useState<Record<string, SpriteAnim> | null>(null)
  const [loadStatus, setLoadStatus] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const gridRef = useRef<HTMLCanvasElement>(null)

  // Reset frame when switching items
  useEffect(() => { setFrameIndex(0) }, [selected])

  // Load live sprite data — use authoritative frameMap from API
  const [liveFrameMapData, setLiveFrameMapData] = useState<Record<string, string[]> | null>(null)
  const [livePalettes, setLivePalettes] = useState<Record<string, string[]> | null>(null)
  const loadLiveData = useCallback(async () => {
    try {
      setLoadStatus('loading...')
      const res = await fetch('/shimmer/save-sprite?species=items')
      const data = await res.json()
      if (data.palettes) {
        setLivePalettes(data.palettes)
      }
      if (data.frames) {
        const fmap: Record<string, string[]> = data.frameMap ?? {}
        setLiveFrameMapData(fmap)
        const overrides: Record<string, SpriteAnim> = {}
        for (const [itemKey, constNames] of Object.entries(fmap)) {
          const frames: Uint8Array[] = []
          for (const name of constNames) {
            if (data.frames[name]) {
              frames.push(parseDigits(data.frames[name], 32 * 32))
            } else {
              frames.push(ITEM_ICONS[itemKey]?.frames[0] ?? new Uint8Array(1024))
            }
          }
          if (frames.length > 0) {
            overrides[itemKey] = { frames, rate: frames.length > 1 ? 8 : 1 }
          }
        }
        setLiveSprites(overrides)
        setLoadStatus('live')
      }
    } catch {
      setLoadStatus('failed')
    }
  }, [])

  useEffect(() => {
    loadLiveData()
  }, [loadLiveData])

  const sprites = useMemo(() => {
    const base = { ...ITEM_ICONS }
    if (liveSprites) {
      for (const [k, v] of Object.entries(liveSprites)) base[k] = v
    }
    return base
  }, [liveSprites])

  // Use authoritative frame map from API (falls back to static ITEM_FRAME_MAP)
  const liveFrameMap = useMemo(() => {
    return liveFrameMapData ?? ITEM_FRAME_MAP
  }, [liveFrameMapData])

  const currentAnim = sprites[selected]
  const totalFrames = currentAnim?.frames.length ?? 1
  const safeFrameIndex = Math.min(frameIndex, totalFrames - 1)
  const currentFrame = currentAnim?.frames[safeFrameIndex]
  const currentItem = ITEMS.find(i => i.id === selected)
  const palette = (livePalettes?.[selected] ?? ITEM_PALETTES[selected] ?? [...ITEM_PALETTE]) as readonly string[]
  const { setInspectorContent, setInspectorTitle } = useInspector()

  // Push item details to inspector
  useEffect(() => {
    setInspectorTitle('Item Details')
    if (!currentItem) {
      setInspectorContent(null)
      return
    }
    setInspectorContent(
      <div className="p-3 space-y-3">
        <div>
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Name</span>
          <div className="text-sm font-display text-white/80">{currentItem.name}</div>
        </div>
        <div>
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Type</span>
          <div className="text-xs text-white/60">{TYPE_LABELS[currentItem.type] ?? currentItem.type}</div>
        </div>
        <div>
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Rarity</span>
          <div className={`text-xs capitalize ${RARITY_COLORS[currentItem.rarity]}`}>{currentItem.rarity}</div>
        </div>
        <div>
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Description</span>
          <div className="text-[11px] text-white/50 leading-relaxed">{currentItem.description}</div>
        </div>
        {currentItem.effect && (
          <div>
            <span className="text-[9px] text-white/40 uppercase tracking-wider">Effect</span>
            <div className="text-xs text-green-400">+{currentItem.effect.amount} {currentItem.effect.stat}</div>
          </div>
        )}
        <div className="flex gap-4 text-[10px]">
          <div>
            <span className="text-white/40 block">Stackable</span>
            <span className="text-white/60">{currentItem.stackable ? `Yes (x${currentItem.maxStack})` : 'No'}</span>
          </div>
          <div>
            <span className="text-white/40 block">Tradeable</span>
            <span className="text-white/60">{(currentItem as any).tradeable !== false ? 'Yes' : 'No'}</span>
          </div>
        </div>
        <div className="text-[9px] text-white/20 pt-2 border-t border-white/5 font-mono">{currentItem.id}</div>
      </div>
    )
  }, [currentItem, setInspectorContent, setInspectorTitle])

  // Add a new frame to the selected item
  const addFrame = useCallback(async () => {
    setAdding(true)
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'items', item: selected }),
      })
      const data = await res.json()
      if (data.success) {
        await loadLiveData()
        setFrameIndex(data.frameCount - 1)
      }
    } catch {}
    setAdding(false)
  }, [selected, loadLiveData])

  const duplicateFrame = useCallback(async (currentPixels: number[]) => {
    setAdding(true)
    try {
      const insertAt = safeFrameIndex + 1
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'items', item: selected, insertAt }),
      })
      const data = await res.json()
      if (data.success) {
        await fetch('/shimmer/save-sprite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ species: 'items', anim: selected, frameIndex: insertAt, digits: pixelsToDigits(currentPixels) }),
        })
        await loadLiveData()
        setFrameIndex(insertAt)
      }
    } catch {}
    setAdding(false)
  }, [safeFrameIndex, selected, loadLiveData])

  const handleBatchOp = useCallback(async (op: 'flipH' | 'flipV' | 'shiftUp' | 'shiftDown' | 'shiftLeft' | 'shiftRight') => {
    if (!currentAnim) return
    for (let i = 0; i < currentAnim.frames.length; i++) {
      let px = Array.from(currentAnim.frames[i])
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
        body: JSON.stringify({ species: 'items', anim: selected, frameIndex: i, digits: pixelsToDigits(px) }),
      })
    }
    await loadLiveData()
  }, [currentAnim, selected, loadLiveData])

  const deleteFrame = useCallback(async (frameIdx: number) => {
    setDeleting(frameIdx)
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: 'items', item: selected, frameIndex: frameIdx }),
      })
      const data = await res.json()
      if (data.success) {
        await loadLiveData()
        setFrameIndex(Math.max(0, frameIdx - 1))
      }
    } catch {}
    setDeleting(null)
  }, [selected, loadLiveData])

  // Render item grid preview
  useEffect(() => {
    const ctx = gridRef.current?.getContext('2d')
    if (!ctx) return
    const cols = 3
    const rows = Math.ceil(ITEMS.length / cols)
    const cell = 22
    const pad = 3
    const w = cols * cell + pad * 2
    const h = rows * cell + pad * 2
    ctx.canvas.width = w
    ctx.canvas.height = h
    ctx.imageSmoothingEnabled = false

    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(212, 168, 67, 0.3)'
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)

    ITEMS.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = pad + col * cell
      const y = pad + row * cell

      if (item.id === selected) {
        ctx.fillStyle = 'rgba(212, 168, 67, 0.15)'
        ctx.fillRect(x, y, cell, cell)
      }

      const anim = sprites[item.id]
      const itemPal = (livePalettes?.[item.id] ?? ITEM_PALETTES[item.id] ?? [...ITEM_PALETTE]) as readonly string[]
      if (anim) {
        const frame = anim.frames[0]
        const ss = Math.round(Math.sqrt(frame.length)) || 16
        if (ss > 16) {
          // Draw to offscreen canvas at native size, then scale down to fit cell
          const off = document.createElement('canvas')
          off.width = ss
          off.height = ss
          const octx = off.getContext('2d')!
          drawSprite(octx, frame, itemPal, 0, 0, mode)
          ctx.drawImage(off, x + 3, y + 3, 16, 16)
        } else {
          drawSprite(ctx, frame, itemPal, x + 3, y + 3, mode)
        }
      }
    })
  }, [sprites, selected, livePalettes, mode])

  return (
    <EditorShell
      title="Item Dev"
      subtitle="Game items — 32x32 icon sprites"
      loadStatus={loadStatus}
      shortcuts={PIXEL_EDITOR_SHORTCUTS}
      onDeploy={onDeploy}
      deployState={deployState}
    >

      {/* Item selector — category tabs + filtered list */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-44 px-2.5 py-1.5 text-xs bg-black/40 border border-white/10 rounded text-white outline-none focus:border-gold/40 placeholder:text-text-faint/50"
          />
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-2.5 py-1 rounded text-[10px] font-display border transition-all ${
                activeCategory === null
                  ? 'bg-white/10 text-white/80 border-white/20'
                  : 'bg-white/[0.03] text-white/40 border-transparent hover:bg-white/5'
              }`}
            >All ({ITEMS.length})</button>
            {CATEGORY_ORDER.map(cat => {
              const count = ITEMS.filter(i => i.type === cat).length
              if (count === 0) return null
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className="px-2.5 py-1 rounded text-[10px] font-display border transition-all"
                  style={{
                    background: activeCategory === cat ? `${CATEGORY_COLORS[cat]}15` : 'rgba(255,255,255,0.02)',
                    borderColor: activeCategory === cat ? `${CATEGORY_COLORS[cat]}40` : 'transparent',
                    color: activeCategory === cat ? CATEGORY_COLORS[cat] : 'rgba(255,255,255,0.4)',
                  }}
                >{TYPE_LABELS[cat]} ({count})</button>
              )
            })}
          </div>
          <div className="w-px h-6 bg-white/10" />
          <ViewModeToggle mode={mode} onChange={setMode} />
        </div>
        <div className="flex gap-1 flex-wrap max-h-24 overflow-y-auto">
          {ITEMS
            .filter(i => !activeCategory || i.type === activeCategory)
            .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase()) || (i.species && i.species.toLowerCase().includes(search.toLowerCase())))
            .map(item => (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-display border transition-all ${
                  selected === item.id
                    ? 'bg-gold/20 text-gold border-gold/30'
                    : 'bg-white/[0.03] text-text-dim border-white/5 hover:bg-white/5'
                }`}
              >
                {item.species ? `${item.name} (${item.species.charAt(0).toUpperCase() + item.species.slice(1).replace('-', ' ')})` : item.name}
              </button>
            ))}
        </div>
        {currentItem && (
          <div className="text-[11px] text-text-faint">
            <span style={{ color: CATEGORY_COLORS[currentItem.type] }}>{TYPE_LABELS[currentItem.type]}</span>
            {' · '}
            <span className={RARITY_COLORS[currentItem.rarity]}>{currentItem.rarity}</span>
            {' · '}
            <span className="text-white/20 font-mono">{currentItem.id}</span>
          </div>
        )}
      </div>

      {/* Frame controls */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] text-text-faint uppercase tracking-wider">Frames</span>
        <span className="text-[11px] text-text-dim font-mono">
          {safeFrameIndex + 1} / {totalFrames}
        </span>
        <button
          onClick={addFrame}
          disabled={adding}
          className="px-2.5 py-1 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50"
        >
          {adding ? 'Adding...' : '+ Add Frame'}
        </button>
        {totalFrames > 1 && (
          <button
            onClick={() => deleteFrame(safeFrameIndex)}
            disabled={deleting !== null}
            className="px-2.5 py-1 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
          >
            {deleting !== null ? 'Deleting...' : `Delete F${safeFrameIndex}`}
          </button>
        )}
        {totalFrames > 1 && (
          <span className="text-[9px] text-text-faint">
            8 ticks/frame (~0.5s) &middot; [ ] to navigate &middot; O for onion skin
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
              species="items"
              animName={selected}
              frameIndex={safeFrameIndex}
              totalFrames={totalFrames}
              onFrameChange={setFrameIndex}
              onSaved={() => loadLiveData()}
              allSprites={sprites}
              paletteKey={selected}
              frameConstMap={liveFrameMap}
              onDuplicateFrame={duplicateFrame}
              onBatchOperation={handleBatchOp}
            />
          )}
        </div>

        {/* Info + Preview Panel */}
        <div className="flex flex-col gap-5 w-56">
          {/* Item catalog grid */}
          <div>
            <span className="text-[9px] text-text-faint block mb-2">Catalog (4x)</span>
            <canvas
              ref={gridRef}
              className="border border-white/10 rounded"
              style={{ imageRendering: 'pixelated', transform: 'scale(4)', transformOrigin: 'top left' }}
            />
          </div>

          {/* Spacer for scaled canvas */}
          <div style={{ marginTop: ITEMS.length > 3 ? 140 : 60 }} />

          {/* Item details card */}
          {currentItem && (
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
                  <span className="text-sm font-display text-white">{currentItem.name}</span>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-text-faint">{TYPE_LABELS[currentItem.type]}</span>
                    <span className={`text-[10px] capitalize ${RARITY_COLORS[currentItem.rarity]}`}>
                      {currentItem.rarity}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-text-dim leading-relaxed">{currentItem.description}</p>
              <div className="flex gap-4 text-[10px]">
                {currentItem.effect && (
                  <div>
                    <span className="text-text-faint block">Effect</span>
                    <span className="text-green-400">
                      +{currentItem.effect.amount} {currentItem.effect.stat}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-text-faint block">Stack</span>
                  <span className="text-text-dim">
                    {currentItem.stackable ? `x${currentItem.maxStack}` : 'No'}
                  </span>
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
              {palette.map((color, i) => (
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
