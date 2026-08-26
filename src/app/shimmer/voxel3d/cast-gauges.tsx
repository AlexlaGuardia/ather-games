'use client'

// cast-gauges.tsx — is the tactical ready? is the signature ready?
//
// ★ WHY THIS DID NOT EXIST UNTIL 2026-08-26, WHICH IS THE INTERESTING PART. Cooldowns have been
// fully tracked since the cast port: `castCd` holds a `performance.now()` deadline per band and
// `resolveCast` refuses a cast that is still cooling with a spoken reason. But the only place a
// keeper could SEE a cooldown was the loadout tab inside the bag — a panel you open while nothing
// is happening. In the fight, the state was invisible: you pressed Z, something declined, and the
// only feedback was a line of text. Alex: "so the player can actively see when they are on cooldown
// or ready."
//
// ⚠ IT READS THE SAME `cooldownUntil` THE DISPATCHER WRITES, and derives the fraction from the
// move's own `cooldownMs`. Nothing here keeps its own clock or its own copy of the duration — a
// second timer would drift from the one that actually refuses the cast, and the gauge would say
// READY while the world said no. That is the mirror failure this codebase has now catalogued a
// dozen times.
//
// ⚠ AND IT POLLS A REF RATHER THAN RE-RENDERING. A cooldown sweep at 60fps through React state is
// ~120 renders of the whole HUD per cast. Same discipline as `ManaGauge` and `ResourceBars`: read
// the ref on an interval, write the style directly.

import React, { useEffect, useRef, useState } from 'react'
import { castForMove, ALL_BANDS, BAND_KEYS, type CastArchetype } from '../play3d/cast'

export interface CastHud {
  /** bound move id per band, or null — the same array shape `loadout` holds */
  ids: (string | null)[]
  /** `performance.now()` deadline per band; <= now means ready */
  until: number[]
}

/** What each band is called on screen. Canon calls the ultimate a SIGNATURE. */
const BAND_LABEL: Record<string, string> = { tactical: 'TACTICAL', ultimate: 'SIGNATURE' }


/**
 * ── ★ A MOVE'S ICON IS ITS ARCHETYPE, NOT ITS RUNE (2026-08-26) ──────────────────────────────────
 * Alex asked for an icon per move to simplify the button. It draws what the move DOES, and that is
 * a deliberate choice with canon behind it: `moves.md:5` rules that **colour is never part of a
 * move — colour is the mage's own soul-frequency, applied when they cast it**, and `cast.ts` records
 * v2 shipping rune-coloured casts as drift. So nothing here may key off the rune, in shape OR hue.
 * These are monochrome `currentColor`, exactly like `ToolGlyph`, and the caster supplies the colour.
 *
 * ⚠ AND ARCHETYPE IS THE RIGHT AXIS ANYWAY. A HUD button answers "what happens if I press this",
 * and the archetype IS that answer — the sim branches on it. Keying on move ID would need a new
 * drawing every time canon registers a move, and there are 68 of them with more coming; keying on
 * archetype covers every move that will ever exist by construction.
 */
function MoveGlyph({ archetype, chains }: { archetype: CastArchetype; chains?: boolean }) {
  switch (archetype) {
    case 'projectile':
      // ⚠ ONE MODIFIER, AND IT EARNS ITS KEEP. Archetype alone drew Ice Dart and Chain Lightning
      // identically — the two most likely bindings in the game, side by side, indistinguishable.
      // `chain > 0` is a build field, not a rune, so branching on it stays clear of the colour law,
      // and CHAINING is exactly what differs between those two moves. A bolt that forks.
      return chains
        ? <><path d="M3 18 L13 8" /><path d="M13 8 L19 5 L17 10 Z" fill="currentColor" stroke="none" />
             <path d="M13 8 L18 13" /><path d="M13 8 L9 3" /></>
        : <><path d="M3 18 L15 6" /><path d="M15 6 L20 4 L18 9 Z" fill="currentColor" stroke="none" /></>
    case 'restore':    // mending — a cross, no cup, nothing medical
      return <><path d="M12 5v14" /><path d="M5 12h14" /></>
    case 'stance':     // a held shell
      return <path d="M12 3 4 6.5v6c0 4.5 3.4 7.4 8 8.5 4.6-1.1 8-4 8-8.5v-6L12 3Z" />
    case 'surge':      // a burst of speed — stacked chevrons
      return <><path d="M5 16 11 8 17 16" /><path d="M7 20 11 14 15 20" /></>
    case 'field':      // a placed area that persists
      return <><circle cx="12" cy="14" r="6" /><path d="M6 14a6 3 0 0 0 12 0" /></>
    case 'terrain':    // raised ground
      return <><path d="M3 19h18" /><path d="M7 19V9h4v10" /><path d="M13 19v-6h4v6" /></>
    case 'status':     // an option removed
      return <><circle cx="12" cy="12" r="7.5" /><path d="M7 17 17 7" /></>
    case 'impulse':    // the caster moves — a leap
      return <><path d="M4 19c5 0 7-3 8-6s3-6 8-6" /><path d="M17 4h3v3" /></>
    case 'infusion':   // the weapon carries it
      return <><path d="M7 20 17 6" /><path d="M14 4c2.5 1.5 3 4.5 1.5 7" /></>
    case 'unbuilt':    // registered in canon, no behaviour yet — the honesty rule, on screen
      return <><circle cx="12" cy="12" r="7.5" strokeDasharray="3 3" /><path d="M12 8v5" /><circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none" /></>
  }
}

