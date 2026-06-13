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

const WISP: VoiceProfile = {
  id: 'wisp',
  name: 'Wisp',
  pitch: 250,            // high, ethereal
  pitchVariance: 35,     // fluttery, variable
  speed: 10,             // fast, excited
  syllableSet: 'breathy',
  tone: 'cheerful',
  volume: 0.6,
}

const SPORE: VoiceProfile = {
  id: 'spore',
  name: 'Spore',
  pitch: 180,            // mid-range, earthy
  pitchVariance: 25,     // some roughness
  speed: 7,              // measured pace
  syllableSet: 'consonant-heavy',
  tone: 'raspy',
  volume: 0.7,
  reverb: 0.3,           // cave/underground feel
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

// ── Wave 2 NPCs ──

const BRAMBLE: VoiceProfile = {
  id: 'bramble',
  name: 'Bramble',
  pitch: 140,            // low, gruff farmer
  pitchVariance: 12,
  speed: 5,              // slow, deliberate
  syllableSet: 'consonant-heavy',
  tone: 'neutral',
  volume: 0.75,
}

const EMBER: VoiceProfile = {
  id: 'ember',
  name: 'Ember',
  pitch: 190,            // mid-high, energetic
  pitchVariance: 30,     // animated speech
  speed: 8,              // fast talker
  syllableSet: 'sharp',
  tone: 'cheerful',
  volume: 0.7,
}

const LUNA_NPC: VoiceProfile = {
  id: 'luna_npc',
  name: 'Luna',
  pitch: 210,            // gentle, calming
  pitchVariance: 18,
  speed: 7,
  syllableSet: 'breathy',
  tone: 'warm',
  volume: 0.65,
}

const ROOTWEAVER: VoiceProfile = {
  id: 'rootweaver',
  name: 'Rootweaver',
  pitch: 160,            // mid-low, gravelly
  pitchVariance: 20,
  speed: 6,
  syllableSet: 'vowel-heavy',
  tone: 'raspy',
  volume: 0.7,
  reverb: 0.2,
}

const ECHO: VoiceProfile = {
  id: 'echo',
  name: 'Echo',
  pitch: 260,            // high, ethereal
  pitchVariance: 40,     // wavering, mysterious
  speed: 9,
  syllableSet: 'vowel-heavy',
  tone: 'cold',
  volume: 0.6,
  reverb: 0.5,           // echo reverb
}

const DUSK: VoiceProfile = {
  id: 'dusk',
  name: 'Dusk',
  pitch: 170,            // mid, measured
  pitchVariance: 10,     // very steady
  speed: 7,
  syllableSet: 'balanced',
  tone: 'neutral',
  volume: 0.7,
}

const MOSS: VoiceProfile = {
  id: 'moss',
  name: 'Moss',
  pitch: 130,            // very deep, slow
  pitchVariance: 8,      // almost monotone
  speed: 4,              // slowest NPC
  syllableSet: 'consonant-heavy',
  tone: 'warm',
  volume: 0.8,
  reverb: 0.15,
}

const GLINT: VoiceProfile = {
  id: 'glint',
  name: 'Glint',
  pitch: 240,            // high, sparkling
  pitchVariance: 35,
  speed: 10,             // very fast, excited
  syllableSet: 'breathy',
  tone: 'cheerful',
  volume: 0.55,
}

// ── Registry ──

export const VOICE_PROFILES: Record<string, VoiceProfile> = {
  gregory: GREGORY,
  wisp: WISP,
  spore: SPORE,
  narrator: NARRATOR,
  bramble: BRAMBLE,
  ember: EMBER,
  luna_npc: LUNA_NPC,
  rootweaver: ROOTWEAVER,
  echo: ECHO,
  dusk: DUSK,
  moss: MOSS,
  glint: GLINT,
}

/** Get voice profile for an NPC, falling back to narrator */
export function getVoiceProfile(npcId: string): VoiceProfile {
  return VOICE_PROFILES[npcId] ?? VOICE_PROFILES.narrator
}
