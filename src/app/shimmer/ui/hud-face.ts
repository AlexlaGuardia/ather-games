// THE HUD FACES — Phase 9 of the Carved Hearth, as data.
//
// ── ★ WHY A FILE OF TOKENS (2026-09-23, play lane, hub's work order) ──────────────────────────
// Alex is choosing the always-on HUD's face at `/shimmer/dev/hud-mock` between two looks:
//   light — LIGHT TOUCH: stays dark and quiet so it never competes with the world, but takes the
//           hearth's shapes (rounded wells, a slim wood rim, the ember ring, the two faces).
//   full  — FULL HEARTH: wood frames and parchment on the HUD itself.
// The HUD pieces in `hearth-hud.tsx` were built BEFORE that call, against both. Every colour, rim
// and shadow that differs between the two lives here and nowhere else, so the pick is ONE KEY — and
// a retune after the pick is one edit to one record, not a hunt through nine components.
//
// The values are lifted from the mock verbatim, so what Alex judges on the mock is what the kit
// draws. `Record<HudFace, HudTokens>` is the completeness check: a token one face forgets is a type
// error, not a blank on screen. The on/off flag lives in `hud-flag.ts` (pure, so it tests in node).
import { H, WOOD, PAPER, grain } from './hearth'
import type { HudFace } from './hud-flag'
export type { HudFace } from './hud-flag'

export interface HudTokens {
  /** Plate: what a readout sits on. `rim` is the frame round it (background shorthand), `pad` its width. */
  plate: string
  rim: string
  rimPad: number
  plateShadow: string
  /** Text on a plate. `shadow` is 'none' where the plate is parchment (ink needs no halo). */
  text: string
  textDim: string
  textShadow: string
  /** The one ACT-HERE colour: selected slot, objective value. */
  accent: string
  /** A slot well (hotbar, tool sockets) — idle, and selected. */
  well: string
  wellShadow: string
  wellSelShadow: string
  wellKey: string
  count: string
  countShadow: string
  /** The label over the bar ("Glass · 3"): it sits on the WORLD, never on a plate, in both faces. */
  heldColor: string
  /** A bar's empty track (health). */
  track: string
  /** Moss-for-have, used by the shield "+N". */
  plus: string
  /** The hotbar's tray: what the row of wells sits in. Light = smoke inside the slim rim; full = the
   *  wood board itself (the inner fill is transparent so the rim's wood IS the tray). */
  tray: string
  trayPad: number
  /** Round things (minimap, mana orb, tool sockets) get a ring, not a board. */
  ring: string
  ringShadow: string
}

const CREAM = '#f6e4c2'
const SMOKE = 'rgba(30,19,10,.62)'
const RIM = `${grain(0.01, 0.4, 3, 0.6)}, linear-gradient(180deg, #9a6a3c, #5a371d)`
const HALO = '0 1px 2px rgba(0,0,0,.85)'

export const HUD_FACES: Record<HudFace, HudTokens> = {
  light: {
    plate: SMOKE, rim: RIM, rimPad: 2, plateShadow: '0 3px 8px rgba(0,0,0,.4)',
    text: CREAM, textDim: 'rgba(246,228,194,.7)', textShadow: HALO,
    accent: '#f1b27a',
    well: 'radial-gradient(circle at 50% 40%, rgba(60,40,24,.75), rgba(22,14,8,.85))',
    wellShadow: 'inset 0 2px 5px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,210,160,.14)',
    wellSelShadow: `inset 0 0 0 2.5px ${H.emberHi}, 0 0 12px rgba(224,130,63,.55)`,
    wellKey: 'rgba(246,228,194,.45)',
    count: CREAM, countShadow: HALO,
    heldColor: CREAM,
    track: 'rgba(0,0,0,.45)',
    plus: '#9cc58a',
    tray: SMOKE, trayPad: 2,
    ring: 'inset 0 0 0 3px #7a4f2c, inset 0 0 0 4px rgba(255,210,160,.35)',
    ringShadow: '0 3px 8px rgba(0,0,0,.4)',
  },
  full: {
    plate: PAPER, rim: WOOD, rimPad: 6, plateShadow: '0 6px 14px rgba(20,10,4,.5), inset 0 1px 0 rgba(255,210,160,.35)',
    text: H.ink, textDim: H.inkSoft, textShadow: 'none',
    accent: H.ember,
    well: 'radial-gradient(circle at 50% 40%, #e9d7b4, #d6bf95)',
    wellShadow: 'inset 0 2px 4px rgba(74,45,24,.45), inset 0 -1px 0 rgba(255,250,235,.7)',
    wellSelShadow: `inset 0 0 0 2.5px ${H.ember}, 0 3px 8px rgba(200,100,42,.4)`,
    wellKey: H.inkFaint,
    count: H.ink, countShadow: '0 1px 0 rgba(255,250,235,.8)',
    heldColor: CREAM,
    track: H.paperLo,
    plus: H.moss,
    tray: 'transparent', trayPad: 8,
    ring: 'inset 0 0 0 6px #6a4222, inset 0 0 0 7px rgba(255,210,160,.35)',
    ringShadow: '0 6px 14px rgba(20,10,4,.5)',
  },
}
