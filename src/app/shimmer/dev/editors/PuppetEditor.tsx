'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { FOX_SPRITES } from '../../sprites/fox'
import { AXOLOTL_SPRITES } from '../../sprites/axolotl'
import { WATER_BEAR_SPRITES } from '../../sprites/water-bear'
import { TURTLE_SPRITES } from '../../sprites/turtle'
import { OWL_SPRITES } from '../../sprites/owl'
import { FROG_SPRITES } from '../../sprites/frog'
import { FIREFLY_SPRITES } from '../../sprites/firefly'
import { RABBIT_SPRITES } from '../../sprites/rabbit'
import { HUMMINGBIRD_SPRITES } from '../../sprites/hummingbird'
import { BAT_SPRITES } from '../../sprites/bat'
import { PALETTES } from '../../sprites/palette'
import { PLAYER_SPRITES, PLAYER_PALETTE } from '../../sprites/player'
import { SpriteAnim } from '../../sprites/sprite-data'
import EditorShell from '../templates/EditorShell'
import { saveState, loadState } from '../hooks/useShimmerDB'
import {
  type PuppetDef, type PuppetPart, type PuppetAnimation, type PuppetKeyframe, type PartTransform,
  createBipedTemplate, renderPuppetToCanvas, interpolateTransforms, extractPartPixels,
} from '../../engine/puppet'
import { drawSprite } from '../../components/SpriteRenderers'

// --- Sprite Sources ---

interface SpriteSource {
  id: string
  label: string
  anims: Record<string, SpriteAnim>
  palette: readonly string[]
}

const SPIRIT_SOURCES: SpriteSource[] = [
  { id: 'fox', label: 'Fox', anims: FOX_SPRITES, palette: PALETTES.fox.base },
  { id: 'axolotl', label: 'Axolotl', anims: AXOLOTL_SPRITES, palette: PALETTES.axolotl.base },
  { id: 'water-bear', label: 'Water Bear', anims: WATER_BEAR_SPRITES, palette: PALETTES['water-bear'].base },
  { id: 'turtle', label: 'Turtle', anims: TURTLE_SPRITES, palette: PALETTES.turtle.base },
  { id: 'owl', label: 'Owl', anims: OWL_SPRITES, palette: PALETTES.owl.base },
  { id: 'frog', label: 'Frog', anims: FROG_SPRITES, palette: PALETTES.frog.base },
  { id: 'firefly', label: 'Firefly', anims: FIREFLY_SPRITES, palette: PALETTES.firefly.base },
  { id: 'rabbit', label: 'Rabbit', anims: RABBIT_SPRITES, palette: PALETTES.rabbit.base },
  { id: 'hummingbird', label: 'Hummingbird', anims: HUMMINGBIRD_SPRITES, palette: PALETTES.hummingbird.base },
  { id: 'bat', label: 'Bat', anims: BAT_SPRITES, palette: PALETTES.bat.base },
]

const PLAYER_SOURCE: SpriteSource = {
  id: 'player', label: 'Player',
  anims: PLAYER_SPRITES,
  palette: PLAYER_PALETTE,
}

// Part colors for visual distinction
const PART_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce', '#82e0aa', '#f0b27a', '#85929e']

// --- Component ---

