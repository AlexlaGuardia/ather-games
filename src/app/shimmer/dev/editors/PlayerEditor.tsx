'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { PLAYER_SPRITES, PLAYER_PALETTE } from '../../sprites/player'
import { KAEL_SPRITES, KAEL_PALETTE } from '../../sprites/kael'
import { GREGORY_SPRITES, GREGORY_PALETTE } from '../../sprites/gregory'
import { SpriteAnim } from '../../sprites/sprite-data'
import { ALEX_SPRITES, ALEX_PALETTE } from '../../sprites/alex'
import { ViewMode, parseDigits, pixelsToDigits, flipH, flipV, shiftAllPixels } from '../../components/PixelUtils'
import { ScenePreview, AnimPlayer, FramePreview } from '../../components/SpriteRenderers'
import SandboxPreview from '../../components/SandboxPreview'
import PixelEditor from '../../components/PixelEditor'
import EditorShell from '../templates/EditorShell'
import { PIXEL_EDITOR_SHORTCUTS } from '../templates/shortcut-data'
import ViewModeToggle from '../templates/ViewModeToggle'

type CharRole = 'player' | 'npc'

type AnimTab = 'movement' | 'channel' | 'mana' | 'rinning' | 'emotes'

const ANIM_TABS: { id: AnimTab; label: string; pcOnly: boolean }[] = [
  { id: 'movement', label: 'Movement', pcOnly: false },
  { id: 'channel', label: 'Channel', pcOnly: true },
  { id: 'mana', label: 'Mana', pcOnly: true },
  { id: 'rinning', label: 'Rinning', pcOnly: true },
  { id: 'emotes', label: 'Emotes', pcOnly: false },
]

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

function animTabFor(key: string): AnimTab {
  if (key.startsWith('channel_')) return 'channel'
  if (key.startsWith('mana_')) return 'mana'
  if (key.startsWith('rinning_')) return 'rinning'
  if (key.startsWith('emote_')) return 'emotes'
  return 'movement'
}

