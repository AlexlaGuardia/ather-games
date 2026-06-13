'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { GRIMOIRE, type GrimoireEntry, type FormStage } from '../../spirits/grimoire'
import { LAUNCHED_SPECIES } from '../../engine/spirit-index'
import { ELEMENT_COLORS } from '../../spirits/spirit'
import { type Species } from '../../spirits/spirit'
import { type SpriteAnim } from '../../sprites/sprite-data'
import { AnimPlayer } from '../../components/SpriteRenderers'

interface Props {
  selected: string
  onSelect: (id: string) => void
  // Sprite data for base species (for previews)
  allSpiritsData: { id: string; sprites: Record<string, SpriteAnim>; palettes: Record<string, readonly string[]> }[]
}

const FORM_COLORS: Record<FormStage, string> = {
  base: 'text-white/50',
  second: 'text-amber-400/70',
  awakened: 'text-violet-400/70',
}

const FORM_LABELS: Record<FormStage, string> = {
  base: 'Base',
  second: '2nd',
  awakened: 'Awk',
}

export default function GrimoireSelector({ selected, onSelect, allSpiritsData }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [formFilter, setFormFilter] = useState<FormStage | 'all'>('all')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const entry = useMemo(() => GRIMOIRE.find(e => e.id === selected), [selected])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Scroll to selected on open
  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.querySelector('[data-selected="true"]')
      if (el) el.scrollIntoView({ block: 'center' })
    }
  }, [open])

  const filtered = useMemo(() => {
    return GRIMOIRE.filter(e => {
      if (formFilter !== 'all' && e.form !== formFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return e.name.toLowerCase().includes(q) || e.id.includes(q) || e.baseSpecies.includes(q)
    })
  }, [search, formFilter])

  // Get base species sprite data for preview
  const baseData = entry ? allSpiritsData.find(s => s.id === entry.baseSpecies) : null
  const basePal = baseData?.palettes.base

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => { setOpen(!open); setSearch('') }}
        className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-gold/30 transition-all min-w-[260px]"
      >
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          {baseData?.sprites.icon && basePal && (
            <AnimPlayer anim={baseData.sprites.icon} palette={basePal} scale={2} mode="normal" />
          )}
          {!baseData?.sprites.icon && (
            <div className="w-8 h-8 rounded border border-dashed border-white/20 flex items-center justify-center text-white/15 text-[9px]">?</div>
          )}
        </div>
        <div className="text-left flex-1 min-w-0">
          <div className="text-sm font-display text-white/90 truncate">{entry?.name ?? selected}</div>
          <div className="text-[9px] text-white/30 flex items-center gap-1.5">
            <span className="font-mono">#{String(entry?.number ?? 0).padStart(3, '0')}</span>
            {entry && <span className={FORM_COLORS[entry.form]}>{FORM_LABELS[entry.form]}</span>}
            {entry?.element && (
              <span className="capitalize" style={{ color: ELEMENT_COLORS[entry.element as keyof typeof ELEMENT_COLORS] + '80' }}>{entry.element}</span>
            )}
          </div>
        </div>
        <svg className={`w-3 h-3 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-[360px] bg-[#0d0d1a] border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {/* Search + filter */}
          <div className="p-2 border-b border-white/5 space-y-2">
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search spirits..."
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs text-white/80 outline-none focus:border-gold/30 placeholder:text-white/20"
            />
            <div className="flex gap-1">
              {(['all', 'base', 'second', 'awakened'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormFilter(f)}
                  className={`px-2 py-0.5 rounded text-[9px] transition-all ${
                    formFilter === f ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/50'
                  }`}
                >
                  {f === 'all' ? `All (${GRIMOIRE.length})` : `${FORM_LABELS[f]} (${GRIMOIRE.filter(e => e.form === f).length})`}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div ref={listRef} className="max-h-[450px] overflow-y-auto">
            {filtered.map(e => {
              const isSel = e.id === selected
              const spriteData = allSpiritsData.find(s => s.id === e.baseSpecies)
              const pal = spriteData?.palettes.base
              const launched = e.form === 'base' && LAUNCHED_SPECIES.includes(e.baseSpecies as Species)
              const hasSprites = !!spriteData?.sprites.icon && e.form === 'base'

              return (
                <button
                  key={e.id}
                  data-selected={isSel}
                  onClick={() => { onSelect(e.id); setOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-1.5 text-left transition-all ${
                    isSel ? 'bg-gold/10 border-l-2 border-gold/50' : 'hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  {/* Preview or blank */}
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {hasSprites && spriteData?.sprites.icon && pal ? (
                      <AnimPlayer anim={spriteData.sprites.icon} palette={pal} scale={2} mode="normal" />
                    ) : (
                      <div className="w-6 h-6 rounded border border-dashed border-white/10" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-display truncate ${isSel ? 'text-gold' : 'text-white/70'}`}>{e.name}</span>
                      {launched && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 text-[8px]">
                      <span className="text-white/20 font-mono">{e.baseSpecies}</span>
                      {e.element && (
                        <span className="capitalize" style={{ color: ELEMENT_COLORS[e.element as keyof typeof ELEMENT_COLORS] + '60' }}>{e.element}</span>
                      )}
                      {e.branch && <span className="text-violet-400/40">{e.branch}</span>}
                    </div>
                  </div>

                  {/* Number + form badge */}
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-white/15 font-mono block">#{String(e.number).padStart(3, '0')}</span>
                    <span className={`text-[8px] ${FORM_COLORS[e.form]}`}>{FORM_LABELS[e.form]}</span>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-white/20 text-xs">No spirits match "{search}"</div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-white/5 text-[9px] text-white/15">
            {GRIMOIRE.length} spirits &middot; {filtered.length} shown
          </div>
        </div>
      )}
    </div>
  )
}
