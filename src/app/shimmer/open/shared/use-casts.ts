'use client'
// THE CAST STATE, ONE HOME (BETA M15b; Alex 11-18: "the tactical and signature should have a universal effect for all
// game modes"). Q / X clocks, the mana refill, castSlot and the HUD chips live HERE so the Ather and the continent on foot
// cast the same way. shared/casting.ts decides every verdict; this carries them out.
//   - surge / impulse move the keeper: the host's walker reads `surge` / `impulse` each frame
//   - a fight cast goes to `castQueue` when the host has a fight (the Wilds' CombatLayer); anywhere else it resolves against
//     nothing, still draws a flash at the aim point, and says "nothing caught"
//   - restore heals the vitals (or reads "you are whole")
import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { castForMove, type CastSpec } from '../../play3d/cast'
import { castMoves, press, freshClock, cooling, type CastSlot, type CastClock } from './casting'
import { useBirth } from '../birth-gate'
import { useLoadout } from './loadout'
import { hudSay, type Mana } from './game-hud'

export interface CastChip { key: string; name: string | null; cool: number; tooDear: boolean }
interface VitalsLike { hp: number; hpMax: number }

const FLASH: Record<string, string> = { field: '255,217,160', projectile: '143,211,255', status: '201,160,255', restore: '143,227,160', infusion: '255,207,112' }
/** Off the Wilds there is nothing to catch, but the cast is still seen: a ring at the aim point (screen centre). */
function flashAtAim(sp: CastSpec) {
  if (typeof document === 'undefined') return
  const c = FLASH[sp.archetype] ?? '255,255,255', el = document.createElement('div')
  el.setAttribute('data-cast-flash', sp.archetype)
  el.style.cssText = `position:fixed;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;pointer-events:none;z-index:60;`
    + `background:radial-gradient(circle,rgba(${c},0.55) 0%,rgba(${c},0.25) 45%,rgba(${c},0) 70%);border:2px solid rgba(${c},0.8)`
  document.body.appendChild(el)
  const done = () => el.remove()
  if (el.animate) el.animate([{ transform: 'scale(0.3)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = done
  else setTimeout(done, 520)
}

export function useCasts(o: {
  manaRef: MutableRefObject<Mana>
  vitalsRef?: MutableRefObject<VitalsLike>
  /** true where a fight holds the cast (the Wilds); false resolves against nothing */
  fightHere: () => boolean
  /** a multiplier on the mana refill (Ather Flow) */
  flow?: () => number
}) {
  const { manaRef } = o
  const birth = useBirth(), loadout = useLoadout()
  const castSet = useMemo(() => castMoves(loadout, birth), [loadout, birth])
  const castSetRef = useRef(castSet); castSetRef.current = castSet
  const oRef = useRef(o); oRef.current = o
  const clocks = useRef<Record<CastSlot, { move: string | null; clock: CastClock }>>({ tactical: { move: null, clock: freshClock(castForMove(null)) }, signature: { move: null, clock: freshClock(castForMove(null)) } })
  const castQueue = useRef<CastSpec[]>([])
  const surge = useRef<{ until: number; mult: number }>({ until: 0, mult: 1 })
  const impulse = useRef<CastSpec | null>(null)
  const handsCastAt = useRef(-Infinity)
  const castHud = useRef<CastChip[]>([])

  const paint = useCallback((now: number) => {
    castHud.current = (['tactical', 'signature'] as CastSlot[]).map(slot => {
      const move = castSetRef.current[slot], sp = castForMove(move), cc = clocks.current[slot]
      return { key: slot === 'tactical' ? 'Q' : 'X', name: move ? sp.label : null, cool: cc.move === move ? cooling(sp, cc.clock, now) : 0, tooDear: !!move && manaRef.current.cur < sp.manaCost }
    })
  }, [manaRef])

  const castSlot = useCallback((slot: CastSlot) => {
    const move = castSetRef.current[slot], cc = clocks.current[slot]
    if (cc.move !== move) clocks.current[slot] = { move, clock: freshClock(castForMove(move)) }
    const v = press(slot, move, clocks.current[slot].clock, performance.now(), manaRef.current.cur)
    if (!v.ok) { hudSay(v.why, 'info'); return }
    clocks.current[slot].clock = v.clock; manaRef.current.cur = v.mana
    paint(performance.now())   // the chip shows the cooldown at once, not a frame later
    handsCastAt.current = performance.now()   // the glove comes up (open-hands.tsx)
    const sp = v.spec, fight = oRef.current.fightHere()
    if (sp.archetype === 'surge') { surge.current = { until: performance.now() + sp.surgeSecs * 1000, mult: sp.surgeMult || 1.5 }; hudSay(sp.label, 'item'); return }
    if (sp.archetype === 'impulse') { impulse.current = sp; hudSay(sp.label, 'item'); return }
    if (fight) { castQueue.current.push(sp); return }   // the Wilds' CombatLayer resolves it and says what it caught
    if (sp.archetype === 'restore') {
      const vt = oRef.current.vitalsRef?.current
      if (vt && vt.hp < vt.hpMax) { vt.hp = Math.min(vt.hpMax, vt.hp + sp.heal); flashAtAim(sp); hudSay(`${sp.label} · +${sp.heal}`, 'item') }
      else hudSay(`${sp.label} · you are whole`, 'item')
      return
    }
    flashAtAim(sp); hudSay(sp.archetype === 'field' ? `${sp.label} · set down, nothing here to hold` : `${sp.label} · nothing caught`, 'item')
  }, [manaRef, paint])

  useEffect(() => {
    let raf = 0, last = performance.now()
    const tick = () => {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now
      const m = manaRef.current
      if (m.cur < m.max) m.cur = Math.min(m.max, m.cur + m.regen * (oRef.current.flow?.() ?? 1) * dt)   // the refill
      paint(now)
      raf = requestAnimationFrame(tick)
    }
    ;(window as unknown as { __casts?: unknown }).__casts = { mana: () => manaRef.current.cur, hud: () => castHud.current }   // harness handle (scripts/cast-everywhere-check.mts)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [manaRef, paint])

  return { castSlot, castQueue, castHud, surge, impulse, handsCastAt, castSet: castSetRef }
}
