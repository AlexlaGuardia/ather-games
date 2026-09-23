// The HUD-face flag — which face a keeper asked for, if any. Pure (no React, no fonts), so it tests
// under node; the tokens themselves live in `hud-face.ts`, which needs the hearth kit and so cannot.
//
// ⚠ OFF UNLESS ASKED FOR. `readHudFace()` is null by default and null means THE SHIPPED HUD, untouched.
// `?hud=light|full` (or `localStorage['ather:shimmer:hudFace']`) turns the kit on for one keeper.
// After Alex's pick the default flips here and the flag retires.

export type HudFace = 'light' | 'full'
export const HUD_FACE_NAMES: readonly HudFace[] = ['light', 'full']
export const FACE_KEY = 'ather:shimmer:hudFace'

/** Parse a flag value. Anything that is not a face name is "kit off" — never a guessed default. */
export const parseHudFace = (v: string | null | undefined): HudFace | null =>
  v === 'light' || v === 'full' ? v : null

/**
 * The face this keeper asked for, or null. URL beats storage so a shared link shows what it names.
 * Storage is wrapped: a private window throws, and a throw here would take the HUD down with it for
 * the sake of a preview flag.
 */
export function readHudFace(search?: string, store?: Pick<Storage, 'getItem'> | null): HudFace | null {
  if (search === undefined && typeof window === 'undefined') return null
  const q = parseHudFace(new URLSearchParams(search ?? window.location.search).get('hud'))
  if (q) return q
  try {
    const s = store === undefined ? window.localStorage : store
    return parseHudFace(s?.getItem(FACE_KEY))
  } catch { return null }
}

// ── ★ THE HUD SIZES (2026-09-23, Alex: "any suggestions for the narrow window.. i imagine its the
// same for mobile") ──────────────────────────────────────────────────────────────────────────────
// The wide bottom row is THREE things side by side — the health column (~225px), the Full-hearth
// hotbar (~490px) and the orb + tool arch (~235px) — so under ~1000px they collide, and at phone
// width no arrangement of three-abreast fits. The answer is not to shrink everything; the hotbar
// keeps the bottom edge and the corners move OFF that row:
//   wide    ≥ 1000  — as designed: health bottom-left, orb bottom-right.
//   compact  < 1000 — 44px wells; health rides the hotbar as a lip; buffs go top-left; the orb shrinks.
//   phone    <  600 — 40px wells, the bar IS the bottom edge; health + mana are two lip bars, the orb
//                     is gone, tools are four pips on the lip; minimap 96; the bottom corners stay
//                     EMPTY on purpose — they are where thumbs go once the Ather has touch controls.
// A size is chosen by the HOST from the real width and passed down as a prop, never read from a CSS
// media query inside a piece: the dev page has to be able to show a phone inside a desktop window.
export type HudSize = 'wide' | 'compact' | 'phone'
export const HUD_COMPACT_BELOW = 1000
export const HUD_PHONE_BELOW = 600
export const hudSizeFor = (width: number): HudSize =>
  width < HUD_PHONE_BELOW ? 'phone' : width < HUD_COMPACT_BELOW ? 'compact' : 'wide'
