'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import EditorShell from '../templates/EditorShell'
import { NPCS, type NPCDef } from '../../world/npcs'
import type { PlayerDirection } from '../../engine/player'
import type { Species, Element } from '../../spirits/spirit'
import type { AITier } from '../../engine/battle-ai'
import { ZONES } from '../../world/zones'
import { TILES, SOLID } from '../../world/tiles'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const DIRECTIONS: PlayerDirection[] = ['up', 'down', 'left', 'right']
const SPECIES_LIST: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
const ELEMENTS: Element[] = ['mana', 'storm', 'earth', 'water', 'base']
const AI_TIERS: AITier[] = ['wild', 'trained', 'champion']

const ZONE_COLORS: Record<string, string> = {
  garden: '#4ade80', 'mycelial-path': '#a78bfa', 'moonwell-glade': '#60a5fa',
  'spore-hollow': '#f472b6', 'twilight-thicket': '#f59e0b', 'mana-springs': '#38bdf8',
}

// Serializable NPC data (excludes Uint8Array sprite)
interface NPCData {
  id: string
  name: string
  zone: string
  tileX: number
  tileY: number
  direction: PlayerDirection
  dialogueId: string
  palette: string[]
  returnDialogueId?: string
  dialogueChain?: { dialogueId: string; requiresFlag?: string }[]
  blocking?: boolean
  hideWhenFlag?: string
  patrolPath?: { tileX: number; tileY: number }[]
  trainer?: { species: Species; name: string; levelOffset: number; element: Element; aiTier: AITier }
}

function cloneNPCs(): { data: NPCData[]; sprites: Uint8Array[] } {
  const data: NPCData[] = []
  const sprites: Uint8Array[] = []
  for (const n of NPCS) {
    data.push({
      id: n.id, name: n.name, zone: n.zone, tileX: n.tileX, tileY: n.tileY,
      direction: n.direction, dialogueId: n.dialogueId, palette: [...n.palette],
      returnDialogueId: n.returnDialogueId,
      dialogueChain: n.dialogueChain?.map(c => ({ ...c })),
      blocking: n.blocking, hideWhenFlag: n.hideWhenFlag,
      patrolPath: n.patrolPath?.map(p => ({ ...p })),
      trainer: n.trainer ? { ...n.trainer } : undefined,
    })
    sprites.push(n.sprite)
  }
  return { data, sprites }
}

function NpcSprite({ sprite, palette, size = 32 }: { sprite: Uint8Array; palette: string[]; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const ss = Math.round(Math.sqrt(sprite.length)) || 32
    const s = size / ss
    c.width = size
    c.height = size
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, size, size)
    for (let y = 0; y < ss; y++) {
      for (let x = 0; x < ss; x++) {
        const idx = sprite[y * ss + x]
        if (idx > 0 && palette[idx - 1]) {
          ctx.fillStyle = palette[idx - 1]
          ctx.fillRect(x * s, y * s, s, s)
        }
      }
    }
  }, [sprite, palette, size])
  return <canvas ref={ref} width={size} height={size} style={{ imageRendering: 'pixelated' }} />
}

function tileColor(tileIdx: number): string {
  if (tileIdx === 14) return '#ab51c2'
  if (SOLID[tileIdx]) {
    const tile = TILES[tileIdx]
    if (tile?.palette[0]?.startsWith('#24') || tile?.palette[0]?.startsWith('#99')) return '#24b296'
    if (tile?.palette[0]?.startsWith('#e5') || tile?.palette[0]?.startsWith('#e7') || tile?.palette[0]?.startsWith('#ec')) return '#8a7a8a'
    return '#3a3a4a'
  }
  const tile = TILES[tileIdx]
  if (!tile) return '#2d9c16'
  const p = tile.palette[0] ?? '#2d9c16'
  if (p.startsWith('#8a') || p.startsWith('#81') || p.startsWith('#91')) return '#8a7a4a'
  return '#2d9c16'
}

