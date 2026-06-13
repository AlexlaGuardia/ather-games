'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Spirit, Element } from '../spirits/spirit'
import { ELEMENTS, ELEMENT_COLORS, SECOND_FORM_NAMES } from '../spirits/spirit'
import type { SpriteAnim } from '../sprites/sprite-data'
import { PALETTES, getEvolvedPalette } from '../sprites/palette'
import { drawSprite } from './SpriteRenderers'

interface EvolutionOverlayProps {
  spirit: Spirit
  sprites: Record<string, Record<string, SpriteAnim>>
  onComplete: (chosenElement: Exclude<Element, 'base'>) => void
}

type Phase = 'reveal' | 'choose' | 'evolving' | 'done'

export default function EvolutionOverlay({ spirit, sprites, onComplete }: EvolutionOverlayProps) {
  const [phase, setPhase] = useState<Phase>('reveal')
  const [chosen, setChosen] = useState<Exclude<Element, 'base'> | null>(null)
  const [flash, setFlash] = useState(0) // 0-1 flash intensity
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Draw the spirit on canvas (uses element palette once chosen)
  const drawPreview = useCallback((el: HTMLCanvasElement | null) => {
    if (!el) return
    const ctx = el.getContext('2d')!
    el.width = 32; el.height = 32
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 32, 32)
    const spriteData = sprites[spirit.species]
    const anim = spriteData?.battle_front ?? spriteData?.down_idle ?? spriteData?.idle
    if (anim) {
      const palette = chosen
        ? getEvolvedPalette(spirit.species, chosen)
        : (PALETTES[spirit.species]?.base ?? ['#888', '#aaa', '#ccc'])
      drawSprite(ctx, anim.frames[0], palette, 8, 8, 'normal', false)
    }
  }, [spirit.species, sprites, chosen])

  // Auto-advance from reveal to choose
  useEffect(() => {
    if (phase === 'reveal') {
      const t = setTimeout(() => setPhase('choose'), 2000)
      return () => clearTimeout(t)
    }
  }, [phase])

  // Evolving flash animation
  useEffect(() => {
    if (phase !== 'evolving') return
    let frame = 0
    const interval = setInterval(() => {
      frame++
      // Flash up for 15 frames, hold for 5, fade for 10
      if (frame <= 15) setFlash(frame / 15)
      else if (frame <= 20) setFlash(1)
      else if (frame <= 30) setFlash(1 - (frame - 20) / 10)
      else {
        setFlash(0)
        setPhase('done')
        clearInterval(interval)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [phase])

  // Done phase — auto-close after showing result
  useEffect(() => {
    if (phase === 'done' && chosen) {
      const t = setTimeout(() => onComplete(chosen), 2500)
      return () => clearTimeout(t)
    }
  }, [phase, chosen, onComplete])

  const handleChoose = (element: Exclude<Element, 'base'>) => {
    setChosen(element)
    setPhase('evolving')
  }

  const formName = chosen ? SECOND_FORM_NAMES[spirit.species]?.[chosen] ?? spirit.name : null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90">
      {/* Flash overlay */}
      {flash > 0 && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ backgroundColor: `rgba(212, 168, 67, ${flash * 0.8})` }}
        />
      )}

      <div className="relative z-20 text-center max-w-[400px]">
        {/* Spirit preview */}
        <div className="mb-6">
          <canvas
            ref={drawPreview}
            style={{ imageRendering: 'pixelated', width: 96, height: 96, margin: '0 auto' }}
            className={phase === 'evolving' ? 'animate-pulse' : ''}
          />
        </div>

        {/* Reveal phase */}
        {phase === 'reveal' && (
          <div className="animate-fade-in">
            <p className="font-display text-[18px] text-[#d4a843] mb-2">
              Something is happening...
            </p>
            <p className="text-[12px] text-white/50">
              {spirit.name} is ready to evolve!
            </p>
          </div>
        )}

        {/* Choose phase */}
        {phase === 'choose' && (
          <div>
            <p className="font-display text-[14px] text-white/70 mb-1">
              Choose an element for {spirit.name}
            </p>
            <p className="text-[10px] text-white/30 mb-5">
              This determines their second form and unlocks new moves
            </p>

            <div className="grid grid-cols-2 gap-3">
              {ELEMENTS.map(el => {
                const formDisplayName = SECOND_FORM_NAMES[spirit.species]?.[el] ?? el
                return (
                  <button
                    key={el}
                    onClick={() => handleChoose(el)}
                    className="group relative bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-current rounded-lg p-4 transition-all text-left"
                    style={{ color: ELEMENT_COLORS[el] }}
                  >
                    <span className="font-display text-[13px] block mb-1 capitalize">
                      {el}
                    </span>
                    <span className="text-[11px] text-white/50 group-hover:text-white/70 block">
                      {formDisplayName}
                    </span>
                    <div
                      className="absolute top-2 right-2 w-2 h-2 rounded-full opacity-40 group-hover:opacity-80"
                      style={{ backgroundColor: ELEMENT_COLORS[el] }}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Evolving phase */}
        {phase === 'evolving' && (
          <p className="font-display text-[16px] text-[#d4a843] animate-pulse">
            Evolving...
          </p>
        )}

        {/* Done phase */}
        {phase === 'done' && formName && (
          <div>
            <p className="font-display text-[20px] text-[#d4a843] mb-2">
              {formName}
            </p>
            <p className="text-[11px] text-white/40">
              {spirit.name} evolved into {formName}!
            </p>
            <p className="text-[10px] text-white/25 mt-2">
              New elemental moves unlocked
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
