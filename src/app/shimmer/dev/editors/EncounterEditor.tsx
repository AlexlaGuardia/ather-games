'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import EditorShell from '../templates/EditorShell'
import { ZONES } from '../../world/zones'
import { ENCOUNTER_TABLES, type ZoneEncounters, type EncounterEntry } from '../../engine/encounters'
import { ALL_SPECIES, LAUNCHED_SPECIES } from '../../engine/spirit-index'
import type { Species, Element } from '../../spirits/spirit'
import type { AITier } from '../../engine/battle-ai'
import { useInspector } from '../templates/inspector-context'

const ALL_ELEMENTS: Element[] = ['base', 'mana', 'storm', 'earth', 'water']
const AI_TIERS: AITier[] = ['wild', 'trained', 'champion']

const TIER_COLORS: Record<AITier, string> = {
  wild: '#60c0e0',
  trained: '#e0a040',
  champion: '#e04060',
}

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

function deepCloneTables(): Record<string, ZoneEncounters> {
  const clone: Record<string, ZoneEncounters> = {}
  for (const [k, v] of Object.entries(ENCOUNTER_TABLES)) {
    clone[k] = {
      rate: v.rate,
      aiTier: v.aiTier,
      entries: v.entries.map(e => ({ ...e, levelRange: [...e.levelRange] as [number, number] })),
    }
  }
  return clone
}

