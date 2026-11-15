'use client'

import { useEffect, useRef, useState } from 'react'
import { touch, pressKey, resetTouch } from './touch'

// The phone layer for the open world (2026-11-15, hub). Writes `touch` (shared/touch.ts); never touches game state.
//
//   LEFT half   a floating stick: it appears under your thumb wherever you put it down, so there is no dead
//               zone to hunt for. Max throw 56 px; a light push walks, a full push runs.
//   RIGHT half  drag anywhere to look. Fire is a button you can DRAG to aim while it is held (thumb never lifts).
//   Buttons     hold: jump, slide, fire. Tap: whatever the page passes in `actions` (E use, M map, F plant...),
//               sent as real key presses so the page's own handler runs.
// Multi-touch by pointerId: each finger owns exactly one role from touchdown to lift.

/** `near`: a contextual action (E use, L lift) shown as a big pill by the thumb cluster; the rest sit in a compact
 *  row under the top-right HUD. Two places because a short phone screen cannot stack all of them in one column. */
export interface TouchAction { code: string; label: string; key: string; near?: boolean }

const THROW = 56
const ring = (size: number, lit = false): React.CSSProperties => ({
  width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center',
  background: lit ? 'rgba(212,168,67,0.42)' : 'rgba(12,16,20,0.42)', border: '2px solid rgba(244,239,226,0.55)',
  color: '#f4efe2', font: '700 12px system-ui', letterSpacing: '0.06em', textTransform: 'uppercase',
  touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', backdropFilter: 'blur(2px)',
})

export function TouchControls({ actions, showFire }: { actions: TouchAction[]; showFire: boolean }) {
  const roles = useRef(new Map<number, { kind: 'stick' | 'look' | 'fire'; ox: number; oy: number; lx: number; ly: number }>())
  const [stick, setStick] = useState<null | { ox: number; oy: number; x: number; y: number }>(null)
  const [down, setDown] = useState<Record<string, boolean>>({})

  useEffect(() => () => resetTouch(), [])

  const start = (e: React.PointerEvent) => {
    if (roles.current.size >= 4) return
    const left = e.clientX < window.innerWidth * 0.45
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    roles.current.set(e.pointerId, { kind: left ? 'stick' : 'look', ox: e.clientX, oy: e.clientY, lx: e.clientX, ly: e.clientY })
    if (left) setStick({ ox: e.clientX, oy: e.clientY, x: 0, y: 0 })
  }
  const move = (e: React.PointerEvent) => {
    const r = roles.current.get(e.pointerId); if (!r) return
    if (r.kind === 'stick') {
      let dx = e.clientX - r.ox, dy = e.clientY - r.oy
      const m = Math.hypot(dx, dy); if (m > THROW) { dx *= THROW / m; dy *= THROW / m }
      touch.move.x = dx / THROW; touch.move.y = -dy / THROW
      setStick({ ox: r.ox, oy: r.oy, x: dx, y: dy })
    } else {
      touch.look.dx += e.clientX - r.lx; touch.look.dy += e.clientY - r.ly
    }
    r.lx = e.clientX; r.ly = e.clientY
  }
  const end = (e: React.PointerEvent) => {
    const r = roles.current.get(e.pointerId); if (!r) return
    roles.current.delete(e.pointerId)
    if (r.kind === 'stick') { touch.move.x = 0; touch.move.y = 0; setStick(null) }
    if (r.kind === 'fire') { touch.fire = false; setDown(d => ({ ...d, fire: false })) }
  }

  // A hold button: down while the finger is on it. Fire also looks while dragged.
  const hold = (id: string, onDown: () => void, onUp: () => void, looks = false) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      if (looks) roles.current.set(e.pointerId, { kind: 'fire', ox: e.clientX, oy: e.clientY, lx: e.clientX, ly: e.clientY })
      onDown(); setDown(d => ({ ...d, [id]: true }))
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!looks) return
      const r = roles.current.get(e.pointerId); if (!r) return
      touch.look.dx += e.clientX - r.lx; touch.look.dy += e.clientY - r.ly; r.lx = e.clientX; r.ly = e.clientY
    },
    onPointerUp: (e: React.PointerEvent) => { e.stopPropagation(); roles.current.delete(e.pointerId); onUp(); setDown(d => ({ ...d, [id]: false })) },
    onPointerCancel: (e: React.PointerEvent) => { roles.current.delete(e.pointerId); onUp(); setDown(d => ({ ...d, [id]: false })) },
  })
  const holdKey = (code: string) => hold(code, () => touch.held.add(code), () => touch.held.delete(code))

  return (
    <div
      style={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', zIndex: 5 }}
      onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      onContextMenu={e => e.preventDefault()}
    >
      {stick && (
        <div style={{ position: 'absolute', left: stick.ox - THROW, top: stick.oy - THROW, width: THROW * 2, height: THROW * 2, borderRadius: '50%', border: '2px solid rgba(244,239,226,0.35)', background: 'rgba(12,16,20,0.18)', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: THROW + stick.x - 24, top: THROW + stick.y - 24, width: 48, height: 48, borderRadius: '50%', background: 'rgba(244,239,226,0.55)', pointerEvents: 'none' }} />
        </div>
      )}
      {!stick && (
        <div style={{ position: 'absolute', left: 28, bottom: 'max(28px, env(safe-area-inset-bottom))', color: 'rgba(244,239,226,0.55)', font: '600 10px system-ui', letterSpacing: '0.2em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          thumb here to move
        </div>
      )}

      {/* right cluster: fire big, jump + slide beside it */}
      <div style={{ position: 'absolute', right: 'max(18px, env(safe-area-inset-right))', bottom: 'max(22px, env(safe-area-inset-bottom))', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={ring(56, down.ShiftLeft)} {...holdKey('ShiftLeft')}>slide</div>
          <div style={ring(56, down.Space)} {...holdKey('Space')}>jump</div>
        </div>
        {showFire
          ? <div style={ring(84, down.fire)} {...hold('fire', () => { touch.fire = true }, () => { touch.fire = false }, true)}>fire</div>
          : null}
      </div>

      {/* standing taps: a compact row under the top-right HUD */}
      <div style={{ position: 'absolute', right: 'max(12px, env(safe-area-inset-right))', top: 70, display: 'flex', gap: 8 }}>
        {actions.filter(a => !a.near).map(a => (
          <div key={a.code} style={{ ...ring(40), width: 'auto', minWidth: 40, padding: '0 11px', borderRadius: 20, display: 'flex', alignItems: 'center', fontSize: 11 }}
            onPointerDown={e => { e.stopPropagation(); pressKey(a.code) }}>
            <span style={{ fontSize: 13, marginRight: 6, color: '#d4a843' }}>{a.key}</span>{a.label}
          </div>
        ))}
      </div>
      {/* what is in reach right now: big, beside the thumb cluster */}
      <div style={{ position: 'absolute', right: `calc(max(18px, env(safe-area-inset-right)) + ${showFire ? 84 + 12 : 0}px + 56px + 16px)`, bottom: 'max(22px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
        {actions.filter(a => a.near).map(a => (
          <div key={a.code} style={{ ...ring(60, true), width: 'auto', minWidth: 60, padding: '0 18px', borderRadius: 30, display: 'flex', alignItems: 'center', fontSize: 13 }}
            onPointerDown={e => { e.stopPropagation(); pressKey(a.code) }}>
            <span style={{ fontSize: 17, marginRight: 8, color: '#f4efe2' }}>{a.key}</span>{a.label}
          </div>
        ))}
      </div>
    </div>
  )
}
