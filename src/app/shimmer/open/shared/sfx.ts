// ── GAME SFX (BETA M36) ─ one registry, one AudioContext, a yay gate ───────────────────────────────────────────────────────
// `sounds.json` is the registry: every sound is proposed | yay | nay, and the GAME PLAYS ONLY `yay`. A proposed or nay sound is
// silent in play; Alex votes on /shimmer/dev/sounds (which POSTs /shimmer/save-sound-vote), and the vote is live at the next deploy.
// The synth recipes live here, in code, modelled on gun-sound.ts and played through ITS context and master bus (one AudioContext).
// Sounds are build/feel, not canon.

import registry from './sounds.json'
import { audio, masterBus, noise } from './gun-sound'

export type SoundStatus = 'proposed' | 'yay' | 'nay'
export interface SoundRow { id: string; area: string; status: SoundStatus; note: string; desc?: string; source: 'synth' | 'cc0'; licence?: string }
export const SOUNDS = registry as SoundRow[]
export const statusOf = (id: string): SoundStatus | null => SOUNDS.find(s => s.id === id)?.status ?? null

export interface PlayOpts { vol?: number; pitch?: number }
type Bus = { c: AudioContext; out: AudioNode; t: number; vol: number; pitch: number }

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}
/** a filtered noise burst */
function puff(b: Bus, type: BiquadFilterType, freq: number, q: number, gain: number, attack: number, decay: number, at = 0) {
  const t = b.t + at, s = b.c.createBufferSource(); s.buffer = noise(b.c)
  const f = b.c.createBiquadFilter(); f.type = type; f.frequency.value = freq * b.pitch; f.Q.value = q
  const g = b.c.createGain(); env(g, t, gain * b.vol, attack, decay)
  s.connect(f).connect(g).connect(b.out); s.start(t, Math.random()); s.stop(t + attack + decay + 0.05)
}
/** a pitched tone, optionally gliding */
function tone(b: Bus, type: OscillatorType, from: number, to: number, gain: number, attack: number, decay: number, at = 0) {
  const t = b.t + at, o = b.c.createOscillator(), g = b.c.createGain()
  o.type = type; o.frequency.setValueAtTime(from * b.pitch, t); o.frequency.exponentialRampToValueAtTime(Math.max(to * b.pitch, 10), t + attack + decay)
  env(g, t, gain * b.vol, attack, decay); o.connect(g).connect(b.out); o.start(t); o.stop(t + attack + decay + 0.05)
}

