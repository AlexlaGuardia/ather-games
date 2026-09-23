'use client'
// ── The rebinding menu ────────────────────────────────────────────────────────────────────────
//
// Alex, 2026-08-23: "the button hints should be part of the tutorial and then in the menu there
// should be an option to bind keys."
//
// Presentation only. Every rule it enforces — the merge, orphan detection, conflict reporting —
// lives in `@/lib/input/bindings` and is tested headless, because a rule that only exists inside a
// React component is a rule nothing can check. This file decides what the player SEES.
//
// ★ IT ASKS `.gx-label`/`.gx-value`/`.gx-btn` rather than restating them. Shimmer spent two months
// as the one surface that never joined the house game-UI layer; a NEW panel typing its own
// uppercase+tracking would re-open that hole on the day it was closed.

import { useCallback, useEffect, useRef, useState } from 'react'
import { HearthFrame, HearthButton } from '../ui/hearth'
import { GROUPS, LABEL, OWNER_ONLY, STICK_DRIVEN, PAD, type ActionId, type PadButton } from '@/lib/input/actions'
import { load, save, rebind, resetAll, conflicts, orphans, type BindingMap } from '@/lib/input/bindings'
import { keyName, padName } from '@/lib/input/hints'
import type { PadKind } from '@/lib/input/gamepad'

type Capture = { id: ActionId; device: 'key' | 'pad' } | null

export default function BindingsPanel({ isOwner, padKind, onClose }: {
  isOwner: boolean
  padKind: PadKind
  onClose: () => void
}) {
  const [map, setMap] = useState<BindingMap>(() => load())
  const [capture, setCapture] = useState<Capture>(null)
  const captureRef = useRef<Capture>(null)
  captureRef.current = capture

  const commit = useCallback((next: BindingMap) => {
    // ⚠ REFUSE A CHANGE THAT ORPHANS THE ACTION. Without this a player can unbind their way out of
    // being able to move, with no route back except clearing site data — and the panel that did it
    // would look like it worked. `orphans` is the tested rule; this is only the refusal.
    if (orphans(next).length > orphans(map).length) return false
    setMap(next); save(next); return true
  }, [map])

  // ── capturing a keyboard binding ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!capture || capture.device !== 'key') return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation()
      const c = captureRef.current
      if (!c) return
      // Escape CANCELS rather than binds. It is the one key a player will press to back out, so
      // binding it here would be a trap — and `ui.close` already owns it.
      if (e.code !== 'Escape') commit(rebind(map, c.id, 'key', [e.code]))
      setCapture(null)
    }
    // capture-phase + `once` so the game's own listeners never see the keystroke that was meant
    // for this panel. Without capture phase, rebinding Craft would also open the craft surface.
    window.addEventListener('keydown', onKey, { capture: true, once: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [capture, map, commit])

  // ── capturing a controller binding ──────────────────────────────────────────────────────────
  // Polled, because the Gamepad API has no button events. Runs ONLY while capturing, so the panel
  // adds no per-frame work to normal play.
  useEffect(() => {
    if (!capture || capture.device !== 'pad') return
    let raf = 0
    const tick = () => {
      const g = navigator.getGamepads?.().find(Boolean)
      if (g && g.mapping === 'standard') {
        for (const [name, idx] of Object.entries(PAD) as [PadButton, number][]) {
          if (g.buttons[idx]?.pressed) {
            const c = captureRef.current
            if (c) commit(rebind(map, c.id, 'pad', [name]))
            setCapture(null)
            return
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [capture, map, commit])

  const clash = conflicts(map)
  const clashFor = (id: ActionId) => clash.filter(c => c.actions.includes(id))

  return (
    <HearthFrame title="Controls" maxWidth={580} onClose={onClose} fixed backdropClass="z-[48]" bodyClass="p-5 pt-6 text-[12px]">
        <div className="mb-3 flex justify-end">
          <HearthButton small primary onClick={onClose}>Done</HearthButton>
        </div>

        <p className="mb-4 text-[12px] leading-relaxed hk-faint">
          Click a binding, then press the key or controller button you want.
          Esc cancels. Controls are saved to this device, not to your keeper.
        </p>

        {GROUPS.map(group => {
          const rows = group.actions.filter(id => isOwner || !OWNER_ONLY.includes(id))
          if (!rows.length) return null
          return (
            <div key={group.title} className="mb-4">
              <div className="hk-label mb-1.5 text-[12px] hk-faint">{group.title}</div>
              {rows.map(id => {
                const b = map[id]
                const stick = STICK_DRIVEN.includes(id)
                const bad = clashFor(id)
                return (
                  <div key={id} className="flex items-center gap-2 border-b hk-rule py-1.5 last:border-0">
                    <span className="flex-1 text-[12px] hk-soft">{LABEL[id]}</span>

                    <Slot label={b.keys.length ? keyName(b.keys[0]) : '—'}
                          active={capture?.id === id && capture.device === 'key'}
                          onClick={() => setCapture({ id, device: 'key' })} />

                    {/* ⚠ A stick-driven verb shows the stick and is NOT offered for rebinding.
                        `Binding` models keys and buttons, not axes — presenting an empty, clickable
                        slot would promise a rebind that silently cannot be stored. */}
                    {stick
                      ? <span className="tabular-nums w-[74px] text-center text-[12px] hk-faint">L-Stick</span>
                      : <Slot label={b.pad.length ? padName(b.pad[0], padKind) : '—'}
                              active={capture?.id === id && capture.device === 'pad'}
                              onClick={() => setCapture({ id, device: 'pad' })} />}
                  </div>
                )
              })}
              {rows.some(id => clashFor(id).length > 0) && (
                <div className="mt-1 text-[12px] hk-ember">
                  {rows.flatMap(clashFor).filter((c, i, a) => a.indexOf(c) === i).map(c =>
                    // Shown, never refused: Drop and Cycle genuinely share Q and the game picks by
                    // whether the weapon is drawn. The player decides whether a clash bothers them.
                    `${c.device === 'key' ? keyName(c.input) : c.input} is shared by ${c.actions.map(a => LABEL[a]).join(' + ')}`
                  ).join(' · ')}
                </div>
              )}
            </div>
          )
        })}

        <button onClick={() => { const d = resetAll(); setMap(d); save(d) }}
                className="hk-btn mt-1 px-3 py-1 text-[12px]">Reset to defaults</button>
    </HearthFrame>
  )
}

function Slot({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
            className={`tabular-nums w-[74px] rounded border px-2 py-1 text-center text-[12px] transition-colors ${
 active ? 'hk-rule-ember hk-fill-ember hk-ember' : 'hk-rule hk-ink hk-hover-edge'}`}>
      {active ? 'press…' : label}
    </button>
  )
}
