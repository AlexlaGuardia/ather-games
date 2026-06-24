// Dialogue Graph Schema — Wave 1
// Branching dialogue trees (BioWare-style) with conditions, actions, and voice hooks

// ── Node data types ──

export interface TextNodeData {
  speaker: string               // NPC name or "narrator"
  text: string
  emotion?: string              // portrait/animation hint: "neutral", "happy", "angry", "serious", etc.
  voiceOverride?: Partial<VoiceProfile>
  autoAdvance?: number          // ms before auto-advancing (0 = wait for input)
}

export interface ChoiceNodeData {
  prompt?: string               // optional text before choices
  options: ChoiceOption[]
}

export interface ChoiceOption {
  label: string                 // what player sees
  targetNodeId: string          // where this choice leads
  condition?: DialogueCondition // only show if condition met
}

export interface ConditionNodeData {
  conditions: {
    check: DialogueCondition
    targetNodeId: string        // if true
  }[]
  fallbackNodeId: string        // if none match
}

export interface ActionNodeData {
  actions: DialogueAction[]
  nextNodeId?: string           // continue to next node (null = end dialogue)
}

// ── Conditions (composable) ──

export type DialogueCondition =
  | { type: 'flag'; flag: string; value: boolean }
  | { type: 'item'; itemId: string; count: number; op: '>=' | '<' | '==' }
  | { type: 'skill'; skillId: string; level: number; op: '>=' | '<' }
  | { type: 'spirit'; species: string; inParty?: boolean }
  | { type: 'time'; phase: 'dawn' | 'day' | 'dusk' | 'night' }
  | { type: 'reputation'; npcId: string; level: number; op: '>=' | '<' }
  | { type: 'and'; conditions: DialogueCondition[] }
  | { type: 'or'; conditions: DialogueCondition[] }

// ── Actions ──

export type DialogueAction =
  | { type: 'setFlag'; flag: string; value: boolean }
  | { type: 'giveItem'; itemId: string; count: number }
  | { type: 'removeItem'; itemId: string; count: number }
  | { type: 'startBattle'; config: Record<string, unknown> }
  | { type: 'openShop'; shopId: string }
  | { type: 'heal' }
  | { type: 'teleport'; zoneId: string; tileX: number; tileY: number }
  | { type: 'playSound'; soundId: string }
  | { type: 'setEmotion'; npcId: string; emotion: string }
  // Grants a random Mana Seed from the ready-species pool.
  // Pool starts as ['fox','axolotl','water-bear']; widen to all 10 as sprites land.
  | { type: 'giveRandomSeed' }

// ── Graph structure ──

export type DialogueNodeType = 'text' | 'choice' | 'condition' | 'action'

export interface DialogueNode {
  id: string
  type: DialogueNodeType
  position: { x: number; y: number }  // editor layout
  data: TextNodeData | ChoiceNodeData | ConditionNodeData | ActionNodeData
}

export interface DialogueEdge {
  id: string
  from: string                  // node ID
  to: string                    // node ID
  fromPort?: string             // which output port (for choice/condition branches)
}

export interface DialogueGraph {
  id: string                    // e.g. "gregory_intro"
  npcId: string                 // e.g. "gregory"
  nodes: DialogueNode[]
  edges: DialogueEdge[]
  entryNodeId: string           // starting node
  metadata?: {
    author?: string
    lastEdited?: string
    tags?: string[]             // "tutorial", "quest", "shop"
  }
}

// ── Voice profile (used by Track B chatterbox) ──

export interface VoiceProfile {
  id: string                    // matches NPC id
  name: string                  // display name
  pitch: number                 // base frequency (80-300 Hz)
  pitchVariance: number         // random variance per syllable (0-50)
  speed: number                 // syllables per second (4-12)
  syllableSet: 'vowel-heavy' | 'consonant-heavy' | 'balanced' | 'breathy' | 'sharp'
  tone: 'warm' | 'cold' | 'neutral' | 'raspy' | 'cheerful'
  volume: number                // 0-1
  reverb?: number               // 0-1 (cave NPCs get reverb)
}

// ── Runtime state (used by dialogue-runtime.ts) ──

export interface DialogueRuntimeState {
  active: boolean
  graphId: string
  currentNodeId: string
  charProgress: number          // typewriter position (fractional)
  lineComplete: boolean
  choices: ChoiceOption[] | null // non-null when waiting for player choice
  pendingActions: DialogueAction[] | null // actions to execute before advancing
}
