// GRAVITAR — sound. A low engine pulse while you burn, a bright relit chime when a core is
// gathered, a soft thud off the void-wall, a heavy fall when you crash into a world. On the
// shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'thrust' | 'collect' | 'bounce' | 'crash'

const patch: Patch<Id> = {
  // the engine burns — a short low pulse, replayed (throttled) for a rumble
  thrust: (E, t) => {
    E.tone(t, 90, { glideTo: 70, dur: 0.1, type: 'sawtooth', peak: 0.05, filter: 420 })
    E.noise(t, { dur: 0.09, peak: 0.03, filter: 360, sweepTo: 160, filterType: 'lowpass' })
  },
  // a core relights the spark — a bright rising two-note chime
  collect: (E, t) => {
    E.tone(t, 740, { glideTo: 1110, dur: 0.12, type: 'triangle', peak: 0.13, detune: 7 })
    E.tone(t + 0.06, 1480, { dur: 0.16, type: 'sine', peak: 0.09, detune: 5 })
    E.noise(t, { dur: 0.1, peak: 0.04, filter: 4200, sweepTo: 1500, filterType: 'bandpass', q: 1.5 })
  },
  // the void-wall turns you back — a soft mid thud
  bounce: (E, t) => {
    E.tone(t, 300, { glideTo: 180, dur: 0.12, type: 'sine', peak: 0.1 })
    E.noise(t, { dur: 0.08, peak: 0.04, filter: 900, sweepTo: 300, filterType: 'lowpass' })
  },
  // crash into a world — a heavy descending fall + crack
  crash: (E, t) => {
    E.tone(t, 200, { glideTo: 40, dur: 0.6, type: 'sawtooth', peak: 0.2, vibHz: 6, vibDepth: 14 })
    E.noise(t, { dur: 0.45, peak: 0.14, filter: 1800, sweepTo: 150, filterType: 'lowpass' })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { thrust: 70, collect: 40, bounce: 120 },
  storageKey: 'gravitar.sfx',
})
