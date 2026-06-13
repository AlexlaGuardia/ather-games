'use client'

import { useState, useCallback } from 'react'
import EditorShell from '../templates/EditorShell'
import CrashRecovery from '../templates/CrashRecovery'
import EditableCell from '../templates/EditableCell'
import { useAutoSave } from '../hooks/useAutoSave'
import { SKILL_META, SKILL_IDS, SKILL_MILESTONES, type SkillId } from '../../engine/skills'
import { BASE_CHANNEL_TICKS } from '../../engine/harvesting'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const SKILL_COLORS: Record<string, string> = {
  farming: '#f59e0b',
  forestry: '#4ade80',
  prospecting: '#a78bfa',
  rinning: '#60a5fa',
  alchemy: '#f472b6',
  mana: '#8b5cf6',
}

const TPS = 15

interface SkillConfig {
  name: string
  manaCost: number
  locked?: string
}

interface MilestoneConfig {
  level: number
  label: string
}

function deepCloneMeta(): Record<SkillId, SkillConfig> {
  const clone = {} as Record<SkillId, SkillConfig>
  for (const id of SKILL_IDS) {
    clone[id] = { ...SKILL_META[id] }
  }
  return clone
}

function cloneChannelTicks(): Record<SkillId, number> {
  return { ...BASE_CHANNEL_TICKS }
}

function cloneMilestones(): MilestoneConfig[] {
  return SKILL_MILESTONES.map(m => ({ ...m }))
}

export default function SkillsEditor({ onDeploy, deployState }: Props) {
  const [meta, setMeta] = useState<Record<SkillId, SkillConfig>>(deepCloneMeta)
  const [channelTicks, setChannelTicks] = useState<Record<SkillId, number>>(cloneChannelTicks)
  const [milestones, setMilestones] = useState<MilestoneConfig[]>(cloneMilestones)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const { recovery, restore, discard } = useAutoSave(
    'skills', { meta, channelTicks, milestones }, dirty
  )

  const handleRestore = useCallback(() => {
    const data = restore()
    if (data) {
      setMeta(data.meta)
      setChannelTicks(data.channelTicks)
      setMilestones(data.milestones)
      setDirty(true)
    }
  }, [restore])

  const updateMeta = useCallback((id: SkillId, patch: Partial<SkillConfig>) => {
    setMeta(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setDirty(true)
  }, [])

  const updateChannelTicks = useCallback((id: SkillId, val: number) => {
    setChannelTicks(prev => ({ ...prev, [id]: val }))
    setDirty(true)
  }, [])

  const updateMilestone = useCallback((idx: number, patch: Partial<MilestoneConfig>) => {
    setMilestones(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m))
    setDirty(true)
  }, [])

  const addMilestone = useCallback(() => {
    setMilestones(prev => [...prev, { level: 99, label: 'New' }])
    setDirty(true)
  }, [])

  const removeMilestone = useCallback((idx: number) => {
    setMilestones(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: { meta, channelTicks, milestones } }),
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
  }, [meta, channelTicks, milestones, onDeploy])

  const activeSkills = SKILL_IDS.filter(id => channelTicks[id] > 0)
  const channelRange = activeSkills.length > 0
    ? `${Math.min(...activeSkills.map(id => channelTicks[id] / TPS)).toFixed(1)}s – ${Math.max(...activeSkills.map(id => channelTicks[id] / TPS)).toFixed(1)}s`
    : '—'

  return (
    <EditorShell
      title="Skills"
      subtitle="Skill meta — mana costs, channel timing, milestones"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
      recoveryBanner={recovery ? <CrashRecovery timestamp={recovery.timestamp} onRestore={handleRestore} onDiscard={discard} /> : undefined}
    >
      <div className="space-y-8">
        {/* Skills table */}
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Skill Configuration</div>
          <div className="grid grid-cols-[180px_100px_100px_100px_140px] gap-2 px-3 mb-2">
            <span className="text-[9px] text-white/30 uppercase">Skill</span>
            <span className="text-[9px] text-white/30 uppercase">Mana Cost</span>
            <span className="text-[9px] text-white/30 uppercase">Channel Ticks</span>
            <span className="text-[9px] text-white/30 uppercase">Channel Time</span>
            <span className="text-[9px] text-white/30 uppercase">Locked</span>
          </div>
          <div className="space-y-1">
            {SKILL_IDS.map(id => (
              <div key={id} className="grid grid-cols-[180px_100px_100px_100px_140px] gap-2 items-center px-3 py-2.5 rounded bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: SKILL_COLORS[id] }} />
                  <span className="text-sm font-display text-white/80">{meta[id].name}</span>
                  <span className="text-[8px] text-white/20">{id}</span>
                </div>
                <EditableCell
                  type="number" min={0} value={meta[id].manaCost}
                  onChange={v => updateMeta(id, { manaCost: v as number })}
                  className="text-blue-400/80 font-display"
                />
                <EditableCell
                  type="number" min={0} value={channelTicks[id]}
                  onChange={v => updateChannelTicks(id, v as number)}
                  className="text-amber-400/80 font-display"
                />
                <span className="text-xs text-white/40 tabular-nums">
                  {channelTicks[id] > 0 ? `${(channelTicks[id] / TPS).toFixed(1)}s` : '—'}
                </span>
                <input
                  type="text"
                  value={meta[id].locked ?? ''}
                  placeholder="—"
                  onChange={e => updateMeta(id, { locked: e.target.value || undefined })}
                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/60 outline-none focus:border-violet-500/50 placeholder-white/20"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">
            Milestones ({milestones.length})
          </div>
          <div className="grid grid-cols-[100px_200px_30px] gap-2 px-3 mb-2">
            <span className="text-[9px] text-white/30 uppercase">Level</span>
            <span className="text-[9px] text-white/30 uppercase">Title</span>
            <span />
          </div>
          <div className="space-y-1">
            {milestones.map((m, i) => (
              <div key={i} className="grid grid-cols-[100px_200px_30px] gap-2 items-center px-3 py-2 rounded bg-white/[0.03] border border-white/5">
                <input
                  type="number" min={1} max={99}
                  value={m.level}
                  onChange={e => updateMilestone(i, { level: parseInt(e.target.value) || 1 })}
                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-[#d4a843]/80 outline-none focus:border-violet-500/50 tabular-nums"
                />
                <input
                  type="text"
                  value={m.label}
                  onChange={e => updateMilestone(i, { label: e.target.value })}
                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-display text-white/80 outline-none focus:border-violet-500/50"
                />
                <button
                  onClick={() => removeMilestone(i)}
                  className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                >x</button>
              </div>
            ))}
          </div>
          <button
            onClick={addMilestone}
            className="mt-2 text-[10px] text-violet-400/70 hover:text-violet-400 border border-dashed border-violet-500/20 hover:border-violet-500/40 rounded px-3 py-1.5 transition-all"
          >+ Add Milestone</button>
        </div>

        {/* Summary */}
        <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
          {activeSkills.length} active gathering skills |
          Channel range: {channelRange}
        </div>
      </div>
    </EditorShell>
  )
}
