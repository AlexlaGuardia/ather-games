// REKINDLE — sound. Cozy retro-vector machine: soft rotate clicks, a warm hum
// when flow connects, a rising whoom when a core catches, a little chord on a
// finished machine. Built on the shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'rotate' | 'connect' | 'rekindle' | 'complete'

const patch: Patch<Id> = {
  // a dry mechanical click — a conduit turning in its socket
  rotate: (E, t) => {
    E.noise(t, { dur: 0.05, peak: 0.11, filter: 2600, filterType: 'bandpass', q: 2.5 })
    E.tone(t, 320, { type: 'triangle', dur: 0.05, peak: 0.05 })
  },
  // warm rising hum — Ather reaches a little further
  connect: (E, t) => {
    E.tone(t, 294, { glideTo: 441, dur: 0.16, type: 'sine', peak: 0.11, detune: 6, filter: 1400 })
  },
  // the core catches — a swelling whoom with a noise bloom
  rekindle: (E, t) => {
    E.tone(t, 174, { glideTo: 392, dur: 0.55, type: 'sine', peak: 0.18, detune: 9, vibHz: 5, vibDepth: 12 })
    E.noise(t, { dur: 0.45, peak: 0.09, filter: 500, sweepTo: 3200, filterType: 'lowpass' })
  },
  // machine fully lit — a small ascending chord
  complete: (E, t) => {
    ;[392, 523, 659, 784].forEach((f, i) =>
      E.tone(t + i * 0.085, f, { type: 'triangle', dur: 0.32, peak: 0.13, detune: 5 }),
    )
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { rotate: 25, connect: 45 },
  storageKey: 'rekindle.sfx',
})
