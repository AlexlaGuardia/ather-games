'use client'

import { useState, useCallback, useMemo } from 'react'
import EditorShell from '../templates/EditorShell'
import ItemIcon from '../../components/ItemIcon'
import { TOOL_DEFS, type ToolDef } from '../../engine/tools'
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

const SKILL_TOOL_NAMES: Record<string, string> = {
  forestry: 'Blades',
  prospecting: 'Spikes',
  rinning: 'Rinsticks',
}

const TIER_COLORS: Record<number, string> = {
  1: '#60c0e0',
  2: '#e0a040',
  3: '#c070e0',
}

const RECIPE_ITEMS = ITEMS.filter(i => i.type === 'resource' || i.type === 'consumable')

function deepCloneTools(): Record<string, ToolDef> {
  const clone: Record<string, ToolDef> = {}
  for (const [k, v] of Object.entries(TOOL_DEFS)) {
    clone[k] = {
      ...v,
      recipe: v.recipe.map(r => ({ ...r })),
    }
  }
  return clone
}

export default function ToolsEditor({ onDeploy, deployState }: Props) {
  const [tools, setTools] = useState<Record<string, ToolDef>>(deepCloneTools)
  const [selectedId, setSelectedId] = useState<string>(Object.keys(TOOL_DEFS)[0] ?? '')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const toolList = useMemo(() =>
    Object.values(tools).sort((a, b) => {
      const skillOrder = ['forestry', 'prospecting', 'rinning']
      return skillOrder.indexOf(a.skillId) - skillOrder.indexOf(b.skillId) || a.tier - b.tier
    }),
    [tools]
  )

  const selected = tools[selectedId] ?? null

  const bySkill = useMemo(() => {
    const groups: Record<string, ToolDef[]> = { forestry: [], prospecting: [], rinning: [] }
    for (const t of toolList) groups[t.skillId]?.push(t)
    return groups
  }, [toolList])

  const updateTool = useCallback((id: string, patch: Partial<ToolDef>) => {
    setTools(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setDirty(true)
  }, [])

  const updateRecipeItem = useCallback((toolId: string, idx: number, patch: Partial<{ itemId: string; count: number }>) => {
    setTools(prev => {
      const tool = prev[toolId]
      if (!tool) return prev
      const recipe = [...tool.recipe]
      recipe[idx] = { ...recipe[idx], ...patch }
      return { ...prev, [toolId]: { ...tool, recipe } }
    })
    setDirty(true)
  }, [])

  const addIngredient = useCallback((toolId: string) => {
    setTools(prev => {
      const tool = prev[toolId]
      if (!tool) return prev
      return { ...prev, [toolId]: { ...tool, recipe: [...tool.recipe, { itemId: 'raw_mana_shard', count: 1 }] } }
    })
    setDirty(true)
  }, [])

  const removeIngredient = useCallback((toolId: string, idx: number) => {
    setTools(prev => {
      const tool = prev[toolId]
      if (!tool) return prev
      return { ...prev, [toolId]: { ...tool, recipe: tool.recipe.filter((_, i) => i !== idx) } }
    })
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools }),
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
  }, [tools, onDeploy])

  return (
    <EditorShell
      title="Tools"
      subtitle="Gathering tools — durability, bonuses, crafting recipes"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* Left panel — tools grouped by skill */}
        <div className="w-56 shrink-0 space-y-3">
          {(['forestry', 'prospecting', 'rinning'] as const).map(skill => (
            <div key={skill}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[8px] font-display px-1.5 py-0.5 rounded"
                  style={{ background: `${SKILL_COLORS[skill]}20`, color: SKILL_COLORS[skill] }}
                >{SKILL_TOOL_NAMES[skill]}</span>
              </div>
              <div className="space-y-1">
                {bySkill[skill]?.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedId(tool.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-all text-xs border ${
                      selectedId === tool.id
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'hover:bg-white/5 border-transparent text-white/60'
                    }`}
                  >
                    <span className="flex-1 truncate font-display">{tool.name}</span>
                    <span
                      className="text-[8px] px-1 rounded"
                      style={{ background: `${TIER_COLORS[tool.tier]}20`, color: TIER_COLORS[tool.tier] }}
                    >T{tool.tier}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — tool detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="space-y-5">
              {/* Header */}
              <div>
                <h2 className="font-display text-lg text-white/90">{selected.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[8px] font-display px-1.5 py-0.5 rounded"
                    style={{ background: `${SKILL_COLORS[selected.skillId]}20`, color: SKILL_COLORS[selected.skillId] }}
                  >{SKILL_TOOL_NAMES[selected.skillId]}</span>
                  <span
                    className="text-[8px] px-1 rounded"
                    style={{ background: `${TIER_COLORS[selected.tier]}20`, color: TIER_COLORS[selected.tier] }}
                  >Tier {selected.tier}</span>
                  <span className="text-[9px] text-white/30">{selected.id}</span>
                </div>
              </div>

              {/* Tier select */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/40 uppercase tracking-wider">Tier</label>
                {([1, 2, 3] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => updateTool(selected.id, { tier: t })}
                    className="text-[10px] px-2 py-1 rounded border transition-all"
                    style={{
                      background: selected.tier === t ? `${TIER_COLORS[t]}20` : 'transparent',
                      borderColor: selected.tier === t ? `${TIER_COLORS[t]}60` : 'rgba(255,255,255,0.1)',
                      color: selected.tier === t ? TIER_COLORS[t] : 'rgba(255,255,255,0.4)',
                    }}
                  >{t}</button>
                ))}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Durability</label>
                  <input
                    type="number" min={1}
                    value={selected.durability}
                    onChange={e => updateTool(selected.id, { durability: parseInt(e.target.value) || 1 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-white/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                  <span className="text-[8px] text-white/20 mt-1 block">uses before breaking</span>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">XP Bonus</label>
                  <input
                    type="number" min={1} max={3} step={0.05}
                    value={selected.xpBonus}
                    onChange={e => updateTool(selected.id, { xpBonus: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-green-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                  <span className="text-[8px] text-white/20 mt-1 block">+{((selected.xpBonus - 1) * 100).toFixed(0)}% XP</span>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Speed Bonus</label>
                  <input
                    type="number" min={0.5} max={1} step={0.05}
                    value={selected.speedBonus}
                    onChange={e => updateTool(selected.id, { speedBonus: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-cyan-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                  <span className="text-[8px] text-white/20 mt-1 block">{((1 - selected.speedBonus) * 100).toFixed(0)}% faster</span>
                </div>
              </div>

              {/* Crafting recipe */}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Crafting Recipe ({selected.recipe.length} {selected.recipe.length === 1 ? 'material' : 'materials'})
                </div>

                {selected.recipe.length > 0 && (
                  <div className="grid grid-cols-[1fr_80px_30px] gap-2 px-2 mb-1">
                    <span className="text-[9px] text-white/30 uppercase">Item</span>
                    <span className="text-[9px] text-white/30 uppercase">Count</span>
                    <span />
                  </div>
                )}

                <div className="space-y-1">
                  {selected.recipe.map((ingredient, i) => {
                    const itemDef = ITEMS.find(it => it.id === ingredient.itemId)
                    return (
                      <div key={i} className="grid grid-cols-[1fr_80px_30px] gap-2 items-center px-2 py-1.5 rounded bg-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 shrink-0">
                            {itemDef && <ItemIcon itemId={ingredient.itemId} scale={1} />}
                          </div>
                          <select
                            value={ingredient.itemId}
                            onChange={e => updateRecipeItem(selected.id, i, { itemId: e.target.value })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 flex-1 min-w-0"
                          >
                            {RECIPE_ITEMS.map(item => (
                              <option key={item.id} value={item.id} style={{ background: '#1a1a2e' }}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="number" min={1} max={99}
                          value={ingredient.count}
                          onChange={e => updateRecipeItem(selected.id, i, { count: parseInt(e.target.value) || 1 })}
                          className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 w-full tabular-nums"
                        />
                        <button
                          onClick={() => removeIngredient(selected.id, i)}
                          className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                        >x</button>
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={() => addIngredient(selected.id)}
                  className="mt-2 text-[10px] text-violet-400/70 hover:text-violet-400 border border-dashed border-violet-500/20 hover:border-violet-500/40 rounded px-3 py-1.5 transition-all"
                >+ Add Material</button>
              </div>

              {/* Summary */}
              <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
                Total materials: {selected.recipe.reduce((s, r) => s + r.count, 0)} items |
                XP boost: +{((selected.xpBonus - 1) * 100).toFixed(0)}% |
                Speed: {((1 - selected.speedBonus) * 100).toFixed(0)}% faster
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-white/20 text-sm font-display">Select a tool to edit</p>
            </div>
          )}
        </div>
      </div>
    </EditorShell>
  )
}
