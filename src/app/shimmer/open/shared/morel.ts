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

// ── the gun's numbers, published by the combat layer itself (not through a React state: on a slow device a page re-render
// lags the trigger by seconds, and the bubble would hold for as long as the page took to draw) ──
export interface AmmoFeed { ammo: number; clip: number; reloading: boolean; firing?: boolean }
let ammoFeed: AmmoFeed | null = null
export const setAmmoFeed = (f: AmmoFeed | null) => { ammoFeed = f }
export const getAmmoFeed = () => ammoFeed

// ── the gem's glow, read by the gloves every frame (open-hands, fp-gun) ──
let pulseAt = -1e9
/** 0..1: a round just changed (fades over PULSE s). */
export const gemGlow = (now: number) => { const t = now - pulseAt; return t < 0 || t > PULSE ? 0 : 1 - t / PULSE }
/** tests only */
export const _resetGem = () => { pulseAt = -1e9 }

// ── S2 STUCK HINTS ──
// No errand progress for STALL s of ACTIVE play (tab visible, no menu or panel up, not in a fight), or AWAY s spent walking
// AWAY from the errand's mark (AWAY_M further than the nearest point of that window) -> ONE hint for that stage. Then quiet
// for COOL s; at most MAX_HINTS per stage. A stage change (progress) resets everything. Times scale by `speed` (checks:
// ?morel=fast = x20, so a 4 min stall is 12 s).
export const STALL = 240, AWAY = 60, AWAY_M = 15, COOL = 300, MAX_HINTS = 2
export type HintStage = 'none' | 'greg' | 'smith' | 'temple' | 'done'
export interface HintWatch { stage: HintStage | null; idle: number; last: number; lastHint: number; count: number; track: { t: number; d: number }[] }
export const newHintWatch = (): HintWatch => ({ stage: null, idle: 0, last: -1, lastHint: -1e9, count: 0, track: [] })
export interface HintIn { stage: HintStage; now: number; active: boolean; dist: number | null; speed?: number }
/** One look at the errand. Mutates `w`; returns which of the stage's hints to say (0 / 1), and why, or null. */
export function hintStep(w: HintWatch, a: HintIn): { i: number; why: 'stall' | 'away' } | null {
  const k = a.speed ?? 1, stall = STALL / k, away = AWAY / k, cool = COOL / k
  if (a.stage !== w.stage) { w.stage = a.stage; w.idle = 0; w.count = 0; w.track = []; w.last = a.now; return null }
  const dt = w.last < 0 ? 0 : Math.min(2, Math.max(0, a.now - w.last)); w.last = a.now
  if (a.stage === 'none' || a.stage === 'done' || !a.active) return null
  w.idle += dt
  let goingAway = false
  if (a.dist !== null) {
    w.track.push({ t: a.now, d: a.dist }); w.track = w.track.filter(s => a.now - s.t <= away)
    const min = Math.min(...w.track.map(s => s.d))
    goingAway = a.now - w.track[0].t >= away * 0.9 && a.dist - min > AWAY_M && a.dist >= w.track[0].d + AWAY_M
  } else w.track = []
  if (!(w.idle >= stall || goingAway) || a.now - w.lastHint < cool || w.count >= MAX_HINTS) return null
  const why = goingAway ? 'away' : 'stall'
  w.count++; w.lastHint = a.now; w.idle = 0; w.track = []
  return { i: (w.count - 1) % 2, why }
}
