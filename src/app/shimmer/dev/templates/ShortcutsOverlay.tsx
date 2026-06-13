'use client'

import { useEffect, useMemo } from 'react'
import type { ShortcutDef } from './shortcut-data'

interface ShortcutsOverlayProps {
  shortcuts: ShortcutDef[]
  onClose: () => void
}

export default function ShortcutsOverlay({ shortcuts, onClose }: ShortcutsOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const grouped = useMemo(() => {
    const map = new Map<string, ShortcutDef[]>()
    for (const s of shortcuts) {
      const cat = s.category ?? 'General'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(s)
    }
    return map
  }, [shortcuts])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-[#0a0a1a]/95 border border-white/15 rounded-xl shadow-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg text-gold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 text-sm transition-colors"
          >
            Esc
          </button>
        </div>

        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-[9px] text-white/30 uppercase tracking-wider mb-2">{category}</h3>
              <div className="space-y-1">
                {items.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-0.5">
                    <kbd className="bg-white/10 rounded px-1.5 py-0.5 font-mono text-[10px] text-white/70 min-w-[60px] text-center shrink-0">
                      {s.key}
                    </kbd>
                    <span className="text-[11px] text-white/50">{s.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 border-t border-white/10">
          <span className="text-[9px] text-white/20">Press ? or Esc to close</span>
        </div>
      </div>
    </div>
  )
}
