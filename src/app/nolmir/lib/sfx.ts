// NOLMIR audio — the Arcane spine (chosen 2026-06-11). The Web Audio engine +
// manager now live in the shared arcade toolkit (@/lib/arcade/sfx); this file is
// just Nolmir's sound SET (the arcane patch) + the singleton wired to it. Tune a
// cue here and you hear it in-game. The sfx-lab page keeps its own copy for the
// 3-vibe pitch comparison.

import { makeEngine, SfxManager, type Engine, type Patch } from '@/lib/arcade/sfx'

export { makeEngine }
export type { Engine }

export type SfxId =
  | 'click' | 'buy' | 'error' | 'unlock'
  | 'shot' | 'bolt' | 'hit' | 'death' | 'heal' | 'break'
  | 'waveClear' | 'levelUp' | 'vault' | 'warp' | 'wash'

// THE ARCANE SPINE — crystalline bells, runic shimmer. The two flood moments
// (wash / vault) carry deeper weight, the Abyssal accent inside the arcane set.
export const arcane: Patch<SfxId> = {
  click: (E, t) => E.tone(t, 1046, { type: 'triangle', dur: 0.12, peak: 0.16, attack: 0.008 }),
  buy: (E, t) => { E.tone(t, 880, { type: 'sine', dur: 0.4, peak: 0.16, detune: 6 }); E.tone(t + 0.04, 1320, { type: 'sine', dur: 0.5, peak: 0.12, detune: 7 }) },
  unlock: (E, t) => [523, 659, 784].forEach((f) => E.tone(t, f, { type: 'sine', dur: 0.7, peak: 0.12, detune: 5, attack: 0.01 })),
  error: (E, t) => E.tone(t, 233, { type: 'triangle', dur: 0.28, peak: 0.16, detune: 22, vibHz: 14, vibDepth: 30 }),
  shot: (E, t) => { E.tone(t, 1318, { type: 'triangle', dur: 0.16, peak: 0.13, glideTo: 740 }); E.noise(t, { dur: 0.1, peak: 0.04, filter: 5000, q: 0.6 }) },
  bolt: (E, t) => { E.tone(t, 1568, { type: 'sine', dur: 0.18, peak: 0.2, glideTo: 820, detune: 8 }); E.noise(t, { dur: 0.06, peak: 0.05, filter: 4200, q: 0.7 }) },
  hit: (E, t) => { E.tone(t, 560, { type: 'triangle', dur: 0.1, peak: 0.22, glideTo: 380 }); E.tone(t, 1100, { type: 'sine', dur: 0.09, peak: 0.1 }); E.noise(t, { dur: 0.05, peak: 0.1, filter: 2600, q: 1 }) },
  death: (E, t) => { E.tone(t, 520, { type: 'sine', dur: 0.35, peak: 0.16, glideTo: 120, detune: 10 }); E.noise(t + 0.02, { dur: 0.3, peak: 0.08, filter: 3000, sweepTo: 400, filterType: 'lowpass' }) },
  heal: (E, t) => [784, 1175, 1568].forEach((f, i) => E.tone(t + i * 0.06, f, { type: 'sine', dur: 0.5, peak: 0.13, detune: 6, attack: 0.01 })),
  break: (E, t) => { E.tone(t, 330, { type: 'triangle', dur: 0.55, peak: 0.22, glideTo: 130, detune: 16, vibHz: 6, vibDepth: 18 }); E.tone(t + 0.04, 220, { type: 'sine', dur: 0.5, peak: 0.16, glideTo: 90, detune: 10 }) },
  waveClear: (E, t) => [523, 659, 784, 1047].forEach((f, i) => E.tone(t + i * 0.08, f, { type: 'sine', dur: 0.6, peak: 0.12, detune: 5 })),
  levelUp: (E, t) => [659, 988, 1319, 1976].forEach((f, i) => E.tone(t + i * 0.06, f, { type: 'sine', dur: 0.55, peak: 0.13, detune: 7, attack: 0.008 })),
  vault: (E, t) => { E.tone(t, 110, { type: 'sine', dur: 0.9, peak: 0.2, detune: 8 }); E.tone(t + 0.1, 220, { type: 'triangle', dur: 0.8, peak: 0.1, detune: 14, vibHz: 5, vibDepth: 12 }) },
  warp: (E, t) => { E.tone(t, 330, { type: 'sine', dur: 0.7, peak: 0.16, glideTo: 1980, detune: 10 }); [988, 1319, 1760, 2349].forEach((f, i) => E.tone(t + 0.25 + i * 0.06, f, { type: 'sine', dur: 0.5, peak: 0.1, detune: 8 })) },
  wash: (E, t) => { E.noise(t, { dur: 1.1, peak: 0.2, filter: 900, sweepTo: 220, filterType: 'lowpass', q: 0.7 }); E.tone(t, 98, { type: 'sine', dur: 1.0, peak: 0.16, detune: 9 }); E.tone(t + 0.2, 196, { type: 'triangle', dur: 0.8, peak: 0.08, vibHz: 3, vibDepth: 20 }) },
}

// per-event minimum gap (ms) — keeps a heavy wave/brawl musical, not a buzzsaw
const THROTTLE: Partial<Record<SfxId, number>> = { shot: 55, bolt: 42, hit: 35, death: 70, heal: 90 }

export const sfx = new SfxManager<SfxId>(arcane, { throttle: THROTTLE, storageKey: 'nolmir.sfx', defaultVolume: 0.4 })
