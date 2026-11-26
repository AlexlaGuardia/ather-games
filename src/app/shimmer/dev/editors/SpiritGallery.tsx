'use client'
// BETA M213 s1 (sprites, 2026-11-26): THE SPIRIT GALLERY, /shimmer/dev?mode=spirits (owner: the /shimmer/dev gate, src/proxy.ts).
// Alex 11-26 18:0x: "lets give the models a home in the /dev page with a tool that just shows the grimiore basically ... a dial that
// scrolls up and down just showing the number, icon and name of the spirit.. starting with the base spirits and onward".
// LEFT: the dial (wheel, drag, arrow keys, click), rows = number, icon, name (spirit-gallery.ts: base 10, then the 40 forms in
// discovery order). RIGHT: the selected spirit LIVE as the game mounts her (SpiritStage = spirit-model.tsx's own SpiritModel: glb,
// rig, materials, form fx, glow accent), orbit + zoom, her clips; a form with no model yet shows her locked art, NOT BUILT.
// Labels are plain functional UI words (for @lark). The grimoire look gets tuned here later; desktop first.
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { GALLERY, dialStep, galleryNo, type GalleryElement, type GalleryRow } from './spirit-gallery'
import { SpiritStage } from '../../open/ather/spirit-model'
import { formLook, spiritModelFor, type SpiritLook } from '../../open/ather/spirit-models'
import { RIG_CLIPS, type RigClip } from '../../open/ather/spirit-rig'
import { ELEMENT_COLORS } from '../../spirits/spirit'

const ROW = 52, SHOWN = 11
const GAME = 'var(--font-game), system-ui, sans-serif'
const ELS: GalleryElement[] = ['mana', 'storm', 'earth', 'water']

const lookOf = (r: GalleryRow): SpiritLook | null => (r.el ? formLook(r.sp, r.el) : spiritModelFor(r.sp))

const initialIndex = () => {
  if (typeof window === 'undefined') return 0
  const n = Number(new URLSearchParams(window.location.search).get('spirit'))
  return Number.isFinite(n) && n >= 1 && n <= GALLERY.length ? n - 1 : 0
}

