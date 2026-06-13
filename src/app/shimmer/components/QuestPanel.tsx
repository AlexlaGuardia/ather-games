'use client'

import { useState, useMemo } from 'react'
import {
  type QuestState, type QuestDef,
  getAvailableQuests, getActiveQuests, getCompletedQuests,
  objectiveLabel, objectiveProgressText, objectiveTarget,
  QUEST_DEFS,
} from '../engine/quests'
interface QuestPanelProps {
  questState: QuestState
  flags: Record<string, boolean>
  inv?: unknown
  skills?: unknown
  spiritIndex?: unknown
  zoneId?: string
  onStart: (questId: string) => void
}

const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  main: { bg: '#d4a843', text: '#1a1a2e' },
  side: { bg: '#9ca3af', text: '#1a1a2e' },
}

export default function QuestPanel({ questState, flags, onStart }: QuestPanelProps) {
  const [tab, setTab] = useState<'active' | 'available' | 'complete'>('active')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const active = useMemo(() => getActiveQuests(questState), [questState])
  const available = useMemo(() => getAvailableQuests(questState, flags), [questState, flags])
  const completed = useMemo(() => getCompletedQuests(questState), [questState])

  const lists: Record<string, QuestDef[]> = { active, available, complete: completed }
  const currentList = lists[tab] ?? []
  const counts = { active: active.length, available: available.length, complete: completed.length }

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1">
        {(['active', 'available', 'complete'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setExpandedId(null) }}
            className={`flex-1 text-[11px] font-display py-1.5 rounded-lg border transition-colors ${
              tab === t
                ? 'bg-[#d4a843]/15 text-[#d4a843] border-[#d4a843]/30'
                : 'text-white/30 border-[#d4a843]/10 hover:text-white/50 hover:border-[#d4a843]/20'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {counts[t] > 0 && <span className="ml-1 text-[9px] opacity-60">({counts[t]})</span>}
          </button>
        ))}
      </div>

      {/* Quest list */}
      <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1 shimmer-scroll">
        {currentList.length === 0 && (
          <p className="text-white/20 text-[11px] font-display text-center py-6">
            {tab === 'active' ? 'No active quests' : tab === 'available' ? 'No quests available' : 'No completed quests'}
          </p>
        )}
        {currentList.map(quest => {
          const prog = questState[quest.id]
          const isExpanded = expandedId === quest.id
          const badge = CAT_BADGE[quest.category]

          return (
            <div key={quest.id} className="rounded-lg border border-[#d4a843]/12 overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : quest.id)}
                className="w-full text-left p-2.5 flex items-center gap-2 hover:bg-white/[0.03] transition-colors"
              >
                <span
                  className="text-[8px] font-display px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: badge.bg, color: badge.text }}
                >{quest.category}</span>
                <span className="text-[12px] font-display text-white/80 flex-1 truncate">{quest.name}</span>
                {tab === 'active' && prog && (
                  <span className="text-[9px] text-white/25 tabular-nums shrink-0">
                    {prog.progress.filter((p, i) => p >= objectiveTarget(quest.objectives[i])).length}/{quest.objectives.length}
                  </span>
                )}
                {tab === 'complete' && <span className="text-[9px] text-green-400/50">Done</span>}
                <span className="text-[9px] text-white/20">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-2 border-t border-[#d4a843]/10 pt-2">
                  <p className="text-[11px] text-white/40 leading-relaxed">{quest.description}</p>

                  {/* Objectives */}
                  <div className="space-y-1">
                    {quest.objectives.map((obj, i) => {
                      const current = prog?.progress[i] ?? 0
                      const target = objectiveTarget(obj)
                      const done = current >= target
                      return (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className={done ? 'text-green-400' : 'text-white/20'}>
                            {done ? '✓' : '○'}
                          </span>
                          <span className={`flex-1 ${done ? 'text-white/40 line-through' : 'text-white/60'}`}>
                            {objectiveLabel(obj)}
                          </span>
                          <span className="text-white/25 tabular-nums text-[9px]">
                            {objectiveProgressText(obj, current)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Rewards */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {quest.rewards.map((r, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#d4a843]/8 text-white/35">
                        {r.type === 'marks' ? `${r.amount} marks` :
                         r.type === 'item' ? `${r.count}× ${r.itemId.replace(/_/g, ' ')}` :
                         r.type === 'xp' ? `${r.amount} ${r.skillId} XP` :
                         r.flag}
                      </span>
                    ))}
                  </div>

                  {/* Start button (available tab only) */}
                  {tab === 'available' && (
                    <button
                      onClick={() => onStart(quest.id)}
                      className="text-[10px] font-display px-3 py-1.5 rounded-lg border border-[#d4a843]/30 text-[#d4a843] hover:bg-[#d4a843]/10 hover:border-[#d4a843]/50 transition-colors"
                    >Start Quest</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
