'use client'

import { useState, useCallback, useMemo } from 'react'
import EditorShell from '../templates/EditorShell'
import ItemIcon from '../../components/ItemIcon'
import { POTION_DEFS, type PotionDef } from '../../engine/alchemy'
import { ITEMS } from '../../sprites/items'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const TIER_COLORS: Record<number, string> = {
  1: '#60c0e0',
  2: '#e0a040',
  3: '#c070e0',
  4: '#e04060',
}

const TIER_LABELS = ['', 'Beginner', 'Intermediate', 'Advanced', 'Master']

// Items valid as recipe ingredients (resources + consumables)
const INGREDIENT_ITEMS = ITEMS.filter(i => i.type === 'resource' || i.type === 'consumable' || i.type === 'crop_seed')

function deepClonePotions(): Record<string, PotionDef> {
  const clone: Record<string, PotionDef> = {}
  for (const [k, v] of Object.entries(POTION_DEFS)) {
    clone[k] = {
      ...v,
      recipe: v.recipe.map(r => ({ ...r })),
    }
  }
  return clone
}

export default function AlchemyEditor({ onDeploy, deployState }: Props) {
  const [potions, setPotions] = useState<Record<string, PotionDef>>(deepClonePotions)
  const [selectedId, setSelectedId] = useState<string>(Object.keys(POTION_DEFS)[0] ?? '')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const potionList = useMemo(() =>
    Object.values(potions).sort((a, b) => a.tier - b.tier || a.minAlchemyLevel - b.minAlchemyLevel),
    [potions]
  )

  const selected = potions[selectedId] ?? null

  // Group by tier for the left panel
  const tiers = useMemo(() => {
    const groups: Record<number, PotionDef[]> = { 1: [], 2: [], 3: [], 4: [] }
    for (const p of potionList) groups[p.tier]?.push(p)
    return groups
  }, [potionList])

  const updatePotion = useCallback((id: string, patch: Partial<PotionDef>) => {
    setPotions(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setDirty(true)
  }, [])

  const updateRecipeItem = useCallback((potionId: string, idx: number, patch: Partial<{ itemId: string; count: number }>) => {
    setPotions(prev => {
      const potion = prev[potionId]
      if (!potion) return prev
      const recipe = [...potion.recipe]
      recipe[idx] = { ...recipe[idx], ...patch }
      return { ...prev, [potionId]: { ...potion, recipe } }
    })
    setDirty(true)
  }, [])

  const addIngredient = useCallback((potionId: string) => {
    setPotions(prev => {
      const potion = prev[potionId]
      if (!potion) return prev
      return { ...prev, [potionId]: { ...potion, recipe: [...potion.recipe, { itemId: 'raw_mana_shard', count: 1 }] } }
    })
    setDirty(true)
  }, [])

  const removeIngredient = useCallback((potionId: string, idx: number) => {
    setPotions(prev => {
      const potion = prev[potionId]
      if (!potion) return prev
      return { ...prev, [potionId]: { ...potion, recipe: potion.recipe.filter((_, i) => i !== idx) } }
    })
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alchemy: potions }),
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
  }, [potions, onDeploy])

  return (
    <EditorShell
      title="Alchemy"
      subtitle="Potion recipes, costs, and XP balancing"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* Left panel — recipe list grouped by tier */}
        <div className="w-60 shrink-0 space-y-3">
          {([1, 2, 3, 4] as const).map(tier => (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[8px] font-display px-1.5 py-0.5 rounded"
                  style={{ background: `${TIER_COLORS[tier]}20`, color: TIER_COLORS[tier] }}
                >T{tier}</span>
                <span className="text-[9px] text-white/25 uppercase tracking-wider">{TIER_LABELS[tier]}</span>
              </div>
              <div className="space-y-1">
                {tiers[tier]?.map(potion => (
                  <button
                    key={potion.id}
                    onClick={() => setSelectedId(potion.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-all text-xs border ${
                      selectedId === potion.id
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'hover:bg-white/5 border-transparent text-white/60'
                    }`}
                  >
                    <div className="w-4 h-4 shrink-0"><ItemIcon itemId={potion.id} scale={1} /></div>
                    <span className="flex-1 truncate font-display">{potion.name}</span>
                    <span className="text-[8px] text-white/25 tabular-nums">Lv{potion.minAlchemyLevel}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — recipe detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8"><ItemIcon itemId={selected.id} scale={2} /></div>
                <div>
                  <h2 className="font-display text-lg text-white/90">{selected.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-[8px] font-display px-1.5 py-0.5 rounded"
                      style={{ background: `${TIER_COLORS[selected.tier]}20`, color: TIER_COLORS[selected.tier] }}
                    >Tier {selected.tier}</span>
                    <span className="text-[9px] text-white/30">{selected.id}</span>
                  </div>
                </div>
              </div>

              {/* Tier select */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/40 uppercase tracking-wider">Tier</label>
                {([1, 2, 3, 4] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => updatePotion(selected.id, { tier: t })}
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
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Min Level</label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={selected.minAlchemyLevel}
                    onChange={e => updatePotion(selected.id, { minAlchemyLevel: parseInt(e.target.value) || 1 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-white/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Mana Cost</label>
                  <input
                    type="number"
                    min={0}
                    value={selected.manaCost}
                    onChange={e => updatePotion(selected.id, { manaCost: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-blue-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">XP Grant</label>
                  <input
                    type="number"
                    min={0}
                    value={selected.xpGrant}
                    onChange={e => updatePotion(selected.id, { xpGrant: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-green-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Result Qty</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={selected.resultCount}
                    onChange={e => updatePotion(selected.id, { resultCount: parseInt(e.target.value) || 1 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-[#d4a843]/80 outline-none focus:border-violet-500/50 tabular-nums"
                  />
                </div>
              </div>

              {/* Recipe ingredients */}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Recipe ({selected.recipe.length} {selected.recipe.length === 1 ? 'ingredient' : 'ingredients'})
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
                            {INGREDIENT_ITEMS.map(item => (
                              <option key={item.id} value={item.id} style={{ background: '#1a1a2e' }}>
                                {item.name} ({item.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={99}
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
                >+ Add Ingredient</button>
              </div>

              {/* Summary */}
              <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
                Total ingredients: {selected.recipe.reduce((s, r) => s + r.count, 0)} items |
                XP/mana ratio: {selected.manaCost > 0 ? (selected.xpGrant / selected.manaCost).toFixed(1) : '—'}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-white/20 text-sm font-display">Select a potion to edit</p>
            </div>
          )}
        </div>
      </div>
    </EditorShell>
  )
}
