// ── THE MANALIC GUNS' VOICES (Alex 11-19: "what if the gunshots weren't loud but instead each has a unique exhale / sizzle /
// discharge type sound") ─────────────────────────────────────────────────────────────────────────────────────────────────
// No powder, so no bang: a shot is a breath of mana with a tail. Four layers, all synthesised (WebAudio, no sound files):
//   BREATH  band-passed noise, the exhale          SIZZLE  high-passed noise chopped by a random gate, the crackle
//   RING    two detuned triangles, the crystal      THUMP   a sine dropping in pitch, the body under the shot
// The numbers are the sound board's (docs/looks/gun-sound.html, the same synth): Alex tunes there, Copy settings, then pastes
// into /shimmer/dev/guns › Sound, which saves THIS browser's copy (GUN_SOUND_KEY, a device key). The game reads it at fire time.
// Canon says nothing about how manalic guns sound (checked 11-19): this is build/feel.

import { getSettings } from './settings'

export type Layer = Record<string, number>
export interface GunVoice { breath: Layer; sizzle: Layer; ring: Layer; thump: Layer }

export const GUN_SOUND_KEY = 'open:gun-sound.v1'

export const GUN_VOICES: Record<string, GunVoice> = {
  repeater: { breath: { gain: .55, freq: 1400, q: 1.2, attack: .003, decay: .09 }, sizzle: { gain: .08, freq: 6000, crackle: .2, decay: .08 }, ring: { gain: .22, freq: 1850, shimmer: 6, decay: .25 }, thump: { gain: .2, from: 180, to: 70, decay: .06 } },
  spitter: { breath: { gain: .45, freq: 2400, q: 2.4, attack: .001, decay: .035 }, sizzle: { gain: .05, freq: 7000, crackle: .1, decay: .03 }, ring: { gain: .06, freq: 2600, shimmer: 2, decay: .05 }, thump: { gain: .15, from: 220, to: 120, decay: .025 } },
  backbone: { breath: { gain: .5, freq: 1100, q: 1.6, attack: .002, decay: .07 }, sizzle: { gain: .14, freq: 5200, crackle: .35, decay: .12 }, ring: { gain: .1, freq: 1300, shimmer: 4, decay: .12 }, thump: { gain: .3, from: 160, to: 55, decay: .06 } },
  roar: { breath: { gain: .8, freq: 520, q: .8, attack: .004, decay: .22 }, sizzle: { gain: .5, freq: 4200, crackle: .75, decay: .65 }, ring: { gain: .05, freq: 700, shimmer: 10, decay: .3 }, thump: { gain: .75, from: 120, to: 35, decay: .2 } },
  lance: { breath: { gain: .4, freq: 3200, q: 3, attack: .001, decay: .05 }, sizzle: { gain: .42, freq: 7600, crackle: .15, decay: .95 }, ring: { gain: .2, freq: 2900, shimmer: 12, decay: .7 }, thump: { gain: .25, from: 260, to: 90, decay: .05 } },
  'charred-rifle': { breath: { gain: .65, freq: 900, q: 1, attack: .003, decay: .14 }, sizzle: { gain: .32, freq: 5600, crackle: .25, decay: .55 }, ring: { gain: .14, freq: 1150, shimmer: 8, decay: .4 }, thump: { gain: .45, from: 140, to: 45, decay: .1 } },
}

/** This browser's tuned voices (from the dev bench), else the defaults. Bad JSON never breaks a shot. */
export function voices(): Record<string, GunVoice> {
  try {
    const t = JSON.parse(localStorage.getItem(GUN_SOUND_KEY) ?? 'null') as Record<string, GunVoice> | null
    if (t && typeof t === 'object') return { ...GUN_VOICES, ...t }
  } catch { /* defaults */ }
  return GUN_VOICES
}
export function saveVoices(json: string): boolean {
  try { const v = JSON.parse(json); if (!v || typeof v !== 'object') return false; localStorage.setItem(GUN_SOUND_KEY, JSON.stringify(v)); return true } catch { return false }
}
export function resetVoices() { try { localStorage.removeItem(GUN_SOUND_KEY) } catch { /* fine */ } }

