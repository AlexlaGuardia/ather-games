'use client'

import { useState, useRef, useEffect } from 'react'
import type { Spirit, Species, Element } from '../spirits/spirit'
import { xpForLevel, formStage, ELEMENT_COLORS, SECOND_FORM_NAMES, speciesDisplayName } from '../spirits/spirit'
import { PALETTES, getEvolvedPalette } from '../sprites/palette'
import { drawSprite } from './SpriteRenderers'
import type { SpriteAnim } from '../sprites/sprite-data'

interface SpiritConsoleProps {
  spirits: Spirit[]
  sprites: Record<string, Record<string, SpriteAnim>>
  onClose: () => void
  onSwapParty: (spiritId: string) => void
}

function ConsoleSpriteIcon({ species, element, sprites, size = 32 }: {
  species: Species
  element?: Element
  sprites: Record<string, Record<string, SpriteAnim>>
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
      drawSprite(ctx, anim.frames[0], palette, 0, 0, 'normal')
    }
  }, [species, element, sprites])
  return (
    <canvas
      ref={ref}
      style={{ imageRendering: 'pixelated' as const, width: size, height: size }}
    />
  )
}

export default function SpiritConsole({ spirits, sprites, onClose, onSwapParty }: SpiritConsoleProps) {
  const [partyFullMsg, setPartyFullMsg] = useState(false)

  const party = spirits.filter(s => s.inParty).slice(0, 4)
  const stored = spirits.filter(s => !s.inParty)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleStoredClick(spiritId: string) {
    if (party.length >= 4) {
      setPartyFullMsg(true)
      setTimeout(() => setPartyFullMsg(false), 2200)
      return
    }
    onSwapParty(spiritId)
  }

  function handlePartyClick(spiritId: string) {
    onSwapParty(spiritId)
  }

  // 4 fixed party slots (filled or empty)
  const partySlots: (Spirit | null)[] = [
    party[0] ?? null,
    party[1] ?? null,
    party[2] ?? null,
    party[3] ?? null,
  ]

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="bg-[#16142a]/95 border border-[#d4a843]/35 rounded-xl shadow-lg shadow-black/50 w-[560px] max-h-[480px] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5 border-b border-[#d4a843]/15">
          <span className="font-display text-[13px] text-[#d4a843] tracking-wide">Spirit Console</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors text-sm font-bold"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0 divide-x divide-[#d4a843]/10">

          {/* Left — Active Scrolls */}
          <div className="w-[240px] flex-shrink-0 flex flex-col px-4 py-3 gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display text-[10px] text-[#d4a843]/70 tracking-wider uppercase">Active Scrolls</span>
              <span className="text-[8px] text-white/25">{party.length} / 4</span>
            </div>

            {/* 2x2 grid */}
            <div className="grid grid-cols-2 gap-2 flex-1">
              {partySlots.map((spirit, i) => {
                if (!spirit) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 bg-white/[0.02] min-h-[88px]"
                    >
                      <span className="text-[8px] text-white/15 font-display tracking-wide">Empty Scroll</span>
                    </div>
                  )
                }

                const stage = formStage(spirit.level)
                const formLabel =
                  spirit.element !== 'base'
                    ? (SECOND_FORM_NAMES[spirit.species]?.[spirit.element as Exclude<Element, 'base'>] ?? spirit.element)
                    : stage === 'base' ? 'Base Form' : stage === 'second' ? 'Second Form' : 'Awakened'

                return (
                  <button
                    key={spirit.id}
                    onClick={() => handlePartyClick(spirit.id)}
                    className="flex flex-col items-center gap-1.5 rounded-lg p-2 bg-white/[0.03] border border-[#d4a843]/10 hover:border-[#d4a843]/30 hover:bg-white/[0.06] transition-colors group min-h-[88px]"
                    title="Click to send to storage"
                  >
                    <div className="rounded-md p-1 bg-black/20">
                      <ConsoleSpriteIcon
                        species={spirit.species}
                        element={spirit.element}
                        sprites={sprites}
                        size={32}
                      />
                    </div>
                    <div className="w-full text-center space-y-0.5">
                      <div className="font-display text-[10px] text-white/90 truncate leading-tight">{spirit.name}</div>
                      <div className="text-[8px] text-white/35">{speciesDisplayName(spirit.species)}</div>
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-[8px] text-white/25">Lv.{spirit.level}</span>
                        {spirit.element !== 'base' && (
                          <span
                            className="text-[7px] font-display leading-none"
                            style={{ color: ELEMENT_COLORS[spirit.element] }}
                          >
                            {spirit.element}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Party-full message area — keeps layout stable */}
            <div className="h-4 flex items-center justify-center">
              {partyFullMsg && (
                <span className="text-[9px] text-[#d4a843]/70 font-display animate-pulse">
                  Party full! Remove a scroll first.
                </span>
              )}
            </div>
          </div>

          {/* Right — Stored Scrolls */}
          <div className="flex-1 flex flex-col px-4 py-3 gap-2.5 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-display text-[10px] text-[#d4a843]/70 tracking-wider uppercase">Stored Scrolls</span>
              <span className="text-[8px] text-white/25">{stored.length} / 30 stored</span>
            </div>

            {stored.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-white/20 text-[10px]">
                No spirits in storage
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 space-y-1.5 shimmer-scroll">
                {stored.map(spirit => {
                  const xpNeeded = xpForLevel(spirit.level)
                  const xpPct = xpNeeded > 0 ? Math.min(100, (spirit.xp / xpNeeded) * 100) : 0

                  return (
                    <button
                      key={spirit.id}
                      onClick={() => handleStoredClick(spirit.id)}
                      className="w-full flex items-center gap-2.5 rounded-lg p-2 bg-white/[0.02] border border-white/[0.05] hover:border-[#d4a843]/20 hover:bg-white/[0.05] transition-colors text-left"
                      title="Click to add to party"
                    >
                      <div className="flex-shrink-0 rounded-md p-0.5 bg-black/20">
                        <ConsoleSpriteIcon
                          species={spirit.species}
                          element={spirit.element}
                          sprites={sprites}
                          size={28}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-[11px] text-white/85 truncate">{spirit.name}</span>
                          <span className="text-[8px] text-white/25 flex-shrink-0">Lv.{spirit.level}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] text-white/35">{speciesDisplayName(spirit.species)}</span>
                          {spirit.element !== 'base' && (
                            <>
                              <span className="text-[8px] text-white/15">·</span>
                              <span
                                className="text-[8px] font-display"
                                style={{ color: ELEMENT_COLORS[spirit.element] }}
                              >
                                {SECOND_FORM_NAMES[spirit.species]?.[spirit.element as Exclude<Element, 'base'>] ?? spirit.element}
                              </span>
                            </>
                          )}
                        </div>
                        {/* XP bar */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex-1 h-[2px] bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400/40 rounded-full"
                              style={{ width: `${xpPct}%` }}
                            />
                          </div>
                          <span className="text-[7px] text-white/15 tabular-nums">{Math.round(xpPct)}%</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
