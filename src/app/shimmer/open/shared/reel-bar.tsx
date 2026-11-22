'use client'
// THE REEL BAR (shared/reel.ts, re-ruled 11-16: the rinn can get away). Only while a rinn is on the line. One track, the
// far water on the left, the keeper on the right: the lit ZONE is the rinn, moving to its kind's habit; the bobber is
// you (hold = take, let go = give). Keep the bobber inside the zone; the zone's rim goes red as the line strains, and a
// rinn held at the edge too long is gone. The line under it says the kind's habit, so a keeper learns to read it.

import { useEffect, useState, type MutableRefObject } from 'react'
import type { RinningApi } from './rinning-fx'
import { PATTERN_TELL } from './reel'
import { openSkills } from '../ather/forestry'
import { isTouchOnly } from './touch'

/** M77 (11-22): nothing on screen said the reel is a HOLD, and Alex lost every rinn before he found it ("once the control
 *  was explained he got it instantly"). So the bar says it until the keeper's FIRST landed rinn, then never again. Rinning
 *  XP comes only from a landed catch (ather/page.tsx + continent/nyx-rinning.tsx), and it is saved with the keeper's
 *  skills, so "any rinning XP" is exactly "has landed one", per keeper, across reloads and both worlds. */
export const reelHint = (touch: boolean) => (touch ? 'Hold FIRE to pull · let go to give' : 'Hold click to pull · let go to give')
export function landedARinn(): boolean { const k = openSkills().rinning; return k.level > 1 || k.xp > 0 }

export function ReelBar({ api }: { api: MutableRefObject<RinningApi | null> }) {
  const [v, setV] = useState<ReturnType<RinningApi['view']> | null>(null)
  useEffect(() => {
    let id = 0, last = 0
    const loop = (t: number) => { if (t - last > 33) { last = t; setV(api.current?.view() ?? null) } id = requestAnimationFrame(loop) }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [api])
  const r = v?.phase === 'reeling' ? v.reel : null
  if (!r) return null
  const fighting = r.zoneV < -0.02, strain = r.strain
  const hint = landedARinn() ? null : reelHint(isTouchOnly())
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 150, transform: 'translateX(-50%)', width: 'min(380px, 84vw)', zIndex: 60, pointerEvents: 'none', font: '600 13px system-ui, sans-serif', color: '#f4ecd2', textShadow: '0 1px 2px #000' }}>
      <div style={{ textAlign: 'center', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', color: fighting ? '#ffd27a' : '#bdf0c8' }}>
        {fighting ? 'It fights · give' : 'It gives · take'}
      </div>
      {hint && <div data-reel-hint style={{ textAlign: 'center', marginBottom: 6, fontWeight: 700, fontSize: 13, color: '#fff7e0' }}>{hint}</div>}
      {/* the track: far water ← → you */}
      <div style={{ position: 'relative', height: 22, borderRadius: 6, background: 'rgba(12,16,20,0.72)', border: '1px solid rgba(244,236,210,0.35)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: '#e9f6ff', opacity: 0.6 }} />
        {/* the zone: the rinn */}
        <div style={{ position: 'absolute', top: 2, bottom: 2, left: pct(r.zone - r.half), width: pct(r.half * 2), borderRadius: 4,
          background: 'rgba(127,199,232,0.35)', boxShadow: `inset 0 0 0 2px ${strain > 0.05 ? `rgba(232,115,90,${0.4 + strain * 0.6})` : 'rgba(189,240,200,0.75)'}` }} />
        {/* the bobber: you */}
        <div style={{ position: 'absolute', top: 3, bottom: 3, left: `calc(${pct(r.bob)} - 3px)`, width: 6, borderRadius: 3, background: '#fff7e0', boxShadow: '0 0 6px rgba(255,240,200,0.9)' }} />
      </div>
      {/* how far in */}
      <div style={{ height: 4, marginTop: 5, borderRadius: 3, background: 'rgba(12,16,20,0.7)', overflow: 'hidden' }}>
        <div style={{ width: pct(r.progress), height: '100%', background: 'linear-gradient(90deg,#7fc7e8,#e9f6ff)' }} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 5, fontWeight: 500, fontSize: 12, opacity: 0.85 }}>{v?.rinn?.name ? `It ${PATTERN_TELL[r.pattern]}` : ''}</div>
    </div>
  )
}
