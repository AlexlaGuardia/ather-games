'use client'

import { useState, useCallback, useMemo } from 'react'
import EditorShell from '../templates/EditorShell'
import ItemIcon from '../../components/ItemIcon'
import { NODE_DEFS, type NodeDef } from '../../world/resources'
import { ITEMS } from '../../sprites/items'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const SKILL_COLORS: Record<string, string> = {
  forestry: '#4ade80',
  prospecting: '#a78bfa',
  rinning: '#60a5fa',
}

const SKILL_LABELS: Record<string, string> = {
  forestry: 'Forestry',
  prospecting: 'Prospecting',
  rinning: 'Rinning',
}

const DROP_ITEMS = ITEMS.filter(i => i.type === 'resource' || i.type === 'consumable')

function deepCloneNodes(): Record<string, NodeDef> {
  const clone: Record<string, NodeDef> = {}
  for (const [k, v] of Object.entries(NODE_DEFS)) {
    clone[k] = {
      ...v,
      drops: v.drops.map(d => ({ ...d })),
    }
  }
  return clone
}

export default function ResourcesEditor({ onDeploy, deployState }: Props) {
  const [nodes, setNodes] = useState<Record<string, NodeDef>>(deepCloneNodes)
  const [selectedId, setSelectedId] = useState<string>(Object.keys(NODE_DEFS)[0] ?? '')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const nodeList = useMemo(() =>
    Object.values(nodes).sort((a, b) => {
      const skillOrder = ['forestry', 'prospecting', 'rinning']
      return skillOrder.indexOf(a.skill) - skillOrder.indexOf(b.skill) || a.minLevel - b.minLevel
    }),
    [nodes]
  )

  const selected = nodes[selectedId] ?? null

  const bySkill = useMemo(() => {
    const groups: Record<string, NodeDef[]> = { forestry: [], prospecting: [], rinning: [] }
    for (const n of nodeList) groups[n.skill]?.push(n)
    return groups
  }, [nodeList])

  const updateNode = useCallback((id: string, patch: Partial<NodeDef>) => {
    setNodes(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setDirty(true)
  }, [])

  const updateDrop = useCallback((nodeId: string, idx: number, patch: Partial<{ itemId: string; chance: number }>) => {
    setNodes(prev => {
      const node = prev[nodeId]
      if (!node) return prev
      const drops = [...node.drops]
      drops[idx] = { ...drops[idx], ...patch }
      return { ...prev, [nodeId]: { ...node, drops } }
    })
    setDirty(true)
  }, [])

  const addDrop = useCallback((nodeId: string) => {
    setNodes(prev => {
      const node = prev[nodeId]
      if (!node) return prev
      return { ...prev, [nodeId]: { ...node, drops: [...node.drops, { itemId: 'raw_mana_shard', chance: 1.0 }] } }
    })
    setDirty(true)
  }, [])

  const removeDrop = useCallback((nodeId: string, idx: number) => {
    setNodes(prev => {
      const node = prev[nodeId]
      if (!node) return prev
      return { ...prev, [nodeId]: { ...node, drops: node.drops.filter((_, i) => i !== idx) } }
    })
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: nodes }),
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
  }, [nodes, onDeploy])

  return (
    <EditorShell
      title="Resources"
      subtitle="Node definitions — levels, XP, respawn timers, drop tables"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* Left panel — node list grouped by skill */}
        <div className="w-56 shrink-0 space-y-3">
          {(['forestry', 'prospecting', 'rinning'] as const).map(skill => (
            <div key={skill}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[8px] font-display px-1.5 py-0.5 rounded"
                  style={{ background: `${SKILL_COLORS[skill]}20`, color: SKILL_COLORS[skill] }}
                >{SKILL_LABELS[skill]}</span>
              </div>
              <div className="space-y-1">
                {bySkill[skill]?.map(node => (
                  <button
                    key={node.type}
                    onClick={() => setSelectedId(node.type)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-all text-xs border ${
                      selectedId === node.type
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'hover:bg-white/5 border-transparent text-white/60'
                    }`}
                  >
                    <span className="flex-1 truncate font-display capitalize">{node.type.replace(/_/g, ' ')}</span>
                    <span className="text-[8px] text-white/25 tabular-nums">Lv{node.minLevel}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — node detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="space-y-5">
              {/* Header */}
              <div>
                <h2 className="font-display text-lg text-white/90 capitalize">{selected.type.replace(/_/g, ' ')}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[8px] font-display px-1.5 py-0.5 rounded"
                    style={{ background: `${SKILL_COLORS[selected.skill]}20`, color: SKILL_COLORS[selected.skill] }}
                  >{SKILL_LABELS[selected.skill]}</span>
                  <span className="text-[9px] text-white/30">{selected.type}</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Min Level</label>
                  <input
                    type="number" min={1} max={99}
                    value={selected.minLevel}
                    onChange={e => updateNode(selected.type, { minLevel: parseInt(e.target.value) || 1 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-white/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Respawn (min)</label>
                  <input
                    type="number" min={0.5} step={0.5}
                    value={Math.round(selected.respawnMs / 60000 * 10) / 10}
                    onChange={e => updateNode(selected.type, { respawnMs: Math.round((parseFloat(e.target.value) || 1) * 60000) })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-amber-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">XP</label>
                  <input
                    type="number" min={0}
                    value={selected.xp}
                    onChange={e => updateNode(selected.type, { xp: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-green-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Mana Cost</label>
                  <input
                    type="number" min={0}
                    value={selected.manaCost}
                    onChange={e => updateNode(selected.type, { manaCost: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-blue-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                </div>
              </div>

              {/* Max harvests (fishing spots only) */}
              {selected.skill === 'rinning' && (
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 max-w-[200px]">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Max Harvests</label>
                  <input
                    type="number" min={1} max={20}
                    value={selected.maxHarvests ?? 1}
                    onChange={e => updateNode(selected.type, { maxHarvests: parseInt(e.target.value) || 1 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-cyan-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                  <span className="text-[8px] text-white/20 mt-1 block">catches before depletion</span>
                </div>
              )}

              {/* Drop table */}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Drops ({selected.drops.length})
                </div>

                {selected.drops.length > 0 && (
                  <div className="grid grid-cols-[1fr_100px_30px] gap-2 px-2 mb-1">
                    <span className="text-[9px] text-white/30 uppercase">Item</span>
                    <span className="text-[9px] text-white/30 uppercase">Chance</span>
                    <span />
                  </div>
                )}

                <div className="space-y-1">
                  {selected.drops.map((drop, i) => {
                    const itemDef = ITEMS.find(it => it.id === drop.itemId)
                    return (
                      <div key={i} className="grid grid-cols-[1fr_100px_30px] gap-2 items-center px-2 py-1.5 rounded bg-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 shrink-0">
                            {itemDef && <ItemIcon itemId={drop.itemId} scale={1} />}
                          </div>
                          <select
                            value={drop.itemId}
                            onChange={e => updateDrop(selected.type, i, { itemId: e.target.value })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 flex-1 min-w-0"
                          >
                            {DROP_ITEMS.map(item => (
                              <option key={item.id} value={item.id} style={{ background: '#1a1a2e' }}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="number" min={0} max={1} step={0.05}
                          value={drop.chance}
                          onChange={e => updateDrop(selected.type, i, { chance: parseFloat(e.target.value) || 0 })}
                          className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 w-full tabular-nums"
                        />
                        <button
                          onClick={() => removeDrop(selected.type, i)}
                          className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                        >x</button>
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={() => addDrop(selected.type)}
                  className="mt-2 text-[10px] text-violet-400/70 hover:text-violet-400 border border-dashed border-violet-500/20 hover:border-violet-500/40 rounded px-3 py-1.5 transition-all"
                >+ Add Drop</button>
              </div>

              {/* Summary */}
              <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
                Respawn: {(selected.respawnMs / 60000).toFixed(1)}m |
                XP/mana: {selected.manaCost > 0 ? (selected.xp / selected.manaCost).toFixed(1) : '—'} |
                Total drop chance: {(selected.drops.reduce((s, d) => s + d.chance, 0) * 100).toFixed(0)}%
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-white/20 text-sm font-display">Select a node to edit</p>
            </div>
          )}
        </div>
      </div>
    </EditorShell>
  )
}
