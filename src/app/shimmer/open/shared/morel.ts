// ── MOREL: WHEN THE GLOVE'S GEM SPEAKS (BETA M33, Alex 11-19) ─────────────────────────────────────────────────────────
// CANON (athernyx f83b66f, world/network.md › The gem and Morel): every Alkin child of 1672 wears a gem in the glove,
// Alkin manatech that catches the Network's signals; its voice is MOREL, made by Alkin hands (the Network stays mute).
// Canon owns WHAT Morel is and lark writes every line (shared/morel-lines.ts); this file is Jin's half: WHEN it speaks.
//
// The rule (BETA M33): QUIET BY DEFAULT. Morel speaks on a CHANGE or when the keeper is stuck, never every shot.
//   S1 AMMO: the thought bubble by the glove shows while the trigger is held (rounds left, red at RED_AT and under) and
//            holds BUBBLE_HOLD s after release, then fades. The gem pulses on every round change. Spoken: ONE line when the
//            clip crosses RED_AT, ONE when it runs dry; a reload (the count going UP) re-arms both.
//
// ★ PURE (no React, no three): the page feeds `ammoStep` from the combat HUD and draws what it returns; the gloves read
// `gemGlow`. Node tests drive this file directly (morel.test.ts).

/** at or under this many rounds the bubble is red and Morel says so (once per clip) */
export const RED_AT = 7
/** seconds the bubble stays after the trigger is let go, then FADE s to nothing */
export const BUBBLE_HOLD = 3
export const FADE = 0.5
/** how long a round's pulse lights the gem (s) */
export const PULSE = 0.35

export type AmmoSay = 'low' | 'empty'
export interface AmmoWatch { ammo: number; firingAt: number; releasedAt: number; saidLow: boolean; saidEmpty: boolean; pulseAt: number }
export interface AmmoIn { ammo: number; clip: number; firing: boolean; reloading: boolean; now: number }
export interface Bubble { show: boolean; n: number; clip: number; red: boolean; alpha: number; reloading: boolean }

export const newAmmoWatch = (ammo = 0): AmmoWatch => ({ ammo, firingAt: -1e9, releasedAt: -1e9, saidLow: false, saidEmpty: false, pulseAt: -1e9 })

/** One look at the gun. Mutates `w`; returns what to draw and, at most once per crossing, what Morel says. */
export function ammoStep(w: AmmoWatch, a: AmmoIn): { bubble: Bubble; say: AmmoSay | null } {
  let say: AmmoSay | null = null
  if (a.ammo !== w.ammo) {
    w.pulseAt = a.now; pulseAt = a.now
    if (a.ammo > w.ammo) { w.saidLow = false; w.saidEmpty = false }   // a reload re-arms both lines
    else if (a.ammo <= 0 && !w.saidEmpty) { w.saidEmpty = true; w.saidLow = true; say = 'empty' }
    else if (a.ammo <= RED_AT && w.ammo > RED_AT && a.clip > RED_AT && !w.saidLow) { w.saidLow = true; say = 'low' }
    w.ammo = a.ammo
  }
  if (a.firing) { w.firingAt = a.now; w.releasedAt = a.now }
  const since = a.firing ? 0 : a.now - w.releasedAt
  const alpha = since <= BUBBLE_HOLD ? 1 : Math.max(0, 1 - (since - BUBBLE_HOLD) / FADE)
  return { bubble: { show: alpha > 0, n: a.ammo, clip: a.clip, red: a.ammo <= RED_AT, alpha, reloading: a.reloading }, say }
}

// ── the gem's glow, read by the gloves every frame (open-hands, fp-gun) ──
let pulseAt = -1e9
/** 0..1: a round just changed (fades over PULSE s). */
export const gemGlow = (now: number) => { const t = now - pulseAt; return t < 0 || t > PULSE ? 0 : 1 - t / PULSE }
/** tests only */
export const _resetGem = () => { pulseAt = -1e9 }
