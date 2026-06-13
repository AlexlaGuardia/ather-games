'use client'

import { useState, useCallback, useMemo } from 'react'
import EditorShell from '../templates/EditorShell'
import { QUEST_DEFS, QUEST_IDS, type QuestDef, type QuestObjective, type QuestReward } from '../../engine/quests'
import { ITEMS } from '../../sprites/items'
import { SKILL_IDS } from '../../engine/skills'
import { ZONES } from '../../world/zones'
import { NPC_SUMMARY } from '../../world/npcs'
import { POTION_IDS, POTION_DEFS } from '../../engine/alchemy'

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

const CAT_COLORS: Record<string, string> = { main: '#d4a843', side: '#9ca3af' }

const OBJ_TYPES = ['gather', 'study', 'talk', 'visit', 'brew', 'battle', 'flag', 'skill'] as const
const REWARD_TYPES = ['item', 'marks', 'xp', 'flag'] as const

const RESOURCE_ITEMS = ITEMS.filter(i => i.type === 'resource' || i.type === 'consumable' || i.type === 'crop_seed')
const ALL_ITEM_IDS = ITEMS.map(i => i.id)
const ZONE_IDS = ZONES.map(z => z.id)
const NPC_IDS = NPC_SUMMARY.map(n => n.id)
const SPECIES_LIST = ['any', 'fox', 'axolotl', 'water-bear', 'turtle', 'owl', 'frog', 'firefly', 'rabbit', 'hummingbird', 'bat']

function deepCloneQuests(): Record<string, QuestDef> {
  const clone: Record<string, QuestDef> = {}
  for (const [k, v] of Object.entries(QUEST_DEFS)) {
    clone[k] = {
      ...v,
      prerequisites: [...v.prerequisites],
      objectives: v.objectives.map(o => ({ ...o })),
      rewards: v.rewards.map(r => ({ ...r })),
    }
  }
  return clone
}

function nameToId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'new_quest'
}

function makeDefaultObjective(): QuestObjective {
  return { type: 'flag', flag: 'new_flag' }
}

function makeDefaultReward(): QuestReward {
  return { type: 'marks', amount: 50 }
}

