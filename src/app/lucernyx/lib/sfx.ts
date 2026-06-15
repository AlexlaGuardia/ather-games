// LUCERNYX — sound. A quiet board of rekindling: a soft woody slide as a piece moves,
// a bright bell each time a grey is rekindled to light (staggered through a multi-jump it
// becomes a cascade), a warm whoosh as a torch lights and the piece ascends, a glad rising
// chord on victory, a sinking fall when the dark holds. On the shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'slide' | 'convert' | 'torch' | 'win' | 'lose'

const patch: Patch<Id> = {
  // a piece slides a square — soft, woody, quiet
  slide: (E, t) => {
    E.tone(t, 320, { glideTo: 240, dur: 0.09, type: 'triangle', peak: 0.05, filter: 1400 })
    E.noise(t, { dur: 0.05, peak: 0.02, filter: 1200, sweepTo: 400, filterType: 'lowpass' })
  },
  // a grey is rekindled — the signature bright bell (played per flip → a cascade on a chain)
  convert: (E, t) => {
    E.tone(t, 880, { glideTo: 1320, dur: 0.13, type: 'triangle', peak: 0.12, detune: 8 })
    E.tone(t + 0.05, 1760, { dur: 0.14, type: 'sine', peak: 0.07, detune: 6 })
    E.noise(t, { dur: 0.1, peak: 0.04, filter: 4000, sweepTo: 1600, filterType: 'bandpass', q: 1.6 })
  },
  // a torch lights and the piece ascends — a warm rising whoosh
  torch: (E, t) => {
    E.tone(t, 330, { glideTo: 880, dur: 0.4, type: 'sawtooth', peak: 0.1, filter: 1600, vibHz: 5, vibDepth: 10 })
    E.tone(t + 0.04, 523, { glideTo: 1046, dur: 0.36, type: 'triangle', peak: 0.08, detune: 6 })
    E.noise(t, { dur: 0.34, peak: 0.05, filter: 600, sweepTo: 3000, filterType: 'highpass' })
  },
  // three torches held — a glad ascending major chord
  win: (E, t) => {
    ;[523, 659, 784, 1046].forEach((f, i) =>
      E.tone(t + i * 0.1, f, { type: 'triangle', dur: 0.5, peak: 0.13, detune: 6, vibHz: 4, vibDepth: 8 }),
    )
  },
  // the dark drinks the lanterns — a long minor sink
  lose: (E, t) => {
    ;[392, 311, 233, 156].forEach((f, i) =>
      E.tone(t + i * 0.16, f, { type: 'sine', dur: 0.6, peak: 0.15, detune: 7, vibHz: 4, vibDepth: 10 }),
    )
    E.noise(t, { dur: 0.85, peak: 0.05, filter: 800, sweepTo: 110, filterType: 'lowpass' })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { slide: 30, convert: 20 },
  storageKey: 'lucernyx.sfx',
})