function ZoneMinimap({ zone, tileX, tileY, direction, patrolPath, otherNpcs, onPositionChange, onPatrolPathChange }: {
  zone: string
  tileX: number
  tileY: number
  direction: string
  patrolPath: { tileX: number; tileY: number }[]
  otherNpcs: { tileX: number; tileY: number }[]
  onPositionChange: (x: number, y: number) => void
  onPatrolPathChange: (p: { tileX: number; tileY: number }[]) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoneData = ZONES.find(z => z.id === zone)
  const grid = zoneData?.grid ?? []
  const SCALE = 3

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !grid.length) return
    const rows = grid.length
    const cols = grid[0]?.length ?? 0
    canvas.width = cols * SCALE
    canvas.height = rows * SCALE
    const ctx = canvas.getContext('2d')!

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const raw = grid[ty]?.[tx] ?? 0
        ctx.fillStyle = tileColor(raw & 0xFF)
        ctx.fillRect(tx * SCALE, ty * SCALE, SCALE, SCALE)
      }
    }

    for (const n of otherNpcs) {
      ctx.fillStyle = 'rgba(150, 150, 150, 0.7)'
      ctx.fillRect(n.tileX * SCALE, n.tileY * SCALE, SCALE, SCALE)
    }

    if (patrolPath.length > 0) {
      ctx.strokeStyle = '#f0e6c8'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(tileX * SCALE + SCALE / 2, tileY * SCALE + SCALE / 2)
      for (const wp of patrolPath) {
        ctx.lineTo(wp.tileX * SCALE + SCALE / 2, wp.tileY * SCALE + SCALE / 2)
      }
      ctx.stroke()
      for (let i = 0; i < patrolPath.length; i++) {
        const wp = patrolPath[i]
        ctx.fillStyle = '#f0e6c8'
        ctx.fillRect(wp.tileX * SCALE, wp.tileY * SCALE, SCALE, SCALE)
        ctx.fillStyle = '#000'
        ctx.font = `${Math.max(SCALE - 1, 2)}px monospace`
        ctx.fillText(`${i + 1}`, wp.tileX * SCALE, wp.tileY * SCALE + SCALE)
      }
    }

    ctx.fillStyle = '#d4a843'
    ctx.fillRect(tileX * SCALE, tileY * SCALE, SCALE, SCALE)
    ctx.fillStyle = '#fff'
    const cx = tileX * SCALE + SCALE / 2
    const cy = tileY * SCALE + SCALE / 2
    if (direction === 'down') ctx.fillRect(cx, cy + 1, 1, 1)
    else if (direction === 'up') ctx.fillRect(cx, cy - 1, 1, 1)
    else if (direction === 'right') ctx.fillRect(cx + 1, cy, 1, 1)
    else if (direction === 'left') ctx.fillRect(cx - 1, cy, 1, 1)
  }, [grid, tileX, tileY, direction, patrolPath, otherNpcs, SCALE])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY
    const tx = Math.floor(px / SCALE)
    const ty = Math.floor(py / SCALE)
    if (e.shiftKey) {
      onPatrolPathChange([...patrolPath, { tileX: tx, tileY: ty }])
    } else {
      onPositionChange(tx, ty)
    }
  }

  if (!grid.length) return null

  return (
    <div>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="border border-white/10 rounded-lg cursor-crosshair"
        style={{ imageRendering: 'pixelated', width: (grid[0]?.length ?? 30) * SCALE * 2, height: grid.length * SCALE * 2 }}
      />
      <p className="text-[9px] text-white/25 mt-1">Click to place · Shift+click to add patrol waypoint</p>
    </div>
  )
}

