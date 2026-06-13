'use client'

import { useState, useMemo, useCallback } from 'react'
import EditorShell from '../templates/EditorShell'
import ItemIcon from '../../components/ItemIcon'
import { GE_BASE_OVERRIDES, deriveDefaultBase, TAX_RATE } from '../../engine/exchange'
import { ITEMS, type ItemRarity } from '../../sprites/items'

interface GEEditorProps {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const RARITY_COLORS: Record<ItemRarity, string> = {
  common: 'text-gray-300',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  legendary: 'text-purple-400',
}

const RARITY_DOT: Record<ItemRarity, string> = {
  common: 'bg-gray-400',
  uncommon: 'bg-green-400',
  rare: 'bg-blue-400',
  legendary: 'bg-purple-400',
}

const TRADEABLE = ITEMS.filter(i => i.tradeable)

export default function GEEditor({ onDeploy, deployState }: GEEditorProps) {
  const [overrides, setOverrides] = useState<Record<string, number>>(() => ({ ...GE_BASE_OVERRIDES }))
  const [selectedId, setSelectedId] = useState(TRADEABLE[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [filterRarity, setFilterRarity] = useState<ItemRarity | 'all'>('all')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Compute effective config for an item using current overrides
  const getConfig = useCallback((itemId: string) => {
    const item = ITEMS.find(i => i.id === itemId)
    if (!item) return { basePrice: 0, minPrice: 0, maxPrice: 0, volatility: 0.1 }
    const base = overrides[itemId] ?? deriveDefaultBase(item)
    return {
      basePrice: base,
      minPrice: Math.max(1, Math.floor(base * 0.4)),
      maxPrice: Math.ceil(base * 3.0),
      volatility: item.rarity === 'legendary' ? 0.3
        : item.rarity === 'rare' ? 0.2
        : item.rarity === 'uncommon' ? 0.15
        : 0.1,
    }
  }, [overrides])

  const filtered = useMemo(() =>
    TRADEABLE.filter(i => {
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterRarity !== 'all' && i.rarity !== filterRarity) return false
      return true
    }),
    [search, filterRarity]
  )

  const selected = TRADEABLE.find(i => i.id === selectedId)
  const selectedConfig = selected ? getConfig(selected.id) : null
  const selectedDefault = selected ? deriveDefaultBase(selected) : 0
  const hasOverride = selectedId in overrides

  // Aggregate stats
  const stats = useMemo(() => {
    const byRarity: Record<string, number> = {}
    let totalBase = 0
    for (const item of TRADEABLE) {
      byRarity[item.rarity] = (byRarity[item.rarity] ?? 0) + 1
      totalBase += getConfig(item.id).basePrice
    }
    return { total: TRADEABLE.length, byRarity, avgPrice: Math.round(totalBase / (TRADEABLE.length || 1)) }
  }, [getConfig])

  const setBasePrice = useCallback((itemId: string, value: number) => {
    setOverrides(prev => ({ ...prev, [itemId]: Math.max(1, value) }))
    setDirty(true)
  }, [])

  const resetItem = useCallback((itemId: string) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geOverrides: overrides }),
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
  }, [overrides, onDeploy])

  return (
    <EditorShell
      title="Ather Exchange"
      subtitle="Market prices, bands, and balancing"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="flex gap-6">
        {/* Left — item list */}
        <div className="w-[280px] flex-shrink-0 space-y-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-[10px] text-text font-display placeholder-text-faint/20 focus:outline-none focus:border-gold/30"
          />
          <div className="flex gap-1">
            {(['all', 'common', 'uncommon', 'rare', 'legendary'] as const).map(r => (
              <button
                key={r}
                onClick={() => setFilterRarity(r)}
                className={`text-[8px] font-display px-2 py-0.5 rounded border transition-colors ${
                  filterRarity === r
                    ? 'bg-white/10 border-gold/30 text-gold'
                    : 'border-white/5 text-text-faint/30 hover:text-text-faint/50'
                }`}
              >{r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}</button>
            ))}
          </div>
          <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map(item => {
              const cfg = getConfig(item.id)
              const isOverridden = item.id in overrides
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left px-3 py-2 rounded border text-[10px] font-display transition-all flex items-center gap-2 ${
                    selectedId === item.id
                      ? 'bg-white/10 border-gold/30 text-gold'
                      : 'bg-white/[0.02] border-white/5 text-text-faint hover:text-text-dim hover:bg-white/5'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${RARITY_DOT[item.rarity]}`} />
                  <div className="w-4 h-4 flex-shrink-0">
                    <ItemIcon itemId={item.id} scale={1} />
                  </div>
                  <span className="flex-1 truncate">{item.name}</span>
                  {isOverridden && <span className="text-[7px] text-violet-400/60">*</span>}
                  <span className="text-[8px] text-[#d4a843]/40">{cfg.basePrice}m</span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-text-faint/20 text-[10px] font-display text-center py-4">No matching items</p>
            )}
          </div>
        </div>

        {/* Right — selected item config */}
        <div className="flex-1 space-y-4">
          {selected && selectedConfig ? (
            <>
              <div className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8">
                    <ItemIcon itemId={selected.id} scale={2} />
                  </div>
                  <div>
                    <h2 className={`font-display text-lg ${RARITY_COLORS[selected.rarity]}`}>{selected.name}</h2>
                    <p className="text-[9px] text-text-faint/40">{selected.type} &middot; {selected.rarity}</p>
                  </div>
                </div>

                <p className="text-[10px] text-text-faint/40 mb-4">{selected.description}</p>

                {/* Editable base price */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/[0.02] rounded p-2 border border-white/5">
                    <p className="text-[8px] text-text-faint/30 uppercase tracking-wider mb-1">GE Base Price</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={selectedConfig.basePrice}
                        onChange={e => setBasePrice(selected.id, parseInt(e.target.value) || 1)}
                        className="w-20 bg-transparent border border-white/10 rounded px-2 py-1 text-[14px] font-display text-[#d4a843] outline-none focus:border-violet-500/50 tabular-nums"
                      />
                      {hasOverride && (
                        <button
                          onClick={() => resetItem(selected.id)}
                          className="text-[8px] text-violet-400/60 hover:text-violet-400 border border-violet-500/20 rounded px-1.5 py-0.5 transition-colors"
                        >Reset</button>
                      )}
                    </div>
                    <p className="text-[8px] text-text-faint/20 mt-1">
                      Auto: {selectedDefault}m{selected.buyPrice ? ` (shop ${selected.buyPrice}m × 0.7)` : ''}
                    </p>
                  </div>
                  <div className="bg-white/[0.02] rounded p-2 border border-white/5">
                    <p className="text-[8px] text-text-faint/30 uppercase tracking-wider">Volatility</p>
                    <p className="text-[14px] font-display text-amber-400">{(selectedConfig.volatility * 100).toFixed(0)}%</p>
                    <p className="text-[8px] text-text-faint/20 mt-1">Set by rarity</p>
                  </div>
                  <div className="bg-white/[0.02] rounded p-2 border border-white/5">
                    <p className="text-[8px] text-text-faint/30 uppercase tracking-wider">Min Price</p>
                    <p className="text-[14px] font-display text-red-400/70">{selectedConfig.minPrice} marks</p>
                  </div>
                  <div className="bg-white/[0.02] rounded p-2 border border-white/5">
                    <p className="text-[8px] text-text-faint/30 uppercase tracking-wider">Max Price</p>
                    <p className="text-[14px] font-display text-green-400/70">{selectedConfig.maxPrice} marks</p>
                  </div>
                </div>

                {/* Price band visualization */}
                <div className="mb-3">
                  <p className="text-[9px] text-text-faint/40 font-display uppercase tracking-wider mb-2">Price Band</p>
                  <div className="relative h-6 bg-white/5 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 bg-white/10 rounded-full"
                      style={{
                        left: `${(selectedConfig.minPrice / selectedConfig.maxPrice) * 100}%`,
                        right: '0%',
                      }}
                    />
                    {/* Base price marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#d4a843]"
                      style={{ left: `${(selectedConfig.basePrice / selectedConfig.maxPrice) * 100}%` }}
                    />
                    {/* Shop price marker (if exists) */}
                    {selected.buyPrice && selected.buyPrice <= selectedConfig.maxPrice && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-400/50"
                        style={{ left: `${(selected.buyPrice / selectedConfig.maxPrice) * 100}%` }}
                        title={`Shop: ${selected.buyPrice}m`}
                      />
                    )}
                    <span className="absolute left-1 top-0.5 text-[7px] text-red-400/50 font-display">{selectedConfig.minPrice}</span>
                    <span className="absolute right-1 top-0.5 text-[7px] text-green-400/50 font-display">{selectedConfig.maxPrice}</span>
                  </div>
                  {selected.buyPrice && (
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[8px] text-text-faint/30">
                        <span className="w-2 h-0.5 bg-[#d4a843] inline-block" /> GE base
                      </span>
                      <span className="flex items-center gap-1 text-[8px] text-text-faint/30">
                        <span className="w-2 h-0.5 bg-red-400/50 inline-block" /> Shop ({selected.buyPrice}m)
                      </span>
                    </div>
                  )}
                </div>

                {/* Item economics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/[0.02] rounded p-2 border border-white/5 text-center">
                    <p className="text-[7px] text-text-faint/30 uppercase">Shop Buy</p>
                    <p className="text-[11px] font-display text-text-faint/60">{selected.buyPrice ?? '—'}</p>
                  </div>
                  <div className="bg-white/[0.02] rounded p-2 border border-white/5 text-center">
                    <p className="text-[7px] text-text-faint/30 uppercase">Vendor Sell</p>
                    <p className="text-[11px] font-display text-text-faint/60">{selected.sellPrice ?? '—'}</p>
                  </div>
                  <div className="bg-white/[0.02] rounded p-2 border border-white/5 text-center">
                    <p className="text-[7px] text-text-faint/30 uppercase">Tax ({Math.round(TAX_RATE * 100)}%)</p>
                    <p className="text-[11px] font-display text-red-400/60">{Math.ceil(selectedConfig.basePrice * TAX_RATE)}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white/[0.03] rounded-lg p-6 border border-white/5 text-center">
              <p className="text-text-faint/20 text-[11px] font-display">Select an item to edit exchange config</p>
            </div>
          )}

          {/* Market stats */}
          <div className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
            <p className="text-[9px] text-text-faint/40 font-display uppercase tracking-wider mb-3">Market Overview</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <p className="text-[14px] font-display text-text">{stats.total}</p>
                <p className="text-[7px] text-text-faint/30 uppercase">Items</p>
              </div>
              {(['common', 'uncommon', 'rare', 'legendary'] as const).map(r => (
                <div key={r} className="text-center">
                  <p className={`text-[14px] font-display ${RARITY_COLORS[r]}`}>{stats.byRarity[r] ?? 0}</p>
                  <p className="text-[7px] text-text-faint/30 uppercase">{r}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 text-center">
              <p className="text-[10px] font-display text-[#d4a843]/50">Avg base price: {stats.avgPrice} marks</p>
              {Object.keys(overrides).length > 0 && (
                <p className="text-[9px] text-violet-400/40 mt-1">{Object.keys(overrides).length} custom overrides</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </EditorShell>
  )
}
