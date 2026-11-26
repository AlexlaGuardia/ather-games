'use client'
// M95 LoadScreen: a full-bleed in-engine screenshot, a tip on a dark plate at the bottom, and ATHER as text on some images.
// Mount it where a page is already waiting (ather/page.tsx resume veil, continent/page.tsx `!R`); it adds no load point.
// M187: under the tip, a Dewbear runs from the left toward a fruit at the right; where it is = the REAL percent of the bytes
// this load fetches (load-progress.ts), shown small beside it; at 100 it is at the fruit. The Dewbear is a flipbook of the
// rig's own run clip (public/open/load/dewbear-run.webp, 12 frames, rendered from dewbear-rigged.glb, scripts/m187-render/),
// so it needs no three.js. The fruit rotates per load through the game's fruit (load-fruit.ts), picture only.
import { useEffect, useState } from 'react'
import { hearthDisplay, hearthBody } from '../../ui/hearth'
import { LOAD_TIPS, LOAD_IMAGES, pickTip } from './load-tips'
import { loadMeter } from './load-progress'
import { pickFruit, fruitSrc, DEFAULT_FRUIT, type LoadFruit } from './load-fruit'

const KEY = 'ather:shimmer:loadTipLast'
const readLast = (): number | null => { try { const v = Number(localStorage.getItem(KEY)); return localStorage.getItem(KEY) === null || !Number.isFinite(v) ? null : v } catch { return null } }
const writeLast = (i: number) => { try { localStorage.setItem(KEY, String(i)) } catch { /* private mode: no memory of the last tip is fine */ } }
const FRUIT_KEY = 'ather:shimmer:loadFruitLast'
const nextFruit = (): LoadFruit => {
  let f: LoadFruit = DEFAULT_FRUIT
  try { f = pickFruit(localStorage.getItem(FRUIT_KEY)); localStorage.setItem(FRUIT_KEY, f) } catch { /* private mode: Sunfruit */ }
  return f
}
/** the flipbook: 12 frames of 184 x 120 side by side, facing right */
const DEW_FRAMES = 12, DEW_ASPECT = 184 / 120

/** The track under the tip: a fixed height from the first frame, so nothing below or above it moves when it fills. */
function LoadRunner() {
  const [fruit, setFruit] = useState<LoadFruit>(nextFruit)
  const [pct, setPct] = useState(() => loadMeter.percent())
  useEffect(() => {
    let raf = 0
    const tick = () => { raf = 0; setPct(loadMeter.percent()) }
    const off = loadMeter.subscribe(() => { if (!raf) raf = requestAnimationFrame(tick) })
    tick()
    return () => { off(); if (raf) cancelAnimationFrame(raf) }
  }, [])
  const H = 'clamp(48px, 7.5vh, 72px)'
  const dewW = `calc(${H} * ${DEW_ASPECT})`, fruitW = `calc(${H} * 0.62)`
  const done = pct >= 100
  return (
    <div data-load-runner={pct} data-load-fruit={fruit} style={{ position: 'relative', height: H, marginTop: 10 }}>
      <style>{`@keyframes m187run { from { transform: translateX(0) } to { transform: translateX(-100%) } }`}</style>
      <img data-load-fruit-img src={fruitSrc(fruit)} alt="" onError={() => { if (fruit !== DEFAULT_FRUIT) setFruit(DEFAULT_FRUIT) }}
        style={{ position: 'absolute', right: 0, bottom: '6%', width: fruitW, height: fruitW, objectFit: 'contain', imageRendering: 'pixelated', filter: 'drop-shadow(0 0 6px rgba(255,226,140,0.55)) drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }} />
      <div data-load-dewbear style={{ position: 'absolute', bottom: 0, height: '100%', width: dewW, left: `calc((100% - ${dewW} - ${fruitW}) * ${pct / 100})`, transition: 'left 0.3s linear' }}>
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))' }}>
          <img src="/open/load/dewbear-run.webp" alt="" style={{ display: 'block', height: '100%', width: `${DEW_FRAMES * 100}%`, maxWidth: 'none', animation: `m187run 0.5s steps(${DEW_FRAMES}) infinite`, animationPlayState: done ? 'paused' : 'running' }} />
        </div>
        <div data-load-pct style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 2, ...hearthBody, fontSize: 11, fontWeight: 700, color: '#f6efdc', textShadow: '0 1px 2px rgba(0,0,0,0.9)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{pct}%</div>
      </div>
    </div>
  )
}

export function LoadScreen({ side, label }: { side: 'ather' | 'nyx'; label?: string }) {
  // picked once per mount, client-side only (the screen only mounts after hydration; lazy init runs once)
  const [pick] = useState(() => {
    const t = pickTip(side, readLast()); writeLast(t)
    const imgs = LOAD_IMAGES.filter(i => i.side === 'both' || i.side === side)
    return { tip: LOAD_TIPS[t], img: imgs.length ? imgs[Math.floor(Math.random() * imgs.length)] : null }
  })
  const { tip, img } = pick
  return (
    <div data-load-screen={side} role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 60, background: '#1b1a17', overflow: 'hidden', pointerEvents: 'auto' }}>
      {img && <img src={img.src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: img.pos ?? '50% 60%' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.12), rgba(0,0,0,0) 35%, rgba(0,0,0,0.35))' }} />
      {img?.title && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '30%', textAlign: 'center', ...hearthDisplay, fontSize: 'clamp(48px, 14vw, 120px)', fontWeight: 700, letterSpacing: '0.32em', paddingLeft: '0.32em', color: '#fff7e0', textShadow: '0 0 24px rgba(255,236,170,0.55), 0 2px 0 rgba(0,0,0,0.45), 0 0 2px rgba(0,0,0,0.8)' }}>ATHER</div>
      )}
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'max(16px, env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto' }}>
        <div data-load-tip style={{ padding: '12px 16px', background: 'rgba(22,20,16,0.88)', border: '1px solid rgba(255,244,214,0.55)', borderRadius: 8, boxSizing: 'border-box' }}>
          <div style={{ ...hearthDisplay, fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', color: '#e8c97a', textTransform: 'uppercase', marginBottom: 6 }}>Tip</div>
          <div style={{ ...hearthBody, fontSize: 15, lineHeight: 1.45, fontWeight: 600, color: '#f6efdc' }}>{tip.text}</div>
          {label && <div style={{ ...hearthBody, fontSize: 11, marginTop: 8, color: 'rgba(246,239,220,0.6)' }}>{label}</div>}
        </div>
        <LoadRunner />
      </div>
    </div>
  )
}
