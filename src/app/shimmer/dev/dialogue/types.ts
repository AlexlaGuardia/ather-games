// Dialogue graph schema — shared with engine/dialogue-schema.ts (Track A)
// When Track A ships, replace this import with the canonical source

export interface DialogueGraph {
  id: string
  npcId: string
  nodes: DialogueNode[]
  edges: DialogueEdge[]
  entryNodeId: string
  frames?: DialogueFrame[]
  metadata?: {
    author?: string
    lastEdited?: string
    tags?: string[]
  }
}

export type DialogueNodeType = 'text' | 'choice' | 'condition' | 'action' | 'reroute'

export interface DialogueNode {
  id: string
  type: DialogueNodeType
  position: { x: number; y: number }
  data: TextNodeData | ChoiceNodeData | ConditionNodeData | ActionNodeData | RerouteNodeData
}

export interface TextNodeData {
  speaker: string
  text: string
  emotion?: string
  autoAdvance?: number
}

export interface ChoiceNodeData {
  prompt?: string
  options: {
    label: string
    targetNodeId: string
    condition?: DialogueCondition
  }[]
}

export interface ConditionNodeData {
  conditions: {
    check: DialogueCondition
    targetNodeId: string
  }[]
  fallbackNodeId: string
}

export interface ActionNodeData {
  actions: DialogueAction[]
  nextNodeId?: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RerouteNodeData {}

export interface DialogueFrame {
  id: string
  label: string
  color: string
  position: { x: number; y: number }
  size: { w: number; h: number }
}

export type DialogueCondition =
  | { type: 'flag'; flag: string; value: boolean }
  | { type: 'item'; itemId: string; count: number; op: '>=' | '<' | '==' }
  | { type: 'skill'; skillId: string; level: number; op: '>=' | '<' }
  | { type: 'spirit'; species: string; inParty?: boolean }
  | { type: 'time'; phase: 'dawn' | 'day' | 'dusk' | 'night' }
  | { type: 'and'; conditions: DialogueCondition[] }
  | { type: 'or'; conditions: DialogueCondition[] }

export type DialogueAction =
  | { type: 'setFlag'; flag: string; value: boolean }
  | { type: 'giveItem'; itemId: string; count: number }
  | { type: 'removeItem'; itemId: string; count: number }
  | { type: 'startBattle'; trainerId: string }
  | { type: 'openShop'; shopId: string }
  | { type: 'heal' }
  | { type: 'teleport'; zoneId: string; tileX: number; tileY: number }
  | { type: 'playSound'; soundId: string }
  | { type: 'setEmotion'; npcId: string; emotion: string }
  | { type: 'giveRandomSeed' }

export interface DialogueEdge {
  id: string
  from: string
  to: string
  fromPort?: string
}

export interface VoiceProfile {
  id: string
  name: string
  pitch: number
  pitchVariance: number
  speed: number
  syllableSet: 'vowel-heavy' | 'consonant-heavy' | 'balanced' | 'breathy' | 'sharp'
  tone: 'warm' | 'cold' | 'neutral' | 'raspy' | 'cheerful'
  volume: number
  reverb?: number
}

// Node color scheme
export const NODE_COLORS: Record<DialogueNodeType, { bg: string; border: string; text: string }> = {
  text:      { bg: '#1a2744', border: '#4a7ccc', text: '#8ab4f8' },
  choice:    { bg: '#2a2410', border: '#d4a843', text: '#f0d070' },
  condition: { bg: '#1a2a1a', border: '#4caf50', text: '#81c784' },
  action:    { bg: '#2a1a1a', border: '#e57373', text: '#ef9a9a' },
  reroute:   { bg: '#2a2a2a', border: '#888888', text: '#aaaaaa' },
}

// Helper to create unique IDs
let _idCounter = 0
export function generateId(prefix = 'node'): string {
  return `${prefix}_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`
}

// Default empty graph
export function createEmptyGraph(npcId: string, graphId?: string): DialogueGraph {
  const entryId = generateId('text')
  return {
    id: graphId ?? generateId('graph'),
    npcId,
    entryNodeId: entryId,
    nodes: [
      {
        id: entryId,
        type: 'text',
        position: { x: 300, y: 200 },
        data: { speaker: npcId, text: 'Hello there!' } as TextNodeData,
      },
    ],
    edges: [],
  }
}
