'use client'
// BETA M213 s1 (sprites, 2026-11-26): THE SPIRIT GALLERY, /shimmer/dev?mode=spirits (owner: the /shimmer/dev gate, src/proxy.ts).
// Alex 11-26 18:0x: "lets give the models a home in the /dev page with a tool that just shows the grimiore basically ... a dial that
// scrolls up and down just showing the number, icon and name of the spirit.. starting with the base spirits and onward".
// LEFT: the dial (wheel, drag, arrow keys, click), rows = number, icon, name (spirit-gallery.ts: base 10, then the 40 forms in
// discovery order). RIGHT: the selected spirit LIVE as the game mounts her (SpiritStage = spirit-model.tsx's own SpiritModel: glb,
// rig, materials, form fx, glow accent), orbit + zoom, her clips; a form with no model yet shows her locked art, NOT BUILT.
// Labels are plain functional UI words (for @lark). The grimoire look gets tuned here later; desktop first.
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { GALLERY, dialStep, galleryNo, STEEP_ELS, STEEP_NONE, steepAdd, steepMeals, steepTotal, type GalleryRow, type SteepMix } from './spirit-gallery'
import { accentOf } from '../../open/ather/spirit-accent'
import { SpiritStage } from '../../open/ather/spirit-model'
import { AWAKENED_FORMS, formLook, spiritModelFor, type SpiritLook } from '../../open/ather/spirit-models'
import { basePreviewFor } from '../../open/ather/spirit-base-preview'
import { RIG_CLIPS, type RigClip } from '../../open/ather/spirit-rig'
import { ELEMENT_COLORS } from '../../spirits/spirit'
import { loadSizes, saveSize, sizeLines, sizeSlot, SIZE_MAX, SIZE_MIN, SIZE_STEP, type SizeForm } from './gallery-size'
import { StageKeeper } from './gallery-size-view'

const ROW = 52, SHOWN = 11, half = Math.floor(SHOWN / 2)
const GAME = 'var(--font-game), system-ui, sans-serif'

// M174: a base form built but not yet OK'd by Alex shows here (this page is owner-only) via basePreviewFor
const lookOf = (r: GalleryRow): SpiritLook | null => (r.aw ? AWAKENED_FORMS[r.aw.look] ?? null : r.el ? formLook(r.sp, r.el) : spiritModelFor(r.sp) ?? basePreviewFor(r.sp))

// M249: what the size slider sizes (one slot per form: base by species, a form by its look name)
const sizeFormOf = (r: GalleryRow, look: SpiritLook | null): SizeForm | null =>
  !look ? null : r.aw ? { kind: 'awakened', name: r.aw.look } : r.el ? { kind: 'form', name: look.name } : { kind: 'base', sp: r.sp }
const KEEPER_FRAME = 1.8   // the stage frames at least a keeper's height (he stands beside her)

const initialIndex = () => {
  if (typeof window === 'undefined') return 0
  const n = Number(new URLSearchParams(window.location.search).get('spirit'))
  return Number.isFinite(n) && n >= 1 && n <= GALLERY.length ? n - 1 : 0
}

