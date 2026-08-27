/**
 * THE AUDIO BUS — one context, one master, one unlock, for the whole of Shimmer.
 *
 * ★★★ WHY THIS EXISTS, MEASURED THE DAY IT WAS WRITTEN (2026-08-27). Audio had grown one module at
 * a time across three lanes, and every module made its OWN `AudioContext`: `play3d/gather-fx.ts`,
 * `play3d/rin-fx.ts`, `voxel3d/hollow-sfx.ts`, `engine/chatterbox.ts` — four inside Shimmer alone,
 * each with a private gain and a private lifecycle. `gather-fx` and `rin-fx` held BYTE-IDENTICAL
 * copies of the same `tone()`. `rin-fx` line 1 had said *"the walker has no shared sfx module"*
 * since the day it was written; the codebase knew, and nobody owned the layer.
 *
 * ⚠⚠ THE COST WAS NOT TIDINESS, IT WAS TWO THINGS THAT CANNOT BE BUILT WITHOUT THIS FILE:
 *
 *   1. **"Unlock the audio" was not one act.** A browser refuses to start an `AudioContext` until a
 *      real user gesture, and the refusal is SILENT — the context sits `suspended` and every sound
 *      is a no-op that reports nothing. With four contexts, unlocking one unlocked one. A player
 *      could be in a world where the Hollows are audible and the chopping is not, with nothing on
 *      screen to say which, and the symptom is silence — which reads as *"nobody wrote that sound
 *      yet"* rather than as a bug. One context means one gesture settles the whole game.
 *
 *   2. **There could be no master volume.** `setHollowVolume` existed with no caller and could
 *      never have had one that meant anything: four contexts cannot share a setting. Every sound
 *      now passes through ONE `GainNode`, so a volume slider is a one-line change instead of a
 *      four-module negotiation. ⚠ THAT IS ONLY TRUE WHILE MODULES CONNECT TO `bus()` AND NEVER TO
 *      `ctx().destination` — connecting to the destination silently opts a sound out of the master,
 *      and the way you find out is a player turning the volume down and one sound staying loud.
 *      `audio-bus.test.ts` asserts no module reaches for `.destination`.
 *
 * ★ HOUSE STYLE, INHERITED AND KEPT: every sound in this game is SYNTHESISED. No file is fetched,
 * so there is nothing to 404, nothing to licence, and nothing to wait for on a cold load — a
 * footstep can never arrive late because a download did. A shared bus is not permission to start
 * shipping samples.
 *
 * ⚠⚠ ONE MODULE IS NOT ONE CONTEXT PER TAB, AND THE SOURCE INVARIANT CANNOT SEE THE DIFFERENCE.
 * `audio-bus.test.ts` proves there is one bus MODULE. Webpack then emits a copy of it into every
 * route bundle that imports it, and module state (`ac` below) is per COPY — measured after the
 * first deploy: `/shimmer/voxel3d`, `/shimmer/play3d` and `/shimmer/dev/creep` each ship their own.
 * That is harmless as long as those are separate PAGE LOADS, which routes are, and it is why the
 * invariant is written at the source level.
 * ★ WHERE IT WOULD BITE: two game surfaces co-mounted in ONE page, or one route dynamically
 * importing another's fx module. Then there are two contexts again, the second one suspended and
 * silent, and nothing in the source would look wrong. If a page ever mounts two worlds, this file
 * has to move to a provider or the window — do not assume the module is enough.
 * ⚠ AND THE MEASUREMENT ITSELF HAS A TRAP: grepping the bundle for `new AudioContext` finds NOTHING
 * because the minifier renames the constructor to a single letter — it reads as a clean result and
 * it is a blind one. Count `window.AudioContext||window.webkitAudioContext` and the `new <alias>`
 * that follows it, or read the per-route `react-loadable-manifest.json` under .next/server/app, which names the
 * route each chunk belongs to and settles the question outright.
 *
 * ★ NO SETTINGS LIVE HERE. The master level is a number this module holds; persisting it is the
 * caller's job. Same reasoning as `hollow-sfx`'s original note — a rule that lives inside a
 * `localStorage` call is a rule nothing can test.
 */

let ac: AudioContext | null = null
let masterGain: GainNode | null = null
let noise: AudioBuffer | null = null
let level = 0.9

/** How much white noise the shared buffer holds, in seconds. Long enough that a random offset into
 *  it never repeats audibly; short enough to be a rounding error in memory. */
const NOISE_SECONDS = 0.25

/**
 * The one context. Lazy, because constructing it before a gesture is what gets it born suspended.
 *
 * ⚠ RETURNS null RATHER THAN THROWING. Audio is decorative by definition — a browser with the API
 * missing, or blocked by policy, must cost the game nothing. Every caller in this file treats null
 * as "make no sound".
 */
export function audioCtx(): AudioContext | null {
  try {
    if (ac) return ac
    const AC = window.AudioContext
      || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ac = new AC()
    return ac
  } catch { return null }
}

