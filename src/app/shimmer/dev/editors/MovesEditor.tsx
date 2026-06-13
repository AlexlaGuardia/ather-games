'use client'

import React, { useState, useCallback, useMemo } from 'react'
import EditorShell from '../templates/EditorShell'
import {
  type Move, type BattleElement, type MoveState, type CombatStat, type StatusId,
  MOVE_MANA_PULSE, MOVE_SPIRIT_WARD,
  MOVES_SOLID, MOVES_COMPACT, MOVES_EXPANDING, MOVES_IGNITE,
  MOVES_FLOW, MOVES_SCATTER, MOVES_BIND,
  SPECIES_SIGNATURES,
  getEffectiveness,
} from '../../engine/moves'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const ELEMENTS: BattleElement[] = ['mana', 'storm', 'earth', 'water', 'neutral']
const COMBAT_ELEMENTS: Exclude<BattleElement, 'neutral'>[] = ['mana', 'storm', 'earth', 'water']
const STATES: MoveState[] = ['solid', 'compact', 'expanding', 'ignite', 'flow', 'scatter', 'bind']
const COMBAT_STATS: CombatStat[] = ['pwr', 'grd', 'agi', 'vig']
const STATUS_IDS: StatusId[] = ['ignition', 'regen', 'crystallize', 'fortify', 'surge', 'erosion', 'anchor']

const ELEMENT_COLORS: Record<BattleElement, string> = {
  mana: '#c084fc', storm: '#fbbf24', earth: '#4ade80', water: '#60a5fa', neutral: '#94a3b8',
}

const STATE_LABELS: Record<MoveState, string> = {
  solid: 'Direct Damage', compact: 'Defense', expanding: 'Area/Spread',
  ignite: 'Burst', flow: 'Sustain', scatter: 'Disruption', bind: 'Control',
}

const STATE_GROUP_DEFS: { id: MoveState; constName: string; data: Record<string, Move> }[] = [
  { id: 'solid', constName: 'MOVES_SOLID', data: MOVES_SOLID as unknown as Record<string, Move> },
  { id: 'compact', constName: 'MOVES_COMPACT', data: MOVES_COMPACT as unknown as Record<string, Move> },
  { id: 'expanding', constName: 'MOVES_EXPANDING', data: MOVES_EXPANDING as unknown as Record<string, Move> },
  { id: 'ignite', constName: 'MOVES_IGNITE', data: MOVES_IGNITE as unknown as Record<string, Move> },
  { id: 'flow', constName: 'MOVES_FLOW', data: MOVES_FLOW as unknown as Record<string, Move> },
  { id: 'scatter', constName: 'MOVES_SCATTER', data: MOVES_SCATTER as unknown as Record<string, Move> },
  { id: 'bind', constName: 'MOVES_BIND', data: MOVES_BIND as unknown as Record<string, Move> },
]

const SPECIES_KEYS = Object.keys(SPECIES_SIGNATURES)

interface MoveEntry {
  move: Move
  group: string   // 'universal' | state name | 'sig:species:element'
  key: string     // key in group object (e.g. 'mana_shard') or const name for universal
}

function cloneMove(m: Move): Move {
  return { ...m, statChanges: m.statChanges?.map(sc => ({ ...sc })) }
}

function buildEntries(): MoveEntry[] {
  const entries: MoveEntry[] = []
  entries.push({ move: cloneMove(MOVE_MANA_PULSE), group: 'universal', key: 'MOVE_MANA_PULSE' })
  entries.push({ move: cloneMove(MOVE_SPIRIT_WARD), group: 'universal', key: 'MOVE_SPIRIT_WARD' })
  for (const sg of STATE_GROUP_DEFS) {
    for (const [key, move] of Object.entries(sg.data)) {
      entries.push({ move: cloneMove(move), group: sg.id, key })
    }
  }
  for (const species of SPECIES_KEYS) {
    const sigs = SPECIES_SIGNATURES[species as keyof typeof SPECIES_SIGNATURES]
    if (!sigs) continue
    for (const el of COMBAT_ELEMENTS) {
      const move = sigs[el]
      if (!move) continue
      entries.push({ move: cloneMove(move), group: `sig:${species}:${el}`, key: move.id })
    }
  }
  return entries
}