const RECIPES: Record<string, (b: Bus) => void> = {
  'step-grass': b => { puff(b, 'bandpass', 1400, 0.7, 0.09, 0.006, 0.07); puff(b, 'lowpass', 350, 0.7, 0.06, 0.003, 0.05) },   // r2: softer (Alex)
  'step-stone': b => { tone(b, 'triangle', 2600, 2300, 0.12, 0.001, 0.025); puff(b, 'highpass', 4000, 1, 0.06, 0.001, 0.012); tone(b, 'triangle', 2100, 1900, 0.09, 0.001, 0.022, 0.04) },   // r2: domino click-clack (Alex)
  'step-wood': b => { tone(b, 'sine', 130, 65, 0.26, 0.002, 0.12); puff(b, 'bandpass', 320, 4, 0.12, 0.002, 0.1); tone(b, 'sawtooth', 210, 260, 0.018, 0.03, 0.14, 0.05) },   // r2: hollow thud + soft creak (Alex)
  'jump': b => { tone(b, 'sine', 120, 70, 0.22, 0.002, 0.07); puff(b, 'lowpass', 650, 0.7, 0.22, 0.003, 0.09); puff(b, 'bandpass', 1500, 0.8, 0.12, 0.002, 0.06, 0.02) },   // r2: a heavy last step pushing off (Alex)
  'land': b => { tone(b, 'sine', 120, 60, 0.16, 0.002, 0.08); puff(b, 'lowpass', 700, 0.5, 0.26, 0.012, 0.22); puff(b, 'bandpass', 1100, 0.6, 0.08, 0.02, 0.18, 0.03) },   // r2: pushing dirt (Alex)
  'hit-axe-tree': b => { tone(b, 'triangle', 220, 80, 0.34, 0.001, 0.09); puff(b, 'highpass', 3500, 1, 0.18, 0.001, 0.02); puff(b, 'bandpass', 1300, 1.6, 0.2, 0.001, 0.045) },   // r2: sharper (Alex)
  'hit-prune-tree': b => { puff(b, 'highpass', 3200, 1, 0.14, 0.001, 0.04); puff(b, 'bandpass', 2200, 1, 0.12, 0.003, 0.12, 0.03) },
  'hit-pick-crystal': b => { tone(b, 'triangle', 1900, 1700, 0.18, 0.001, 0.14); puff(b, 'highpass', 5000, 1, 0.1, 0.001, 0.03) },
  'hit-prospect-crystal': b => { tone(b, 'sine', 2400, 2300, 0.14, 0.001, 0.3); tone(b, 'sine', 3100, 3000, 0.07, 0.001, 0.22); puff(b, 'highpass', 6000, 1, 0.06, 0.001, 0.02) },
  'pickup-grey-matter': b => { tone(b, 'sine', 300, 340, 0.16, 0.01, 0.09); tone(b, 'sine', 420, 440, 0.1, 0.01, 0.1, 0.05) },
  'pickup-item': b => { tone(b, 'triangle', 660, 680, 0.14, 0.004, 0.07); tone(b, 'triangle', 990, 1000, 0.12, 0.004, 0.1, 0.07) },
  'ui-tap': b => { tone(b, 'sine', 1300, 1100, 0.1, 0.001, 0.03) },
  'ui-panel-open': b => { puff(b, 'bandpass', 900, 1, 0.09, 0.03, 0.1); tone(b, 'sine', 400, 700, 0.06, 0.02, 0.1) },
  'ui-panel-close': b => { puff(b, 'bandpass', 1300, 1, 0.08, 0.02, 0.09); tone(b, 'sine', 700, 380, 0.06, 0.015, 0.09) },
}

function run(id: string, o: PlayOpts) {
  const r = RECIPES[id]; if (!r) return
  const c = audio(), out = masterBus(); if (!c || !out) return
  try { r({ c, out, t: c.currentTime + 0.003, vol: o.vol ?? 1, pitch: o.pitch ?? 1 }) } catch { /* a sound never breaks the game */ }
}
/** Play a sound IN THE GAME. Only a `yay` sound makes noise; proposed and nay are silent. */
export function play(id: string, opts: PlayOpts = {}) { if (statusOf(id) === 'yay') run(id, opts) }
/** The review page's play button: sounds regardless of status. Never call from the game. */
export function audition(id: string) { run(id, {}) }

// ── the walker's feet: footsteps on the step cadence, jump and land on the air edge ──
/** The surface underfoot. ⚠ The walker's world (LocoWorld) knows floor height and water, not what the floor is made of, so
 *  this is grass everywhere until a surface query exists. */
export type Surface = 'grass' | 'stone' | 'wood'
export const surfaceUnder = (): Surface => 'grass'
export const STRIDE = 1.9   // metres of ground covered per footfall
let strideLeft = STRIDE, wasAir = false
export interface FeetState { px: number; pz: number; hvx: number; hvz: number; vy: number; airborne: boolean; swimming?: boolean }
/** One call per walker frame, after the locomotion tick. */
export function tickFeet(lc: FeetState, dt: number, surface: Surface = surfaceUnder()) {
  const air = lc.airborne && !lc.swimming
  if (air && !wasAir && lc.vy > 0) play('jump')
  if (!air && wasAir) { play('land'); strideLeft = STRIDE }
  wasAir = air
  if (air || lc.swimming) return
  const sp = Math.hypot(lc.hvx, lc.hvz)
  if (sp < 0.5) { strideLeft = Math.min(strideLeft, STRIDE * 0.5); return }
  strideLeft -= sp * dt
  if (strideLeft <= 0) { strideLeft += STRIDE; play(`step-${surface}`, { pitch: 0.94 + Math.random() * 0.12 }) }
}
