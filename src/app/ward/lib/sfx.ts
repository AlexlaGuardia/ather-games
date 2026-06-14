// WARD — sound. A tense vector-arcade defense: a launch whoosh as Ather lifts off,
// a bright pop when a burst unmakes blight, a low thud when a spire falls, a small
// rising chord when a wave is held, a sinking tone when the line breaks. Built on
// the shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'launch' | 'intercept' | 'clean' | 'spire' | 'wave' | 'over'

const patch: Patch<Id> = {
  // Ather lifts off the battery — a short upward whoosh
  launch: (E, t) => {
    E.tone(t, 240, { glideTo: 660, dur: 0.13, type: 'sawtooth', peak: 0.07, filter: 1800 })
    E.noise(t, { dur: 0.1, peak: 0.05, filter: 700, sweepTo: 2600, filterType: 'highpass' })
  },
  // a burst catches blight — bright airy pop
  intercept: (E, t) => {
    E.tone(t, 880, { glideTo: 1320, dur: 0.09, type: 'triangle', peak: 0.12, detune: 8 })
    E.noise(t, { dur: 0.14, peak: 0.08, filter: 3200, sweepTo: 900, filterType: 'bandpass', q: 1.4 })
  },
  // a splitter popped before it forked — a brighter, two-note skill-shot chime
  clean: (E, t) => {
    E.tone(t, 988, { glideTo: 1480, dur: 0.1, type: 'triangle', peak: 0.13, detune: 10 })
    E.tone(t + 0.07, 1480, { glideTo: 1976, dur: 0.12, type: 'triangle', peak: 0.12, detune: 8 })
    E.noise(t, { dur: 0.12, peak: 0.07, filter: 4200, sweepTo: 1400, filterType: 'bandpass', q: 1.6 })
  },
  // a spire falls — heavy descending thud with a noise crack
  spire: (E, t) => {
    E.tone(t, 150, { glideTo: 48, dur: 0.5, type: 'sine', peak: 0.22, vibHz: 7, vibDepth: 18 })
    E.noise(t, { dur: 0.3, peak: 0.13, filter: 1600, sweepTo: 200, filterType: 'lowpass' })
  },
  // wave held — a small ascending chord
  wave: (E, t) => {
    ;[392, 494, 587, 740].forEach((f, i) =>
      E.tone(t + i * 0.07, f, { type: 'triangle', dur: 0.28, peak: 0.12, detune: 5 }),
    )
  },
  // the line breaks — a long sinking minor fall
  over: (E, t) => {
    ;[440, 349, 262, 175].forEach((f, i) =>
      E.tone(t + i * 0.16, f, { type: 'sine', dur: 0.6, peak: 0.16, detune: 7, vibHz: 4, vibDepth: 10 }),
    )
    E.noise(t, { dur: 0.9, peak: 0.06, filter: 900, sweepTo: 120, filterType: 'lowpass' })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { launch: 40, intercept: 30, clean: 30 },
  storageKey: 'ward.sfx',
})
