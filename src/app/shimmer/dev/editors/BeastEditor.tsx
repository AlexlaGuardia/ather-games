'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { BEAST_SPRITES, BEAST_PALETTES } from '../../sprites/beasts'
import { SpriteAnim } from '../../sprites/sprite-data'
import { ViewMode, parseDigits, pixelsToDigits, flipH, flipV, shiftAllPixels } from '../../components/PixelUtils'
import { FramePreview, AnimPlayer, ScenePreview, drawSprite } from '../../components/SpriteRenderers'
import SandboxPreview from '../../components/SandboxPreview'
import PixelEditor from '../../components/PixelEditor'
import EditorShell from '../templates/EditorShell'
import { PIXEL_EDITOR_SHORTCUTS } from '../templates/shortcut-data'
import ViewModeToggle from '../templates/ViewModeToggle'

const BEASTS = [
  { id: 'drifthorn',   name: 'Drifthorn',   desc: 'Deer — amber antler glow, forest body' },
  { id: 'dustwhisker', name: 'Dustwhisker', desc: 'Rabbit — iridescent fur, soft gold' },
  { id: 'sporeling',   name: 'Sporeling',   desc: 'Mushroom — teal/purple bioluminescent' },
  { id: 'glowmite',    name: 'Glowmite',    desc: 'Firefly swarm — electric blue pulse' },
  { id: 'embermole',   name: 'Embermole',   desc: 'Mole — warm amber, small & round' },
]

type BeastAnimTab = 'movement' | 'behavior'

const BEAST_ANIM_TABS: { id: BeastAnimTab; label: string }[] = [
  { id: 'movement', label: 'Movement' },
  { id: 'behavior', label: 'Behavior' },
]

function beastAnimTabFor(key: string): BeastAnimTab {
  if (['happy', 'pet', 'eat', 'sleep'].includes(key)) return 'behavior'
  return 'movement'
}

const DEFAULT_FRAME_CONST_MAP: Record<string, string[]> = {
  down_idle:       ['DOWN_IDLE_0', 'DOWN_IDLE_1'],
  down_walk:       ['DOWN_IDLE_0', 'DOWN_STEP_L', 'DOWN_IDLE_0', 'DOWN_STEP_R'],
  down_run:        ['DOWN_RUN_0', 'DOWN_RUN_1', 'DOWN_RUN_2', 'DOWN_RUN_3'],
  up_idle:         ['UP_IDLE_0', 'UP_IDLE_1'],
  up_walk:         ['UP_IDLE_0', 'UP_STEP_L', 'UP_IDLE_0', 'UP_STEP_R'],
  up_run:          ['UP_RUN_0', 'UP_RUN_1', 'UP_RUN_2', 'UP_RUN_3'],
  right_idle:      ['RIGHT_IDLE_0', 'RIGHT_IDLE_1'],
  right_walk:      ['RIGHT_IDLE_0', 'RIGHT_STEP_L', 'RIGHT_IDLE_0', 'RIGHT_STEP_R'],
  right_run:       ['RIGHT_RUN_0', 'RIGHT_RUN_1', 'RIGHT_RUN_2', 'RIGHT_RUN_3'],
  downright_idle:  ['DOWNRIGHT_IDLE_0', 'DOWNRIGHT_IDLE_1'],
  downright_walk:  ['DOWNRIGHT_IDLE_0', 'DOWNRIGHT_STEP_L', 'DOWNRIGHT_IDLE_0', 'DOWNRIGHT_STEP_R'],
  downright_run:   ['DOWNRIGHT_RUN_0', 'DOWNRIGHT_RUN_1', 'DOWNRIGHT_RUN_2', 'DOWNRIGHT_RUN_3'],
  upright_idle:    ['UPRIGHT_IDLE_0', 'UPRIGHT_IDLE_1'],
  upright_walk:    ['UPRIGHT_IDLE_0', 'UPRIGHT_STEP_L', 'UPRIGHT_IDLE_0', 'UPRIGHT_STEP_R'],
  upright_run:     ['UPRIGHT_RUN_0', 'UPRIGHT_RUN_1', 'UPRIGHT_RUN_2', 'UPRIGHT_RUN_3'],
  // Staged movement phases — play-once transitions
  down_start_run:      ['DOWN_START_RUN_0', 'DOWN_START_RUN_1', 'DOWN_START_RUN_2'],
  down_special:        ['DOWN_SPECIAL_0', 'DOWN_SPECIAL_1', 'DOWN_SPECIAL_2'],
  down_end_run:        ['DOWN_END_RUN_0', 'DOWN_END_RUN_1', 'DOWN_END_RUN_2'],
  up_start_run:        ['UP_START_RUN_0', 'UP_START_RUN_1', 'UP_START_RUN_2'],
  up_special:          ['UP_SPECIAL_0', 'UP_SPECIAL_1', 'UP_SPECIAL_2'],
  up_end_run:          ['UP_END_RUN_0', 'UP_END_RUN_1', 'UP_END_RUN_2'],
  right_start_run:     ['RIGHT_START_RUN_0', 'RIGHT_START_RUN_1', 'RIGHT_START_RUN_2'],
  right_special:       ['RIGHT_SPECIAL_0', 'RIGHT_SPECIAL_1', 'RIGHT_SPECIAL_2'],
  right_end_run:       ['RIGHT_END_RUN_0', 'RIGHT_END_RUN_1', 'RIGHT_END_RUN_2'],
  downright_start_run: ['DOWNRIGHT_START_RUN_0', 'DOWNRIGHT_START_RUN_1', 'DOWNRIGHT_START_RUN_2'],
  downright_special:   ['DOWNRIGHT_SPECIAL_0', 'DOWNRIGHT_SPECIAL_1', 'DOWNRIGHT_SPECIAL_2'],
  downright_end_run:   ['DOWNRIGHT_END_RUN_0', 'DOWNRIGHT_END_RUN_1', 'DOWNRIGHT_END_RUN_2'],
  upright_start_run:   ['UPRIGHT_START_RUN_0', 'UPRIGHT_START_RUN_1', 'UPRIGHT_START_RUN_2'],
  upright_special:     ['UPRIGHT_SPECIAL_0', 'UPRIGHT_SPECIAL_1', 'UPRIGHT_SPECIAL_2'],
  upright_end_run:     ['UPRIGHT_END_RUN_0', 'UPRIGHT_END_RUN_1', 'UPRIGHT_END_RUN_2'],
  happy:           ['HAPPY_0'],
  pet:             ['PET_0', 'PET_1'],
  eat:             ['EAT_0', 'EAT_1'],
  sleep:           ['SLEEP_0'],
}

