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
import { hudSay } from '../shared/hud-say'
import { itemDef } from '../shared/inventory'
import { isBuilding } from './build-mode'
import { FURNITURE, keepstoneFor } from './furniture'

const live = { target: null as Target | null, hits: null as Hits | null, last: -1e9, hitAt: new Map<string, number>(), subs: new Set<() => void>() }
const emit = () => live.subs.forEach(f => f())
/** is there something in reach to hit right now (the phone shows its 'hit' button only then) */
export function useMeleeReady(): boolean {
  return useSyncExternalStore(f => { live.subs.add(f); return () => { live.subs.delete(f) } }, () => !!live.target, () => false)
}
const nameOf = (t: Target) => {
  if (t.kind === 'piece') { const p = currentWorks().pieces.find(x => x.id === t.id); return p ? FURNITURE[p.item]?.name ?? 'It' : 'It' }
  const c = currentWorks().chests.find(x => x.id === t.id); return c ? itemDef(keepstoneFor(c.crystal)).name : 'The Keepstone'
}
/** one swing, now. Returns what happened (checks read it through __melee). */
export function swing(now = performance.now()): 'cooldown' | 'miss' | 'hit' | 'broke' | 'full' {
  if (!canSwing(live.last, now)) return 'cooldown'
  live.last = now
  const t = live.target; if (!t) return 'miss'
  const r = strike(live.hits, t.id, now)
  live.hits = r.hits; live.hitAt.set(t.id, now)
  if (!r.broke) return 'hit'
  if (guestRefuses(m => hudSay(m, 'info', 4))) { live.target = null; emit(); return 'miss' }   // M61: a guest never takes from a mate's plot
  const name = nameOf(t), b = breakTarget(currentWorks(), t, getInv())
  if (!b) { hudSay('Your bag is full.', 'info'); return 'full' }
  setWorks(b.works); setInv(b.inv); live.target = null; emit()
  hudSay(`${name} · back in your bag`, 'item')
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
    g.__melee = { target: () => live.target, hits: () => live.hits, swing: () => swing(), need: MELEE_HITS }   // read-only probes for melee-check (swing = the same call the button makes)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('keydown', key); live.target = null; emit() }
  }, [stowed])
  return null
}
