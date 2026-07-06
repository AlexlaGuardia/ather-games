'use client'

// ARCADE CONTROLS — the cabinet's CONTROL DECK. Bolts under a game's screen so the canvas
// stays clean (no input UI painted over the action) and the whole thing reads like a tall
// arcade cabinet: art-framed screen up top, a recessed gold-trim panel of real buttons /
// joystick beneath. Pairs with <ArcadeCabinet> (the housing). Mobile-first; on desktop the
// game's keyboard still drives — the deck just mirrors it (and shows the keybind hints).
//
// Per-game control SPEC drives it (button games vs stick games). The deck calls back into the
// SAME handlers the game already exposes (press/release for buttons, a -1..1 vector for the
// stick), so wiring a game = render <ArcadeControls> + point the callbacks at its input fns.

import { useCallback, useRef, useState } from 'react'

export interface DeckButton {
  id: string
  label: string // short cap-text, e.g. "VAULT" / "LEFT"
  glyph?: string // optional face glyph, e.g. "⤴" "◀" "▶"
  hint?: string // desktop keybind hint, e.g. "space"
  size?: 'lg' | 'md' // primary action = lg
}

export interface ArcadeControlsProps {
  accent?: string
  buttons?: DeckButton[]
  onPress?: (id: string) => void
  onRelease?: (id: string) => void
  stick?: boolean
  onStick?: (x: number, y: number) => void // each axis -1..1, y+ = down
  onStickEnd?: () => void
  /** 4-direction D-pad (cross of square keys) — fires onPress/onRelease with ids up|down|left|right */
  dpad?: boolean
  /** override the small instruction line under the deck */
  hint?: string
  maxWidth?: number | string
  className?: string
}

const STICK_R = 69 // gate radius (px, virtual — the panel scales). 1.5x for thumb-size deck.
const KNOB_R = 39

