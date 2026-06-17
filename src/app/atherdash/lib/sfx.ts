// ATHERDASH — sound. A fast lane-runner: a short airy WHOOSH on a lane-swap, a
// bright two-note CHIME when you thread a gate, a hard THUD into a wall, and a
// sinking sigh on the end screen. Built on the shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'swap' | 'pass' | 'crash' | 'over'

const patch: Patch<Id> = {
  // lane-swap — a quick sideways puff of air with a tiny upward tick
  swap: (E, t) => {
    E.noise(t, { dur: 0.07, peak: 0.05, filter: 700, sweepTo: 2600, filterType: 'bandpass', q: 0.8 })
    E.tone(t, 520, { glideTo: 680, dur: 0.06, type: 'sine', peak: 0.045 })
  },
  // threaded a gate — a bright little rising chime (the door rings as you pass)
  pass: (E, t) => {
    E.tone(t, 880, { type: 'triangle', dur: 0.06, peak: 0.09 })
    E.tone(t + 0.045, 1318, { type: 'triangle', dur: 0.09, peak: 0.09, detune: 5 })
  },
  // hit the wall — a hard descending thud + a dark noise burst (the Dying takes you)
  crash: (E, t) => {
    E.tone(t, 180, { glideTo: 48, dur: 0.34, type: 'sawtooth', peak: 0.2 })
    E.noise(t, { dur: 0.22, peak: 0.14, filter: 1400, sweepTo: 160, filterType: 'lowpass' })
  },
  // the run ends — a short sinking two-note sigh
  over: (E, t) => {
    E.tone(t, 392, { type: 'sine', dur: 0.34, peak: 0.13, detune: 6 })
    E.tone(t + 0.14, 247, { type: 'sine', dur: 0.44, peak: 0.12, detune: 6, vibHz: 4, vibDepth: 8 })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { swap: 60, pass: 30 },
  storageKey: 'atherdash.sfx',
})
