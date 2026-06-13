'use client'

import React, { useState, useCallback } from 'react'
import EditorShell from '../templates/EditorShell'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

interface PhaseConfig {
  id: string
  label: string
  start: number      // fraction 0-1
  color: string       // ambient overlay hex
  alpha: number       // ambient overlay opacity
}

interface CycleConfig {
  cycleMins: number
  phases: PhaseConfig[]
  midnight: number    // fraction 0-1
  respawnTriggers: { id: string; label: string; threshold: number }[]
}

const DEFAULT_CONFIG: CycleConfig = {
  cycleMins: 30,
  phases: [
    { id: 'dawn',  label: 'Dawn',  start: 0,       color: '#ff9940', alpha: 0.18 },
    { id: 'day',   label: 'Day',   start: 3 / 30,  color: '#000000', alpha: 0 },
    { id: 'dusk',  label: 'Dusk',  start: 23 / 30, color: '#6030a0', alpha: 0.12 },
    { id: 'night', label: 'Night', start: 26 / 30, color: '#101838', alpha: 0.25 },
  ],
  midnight: 28 / 30,
  respawnTriggers: [
    { id: 'forestry',    label: 'Forestry',    threshold: 0 },
    { id: 'prospecting', label: 'Prospecting', threshold: 23 / 30 },
    { id: 'rinning',     label: 'Rinning',     threshold: 28 / 30 },
  ],
}

const PHASE_COLORS: Record<string, string> = {
  dawn: '#ff9940', day: '#fbbf24', dusk: '#8b5cf6', night: '#1e3a5f',
}

function fracToMin(frac: number, cycleMins: number): string {
  const m = frac * cycleMins
  return m.toFixed(1)
}

function minToFrac(min: number, cycleMins: number): number {
  return Math.max(0, Math.min(1, min / cycleMins))
}

