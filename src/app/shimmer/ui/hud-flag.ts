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
