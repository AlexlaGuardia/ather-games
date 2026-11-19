'use client'
// ── MOREL'S AMMO BUBBLE (BETA M33 slice 1) ────────────────────────────────────────────────────────────────────────────────
// The thought bubble by the right glove (where the gem sits): while the trigger is held it shows the rounds left, RED at
// morel.ts RED_AT and under, and it holds a few seconds after release, then fades. WHEN is decided in morel.ts (pure); this
// draws it and puts Morel's two ammo lines on the message line (hudSay 'morel'). Game-UI rule: never raw on the scene,
// always on a plate; tabular numerals. Mount in the Wilds (where guns fire), outside the Canvas; feed it the combat HUD.

import { useEffect, useRef, useState } from 'react'
import { ammoStep, newAmmoWatch, getAmmoFeed, type Bubble, type AmmoFeed } from './morel'
import { MOREL_AMMO } from './morel-lines'
import { hudSay } from './hud-say'

/** `feed` is the fallback; the combat layer's own store (morel.ts setAmmoFeed) wins when it has spoken. */
export function MorelBubble({ feed }: { feed?: React.MutableRefObject<AmmoFeed | null> }) {
  const [b, setB] = useState<Bubble | null>(null)
  // on a phone the right-thumb cluster (touch-controls [data-touch-cluster]) sits where the glove's bubble goes: sit just ABOVE it
  const [over, setOver] = useState<{ right: number; bottom: number } | null>(null)
  const watch = useRef<ReturnType<typeof newAmmoWatch> | null>(null), last = useRef('')
  useEffect(() => {
    let raf = 0
    const said: string[] = []
    ;(window as unknown as { __morel?: unknown }).__morel = { bubble: () => lastB, said: () => [...said] }   // checks' hook: READ only
    let lastB: Bubble | null = null
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const f = getAmmoFeed() ?? feed?.current; if (!f) return
      if (!watch.current) watch.current = newAmmoWatch(f.ammo)
      const r = ammoStep(watch.current, { ammo: f.ammo, clip: f.clip, firing: !!f.firing, reloading: f.reloading, now: performance.now() / 1000 })
      if (r.say) { said.push(r.say); hudSay(MOREL_AMMO[r.say], 'morel') }
      lastB = r.bubble
      // re-render only when what is drawn changes (alpha in 10 steps)
      const sig = r.bubble.show ? `${r.bubble.n}|${r.bubble.red}|${r.bubble.reloading}|${Math.round(r.bubble.alpha * 10)}` : ''
      if (sig !== last.current) {
        last.current = sig; setB(r.bubble.show ? r.bubble : null)
        const c = r.bubble.show ? document.querySelector('[data-touch-cluster]')?.getBoundingClientRect() : null
        setOver(c && c.width ? { right: Math.max(14, window.innerWidth - c.right), bottom: window.innerHeight - c.top + 14 } : null)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); delete (window as unknown as { __morel?: unknown }).__morel }
  }, [feed])
  if (!b) return null
  const ink = b.red ? '#ff6a5c' : '#eaf4fb'
  return (
    <div data-morel-bubble data-red={b.red ? '1' : '0'} style={{ position: 'fixed', right: over ? over.right : 'max(14px, 17vw)', bottom: over ? over.bottom : 'max(150px, 27vh)', zIndex: 32, pointerEvents: 'none', opacity: b.alpha, transition: 'opacity .1s linear' }}>
      <div style={{ background: 'rgba(16,22,30,.78)', border: `1px solid ${b.red ? 'rgba(255,106,92,.7)' : 'rgba(127,182,217,.55)'}`, borderRadius: 14, padding: '5px 11px', boxShadow: '0 2px 10px rgba(0,0,0,.45)', display: 'flex', alignItems: 'baseline', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
        {b.reloading
          ? <span style={{ color: '#9fc4dc', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>reloading</span>
          : <><span data-morel-n style={{ color: ink, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{b.n}</span><span style={{ color: '#8aa3b5', fontSize: 11, fontWeight: 700 }}>/ {b.clip}</span></>}
      </div>
      {/* the thought trail down toward the glove's gem */}
      <div style={{ position: 'absolute', right: 6, bottom: -9, width: 7, height: 7, borderRadius: 9, background: 'rgba(16,22,30,.78)', border: '1px solid rgba(127,182,217,.45)' }} />
      <div style={{ position: 'absolute', right: 0, bottom: -16, width: 4, height: 4, borderRadius: 9, background: 'rgba(16,22,30,.78)', border: '1px solid rgba(127,182,217,.4)' }} />
    </div>
  )
}
