// SEEDFALL — sound. Cozy and airy: a soft sustained whoosh while the Ather thrusts,
// a warm chime when a seed roots, a gentle dull thud when one shatters. Built on the
// shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'thrust' | 'plant' | 'perfect' | 'crash' | 'thread' | 'caught'

const patch: Patch<Id> = {
  // a short breath of thrust — played in pulses while held (throttled)
  thrust: (E, t) => {
    E.noise(t, { dur: 0.14, peak: 0.05, filter: 480, sweepTo: 900, filterType: 'lowpass', q: 0.7 })
    E.tone(t, 150, { glideTo: 190, dur: 0.13, type: 'sine', peak: 0.04 })
  },
  // a seed roots — a warm ascending two-note chime
  plant: (E, t) => {
    E.tone(t, 523, { type: 'sine', dur: 0.3, peak: 0.13, detune: 5 })
    E.tone(t + 0.1, 784, { type: 'sine', dur: 0.34, peak: 0.12, detune: 5, vibHz: 4, vibDepth: 6 })
  },
  // a butter-soft landing — a brighter little arpeggio sparkle on top
  perfect: (E, t) => {
    ;[659, 880, 1175, 1568].forEach((f, i) =>
      E.tone(t + i * 0.05, f, { type: 'triangle', dur: 0.18, peak: 0.1, detune: 6 }),
    )
  },
  // it shatters — a soft dull thud, no harshness (this is the cozy lane)
  crash: (E, t) => {
    E.tone(t, 130, { glideTo: 70, dur: 0.32, type: 'sine', peak: 0.16 })
    E.noise(t, { dur: 0.22, peak: 0.08, filter: 700, sweepTo: 180, filterType: 'lowpass' })
  },
  // threaded a branch — a soft airy tick, leaf-rustle light
  thread: (E, t) => {
    E.noise(t, { dur: 0.07, peak: 0.035, filter: 1600, sweepTo: 2600, filterType: 'bandpass', q: 1.2 })
    E.tone(t, 660, { type: 'sine', dur: 0.08, peak: 0.045 })
  },
  // the Havari snatches it — a startled little flutter up, then gone
  caught: (E, t) => {
    E.tone(t, 440, { glideTo: 760, dur: 0.18, type: 'triangle', peak: 0.12, vibHz: 18, vibDepth: 30 })
    E.noise(t, { dur: 0.2, peak: 0.06, filter: 900, sweepTo: 1800, filterType: 'bandpass', q: 0.8 })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { thrust: 110 }, // pulse the thrust loop so it stays soft
  storageKey: 'seedfall.sfx',
})
