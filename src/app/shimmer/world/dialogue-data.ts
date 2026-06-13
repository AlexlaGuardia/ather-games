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
  'wisp-intro': {
    id: 'wisp-intro',
    lines: [
      { speaker: 'Wisp', text: "Oh! A new Keeper. I wasn't sure when you'd arrive.", voiceRef: 'wisp-intro_0' },
      { speaker: 'Wisp', text: 'This is the Shimmer Garden. The spirits here have been waiting for you.', voiceRef: 'wisp-intro_1' },
      { speaker: 'Wisp', text: 'Walk up to one and press Space. They love being petted.', voiceRef: 'wisp-intro_2' },
      { speaker: 'Wisp', text: 'If you find fruit, feed your companion from the bar below.', voiceRef: 'wisp-intro_3' },
      { speaker: 'Wisp', text: "I'll be here if you need me. Good luck, Keeper.", voiceRef: 'wisp-intro_4' },
    ],
    repeatable: true,
  },

  'console-inspect': {
    id: 'console-inspect',
    lines: [
      { text: 'The Spirit Console hums with faint energy...' },
      { text: 'Ancient markings glow across its surface. It responds to your presence.' },
      { text: 'Spirits drawn to the Console seem calmer, more trusting.' },
    ],
    repeatable: true,
  },

  'mycelial-keeper': {
    id: 'mycelial-keeper',
    lines: [
      { speaker: 'Spore', text: "The roots here connect everything. Every zone, every spirit.", voiceRef: 'mycelial-keeper_0' },
      { speaker: 'Spore', text: "Walk carefully. The mycelium remembers your steps.", voiceRef: 'mycelial-keeper_1' },
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

  'sleeping-spirit': {
    id: 'sleeping-spirit',
    lines: [
      { text: "A small spirit dozes peacefully, curled up in the doorway." },
      { text: "It doesn't seem like it plans to move anytime soon." },
    ],
    repeatable: true,
  },

  'gregory-intro': {
    id: 'gregory-intro',
    lines: [
      { speaker: 'Gregory', text: "Well now. You actually made it through.", voiceRef: 'gregory-intro_0' },
      { speaker: 'Gregory', text: "Most Keepers turn back at the first fork. You kept going.", voiceRef: 'gregory-intro_1' },
      { speaker: 'Gregory', text: "This is my workshop. Everything in the Ather flows through here eventually.", voiceRef: 'gregory-intro_2' },
      { speaker: 'Gregory', text: "I've called my companion back from your garden entrance. The shortcut is open now.", voiceRef: 'gregory-intro_3' },
      { speaker: 'Gregory', text: "Come find me when you're ready to go deeper.", voiceRef: 'gregory-intro_4' },
    ],
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

  // ── Moglin arc — triggers after first battle win against Gregory ──

  'gregory-moglin-warning': {
    id: 'gregory-moglin-warning',
    lines: [
      { speaker: 'Gregory', text: "Wait. Before you go further, you need to know something.", voiceRef: 'gregory-moglin_0', mood: 'serious' },
      { speaker: 'Gregory', text: "I didn't come here just to tend spirits. I was researching their origins.", voiceRef: 'gregory-moglin_1' },
      { speaker: 'Gregory', text: "The Ather has old pathways — portals, folded into the roots of this place.", voiceRef: 'gregory-moglin_2' },
      { speaker: 'Gregory', text: "I mapped some of them. Back on Athernyx, I was careless with that knowledge.", voiceRef: 'gregory-moglin_3', mood: 'regret' },
      { speaker: 'Gregory', text: "The Moglins found my research. They built their own portal system from it.", voiceRef: 'gregory-moglin_4' },
      { speaker: 'Gregory', text: "They've set up footholds in the outer zones. Camps. Crude, but they're digging in.", voiceRef: 'gregory-moglin_5', mood: 'serious' },
      { speaker: 'Gregory', text: "I'd avoid their encampments if I were you. They aren't interested in research.", voiceRef: 'gregory-moglin_6' },
      { speaker: 'Gregory', text: "But... if you insist on going out there anyway—", voiceRef: 'gregory-moglin_7' },
      { speaker: 'Gregory', text: "Here. I've been gathering these from the deeper groves. Mana seeds.", voiceRef: 'gregory-moglin_8', mood: 'giving' },
      { speaker: 'Gregory', text: "Each one holds the essence of a different spirit. Plant it, and something will grow.", voiceRef: 'gregory-moglin_9' },
      { speaker: 'Gregory', text: "Pick one. Whichever calls to you.", voiceRef: 'gregory-moglin_10' },
    ],
    repeatable: false,
    onComplete: 'gregorySeedChoice',
  },

  'gregory-tablet': {
    id: 'gregory-tablet',
    lines: [
      { speaker: 'Gregory', text: "Good choice. Take care of it.", voiceRef: 'gregory-tablet_0' },
      { speaker: 'Gregory', text: "Now — take this too. A Spirit Tablet. Portable, links to my research archive.", voiceRef: 'gregory-tablet_1', mood: 'giving' },
      { speaker: 'Gregory', text: "It tracks your party, and anything you learn about the spirits you encounter.", voiceRef: 'gregory-tablet_2' },
      { speaker: 'Gregory', text: "If you come across spirits in the wild... study them. Get close, observe.", voiceRef: 'gregory-tablet_3' },
      { speaker: 'Gregory', text: "Most will accept a challenge if you offer one. That's how they communicate.", voiceRef: 'gregory-tablet_4' },
      { speaker: 'Gregory', text: "Bring back what you learn. Every bit of data helps me understand what the Moglins are after.", voiceRef: 'gregory-tablet_5' },
      { speaker: 'Gregory', text: "The tablet is yours now. Press T to open it anytime.", voiceRef: 'gregory-tablet_6' },
    ],
    repeatable: false,
    onComplete: 'spiritTabletReceived',
  },

  'gregory-post-tablet': {
    id: 'gregory-post-tablet',
    lines: [
      { speaker: 'Gregory', text: "How's the research going? The tablet tracking everything?", voiceRef: 'gregory-post-tablet_0' },
      { speaker: 'Gregory', text: "I've got seedlings and nodes if you need to expand your garden. Take a look.", voiceRef: 'gregory-post-tablet_1' },
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

  // ── Wave 2 NPCs — stubs for chain resolution (content in JSON graphs) ──

  'bramble-intro': { id: 'bramble-intro', lines: [], repeatable: false, onComplete: 'metBramble' },
  'bramble-return': { id: 'bramble-return', lines: [], repeatable: true },
  'ember-intro': { id: 'ember-intro', lines: [], repeatable: false, onComplete: 'metEmber' },
  'ember-return': { id: 'ember-return', lines: [], repeatable: true },
  'luna-intro': { id: 'luna-intro', lines: [], repeatable: false, onComplete: 'metLuna' },
  'luna-heal': { id: 'luna-heal', lines: [], repeatable: true },
  'rootweaver-intro': { id: 'rootweaver-intro', lines: [], repeatable: false, onComplete: 'metRootweaver' },
  'echo-riddle': { id: 'echo-riddle', lines: [], repeatable: true },
  'dusk-intro': { id: 'dusk-intro', lines: [], repeatable: false, onComplete: 'metDusk' },
  'moss-intro': { id: 'moss-intro', lines: [], repeatable: true },
  'glint-intro': { id: 'glint-intro', lines: [], repeatable: false, onComplete: 'metGlint' },
}
