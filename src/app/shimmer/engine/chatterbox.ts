// Chatterbox — Web Audio mumble synthesizer
// Generates per-NPC voice mumble (Undertale/Animal Crossing style)
// Each text character triggers a short oscillator tone, creating speech-like babble
// Two modes: playChar() for typewriter-synced per-character notes, speakLine() for editor preview

import type { VoiceProfile } from './dialogue-schema'
export type { VoiceProfile }

export interface VoiceInstance {
  profile: VoiceProfile
}

// ── Module state ──

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let masterVolume = 0.15
let muted = false
let speaking = false
let stopRequested = false
let activeTimeouts: ReturnType<typeof setTimeout>[] = []

// ── Audio context (lazy, needs user gesture to resume) ──

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    masterGain = ctx.createGain()
    masterGain.gain.value = masterVolume
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function getMasterGain(): GainNode {
  getCtx()
  return masterGain!
}

// ── Helpers ──

const VOWELS = new Set('aeiouAEIOU')

function isVowel(ch: string): boolean {
  return VOWELS.has(ch)
}

function isPause(ch: string): boolean {
  return ch === '.' || ch === ',' || ch === '!' || ch === '?' || ch === ';' || ch === ':'
}

// Map letter to consistent pitch offset (-20 to +20 Hz)
// Same letter always sounds similar for word-recognition feel
function charPitchOffset(ch: string): number {
  const code = ch.toLowerCase().charCodeAt(0) - 97
  if (code < 0 || code > 25) return 0
  return ((code / 25) * 40) - 20
}

// Oscillator waveform based on voice tone + vowel/consonant
function getWaveform(tone: VoiceProfile['tone'], vowel: boolean): OscillatorType {
  switch (tone) {
    case 'warm':     return vowel ? 'sine' : 'triangle'
    case 'cold':     return 'sawtooth'
    case 'neutral':  return 'triangle'
    case 'raspy':    return 'square'
    case 'cheerful': return vowel ? 'sine' : 'triangle'
  }
}

// Filter config shapes the overall voice character
function getFilterConfig(profile: VoiceProfile): { type: BiquadFilterType; freq: number; Q: number } {
  switch (profile.syllableSet) {
    case 'vowel-heavy':     return { type: 'lowpass',  freq: 800,  Q: 1.0 }
    case 'consonant-heavy': return { type: 'bandpass', freq: 1200, Q: 2.0 }
    case 'balanced':        return { type: 'lowpass',  freq: 1500, Q: 0.5 }
    case 'breathy':         return { type: 'lowpass',  freq: 600,  Q: 0.3 }
    case 'sharp':           return { type: 'highpass', freq: 400,  Q: 3.0 }
  }
}

// Syllable duration multiplier based on character type and syllable set
function syllableDurationMult(vowel: boolean, set: VoiceProfile['syllableSet']): number {
  if (set === 'vowel-heavy')     return vowel ? 1.2 : 0.6
  if (set === 'consonant-heavy') return vowel ? 0.7 : 1.1
  if (set === 'breathy')         return vowel ? 1.3 : 0.8
  if (set === 'sharp')           return vowel ? 0.7 : 0.5
  return vowel ? 1.0 : 0.7  // balanced
}

// ── Core synthesis ──

// Play a single syllable at the given time
function playSyllable(
  audioCtx: AudioContext,
  dest: GainNode,
  profile: VoiceProfile,
  ch: string,
  startTime: number,
  duration: number,
): void {
  const vowel = isVowel(ch)
  const freq = profile.pitch + charPitchOffset(ch) + (Math.random() - 0.5) * 2 * profile.pitchVariance

  // Oscillator
  const osc = audioCtx.createOscillator()
  osc.type = getWaveform(profile.tone, vowel)
  osc.frequency.value = Math.max(60, Math.min(400, freq))

  // Cheerful: add slight vibrato
  if (profile.tone === 'cheerful') {
    const vibrato = audioCtx.createOscillator()
    const vibratoGain = audioCtx.createGain()
    vibrato.frequency.value = 6
    vibratoGain.gain.value = 8
    vibrato.connect(vibratoGain)
    vibratoGain.connect(osc.frequency)
    vibrato.start(startTime)
    vibrato.stop(startTime + duration)
  }

  // Filter
  const filter = audioCtx.createBiquadFilter()
  const fc = getFilterConfig(profile)
  filter.type = fc.type
  filter.frequency.value = fc.freq
  filter.Q.value = fc.Q

  // Envelope
  const env = audioCtx.createGain()
  const attack = vowel ? 0.008 : 0.003
  const release = vowel ? 0.025 : 0.012
  env.gain.setValueAtTime(0, startTime)
  env.gain.linearRampToValueAtTime(profile.volume, startTime + attack)
  env.gain.setValueAtTime(profile.volume, startTime + duration - release)
  env.gain.linearRampToValueAtTime(0, startTime + duration)

  // Chain: osc → filter → envelope → dest
  osc.connect(filter)
  filter.connect(env)

  // Optional reverb (simple delay feedback)
  if (profile.reverb && profile.reverb > 0.05) {
    const delay = audioCtx.createDelay(0.15)
    delay.delayTime.value = 0.06 + profile.reverb * 0.08
    const feedback = audioCtx.createGain()
    feedback.gain.value = profile.reverb * 0.4
    const wetGain = audioCtx.createGain()
    wetGain.gain.value = profile.reverb * 0.3
    env.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wetGain)
    wetGain.connect(dest)
  }

  env.connect(dest)

  osc.start(startTime)
  osc.stop(startTime + duration + 0.01)
}

