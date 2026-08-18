'use client'

/**
 * ── ★★ REVEAL, NOT CHOOSE (#262 slice ④, 2026-08-18) ───────────────────────────────────────────
 *
 * This component was fully written and mounted NOWHERE — zero references outside its own file since
 * it was authored. `game/alchemy.md`'s complaint that *"the build announces 'ready to evolve!' and
 * then nothing happens"* was generous: the announcement was not reachable either.
 *
 * ★ AND THE ORPHAN WAS BUILT ON THE PREMISE CANON REFUSES. Its middle phase was *"Choose an element
 * for {spirit}"* — a free pick of all four, `onComplete(chosenElement)`. Canon rules a spirit's
 * second form is **set at level 34 by DOMINANT INFUSION**, and that the Infusions are the only road
 * to an evolved form. A menu of four at the moment of evolution does not tune that rule, it deletes
 * it: the herbs, the brews and every pour become decoration for a choice made at the end anyway.
 * `engine/farming.ts` had already written the same lesson about blooms in its own words — letting
 * the player pick *"contradicts the world rather than tuning it."*
 *
 * So the middle is gone. What is left is the one honest job: **show the keeper the form their
 * infusions already earned**, and name the element that earned it, so the reveal reads as a
 * consequence of what they did rather than as a dice roll.
 *
 * ⚠ THE OVERLAY DOES NOT EVOLVE ANYTHING. The caller applies `evolveSpirit()` and persists FIRST,
 * then shows this for the result. A component that both decides and animates is one dismissed
 * dialog away from a spirit that was announced as evolved and never was — and the animation is the
 * part a player can interrupt.
 *
 * ⚠ The element grid is gone, and with it a bug: it mapped `ELEMENTS`, which included `'base'` when
 * this was written, so the free pick offered five options — one of them "evolve into no element".
 */

import { useState, useEffect, useCallback } from 'react'
import type { Spirit } from '../spirits/spirit'
import { ELEMENT_COLORS } from '../spirits/spirit'
import type { PendingEvolution } from '../spirits/evolution'
import type { SpriteAnim } from '../sprites/sprite-data'
import { PALETTES, getEvolvedPalette } from '../sprites/palette'
import { drawSprite } from './SpriteRenderers'

interface EvolutionOverlayProps {
  spirit: Spirit
  /** The form the infusions earned — already applied by the caller. Display only. */
  evolution: PendingEvolution
  /**
   * ── ★ OPTIONAL, AND THAT IS NOT DEFENSIVE PADDING ───────────────────────────────────────────
   * This overlay was written for the 2D tilemap game, which is archived. `drawSprite` + `PALETTES`
   * are that 2D pipeline, and NEITHER live surface loads it: play3d supplies no sprite record at
   * all, and `grimoire-tab.tsx`'s header explains why the voxel world will not drag it in just to
   * draw a thumbnail. Requiring sprites here would make the single most memorable moment in the
   * game the one screen that cannot be shown.
   *
   * So it degrades to a lit cube in the element's colour — the same call `grimoire-tab` makes, for
   * the reason it gives: *"that is the world's own visual language and it needs no art to exist."*
   */
  sprites?: Record<string, Record<string, SpriteAnim>>
  onComplete: () => void
}

type Phase = 'reveal' | 'evolving' | 'done'

export default function EvolutionOverlay({ spirit, evolution, sprites, onComplete }: EvolutionOverlayProps) {
  const [phase, setPhase] = useState<Phase>('reveal')
  const [flash, setFlash] = useState(0)
  // The evolved look lands WITH the flash, not before it — until then this is still the spirit the
  // keeper has been raising, which is what makes the change read as a change.
  const evolved = phase === 'done'
  const tint = ELEMENT_COLORS[evolution.element]
  const hasSprite = !!sprites?.[spirit.species]

  const drawPreview = useCallback((el: HTMLCanvasElement | null) => {
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    el.width = 32; el.height = 32
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 32, 32)
    const spriteData = sprites?.[spirit.species]
    const anim = spriteData?.battle_front ?? spriteData?.down_idle ?? spriteData?.idle
    if (!anim) return
    const palette = evolved
      ? getEvolvedPalette(spirit.species, evolution.element)
      : (PALETTES[spirit.species]?.base ?? ['#888', '#aaa', '#ccc'])
    drawSprite(ctx, anim.frames[0], palette, 8, 8, 'normal', false)
  }, [spirit.species, sprites, evolved, evolution.element])

  useEffect(() => {
    if (phase !== 'reveal') return
    const t = setTimeout(() => setPhase('evolving'), 2200)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'evolving') return
    let frame = 0
    const interval = setInterval(() => {
      frame++
      if (frame <= 15) setFlash(frame / 15)
      else if (frame <= 20) setFlash(1)
      else if (frame <= 30) setFlash(1 - (frame - 20) / 10)
      else { setFlash(0); setPhase('done'); clearInterval(interval) }
    }, 50)
    return () => clearInterval(interval)
  }, [phase])

  useEffect(() => {
    if (phase !== 'done') return
    const t = setTimeout(onComplete, 3000)
    return () => clearTimeout(t)
  }, [phase, onComplete])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90">
      {flash > 0 && (
        <div className="absolute inset-0 z-10 pointer-events-none"
             style={{ backgroundColor: `rgba(212, 168, 67, ${flash * 0.8})` }} />
      )}

      <div className="relative z-20 max-w-[400px] text-center">
        <div className="mb-6">
          {hasSprite ? (
            <canvas ref={drawPreview}
                    style={{ imageRendering: 'pixelated', width: 96, height: 96, margin: '0 auto' }}
                    className={phase === 'evolving' ? 'animate-pulse' : ''} />
          ) : (
            <span aria-hidden
                  className={`mx-auto block rounded-[6px] ${phase === 'evolving' ? 'animate-pulse' : ''}`}
                  style={{
                    width: 96, height: 96,
                    background: evolved ? tint : ELEMENT_COLORS.base,
                    transition: 'background 320ms ease',
                    boxShadow: 'inset 6px 6px 0 rgba(255,255,255,0.26), inset -6px -6px 0 rgba(0,0,0,0.34)',
                  }} />
          )}
        </div>

        {phase === 'reveal' && (
          <div className="animate-fade-in">
            <p className="font-display mb-2 text-[18px] text-[#d4a843]">Something is happening…</p>
            {/* ★ The cause, named. Without this line the reveal is a slot machine; with it, it is
                the keeper's own farming and brewing coming back to them. */}
            <p className="text-[12px] text-white/50">
              {spirit.name} has taken enough{' '}
              <span style={{ color: tint }} className="capitalize">{evolution.element}</span>
              {' '}to change.
            </p>
          </div>
        )}

        {phase === 'evolving' && (
          <p className="font-display animate-pulse text-[16px] text-[#d4a843]">Evolving…</p>
        )}

        {phase === 'done' && (
          <div>
            <p className="font-display mb-2 text-[20px]" style={{ color: tint }}>{evolution.formName}</p>
            <p className="text-[11px] text-white/40">{spirit.name} became {evolution.formName}.</p>
            <p className="mt-2 text-[10px] capitalize text-white/25">
              {evolution.element} was the strongest infusion in them
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