export default function PuppetEditor() {
  // Source selection
  const [sourceId, setSourceId] = useState('fox')
  const [animKey, setAnimKey] = useState('battle_front')

  // Puppet definition
  const [puppet, setPuppet] = useState<PuppetDef | null>(null)

  // Interaction state
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState<'select' | 'draw' | 'anchor'>('select')
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)

  // Animation state
  const [selectedAnimIdx, setSelectedAnimIdx] = useState(0)
  const [currentTick, setCurrentTick] = useState(0)
  const [playing, setPlaying] = useState(false)
  const playRef = useRef(false)

  // Canvas refs
  const slicerRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)

  // Resolve source
  const source = useMemo(() => {
    if (sourceId === 'player') return PLAYER_SOURCE
    return SPIRIT_SOURCES.find(s => s.id === sourceId) ?? SPIRIT_SOURCES[0]
  }, [sourceId])

  const anim = source.anims[animKey]
  const sourcePixels = anim?.frames[0]
  const spriteSize = sourcePixels ? Math.round(Math.sqrt(sourcePixels.length)) : 32

  // Available anims for current source
  const animKeys = useMemo(() => Object.keys(source.anims), [source])

  // Current puppet animation
  const puppetAnim = puppet?.animations[selectedAnimIdx] ?? null

  // --- Persistence ---

  const dbKey = `puppet-${sourceId}-${animKey}`

  useEffect(() => {
    loadState('editor-state', dbKey).then(saved => {
      if (saved?.data) {
        setPuppet(saved.data)
        setSelectedPartId(null)
        setSelectedAnimIdx(0)
        setCurrentTick(0)
      } else {
        setPuppet(createBipedTemplate(spriteSize))
      }
    })
  }, [dbKey, spriteSize])

  const savePuppet = useCallback((p: PuppetDef) => {
    setPuppet(p)
    saveState('editor-state', dbKey, p)
  }, [dbKey])

  // --- Slicer Canvas ---

  const SLICER_SCALE = spriteSize <= 32 ? 10 : spriteSize <= 64 ? 6 : 4
  const canvasSize = spriteSize * SLICER_SCALE

  const redrawSlicer = useCallback(() => {
    const canvas = slicerRef.current
    if (!canvas || !sourcePixels || !puppet) return
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Clear
    ctx.fillStyle = '#111122'
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    // Draw sprite scaled up
    for (let y = 0; y < spriteSize; y++) {
      for (let x = 0; x < spriteSize; x++) {
        const idx = sourcePixels[y * spriteSize + x]
        if (idx === 0) continue
        ctx.fillStyle = source.palette[idx - 1] ?? '#ff00ff'
        ctx.fillRect(x * SLICER_SCALE, y * SLICER_SCALE, SLICER_SCALE, SLICER_SCALE)
      }
    }

    // Draw part regions
    puppet.parts.forEach((part, i) => {
      const color = PART_COLORS[i % PART_COLORS.length]
      const isSelected = part.id === selectedPartId

      // Region outline
      ctx.strokeStyle = color
      ctx.lineWidth = isSelected ? 3 : 1
      ctx.globalAlpha = isSelected ? 1 : 0.6
      ctx.strokeRect(
        part.x * SLICER_SCALE, part.y * SLICER_SCALE,
        part.w * SLICER_SCALE, part.h * SLICER_SCALE,
      )

      // Fill overlay
      ctx.fillStyle = color
      ctx.globalAlpha = isSelected ? 0.15 : 0.05
      ctx.fillRect(
        part.x * SLICER_SCALE, part.y * SLICER_SCALE,
        part.w * SLICER_SCALE, part.h * SLICER_SCALE,
      )
      ctx.globalAlpha = 1

      // Anchor point
      const ax = (part.x + part.anchorX) * SLICER_SCALE
      const ay = (part.y + part.anchorY) * SLICER_SCALE
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ax, ay, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      ctx.fillStyle = color
      ctx.font = '11px monospace'
      ctx.globalAlpha = 0.9
      ctx.fillText(part.id, part.x * SLICER_SCALE + 3, part.y * SLICER_SCALE - 4)
      ctx.globalAlpha = 1
    })

    // Draw rectangle in progress
    if (dragStart && dragCurrent && drawMode === 'draw') {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      const x = Math.min(dragStart.x, dragCurrent.x) * SLICER_SCALE
      const y = Math.min(dragStart.y, dragCurrent.y) * SLICER_SCALE
      const w = Math.abs(dragCurrent.x - dragStart.x) * SLICER_SCALE
      const h = Math.abs(dragCurrent.y - dragStart.y) * SLICER_SCALE
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
    }
  }, [sourcePixels, puppet, selectedPartId, dragStart, dragCurrent, drawMode, spriteSize, SLICER_SCALE, canvasSize, source.palette])

  useEffect(() => { redrawSlicer() }, [redrawSlicer])

  // --- Slicer Mouse Handlers ---

  const canvasToSprite = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const displayScale = canvasSize / rect.width
    return {
      x: Math.floor((e.clientX - rect.left) * displayScale / SLICER_SCALE),
      y: Math.floor((e.clientY - rect.top) * displayScale / SLICER_SCALE),
    }
  }, [canvasSize, SLICER_SCALE])

  const handleSlicerDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = canvasToSprite(e)
    if (drawMode === 'draw') {
      setDragStart(pos)
      setDragCurrent(pos)
    } else if (drawMode === 'anchor' && selectedPartId && puppet) {
      // Set anchor within selected part
      const part = puppet.parts.find(p => p.id === selectedPartId)
      if (part && pos.x >= part.x && pos.x < part.x + part.w && pos.y >= part.y && pos.y < part.y + part.h) {
        const updated = { ...puppet, parts: puppet.parts.map(p =>
          p.id === selectedPartId ? { ...p, anchorX: pos.x - part.x, anchorY: pos.y - part.y } : p
        )}
        savePuppet(updated)
      }
    } else {
      // Select mode — find clicked part
      if (!puppet) return
      const clicked = puppet.parts.find(p =>
        pos.x >= p.x && pos.x < p.x + p.w && pos.y >= p.y && pos.y < p.y + p.h
      )
      setSelectedPartId(clicked?.id ?? null)
    }
  }, [drawMode, canvasToSprite, puppet, selectedPartId, savePuppet])

  const handleSlicerMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawMode === 'draw' && dragStart) {
      setDragCurrent(canvasToSprite(e))
    }
  }, [drawMode, dragStart, canvasToSprite])

  const handleSlicerUp = useCallback(() => {
    if (drawMode === 'draw' && dragStart && dragCurrent && puppet) {
      const x = Math.min(dragStart.x, dragCurrent.x)
      const y = Math.min(dragStart.y, dragCurrent.y)
      const w = Math.abs(dragCurrent.x - dragStart.x)
      const h = Math.abs(dragCurrent.y - dragStart.y)
      if (w >= 2 && h >= 2) {
        const id = `part_${puppet.parts.length}`
        const newPart: PuppetPart = {
          id, x, y, w, h,
          anchorX: Math.floor(w / 2),
          anchorY: Math.floor(h / 2),
          parentId: puppet.parts.length > 0 ? puppet.parts[0].id : null,
          attachX: 0, attachY: 0,
          zOrder: puppet.parts.length,
        }
        savePuppet({ ...puppet, parts: [...puppet.parts, newPart] })
        setSelectedPartId(id)
        setDrawMode('select')
      }
    }
    setDragStart(null)
    setDragCurrent(null)
  }, [drawMode, dragStart, dragCurrent, puppet, savePuppet])

  // --- Part Inspector ---

  const selectedPart = puppet?.parts.find(p => p.id === selectedPartId) ?? null

  const updatePart = useCallback((partId: string, changes: Partial<PuppetPart>) => {
    if (!puppet) return
    savePuppet({
      ...puppet,
      parts: puppet.parts.map(p => p.id === partId ? { ...p, ...changes } : p),
    })
  }, [puppet, savePuppet])

  const deletePart = useCallback((partId: string) => {
    if (!puppet) return
    savePuppet({
      ...puppet,
      parts: puppet.parts
        .filter(p => p.id !== partId)
        .map(p => p.parentId === partId ? { ...p, parentId: null } : p),
      animations: puppet.animations.map(a => ({
        ...a,
        keyframes: a.keyframes.map(kf => {
          const { [partId]: _, ...rest } = kf.parts
          return { ...kf, parts: rest }
        }),
      })),
    })
    if (selectedPartId === partId) setSelectedPartId(null)
  }, [puppet, selectedPartId, savePuppet])

  // --- Animation Controls ---

  const addAnimation = useCallback(() => {
    if (!puppet) return
    const name = `anim_${puppet.animations.length}`
    const newAnim: PuppetAnimation = {
      name, duration: 60, loop: true,
      keyframes: [{
        tick: 0,
        easing: 'ease-in-out',
        parts: Object.fromEntries(puppet.parts.map(p => [p.id, {}])),
      }],
    }
    savePuppet({ ...puppet, animations: [...puppet.animations, newAnim] })
    setSelectedAnimIdx(puppet.animations.length)
  }, [puppet, savePuppet])

  const updateAnimation = useCallback((idx: number, changes: Partial<PuppetAnimation>) => {
    if (!puppet) return
    savePuppet({
      ...puppet,
      animations: puppet.animations.map((a, i) => i === idx ? { ...a, ...changes } : a),
    })
  }, [puppet, savePuppet])

  const deleteAnimation = useCallback((idx: number) => {
    if (!puppet || puppet.animations.length <= 1) return
    savePuppet({
      ...puppet,
      animations: puppet.animations.filter((_, i) => i !== idx),
    })
    setSelectedAnimIdx(Math.max(0, idx - 1))
  }, [puppet, savePuppet])

  // --- Keyframe Controls ---

  const addKeyframe = useCallback(() => {
    if (!puppet || !puppetAnim) return
    // Don't add if one already exists at this tick
    if (puppetAnim.keyframes.some(kf => kf.tick === currentTick)) return
    const newKf: PuppetKeyframe = {
      tick: currentTick,
      easing: 'ease-in-out',
      parts: Object.fromEntries(puppet.parts.map(p => [p.id, {}])),
    }
    const kfs = [...puppetAnim.keyframes, newKf].sort((a, b) => a.tick - b.tick)
    updateAnimation(selectedAnimIdx, { keyframes: kfs })
  }, [puppet, puppetAnim, currentTick, selectedAnimIdx, updateAnimation])

  const deleteKeyframe = useCallback((tick: number) => {
    if (!puppetAnim || puppetAnim.keyframes.length <= 1) return
    updateAnimation(selectedAnimIdx, {
      keyframes: puppetAnim.keyframes.filter(kf => kf.tick !== tick),
    })
  }, [puppetAnim, selectedAnimIdx, updateAnimation])

  // Current keyframe (exact match or null)
  const currentKeyframe = puppetAnim?.keyframes.find(kf => kf.tick === currentTick) ?? null

  const updateKeyframeTransform = useCallback((partId: string, field: keyof PartTransform, value: number) => {
    if (!puppetAnim || !currentKeyframe) return
    const kfs = puppetAnim.keyframes.map(kf => {
      if (kf.tick !== currentTick) return kf
      return {
        ...kf,
        parts: { ...kf.parts, [partId]: { ...kf.parts[partId], [field]: value } },
      }
    })
    updateAnimation(selectedAnimIdx, { keyframes: kfs })
  }, [puppetAnim, currentKeyframe, currentTick, selectedAnimIdx, updateAnimation])

  // --- Preview Animation Loop ---

  useEffect(() => {
    playRef.current = playing
  }, [playing])

  useEffect(() => {
    if (!playing || !puppetAnim) return
    const interval = setInterval(() => {
      if (!playRef.current) return
      setCurrentTick(t => {
        const next = t + 1
        if (puppetAnim.loop) return next % puppetAnim.duration
        return Math.min(next, puppetAnim.duration)
      })
    }, 1000 / 15) // 15 TPS
    return () => clearInterval(interval)
  }, [playing, puppetAnim])

  // --- Preview Canvas ---

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !puppet || !puppetAnim || !sourcePixels) return

    const size = puppet.sourceSize
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, size, size)

    const puppetCanvas = renderPuppetToCanvas(sourcePixels, source.palette, puppet, puppetAnim, currentTick)
    ctx.drawImage(puppetCanvas, 0, 0)
  }, [puppet, puppetAnim, sourcePixels, currentTick, source.palette])

  // --- Reset puppet to template ---

  const resetToTemplate = useCallback(() => {
    const fresh = createBipedTemplate(spriteSize)
    savePuppet(fresh)
    setSelectedPartId(null)
    setSelectedAnimIdx(0)
    setCurrentTick(0)
  }, [spriteSize, savePuppet])

  // --- Render ---

  if (!puppet || !sourcePixels) {
    return (
      <EditorShell title="Puppet" subtitle="body part animation">
        <p className="text-text-faint text-sm">No sprite data for {sourceId}/{animKey}</p>
      </EditorShell>
    )
  }

  const previewScale = spriteSize <= 32 ? 8 : spriteSize <= 64 ? 5 : 3

  return (
    <EditorShell title="Puppet" subtitle="body part animation system">
      {/* Source selection */}
      <div className="flex items-center gap-3 mb-5">
        <select
          value={sourceId}
          onChange={e => { setSourceId(e.target.value); setSelectedPartId(null) }}
          className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm"
        >
          <option value="player">Player</option>
          {SPIRIT_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select
          value={animKey}
          onChange={e => { setAnimKey(e.target.value); setSelectedPartId(null) }}
          className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm"
        >
          {animKeys.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <span className="text-text-faint text-xs">{spriteSize}x{spriteSize}</span>

        <div className="flex gap-1 ml-4">
          {(['select', 'draw', 'anchor'] as const).map(m => (
            <button
              key={m}
              onClick={() => setDrawMode(m)}
              className={`px-3 py-1 rounded text-xs transition-all ${
                drawMode === m
                  ? 'bg-violet-500/30 text-violet-200 border border-violet-500/50'
                  : 'bg-white/5 text-text-faint border border-white/10 hover:bg-white/10'
              }`}
            >
              {m === 'select' ? 'Select' : m === 'draw' ? 'Draw Part' : 'Set Anchor'}
            </button>
          ))}
        </div>

        <button
          onClick={resetToTemplate}
          className="ml-auto px-3 py-1 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
        >
          Reset
        </button>
      </div>

      {/* Main layout: slicer | inspector | preview */}
      <div className="flex gap-6">
        {/* Slicer canvas */}
        <div className="shrink-0">
          <canvas
            ref={slicerRef}
            width={canvasSize}
            height={canvasSize}
            onMouseDown={handleSlicerDown}
            onMouseMove={handleSlicerMove}
            onMouseUp={handleSlicerUp}
            onMouseLeave={handleSlicerUp}
            className="border border-white/10 rounded-lg cursor-crosshair"
            style={{ imageRendering: 'pixelated', width: canvasSize, height: canvasSize }}
          />
          <p className="text-text-faint text-[10px] mt-2">
            {drawMode === 'draw' ? 'Click + drag to define a part region' :
             drawMode === 'anchor' ? 'Click within selected part to set pivot' :
             'Click a part to select it'}
          </p>
        </div>

        {/* Part inspector */}
        <div className="flex-1 min-w-[240px] max-w-[320px]">
          <h3 className="text-xs font-display text-gold mb-3">Parts ({puppet.parts.length})</h3>

          {/* Part list */}
          <div className="space-y-1 mb-4 max-h-[200px] overflow-y-auto">
            {puppet.parts.map((part, i) => (
              <div
                key={part.id}
                onClick={() => setSelectedPartId(part.id)}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-all ${
                  part.id === selectedPartId
                    ? 'bg-white/10 text-white'
                    : 'text-text-faint hover:bg-white/5'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: PART_COLORS[i % PART_COLORS.length] }}
                />
                <span className="flex-1 truncate">{part.id}</span>
                <span className="text-[9px] opacity-50">{part.w}x{part.h}</span>
                <button
                  onClick={e => { e.stopPropagation(); deletePart(part.id) }}
                  className="text-red-400/50 hover:text-red-400 text-[10px]"
                >x</button>
              </div>
            ))}
          </div>

          {/* Selected part details */}
          {selectedPart && (
            <div className="space-y-3 border-t border-white/10 pt-3">
              <div>
                <label className="text-[10px] text-text-faint block mb-1">ID</label>
                <input
                  value={selectedPart.id}
                  onChange={e => {
                    const newId = e.target.value.replace(/[^a-z0-9_]/g, '')
                    if (!newId || puppet.parts.some(p => p.id === newId && p.id !== selectedPart.id)) return
                    // Rename in parts + animations + parent refs
                    const oldId = selectedPart.id
                    savePuppet({
                      ...puppet,
                      parts: puppet.parts.map(p => {
                        let updated = p.id === oldId ? { ...p, id: newId } : p
                        if (updated.parentId === oldId) updated = { ...updated, parentId: newId }
                        return updated
                      }),
                      animations: puppet.animations.map(a => ({
                        ...a,
                        keyframes: a.keyframes.map(kf => {
                          const parts: Record<string, PartTransform> = {}
                          for (const [k, v] of Object.entries(kf.parts)) {
                            parts[k === oldId ? newId : k] = v
                          }
                          return { ...kf, parts }
                        }),
                      })),
                    })
                    setSelectedPartId(newId)
                  }}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-text-faint block mb-1">Parent</label>
                  <select
                    value={selectedPart.parentId ?? ''}
                    onChange={e => updatePart(selectedPart.id, { parentId: e.target.value || null })}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs w-full"
                  >
                    <option value="">(root)</option>
                    {puppet.parts.filter(p => p.id !== selectedPart.id).map(p =>
                      <option key={p.id} value={p.id}>{p.id}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-text-faint block mb-1">Z-Order</label>
                  <input
                    type="number"
                    value={selectedPart.zOrder}
                    onChange={e => updatePart(selectedPart.id, { zOrder: parseInt(e.target.value) || 0 })}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-text-faint block mb-1">Attach X</label>
                  <input
                    type="number"
                    value={selectedPart.attachX}
                    onChange={e => updatePart(selectedPart.id, { attachX: parseInt(e.target.value) || 0 })}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-faint block mb-1">Attach Y</label>
                  <input
                    type="number"
                    value={selectedPart.attachY}
                    onChange={e => updatePart(selectedPart.id, { attachY: parseInt(e.target.value) || 0 })}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs w-full"
                  />
                </div>
              </div>

              <p className="text-[9px] text-text-faint">
                Region: {selectedPart.x},{selectedPart.y} {selectedPart.w}x{selectedPart.h} |
                Anchor: {selectedPart.anchorX},{selectedPart.anchorY}
              </p>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="shrink-0">
          <h3 className="text-xs font-display text-gold mb-3">Preview</h3>
          <canvas
            ref={previewRef}
            className="border border-white/10 rounded-lg bg-[#1a1a2e]"
            style={{
              imageRendering: 'pixelated',
              width: spriteSize * previewScale,
              height: spriteSize * previewScale,
            }}
          />

          {/* Static reference */}
          <div className="mt-3">
            <p className="text-[10px] text-text-faint mb-1">Original</p>
            <canvas
              ref={el => {
                if (!el || !sourcePixels) return
                el.width = spriteSize
                el.height = spriteSize
                const ctx = el.getContext('2d')!
                ctx.imageSmoothingEnabled = false
                ctx.clearRect(0, 0, spriteSize, spriteSize)
                drawSprite(ctx, sourcePixels, source.palette, 0, 0)
              }}
              className="border border-white/10 rounded bg-[#1a1a2e]"
              style={{
                imageRendering: 'pixelated',
                width: spriteSize * (previewScale / 2),
                height: spriteSize * (previewScale / 2),
              }}
            />
          </div>
        </div>
      </div>

      {/* Animation Timeline */}
      <div className="mt-6 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-xs font-display text-gold">Animation</h3>

          {/* Anim selector */}
          <select
            value={selectedAnimIdx}
            onChange={e => { setSelectedAnimIdx(parseInt(e.target.value)); setCurrentTick(0); setPlaying(false) }}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
          >
            {puppet.animations.map((a, i) => (
              <option key={i} value={i}>{a.name}</option>
            ))}
          </select>

          <button onClick={addAnimation} className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 hover:bg-white/10">+ New</button>

          {puppet.animations.length > 1 && (
            <button
              onClick={() => deleteAnimation(selectedAnimIdx)}
              className="px-2 py-1 rounded text-xs text-red-400/70 hover:text-red-400"
            >Delete</button>
          )}

          {puppetAnim && (
            <>
              <input
                value={puppetAnim.name}
                onChange={e => updateAnimation(selectedAnimIdx, { name: e.target.value })}
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs w-24"
                placeholder="name"
              />
              <div className="flex items-center gap-1">
                <label className="text-[10px] text-text-faint">Duration</label>
                <input
                  type="number"
                  value={puppetAnim.duration}
                  onChange={e => updateAnimation(selectedAnimIdx, { duration: Math.max(1, parseInt(e.target.value) || 60) })}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs w-16"
                />
              </div>
              <label className="flex items-center gap-1 text-[10px] text-text-faint">
                <input
                  type="checkbox"
                  checked={puppetAnim.loop}
                  onChange={e => updateAnimation(selectedAnimIdx, { loop: e.target.checked })}
                  className="w-3 h-3"
                />
                Loop
              </label>
            </>
          )}

          {/* Playback controls */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => { setCurrentTick(0); setPlaying(false) }}
              className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 hover:bg-white/10"
            >|&lt;</button>
            <button
              onClick={() => setPlaying(p => !p)}
              className={`px-3 py-1 rounded text-xs border transition-all ${
                playing
                  ? 'bg-green-500/20 text-green-300 border-green-500/40'
                  : 'bg-white/5 text-text-faint border-white/10 hover:bg-white/10'
              }`}
            >{playing ? 'Pause' : 'Play'}</button>
          </div>
        </div>

        {/* Timeline scrubber */}
        {puppetAnim && (
          <div className="relative">
            {/* Track */}
            <div className="h-10 bg-white/5 rounded border border-white/10 relative overflow-hidden">
              {/* Tick markers */}
              {Array.from({ length: Math.min(puppetAnim.duration, 120) }, (_, i) => (
                <div
                  key={i}
                  className={`absolute top-0 w-px h-full ${i % 15 === 0 ? 'bg-white/20' : i % 5 === 0 ? 'bg-white/10' : 'bg-white/5'}`}
                  style={{ left: `${(i / puppetAnim.duration) * 100}%` }}
                />
              ))}

              {/* Keyframe diamonds */}
              {puppetAnim.keyframes.map((kf, i) => (
                <div
                  key={i}
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 cursor-pointer transition-all ${
                    kf.tick === currentTick
                      ? 'bg-gold border border-gold/50'
                      : 'bg-violet-400 border border-violet-300/50 hover:bg-violet-300'
                  }`}
                  style={{ left: `calc(${(kf.tick / puppetAnim.duration) * 100}% - 6px)` }}
                  onClick={() => { setCurrentTick(kf.tick); setPlaying(false) }}
                />
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 w-0.5 h-full bg-gold z-10"
                style={{ left: `${(currentTick / puppetAnim.duration) * 100}%` }}
              />

              {/* Click to scrub */}
              <div
                className="absolute inset-0 z-20"
                onMouseDown={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = (e.clientX - rect.left) / rect.width
                  setCurrentTick(Math.round(pct * puppetAnim.duration))
                  setPlaying(false)
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-text-faint">Tick {currentTick} / {puppetAnim.duration} ({(currentTick / 15).toFixed(1)}s)</span>
              <div className="flex gap-2">
                <button onClick={addKeyframe} className="px-2 py-0.5 rounded text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30">
                  + Keyframe
                </button>
                {currentKeyframe && puppetAnim.keyframes.length > 1 && (
                  <button
                    onClick={() => deleteKeyframe(currentTick)}
                    className="px-2 py-0.5 rounded text-[10px] text-red-400/70 hover:text-red-400"
                  >- Keyframe</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transform controls (when on a keyframe) */}
        {currentKeyframe && selectedPart && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <h4 className="text-[10px] font-display text-gold mb-2">
              Transforms for <span className="text-violet-300">{selectedPart.id}</span> at tick {currentTick}
            </h4>
            <div className="grid grid-cols-5 gap-3">
              {[
                { key: 'offsetX' as const, label: 'Offset X', min: -20, max: 20, step: 0.5, def: 0 },
                { key: 'offsetY' as const, label: 'Offset Y', min: -20, max: 20, step: 0.5, def: 0 },
                { key: 'rotation' as const, label: 'Rotation', min: -30, max: 30, step: 0.5, def: 0 },
                { key: 'scaleX' as const, label: 'Scale X', min: 0.5, max: 1.5, step: 0.01, def: 1 },
                { key: 'scaleY' as const, label: 'Scale Y', min: 0.5, max: 1.5, step: 0.01, def: 1 },
              ].map(({ key, label, min, max, step, def }) => {
                const val = currentKeyframe.parts[selectedPart.id]?.[key] ?? def
                return (
                  <div key={key}>
                    <label className="text-[10px] text-text-faint block mb-1">{label}</label>
                    <input
                      type="range"
                      min={min} max={max} step={step}
                      value={val}
                      onChange={e => updateKeyframeTransform(selectedPart.id, key, parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <span className="text-[9px] text-text-faint">{typeof val === 'number' ? val.toFixed(2) : val}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {currentKeyframe && !selectedPart && (
          <p className="mt-3 text-text-faint text-[10px]">Select a part to edit transforms at this keyframe</p>
        )}

        {!currentKeyframe && puppetAnim && (
          <p className="mt-3 text-text-faint text-[10px]">Scrub to a keyframe or add one at tick {currentTick}</p>
        )}
      </div>
    </EditorShell>
  )
}
