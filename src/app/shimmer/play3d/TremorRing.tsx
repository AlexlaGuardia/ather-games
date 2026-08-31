'use client'
// TremorRing — what Tremor Sense looks like. A ring of ticks around the reticle, one per contact.
//
// ★ IT IS A DUMB `map` ON PURPOSE. Every number it draws comes from `tremor-sense.ts` › `ringTick`,
// which is pure and under an oracle. A component is the one place in this codebase nothing can
// assert against, so it is given no arithmetic to get wrong — no atan2, no y-flip, no falloff curve.
// ⚠ If you find yourself computing a coordinate in this file, it belongs in `tremor-sense.ts`.
//
// ★ NO `gx-*` CLASSES, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT. The house game-UI layer
// (`app/gameui.css`) dresses PANELS — card, chrome, title, label, value, btn. This is a bare
// geometric overlay on a 3D scene with no text and no chrome in it, so reaching for gx- would be
// borrowing a look it has no surface to hang on. The moment this readout grows a label, it joins.
//
// ⚠ NO IDENTITY IS DRAWN, AND THE COMPONENT COULD NOT DRAW ONE IF IT WANTED TO. Canon says *"know
// where everyone stands"* — where, not who — and `Contact` carries no form, no hp and no name for
// exactly that reason. Do not widen the prop to pass one in.

import { useEffect, useRef, useState } from 'react'
import { ringTick, bearingOf, type Contact } from './tremor-sense'
import { gold, hair } from './tokens'
// ★ Colour comes from `tokens.ts`, and the two choices are semantic rather than aesthetic: the ring
// is a HAIRLINE (a frame of reference, not a thing to look at) and a contact is drawn in the warm
// bone weight the rest of the HUD uses for a reading. ⚠ It is deliberately NOT a rune colour —
// `moves.md:5` makes colour the mage's own soul-frequency, applied when they CAST. A sense is not a
// cast, so tinting this by rune would put a caster's signature on something nobody cast.

export interface TremorRingProps {
  /** Everything felt this tick, from `senseGround`. Empty = nothing to draw, and it draws nothing. */
  contacts: readonly Contact[]
  /** The keeper, in world units. */
  px: number
  pz: number
  /** The keeper's facing as a direction; need not be normalised. */
  fx: number
  fz: number
  /** The worn sense's reach — `spec.senseRadius`. Falloff is measured against it. */
  radius: number
  /** Ring radius on screen, px. */
  size?: number
}

/**
 * ⚠ THE HOST OWNS THE CADENCE, NOT THIS FILE. Feed it from a throttled slice of state (~10Hz is
 * plenty — the fastest body in the world covers 0.39 units between updates, which is a third of a
 * degree on a 24-unit ring), never from a 60Hz frame loop through `setState`. A HUD that re-renders
 * every frame is how a readout costs more than the world it reports on.
 */
function TremorRing({ contacts, px, pz, fx, fz, radius, size = 84 }: TremorRingProps) {
  if (contacts.length === 0) return null
  const span = size * 1.3          // room for the longest tick to point outward without clipping
  return (
    <svg
      aria-hidden
      width={span * 2}
      height={span * 2}
      viewBox={`${-span} ${-span} ${span * 2} ${span * 2}`}
      style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',   // the reticle and the world live under this; it must never eat a click
        overflow: 'visible',
      }}
    >
      {/* The ring itself, barely there — it is a frame of reference, not a thing to look at. */}
      <circle cx={0} cy={0} r={size} fill="none" stroke={hair.weak} strokeWidth={1} />
      {contacts.map((c, i) => {
        const t = ringTick(bearingOf(c, px, pz, fx, fz), c.dist, radius)
        return (
          <line
            key={i}
            x1={t.x1 * size} y1={t.y1 * size}
            x2={t.x2 * size} y2={t.y2 * size}
            stroke={gold.parchment}
            strokeOpacity={t.opacity}
            strokeWidth={2}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

// ── the ref bridge ──────────────────────────────────────────────────────────────────────────────
// The scene knows where the bodies are; the HUD knows how to draw. Neither should know the other's
// job, so the scene POSTS a readout into a ref and this component drains it. Same shape as
// `bloomRef` → `WeaponReticle`, which is the house pattern for a HUD element that must not make the
// React tree re-render at 60Hz.

export default TremorRing

export interface TremorReadout {
  contacts: readonly Contact[]
  px: number
  pz: number
  fx: number
  fz: number
  radius: number
  /**
   * Bumped by the writer on every post.
   *
   * ★★ IT EXISTS BECAUSE THE OBVIOUS CHANGE DETECTOR IS WRONG IN THE DIRECTION THAT LOOKS FINE.
   * Comparing `contacts.length` would hold a stale picture while a body walked a full circle around
   * the keeper — the count never changes, so the ring would freeze pointing at where the danger USED
   * to be, and a frozen ring is indistinguishable from a correct one until you act on it. A counter
   * cannot miss a change it did not think to look for.
   */
  rev: number
}

export const emptyReadout = (): TremorReadout =>
  ({ contacts: [], px: 0, pz: 0, fx: 0, fz: 1, radius: 0, rev: 0 })

/**
 * Drains `tremorRef` and draws it. Renders nothing at all when the keeper wears no sense, so the
 * cost of not having Tremor Sense is one `rev` comparison per animation frame.
 */
export function TremorSenseHud({ tremorRef }: { tremorRef: React.MutableRefObject<TremorReadout> }) {
  const [shown, setShown] = useState<TremorReadout>(emptyReadout)
  const seen = useRef(-1)
  useEffect(() => {
    let raf = 0
    const pump = () => {
      const r = tremorRef.current
      if (r.rev !== seen.current) {
        seen.current = r.rev
        // Copied, not aliased: the writer mutates its ref in place, so handing React the live object
        // would give it an object whose fields change under it between render and paint.
        setShown({ ...r })
      }
      raf = requestAnimationFrame(pump)
    }
    raf = requestAnimationFrame(pump)
    return () => cancelAnimationFrame(raf)
  }, [tremorRef])
  if (shown.radius <= 0 || shown.contacts.length === 0) return null
  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 30, pointerEvents: 'none' }}>
      <TremorRing
        contacts={shown.contacts}
        px={shown.px} pz={shown.pz}
        fx={shown.fx} fz={shown.fz}
        radius={shown.radius}
      />
    </div>
  )
}