export default function DayCycleEditor({ onDeploy, deployState }: Props) {
  const [config, setConfig] = useState<CycleConfig>(() => JSON.parse(JSON.stringify(DEFAULT_CONFIG)))
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const updatePhase = useCallback((idx: number, patch: Partial<PhaseConfig>) => {
    setConfig(prev => {
      const phases = prev.phases.map((p, i) => i === idx ? { ...p, ...patch } : p)
      return { ...prev, phases }
    })
    setDirty(true)
  }, [])

  const updateTrigger = useCallback((idx: number, threshold: number) => {
    setConfig(prev => {
      const respawnTriggers = prev.respawnTriggers.map((t, i) => i === idx ? { ...t, threshold } : t)
      return { ...prev, respawnTriggers }
    })
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayCycle: config }),
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

  const { phases, cycleMins, midnight, respawnTriggers } = config

  return (
    <EditorShell
      title="Day/Night Cycle"
      subtitle="Phase timing, ambient lighting, respawn triggers"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="space-y-8">
        {/* Timeline visualization */}
        <div className="space-y-2">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">Timeline</h3>
          <div className="relative h-12 rounded-lg overflow-hidden border border-white/10">
            {phases.map((phase, i) => {
              const nextStart = i < phases.length - 1 ? phases[i + 1].start : 1
              const width = (nextStart - phase.start) * 100
              return (
                <div
                  key={phase.id}
                  className="absolute top-0 h-full flex items-center justify-center"
                  style={{
                    left: `${phase.start * 100}%`,
                    width: `${width}%`,
                    background: PHASE_COLORS[phase.id] ?? '#333',
                    opacity: 0.7,
                  }}
                >
                  <span className="text-[10px] font-display text-white drop-shadow-md">
                    {phase.label} ({(width).toFixed(0)}%)
                  </span>
                </div>
              )
            })}
            {/* Midnight marker */}
            <div
              className="absolute top-0 h-full w-px bg-white/60"
              style={{ left: `${midnight * 100}%` }}
            >
              <span className="absolute -top-5 left-1 text-[8px] text-white/50">midnight</span>
            </div>
            {/* Respawn trigger markers */}
            {respawnTriggers.map(t => (
              <div
                key={t.id}
                className="absolute bottom-0 w-0.5 h-3 bg-green-400/80"
                style={{ left: `${t.threshold * 100}%` }}
                title={`${t.label} respawn`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-white/25 px-1">
            <span>0:00</span>
            <span>{(cycleMins / 4).toFixed(0)}:00</span>
            <span>{(cycleMins / 2).toFixed(0)}:00</span>
            <span>{(cycleMins * 3 / 4).toFixed(0)}:00</span>
            <span>{cycleMins}:00</span>
          </div>
        </div>

        {/* Cycle duration */}
        <div className="flex items-center gap-4">
          <label className="text-[9px] text-white/30 uppercase w-28">Cycle Duration</label>
          <input
            type="number" min={5} max={120} value={cycleMins}
            onChange={e => { setConfig(prev => ({ ...prev, cycleMins: parseInt(e.target.value) || 30 })); setDirty(true) }}
            className="bg-transparent border border-white/10 rounded px-3 py-1.5 text-sm font-display text-amber-400/80 outline-none focus:border-violet-500/50 w-20 tabular-nums"
          />
          <span className="text-[10px] text-white/30">minutes (real time)</span>
        </div>

        {/* Phase configs */}
        <div className="space-y-3">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">Phases</h3>
          <div className="grid grid-cols-[100px_80px_110px_50px_60px] gap-2 px-3">
            <span className="text-[9px] text-white/30 uppercase">Phase</span>
            <span className="text-[9px] text-white/30 uppercase">Start (min)</span>
            <span className="text-[9px] text-white/30 uppercase">Overlay Color</span>
            <span className="text-[9px] text-white/30 uppercase">Alpha</span>
            <span className="text-[9px] text-white/30 uppercase">Preview</span>
          </div>
          {phases.map((phase, i) => (
            <div key={phase.id} className="grid grid-cols-[100px_80px_110px_50px_60px] gap-2 items-center px-3 py-2 rounded bg-white/[0.03] border border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: PHASE_COLORS[phase.id] }} />
                <span className="text-sm font-display text-white/80">{phase.label}</span>
              </div>
              <input
                type="number" min={0} max={cycleMins} step={0.5}
                value={parseFloat(fracToMin(phase.start, cycleMins))}
                onChange={e => updatePhase(i, { start: minToFrac(parseFloat(e.target.value) || 0, cycleMins) })}
                disabled={i === 0}
                className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-green-400/80 outline-none focus:border-violet-500/50 tabular-nums disabled:opacity-30"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color" value={phase.color}
                  onChange={e => updatePhase(i, { color: e.target.value })}
                  className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
                />
                <span className="text-[10px] text-white/40 font-mono">{phase.color}</span>
              </div>
              <input
                type="number" min={0} max={1} step={0.01} value={phase.alpha}
                onChange={e => updatePhase(i, { alpha: parseFloat(e.target.value) || 0 })}
                className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-blue-400/80 outline-none focus:border-violet-500/50 tabular-nums"
              />
              <div
                className="w-10 h-6 rounded border border-white/10"
                style={{ background: phase.color, opacity: phase.alpha || 0.05 }}
                title={`${phase.color} @ ${(phase.alpha * 100).toFixed(0)}%`}
              />
            </div>
          ))}
        </div>

        {/* Midnight */}
        <div className="flex items-center gap-4">
          <label className="text-[9px] text-white/30 uppercase w-28">Midnight At</label>
          <input
            type="number" min={0} max={cycleMins} step={0.5}
            value={parseFloat(fracToMin(midnight, cycleMins))}
            onChange={e => { setConfig(prev => ({ ...prev, midnight: minToFrac(parseFloat(e.target.value) || 0, cycleMins) })); setDirty(true) }}
            className="bg-transparent border border-white/10 rounded px-3 py-1.5 text-sm font-display text-violet-400/80 outline-none focus:border-violet-500/50 w-20 tabular-nums"
          />
          <span className="text-[10px] text-white/30">minutes into cycle</span>
        </div>

        {/* Respawn triggers */}
        <div className="space-y-3">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">Respawn Triggers</h3>
          {respawnTriggers.map((t, i) => (
            <div key={t.id} className="flex items-center gap-4 px-3 py-2 rounded bg-white/[0.03] border border-white/5">
              <span className="text-sm font-display text-white/70 w-28">{t.label}</span>
              <span className="text-[9px] text-white/30">triggers at</span>
              <input
                type="number" min={0} max={cycleMins} step={0.5}
                value={parseFloat(fracToMin(t.threshold, cycleMins))}
                onChange={e => updateTrigger(i, minToFrac(parseFloat(e.target.value) || 0, cycleMins))}
                className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-green-400/80 outline-none focus:border-violet-500/50 w-20 tabular-nums"
              />
              <span className="text-[10px] text-white/30">min</span>
              <span className="text-[10px] text-white/20">
                ({getPhaseAt(t.threshold, phases)})
              </span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
          {cycleMins}min cycle |
          Dawn {fracToMin(phases[1].start - phases[0].start, cycleMins)}min |
          Day {fracToMin(phases[2].start - phases[1].start, cycleMins)}min |
          Dusk {fracToMin(phases[3].start - phases[2].start, cycleMins)}min |
          Night {fracToMin(1 - phases[3].start, cycleMins)}min
        </div>
      </div>
    </EditorShell>
  )
}

function getPhaseAt(frac: number, phases: PhaseConfig[]): string {
  for (let i = phases.length - 1; i >= 0; i--) {
    if (frac >= phases[i].start) return phases[i].label.toLowerCase()
  }
  return 'dawn'
}
