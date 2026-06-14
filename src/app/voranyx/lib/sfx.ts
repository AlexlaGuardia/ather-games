// VORANYX — sound. A wet, glowing deep: soft blips as you graze dross, a warm chime
// when a seed paints you, an airy rush while boosting, a bright burst when a rival
// falls to your body, and a low dissolving tone when you sublimate away. Built on
// the shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'eat' | 'seed' | 'boost' | 'kill' | 'death'

const patch: Patch<Id> = {
  // grazing dross/bubbles — a soft, short blip (throttled so a feeding frenzy stays musical)
  eat: (E, t) => {
    E.tone(t, 440, { glideTo: 620, dur: 0.05, type: 'sine', peak: 0.06 })
  },
  // a seed — a warm rising two-note (the colour taking hold)
  seed: (E, t) => {
    E.tone(t, 523, { type: 'triangle', dur: 0.12, peak: 0.1, detune: 5 })
    E.tone(t + 0.07, 784, { type: 'triangle', dur: 0.16, peak: 0.1, detune: 5 })
  },
  // boosting — an airy filtered rush (pulsed while held)
  boost: (E, t) => {
    E.noise(t, { dur: 0.18, peak: 0.05, filter: 600, sweepTo: 2600, filterType: 'bandpass', q: 0.8 })
  },
  // a rival falls to your body — a bright descending burst
  kill: (E, t) => {
    E.tone(t, 880, { glideTo: 1320, dur: 0.1, type: 'triangle', peak: 0.12, detune: 8 })
    E.noise(t, { dur: 0.22, peak: 0.1, filter: 3000, sweepTo: 700, filterType: 'bandpass', q: 1.3 })
  },
  // you sublimate — a long, low, dissolving fall (no harsh impact; you don't shatter, you scatter)
  death: (E, t) => {
    E.tone(t, 220, { glideTo: 55, dur: 0.7, type: 'sine', peak: 0.18, vibHz: 5, vibDepth: 14 })
    E.noise(t, { dur: 0.7, peak: 0.08, filter: 1400, sweepTo: 140, filterType: 'lowpass' })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { eat: 55, boost: 130 },
  storageKey: 'voranyx.sfx',
})
