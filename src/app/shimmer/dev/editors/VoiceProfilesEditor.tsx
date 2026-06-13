'use client'

import { useState, useCallback } from 'react'
import EditorShell from '../templates/EditorShell'
import CrashRecovery from '../templates/CrashRecovery'
import EditableCell from '../templates/EditableCell'
import { useAutoSave } from '../hooks/useAutoSave'
import { VOICE_PROFILES } from '../../data/voice-profiles'
import type { VoiceProfile } from '../../engine/dialogue-schema'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const SYLLABLE_SETS: VoiceProfile['syllableSet'][] = ['balanced', 'breathy', 'consonant-heavy', 'sharp', 'vowel-heavy']
const TONES: VoiceProfile['tone'][] = ['warm', 'cold', 'neutral', 'raspy', 'cheerful']

const TONE_COLORS: Record<string, string> = {
  warm: '#f59e0b', cold: '#60a5fa', neutral: '#94a3b8', raspy: '#a78bfa', cheerful: '#4ade80',
}

function deepClone(): Record<string, VoiceProfile & { reverb?: number }> {
  const clone: Record<string, VoiceProfile & { reverb?: number }> = {}
  for (const [k, v] of Object.entries(VOICE_PROFILES)) {
    clone[k] = { ...v }
  }
  return clone
}

export default function VoiceProfilesEditor({ onDeploy, deployState }: Props) {
  const [profiles, setProfiles] = useState(deepClone)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const { recovery, restore, discard } = useAutoSave('voice-profiles', profiles, dirty)

  const handleRestore = useCallback(() => {
    const data = restore()
    if (data) {
      setProfiles(data)
      setDirty(true)
    }
  }, [restore])

  const keys = Object.keys(profiles)

  const update = useCallback((id: string, patch: Partial<VoiceProfile & { reverb?: number }>) => {
    setProfiles(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceProfiles: profiles }),
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
  }, [profiles, onDeploy])

  return (
    <EditorShell
      title="Voice Profiles"
      subtitle="NPC chatterbox voice configurations — pitch, speed, tone"
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
      recoveryBanner={recovery ? <CrashRecovery timestamp={recovery.timestamp} onRestore={handleRestore} onDiscard={discard} /> : undefined}
    >
      <div className="space-y-6">
        {/* Header row */}
        <div className="grid grid-cols-[130px_70px_70px_60px_130px_100px_60px_60px] gap-2 px-3">
          <span className="text-[9px] text-white/30 uppercase">Name</span>
          <span className="text-[9px] text-white/30 uppercase">Pitch</span>
          <span className="text-[9px] text-white/30 uppercase">Variance</span>
          <span className="text-[9px] text-white/30 uppercase">Speed</span>
          <span className="text-[9px] text-white/30 uppercase">Syllables</span>
          <span className="text-[9px] text-white/30 uppercase">Tone</span>
          <span className="text-[9px] text-white/30 uppercase">Volume</span>
          <span className="text-[9px] text-white/30 uppercase">Reverb</span>
        </div>

        {/* Profile rows */}
        <div className="space-y-1">
          {keys.map(id => {
            const p = profiles[id]
            return (
              <div key={id} className="grid grid-cols-[130px_70px_70px_60px_130px_100px_60px_60px] gap-2 items-center px-3 py-2.5 rounded bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: TONE_COLORS[p.tone] ?? '#666' }} />
                  <span className="text-sm font-display text-white/80">{p.name}</span>
                  <span className="text-[8px] text-white/20">{id}</span>
                </div>
                <EditableCell
                  type="number" min={80} max={300} value={p.pitch}
                  onChange={v => update(id, { pitch: v as number })}
                  className="text-amber-400/80 font-display"
                />
                <EditableCell
                  type="number" min={0} max={50} value={p.pitchVariance}
                  onChange={v => update(id, { pitchVariance: v as number })}
                  className="text-orange-400/80 font-display"
                />
                <EditableCell
                  type="number" min={1} max={12} value={p.speed}
                  onChange={v => update(id, { speed: v as number })}
                  className="text-green-400/80 font-display"
                />
                <select value={p.syllableSet}
                  onChange={e => update(id, { syllableSet: e.target.value as VoiceProfile['syllableSet'] })}
                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/70 outline-none focus:border-violet-500/50">
                  {SYLLABLE_SETS.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s}</option>)}
                </select>
                <select value={p.tone}
                  onChange={e => update(id, { tone: e.target.value as VoiceProfile['tone'] })}
                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/70 outline-none focus:border-violet-500/50">
                  {TONES.map(t => <option key={t} value={t} style={{ background: '#1a1a2e' }}>{t}</option>)}
                </select>
                <EditableCell
                  type="number" min={0} max={1} step={0.05} value={p.volume}
                  onChange={v => update(id, { volume: v as number })}
                  className="text-blue-400/80 font-display"
                />
                <EditableCell
                  type="number" min={0} max={1} step={0.05} value={p.reverb ?? 0}
                  onChange={v => { const n = v as number; update(id, { reverb: n > 0 ? n : undefined }) }}
                  className="text-cyan-400/80 font-display"
                />
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
          {keys.length} profiles |
          Pitch range: {Math.min(...keys.map(k => profiles[k].pitch))}–{Math.max(...keys.map(k => profiles[k].pitch))} Hz |
          Speed range: {Math.min(...keys.map(k => profiles[k].speed))}–{Math.max(...keys.map(k => profiles[k].speed))} syll/s
        </div>
      </div>
    </EditorShell>
  )
}
