// ══ THE WORLD PROMPT'S PLACE (BETA M218, 2026-11-27) ═══════════════════════════════════════════════════════════════
// Alex 11-26: "that tool tip that's always blocking the center of the screen.. I'm sure there's something better we can
// do there". The E prompt ("E · talk to Fennel", "E · the gate (fold map)") sat at top 58%, the waymark refusal at 64%:
// both inside the band the keeper looks through. The prompt slot now lives in the HUD template (game-hud.tsx draws it,
// pages pass the lines) and never enters the CENTRE BOX: the middle 30% of the screen on both axes.
//
//   desktop (wide / compact)  bottom-centre, the template's FREE slot (the hotbar is top-left), stacked up from
//                             PROMPT_DESK_BOTTOM: clear of the continent's MPH readout (bottom 16, ~90 tall) and short
//                             enough to stay under the Ather's gather bar (bottom 150) with one line up
//   phone portrait            left edge, hung just BELOW the centre box and growing down (the bottom-centre is the
//                             hotbar + the near pills; the stick hint sits lower, at the bar's clear)
//   phone landscape           left edge, mid-height: a short screen has no free bottom; the left third is clear of the
//                             centre box on the x axis, whatever the height
// A prompt dims to PROMPT_DIM after PROMPT_HOLD_MS of the same text and comes back to full when the text changes.

import type { HudSize } from '../../ui/hud-flag'

export type HudPromptLine = { text: string; tone?: 'warn' | 'verb'; /** data-* hooks a check reads, e.g. { 'waymark-why': '' } → data-waymark-why */ data?: Readonly<Record<string, string>> }

export const PROMPT_DESK_BOTTOM = 112
export const PROMPT_HOLD_MS = 2600
export const PROMPT_DIM = 0.5
/** the share of the screen (each axis) a prompt must stay out of */
export const CENTRE_SHARE = 0.3

export type PromptPlace = { left?: number | string; right?: number | string; top?: number | string; bottom?: number | string; transform?: string; maxWidth: number; align: 'left' | 'center'; anchor: 'bottom' | 'middle' | 'top' }

export function promptPlace(size: HudSize, vw: number, vh: number): PromptPlace {
  if (size !== 'phone') return { left: '50%', transform: 'translateX(-50%)', bottom: PROMPT_DESK_BOTTOM, maxWidth: Math.min(520, Math.round(vw * 0.6)), align: 'center', anchor: 'bottom' }
  // the left third: everything left of the centre box's edge, minus the gutter
  const leftThird = Math.floor(vw * (0.5 - CENTRE_SHARE / 2)) - 12 - 8
  if (vh < 520 && vw > vh) return { left: 12, top: '50%', transform: 'translateY(-50%)', maxWidth: Math.max(140, leftThird), align: 'left', anchor: 'middle' }
  return { left: 12, top: Math.ceil(vh * (0.5 + CENTRE_SHARE / 2)) + 10, maxWidth: Math.min(260, Math.round(vw * 0.62)), align: 'left', anchor: 'top' }
}

/** the centre box in px: [x0, y0, x1, y1] */
export function centreBox(vw: number, vh: number): [number, number, number, number] {
  const hx = vw * CENTRE_SHARE / 2, hy = vh * CENTRE_SHARE / 2
  return [vw / 2 - hx, vh / 2 - hy, vw / 2 + hx, vh / 2 + hy]
}

/** a laid-out rect (x, y, w, h) against the centre box */
export function overlapsCentre(r: { x: number; y: number; w: number; h: number }, vw: number, vh: number): boolean {
  const [x0, y0, x1, y1] = centreBox(vw, vh)
  return r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0
}

/** where the stack would land for `lines` lines of `lineH` px (gap 6) and the widest line `w` px: the test's model of the DOM */
export function promptRect(p: PromptPlace, vw: number, vh: number, lines: number, w: number, lineH = 30): { x: number; y: number; w: number; h: number } {
  const h = lines * lineH + (lines - 1) * 6, ww = Math.min(w, p.maxWidth)
  const x = p.align === 'center' ? vw / 2 - ww / 2 : (p.left as number)
  const y = p.anchor === 'middle' ? vh / 2 - h / 2 : p.anchor === 'top' ? (p.top as number) : vh - (p.bottom as number) - h
  return { x, y, w: ww, h }
}
