'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Spirit, Species, Element } from '../spirits/spirit'
import { xpForLevel, formStage } from '../spirits/spirit'
import type { SpiritIndex, IndexEntry } from '../engine/spirit-index'
import { LAUNCHED_SPECIES, indexStats } from '../engine/spirit-index'
import { PALETTES, getEvolvedPalette } from '../sprites/palette'
import { drawSprite } from './SpriteRenderers'
import type { SpriteAnim } from '../sprites/sprite-data'
import { ELEMENT_COLORS, SECOND_FORM_NAMES, speciesDisplayName } from '../spirits/spirit'

interface GrimoireProps {
  spirits: Spirit[]
  index: SpiritIndex
  sprites: Record<string, Record<string, SpriteAnim>>
  onClose: () => void
}

function TabletSpriteIcon({ species, element, sprites, mode, size = 32 }: {
  species: Species
  element?: Element
  sprites: Record<string, Record<string, SpriteAnim>>
  mode: 'normal' | 'silhouette'
  size?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 32, 32)
    const specSprites = sprites[species]
    const anim = specSprites?.battle_front ?? specSprites?.down_idle ?? specSprites?.idle
    if (anim) {
      const palette = element && element !== 'base'
        ? getEvolvedPalette(species, element)
        : (PALETTES[species]?.base ?? PALETTES.fox.base)
      drawSprite(ctx, anim.frames[0], palette, 0, 0, mode)
    }
  }, [species, element, sprites, mode])
  return <canvas ref={ref} style={{ imageRendering: 'pixelated' as const, width: size, height: size }} />
}

function PartyTab({ spirits, sprites }: { spirits: Spirit[]; sprites: Record<string, Record<string, SpriteAnim>> }) {
  const party = spirits.filter(s => s.inParty).slice(0, 4)

  if (party.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/30 text-[11px]">
        No spirits in party
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {party.map(s => {
        const xpNeeded = xpForLevel(s.level)
        const xpPct = xpNeeded > 0 ? Math.min(100, (s.xp / xpNeeded) * 100) : 0
        const stage = formStage(s.level)
        return (
          <div key={s.id} className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-2 border border-[#d4a843]/10">
            <TabletSpriteIcon species={s.species} element={s.element} sprites={sprites} mode="normal" size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-[12px] text-white/90 truncate">{s.name}</span>
                <span className="text-[9px] text-white/30">Lv.{s.level}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] text-white/40">{speciesDisplayName(s.species)}</span>
                {s.element !== 'base' && (
                  <>
                    <span className="text-[8px] text-white/20">·</span>
                    <span className="text-[8px] font-display" style={{ color: ELEMENT_COLORS[s.element] }}>
                      {SECOND_FORM_NAMES[s.species]?.[s.element as Exclude<Element, 'base'>] ?? s.element}
                    </span>
                  </>
                )}
              </div>
              {/* XP bar */}
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-[2px] bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400/50 rounded-full" style={{ width: `${xpPct}%` }} />
                </div>
                <span className="text-[8px] text-white/20 tabular-nums">{Math.round(xpPct)}%</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function IndexTab({ index, sprites }: { index: SpiritIndex; sprites: Record<string, Record<string, SpriteAnim>> }) {
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null)
  const stats = indexStats(index)

  if (selectedSpecies) {
    const entry = index.entries[selectedSpecies]
    const isSeen = entry.status !== 'unseen'

    return (
      <div>
        <button
          onClick={() => setSelectedSpecies(null)}
          className="text-[9px] text-[#d4a843]/60 hover:text-[#d4a843] mb-2"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-lg p-1 bg-white/[0.03] border border-[#d4a843]/10">
            <TabletSpriteIcon
              species={selectedSpecies}
              sprites={sprites}
              mode={isSeen ? 'normal' : 'silhouette'}
              size={48}
            />
          </div>
          <div>
            <p className="font-display text-[13px] text-white/90">
              {isSeen ? speciesDisplayName(selectedSpecies) : '???'}
            </p>
            <p className="text-[9px] mt-0.5" style={{
              color: entry.status === 'studied' ? '#60c0e0' :
                     entry.status === 'seen' ? '#c0a020' : '#404050',
            }}>
              {entry.status === 'unseen' ? 'Not yet encountered' :
               entry.status === 'seen' ? 'Seen' : 'Studied'}
            </p>
          </div>
        </div>
        {isSeen && (
          <div className="space-y-2 text-[10px] text-white/50">
            <div className="flex justify-between">
              <span>Times seen</span>
              <span className="text-white/70">{entry.timesSeen}</span>
            </div>
            {entry.timesStudied > 0 && (
              <div className="flex justify-between">
                <span>Times studied</span>
                <span className="text-white/70">{entry.timesStudied}</span>
              </div>
            )}
            {entry.elementsStudied.length > 0 && (
              <div>
                <span className="text-[9px] text-white/30 uppercase tracking-wider">Elements observed</span>
                <div className="flex gap-1.5 mt-1">
                  {entry.elementsStudied.map(el => (
                    <span key={el} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5" style={{ color: ELEMENT_COLORS[el] }}>
                      {el}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-3 text-[9px] text-white/40">
        <span>Seen: <span className="text-white/60">{stats.seen}</span>/{stats.total}</span>
        <span>Studied: <span className="text-[#60c0e0]">{stats.studied}</span></span>
      </div>
      {/* Species grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {LAUNCHED_SPECIES.map(species => {
          const entry = index.entries[species]
          const isSeen = entry.status !== 'unseen'
          const borderColor = entry.status === 'studied' ? 'rgba(96,192,224,0.2)' :
                             entry.status === 'seen' ? 'rgba(192,160,32,0.15)' :
                             'rgba(255,255,255,0.04)'

          return (
            <button
              key={species}
              onClick={() => setSelectedSpecies(species)}
              className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors hover:bg-white/[0.04]"
              style={{ border: `1px solid ${borderColor}` }}
            >
              <TabletSpriteIcon
                species={species}
                sprites={sprites}
                mode={isSeen ? 'normal' : 'silhouette'}
                size={28}
              />
              <span className="text-[8px] text-white/40 truncate w-full text-center">
                {isSeen ? speciesDisplayName(species) : '???'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Grimoire({ spirits, index, sprites, onClose }: GrimoireProps) {
  const [tab, setTab] = useState<'party' | 'index'>('party')

  // Keyboard: Escape to close, left/right to switch tabs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 't' || e.key === 'T') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        setTab('party')
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        setTab('index')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
      <div className="bg-[#16142a]/95 border border-[#d4a843]/35 rounded-xl shadow-lg shadow-black/50 w-[340px] max-h-[380px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#d4a843]/15">
          <span className="font-display text-[12px] text-[#d4a843] tracking-wide">Grimoire</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors text-sm font-bold"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#d4a843]/15">
          {(['party', 'index'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-1.5 text-[10px] font-display uppercase tracking-wider transition-colors"
              style={{
                color: tab === t ? '#d4a843' : 'rgba(255,255,255,0.3)',
                borderBottom: tab === t ? '1px solid #d4a843' : '1px solid transparent',
              }}
            >
              {t === 'party' ? 'Party' : 'Spirit Index'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {tab === 'party' ? (
            <PartyTab spirits={spirits} sprites={sprites} />
          ) : (
            <IndexTab index={index} sprites={sprites} />
          )}
        </div>
      </div>
    </div>
  )
}
