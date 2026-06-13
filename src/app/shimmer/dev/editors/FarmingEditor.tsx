'use client'

import { useState, useCallback, useMemo } from 'react'
import EditorShell from '../templates/EditorShell'
import ItemIcon from '../../components/ItemIcon'
import { CROP_DEFS, CROP_IDS, type CropDef } from '../../engine/farming'
import { ITEMS } from '../../sprites/items'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const TIER_COLORS: Record<number, string> = {
  1: '#a0a0a0',
  2: '#4ade80',
  3: '#60a5fa',
  4: '#c084fc',
}

const TIER_LABELS = ['', 'Beginner', 'Intermediate', 'Advanced', 'Master']

const YIELD_ITEMS = ITEMS.filter(i => i.type === 'resource' || i.type === 'consumable')
const SEED_ITEMS = ITEMS.filter(i => i.type === 'crop_seed')

function deepCloneCrops(): Record<string, CropDef> {
  const clone: Record<string, CropDef> = {}
  for (const [k, v] of Object.entries(CROP_DEFS)) {
    clone[k] = { ...v, yields: v.yields.map(y => ({ ...y })) }
  }
  return clone
}

export default function FarmingEditor({ onDeploy, deployState }: Props) {
  const [crops, setCrops] = useState<Record<string, CropDef>>(deepCloneCrops)
  const [selectedId, setSelectedId] = useState<string>(CROP_IDS[0] ?? '')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const cropList = useMemo(() =>
    Object.values(crops).sort((a, b) => a.tier - b.tier || a.minFarmingLevel - b.minFarmingLevel),
    [crops]
  )

  const selected = crops[selectedId] ?? null

  const tiers = useMemo(() => {
    const groups: Record<number, CropDef[]> = { 1: [], 2: [], 3: [], 4: [] }
    for (const c of cropList) groups[c.tier]?.push(c)
    return groups
  }, [cropList])

  const updateCrop = useCallback((id: string, patch: Partial<CropDef>) => {
    setCrops(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setDirty(true)
  }, [])

  const updateYield = useCallback((cropId: string, idx: number, patch: Partial<{ itemId: string; count: number; chance: number }>) => {
    setCrops(prev => {
      const crop = prev[cropId]
      if (!crop) return prev
      const yields = [...crop.yields]
      yields[idx] = { ...yields[idx], ...patch }
      return { ...prev, [cropId]: { ...crop, yields } }
    })
    setDirty(true)
  }, [])

  const addYield = useCallback((cropId: string) => {
    setCrops(prev => {
      const crop = prev[cropId]
      if (!crop) return prev
      return { ...prev, [cropId]: { ...crop, yields: [...crop.yields, { itemId: 'raw_mana_shard', count: 1, chance: 1.0 }] } }
    })
    setDirty(true)
  }, [])

  const removeYield = useCallback((cropId: string, idx: number) => {
    setCrops(prev => {
      const crop = prev[cropId]
      if (!crop) return prev
      return { ...prev, [cropId]: { ...crop, yields: crop.yields.filter((_, i) => i !== idx) } }
    })
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farming: crops }),
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
  }, [crops, onDeploy])

  return (
    <EditorShell
      title="Farming"
      subtitle="Crop definitions, growth times, harvest yields"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* Left panel — crop list grouped by tier */}
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
                {tiers[tier]?.map(crop => (
                  <button
                    key={crop.id}
                    onClick={() => setSelectedId(crop.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-all text-xs border ${
                      selectedId === crop.id
                        ? 'bg-green-500/15 border-green-500/40 text-green-300'
                        : 'hover:bg-white/5 border-transparent text-white/60'
                    }`}
                  >
                    <div className="w-4 h-4 shrink-0"><ItemIcon itemId={crop.seedItemId} scale={1} /></div>
                    <span className="flex-1 truncate font-display">{crop.name}</span>
                    <span className="text-[8px] text-white/25 tabular-nums">Lv{crop.minFarmingLevel}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — crop detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8"><ItemIcon itemId={selected.seedItemId} scale={2} /></div>
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
                    onClick={() => updateCrop(selected.id, { tier: t })}
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
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Min Level</label>
                  <input
                    type="number" min={1} max={99}
                    value={selected.minFarmingLevel}
                    onChange={e => updateCrop(selected.id, { minFarmingLevel: parseInt(e.target.value) || 1 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-white/80 outline-none focus:border-green-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Mana Cost</label>
                  <input
                    type="number" min={0}
                    value={selected.manaCost}
                    onChange={e => updateCrop(selected.id, { manaCost: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-blue-400/80 outline-none focus:border-green-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Growth Time</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={1} max={120}
                      value={Math.round(selected.growthMs / 60000)}
                      onChange={e => updateCrop(selected.id, { growthMs: (parseInt(e.target.value) || 1) * 60000 })}
                      className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-white/80 outline-none focus:border-green-500/50 tabular-nums"
                    />
                    <span className="text-[9px] text-white/30 shrink-0">min</span>
                  </div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Plant XP</label>
                  <input
                    type="number" min={0}
                    value={selected.plantXp}
                    onChange={e => updateCrop(selected.id, { plantXp: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-green-400/80 outline-none focus:border-green-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Harvest XP</label>
                  <input
                    type="number" min={0}
                    value={selected.xpGrant}
                    onChange={e => updateCrop(selected.id, { xpGrant: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-green-400/80 outline-none focus:border-green-500/50 tabular-nums"
                  />
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Yield Bonus/Lvl</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={100} step={1}
                      value={Math.round(selected.yieldBonusPerLevel * 100)}
                      onChange={e => updateCrop(selected.id, { yieldBonusPerLevel: (parseInt(e.target.value) || 0) / 100 })}
                      className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-amber-400/80 outline-none focus:border-green-500/50 tabular-nums"
                    />
                    <span className="text-[9px] text-white/30 shrink-0">%</span>
                  </div>
                </div>
              </div>

              {/* Seed item */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Seed Item</label>
                <select
                  value={selected.seedItemId}
                  onChange={e => updateCrop(selected.id, { seedItemId: e.target.value })}
                  className="bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 outline-none focus:border-green-500/50 w-full max-w-xs"
                >
                  {SEED_ITEMS.map(item => (
                    <option key={item.id} value={item.id} style={{ background: '#1a1a2e' }}>{item.name}</option>
                  ))}
                </select>
              </div>

              {/* Harvest yields */}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Harvest Yields ({selected.yields.length} {selected.yields.length === 1 ? 'drop' : 'drops'})
                </div>

                {selected.yields.length > 0 && (
                  <div className="grid grid-cols-[1fr_80px_90px_30px] gap-2 px-2 mb-1">
                    <span className="text-[9px] text-white/30 uppercase">Item</span>
                    <span className="text-[9px] text-white/30 uppercase">Count</span>
                    <span className="text-[9px] text-white/30 uppercase">Chance</span>
                    <span />
                  </div>
                )}

                <div className="space-y-1">
                  {selected.yields.map((y, i) => {
                    const itemDef = ITEMS.find(it => it.id === y.itemId)
                    return (
                      <div key={i} className="grid grid-cols-[1fr_80px_90px_30px] gap-2 items-center px-2 py-1.5 rounded bg-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 shrink-0">
                            {itemDef && <ItemIcon itemId={y.itemId} scale={1} />}
                          </div>
                          <select
                            value={y.itemId}
                            onChange={e => updateYield(selected.id, i, { itemId: e.target.value })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-green-500/50 flex-1 min-w-0"
                          >
                            {YIELD_ITEMS.map(item => (
                              <option key={item.id} value={item.id} style={{ background: '#1a1a2e' }}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="number" min={1} max={99}
                          value={y.count}
                          onChange={e => updateYield(selected.id, i, { count: parseInt(e.target.value) || 1 })}
                          className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-green-500/50 w-full tabular-nums"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} max={100} step={1}
                            value={Math.round(y.chance * 100)}
                            onChange={e => updateYield(selected.id, i, { chance: Math.min(1, Math.max(0, (parseInt(e.target.value) || 0) / 100)) })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-green-500/50 w-full tabular-nums"
                          />
                          <span className="text-[8px] text-white/25">%</span>
                        </div>
                        <button
                          onClick={() => removeYield(selected.id, i)}
                          className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                        >x</button>
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={() => addYield(selected.id)}
                  className="mt-2 text-[10px] text-green-400/70 hover:text-green-400 border border-dashed border-green-500/20 hover:border-green-500/40 rounded px-3 py-1.5 transition-all"
                >+ Add Drop</button>
              </div>

              {/* Growth timeline */}
              <div className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
                <p className="text-[9px] text-white/40 font-display uppercase tracking-wider mb-3">Growth Timeline</p>
                <div className="flex items-center gap-1">
                  {['Seed', 'Sprout', 'Growing', 'Ready'].map((label, i) => {
                    const mins = Math.round((selected.growthMs / 60000) * (i + 1) / 4)
                    return (
                      <div key={label} className="flex-1 text-center">
                        <div className={`h-2 rounded-full mb-1 ${
                          i === 3 ? 'bg-green-500/40' : i === 2 ? 'bg-green-500/25' : i === 1 ? 'bg-green-500/15' : 'bg-white/10'
                        }`} />
                        <p className="text-[8px] font-display text-white/40">{label}</p>
                        <p className="text-[7px] text-white/20">{mins}m</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
                Total yields: {selected.yields.reduce((s, y) => s + y.count, 0)} items |
                XP/mana: {selected.manaCost > 0 ? ((selected.xpGrant + selected.plantXp) / selected.manaCost).toFixed(1) : '--'} |
                Yield bonus: +{Math.round(selected.yieldBonusPerLevel * 100)}% per level above {selected.minFarmingLevel}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-white/20 text-sm font-display">Select a crop to edit</p>
            </div>
          )}
        </div>
      </div>
    </EditorShell>
  )
}
