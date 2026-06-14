// LAZ — sound. A light, airy one-tap arcade: a soft wing-beat on every flap, a
// bright blip clearing a gate, a dull thud on a crash, a short sinking tone on the
// end screen. Built on the shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'flap' | 'pass' | 'crash' | 'over'

const patch: Patch<Id> = {
  // a wing-beat — a quick puff of air with a soft upward chirp
  flap: (E, t) => {
    E.noise(t, { dur: 0.08, peak: 0.06, filter: 900, sweepTo: 2200, filterType: 'bandpass', q: 0.9 })
    E.tone(t, 380, { glideTo: 540, dur: 0.07, type: 'sine', peak: 0.06 })
  },
  // cleared a gate — a bright little coin-blip
  pass: (E, t) => {
    E.tone(t, 784, { type: 'triangle', dur: 0.06, peak: 0.1 })
    E.tone(t + 0.05, 1175, { type: 'triangle', dur: 0.08, peak: 0.1 })
  },
  // crash — a dull descending thud
  crash: (E, t) => {
    E.tone(t, 200, { glideTo: 60, dur: 0.3, type: 'sawtooth', peak: 0.18 })
    E.noise(t, { dur: 0.2, peak: 0.12, filter: 1200, sweepTo: 200, filterType: 'lowpass' })
  },
  // the run ends — a short sinking two-note sigh
  over: (E, t) => {
    E.tone(t, 392, { type: 'sine', dur: 0.34, peak: 0.14, detune: 6 })
    E.tone(t + 0.14, 262, { type: 'sine', dur: 0.42, peak: 0.13, detune: 6, vibHz: 4, vibDepth: 8 })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { flap: 40, pass: 25 },
  storageKey: 'laz.sfx',
})
