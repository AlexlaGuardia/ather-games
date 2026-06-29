// VAULT — sound. A bright airy leap (the vault), a soft tap on landing on surviving ground, a
// rising crystalline "unmaking" on a stomp (climbs with the combo), a clean ping gathering loose
// Ather-light, and a low collapsing thud when the grey takes the light. Shared arcade SFX engine.
import { SfxManager, type Patch } from '@/lib/arcade/sfx'

type Id = 'jump' | 'land' | 'stomp' | 'collect' | 'death'

const patch: Patch<Id> = {
  // the vault — a short bright upward blip (the leap of the light)
  jump: (E, t) => {
    E.tone(t, 440, { glideTo: 720, dur: 0.12, type: 'triangle', peak: 0.06 })
    E.noise(t, { dur: 0.06, peak: 0.02, filter: 1800, sweepTo: 3000, filterType: 'highpass', q: 0.7 })
  },
  // landing on surviving ground — a soft, low tap (no harshness; you made it across)
  land: (E, t) => {
    E.tone(t, 180, { glideTo: 120, dur: 0.08, type: 'sine', peak: 0.045 })
  },
  // unmaking a grey void-spawn — a crisp crystalline zap; brighter as the combo climbs
  stomp: (E, t) => {
    E.tone(t, 520, { glideTo: 880, dur: 0.1, type: 'square', peak: 0.06, detune: 6 })
    E.noise(t, { dur: 0.09, peak: 0.05, filter: 1600, sweepTo: 600, filterType: 'bandpass', q: 1.2 })
  },
  // gathering loose Ather-light — a bright clean ping
  collect: (E, t) => {
    E.tone(t, 1180, { type: 'triangle', dur: 0.07, peak: 0.06, detune: 3 })
    E.tone(t, 1760, { type: 'sine', dur: 0.05, peak: 0.03 })
  },
  // the grey takes the light — a low collapsing thud
  death: (E, t) => {
    E.tone(t, 200, { glideTo: 50, dur: 0.45, type: 'sine', peak: 0.18 })
    E.noise(t, { dur: 0.32, peak: 0.09, filter: 760, sweepTo: 110, filterType: 'lowpass' })
  },
}

export const sfx = new SfxManager<Id>(patch, {
  throttle: { collect: 40, stomp: 40 }, // a mote streak / bounce-chain shouldn't machine-gun
  storageKey: 'vault.sfx',
})
