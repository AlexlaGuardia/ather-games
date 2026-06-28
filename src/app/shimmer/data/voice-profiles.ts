// Voice profiles — per-NPC chatterbox voice configurations
// Each NPC gets a distinct mumble voice shaped by pitch, speed, tone, and syllable set
// Profiles are looked up by NPC id at dialogue runtime

import type { VoiceProfile } from '../engine/dialogue-schema'

// ── NPC Voice Profiles ──

const GREGORY: VoiceProfile = {
  id: 'gregory',
  name: 'Gregory',
  pitch: 120,            // deep, authoritative
  pitchVariance: 15,     // steady, measured speech
  speed: 5,              // slow, deliberate
  syllableSet: 'balanced',
  tone: 'warm',
  volume: 0.8,
}

// Narrator/object text — neutral, understated
const NARRATOR: VoiceProfile = {
  id: 'narrator',
  name: 'Narrator',
  pitch: 200,
  pitchVariance: 10,
  speed: 8,
  syllableSet: 'balanced',
  tone: 'neutral',
  volume: 0.4,           // quieter than NPCs
}

// ── Reformed Moglins ──

// Brack — gruff, grounded, carries the weight of what he did; reformed trader.
// "I know the worth of things, Keeper. Spent years counting them on leashes, more shame to me."
const BRACK: VoiceProfile = {
  id: 'brack',
  name: 'Brack',
  pitch: 145,            // low, solid — a heavy voice doing lighter work now
  pitchVariance: 12,     // steady, no flutter
  speed: 5,              // slow and deliberate, like he thinks before he speaks
  syllableSet: 'consonant-heavy',
  tone: 'warm',          // reformed, trying to be good
  volume: 0.75,
}

// Sorrel — careful with words, gentle, thoughtful; finds the right name for things.
// "And I am good with names. If ever a friend of yours wants a new one, a kinder one…"
const SORREL: VoiceProfile = {
  id: 'sorrel',
  name: 'Sorrel',
  pitch: 195,            // mid-high, bright but unhurried
  pitchVariance: 18,     // light variance — turning words over
  speed: 7,              // measured, not slow; she chooses each word
  syllableSet: 'balanced',
  tone: 'warm',          // careful kindness
  volume: 0.7,
}

// Thistle — quietest of the three; patient, warm, waiting.
// "I will mind a corner for you, Keeper. Keep it ready. Keep it warm."
const THISTLE: VoiceProfile = {
  id: 'thistle',
  name: 'Thistle',
  pitch: 220,            // higher, soft — the gentlest voice in the cast
  pitchVariance: 14,     // gentle ebb, never jagged
  speed: 6,              // unhurried, patient
  syllableSet: 'breathy',
  tone: 'warm',          // genuinely warm, no edge left
  volume: 0.6,           // quieter — doesn't demand attention
}

// ── Registry ──

export const VOICE_PROFILES: Record<string, VoiceProfile> = {
  gregory: GREGORY,
  narrator: NARRATOR,
  brack: BRACK,
  sorrel: SORREL,
  thistle: THISTLE,
}

/** Get voice profile for an NPC, falling back to narrator */
export function getVoiceProfile(npcId: string): VoiceProfile {
  return VOICE_PROFILES[npcId] ?? VOICE_PROFILES.narrator
}
