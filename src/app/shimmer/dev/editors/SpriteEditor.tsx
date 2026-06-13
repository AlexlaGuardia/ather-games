'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { SpriteAnim } from '../../sprites/sprite-data'
import { VARIANT_CONFIG, VARIANT_CLASSES, VARIANT_CLASS_DEFS, RARITY_COLORS, RARITIES, type Rarity, type VariantConfig, type VariantClass } from '../../sprites/variants'
import { ELEMENTS, ELEMENT_COLORS, type Species } from '../../spirits/spirit'
import { LAUNCHED_SPECIES } from '../../engine/spirit-index'
import { ViewMode, parseDigits, pixelsToDigits, flipH, flipV, shiftAllPixels } from '../../components/PixelUtils'
import { ScenePreview, AnimPlayer, FramePreview } from '../../components/SpriteRenderers'
import PixelEditor from '../../components/PixelEditor'
import EditorShell from '../templates/EditorShell'
import { PIXEL_EDITOR_SHORTCUTS } from '../templates/shortcut-data'
import ViewModeToggle from '../templates/ViewModeToggle'
import { useInspector } from '../templates/inspector-context'
import GrimoireSelector from './GrimoireSelector'
import SpiritConfig from './SpiritConfig'
import { getEntry } from '../../spirits/grimoire'

const SPIRITS: {
  id: string
  label: string
  sprites: Record<string, SpriteAnim>
  palettes: Record<string, readonly string[]>
}[] = [
  { id: 'fox', label: 'Fox', sprites: FOX_SPRITES, palettes: PALETTES.fox },
  { id: 'axolotl', label: 'Axolotl', sprites: AXOLOTL_SPRITES, palettes: PALETTES.axolotl },
  { id: 'water-bear', label: 'Water Bear', sprites: WATER_BEAR_SPRITES, palettes: PALETTES['water-bear'] },
  { id: 'turtle', label: 'Turtle', sprites: TURTLE_SPRITES, palettes: PALETTES.turtle },
  { id: 'owl', label: 'Owl', sprites: OWL_SPRITES, palettes: PALETTES.owl },
  { id: 'frog', label: 'Frog', sprites: FROG_SPRITES, palettes: PALETTES.frog },
  { id: 'firefly', label: 'Firefly', sprites: FIREFLY_SPRITES, palettes: PALETTES.firefly },
  { id: 'rabbit', label: 'Rabbit', sprites: RABBIT_SPRITES, palettes: PALETTES.rabbit },
  { id: 'hummingbird', label: 'Hummingbird', sprites: HUMMINGBIRD_SPRITES, palettes: PALETTES.hummingbird },
  { id: 'bat', label: 'Bat', sprites: BAT_SPRITES, palettes: PALETTES.bat },
]

const FRAME_CONST_MAP: Record<string, string[]> = {
  icon:         ['BATTLE_FRONT_0', 'BATTLE_FRONT_1'],
  battle_front: ['BF96_0', 'BF96_1'],
  battle_back:  ['BB96_0', 'BB96_1'],
}

const ANIM_GRID_SIZE: Record<string, number> = {
  icon: 32,
  battle_front: 96,
  battle_back: 96,
}

