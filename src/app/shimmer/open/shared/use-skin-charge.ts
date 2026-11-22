'use client'
// M80 (Alex 11-22): HOLD F (both worlds) charges the keeper's own Mana Skin. The phone's SHIELD hold sends KeyF into
// touch.held. The numbers are shared/vitals-economy.ts › ECON.skin*; the page owns the pool ({ cur }) so combat
// (ather/combat.ts › Combat.skin) drains it with every blow and pops it at 0 like the M59 field skin.
import { useEffect, useRef, type MutableRefObject } from 'react'
import { ECON, skinStep, type SkinCharge } from './vitals-economy'
import { touch } from './touch'

export const SKIN_CODE = 'KeyF'
export type SkinPool = { cur: number }
type Vit = { shield: number; shieldMax: number }

/** `active()` false = F does nothing (a menu is open, driving, the birth ritual). `vitals` + `drawn()` true = this hook
 *  draws the skin on the health bar (the Wilds' combat layer draws it itself while it runs). */
export function useSkinCharge(o: {
  mana: MutableRefObject<{ cur: number }>
  skin: MutableRefObject<SkinPool>
  active: () => boolean
  vitals?: MutableRefObject<Vit>
  drawn?: () => boolean
}) {
  const oRef = useRef(o); oRef.current = o
  const key = useRef(false), scripted = useRef<boolean | null>(null)
  useEffect(() => {
    const ch: SkinCharge = { heldFor: 0 }
    const down = (e: KeyboardEvent) => { if (e.code === SKIN_CODE) key.current = true }
    const up = (e: KeyboardEvent) => { if (e.code === SKIN_CODE) key.current = false }
    const blur = () => { key.current = false }
    let raf = 0, last = performance.now()
    const tick = () => {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now
      const O = oRef.current
      const held = (scripted.current ?? (key.current || touch.held.has(SKIN_CODE))) && O.active()
      skinStep(ch, held, dt, O.mana.current, O.skin.current)
      if (O.vitals && (O.drawn?.() ?? true)) { const v = O.vitals.current, s = O.skin.current.cur; v.shield = s; v.shieldMax = s > 0 ? ECON.skinCap : 0 }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // harness handle (scripts/mana-skin-check.mts): read the pool, hold F without a keyboard (null = back to the keys)
    ;(window as unknown as { __skin?: unknown }).__skin = { cur: () => oRef.current.skin.current.cur, held: () => key.current || touch.held.has(SKIN_CODE), hold: (h: boolean | null) => { scripted.current = h } }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [])
}