// ── Public API ──

/** Create a voice instance from a profile */
export function createVoice(profile: VoiceProfile): VoiceInstance {
  return { profile }
}

/**
 * Speak a line with the given voice.
 * onSyllable(charIndex) fires for each character in sync with audio.
 * Returns a promise that resolves when the line finishes.
 */
export function speakLine(
  voice: VoiceInstance,
  text: string,
  onSyllable?: (charIndex: number) => void,
): Promise<void> {
  // Stop any current speech
  stopSpeaking()

  if (muted || !text) return Promise.resolve()

  const audioCtx = getCtx()
  const dest = getMasterGain()
  const profile = voice.profile
  speaking = true
  stopRequested = false

  const baseDur = 1 / profile.speed  // seconds per syllable
  let time = audioCtx.currentTime + 0.02  // small buffer
  const startTime = time

  return new Promise<void>((resolve) => {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const elapsed = time - startTime

      if (stopRequested) break

      if (ch === ' ') {
        // Space: short pause, still fire callback for typewriter
        const gap = baseDur * 0.35
        const idx = i
        const ms = elapsed * 1000
        activeTimeouts.push(setTimeout(() => {
          if (!stopRequested) onSyllable?.(idx)
        }, ms))
        time += gap
      } else if (isPause(ch)) {
        // Punctuation: longer pause
        const pause = ch === ',' ? baseDur * 0.8 : baseDur * 1.5
        const idx = i
        const ms = elapsed * 1000
        activeTimeouts.push(setTimeout(() => {
          if (!stopRequested) onSyllable?.(idx)
        }, ms))
        time += pause
      } else if (/[a-zA-Z]/.test(ch)) {
        // Letter: play syllable
        const vowel = isVowel(ch)
        const mult = syllableDurationMult(vowel, profile.syllableSet)
        const dur = baseDur * mult * (0.85 + Math.random() * 0.3)  // slight jitter
        playSyllable(audioCtx, dest, profile, ch, time, dur)

        const idx = i
        const ms = elapsed * 1000
        activeTimeouts.push(setTimeout(() => {
          if (!stopRequested) onSyllable?.(idx)
        }, ms))
        time += dur
      } else {
        // Other chars (numbers, symbols): fire callback, small gap
        const idx = i
        const ms = elapsed * 1000
        activeTimeouts.push(setTimeout(() => {
          if (!stopRequested) onSyllable?.(idx)
        }, ms))
        time += baseDur * 0.3
      }
    }

    // Resolve when all syllables finish
    const totalMs = (time - startTime) * 1000
    activeTimeouts.push(setTimeout(() => {
      speaking = false
      resolve()
    }, totalMs + 50))
  })
}

/** Stop all current speech immediately */
export function stopSpeaking(): void {
  stopRequested = true
  speaking = false
  for (const t of activeTimeouts) clearTimeout(t)
  activeTimeouts = []
  // Ramp master gain to zero to kill any in-flight oscillators
  if (masterGain && ctx) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime)
    masterGain.gain.setValueAtTime(0, ctx.currentTime)
    // Restore after a beat so next speakLine works
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime + 0.05)
  }
}

/** Check if currently speaking */
export function isSpeaking(): boolean {
  return speaking
}

// ── Volume controls ──

/** Unlock audio context (call on first user gesture) */
export function unlockChatter(): void {
  if (ctx && ctx.state === 'suspended') ctx.resume()
}

export function setChatterVolume(vol: number): void {
  masterVolume = Math.max(0, Math.min(1, vol))
  if (masterGain) masterGain.gain.value = masterVolume
}

export function getChatterVolume(): number {
  return masterVolume
}

export function toggleChatterMute(): boolean {
  muted = !muted
  if (muted) stopSpeaking()
  return muted
}

export function isChatterMuted(): boolean {
  return muted
}

// ── Per-character playback (typewriter sync) ──

/** Play a single character's mumble note immediately (fire-and-forget).
 *  Call this from the typewriter tick for each newly revealed character.
 *  Only letters produce sound — spaces and punctuation are silent. */
export function playChar(voice: VoiceInstance, ch: string): void {
  if (muted || !/[a-zA-Z]/.test(ch)) return
  const audioCtx = getCtx()
  const dest = getMasterGain()
  const profile = voice.profile
  // Duration: short note that won't overlap with next char (~28ms between chars at 36/sec)
  const dur = Math.min(0.04 + (1 / profile.speed) * 0.03, 0.1)
  playSyllable(audioCtx, dest, profile, ch, audioCtx.currentTime, dur)
}

// ── Preview (for editor voice testing) ──

/** Speak a short sample to preview a voice profile */
export function previewVoice(profile: VoiceProfile): Promise<void> {
  const voice = createVoice(profile)
  return speakLine(voice, 'Hello there, Keeper. Welcome.')
}
