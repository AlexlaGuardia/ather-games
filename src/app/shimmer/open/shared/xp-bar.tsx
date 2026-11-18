'use client'
// The XP bar (BETA M21, Alex 11-18 "feel the levels"): any XP gain fades a bar in under the compass (skill, level, fill
// to next), it holds while gains keep coming, then fades out. A level-up pops confetti off the bar and the level reads
// in the accent. Hears every gain through xp-feed.ts; GameHud mounts it at the compass's centre, so both maps get it.
import { useEffect, useRef, useState } from 'react'
import { HudPlate } from '../../ui/hearth-hud'
import type { HudFace } from '../../ui/hud-face'
import type { HudSize } from '../../ui/hud-flag'
import { hearthDisplay, hearthBody } from '../../ui/hearth'
import { subscribeXp, fillOf, type XpGain } from './xp-feed'

/** How long the bar stays after the LAST gain (ms), and its fade. */
export const XP_HOLD_MS = 2600
export const XP_FADE_MS = 260
const CONFETTI = ['#f5c542', '#b98cff', '#7fe0c2', '#ff8fa3', '#fff3c4']

export const xpBarWidth = (size: HudSize) => (size === 'phone' ? 170 : 220)

export function XpBar({ face, size, centerX, top }: { face: HudFace; size: HudSize; centerX: number; top: number }) {
  const [g, setG] = useState<XpGain | null>(null)
  const [shown, setShown] = useState(false)
  const [lvlFlash, setLvlFlash] = useState(false)
  const hold = useRef<number | null>(null), flash = useRef<number | null>(null)
  const burst = useRef<HTMLDivElement>(null)

  useEffect(() => subscribeXp(next => {
    setG(next)
    setShown(true)
    if (hold.current) window.clearTimeout(hold.current)
    hold.current = window.setTimeout(() => setShown(false), XP_HOLD_MS)
    if (next.leveledTo) {
      setLvlFlash(true)
      if (flash.current) window.clearTimeout(flash.current)
      flash.current = window.setTimeout(() => setLvlFlash(false), XP_HOLD_MS)
      if (hold.current) window.clearTimeout(hold.current)
      hold.current = window.setTimeout(() => setShown(false), XP_HOLD_MS + 1200)   // a level-up earns a longer look
      popConfetti(burst.current)
    }
  }), [])
  useEffect(() => () => { if (hold.current) window.clearTimeout(hold.current); if (flash.current) window.clearTimeout(flash.current) }, [])

  const W = xpBarWidth(size)
  const fill = g ? fillOf(g) : 0
  return (
    <div className="pointer-events-none" data-hud="xp-bar" data-shown={shown ? '1' : '0'} data-skill={g?.skill ?? ''} data-level={g?.level ?? ''}
         data-fill={fill.toFixed(4)} data-levelup={lvlFlash ? '1' : '0'}
         style={{ position: 'fixed', top, left: centerX, transform: `translateX(-50%) translateY(${shown ? 0 : -4}px)`, zIndex: 34,
                  opacity: shown ? 1 : 0, transition: `opacity ${XP_FADE_MS}ms ease, transform ${XP_FADE_MS}ms ease` }}>
      <div ref={burst} className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0 }} />
      <HudPlate face={face} r={10}>
        <div style={{ width: W, padding: size === 'phone' ? '3px 8px 5px' : '4px 10px 6px' }}>
          <div className="flex items-baseline justify-between leading-none">
            <span style={{ ...hearthDisplay, fontSize: size === 'phone' ? 10 : 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }} data-xp="name">{g?.name ?? ''}</span>
            <span className="tabular-nums" style={{ ...hearthBody, fontSize: size === 'phone' ? 10 : 11, fontWeight: 700,
                  color: lvlFlash ? '#b8860b' : undefined, transition: 'color .3s' }} data-xp="level">
              {lvlFlash ? 'LEVEL UP · ' : ''}Lv {g?.level ?? ''}
            </span>
          </div>
          <div className="relative mt-1 overflow-hidden" style={{ height: 5, borderRadius: 3, background: 'rgba(58,39,22,.35)' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, borderRadius: 3,
                          background: 'linear-gradient(90deg, #c9962e, #f5c542)', transition: 'width .45s cubic-bezier(.2,.8,.2,1)' }} />
          </div>
          {size !== 'phone' && g && (
            <div className="text-right tabular-nums leading-none mt-0.5" style={{ ...hearthBody, fontSize: 9, opacity: 0.7 }}>
              +{g.gained} · {g.xp}/{g.need}
            </div>
          )}
        </div>
      </HudPlate>
    </div>
  )
}

/** A one-shot burst of DOM bits off the bar's centre (Web Animations; nothing left behind). Reduced motion = none. */
function popConfetti(host: HTMLDivElement | null) {
  if (!host || typeof window === 'undefined') return
  try { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return } catch { /* old browser: pop anyway */ }
  const N = 40
  host.dataset.pops = String(Number(host.dataset.pops ?? 0) + 1)   // checks read it
  for (let i = 0; i < N; i++) {
    const d = document.createElement('div')
    const w = 4 + Math.random() * 4, h = 3 + Math.random() * 5
    d.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;border-radius:1px;background:${CONFETTI[i % CONFETTI.length]};pointer-events:none`
    d.dataset.confettiBit = '1'
    host.appendChild(d)
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, v = 60 + Math.random() * 90
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v, fall = 70 + Math.random() * 60, spin = (Math.random() - 0.5) * 720
    const anim = d.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx * 1.3}px,${dy + fall}px) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' })
    anim.onfinish = () => d.remove()
    window.setTimeout(() => d.remove(), 2000)   // a hidden tab never finishes the animation: clean up anyway
  }
}
