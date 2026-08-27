// Juice for rinning: a blip + a haptic buzz on the bite and the catch, a low slip on a miss.
//
// ★ THE SYNTHESIS LIVES IN `audio/bus.ts` NOW (2026-08-27). This file's opening line used to read
// *"the walker has no shared sfx module"* — it had one private `AudioContext` and a `tone()`
// byte-identical to gather-fx's. Both are gone; what remains is this feature's own voice.
import { tone, buzz } from '../audio/bus'

export function rinBite() { tone(560, 70, { type: 'triangle', gain: 0.07 }); tone(760, 90, { gain: 0.05 }); buzz(38) }
export function rinCatch() { tone(420, 260, { type: 'triangle', slideTo: 820, gain: 0.07 }); buzz([15, 40]) }
export function rinMiss() { tone(190, 240, { type: 'sawtooth', slideTo: 120, gain: 0.05 }) }