export function CastGauges({ cast }: { cast: React.RefObject<CastHud | null> }) {
  // Which archetype each band currently holds. State (not a ref) because the GLYPH is React-rendered
  // — it changes only when the loadout changes, which is rare, so a re-render is the cheap path.
  const [arch, setArch] = useState<(string | null)[]>(() => ALL_BANDS.map(() => null))
  const keys = useRef<(HTMLSpanElement | null)[]>([])
  const glyphs = useRef<(SVGSVGElement | null)[]>([])
  const contents = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const id = setInterval(() => {
      const c = cast.current
      if (!c) return
      const now = performance.now()
      ALL_BANDS.forEach((_, i) => {
        const moveId = c.ids[i] ?? null
        const spec = moveId ? castForMove(moveId) : null
        const total = spec?.cooldownMs ?? 0
        const left = Math.max(0, (c.until[i] ?? 0) - now)
        // ⚠ A move with NO cooldown is always ready and must read as FULL, not as empty. `left/total`
        // with total 0 is NaN, and NaN width silently renders as nothing — a permanently empty gauge
        // on the one move that is never unavailable.
        const pct = total > 0 ? Math.max(0, Math.min(1, 1 - left / total)) : 1
        void pct
        // ★ THE BUTTON *IS* THE READOUT (Alex, 2026-08-26). A sweep meter was furniture: Ice Dart
        // cools in 650ms, which is over before anyone reads a bar. Darken on use, count down, light
        // back up. Three states and no geometry.
        // ⚠⚠ THE DIM GOES ON THE CONTENT, NEVER ON THE PLATE — and this file had the bug that
        // `ToolSocket`'s own comment was written about, four metres away in the same corner:
        // "bg-black/45 × 0.4 is an 18% film, so over a lit grass field the plate disappeared and
        // four faint rings were left floating on the world." Measured on the `sky` backdrop, a
        // wrapper-dimmed glyph came out at 2.10 contrast against its own plate — under the 3.0 a
        // graphic needs, on the one state the button spends most of its time in.
        // The plate stays opaque and the CONTENT carries the state.
        const w = contents.current[i]
        if (w) w.style.opacity = moveId ? (left > 0 ? '0.42' : '1') : '0.25'
        // The KEY square carries the countdown, because the key is the thing you are about to press.
        // Tenths under ten seconds — a 0.6s cooldown shown as "1" then "0" is a lie twice over.
        const k = keys.current[i]
        if (k) {
          const t = left > 0 ? (left >= 10000 ? `${Math.ceil(left / 1000)}` : (left / 1000).toFixed(1)) : (BAND_KEYS[i] ?? '?').toUpperCase()
          if (k.textContent !== t) k.textContent = t
          k.style.fontSize = left > 0 ? '8px' : ''
        }
        // ⚠ The glyph is rendered by React below, keyed off the archetype — this effect only tracks
        // WHICH archetype is bound so a loadout change repaints it. Writing SVG paths from an
        // interval would be re-implementing the renderer inside a timer.
        const g = glyphs.current[i]
        if (g) {
          const want = spec ? `${spec.archetype}${spec.chain > 0 ? ':chain' : ''}` : 'none'
          if (g.dataset.arch !== want) { g.dataset.arch = want; setArch(a => (a[i] === want ? a : Object.assign([...a], { [i]: want }))) }
        }
      })
    }, 60)
    return () => clearInterval(id)
  }, [cast])

  return (
    // ── ★ SIDE BY SIDE, ICON-FIRST (Alex, 2026-08-26) ────────────────────────────────────────────
    // Two square tiles instead of two full-width rows. The move NAME is gone from the tile: an icon
    // and a key are what you read mid-fight, and the name was the widest thing on a HUD element you
    // never actually read a word of. It lives one keypress away in the bag, which is where reading
    // belongs. Simplify as much as possible was the ask, and the name was the thing to cut.
    <div className="flex gap-1.5 font-mono pointer-events-none">
      {ALL_BANDS.map((kind, i) => (
        <div key={kind} title={BAND_LABEL[kind] ?? kind}
             className="relative h-[52px] w-[52px] rounded bg-black/60 ring-1 ring-white/15
                        flex items-center justify-center">
          <div ref={el => { contents.current[i] = el }}
               className="absolute inset-0 flex items-center justify-center transition-opacity duration-150">
          {/* The glyph is the button. `text-current` so the wrapper's opacity carries the state and
              nothing here has to know what "cooling" looks like. */}
          <svg viewBox="0 0 24 24" ref={el => { glyphs.current[i] = el }}
               className="h-7 w-7 text-amber-100/85" fill="none" stroke="currentColor"
               strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {arch[i] && arch[i] !== 'none' && (
              <MoveGlyph archetype={(arch[i] as string).split(':')[0] as CastArchetype}
                         chains={(arch[i] as string).endsWith(':chain')} />
            )}
          </svg>
          {/* Key in the corner while ready; the COUNTDOWN takes its place while cooling, because the
              key is the thing you are about to press and it is where the eye already is. */}
            <span ref={el => { keys.current[i] = el }}
                  className="absolute bottom-0.5 right-1 text-[9px] font-bold tabular-nums text-white/70">
              {(BAND_KEYS[i] ?? '?').toUpperCase()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
