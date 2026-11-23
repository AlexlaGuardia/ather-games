'use client'
// MELEE in the plot (BETA M42): the live side of melee.ts. In the Canvas, every frame, what a swing from the eye would land on;
// stowed + RIGHT-CLICK (pointer locked) swings, the phone's 'hit' button (pressKey('Melee')) swings; each landed hit wobbles the
// thing and the third pops it back into the bag. Armed right-click is still the sights (combat-layer reads it); a held item or a
// drawn gun never swings. Mounted by WorkshopScene, so it only ever runs on the keeper's own plot.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { guestRefuses } from './plot-visit'
import { meleeTarget, strike, canSwing, breakTarget, MELEE_HITS, type Target, type Hits } from './melee'
import { currentWorks, setWorks } from './workshop'
import { getInv, setInv } from '../shared/bag'
import { getPots, setPots } from './spirit-panels'
import { getBoxes, setBoxes } from './planter-box-view'   // M113: a Planter Box's sapling rides along
import { hudSay } from '../shared/hud-say'
import { BLOOMED_SPIRIT_LINE } from './planter-lines'
import { itemDef } from '../shared/inventory'
import { isBuilding } from './build-mode'
import { FURNITURE, keepstoneFor } from './furniture'
import { pickSwing, strikeMs, swingPool, type HandAction } from '../shared/fp-actions'   // M82: the punch pool

const live = { target: null as Target | null, hits: null as Hits | null, last: -1e9, hitAt: new Map<string, number>(), subs: new Set<() => void>(),
  // M82 punch pool: the punch this swing plays, and the blow it owes (it lands on the punch's strike key, not on the click)
  swingIdx: -1, swingAction: null as HandAction | null, pending: null as { at: number; target: Target } | null }
const emit = () => live.subs.forEach(f => f())
/** is there something in reach to hit right now (the phone shows its 'hit' button only then) */
export function useMeleeReady(): boolean {
  return useSyncExternalStore(f => { live.subs.add(f); return () => { live.subs.delete(f) } }, () => !!live.target, () => false)
}
const nameOf = (t: Target) => {
  if (t.kind === 'table') return 'The planning table'
  if (t.kind === 'piece') { const p = currentWorks().pieces.find(x => x.id === t.id); return p ? FURNITURE[p.item]?.name ?? 'It' : 'It' }
  const c = currentWorks().chests.find(x => x.id === t.id); return c ? itemDef(keepstoneFor(c.crystal)).name : 'The Keepstone'
}
/** M82 s3: performance.now() of the last swing that went (hit or miss; a cooldown press is not a swing): the hands play the
 *  authored swing from it. -1e9 = never. */
export const lastSwingAt = () => live.last
/** the punch the last swing picked (fp-actions pickSwing), for the hands */
export const lastSwingAction = () => live.swingAction

/** one swing, now: picks a punch from the pool and owes its blow to whatever is aimed at, landing on the punch's strike key.
 *  Returns 'cooldown', 'miss' (nothing in reach) or 'hit' (a blow is on its way); checks read it through __melee. */
export function swing(now = performance.now()): 'cooldown' | 'miss' | 'hit' {
  if (!canSwing(live.last, now)) return 'cooldown'
  if (live.pending) land(live.pending.target, now)   // a blow still owed lands first: a fast second punch never eats the first
  live.pending = null
  live.last = now
  const pk = pickSwing(live.swingIdx); live.swingIdx = pk.i; live.swingAction = pk.action
  const t = live.target; if (!t) return 'miss'
  const ms = strikeMs(pk.action)
  live.pending = { at: now + ms, target: t }
  // the blow lands on REAL time, not on a drawn frame (a hidden tab or a headless check draws none; MeleeAim settles it too)
  if (typeof window !== 'undefined') window.setTimeout(() => settleBlow(), ms + 1)
  return 'hit'
}
/** the blow owed by the last swing, if its strike key has landed by `now` (MeleeAim calls this every frame) */
export function settleBlow(now = performance.now()) { const p = live.pending; if (p && now >= p.at) { live.pending = null; land(p.target, now) } }
function land(t: Target, now: number): 'hit' | 'broke' | 'full' | 'miss' {
  const r = strike(live.hits, t.id, now)
  live.hits = r.hits; live.hitAt.set(t.id, now)
  if (!r.broke) return 'hit'
  if (guestRefuses(m => hudSay(m, 'info', 4))) { live.target = null; emit(); return 'miss' }   // M61: a guest never takes from a mate's plot
  const name = nameOf(t), b = breakTarget(currentWorks(), t, getInv(), getPots(), getBoxes())   // M106 fix: a planter's pot rides along
  if (b === 'spirit') { hudSay(BLOOMED_SPIRIT_LINE, 'info'); return 'full' }
  if (!b) { hudSay('Your bag is full.', 'info'); return 'full' }
  const carried = b.pots !== getPots(), sap = b.boxes !== getBoxes()
  setWorks(b.works); setInv(b.inv); setPots(b.pots); setBoxes(b.boxes); live.target = null; emit()
  hudSay(carried ? `${name} · back in your bag. Its seed goes with it.` : sap ? `${name} · back in your bag. Its sapling goes with it.` : `${name} · back in your bag`, 'item')
  return 'broke'
}

/** wobble for a hit thing: wrap its mesh in this group */
export function useHitWobble(id: string) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const at = live.hitAt.get(id), el = g.current; if (!el) return
    const a = at == null ? 1 : (performance.now() - at) / 260
    if (a >= 1) { if (el.rotation.z !== 0) { el.rotation.z = 0; el.rotation.x = 0; el.scale.setScalar(1) } return }
    const k = (1 - a) * (1 - a), s = Math.sin(a * Math.PI * 4)
    el.rotation.z = s * 0.09 * k; el.rotation.x = s * 0.05 * k; el.scale.setScalar(1 - 0.05 * k)
  })
  return g
}

export function MeleeAim({ stowed }: { stowed: () => boolean }) {
  const { camera } = useThree()
  const o = useRef(new THREE.Vector3()), d = useRef(new THREE.Vector3())
  useFrame(() => {
    settleBlow()   // M82: a punch's blow lands on its strike key
    let t: Target | null = null
    if (stowed() && !isBuilding() && !document.querySelector('[data-panel]')) {
      camera.getWorldPosition(o.current); camera.getWorldDirection(d.current)
      t = meleeTarget(currentWorks(), [o.current.x, o.current.y, o.current.z], [d.current.x, d.current.y, d.current.z])
    }
    if ((t?.id ?? null) !== (live.target?.id ?? null)) { live.target = t; emit() } else live.target = t
  })
  useEffect(() => {
    const down = (e: MouseEvent) => { if (e.button === 2 && document.pointerLockElement && stowed() && !isBuilding()) swing() }
    const key = (e: KeyboardEvent) => { if (e.code === 'Melee' && stowed()) swing() }   // the phone's 'hit' button
    window.addEventListener('mousedown', down); window.addEventListener('keydown', key)
    const g = window as unknown as { __melee?: unknown }
    g.__melee = { target: () => live.target, hits: () => live.hits, swing: () => swing(), need: MELEE_HITS, punch: () => live.swingIdx, pool: () => swingPool().length, pending: () => !!live.pending }   // read-only probes for melee-check (swing = the same call the button makes)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('keydown', key); live.target = null; emit() }
  }, [stowed])
  return null
}