// ── the engine: one AudioContext, made on the first shot (a shot is always a user gesture's consequence) ──
let ctx: AudioContext | null = null, master: GainNode | null = null, noiseBuf: AudioBuffer | null = null
/** The ONE master bus (sfx.ts plays through it too: one context, not two). Valid after audio() returned a context. */
export const masterBus = (): GainNode | null => master
export function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    master!.gain.value = Math.max(0, Math.min(1, getSettings().volume ?? 0.7))
    return ctx
  } catch { return null }
}
export function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf
  const n = Math.floor(c.sampleRate * 1.5); noiseBuf = c.createBuffer(1, n, c.sampleRate)
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}
function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}
/** One voice at time t (pitch = a per-shot wobble). */
export function voice(v: GunVoice, pitch = 1) {
  const c = audio(); if (!c || !master) return
  const t = c.currentTime + 0.005, out = master
  const b = v.breath, z = v.sizzle, r = v.ring, h = v.thump
  if (b?.gain > 0) { const s = c.createBufferSource(); s.buffer = noise(c); s.playbackRate.value = pitch
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = b.freq * pitch; f.Q.value = b.q
    const g = c.createGain(); env(g, t, b.gain, b.attack, b.decay); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + b.attack + b.decay + 0.05) }
  if (z?.gain > 0) { const s = c.createBufferSource(); s.buffer = noise(c)
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = z.freq * pitch
    const g = c.createGain(); env(g, t, z.gain, 0.004, z.decay)
    const gate = c.createGain(), dur = z.decay + 0.05, steps = Math.ceil(dur / 0.008)
    for (let i = 0; i < steps; i++) gate.gain.setValueAtTime(Math.random() < z.crackle ? Math.random() * 0.3 : 1, t + i * 0.008)
    s.connect(f).connect(gate).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur) }
  if (r?.gain > 0) for (const d of [-1, 1]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = r.freq * pitch; o.detune.value = d * r.shimmer
    const g = c.createGain(); env(g, t, r.gain * 0.5, 0.002, r.decay); o.connect(g).connect(out); o.start(t); o.stop(t + r.decay + 0.05) }
  if (h?.gain > 0) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(h.from * pitch, t); o.frequency.exponentialRampToValueAtTime(Math.max(h.to, 10), t + h.decay)
    const g = c.createGain(); env(g, t, h.gain, 0.002, h.decay); o.connect(g).connect(out); o.start(t); o.stop(t + h.decay + 0.05) }
}

export function playShot(gunId: string) { const v = voices()[gunId] ?? GUN_VOICES.repeater; voice(v, 1 + (Math.random() - 0.5) * 0.06) }
const Z = { gain: 0 }
let lastEmpty = 0
/** a dry sputter, like a match that won't strike (throttled: a held trigger on an empty gun sputters, it doesn't buzz) */
export function playEmpty() {
  const now = performance.now(); if (now - lastEmpty < 280) return; lastEmpty = now
  voice({ breath: { gain: 0.18, freq: 3000, q: 3, attack: 0.001, decay: 0.02 }, sizzle: { gain: 0.1, freq: 7000, crackle: 0.6, decay: 0.03 }, ring: Z, thump: Z })
}
/** two crystal clinks, then the mana humming back in */
export function playReload() {
  const c = audio(); if (!c || !master) return
  voice({ breath: Z, sizzle: Z, thump: Z, ring: { gain: 0.3, freq: 2400, shimmer: 3, decay: 0.08 } })
  setTimeout(() => voice({ breath: Z, sizzle: Z, thump: Z, ring: { gain: 0.25, freq: 3000, shimmer: 3, decay: 0.07 } }), 90)
  const t = c.currentTime + 0.2, o = c.createOscillator(), g = c.createGain()
  o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.5)
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.6)
}
