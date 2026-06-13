'use client'

import { useState, useCallback } from 'react'
import EditorShell from '../templates/EditorShell'
import {
  EVOLUTION_THRESHOLDS,
  INFUSION_CAPS,
  STAT_CAPS,
  ELEMENT_STAT_MODS,
  RUNEWORDS,
  AWAKENED_BRANCHES,
  AWAKENED_FORM_NAMES,
  type StatMod,
  type BranchDef,
  type AwakenedNames,
} from '../../spirits/evolution-config'
import type { Species, Element } from '../../spirits/spirit'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const SPECIES: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
const ELEMENTS: Exclude<Element, 'base'>[] = ['mana', 'storm', 'earth', 'water']
const BRANCHES = ['alpha', 'beta', 'gamma', 'delta'] as const
const STATS = ['vig', 'prs', 'agi', 'pwr', 'grd']

const ELEMENT_COLORS: Record<string, string> = {
  mana: '#a78bfa',
  storm: '#fbbf24',
  earth: '#84cc16',
  water: '#38bdf8',
}

const BRANCH_COLORS: Record<string, string> = {
  alpha: '#ef4444',
  beta: '#3b82f6',
  gamma: '#22c55e',
  delta: '#a855f7',
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export default function EvolutionEditor({ onDeploy, deployState }: Props) {
  const [thresholds, setThresholds] = useState({ ...EVOLUTION_THRESHOLDS })
  const [infusionCaps, setInfusionCaps] = useState({ ...INFUSION_CAPS })
  const [statCaps, setStatCaps] = useState({ ...STAT_CAPS })
  const [elementStatMods, setElementStatMods] = useState<Record<string, StatMod[]>>(deepClone(ELEMENT_STAT_MODS))
  const [runewords, setRunewords] = useState<Record<string, Record<string, string>>>(deepClone(RUNEWORDS))
  const [awakenedBranches, setAwakenedBranches] = useState<Record<string, BranchDef>>(deepClone(AWAKENED_BRANCHES))
  const [awakenedFormNames, setAwakenedFormNames] = useState<Record<string, Record<string, AwakenedNames>>>(deepClone(AWAKENED_FORM_NAMES))

  const [selectedSpecies, setSelectedSpecies] = useState<Species>('fox')
  const [selectedElement, setSelectedElement] = useState<Exclude<Element, 'base'>>('mana')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Count filled awakened names
  const filledNames = SPECIES.reduce((sum, sp) =>
    sum + ELEMENTS.reduce((eSum, el) =>
      eSum + BRANCHES.reduce((bSum, b) =>
        bSum + (awakenedFormNames[sp]?.[el]?.[b] ? 1 : 0), 0), 0), 0)

  const updateThreshold = useCallback((key: string, val: number) => {
    setThresholds(prev => ({ ...prev, [key]: val }))
    setDirty(true)
  }, [])

  const updateInfusionCap = useCallback((key: string, val: number) => {
    setInfusionCaps(prev => ({ ...prev, [key]: val }))
    setDirty(true)
  }, [])

  const updateStatCap = useCallback((key: string, val: number) => {
    setStatCaps(prev => ({ ...prev, [key]: val }))
    setDirty(true)
  }, [])

  const updateStatMod = useCallback((el: string, idx: number, patch: Partial<StatMod>) => {
    setElementStatMods(prev => {
      const mods = [...(prev[el] ?? [])]
      mods[idx] = { ...mods[idx], ...patch }
      return { ...prev, [el]: mods }
    })
    setDirty(true)
  }, [])

  const addStatMod = useCallback((el: string) => {
    setElementStatMods(prev => ({
      ...prev,
      [el]: [...(prev[el] ?? []), { stat: 'vig', mod: 1.05 }],
    }))
    setDirty(true)
  }, [])

  const removeStatMod = useCallback((el: string, idx: number) => {
    setElementStatMods(prev => ({
      ...prev,
      [el]: (prev[el] ?? []).filter((_, i) => i !== idx),
    }))
    setDirty(true)
  }, [])

  const updateRuneword = useCallback((sp: string, el: string, val: string) => {
    setRunewords(prev => ({
      ...prev,
      [sp]: { ...(prev[sp] ?? {}), [el]: val },
    }))
    setDirty(true)
  }, [])

  const updateBranch = useCallback((branch: string, patch: Partial<BranchDef>) => {
    setAwakenedBranches(prev => ({
      ...prev,
      [branch]: { ...prev[branch], ...patch },
    }))
    setDirty(true)
  }, [])

  const updateAwakenedName = useCallback((sp: string, el: string, branch: string, val: string) => {
    setAwakenedFormNames(prev => ({
      ...prev,
      [sp]: {
        ...(prev[sp] ?? {}),
        [el]: {
          ...(prev[sp]?.[el] ?? { alpha: null, beta: null, gamma: null, delta: null }),
          [branch]: val || null,
        },
      },
    }))
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evolution: {
            thresholds,
            infusionCaps,
            statCaps,
            elementStatMods,
            runewords,
            awakenedBranches,
            awakenedFormNames,
          },
        }),
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
  }, [thresholds, infusionCaps, statCaps, elementStatMods, runewords, awakenedBranches, awakenedFormNames, onDeploy])

  return (
    <EditorShell
      title="Evolution"
      subtitle={`Spirit evolution config — ${filledNames}/160 awakened names filled`}
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="space-y-8">
        {/* ── Global Config ── */}
        <section>
          <h3 className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Global Config</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Second Form Level</label>
              <input type="number" min={1} max={99} value={thresholds.secondFormLevel}
                onChange={e => updateThreshold('secondFormLevel', parseInt(e.target.value) || 1)}
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-violet-400/80 outline-none focus:border-violet-500/50 tabular-nums" />
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Awakened Level</label>
              <input type="number" min={1} max={100} value={thresholds.awakenedFormLevel}
                onChange={e => updateThreshold('awakenedFormLevel', parseInt(e.target.value) || 1)}
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-violet-400/80 outline-none focus:border-violet-500/50 tabular-nums" />
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Max Level</label>
              <input type="number" min={1} max={200} value={thresholds.maxLevel}
                onChange={e => updateThreshold('maxLevel', parseInt(e.target.value) || 100)}
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-white/80 outline-none focus:border-violet-500/50 tabular-nums" />
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Infusion Cap (Total)</label>
              <input type="number" min={1} max={50} value={infusionCaps.totalCap}
                onChange={e => updateInfusionCap('totalCap', parseInt(e.target.value) || 1)}
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-amber-400/80 outline-none focus:border-violet-500/50 tabular-nums" />
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Per Element Cap</label>
              <input type="number" min={1} max={50} value={infusionCaps.perElementCap}
                onChange={e => updateInfusionCap('perElementCap', parseInt(e.target.value) || 1)}
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-amber-400/80 outline-none focus:border-violet-500/50 tabular-nums" />
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Stat Cap (Base)</label>
              <input type="number" min={1} max={200} value={statCaps.base}
                onChange={e => updateStatCap('base', parseInt(e.target.value) || 50)}
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-white/80 outline-none focus:border-violet-500/50 tabular-nums" />
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Stat Cap (Second)</label>
              <input type="number" min={1} max={200} value={statCaps.second}
                onChange={e => updateStatCap('second', parseInt(e.target.value) || 75)}
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-white/80 outline-none focus:border-violet-500/50 tabular-nums" />
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Stat Cap (Awakened)</label>
              <input type="number" min={1} max={200} value={statCaps.awakened}
                onChange={e => updateStatCap('awakened', parseInt(e.target.value) || 100)}
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display text-white/80 outline-none focus:border-violet-500/50 tabular-nums" />
            </div>
          </div>
        </section>

        {/* ── Element Stat Modifiers ── */}
        <section>
          <h3 className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Element Stat Modifiers</h3>
          <div className="grid grid-cols-4 gap-3">
            {ELEMENTS.map(el => (
              <div key={el} className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: ELEMENT_COLORS[el] }} />
                  <span className="text-[10px] font-display uppercase" style={{ color: ELEMENT_COLORS[el] }}>{el}</span>
                </div>
                <div className="space-y-1.5">
                  {(elementStatMods[el] ?? []).map((mod, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <select value={mod.stat} onChange={e => updateStatMod(el, i, { stat: e.target.value })}
                        className="bg-transparent border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/70 outline-none w-16">
                        {STATS.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s.toUpperCase()}</option>)}
                      </select>
                      <input type="number" min={0.5} max={2.0} step={0.05} value={mod.mod}
                        onChange={e => updateStatMod(el, i, { mod: parseFloat(e.target.value) || 1 })}
                        className="w-16 bg-transparent border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/70 outline-none tabular-nums" />
                      <button onClick={() => removeStatMod(el, i)} className="text-red-400/40 hover:text-red-400 text-[10px]">x</button>
                    </div>
                  ))}
                  <button onClick={() => addStatMod(el)}
                    className="text-[9px] text-violet-400/50 hover:text-violet-400 transition-colors">+ mod</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Awakened Branches ── */}
        <section>
          <h3 className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Awakened Branches</h3>
          <div className="grid grid-cols-4 gap-3">
            {BRANCHES.map(branch => {
              const b = awakenedBranches[branch]
              return (
                <div key={branch} className="bg-white/[0.03] rounded-lg p-3 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: BRANCH_COLORS[branch] }} />
                    <span className="text-[10px] font-display uppercase tracking-wider" style={{ color: BRANCH_COLORS[branch] }}>{branch}</span>
                  </div>
                  <div>
                    <label className="text-[7px] text-white/25 uppercase">Name</label>
                    <input value={b?.name ?? ''} onChange={e => updateBranch(branch, { name: e.target.value })}
                      className="w-full bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/40" />
                  </div>
                  <div>
                    <label className="text-[7px] text-white/25 uppercase">Focus</label>
                    <input value={b?.focus ?? ''} onChange={e => updateBranch(branch, { focus: e.target.value })}
                      className="w-full bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/40" />
                  </div>
                  <div>
                    <label className="text-[7px] text-white/25 uppercase">Prerequisites</label>
                    <input value={b?.prereqSummary ?? ''} onChange={e => updateBranch(branch, { prereqSummary: e.target.value })}
                      className="w-full bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/40" />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Runewords + Awakened Names (per species) ── */}
        <section>
          <h3 className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Runewords & Awakened Forms</h3>
          <div className="flex gap-6">
            {/* Species selector */}
            <div className="w-44 shrink-0 space-y-1">
              <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Species</div>
              {SPECIES.map(sp => {
                const nameCount = ELEMENTS.reduce((sum, el) =>
                  sum + BRANCHES.reduce((bSum, b) =>
                    bSum + (awakenedFormNames[sp]?.[el]?.[b] ? 1 : 0), 0), 0)
                return (
                  <button key={sp} onClick={() => setSelectedSpecies(sp)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded text-left text-xs transition-all border ${
                      selectedSpecies === sp
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'hover:bg-white/5 border-transparent text-white/60'
                    }`}>
                    <span className="capitalize font-display">{sp}</span>
                    <span className="text-[8px] text-white/25 tabular-nums">{nameCount}/16</span>
                  </button>
                )
              })}
            </div>

            {/* Right panel — element tabs + runewords + names */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Element tabs */}
              <div className="flex gap-1">
                {ELEMENTS.map(el => (
                  <button key={el} onClick={() => setSelectedElement(el)}
                    className="px-4 py-2 rounded text-xs font-display transition-all border"
                    style={{
                      background: selectedElement === el ? `${ELEMENT_COLORS[el]}20` : 'transparent',
                      borderColor: selectedElement === el ? `${ELEMENT_COLORS[el]}60` : 'rgba(255,255,255,0.1)',
                      color: selectedElement === el ? ELEMENT_COLORS[el] : 'rgba(255,255,255,0.4)',
                    }}>
                    {el}
                  </button>
                ))}
              </div>

              {/* Runeword for selected species + element */}
              <div className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
                <label className="text-[9px] text-white/40 uppercase tracking-wider block mb-2">
                  Runeword — {selectedSpecies} / {selectedElement}
                </label>
                <input
                  value={runewords[selectedSpecies]?.[selectedElement] ?? ''}
                  onChange={e => updateRuneword(selectedSpecies, selectedElement, e.target.value)}
                  placeholder="Enter runeword..."
                  className="bg-transparent border border-white/10 rounded px-3 py-2 text-lg font-display outline-none focus:border-violet-500/50 w-full max-w-xs"
                  style={{ color: ELEMENT_COLORS[selectedElement] }}
                />
              </div>

              {/* Awakened form names — 4 branches */}
              <div className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
                <label className="text-[9px] text-white/40 uppercase tracking-wider block mb-3">
                  Awakened Forms — {selectedSpecies} / {selectedElement}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {BRANCHES.map(branch => {
                    const branchDef = awakenedBranches[branch]
                    const currentName = awakenedFormNames[selectedSpecies]?.[selectedElement]?.[branch] ?? ''
                    return (
                      <div key={branch} className="bg-white/[0.02] rounded p-3 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: BRANCH_COLORS[branch] }} />
                          <span className="text-[9px] font-display uppercase" style={{ color: BRANCH_COLORS[branch] }}>
                            {branch} — {branchDef?.name ?? ''}
                          </span>
                          <span className="text-[8px] text-white/20 ml-auto">{branchDef?.focus ?? ''}</span>
                        </div>
                        <input
                          value={currentName}
                          onChange={e => updateAwakenedName(selectedSpecies, selectedElement, branch, e.target.value)}
                          placeholder="Not yet named..."
                          className="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-sm font-display text-white/80 outline-none focus:border-violet-500/50 placeholder-white/15"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Runeword overview table for selected species */}
              <div className="bg-white/[0.03] rounded-lg p-4 border border-white/5">
                <label className="text-[9px] text-white/40 uppercase tracking-wider block mb-2">
                  All Runewords — {selectedSpecies}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ELEMENTS.map(el => (
                    <div key={el} className="text-center">
                      <p className="text-[8px] uppercase tracking-wider mb-1" style={{ color: `${ELEMENT_COLORS[el]}80` }}>{el}</p>
                      <p className="text-xs font-display" style={{ color: ELEMENT_COLORS[el] }}>
                        {runewords[selectedSpecies]?.[el] || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </EditorShell>
  )
}