export default function EncounterEditor({ onDeploy, deployState }: Props) {
  const [tables, setTables] = useState<Record<string, ZoneEncounters>>(deepCloneTables)
  const [selectedZone, setSelectedZone] = useState<string>(ZONES[0]?.id ?? 'garden')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const zoneIds = useMemo(() => ZONES.map(z => z.id), [])

  const current = tables[selectedZone]
  const { setInspectorContent, setInspectorTitle } = useInspector()

  // Push zone summary to inspector
  useEffect(() => {
    setInspectorTitle('Zone Summary')
    if (!current) {
      setInspectorContent(null)
      return
    }
    const totalWeight = current.entries.reduce((s, e) => s + e.weight, 0)
    const unlaunchedCount = current.entries.filter(e => !LAUNCHED_SPECIES.includes(e.species)).length
    setInspectorContent(
      <div className="p-3 space-y-3">
        <div>
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Zone</span>
          <div className="text-sm font-display text-white/80">{selectedZone.replace(/-/g, ' ')}</div>
        </div>
        <div className="flex gap-4">
          <div>
            <span className="text-[9px] text-white/40 block">Rate</span>
            <span className="text-xs text-white/70 tabular-nums">{current.rate.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[9px] text-white/40 block">AI Tier</span>
            <span className="text-xs" style={{ color: TIER_COLORS[current.aiTier] }}>{current.aiTier}</span>
          </div>
        </div>
        <div>
          <span className="text-[9px] text-white/40 block">Species</span>
          <span className="text-xs text-white/60">{current.entries.length} entries, weight {totalWeight}</span>
        </div>
        {current.entries.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] text-white/30 uppercase">Distribution</span>
            {current.entries.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className={`text-white/60 ${!LAUNCHED_SPECIES.includes(e.species) ? 'line-through text-red-400/40' : ''}`}>
                  {e.species}
                </span>
                <span className="text-white/30 tabular-nums">{totalWeight > 0 ? Math.round(e.weight / totalWeight * 100) : 0}%</span>
              </div>
            ))}
          </div>
        )}
        {unlaunchedCount > 0 && (
          <div className="text-[10px] text-red-400/50 pt-2 border-t border-white/5">
            {unlaunchedCount} unlaunched (won't spawn)
          </div>
        )}
        <div className="text-[10px] text-white/25 pt-2 border-t border-white/5">
          ~{Math.round(current.rate * 100)} encounters per 100 steps
        </div>
      </div>
    )
  }, [selectedZone, current, setInspectorContent, setInspectorTitle])

  // Update helpers
  const updateZone = useCallback((zoneId: string, patch: Partial<ZoneEncounters>) => {
    setTables(prev => ({
      ...prev,
      [zoneId]: { ...prev[zoneId], ...patch },
    }))
    setDirty(true)
  }, [])

  const updateEntry = useCallback((zoneId: string, idx: number, patch: Partial<EncounterEntry>) => {
    setTables(prev => {
      const zone = prev[zoneId]
      if (!zone) return prev
      const entries = [...zone.entries]
      entries[idx] = { ...entries[idx], ...patch }
      return { ...prev, [zoneId]: { ...zone, entries } }
    })
    setDirty(true)
  }, [])

  const addEntry = useCallback((zoneId: string) => {
    setTables(prev => {
      const zone = prev[zoneId]
      if (!zone) return prev
      const newEntry: EncounterEntry = { species: 'fox' as Species, weight: 3, levelRange: [0, 2] }
      return { ...prev, [zoneId]: { ...zone, entries: [...zone.entries, newEntry] } }
    })
    setDirty(true)
  }, [])

  const removeEntry = useCallback((zoneId: string, idx: number) => {
    setTables(prev => {
      const zone = prev[zoneId]
      if (!zone) return prev
      return { ...prev, [zoneId]: { ...zone, entries: zone.entries.filter((_, i) => i !== idx) } }
    })
    setDirty(true)
  }, [])

  const enableZone = useCallback((zoneId: string) => {
    setTables(prev => ({
      ...prev,
      [zoneId]: { rate: 0.05, aiTier: 'wild', entries: [] },
    }))
    setDirty(true)
  }, [])

  // Save to source
  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounters: tables }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaveStatus('saved')
      setDirty(false)
      setTimeout(() => setSaveStatus(null), 2000)
      if (onDeploy) onDeploy()
    } catch (err) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }, [tables, onDeploy])

  return (
    <EditorShell
      title="Encounters"
      subtitle="Wild encounter tables per zone"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* Left panel — zone list */}
        <div className="w-56 shrink-0 space-y-1">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Zones</div>
          {zoneIds.map(id => {
            const zone = tables[id]
            const active = id === selectedZone
            return (
              <button
                key={id}
                onClick={() => setSelectedZone(id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-left transition-all text-xs ${
                  active
                    ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                    : 'hover:bg-white/5 border border-transparent text-white/60'
                }`}
              >
                <span className="truncate">{id.replace(/-/g, ' ')}</span>
                <span className="flex items-center gap-1.5 shrink-0 ml-2">
                  {zone ? (
                    <>
                      <span className="text-[9px] text-white/30 tabular-nums">{zone.rate.toFixed(2)}</span>
                      <span
                        className="text-[8px] px-1 py-0.5 rounded"
                        style={{ background: `${TIER_COLORS[zone.aiTier]}20`, color: TIER_COLORS[zone.aiTier] }}
                      >
                        {zone.aiTier}
                      </span>
                    </>
                  ) : (
                    <span className="text-[9px] text-white/20">none</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right panel — zone detail */}
        <div className="flex-1 min-w-0">
          {current ? (
            <div className="space-y-6">
              {/* Zone header */}
              <div className="flex items-center gap-4">
                <h2 className="font-display text-lg text-white/80">{selectedZone.replace(/-/g, ' ')}</h2>
                {current.rate === 0 && (
                  <span className="text-[10px] text-green-400/60 bg-green-400/10 px-2 py-0.5 rounded">safe zone</span>
                )}
              </div>

              {/* Rate + AI Tier row */}
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">Rate</label>
                  <input
                    type="range"
                    min={0}
                    max={0.20}
                    step={0.01}
                    value={current.rate}
                    onChange={e => updateZone(selectedZone, { rate: parseFloat(e.target.value) })}
                    className="w-32 accent-violet-500"
                  />
                  <span className="text-xs text-white/70 tabular-nums w-10">{current.rate.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">AI Tier</label>
                  {AI_TIERS.map(tier => (
                    <button
                      key={tier}
                      onClick={() => updateZone(selectedZone, { aiTier: tier })}
                      className="text-[10px] px-2 py-1 rounded border transition-all"
                      style={{
                        background: current.aiTier === tier ? `${TIER_COLORS[tier]}20` : 'transparent',
                        borderColor: current.aiTier === tier ? `${TIER_COLORS[tier]}60` : 'rgba(255,255,255,0.1)',
                        color: current.aiTier === tier ? TIER_COLORS[tier] : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              {/* Species table */}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Species Pool ({current.entries.length} {current.entries.length === 1 ? 'entry' : 'entries'})
                </div>

                {/* Header row */}
                {current.entries.length > 0 && (
                  <div className="grid grid-cols-[1fr_60px_80px_80px_90px_30px] gap-2 px-2 mb-1">
                    <span className="text-[9px] text-white/30 uppercase">Species</span>
                    <span className="text-[9px] text-white/30 uppercase">Weight</span>
                    <span className="text-[9px] text-white/30 uppercase">Lvl Min</span>
                    <span className="text-[9px] text-white/30 uppercase">Lvl Max</span>
                    <span className="text-[9px] text-white/30 uppercase">Element</span>
                    <span />
                  </div>
                )}

                {/* Entry rows */}
                <div className="space-y-1">
                  {current.entries.map((entry, i) => {
                    const launched = LAUNCHED_SPECIES.includes(entry.species)
                    return (
                      <div
                        key={i}
                        className={`grid grid-cols-[1fr_60px_80px_80px_90px_30px] gap-2 items-center px-2 py-1.5 rounded ${
                          launched ? 'bg-white/5' : 'bg-red-500/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <select
                            value={entry.species}
                            onChange={e => updateEntry(selectedZone, i, { species: e.target.value as Species })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 w-full"
                          >
                            {ALL_SPECIES.map(s => (
                              <option key={s} value={s} style={{ background: '#1a1a2e' }}>
                                {s}{LAUNCHED_SPECIES.includes(s) ? '' : ' *'}
                              </option>
                            ))}
                          </select>
                          {!launched && (
                            <span className="text-[8px] text-red-400/60 shrink-0">unlaunched</span>
                          )}
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={entry.weight}
                          onChange={e => updateEntry(selectedZone, i, { weight: parseInt(e.target.value) || 1 })}
                          className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 w-full tabular-nums"
                        />
                        <input
                          type="number"
                          min={-5}
                          max={10}
                          value={entry.levelRange[0]}
                          onChange={e => updateEntry(selectedZone, i, { levelRange: [parseInt(e.target.value) || 0, entry.levelRange[1]] })}
                          className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 w-full tabular-nums"
                        />
                        <input
                          type="number"
                          min={-5}
                          max={10}
                          value={entry.levelRange[1]}
                          onChange={e => updateEntry(selectedZone, i, { levelRange: [entry.levelRange[0], parseInt(e.target.value) || 0] })}
                          className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 w-full tabular-nums"
                        />
                        <select
                          value={entry.element ?? 'base'}
                          onChange={e => {
                            const val = e.target.value as Element
                            updateEntry(selectedZone, i, val === 'base' ? { element: undefined } : { element: val })
                          }}
                          className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 w-full"
                        >
                          {ALL_ELEMENTS.map(el => (
                            <option key={el} value={el} style={{ background: '#1a1a2e' }}>{el}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeEntry(selectedZone, i)}
                          className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                        >
                          x
                        </button>
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={() => addEntry(selectedZone)}
                  className="mt-2 text-[10px] text-violet-400/70 hover:text-violet-400 border border-dashed border-violet-500/20 hover:border-violet-500/40 rounded px-3 py-1.5 transition-all"
                >
                  + Add Species
                </button>
              </div>

              {/* Summary stats */}
              <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
                Total weight: {current.entries.reduce((s, e) => s + e.weight, 0)} |
                Avg encounters per 100 steps: ~{Math.round(current.rate * 100)} |
                {current.entries.filter(e => !LAUNCHED_SPECIES.includes(e.species)).length > 0 && (
                  <span className="text-red-400/50 ml-2">
                    {current.entries.filter(e => !LAUNCHED_SPECIES.includes(e.species)).length} unlaunched species (won't spawn)
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <p className="text-white/30 text-sm">No encounter table for this zone</p>
              <button
                onClick={() => enableZone(selectedZone)}
                className="text-xs text-violet-400 border border-violet-500/30 hover:bg-violet-500/10 rounded px-4 py-2 transition-all"
              >
                Enable Encounters
              </button>
            </div>
          )}
        </div>
      </div>
    </EditorShell>
  )
}
