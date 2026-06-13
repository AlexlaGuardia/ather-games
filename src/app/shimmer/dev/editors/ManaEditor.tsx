'use client'

import React, { useState, useCallback, useMemo } from 'react'
import EditorShell from '../templates/EditorShell'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

interface ManaLevel {
  pool: number
  regen: number
}

interface ExtractionThreshold {
  level: number
  multiplier: number
}

interface PerkUnlock {
  id: string
  label: string
  level: number
}

interface ManaConfig {
  table: ManaLevel[]  // levels 1-10 (index 0 = level 1)
  postCurve: {
    poolBase: number; poolScale: number; poolDecay: number
    regenBase: number; regenScale: number; regenDecay: number
  }
  extraction: ExtractionThreshold[]
  perks: PerkUnlock[]
}

const DEFAULT_CONFIG: ManaConfig = {
  table: [
    { pool: 100, regen: 1.0 },
    { pool: 110, regen: 1.1 },
    { pool: 120, regen: 1.2 },
    { pool: 135, regen: 1.3 },
    { pool: 150, regen: 1.5 },
    { pool: 160, regen: 1.6 },
    { pool: 175, regen: 1.8 },
    { pool: 185, regen: 1.9 },
    { pool: 192, regen: 1.9 },
    { pool: 200, regen: 2.0 },
  ],
  postCurve: {
    poolBase: 200, poolScale: 100, poolDecay: 35,
    regenBase: 2.0, regenScale: 1.5, regenDecay: 35,
  },
  extraction: [
    { level: 3, multiplier: 1.1 },
    { level: 6, multiplier: 1.2 },
    { level: 9, multiplier: 1.3 },
  ],
  perks: [
    { id: 'faster_extraction', label: 'Faster Extraction', level: 3 },
    { id: 'dual_tend', label: 'Dual Tend', level: 5 },
    { id: 'node_sense', label: 'Node Sense', level: 7 },
    { id: 'mana_pulse', label: 'Mana Pulse', level: 9 },
    { id: 'mana_surplus', label: 'Mana Surplus', level: 10 },
  ],
}

function calcPostPool(level: number, cfg: ManaConfig['postCurve']): number {
  return Math.floor(cfg.poolBase + cfg.poolScale * (1 - Math.exp(-(level - 10) / cfg.poolDecay)))
}

function calcPostRegen(level: number, cfg: ManaConfig['postCurve']): number {
  return +(cfg.regenBase + cfg.regenScale * (1 - Math.exp(-(level - 10) / cfg.regenDecay))).toFixed(2)
}

