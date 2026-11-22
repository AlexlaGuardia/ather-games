'use client'
// M95 LoadScreen: a full-bleed in-engine screenshot, a tip on a dark plate at the bottom, and ATHER as text on some images.
// Mount it where a page is already waiting (ather/page.tsx resume veil, continent/page.tsx `!R`); it adds no load point.
import { useState } from 'react'
import { hearthDisplay, hearthBody } from '../../ui/hearth'
import { LOAD_TIPS, LOAD_IMAGES, pickTip } from './load-tips'

const KEY = 'ather:shimmer:loadTipLast'
const readLast = (): number | null => { try { const v = Number(localStorage.getItem(KEY)); return localStorage.getItem(KEY) === null || !Number.isFinite(v) ? null : v } catch { return null } }
const writeLast = (i: number) => { try { localStorage.setItem(KEY, String(i)) } catch { /* private mode: no memory of the last tip is fine */ } }

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
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'max(24px, env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto', padding: '12px 16px', background: 'rgba(22,20,16,0.88)', border: '1px solid rgba(255,244,214,0.55)', borderRadius: 8, boxSizing: 'border-box' }}>
        <div style={{ ...hearthDisplay, fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', color: '#e8c97a', textTransform: 'uppercase', marginBottom: 6 }}>Tip</div>
        <div style={{ ...hearthBody, fontSize: 15, lineHeight: 1.45, fontWeight: 600, color: '#f6efdc' }}>{tip.text}</div>
        {label && <div style={{ ...hearthBody, fontSize: 11, marginTop: 8, color: 'rgba(246,239,220,0.6)' }}>{label}</div>}
      </div>
    </div>
  )
}