/**
 * What every sound connects to. NEVER `audioCtx().destination`.
 *
 * ⚠ The gain is rebuilt whenever the context is, and `dispose` nulls both together — a `GainNode`
 * belonging to a closed context is not an error you get told about, it is a node that silently
 * plays nothing.
 */
export function bus(): GainNode | null {
  const a = audioCtx()
  if (!a) return null
  if (!masterGain) {
    masterGain = a.createGain()
    masterGain.gain.value = level
    masterGain.connect(a.destination)
  }
  return masterGain
}

/**
 * Start the audio. MUST be called from a real user gesture — a click or a keypress.
 *
 * ★ ONE CALL SETTLES THE WHOLE GAME, which is the entire point of the file. Returns whether audio
 * is actually running so a caller can show the truth rather than assume it. Idempotent and safe to
 * call on every gesture; a refusal simply leaves the context suspended.
 */
export function unlockAudio(): boolean {
  const a = audioCtx()
  if (!a) return false
  try { void a.resume() } catch { /* refused — stays suspended */ }
  bus()   // build the master now, so the first sound is not the thing that allocates it
  return a.state === 'running'
}

/**
 * 'off' = no context could be made · 'suspended' = never unlocked · 'running' = audible.
 *
 * ★ THE THREE ARE DELIBERATELY DISTINCT. "Muted" and "never unlocked" look identical from outside
 * and have completely different fixes; collapsing them is how a silent game gets diagnosed as an
 * unwritten feature.
 */
export function audioState(): 'off' | 'suspended' | 'running' {
  if (!ac) return 'off'
  return ac.state === 'running' ? 'running' : 'suspended'
}

/** 0..1, applied to every sound in the game. Ramped rather than set, so a slider does not click. */
export function setMasterVolume(v: number): void {
  level = Math.max(0, Math.min(1, v))
  const g = masterGain
  const a = ac
  if (!g || !a) return
  try { g.gain.setTargetAtTime(level, a.currentTime, 0.02) } catch { g.gain.value = level }
}

/** What the master is set to. Read by a settings surface; this module persists nothing. */
export const masterVolume = (): number => level

/**
 * A quarter-second of white noise, built once and shared by every sound that will ever want it.
 *
 * ⚠ A fresh `AudioBuffer` per sound is the audio-side version of the per-object material
 * `render-audit.test.ts` exists to catch. Only the cheap `AudioBufferSourceNode` is per-sound,
 * which is what the API requires.
 */
export function noiseBuffer(): AudioBuffer | null {
  const a = audioCtx()
  if (!a) return null
  if (noise && noise.sampleRate === a.sampleRate) return noise
  try {
    const frames = Math.floor(a.sampleRate * NOISE_SECONDS)
    const buf = a.createBuffer(1, frames, a.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1
    noise = buf
    return buf
  } catch { return null }
}

export interface ToneOpts {
  type?: OscillatorType
  gain?: number
  /** Ramp the pitch to this by the end — a slide, not a step. */
  slideTo?: number
}

/**
 * The house blip: one oscillator, one envelope.
 *
 * ★ THIS IS THE DEDUPE. `gather-fx.ts` and `rin-fx.ts` each carried a byte-identical private copy,
 * which is a hand-kept mirror in the layer least likely to be noticed — two copies agree right up
 * until someone edits one, and nothing anywhere compares them. Now there is one.
 *
 * ⚠ NEVER THROWS. Called from click handlers and frame loops; an exception here would take the
 * world down over a noise.
 */
export function tone(freq: number, durMs: number, opts: ToneOpts = {}): void {
  try {
    const a = audioCtx()
    const out = bus()
    if (!a || !out) return
    const t0 = a.currentTime, dur = durMs / 1000
    const o = a.createOscillator(), g = a.createGain()
    o.type = opts.type ?? 'sine'
    o.frequency.setValueAtTime(freq, t0)
    if (opts.slideTo) o.frequency.linearRampToValueAtTime(opts.slideTo, t0 + dur)
    g.gain.setValueAtTime(opts.gain ?? 0.06, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(out)
    o.start(t0); o.stop(t0 + dur)
  } catch { /* audio blocked — no-op */ }
}

/** The haptic half of the same juice. Deduped for the same reason `tone` was. */
export function buzz(pat: number | number[]): void {
  try { navigator.vibrate?.(pat) } catch { /* unsupported */ }
}

/**
 * Drop the context. Call on unmount so a page that is gone is not holding an audio device.
 *
 * ⚠ EVERY CACHED NODE AND BUFFER GOES WITH IT. A `GainNode` or an `AudioBuffer` from a closed
 * context does not error — it silently plays nothing, which is the worst failure this file has.
 */
export function disposeAudio(): void {
  try { void ac?.close() } catch { /* already gone */ }
  ac = null
  masterGain = null
  noise = null
}