export default function QuestEditor({ onDeploy, deployState }: Props) {
  const [quests, setQuests] = useState<Record<string, QuestDef>>(deepCloneQuests)
  const [selectedId, setSelectedId] = useState<string>(QUEST_IDS[0] ?? '')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const questList = useMemo(() =>
    Object.values(quests).sort((a, b) => {
      if (a.category !== b.category) return a.category === 'main' ? -1 : 1
      return 0
    }),
    [quests]
  )

  const selected = quests[selectedId] ?? null
  const questIds = useMemo(() => Object.keys(quests), [quests])

  // Group by category for left panel
  const groups = useMemo(() => {
    const g: Record<string, QuestDef[]> = { main: [], side: [] }
    for (const q of questList) g[q.category]?.push(q)
    return g
  }, [questList])

  const updateQuest = useCallback((id: string, patch: Partial<QuestDef>) => {
    setQuests(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    setDirty(true)
  }, [])

  const createQuest = useCallback((category: 'main' | 'side') => {
    const base = category === 'main' ? 'new_main_quest' : 'new_side_quest'
    let id = base
    let n = 2
    // eslint-disable-next-line no-loop-func
    while (quests[id]) { id = `${base}_${n}`; n++ }
    const quest: QuestDef = {
      id,
      name: category === 'main' ? 'New Main Quest' : 'New Side Quest',
      description: '',
      category,
      prerequisites: [],
      objectives: [makeDefaultObjective()],
      rewards: [makeDefaultReward()],
    }
    setQuests(prev => ({ ...prev, [id]: quest }))
    setSelectedId(id)
    setDirty(true)
  }, [quests])

  const duplicateQuest = useCallback((sourceId: string) => {
    const src = quests[sourceId]
    if (!src) return
    let id = `${sourceId}_copy`
    let n = 2
    // eslint-disable-next-line no-loop-func
    while (quests[id]) { id = `${sourceId}_copy_${n}`; n++ }
    const quest: QuestDef = {
      ...src,
      id,
      name: `${src.name} (Copy)`,
      prerequisites: [...src.prerequisites],
      objectives: src.objectives.map(o => ({ ...o })),
      rewards: src.rewards.map(r => ({ ...r })),
    }
    setQuests(prev => ({ ...prev, [id]: quest }))
    setSelectedId(id)
    setDirty(true)
  }, [quests])

  const deleteQuest = useCallback((id: string) => {
    setQuests(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setSelectedId(prev => prev === id ? (Object.keys(quests).find(k => k !== id) ?? '') : prev)
    setDirty(true)
  }, [quests])

  const renameQuestId = useCallback((oldId: string, newId: string) => {
    if (newId === oldId || !newId || quests[newId]) return
    setQuests(prev => {
      const next = { ...prev }
      const quest = next[oldId]
      if (!quest) return prev
      delete next[oldId]
      next[newId] = { ...quest, id: newId }
      // Update prerequisite references
      for (const q of Object.values(next)) {
        q.prerequisites = q.prerequisites.map(p => p === oldId ? newId : p)
      }
      return next
    })
    setSelectedId(newId)
    setDirty(true)
  }, [quests])

  const updateObjective = useCallback((questId: string, idx: number, obj: QuestObjective) => {
    setQuests(prev => {
      const q = prev[questId]
      if (!q) return prev
      const objectives = [...q.objectives]
      objectives[idx] = obj
      return { ...prev, [questId]: { ...q, objectives } }
    })
    setDirty(true)
  }, [])

  const addObjective = useCallback((questId: string) => {
    setQuests(prev => {
      const q = prev[questId]
      if (!q) return prev
      return { ...prev, [questId]: { ...q, objectives: [...q.objectives, makeDefaultObjective()] } }
    })
    setDirty(true)
  }, [])

  const removeObjective = useCallback((questId: string, idx: number) => {
    setQuests(prev => {
      const q = prev[questId]
      if (!q) return prev
      return { ...prev, [questId]: { ...q, objectives: q.objectives.filter((_, i) => i !== idx) } }
    })
    setDirty(true)
  }, [])

  const updateReward = useCallback((questId: string, idx: number, reward: QuestReward) => {
    setQuests(prev => {
      const q = prev[questId]
      if (!q) return prev
      const rewards = [...q.rewards]
      rewards[idx] = reward
      return { ...prev, [questId]: { ...q, rewards } }
    })
    setDirty(true)
  }, [])

  const addReward = useCallback((questId: string) => {
    setQuests(prev => {
      const q = prev[questId]
      if (!q) return prev
      return { ...prev, [questId]: { ...q, rewards: [...q.rewards, makeDefaultReward()] } }
    })
    setDirty(true)
  }, [])

  const removeReward = useCallback((questId: string, idx: number) => {
    setQuests(prev => {
      const q = prev[questId]
      if (!q) return prev
      return { ...prev, [questId]: { ...q, rewards: q.rewards.filter((_, i) => i !== idx) } }
    })
    setDirty(true)
  }, [])

  const addPrereq = useCallback((questId: string) => {
    setQuests(prev => {
      const q = prev[questId]
      if (!q) return prev
      return { ...prev, [questId]: { ...q, prerequisites: [...q.prerequisites, ''] } }
    })
    setDirty(true)
  }, [])

  const updatePrereq = useCallback((questId: string, idx: number, value: string) => {
    setQuests(prev => {
      const q = prev[questId]
      if (!q) return prev
      const prerequisites = [...q.prerequisites]
      prerequisites[idx] = value
      return { ...prev, [questId]: { ...q, prerequisites } }
    })
    setDirty(true)
  }, [])

  const removePrereq = useCallback((questId: string, idx: number) => {
    setQuests(prev => {
      const q = prev[questId]
      if (!q) return prev
      return { ...prev, [questId]: { ...q, prerequisites: q.prerequisites.filter((_, i) => i !== idx) } }
    })
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quests }),
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
  }, [quests, onDeploy])

  return (
    <EditorShell
      title="Quests"
      subtitle={`${questList.length} quests — ${groups.main?.length ?? 0} main, ${groups.side?.length ?? 0} side`}
      loadStatus="live"
      onDeploy={handleSave}
      deployState={saveStatus === 'saving' ? 'building' : saveStatus === 'saved' ? 'done' : saveStatus === 'error' ? 'error' : deployState}
      headerActions={dirty ? <span className="text-amber-400 text-[10px]">unsaved changes</span> : null}
    >
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* Left panel — quest list grouped by category */}
        <div className="w-56 shrink-0 space-y-3">
          {(['main', 'side'] as const).map(cat => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[8px] font-display px-1.5 py-0.5 rounded uppercase"
                  style={{ background: `${CAT_COLORS[cat]}20`, color: CAT_COLORS[cat] }}
                >{cat}</span>
                <span className="text-[9px] text-white/25 tabular-nums">{groups[cat]?.length ?? 0}</span>
                <button
                  onClick={() => createQuest(cat)}
                  className="ml-auto text-[9px] text-violet-400/60 hover:text-violet-400 transition-colors"
                  title={`New ${cat} quest`}
                >+</button>
              </div>
              <div className="space-y-1">
                {groups[cat]?.map(quest => (
                  <button
                    key={quest.id}
                    onClick={() => setSelectedId(quest.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-all text-xs border ${
                      selectedId === quest.id
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'hover:bg-white/5 border-transparent text-white/60'
                    }`}
                  >
                    <span className="flex-1 truncate font-display">{quest.name}</span>
                    <span className="text-[8px] text-white/25 tabular-nums">{quest.objectives.length}obj</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — quest detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="space-y-5">
              {/* Header — name + category + actions */}
              <div className="flex items-center gap-3">
                <input
                  value={selected.name}
                  onChange={e => updateQuest(selected.id, { name: e.target.value })}
                  className="bg-transparent border-b border-white/10 text-lg font-display text-white/90 outline-none focus:border-violet-500/50 flex-1"
                />
                <div className="flex gap-1">
                  {(['main', 'side'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => updateQuest(selected.id, { category: cat })}
                      className="text-[10px] px-2 py-1 rounded border transition-all"
                      style={{
                        background: selected.category === cat ? `${CAT_COLORS[cat]}20` : 'transparent',
                        borderColor: selected.category === cat ? `${CAT_COLORS[cat]}60` : 'rgba(255,255,255,0.1)',
                        color: selected.category === cat ? CAT_COLORS[cat] : 'rgba(255,255,255,0.4)',
                      }}
                    >{cat}</button>
                  ))}
                </div>
                <button
                  onClick={() => duplicateQuest(selected.id)}
                  className="text-[9px] text-white/30 hover:text-white/60 transition-colors px-1.5 py-1 rounded border border-white/10 hover:border-white/20"
                  title="Duplicate quest"
                >Dup</button>
                <button
                  onClick={() => { if (confirm(`Delete "${selected.name}"?`)) deleteQuest(selected.id) }}
                  className="text-[9px] text-red-400/40 hover:text-red-400 transition-colors px-1.5 py-1 rounded border border-red-400/10 hover:border-red-400/30"
                  title="Delete quest"
                >Del</button>
              </div>

              {/* ID + auto-start */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-white/30">ID:</span>
                  <input
                    value={selected.id}
                    onBlur={e => {
                      const newId = nameToId(e.target.value)
                      if (newId !== selected.id) renameQuestId(selected.id, newId)
                    }}
                    onChange={() => {}} // controlled display only — commit on blur
                    className="text-[9px] text-white/40 bg-transparent border-b border-white/5 outline-none focus:border-violet-500/30 w-40 font-mono"
                    title="Edit quest ID (applied on blur)"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-white/40">
                  <input
                    type="checkbox"
                    checked={selected.autoStart ?? false}
                    onChange={e => updateQuest(selected.id, { autoStart: e.target.checked || undefined })}
                    className="accent-violet-500"
                  />
                  Auto-start
                </label>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  value={selected.description}
                  onChange={e => updateQuest(selected.id, { description: e.target.value })}
                  rows={2}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-violet-500/50 resize-none"
                />
              </div>

              {/* Prerequisites */}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Prerequisites ({selected.prerequisites.length})
                </div>
                <div className="space-y-1">
                  {selected.prerequisites.map((prereq, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={prereq}
                        onChange={e => updatePrereq(selected.id, i, e.target.value)}
                        className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white/70 outline-none focus:border-violet-500/50 flex-1"
                      >
                        <option value="" style={{ background: '#1a1a2e' }}>-- select --</option>
                        {questIds.filter(qid => qid !== selected.id).map(qid => (
                          <option key={qid} value={qid} style={{ background: '#1a1a2e' }}>{quests[qid].name} ({qid})</option>
                        ))}
                      </select>
                      <button onClick={() => removePrereq(selected.id, i)} className="text-red-400/50 hover:text-red-400 text-xs">x</button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addPrereq(selected.id)}
                  className="mt-1 text-[10px] text-violet-400/70 hover:text-violet-400 border border-dashed border-violet-500/20 hover:border-violet-500/40 rounded px-3 py-1 transition-all"
                >+ Add Prerequisite</button>
              </div>

              {/* Objectives */}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Objectives ({selected.objectives.length})
                </div>
                <div className="space-y-2">
                  {selected.objectives.map((obj, i) => (
                    <div key={i} className="p-2 rounded bg-white/5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <select
                          value={obj.type}
                          onChange={e => {
                            const type = e.target.value as QuestObjective['type']
                            const defaults: Record<string, QuestObjective> = {
                              gather: { type: 'gather', itemId: 'raw_mana_shard', count: 1 },
                              study: { type: 'study', species: 'any' },
                              talk: { type: 'talk', npcId: NPC_IDS[0] ?? '' },
                              visit: { type: 'visit', zoneId: ZONE_IDS[0] ?? '' },
                              brew: { type: 'brew', potionId: POTION_IDS[0] ?? '', count: 1 },
                              battle: { type: 'battle', npcId: NPC_IDS[0] ?? '' },
                              flag: { type: 'flag', flag: '' },
                              skill: { type: 'skill', skillId: 'farming', level: 5 },
                            }
                            updateObjective(selected.id, i, defaults[type] ?? obj)
                          }}
                          className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/50 w-20 shrink-0"
                        >
                          {OBJ_TYPES.map(t => <option key={t} value={t} style={{ background: '#1a1a2e' }}>{t}</option>)}
                        </select>

                        {/* Type-specific fields with real dropdowns */}
                        {obj.type === 'gather' && (
                          <>
                            <select
                              value={obj.itemId}
                              onChange={e => updateObjective(selected.id, i, { ...obj, itemId: e.target.value })}
                              className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/50 flex-1 min-w-0"
                            >
                              {RESOURCE_ITEMS.map(it => <option key={it.id} value={it.id} style={{ background: '#1a1a2e' }}>{it.name}</option>)}
                            </select>
                            <input type="number" min={1} value={obj.count} onChange={e => updateObjective(selected.id, i, { ...obj, count: parseInt(e.target.value) || 1 })}
                              className="w-14 bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none tabular-nums" />
                          </>
                        )}
                        {obj.type === 'study' && (
                          <select
                            value={obj.species}
                            onChange={e => updateObjective(selected.id, i, { ...obj, species: e.target.value })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/50 flex-1"
                          >
                            {SPECIES_LIST.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s === 'any' ? 'Any species' : s}</option>)}
                          </select>
                        )}
                        {(obj.type === 'talk' || obj.type === 'battle') && (
                          <select
                            value={obj.npcId}
                            onChange={e => updateObjective(selected.id, i, { ...obj, npcId: e.target.value })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/50 flex-1"
                          >
                            <option value="" style={{ background: '#1a1a2e' }}>-- select NPC --</option>
                            {NPC_SUMMARY.map(n => <option key={n.id} value={n.id} style={{ background: '#1a1a2e' }}>{n.name} ({n.zone})</option>)}
                          </select>
                        )}
                        {obj.type === 'visit' && (
                          <select
                            value={obj.zoneId}
                            onChange={e => updateObjective(selected.id, i, { ...obj, zoneId: e.target.value })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/50 flex-1"
                          >
                            <option value="" style={{ background: '#1a1a2e' }}>-- select zone --</option>
                            {ZONES.map(z => <option key={z.id} value={z.id} style={{ background: '#1a1a2e' }}>{z.name} ({z.id})</option>)}
                          </select>
                        )}
                        {obj.type === 'brew' && (
                          <>
                            <select
                              value={obj.potionId}
                              onChange={e => updateObjective(selected.id, i, { ...obj, potionId: e.target.value })}
                              className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/50 flex-1"
                            >
                              <option value="" style={{ background: '#1a1a2e' }}>-- select potion --</option>
                              {POTION_IDS.map(pid => <option key={pid} value={pid} style={{ background: '#1a1a2e' }}>{POTION_DEFS[pid].name}</option>)}
                            </select>
                            <input type="number" min={1} value={obj.count} onChange={e => updateObjective(selected.id, i, { ...obj, count: parseInt(e.target.value) || 1 })}
                              className="w-14 bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none tabular-nums" />
                          </>
                        )}
                        {obj.type === 'flag' && (
                          <input value={obj.flag} onChange={e => updateObjective(selected.id, i, { ...obj, flag: e.target.value })}
                            placeholder="flag_name"
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none flex-1" />
                        )}
                        {obj.type === 'skill' && (
                          <>
                            <select value={obj.skillId} onChange={e => updateObjective(selected.id, i, { ...obj, skillId: e.target.value })}
                              className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/50">
                              {SKILL_IDS.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s}</option>)}
                            </select>
                            <input type="number" min={1} value={obj.level} onChange={e => updateObjective(selected.id, i, { ...obj, level: parseInt(e.target.value) || 1 })}
                              className="w-14 bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none tabular-nums" />
                          </>
                        )}
                        <button onClick={() => removeObjective(selected.id, i)} className="text-red-400/50 hover:text-red-400 text-xs shrink-0">x</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addObjective(selected.id)}
                  className="mt-2 text-[10px] text-violet-400/70 hover:text-violet-400 border border-dashed border-violet-500/20 hover:border-violet-500/40 rounded px-3 py-1 transition-all"
                >+ Add Objective</button>
              </div>

              {/* Rewards */}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  Rewards ({selected.rewards.length})
                </div>
                <div className="space-y-2">
                  {selected.rewards.map((reward, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-white/5">
                      <select
                        value={reward.type}
                        onChange={e => {
                          const type = e.target.value as QuestReward['type']
                          const defaults: Record<string, QuestReward> = {
                            item: { type: 'item', itemId: 'berry', count: 1 },
                            marks: { type: 'marks', amount: 50 },
                            xp: { type: 'xp', skillId: 'farming', amount: 20 },
                            flag: { type: 'flag', flag: '' },
                          }
                          updateReward(selected.id, i, defaults[type] ?? reward)
                        }}
                        className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-violet-500/50 w-16 shrink-0"
                      >
                        {REWARD_TYPES.map(t => <option key={t} value={t} style={{ background: '#1a1a2e' }}>{t}</option>)}
                      </select>
                      {reward.type === 'item' && (
                        <>
                          <select value={reward.itemId} onChange={e => updateReward(selected.id, i, { ...reward, itemId: e.target.value })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none flex-1 min-w-0">
                            {ALL_ITEM_IDS.map(id => <option key={id} value={id} style={{ background: '#1a1a2e' }}>{id.replace(/_/g, ' ')}</option>)}
                          </select>
                          <input type="number" min={1} value={reward.count} onChange={e => updateReward(selected.id, i, { ...reward, count: parseInt(e.target.value) || 1 })}
                            className="w-14 bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none tabular-nums" />
                        </>
                      )}
                      {reward.type === 'marks' && (
                        <input type="number" min={1} value={reward.amount} onChange={e => updateReward(selected.id, i, { ...reward, amount: parseInt(e.target.value) || 1 })}
                          className="w-20 bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-[#d4a843]/80 outline-none tabular-nums" />
                      )}
                      {reward.type === 'xp' && (
                        <>
                          <select value={reward.skillId} onChange={e => updateReward(selected.id, i, { ...reward, skillId: e.target.value })}
                            className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none">
                            {SKILL_IDS.map(s => <option key={s} value={s} style={{ background: '#1a1a2e' }}>{s}</option>)}
                          </select>
                          <input type="number" min={1} value={reward.amount} onChange={e => updateReward(selected.id, i, { ...reward, amount: parseInt(e.target.value) || 1 })}
                            className="w-14 bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-green-400/80 outline-none tabular-nums" />
                        </>
                      )}
                      {reward.type === 'flag' && (
                        <input value={reward.flag} onChange={e => updateReward(selected.id, i, { ...reward, flag: e.target.value })}
                          placeholder="flag_name"
                          className="bg-transparent border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/70 outline-none flex-1" />
                      )}
                      <button onClick={() => removeReward(selected.id, i)} className="text-red-400/50 hover:text-red-400 text-xs shrink-0">x</button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addReward(selected.id)}
                  className="mt-2 text-[10px] text-violet-400/70 hover:text-violet-400 border border-dashed border-violet-500/20 hover:border-violet-500/40 rounded px-3 py-1 transition-all"
                >+ Add Reward</button>
              </div>

              {/* Summary */}
              <div className="text-[10px] text-white/25 pt-4 border-t border-white/5">
                {selected.objectives.length} objective{selected.objectives.length !== 1 ? 's' : ''} |{' '}
                {selected.rewards.length} reward{selected.rewards.length !== 1 ? 's' : ''} |{' '}
                {selected.prerequisites.length} prerequisite{selected.prerequisites.length !== 1 ? 's' : ''}
                {selected.autoStart ? ' | auto-start' : ''}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-white/20 text-sm font-display">Select a quest to edit</p>
            </div>
          )}
        </div>
      </div>
    </EditorShell>
  )
}