const TAB_COLORS: Record<AnimTab, { active: string; text: string }> = {
  movement: { active: 'bg-gold/20 text-gold border-gold/30', text: 'text-gold' },
  channel:  { active: 'bg-violet-500/20 text-violet-300 border-violet-500/30', text: 'text-violet-300' },
  mana:     { active: 'bg-blue-500/20 text-blue-300 border-blue-500/30', text: 'text-blue-300' },
  rinning:  { active: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', text: 'text-cyan-300' },
  emotes:   { active: 'bg-pink-500/20 text-pink-300 border-pink-500/30', text: 'text-pink-300' },
}

const CHARACTERS: {
  id: string
  label: string
  sprites: Record<string, SpriteAnim>
  palette: readonly string[]
  role: CharRole
}[] = [
  { id: 'alkin', label: 'Alkin', sprites: PLAYER_SPRITES, palette: PLAYER_PALETTE, role: 'player' },
  { id: 'kael', label: 'Kael', sprites: KAEL_SPRITES, palette: KAEL_PALETTE, role: 'player' },
  { id: 'gregory', label: 'Gregory', sprites: GREGORY_SPRITES, palette: GREGORY_PALETTE, role: 'npc' },
  { id: 'alex', label: 'Alex', sprites: ALEX_SPRITES, palette: ALEX_PALETTE, role: 'player' as CharRole },
]

const FRAME_CONST_MAP: Record<string, string[]> = {
  down_idle:  ['DOWN_IDLE_0', 'DOWN_IDLE_1'],
  down_walk:  ['DOWN_IDLE_0', 'DOWN_STEP_L', 'DOWN_IDLE_0', 'DOWN_STEP_R'],
  down_run:   ['DOWN_RUN_0', 'DOWN_RUN_1', 'DOWN_RUN_2', 'DOWN_RUN_3'],
  up_idle:    ['UP_IDLE_0', 'UP_IDLE_1'],
  up_walk:    ['UP_IDLE_0', 'UP_STEP_L', 'UP_IDLE_0', 'UP_STEP_R'],
  up_run:     ['UP_RUN_0', 'UP_RUN_1', 'UP_RUN_2', 'UP_RUN_3'],
  right_idle: ['RIGHT_IDLE_0', 'RIGHT_IDLE_1'],
  right_walk: ['RIGHT_IDLE_0', 'RIGHT_STEP_L', 'RIGHT_IDLE_0', 'RIGHT_STEP_R'],
  right_run:  ['RIGHT_RUN_0', 'RIGHT_RUN_1', 'RIGHT_RUN_2', 'RIGHT_RUN_3'],
  // Staged movement phases — play-once transitions
  down_start_run:  ['DOWN_START_RUN_0', 'DOWN_START_RUN_1', 'DOWN_START_RUN_2'],
  down_special:    ['DOWN_SPECIAL_0', 'DOWN_SPECIAL_1', 'DOWN_SPECIAL_2'],
  down_end_run:    ['DOWN_END_RUN_0', 'DOWN_END_RUN_1', 'DOWN_END_RUN_2'],
  up_start_run:    ['UP_START_RUN_0', 'UP_START_RUN_1', 'UP_START_RUN_2'],
  up_special:      ['UP_SPECIAL_0', 'UP_SPECIAL_1', 'UP_SPECIAL_2'],
  up_end_run:      ['UP_END_RUN_0', 'UP_END_RUN_1', 'UP_END_RUN_2'],
  right_start_run: ['RIGHT_START_RUN_0', 'RIGHT_START_RUN_1', 'RIGHT_START_RUN_2'],
  right_special:   ['RIGHT_SPECIAL_0', 'RIGHT_SPECIAL_1', 'RIGHT_SPECIAL_2'],
  right_end_run:   ['RIGHT_END_RUN_0', 'RIGHT_END_RUN_1', 'RIGHT_END_RUN_2'],
  // Diagonals
  downright_idle:      ['DOWNRIGHT_IDLE_0', 'DOWNRIGHT_IDLE_1'],
  downright_walk:      ['DOWNRIGHT_IDLE_0', 'DOWNRIGHT_STEP_L', 'DOWNRIGHT_IDLE_0', 'DOWNRIGHT_STEP_R'],
  downright_run:       ['DOWNRIGHT_RUN_0', 'DOWNRIGHT_RUN_1', 'DOWNRIGHT_RUN_2', 'DOWNRIGHT_RUN_3'],
  downright_start_run: ['DOWNRIGHT_START_RUN_0', 'DOWNRIGHT_START_RUN_1', 'DOWNRIGHT_START_RUN_2'],
  downright_special:   ['DOWNRIGHT_SPECIAL_0', 'DOWNRIGHT_SPECIAL_1', 'DOWNRIGHT_SPECIAL_2'],
  downright_end_run:   ['DOWNRIGHT_END_RUN_0', 'DOWNRIGHT_END_RUN_1', 'DOWNRIGHT_END_RUN_2'],
  upright_idle:        ['UPRIGHT_IDLE_0', 'UPRIGHT_IDLE_1'],
  upright_walk:        ['UPRIGHT_IDLE_0', 'UPRIGHT_STEP_L', 'UPRIGHT_IDLE_0', 'UPRIGHT_STEP_R'],
  upright_run:         ['UPRIGHT_RUN_0', 'UPRIGHT_RUN_1', 'UPRIGHT_RUN_2', 'UPRIGHT_RUN_3'],
  upright_start_run:   ['UPRIGHT_START_RUN_0', 'UPRIGHT_START_RUN_1', 'UPRIGHT_START_RUN_2'],
  upright_special:     ['UPRIGHT_SPECIAL_0', 'UPRIGHT_SPECIAL_1', 'UPRIGHT_SPECIAL_2'],
  upright_end_run:     ['UPRIGHT_END_RUN_0', 'UPRIGHT_END_RUN_1', 'UPRIGHT_END_RUN_2'],
  channel_down:  ['CHANNEL_DOWN_0', 'CHANNEL_DOWN_1'],
  channel_up:    ['CHANNEL_UP_0', 'CHANNEL_UP_1'],
  channel_right: ['CHANNEL_RIGHT_0', 'CHANNEL_RIGHT_1'],
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

export default function PlayerEditor({ onDeploy, deployState }: {
  onDeploy: () => void
  deployState: 'idle' | 'building' | 'done' | 'error'
}) {
  const [selected, setSelected] = useState('alkin')
  const [selectedAnim, setSelectedAnim] = useState('down_idle')
  const [activeTab, setActiveTab] = useState<AnimTab>('movement')
  const [mode, setMode] = useState<ViewMode>('normal')
  const [editingFrame, setEditingFrame] = useState(0)
  const [liveSprites, setLiveSprites] = useState<Record<string, Record<string, SpriteAnim>> | null>(null)
  const [livePalette, setLivePalette] = useState<Record<string, string[]> | null>(null)
  const [liveFrameMaps, setLiveFrameMaps] = useState<Record<string, Record<string, string[]>>>({})
  const [liveDurations, setLiveDurations] = useState<Record<string, Record<string, number[]>>>({})
  const [loadStatus, setLoadStatus] = useState<string>('')
  const [addingFrame, setAddingFrame] = useState(false)
  const [deletingFrame, setDeletingFrame] = useState<number | null>(null)
  const [newFrameName, setNewFrameName] = useState('')
  const [showNewFrameInput, setShowNewFrameInput] = useState<number | 'end' | null>(null)
  const [renamingFrame, setRenamingFrame] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // Direction picker (movement tab)
  type SpriteDir = 'down' | 'up' | 'right' | 'downright' | 'upright'
  type AnimType = 'idle' | 'walk' | 'run'
  const [selectedDir, setSelectedDir] = useState<SpriteDir>('down')
  const [selectedAnimType, setSelectedAnimType] = useState<AnimType>('idle')
  // Character creation
  const [showCreateChar, setShowCreateChar] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharRole, setNewCharRole] = useState<CharRole>('npc')
  const [charActionStatus, setCharActionStatus] = useState('')
  // Movement style
  const [moveStyle, setMoveStyle] = useState<Record<string, { walkSpeed: number; runSpeed: number; rampTiles: number; brakeTiles: number; longPathThreshold: number; specialThreshold: number; endRunTiles: number }>>({})
  // Sandbox mode
  const [sandboxOpen, setSandboxOpen] = useState(false)
  // Clipboard (camera roll)
  const [clipboard, setClipboard] = useState<{ id: string; pixels: number[]; label: string }[]>([])
  const [clipboardPreview, setClipboardPreview] = useState<number | null>(null) // index into clipboard
  const clipboardKey = `shimmer-clipboard-${selected}`

  const loadMoveStyle = useCallback(async (charId: string) => {
    try {
      const res = await fetch(`/shimmer/save-movement-style?kind=player&id=${charId}`)
      const data = await res.json()
      if (data.style) setMoveStyle(prev => ({ ...prev, [charId]: data.style }))
    } catch { /* optional */ }
  }, [])

  const saveMoveStyle = useCallback(async (charId: string, style: { walkSpeed: number; runSpeed: number; rampTiles: number; brakeTiles: number; longPathThreshold: number; specialThreshold: number; endRunTiles: number }) => {
    setMoveStyle(prev => ({ ...prev, [charId]: style }))
    try {
      await fetch('/shimmer/save-movement-style', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'player', id: charId, style }),
      })
    } catch { /* best effort */ }
  }, [])


  const loadLiveData = useCallback(async (charId: string) => {
    try {
      setLoadStatus('loading...')
      const res = await fetch(`/shimmer/save-sprite?species=${charId}`)
      const data = await res.json()
      if (data.frames) {
        // Merge: FRAME_CONST_MAP provides defaults (incl. run phases), saved frameMap overrides
        const frameMap: Record<string, string[]> = { ...FRAME_CONST_MAP, ...(data.frameMap ?? {}) }
        setLiveFrameMaps(prev => ({ ...prev, [charId]: frameMap }))

        const compiled = CHARACTERS.find(c => c.id === charId)!.sprites
        const overrides: Record<string, SpriteAnim> = {}
        for (const [animKey, constNames] of Object.entries(frameMap)) {
          const compiledAnim = compiled[animKey]
          if (!compiledAnim) continue
          const frames: Uint8Array[] = constNames.map(
            (name, idx) => data.frames[name] ? parseDigits(data.frames[name], 1024) : (compiledAnim.frames[idx] ?? compiledAnim.frames[0])
          )
          overrides[animKey] = { frames, rate: compiledAnim.rate }
        }
        // Bootstrap empty animations for run phases that exist in frameMap but not in compiled sprites
        for (const [animKey, constNames] of Object.entries(frameMap)) {
          if (overrides[animKey]) continue // already built from compiled data
          const frames: Uint8Array[] = constNames.map(
            name => data.frames[name] ? parseDigits(data.frames[name], 1024) : new Uint8Array(1024)
          )
          overrides[animKey] = { frames, rate: 4 }
        }
        setLiveSprites(prev => ({ ...prev, [charId]: overrides }))
        // API returns palettes: { base: [...] } — extract base palette
        const livePal = data.palettes?.base ?? data.palette
        if (livePal) {
          setLivePalette(prev => ({ ...prev, [charId]: livePal }))
        }
        setLoadStatus('live')
      }
      // Load per-frame durations
      try {
        const durRes = await fetch(`/shimmer/save-durations?species=${charId}`)
        const durData = await durRes.json()
        if (durData.durations) {
          setLiveDurations(prev => ({ ...prev, [charId]: durData.durations }))
        }
      } catch { /* durations are optional */ }
    } catch {
      setLoadStatus('failed')
    }
  }, [])

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

  const handleBatchOp = useCallback(async (op: 'flipH' | 'flipV' | 'shiftUp' | 'shiftDown' | 'shiftLeft' | 'shiftRight') => {
    const sp = liveSprites?.[selected] ?? CHARACTERS.find(c => c.id === selected)!.sprites
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

  const createCharacter = useCallback(async () => {
    const name = newCharName.trim().toLowerCase()
    if (!name || name.length < 2) return
    setCharActionStatus('creating...')
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createCharacter', name, role: newCharRole }),
      })
      const data = await res.json()
      if (data.success) {
        setCharActionStatus(`Created "${name}" — deploy to activate`)
        setShowCreateChar(false)
        setNewCharName('')
      } else {
        setCharActionStatus(data.error ?? 'Failed')
      }
    } catch { setCharActionStatus('Request failed') }
  }, [newCharName, newCharRole])

  const deleteCharacter = useCallback(async (charId: string) => {
    if (['alkin', 'kael', 'gregory'].includes(charId)) return
    setCharActionStatus('deleting...')
    try {
      const res = await fetch('/shimmer/save-sprite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteCharacter', name: charId }),
      })
      const data = await res.json()
      if (data.success) {
        setCharActionStatus(`Deleted "${charId}" — deploy to apply`)
        setSelected('alkin')
      } else {
        setCharActionStatus(data.error ?? 'Failed')
      }
    } catch { setCharActionStatus('Request failed') }
  }, [])

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

  useEffect(() => {
    loadLiveData(selected)
    loadMoveStyle(selected)
  }, [selected, loadLiveData, loadMoveStyle])

  // Load clipboard from localStorage when character changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(clipboardKey)
      if (stored) setClipboard(JSON.parse(stored))
      else setClipboard([])
    } catch { setClipboard([]) }
    setClipboardPreview(null)
  }, [clipboardKey])

  // Save clipboard to localStorage on change
  const saveClipboard = useCallback((next: { id: string; pixels: number[]; label: string }[]) => {
    setClipboard(next)
    try { localStorage.setItem(clipboardKey, JSON.stringify(next)) } catch {}
  }, [clipboardKey])

  const stashToClipboard = useCallback((pixels: Uint8Array | number[], label: string) => {
    const arr = Array.from(pixels)
    const id = `clip_${Date.now()}`
    saveClipboard([...clipboard, { id, pixels: arr, label }])
  }, [clipboard, saveClipboard])

  const removeFromClipboard = useCallback((idx: number) => {
    saveClipboard(clipboard.filter((_, i) => i !== idx))
    if (clipboardPreview === idx) setClipboardPreview(null)
    else if (clipboardPreview !== null && clipboardPreview > idx) setClipboardPreview(clipboardPreview - 1)
  }, [clipboard, clipboardPreview, saveClipboard])

  const pasteFromClipboard = useCallback(async (clipIdx: number) => {
    const entry = clipboard[clipIdx]
    if (!entry) return
    // Save clipboard pixels into the current frame on disk
    await fetch('/shimmer/save-sprite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species: selected, anim: selectedAnim, frameIndex: editingFrame, digits: pixelsToDigits(entry.pixels, 32) }),
    })
    await loadLiveData(selected)
  }, [clipboard, selected, selectedAnim, editingFrame, loadLiveData])

  const saveDuration = useCallback(async (frameIdx: number, value: number, overrideAnim?: string) => {
    const animKey = overrideAnim ?? selectedAnim
    const current = liveDurations[selected]?.[animKey] ?? []
    const updated = [...current]
    while (updated.length <= frameIdx) updated.push(0)
    updated[frameIdx] = value
    setLiveDurations(prev => ({
      ...prev,
      [selected]: { ...prev[selected], [animKey]: updated }
    }))
    try {
      await fetch('/shimmer/save-durations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species: selected, anim: animKey, durations: updated }),
      })
    } catch { /* best effort */ }
  }, [selected, selectedAnim, liveDurations])

  const character = CHARACTERS.find(c => c.id === selected)!
  const sprites = liveSprites?.[selected] ?? character.sprites
  const palette = livePalette?.[selected] ?? character.palette
  const activeFrameMap = liveFrameMaps[selected] ?? FRAME_CONST_MAP
  // Auto-fallback: if NPC selected and current anim is a PC-only skill anim, reset to idle
  const isSkillAnim = selectedAnim.startsWith('channel_') || selectedAnim.startsWith('mana_') || selectedAnim.startsWith('rinning_')
  const effectiveAnim = (character.role === 'npc' && isSkillAnim) ? 'down_idle' : selectedAnim
  const rawAnim = sprites[effectiveAnim]
  // Merge live durations into anim for preview
  const animDurations = liveDurations[selected]?.[effectiveAnim]
  const anim = rawAnim && animDurations?.length
    ? { ...rawAnim, durations: animDurations }
    : rawAnim
  const sharedIndices = getSharedIndices(effectiveAnim, activeFrameMap)

  return (
    <EditorShell
      title="Character Sprites"
      subtitle="Pixel-art characters. 1x is truth."
      loadStatus={loadStatus}
      shortcuts={PIXEL_EDITOR_SHORTCUTS}
      onDeploy={onDeploy}
      deployState={deployState}
    >

      {/* Controls row */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div className="flex gap-2 items-center">
          {/* Character dropdown — grouped by role */}
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setSelectedAnim('down_idle'); setEditingFrame(0); setActiveTab('movement') }}
            className="px-3 py-1.5 rounded text-xs font-display bg-[#0a0a18] text-text border border-white/15 focus:border-gold/40 focus:outline-none min-w-[160px]"
          >
            <optgroup label="Playable Characters">
              {CHARACTERS.filter(c => c.role === 'player').map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </optgroup>
            <optgroup label="NPCs">
              {CHARACTERS.filter(c => c.role === 'npc').map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </optgroup>
          </select>
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
            character.role === 'player' ? 'bg-violet-500/20 text-violet-300' : 'bg-amber-500/20 text-amber-300'
          }`}>{character.role === 'player' ? 'PC' : 'NPC'}</span>
          {/* New/delete character */}
          <button
            onClick={() => { setShowCreateChar(!showCreateChar); setCharActionStatus('') }}
            className="px-2 py-1.5 rounded text-xs font-display bg-green-500/15 text-green-300 border border-green-500/20 hover:bg-green-500/25"
            title="New character"
          >+</button>
          {!['alkin', 'kael', 'gregory'].includes(selected) && (
            <button
              onClick={() => { if (confirm(`Delete "${selected}"? This removes the sprite file.`)) deleteCharacter(selected) }}
              className="px-2 py-1.5 rounded text-xs font-display bg-red-500/15 text-red-300 border border-red-500/20 hover:bg-red-500/25"
              title={`Delete ${selected}`}
            >x</button>
          )}
          {charActionStatus && (
            <span className={`text-[10px] ${charActionStatus.includes('Created') || charActionStatus.includes('Deleted') ? 'text-green-400' : charActionStatus.includes('...') ? 'text-text-faint' : 'text-red-400'}`}>
              {charActionStatus}
            </span>
          )}
        </div>
        {/* Create character form */}
        {showCreateChar && (
          <div className="flex gap-2 items-center -mt-2 mb-2">
            <input
              autoFocus
              value={newCharName}
              onChange={e => setNewCharName(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              placeholder="name"
              className="w-28 px-2 py-1 text-xs bg-black/40 border border-white/10 rounded text-white outline-none focus:border-gold/40"
              onKeyDown={e => { if (e.key === 'Enter') createCharacter(); if (e.key === 'Escape') setShowCreateChar(false) }}
            />
            <div className="flex gap-0.5">
              {(['player', 'npc'] as CharRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => setNewCharRole(r)}
                  className={`px-2 py-1 rounded text-[10px] ${
                    newCharRole === r
                      ? r === 'player' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/5 text-text-faint border border-transparent'
                  }`}
                >{r.toUpperCase()}</button>
              ))}
            </div>
            <button onClick={createCharacter} className="px-3 py-1 rounded text-xs bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30">Create</button>
            <button onClick={() => setShowCreateChar(false)} className="px-2 py-1 rounded text-xs text-text-faint hover:text-white">Cancel</button>
          </div>
        )}
        <div className="w-px h-6 bg-white/10" />
        {/* Tab bar */}
        <div className="flex gap-1">
          {ANIM_TABS
            .filter(tab => !tab.pcOnly || character.role === 'player')
            .map(tab => {
              const count = Object.keys(sprites).filter(k => animTabFor(k) === tab.id).length
              const tc = TAB_COLORS[tab.id]
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    const firstAnim = Object.keys(sprites).find(k => animTabFor(k) === tab.id)
                    if (firstAnim) { setSelectedAnim(firstAnim); setEditingFrame(0) }
                  }}
                  className={`px-3 py-1 rounded text-[11px] font-display border transition-all ${
                    activeTab === tab.id ? tc.active : 'bg-white/5 text-text-faint border-transparent hover:bg-white/10'
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
          /* Other tabs: flat animation buttons */
          <div className="flex gap-1 flex-wrap items-center">
            {Object.keys(sprites)
              .filter(key => animTabFor(key) === activeTab)
              .map(key => {
                const tc = TAB_COLORS[activeTab]
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedAnim(key); setEditingFrame(0) }}
                    className={`px-2.5 py-1 rounded text-[11px] ${
                      effectiveAnim === key ? tc.active : 'bg-white/5 text-text-faint hover:text-text-dim'
                    }`}
                  >{key}</button>
                )
              })}
            {activeTab === 'emotes' && (
              <button
                onClick={() => {
                  const name = prompt('Emote name (e.g. wave, dance, sit):')
                  if (!name || !/^[a-z_]+$/.test(name)) return
                  const emoteKey = `emote_${name}`
                  if (sprites[emoteKey]) { alert('Already exists'); return }
                  setSelectedAnim(emoteKey)
                  setEditingFrame(0)
                  fetch('/shimmer/save-sprite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ species: selected, anim: emoteKey, frameIndex: 0, digits: Array(32).fill('0'.repeat(32)).join('\n') }),
                  }).then(() => loadLiveData(selected))
                }}
                className="px-2 py-1 rounded text-[11px] bg-pink-500/15 text-pink-300 border border-pink-500/20 hover:bg-pink-500/25"
                title="Create new emote animation"
              >+ Emote</button>
            )}
          </div>
        )}
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

      {/* Movement Style panel (only on Movement tab for PCs) */}
      {activeTab === 'movement' && character.role === 'player' && (() => {
        const style = moveStyle[selected] ?? { walkSpeed: 3, runSpeed: 5.2, rampTiles: 3, brakeTiles: 3, longPathThreshold: 6, specialThreshold: 8, endRunTiles: 2 }
        return (
          <div className="flex items-center gap-4 mb-4 px-3 py-2 rounded bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-text-faint uppercase tracking-wider shrink-0">Movement</span>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              Walk
              <input type="range" min={1} max={6} step={0.1} value={style.walkSpeed}
                onChange={e => saveMoveStyle(selected, { ...style, walkSpeed: +e.target.value })}
                className="w-16 h-1 accent-gold" />
              <span className="text-gold w-6 text-right">{style.walkSpeed}</span>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              Run
              <input type="range" min={0} max={10} step={0.1} value={style.runSpeed}
                onChange={e => saveMoveStyle(selected, { ...style, runSpeed: +e.target.value })}
                className="w-16 h-1 accent-gold" />
              <span className="text-gold w-6 text-right">{style.runSpeed || 'off'}</span>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              Ramp
              <input type="range" min={1} max={8} step={1} value={style.rampTiles}
                onChange={e => saveMoveStyle(selected, { ...style, rampTiles: +e.target.value })}
                className="w-12 h-1 accent-gold" />
              <span className="text-gold w-4 text-right">{style.rampTiles}</span>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-text-dim">
              Brake
              <input type="range" min={1} max={8} step={1} value={style.brakeTiles}
                onChange={e => saveMoveStyle(selected, { ...style, brakeTiles: +e.target.value })}
                className="w-12 h-1 accent-gold" />
              <span className="text-gold w-4 text-right">{style.brakeTiles}</span>
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
          <SandboxPreview sprites={sprites} palette={palette} durations={liveDurations[selected]} />
        )}
      </div>

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
            gridSize={32}
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

      {/* Live Animation + Clipboard (compact row) */}
      <div className="flex gap-8 mb-8">
        <div className="flex-1">
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

        {/* Camera Roll / Clipboard */}
        <div className="w-[140px] shrink-0">
          <p className="text-text-faint text-[10px] uppercase tracking-widest mb-3">Clipboard</p>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {clipboard.length === 0 && (
              <p className="text-white/15 text-[9px] text-center py-4">
                Hover a frame and click ↓ to stash
              </p>
            )}
            {clipboard.map((entry, i) => (
              <div
                key={entry.id}
                className={`relative group/clip rounded-lg p-1.5 border transition-all cursor-pointer ${
                  clipboardPreview === i
                    ? 'bg-violet-500/10 border-violet-500/30'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                }`}
                onClick={() => setClipboardPreview(clipboardPreview === i ? null : i)}
              >
                <div className="flex items-center gap-2">
                  <FramePreview pixels={new Uint8Array(entry.pixels)} palette={palette} scale={2} mode={mode} />
                  <span className="text-[8px] text-white/40 font-mono truncate flex-1">{entry.label}</span>
                </div>
                <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover/clip:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); pasteFromClipboard(i) }}
                    className="w-5 h-4 rounded bg-green-500/80 text-white text-[7px] flex items-center justify-center hover:bg-green-400"
                    title="Paste into current frame"
                  >P</button>
                  <button
                    onClick={e => { e.stopPropagation(); removeFromClipboard(i) }}
                    className="w-4 h-4 rounded bg-red-500/80 text-white text-[7px] flex items-center justify-center hover:bg-red-400"
                    title="Remove from clipboard"
                  >x</button>
                </div>
              </div>
            ))}
            {clipboard.length > 0 && (
              <button
                onClick={() => saveClipboard([])}
                className="w-full text-[8px] text-red-400/50 hover:text-red-400 py-1 transition-colors"
              >Clear all</button>
            )}
          </div>
        </div>
      </div>

      {/* Frames — single strip or 4 phase strips for run context */}
      {(() => {
        const runCtx = getRunContext(effectiveAnim)

        /** Render a full frame strip for a given animation */
        const renderFrameStrip = (stripAnimKey: string, stripLabel: string, showShared = false) => {
          const stripAnim = sprites[stripAnimKey]
          if (!stripAnim) return null
          const isActive = effectiveAnim === stripAnimKey
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
                            title={`Stash ${constName} to clipboard`}>↓</button>
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
          const cycleAnims = [
            sprites[`${direction}_start_run`],
            sprites[`${direction}_run`],
            sprites[`${direction}_run`], // loop twice
            sprites[`${direction}_special`],
            sprites[`${direction}_end_run`],
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
            {renderFrameStrip(effectiveAnim, 'Frames — click to edit, double-click name to rename', true)}
          </div>
        )
      })()}

      {/* All Characters */}
      <div className="mb-8">
        <p className="text-text-faint text-[10px] uppercase tracking-widest mb-3">All Characters</p>
        <div className="flex gap-5">
          {CHARACTERS.map(c => {
            const charSprites = liveSprites?.[c.id] ?? c.sprites
            const charPalette = livePalette?.[c.id] ?? c.palette
            const charAnim = charSprites.down_idle
            const firstFrame = charAnim?.frames[0]
            return (
              <div key={c.id} className="text-center">
                {firstFrame && (
                  <FramePreview pixels={firstFrame} palette={charPalette} scale={5} mode={mode} />
                )}
                <span className="text-[9px] text-text-faint mt-1 block">
                  {c.label}
                  <span className={`ml-1 text-[8px] ${c.role === 'player' ? 'text-violet-400' : 'text-amber-400'}`}>
                    {c.role === 'player' ? 'PC' : 'NPC'}
                  </span>
                </span>
                <div className="flex gap-1 justify-center mt-1">
                  {charPalette.map((col, i) => (
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
    </EditorShell>
  )
}