export default function MovesEditor({ onDeploy, deployState }: Props) {
  const [entries, setEntries] = useState<MoveEntry[]>(buildEntries)
  const [selectedId, setSelectedId] = useState<string>(entries[0]?.move.id ?? '')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const selected = useMemo(() => entries.find(e => e.move.id === selectedId) ?? null, [entries, selectedId])

  const universalMoves = useMemo(() => entries.filter(e => e.group === 'universal'), [entries])
  const stateGrouped = useMemo(() => {
    const groups: Record<string, MoveEntry[]> = {}
    for (const s of STATES) groups[s] = []
    for (const e of entries) { if (groups[e.group]) groups[e.group].push(e) }
    return groups
  }, [entries])
  const sigGrouped = useMemo(() => {
    const groups: Record<string, MoveEntry[]> = {}
    for (const sp of SPECIES_KEYS) groups[sp] = []
    for (const e of entries) {
      if (e.group.startsWith('sig:')) {
        const sp = e.group.split(':')[1]
        groups[sp]?.push(e)
      }
    }
    return groups
  }, [entries])

  const updateMove = useCallback((id: string, patch: Partial<Move>) => {
    setEntries(prev => prev.map(e => e.move.id === id ? { ...e, move: { ...e.move, ...patch } } : e))
    setDirty(true)
  }, [])

  const updateStatChange = useCallback((moveId: string, idx: number, patch: Partial<{ target: 'self' | 'foe'; stat: CombatStat; stages: number }>) => {
    setEntries(prev => prev.map(e => {
      if (e.move.id !== moveId) return e
      const sc = [...(e.move.statChanges ?? [])]
      sc[idx] = { ...sc[idx], ...patch }
      return { ...e, move: { ...e.move, statChanges: sc } }
    }))
    setDirty(true)
  }, [])

  const addStatChange = useCallback((moveId: string) => {
    setEntries(prev => prev.map(e => {
      if (e.move.id !== moveId) return e
      return { ...e, move: { ...e.move, statChanges: [...(e.move.statChanges ?? []), { target: 'self' as const, stat: 'pwr' as CombatStat, stages: 1 }] } }
    }))
    setDirty(true)
  }, [])

  const removeStatChange = useCallback((moveId: string, idx: number) => {
    setEntries(prev => prev.map(e => {
      if (e.move.id !== moveId) return e
      return { ...e, move: { ...e.move, statChanges: (e.move.statChanges ?? []).filter((_, i) => i !== idx) } }
    }))
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const universal = entries.filter(e => e.group === 'universal').map(e => ({ constName: e.key, move: e.move }))
      const groups: Record<string, Record<string, Move>> = {}
      for (const sg of STATE_GROUP_DEFS) {
        groups[sg.id] = {}
        for (const e of entries) { if (e.group === sg.id) groups[sg.id][e.key] = e.move }
      }
      const signatures: Record<string, Record<string, Move>> = {}
      for (const sp of SPECIES_KEYS) signatures[sp] = {}
      for (const e of entries) {
        if (e.group.startsWith('sig:')) {
          const [, sp, el] = e.group.split(':')
          signatures[sp][el] = e.move
        }
      }
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: { universal, groups, signatures } }),
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
  }, [entries, onDeploy])

  // Matchup chart cells
  const matchupCells: React.ReactNode[] = []
  matchupCells.push(<div key="empty" />)
  for (const def of ELEMENTS) {
    matchupCells.push(
      <div key={`h-${def}`} className="text-center text-[9px] py-1 capitalize font-display" style={{ color: ELEMENT_COLORS[def] }}>{def}</div>
    )
  }
  for (const atk of ELEMENTS) {
    matchupCells.push(
      <div key={`r-${atk}`} className="text-right pr-3 text-[9px] py-1.5 capitalize font-display" style={{ color: ELEMENT_COLORS[atk] }}>{atk} &rarr;</div>
    )
    for (const def of ELEMENTS) {
      const mult = getEffectiveness(atk, def)
      matchupCells.push(
        <div key={`${atk}-${def}`} className="text-center text-[10px] py-1.5 tabular-nums rounded-sm mx-0.5" style={{
          background: mult > 1 ? 'rgba(74,222,128,0.15)' : mult < 1 ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.03)',
          color: mult > 1 ? '#4ade80' : mult < 1 ? '#f87171' : 'rgba(255,255,255,0.3)',
        }}>{mult}x</div>
      )
    }
  }

  return (
    <EditorShell
      title="Moves"
      subtitle="Battle moves — power, effects, stat changes, matchups"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Left panel — move list */}
        <div className="w-64 shrink-0 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {/* Universal */}
          <div>
            <div className="text-[8px] text-white/25 uppercase tracking-wider mb-1">Universal</div>
            <div className="space-y-0.5">
              {universalMoves.map(e => <MoveBtn key={e.move.id} entry={e} sel={selectedId === e.move.id} onClick={() => setSelectedId(e.move.id)} />)}
            </div>
          </div>
          {/* State groups */}
          {STATES.map(state => stateGrouped[state]?.length > 0 && (
            <div key={state}>
              <div className="text-[8px] text-white/25 uppercase tracking-wider mb-1">
                {state} <span className="text-white/15 normal-case">— {STATE_LABELS[state]}</span>
              </div>
              <div className="space-y-0.5">
                {stateGrouped[state].map(e => <MoveBtn key={e.move.id} entry={e} sel={selectedId === e.move.id} onClick={() => setSelectedId(e.move.id)} />)}
              </div>
            </div>
          ))}
          {/* Signatures */}
          <div className="pt-2 border-t border-white/5">
            <div className="text-[8px] text-white/25 uppercase tracking-wider mb-2">Species Signatures</div>
            {SPECIES_KEYS.map(sp => sigGrouped[sp]?.length > 0 && (
              <div key={sp} className="mb-2">
                <div className="text-[8px] text-white/30 capitalize mb-0.5 font-display">{sp.replace('-', ' ')}</div>
                <div className="space-y-0.5">
                  {sigGrouped[sp].map(e => <MoveBtn key={e.move.id} entry={e} sel={selectedId === e.move.id} onClick={() => setSelectedId(e.move.id)} />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — move detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <MoveDetail
              entry={selected}
              onUpdate={updateMove}
              onUpdateSC={updateStatChange}
              onAddSC={addStatChange}
              onRemoveSC={removeStatChange}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-white/20 text-sm font-display">Select a move to edit</p>
            </div>
          )}
        </div>
      </div>

      {/* Matchup chart */}
      <div className="mt-8 pt-6 border-t border-white/5">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Element Matchup Chart</div>
        <div className="inline-grid gap-0" style={{ gridTemplateColumns: `80px repeat(${ELEMENTS.length}, 70px)` }}>
          {matchupCells}
        </div>
        <div className="text-[10px] text-white/20 mt-2">Cycle: Mana &rarr; Water &rarr; Storm &rarr; Earth &rarr; Mana (1.5x strong, 0.75x weak)</div>
      </div>
    </EditorShell>
  )
}

// ── Sub-components ──

function MoveBtn({ entry, sel, onClick }: { entry: MoveEntry; sel: boolean; onClick: () => void }) {
  const { move } = entry
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded text-left transition-all text-[11px] border ${
        sel ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'hover:bg-white/5 border-transparent text-white/60'
      }`}
    >
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ELEMENT_COLORS[move.element] }} />
      <span className="flex-1 truncate font-display">{move.name}</span>
      {move.power > 0 && <span className="text-[8px] text-white/25 tabular-nums">{move.power}p</span>}
    </button>
  )
}

function MoveDetail({ entry, onUpdate, onUpdateSC, onAddSC, onRemoveSC }: {
  entry: MoveEntry
  onUpdate: (id: string, patch: Partial<Move>) => void
  onUpdateSC: (moveId: string, idx: number, patch: Partial<{ target: 'self' | 'foe'; stat: CombatStat; stages: number }>) => void
  onAddSC: (moveId: string) => void
  onRemoveSC: (moveId: string, idx: number) => void
}) {
  const { move, group } = entry
  const isSig = group.startsWith('sig:')
  const sigLabel = isSig ? group.split(':')[1].replace('-', ' ') : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <input
          value={move.name}
          onChange={e => onUpdate(move.id, { name: e.target.value })}
          className="font-display text-lg text-white/90 bg-transparent border-b border-transparent hover:border-white/10 focus:border-violet-500/50 outline-none w-full"
        />
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[8px] font-display px-1.5 py-0.5 rounded capitalize" style={{ background: `${ELEMENT_COLORS[move.element]}20`, color: ELEMENT_COLORS[move.element] }}>
            {move.element}
          </span>
          <span className="text-[8px] font-display px-1.5 py-0.5 rounded bg-white/5 text-white/50 capitalize">{move.state}</span>
          {isSig && <span className="text-[8px] font-display px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 capitalize">{sigLabel}</span>}
          <span className="text-[9px] text-white/20">{move.id}</span>
        </div>
      </div>

      {/* Element + State selectors */}
      <div className="flex gap-3">
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 flex-1">
          <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">Element</label>
          <select
            value={move.element}
            onChange={e => onUpdate(move.id, { element: e.target.value as BattleElement })}
            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50"
          >
            {ELEMENTS.map(el => <option key={el} value={el} style={{ background: '#1a1a2e' }}>{el}</option>)}
          </select>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 flex-1">
          <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">State</label>
          <select
            value={move.state}
            onChange={e => onUpdate(move.id, { state: e.target.value as MoveState })}
            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50"
          >
            {STATES.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s} — {STATE_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3">
        <NumField label="Power" value={move.power} color="#f87171" hint={move.power === 0 ? 'status move' : 'damage'} onChange={v => onUpdate(move.id, { power: v })} />
        <NumField label="Accuracy" value={move.accuracy} color="#fbbf24" hint={`${move.accuracy}% hit`} onChange={v => onUpdate(move.id, { accuracy: v })} />
        <NumField label="PP" value={move.pp} color="#60a5fa" hint="uses / battle" onChange={v => onUpdate(move.id, { pp: v })} />
        <NumField label="Priority" value={move.priority} color="#c084fc" hint={move.priority > 0 ? 'strikes first' : move.priority < 0 ? 'strikes last' : 'normal'} onChange={v => onUpdate(move.id, { priority: v })} min={-1} max={1} />
      </div>

      {/* Effects */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
          <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-2">Target Effect</label>
          <div className="flex gap-2">
            <select
              value={move.effect ?? ''}
              onChange={e => {
                const val = e.target.value as StatusId | ''
                onUpdate(move.id, { effect: val || undefined, effectChance: val ? (move.effectChance ?? 25) : undefined })
              }}
              className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 flex-1"
            >
              <option value="" style={{ background: '#1a1a2e' }}>None</option>
              {STATUS_IDS.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s}</option>)}
            </select>
            {move.effect && (
              <input
                type="number" min={0} max={100}
                value={move.effectChance ?? 0}
                onChange={e => onUpdate(move.id, { effectChance: parseInt(e.target.value) || 0 })}
                className="w-16 bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/60 outline-none focus:border-violet-500/50 tabular-nums"
                title="Chance %"
              />
            )}
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
          <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-2">Self Effect</label>
          <div className="flex gap-2">
            <select
              value={move.selfEffect ?? ''}
              onChange={e => {
                const val = e.target.value as StatusId | ''
                onUpdate(move.id, { selfEffect: val || undefined, selfEffectChance: val ? (move.selfEffectChance ?? 100) : undefined })
              }}
              className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-violet-500/50 flex-1"
            >
              <option value="" style={{ background: '#1a1a2e' }}>None</option>
              {STATUS_IDS.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s}</option>)}
            </select>
            {move.selfEffect && (
              <input
                type="number" min={0} max={100}
                value={move.selfEffectChance ?? 0}
                onChange={e => onUpdate(move.id, { selfEffectChance: parseInt(e.target.value) || 0 })}
                className="w-16 bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/60 outline-none focus:border-violet-500/50 tabular-nums"
                title="Chance %"
              />
            )}
          </div>
        </div>
      </div>

      {/* Stat Changes */}
      <div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
          Stat Changes ({move.statChanges?.length ?? 0})
        </div>
        {(move.statChanges ?? []).length > 0 && (
          <div className="grid grid-cols-[80px_80px_70px_30px] gap-2 px-2 mb-1">
            <span className="text-[9px] text-white/30 uppercase">Target</span>
            <span className="text-[9px] text-white/30 uppercase">Stat</span>
            <span className="text-[9px] text-white/30 uppercase">Stages</span>
            <span />
          </div>
        )}
        <div className="space-y-1">
          {(move.statChanges ?? []).map((sc, i) => (
            <div key={i} className="grid grid-cols-[80px_80px_70px_30px] gap-2 items-center px-2 py-1.5 rounded bg-white/5">
              <select value={sc.target} onChange={e => onUpdateSC(move.id, i, { target: e.target.value as 'self' | 'foe' })}
                className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none">
                <option value="self" style={{ background: '#1a1a2e' }}>Self</option>
                <option value="foe" style={{ background: '#1a1a2e' }}>Foe</option>
              </select>
              <select value={sc.stat} onChange={e => onUpdateSC(move.id, i, { stat: e.target.value as CombatStat })}
                className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none">
                {COMBAT_STATS.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s.toUpperCase()}</option>)}
              </select>
              <input type="number" min={-3} max={3} value={sc.stages}
                onChange={e => onUpdateSC(move.id, i, { stages: parseInt(e.target.value) || 0 })}
                className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-xs text-white/80 outline-none tabular-nums" />
              <button onClick={() => onRemoveSC(move.id, i)}
                className="text-red-400/50 hover:text-red-400 text-xs transition-colors">x</button>
            </div>
          ))}
        </div>
        <button onClick={() => onAddSC(move.id)}
          className="mt-2 text-[10px] text-violet-400/70 hover:text-violet-400 border border-dashed border-violet-500/20 hover:border-violet-500/40 rounded px-3 py-1.5 transition-all"
        >+ Add Stat Change</button>
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Description</label>
        <textarea
          value={move.description}
          onChange={e => onUpdate(move.id, { description: e.target.value })}
          rows={2}
          className="w-full bg-transparent border border-white/10 rounded px-3 py-2 text-xs text-white/70 outline-none focus:border-violet-500/50 resize-none"
        />
      </div>

      {/* Summary */}
      <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
        {move.power > 0 ? `${move.power}p @ ${move.accuracy}%` : 'Status move'} |{' '}
        {move.pp} PP | Priority: {move.priority > 0 ? `+${move.priority}` : move.priority} |{' '}
        {move.effect ? `${move.effect} (${move.effectChance}%)` : 'No foe effect'} |{' '}
        {move.selfEffect ? `Self: ${move.selfEffect} (${move.selfEffectChance}%)` : 'No self effect'}
      </div>
    </div>
  )
}

function NumField({ label, value, color, hint, onChange, min = 0, max = 100 }: {
  label: string; value: number; color: string; hint: string
  onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
      <label className="text-[8px] text-white/30 uppercase tracking-wider block mb-1">{label}</label>
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm font-display outline-none focus:border-violet-500/50 tabular-nums"
        style={{ color: `${color}cc` }} />
      <span className="text-[8px] text-white/20 mt-1 block">{hint}</span>
    </div>
  )
}
