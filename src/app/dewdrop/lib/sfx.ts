// DEWDROP — sound. Cozy + bright: a soft blip per dewdrop, a warm chime when a wildbloom
// snaps the collars, a comic squeak-pop when a deflated Moglin is bumped home, a low thud
// when one collars you. Built on the shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'drop' | 'bloom' | 'pop' | 'caught'

const patch: Patch<Id> = {
  // a dewdrop gobbled — a tiny bright blip (waka)
  drop: (E, t) => {
    E.tone(t, 520, { glideTo: 660, dur: 0.05, type: 'square', peak: 0.04 })
  },
  // a wildbloom — every collar snaps: a warm rising bloom of light
  bloom: (E, t) => {
    ;[440, 587, 784, 1047].forEach((f, i) =>
      E.tone(t + i * 0.05, f, { type: 'sine', dur: 0.26, peak: 0.11, detune: 5, vibHz: 5, vibDepth: 5 }),
    )
  },
  // bump a deflated Moglin home — a comic squeak-pop (the swagger deflates)
  pop: (E, t) => {
    E.tone(t, 880, { glideTo: 240, dur: 0.16, type: 'triangle', peak: 0.12, vibHz: 22, vibDepth: 40 })
    E.noise(t, { dur: 0.06, peak: 0.04, filter: 1200, sweepTo: 400, filterType: 'lowpass' })
  },
  // a Moglin collars you — a low soft thud, no harshness (the cozy lane)
  caught: (E, t) => {
    E.tone(t, 150, { glideTo: 60, dur: 0.36, type: 'sine', peak: 0.17 })
    E.noise(t, { dur: 0.24, peak: 0.07, filter: 600, sweepTo: 130, filterType: 'lowpass' })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { drop: 50 }, // a fast dewdrop streak shouldn't machine-gun the blip
  storageKey: 'dewdrop.sfx',
})