/** Check if an anim key is a run-related phase and extract direction + phase */
function getRunContext(animKey: string): { direction: string; phase: string } | null {
  // Check longest phases first to avoid 'run' matching 'start_run'
  for (const phase of ['start_run', 'end_run', 'special', 'run']) {
    if (animKey.endsWith(`_${phase}`)) {
      return { direction: animKey.slice(0, -(phase.length + 1)), phase }
    }
  }
  return null
}

/** Sub-phases hidden from animation buttons — shown in phase rows instead */
function isRunSubPhase(key: string): boolean {
  return key.includes('_start_run') || key.includes('_special') || key.includes('_end_run')
}

/** Detect which frame indices in a walk anim are shared with idle */
function getSharedIndices(animName: string, frameMap: Record<string, string[]>): Set<number> {
  const shared = new Set<number>()
  const constNames = frameMap[animName]
  if (!constNames || !animName.endsWith('_walk')) return shared
  const idleKey = animName.replace('_walk', '_idle')
  const idleConsts = new Set(frameMap[idleKey])
  for (let i = 0; i < constNames.length; i++) {
    if (idleConsts.has(constNames[i])) shared.add(i)
  }
  return shared
}

export default function BeastEditor({ onDeploy, deployState }: {
  onDeploy: () => void
  deployState: 'idle' | 'building' | 'done' | 'error'
}) {
  const [selected, setSelected]         = useState(BEASTS[0].id)
  const [selectedAnim, setSelectedAnim] = useState('down_idle')
  const [activeTab, setActiveTab]       = useState<BeastAnimTab>('movement')
  const [editingFrame, setEditingFrame] = useState(0)
  const [mode, setMode]                 = useState<ViewMode>('normal')
  const [liveSprites, setLiveSprites]   = useState<Record<string, Record<string, SpriteAnim>> | null>(null)
  const [liveFrameMaps, setLiveFrameMaps] = useState<Record<string, Record<string, string[]>>>({})
  const [livePalettes, setLivePalettes] = useState<Record<string, string[]>>({})
  const [loadStatus, setLoadStatus]     = useState<string>('')
  const [addingFrame, setAddingFrame]   = useState(false)
  const [deletingFrame, setDeletingFrame] = useState<number | null>(null)
  const [newFrameName, setNewFrameName] = useState('')
  const [showNewFrameInput, setShowNewFrameInput] = useState<number | 'end' | null>(null)
  const [renamingFrame, setRenamingFrame] = useState<number | null>(null)
  const [renameValue, setRenameValue]   = useState('')
  // Direction picker (movement tab)
  type SpriteDir = 'down' | 'up' | 'right' | 'downright' | 'upright'
  type AnimType = 'idle' | 'walk' | 'run'
  const [selectedDir, setSelectedDir] = useState<SpriteDir>('down')
  const [selectedAnimType, setSelectedAnimType] = useState<AnimType>('idle')
  const gridRef = useRef<HTMLCanvasElement>(null)
  // Movement style
  const [moveStyle, setMoveStyle] = useState<Record<string, { walkSpeed: number; catchupSpeed: number; catchupDistance: number; longPathThreshold: number; specialThreshold: number; endRunTiles: number }>>({})
  // Per-frame durations
  const [liveDurations, setLiveDurations] = useState<Record<string, Record<string, number[]>>>({})
  // Clipboard (per-species, persisted in localStorage)
  const [clipboard, setClipboard] = useState<{ id: string; pixels: number[]; label: string }[]>([])
  const clipboardKey = `shimmer-clipboard-beast-${selected}`
  // Sandbox mode
  const [sandboxOpen, setSandboxOpen] = useState(false)

  const loadMoveStyle = useCallback(async (beastId: string) => {
    try {
      const res = await fetch(`/shimmer/save-movement-style?kind=beast&id=${beastId}`)
      const data = await res.json()
      if (data.style) setMoveStyle(prev => ({ ...prev, [beastId]: data.style }))
    } catch { /* optional */ }
  }, [])

  const saveMoveStyle = useCallback(async (beastId: string, style: { walkSpeed: number; catchupSpeed: number; catchupDistance: number; longPathThreshold: number; specialThreshold: number; endRunTiles: number }) => {
    setMoveStyle(prev => ({ ...prev, [beastId]: style }))
    try {
      await fetch('/shimmer/save-movement-style', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'beast', id: beastId, style }),
      })
    } catch { /* best effort */ }
  }, [])

  // ----------------------------------------------------------------
  // Duration load/save
  // ----------------------------------------------------------------
  const loadDurations = useCallback(async (beastId: string) => {
    try {
      const res = await fetch(`/shimmer/save-durations?species=${beastId}`)
      const data = await res.json()
      if (data.durations) setLiveDurations(prev => ({ ...prev, [beastId]: data.durations }))
    } catch { /* optional */ }
  }, [])

  const saveDuration = useCallback(async (frameIdx: number, value: number, animKey?: string) => {
    const aKey = animKey ?? selectedAnim
    const current = liveDurations[selected]?.[aKey] ?? []
    const updated = [...current]
    while (updated.length <= frameIdx) updated.push(0)
    updated[frameIdx] = value
    setLiveDurations(prev => ({ ...prev, [selected]: { ...prev[selected], [aKey]: updated } }))
    try {
      await fetch('/shimmer/save-durations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: selected, anim: aKey, durations: updated }),
      })
    } catch { /* best effort */ }
  }, [selected, selectedAnim, liveDurations])

  // ----------------------------------------------------------------
  // Live data loading — per beast, with frame map from server
  // ----------------------------------------------------------------
  const loadLiveData = useCallback(async (beastId?: string) => {
    const toLoad = beastId ? [BEASTS.find(b => b.id === beastId)!] : BEASTS

    for (const beast of toLoad) {
      try {
        setLoadStatus('loading...')
        const res = await fetch(`/shimmer/save-sprite?species=${beast.id}`)
        const data = await res.json()
        if (!data.frames) continue

        const frameMap: Record<string, string[]> = { ...DEFAULT_FRAME_CONST_MAP, ...(data.frameMap ?? {}) }
        setLiveFrameMaps(prev => ({ ...prev, [beast.id]: frameMap }))

        const compiled = BEAST_SPRITES[beast.id] ?? {}
        const overrides: Record<string, SpriteAnim> = {}

        for (const [animKey, constNames] of Object.entries(frameMap)) {
          const compiledAnim = compiled[animKey]
          const frames: Uint8Array[] = constNames.map(
            (name, idx) => data.frames[name] ? parseDigits(data.frames[name], 1024) : (compiledAnim?.frames[idx] ?? new Uint8Array(1024))
          )
          const rate = animKey.includes('walk') ? 3 : animKey === 'happy' ? 4 : animKey.includes('downright') || animKey.includes('upright') ? 4 : 8
          overrides[animKey] = { frames, rate: compiledAnim?.rate ?? rate }
        }

        // Bootstrap empty animations for run phases that exist in frameMap but not in compiled sprites
        for (const [animKey, constNames] of Object.entries(frameMap)) {
          if (overrides[animKey]) continue
          const frames: Uint8Array[] = constNames.map(
            name => data.frames[name] ? parseDigits(data.frames[name], 1024) : new Uint8Array(1024)
          )
          overrides[animKey] = { frames, rate: 4 }
        }

        setLiveSprites(prev => ({ ...prev, [beast.id]: overrides }))

        // Load live palette (API returns palettes: { base: [...] })
        const livePal = data.palettes?.base ?? data.palette
        if (livePal) {
          setLivePalettes(prev => ({ ...prev, [beast.id]: livePal }))
        }
      } catch {
        // keep fallback
      }
    }
    setLoadStatus('live')
  }, [])

  // ----------------------------------------------------------------
  // Clipboard — stash/paste frame pixel data (after loadLiveData)
  // ----------------------------------------------------------------
  const stashToClipboard = useCallback((pixels: Uint8Array | number[], label: string) => {
    const entry = { id: `${Date.now()}`, pixels: Array.from(pixels), label }
    setClipboard(prev => {
      const next = [...prev, entry]
      try { localStorage.setItem(clipboardKey, JSON.stringify(next)) } catch {}
      return next
    })
  }, [clipboardKey])

  const removeFromClipboard = useCallback((idx: number) => {
    setClipboard(prev => {
      const next = prev.filter((_, i) => i !== idx)
      try { localStorage.setItem(clipboardKey, JSON.stringify(next)) } catch {}
      return next
    })
  }, [clipboardKey])

  const pasteFromClipboard = useCallback(async (clipIdx: number) => {
    const entry = clipboard[clipIdx]
    if (!entry) return
    await fetch('/shimmer/save-sprite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species: selected, anim: selectedAnim, frameIndex: editingFrame, digits: pixelsToDigits(entry.pixels) }),
    })
    await loadLiveData(selected)
  }, [clipboard, selected, selectedAnim, editingFrame, loadLiveData])

  useEffect(() => { loadLiveData(); BEASTS.forEach(b => { loadMoveStyle(b.id); loadDurations(b.id) }) }, [loadLiveData, loadMoveStyle, loadDurations])

  // Restore clipboard from localStorage on species change
  useEffect(() => {
    try {
      const stored = localStorage.getItem(clipboardKey)
      setClipboard(stored ? JSON.parse(stored) : [])
    } catch { setClipboard([]) }
  }, [clipboardKey])

  // ----------------------------------------------------------------
  // Merged sprites: live overrides static source
  // ----------------------------------------------------------------
  const sprites = useMemo(() => {
    const merged: Record<string, Record<string, SpriteAnim>> = {}
    for (const beast of BEASTS) {
      merged[beast.id] = {
        ...BEAST_SPRITES[beast.id],
        ...(liveSprites?.[beast.id] ?? {}),
      }
    }
    return merged
  }, [liveSprites])

  // Active frame map for current beast
  const activeFrameMap = liveFrameMaps[selected] ?? DEFAULT_FRAME_CONST_MAP
  const currentBeast = BEASTS.find(b => b.id === selected)!
  const palette = (livePalettes[selected] ?? BEAST_PALETTES[selected]) as readonly string[]
  const anim = sprites[selected]?.[selectedAnim]
  const sharedIndices = getSharedIndices(selectedAnim, activeFrameMap)

  // ----------------------------------------------------------------
  // Frame management: add, delete, rename, duplicate
  // ----------------------------------------------------------------
  const addFrame = useCallback(async (insertAt?: number, frameName?: string, overrideAnim?: string) => {
    setAddingFrame(true)
    try {
      const body: Record<string, unknown> = { species: selected, anim: overrideAnim ?? selectedAnim }
      if (insertAt !== undefined) body.insertAt = insertAt
      if (frameName) body.frameName = frameName
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
    setShowNewFrameInput(null)
    setNewFrameName('')
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
          body: JSON.stringify({ species: selected, anim: selectedAnim, frameIndex: insertAt, digits: pixelsToDigits(currentPixels) }),
        })
        await loadLiveData(selected)
        setEditingFrame(insertAt)
      }
    } catch {}
    setAddingFrame(false)
  }, [editingFrame, selected, selectedAnim, loadLiveData])

  const deleteFrame = useCallback(async (frameIdx: number, overrideAnim?: string) => {
    setDeletingFrame(frameIdx)
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: selected, anim: overrideAnim ?? selectedAnim, frameIndex: frameIdx }),
      })
      const data = await res.json()
      if (data.success) {
        await loadLiveData(selected)
        setEditingFrame(Math.max(0, frameIdx - 1))
      }
    } catch {}
    setDeletingFrame(null)
  }, [selected, selectedAnim, loadLiveData])

  const renameFrame = useCallback(async (frameIdx: number, newName: string, overrideAnim?: string) => {
    if (!newName.trim()) return
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: selected, anim: overrideAnim ?? selectedAnim, renameFrame: frameIdx, newName: newName.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (data.success) await loadLiveData(selected)
    } catch {}
    setRenamingFrame(null)
    setRenameValue('')
  }, [selected, selectedAnim, loadLiveData])

  const handleBatchOp = useCallback(async (op: 'flipH' | 'flipV' | 'shiftUp' | 'shiftDown' | 'shiftLeft' | 'shiftRight') => {
    const sp = liveSprites?.[selected] ?? BEAST_SPRITES[selected] ?? {}
    const a = sp[selectedAnim]
    if (!a) return
    for (let i = 0; i < a.frames.length; i++) {
      let px = Array.from(a.frames[i])
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
        body: JSON.stringify({ species: selected, anim: selectedAnim, frameIndex: i, digits: pixelsToDigits(px) }),
      })
    }
    await loadLiveData(selected)
  }, [liveSprites, selected, selectedAnim, loadLiveData])

  // ----------------------------------------------------------------
  // Preview grid: all 5 beasts in a row (idle frame 0)
  // ----------------------------------------------------------------
  useEffect(() => {
    const ctx = gridRef.current?.getContext('2d')
    if (!ctx) return

    const cell = 22
    const pad  = 3
    const cols = BEASTS.length
    const w    = cols * cell + pad * 2
    const h    = cell + pad * 2

    ctx.canvas.width  = w
    ctx.canvas.height = h
    ctx.imageSmoothingEnabled = false

    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(212, 168, 67, 0.3)'
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1)

    BEASTS.forEach((beast, i) => {
      const x = pad + i * cell
      const y = pad

      if (beast.id === selected) {
        ctx.fillStyle = 'rgba(212, 168, 67, 0.15)'
        ctx.fillRect(x, y, cell, cell)
      }

      const idleAnim = sprites[beast.id]?.idle ?? sprites[beast.id]?.right_idle
      const pal      = BEAST_PALETTES[beast.id] as readonly string[]
      if (idleAnim?.frames[0]) {
        drawSprite(ctx, idleAnim.frames[0], pal, x + 3, y + 3, mode)
      }
    })
  }, [sprites, selected, mode])

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <EditorShell
      title="Mana'mal Dev"
      subtitle="Mana'mals — 8-directional follower sprites (32x32)"
      loadStatus={loadStatus}
      shortcuts={PIXEL_EDITOR_SHORTCUTS}
      onDeploy={onDeploy}
      deployState={deployState}
    >
      {/* Beast selector + animation picker */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <div className="flex gap-2 items-center">
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setSelectedAnim('down_idle'); setEditingFrame(0) }}
            className="px-3 py-1.5 rounded text-xs font-display bg-[#0a0a18] text-text border border-white/15 focus:border-gold/40 focus:outline-none min-w-[160px]"
          >
            {BEASTS.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <span className="text-[11px] text-text-faint italic">{currentBeast.desc}</span>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <ViewModeToggle mode={mode} onChange={setMode} />
        <div className="w-px h-6 bg-white/10" />
        <div className="flex gap-1 items-center">
          <span className="text-[10px] text-text-faint mr-1">Palette:</span>
          {palette.map((c, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-sm border border-white/10"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Tab bar + animation selector */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="flex gap-1">
          {BEAST_ANIM_TABS.map(tab => {
            const count = Object.keys(sprites[selected] ?? {}).filter(k => k !== 'idle' && k !== 'walk' && beastAnimTabFor(k) === tab.id).length
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  if (tab.id === 'movement') {
                    setSelectedAnim(`${selectedDir}_${selectedAnimType}`)
                    setEditingFrame(0)
                  } else {
                    const firstAnim = Object.keys(sprites[selected] ?? {}).find(k => k !== 'idle' && k !== 'walk' && beastAnimTabFor(k) === tab.id)
                    if (firstAnim) { setSelectedAnim(firstAnim); setEditingFrame(0) }
                  }
                }}
                className={`px-3 py-1 rounded text-[11px] font-display border transition-all ${
                  activeTab === tab.id
                    ? tab.id === 'movement' ? 'bg-gold/20 text-gold border-gold/30' : 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                    : 'bg-white/5 text-text-faint border-transparent hover:bg-white/10'
                }`}
              >
                {tab.label}
                <span className="ml-1 text-[9px] opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
        <div className="w-px h-6 bg-white/10" />
        {/* Movement tab: direction picker + animation type */}
        {activeTab === 'movement' ? (
          <div className="flex gap-3 items-center">
            {/* Direction picker */}
            <div className="flex gap-1">
              {(['down', 'up', 'right', 'downright', 'upright'] as SpriteDir[]).map(d => {
                const labels: Record<SpriteDir, string> = { down: 'D', up: 'U', right: 'R', downright: 'DR', upright: 'UR' }
                return (
                  <button
                    key={d}
                    onClick={() => { setSelectedDir(d); setSelectedAnim(`${d}_${selectedAnimType}`); setEditingFrame(0) }}
                    className={`px-2.5 py-1 rounded text-[11px] font-display ${
                      selectedDir === d ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-white/5 text-text-faint border border-transparent hover:text-text-dim'
                    }`}
                  >{labels[d]}</button>
                )
              })}
            </div>
            <div className="w-px h-6 bg-white/10" />
            {/* Animation type */}
            <div className="flex gap-1">
              {(['idle', 'walk', 'run'] as AnimType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setSelectedAnimType(t); setSelectedAnim(`${selectedDir}_${t}`); setEditingFrame(0) }}
                  className={`px-3 py-1 rounded text-[11px] font-display ${
                    selectedAnimType === t ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-white/5 text-text-faint border border-transparent hover:text-text-dim'
                  }`}
                >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>
          </div>
        ) : (
          /* Behavior tab: flat animation buttons */
          <div className="flex gap-1 flex-wrap">
            {Object.keys(sprites[selected] ?? {})
              .filter(key => key !== 'idle' && key !== 'walk' && beastAnimTabFor(key) === activeTab)
              .map(key => {
                const shared = getSharedIndices(key, activeFrameMap)
                const firstEditable = shared.has(0) ? 1 : 0
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedAnim(key); setEditingFrame(firstEditable) }}
                    className={`px-2.5 py-1 rounded text-[11px] ${
                      selectedAnim === key
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                        : 'bg-white/5 text-text-faint hover:text-text-dim'
                    }`}
                  >
                    {key}
                  </button>
                )
              })}
          </div>
        )}
      </div>

      {/* Movement Style panel */}
      {activeTab === 'movement' && (() => {
        const style = moveStyle[selected] ?? { walkSpeed: 2, catchupSpeed: 3, catchupDistance: 4, longPathThreshold: 6, specialThreshold: 8, endRunTiles: 2 }
        return (
          <div className="flex items-center gap-4 mb-6 px-3 py-2 rounded bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-text-faint uppercase tracking-wider shrink-0">Movement</span>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              Walk
              <input type="range" min={0.5} max={5} step={0.1} value={style.walkSpeed}
                onChange={e => saveMoveStyle(selected, { ...style, walkSpeed: +e.target.value })}
                className="w-16 h-1 accent-gold" />
              <span className="text-gold w-6 text-right">{style.walkSpeed}</span>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              Catchup
              <input type="range" min={1} max={8} step={0.1} value={style.catchupSpeed}
                onChange={e => saveMoveStyle(selected, { ...style, catchupSpeed: +e.target.value })}
                className="w-16 h-1 accent-gold" />
              <span className="text-gold w-6 text-right">{style.catchupSpeed}</span>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              Dist
              <input type="range" min={2} max={8} step={1} value={style.catchupDistance}
                onChange={e => saveMoveStyle(selected, { ...style, catchupDistance: +e.target.value })}
                className="w-12 h-1 accent-gold" />
              <span className="text-gold w-4 text-right">{style.catchupDistance}</span>
            </label>
            <span className="text-[9px] text-text-faint/50 opacity-30 mx-1">|</span>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              Long Path
              <input type="range" min={3} max={12} step={1} value={style.longPathThreshold}
                onChange={e => saveMoveStyle(selected, { ...style, longPathThreshold: +e.target.value })}
                className="w-12 h-1 accent-gold" />
              <span className="text-gold w-4 text-right">{style.longPathThreshold}</span>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              Special At
              <input type="range" min={4} max={16} step={1} value={style.specialThreshold}
                onChange={e => saveMoveStyle(selected, { ...style, specialThreshold: +e.target.value })}
                className="w-12 h-1 accent-gold" />
              <span className="text-gold w-4 text-right">{style.specialThreshold}</span>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              End Run
              <input type="range" min={1} max={5} step={1} value={style.endRunTiles}
                onChange={e => saveMoveStyle(selected, { ...style, endRunTiles: +e.target.value })}
                className="w-12 h-1 accent-gold" />
              <span className="text-gold w-4 text-right">{style.endRunTiles}</span>
            </label>
            <span className="text-[9px] text-text-faint/50 italic ml-auto">px/tick @ 15 TPS</span>
          </div>
        )
      })()}

      {/* Sandbox */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setSandboxOpen(v => !v)}
            className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border transition-colors ${
              sandboxOpen
                ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                : 'border-gold/30 text-gold hover:bg-gold/10'
            }`}
          >
            {sandboxOpen ? 'Close Sandbox' : 'Test Now'}
          </button>
        </div>
        {sandboxOpen && (
          <SandboxPreview sprites={sprites[selected] ?? {}} palette={palette} durations={liveDurations[selected]} />
        )}
      </div>

      {/* Pixel Editor */}
      <div className="mb-8">
        {anim && (
          <PixelEditor
            palette={palette}
            initialPixels={anim.frames[Math.min(editingFrame, anim.frames.length - 1)]}
            gridSize={32}
            mode={mode}
            species={selected}
            animName={selectedAnim}
            frameIndex={editingFrame}
            onSaved={() => loadLiveData(selected)}
            allSprites={sprites[selected] ?? {}}
            gridCellSize={20}
            showMirror
            isShared={sharedIndices.has(editingFrame)}
            frameConstMap={activeFrameMap}
            onFrameChange={setEditingFrame}
            totalFrames={anim.frames.length}
            onDuplicateFrame={duplicateFrame}
            onBatchOperation={handleBatchOp}
          />
        )}
      </div>

      {/* Live Animation */}
      <div className="mb-8">
        <p className="text-text-faint text-[10px] uppercase tracking-widest mb-3">Live Animation</p>
        <div className="flex gap-6 items-end flex-wrap">
          {anim && [1, 2, 4].map(s => (
            <div key={s} className="text-center">
              <AnimPlayer anim={anim} palette={palette} scale={s} mode={mode} />
              <span className="text-[9px] text-text-faint mt-1 block">{s}x</span>
            </div>
          ))}
        </div>
      </div>

      {/* Frames — single strip or 4 phase strips for run context */}
      {(() => {
        const runCtx = getRunContext(selectedAnim)

        /** Render a full frame strip for a given animation */
        const renderFrameStrip = (stripAnimKey: string, stripLabel: string, showShared = false) => {
          const stripAnim = (sprites[selected] ?? {})[stripAnimKey]
          if (!stripAnim) return null
          const isActive = selectedAnim === stripAnimKey
          const stripConstNames = activeFrameMap[stripAnimKey] ?? []
          const stripShared = showShared ? getSharedIndices(stripAnimKey, activeFrameMap) : new Set<number>()
          const stripDurations = liveDurations[selected]?.[stripAnimKey]
          const defaultRate = stripAnim.rate

          return (
            <div className={`${runCtx ? 'rounded-lg p-4 border transition-all' : ''} ${
              runCtx ? (isActive ? 'bg-gold/[0.04] border-gold/20' : 'bg-white/[0.015] border-white/[0.06]') : ''
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <p className={`text-[10px] uppercase tracking-widest font-display ${
                  isActive ? 'text-gold' : 'text-text-faint'
                }`}>{stripLabel}</p>
                {runCtx && (
                  <AnimPlayer anim={stripAnim} palette={palette} scale={2} mode={mode} />
                )}
                <span className="text-[9px] text-text-faint/30">{stripAnim.frames.length} frames</span>
              </div>
              <div className="flex flex-wrap items-end">
                {stripAnim.frames.map((frame, i) => {
                  const isFrameShared = stripShared.has(i)
                  const constName = stripConstNames[i] ?? `F${i}`
                  const prefix = stripAnimKey.toUpperCase() + '_'
                  const shortName = constName.startsWith(prefix) ? constName.slice(prefix.length) : constName
                  const isEditing = isActive && editingFrame === i
                  return (
                    <div key={i} className="flex items-end">
                      {/* Insert-before */}
                      {isActive && showNewFrameInput === i ? (
                        <form
                          className="flex flex-col items-center gap-1 mx-1 self-center"
                          onSubmit={e => { e.preventDefault(); addFrame(i, newFrameName || undefined, stripAnimKey) }}
                        >
                          <input autoFocus value={newFrameName}
                            onChange={e => setNewFrameName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                            placeholder="NAME"
                            className="w-16 px-1 py-0.5 text-[9px] bg-black/40 border border-gold/30 rounded text-gold text-center outline-none"
                            onKeyDown={e => { if (e.key === 'Escape') { setShowNewFrameInput(null); setNewFrameName('') } }}
                          />
                          <div className="flex gap-0.5">
                            <button type="submit" className="text-[8px] text-green-400 hover:text-green-300">add</button>
                            <button type="button" onClick={() => { setShowNewFrameInput(null); setNewFrameName('') }} className="text-[8px] text-red-400 hover:text-red-300">esc</button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => { setSelectedAnim(stripAnimKey); setShowNewFrameInput(i); setNewFrameName('') }}
                          disabled={addingFrame}
                          className="w-4 h-12 flex items-center justify-center text-white/0 hover:text-gold/60 transition-all group self-center"
                          title={`Insert frame before ${constName}`}
                        >
                          <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                        </button>
                      )}
                      <div className="relative group/frame">
                        <button
                          onClick={() => {
                            if (isFrameShared) return
                            setSelectedAnim(stripAnimKey)
                            setEditingFrame(i)
                          }}
                          className={`text-center rounded-lg p-1.5 transition-all ${
                            isFrameShared ? 'opacity-40 cursor-not-allowed'
                              : isEditing ? 'bg-gold/15 ring-2 ring-gold/40'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <FramePreview pixels={frame} palette={palette} scale={3} mode={mode} />
                          {isActive && renamingFrame === i && !isFrameShared ? (
                            <form className="mt-1" onSubmit={e => { e.preventDefault(); renameFrame(i, renameValue, stripAnimKey) }} onClick={e => e.stopPropagation()}>
                              <input autoFocus value={renameValue}
                                onChange={e => setRenameValue(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                                className="w-16 px-0.5 py-0 text-[8px] bg-black/60 border border-gold/40 rounded text-gold text-center outline-none"
                                onKeyDown={e => { if (e.key === 'Escape') setRenamingFrame(null) }}
                                onBlur={() => setRenamingFrame(null)}
                              />
                            </form>
                          ) : (
                            <span
                              className={`text-[8px] mt-1 block font-mono truncate max-w-[60px] ${
                                isFrameShared ? 'text-amber-400' : isEditing ? 'text-gold' : 'text-text-faint'
                              }`}
                              title={`${constName} — double-click to rename`}
                              onDoubleClick={e => { if (isFrameShared) return; e.stopPropagation(); setSelectedAnim(stripAnimKey); setRenamingFrame(i); setRenameValue(constName) }}
                            >
                              {isFrameShared ? 'idle' : shortName}
                            </span>
                          )}
                          {!isFrameShared && (
                            <div className="flex items-center justify-center gap-0.5 mt-1" onClick={e => e.stopPropagation()}>
                              <input type="number" min={1} max={120}
                                value={stripDurations?.[i] || defaultRate}
                                onChange={e => saveDuration(i, Math.max(1, Math.min(120, parseInt(e.target.value) || defaultRate)), stripAnimKey)}
                                className="w-8 text-center text-[8px] bg-black/40 border border-white/10 rounded text-text-faint py-0 px-0 focus:border-gold/40 focus:outline-none"
                                title={`Hold time (ticks) — ${Math.round((stripDurations?.[i] || defaultRate) / 15 * 1000)}ms`}
                              />
                              <span className="text-[7px] text-text-faint/40">t</span>
                            </div>
                          )}
                        </button>
                        {!isFrameShared && (
                          <button onClick={() => stashToClipboard(frame, constName)}
                            className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-violet-500/80 text-white text-[8px] flex items-center justify-center opacity-0 group-hover/frame:opacity-100 transition-opacity hover:bg-violet-400"
                            title={`Stash ${constName} to clipboard`}>&#x2193;</button>
                        )}
                        {!isFrameShared && stripAnim.frames.length > 1 && (
                          <button onClick={() => deleteFrame(i, stripAnimKey)}
                            disabled={deletingFrame !== null}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white text-[8px] flex items-center justify-center opacity-0 group-hover/frame:opacity-100 transition-opacity hover:bg-red-400 disabled:opacity-30"
                            title={`Delete ${constName}`}>
                            {deletingFrame === i ? '...' : 'x'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {/* Add frame at end */}
                {isActive && showNewFrameInput === 'end' ? (
                  <form className="ml-1 flex flex-col items-center gap-1"
                    onSubmit={e => { e.preventDefault(); addFrame(undefined, newFrameName || undefined, stripAnimKey) }}>
                    <input autoFocus value={newFrameName}
                      onChange={e => setNewFrameName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                      placeholder="FRAME_NAME"
                      className="w-20 px-1.5 py-1 text-[10px] bg-black/40 border border-gold/30 rounded text-gold text-center outline-none"
                      onKeyDown={e => { if (e.key === 'Escape') { setShowNewFrameInput(null); setNewFrameName('') } }}
                    />
                    <div className="flex gap-1">
                      <button type="submit" className="text-[9px] text-green-400 hover:text-green-300">add</button>
                      <button type="button" onClick={() => { setShowNewFrameInput(null); setNewFrameName('') }} className="text-[9px] text-red-400 hover:text-red-300">esc</button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => { setSelectedAnim(stripAnimKey); setShowNewFrameInput('end'); setNewFrameName('') }}
                    disabled={addingFrame}
                    className="ml-1 w-14 h-14 rounded-lg border-2 border-dashed border-white/20 hover:border-gold/40 hover:bg-gold/5 text-white/40 hover:text-gold text-lg flex items-center justify-center transition-all disabled:opacity-30"
                    title="Add frame at end">
                    {addingFrame ? '...' : '+'}
                  </button>
                )}
              </div>
            </div>
          )
        }

        if (runCtx) {
          const { direction } = runCtx
          // Build combined cycle preview: start_run → run (×2) → special → end_run
          const beastAnims = sprites[selected] ?? {}
          const cycleAnims = [
            beastAnims[`${direction}_start_run`],
            beastAnims[`${direction}_run`],
            beastAnims[`${direction}_run`], // loop twice
            beastAnims[`${direction}_special`],
            beastAnims[`${direction}_end_run`],
          ].filter(Boolean)
          const cycleFrames = cycleAnims.flatMap(a => Array.from(a!.frames))
          const cycleAnim = cycleFrames.length > 0 ? { frames: cycleFrames.map(f => f as Uint8Array), rate: 4 } : null

          return (
            <div className="mb-8 space-y-4">
              {/* Combined cycle preview */}
              {cycleAnim && (
                <div className="flex items-center gap-4 px-3 py-2 rounded bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] text-text-faint uppercase tracking-wider shrink-0">Full Cycle</span>
                  {[2, 4].map(s => (
                    <div key={s} className="text-center">
                      <AnimPlayer anim={cycleAnim} palette={palette} scale={s} mode={mode} />
                      <span className="text-[8px] text-text-faint/40 block">{s}x</span>
                    </div>
                  ))}
                  <span className="text-[9px] text-text-faint/30 ml-auto">
                    start → run ×2 → special → brake ({cycleFrames.length} frames)
                  </span>
                </div>
              )}
              {renderFrameStrip(`${direction}_start_run`, 'Start Run')}
              {renderFrameStrip(`${direction}_run`, 'Run Loop')}
              {renderFrameStrip(`${direction}_special`, 'Special')}
              {renderFrameStrip(`${direction}_end_run`, 'Brake')}
            </div>
          )
        }

        // Default: single frame strip for current animation
        return (
          <div className="mb-8">
            {renderFrameStrip(selectedAnim, 'Frames — click to edit, double-click name to rename', true)}
          </div>
        )
      })()}

      {/* Clipboard */}
      {clipboard.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-text-faint text-[10px] uppercase tracking-widest">Clipboard</p>
            <span className="text-[9px] text-text-faint/40">Hover a frame and click &#x2193; to stash</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {clipboard.map((entry, i) => (
              <div key={entry.id} className="relative group/clip text-center">
                <FramePreview pixels={new Uint8Array(entry.pixels)} palette={palette} scale={3} mode={mode} />
                <span className="text-[7px] text-text-faint block mt-0.5 truncate max-w-[50px]">{entry.label}</span>
                <button
                  onClick={e => { e.stopPropagation(); pasteFromClipboard(i) }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500/80 text-white text-[8px] flex items-center justify-center opacity-0 group-hover/clip:opacity-100 transition-opacity hover:bg-green-400"
                  title="Paste into current frame">&#x2191;</button>
                <button
                  onClick={e => { e.stopPropagation(); removeFromClipboard(i) }}
                  className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-red-500/80 text-white text-[8px] flex items-center justify-center opacity-0 group-hover/clip:opacity-100 transition-opacity hover:bg-red-400"
                  title="Remove from clipboard">x</button>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setClipboard([]); try { localStorage.removeItem(clipboardKey) } catch {} }}
            className="text-[8px] text-red-400/60 hover:text-red-400 mt-2">Clear all</button>
        </div>
      )}

      {/* All Mana'mals overview */}
      <div className="mb-8">
        <p className="text-text-faint text-[10px] uppercase tracking-widest mb-3">All Mana'mals</p>
        <div className="flex gap-5">
          {BEASTS.map(b => {
            const beastSprites = sprites[b.id] ?? {}
            const beastPalette = (livePalettes[b.id] ?? BEAST_PALETTES[b.id]) as readonly string[]
            const beastAnim = beastSprites.down_idle ?? beastSprites.idle
            const firstFrame = beastAnim?.frames[0]
            return (
              <div key={b.id} className="text-center">
                {firstFrame && (
                  <FramePreview pixels={firstFrame} palette={beastPalette} scale={5} mode={mode} />
                )}
                <span className="text-[9px] text-text-faint mt-1 block">{b.name}</span>
                <div className="flex gap-1 justify-center mt-1">
                  {beastPalette.map((col, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-sm border border-white/10"
                      style={{ backgroundColor: col }}
                      title={col}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Catalog grid */}
      <div>
        <span className="text-[9px] text-text-faint block mb-2">Sprite Grid (4x)</span>
        <canvas
          ref={gridRef}
          className="border border-white/10 rounded"
          style={{ imageRendering: 'pixelated', transform: 'scale(4)', transformOrigin: 'top left' }}
        />
        <div style={{ marginTop: 80 }} />
      </div>
    </EditorShell>
  )
}
