// MANA'NANA audio — bright and poppy, its own flavor (not Nolmir's arcane).
// Built on the shared arcade toolkit; tune a cue here.

import { SfxManager, type Patch } from '@/lib/arcade/sfx'

export type ManaSfx = 'swap' | 'bad' | 'pop' | 'combo' | 'shuffle' | 'over' | 'bloom' | 'surge' | 'prism' | 'star' | 'reward'

const patch: Patch<ManaSfx> = {
  swap: (E, t) => E.tone(t, 660, { type: 'sine', dur: 0.09, peak: 0.13, glideTo: 900 }),
  bad: (E, t) => E.tone(t, 240, { type: 'triangle', dur: 0.18, peak: 0.16, glideTo: 175, vibHz: 12, vibDepth: 22 }),
  pop: (E, t) => { E.tone(t, 880, { type: 'sine', dur: 0.13, peak: 0.18, glideTo: 1320 }); E.noise(t, { dur: 0.05, peak: 0.05, filter: 5200, q: 0.6 }) },
  combo: (E, t) => [1046, 1318, 1568, 2093].forEach((f, i) => E.tone(t + i * 0.05, f, { type: 'sine', dur: 0.22, peak: 0.14, detune: 4 })),
  shuffle: (E, t) => [523, 659, 784, 1047, 1319].forEach((f, i) => E.tone(t + i * 0.04, f, { type: 'triangle', dur: 0.22, peak: 0.12 })),
  over: (E, t) => { E.tone(t, 440, { type: 'sine', dur: 0.6, peak: 0.18, glideTo: 220, detune: 8 }); E.tone(t + 0.08, 330, { type: 'triangle', dur: 0.5, peak: 0.12, detune: 10 }) },
  // a big match blooms a special into being — a bright rising chime
  bloom: (E, t) => [880, 1175, 1568, 2093].forEach((f, i) => E.tone(t + i * 0.045, f, { type: 'sine', dur: 0.3, peak: 0.15, detune: 5, attack: 0.006 })),
  // Surge line-blast — a sweeping zap
  surge: (E, t) => { E.tone(t, 1320, { type: 'sawtooth', dur: 0.22, peak: 0.16, glideTo: 280, filter: 2600 }); E.noise(t, { dur: 0.2, peak: 0.08, filter: 3000, sweepTo: 700, filterType: 'lowpass' }) },
  // Prism colour-wipe — a shimmering wash
  prism: (E, t) => { [659, 988, 1319, 1760, 2349].forEach((f, i) => E.tone(t + i * 0.04, f, { type: 'sine', dur: 0.4, peak: 0.12, detune: 6 })); E.noise(t, { dur: 0.4, peak: 0.06, filter: 6000, sweepTo: 1500, filterType: 'lowpass' }) },
  // Ather Star nova — a deep cross-blast boom
  star: (E, t) => { E.tone(t, 1568, { type: 'sine', dur: 0.5, peak: 0.18, glideTo: 110, detune: 12 }); E.tone(t, 80, { type: 'sine', dur: 0.6, peak: 0.2 }); E.noise(t, { dur: 0.5, peak: 0.14, filter: 400, sweepTo: 120, filterType: 'lowpass' }) },
  // earned moves — a warm reward flourish
  reward: (E, t) => [784, 1047, 1319, 1568].forEach((f, i) => E.tone(t + i * 0.06, f, { type: 'triangle', dur: 0.4, peak: 0.15, detune: 4 })),
}

const THROTTLE: Partial<Record<ManaSfx, number>> = { pop: 35 }

export const sfx = new SfxManager<ManaSfx>(patch, { throttle: THROTTLE, storageKey: 'manana.sfx', defaultVolume: 0.45 })
