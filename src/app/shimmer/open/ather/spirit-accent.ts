// BETA M204 s2 (sprites, 2026-11-26): HER GLOW ACCENT comes from her bar. Alex 11-26 (BETA Inbox 14:0x): "everytime the player
// feed the spirit the infused spices add to the color until its full and the color cant be changed.. (can we give the spirit
// this same glow accent?) ... feed the spirit 10 meals to lock in its element and glow". So: the meals fed (infusions.ts, her
// 10-slot bar) tint a live glow on her model (spirit-model.tsx: a fresnel rim + a faint floor in the accent colour, and her
// translucent hull leans to it), in the BAR'S OWN colours (spirit.ts ELEMENT_COLORS, the slots' colours) mixed by count,
// growing with how full the bar is (the glow FLOWS through the slots' colours along her body, in feed order, so a mixed bar
// shows every colour fed rather than the grey their average would be); at 10 it is LOCKED (steady, full, and the bar can never change again, so neither can she).
// No meals = no accent.
// ★ M204 s3 (canon 35c83eb, game/alchemy.md › THE COOKING ROAD › The glow, colours = game/magii.md › The Elements): the glow
// is the element's CANON colour, Mana violet, Storm blue, Earth brown, Water teal, and the Steep fills in the same colours.
// ELEMENT_COLORS (spirit.ts) is the one table. s2 'lit' every colour (scaled so its brightest channel was 1), which kept the
// hue but threw away the value, and brown IS a dark orange: lit, earth #8a6a3a read #ffc46b, gold/orange. So the colours go
// to the glow AS THEY ARE (no brightening), and the mix is their plain mean.
// ★ PURE: no three, no React. Run: npx tsx src/app/shimmer/open/ather/spirit-accent.test.ts
import { ELEMENT_COLORS } from '../../spirits/spirit'
import { BAR_SLOTS, isElement } from './infusions'
import type { FormElement } from '../../spirits/second-form-gate'

export type Accent = {
  /** the bar's canon colours mixed by meal count (sRGB 0..1): their plain mean, never brightened (M204 s3: lit brown = orange) */
  rgb: [number, number, number]
  /** how strong: grows meal by meal, 1 when locked */
  s: number
  locked: boolean
  /** meals in the bar (0..10) */
  n: number
  /** the mix as #rrggbb (the probe and the check read it) */
  hex: string
  /** each slot's own canon colour, in feed order: the glow flows through them along her body (every colour fed shows on her) */
  slots: [number, number, number][]
}
/** strength before the lock: n / 10 of this (3 meals = 0.21); the lock jumps to 1 so a full bar reads as finished */
export const ACCENT_OPEN_MAX = 0.7
/** the pulse of an open (unlocked) accent: +- this share of its strength; a locked one is steady */
export const ACCENT_PULSE = 0.25

const rgbOf = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] }
const hexOf = (c: readonly number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')

/** Her accent from her bar (in feed order, as the pot keeps it). Null = no meals yet = no accent. */
export function accentOf(meals: readonly unknown[] | undefined): Accent | null {
  const m = (meals ?? []).filter(isElement).slice(0, BAR_SLOTS) as FormElement[]
  if (!m.length) return null
  const sum: [number, number, number] = [0, 0, 0]
  for (const el of m) { const c = rgbOf(ELEMENT_COLORS[el]); sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2] }
  const rgb = sum.map(v => v / m.length) as [number, number, number]
  const locked = m.length >= BAR_SLOTS
  return { rgb, s: locked ? 1 : ACCENT_OPEN_MAX * m.length / BAR_SLOTS, locked, n: m.length, hex: hexOf(rgb), slots: m.map(el => rgbOf(ELEMENT_COLORS[el])) }
}

/** The accent's strength at time t (seconds): an open bar breathes, a locked one holds. Allocation-free (per frame). */
export const accentAt = (a: Accent | null, t: number): number =>
  !a ? 0 : a.locked ? a.s : a.s * (1 + ACCENT_PULSE * Math.sin(t * Math.PI * 2 * 0.45))