export default function NPCEditor({ onDeploy, deployState }: Props) {
  const [{ data, sprites }] = useState(cloneNPCs)
  const [npcs, setNpcs] = useState<NPCData[]>(data)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const selected = npcs[selectedIdx] ?? null
  const selectedSprite = sprites[selectedIdx] ?? null

  const byZone = useMemo(() => {
    const groups: Record<string, { npc: NPCData; idx: number }[]> = {}
    for (let i = 0; i < npcs.length; i++) {
      const z = npcs[i].zone
      if (!groups[z]) groups[z] = []
      groups[z].push({ npc: npcs[i], idx: i })
    }
    return groups
  }, [npcs])

  const update = useCallback((idx: number, patch: Partial<NPCData>) => {
    setNpcs(prev => prev.map((n, i) => i === idx ? { ...n, ...patch } : n))
    setDirty(true)
  }, [])

  const updateChainStep = useCallback((npcIdx: number, stepIdx: number, patch: Partial<{ dialogueId: string; requiresFlag: string }>) => {
    setNpcs(prev => prev.map((n, i) => {
      if (i !== npcIdx || !n.dialogueChain) return n
      const chain = [...n.dialogueChain]
      chain[stepIdx] = { ...chain[stepIdx], ...patch }
      if (patch.requiresFlag === '') { delete (chain[stepIdx] as Record<string, unknown>).requiresFlag }
      return { ...n, dialogueChain: chain }
    }))
    setDirty(true)
  }, [])

  const addChainStep = useCallback((npcIdx: number) => {
    setNpcs(prev => prev.map((n, i) => {
      if (i !== npcIdx) return n
      return { ...n, dialogueChain: [...(n.dialogueChain ?? []), { dialogueId: 'new-dialogue' }] }
    }))
    setDirty(true)
  }, [])

  const removeChainStep = useCallback((npcIdx: number, stepIdx: number) => {
    setNpcs(prev => prev.map((n, i) => {
      if (i !== npcIdx || !n.dialogueChain) return n
      return { ...n, dialogueChain: n.dialogueChain.filter((_, si) => si !== stepIdx) }
    }))
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npcs }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaveStatus('saved')
      setDirty(false)
      setTimeout(() => setSaveStatus(null), 2000)
      if (onDeploy) onDeploy()
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }, [npcs, onDeploy])

  return (
    <EditorShell
      title="NPCs"
      subtitle="NPC placement — zones, dialogue, trainers, flags"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* Left panel — NPC list by zone */}
        <div className="w-56 shrink-0 space-y-3">
          {Object.entries(byZone).map(([zone, entries]) => (
            <div key={zone}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: ZONE_COLORS[zone] ?? '#666' }} />
                <span className="text-[8px] font-display text-white/30 uppercase tracking-wider">{zone.replace(/-/g, ' ')}</span>
              </div>
              <div className="space-y-1">
                {entries.map(({ npc, idx }) => (
                  <button
                    key={npc.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-all text-xs border ${
                      selectedIdx === idx
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'hover:bg-white/5 border-transparent text-white/60'
                    }`}
                  >
                    <div className="w-6 h-6 shrink-0">
                      <NpcSprite sprite={sprites[idx]} palette={npc.palette} size={24} />
                    </div>
                    <span className="flex-1 truncate font-display">{npc.name}</span>
                    <span className="text-[8px] text-white/20 tabular-nums">{npc.tileX},{npc.tileY}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — NPC detail */}
        <div className="flex-1 min-w-0">
          {selected && selectedSprite ? (
            <div className="space-y-5">
              {/* Header with sprite preview */}
              <div className="flex items-start gap-4">
                <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                  <NpcSprite sprite={selectedSprite} palette={selected.palette} size={64} />
                </div>
                <div>
                  <input value={selected.name}
                    onChange={e => update(selectedIdx, { name: e.target.value })}
                    className="font-display text-lg text-white/90 bg-transparent border-b border-transparent hover:border-white/10 focus:border-violet-500/50 outline-none" />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] font-display px-1.5 py-0.5 rounded" style={{ background: `${ZONE_COLORS[selected.zone] ?? '#666'}20`, color: ZONE_COLORS[selected.zone] ?? '#666' }}>
                      {selected.zone}
                    </span>
                    <span className="text-[9px] text-white/20">{selected.id}</span>
                    {selected.blocking && <span className="text-[8px] text-red-400/60 px-1 rounded bg-red-500/10">blocking</span>}
                    {selected.trainer && <span className="text-[8px] text-amber-400/60 px-1 rounded bg-amber-500/10">trainer</span>}
                  </div>
                  {/* Palette swatches */}
                  <div className="flex gap-1 mt-2">
                    {selected.palette.map((c, i) => (
                      <input key={i} type="color" value={c}
                        onChange={e => {
                          const pal = [...selected.palette]
                          pal[i] = e.target.value
                          update(selectedIdx, { palette: pal })
                        }}
                        className="w-5 h-5 rounded border border-white/10 cursor-pointer" style={{ padding: 0 }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Position + direction */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Zone</label>
                  <select value={selected.zone}
                    onChange={e => update(selectedIdx, { zone: e.target.value })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50">
                    {ZONES.map(z => <option key={z.id} value={z.id} style={{ background: '#1a1a2e' }}>{z.name}</option>)}
                  </select>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Tile X</label>
                  <input type="number" min={0} value={selected.tileX}
                    onChange={e => update(selectedIdx, { tileX: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-white/80 outline-none focus:border-violet-500/50 tabular-nums" />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Tile Y</label>
                  <input type="number" min={0} value={selected.tileY}
                    onChange={e => update(selectedIdx, { tileY: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-white/80 outline-none focus:border-violet-500/50 tabular-nums" />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Direction</label>
                  <select value={selected.direction}
                    onChange={e => update(selectedIdx, { direction: e.target.value as PlayerDirection })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50">
                    {DIRECTIONS.map(d => <option key={d} value={d} style={{ background: '#1a1a2e' }}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Zone Minimap + Patrol Path */}
              <div className="flex gap-4">
                <ZoneMinimap
                  zone={selected.zone}
                  tileX={selected.tileX}
                  tileY={selected.tileY}
                  direction={selected.direction}
                  patrolPath={selected.patrolPath ?? []}
                  otherNpcs={npcs.filter((_, i) => i !== selectedIdx && npcs[i].zone === selected.zone).map(n => ({ tileX: n.tileX, tileY: n.tileY }))}
                  onPositionChange={(x, y) => update(selectedIdx, { tileX: x, tileY: y })}
                  onPatrolPathChange={p => update(selectedIdx, { patrolPath: p.length > 0 ? p : undefined })}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">Patrol Path</span>
                    <span className="text-[9px] text-white/20">{selected.patrolPath?.length ?? 0} waypoints</span>
                    {(selected.patrolPath?.length ?? 0) > 0 && (
                      <>
                        <button onClick={() => update(selectedIdx, { patrolPath: selected.patrolPath!.slice(0, -1) })}
                          className="text-[9px] text-amber-400 hover:text-amber-300">Undo</button>
                        <button onClick={() => update(selectedIdx, { patrolPath: undefined })}
                          className="text-[9px] text-red-400 hover:text-red-300">Clear</button>
                      </>
                    )}
                  </div>
                  {(selected.patrolPath?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selected.patrolPath!.map((wp, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 tabular-nums">
                          {i + 1}: ({wp.tileX},{wp.tileY})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dialogue */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Primary Dialogue</label>
                  <input value={selected.dialogueId}
                    onChange={e => update(selectedIdx, { dialogueId: e.target.value })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50" />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Return Dialogue</label>
                  <input value={selected.returnDialogueId ?? ''} placeholder="none"
                    onChange={e => update(selectedIdx, { returnDialogueId: e.target.value || undefined })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 placeholder-white/20" />
                </div>
              </div>

              {/* Flags */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Hide When Flag</label>
                  <input value={selected.hideWhenFlag ?? ''} placeholder="none"
                    onChange={e => update(selectedIdx, { hideWhenFlag: e.target.value || undefined })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 placeholder-white/20" />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 flex items-center gap-3">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider">Blocking</label>
                  <input type="checkbox" checked={selected.blocking ?? false}
                    onChange={e => update(selectedIdx, { blocking: e.target.checked || undefined })}
                    className="accent-violet-500" />
                </div>
              </div>

              {/* Dialogue Chain */}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Dialogue Chain ({selected.dialogueChain?.length ?? 0} steps)
                </div>
                {(selected.dialogueChain ?? []).length > 0 && (
                  <div className="grid grid-cols-[1fr_1fr_30px] gap-2 px-2 mb-1">
                    <span className="text-[9px] text-white/30 uppercase">Dialogue ID</span>
                    <span className="text-[9px] text-white/30 uppercase">Requires Flag</span>
                    <span />
                  </div>
                )}
                <div className="space-y-1">
                  {(selected.dialogueChain ?? []).map((step, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_30px] gap-2 items-center px-2 py-1.5 rounded bg-white/5">
                      <input value={step.dialogueId}
                        onChange={e => updateChainStep(selectedIdx, i, { dialogueId: e.target.value })}
                        className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50" />
                      <input value={step.requiresFlag ?? ''} placeholder="(none)"
                        onChange={e => updateChainStep(selectedIdx, i, { requiresFlag: e.target.value })}
                        className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/60 outline-none focus:border-violet-500/50 placeholder-white/20" />
                      <button onClick={() => removeChainStep(selectedIdx, i)}
                        className="text-red-400/50 hover:text-red-400 text-xs transition-colors">x</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => addChainStep(selectedIdx)}
                  className="mt-2 text-[10px] text-violet-400/70 hover:text-violet-400 border border-dashed border-violet-500/20 hover:border-violet-500/40 rounded px-3 py-1.5 transition-all">
                  + Add Step
                </button>
              </div>

              {/* Trainer config (optional) */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">Trainer</span>
                  <input type="checkbox" checked={!!selected.trainer}
                    onChange={e => {
                      if (e.target.checked) {
                        update(selectedIdx, { trainer: { species: 'owl', name: `${selected.name}'s Spirit`, levelOffset: 0, element: 'mana', aiTier: 'trained' } })
                      } else {
                        update(selectedIdx, { trainer: undefined })
                      }
                    }}
                    className="accent-violet-500" />
                </div>
                {selected.trainer && (
                  <div className="grid grid-cols-5 gap-3">
                    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                      <label className="text-[8px] text-white/30 uppercase block mb-1">Species</label>
                      <select value={selected.trainer.species}
                        onChange={e => update(selectedIdx, { trainer: { ...selected.trainer!, species: e.target.value as Species } })}
                        className="w-full bg-transparent border border-white/10 rounded px-1 py-1 text-xs text-white/80 outline-none">
                        {SPECIES_LIST.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s}</option>)}
                      </select>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                      <label className="text-[8px] text-white/30 uppercase block mb-1">Spirit Name</label>
                      <input value={selected.trainer.name}
                        onChange={e => update(selectedIdx, { trainer: { ...selected.trainer!, name: e.target.value } })}
                        className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none" />
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                      <label className="text-[8px] text-white/30 uppercase block mb-1">Level Offset</label>
                      <input type="number" min={-10} max={10} value={selected.trainer.levelOffset}
                        onChange={e => update(selectedIdx, { trainer: { ...selected.trainer!, levelOffset: parseInt(e.target.value) || 0 } })}
                        className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-white/80 outline-none tabular-nums" />
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                      <label className="text-[8px] text-white/30 uppercase block mb-1">Element</label>
                      <select value={selected.trainer.element}
                        onChange={e => update(selectedIdx, { trainer: { ...selected.trainer!, element: e.target.value as Element } })}
                        className="w-full bg-transparent border border-white/10 rounded px-1 py-1 text-xs text-white/80 outline-none">
                        {ELEMENTS.map(el => <option key={el} value={el} style={{ background: '#1a1a2e' }}>{el}</option>)}
                      </select>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                      <label className="text-[8px] text-white/30 uppercase block mb-1">AI Tier</label>
                      <select value={selected.trainer.aiTier}
                        onChange={e => update(selectedIdx, { trainer: { ...selected.trainer!, aiTier: e.target.value as AITier } })}
                        className="w-full bg-transparent border border-white/10 rounded px-1 py-1 text-xs text-white/80 outline-none">
                        {AI_TIERS.map(t => <option key={t} value={t} style={{ background: '#1a1a2e' }}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
                {selected.zone} @ ({selected.tileX}, {selected.tileY}) facing {selected.direction} |
                Dialogue: {selected.dialogueId} |
                {selected.dialogueChain ? `${selected.dialogueChain.length} chain steps` : 'no chain'} |
                {selected.trainer ? `Trainer: ${selected.trainer.species} Lv+${selected.trainer.levelOffset}` : 'not a trainer'}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-white/20 text-sm font-display">Select an NPC to edit</p>
            </div>
          )}
        </div>
      </div>
    </EditorShell>
  )
}