export default function ManaEditor({ onDeploy, deployState }: Props) {
  const [config, setConfig] = useState<ManaConfig>(() => JSON.parse(JSON.stringify(DEFAULT_CONFIG)))
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const updateTable = useCallback((idx: number, patch: Partial<ManaLevel>) => {
    setConfig(prev => {
      const table = prev.table.map((t, i) => i === idx ? { ...t, ...patch } : t)
      return { ...prev, table }
    })
    setDirty(true)
  }, [])

  const updateCurve = useCallback((patch: Partial<ManaConfig['postCurve']>) => {
    setConfig(prev => ({ ...prev, postCurve: { ...prev.postCurve, ...patch } }))
    setDirty(true)
  }, [])

  const updateExtraction = useCallback((idx: number, patch: Partial<ExtractionThreshold>) => {
    setConfig(prev => {
      const extraction = prev.extraction.map((e, i) => i === idx ? { ...e, ...patch } : e)
      return { ...prev, extraction }
    })
    setDirty(true)
  }, [])

  const updatePerk = useCallback((idx: number, level: number) => {
    setConfig(prev => {
      const perks = prev.perks.map((p, i) => i === idx ? { ...p, level } : p)
      return { ...prev, perks }
    })
    setDirty(true)
  }, [])

  // Generate curve preview data (levels 1-50)
  const curveData = useMemo(() => {
    const points: { level: number; pool: number; regen: number }[] = []
    for (let lvl = 1; lvl <= 50; lvl++) {
      if (lvl <= 10) {
        const t = config.table[lvl - 1]
        points.push({ level: lvl, pool: t.pool, regen: t.regen })
      } else {
        points.push({
          level: lvl,
          pool: calcPostPool(lvl, config.postCurve),
          regen: calcPostRegen(lvl, config.postCurve),
        })
      }
    }
    return points
  }, [config.table, config.postCurve])

  const maxPool = Math.max(...curveData.map(d => d.pool))
  const maxRegen = Math.max(...curveData.map(d => d.regen))

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mana: config }),
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
  }, [config, onDeploy])

  return (
    <EditorShell
      title="Mana System"
      subtitle="Pool/regen progression, extraction speed, perk unlocks"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="space-y-8">
        {/* Progression curve preview */}
        <div className="space-y-2">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">Progression Curve (Level 1–50)</h3>
          <div className="relative h-32 bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden">
            {/* Pool line */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 128" preserveAspectRatio="none">
              <polyline
                fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.7"
                points={curveData.map((d, i) => `${(i / 49) * 500},${128 - (d.pool / maxPool) * 120}`).join(' ')}
              />
              <polyline
                fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.7"
                points={curveData.map((d, i) => `${(i / 49) * 500},${128 - (d.regen / maxRegen) * 120}`).join(' ')}
              />
              {/* Level 10 divider */}
              <line x1={`${(9 / 49) * 500}`} y1="0" x2={`${(9 / 49) * 500}`} y2="128" stroke="white" strokeWidth="0.5" opacity="0.15" strokeDasharray="4,4" />
            </svg>
            {/* Labels */}
            <div className="absolute top-1 right-2 flex gap-3">
              <span className="text-[9px] text-amber-400/60">Pool</span>
              <span className="text-[9px] text-blue-400/60">Regen</span>
            </div>
            <span className="absolute top-1 left-2 text-[8px] text-white/20">Lv 10 ↓</span>
            <span className="absolute bottom-1 left-1 text-[8px] text-white/15">1</span>
            <span className="absolute bottom-1 right-1 text-[8px] text-white/15">50</span>
          </div>
        </div>

        {/* Level 1-10 table */}
        <div className="space-y-2">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">Levels 1–10 (Manual Table)</h3>
          <div className="grid grid-cols-[40px_80px_80px] gap-2 px-3">
            <span className="text-[9px] text-white/30 uppercase">Lvl</span>
            <span className="text-[9px] text-white/30 uppercase">Pool</span>
            <span className="text-[9px] text-white/30 uppercase">Regen/s</span>
          </div>
          <div className="space-y-1">
            {config.table.map((t, i) => (
              <div key={i} className="grid grid-cols-[40px_80px_80px] gap-2 items-center px-3 py-1.5 rounded bg-white/[0.03] border border-white/5">
                <span className="text-xs font-display text-white/50">{i + 1}</span>
                <input
                  type="number" min={10} max={500} value={t.pool}
                  onChange={e => updateTable(i, { pool: parseInt(e.target.value) || 100 })}
                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-amber-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                />
                <input
                  type="number" min={0.1} max={10} step={0.1} value={t.regen}
                  onChange={e => updateTable(i, { regen: parseFloat(e.target.value) || 1 })}
                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-blue-400/80 outline-none focus:border-violet-500/50 tabular-nums"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Post-10 curve parameters */}
        <div className="space-y-3">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">Post-10 Curve Parameters</h3>
          <p className="text-[10px] text-white/20">Pool = base + scale * (1 - e^(-(level-10)/decay)) | Same formula for regen</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 p-3 rounded bg-white/[0.02] border border-white/5">
              <span className="text-[9px] text-amber-400/60 uppercase">Pool Curve</span>
              {([['poolBase', 'Base', config.postCurve.poolBase], ['poolScale', 'Scale', config.postCurve.poolScale], ['poolDecay', 'Decay', config.postCurve.poolDecay]] as const).map(([key, label, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-12">{label}</span>
                  <input
                    type="number" step={key === 'poolDecay' ? 1 : 10} value={val}
                    onChange={e => updateCurve({ [key]: parseFloat(e.target.value) || 0 })}
                    className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-amber-400/80 outline-none focus:border-violet-500/50 w-20 tabular-nums"
                  />
                </div>
              ))}
              <span className="text-[9px] text-white/20">Lv50: {calcPostPool(50, config.postCurve)} | Lv99: {calcPostPool(99, config.postCurve)}</span>
            </div>
            <div className="space-y-2 p-3 rounded bg-white/[0.02] border border-white/5">
              <span className="text-[9px] text-blue-400/60 uppercase">Regen Curve</span>
              {([['regenBase', 'Base', config.postCurve.regenBase], ['regenScale', 'Scale', config.postCurve.regenScale], ['regenDecay', 'Decay', config.postCurve.regenDecay]] as const).map(([key, label, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-12">{label}</span>
                  <input
                    type="number" step={key === 'regenDecay' ? 1 : 0.1} value={val}
                    onChange={e => updateCurve({ [key]: parseFloat(e.target.value) || 0 })}
                    className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-blue-400/80 outline-none focus:border-violet-500/50 w-20 tabular-nums"
                  />
                </div>
              ))}
              <span className="text-[9px] text-white/20">Lv50: {calcPostRegen(50, config.postCurve)}/s | Lv99: {calcPostRegen(99, config.postCurve)}/s</span>
            </div>
          </div>
        </div>

        {/* Extraction speed */}
        <div className="space-y-3">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">Extraction Speed</h3>
          {config.extraction.map((e, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-white/40">Level</span>
              <input
                type="number" min={1} max={99} value={e.level}
                onChange={ev => updateExtraction(i, { level: parseInt(ev.target.value) || 1 })}
                className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-green-400/80 outline-none focus:border-violet-500/50 w-16 tabular-nums"
              />
              <span className="text-[10px] text-white/40">→</span>
              <input
                type="number" min={1} max={3} step={0.05} value={e.multiplier}
                onChange={ev => updateExtraction(i, { multiplier: parseFloat(ev.target.value) || 1 })}
                className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-amber-400/80 outline-none focus:border-violet-500/50 w-16 tabular-nums"
              />
              <span className="text-[10px] text-white/30">x speed</span>
            </div>
          ))}
        </div>

        {/* Perk unlocks */}
        <div className="space-y-3">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">Perk Unlocks</h3>
          {config.perks.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded bg-white/[0.03] border border-white/5">
              <span className="text-sm font-display text-white/70 w-40">{p.label}</span>
              <span className="text-[9px] text-white/20 w-32">{p.id}</span>
              <span className="text-[10px] text-white/40">Lv</span>
              <input
                type="number" min={1} max={99} value={p.level}
                onChange={e => updatePerk(i, parseInt(e.target.value) || 1)}
                className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-violet-400/80 outline-none focus:border-violet-500/50 w-16 tabular-nums"
              />
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
          Pool: {config.table[0].pool}–{config.table[9].pool} (Lv1–10) → {calcPostPool(99, config.postCurve)} (Lv99) |
          Regen: {config.table[0].regen}–{config.table[9].regen}/s → {calcPostRegen(99, config.postCurve)}/s |
          {config.perks.length} perks | {config.extraction.length} speed tiers
        </div>
      </div>
    </EditorShell>
  )
}