export default function SpriteEditor({ onDeploy, deployState }: {
  onDeploy: () => void
  deployState: 'idle' | 'building' | 'done' | 'error'
}) {
  const [selected, setSelected] = useState('fox')
  const [selectedAnim, setSelectedAnim] = useState('icon')
  const [paletteKey, setPaletteKey] = useState('base')
  const [mode, setMode] = useState<ViewMode>('normal')
  const [editingFrame, setEditingFrame] = useState(0)
  const [liveSprites, setLiveSprites] = useState<Record<string, Record<string, SpriteAnim>> | null>(null)
  const [livePalettes, setLivePalettes] = useState<Record<string, Record<string, string[]>> | null>(null)
  const [liveFrameMaps, setLiveFrameMaps] = useState<Record<string, Record<string, string[]>>>({})
  const [loadStatus, setLoadStatus] = useState<string>('')
  const [addingFrame, setAddingFrame] = useState(false)
  const [deletingFrame, setDeletingFrame] = useState<number | null>(null)
  const [animSpeed, setAnimSpeed] = useState(1)
  const [variantConfig, setVariantConfig] = useState<VariantConfig>(VARIANT_CONFIG)
  const [variantSaveStatus, setVariantSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Load variant config from source on mount
  useEffect(() => {
    fetch('/shimmer/save-sprite?species=variants')
      .then(r => r.json())
      .then(data => { if (data.config) setVariantConfig(data.config) })
      .catch(() => {})
  }, [])

  const saveVariantConfig = useCallback(async (species: string, variants: Record<string, { rarity: string; encounterRate: number }>) => {
    setVariantSaveStatus('saving')
    try {
      await fetch('/shimmer/save-sprite', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species, variants }),
      })
      setVariantSaveStatus('saved')
      setTimeout(() => setVariantSaveStatus('idle'), 1500)
    } catch {
      setVariantSaveStatus('idle')
    }
  }, [])

  const updateVariant = useCallback((species: string, variantKey: string, field: 'rarity' | 'encounterRate', value: string | number) => {
    setVariantConfig(prev => {
      const updated = { ...prev }
      updated[species] = { ...updated[species] }
      updated[species][variantKey] = { ...updated[species][variantKey], [field]: value }
      return updated
    })
  }, [])

  const savePaletteColor = useCallback(async (species: string, palKey: string, colorIdx: number, newColor: string) => {
    // Update local state immediately
    setLivePalettes(prev => {
      const updated = { ...prev }
      const spiritData = SPIRITS.find(s => s.id === species)
      const fallbackPal = spiritData?.palettes[palKey as keyof typeof PALETTES.fox] ?? ['#555555', '#888888', '#333333', '#111111', '#eeeeee', '#666666', '#444444', '#777777', '#999999', '#aaaaaa']
      const current = updated[species]?.[palKey] ?? [...fallbackPal]
      const colors = [...current]
      colors[colorIdx] = newColor
      updated[species] = { ...updated[species], [palKey]: colors }
      return updated
    })
    // Save to source
    const spirit = SPIRITS.find(s => s.id === species)
    const defaultPal = ['#555555', '#888888', '#333333', '#111111', '#eeeeee', '#666666', '#444444', '#777777', '#999999', '#aaaaaa'] as readonly string[]
    const currentPal = livePalettes?.[species]?.[palKey] ?? [...(spirit?.palettes[palKey as keyof typeof spirit.palettes] ?? spirit?.palettes.base ?? defaultPal)]
    const colors = [...currentPal]
    colors[colorIdx] = newColor
    await fetch('/shimmer/save-sprite', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species, paletteKey: palKey, colors }),
    })
  }, [livePalettes])

  const loadLiveData = useCallback(async (species: string) => {
    try {
      setLoadStatus('loading...')
      const res = await fetch(`/shimmer/save-sprite?species=${species}`)
      const data = await res.json()
      if (data.frames) {
        const serverFrameMap: Record<string, string[]> = data.frameMap ?? {}
        // Icon pulls from the server's battle_front const names (existing 32x32 art)
        const iconNames = serverFrameMap.battle_front ?? FRAME_CONST_MAP.icon
        const resolvedMap: Record<string, string[]> = {
          icon: iconNames,
          battle_front: FRAME_CONST_MAP.battle_front,
          battle_back: FRAME_CONST_MAP.battle_back,
        }
        // Merge for "Load from" buttons (server frames + our slots)
        setLiveFrameMaps(prev => ({ ...prev, [species]: { ...serverFrameMap, ...resolvedMap } }))

        const compiled = SPIRITS.find(s => s.id === species)?.sprites
        const overrides: Record<string, SpriteAnim> = {}
        for (const [animKey, constNames] of Object.entries(resolvedMap)) {
          const gs = ANIM_GRID_SIZE[animKey] ?? 32
          const totalPx = gs * gs
          const rate = compiled?.[animKey]?.rate ?? compiled?.battle_front?.rate ?? 8
          const frames: Uint8Array[] = constNames.map(
            name => data.frames[name] ? parseDigits(data.frames[name], totalPx) : new Uint8Array(totalPx)
          )
          overrides[animKey] = { frames, rate }
        }
        setLiveSprites(prev => ({ ...prev, [species]: overrides }))
        if (data.palettes) {
          setLivePalettes(prev => ({ ...prev, [species]: data.palettes }))
        }
        setLoadStatus('live')
      }
    } catch {
      setLoadStatus('failed')
    }
  }, [])


  const addFrame = useCallback(async (insertAt?: number) => {
    setAddingFrame(true)
    try {
      const body: Record<string, unknown> = { species: selected, anim: selectedAnim }
      if (insertAt !== undefined) body.insertAt = insertAt
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        await loadLiveData(selected)
        setEditingFrame(insertAt !== undefined ? insertAt : data.frameCount - 1)
      }
    } catch {}
    setAddingFrame(false)
  }, [selected, selectedAnim, loadLiveData])

  const duplicateFrame = useCallback(async (currentPixels: number[]) => {
    setAddingFrame(true)
    try {
      const insertAt = editingFrame + 1
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: selected, anim: selectedAnim, insertAt }),
      })
      const data = await res.json()
      if (data.success) {
        await fetch('/shimmer/save-sprite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ species: selected, anim: selectedAnim, frameIndex: insertAt, digits: pixelsToDigits(currentPixels, ANIM_GRID_SIZE[selectedAnim] ?? 32) }),
        })
        await loadLiveData(selected)
        setEditingFrame(insertAt)
      }
    } catch {}
    setAddingFrame(false)
  }, [editingFrame, selected, selectedAnim, loadLiveData])

  const handleBatchOp = useCallback(async (op: 'flipH' | 'flipV' | 'shiftUp' | 'shiftDown' | 'shiftLeft' | 'shiftRight') => {
    const sp = liveSprites?.[selected] ?? SPIRITS.find(s => s.id === selected)?.sprites ?? defaultSprites
    const a = sp[selectedAnim]
    if (!a) return
    const gs = ANIM_GRID_SIZE[selectedAnim] ?? 32
    for (let i = 0; i < a.frames.length; i++) {
      let px = Array.from(a.frames[i])
      switch (op) {
        case 'flipH': px = flipH(px, gs, gs); break
        case 'flipV': px = flipV(px, gs, gs); break
        case 'shiftUp': px = shiftAllPixels(px, 0, -1, gs); break
        case 'shiftDown': px = shiftAllPixels(px, 0, 1, gs); break
        case 'shiftLeft': px = shiftAllPixels(px, -1, 0, gs); break
        case 'shiftRight': px = shiftAllPixels(px, 1, 0, gs); break
      }
      await fetch('/shimmer/save-sprite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: selected, anim: selectedAnim, frameIndex: i, digits: pixelsToDigits(px, ANIM_GRID_SIZE[selectedAnim] ?? 32) }),
      })
    }
    await loadLiveData(selected)
  }, [liveSprites, selected, selectedAnim, loadLiveData])

  const deleteFrame = useCallback(async (frameIdx: number) => {
    setDeletingFrame(frameIdx)
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: selected, anim: selectedAnim, frameIndex: frameIdx }),
      })
      const data = await res.json()
      if (data.success) {
        await loadLiveData(selected)
        setEditingFrame(Math.max(0, frameIdx - 1))
      }
    } catch {}
    setDeletingFrame(null)
  }, [selected, selectedAnim, loadLiveData])

  // Resolve grimoire entry → base species for sprite data
  const grimoireEntry = getEntry(selected)
  const baseSpeciesId = grimoireEntry?.baseSpecies ?? selected
  const isBaseForm = !grimoireEntry || grimoireEntry.form === 'base'

  useEffect(() => {
    // For base forms, load from the species file
    // For evolution forms, try to load from their own file (may not exist yet)
    loadLiveData(isBaseForm ? selected : selected)
  }, [selected, isBaseForm, loadLiveData])

  const baseSpirit = SPIRITS.find(s => s.id === baseSpeciesId)
  const blankAnim: SpriteAnim = { frames: [new Uint8Array(32 * 32)], rate: 8 }
  const defaultSprites: Record<string, SpriteAnim> = { icon: blankAnim, battle_front: { frames: [new Uint8Array(96 * 96)], rate: 8 }, battle_back: { frames: [new Uint8Array(96 * 96)], rate: 8 } }
  const defaultPalettes = { base: ['#333333', '#666666', '#999999', '#cccccc', '#ffffff', '#444444', '#555555', '#777777', '#888888', '#aaaaaa'] as readonly string[] }

  const spirit = baseSpirit ?? { id: selected, label: grimoireEntry?.name ?? selected, sprites: defaultSprites, palettes: defaultPalettes }
  // For base forms use compiled sprites, for evolution forms use live data (or blank)
  const sprites = isBaseForm
    ? (liveSprites?.[selected] ?? spirit.sprites)
    : (liveSprites?.[selected] ?? defaultSprites)
  const anim = sprites[selectedAnim]
  const palette = livePalettes?.[selected]?.[paletteKey]
    ?? spirit.palettes[paletteKey as keyof typeof spirit.palettes]
    ?? spirit.palettes.base

  const { setInspectorContent, setInspectorTitle } = useInspector()

  // Push spirit details to inspector
  useEffect(() => {
    setInspectorTitle('Spirit Details')
    const entry = grimoireEntry

    setInspectorContent(
      <div className="p-3 space-y-3">
        <div>
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Spirit</span>
          <div className="text-sm font-display text-white/80">{entry?.name ?? selected}</div>
          {entry && (
            <div className="text-[9px] text-white/25 mt-0.5">
              #{String(entry.number).padStart(3, '0')} &middot; {entry.form} {entry.element ? `(${entry.element})` : ''}
            </div>
          )}
        </div>
        <div className="flex gap-4">
          <div>
            <span className="text-[9px] text-white/40 block">Base Species</span>
            <span className="text-xs text-white/60">{baseSpeciesId}</span>
          </div>
          <div>
            <span className="text-[9px] text-white/40 block">Form</span>
            <span className="text-xs text-white/60 capitalize">{entry?.form ?? 'base'}</span>
          </div>
        </div>
        <div>
          <span className="text-[9px] text-white/40 block">Animation</span>
          <span className="text-xs text-white/60">{selectedAnim} ({anim?.frames.length ?? 0} frames)</span>
        </div>
        <div>
          <span className="text-[9px] text-white/40 block">Palette</span>
          <span className="text-xs text-white/60">{paletteKey}</span>
          <div className="flex gap-0.5 mt-1">
            {(palette as readonly string[]).map((c, i) => (
              <div key={i} className="w-3 h-3 rounded-sm border border-white/10" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div className="text-[9px] text-white/20 pt-2 border-t border-white/5 font-mono">{selected}</div>
      </div>
    )
  }, [selected, selectedAnim, paletteKey, grimoireEntry, baseSpeciesId, spirit, anim, palette, setInspectorContent, setInspectorTitle])

  const launchToggle = (
    <button
      onClick={async () => {
        try {
          const res = await fetch('/shimmer/save-sprite', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggleLaunch', species: selected }),
          })
          const data = await res.json()
          if (data.success) {
            alert(`${selected} is now ${data.launched ? 'LAUNCHED' : 'UNLAUNCHED'}. Deploy to activate.`)
          }
        } catch { /* ignore */ }
      }}
      className={`px-3 py-1.5 rounded text-[11px] font-display border transition-all ${
        LAUNCHED_SPECIES.includes(selected as Species)
          ? 'bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25'
          : 'bg-white/5 text-text-faint border-white/10 hover:bg-white/10'
      }`}
    >
      {LAUNCHED_SPECIES.includes(selected as Species) ? '● Live — Unlaunch?' : '○ Draft — Launch?'}
    </button>
  )

  return (
    <EditorShell
      title="Spirit Dev"
      subtitle="Battle frames only — spirits fight, mana'mals follow."
      loadStatus={loadStatus}
      shortcuts={PIXEL_EDITOR_SHORTCUTS}
      onDeploy={onDeploy}
      deployState={deployState}
      headerActions={launchToggle}
    >

      {/* Controls row */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <GrimoireSelector
          selected={selected}
          onSelect={(id) => { setSelected(id); setSelectedAnim('icon'); setEditingFrame(0); setPaletteKey('base') }}
          allSpiritsData={SPIRITS}
        />
        <div className="w-px h-6 bg-white/10" />
        <div className="flex gap-1">
          {Object.keys(FRAME_CONST_MAP).map(key => (
            <button
              key={key}
              onClick={() => { setSelectedAnim(key); setEditingFrame(0) }}
              className={`px-2.5 py-1 rounded text-[11px] ${
                selectedAnim === key ? 'bg-white/15 text-white' : 'bg-white/5 text-text-faint hover:text-text-dim'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div className="flex gap-1">
          {[...Object.keys(spirit.palettes), ...ELEMENTS.filter(el => livePalettes?.[selected]?.[el])].map(key => {
            const isElement = (ELEMENTS as string[]).includes(key)
            const elColor = isElement ? ELEMENT_COLORS[key as keyof typeof ELEMENT_COLORS] : undefined
            return (
            <button
              key={key}
              onClick={() => setPaletteKey(key)}
              className={`px-2.5 py-1 rounded text-[11px] ${
                paletteKey === key ? 'bg-white/15 text-white' : 'bg-white/5 text-text-faint hover:text-text-dim'
              }`}
              style={isElement && paletteKey === key ? { color: elColor } : undefined}
            >
              {key}
            </button>
            )
          })}
        </div>
        <div className="w-px h-6 bg-white/10" />
        <ViewModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* Scene Preview — overworld context for icons, hidden for battle sprites */}
      {selectedAnim !== 'battle_front' && selectedAnim !== 'battle_back' && (
        <div className="mb-8">
          <p className="text-text-faint text-[10px] uppercase tracking-widest mb-2">
            Context — game scale (4x) · {selectedAnim} · {anim?.frames.length}f @ {anim?.rate}t
          </p>
          {anim && <ScenePreview anim={anim} palette={palette} mode={mode} />}
        </div>
      )}

      {/* Pixel Editor */}
      <div className="mb-8">
        {anim && (
          <PixelEditor
            palette={palette}
            initialPixels={anim.frames[Math.min(editingFrame, anim.frames.length - 1)]}
            mode={mode}
            species={selected}
            animName={selectedAnim}
            frameIndex={editingFrame}
            onSaved={() => loadLiveData(selected)}
            allSprites={sprites}
            paletteKey={paletteKey}
            gridSize={ANIM_GRID_SIZE[selectedAnim] ?? 32}
            frameConstMap={liveFrameMaps[selected] ?? FRAME_CONST_MAP}
            onFrameChange={setEditingFrame}
            totalFrames={anim.frames.length}
            onDuplicateFrame={duplicateFrame}
            onBatchOperation={handleBatchOp}
          />
        )}
      </div>

      {/* Live Animation + Frames */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-text-faint text-[10px] uppercase tracking-widest">Live Animation</p>
            <div className="flex gap-0.5 items-center">
              <span className="text-[9px] text-text-faint mr-1">Speed:</span>
              {[0.25, 0.5, 1, 2, 4].map(s => (
                <button key={s} onClick={() => setAnimSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[9px] ${animSpeed === s ? 'bg-white/15 text-white' : 'bg-white/5 text-text-faint hover:text-text-dim'}`}
                >{s}x</button>
              ))}
            </div>
          </div>
          <div className="flex gap-6 items-end flex-wrap">
            {anim && [1, 2, 4, 8].map(s => (
              <div key={s} className="text-center">
                <AnimPlayer anim={anim} palette={palette} scale={s} mode={mode} speedMultiplier={animSpeed} />
                <span className="text-[9px] text-text-faint mt-1 block">{s}x</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-text-faint text-[10px] uppercase tracking-widest mb-3">Frames — click to edit</p>
          <div className="flex flex-wrap items-end">
            {anim?.frames.map((frame, i) => (
              <div key={i} className="flex items-end">
                <button
                  onClick={() => addFrame(i)}
                  disabled={addingFrame}
                  className="w-4 h-12 flex items-center justify-center text-white/0 hover:text-gold/60 transition-all group self-center"
                  title={`Insert frame before F${i}`}
                >
                  <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                </button>
                <div className="relative group/frame">
                  <button
                    onClick={() => setEditingFrame(i)}
                    className={`text-center rounded-lg p-1.5 transition-all ${
                      editingFrame === i
                        ? 'bg-gold/15 ring-2 ring-gold/40'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <FramePreview pixels={frame} palette={palette} scale={6} mode={mode} />
                    <span className={`text-[9px] mt-1 block ${
                      editingFrame === i ? 'text-gold' : 'text-text-faint'
                    }`}>
                      F{i} {editingFrame === i ? '(editing)' : ''}
                    </span>
                  </button>
                  {anim.frames.length > 1 && (
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
              </div>
            ))}
            <button
              onClick={() => addFrame()}
              disabled={addingFrame}
              className="ml-1 w-[6.5rem] h-[6.5rem] rounded-lg border-2 border-dashed border-white/20 hover:border-gold/40 hover:bg-gold/5 text-white/40 hover:text-gold text-lg flex items-center justify-center transition-all disabled:opacity-30"
              title="Add frame at end"
            >
              {addingFrame ? '...' : '+'}
            </button>
          </div>
        </div>
      </div>

      {/* Variant Palettes */}
      <div className="mb-8">
        <div className="flex items-baseline gap-3 mb-4">
          <p className="text-text-faint text-[10px] uppercase tracking-widest">Variant Palettes</p>
          {isBaseForm ? (() => {
            const total = Object.values(variantConfig[selected] ?? {}).reduce((s, v) => s + v.encounterRate, 0)
            return total !== 100 ? (
              <span className="text-[10px] text-red-400">rates sum to {total}% (should be 100%)</span>
            ) : (
              <span className="text-[10px] text-green-400/60">100%</span>
            )
          })() : (
            <span className="text-[10px] text-white/20 italic">rates inherited from {baseSpeciesId}</span>
          )}
          {isBaseForm && (
            <button
              onClick={() => saveVariantConfig(selected, variantConfig[selected])}
              className={`ml-auto px-3 py-1 rounded text-[10px] border transition-all ${
                variantSaveStatus === 'saving' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                : variantSaveStatus === 'saved' ? 'bg-green-500/20 text-green-300 border-green-500/30'
                : 'bg-white/5 text-text-dim border-white/10 hover:bg-white/10'
              }`}
            >
              {variantSaveStatus === 'saving' ? 'Saving...' : variantSaveStatus === 'saved' ? 'Saved' : 'Save Variants'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6">
          {['base', ...VARIANT_CLASSES].map(key => {
            const compiledPal = (spirit.palettes as Record<string, readonly string[]>)[key] ?? spirit.palettes.base
            const pal = livePalettes?.[selected]?.[key] ?? compiledPal
            // Rates always come from base species
            const vc = variantConfig[baseSpeciesId]?.[key] ?? { rarity: 'common', encounterRate: 20 }
            const rc = RARITY_COLORS[vc.rarity as Rarity] ?? RARITY_COLORS.common
            const classDef = key !== 'base' ? VARIANT_CLASS_DEFS[key as VariantClass] : null
            return (
              <div key={key} className={`rounded-lg border p-3 ${rc.border} ${rc.bg}`}>
                <div className="flex justify-center mb-2">
                  <AnimPlayer
                    anim={anim ?? { frames: [new Uint8Array((ANIM_GRID_SIZE[selectedAnim] ?? 32) ** 2)], rate: 8 }}
                    palette={pal}
                    scale={4}
                    mode={mode}
                  />
                </div>
                <div className="text-center mb-1">
                  <span className="text-[11px] text-white font-display">{classDef?.name ?? 'Base'}</span>
                </div>
                {classDef && (
                  <div className="text-center mb-2">
                    <span className="text-[8px] text-white/20 italic">{classDef.description}</span>
                  </div>
                )}
                {isBaseForm ? (
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={0} max={100}
                        value={vc.encounterRate}
                        onChange={e => updateVariant(selected, key, 'encounterRate', parseInt(e.target.value))}
                        className="flex-1 h-1 accent-violet-500"
                      />
                      <span className={`text-[11px] font-mono w-8 text-right ${rc.text}`}>{vc.encounterRate}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2 text-center">
                    <span className={`text-[10px] font-mono ${rc.text}`}>{vc.encounterRate}%</span>
                  </div>
                )}
                <div className="flex gap-1 justify-center flex-wrap">
                  {(pal as readonly string[]).map((c, i) => (
                    <label key={i} className="relative cursor-pointer group">
                      <div className="w-5 h-5 rounded-sm border border-white/20 group-hover:border-white/50 transition-all group-hover:scale-110" style={{ backgroundColor: c }} title={`${c} — click to edit`} />
                      <input type="color" value={c} onChange={e => savePaletteColor(selected, key, i, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

      </div>

      {/* Spirit Config — under the hood */}
      <div className="mb-8">
        <SpiritConfig species={selected} />
      </div>
    </EditorShell>
  )
}