export default function SpiritGallery() {
  const [i, setI] = useState(initialIndex)
  const [clip, setClip] = useState<RigClip>('idle')
  const row = GALLERY[i], look = lookOf(row)
  // M213 s2: the glow is a STEEP MIX preview (her 10-slot bar, set by element), default none; it stays as you turn the dial
  const [mix, setMix] = useState<SteepMix>(STEEP_NONE)
  const go = useCallback((by: number) => setI(v => dialStep(v, by)), [])
  // M249: the size slider, per form, this browser's (loaded after mount: no localStorage on the server)
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState('')
  useEffect(() => { setSizes(loadSizes()) }, [])
  const sf = sizeFormOf(row, look), slot = sf ? sizeSlot(sf) : '', scale = (slot && sizes[slot]) || 1
  const lines = sf ? sizeLines(sf, scale) : []
  const sizeEl = useRef<HTMLDivElement>(null)
  const setScale = (v: number | null) => { if (slot) setSizes(saveSize(slot, v)) }
  const copy = () => { const txt = lines.join('\n'); setCopied(txt); navigator.clipboard?.writeText(txt).catch(() => {}) }
  useEffect(() => { setCopied('') }, [slot])

  // the clip goes back to idle on a new spirit
  useEffect(() => { setClip('idle')
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

  // the wheel: one row per notch (a mouse notch is ~100 px in one event = one row; a trackpad's small deltas add up to one)
  const dial = useRef<HTMLDivElement>(null), wheelAcc = useRef(0)
  useEffect(() => {
    const el = dial.current; if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheelAcc.current += e.deltaY
      if (Math.abs(wheelAcc.current) >= 50) { go(Math.sign(wheelAcc.current)); wheelAcc.current = 0 } }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [go])
  // the drag: one row per ROW px dragged, opposite the finger (drag up = further down the list)
  const drag = useRef<{ y: number; moved: boolean } | null>(null)
  const onDown = (e: RPointerEvent) => { drag.current = { y: e.clientY, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const onMove = (e: RPointerEvent) => { const d = drag.current; if (!d) return
    const rows = Math.trunc((d.y - e.clientY) / ROW); if (rows) { go(rows); d.y -= rows * ROW; d.moved = true } }
  // M213 fix: a tap (no drag) selects the row under the pointer. The row's own onClick never fired: the dial holds pointer capture
  // from the press, so the click lands on the dial, not the row. Read the row off the pointer's height instead.
  const onUp = (e: RPointerEvent) => { const d = drag.current; drag.current = null
    if (!d || d.moved || !dial.current) return
    const k = i + Math.floor((e.clientY - dial.current.getBoundingClientRect().top) / ROW) - half
    if (k >= 0 && k < GALLERY.length) setI(k) }
  const onCancel = () => { drag.current = null }

  const meals = steepMeals(mix), total = steepTotal(mix), accent = accentOf(meals)

  return (
    <div data-spirit-gallery style={{ display: 'flex', gap: 16, minHeight: 640, color: '#f3e6cc' }}>
      {/* the dial */}
      <div style={{ width: 300, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: GAME, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.55 }}>Spirits · {GALLERY.length}</div>
        <div ref={dial} data-gallery-dial tabIndex={0} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
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
          <span style={{ fontFamily: GAME, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.5 }}>{row.el ?? 'base'}{row.aw ? ` · ${row.aw.branch}` : ''}{look ? ` · ${look.name}` : ''}</span>
        </div>
        <div data-gallery-state={look ? 'model' : 'art'} style={{ position: 'relative', height: 520, borderRadius: 12, overflow: 'hidden',
          background: 'radial-gradient(circle at 50% 40%, rgba(255,236,190,.30), rgba(36,24,14,.92) 75%)', border: '1px solid rgba(245,197,66,.18)' }}>
          <SpiritStage sp={row.sp} look={look} clip={clip} meals={meals} scale={scale} frame={look ? Math.max(look.h * scale, KEEPER_FRAME) : undefined}>
            {look && <StageKeeper out={sizeEl} ruler={Math.max(2, Math.ceil(look.h * scale * 1.1))} />}
          </SpiritStage>
          {!look && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-gallery-art src={row.icon} alt={row.name} style={{ maxWidth: '62%', maxHeight: 400, objectFit: 'contain', filter: 'saturate(.85)' }} />
              <span data-gallery-unbuilt style={{ fontFamily: GAME, fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: 'rgba(0,0,0,.45)', opacity: 0.85 }}>Not built</span>
            </div>
          )}
        </div>
        {look && sf && <div ref={sizeEl} data-gallery-size={slot} data-gallery-scale={scale.toFixed(2)} data-gallery-design-h={(look.h * scale).toFixed(3)}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: GAME, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.5, width: 44 }}>Size</span>
          <input type="range" data-gallery-size-slider min={SIZE_MIN} max={SIZE_MAX} step={SIZE_STEP} value={scale} aria-label="Size"
            onChange={e => setScale(Number(e.target.value))} style={{ width: 220, accentColor: '#f5c542' }} />
          <span data-gallery-size-n style={{ fontFamily: GAME, fontSize: 11, fontVariantNumeric: 'tabular-nums', minWidth: 230 }}>x{scale.toFixed(2)} · <span data-gallery-size-h /></span>
          <Btn on={false} attr={{ 'data-gallery-size-copy': '' }} onClick={copy}>Copy values</Btn>
          <Btn on={false} attr={{ 'data-gallery-size-reset': '' }} onClick={() => setScale(null)}>Reset</Btn>
          {copied && <pre data-gallery-size-line style={{ flexBasis: '100%', margin: 0, fontSize: 11, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,.4)', whiteSpace: 'pre-wrap' }}>{copied}</pre>}
        </div>}
        {look && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: GAME, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.5, width: 44 }}>Clip</span>
          {RIG_CLIPS.map(c => <Btn key={c} on={clip === c} attr={{ 'data-gallery-clip': c }} onClick={() => setClip(c)}>{c}</Btn>)}
        </div>}
        {look && <div data-gallery-steep={meals.join()} data-gallery-accent={accent?.hex ?? ''} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: GAME, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.5, width: 44 }}>Steep</span>
          {STEEP_ELS.map(e => (
            <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 6 }}>
              <Btn on={false} color={ELEMENT_COLORS[e]} attr={{ 'data-gallery-steep-less': e, 'aria-label': `${e} minus one` }} onClick={() => setMix(m => steepAdd(m, e, -1))}>−</Btn>
              <span data-gallery-steep-n={e} style={{ fontFamily: GAME, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', minWidth: 64, textAlign: 'center', color: mix[e] ? ELEMENT_COLORS[e] : '#f3e6cc', opacity: mix[e] ? 1 : 0.55 }}>{e} {mix[e]}</span>
              <Btn on={false} color={ELEMENT_COLORS[e]} attr={{ 'data-gallery-steep-more': e, 'aria-label': `${e} plus one` }} onClick={() => setMix(m => steepAdd(m, e, 1))}>+</Btn>
            </span>
          ))}
          <Btn on={total === 0} attr={{ 'data-gallery-steep-none': '' }} onClick={() => setMix(STEEP_NONE)}>none</Btn>
          {/* her bar, slot by slot in feed order, and the glow it gives (the game's accentOf) */}
          <span style={{ display: 'inline-flex', gap: 2, marginLeft: 10 }}>
            {Array.from({ length: 10 }, (_, k) => <span key={k} style={{ width: 9, height: 14, borderRadius: 2, background: meals[k] ? ELEMENT_COLORS[meals[k]] : 'rgba(255,236,190,.12)', border: '1px solid rgba(245,197,66,.25)' }} />)}
          </span>
          <span style={{ fontFamily: GAME, fontSize: 11, letterSpacing: '0.12em', opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {total}/10{accent && <><span style={{ width: 14, height: 14, borderRadius: 7, background: accent.hex, boxShadow: `0 0 8px ${accent.hex}` }} />{accent.hex}{accent.locked ? ' · locked' : ''}</>}
          </span>
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
