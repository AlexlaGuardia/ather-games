'use client'

import { useState, useMemo } from 'react'
import { NPC_SUMMARY } from '../../world/npcs'

const ZONE_COLORS: Record<string, string> = {
  'garden': '#f0e0a0',
  'mycelial-path': '#9b7fa0',
  'moonwell-glade': '#7fa0c8',
  'spore-hollow': '#a07f90',
  'twilight-thicket': '#7faa7f',
  'mana-springs': '#60a0c0',
  'the-threshold': '#b0a090',
  'spirit-meadow': '#a0c890',
}

const EDITOR_NPCS = NPC_SUMMARY.map(n => ({
  ...n,
  color: ZONE_COLORS[n.zone] ?? '#808080',
}))

interface NPCBrowserProps {
  activeNpcId: string | null
  onSelectNpc: (npcId: string) => void
  graphCounts: Record<string, number>
}

export default function NPCBrowser({ activeNpcId, onSelectNpc, graphCounts }: NPCBrowserProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return EDITOR_NPCS
    const q = search.toLowerCase()
    return EDITOR_NPCS.filter(n =>
      n.name.toLowerCase().includes(q) || n.zone.toLowerCase().includes(q)
    )
  }, [search])

  const zones = useMemo(() => {
    const grouped: Record<string, typeof EDITOR_NPCS> = {}
    for (const npc of filtered) {
      ;(grouped[npc.zone] ??= []).push(npc)
    }
    return grouped
  }, [filtered])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-white/10">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">NPCs</div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search NPCs..."
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-violet-500/50"
        />
      </div>

      {/* NPC list grouped by zone */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {Object.entries(zones).map(([zone, npcs]) => (
          <div key={zone}>
            <div className="text-[9px] text-white/25 uppercase tracking-wider px-1 mb-1">
              {zone.replace(/-/g, ' ')}
            </div>
            {npcs.map(npc => {
              const count = graphCounts[npc.id] ?? 0
              const active = activeNpcId === npc.id
              return (
                <button
                  key={npc.id}
                  onClick={() => onSelectNpc(npc.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all ${
                    active
                      ? 'bg-violet-500/20 border border-violet-500/40'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: npc.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs truncate ${active ? 'text-violet-300' : 'text-white/70'}`}>
                      {npc.name}
                    </div>
                  </div>
                  {count > 0 && (
                    <span className="text-[9px] text-white/30 tabular-nums">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-xs text-white/30 text-center py-4">No NPCs found</div>
        )}
      </div>

      {/* Footer: NPC count */}
      <div className="p-2 border-t border-white/10 text-[9px] text-white/25 text-center">
        {EDITOR_NPCS.length} NPCs
      </div>
    </div>
  )
}
