'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchCommands, type CommandEntry } from './command-registry'

interface CommandPaletteProps {
  onClose: () => void
  onSwitchMode: (mode: string) => void
  onNavigate: (href: string) => void
  onDeploy: () => void
}

const CATEGORY_DOT: Record<CommandEntry['category'], string> = {
  editor: 'bg-emerald-400',
  link: 'bg-blue-400',
  action: 'bg-amber-400',
}

const CATEGORY_LABEL: Record<CommandEntry['category'], string> = {
  editor: 'Editor',
  link: 'Link',
  action: 'Action',
}

export default function CommandPalette({ onClose, onSwitchMode, onNavigate, onDeploy }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = searchCommands(query)

  // Clamp selected index when results change
  useEffect(() => {
    setSelectedIndex(prev => (results.length === 0 ? 0 : Math.min(prev, results.length - 1)))
  }, [results.length])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const execute = useCallback((entry: CommandEntry) => {
    if (entry.action === 'switchMode' && entry.mode) {
      onSwitchMode(entry.mode)
    } else if (entry.action === 'navigate' && entry.href) {
      onNavigate(entry.href)
    } else if (entry.action === 'deploy') {
      onDeploy()
    }
    onClose()
  }, [onClose, onDeploy, onNavigate, onSwitchMode])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % (results.length || 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + (results.length || 1)) % (results.length || 1))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const entry = results[selectedIndex]
        if (entry) execute(entry)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [results, selectedIndex, execute, onClose])

  // Scroll selected row into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const row = list.children[selectedIndex] as HTMLElement | undefined
    if (row) row.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative bg-[#0a0a1a]/95 border border-white/15 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-white/10">
          <svg
            className="ml-4 shrink-0 w-3.5 h-3.5 text-white/25"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            placeholder="Search editors..."
            className="bg-transparent text-white text-sm p-4 pl-3 outline-none w-full placeholder:text-white/25"
          />
          <kbd className="mr-4 shrink-0 bg-white/8 border border-white/10 rounded px-1.5 py-0.5 font-mono text-[9px] text-white/25">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[360px] overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] text-white/25">
              No editors found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((entry, i) => (
              <div
                key={entry.id}
                onClick={() => execute(entry)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer text-sm transition-colors ${
                  i === selectedIndex
                    ? 'bg-[#d4a843]/10 text-[#d4a843]'
                    : 'text-white hover:bg-white/5'
                }`}
              >
                {/* Category dot */}
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${CATEGORY_DOT[entry.category]} ${
                    i === selectedIndex ? 'opacity-100' : 'opacity-60'
                  }`}
                />

                {/* Label */}
                <span className="flex-1 font-display">{entry.label}</span>

                {/* Category badge */}
                <span className="text-[9px] text-white/30 uppercase tracking-wider shrink-0">
                  {CATEGORY_LABEL[entry.category]}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/8 flex items-center gap-3">
          <span className="text-[9px] text-white/20">
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span className="text-[9px] text-white/20">
            <kbd className="font-mono">Enter</kbd> select
          </span>
          <span className="text-[9px] text-white/20 ml-auto">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
