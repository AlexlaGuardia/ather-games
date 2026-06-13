'use client'

import { useState, useMemo, useCallback } from 'react'
import { ITEMS, type ItemRarity, type ItemType } from '../sprites/items'
import { type Inventory, countItem } from '../engine/inventory'
import { type GEMarketState, GE_CONFIGS, getMarketPrice, getPriceHistory, TAX_RATE } from '../engine/exchange'
import ItemIcon from './ItemIcon'

const RARITY_DOT: Record<ItemRarity, string> = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  legendary: '#c084fc',
}

const SORT_OPTIONS = [
  { id: 'name', label: 'Name' },
  { id: 'price-asc', label: 'Price ↑' },
  { id: 'price-desc', label: 'Price ↓' },
  { id: 'trending', label: 'Hot' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['id']

// Tiny SVG sparkline from price history
function Sparkline({ data, width = 40, height = 12 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${x},${y}`
  }).join(' ')

  const trending = data[data.length - 1] >= data[0]
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={trending ? '#4ade80' : '#f87171'} strokeWidth={1.2} />
    </svg>
  )
}

interface ExchangePanelProps {
  ge: GEMarketState
  inv: Inventory
  marks: number
  onBuy: (itemId: string, qty: number) => void
  onSell: (itemId: string, qty: number) => void
}

export default function ExchangePanel({ ge, inv, marks, onBuy, onSell }: ExchangePanelProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [filterRarity, setFilterRarity] = useState<ItemRarity | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('name')
  const [tradeFeedback, setTradeFeedback] = useState<{ msg: string; type: 'buy' | 'sell' } | null>(null)

  const tradeableItems = useMemo(() => ITEMS.filter(i => i.tradeable), [])

  const filtered = useMemo(() => {
    let items = tradeableItems
    if (mode === 'sell') {
      items = items.filter(i => countItem(inv, i.id) > 0)
    }
    if (filterRarity !== 'all') {
      items = items.filter(i => i.rarity === filterRarity)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(q))
    }
    // Sort
    const sorted = [...items]
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'price-asc':
        sorted.sort((a, b) => getMarketPrice(ge, a.id) - getMarketPrice(ge, b.id))
        break
      case 'price-desc':
        sorted.sort((a, b) => getMarketPrice(ge, b.id) - getMarketPrice(ge, a.id))
        break
      case 'trending': {
        // Sort by biggest % deviation from base (most volatile first)
        sorted.sort((a, b) => {
          const cfgA = GE_CONFIGS[a.id], cfgB = GE_CONFIGS[b.id]
          if (!cfgA || !cfgB) return 0
          const devA = Math.abs(getMarketPrice(ge, a.id) - cfgA.basePrice) / cfgA.basePrice
          const devB = Math.abs(getMarketPrice(ge, b.id) - cfgB.basePrice) / cfgB.basePrice
          return devB - devA
        })
        break
      }
    }
    return sorted
  }, [tradeableItems, mode, inv, search, filterRarity, sort, ge])

  // Reset qty and selection when switching modes
  const switchMode = (m: 'buy' | 'sell') => {
    setMode(m)
    setSelectedId(null)
    setQty(1)
  }

  const selectItem = (id: string) => {
    setSelectedId(selectedId === id ? null : id)
    setQty(1)
  }

  // Selected item details
  const selected = selectedId ? ITEMS.find(i => i.id === selectedId) : null
  const selectedPrice = selectedId ? getMarketPrice(ge, selectedId) : 0
  const selectedOwned = selectedId ? countItem(inv, selectedId) : 0
  const selectedCfg = selectedId ? GE_CONFIGS[selectedId] : null

  // Max qty calculations
  const maxBuy = selectedPrice > 0 ? Math.min(99, Math.floor(marks / selectedPrice)) : 0
  const maxSell = selectedOwned

  // Trade preview
  const totalCost = selectedPrice * qty
  const grossSell = Math.floor(selectedPrice * qty)
  const taxAmount = Math.ceil(grossSell * TAX_RATE)
  const netSell = grossSell - taxAmount

  const canExecute = mode === 'buy'
    ? qty > 0 && marks >= totalCost
    : qty > 0 && selectedOwned >= qty

  const executeTrade = useCallback(() => {
    if (!selected) return
    if (mode === 'buy') {
      onBuy(selected.id, qty)
      setTradeFeedback({ msg: `Bought ${qty}x ${selected.name}`, type: 'buy' })
    } else {
      onSell(selected.id, qty)
      setTradeFeedback({ msg: `Sold ${qty}x ${selected.name}`, type: 'sell' })
    }
    setQty(1)
    setTimeout(() => setTradeFeedback(null), 2000)
  }, [selected, mode, qty, onBuy, onSell])

  // Price % from base
  const priceVsBase = selectedCfg
    ? Math.round(((selectedPrice - selectedCfg.basePrice) / selectedCfg.basePrice) * 100)
    : 0

  return (
    <div className="space-y-2">
      {/* Trade feedback toast */}
      {tradeFeedback && (
        <div className={`text-center text-[10px] font-display py-1.5 rounded-lg border animate-pulse ${
          tradeFeedback.type === 'buy'
            ? 'bg-[#d4a843]/10 border-[#d4a843]/20 text-[#d4a843]'
            : 'bg-[#40d060]/10 border-[#40d060]/20 text-[#40d060]'
        }`}>
          {tradeFeedback.msg}
        </div>
      )}

      {/* Buy / Sell tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => switchMode('buy')}
          className={`flex-1 text-[10px] font-display py-1.5 rounded-lg transition-colors ${mode === 'buy' ? 'bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/30' : 'text-white/30 border border-[#d4a843]/10'}`}
        >Buy</button>
        <button
          onClick={() => switchMode('sell')}
          className={`flex-1 text-[10px] font-display py-1.5 rounded-lg transition-colors ${mode === 'sell' ? 'bg-[#40d060]/20 text-[#40d060] border border-[#40d060]/30' : 'text-white/30 border border-[#d4a843]/10'}`}
        >Sell</button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search items..."
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white placeholder-white/20 outline-none focus:border-violet-500/40"
      />

      {/* Rarity filter + sort */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-0.5">
          {(['all', 'common', 'uncommon', 'rare', 'legendary'] as const).map(r => (
            <button
              key={r}
              onClick={() => setFilterRarity(r)}
              className={`text-[7px] font-display px-1.5 py-0.5 rounded border transition-colors ${
                filterRarity === r
                  ? 'bg-white/10 border-white/20 text-white/80'
                  : 'border-transparent text-white/20 hover:text-white/40'
              }`}
            >
              {r === 'all' ? 'All' : (
                <span className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full" style={{ background: RARITY_DOT[r] }} />
                  {r.charAt(0).toUpperCase()}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5">
          {SORT_OPTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`text-[7px] font-display px-1 py-0.5 rounded transition-colors ${
                sort === s.id ? 'text-violet-300 bg-violet-500/10' : 'text-white/15 hover:text-white/30'
              }`}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* Tax note */}
      <p className="text-[9px] text-white/15">5% tax on sales · {filtered.length} items</p>

      {/* Item list */}
      <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-white/20 text-[10px] font-display text-center py-6">
            {mode === 'sell' ? 'No tradeable items in inventory' : 'No items match'}
          </p>
        )}
        {filtered.map(item => {
          const price = getMarketPrice(ge, item.id)
          const cfg = GE_CONFIGS[item.id]
          const history = getPriceHistory(ge, item.id)
          const active = selectedId === item.id
          const owned = countItem(inv, item.id)

          // Trend: compare to base price
          let trend: 'up' | 'down' | 'flat' = 'flat'
          if (cfg && price > cfg.basePrice * 1.02) trend = 'up'
          else if (cfg && price < cfg.basePrice * 0.98) trend = 'down'

          // % deviation from base
          const pctDev = cfg ? Math.round(((price - cfg.basePrice) / cfg.basePrice) * 100) : 0

          return (
            <button
              key={item.id}
              onClick={() => selectItem(item.id)}
              className={`w-full rounded-lg p-2 border flex items-center gap-2 text-left transition-all ${
                active
                  ? 'bg-violet-500/10 border-violet-500/30'
                  : 'bg-white/[0.02] border-[#d4a843]/10 hover:bg-white/[0.05]'
              }`}
            >
              <div className="w-6 h-6 shrink-0"><ItemIcon itemId={item.id} scale={1.5} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RARITY_DOT[item.rarity] }} />
                  <span className="text-[10px] font-display text-white/80 truncate">{item.name}</span>
                  {owned > 0 && (
                    <span className="text-[8px] text-white/25">x{owned}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] text-[#d4a843]/70 tabular-nums">{price}m</span>
                  <span className={`text-[8px] ${trend === 'up' ? 'text-red-400/60' : trend === 'down' ? 'text-green-400/60' : 'text-white/15'}`}>
                    {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
                  </span>
                  {pctDev !== 0 && (
                    <span className={`text-[7px] tabular-nums ${pctDev > 0 ? 'text-red-400/40' : 'text-green-400/40'}`}>
                      {pctDev > 0 ? '+' : ''}{pctDev}%
                    </span>
                  )}
                  <Sparkline data={history} />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected item detail / trade panel */}
      {selected && selectedCfg && (
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8"><ItemIcon itemId={selected.id} scale={2} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-display text-white/90">{selected.name}</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: RARITY_DOT[selected.rarity] }} />
              </div>
              <div className="text-[8px] text-white/30">
                {selectedPrice}m ea · base {selectedCfg.basePrice}m
                {priceVsBase !== 0 && (
                  <span className={priceVsBase > 0 ? 'text-red-400/50' : 'text-green-400/50'}>
                    {' '}({priceVsBase > 0 ? '+' : ''}{priceVsBase}%)
                  </span>
                )}
              </div>
            </div>
            {selectedOwned > 0 && (
              <div className="text-right">
                <div className="text-[8px] text-white/20">Owned</div>
                <div className="text-[10px] font-display text-white/50 tabular-nums">{selectedOwned}</div>
              </div>
            )}
          </div>

          {/* Price range bar */}
          <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 rounded-full"
              style={{
                left: `${(selectedCfg.minPrice / selectedCfg.maxPrice) * 100}%`,
                right: '0%',
                background: 'linear-gradient(90deg, rgba(248,113,113,0.15), rgba(74,222,128,0.15))',
              }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#d4a843]/60"
              style={{ left: `${(selectedCfg.basePrice / selectedCfg.maxPrice) * 100}%` }}
              title={`Base: ${selectedCfg.basePrice}m`}
            />
            <div
              className="absolute top-0 bottom-0 w-1 bg-white/60 rounded-full"
              style={{ left: `${Math.min(100, (selectedPrice / selectedCfg.maxPrice) * 100)}%` }}
              title={`Current: ${selectedPrice}m`}
            />
          </div>
          <div className="flex justify-between text-[7px] text-white/15 -mt-1.5">
            <span>{selectedCfg.minPrice}m</span>
            <span>{selectedCfg.maxPrice}m</span>
          </div>

          {/* Quantity picker */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/40">Qty</span>
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="text-[10px] text-white/40 hover:text-white/70 border border-white/10 rounded w-5 h-5 flex items-center justify-center"
            >−</button>
            <input
              type="number"
              min={1}
              max={mode === 'buy' ? maxBuy : maxSell}
              value={qty}
              onChange={e => { const max = mode === 'buy' ? maxBuy : maxSell; setQty(Math.min(max, Math.max(1, parseInt(e.target.value) || 1))) }}
              className="w-12 bg-transparent border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/80 text-center outline-none focus:border-violet-500/40 tabular-nums"
            />
            <button
              onClick={() => setQty(Math.min(mode === 'buy' ? maxBuy : maxSell, qty + 1))}
              className="text-[10px] text-white/40 hover:text-white/70 border border-white/10 rounded w-5 h-5 flex items-center justify-center"
            >+</button>
            {[1, 5, 10].map(n => (
              <button
                key={n}
                onClick={() => setQty(Math.min(n, mode === 'buy' ? maxBuy : maxSell))}
                className={`text-[8px] px-1.5 py-0.5 rounded border transition-colors ${
                  qty === n ? 'border-violet-500/40 text-violet-300 bg-violet-500/10' : 'border-white/10 text-white/30 hover:text-white/50'
                }`}
              >{n}</button>
            ))}
            <button
              onClick={() => setQty(mode === 'buy' ? maxBuy : maxSell)}
              className="text-[8px] px-1.5 py-0.5 rounded border border-white/10 text-white/30 hover:text-white/50 transition-colors"
            >All</button>
          </div>

          {/* Total preview + execute */}
          <div className="flex items-center justify-between">
            <div className="text-[9px] text-white/50">
              {mode === 'buy' ? (
                <span>Total: <span className="text-[#d4a843] tabular-nums">{totalCost} marks</span></span>
              ) : (
                <span>
                  Earn: <span className="text-[#40d060] tabular-nums">{netSell} marks</span>
                  <span className="text-white/20 ml-1">({taxAmount} tax)</span>
                </span>
              )}
            </div>
            <button
              onClick={executeTrade}
              disabled={!canExecute}
              className={`text-[9px] font-display px-3 py-1.5 rounded border transition-colors ${
                mode === 'buy'
                  ? 'border-[#d4a843]/30 text-[#d4a843]/80 hover:text-[#d4a843] hover:border-[#d4a843]/50 hover:bg-[#d4a843]/5'
                  : 'border-[#40d060]/30 text-[#40d060]/80 hover:text-[#40d060] hover:border-[#40d060]/50 hover:bg-[#40d060]/5'
              } disabled:opacity-20 disabled:cursor-not-allowed`}
            >
              {mode === 'buy' ? `Buy ${qty}` : `Sell ${qty}`}
            </button>
          </div>
        </div>
      )}

      {/* Footer: wallet */}
      <div className="text-center text-[10px] text-[#d4a843]/50 font-display pt-1 border-t border-[#d4a843]/15">
        {marks} marks
      </div>
    </div>
  )
}
