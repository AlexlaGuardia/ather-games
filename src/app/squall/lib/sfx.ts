// SQUALL — sound. Tense and airy: a soft warning swell as the void telegraphs, a sharp
// little tick on a graze (the close-pass reward), and a low collapsing thud when a bullet
// finds you. Built on the shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'warn' | 'fire' | 'graze' | 'death'

const patch: Patch<Id> = {
  // a pattern telegraphs — a soft rising swell (the breath before the storm beat)
  warn: (E, t) => {
    E.tone(t, 220, { glideTo: 320, dur: 0.18, type: 'sine', peak: 0.04 })
    E.noise(t, { dur: 0.16, peak: 0.025, filter: 600, sweepTo: 1100, filterType: 'bandpass', q: 0.9 })
  },
  // the void fires — a short airy whoosh
  fire: (E, t) => {
    E.noise(t, { dur: 0.12, peak: 0.045, filter: 1400, sweepTo: 500, filterType: 'lowpass', q: 0.7 })
  },
  // a graze — a bright, sharp little tick (the risk-reward ping)
  graze: (E, t) => {
    E.tone(t, 1320, { type: 'triangle', dur: 0.06, peak: 0.07, detune: 4 })
    E.noise(t, { dur: 0.04, peak: 0.03, filter: 2600, sweepTo: 3600, filterType: 'bandpass', q: 1.4 })
  },
  // a bullet finds you — a low collapsing thud, no harshness
  death: (E, t) => {
    E.tone(t, 160, { glideTo: 55, dur: 0.4, type: 'sine', peak: 0.18 })
    E.noise(t, { dur: 0.3, peak: 0.09, filter: 700, sweepTo: 120, filterType: 'lowpass' })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { graze: 45, warn: 90 }, // a graze streak / wave swell shouldn't machine-gun
  storageKey: 'squall.sfx',
})
