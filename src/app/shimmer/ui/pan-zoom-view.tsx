'use client'
// BETA M100: the M map pans + zooms. Drag (mouse or one finger) pans, the wheel or a pinch zooms about the pointer,
// the view never leaves the picture, and a press that moved under DRAG_PX is still a click on a stop.
//
// Two ways to use it:
//  - <PanZoomBox>: a DOM map (pins are buttons). The layer is CSS-transformed and publishes `--mapk`; a pin wearing
//    `PIN_KEEP` scales back by 1/k so it stays the same size on screen. (open/ather/panels.tsx, both faces.)
//  - usePanZoom + <ResetView>: a canvas map that draws its own marks at fixed px with the view (open/continent/map.tsx).
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { HOME, MAX_K, DRAG_PX, clampView, zoomAt, panBy, wheelFactor, isHome, type View } from './pan-zoom'

/** `k,x,y` on the box: what the check reads (scripts/m100-map-zoom-check.mts). */
export const viewAttr = (v: View) => `${v.k.toFixed(4)},${v.x.toFixed(2)},${v.y.toFixed(2)}`

/** Spread onto a pin inside a <PanZoomBox>: it keeps its on-screen size at any zoom. */
export const PIN_KEEP: CSSProperties = { transform: 'scale(calc(1 / var(--mapk, 1)))' }

export function usePanZoom(maxK = MAX_K) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>(HOME)
  const vref = useRef<View>(HOME)
  const put = useCallback((v: View) => { vref.current = v; setView(v) }, [])
  const reset = useCallback(() => put(HOME), [put])
  useEffect(() => {
    const el = ref.current; if (!el) return
    const size = (): [number, number] => [el.clientWidth || 1, el.clientHeight || 1]
    const local = (e: { clientX: number; clientY: number }) => {
      // ★ IN THE BOX'S OWN CSS PX: an ancestor transform (the frame's open animation, a HUD scale) makes screen px differ
      const r = el.getBoundingClientRect(), sc = r.width / (el.offsetWidth || r.width || 1)
      return { x: (e.clientX - r.left) / sc - el.clientLeft, y: (e.clientY - r.top) / sc - el.clientTop }
    }
    const pts = new Map<number, { x: number; y: number }>()
    let start = { x: 0, y: 0 }, dragged = false
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation()
      const [w, h] = size(), p = local(e)
      put(zoomAt(vref.current, wheelFactor(e.deltaY, e.deltaMode), p.x, p.y, w, h, maxK))
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const p = local(e)
      if (pts.size === 0) { start = p; dragged = false }
      pts.set(e.pointerId, p)
      if (pts.size === 2) { dragged = true; for (const id of pts.keys()) try { el.setPointerCapture(id) } catch { /* gone */ } }
    }
    const move = (e: PointerEvent) => {
      const old = pts.get(e.pointerId); if (!old) return
      const q = local(e), [w, h] = size()
      if (pts.size === 1) {
        if (!dragged && Math.hypot(q.x - start.x, q.y - start.y) < DRAG_PX) return
        // ★ CAPTURE ONLY ONCE IT IS A DRAG: a captured press clicks the box, not the stop under the finger
        if (!dragged) { dragged = true; try { el.setPointerCapture(e.pointerId) } catch { /* gone */ } }
        pts.set(e.pointerId, q)
        put(panBy(vref.current, q.x - old.x, q.y - old.y, w, h, maxK))
        return
      }
      const other = [...pts.entries()].find(([id]) => id !== e.pointerId)?.[1]
      pts.set(e.pointerId, q)
      if (!other) return
      const d0 = Math.hypot(old.x - other.x, old.y - other.y), d1 = Math.hypot(q.x - other.x, q.y - other.y)
      const m0x = (old.x + other.x) / 2, m0y = (old.y + other.y) / 2, m1x = (q.x + other.x) / 2, m1y = (q.y + other.y) / 2
      const z = d0 > 1 ? zoomAt(vref.current, d1 / d0, m1x, m1y, w, h, maxK) : vref.current
      put(panBy(z, m1x - m0x, m1y - m0y, w, h, maxK))
    }
    const up = (e: PointerEvent) => { pts.delete(e.pointerId) }
    // a press that dragged must not land as a click on whatever is under the release
    const click = (e: MouseEvent) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false } }
    const ro = new ResizeObserver(() => { const [w, h] = size(); put(clampView(vref.current, w, h, maxK)) })
    ro.observe(el)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('click', click, true)
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', wheel); el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('click', click, true)
    }
  }, [maxK, put])
  return { ref, view, reset }
}

/** The reset-view button, top-right of the map; only there once the view has moved. */
export function ResetView({ view, onReset }: { view: View; onReset: () => void }) {
  if (isHome(view)) return null
  return (
    <button type="button" data-map-reset onClick={e => { e.stopPropagation(); onReset() }} title="Back to the whole map"
      style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, minHeight: 32, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(90,61,34,0.6)',
        background: 'rgba(246,236,210,0.92)', color: '#3a2614', font: '700 11px system-ui', letterSpacing: '0.08em', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
      Reset view
    </button>
  )
}

/** A DOM map that pans + zooms. `style` is the viewport's (size, radius, background); children fill it as before. */
export function PanZoomBox({ style, children, maxK }: { style?: CSSProperties; children: ReactNode; maxK?: number }) {
  const { ref, view, reset } = usePanZoom(maxK)
  return (
    <div ref={ref} data-panzoom data-view={viewAttr(view)} style={{ position: 'relative', ...style, overflow: 'hidden', touchAction: 'none', cursor: view.k > 1 ? 'grab' : undefined }}>
      <div data-panzoom-layer style={{ position: 'relative', width: '100%', height: '100%', transformOrigin: '0 0',
        transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, ['--mapk' as string]: view.k } as CSSProperties}>
        {children}
      </div>
      <ResetView view={view} onReset={reset} />
    </div>
  )
}
