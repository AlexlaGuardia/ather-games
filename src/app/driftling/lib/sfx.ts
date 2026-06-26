// DRIFTLING — sound. Wet and soft: a little gulp when you swallow something, a warm
// rising chime when you cross a tier (evolve), a bright shimmer the moment the fork
// locks, and a low swallowed thud when a bigger thing takes you. Built on the shared
// arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'eat' | 'grow' | 'fork' | 'death'

const patch: Patch<Id> = {
  // a soft bubbly gulp — a quick down-blip with a wet noise tick
  eat: (E, t) => {
    E.tone(t, 380, { glideTo: 240, dur: 0.1, type: 'sine', peak: 0.07 })
    E.noise(t, { dur: 0.06, peak: 0.03, filter: 900, sweepTo: 380, filterType: 'lowpass', q: 0.8 })
  },
  // crossing a tier — a warm ascending three-note bloom (the payoff beat)
  grow: (E, t) => {
    ;[392, 523, 784].forEach((f, i) =>
      E.tone(t + i * 0.07, f, { type: 'sine', dur: 0.3, peak: 0.12, detune: 5, vibHz: 4, vibDepth: 5 }),
    )
  },
  // the first eat locks your branch — a bright spreading shimmer
  fork: (E, t) => {
    ;[523, 659, 880, 1047].forEach((f, i) =>
      E.tone(t + i * 0.045, f, { type: 'triangle', dur: 0.22, peak: 0.1, detune: 6 }),
    )
    E.noise(t, { dur: 0.18, peak: 0.04, filter: 1400, sweepTo: 2600, filterType: 'bandpass', q: 1.1 })
  },
  // a bigger thing swallows you — a low swallowed thud, no harshness
  death: (E, t) => {
    E.tone(t, 150, { glideTo: 60, dur: 0.38, type: 'sine', peak: 0.17 })
    E.noise(t, { dur: 0.26, peak: 0.08, filter: 600, sweepTo: 140, filterType: 'lowpass' })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { eat: 60 }, // a fast eating streak shouldn't machine-gun the gulp
  storageKey: 'driftling.sfx',
})
