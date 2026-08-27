// Juice for gathering (forestry/prospecting), matching rin-fx for fishing. A working "thunk" per
// chop/mine tick while channeling, and a bright pop + buzz on the grant.
//
// ★ THE SYNTHESIS LIVES IN `audio/bus.ts` NOW (2026-08-27). This file used to carry its own
// `AudioContext` and a private `tone()` byte-identical to rin-fx's. What is left here is the only
// thing that was ever specific to gathering: which notes a chop and a pop are. That is the right
// split — a module owns its VOICE, the bus owns the device.
import { tone, buzz } from '../audio/bus'

// per-skill working tick: forestry = a low wooden thunk, prospecting = a higher rock clink.
export function gatherTick(skill: string) {
  if (skill === 'prospecting') tone(680, 70, { type: 'square', gain: 0.035, slideTo: 520 })
  else tone(150, 90, { type: 'triangle', gain: 0.05, slideTo: 110 }) // forestry / default
}

// the payoff: a bright two-note pop + a short buzz when a harvest lands.
export function gatherPop() {
  tone(520, 90, { type: 'triangle', gain: 0.06 })
  tone(780, 140, { type: 'sine', gain: 0.05, slideTo: 920 })
  buzz(20)
}