export default function SpiritGallery() {
  const [i, setI] = useState(initialIndex)
  const [clip, setClip] = useState<RigClip>('idle')
  const row = GALLERY[i], look = lookOf(row)
  const [glow, setGlow] = useState<GalleryElement | null>(row.el)
  const go = useCallback((by: number) => setI(v => dialStep(v, by)), [])

  // her own element's glow by default (a base: none); the clip goes back to idle on a new spirit
  useEffect(() => { setGlow(row.el); setClip('idle')
    const u = new URL(window.location.href); u.searchParams.set('spirit', String(row.num)); window.history.replaceState({}, '', u.toString()) }, [row])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const by = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : e.key === 'PageDown' ? 5 : e.key === 'PageUp' ? -5 : 0
      if (by) { e.preventDefault(); go(by) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // the wheel: one row per notch (a trackpad's small deltas add up to a notch)
  const dial = useRef<HTMLDivElement>(null), wheelAcc = useRef(0)
  useEffect(() => {
    const el = dial.current; if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheelAcc.current += e.deltaY
      while (Math.abs(wheelAcc.current) >= 40) { const s = Math.sign(wheelAcc.current); go(s); wheelAcc.current -= s * 40 } }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [go])
  // the drag: one row per ROW px dragged, opposite the finger (drag up = further down the list)
  const drag = useRef<{ y: number; moved: boolean } | null>(null)
  const onDown = (e: RPointerEvent) => { drag.current = { y: e.clientY, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const onMove = (e: RPointerEvent) => { const d = drag.current; if (!d) return
    const rows = Math.trunc((d.y - e.clientY) / ROW); if (rows) { go(rows); d.y -= rows * ROW; d.moved = true } }
  const onUp = () => { setTimeout(() => { drag.current = null }, 0) }

  const meals = glow ? Array.from({ length: 10 }, () => glow) : undefined
  const half = Math.floor(SHOWN / 2)

  return (
    <div data-spirit-gallery style={{ display: 'flex', gap: 16, minHeight: 640, color: '#f3e6cc' }}>
      {/* the dial */}
      <div style={{ width: 300, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: GAME, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.55 }}>Spirits · {GALLERY.length}</div>
        <div ref={dial} data-gallery-dial tabIndex={0} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ position: 'relative', height: ROW * SHOWN, overflow: 'hidden', borderRadius: 10, background: 'rgba(24,16,10,.82)', border: '1px solid rgba(245,197,66,.22)',
            touchAction: 'none', userSelect: 'none', cursor: 'ns-resize', outline: 'none' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: half * ROW, height: ROW, background: 'rgba(245,197,66,.10)', borderTop: '1px solid rgba(245,197,66,.45)', borderBottom: '1px solid rgba(245,197,66,.45)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${(half - i) * ROW}px)`, transition: 'transform 140ms ease-out' }}>
            {GALLERY.map((r, k) => {
              const d = Math.abs(k - i), on = k === i
              if (d > half + 1) return <div key={r.num} data-gallery-row={r.num} data-gallery-name={r.name} data-selected="0" style={{ height: ROW }} />
              const c = r.el ? ELEMENT_COLORS[r.el] : ELEMENT_COLORS.base
              return (
                <div key={r.num} data-gallery-row={r.num} data-gallery-name={r.name} data-selected={on ? '1' : '0'}
                  onClick={() => { if (!drag.current?.moved) setI(k) }}
                  style={{ height: ROW, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', cursor: 'pointer',
                    opacity: on ? 1 : Math.max(0.22, 0.62 - d * 0.08), transform: `scale(${on ? 1 : Math.max(0.9, 1 - d * 0.02)})`, transformOrigin: 'left center' }}>
                  <span style={{ fontFamily: GAME, fontVariantNumeric: 'tabular-nums', fontSize: 12, letterSpacing: '0.06em', width: 40, opacity: on ? 0.9 : 0.6 }}>{galleryNo(r.num)}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.icon} alt="" draggable={false} style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 8, background: 'rgba(255,236,190,.08)', boxShadow: on ? `0 0 0 1px ${c}` : 'none' }} />
                  <span style={{ fontFamily: GAME, fontWeight: 600, fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: on ? '#ffe9b0' : '#f3e6cc' }}>{r.name}</span>
                  {!lookOf(r) && <span style={{ marginLeft: 'auto', fontFamily: GAME, fontSize: 9, letterSpacing: '0.16em', opacity: 0.45 }}>ART</span>}
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.45 }}>Wheel, drag or ↑ ↓ to turn the dial.</div>
      </div>

      {/* the stage */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: GAME, fontVariantNumeric: 'tabular-nums', fontSize: 13, opacity: 0.6 }}>{galleryNo(row.num)}</span>
          <span data-gallery-title style={{ fontFamily: GAME, fontWeight: 700, fontSize: 22, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{row.name}</span>
          <span style={{ fontFamily: GAME, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.5 }}>{row.el ?? 'base'}{look ? ` · ${look.name}` : ''}</span>
        </div>
        <div data-gallery-state={look ? 'model' : 'art'} style={{ position: 'relative', height: 520, borderRadius: 12, overflow: 'hidden',
          background: 'radial-gradient(circle at 50% 40%, rgba(255,236,190,.30), rgba(36,24,14,.92) 75%)', border: '1px solid rgba(245,197,66,.18)' }}>
          {look ? <SpiritStage key={`${row.num}`} sp={row.sp} look={look} clip={clip} meals={meals} /> : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-gallery-art src={row.icon} alt={row.name} style={{ maxWidth: '62%', maxHeight: 400, objectFit: 'contain', filter: 'saturate(.85)' }} />
              <span data-gallery-unbuilt style={{ fontFamily: GAME, fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: 'rgba(0,0,0,.45)', opacity: 0.85 }}>Not built</span>
            </div>
          )}
        </div>
        {look && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: GAME, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.5, width: 44 }}>Clip</span>
          {RIG_CLIPS.map(c => <Btn key={c} on={clip === c} attr={{ 'data-gallery-clip': c }} onClick={() => setClip(c)}>{c}</Btn>)}
          <span style={{ fontFamily: GAME, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.5, marginLeft: 18, width: 44 }}>Glow</span>
          <Btn on={!glow} attr={{ 'data-gallery-glow': 'none' }} onClick={() => setGlow(null)}>none</Btn>
          {ELS.map(e => <Btn key={e} on={glow === e} color={ELEMENT_COLORS[e]} attr={{ 'data-gallery-glow': e }} onClick={() => setGlow(e)}>{e}</Btn>)}
        </div>}
        <div style={{ fontSize: 11, opacity: 0.45 }}>{look ? 'Drag to turn, wheel to zoom. The game’s own model, rig and effects.' : 'No model yet: this is the locked art.'}</div>
      </div>
    </div>
  )
}

function Btn({ on, onClick, children, color, attr }: { on: boolean; onClick: () => void; children: string; color?: string; attr: Record<string, string> }) {
  return (
    <button type="button" {...attr} aria-pressed={on} onClick={onClick}
      style={{ fontFamily: GAME, fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
        color: on ? '#1c130b' : '#f3e6cc', background: on ? (color ?? '#f5c542') : 'rgba(24,16,10,.8)', border: `1px solid ${color ?? 'rgba(245,197,66,.4)'}`, opacity: on ? 1 : 0.6 }}>
      {children}
    </button>
  )
}