function hexRgb(hex: string): string {
  const h = hex.replace('#', '')
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(f, 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export default function ArcadeControls({
  accent = '#37e6ff',
  buttons = [],
  onPress,
  onRelease,
  stick = false,
  onStick,
  onStickEnd,
  dpad = false,
  hint,
  maxWidth = 480,
  className = '',
}: ArcadeControlsProps) {
  const rgb = hexRgb(accent)
  const [held, setHeld] = useState<Record<string, boolean>>({})
  const knob = useRef<HTMLDivElement>(null)
  const gate = useRef<HTMLDivElement>(null)
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 })
  const stickPid = useRef(-1)

  // ── buttons ───────────────────────────────────────────────────────────────────
  const press = useCallback((b: DeckButton, e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    setHeld((h) => ({ ...h, [b.id]: true }))
    onPress?.(b.id)
  }, [onPress])
  const release = useCallback((b: DeckButton, e: React.PointerEvent) => {
    e.preventDefault()
    setHeld((h) => (h[b.id] ? { ...h, [b.id]: false } : h))
    onRelease?.(b.id)
  }, [onRelease])

  // ── joystick (fixed-base, cabinet-authentic) ────────────────────────────────────
  const moveStick = useCallback((e: React.PointerEvent) => {
    const g = gate.current
    if (!g) return
    const r = g.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    let dx = e.clientX - cx
    let dy = e.clientY - cy
    const scale = r.width / 2 / STICK_R // px per virtual unit
    const d = Math.hypot(dx, dy)
    const max = STICK_R * scale
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max }
    setKnobPos({ x: dx, y: dy })
    onStick?.(dx / max, dy / max)
  }, [onStick])
  const stickDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    stickPid.current = e.pointerId
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    moveStick(e)
  }, [moveStick])
  const stickMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== stickPid.current) return
    moveStick(e)
  }, [moveStick])
  const stickUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== stickPid.current) return
    stickPid.current = -1
    setKnobPos({ x: 0, y: 0 })
    onStickEnd?.()
  }, [onStickEnd])

  const defaultHint = stick
    ? 'drag the stick · tap the buttons'
    : dpad ? 'tap a direction to turn'
    : buttons.length > 1 ? 'hold the buttons' : 'tap or hold the button'

  // ── 4-direction D-pad (cross of square keys) ────────────────────────────────────
  const DPAD_KEYS = [
    { id: 'up', glyph: '▲', gc: 2, gr: 1 },
    { id: 'left', glyph: '◀', gc: 1, gr: 2 },
    { id: 'right', glyph: '▶', gc: 3, gr: 2 },
    { id: 'down', glyph: '▼', gc: 2, gr: 3 },
  ] as const
  const renderDpad = () => (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 78px)', gridTemplateRows: 'repeat(3, 78px)' }}>
      {DPAD_KEYS.map((d) => {
        const down = !!held[d.id]
        const btn: DeckButton = { id: d.id, label: d.id }
        return (
          <button
            key={d.id}
            aria-label={d.id}
            onPointerDown={(e) => press(btn, e)}
            onPointerUp={(e) => release(btn, e)}
            onPointerCancel={(e) => release(btn, e)}
            onPointerLeave={(e) => { if (held[d.id]) release(btn, e) }}
            onContextMenu={(e) => e.preventDefault()}
            className="relative rounded-lg flex items-center justify-center font-bold select-none touch-none active:outline-none"
            style={{
              gridColumn: d.gc, gridRow: d.gr, width: 78, height: 78,
              color: down ? '#fff' : '#eafcff',
              background: `radial-gradient(circle at 50% 34%, rgba(${rgb},${down ? 0.95 : 0.7}), rgba(${rgb},0.32) 64%, rgba(${rgb},0.14) 100%)`,
              boxShadow: down
                ? `inset 0 4px 12px rgba(0,0,0,0.55), 0 0 22px rgba(${rgb},0.8)`
                : `0 4px 0 rgba(${rgb},0.28), 0 7px 14px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(0,0,0,0.35), 0 0 16px rgba(${rgb},0.32)`,
              transform: down ? 'translateY(2px)' : 'translateY(0)',
              transition: 'transform 0.05s, box-shadow 0.08s, background 0.08s',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)', fontSize: 26,
            }}
          >
            {d.glyph}
          </button>
        )
      })}
      {/* center hub — dead cell, reads as a real D-pad */}
      <span style={{ gridColumn: 2, gridRow: 2 }} className="m-auto h-5 w-5 rounded-[4px] bg-black/40 border border-white/5" />
    </div>
  )

  return (
    <div className={`w-full ${className}`} style={{ maxWidth }}>
      {/* the attract pulse — the deck button breathes so the SCREEN can stay neutral and the
          BUTTON is what calls the eye (idle only; killed the moment you press) */}
      <style>{`@keyframes acAttract{0%,100%{filter:brightness(1)}50%{filter:brightness(1.22)}}`}</style>
      {/* the control panel — recessed dark deck, gold cabinet trim, corner screws */}
      <div
        className="relative mt-2 rounded-xl border border-[#d4a843]/30 px-4 py-2.5 touch-none"
        style={{
          background: 'linear-gradient(to bottom, #15151d 0%, #0c0c12 55%, #08080d 100%)',
          boxShadow: `inset 0 2px 10px rgba(0,0,0,0.65), inset 0 0 24px rgba(${rgb},0.04), 0 6px 22px rgba(0,0,0,0.5)`,
        }}
      >
        {/* corner screws */}
        {(['left-2 top-2', 'right-2 top-2', 'left-2 bottom-2', 'right-2 bottom-2'] as const).map((p) => (
          <span key={p} className={`absolute ${p} w-1.5 h-1.5 rounded-full bg-[#d4a843]/30 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]`} />
        ))}

        <div className={`flex items-center ${stick ? 'justify-between' : 'justify-center'} gap-4 min-h-[76px]`}>
          {/* joystick gate (left) */}
          {stick && (
            <div
              ref={gate}
              onPointerDown={stickDown}
              onPointerMove={stickMove}
              onPointerUp={stickUp}
              onPointerCancel={stickUp}
              className="relative shrink-0 rounded-full"
              style={{
                width: STICK_R * 2, height: STICK_R * 2,
                background: 'radial-gradient(circle at 50% 38%, #0c0c12, #050507 70%)',
                boxShadow: `inset 0 3px 10px rgba(0,0,0,0.8), 0 0 0 2px rgba(${rgb},0.12)`,
              }}
            >
              {/* gate ring */}
              <span className="absolute inset-[7px] rounded-full border border-white/5" />
              {/* the ball-top stick */}
              <div
                ref={knob}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: KNOB_R * 2, height: KNOB_R * 2,
                  transform: `translate(calc(-50% + ${knobPos.x}px), calc(-50% + ${knobPos.y}px))`,
                  background: `radial-gradient(circle at 38% 32%, #fff5, rgb(${rgb}) 42%, #0a0a0f 120%)`,
                  boxShadow: `0 4px 10px rgba(0,0,0,0.6), 0 0 14px rgba(${rgb},0.5)`,
                  transition: stickPid.current === -1 ? 'transform 0.12s ease-out' : 'none',
                }}
              />
            </div>
          )}

          {/* D-pad (cross) — replaces the button row for direction games */}
          {dpad && renderDpad()}

          {/* buttons (right, or centered) */}
          {!dpad && <div className="flex items-center gap-4">
            {buttons.map((b) => {
              const big = b.size === 'lg'
              const dim = big ? 108 : 84
              const down = !!held[b.id]
              return (
                <div key={b.id} className="flex flex-col items-center gap-1 shrink-0">
                  <button
                    aria-label={b.label}
                    onPointerDown={(e) => press(b, e)}
                    onPointerUp={(e) => release(b, e)}
                    onPointerCancel={(e) => release(b, e)}
                    onPointerLeave={(e) => { if (held[b.id]) release(b, e) }}
                    onContextMenu={(e) => e.preventDefault()}
                    className="relative rounded-full flex items-center justify-center font-bold select-none touch-none active:outline-none"
                    style={{
                      width: dim, height: dim,
                      color: down ? '#fff' : '#eafcff',
                      background: `radial-gradient(circle at 50% 34%, rgba(${rgb},${down ? 0.95 : 0.7}), rgba(${rgb},0.32) 64%, rgba(${rgb},0.14) 100%)`,
                      boxShadow: down
                        ? `inset 0 4px 12px rgba(0,0,0,0.55), 0 0 22px rgba(${rgb},0.8)`
                        : `0 4px 0 rgba(${rgb},0.28), 0 7px 14px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(0,0,0,0.35), 0 0 16px rgba(${rgb},0.32)`,
                      transform: down ? 'translateY(3px)' : 'translateY(0)',
                      transition: 'transform 0.05s, box-shadow 0.08s, background 0.08s',
                      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                      fontSize: big ? 33 : 26,
                      // idle attract on the primary button — the eye-catcher (off while pressed)
                      animation: big && !down ? 'acAttract 1.8s ease-in-out infinite' : 'none',
                    }}
                  >
                    {b.glyph ?? b.label.slice(0, 1)}
                  </button>
                  <span className="text-[8.5px] font-mono tracking-[0.15em] uppercase text-[#d4a843]/70 leading-none">
                    {b.label}{b.hint ? <span className="text-[#7fd8e6]/35"> · {b.hint}</span> : null}
                  </span>
                </div>
              )
            })}
          </div>}
        </div>

        <p className="mt-1.5 text-center text-[9px] font-mono tracking-wider text-[#7fd8e6]/30">{hint ?? defaultHint}</p>
      </div>
    </div>
  )
}
