// Dialogue content — voice-ready structure
// Each line has optional voiceRef for future Chatterbox TTS integration
// Convention: voiceRef = "{dialogueId}_{lineIndex}" maps to /audio/dialogue/{voiceRef}.wav

export interface DialogueLine {
  speaker?: string     // NPC name, omit for narration/object text
  text: string
  voiceRef?: string    // Chatterbox audio reference ID
  mood?: string        // Future: sprite expression hint
}

export interface Dialogue {
  id: string
  lines: DialogueLine[]
  repeatable?: boolean // Can trigger again after completing (default true)
  onComplete?: string  // Flag name to set when dialogue finishes (e.g., 'tutorialComplete')
}

export const DIALOGUES: Record<string, Dialogue> = {
  'console-inspect': {
    id: 'console-inspect',
    lines: [
      { text: 'The Spirit Console hums with faint energy...' },
      { text: 'Ancient markings glow across its surface. It responds to your presence.' },
      { text: 'Spirits drawn to the Console seem calmer, more trusting.' },
    ],
    repeatable: true,
  },

  'community-gate': {
    id: 'community-gate',
    lines: [
      { text: 'The gate hums with quiet energy. Beyond it, the Ather stretches wide.' },
    ],
    repeatable: true,
  },

  'gregory-intro': {
    id: 'gregory-intro',
    lines: [],
    repeatable: false,
    onComplete: 'tutorialComplete',
  },

  'gregory-return': {
    id: 'gregory-return',
    lines: [
      { speaker: 'Gregory', text: "Back again? Good. The Ather rewards persistence.", voiceRef: 'gregory-return_0' },
    ],
    repeatable: true,
  },

  'gregory-challenge': {
    id: 'gregory-challenge',
    lines: [
      { speaker: 'Gregory', text: "Your spirit looks stronger since last time.", voiceRef: 'gregory-challenge_0' },
      { speaker: 'Gregory', text: "Let me see how far you've come. My owl's been restless.", voiceRef: 'gregory-challenge_1' },
    ],
    repeatable: true,
  },

  'gregory-post-win': {
    id: 'gregory-post-win',
    lines: [
      { speaker: 'Gregory', text: "Hm. Not bad, Keeper.", voiceRef: 'gregory-post-win_0' },
      { speaker: 'Gregory', text: "Your spirit trusts you. That's what matters.", voiceRef: 'gregory-post-win_1' },
    ],
    repeatable: true,
  },

  'gregory-post-lose': {
    id: 'gregory-post-lose',
    lines: [
      { speaker: 'Gregory', text: "Don't look so down. Every loss is a lesson.", voiceRef: 'gregory-post-lose_0' },
      { speaker: 'Gregory', text: "Come back when you're ready. I'll be here.", voiceRef: 'gregory-post-lose_1' },
    ],
    repeatable: true,
  },

  // ── Study observations — brief narration when studying a wild spirit ──

  'study-observation': {
    id: 'study-observation',
    lines: [
      { text: "You observe the spirit carefully. Its patterns are recorded in your tablet." },
    ],
    repeatable: true,
  },

  // ── New v1 main-map dialogues (handled by JSON graphs) ──

  'gregory-tending': { id: 'gregory-tending', lines: [], repeatable: false, onComplete: 'tendingTaughtComplete' },
  'gregory-sendoff': { id: 'gregory-sendoff', lines: [], repeatable: false, onComplete: 'gregorySentToMeadows' },
  'thistle-prefight': { id: 'thistle-prefight', lines: [], repeatable: false, onComplete: 'sawThistle' },
  'thistle-return': { id: 'thistle-return', lines: [], repeatable: false },
  'thistle-defeat': { id: 'thistle-defeat', lines: [], repeatable: false, onComplete: 'thistleDefeated' },
  'sorrel-prefight': { id: 'sorrel-prefight', lines: [], repeatable: false },
  'sorrel-defeat': { id: 'sorrel-defeat', lines: [], repeatable: false, onComplete: 'sorrelDefeated' },
  'brack-prefight': { id: 'brack-prefight', lines: [], repeatable: false },
  'brack-defeat': { id: 'brack-defeat', lines: [], repeatable: false, onComplete: 'brackDefeated' },
  'ather-winds-hook': { id: 'ather-winds-hook', lines: [], repeatable: false, onComplete: 'atherWindsVisited' },
  'thistle-home': { id: 'thistle-home', lines: [], repeatable: true },
  'sorrel-home': { id: 'sorrel-home', lines: [], repeatable: true },
  'brack-home': { id: 'brack-home', lines: [], repeatable: true },
}
