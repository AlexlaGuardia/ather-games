// THE NIGHT, HEARD — the thin WebAudio shell over `hollow-voice.ts`.
//
// ★ THIS FILE OWNS NO DECISIONS. What makes a sound, when, how loud and from which side is decided
// in `hollow-voice.ts`, which is pure and has an oracle. Everything here is nodes and time. If you
// find yourself computing a bearing in this file, it belongs next door.
//
// ★ HOUSE STYLE, FOLLOWED ON PURPOSE (`play3d/gather-fx.ts`, `rin-fx.ts`, `nolmir/sfx-lab`): every
// sound is SYNTHESISED, and every entry point is wrapped so a blocked or unsupported AudioContext
// no-ops instead of throwing. No file is fetched, so there is nothing to 404, nothing to licence
// and nothing to wait for on a cold load — which also means a footstep can never arrive late
// because a download did.
//
// ⚠ AUDIO NEEDS A GESTURE. Browsers refuse to start an AudioContext until the user has clicked or
// pressed a key, and a refusal is SILENT — the context sits `suspended` and every sound is a no-op
// that reports nothing. So `unlockHollowSfx()` must be called from a real input handler, and
// `hollowSfxState()` exists so a caller can tell "muted" from "never unlocked", which look
// identical from the outside and have completely different fixes.
//
// ── ★ WHY A FOOTSTEP IS NOISE AND NOT A TONE ────────────────────────────────────────────────────
// `gather-fx` uses oscillators because a chop and a pop are pitched events. A footfall is not: it
// is a broadband scuff, and an oscillator version reads as a beep — which in a dark wood sounds
// like UI, not like something walking. So the source is a short white-noise burst shaped by a
// band-pass, and the FORM changes the band rather than the note.
//
// ⚠ ONE NOISE BUFFER, BUILT ONCE. A fresh `AudioBuffer` per footfall is the audio-side version of
// the per-object material `render-audit.test.ts` exists to catch: a pack of four at two steps a
// second would allocate eight buffers a second, forever. The buffer is shared; only the cheap
// `AudioBufferSourceNode` is per-sound, which is what the API requires.

import type { Emission } from './hollow-voice'
// ★ THE DEVICE IS THE BUS'S NOW (2026-08-27). This file made its own `AudioContext` and its own
// noise buffer; it was one of four inside Shimmer, and four contexts cannot share an unlock or a
// volume. What stays here is what was always this module's own: the per-form voices and the node
// graph that shapes a footfall. See `audio/bus.ts` for why that split is load-bearing.
import { audioCtx, bus, noiseBuffer, unlockAudio, audioState, disposeAudio } from '../audio/bus'

/** This LAYER's level, under the master. Lets footsteps be quieted without muting the game. */
let master = 0.9

/** The per-form voice. Band centre and length are what make a warden and a stalker different. */
const VOICE: Record<Emission['form'], { hz: number; q: number; ms: number; gain: number }> = {
  // Heavy and low: a wall taking a step. Long enough to read as weight rather than as a tick.
  warden:  { hz: 190, q: 1.1, ms: 150, gain: 1.0 },
  // ★ THE ONE ALEX ASKED FOR. Dry, light and short — a scuff, not a stomp. Pitched well above the
  // warden so a keeper can tell WHICH of them is behind them without turning, which matters because
  // the two want opposite responses: you walk around a warden, you turn on a stalker.
  stalker: { hz: 900, q: 2.2, ms: 55,  gain: 0.75 },
  // It floats, so it has no footfall at all — a dry rattle instead, sparse and cold.
  caster:  { hz: 2600, q: 3.5, ms: 70, gain: 0.5 },
}

/**
 * ⚠ THESE TWO ARE NOW THIN FORWARDS, KEPT ON PURPOSE RATHER THAN DELETED.
 * They were this module's public surface before the bus existed, and the world calls
 * `unlockHollowSfx` from its canvas click. Forwarding means the rename is not a flag day and there
 * is exactly one implementation — what must never come back is a SECOND context behind them.
 * `audio-bus.test.ts` asserts that by counting `new AudioContext` across the whole Shimmer tree.
 */
export const unlockHollowSfx = (): boolean => unlockAudio()
export const hollowSfxState = (): 'off' | 'suspended' | 'running' => audioState()

/** 0..1. Persisted by the caller if it wants to be; this module keeps no settings. */
export function setHollowVolume(v: number): void {
  master = Math.max(0, Math.min(1, v))
}

/**
 * Make the sounds `stepVoices` asked for.
 *
 * ⚠ NEVER THROWS. A frame loop calls this, and an exception here would take the whole world down
 * over a noise — the one thing in the game that is decorative by definition.
 */
export function playEmissions(ems: readonly Emission[]): void {
  if (ems.length === 0) return
  const a = audioCtx()
  const out = bus()
  if (!a || !out || a.state !== 'running') return
  try {
    const buf = noiseBuffer()
    if (!buf) return
    const t0 = a.currentTime
    for (const e of ems) {
      const v = VOICE[e.form]
      const dur = v.ms / 1000
      const src = a.createBufferSource()
      src.buffer = buf
      // A random offset into the shared noise so two footfalls are never the identical sample —
      // repetition is what makes a synthesised step read as a loop instead of as a footstep.
      const off = Math.random() * (buf.duration - dur)
      const band = a.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = v.hz
      band.Q.value = v.q
      // ★★ THE MUFFLE IS WHAT SEPARATES BEHIND FROM AHEAD. Panning cannot: a thing at your 4
      // o'clock and one at your 8 o'clock pan identically. Rolling the top end off as a body moves
      // behind you is the cheap stand-in for your own head shadowing your ears, and it is the
      // difference between "something is to my right" and "something is behind my right shoulder".
      const dark = a.createBiquadFilter()
      dark.type = 'lowpass'
      dark.frequency.value = 18000 - e.muffle * 16200      // 18k dead ahead → ~1.8k directly behind
      const pan = a.createStereoPanner()
      pan.pan.value = Math.max(-1, Math.min(1, e.pan))
      const g = a.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, e.gain * v.gain * master), t0 + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      // ⚠ `out`, NEVER `a.destination`. Connecting to the destination silently opts this sound out
      // of the master gain, and the way anyone finds out is a player turning the volume down and
      // the footsteps staying loud.
      src.connect(band); band.connect(dark); dark.connect(pan); pan.connect(g); g.connect(out)
      src.start(t0, off, dur)
      src.stop(t0 + dur)
    }
  } catch { /* audio blocked mid-frame — the world keeps running */ }
}

/**
 * Drop the audio device. Call on unmount so a page that is gone is not holding one.
 *
 * ⚠ THIS NOW CLOSES THE WHOLE GAME'S AUDIO, NOT JUST THIS MODULE'S, because there is one device.
 * Correct for the only caller — VoxelWorld's unmount, which is the page going away — and wrong for
 * anything that merely wanted footsteps to stop. Use `setHollowVolume(0)` for that; the names are
 * close and the acts are not.
 */
export const disposeHollowSfx = (): void => disposeAudio()
