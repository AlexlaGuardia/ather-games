'use client'
// RINNING ON THE WAKING CONTINENT, MOUNTED (rinning-nyx.ts has what bites where; shared/rinning-fx.tsx + shared/reel.ts are
// the same rod, wait and reel as the Wilds). One hook so the page adds an import, a call and two JSX lines:
//
//   const rin = useNyxRinning(R, heldId, onFootAndFree)        // heldId = the hotbar item in hand (heldOf(stance, inv))
//   <Canvas> … {rin.fx} … </Canvas>                             // the rod, float, line, rise, splash
//   {rin.bar}                                                   // the reel bar, outside the Canvas
//   rin.prompt()                                                // optional: the line to show ('Click · cast (9 bait left)')
//
// Controls (the Wilds' exactly): bait in hand → the rinstick is out. LEFT MOUSE at open water casts (one bait), LEFT
// MOUSE on the take answers, then HOLD to take line and LET GO to give. Not E (E is the shop doors and boards).
// ★ M22 (11-18): the worn rinstick is EARNED (ather/rinquest.ts, a Rinnshop side quest), so a keeper born after M22 may
// hold bait with no rinstick: no rod comes out and a click says where the first one comes from. A better rinstick's
// `ease` comes in when upgrades do.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Region } from '../region'
import { RinningFX, type RinningApi } from '../shared/rinning-fx'
import { ReelBar } from '../shared/reel-bar'
import type { Rinn, Reel } from '../shared/reel'
import { getInv, setInv } from '../shared/bag'
import { give, take, countOf, NO_BAIT_LINE } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { touch } from '../shared/touch'
import { addOpenXp, openLevel } from '../ather/forestry'
import { BAIT } from '../ather/rinning'
import { perkBonus } from '../shared/companion'
import { loadQuest } from '../ather/rinsticks'
import { hasStick, noStickLine } from '../ather/rinquest'
import { NYX_WATER_Y, nyxIsWater, nyxWaterAt, rollNyxRinn } from './rinning-nyx'

export function useNyxRinning(R: Region | null, held: string | null, active: boolean) {
  const api = useRef<RinningApi | null>(null), holding = useRef<boolean | ((r: Reel) => boolean)>(false)
  const stick = useMemo(() => (typeof window === 'undefined' ? true : hasStick(loadQuest())), [held])   // re-read when the hand changes
  const out = active && held === BAIT && !!R && stick
  const noStickRef = useRef(false); noStickRef.current = active && held === BAIT && !stick
  const outRef = useRef(out); outRef.current = out

  const isWater = useCallback((x: number, z: number) => !!R && nyxIsWater(R, x, z), [R])
  const roll = useCallback((x: number, z: number) => rollNyxRinn(openLevel('rinning'), R ? nyxWaterAt(R, x, z) : 'coast', Math.random), [R])
  const rarer = useCallback((x: number, z: number) => !!R && nyxWaterAt(R, x, z) === 'open', [R])
  const onCatch = useCallback((rn: Rinn) => {
    const perk = perkBonus('rinning')   // Truesight (Embermole / Prismstrike): a second of the same rinn
    const g = give(getInv(), rn.id, perk ? 2 : 1); setInv(g.inv)
    const up = addOpenXp('rinning', rn.xp)
    hudSay(`${perk ? `${perk}! 2 × ` : ''}${rn.name}${g.left ? ' (bag full)' : ''} · +${rn.xp} Rinning${up ? `. Rinning ${up}!` : ''}`, 'item')
  }, [])
  const onGone = useCallback((rn: Rinn) => hudSay(`It got away. ${rn.name}, by the way it moved.`, 'info'), [])

  // left mouse: cast at the aimed water, or answer the take; held = taking line during the reel
  // the click itself, shared by the mouse and a scripted check (headless gets no pointer lock)
  const act = useCallback(() => {
      if (noStickRef.current) { hudSay(noStickLine(loadQuest()), 'info'); return }   // M22
      if (!outRef.current) return
      const r = api.current; if (!r) return
      const v = r.view()
      if (v.phase === 'waiting' || v.phase === 'rising' || v.phase === 'taking') { r.answer(); return }   // a click off the take costs nothing
      if (v.phase !== 'idle' && v.phase !== 'landed' && v.phase !== 'gone') return
      if (!v.aim) { hudSay('Aim at open water to cast.', 'info'); return }
      const spent = take(getInv(), BAIT, 1)
      if (!spent) { hudSay(NO_BAIT_LINE, 'info'); return }
      if (r.cast()) { setInv(spent); if (!countOf(spent, BAIT)) hudSay(NO_BAIT_LINE, 'info') }   // the last bait: where more comes from
  }, [])
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button !== 0) return
      holding.current = true
      if (document.pointerLockElement) act()
    }
    const up = (e: MouseEvent) => { if (e.button === 0) holding.current = false }
    window.addEventListener('mousedown', down); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up) }
  }, [act])
  // PHONE (BETA M79, 11-22): the FIRE button is the click, as in the Wilds (ather/page.tsx, M6a): with bait in hand it casts,
  // answers the take and is the reel's hold. Polled on a timer, not rAF, so a tap shorter than a frame still counts.
  const baitHeld = active && held === BAIT
  useEffect(() => {
    if (!baitHeld) return
    let was = touch.fire
    const id = setInterval(() => {
      const f = touch.fire; if (f === was) return
      was = f; holding.current = f
      if (f) act()
    }, 30)
    return () => { clearInterval(id); holding.current = false }
  }, [baitHeld, act])

  const prompt = useCallback((): string | null => {
    if (!outRef.current) return null
    const v = api.current?.view(); if (!v) return null
    if (v.phase === 'idle' || v.phase === 'landed' || v.phase === 'gone') return v.aim ? `Click · cast (${countOf(getInv(), BAIT)} bait left)` : 'Aim at open water to cast'
    if (v.phase === 'casting' || v.phase === 'waiting') return 'Watch the water…'
    if (v.phase === 'rising') return 'Something is coming…'
    if (v.phase === 'taking') return 'Click to answer it'
    return null   // reeling: the reel bar speaks
  }, [])

  const fx = useMemo(() => R
    ? <RinningFX waterY={NYX_WATER_Y} isWater={isWater} roll={roll} rarer={rarer} api={api} holding={holding} out={out} onCatch={onCatch} onGone={onGone} />
    : null, [R, isWater, roll, rarer, out, onCatch, onGone])
  const bar = out ? <ReelBar api={api} /> : null
  /** for a scripted check: true / false, or 'track' (a stand-in keeper that follows the zone) */
  const hold = useCallback((h: boolean | 'track') => { holding.current = h === 'track' ? (r: Reel) => (r.zone - r.bob) * 6 + (r.zoneV - r.bobV) * 1.6 > 0 : h }, [])
  return { fx, bar, prompt, api, hold, act, baitHeld }
}
